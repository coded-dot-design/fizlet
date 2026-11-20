// src/sprite.ts
var framesOf = (d) => {
  const fr = d.frames ?? [];
  return typeof fr[0] == "string" ? [fr] : fr;
};
var sizeOf = (d, f = framesOf(d)) => [d.w ?? Math.max(0, ...f.map((r) => Math.max(0, ...r.map((s) => s.length)))), d.h ?? Math.max(0, ...f.map((r) => r.length))];
var paint = (pals, v, p) => {
  const q = pals[p] ?? pals[0];
  return q["*"] || q[v] || pals[0][v] || v;
};
function runs(d, rows, pals, p, rect) {
  const o = d.outline ? 1 : 0, cm = d.colors ?? {};
  for (let pass = o ? 0 : 1; pass < 2; pass++)
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0, e; x < r.length; x = e) {
        const ch = r[x], c = cm[ch];
        for (e = x + 1; r[e] === ch; e++) ;
        if (c) pass ? rect(x + o, y + o, e - x, 1, paint(pals, c, p)) : rect(x + o - 1, y + o - 1, e - x + 2, 3, paint(pals, d.outline, p));
      }
    }
}
function spriteSVG(d, frame = 0, palettes = [{}], palette = 0) {
  const f = framesOf(d), [w0, h0] = sizeOf(d, f), o = d.outline ? 2 : 0, w = w0 + o, h = h0 + o, n = Math.max(1, d.n ?? f.length);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`;
  runs(d, f[((frame | 0) % n + n) % n] ?? [], palettes, palette & 31, (x, y, w2, h2, c) => s += `<rect x="${x}" y="${y}" width="${w2}" height="${h2}" fill="${c}"/>`);
  return s + "</svg>";
}
var spriteURL = (d, frame = 0, palettes = [{}], palette = 0) => "data:image/svg+xml," + encodeURIComponent(spriteSVG(d, frame, palettes, palette));
function sprites(defs, o = {}) {
  const pals = o.palettes ?? [{}];
  const cap = o.cap ?? 256;
  const make = o.canvas ?? ((w, h) => {
    if (typeof OffscreenCanvas == "function") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  });
  const list = Object.values(defs);
  const ids = {};
  const n = list.length;
  const F = [];
  const W = new Float64Array(n), H = new Float64Array(n), AX = new Float64Array(n), AY = new Float64Array(n), N = new Int32Array(n), PAD = new Int32Array(n);
  Object.keys(defs).forEach((k, i) => {
    const d = list[i], f = framesOf(d);
    ids[k] = i;
    F[i] = f;
    [W[i], H[i]] = sizeOf(d, f);
    AX[i] = d.ax ?? W[i] / 2;
    AY[i] = d.ay ?? H[i] / 2;
    N[i] = Math.max(1, d.n ?? f.length);
    PAD[i] = d.outline ? 1 : 0;
  });
  const cache = /* @__PURE__ */ new Map();
  const st = new Float64Array(1);
  const color = (v, p) => paint(pals, v, p);
  function tile(id, frame = 0, scale = 1, palette = 0) {
    const i = typeof id == "string" ? ids[id] : id;
    if (!N[i]) throw new RangeError("fizlet/sprite: no sprite " + id);
    const f = ((frame | 0) % N[i] + N[i]) % N[i];
    const k = Math.min(8, Math.max(1, Math.ceil(scale))) | 0;
    const p = palette & 31;
    const key = ((i * 64 + f) * 32 + p) * 8 + k - 1 | 0;
    return cache.get(key) ?? bake(i, f, k, p, key);
  }
  function bake(i, f, k, p, key) {
    const o2 = PAD[i] * 2, d = list[i];
    const t = make((W[i] + o2) * k, (H[i] + o2) * k);
    const c = t.getContext("2d");
    c.setTransform(k, 0, 0, k, 0, 0);
    if (d.paint) d.paint(c, f, (v) => color(v, p));
    else runs(d, F[i][f] ?? [], pals, p, (x, y, w, h, col) => (c.fillStyle = col, c.fillRect(x, y, w, h)));
    if (cache.size >= cap) for (const old of cache.keys()) {
      cache.delete(old);
      break;
    }
    cache.set(key, t);
    st[0]++;
    return t;
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
     * An id that names no sprite throws a RangeError (as `tile` does).
     */
    draw(ctx, id, frame, x, y, angle = 0, scale = 1, palette = 0) {
      const i = typeof id == "string" ? ids[id] : id;
      const t = tile(i, frame, scale, palette), o2 = PAD[i];
      const dw = (W[i] + o2 * 2) * scale, dh = (H[i] + o2 * 2) * scale, px = -(AX[i] + o2) * scale, py = -(AY[i] + o2) * scale;
      ctx.imageSmoothingEnabled = false;
      if (angle) {
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(angle);
        ctx.drawImage(t, px, py, dw, dh);
        ctx.restore();
      } else ctx.drawImage(t, Math.round(x + px), Math.round(y + py), dw, dh);
    },
    /** Baked tiles kept now. */
    get size() {
      return cache.size;
    },
    /** Tiles baked so far (cache misses). Flat in a steady scene. */
    get baked() {
      return st[0];
    },
    /** Drop every baked tile (after changing a palette in place). */
    clear() {
      cache.clear();
    }
  };
}

export {
  spriteSVG,
  spriteURL,
  sprites
};
