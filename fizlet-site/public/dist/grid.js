// src/grid.ts
var BLOCKED = 1;
var COVER = 2;
var OCCUPIED = 4;
var DX = [1, -1, 0, 0, 1, -1, 1, -1];
var DY = [0, 0, 1, -1, 1, 1, -1, -1];
var Board = class {
  /** Cells the last search expanded; `partial` is true when the last path ran out of budget. */
  expanded = 0;
  partial = false;
  k = 0;
  z = 0;
  b = 0;
  x = 0;
  y = 0;
  constructor(cols, rows, opts = {}) {
    const n = (this.cols = cols) * (this.rows = rows), cell = this.cell = opts.cell ?? 1;
    if (!(cols >= 1 && rows >= 1 && cols === (cols | 0) && rows === (rows | 0) && cell > 0 && Number.isFinite(cell)))
      throw new RangeError(`fizlet/grid: cols ${cols}, rows ${rows}, cell ${cell} is not a board`);
    this.diagonal = !!opts.diagonal;
    this.terrain = new Uint8Array(n);
    this.cost = new Uint8Array(n).fill(1);
    this.flags = new Uint8Array(n);
    this.g = new Int32Array(n);
    this.f = new Int32Array(n);
    this.v = new Int32Array(n);
    this.q = new Int32Array(n);
    this.p = new Int32Array(n);
    this.s = new Int32Array(n);
  }
  /** The cell under a world point, clamped to the board (so always a valid id). */
  at(x, y) {
    const c = Math.floor(x / this.cell), r = Math.floor(y / this.cell), mc = this.cols - 1, mr = this.rows - 1;
    return (r < 0 ? 0 : r > mr ? mr : r) * this.cols + (c < 0 ? 0 : c > mc ? mc : c);
  }
  /** Hot-path form: the cell under body i, reading typed arrays (nothing boxes). */
  cellOf(x, y, i) {
    return this.at(x[i], y[i]);
  }
  /** World centre of cell i into out[k], out[k + 1]. */
  center(i, out, k = 0) {
    const c = i % this.cols;
    out[k] = (c + 0.5) * this.cell;
    out[k + 1] = ((i - c) / this.cols + 0.5) * this.cell;
  }
  set(i, terrain, cost = 1, flags = 0) {
    this.terrain[i] = terrain;
    this.cost[i] = cost;
    this.flags[i] = flags;
  }
  /**
   * Seeded terrain: inside the rect (c0, r0)–(c1, r1) (default the whole board), each open cell
   * (terrain 0, no flags) becomes `terrain` with chance `density`. One draw per cell in the rect,
   * whatever is there, so the same seed always lays the same board. Returns cells placed.
   */
  scatter(rand, density, terrain, cost = 1, flags = BLOCKED, c0 = 0, r0 = 0, c1 = this.cols, r1 = this.rows) {
    let placed = 0;
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) {
        const i = r * this.cols + c;
        if (rand() < density && !this.terrain[i] && !this.flags[i]) this.set(i, terrain, cost, flags), placed++;
      }
    return placed;
  }
  /** A random cell with none of `mask`, or -1 after `tries` misses (spawns, pickups, crates). */
  pick(rand, mask = BLOCKED | OCCUPIED, tries = 32) {
    for (let k = 0; k < tries; k++) {
      const i = Math.floor(rand() * this.flags.length);
      if (!(this.flags[i] & mask)) return i;
    }
    return -1;
  }
  /**
   * A* from `from` to `to` into `out`: the cells to step through, start excluded, goal last.
   * Returns the step count (0 when from === to, -1 for no path); if it is over out.length only the
   * first out.length steps are written. `budget` caps the cells expanded (0 = no cap) so a frame
   * never stalls: on a cap it writes the path to the closest cell found and sets `partial`.
   * Cells with any `avoid` flag are walls, except that the goal may be OCCUPIED.
   */
  path(from, to, out, budget = 0, avoid = BLOCKED | OCCUPIED) {
    this.c(from), this.c(to);
    this.partial = false;
    if (from === to) return 0;
    if (this.flags[to] & BLOCKED) return -1;
    let end = this.r(from, to, avoid, 2147483647, budget, out);
    if (end === -1) return -1;
    if (end === -2) this.partial = true, end = this.b;
    const via = this.v;
    let n = 0;
    for (let i = end; i !== from; i = via[i]) n++;
    for (let i = end, k = n; i !== from; i = via[i]) if (--k < out.length) out[k] = i;
    return n;
  }
  /**
   * Movement range: every cell reachable from `from` for at most `max` cost (an orthogonal step
   * into a cost-1 cell costs 1, a diagonal 1.4), nearest first, start included. Returns the count
   * (capped at out.length). `dist(i)` then reads each cell's cost.
   */
  flood(from, max, out, avoid = BLOCKED | OCCUPIED) {
    this.c(from);
    this.r(from, -1, avoid, max * 10, 0, out);
    return this.b;
  }
  /** Cost from the last search's start to cell i (exact after flood), or -1 if it was not reached. */
  dist(i) {
    return this.s[i] >= this.k ? this.g[i] / 10 : -1;
  }
  /** Line of sight between two cells: no cell strictly between them has a `mask` flag.
   *  Symmetric (a sees b exactly when b sees a). Pass BLOCKED | COVER to let cover block it. */
  los(a, b, mask = BLOCKED) {
    return (a < b ? this.hit(a, b, mask) : this.hit(b, a, mask)) < 0;
  }
  /** The first cell strictly between a and b (walking from a) with a `mask` flag, or -1 if clear.
   *  Bresenham over cells: what a shot hits on its way. */
  hit(a, b, mask = BLOCKED) {
    this.c(a), this.c(b);
    const cols = this.cols, x1 = b % cols, y1 = (b - x1) / cols;
    let x = a % cols, y = (a - x) / cols;
    const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
    for (let e = dx + dy; ; ) {
      const i = y * cols + x;
      if (i === b) return -1;
      if (i !== a && this.flags[i] & mask) return i;
      const e2 = 2 * e;
      if (e2 >= dy) e += dy, x += sx;
      if (e2 <= dx) e += dx, y += sy;
    }
  }
  // A cell id a search starts or ends on must be an integer on the board: anything else (NaN, a
  // fraction, a string, off the board) never meets the walk's end test, so it throws here instead of
  // looping forever (S6 P2-01). Inline, not the kernel's `need`: grid runs without the kernel.
  c(i) {
    if (!(this.flags[i] >= 0 && i === (i | 0))) throw new RangeError(`fizlet/grid: cell ${i} is not on the board`);
  }
  // The search: A* toward `to`, or Dijkstra over everything within `limit` when to < 0 (flood).
  // Returns `to` when found, -1 when exhausted, -2 when the budget ran out. Integers only.
  r(from, to, avoid, limit, budget, out) {
    const { cols, rows, g, f, v: via, s: seen, flags, cost } = this, m = this.k += 2, ways = this.diagonal ? 8 : 4, flood = to < 0;
    this.x = to % cols;
    this.y = (to - this.x) / cols;
    this.z = this.expanded = 0;
    g[from] = 0;
    f[from] = this.h(from % cols, (from - from % cols) / cols);
    via[from] = from;
    seen[from] = m;
    this.u(from);
    let best = from, found = 0;
    while (this.z) {
      const i = this.o();
      seen[i] = m + 1;
      if (i === to) return i;
      if (flood) {
        if (found < out.length) out[found++] = i;
      } else if (f[i] - g[i] < f[best] - g[best]) best = i;
      if (++this.expanded > budget && budget) return this.b = best, -2;
      const c = i % cols, r = (i - c) / cols;
      for (let k = 0; k < ways; k++) {
        const nc = c + DX[k], nr = r + DY[k], j = nr * cols + nc;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[j] === m + 1 || flags[j] & avoid && j !== to) continue;
        if (k > 3 && (flags[r * cols + nc] | flags[nr * cols + c]) & avoid) continue;
        const ng = g[i] + cost[j] * (k > 3 ? 14 : 10);
        if (ng > limit || seen[j] === m && ng >= g[j]) continue;
        g[j] = ng;
        f[j] = ng + this.h(nc, nr);
        via[j] = i;
        if (seen[j] === m) this.w(this.p[j]);
        else seen[j] = m, this.u(j);
      }
    }
    this.b = flood ? found : best;
    return -1;
  }
  // Octile (8-way) or Manhattan (4-way) distance in tenths: admissible while every cost is >= 1.
  h(c, r) {
    if (this.x < 0) return 0;
    const dx = Math.abs(c - this.x), dy = Math.abs(r - this.y);
    return this.diagonal ? 10 * (dx + dy) - 6 * (dx < dy ? dx : dy) : 10 * (dx + dy);
  }
  u(i) {
    this.q[this.z] = i;
    this.w(this.z++);
  }
  w(p) {
    const h = this.q, f = this.f, pos = this.p, i = h[p];
    while (p > 0) {
      const q = p - 1 >> 1, j = h[q];
      if (f[j] <= f[i]) break;
      h[p] = j;
      pos[j] = p;
      p = q;
    }
    h[p] = i;
    pos[i] = p;
  }
  o() {
    const h = this.q, f = this.f, pos = this.p, top = h[0], n = --this.z, last = h[n];
    let p = 0;
    for (let c = 1; c < n; c = 2 * p + 1) {
      if (c + 1 < n && f[h[c + 1]] < f[h[c]]) c++;
      if (f[h[c]] >= f[last]) break;
      h[p] = h[c];
      pos[h[p]] = p;
      p = c;
    }
    h[p] = last;
    pos[last] = p;
    return top;
  }
};
var board = (cols, rows, opts) => new Board(cols, rows, opts);
export {
  BLOCKED,
  Board,
  COVER,
  OCCUPIED,
  board
};
