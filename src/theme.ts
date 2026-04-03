import { readFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { getThemePath } from './platform.js';
import { VALID_HIDE_FIELDS } from './types.js';
import type { ThemeConfig, ThemeColors, BarStyle, HiddenField } from './types.js';

export const DEFAULTS: Readonly<Record<keyof ThemeColors, string>> = {
  context: '\x1b[35m',
  five_hour: '\x1b[36m',
  seven_day: '\x1b[32m',
  cwd: '\x1b[34m',
  branch: '\x1b[32m',
  model: '\x1b[35m',
  cost: '\x1b[33m',
  diff_add: '\x1b[32m',
  diff_remove: '\x1b[31m',
  duration: '\x1b[34m',
  five_hour_reset: '',
  seven_day_reset: '',
  dim: '\x1b[2m',
  warn: '\x1b[33m',
  danger: '\x1b[31m',
};

const NAMED: Readonly<Record<string, string>> = {
  black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
  bright_black: '\x1b[90m', bright_red: '\x1b[91m', bright_green: '\x1b[92m',
  bright_yellow: '\x1b[93m', bright_blue: '\x1b[94m', bright_magenta: '\x1b[95m',
  bright_cyan: '\x1b[96m', bright_white: '\x1b[97m',
};

let cachedMerged: ThemeConfig | null | undefined;
const resolvedColors = new Map<string, string>();

function parseAnsi(value: string): string {
  const lower = value.toLowerCase().trim();
  if (NAMED[lower]) return NAMED[lower];
  if (value.includes('\x1b') || value.includes('\\x1b') || value.includes('\\e') || value.includes('\\033')) {
    return value
      .replace(/\\x1b/g, '\x1b')
      .replace(/\\e/g, '\x1b')
      .replace(/\\033/g, '\x1b');
  }
  const m256 = lower.match(/^256:(\d+)$/);
  if (m256) {
    const idx = Number(m256[1]);
    if (idx >= 0 && idx <= 255) return `\x1b[38;5;${idx}m`;
    return '';
  }
  const mRgb = lower.match(/^rgb:(\d+),(\d+),(\d+)$/);
  if (mRgb) {
    const [r, g, b] = [Number(mRgb[1]), Number(mRgb[2]), Number(mRgb[3])];
    if (r > 255 || g > 255 || b > 255) return '';
    return `\x1b[38;2;${r};${g};${b}m`;
  }
  return '';
}

function loadJsonSafe(path: string): ThemeConfig | null {
  try {
    if (lstatSync(path).isSymbolicLink()) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as ThemeConfig;
  } catch {
    return null;
  }
}

function mergeThemes(base: ThemeConfig | null, overlay: ThemeConfig | null): ThemeConfig | null {
  if (!base && !overlay) return null;
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    style: { ...base.style, ...overlay.style },
    colors: { ...base.colors, ...overlay.colors },
    hide: overlay.hide ?? base.hide,
  };
}

let baseThemePath: string | null = null;

function shippedThemePath(themeName: string): string {
  return join(__dirname, '..', 'themes', themeName + '.json');
}

const THEME_NAME_RE = /^[a-z0-9][a-z0-9-]*$/i;

export function isValidThemeName(name: string): boolean {
  return THEME_NAME_RE.test(name);
}

/** Must be called before first loadTheme(). */
export function setBaseTheme(themeName: string): void {
  baseThemePath = shippedThemePath(themeName);
}

export function getBaseThemePath(themeName: string): string {
  return shippedThemePath(themeName);
}

export function loadTheme(): ThemeConfig | null {
  if (cachedMerged !== undefined) return cachedMerged;
  const base = baseThemePath ? loadJsonSafe(baseThemePath) : null;
  const user = loadJsonSafe(getThemePath());
  cachedMerged = mergeThemes(base, user);
  return cachedMerged;
}

export function applyThemeToStyle(base: BarStyle): BarStyle {
  const theme = loadTheme();
  if (!theme?.style) return base;
  return {
    name: base.name,
    filled: theme.style.filled ?? base.filled,
    empty: theme.style.empty ?? base.empty,
    width: Math.max(1, Math.min(50, Number(theme.style.width) || base.width)),
    separator: theme.style.separator ?? base.separator,
    resetIcon: theme.style.resetIcon ?? base.resetIcon,
  };
}

export function themeColor(key: keyof ThemeColors): string {
  const cached = resolvedColors.get(key);
  if (cached !== undefined) return cached;

  const fallback = DEFAULTS[key];
  const theme = loadTheme();
  const val = theme?.colors?.[key];
  const result = val ? (parseAnsi(val) || fallback) : fallback;
  resolvedColors.set(key, result);
  return result;
}

export function themeHideFields(): Set<HiddenField> {
  const theme = loadTheme();
  if (!theme?.hide) return new Set();
  const result = new Set<HiddenField>();
  for (const f of theme.hide) {
    if (VALID_HIDE_FIELDS.has(f as HiddenField)) result.add(f as HiddenField);
  }
  return result;
}
