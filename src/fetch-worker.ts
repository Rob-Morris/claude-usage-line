import { writeCache, releaseFetchLock, isRateLimitBucket } from './cache.js';
import type { CachedUsage, RateLimitBucket } from './types.js';

// Hard lifetime cap — kill worker if it hangs
setTimeout(() => process.exit(1), 15_000);

// Always release lock on exit
process.on('exit', () => releaseFetchLock());

const API_URL = 'https://api.anthropic.com/api/oauth/usage';
const MAX_STDIN = 8 * 1024;
const MAX_RESPONSE = 1024 * 1024;

function clampBucket(b: RateLimitBucket): RateLimitBucket {
  return {
    utilization: Math.max(0, Math.min(100, b.utilization)),
    resets_at: b.resets_at,
  };
}

function isValidBucket(v: unknown): v is RateLimitBucket {
  if (!isRateLimitBucket(v)) return false;
  return !isNaN(Date.parse(v.resets_at));
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += (chunk as Buffer).length;
    if (total > MAX_STDIN) process.exit(1);
    chunks.push(chunk as Buffer);
  }
  const token = Buffer.concat(chunks).toString('utf-8').trim();
  if (!token) process.exit(1);

  const resp = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': `claude-usage-line/${__VERSION__}`,
      Authorization: `Bearer ${token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) process.exit(1);

  const text = await resp.text();
  if (text.length > MAX_RESPONSE) process.exit(1);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    process.exit(1);
  }

  const usage = body as Record<string, unknown>;
  const cached: CachedUsage = {
    five_hour: isValidBucket(usage.five_hour) ? clampBucket(usage.five_hour) : null,
    seven_day: isValidBucket(usage.seven_day) ? clampBucket(usage.seven_day) : null,
    fetched_at: Date.now() / 1000,
  };

  if (!cached.five_hour && !cached.seven_day) process.exit(1);
  writeCache(cached);
}

main().catch(() => process.exit(1));
