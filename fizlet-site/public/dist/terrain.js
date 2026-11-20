import "./chunks/chunk-62P4PJ5K.js";
import {
  hypot
} from "./chunks/chunk-3IN3G3AQ.js";
import "./chunks/chunk-RA74YNEB.js";

// src/terrain.ts
var fade = (t) => t * t * (3 - 2 * t);
var smooth = (a, b, x) => x <= a ? 0 : x >= b ? 1 : fade((x - a) / (b - a));
function hash(x, z, s) {
  let n = Math.imul(x, 668265261) ^ Math.imul(z, 374761393) ^ Math.imul(s, 2654435761);
  n = Math.imul(n ^ n >>> 15, 2246822507);
  n = Math.imul(n ^ n >>> 13, 3266489909);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}
function value(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), u = fade(x - i), v = fade(z - j);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function terrain(o) {
  const cols = o.cols | 0, rows = o.rows | 0;
  if (cols < 1 || rows < 1) throw new RangeError("terrain: cols and rows must be at least 1");
  const c = o.cell ?? 1, x0 = o.x0 ?? -cols * c / 2, z0 = o.z0 ?? -rows * c / 2, W1 = cols + 1;
  const h = new Float64Array(W1 * (rows + 1)), kind = new Uint8Array(cols * rows * 2), F = new Float64Array(4), adapt = o.split === "adaptive";
  if (o.heights) h.set(o.heights);
  else h.fill(o.base ?? 0);
  function face() {
    const u = Math.min(cols, Math.max(0, (F[0] - api.x0) / c)), v = Math.min(rows, Math.max(0, (F[3] - api.z0) / c));
    const i = Math.min(cols - 1, Math.floor(u)), j = Math.min(rows - 1, Math.floor(v)), fu = u - i, fv = v - j, k = j * W1 + i;
    const a = h[k], b = h[k + 1], cc = h[k + W1 + 1], d = h[k + W1];
    const fl = adapt && Math.abs(b - d) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - d, sz = up ? cc - b : d - a;
    F[0] = a + sx * fu + sz * fv;
    if (fl && up) F[0] += b - a - sx;
    F[1] = sx / c;
    F[2] = sz / c;
    return (j * cols + i) * 2 + (up ? 0 : 1);
  }
  const under = (x, z) => (F[0] = x, F[3] = z, face());
  function each(fn) {
    for (let j = 0, i = 0; j <= rows; j++) for (let k = 0; k <= cols; k++, i++) fn(api.x0 + k * c, api.z0 + j * c, i);
    api.version++;
    return api;
  }
  const T = new Float64Array(4);
  function near(pts, x, z) {
    T[0] = Infinity;
    for (let s = 0; s + 3 < pts.length; s += 2) {
      const ax = pts[s], az = pts[s + 1], dx = pts[s + 2] - ax, dz = pts[s + 3] - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * t, pz = z - az - dz * t, d = hypot(px, pz);
      if (d < T[0]) T[0] = d, T[1] = dx * pz - dz * px >= 0 ? 1 : -1, T[2] = s >> 1, T[3] = t;
    }
  }
  function line(pts, so, fn) {
    const half = (so.width ?? 2) / 2, edge = so.edge ?? 1, n = pts.length / 2 - 1, L = new Float64Array(n + 1);
    for (let s = 0; s < n; s++) L[s + 1] = L[s] + hypot(pts[s * 2 + 2] - pts[s * 2], pts[s * 2 + 3] - pts[s * 2 + 1]);
    return each((x, z, i) => {
      near(pts, x, z);
      if (T[0] >= half + edge) return;
      const seg = T[2], at = (L[seg] + (L[seg + 1] - L[seg]) * T[3]) / (L[n] || 1);
      fn(at, T[1], T[0] / (half || 1), 1 - smooth(half, half + edge, T[0]), i);
    });
  }
  const api = {
    /** Cells along x. */
    cols,
    /** Cells along z. */
    rows,
    /** A cell's side, world units. */
    cell: c,
    /** World x of vertex column 0 (`terrainWindow` moves it). */
    x0,
    /** World z of vertex row 0 (`terrainWindow` moves it). */
    z0,
    /** Vertex heights, (cols + 1) per row; write them freely, then bump `version`. */
    h,
    /** A painted kind per triangle (0: none), two per cell (the one with corner (i + 1, j) first; in an
     *  adaptive cell split along 10–01, the one with (i + 1, j + 1) first):
     *  `ribbon` paints the track; `terrainView` colours it; `sample` returns it. */
    kind,
    /** The cells' split ("fixed" or "adaptive"): `terrainView` draws the same one by default. */
    split: adapt ? "adaptive" : "fixed",
    /** Bumped by every stamp: a view re-reads its bounds when it changes. */
    version: 0,
    /** The surface height under (x, z) (the drawn triangle's; outside the grid, its edge). */
    height: (x, z) => (under(x, z), F[0]),
    /** The face's unit normal under (x, z): out = [nx, ny, nz]; returns out. */
    normal(x, z, out) {
      under(x, z);
      const sx = F[1], sz = F[2], l = Math.sqrt(sx * sx + sz * sz + 1);
      out[0] = -sx / l;
      out[1] = 1 / l;
      out[2] = -sz / l;
      return out;
    },
    /** Height and normal at once (what a wheel needs): out = [h, nx, ny, nz]; returns the face's kind. */
    sample(x, z, out) {
      const k = under(x, z), sx = F[1], sz = F[2], l = Math.sqrt(sx * sx + sz * sz + 1);
      out[0] = F[0];
      out[1] = -sx / l;
      out[2] = 1 / l;
      out[3] = -sz / l;
      return kind[k];
    },
    /** The kind painted on the face under (x, z) (0: none). */
    kindAt: (x, z) => kind[under(x, z)],
    /** Vertex height at column i, row j. */
    at: (i, j) => h[j * W1 + i],
    /** Set every vertex: h = fn(x, z, h). */
    shape: (fn) => each((x, z, i) => h[i] = fn(x, z, h[i])),
    /** Add seeded value noise (`NoiseOptions`): round hills, or ridged dunes with `ridge`, `wind`, `stretch`. */
    noise(n) {
      const amp = n.amp ?? 1, oct = n.octaves ?? 3, gain = n.gain ?? 0.5, ridge = n.ridge ?? 0, st = n.stretch ?? 1;
      const w = n.wind || [1, 0], wl = hypot(w[0], w[1]) || 1, wx = w[0] / wl, wz = w[1] / wl;
      let norm = 0;
      for (let k = 0, g = 1; k < oct; k++, g *= gain) norm += g;
      return each((x, z, i) => {
        let a = (x * wx + z * wz) / (n.scale ?? 8), b = (z * wx - x * wz) / ((n.scale ?? 8) * st), sum = 0;
        for (let k = 0, g = 1; k < oct; k++, g *= gain, a *= 2, b *= 2) {
          const v = value(a, b, n.seed + k * 1013 | 0), r = 1 - Math.abs(2 * v - 1);
          sum += g * (v + (r * r - v) * ridge);
        }
        h[i] = h[i] + amp * sum / norm;
      });
    },
    /** A round bump (or a dip, height < 0) of radius r at (x, z): smooth to its rim. */
    bump(x, z, r, height) {
      return each((px, pz, i) => {
        const d = hypot(px - x, pz - z) / r;
        if (d < 1) h[i] = h[i] + height * (1 - d * d) * (1 - d * d);
      });
    },
    /** A jump ramp from `from` [x, z] rising to `height` at `to`, then falling back to the ground over
     *  `back` (default one cell: a sharp lip that throws a vehicle into the air). */
    ramp(from, to, so = {}) {
      const ax = from[0], az = from[1], bx = to[0], bz = to[1], len = hypot(bx - ax, bz - az) || 1, back = so.back ?? c, hh = so.height ?? 1;
      const ex = bx + (bx - ax) / len * back, ez = bz + (bz - az) / len * back, tot = len + back;
      return line([ax, az, ex, ez], so, (s, _, __, w, i) => {
        const d = s * tot;
        h[i] = h[i] + w * hh * (d <= len ? d / len : 1 - (d - len) / (back || 1));
      });
    },
    /** `count` rolling humps (whoops) from `from` to `to`. */
    whoops(from, to, so = {}) {
      const n = so.count ?? 6, hh = so.height ?? 0.4;
      return line([from[0], from[1], to[0], to[1]], so, (s, _, __, w, i) => {
        const f = s * n - Math.floor(s * n);
        h[i] = h[i] + w * hh * 16 * f * f * (1 - f) * (1 - f);
      });
    },
    /** A banked turn along `points` [x0, z0, x1, z1, …]: a bowl across its width, rising toward
     *  `side` (1, the default: the right of the direction of travel, the outside of a left turn; −1
     *  the left). Past each end the bank keeps its cross-section and runs out to the ground over
     *  `edge` (no lump on the centre line beyond the ends). */
    berm(points, so = {}) {
      const hh = so.height ?? 1, side = so.side ?? 1, half = (so.width ?? 2) / 2, edge = so.edge ?? 1, m = (points.length >> 1) - 1;
      return line(points, so, (_, sd, across, w, i) => {
        const s = T[2], u = T[3];
        if (s === 0 && u === 0 || s === m - 1 && u === 1) {
          const e = (u === 0 ? s : s + 1) * 2, k = s * 2, dx = points[k + 2] - points[k], dz = points[k + 3] - points[k + 1], l = hypot(dx, dz) || 1;
          const px = api.x0 + i % W1 * c - points[e], pz = api.z0 + Math.floor(i / W1) * c - points[e + 1], perp = (dx * pz - dz * px) / l, d = Math.abs(perp);
          sd = perp >= 0 ? 1 : -1;
          across = d / (half || 1);
          w = (1 - smooth(half, half + edge, d)) * (1 - smooth(0, edge, Math.abs(px * dx + pz * dz) / l));
        }
        const t = Math.min(1, Math.max(0, (1 + side * sd * across) / 2));
        h[i] = h[i] + w * hh * t * t;
      });
    },
    /** Carve a flat track along `points`: its cross-section level (at the height the ground had under
     *  each point, or `y`), blended into the ground over `edge`; paints `kind` on the faces whose centre is inside its width. */
    ribbon(points, so = {}) {
      const n = points.length >> 1, Y = new Float64Array(n), half = (so.width ?? 3) / 2;
      for (let s = 0; s < n; s++) Y[s] = so.y ?? (under(points[s * 2], points[s * 2 + 1]), F[0]);
      line(points, { width: so.width ?? 3, edge: so.edge ?? 1.5 }, (_, __, ___, w, i) => {
        const s = T[2], y = Y[s] + (Y[s + 1] - Y[s]) * T[3];
        h[i] = h[i] + (y - h[i]) * w;
      });
      if (so.kind) {
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols * 2; i++) if (near(points, api.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * c, api.z0 + (j + (i & 1 ? 2 : 1) / 3) * c), T[0] <= half) kind[j * cols * 2 + i] = so.kind;
      }
      return api;
    }
  };
  return api;
}
function shift(a, r, n, dx, dz) {
  if (dz > 0) a.copyWithin(0, dz * r);
  else if (dz < 0) a.copyWithin(-dz * r, 0, (n + dz) * r);
  for (let j = 0, q = 0; dx && j < n; j++, q += r) dx > 0 ? a.copyWithin(q, q + dx, q + r) : a.copyWithin(q - dx, q, q + r + dx);
}
function terrainWindow(o) {
  const cols = o.cols | 0, rows = (o.rows ?? cols) | 0, S = (o.step ?? 8) | 0, c = o.cell ?? 1;
  const w = Object.assign(terrain({ ...o, cols, rows, x0: 0, z0: 0 }), {
    origin: new Int32Array(2),
    stats: { slides: 0, filled: 0 },
    moveTo(i, j) {
      const O = w.origin, dx = i - O[0], dz = j - O[1], n = w.stats.slides;
      if (n && !dx && !dz) return false;
      O[0] = i;
      O[1] = j;
      w.x0 = i * c;
      w.z0 = j * c;
      if (!n || Math.abs(dx) >= cols || Math.abs(dz) >= rows) fill(0, 0, cols, rows);
      else {
        shift(w.h, cols + 1, rows + 1, dx, dz);
        shift(w.kind, cols * 2, rows, dx * 2, dz);
        if (dz) fill(0, dz > 0 ? rows - dz : 0, cols, dz > 0 ? rows : -dz);
        if (dx) fill(dx > 0 ? cols - dx : 0, dz < 0 ? -dz : 0, dx > 0 ? cols : -dx, dz < 0 ? rows : rows - dz);
      }
      w.stats.slides++;
      w.version++;
      return true;
    },
    follow(x, z) {
      return w.moveTo(Math.floor(x / c / S) * S - (cols >> 1) + (S >> 1), Math.floor(z / c / S) * S - (rows >> 1) + (S >> 1));
    }
  });
  function fill(i0, j0, i1, j1) {
    o.fill(i0, j0, i1, j1, w);
    w.stats.filled += (i1 - i0 + 1) * (j1 - j0 + 1);
  }
  return w;
}
var SHN = 12;
function rgb(col, b, m = 0, hc = 0) {
  const n = parseInt(col.slice(1), 16), f = (k, c = n >> k & 255) => (c = b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9, c + ((hc >> k & 255) - c) * m) | 0;
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}
function terrainView(d, t, o = {}) {
  const C = o.chunk ?? 8, cols = t.cols, rows = t.rows, W1 = cols + 1, cs = t.cell, hs = t.h, kind = t.kind;
  if (C & C - 1 || C < 1) throw new RangeError("terrainView: chunk must be a power of two");
  const NX = Math.ceil(cols / C), NZ = Math.ceil(rows / C), NC = NX * NZ, lod = o.lod || [], depth = o.sort === "depth", seams = o.seams !== false;
  const name = o.cluster ?? "terrain", adapt = (o.split || t.split) === "adaptive", layer = o.layer ?? 0, steep = o.steep ?? 0.35, ns = o.shadows ?? 8;
  const NV = W1 * (rows + 1), SX = new Float64Array(NV), SY = new Float64Array(NV), SZ = new Float64Array(NV), HE = new Float64Array(NV);
  const STR = new Int32Array(NC), VIS = new Uint8Array(NC), LO = new Float64Array(NC), HI = new Float64Array(NC), AT = new Float64Array(NC * 3);
  const B = new Float64Array(15), WS = new Float64Array(1), P = new Float64Array(3), L = new Float64Array(3), E = new Int32Array(4);
  const SHX = new Float64Array(ns), SHZ = new Float64Array(ns), SHR = new Float64Array(ns), SHA = new Float64Array(ns), CO = new Float64Array(SHN * 2);
  for (let k = 0; k < SHN; k++) CO[k * 2] = Math.cos(k / SHN * 6.283185307179586), CO[k * 2 + 1] = Math.sin(k / SHN * 6.283185307179586);
  const stats = { faces: 0, chunks: 0 };
  let ver = -1, amb = 0.56, NB = 0, IS = 0, IK = 0, NL = 0, HL = 0, HZ = 0, H0 = 0, H1 = 1;
  const tops = new Float64Array(64), SH = [];
  function colors(bands = [[Infinity, "#d9b27c"]], steepColor, kinds = [], haze = o.haze) {
    const list = [];
    NB = bands.length;
    for (let i = 0; i < NB; i++) tops[i] = bands[i][0], list.push(bands[i][1]);
    const b0 = parseInt(bands[0][1].slice(1), 16);
    IS = list.push(steepColor || "#" + ((b0 >> 16) * 0.8 << 16 | (b0 >> 8 & 255) * 0.8 << 8 | ((b0 & 255) * 0.8 | 0)).toString(16).padStart(6, "0")) - 1;
    IK = list.length;
    for (let i = 0; i < kinds.length; i++) list.push(kinds[i]);
    SH.length = 0;
    NL = list.length;
    HL = haze ? 16 : HZ = 0;
    const hc = haze ? (H0 = haze.from, H1 = 16 / (haze.to - H0), parseInt(haze.color.slice(1), 16)) : 0;
    for (const col of list) for (let l = 0; l <= 32; l++) for (let z = 0; z <= HL; z++) SH.push(rgb(col, 0.5 + l / 40 * 0.62, z / 16, hc));
  }
  colors(o.bands, o.steepColor, o.kinds);
  const lv = o.light || [0.5, 1, 0.4], ll = Math.sqrt(lv[0] * lv[0] + lv[1] * lv[1] + lv[2] * lv[2]) || 1;
  L[0] = lv[0] / ll;
  L[1] = lv[1] / ll;
  L[2] = lv[2] / ll;
  amb = o.ambient ?? amb;
  function bounds() {
    for (let k = 0; k < NC; k++) {
      const i0 = k % NX * C, j0 = (k / NX | 0) * C;
      let lo = Infinity, hi = -Infinity;
      for (let j = j0; j <= Math.min(rows, j0 + C); j++) for (let i = i0; i <= Math.min(cols, i0 + C); i++) lo = Math.min(lo, hs[j * W1 + i]), hi = Math.max(hi, hs[j * W1 + i]);
      LO[k] = lo;
      HI[k] = hi;
    }
    ver = t.version;
  }
  function proj(x, y, z) {
    const dx = x - B[0], dy = y - B[1], dz = z - B[2], zz = dx * B[9] + dy * B[10] + dz * B[11], k = B[12] / Math.max(zz, 0.05);
    P[0] = B[13] + (dx * B[3] + dy * B[4] + dz * B[5]) * k;
    P[1] = B[14] - (dx * B[6] + dy * B[7] + dz * B[8]) * k;
    P[2] = zz;
  }
  function update() {
    if (ver !== t.version) bounds();
    const c = d.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    B[0] = c.tx + c.dist * sy * cp;
    B[1] = c.ty + c.dist * sp;
    B[2] = c.tz + c.dist * cy * cp;
    B[3] = cy;
    B[4] = 0;
    B[5] = -sy;
    B[6] = -sy * sp;
    B[7] = cp;
    B[8] = -cy * sp;
    B[9] = -sy * cp;
    B[10] = -sp;
    B[11] = -cy * cp;
    B[12] = d.height / 2 / Math.tan(c.fov / 2);
    B[13] = d.width / 2 + c.ox;
    B[14] = d.height / 2 + c.oy;
    stats.chunks = 0;
    for (let k = 0; k < NC; k++) {
      const i0 = k % NX * C, j0 = (k / NX | 0) * C, w = Math.min(C, cols - i0), hh = Math.min(C, rows - j0);
      let s = 1;
      const dist = hypot(t.x0 + (i0 + w / 2) * cs - B[0], t.z0 + (j0 + hh / 2) * cs - B[2]);
      for (let q = 0; q < lod.length; q++) if (dist > lod[q] && s < C) s *= 2;
      while (w % s || hh % s) s >>= 1;
      STR[k] = s;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, far = -Infinity, back = 0;
      for (let q = 0; q < 8; q++) {
        const wx = t.x0 + (i0 + (q & 1 ? w : 0)) * cs, wz = t.z0 + (j0 + (q & 2 ? hh : 0)) * cs;
        proj(wx, q & 4 ? HI[k] : LO[k], wz);
        if (P[2] < 0.1) back++;
        x0 = Math.min(x0, P[0]);
        x1 = Math.max(x1, P[0]);
        y0 = Math.min(y0, P[1]);
        y1 = Math.max(y1, P[1]);
        if (q & 4 && P[2] > far) far = P[2], AT[k * 3] = wx, AT[k * 3 + 1] = HI[k], AT[k * 3 + 2] = wz;
      }
      VIS[k] = back === 8 ? 0 : back || x1 >= 0 && y1 >= 0 && x0 <= d.width && y0 <= d.height ? 1 : 0;
      stats.chunks += VIS[k];
    }
    for (let k = 0; k < NC; k++) if (VIS[k]) project(k);
  }
  const strideAt = (ci, cj, s) => ci < 0 || cj < 0 || ci >= NX || cj >= NZ ? s : STR[cj * NX + ci];
  function project(k) {
    const ci = k % NX, cj = k / NX | 0, i0 = ci * C, j0 = cj * C, w = Math.min(C, cols - i0), hh = Math.min(C, rows - j0), s = STR[k];
    E[0] = strideAt(ci - 1, cj, s);
    E[1] = strideAt(ci + 1, cj, s);
    E[2] = strideAt(ci, cj - 1, s);
    E[3] = strideAt(ci, cj + 1, s);
    for (let b = 0; b <= hh; b += s)
      for (let a = 0; a <= w; a += s) {
        const g = (j0 + b) * W1 + i0 + a;
        let y = hs[g];
        const sv = a === 0 ? E[0] : a === w ? E[1] : s, sh = b === 0 ? E[2] : b === hh ? E[3] : s;
        if (sv > s && b % sv) {
          const f = b % sv / sv, g0 = g - b % sv * W1;
          y = hs[g0] + (hs[g0 + sv * W1] - hs[g0]) * f;
        } else if (sh > s && a % sh) {
          const f = a % sh / sh, g0 = g - a % sh;
          y = hs[g0] + (hs[g0 + sh] - hs[g0]) * f;
        }
        HE[g] = y;
        proj(t.x0 + (i0 + a) * cs, y, t.z0 + (j0 + b) * cs);
        SX[g] = P[0];
        SY[g] = P[1];
        SZ[g] = P[2];
      }
  }
  function tri(ctx, p, q, r, kd, a) {
    if (SZ[p] < 0.1 || SZ[q] < 0.1 || SZ[r] < 0.1) return;
    if ((SX[q] - SX[p]) * (SY[r] - SY[p]) - (SY[q] - SY[p]) * (SX[r] - SX[p]) <= 0) return;
    const sx = (a & 1 ? HE[q] - HE[p] : HE[q] - HE[r]) / WS[0], sz = (a === 1 ? HE[r] - HE[q] : a === 2 ? HE[q] - HE[p] : HE[r] - HE[p]) / WS[0];
    const l = Math.sqrt(sx * sx + sz * sz + 1), ny = 1 / l, y = (HE[p] + HE[q] + HE[r]) / 3;
    let ci = IK + kd - 1;
    if (!kd || ci >= NL) {
      ci = 0;
      if (1 - ny > steep) ci = IS;
      else while (ci < NB - 1 && y > tops[ci]) ci++;
    }
    const lvl = Math.round((amb + (1 - amb) * Math.max(0, (-sx * L[0] + L[1] - sz * L[2]) * ny)) * 32);
    ctx.beginPath();
    ctx.moveTo(SX[p], SY[p]);
    ctx.lineTo(SX[q], SY[q]);
    ctx.lineTo(SX[r], SY[r]);
    ctx.closePath();
    ctx.fillStyle = SH[(ci * 33 + lvl) * (HL + 1) + HZ];
    ctx.fill();
    if (seams) ctx.strokeStyle = ctx.fillStyle, ctx.stroke();
    stats.faces++;
  }
  function paintChunk(ctx, k) {
    if (!VIS[k]) return;
    const ci = k % NX, cj = k / NX | 0, i0 = ci * C, j0 = cj * C, s = STR[k], nx = Math.min(C, cols - i0) / s, nz = Math.min(C, rows - j0) / s, ws = WS[0] = s * cs;
    const eu = (B[0] - t.x0) / ws - i0 / s, ev = (B[2] - t.z0) / ws - j0 / s, er = Math.max(0, Math.min(nz, Math.floor(ev))), ec = Math.max(0, Math.min(nx, Math.floor(eu)));
    ctx.lineWidth = 0.6;
    for (let n = 0; n < nz; n++) {
      const b = n < er ? n : nz - 1 - (n - er);
      for (let m = 0; m < nx; m++) {
        const a = m < ec ? m : nx - 1 - (m - ec), g = (j0 + b * s) * W1 + i0 + a * s, g1 = g + s * W1, kd = ((j0 + b * s) * cols + i0 + a * s) * 2;
        if (HL) {
          HZ = Math.min(16, Math.max(0, (hypot(t.x0 + (i0 + (a + 0.5) * s) * cs - d.cam.tx, t.z0 + (j0 + (b + 0.5) * s) * cs - d.cam.tz) - H0) * H1 + 0.5)) | 0;
        }
        if (adapt && Math.abs(HE[g + s] - HE[g1]) < Math.abs(HE[g1 + s] - HE[g])) {
          if (eu - a + ev - b < 1) tri(ctx, g + s, g1 + s, g1, kind[kd], 2), tri(ctx, g, g + s, g1, kind[kd + 1], 3);
          else tri(ctx, g, g + s, g1, kind[kd + 1], 3), tri(ctx, g + s, g1 + s, g1, kind[kd], 2);
        } else if (eu - a - (ev - b) > 0) tri(ctx, g, g1 + s, g1, kind[kd + 1], 0), tri(ctx, g, g + s, g1 + s, kind[kd], 1);
        else tri(ctx, g, g + s, g1 + s, kind[kd], 1), tri(ctx, g, g1 + s, g1, kind[kd + 1], 0);
      }
    }
    for (let i = 0; depth && i < ns; i++) {
      if (SHA[i] <= 0) continue;
      const u = Math.floor((SHX[i] - t.x0) / cs / C), v = Math.floor((SHZ[i] - t.z0) / cs / C);
      if (Math.min(NX - 1, Math.max(0, u)) + Math.min(NZ - 1, Math.max(0, v)) * NX === k) blob(ctx, i);
    }
  }
  function blob(ctx, i) {
    ctx.beginPath();
    for (let q = 0; q < SHN; q++) {
      const x = SHX[i] + CO[q * 2] * SHR[i], z = SHZ[i] + CO[q * 2 + 1] * SHR[i];
      proj(x, t.height(x, z) + 0.03, z);
      if (P[2] < 0.1) return;
      q ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]);
    }
    ctx.closePath();
    ctx.globalAlpha = SHA[i];
    ctx.fillStyle = o.shadowColor || "#000000";
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (depth) {
    d.cluster(name + ":pre", { fixed: -1e6 });
    d.decal(name + ":pre", 0, () => (stats.faces = 0, update()));
    for (let k = 0; k < NC; k++) {
      d.cluster(name + ":" + k, { at: AT.subarray(k * 3, k * 3 + 3) });
      d.decal(name + ":" + k, layer, (ctx) => paintChunk(ctx, k));
    }
  } else {
    d.cluster(name, { fixed: o.fixed ?? 0 });
    d.decal(name, layer, (ctx) => {
      stats.faces = 0;
      update();
      const ex = Math.max(0, Math.min(NX, Math.floor((B[0] - t.x0) / cs / C))), ez = Math.max(0, Math.min(NZ, Math.floor((B[2] - t.z0) / cs / C)));
      for (let n = 0; n < NZ; n++) {
        const b = n < ez ? n : NZ - 1 - (n - ez);
        for (let m = 0; m < NX; m++) paintChunk(ctx, b * NX + (m < ex ? m : NX - 1 - (m - ex)));
      }
      for (let i = 0; i < ns; i++) if (SHA[i] > 0) blob(ctx, i);
    });
  }
  update();
  return {
    /** The last draw: faces painted, chunks on screen. */
    stats,
    /** Chunks along x and z. */
    chunks: [NX, NZ],
    /** Chunk strides from the last draw (1: every cell; 2: every other…). */
    stride: STR,
    /** Set shadow i: a disc of radius r at (x, z) on the ground, alpha a (0 hides it). */
    shadow(i, x, z, r, a) {
      SHX[i] = x;
      SHZ[i] = z;
      SHR[i] = r;
      SHA[i] = a;
    },
    /** New colours (a theme change): bands, steep colour, kinds, haze (default the option's). */
    colors,
    /** Project now (draw does it): after a camera change outside a draw, e.g. before `d.pick`. */
    update
  };
}
export {
  terrain,
  terrainView,
  terrainWindow
};
