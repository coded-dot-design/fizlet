// @fzlt/core/rig: jointed limbs for diorama figures. A two-bone solve (hip to foot, shoulder to hand) in
// 2D and in 3D, and `limb`, two diorama groups that the 3D solve poses each frame: hang a thigh's parts
// on `limb.a` and a shin's on `limb.b` (each bone runs along its group's +x), then `reach` from the root
// joint to a target. Lifted from Holeshot's rider (a leg from hip to peg, an arm from shoulder to grip),
// with the game's art left in the game. `outset` grows an outline all round (an ink edge's twin).
// Zero allocation per solve: results go into the caller's typed arrays (or the limb's own), and no
// double crosses a call V8 might not inline. Cosmetic: builtin trig (a pose is drawn, not simulated); plane distances on
// @fzlt/core/math's exact `hypot`.
import type { Diorama, DioramaObject } from "./diorama.js";
import { hypot } from "./math.js";

/** Two-bone solve in a plane, from joint A (ax, ay) toward B (bx, by), bones `l1` then `l2`, the middle
 *  joint bending to `bend` (+1: to the left of A→B, counter-clockwise; −1: the other way). Out of reach,
 *  B is pulled in along the line. Writes `out` = [first bone's angle, second bone's angle, middle x,
 *  middle y] (angles in radians from +x, as a diorama group's `rot[2]`), and returns it. */
export function ik2<T extends { [i: number]: number }>(out: T, ax: number, ay: number, bx: number, by: number, l1: number, l2: number, bend = 1): T {
  let dx = bx - ax, dy = by - ay, d = hypot(dx, dy);
  const most = l1 + l2 - 1e-4;
  if (d > most) (dx *= most / d), (dy *= most / d), (d = most);
  if (d < 1e-4) (dx = 1e-4), (dy = 0), (d = 1e-4);
  const c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), a1 = Math.atan2(dy, dx) + (bend < 0 ? -1 : 1) * Math.acos(c < -1 ? -1 : c > 1 ? 1 : c);
  const mx = ax + Math.cos(a1) * l1, my = ay + Math.sin(a1) * l1;
  out[0] = a1; out[1] = Math.atan2(ay + dy - my, ax + dx - mx); out[2] = mx; out[3] = my;
  return out;
}

/** Two-bone solve in 3D from joint A toward B, bones `l1` then `l2`, in the plane through A and B nearest
 *  to normal (nx, ny, nz), the middle joint bending to `bend` (+1: toward n × (B − A), as `ik2`'s with
 *  n = +z). The middle joint is exactly `l1` from A and the end exactly `l2` from it (out of reach, B is
 *  pulled in along the line). Writes `out` (12 numbers) = [middle x, y, z, end x, y, z, the first bone's
 *  rotation x, y, z, the second's x, y, z] (diorama rotations: the bone along its +x, the limb plane's
 *  normal its +z), and returns it. */
export function ik3<T extends { [i: number]: number }>(out: T, ax: number, ay: number, az: number, bx: number, by: number, bz: number, l1: number, l2: number, nx = 0, ny = 0, nz = 1, bend = 1): T {
  I[0] = ax; I[1] = ay; I[2] = az; I[3] = bx; I[4] = by; I[5] = bz; I[6] = l1; I[7] = l2; I[8] = nx; I[9] = ny; I[10] = nz; I[11] = bend;
  solve(out, I);
  return out;
}
/** ik3's inputs, in order (scratch: only arrays cross the solve's call, so no double is boxed). */
const I = new Float64Array(12);
/** ik3 on inputs `q` (ik3's arguments after `out`, in order). */
function solve(out: { [i: number]: number }, q: Float64Array) {
  const ax = q[0]!, ay = q[1]!, az = q[2]!, l1 = q[6]!, l2 = q[7]!;
  let dx = q[3]! - ax, dy = q[4]! - ay, dz = q[5]! - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-4) (dx = 0), (dy = -1e-4), (dz = 0), (d = 1e-4);
  const ux = dx / d, uy = dy / d, uz = dz / d, most = l1 + l2 - 1e-4, nx = q[8]!, ny = q[9]!, nz = q[10]!;
  if (d > most) d = most;
  // The plane's normal: n made square to the line (a fallback when n lies along it).
  const nu = nx * ux + ny * uy + nz * uz;
  let px = nx - nu * ux, py = ny - nu * uy, pz = nz - nu * uz, pl = Math.sqrt(px * px + py * py + pz * pz);
  if (pl < 1e-6) (px = -uy), (py = ux), (pz = 0), (pl = hypot(px, py));
  if (pl < 1e-6) (px = 0), (py = 0), (pz = 1), (pl = 1);
  px /= pl; py /= pl; pz /= pl;
  const s = q[11]! < 0 ? -1 : 1, wx = s * (py * uz - pz * uy), wy = s * (pz * ux - px * uz), wz = s * (px * uy - py * ux);
  const cr = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), c = cr < -1 ? -1 : cr > 1 ? 1 : cr, sn = Math.sqrt(1 - c * c);
  const mx = ax + l1 * (c * ux + sn * wx), my = ay + l1 * (c * uy + sn * wy), mz = az + l1 * (c * uz + sn * wz);
  const ex = ax + d * ux, ey = ay + d * uy, ez = az + d * uz;
  out[0] = mx; out[1] = my; out[2] = mz; out[3] = ex; out[4] = ey; out[5] = ez;
  // Each bone's frame: +x along it, +z the plane's normal (diorama order: y, then x, then z).
  for (let b = 0; b < 2; b++) {
    let x = b ? ex - mx : mx - ax, y = b ? ey - my : my - ay, z = b ? ez - mz : mz - az;
    const l = Math.sqrt(x * x + y * y + z * z) || 1, o = 6 + b * 3;
    x /= l; y /= l; z /= l;
    out[o] = Math.asin(py < -1 ? 1 : py > 1 ? -1 : -py);
    out[o + 1] = Math.atan2(px, pz);
    // The y axis is z × x; its y component sets the roll.
    out[o + 2] = Math.atan2(y, pz * x - px * z);
  }
}

/** A limb's shape: its parent, its two bones, its plane and bend (see `ik3`). */
export interface LimbOptions {
  /** The id of the object it hangs from (both groups are its children: the solve is in its frame). */
  on: string;
  /** The upper bone's length (thigh, upper arm). */
  l1: number;
  /** The lower bone's length (shin, forearm). */
  l2: number;
  /** The limb plane's normal, in the parent's frame (default [0, 0, 1]: a side view's plane). */
  normal?: ArrayLike<number>;
  /** +1 (default) or −1: which way the middle joint bends (a knee forward, an elbow back). */
  bend?: number;
}

/** A two-bone limb on a diorama: groups `${id}:a` (the upper bone, at the root joint) and `${id}:b`
 *  (the lower, at the middle joint), both on `o.on`. Hang the bones' parts on them, each along +x from
 *  0 to its length. `reach(ax, ay, az, bx, by, bz)` poses both from joint A toward B (the parent's
 *  frame, as `pos`) and writes the solve to `limb.at` (`ik3`'s 12 numbers); no allocation. */
export function limb(d: Diorama, id: string, o: LimbOptions) {
  const a: DioramaObject = d.add({ id: id + ":a", shape: "group", size: [0.1, 0, 0.1], on: o.on, pick: false });
  const b: DioramaObject = d.add({ id: id + ":b", shape: "group", size: [0.1, 0, 0.1], on: o.on, pick: false });
  const at = new Float64Array(12), q = new Float64Array(12), n = o.normal || [0, 0, 1];
  q[6] = o.l1; q[7] = o.l2; q[8] = +n[0]!; q[9] = +n[1]!; q[10] = +n[2]!; q[11] = o.bend ?? 1;
  return {
    /** The upper bone's group (`${id}:a`), at the root joint: hang its parts along +x. */
    a,
    /** The lower bone's group (`${id}:b`), at the middle joint: hang its parts along +x. */
    b,
    /** The last solve, as `ik3`'s 12 numbers (the middle joint, the end, both bones' rotations). */
    at,
    /** Pose the limb from joint A toward B (the parent's frame). */
    reach(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
      q[0] = ax; q[1] = ay; q[2] = az; q[3] = bx; q[4] = by; q[5] = bz;
      solve(at, q);
      a.pos[0] = ax; a.pos[1] = ay; a.pos[2] = az;
      a.rot[0] = at[6]!; a.rot[1] = at[7]!; a.rot[2] = at[8]!;
      b.pos[0] = at[0]!; b.pos[1] = at[1]!; b.pos[2] = at[2]!;
      b.rot[0] = at[9]!; b.rot[1] = at[10]!; b.rot[2] = at[11]!;
    },
  };
}
/** A limb from `limb`: its two groups `a` and `b`, its last solve `at`, and `reach`. */
export type Limb = ReturnType<typeof limb>;

/** Outline `P` ([x, y] points, either winding) grown by `e` all round, each corner mitred (spikes
 *  capped): an ink edge's twin, drawn just under the shape. Build time (it allocates). */
export function outset(P: ArrayLike<ArrayLike<number>>, e: number): number[][] {
  const n = P.length;
  let A = 0;
  for (let i = 0; i < n; i++) { const p = P[i]!, q = P[(i + 1) % n]!; A += p[0]! * q[1]! - q[0]! * p[1]!; }
  const s = A > 0 ? 1 : -1, out: number[][] = [];
  const nrm = (a: ArrayLike<number>, b: ArrayLike<number>) => { const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, l = hypot(dx, dy) || 1; return [(s * dy) / l, (-s * dx) / l] as const; };
  for (let i = 0; i < n; i++) {
    const p = P[i]!, a = nrm(P[(i + n - 1) % n]!, p), b = nrm(p, P[(i + 1) % n]!), k = e / Math.max(0.35, 1 + a[0] * b[0] + a[1] * b[1]);
    out.push([p[0]! + (a[0] + b[0]) * k, p[1]! + (a[1] + b[1]) * k]);
  }
  return out;
}
