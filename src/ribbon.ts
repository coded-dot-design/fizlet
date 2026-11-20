// @fzlt/core/ribbon: roads, tracks and edge strips drawn along their true curve at their true width,
// draped on a heightfield (an @fzlt/core/terrain, or anything with its `h` grid), instead of coloured
// onto the ground's triangles (whose edges zigzag along the grid, worst far off where the ground is
// drawn coarser). Lifted from Holeshot's road-edge ribbons (src/modes/ribbons.ts); the game's road
// graph and materials stay in the game.
// - A ribbon is a line (closed or open) with bands across it: `band(line, from, to, color)` paints the
//   strip between two offsets from the line (negative: left of its direction), mitred at the joints,
//   cut into pieces no longer than `step`, every corner on the ground's height by the ground's own
//   split rule (what is drawn is what is ridden). Edge strips are narrow bands at the sides.
// - One decal in the ground's cluster, painted inside `d.draw()`: pieces near-clipped and culled off
//   screen, shaded by their slope like the terrain's faces, painted far to near in depth buckets and,
//   in a bucket, one path per colour and shade. Each piece reaches a little back over the one before
//   it: no hairline seams. With `hide`, a piece whose corners all sit behind a crest is skipped; with
//   `cut`, a piece that goes behind one is clipped at the crest line.
// - A band's colour can change along the line (`runs`: a kerb that alternates, a dashed centre line, a
//   strip that stops and starts), and `bands` lays several side by side, each reaching a little under
//   the neighbour painted over it (no seam between two bands at any zoom).
// - The painter's pieces are public (`WP`, `B`, `BK`, `hy`, `hidden`, `bucket`, `emit`, `color`,
//   `light`, `layout`): a scene with its own layout (a road graph walked every frame) emits its own
//   polygons through them inside the same decal.
// - Zero allocation per frame: fixed typed arrays, colours made at build, only arrays cross a call.
//   Render only: the ground's heights are read, never changed.
import type { Diorama } from "./diorama.js";
import { hypot } from "./math.js";

/** What ribbons lie on: a heightfield grid ((cols + 1) × (rows + 1) heights in `h`, row by row). */
export interface RibbonGround {
  /** The heights, row by row ((cols + 1) × (rows + 1), units up). Read every frame, never changed. */
  h: Float64Array;
  /** World x of the grid's first column (units). */
  x0: number;
  /** World z of the grid's first row (units). */
  z0: number;
  /** Cells across (x). */
  cols: number;
  /** Cells deep (z). */
  rows: number;
  /** A cell's side (units). */
  cell: number;
  /** "adaptive": each cell splits along its smaller height difference (the terrain's rule). */
  split?: string;
}

/** The painter's options. */
export interface RibbonOptions {
  /** The decal's cluster (default "terrain": terrainView's). */
  cluster?: string;
  /** The decal's layer in its cluster (default 0.5: over the ground). */
  layer?: number;
  /** The longest piece along the line (default the ground's cell). */
  step?: number;
  /** Pieces painted per frame, at most (default 4096; past it they are dropped and counted). */
  cap?: number;
  /** Depth buckets, far to near (default 8; 1: colour order only). */
  buckets?: number;
  /** Towards the light, [x, y, z] (default diorama's [0.5, 1, 0.4]). */
  light?: ArrayLike<number>;
  /** The ambient light, 0..1 (default 0.56). */
  ambient?: number;
  /** Lift above the ground (default 0.004 units). */
  lift?: number;
  /** Skip pieces hidden behind a crest of the ground (default false: flat or open ground). */
  hide?: boolean;
  /** Clip a piece exactly where its edges go behind a crest, instead of painting it whole while one
   *  corner still shows (default false; implies `hide`). Costs 8 ray tests per edge that crosses a crest. */
  cut?: boolean;
  /** Only pieces within this distance of the camera's target in the floor plane (default: all). */
  reach?: number;
}

/** A band's colours along its line: from distance `at[k]` (units along the line from its first point,
 *  ascending) the band is painted in `colors[k]` (`null`: not painted, a gap) up to `at[k + 1]`; before
 *  `at[0]` in the band's own colour, after the last to the line's end. With `period`, the pattern
 *  repeats every `period` units (`at` within 0..period): a kerb that alternates, a dashed line. */
export interface RibbonRuns {
  /** Where each run starts: distances along the line (units), ascending. */
  at: ArrayLike<number>;
  /** Each run's colour (`#rrggbb`), or `null` for a gap; as many as `at`. */
  colors: ArrayLike<string | null>;
  /** Repeat the pattern every this many units along the line (default: no repeat). */
  period?: number;
}

/** Options for `bands`. */
export interface RibbonBandsOptions {
  /** Join the line's last point to its first (default false). */
  closed?: boolean;
  /** How far a band reaches in under a neighbour painted over it (default 0.15 units; 0: edge to edge). */
  lap?: number;
  /** Each band's colour runs along the line (a missing entry: one colour all the way). */
  runs?: ArrayLike<RibbonRuns | null | undefined>;
}

/** Shade levels a colour is painted in, and the near plane (depth) pieces are clipped at. */
const LV = 33, ZN = 0.3, OV = 0.04;

/** `#rrggbb` at brightness b (0.5..1.12: darkened, or lifted toward white), as rgb(). */
function shade(col: string, b: number) {
  const n = parseInt(col.slice(1), 16), f = (k: number) => { const c = (n >> k) & 255; return (b <= 1 ? c * b : c + (255 - c) * (b - 1) * 0.9) | 0; };
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}

/** Ribbons on ground `g`, painted into diorama `d`. Add bands with `band`; nothing to call per frame. */
export function ribbon(d: Diorama, g: RibbonGround, o: RibbonOptions = {}) {
  const cap = o.cap ?? 4096, nb = Math.max(1, o.buckets ?? 8), step = o.step ?? g.cell, lift = o.lift ?? 0.004, cut = !!o.cut, hide = !!o.hide || cut, reach = o.reach ?? Infinity;
  if (!(step > 0) || !(cap > 0)) throw new RangeError("ribbon: step and cap must be positive");
  const QV = new Float64Array(cap * 10), QN = new Uint8Array(cap), QK = new Uint32Array(cap), ORD = new Int32Array(cap);
  const COL: string[] = [], L = new Float64Array(4), B = new Float64Array(15), WP = new Float64Array(18), WZ = new Float64Array(5), SP = new Float64Array(10), HD = new Uint8Array(4);
  /** The cut's scratch: the clipped corners, each side's crest (and [2]: where `put` puts), the bucket override. */
  const CP = new Float64Array(12), CV = new Float64Array(3), BK = new Int32Array([-1]);
  const lines: { P: Float64Array; n: number; closed: boolean; MN: Float64Array; a: number; b: number; c: number; S: Float64Array; RA: Float64Array | null; RC: Int32Array; per: number; m: number }[] = [];
  let CNT = new Int32Array(1), nq = 0, hmax = -Infinity, own: (() => void) | null = null, mine = false;
  const stats = { pieces: 0, dropped: 0, fills: 0 };
  function light(lv: ArrayLike<number>, ambient: number) {
    const ll = Math.sqrt(lv[0]! * lv[0]! + lv[1]! * lv[1]! + lv[2]! * lv[2]!) || 1;
    L[0] = lv[0]! / ll; L[1] = lv[1]! / ll; L[2] = lv[2]! / ll; L[3] = ambient;
  }
  light(o.light || [0.5, 1, 0.4], o.ambient ?? 0.56);
  const colors = new Map<string, number>();

  /** The ground's height under (A[i], A[i + 2]) into A[i + 1] (the drawn triangle's, by its split rule). */
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
  /** Is WP's corner q behind a crest (the ground above the ray from it to the eye)? */
  function hidden(q: number) {
    const qx = WP[q * 3]!, qy = WP[q * 3 + 1]! + 0.03, qz = WP[q * 3 + 2]!, dx = B[0]! - qx, dy = B[1]! - qy, dz = B[2]! - qz, lh = hypot(dx, dz);
    if (lh < 1e-6) return 0;
    const st = g.cell * 0.5, n = Math.floor(lh / st);
    for (let k = 2; k <= n; k++) {
      const f = (k * st) / lh, y = qy + dy * f;
      if (y > hmax) return 0;
      WP[12] = qx + dx * f; WP[14] = qz + dz * f;
      hy(WP, 12);
      if (WP[13]! > y + lift) return 1;
    }
    return 0;
  }
  /** WP's corner i to the screen (SP) and its depth (WZ): the diorama's pinhole. */
  function prj(i: number) {
    const dx = WP[i * 3]! - B[0]!, dy = WP[i * 3 + 1]! - B[1]!, dz = WP[i * 3 + 2]! - B[2]!, zz = dx * B[9]! + dy * B[10]! + dz * B[11]!, k = B[12]! / (zz > 0.05 ? zz : 0.05);
    SP[i * 2] = B[13]! + (dx * B[3]! + dy * B[4]! + dz * B[5]!) * k;
    SP[i * 2 + 1] = B[14]! - (dx * B[6]! + dy * B[7]! + dz * B[8]!) * k;
    WZ[i] = zz;
  }
  /** The depth bucket of world point (A[i], A[i + 1], A[i + 2]) into BK[0]: far first, finer near. */
  function bucket(A: Float64Array, i: number) {
    const zz = (A[i]! - B[0]!) * B[9]! + (A[i + 1]! - B[1]!) * B[10]! + (A[i + 2]! - B[2]!) * B[11]!, bk = Math.floor((zz > 4 ? 4 / zz : 1) * nb);
    BK[0] = bk >= nb ? nb - 1 : bk;
  }
  /** Where the side from corner i to corner j goes behind a crest (0..1 from i, by halving) into CV[e]. */
  function crest(i: number, j: number, e: number) {
    let lo = 0, hi = 1;
    for (let it = 0; it < 8; it++) {
      const f = (lo + hi) / 2;
      WP[15] = WP[i * 3]! + (WP[j * 3]! - WP[i * 3]!) * f; WP[17] = WP[i * 3 + 2]! + (WP[j * 3 + 2]! - WP[i * 3 + 2]!) * f;
      hy(WP, 15);
      if (hidden(5) === HD[i]) lo = f;
      else hi = f;
    }
    CV[e] = (lo + hi) / 2;
  }
  /** The point CV[2] of the way from corner i to corner j, on the ground, into CP's slot m. */
  function put(i: number, j: number, m: number) {
    const f = CV[2]!;
    CP[m * 3] = WP[i * 3]! + (WP[j * 3]! - WP[i * 3]!) * f; CP[m * 3 + 2] = WP[i * 3 + 2]! + (WP[j * 3 + 2]! - WP[i * 3 + 2]!) * f;
    hy(CP, m * 3);
  }
  /** Emit the polygon in WP (n corners: 4, or 3) in colour c: shaded, cut at a crest, near-clipped,
   *  culled, in its depth bucket. */
  function emit(c: number, n = 4) {
    if (nq >= cap) return void stats.dropped++;
    let back = 0, h = 0;
    for (let i = 0; i < n; i++) (prj(i), WZ[i]! < ZN && back++);
    if (back === n) return;
    if (hide) {
      for (let i = 0; i < n; i++) h += HD[i] = hidden(i);
      if (h === n) return;
    }
    // The normal: a quad's diagonals' cross product, a triangle's two sides'.
    const ia = n > 3 ? 6 : 3, ib = n > 3 ? 9 : 6, ic = n > 3 ? 3 : 0;
    const ux = WP[ia]! - WP[0]!, uy = WP[ia + 1]! - WP[1]!, uz = WP[ia + 2]! - WP[2]!, vx = WP[ib]! - WP[ic]!, vy = WP[ib + 1]! - WP[ic + 1]!, vz = WP[ib + 2]! - WP[ic + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const dot = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / (Math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-12);
    const lvl = Math.round((L[3]! + (1 - L[3]!) * (dot > 0 ? dot : 0)) * 32);
    if (cut && h && n > 3) {
      // Sides 0 → 3 and 1 → 2 run along the line: each one's part in view (from, to; −1: none), the
      // crest found by halving; a side all hidden gives one point, level with the other side's crest.
      const lp = !HD[0], lt = !HD[3], rp = !HD[1], rt = !HD[2];
      if (lp !== lt) crest(0, 3, 0);
      if (rp !== rt) crest(1, 2, 1);
      const l0 = lp ? 0 : lt ? CV[0]! : -1, l1 = lt ? 1 : lp ? CV[0]! : -1, r0 = rp ? 0 : rt ? CV[1]! : -1, r1 = rt ? 1 : rp ? CV[1]! : -1;
      n = 0;
      (CV[2] = l0 >= 0 ? l0 : rp ? r1 : r0), put(0, 3, n++);
      if (r0 >= 0) (CV[2] = r0), put(1, 2, n++), (CV[2] = r1), put(1, 2, n++);
      else (CV[2] = lp ? l1 : l0), put(1, 2, n++);
      if (l0 >= 0) (CV[2] = l1), put(0, 3, n++);
      WP.set(CP);
      back = 0;
      for (let i = 0; i < n; i++) (prj(i), WZ[i]! < ZN && back++);
      if (back === n) return;
    }
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
    if (mine) {
      // A layout's own polygons may wind either way: one winding on screen (the bands'), or two that
      // overlap in one path, wound opposite ways, would cut a hole (the non-zero rule).
      let ar = 0;
      for (let i = 0; i < k; i++) {
        const j = i + 1 === k ? 0 : i + 1;
        ar += QV[q + i * 2]! * QV[q + j * 2 + 1]! - QV[q + j * 2]! * QV[q + i * 2 + 1]!;
      }
      if (ar > 0)
        for (let i = 0, j = k - 1; i < j; i++, j--) {
          const x = QV[q + i * 2]!, y = QV[q + i * 2 + 1]!;
          QV[q + i * 2] = QV[q + j * 2]!; QV[q + i * 2 + 1] = QV[q + j * 2 + 1]!; QV[q + j * 2] = x; QV[q + j * 2 + 1] = y;
        }
    }
    // Far to near: the bucket from the mean depth (finer near the eye), or the one `bucket` chose.
    const zm = zs / k, u = zm > 4 ? 4 / zm : 1, bk = BK[0]! < 0 ? Math.floor(u * nb) : BK[0]!;
    QN[nq] = k; QK[nq] = (bk >= nb ? nb - 1 : bk) * COL.length + c * LV + lvl; nq++;
  }
  /** Paint line `ln`'s band: every piece from segment to segment, mitred corners, each piece reaching
   *  OV back over the one before it. */
  function paintLine(ln: (typeof lines)[number]) {
    const P = ln.P, n = ln.n, MN = ln.MN, a = ln.a, b = ln.b, segs = ln.closed ? n : n - 1;
    const tx = d.cam.tx, tz = d.cam.tz, RA = ln.RA, per = ln.per;
    let pc = -2;
    for (let s = 0; s < segs; s++) {
      const i = s, j = s + 1 === n ? 0 : s + 1, px = P[i * 2]!, pz = P[i * 2 + 1]!, qx = P[j * 2]!, qz = P[j * 2 + 1]!;
      const len = hypot(qx - px, qz - pz);
      if (reach < Infinity && hypot((px + qx) / 2 - tx, (pz + qz) / 2 - tz) - len / 2 > reach) continue;
      // The segment's stretches of one colour (one, 0..1, without runs), each cut into pieces.
      for (let ta = 0, tb = 1; ta < 1; ta = tb, tb = 1) {
        let c = ln.c;
        if (RA) {
          let dd = ln.S[s]! + len * ta + 1e-6, base = 0, r = -1;
          if (per > 0) (base = Math.floor(dd / per) * per), (dd -= base);
          while (r + 1 < RA.length && RA[r + 1]! <= dd) r++;
          if (r >= 0) c = ln.RC[r]!;
          tb = (base + (r + 1 < RA.length ? RA[r + 1]! : per > 0 ? per : Infinity) - ln.S[s]!) / len;
          if (!(tb > ta && tb < 1)) tb = 1;
        }
        if (c >= 0) {
          const k = Math.max(1, Math.ceil((len * (tb - ta)) / step - (RA ? 1e-9 : 0)));
          for (let p = 0; p < k; p++) {
            // Ends of the piece along the segment (t0 reaches back OV over the piece before it, where
            // there is one in its colour), across directions blended from the mitred joint normals so a
            // curve's pieces fan instead of overlapping.
            const t0 = ta + (tb - ta) * (p === 0 ? (ta > 0 || (s === 0 && !ln.closed) || (pc !== c && pc > -2) ? 0 : -OV / k) : (p - OV) / k), t1 = ta + (tb - ta) * ((p + 1) / k);
            for (let e = 0; e < 2; e++) {
              const t = e ? t1 : t0, tc = t < 0 ? 0 : t, x = px + (qx - px) * t, z = pz + (qz - pz) * t;
              const mx = MN[i * 2]! + (MN[j * 2]! - MN[i * 2]!) * tc, mz = MN[i * 2 + 1]! + (MN[j * 2 + 1]! - MN[i * 2 + 1]!) * tc;
              // Corners: e 0 → 0 (a), 1 (b); e 1 → 2 (b), 3 (a): one loop round the quad.
              const ca = e ? 3 : 0, cb = e ? 2 : 1;
              WP[ca * 3] = x + mx * a; WP[ca * 3 + 2] = z + mz * a;
              WP[cb * 3] = x + mx * b; WP[cb * 3 + 2] = z + mz * b;
              hy(WP, ca * 3); hy(WP, cb * 3);
              // Bands laid together share a row's bucket (the point across their middle): the one
              // that reaches under its neighbour is never painted after it.
              if (e && ln.m === ln.m) (WP[15] = x + mx * ln.m), (WP[17] = z + mz * ln.m), hy(WP, 15), bucket(WP, 15);
            }
            emit(c);
            BK[0] = -1;
          }
        }
        pc = c;
      }
    }
  }
  /** The decal: the camera's basis (the diorama's), every band's pieces, then one fill per key. */
  function paint(ctx: CanvasRenderingContext2D) {
    nq = 0; stats.dropped = 0; BK[0] = -1;
    const cm = d.cam, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    B[0] = cm.tx + cm.dist * sy * cp; B[1] = cm.ty + cm.dist * sp; B[2] = cm.tz + cm.dist * cy * cp;
    B[3] = cy; B[4] = 0; B[5] = -sy;
    B[6] = -sy * sp; B[7] = cp; B[8] = -cy * sp;
    B[9] = -sy * cp; B[10] = -sp; B[11] = -cy * cp;
    B[12] = d.height / 2 / Math.tan(cm.fov / 2); B[13] = d.width / 2 + cm.ox; B[14] = d.height / 2 + cm.oy;
    for (let i = 0; i < lines.length; i++) paintLine(lines[i]!);
    if (own) (mine = true), own(), (mine = false), (BK[0] = -1);
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
  d.decal(o.cluster ?? "terrain", o.layer ?? 0.5, paint);
  /** The ground's highest point (for `hide`), after its heights change. */
  function heights() {
    hmax = -Infinity;
    for (let k = 0; k < g.h.length; k++) if (g.h[k]! > hmax) hmax = g.h[k]!;
  }
  heights();

  /** Colour `col`'s index, made on first use (build time); with `at`, slot `at` is repainted as `col`. */
  function color(col: string, at?: number) {
    let c = at ?? colors.get(col);
    if (c === undefined || at !== undefined) {
      if (c === undefined) c = COL.length / LV;
      colors.set(col, c);
      // (Slots skipped by `at` are painted too, in this colour, until they get their own.)
      for (let k = Math.min(c * LV, COL.length); k < (c + 1) * LV; k++) COL[k] = shade(col, 0.5 + ((k % LV) / 40) * 0.62);
      if (COL.length * nb >= CNT.length) CNT = new Int32Array(COL.length * nb + 1);
    }
    return c;
  }
  function band(line: ArrayLike<number>, from: number, to: number, col: string | null, closed = false, runs?: RibbonRuns | null, m = NaN) {
    const n = line.length >> 1, P = Float64Array.from(line), MN = new Float64Array(n * 2), S = new Float64Array(n + 1);
    if (n < 2) throw new RangeError("ribbon: a line needs two points");
    // Each point's mitred across direction: the unit normal scaled by 1 / cos of half the turn
    // (a sharp turn keeps the next segment's normal).
    for (let i = 0; i < n; i++) {
      const p = (i + n - 1) % n, q = (i + 1) % n, hp = closed || i > 0, hq = closed || i < n - 1;
      let ax = P[i * 2]! - P[p * 2]!, az = P[i * 2 + 1]! - P[p * 2 + 1]!, bx = P[q * 2]! - P[i * 2]!, bz = P[q * 2 + 1]! - P[i * 2 + 1]!;
      S[i + 1] = S[i]! + hypot(bx, bz);
      if (!hp) (ax = bx), (az = bz);
      if (!hq) (bx = ax), (bz = az);
      const la = hypot(ax, az) || 1, lb = hypot(bx, bz) || 1;
      ax /= la; az /= la; bx /= lb; bz /= lb;
      const nax = -az, naz = ax, nbx = -bz, nbz = bx, dd = 1 + nax * nbx + naz * nbz;
      MN[i * 2] = dd > 0.2 ? (nax + nbx) / dd : nbx; MN[i * 2 + 1] = dd > 0.2 ? (naz + nbz) / dd : nbz;
    }
    const c = col ? color(col) : -1, RA = runs ? Float64Array.from(runs.at) : null, RC = new Int32Array(RA ? RA.length : 0);
    for (let k = 0; k < RC.length; k++) RC[k] = runs!.colors[k] ? color(runs!.colors[k]!) : -1;
    return lines.push({ P, n, closed, MN, a: Math.min(from, to), b: Math.max(from, to), c, S, RA, RC, per: (runs && runs.period) || 0, m }) - 1;
  }

  return {
    /** Paint a band along `line` ([x, z, …] points; `closed` joins the last to the first) between
     *  offsets `from` and `to` (units across it, negative on the left of its direction), in `color`
     *  (`#rrggbb`; `null`: only where `runs` gives one). `runs` changes the colour along the line, with
     *  gaps. Build time (allocates); returns the band's index. */
    band: band as (line: ArrayLike<number>, from: number, to: number, color: string | null, closed?: boolean, runs?: RibbonRuns | null) => number,
    /** Lay bands side by side along `line`: `edges` their offsets across it, left to right (one more
     *  than bands), `colors` each band's colour (`null`: none there). Where two bands meet, the one
     *  painted first (its colour made first) reaches `lap` in under the other, and every band of a row
     *  takes one depth bucket, so no seam shows between them at any zoom. Build time (allocates);
     *  returns the first band's index. */
    bands(line: ArrayLike<number>, edges: ArrayLike<number>, cols: ArrayLike<string | null>, bo: RibbonBandsOptions = {}) {
      const lap = bo.lap ?? 0.15, nc = cols.length, C: number[] = [];
      for (let k = 0; k < nc; k++) C.push(cols[k] ? color(cols[k]!) : -1);
      for (let k = 0; k < nc; k++) {
        const c = C[k]!, l = k ? C[k - 1]! : -1, r = k + 1 < nc ? C[k + 1]! : -1;
        band(line, edges[k]! - (l > c && c >= 0 ? lap : 0), edges[k + 1]! + (r > c && c >= 0 ? lap : 0), cols[k]!, bo.closed, bo.runs && bo.runs[k], (edges[0]! + edges[nc]!) / 2);
      }
      return lines.length - nc;
    },
    /** Remove every band (colours are kept). */
    clear() {
      lines.length = 0;
    },
    /** Call after the ground's heights change (a stamp): `hide` reads its highest point. */
    heights,
    /** Last frame: pieces painted, dropped (over `cap`), fills. */
    stats,
    /** A colour's index for `emit` (`#rrggbb`; made on first use, build time: allocates). With `at`,
     *  slot `at` is repainted as this colour instead (a theme change): every band and piece in it follows. */
    color,
    /** Set the light: towards it ([x, y, z]) and the ambient light (0..1). No allocation. */
    light,
    /** A function called every frame inside the decal, after the bands' pieces and before the fills:
     *  a scene's own layout (a road graph, rings) fills `WP` and calls `emit`. Its polygons may wind
     *  either way. `null` removes it. What it does must not allocate. */
    layout(fn: (() => void) | null) {
      own = fn;
    },
    /** The decal's own function: everything above, painted into `ctx`. `ribbon` adds it to the
     *  diorama once; after `d.clear()` (a scene rebuilt for a theme) add it again with
     *  `d.decal(cluster, layer, r.paint)`, or call it from a decal of your own. No allocation. */
    paint,
    /** Scratch for `emit`: the polygon's corners in the world ([x, y, z] × 4), then two scratch points
     *  (slots 4 and 5: `emit` and `hidden` write them). */
    WP,
    /** This frame's camera (read only, set before `layout`'s function runs): the eye [0..2], its right
     *  [3..5], up [6..8] and forward [9..11] axes, the focal length in px [12], the screen's middle [13, 14]. */
    B,
    /** The depth bucket `emit` files the next polygons in ([0]; 0 the farthest, `buckets` − 1 the
     *  nearest): set by `bucket`. −1 (the default, and again after each frame): by each polygon's own depth. */
    BK,
    /** The ground's height (plus `lift`) under (A[i], A[i + 2]) into A[i + 1], by the ground's own
     *  split rule. No allocation. */
    hy,
    /** 1 when `WP`'s corner q (0..5) is behind a crest of the ground as the camera sees it, else 0.
     *  No allocation. */
    hidden,
    /** The depth bucket of world point (A[i], A[i + 1], A[i + 2]) into `BK[0]`: polygons emitted
     *  after it share it (a row of bands that overlap: none painted over the one it reaches under).
     *  No allocation. */
    bucket,
    /** Emit the polygon in `WP` (n corners: 4, the default, or 3) in colour index c: shaded by its
     *  slope, hidden or cut behind a crest (`hide`, `cut`: a quad's sides 0 → 3 and 1 → 2 are the ones
     *  cut), clipped at the near plane, culled off screen, filed in its depth bucket. Past `cap` it is
     *  dropped and counted. Call inside `layout`'s function. No allocation. */
    emit,
  };
}
/** What `ribbon` returns. */
export type Ribbon = ReturnType<typeof ribbon>;
