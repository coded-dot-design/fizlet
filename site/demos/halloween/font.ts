// Halloween heroes: the 3 × 5 pixel font (scores, pop words) and a flat pixel disc. Its own
// module, so the page scene (haunt) takes it without the arcade core.
import { PAL } from "./art";

// Glyphs, rows top to bottom, 3 bits a row.
const CH = "0123456789+!ABCEFILMOPSTZHKWx";
const F = [31599, 11415, 29671, 29647, 23497, 31183, 31215, 29330, 31727, 31695, 1488, 9346, 31725, 27566, 31015, 31143, 31140, 29847, 18727, 24557, 31599, 31716, 31183, 29842, 29351, 23533, 23469, 23549, 2728];
/** `str` in the pixel font at (x, y), `k` px a font pixel. No allocation (char codes, no slices). */
export function text(c: CanvasRenderingContext2D, str: string, x: number, y: number, col: number, k = 1) {
  c.fillStyle = PAL[col]!;
  for (let i = 0; i < str.length; i++, x += 4 * k) {
    const b = F[CH.indexOf(str[i]!)] ?? 0;
    for (let p = 0; p < 15; p++) if (b & (1 << (14 - p))) c.fillRect(x + (p % 3) * k, y + ((p / 3) | 0) * k, k, k);
  }
}
/** A whole number in the pixel font, right-aligned at x. */
export function num(c: CanvasRenderingContext2D, n: number, x: number, y: number, col: number, k = 1) {
  do text(c, CH[n % 10]!, (x -= 4 * k), y, col, k), (n = (n / 10) | 0);
  while (n > 0);
}
/** A filled pixel disc (one rect a row: flat, no anti-aliasing). */
export function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  for (let d = -r; d <= r; d++) {
    const h = Math.round(Math.sqrt(r * r - d * d));
    c.fillRect(Math.round(x - h), Math.round(y + d), h * 2 + 1, 1);
  }
}
