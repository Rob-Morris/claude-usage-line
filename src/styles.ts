import type { BarStyle } from './types.js';

export const STYLES: ReadonlyMap<string, BarStyle> = new Map([
  ['classic', { name: 'classic', filled: '█', empty: '░', width: 8, separator: '│', resetIcon: '⟳' }],
  ['dot',     { name: 'dot',     filled: '●', empty: '○', width: 8, separator: '│', resetIcon: '⟳' }],
  ['braille', { name: 'braille', filled: '⣿', empty: '⣀', width: 8, separator: '│', resetIcon: '⟳' }],
  ['block',   { name: 'block',   filled: '▰', empty: '▱', width: 10, separator: '│', resetIcon: '⟳' }],
  ['ascii',   { name: 'ascii',   filled: '#', empty: '-', width: 10, separator: '|', resetIcon: '~' }],
  ['square',  { name: 'square',  filled: '▪', empty: '·', width: 10, separator: '│', resetIcon: '⟳' }],
  ['pipe',    { name: 'pipe',    filled: '┃', empty: '╌', width: 8, separator: '┃', resetIcon: '↻' }],
]);

export const DEFAULT_STYLE = 'classic';

export function getStyle(name: string): BarStyle | undefined {
  return STYLES.get(name);
}

export function styleNames(): string[] {
  return [...STYLES.keys()];
}
