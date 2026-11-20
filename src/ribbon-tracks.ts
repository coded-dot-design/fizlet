// @fzlt/core/ribbon-tracks: what a game's tracks need on top of @fzlt/core/ribbon, as separate exports
// on one small painter, so a game pays only for the ones it imports (they tree-shake; plain ribbon is
// one closure and stays as it is).
// - `painter(d, ground)`: the painter's pieces, for a scene with its own layout (a road graph walked
//   every frame): corners into `WP`, `hy` puts them on the ground, `emit` shades, near-clips, culls and
//   files a quad or a triangle; one decal, far to near in depth buckets, one fill per colour and shade.
// - `band(P, line, from, to, color)`: a strip along a line, mitred, draped (ribbon's own band).
// - `runs(P, band, { at, colors, period })`: the band's colour changes along the line, with gaps (a
//   kerb that alternates, a dashed centre line, a strip that stops and starts).
// - `bands(P, line, edges, colors)`: bands side by side, each reaching a little under the neighbour
//   painted over it, a row in one depth bucket: no seam between two bands at any zoom.
// - `cut(P)`: a piece behind a crest of the ground is skipped, and one that goes behind it is clipped
//   exactly at the crest line instead of drawing through the hill.
// Zero allocation per frame: fixed typed arrays, colours made at build, only arrays cross a call.
// Render only: the ground's heights are read, never changed. Lifted from Holeshot's track painters.
import type { Diorama } from "./diorama.js";
import { hypot } from "./math.js";
import type { RibbonGround } from "./ribbon.js";

/** `painter`'s options. */
export interface PainterOptions {
  /** The decal's cluster (default "terrain": terrainView's). */
  cluster?: string;
  /** The decal's layer in its cluster (default 0.5: over the ground). */
  layer?: number;
  /** Polygons painted per frame, at most (default 4096; past it they are dropped and counted). */
  cap?: number;
  /** Depth buckets, far to near (default 8; 1: colour order only). */
  buckets?: number;
  /** Towards the light (default diorama's [0.5, 1, 0.4]). */
  light?: ArrayLike<number>;
  /** The ambient light (default 0.56). */
  ambient?: number;
  /** Lift above the ground (default 0.004 units). */
  lift?: number;
}

/** A band's colours along its line: from distance `at[k]` (units along the line from its first point,
 *  ascending) the band is painted in `colors[k]` (`null`: not painted, a gap) up to `at[k + 1]`; before
 *  `at[0]` in the band's own colour, after the last to the line's end. With `period`, the pattern
 *  repeats every `period` units (`at` within 0..period). */
export interface TrackRuns {
  /** Where each run starts: distances along the line (units), ascending. */
  at: ArrayLike<number>;
  /** Each run's colour (`#rrggbb`), or `null` for a gap; as many as `at`. */
  colors: ArrayLike<string | null>;
  /** Repeat the pattern every this many units along the line (default: no repeat). */
  period?: number;
}

/** Options for `bands`. */
export interface TrackBandsOptions {
  /** Join the line's last point to its first (default false). */
  closed?: boolean;
  /** How far a band reaches in under a neighbour painted over it (default 0.15 units; 0: edge to edge). */
  lap?: number;
  /** The longest piece along the line (default the ground's cell). */
  step?: number;
}

/** A band made by `band` or `bands`: its line and offsets. Pass it to `runs`; treat its fields as read only. */
export interface TrackBand {
  /** The line's points, [x, z, …]. */
  P: Float64Array;
  /** Each point's mitred across direction, [x, z, …]. */
  MN: Float64Array;
  /** Whether the last point joins the first. */
  closed: boolean;
  /** The band's left offset across the line (units). */
  a: number;
  /** The band's right offset across the line (units). */
  b: number;
  /** Its colour's index (−1: none of its own). */
  c: number;
  /** The longest piece along the line (units). */
  step: number;
  /** The offset whose depth files a row of bands laid together in one bucket (NaN: each piece by its own depth). */
  m: number;
  /** Set by `runs`: the colour and end of the stretch at a place on a segment (through the painter's `F`). */
  run: ((P: Painter, ln: TrackBand, s: number) => void) | null;
  /** Set by `runs`: each point's distance along the line. */
  S?: Float64Array;
  /** Set by `runs`: where each run starts. */
  RA?: Float64Array;
  /** Set by `runs`: each run's colour index (−1: a gap). */
  RC?: Int32Array;
  /** Set by `runs`: the pattern's period (0: none). */
  per?: number;
}

/** Shade levels a colour is painted in, the near plane (depth) polygons are clipped at, and how far
 *  back a piece reaches over the one before it (of its length). */
const LV = 33, ZN = 0.3, OV = 0.04;

/** A painter on ground `g` in diorama `d`: one decal, and the pieces a layout paints through. Build
 *  time (allocates); nothing to call per frame. */
export function painter(d: Diorama, g: RibbonGround, o: PainterOptions = {}) {
  const cap = o.cap ?? 4096, nb = Math.max(1, o.buckets ?? 8), lift = o.lift ?? 0.004;
  const QV = new Float64Array(cap * 10), QN = new Uint8Array(cap), QK = new Uint32Array(cap), ORD = new Int32Array(cap);
  const COL: string[] = [], L = new Float64Array(4), B = new Float64Array(15), WP = new Float64Array(18), WZ = new Float64Array(5), SP = new Float64Array(10), BK = new Int32Array([-1]);
  const lays: (() => void)[] = [], stats = { pieces: 0, dropped: 0, fills: 0 }, colors = new Map<string, number>();
  let CNT = new Int32Array(1), nq = 0;

  function hy(A: Float64Array, i: number) {
    const c = g.cell, n = g.cols, m = g.rows, W1 = n + 1, hs = g.h;
    let u = (A[i]! - g.x0) / c, v = (A[i + 2]! - g.z0) / c;
    u = u < 0 ? 0 : u > n ? n : u; v = v < 0 ? 0 : v > m ? m : v;
    let x = Math.floor(u), z = Math.floor(v);
    if (x > n - 1) x = n - 1;
    if (z > m - 1) z = m - 1;
    const fu = u - x, fv = v - z, k = z * W1 + x, a = hs[k]!, b = hs[k + 1]!, cc = hs[k + W1 + 1]!, dd = hs[k + W1]!;
    const fl = g.split === "adaptive" && Math.abs(b - dd) < Math.abs(cc - a), up = fl ? fu + fv > 1 : fu >= fv;
    const sx = up !== fl ? b - a : cc - dd, sz = up ? cc - b : dd - a;
    A[i + 1] = a + sx * fu + sz * fv + (fl && up ? b - a - sx : 0) + lift;
  }
  /** WP's corner i to the screen (SP) and its depth (WZ): the diorama's pinhole. Returns 1 behind the near plane. */
  function prj(i: number) {
    const dx = WP[i * 3]! - B[0]!, dy = WP[i * 3 + 1]! - B[1]!, dz = WP[i * 3 + 2]! - B[2]!, zz = dx * B[9]! + dy * B[10]! + dz * B[11]!, k = B[12]! / (zz > 0.05 ? zz : 0.05);
    SP[i * 2] = B[13]! + (dx * B[3]! + dy * B[4]! + dz * B[5]!) * k;
    SP[i * 2 + 1] = B[14]! - (dx * B[6]! + dy * B[7]! + dz * B[8]!) * k;
    return (WZ[i] = zz) < ZN ? 1 : 0;
  }
  function bucket(A: Float64Array, i: number) {
    const zz = (A[i]! - B[0]!) * B[9]! + (A[i + 1]! - B[1]!) * B[10]! + (A[i + 2]! - B[2]!) * B[11]!, bk = Math.floor((zz > 4 ? 4 / zz : 1) * nb);
    BK[0] = bk >= nb ? nb - 1 : bk;
  }
  function emit(c: number, n = 4) {
    if (nq >= cap) return void stats.dropped++;
    // The normal: a quad's diagonals' cross product, a triangle's two sides'.
    const ia = n > 3 ? 6 : 3, ib = n > 3 ? 9 : 6, ic = n > 3 ? 3 : 0;
    const ux = WP[ia]! - WP[0]!, uy = WP[ia + 1]! - WP[1]!, uz = WP[ia + 2]! - WP[2]!, vx = WP[ib]! - WP[ic]!, vy = WP[ib + 1]! - WP[ic + 1]!, vz = WP[ib + 2]! - WP[ic + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const dot = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / (Math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-12);
    const lvl = Math.round((L[3]! + (1 - L[3]!) * (dot > 0 ? dot : 0)) * 32);
    // `cut`'s hook: the corners left in view (0: none).
    if (P.clip && !(n = P.clip(n))) return;
    let back = 0;
    for (let i = 0; i < n; i++) back += prj(i);
    if (back === n) return;
    const q = nq * 10;
    let k = 0, zs = 0;
    for (let i = 0; i < n; i++) {
      const j = i === n - 1 ? 0 : i + 1, zi = WZ[i]!, zj = WZ[j]!;
      if (zi >= ZN) (QV[q + k * 2] = SP[i * 2]!), (QV[q + k * 2 + 1] = SP[i * 2 + 1]!), k++, (zs += zi);
      if (zi >= ZN !== zj >= ZN) {
        const f = (ZN - zi) / (zj - zi);
        for (let a = 0; a < 3; a++) WP[12 + a] = WP[i * 3 + a]! + (WP[j * 3 + a]! - WP[i * 3 + a]!) * f;
        prj(4);
        (QV[q + k * 2] = SP[8]!), (QV[q + k * 2 + 1] = SP[9]!), k++, (zs += ZN);
      }
    }
    let l0 = 0, r0 = 0, t0 = 0, b0 = 0;
    const W = d.width, H = d.height;
    for (let i = 0; i < k; i++) {
      const x = QV[q + i * 2]!, y = QV[q + i * 2 + 1]!;
      if (x < 0) l0++;
      if (x > W) r0++;
      if (y < 0) t0++;
      if (y > H) b0++;
    }
    if (l0 === k || r0 === k || t0 === k || b0 === k) return;
    // Far to near: the bucket from the mean depth (finer near the eye), or the one `bucket` chose.
    const zm = zs / k, bk = BK[0]! < 0 ? Math.floor((zm > 4 ? 4 / zm : 1) * nb) : BK[0]!;
    QN[nq] = k; QK[nq] = (bk >= nb ? nb - 1 : bk) * COL.length + c * LV + lvl; nq++;
  }
  function paint(ctx: CanvasRenderingContext2D) {
    nq = 0; stats.dropped = 0;
    const cm = d.cam, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    B[0] = cm.tx + cm.dist * sy * cp; B[1] = cm.ty + cm.dist * sp; B[2] = cm.tz + cm.dist * cy * cp;
    B[3] = cy; B[4] = 0; B[5] = -sy;
    B[6] = -sy * sp; B[7] = cp; B[8] = -cy * sp;
    B[9] = -sy * cp; B[10] = -sp; B[11] = -cy * cp;
    B[12] = d.height / 2 / Math.tan(cm.fov / 2); B[13] = d.width / 2 + cm.ox; B[14] = d.height / 2 + cm.oy;
    for (let i = 0; i < lays.length; i++) (BK[0] = -1), lays[i]!();
    stats.pieces = nq;
    const NK = COL.length, NKB = NK * nb;
    CNT.fill(0);
    for (let q = 0; q < nq; q++) CNT[QK[q]! + 1]!++;
    for (let k = 0; k < NKB; k++) CNT[k + 1] = CNT[k + 1]! + CNT[k]!;
    for (let q = 0; q < nq; q++) ORD[CNT[QK[q]!]!++] = q;
    let key = -1, fills = 0;
    for (let a = 0; a < nq; a++) {
      const q = ORD[a]!, v = q * 10, n = QN[q]!;
      if (QK[q] !== key) {
        if (key >= 0) ctx.fill();
        key = QK[q]!;
        ctx.fillStyle = COL[key % NK]!;
        ctx.beginPath();
        fills++;
      }
      ctx.moveTo(QV[v]!, QV[v + 1]!);
      for (let i = 1; i < n; i++) ctx.lineTo(QV[v + i * 2]!, QV[v + i * 2 + 1]!);
      ctx.closePath();
    }
    if (key >= 0) ctx.fill();
    stats.fills = fills;
  }
  function light(lv: ArrayLike<number>, ambient: number) {
    const ll = Math.sqrt(lv[0]! * lv[0]! + lv[1]! * lv[1]! + lv[2]! * lv[2]!) || 1;
    L[0] = lv[0]! / ll; L[1] = lv[1]! / ll; L[2] = lv[2]! / ll; L[3] = ambient;
  }
  light(o.light || [0.5, 1, 0.4], o.ambient ?? 0.56);
  d.decal(o.cluster ?? "terrain", o.layer ?? 0.5, paint);

  const P = {
    /** The diorama painted into. */
    d,
    /** The ground painted on. */
    g,
    /** The bands `band` and `bands` made, in the order they are laid. Empty it to remove them all. */
    lines: [] as TrackBand[],
    /** Scratch for `emit`: the polygon's corners in the world ([x, y, z] × 4), then two scratch points
     *  (slots 4 and 5: `emit`, `band` and `cut` write them). */
    WP,
    /** This frame's camera (read only, set before a layout's function runs): the eye [0..2], its right
     *  [3..5], up [6..8] and forward [9..11] axes, the focal length in px [12], the screen's middle [13, 14]. */
    B,
    /** The depth bucket `emit` files the next polygons in ([0]; 0 the farthest, `buckets` − 1 the
     *  nearest): set by `bucket`. −1 (the default, and again before each layout's function): by each
     *  polygon's own depth. */
    BK,
    /** Scratch between `band` and `runs`: a place on a segment ([0] 0..1, [1] the segment's length),
     *  the stretch's end ([2]) and colour index ([3]). */
    F: new Float64Array(4),
    /** The lift above the ground `hy` adds (units). */
    lift,
    /** Whether `band` has added its layout to this painter. */
    banded: false,
    /** The ground's highest point, for `cut`'s test (Infinity until `cut` reads it). */
    top: Infinity,
    /** Set by `cut`: called by `emit` with the polygon's corner count; returns the count left in view
     *  (0: none), the corners cut in `WP`. */
    clip: null as ((n: number) => number) | null,
    /** Last frame: polygons painted, dropped (over `cap`), fills. */
    stats,
    /** The ground's height (plus `lift`) under (A[i], A[i + 2]) into A[i + 1], by the ground's own
     *  split rule. No allocation. */
    hy,
    /** The depth bucket of world point (A[i], A[i + 1], A[i + 2]) into `BK[0]`: polygons emitted
     *  after it share it (a row of bands that overlap: none painted over the one it reaches under).
     *  No allocation. */
    bucket,
    /** Emit the polygon in `WP` (n corners: 4, the default, or 3) in colour index c: shaded by its
     *  slope, clipped at the near plane, culled off screen, filed in its depth bucket. Past `cap` it
     *  is dropped and counted. Wind every polygon one way on screen (`band`'s pieces go anticlockwise):
     *  two that overlap in one colour, wound opposite ways, cut a hole. Call inside a layout's
     *  function. No allocation. */
    emit,
    /** A colour's index for `emit` (`#rrggbb`; made on first use, build time: allocates). With `at`,
     *  slot `at` is repainted as this colour instead (a theme change): every band and polygon in it follows. */
    color(col: string, at?: number) {
      let c = at ?? colors.get(col);
      if (c === undefined || at !== undefined) {
        colors.set(col, (c ??= COL.length / LV));
        // (Slots skipped by `at` are painted too, in this colour, until they get their own.)
        for (let k = Math.min(c * LV, COL.length); k < (c + 1) * LV; k++) COL[k] = shade(col, 0.5 + ((k % LV) / 40) * 0.62);
        if (COL.length * nb >= CNT.length) CNT = new Int32Array(COL.length * nb + 1);
      }
      return c;
    },
    /** Set the light: towards it ([x, y, z]) and the ambient light (0..1). No allocation. */
    light,
    /** Add a function called every frame inside the decal, before the fills: a scene's own layout (a
     *  road graph, rings) fills `WP` and calls `emit`. What it does must not allocate. */
    layout(fn: () => void) {
      lays.push(fn);
    },
    /** The decal's own function: every layout, painted into `ctx`. `painter` adds it to the diorama
     *  once; after `d.clear()` (a scene rebuilt for a theme) add it again with
     *  `d.decal(cluster, layer, P.paint)`, or call it from a decal of your own. No allocation. */
    paint,
  };
  return P;
}
/** What `painter` returns: the pieces. */
export type Painter = ReturnType<typeof painter>;

/** `#rrggbb` at brightness b (0.5..1.12: darkened, or lifted toward white), as rgb(). */
function shade(col: string, b: number) {
  const n = parseInt(col.slice(1), 16), f = (k: number) => { const c = (n >> k) & 255; return (b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9) | 0; };
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}

/** Every band's pieces, from segment to segment: mitred corners, each piece reaching OV back over the
 *  one before it; a band with runs paints each stretch in its colour. */
function lay(P: Painter) {
  const WP = P.WP, F = P.F, hy = P.hy;
  for (const ln of P.lines) {
    const Q = ln.P, MN = ln.MN, n = Q.length >> 1, a = ln.a, b = ln.b, m = ln.m, segs = ln.closed ? n : n - 1;
    let pc = -2;
    for (let s = 0; s < segs; s++) {
      const i = s, j = s + 1 === n ? 0 : s + 1, px = Q[i * 2]!, pz = Q[i * 2 + 1]!, qx = Q[j * 2]!, qz = Q[j * 2 + 1]!;
      const len = hypot(qx - px, qz - pz);
      // The segment's stretches of one colour (one, 0..1, without runs), each cut into pieces.
      for (let ta = 0, tb = 1; ta < 1; ta = tb, tb = 1) {
        let c = ln.c;
        if (ln.run) (F[0] = ta), (F[1] = len), ln.run(P, ln, s), (tb = F[2]!), (c = F[3]!);
        if (c >= 0) {
          const k = Math.max(1, Math.ceil((len * (tb - ta)) / ln.step - (ln.run ? 1e-9 : 0)));
          for (let p = 0; p < k; p++) {
            const t0 = ta + (tb - ta) * (p === 0 ? (ta > 0 || (s === 0 && !ln.closed) || (pc !== c && pc > -2) ? 0 : -OV / k) : (p - OV) / k), t1 = ta + (tb - ta) * ((p + 1) / k);
            for (let e = 0; e < 2; e++) {
              const t = e ? t1 : t0, tc = t < 0 ? 0 : t, x = px + (qx - px) * t, z = pz + (qz - pz) * t;
              const mx = MN[i * 2]! + (MN[j * 2]! - MN[i * 2]!) * tc, mz = MN[i * 2 + 1]! + (MN[j * 2 + 1]! - MN[i * 2 + 1]!) * tc;
              // Corners: e 0 → 0 (a), 1 (b); e 1 → 2 (b), 3 (a): one loop round the quad.
              const ca = e ? 9 : 0, cb = e ? 6 : 3;
              WP[ca] = x + mx * a; WP[ca + 2] = z + mz * a;
              WP[cb] = x + mx * b; WP[cb + 2] = z + mz * b;
              hy(WP, ca); hy(WP, cb);
              // Bands laid together share a row's bucket: the one that reaches under is never painted last.
              if (e && m === m) (WP[15] = x + mx * m), (WP[17] = z + mz * m), hy(WP, 15), P.bucket(WP, 15);
            }
            P.emit(c);
            P.BK[0] = -1;
          }
        }
        pc = c;
      }
    }
  }
}

/** Paint a band along `line` ([x, z, …] points; `closed` joins the last to the first) between offsets
 *  `from` and `to` (units across it, negative on the left of its direction), in `color` (`#rrggbb`;
 *  `null`: only where `runs` gives one), mitred at the joints, cut into pieces no longer than `step`
 *  (default the ground's cell), every corner on the ground. Build time (allocates); returns the band. */
export function band(P: Painter, line: ArrayLike<number>, from: number, to: number, color: string | null, closed = false, step = P.g.cell): TrackBand {
  const n = line.length >> 1, Q = Float64Array.from(line), MN = new Float64Array(n * 2);
  if (n < 2 || !(step > 0)) throw new RangeError("ribbon-tracks: line");
  // Each point's mitred across direction: the unit normal scaled by 1 / cos of half the turn
  // (a sharp turn keeps the next segment's normal).
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n;
    let ax = Q[i * 2]! - Q[p * 2]!, az = Q[i * 2 + 1]! - Q[p * 2 + 1]!, bx = Q[q * 2]! - Q[i * 2]!, bz = Q[q * 2 + 1]! - Q[i * 2 + 1]!;
    if (!closed && !i) (ax = bx), (az = bz);
    if (!closed && !q) (bx = ax), (bz = az);
    const la = hypot(ax, az) || 1, lb = hypot(bx, bz) || 1;
    ax /= la; az /= la; bx /= lb; bz /= lb;
    const dd = 1 + az * bz + ax * bx;
    MN[i * 2] = dd > 0.2 ? (-az - bz) / dd : -bz; MN[i * 2 + 1] = dd > 0.2 ? (ax + bx) / dd : bx;
  }
  if (!P.banded) (P.banded = true), P.layout(() => lay(P));
  const ln: TrackBand = { P: Q, MN, closed, a: Math.min(from, to), b: Math.max(from, to), c: color ? P.color(color) : -1, step, m: NaN, run: null };
  P.lines.push(ln);
  return ln;
}

/** The stretch at F[0] of segment s (F[1] long): its end into F[2] (0..1 along the segment) and its
 *  colour index into F[3] (−1: a gap). */
function runAt(P: Painter, ln: TrackBand, s: number) {
  const F = P.F, RA = ln.RA!, per = ln.per!, d0 = ln.S![s]!;
  let dd = d0 + F[1]! * F[0]! + 1e-6, base = 0, r = -1;
  if (per > 0) (base = Math.floor(dd / per) * per), (dd -= base);
  while (r + 1 < RA.length && RA[r + 1]! <= dd) r++;
  const tb = (base + (r + 1 < RA.length ? RA[r + 1]! : per > 0 ? per : Infinity) - d0) / F[1]!;
  F[2] = tb > F[0]! && tb < 1 ? tb : 1;
  F[3] = r < 0 ? ln.c : ln.RC![r]!;
}

/** Change band `ln`'s colour along its line, with gaps: `r.at` the distances where a run starts,
 *  `r.colors` each run's colour (`null`: a gap), `r.period` to repeat. Each stretch is cut exactly at
 *  its distance. Build time (allocates); painting it allocates nothing. */
export function runs(P: Painter, ln: TrackBand, r: TrackRuns) {
  const Q = ln.P, n = Q.length >> 1, S = (ln.S = new Float64Array(n + 1)), RA = (ln.RA = Float64Array.from(r.at)), RC = (ln.RC = new Int32Array(RA.length));
  for (let i = 0; i < n; i++) {
    const q = (i + 1) % n;
    S[i + 1] = S[i]! + hypot(Q[q * 2]! - Q[i * 2]!, Q[q * 2 + 1]! - Q[i * 2 + 1]!);
  }
  for (let k = 0; k < RC.length; k++) RC[k] = r.colors[k] ? P.color(r.colors[k]!) : -1;
  ln.per = r.period || 0;
  ln.run = runAt;
}

/** Lay bands side by side along `line`: `edges` their offsets across it, left to right (one more than
 *  bands), `colors` each band's colour (`null`: none there). Where two bands meet, the one painted
 *  first (its colour made first) reaches `lap` in under the other, and every band of a row takes one
 *  depth bucket, so no seam shows between them at any zoom. Build time (allocates); returns the bands,
 *  left to right. */
export function bands(P: Painter, line: ArrayLike<number>, edges: ArrayLike<number>, colors: ArrayLike<string | null>, o: TrackBandsOptions = {}) {
  const lap = o.lap ?? 0.15, nc = colors.length, C: number[] = [], out: TrackBand[] = [];
  for (let k = 0; k < nc; k++) C.push(colors[k] ? P.color(colors[k]!) : -1);
  for (let k = 0; k < nc; k++) {
    const c = C[k]!, ln = band(P, line, edges[k]! - (c >= 0 && C[k - 1]! > c ? lap : 0), edges[k + 1]! + (c >= 0 && C[k + 1]! > c ? lap : 0), colors[k]!, o.closed, o.step);
    ln.m = (edges[0]! + edges[nc]!) / 2;
    out.push(ln);
  }
  return out;
}

/** 1 when `P.WP`'s corner q (0..5) is behind a crest of the ground as the camera sees it (the ground
 *  above the ray from it to the eye), else 0. No allocation. */
export function hidden(P: Painter, q: number) {
  const WP = P.WP, B = P.B, g = P.g;
  const qx = WP[q * 3]!, qy = WP[q * 3 + 1]! + 0.03, qz = WP[q * 3 + 2]!, dx = B[0]! - qx, dy = B[1]! - qy, dz = B[2]! - qz, lh = hypot(dx, dz);
  const st = g.cell * 0.5, n = Math.floor(lh / st);
  for (let k = 2; k <= n; k++) {
    const f = (k * st) / lh, y = qy + dy * f;
    if (y > P.top) return 0;
    WP[12] = qx + dx * f; WP[14] = qz + dz * f;
    P.hy(WP, 12);
    if (WP[13]! > y + P.lift) return 1;
  }
  return 0;
}

/** Hide what is behind a crest of the ground: from now on a polygon whose corners are all hidden is
 *  skipped, and (`exact`, the default) a quad that goes behind a crest is clipped exactly at the crest
 *  line, on its sides 0 → 3 and 1 → 2 (the ones along a band's line), found by 8 halvings each;
 *  without `exact` it is painted whole while one corner shows. Returns a function to call after the
 *  ground's heights change (the test reads its highest point). Build time; painting allocates nothing. */
export function cut(P: Painter, exact = true) {
  const WP = P.WP, HD = new Uint8Array(4), CP = new Float64Array(12), CV = new Float64Array(3);
  /** The point CV[2] of the way from corner i to corner j, on the ground, into WP's slot 5. */
  function at(i: number, j: number) {
    WP[15] = WP[i]! + (WP[j]! - WP[i]!) * CV[2]!; WP[17] = WP[i + 2]! + (WP[j + 2]! - WP[i + 2]!) * CV[2]!;
    P.hy(WP, 15);
  }
  /** Where the side from corner i to corner j (hidden at one end) goes behind the crest, into CV[e]. */
  function crest(i: number, j: number, e: number) {
    let lo = 0, hi = 1;
    for (let it = 0; it < 8; it++) {
      CV[2] = (lo + hi) / 2;
      at(i * 3, j * 3);
      if (hidden(P, 5) === HD[i]) lo = CV[2]!;
      else hi = CV[2]!;
    }
    CV[e] = (lo + hi) / 2;
  }
  /** That point into CP's slot m. */
  function put(i: number, j: number, f: number, m: number) {
    CV[2] = f;
    at(i, j);
    CP[m] = WP[15]!; CP[m + 1] = WP[16]!; CP[m + 2] = WP[17]!;
  }
  P.clip = (n) => {
    let h = 0;
    for (let i = 0; i < n; i++) h += HD[i] = hidden(P, i);
    if (!h || h === n) return h ? 0 : n;
    if (!exact || n < 4) return n;
    // Each side's part in view (from, to; −1: none); a side all hidden gives one point, level with
    // the other side's crest.
    const lp = !HD[0], lt = !HD[3], rp = !HD[1], rt = !HD[2];
    if (lp !== lt) crest(0, 3, 0);
    if (rp !== rt) crest(1, 2, 1);
    const l0 = lp ? 0 : lt ? CV[0]! : -1, l1 = lt ? 1 : lp ? CV[0]! : -1, r0 = rp ? 0 : rt ? CV[1]! : -1, r1 = rt ? 1 : rp ? CV[1]! : -1;
    n = 0;
    put(0, 9, l0 >= 0 ? l0 : rp ? r1 : r0, n++ * 3);
    if (r0 >= 0) put(3, 6, r0, n++ * 3), put(3, 6, r1, n++ * 3);
    else put(3, 6, lp ? l1 : l0, n++ * 3);
    if (l0 >= 0) put(0, 9, l1, n++ * 3);
    WP.set(CP);
    return n;
  };
  const heights = () => {
    P.top = -Infinity;
    for (let k = 0; k < P.g.h.length; k++) if (P.g.h[k]! > P.top) P.top = P.g.h[k]!;
  };
  heights();
  return heights;
}
