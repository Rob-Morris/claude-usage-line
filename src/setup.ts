import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, sep } from 'path';
import { getSettingsPath, getThemePath, atomicWrite } from './platform.js';
import { isValidThemeName } from './theme.js';

function parseSetupFlags(args: string[]): { themeName: string | null; force: boolean } {
  let themeName: string | null = null;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--force') {
      force = true;
    } else if (arg === '--theme' && i + 1 < args.length) {
      themeName = args[++i];
    } else if (arg.startsWith('--theme=')) {
      themeName = arg.slice('--theme='.length);
    }
  }
  return { themeName, force };
}

// The old default statusline command. Claude Code re-runs the statusline
// command up to every ~300ms, and `npx` boots the entire npm CLI on each run,
// which can pin a CPU core — so setup now writes a direct node invocation and
// migrates this legacy command automatically.
const LEGACY_NPX_COMMAND = 'npx @robmorris/claude-usage-line';

// A command whose leading tokens invoke this package's CLI: a runtime (quoted
// or bare) followed by a path ending in claude-usage-line/dist/cli.js, or the
// bare bin name from the README's manual-config instructions. Anchored to the
// start of the command so wrapper commands that merely mention the path
// somewhere are not claimed as ours.
const OWN_CLI_INVOCATION =
  /^(?:(?:"[^"]+"|\S+) (?:"[^"]*[/\\]claude-usage-line[/\\]dist[/\\]cli\.js"|\S*[/\\]claude-usage-line[/\\]dist[/\\]cli\.js)|claude-usage-line)(?= |$)/;

// Returns the arguments trailing a statusline command this tool wrote (or its
// README documents), or null for commands that are not ours. The absolute
// paths setup writes go stale when the Node version or install location
// changes, so setup must reclaim its own stale commands without --force.
function matchOwnCommand(existing: unknown): string | null {
  if (typeof existing !== 'string') return null;
  if (existing.startsWith(LEGACY_NPX_COMMAND) &&
      (existing.length === LEGACY_NPX_COMMAND.length || existing[LEGACY_NPX_COMMAND.length] === ' ')) {
    return existing.slice(LEGACY_NPX_COMMAND.length);
  }
  const invocation = existing.match(OWN_CLI_INVOCATION);
  return invocation ? existing.slice(invocation[0].length) : null;
}

export function runSetup(args: string[] = []): void {
  const { themeName, force } = parseSetupFlags(args);

  if (themeName && !isValidThemeName(themeName)) {
    process.stderr.write('Invalid theme name: ' + themeName + '\n');
    process.exit(1);
  }

  const settingsPath = getSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });

  const cliCommand = '"' + process.execPath + '" "' + join(__dirname, 'cli.js') + '"';

  // Running from npm's npx cache means the path written below can be evicted
  // by npm at any time, leaving a blank statusline.
  if (__dirname.split(sep).includes('_npx')) {
    process.stderr.write(
      'Warning: setup is running from npm\'s npx cache; the path it records can\n' +
      'be evicted by npm. For a stable path, install globally and re-run setup:\n' +
      '  npm install -g @robmorris/claude-usage-line\n'
    );
  }

  // Only a missing file may be treated as a fresh install. Anything else
  // (unreadable file, invalid JSON, non-object JSON) must abort: atomicWrite
  // replaces the whole file, so proceeding would destroy the user's settings.
  let settings: Record<string, unknown> = {};
  let rawSettings: string | null = null;
  try {
    rawSettings = readFileSync(settingsPath, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      process.stderr.write('Error: could not read ' + settingsPath + ': ' + (e as Error).message + '\n');
      process.exit(1);
    }
  }
  if (rawSettings !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSettings);
    } catch {
      parsed = undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      process.stderr.write(
        'Error: ' + settingsPath + ' exists but is not a valid JSON object.\n' +
        'Refusing to overwrite it — fix or remove the file, then re-run setup.\n'
      );
      process.exit(1);
    }
    settings = parsed as Record<string, unknown>;
  }

  const statusLine = settings.statusLine as Record<string, unknown> | undefined;
  const existing = statusLine?.command;

  const ownCommandSuffix = matchOwnCommand(existing);
  let desired = cliCommand;
  if (ownCommandSuffix !== null) {
    // Carry the user's existing arguments over verbatim; a newly requested
    // --theme replaces any carried-over theme flag but keeps the rest.
    let suffix = ownCommandSuffix;
    if (themeName) {
      suffix = suffix.replace(/ --theme(?:=\S+| +\S+)?/g, '') + ' --theme ' + themeName;
    }
    desired = cliCommand + suffix;
  } else if (themeName) {
    desired += ' --theme ' + themeName;
  }

  if (existing === desired) {
    process.stdout.write('Already configured in ' + settingsPath + '\n');
  } else if (typeof existing === 'string' && existing.length > 0 && !force && ownCommandSuffix === null) {
    process.stdout.write(
      'Existing statusLine.command: ' + existing + '\n' +
      'Would replace with: ' + desired + '\n' +
      'Use --force to overwrite.\n'
    );
    return;
  } else {
    if (typeof existing === 'string' && existing.length > 0) {
      process.stdout.write(
        'Replacing statusLine.command: ' + existing + '\n' +
        'With: ' + desired + '\n'
      );
    }
    settings.statusLine = { type: 'command', command: desired };
    atomicWrite(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    process.stdout.write('Configured statusLine in ' + settingsPath + '\n');
  }

  const themePath = getThemePath();
  const themeSourceName = themeName || 'default';
  const themeSourcePath = join(__dirname, '..', 'themes', themeSourceName + '.json');

  const themeExists = existsSync(themePath);
  if (themeExists && !force) {
    process.stdout.write('Theme file already exists at ' + themePath + '\n');
  } else {
    try {
      const themeContent = readFileSync(themeSourcePath, 'utf-8');
      atomicWrite(themePath, themeContent);
      process.stdout.write((themeExists ? 'Overwrote' : 'Created') + ' theme file at ' + themePath + '\n');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        process.stderr.write('Warning: theme file not found: ' + themeSourcePath + '\n');
        return;
      }
      process.stderr.write('Warning: could not create theme file: ' + (e as Error).message + '\n');
    }
  }
}
