import { join, dirname } from 'path';
import { homedir } from 'os';
import { mkdirSync, openSync, writeSync, closeSync, unlinkSync, renameSync, constants } from 'fs';

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = path + '.' + process.pid + '.tmp';
  try { unlinkSync(tmp); } catch {}
  const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW, 0o600);
  try { writeSync(fd, content); } finally { closeSync(fd); }
  renameSync(tmp, path);
}

export function getThemePath(): string {
  return join(homedir(), '.claude', 'statusline-theme.json');
}

export function getSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}
