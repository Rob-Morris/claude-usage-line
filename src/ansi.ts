export const RST = '\x1b[0m';
export const DIM = '\x1b[2m';
export const RED = '\x1b[31m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const MAGENTA = '\x1b[35m';
export const BLUE = '\x1b[34m';
export const CYAN = '\x1b[36m';

export function colorByThreshold(pct: number, base: string): string {
  if (pct >= 80) return RED;
  if (pct >= 50) return YELLOW;
  return base;
}

export function dim(s: string): string {
  return DIM + s + RST;
}
