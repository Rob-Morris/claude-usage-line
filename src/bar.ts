import { DIM, RST, colorByThreshold } from './ansi.js';
import type { BarStyle } from './types.js';

export function renderBar(pct: number, baseColor: string, style: BarStyle): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const fill = Math.min(Math.round((clamped / 100) * style.width), style.width);
  const color = colorByThreshold(clamped, baseColor);
  return (
    color +
    style.filled.repeat(fill) +
    DIM() +
    style.empty.repeat(style.width - fill) +
    RST +
    ' ' +
    color +
    Math.floor(clamped) +
    '%' +
    RST
  );
}
