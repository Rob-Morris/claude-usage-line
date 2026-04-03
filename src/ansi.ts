import { themeColor } from './theme.js';

export const RST = '\x1b[0m';

export function DIM(): string { return themeColor('dim'); }
export function CONTEXT_COLOR(): string { return themeColor('context'); }
export function FIVE_HOUR_COLOR(): string { return themeColor('five_hour'); }
export function SEVEN_DAY_COLOR(): string { return themeColor('seven_day'); }
export function CWD_COLOR(): string { return themeColor('cwd'); }
export function BRANCH_COLOR(): string { return themeColor('branch'); }
export function MODEL_COLOR(): string { return themeColor('model'); }
export function COST_COLOR(): string { return themeColor('cost'); }
export function DIFF_ADD_COLOR(): string { return themeColor('diff_add'); }
export function DIFF_REMOVE_COLOR(): string { return themeColor('diff_remove'); }
export function DURATION_COLOR(): string { return themeColor('duration'); }
export function FIVE_HOUR_RESET_COLOR(): string { return themeColor('five_hour_reset'); }
export function SEVEN_DAY_RESET_COLOR(): string { return themeColor('seven_day_reset'); }
export function WARN_COLOR(): string { return themeColor('warn'); }
export function DANGER_COLOR(): string { return themeColor('danger'); }

export function colorByThreshold(pct: number, base: string): string {
  if (pct >= 80) return DANGER_COLOR();
  if (pct >= 50) return WARN_COLOR();
  return base;
}

export function dim(s: string): string {
  return DIM() + s + RST;
}
