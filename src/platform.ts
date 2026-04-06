import { join, dirname } from 'path';
import { homedir, platform } from 'os';
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

export type Platform = 'darwin' | 'linux' | 'win32';

export function getPlatform(): Platform {
  const p = platform();
  if (p === 'darwin' || p === 'linux' || p === 'win32') return p;
  return 'linux'; // fallback
}

export function getCachePath(): string {
  const p = getPlatform();
  const home = homedir();
  if (p === 'win32') {
    const appData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return join(appData, 'robmorris-claude-usage-line', 'cache.json');
  }
  if (p === 'darwin') {
    return join(home, 'Library', 'Caches', 'robmorris-claude-usage-line', 'cache.json');
  }
  const xdgCache = process.env.XDG_CACHE_HOME || join(home, '.cache');
  return join(xdgCache, 'robmorris-claude-usage-line', 'cache.json');
}

export function getThemePath(): string {
  return join(homedir(), '.claude', 'statusline-theme.json');
}

export function getSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}
