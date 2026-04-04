import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
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

export function runSetup(args: string[] = []): void {
  const { themeName, force } = parseSetupFlags(args);

  if (themeName && !isValidThemeName(themeName)) {
    process.stderr.write('Invalid theme name: ' + themeName + '\n');
    process.exit(1);
  }

  const settingsPath = getSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });

  let desired = 'npx @robmorris/claude-usage-line';
  if (themeName) desired += ' --theme ' + themeName;

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      settings = {};
    }
  } catch {
    // file doesn't exist or invalid JSON
  }

  const statusLine = settings.statusLine as Record<string, unknown> | undefined;
  const existing = statusLine?.command;

  if (existing === desired) {
    process.stdout.write('Already configured in ' + settingsPath + '\n');
  } else if (typeof existing === 'string' && existing.length > 0 && !force) {
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
