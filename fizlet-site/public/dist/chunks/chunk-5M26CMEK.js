// src/collide.ts
var finite = (v) => v - v === 0;
function count(name, v) {
  if (!(Number.isInteger(v) && v > 0)) throw new RangeError(`Grid: ${name} must be a positive integer, got ${v}`);
  return v;
}
function size(name, v) {
  if (!(finite(v) && v > 0)) throw new RangeError(`Grid: ${name} must be a finite number above 0, got ${v}`);
  return v;
}
var Grid = class {
  cell;
  cols = 0;
  rows = 0;
  /** Entity capacity: valid ids are 0..cap-1. */
  cap;
  /** Index capacity: cell entries per step (a body covering 4 cells takes 4). */
  nodes;
  // Private names are one letter on purpose (esbuild keeps property names; board-page ships this):
  // h cell heads, n next node, d node ids, s query stamps, u nodes used, k stamp; a the circle,
  // p put, q scan.
  h = new Int32Array(0);
  n;
  d;
  s;
  u = 0;
  k = 0;
  /** Index entries refused because the node store was full (raise `nodes`). Cumulative. */
  dropped = 0;
  /** Inserts and queries refused: id outside 0..cap-1, or a non-finite (or negative r) circle. Cumulative. */
  rejected = 0;
  /** Queries whose result did not fit in `out`. Cumulative. */
  truncated = 0;
  /** Ids the last query found but could not write to `out` (0 = complete). */
  missed = 0;
  constructor(cell, cap, w, h, nodes = cap * 4) {
    this.cell = size("cell", cell);
    this.cap = count("cap", cap);
    this.nodes = count("nodes", nodes);
    this.n = new Int32Array(nodes);
    this.d = new Int32Array(nodes);
    this.s = new Int32Array(cap);
    this.resize(w, h);
  }
  /** World size changed (resize is not a hot path). */
  resize(w, h) {
    this.cols = Math.max(1, Math.ceil(size("w", w) / this.cell));
    this.rows = Math.max(1, Math.ceil(size("h", h) / this.cell));
    if (this.h.length < this.cols * this.rows) this.h = new Int32Array(this.cols * this.rows);
    this.clear();
  }
  clear() {
    this.h.fill(-1);
    this.u = 0;
  }
  /** The circle being inserted or queried. The work below takes only integers, so a call that
   *  V8 doesn't inline never boxes a number (numbers stay in this typed array). */
  a = new Float64Array(3);
  /** Add id (0..cap-1) covering the circle (x, y, r). */
  insert(id, x, y, r) {
    const a = this.a;
    a[0] = x;
    a[1] = y;
    a[2] = r;
    this.p(id);
  }
  p(id) {
    const a = this.a, x = a[0], y = a[1], r = a[2];
    if (!((id | 0) === id && id >= 0 && id < this.cap && finite(x) && finite(y) && finite(r) && r >= 0)) return void this.rejected++;
    const c = this.cell, mx = this.cols - 1, my = this.rows - 1;
    let x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    x0 = x0 < 0 ? 0 : x0 > mx ? mx : x0;
    x1 = x1 < 0 ? 0 : x1 > mx ? mx : x1;
    y0 = y0 < 0 ? 0 : y0 > my ? my : y0;
    y1 = y1 < 0 ? 0 : y1 > my ? my : y1;
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) {
        if (this.u === this.nodes) {
          this.dropped += (y1 - gy) * (x1 - x0 + 1) + x1 - gx + 1;
          return;
        }
        const k = gy * this.cols + gx, n = this.u++;
        this.d[n] = id;
        this.n[n] = this.h[k];
        this.h[k] = n;
      }
  }
  /**
   * Hot-path forms: read body i's x, y, r from typed arrays (arrays and integers never box, even
   * when a big step function stops V8 inlining these calls). `pad` widens the search radius.
   */
  add(x, y, r, i) {
    const a = this.a;
    a[0] = x[i];
    a[1] = y[i];
    a[2] = r[i];
    this.p(i);
  }
  near(x, y, r, i, out, pad = 0) {
    const a = this.a;
    a[0] = x[i];
    a[1] = y[i];
    a[2] = r[i] + pad;
    return this.q(out);
  }
  /**
   * Ids whose cells touch the circle, each once, into `out`. Returns the count written. If more
   * were found than `out` holds, `missed` says how many (and `truncated` counts the query).
   */
  query(x, y, r, out) {
    const a = this.a;
    a[0] = x;
    a[1] = y;
    a[2] = r;
    return this.q(out);
  }
  q(out) {
    const a = this.a, x = a[0], y = a[1], r = a[2];
    this.missed = 0;
    if (!(finite(x) && finite(y) && finite(r))) return this.rejected++, 0;
    if (this.k === 2147483647) this.s.fill(0), this.k = 0;
    const m = ++this.k, c = this.cell, mx = this.cols - 1, my = this.rows - 1;
    let x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    x0 = x0 < 0 ? 0 : x0 > mx ? mx : x0;
    x1 = x1 < 0 ? 0 : x1 > mx ? mx : x1;
    y0 = y0 < 0 ? 0 : y0 > my ? my : y0;
    y1 = y1 < 0 ? 0 : y1 > my ? my : y1;
    let count2 = 0, missed = 0;
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++)
        for (let n = this.h[gy * this.cols + gx]; n >= 0; n = this.n[n]) {
          const id = this.d[n];
          if (this.s[id] === m) continue;
          this.s[id] = m;
          if (count2 === out.length) missed++;
          else out[count2++] = id;
        }
    if (missed) this.missed = missed, this.truncated++;
    return count2;
  }
};
var circles = (ax, ay, ar, bx, by, br) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by) < (ar + br) * (ar + br);
function overlap(x, y, r, i, j) {
  const dx = x[i] - x[j], dy = y[i] - y[j], rr = r[i] + r[j];
  return dx * dx + dy * dy < rr * rr;
}
function circleRect(cx, cy, r, x, y, w, h) {
  const dx = cx - (cx < x ? x : cx > x + w ? x + w : cx), dy = cy - (cy < y ? y : cy > y + h ? y + h : cy);
  return dx * dx + dy * dy < r * r;
}
var inRect = (px, py, x, y, w, h) => px >= x && px <= x + w && py >= y && py <= y + h;
function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0, fx = x0 - cx, fy = y0 - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (a === 0) return -1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

export {
  Grid,
  circles,
  overlap,
  circleRect,
  inRect,
  segCircle
};
