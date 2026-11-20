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
//   it: no hairline seams. With `hide`, a piece whose corners all sit behind a crest is skipped.
// - Zero allocation per frame: fixed typed arrays, colours made at build, only arrays cross a call.
//   Render only: the ground's heights are read, never changed.
import type { Diorama } from "./diorama.js";
import { hypot } from "./math.js";

/** What ribbons lie on: a heightfield grid ((cols + 1) × (rows + 1) heights in `h`, row by row). */
export interface RibbonGround {
  h: Float64Array;
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  cell: number;
  /** "adaptive": each cell splits along its smaller height difference (the terrain's rule). */
  split?: string;
}

/** The painter's options. */
export interface RibbonOptions {
  /** The decal's cluster (default "terrain": terrainView's) and layer (default 0.5: over the ground). */
  cluster?: string;
  layer?: number;
  /** The longest piece along the line (default the ground's cell). */
  step?: number;
  /** Pieces painted per frame, at most (default 4096; past it they are dropped and counted). */
  cap?: number;
  /** Depth buckets, far to near (default 8; 1: colour order only). */
  buckets?: number;
  /** Towards the light (default diorama's [0.5, 1, 0.4]) and the ambient light (default 0.56). */
  light?: ArrayLike<number>;
  ambient?: number;
  /** Lift above the ground (default 0.004 units). */
  lift?: number;
  /** Skip pieces hidden behind a crest of the ground (default false: flat or open ground). */
  hide?: boolean;
  /** Only pieces within this distance of the camera's target in the floor plane (default: all). */
  reach?: number;
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
  const cap = o.cap ?? 4096, nb = Math.max(1, o.buckets ?? 8), step = o.step ?? g.cell, lift = o.lift ?? 0.004, hide = !!o.hide, reach = o.reach ?? Infinity;
  if (!(step > 0) || !(cap > 0)) throw new RangeError("ribbon: step and cap must be positive");
  const QV = new Float64Array(cap * 10), QN = new Uint8Array(cap), QK = new Uint32Array(cap), ORD = new Int32Array(cap);
  const COL: string[] = [], L = new Float64Array(4), B = new Float64Array(15), WP = new Float64Array(15), WZ = new Float64Array(5), SP = new Float64Array(10), HD = new Uint8Array(4);
  const lines: { P: Float64Array; n: number; closed: boolean; MN: Float64Array; a: number; b: number; c: number }[] = [];
  let CNT = new Int32Array(1), nq = 0, hmax = -Infinity;
  const stats = { pieces: 0, dropped: 0, fills: 0 };
  const lv = o.light || [0.5, 1, 0.4], ll = Math.sqrt(lv[0]! * lv[0]! + lv[1]! * lv[1]! + lv[2]! * lv[2]!) || 1;
  L[0] = lv[0]! / ll; L[1] = lv[1]! / ll; L[2] = lv[2]! / ll; L[3] = o.ambient ?? 0.56;
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
  /** Emit the quad in WP (4 corners) in colour c: shaded, near-clipped, culled, in its depth bucket. */
  function emit(c: number) {
    if (nq >= cap) return void stats.dropped++;
    let back = 0;
    for (let i = 0; i < 4; i++) (prj(i), WZ[i]! < ZN && back++);
    if (back === 4) return;
    if (hide) {
      let h = 0;
      for (let i = 0; i < 4; i++) h += hidden(i);
      if (h === 4) return;
    }
    const ux = WP[6]! - WP[0]!, uy = WP[7]! - WP[1]!, uz = WP[8]! - WP[2]!, vx = WP[9]! - WP[3]!, vy = WP[10]! - WP[4]!, vz = WP[11]! - WP[5]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    const dot = (nx * L[0]! + ny * L[1]! + nz * L[2]!) / (Math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-12);
    const lvl = Math.round((L[3]! + (1 - L[3]!) * (dot > 0 ? dot : 0)) * 32);
    const q = nq * 10;
    let k = 0, zs = 0;
    for (let i = 0; i < 4; i++) {
      const j = i === 3 ? 0 : i + 1, zi = WZ[i]!, zj = WZ[j]!;
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
    // Far to near: the bucket from the mean depth (finer near the eye).
    const zm = zs / k, u = zm > 4 ? 4 / zm : 1, bk = Math.floor(u * nb);
    QN[nq] = k; QK[nq] = (bk >= nb ? nb - 1 : bk) * COL.length + c * LV + lvl; nq++;
  }
  /** Paint line `ln`'s band: every piece from segment to segment, mitred corners, each piece reaching
   *  OV back over the one before it. */
  function paintLine(ln: (typeof lines)[number]) {
    const P = ln.P, n = ln.n, MN = ln.MN, a = ln.a, b = ln.b, segs = ln.closed ? n : n - 1;
    const tx = d.cam.tx, tz = d.cam.tz;
    for (let s = 0; s < segs; s++) {
      const i = s, j = s + 1 === n ? 0 : s + 1, px = P[i * 2]!, pz = P[i * 2 + 1]!, qx = P[j * 2]!, qz = P[j * 2 + 1]!;
      const len = hypot(qx - px, qz - pz);
      if (reach < Infinity && hypot((px + qx) / 2 - tx, (pz + qz) / 2 - tz) - len / 2 > reach) continue;
      const k = Math.max(1, Math.ceil(len / step));
      for (let p = 0; p < k; p++) {
        // Ends of the piece along the segment (t0 reaches back OV), across directions blended from the
        // mitred joint normals so a curve's pieces fan instead of overlapping.
        const t0 = p === 0 ? (s === 0 && !ln.closed ? 0 : -OV / k) : (p - OV) / k, t1 = (p + 1) / k;
        for (let e = 0; e < 2; e++) {
          const t = e ? t1 : t0, tc = t < 0 ? 0 : t, x = px + (qx - px) * t, z = pz + (qz - pz) * t;
          const mx = MN[i * 2]! + (MN[j * 2]! - MN[i * 2]!) * tc, mz = MN[i * 2 + 1]! + (MN[j * 2 + 1]! - MN[i * 2 + 1]!) * tc;
          // Corners: e 0 → 0 (a), 1 (b); e 1 → 2 (b), 3 (a): one loop round the quad.
          const ca = e ? 3 : 0, cb = e ? 2 : 1;
          WP[ca * 3] = x + mx * a; WP[ca * 3 + 2] = z + mz * a;
          WP[cb * 3] = x + mx * b; WP[cb * 3 + 2] = z + mz * b;
          hy(WP, ca * 3); hy(WP, cb * 3);
        }
        emit(ln.c);
      }
    }
  }
  /** The decal: the camera's basis (the diorama's), every band's pieces, then one fill per key. */
  function paint(ctx: CanvasRenderingContext2D) {
    nq = 0; stats.dropped = 0;
    const cm = d.cam, cp = Math.cos(cm.pitch), sp = Math.sin(cm.pitch), cy = Math.cos(cm.yaw), sy = Math.sin(cm.yaw);
    B[0] = cm.tx + cm.dist * sy * cp; B[1] = cm.ty + cm.dist * sp; B[2] = cm.tz + cm.dist * cy * cp;
    B[3] = cy; B[4] = 0; B[5] = -sy;
    B[6] = -sy * sp; B[7] = cp; B[8] = -cy * sp;
    B[9] = -sy * cp; B[10] = -sp; B[11] = -cy * cp;
    B[12] = d.height / 2 / Math.tan(cm.fov / 2); B[13] = d.width / 2 + cm.ox; B[14] = d.height / 2 + cm.oy;
    for (let i = 0; i < lines.length; i++) paintLine(lines[i]!);
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

  return {
    /** Paint a band along `line` ([x, z, …] points; `closed` joins the last to the first) between
     *  offsets `from` and `to` (units across it, negative on the left of its direction), in `color`
     *  (`#rrggbb`). Build time; returns the band's index. */
    band(line: ArrayLike<number>, from: number, to: number, color: string, closed = false) {
      const n = line.length >> 1, P = Float64Array.from(line), MN = new Float64Array(n * 2);
      if (n < 2) throw new RangeError("ribbon: a line needs two points");
      // Each point's mitred across direction: the unit normal scaled by 1 / cos of half the turn
      // (a sharp turn keeps the next segment's normal).
      for (let i = 0; i < n; i++) {
        const p = (i + n - 1) % n, q = (i + 1) % n, hp = closed || i > 0, hq = closed || i < n - 1;
        let ax = P[i * 2]! - P[p * 2]!, az = P[i * 2 + 1]! - P[p * 2 + 1]!, bx = P[q * 2]! - P[i * 2]!, bz = P[q * 2 + 1]! - P[i * 2 + 1]!;
        if (!hp) (ax = bx), (az = bz);
        if (!hq) (bx = ax), (bz = az);
        const la = hypot(ax, az) || 1, lb = hypot(bx, bz) || 1;
        ax /= la; az /= la; bx /= lb; bz /= lb;
        const nax = -az, naz = ax, nbx = -bz, nbz = bx, dd = 1 + nax * nbx + naz * nbz;
        MN[i * 2] = dd > 0.2 ? (nax + nbx) / dd : nbx; MN[i * 2 + 1] = dd > 0.2 ? (naz + nbz) / dd : nbz;
      }
      let c = colors.get(color);
      if (c === undefined) {
        colors.set(color, (c = colors.size));
        for (let l = 0; l < LV; l++) COL.push(shade(color, 0.5 + (l / 40) * 0.62));
        CNT = new Int32Array(COL.length * nb + 1);
      }
      return lines.push({ P, n, closed, MN, a: Math.min(from, to), b: Math.max(from, to), c }) - 1;
    },
    /** Remove every band (colours are kept). */
    clear() {
      lines.length = 0;
    },
    /** Call after the ground's heights change (a stamp): `hide` reads its highest point. */
    heights,
    /** Last frame: pieces painted, dropped (over `cap`), fills. */
    stats,
  };
}
/** What `ribbon` returns. */
export type Ribbon = ReturnType<typeof ribbon>;
