import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getSettingsPath } from './platform.js';

export function runSetup(): void {
  const settingsPath = getSettingsPath();
  const dir = dirname(settingsPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

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
  const desired = 'npx claude-usage-line';

  if (existing === desired) {
    process.stdout.write('Already configured in ' + settingsPath + '\n');
    return;
  }

  if (typeof existing === 'string' && existing.length > 0) {
    process.stdout.write(
      'Existing statusLine.command: ' + existing + '\n' +
      'Replacing with: ' + desired + '\n'
    );
  }

  settings.statusLine = { type: 'command', command: desired };
  const content = JSON.stringify(settings, null, 2) + '\n';
  const tmp = settingsPath + '.tmp';
  writeFileSync(tmp, content, { encoding: 'utf-8', mode: 0o600 });
  renameSync(tmp, settingsPath);
  process.stdout.write('Configured statusLine in ' + settingsPath + '\n');
}
