/**
 * fizlet/sprite: the character layer's drawing primitive. Pixel-art sprites written as data (rows of
 * characters + a colour map whose values can be palette roles), baked once per (sprite, frame,
 * scale, palette) into a bounded cache, then blitted with one drawImage. `svg()` / `url()` give the
 * same pixels as an SVG for characters that live in the page instead of on a canvas.
 */

/** A colour for a character: a hex, or a role name (`team`, `enemy`, `hazard`…) a palette fills. */
export type Paint = string;

export interface SpriteDef {
  /** Rows of characters, one per pixel (one frame), or a list of those (an animation). */
  frames?: string[] | string[][];
  /** Character → colour or role. Any character not listed is empty (use `.` by convention). */
  colors?: Record<string, Paint>;
  /** Pivot in sprite pixels (default: the centre). Draw places it at (x, y) and rotates about it. */
  ax?: number;
  ay?: number;
  /** A 1px rim around the silhouette (colour or role): readable on light and dark pages. */
  outline?: Paint;
  /** Vector sprite instead of pixels: its size, frame count and a painter, baked like the rest. */
  w?: number;
  h?: number;
  n?: number;
  paint?: (c: CanvasRenderingContext2D, frame: number, color: (p: Paint) => string) => void;
}

export interface SpriteOptions {
  /**
   * Palettes: role → hex. Index 0 is the default and fills roles the others leave out. The key `*`
   * paints every pixel one colour (a hit flash). Push more at runtime (max 32); `clear()` after
   * changing one in place.
   */
  palettes?: Record<string, string>[];
  /** Max baked tiles kept (default 256). The oldest is dropped when a new one is baked. */
  cap?: number;
  /** Tile factory (default: OffscreenCanvas, else a detached canvas). */
  canvas?: (w: number, h: number) => OffscreenCanvas | HTMLCanvasElement;
}

type Tile = OffscreenCanvas | HTMLCanvasElement;
type Rect = (x: number, y: number, w: number, h: number, c: string) => void;

/** Frames ≤ 64, palettes ≤ 32 and baked scales 1–8 per sprite: the cache key is one small integer. */
export function sprites<K extends string>(defs: Record<K, SpriteDef>, o: SpriteOptions = {}) {
  const pals = o.palettes ?? [{}];
  const cap = o.cap ?? 256;
  const make = o.canvas ?? ((w: number, h: number): Tile => {
    if (typeof OffscreenCanvas == "function") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  });
  const list = Object.values(defs) as SpriteDef[];
  const ids = {} as Record<K, number>;
  const n = list.length;
  // Per sprite: art frames, width, height, pivot, frame count, padding (1 with an outline).
  const F: string[][][] = [];
  const W = new Float64Array(n), H = new Float64Array(n), AX = new Float64Array(n), AY = new Float64Array(n), N = new Int32Array(n), PAD = new Int32Array(n);
  Object.keys(defs).forEach((k, i) => {
    const d = list[i]!, fr = d.frames ?? [];
    const f = (typeof fr[0] == "string" ? [fr] : fr) as string[][];
    ids[k as K] = i;
    F[i] = f;
    W[i] = d.w ?? Math.max(0, ...f.map((r) => Math.max(0, ...r.map((s) => s.length))));
    H[i] = d.h ?? Math.max(0, ...f.map((r) => r.length));
    AX[i] = d.ax ?? W[i]! / 2;
    AY[i] = d.ay ?? H[i]! / 2;
    N[i] = Math.max(1, d.n ?? f.length);
    PAD[i] = d.outline ? 1 : 0;
  });
  const cache = new Map<number, Tile>();
  const st = new Float64Array(1); // tiles baked (cache misses)

  const color = (v: Paint, p: number) => {
    const q = pals[p] ?? pals[0]!;
    return q["*"] || q[v] || pals[0]![v] || v;
  };

  /** Pixel art as runs of one colour, rim first: shared by the canvas and the SVG. */
  function runs(i: number, f: number, p: number, rect: Rect) {
    const d = list[i]!, rows = F[i]![f] ?? [], o = PAD[i]!, cm = d.colors ?? {};
    for (let pass = o ? 0 : 1; pass < 2; pass++)
      for (let y = 0; y < rows.length; y++) {
        const r = rows[y]!;
        for (let x = 0, e; x < r.length; x = e) {
          const ch = r[x]!, c = cm[ch];
          for (e = x + 1; r[e] === ch; e++);
          if (c) pass ? rect(x + o, y + o, e - x, 1, color(c, p)) : rect(x + o - 1, y + o - 1, e - x + 2, 3, color(d.outline!, p));
        }
      }
  }

  function tile(id: number | K, frame = 0, scale = 1, palette = 0): Tile {
    const i = typeof id == "string" ? ids[id] : id;
    const f = ((frame | 0) % N[i]! + N[i]!) % N[i]!;
    const k = Math.min(8, Math.max(1, Math.ceil(scale))) | 0;
    const p = palette & 31;
    const key = (((i * 64 + f) * 32 + p) * 8 + k - 1) | 0;
    return cache.get(key) ?? bake(i, f, k, p, key);
  }

  // The miss path lives apart: its closures would otherwise make every tile() call allocate a context.
  function bake(i: number, f: number, k: number, p: number, key: number) {
    const o = PAD[i]! * 2, d = list[i]!;
    const t = make((W[i]! + o) * k, (H[i]! + o) * k);
    const c = t.getContext("2d") as CanvasRenderingContext2D;
    c.setTransform(k, 0, 0, k, 0, 0);
    if (d.paint) d.paint(c, f, (v) => color(v, p));
    else runs(i, f, p, (x, y, w, h, col) => ((c.fillStyle = col), c.fillRect(x, y, w, h)));
    if (cache.size >= cap) for (const old of cache.keys()) { cache.delete(old); break; }
    cache.set(key, t);
    st[0]!++;
    return t;
  }

  /** The sprite as an SVG string (crisp at any size), for characters placed in the page. */
  function svg(id: number | K, frame = 0, palette = 0) {
    const i = typeof id == "string" ? ids[id] : id, w = W[i]! + PAD[i]! * 2, h = H[i]! + PAD[i]! * 2;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`;
    runs(i, ((frame | 0) % N[i]! + N[i]!) % N[i]!, palette & 31, (x, y, w, h, c) => (s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`));
    return s + "</svg>";
  }

  return {
    ids,
    /** Width and height of each sprite in sprite pixels (outline not included), by id. */
    w: W,
    h: H,
    palettes: pals,
    tile,
    /**
     * Draw sprite `id` (number from `ids`, or its name) with its pivot at (x, y), turned by `angle`
     * radians, `scale` pixels per sprite pixel. Bakes on the first call; after that, no allocation.
     */
    draw(ctx: CanvasRenderingContext2D, id: number | K, frame: number, x: number, y: number, angle = 0, scale = 1, palette = 0) {
      const i = typeof id == "string" ? ids[id] : id;
      const t = tile(i, frame, scale, palette), o = PAD[i]!;
      const dw = (W[i]! + o * 2) * scale, dh = (H[i]! + o * 2) * scale, px = -(AX[i]! + o) * scale, py = -(AY[i]! + o) * scale;
      ctx.imageSmoothingEnabled = false;
      if (angle) {
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(angle);
        ctx.drawImage(t, px, py, dw, dh);
        ctx.restore();
      } else ctx.drawImage(t, Math.round(x + px), Math.round(y + py), dw, dh);
    },
    svg,
    /** `svg()` as a data URL, for an `<img src>` or a CSS background. */
    url(id: number | K, frame = 0, palette = 0) {
      return "data:image/svg+xml," + encodeURIComponent(svg(id, frame, palette));
    },
    /** Baked tiles kept now. */
    get size() {
      return cache.size;
    },
    /** Tiles baked so far (cache misses). Flat in a steady scene. */
    get baked() {
      return st[0]!;
    },
    /** Drop every baked tile (after changing a palette in place). */
    clear() {
      cache.clear();
    },
  };
}
export type Sprites = ReturnType<typeof sprites>;
