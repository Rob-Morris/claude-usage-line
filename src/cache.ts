import { readFileSync, unlinkSync, statSync, openSync, writeSync, closeSync, lstatSync, mkdirSync, constants } from 'fs';
import { dirname } from 'path';
import { getCachePath, atomicWrite } from './platform.js';
import type { CachedUsage, RateLimitBucket } from './types.js';

const CACHE_TTL = 60; // seconds
const LOCK_TTL = 30_000; // ms

const O_NOFOLLOW = constants.O_NOFOLLOW ?? 0;

function safeWriteExclusive(path: string, data: string, mode: number): void {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | O_NOFOLLOW, mode);
  try { writeSync(fd, data); } finally { closeSync(fd); }
}

export function isRateLimitBucket(v: unknown): v is RateLimitBucket {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.utilization === 'number' && typeof obj.resets_at === 'string';
}

function validateCached(raw: unknown): CachedUsage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.fetched_at !== 'number') return null;
  return {
    five_hour: isRateLimitBucket(obj.five_hour) ? obj.five_hour : null,
    seven_day: isRateLimitBucket(obj.seven_day) ? obj.seven_day : null,
    fetched_at: obj.fetched_at,
  };
}

export function readCache(): CachedUsage | null {
  try {
    const cachePath = getCachePath();
    if (lstatSync(cachePath).isSymbolicLink()) return null;
    const data = readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(data);
    return validateCached(parsed);
  } catch {
    return null;
  }
}

export function isCacheStale(cached: CachedUsage | null): boolean {
  if (!cached) return true;
  return (Date.now() / 1000 - cached.fetched_at) >= CACHE_TTL;
}

export function writeCache(usage: CachedUsage): void {
  atomicWrite(getCachePath(), JSON.stringify(usage));
}

// --- Fetch lock (thundering herd prevention) ---

function getLockPath(): string {
  return getCachePath() + '.lock';
}

export function acquireFetchLock(): boolean {
  const lockPath = getLockPath();
  // Stale lock cleanup
  try {
    const st = statSync(lockPath);
    if (Date.now() - st.mtimeMs > LOCK_TTL) {
      try { unlinkSync(lockPath); } catch {}
    } else {
      return false;
    }
  } catch {}

  try {
    mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
    safeWriteExclusive(lockPath, String(process.pid), 0o600);
    return true;
  } catch { return false; }
}

export function releaseFetchLock(): void {
  try {
    const lockPath = getLockPath();
    const st = lstatSync(lockPath);
    if (st.isSymbolicLink()) return;
    const content = readFileSync(lockPath, 'utf-8').trim();
    if (content === String(process.pid)) unlinkSync(lockPath);
  } catch {}
}
