// @fzlt/core/backdrop: a painted backdrop behind a scene, drawn in code at an art size (flat shapes in
// the art's own pixels), fitted to any frame and cached: each layer is painted once per frame size
// into a canvas of its own, so a redraw costs one drawImage per layer. Layers slide with a pan at their
// own depth (parallax: far hills slow, near ones fast). Lifted from Holeshot's garage backdrops
// (src/garage/backdrop.ts: fitOf, poly, band, the packed traced field, backdropCache); the scenes'
// art stays in the game.
// - `fit(w, h, art, out)`: the art covers the frame, but never so close that its safe box (what must
//   show whole: a turntable, a player) leaves it; centred, then pushed only as far as the box needs.
// - `fill`, `band` and `unpack` draw shapes that run on past the art's left, right and bottom edges, so a
//   frame wider or taller than the art sees more of the same, never a gap.
// - Zero allocation per frame: `draw` blits the cached layers (a resize, a dpr change or `repaint()`
//   repaints them, outside the frame loop's steady state). Draw it from the render phase or a diorama
//   decal; it never touches the page (its canvases are its own, never in the document).

/** The art: its size in art px, and the box (x0, y0, x1, y1, art px) that must stay in the frame
 *  (none: the art just covers it). */
export interface BackdropArt {
  w: number;
  h: number;
  safe?: ArrayLike<number>;
}

/** The art in a w × h frame: out = [scale, dx, dy] (frame px = art px × scale + d). Cover the frame,
 *  shrunk only as far as the safe box needs to show whole; centred, then clamped so the box stays in. */
export function fit<T extends { [i: number]: number }>(w: number, h: number, art: BackdropArt, out: T): T {
  const S = art.safe;
  let s = w / art.w > h / art.h ? w / art.w : h / art.h;
  const cx = (w - art.w * s) / 2, cy = (h - art.h * s) / 2;
  out[0] = s; out[1] = cx; out[2] = cy;
  if (!S) return out;
  const x0 = S[0]!, y0 = S[1]!, x1 = S[2]!, y1 = S[3]!;
  if (w / (x1 - x0) < s) s = w / (x1 - x0);
  if (h / (y1 - y0) < s) s = h / (y1 - y0);
  // Centred, then the box's left edge on or right of the frame's (dx ≥ −x0·s) and its right edge on or
  // left of it (dx ≤ w − x1·s); the same down.
  const ax = (w - art.w * s) / 2, ay = (h - art.h * s) / 2, hx = w - x1 * s, hy = h - y1 * s;
  out[0] = s;
  out[1] = ax > hx ? hx : ax < -x0 * s ? -x0 * s : ax;
  out[2] = ay > hy ? hy : ay < -y0 * s ? -y0 * s : ay;
  return out;
}

/** How far past an art edge a shape that touches it runs on (art px). */
const FAR = 4000;

/** A filled polygon in art px ([x, y, …] points). Where an edge of it runs along the art's left, right
 *  or bottom edge (within 3 px), it runs on past it. */
export function fill(c: CanvasRenderingContext2D, art: BackdropArt, color: string, pts: ArrayLike<number>) {
  const W = art.w, H = art.h, n = pts.length >> 1;
  const edge = (i: number) => pts[i * 2]! < 2 || pts[i * 2]! > W - 3 || pts[i * 2 + 1]! > H - 3;
  const ox = (x: number) => (x < 2 ? -FAR : x > W - 3 ? W + FAR : x), oy = (y: number) => (y > H - 3 ? H + FAR : y);
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1, x = pts[i * 2]!, y = pts[i * 2 + 1]!;
    c.lineTo(x, y);
    if (edge(i) && edge(j)) c.lineTo(ox(x), oy(y)), c.lineTo(ox(pts[j * 2]!), oy(pts[j * 2 + 1]!));
  }
  c.fill();
}

/** A band across the whole width (and on past both sides), from art row y0 to y1. */
export function band(c: CanvasRenderingContext2D, art: BackdropArt, color: string, y0: number, y1: number) {
  c.fillStyle = color;
  c.fillRect(-FAR, y0, art.w + 2 * FAR, y1 - y0);
}

const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
/** Traced polygons, packed: space-separated shapes, each a palette digit then x, y pairs in two
 *  base-64 digits (art px 0..4095; `0-9A-Za-z-_`). Returns [[palette index, [x, y, …]], …] (build
 *  time); draw them with `fill`. */
export function unpack(s: string): [number, number[]][] {
  const n = (t: string, i: number) => B64.indexOf(t[i]!) * 64 + B64.indexOf(t[i + 1]!);
  return s.split(" ").filter(Boolean).map((t) => {
    const P: number[] = [];
    for (let i = 1; i + 3 < t.length; i += 4) P.push(n(t, i), n(t, i + 2));
    return [+t[0]!, P];
  });
}
/** Polygons in the same packing from `[palette index, [x, y, …]]` (whole art px), for tracing tools
 *  and fixtures: `unpack(pack(x))` gives x back. */
export function pack(shapes: ArrayLike<readonly [number, ArrayLike<number>]>): string {
  const d = (v: number) => B64[(v >> 6) & 63]! + B64[v & 63]!;
  return Array.from(shapes, ([k, P]) => String(k) + Array.from(P, (v) => d(Math.round(v))).join("")).join(" ");
}

/** One layer: paint it in art px (once per frame size); `depth` 0 (default) is fixed, 1 slides the
 *  whole pan (near), between is parallax. */
export interface BackdropLayer {
  paint(c: CanvasRenderingContext2D): void;
  depth?: number;
}
/** Options: the most the pan moves (CSS px either way, default 0: no parallax), and where canvases come
 *  from (default `document.createElement("canvas")`; an OffscreenCanvas maker works too). */
export interface BackdropOptions {
  pan?: number;
  canvas?: () => HTMLCanvasElement | OffscreenCanvas;
}

/** A backdrop of `layers` (back to front) for `art`. `draw(ctx, w, h, dpr, pan)` blits them to a
 *  context in CSS px (a diorama decal's, or one set with setTransform(dpr, …)), repainting a layer only
 *  when the size or dpr changed. */
export function backdrop(art: BackdropArt, layers: readonly BackdropLayer[], o: BackdropOptions = {}) {
  const make = o.canvas || (() => document.createElement("canvas")), PAN = o.pan ?? 0;
  const cvs = layers.map(() => make()), F = new Float64Array(3), K = new Float64Array(3);
  // Each layer's reach (whole CSS px): blits take whole numbers, which a call never boxes.
  // Depths copied once into a typed array (a double field read off mixed layer objects is boxed).
  const D = Float64Array.from(layers, (l) => l.depth ?? 0), M = Int32Array.from(D, (z) => Math.ceil(PAN * z));
  const stats = { paints: 0 };
  K[0] = -1;
  function repaint(w: number, h: number, dpr: number) {
    K[0] = w; K[1] = h; K[2] = dpr;
    fit(w, h, art, F);
    for (let i = 0; i < layers.length; i++) {
      // A layer that slides is painted wider by its reach on both sides.
      const m = M[i]!, cv = cvs[i]!;
      cv.width = Math.round((w + 2 * m) * dpr);
      cv.height = Math.round(h * dpr);
      const c = cv.getContext("2d") as CanvasRenderingContext2D;
      c.setTransform(dpr * F[0]!, 0, 0, dpr * F[0]!, dpr * (F[1]! + m), dpr * F[2]!);
      layers[i]!.paint(c);
      stats.paints++;
    }
  }
  return {
    /** Blit every layer for a w × h CSS px frame at `dpr`, panned `pan` CSS px (clamped to ±`o.pan`;
     *  each layer lands on a whole CSS px). */
    draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr = 1, pan = 0) {
      if (K[0] !== w || K[1] !== h || K[2] !== dpr) repaint(w, h, dpr);
      const p = pan < -PAN ? -PAN : pan > PAN ? PAN : pan;
      for (let i = 0; i < layers.length; i++) {
        // The offset in whole CSS px (a fractional one is boxed on its way into drawImage).
        const m = M[i]!, x = Math.round(p * D[i]!) - m;
        ctx.drawImage(cvs[i]!, x | 0, 0, (w + 2 * m) | 0, h | 0);
      }
    },
    /** Paint again on the next draw (the art changed: a theme). */
    repaint() {
      K[0] = -1;
    },
    /** The fit in use: [scale, dx, dy] (art px → CSS px), for placing a scene on the art. */
    fit: F,
    /** Layer paints so far (a resize or a repaint adds one per layer). */
    stats,
  };
}
/** What `backdrop` returns. */
export type Backdrop = ReturnType<typeof backdrop>;
