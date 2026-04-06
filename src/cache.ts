import { readFileSync, lstatSync } from 'fs';
import { getCachePath, atomicWrite } from './platform.js';
import { parseRateLimitBucket } from './types.js';
import type { InputRateLimitBucket } from './types.js';

export interface CachedRateLimits {
  five_hour?: InputRateLimitBucket;
  seven_day?: InputRateLimitBucket;
}

function validateCacheFile(raw: unknown): CachedRateLimits | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const result: CachedRateLimits = {};
  const fh = parseRateLimitBucket(obj.five_hour);
  const sd = parseRateLimitBucket(obj.seven_day);
  if (fh) result.five_hour = fh;
  if (sd) result.seven_day = sd;
  if (!result.five_hour && !result.seven_day) return null;
  return result;
}

function isBucketExpired(bucket: InputRateLimitBucket): boolean {
  return Date.now() >= bucket.resets_at * 1000;
}

export function readCache(): CachedRateLimits | null {
  try {
    const cachePath = getCachePath();
    if (lstatSync(cachePath).isSymbolicLink()) return null;
    const data = readFileSync(cachePath, 'utf-8');
    const cached = validateCacheFile(JSON.parse(data));
    if (!cached) return null;

    const result: CachedRateLimits = {};
    if (cached.five_hour && !isBucketExpired(cached.five_hour)) result.five_hour = cached.five_hour;
    if (cached.seven_day && !isBucketExpired(cached.seven_day)) result.seven_day = cached.seven_day;
    if (!result.five_hour && !result.seven_day) return null;
    return result;
  } catch {
    return null;
  }
}

export function writeCache(rateLimits: CachedRateLimits): void {
  try {
    const cachePath = getCachePath();
    const newData = JSON.stringify(rateLimits);
    try {
      if (readFileSync(cachePath, 'utf-8') === newData) return;
    } catch {}
    atomicWrite(cachePath, newData);
  } catch {}
}
