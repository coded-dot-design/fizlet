// Pixel stage: a hand-built gallery piece draws its whole scene as palette indices into one small
// buffer (one byte per art pixel), pushed to a canvas the size of the art and scaled up crisp by CSS
// (image-rendering: pixelated). No anti-aliasing, no colour outside the palette, nothing allocated
// per frame. The same buffer, run headless, becomes the piece's still poster (an SVG of flat runs).
// Shared by the hand-built pieces in this folder; scenes stay in their own modules.
import type { Ledger } from "../../../src/kernel/index";

export interface Pixels {
  w: number;
  h: number;
  /** Palette indices, row by row. */
  px: Uint8Array;
}
/** A sprite as data: rows of characters, a map from character to palette index; anything else is clear. */
export interface Art {
  w: number;
  h: number;
  /** Palette index per pixel; 255: clear. */
  d: Uint8Array;
}
export const CLEAR = 255;

export const pixels = (w: number, h: number): Pixels => ({ w, h, px: new Uint8Array(w * h) });

/** Rows of characters to an Art (built once, at load). */
export function art(rows: string[], map: Record<string, number>): Art {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length, d = new Uint8Array(w * h).fill(CLEAR);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch in map && (d[y * w + x] = map[ch]!)));
  return { w, h, d };
}

/** A filled rectangle, clipped to the buffer. */
export function fill(p: Pixels, x: number, y: number, w: number, h: number, c: number) {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0), x1 = Math.min(p.w, (x + w) | 0), y1 = Math.min(p.h, (y + h) | 0);
  for (let j = y0; j < y1; j++) p.px.fill(c, j * p.w + x0, j * p.w + x1);
}

/** One pixel, clipped. */
export function dot(p: Pixels, x: number, y: number, c: number) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x >= 0 && y >= 0 && x < p.w && y < p.h) p.px[y * p.w + x] = c;
}

/** The index at a pixel (CLEAR off the buffer). */
export const at = (p: Pixels, x: number, y: number) => (x >= 0 && y >= 0 && x < p.w && y < p.h ? p.px[y * p.w + x]! : CLEAR);

/** A one-pixel line (DDA), the head in `c`, the rest in `tail`. */
export function line(p: Pixels, x0: number, y0: number, x1: number, y1: number, c: number, tail = c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i < n; i++) dot(p, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, tail);
  dot(p, x1, y1, c);
}

/** Blit an Art with its top left at (x, y); `flip` mirrors it. */
export function blit(p: Pixels, a: Art, x: number, y: number, flip = false) {
  x |= 0;
  y |= 0;
  for (let j = 0; j < a.h; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= p.h) continue;
    for (let i = 0; i < a.w; i++) {
      const c = a.d[j * a.w + (flip ? a.w - 1 - i : i)]!, xx = x + i;
      if (c !== CLEAR && xx >= 0 && xx < p.w) p.px[yy * p.w + xx] = c;
    }
  }
}

/** Hex colours to the 32-bit pixels ImageData takes (little-endian ABGR); "" is clear. */
function lut(palette: readonly string[]) {
  const t = new Uint32Array(256);
  palette.forEach((h, i) => {
    if (!h) return;
    const n = parseInt(h.slice(1), 16);
    t[i] = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
  });
  return t;
}

/**
 * The live canvas: the art's own size, stretched over `parent` and scaled crisp, added through the
 * ledger (Recall removes it). `show()` pushes the buffer (call it in render, when something changed).
 */
export function pixelCanvas(ledger: Ledger, parent: HTMLElement, p: Pixels, palette: readonly string[]) {
  const canvas = ledger.add(document.createElement("canvas"));
  canvas.width = p.w;
  canvas.height = p.h;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  parent.append(canvas);
  const ctx = canvas.getContext("2d")!, img = ctx.createImageData(p.w, p.h), out = new Uint32Array(img.data.buffer), t = lut(palette), px = p.px;
  return {
    canvas,
    show() {
      for (let i = 0; i < px.length; i++) out[i] = t[px[i]!]!;
      ctx.putImageData(img, 0, 0);
    },
  };
}

/**
 * The poster: the buffer as an SVG of flat rectangles (runs of one colour, merged down while the
 * row below repeats them), crisp at any size. Clear pixels ("" in the palette) are left out.
 */
export function posterSVG(p: Pixels, palette: readonly string[], cls: string) {
  const { w, h, px } = p, open = new Map<string, [number, number, number, number, number]>(), done: [number, number, number, number, number][] = [];
  for (let y = 0; y < h; y++) {
    const seen = new Set<string>();
    for (let x = 0; x < w; ) {
      const c = px[y * w + x]!;
      let e = x + 1;
      while (e < w && px[y * w + e] === c) e++;
      if (palette[c]) {
        const k = `${x},${e},${c}`, r = open.get(k);
        if (r && r[1] + r[3] === y) r[3]++;
        else open.set(k, [x, y, e - x, 1, c]);
        seen.add(k);
      }
      x = e;
    }
    for (const [k, r] of open) if (!seen.has(k)) (done.push(r), open.delete(k));
  }
  done.push(...open.values());
  // Fewest bytes: one path per colour ("M x y h w v h h -w z" per rect).
  const by = new Map<number, string>();
  for (const [x, y, rw, rh, c] of done) by.set(c, (by.get(c) ?? "") + `M${x} ${y}h${rw}v${rh}h-${rw}z`);
  let s = `<svg class="ae-slot__placeholder ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">`;
  for (const [c, d] of [...by].sort((a, b) => a[0] - b[0])) s += `<path fill="${palette[c]}" d="${d}"/>`;
  return s + "</svg>";
}
