import { execFileSync } from 'child_process';

export function getGitBranch(cwd: string): string | null {
  try {
    return execFileSync('git', ['-C', cwd, 'symbolic-ref', '--short', 'HEAD'], {
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim() || null;
  } catch {
    // Detached HEAD — fall back to short SHA
    try {
      const sha = execFileSync('git', ['-C', cwd, 'rev-parse', '--short', 'HEAD'], {
        timeout: 1000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim();
      return sha ? ':' + sha : null;
    } catch {
      return null;
    }
  }
}
