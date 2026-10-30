// Comic lettering and outlined sprites for the pixel-buffer pieces (#047 Gecko, #048 spin
// it back): a 5 × 5 font drawn into a palette buffer (./pixel-stage.ts) with a rim, an extrude down
// and right, and the face; and a one-pixel rim added around a sprite once, at load. Each piece
// passes only the glyphs it shouts, so a piece carries no letters it never says.
import { CLEAR, fill, type Art, type Pixels } from "./pixel-stage";

/** A 5 × 5 font: per glyph, 25 characters row by row ("1": lit). */
export type Font = Record<string, string>;

/** The same sprite with a one-pixel outline in `c` all round (w + 2 × h + 2). Made once, at load. */
export function outline(a: Art, c: number): Art {
  const w = a.w + 2, h = a.h + 2, d = new Uint8Array(w * h).fill(CLEAR);
  for (let pass = 0; pass < 2; pass++)
    for (let y = 0; y < a.h; y++)
      for (let x = 0; x < a.w; x++) {
        const v = a.d[y * a.w + x]!;
        if (v === CLEAR) continue;
        if (pass) d[(y + 1) * w + x + 1] = v;
        else for (let j = 0; j < 3; j++) d.fill(c, (y + j) * w + x, (y + j) * w + x + 3);
      }
  return { w, h, d };
}

/** Width in art px of `s` printed `k` art px a dot. */
export const sayW = (s: string, k = 1) => (s.length * 6 - 1) * k;

/**
 * Print `s` with its top left at (x, y), `k` art px a dot: a rim round every letter, an extrude one
 * dot down and right in `ext`, then the face. Whole pixels; nothing allocated.
 */
export function say(p: Pixels, f: Font, s: string, x: number, y: number, face: number, ext: number, rim: number, k = 1) {
  x = Math.round(x);
  y = Math.round(y);
  for (let pass = 0; pass < 3; pass++)
    for (let c = 0; c < s.length; c++) {
      const g = f[s[c]!];
      if (g)
        for (let r = 0; r < 25; r++) {
          if (g.charCodeAt(r) !== 49) continue;
          const px = x + (c * 6 + (r % 5)) * k, py = y + ((r / 5) | 0) * k;
          if (pass === 0) fill(p, px - 1, py - 1, 2 * k + 2, 2 * k + 2, rim);
          else if (pass === 1) fill(p, px + k, py + k, k, k, ext);
          else fill(p, px, py, k, k, face);
        }
    }
}
