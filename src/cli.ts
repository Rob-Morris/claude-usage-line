#!/usr/bin/env node

process.stdout.on('error', (e: NodeJS.ErrnoException) => { if (e.code === 'EPIPE') process.exit(0); throw e; });

import { existsSync } from 'fs';
import { renderStatusline, buildJSONOutput } from './statusline.js';
import { runSetup } from './setup.js';
import { getStyle, styleNames, DEFAULT_STYLE } from './styles.js';
import { setBaseTheme, getBaseThemePath, isValidThemeName, applyThemeToStyle, themeHideFields } from './theme.js';
import { readCache, writeCache } from './cache.js';
import { VALID_HIDE_FIELDS, parseRateLimitBucket } from './types.js';
import type { StatuslineInput, HiddenField } from './types.js';

const STDIN_TIMEOUT = 3000;
const MAX_STDIN = 64 * 1024;

function validateInput(raw: unknown): StatuslineInput {
  const fallback: StatuslineInput = { context_window: { used_percentage: 0 } };
  if (typeof raw !== 'object' || raw === null) return fallback;
  const obj = raw as Record<string, unknown>;
  const ctx = obj.context_window as Record<string, unknown> | undefined;
  if (!ctx) return fallback;

  const pct = typeof ctx.used_percentage === 'number' && Number.isFinite(ctx.used_percentage)
    ? ctx.used_percentage : 0;

  const result: StatuslineInput = {
    context_window: { used_percentage: pct },
  };

  if (typeof obj.cwd === 'string' && obj.cwd.length > 0) {
    result.cwd = obj.cwd;
  }

  const model = obj.model as Record<string, unknown> | undefined;
  if (model && typeof model === 'object') {
    if (typeof model.display_name === 'string' && model.display_name.length > 0) {
      result.model = { display_name: model.display_name };
    }
  }

  const cost = obj.cost as Record<string, unknown> | undefined;
  if (cost && typeof cost === 'object') {
    result.cost = {};
    if (typeof cost.total_lines_added === 'number') result.cost.total_lines_added = cost.total_lines_added;
    if (typeof cost.total_lines_removed === 'number') result.cost.total_lines_removed = cost.total_lines_removed;
    if (typeof cost.total_cost_usd === 'number') result.cost.total_cost_usd = cost.total_cost_usd;
    if (typeof cost.total_duration_ms === 'number') result.cost.total_duration_ms = cost.total_duration_ms;
  }

  const rl = obj.rate_limits as Record<string, unknown> | undefined;
  if (rl && typeof rl === 'object') {
    const fh = parseRateLimitBucket(rl.five_hour);
    const sd = parseRateLimitBucket(rl.seven_day);
    if (fh || sd) {
      result.rate_limits = {};
      if (fh) result.rate_limits.five_hour = fh;
      if (sd) result.rate_limits.seven_day = sd;
    }
  }

  return result;
}

function parseHide(raw: string): Set<HiddenField> {
  const result = new Set<HiddenField>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim() as HiddenField;
    if (VALID_HIDE_FIELDS.has(trimmed)) result.add(trimmed);
  }
  return result;
}

const SEPARATORS: Record<string, string> = {
  bullet: '•',
  pipe: '│',
  dot: '·',
  diamond: '◆',
  arrow: '›',
  star: '✦',
};

interface ParsedFlags {
  json: boolean;
  styleName: string;
  styleExplicit: boolean;
  themeName: string | null;
  hide: Set<HiddenField>;
  sep: string | null;
}

function parseFlags(args: string[]): ParsedFlags {
  let json = false;
  let styleName = DEFAULT_STYLE;
  let styleExplicit = false;
  let themeName: string | null = null;
  let hide = new Set<HiddenField>();
  let sep: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--style' && i + 1 < args.length) {
      styleName = args[++i];
      styleExplicit = true;
    } else if (arg.startsWith('--style=')) {
      styleName = arg.slice('--style='.length);
      styleExplicit = true;
    } else if (arg === '--theme' && i + 1 < args.length) {
      themeName = args[++i];
    } else if (arg.startsWith('--theme=')) {
      themeName = arg.slice('--theme='.length);
    } else if (arg === '--hide' && i + 1 < args.length) {
      hide = parseHide(args[++i]);
    } else if (arg.startsWith('--hide=')) {
      hide = parseHide(arg.slice('--hide='.length));
    } else if (arg === '--sep' && i + 1 < args.length) {
      sep = args[++i];
    } else if (arg.startsWith('--sep=')) {
      sep = arg.slice('--sep='.length);
    }
  }
  return { json, styleName, styleExplicit, themeName, hide, sep };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  const timeout = setTimeout(() => {
    process.stderr.write('stdin timeout\n');
    process.exit(1);
  }, STDIN_TIMEOUT);
  for await (const chunk of process.stdin) {
    total += (chunk as Buffer).length;
    if (total > MAX_STDIN) {
      clearTimeout(timeout);
      process.exit(1);
    }
    chunks.push(chunk as Buffer);
  }
  clearTimeout(timeout);
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'Usage: claude-usage-line [options]\n' +
      '       claude-usage-line setup [--theme <name>] [--force]\n\n' +
      'Options:\n' +
      '  --theme <name>  Use a shipped theme (e.g. dark-contrast)\n' +
      '  --style <name>  Bar style (classic, dot, braille, block, ascii, square, pipe)\n' +
      '  --hide <fields> Hide fields: cost,diff,duration,model,cwd,branch\n' +
      '  --sep <name>    Separator: bullet (default), pipe, dot, diamond, arrow, star\n' +
      '  --json          Output JSON\n' +
      '  --help          Show this help\n' +
      '  --version       Show version\n\n' +
      'Setup options:\n' +
      '  --theme <name>  Include --theme flag in statusline command and copy theme file\n' +
      '  --force         Overwrite existing configuration\n'
    );
    process.exit(0);
  }

  if (args.includes('--version')) {
    process.stdout.write(__VERSION__ + '\n');
    process.exit(0);
  }

  if (args[0] === 'setup') {
    runSetup(args.slice(1));
    return;
  }

  const { json, styleName, styleExplicit, themeName, hide: cliHide, sep } = parseFlags(args);

  if (themeName) {
    if (!isValidThemeName(themeName)) {
      process.stderr.write(`Invalid theme name: ${themeName}\n`);
      process.exit(1);
    }
    const themePath = getBaseThemePath(themeName);
    if (!existsSync(themePath)) {
      process.stderr.write(`Unknown theme: ${themeName}\nShipped themes are in the themes/ directory of the package.\n`);
      process.exit(1);
    }
    setBaseTheme(themeName);
  }

  if (!json) {
    const style = getStyle(styleName);
    if (!style) {
      process.stderr.write(`Unknown style: ${styleName}\nAvailable: ${styleNames().join(', ')}\n`);
      process.exit(1);
    }
  }

  const themeHide = themeHideFields();
  const hide = new Set<HiddenField>([...themeHide, ...cliHide]);

  const raw = await readStdin();
  let parsed: unknown = {};
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // invalid JSON — use defaults
    }
  }

  const input = validateInput(parsed);

  // Cache: write rate limits when present, read from cache when absent
  if (input.rate_limits?.five_hour || input.rate_limits?.seven_day) {
    writeCache({
      five_hour: input.rate_limits.five_hour ?? undefined,
      seven_day: input.rate_limits.seven_day ?? undefined,
    });
  } else if (!input.rate_limits) {
    const cached = readCache();
    if (cached) {
      input.rate_limits = {};
      if (cached.five_hour) input.rate_limits.five_hour = cached.five_hour;
      if (cached.seven_day) input.rate_limits.seven_day = cached.seven_day;
    }
  }

  if (json) {
    process.stdout.write(JSON.stringify(buildJSONOutput(input, hide)) + '\n');
  } else {
    // Precedence: styles.ts defaults → --theme (style+colors) → user theme file → --style flag → --sep flag
    // When --style is explicit, it wins for style properties (filled, empty, width, separator, resetIcon)
    // Theme still wins for colors regardless
    let style = styleExplicit ? getStyle(styleName)! : applyThemeToStyle(getStyle(styleName)!);
    if (sep) {
      const resolved = SEPARATORS[sep];
      if (!resolved) {
        process.stderr.write(`Unknown separator: ${sep}\nAvailable: ${Object.keys(SEPARATORS).join(', ')}\n`);
        process.exit(1);
      }
      style = { ...style, separator: resolved };
    }
    process.stdout.write(renderStatusline(input, style, hide) + '\n');
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.message ?? e) + '\n');
  process.exit(1);
});
