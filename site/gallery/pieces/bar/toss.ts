// Toss: light, deterministic ball flight for the bar-games series (Cup Toss, Hoop Shot): balls that
// fly, spin, curve and bounce off fixed parts. A candidate for a Fizlet brick (flick is pucks on a
// table; this is balls in the air).
// - Balls are spheres (`radius`) with velocity and spin. In the air: gravity, a little drag and the
//   Magnus push of their spin (a side-spun ball curves, a back-spun one floats).
// - Parts are fixed (or moved by hand with `move`, which gives them a velocity for the bounce):
//   `quad` (a flat, one-sided rectangle: a table top, a backboard, a wall), `ring` (a horizontal
//   torus: a cup's rim, a hoop) and `shell` (a thin open cone or cylinder about a vertical axis: a
//   cup's wall, a hoop's net). Each has its own restitution and friction and a tag for events.
// - A bounce exchanges spin and slide through friction (a top-spun ball kicks on, a back-spun one
//   checks up), so the same shot always takes the same bounces.
// - Fixed step and deterministic: `step(dt)` runs `sub` sub-steps of + − × ÷ and square roots only,
//   so the same launches give the same flights bit for bit on every engine. No allocation per step.
// - Balls rest once slow on something that holds them up; `busy` is false once every live ball
//   rests. Events: `toss:hit` (ball, the part's tag, speed, part index).

/** Something that takes events: an engine's ring (`engine.events`). */
export interface TossEvents {
  emit(type: string, a?: number, b?: number, x?: number, y?: number, v?: number): unknown;
}
export interface TossOptions {
  /** Balls (default 4) and parts (default 32). */
  balls?: number;
  parts?: number;
  /** Ball radius (default 0.02) and spin inertia factor (2/3 a hollow ball, 2/5 a solid one). */
  radius?: number;
  inertia?: number;
  /** Gravity (default 9.8), air drag per unit speed (default 0.08), Magnus factor (default 0.004). */
  gravity?: number;
  drag?: number;
  magnus?: number;
  /** Sub-steps per `step` (default 10). */
  sub?: number;
  /** Rolling resistance on something that holds a ball up, per second (default 0.8). */
  roll?: number;
  events?: TossEvents;
}

/** Part kinds. */
export const QUAD = 0, RING = 1, SHELL = 2;
/** Ball states: not in play, flying (or rolling), resting. */
export const OUT = 0, FLY = 1, REST = 2;

export function toss(o: TossOptions = {}) {
  const NB = o.balls ?? 4, NP = o.parts ?? 32, r = o.radius ?? 0.02, beta = o.inertia ?? 2 / 3;
  const g = o.gravity ?? 9.8, cd = o.drag ?? 0.08, km = o.magnus ?? 0.004, sub = o.sub ?? 10, rr = o.roll ?? 0.8, ev = o.events;
  const f = (n: number) => new Float64Array(n);
  // Balls: position, velocity, spin, state, quiet time, the last part it touched.
  const X = f(NB), Y = f(NB), Z = f(NB), VX = f(NB), VY = f(NB), VZ = f(NB), WX = f(NB), WY = f(NB), WZ = f(NB);
  const ST = new Uint8Array(NB), QT = f(NB), LAST = new Int16Array(NB).fill(-1), SUP = new Uint8Array(NB);
  // Parts: kind, on, tag, restitution, friction, and 16 numbers each (by kind):
  // quad: point (0-2), normal (3-5), u (6-8), v (9-11), half u (12), half v (13)
  // ring: centre (0-2), radius (3), tube (4)
  // shell: axis x, z (0, 1), y0, r0, y1, r1 (2-5), half thickness (6)
  // and the part's velocity (13-15; set by `move`).
  const PK = new Uint8Array(NP), PON = new Uint8Array(NP), PT = new Int16Array(NP), PE = f(NP), PM = f(NP), PD = f(NP * 16);
  const N = f(4); // contact normal (0-2) and depth (3)
  let np = 0, busy = false;

  function part(kind: number, e: number, mu: number, tag: number) {
    if (np >= NP) throw new RangeError("toss: more parts than `parts`");
    PK[np] = kind; PON[np] = 1; PT[np] = tag; PE[np] = e; PM[np] = mu;
    return np++;
  }
  /** The contact of ball i with part p into N (normal from the part to the ball, depth); false: apart. */
  function contact(i: number, p: number) {
    const d = p * 16, x = X[i]!, y = Y[i]!, z = Z[i]!;
    const k = PK[p]!;
    if (k === QUAD) {
      const dx = x - PD[d]!, dy = y - PD[d + 1]!, dz = z - PD[d + 2]!;
      const h = dx * PD[d + 3]! + dy * PD[d + 4]! + dz * PD[d + 5]!;
      if (h >= r || h < -r) return false;
      const u = dx * PD[d + 6]! + dy * PD[d + 7]! + dz * PD[d + 8]!, v = dx * PD[d + 9]! + dy * PD[d + 10]! + dz * PD[d + 11]!;
      if (u > PD[d + 12]! || u < -PD[d + 12]! || v > PD[d + 13]! || v < -PD[d + 13]!) return false;
      N[0] = PD[d + 3]!; N[1] = PD[d + 4]!; N[2] = PD[d + 5]!; N[3] = r - h;
      return true;
    }
    if (k === RING) {
      const dx = x - PD[d]!, dz = z - PD[d + 2]!, rho = Math.sqrt(dx * dx + dz * dz), R = PD[d + 3]!;
      // The nearest point of the circle (straight above the centre: any; take +x).
      const cx = rho > 1e-9 ? PD[d]! + (dx / rho) * R : PD[d]! + R, cz = rho > 1e-9 ? PD[d + 2]! + (dz / rho) * R : PD[d + 2]!;
      const ex = x - cx, ey = y - PD[d + 1]!, ez = z - cz, l = Math.sqrt(ex * ex + ey * ey + ez * ez), reach = r + PD[d + 4]!;
      if (l >= reach || l < 1e-9) return false;
      N[0] = ex / l; N[1] = ey / l; N[2] = ez / l; N[3] = reach - l;
      return true;
    }
    // Shell: in the plane through the axis, the segment (r0, y0)–(r1, y1) against the point (rho, y).
    const dx = x - PD[d]!, dz = z - PD[d + 1]!, rho = Math.sqrt(dx * dx + dz * dz);
    const y0 = PD[d + 2]!, r0 = PD[d + 3]!, y1 = PD[d + 4]!, r1 = PD[d + 5]!, sr = r1 - r0, sy = y1 - y0;
    let t = ((rho - r0) * sr + (y - y0) * sy) / (sr * sr + sy * sy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qr = rho - (r0 + sr * t), qy = y - (y0 + sy * t), l = Math.sqrt(qr * qr + qy * qy), reach = r + PD[d + 6]!;
    if (l >= reach || l < 1e-9 || rho < 1e-9) return false;
    N[0] = (qr / l) * (dx / rho); N[1] = qy / l; N[2] = (qr / l) * (dz / rho); N[3] = reach - l;
    return true;
  }
  /** Bounce ball i off part p along N: restitution on the normal, friction couples slide and spin. */
  function bounce(i: number, p: number) {
    const d = p * 16, nx = N[0]!, ny = N[1]!, nz = N[2]!;
    // Push out, then the velocity relative to the part (a moved part carries its velocity).
    X[i] = X[i]! + nx * N[3]!; Y[i] = Y[i]! + ny * N[3]!; Z[i] = Z[i]! + nz * N[3]!;
    const rvx = VX[i]! - PD[d + 13]!, rvy = VY[i]! - PD[d + 14]!, rvz = VZ[i]! - PD[d + 15]!;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (ny > 0.6) SUP[i] = 1;
    if (vn >= 0) return;
    const e = vn > -0.15 ? 0 : PE[p]!, jn = -(1 + e) * vn;
    // The slip at the contact point (−r·n from the centre): v + w × (−r n), tangential part.
    const sx = rvx - r * (WY[i]! * nz - WZ[i]! * ny), sy = rvy - r * (WZ[i]! * nx - WX[i]! * nz), sz = rvz - r * (WX[i]! * ny - WY[i]! * nx);
    const sn = sx * nx + sy * ny + sz * nz, tx = sx - sn * nx, ty = sy - sn * ny, tz = sz - sn * nz;
    const ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
    VX[i] = VX[i]! + jn * nx; VY[i] = VY[i]! + jn * ny; VZ[i] = VZ[i]! + jn * nz;
    if (ts > 1e-9) {
      // Coulomb: at most μ·jn, at most what stops the slip (the spin takes its share).
      const stop = ts / (1 + 1 / beta), jt = Math.min(PM[p]! * jn, stop) / ts;
      const fx = -tx * jt, fy = -ty * jt, fz = -tz * jt;
      VX[i] = VX[i]! + fx; VY[i] = VY[i]! + fy; VZ[i] = VZ[i]! + fz;
      // Δw = (−r n) × f ÷ (β r²) = −(n × f) ÷ (β r).
      const k = 1 / (beta * r);
      WX[i] = WX[i]! - (ny * fz - nz * fy) * k; WY[i] = WY[i]! - (nz * fx - nx * fz) * k; WZ[i] = WZ[i]! - (nx * fy - ny * fx) * k;
    }
    const sp = -vn;
    if (sp > 0.25 && LAST[i] !== p) ev?.emit("toss:hit", i, PT[p]!, X[i]!, Z[i]!, sp);
    if (sp > 0.25) LAST[i] = p;
  }
  /** Ball against ball: equal masses, restitution 0.85, no friction. */
  function pair(i: number, j: number) {
    const dx = X[j]! - X[i]!, dy = Y[j]! - Y[i]!, dz = Z[j]! - Z[i]!, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= 4 * r * r || d2 < 1e-12) return;
    const l = Math.sqrt(d2), nx = dx / l, ny = dy / l, nz = dz / l, push = (2 * r - l) / 2;
    X[i] = X[i]! - nx * push; Y[i] = Y[i]! - ny * push; Z[i] = Z[i]! - nz * push;
    X[j] = X[j]! + nx * push; Y[j] = Y[j]! + ny * push; Z[j] = Z[j]! + nz * push;
    const vn = (VX[j]! - VX[i]!) * nx + (VY[j]! - VY[i]!) * ny + (VZ[j]! - VZ[i]!) * nz;
    // Resting against each other (or parting): only the push apart, nobody wakes.
    if (vn >= -0.05) return;
    const jn = (-(1 + 0.85) * vn) / 2;
    VX[i] = VX[i]! - jn * nx; VY[i] = VY[i]! - jn * ny; VZ[i] = VZ[i]! - jn * nz;
    VX[j] = VX[j]! + jn * nx; VY[j] = VY[j]! + jn * ny; VZ[j] = VZ[j]! + jn * nz;
    ST[i] = ST[j] = FLY;
    QT[i] = QT[j] = 0;
    if (-vn > 0.3) ev?.emit("toss:hit", i, -1, X[i]!, Z[i]!, -vn);
  }
  function tick(h: number) {
    for (let i = 0; i < NB; i++) {
      if (ST[i] !== FLY) continue;
      const vx = VX[i]!, vy = VY[i]!, vz = VZ[i]!, sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      // Drag, gravity and the Magnus push (w × v).
      const dr = 1 - cd * sp * h;
      VX[i] = vx * dr + km * (WY[i]! * vz - WZ[i]! * vy) * h;
      VY[i] = vy * dr - g * h + km * (WZ[i]! * vx - WX[i]! * vz) * h;
      VZ[i] = vz * dr + km * (WX[i]! * vy - WY[i]! * vx) * h;
      X[i] = X[i]! + VX[i]! * h; Y[i] = Y[i]! + VY[i]! * h; Z[i] = Z[i]! + VZ[i]! * h;
      SUP[i] = 0;
      for (let p = 0; p < np; p++) if (PON[p] && contact(i, p)) bounce(i, p);
      if (SUP[i]) {
        // Rolling on something: it slows, and so does its spin.
        const k = 1 - rr * h;
        VX[i] = VX[i]! * k; VZ[i] = VZ[i]! * k; WX[i] = WX[i]! * k; WY[i] = WY[i]! * k; WZ[i] = WZ[i]! * k;
      }
    }
    for (let i = 0; i < NB; i++) for (let j = i + 1; j < NB; j++) if (ST[i] && ST[j] && (ST[i] === FLY || ST[j] === FLY)) pair(i, j);
    // Rest: slow, held up by something, for a quarter of a second.
    for (let i = 0; i < NB; i++) {
      if (ST[i] !== FLY) continue;
      const v2 = VX[i]! * VX[i]! + VY[i]! * VY[i]! + VZ[i]! * VZ[i]!;
      if (SUP[i] && v2 < 0.0025) {
        QT[i] = QT[i]! + h;
        if (QT[i]! > 0.25) (ST[i] = REST), (VX[i] = VY[i] = VZ[i] = WX[i] = WY[i] = WZ[i] = 0), ev?.emit("toss:rest", i);
      } else QT[i] = 0;
    }
  }
  function step(dt: number) {
    const h = dt / sub;
    for (let s = 0; s < sub; s++) tick(h);
    busy = false;
    for (let i = 0; i < NB; i++) if (ST[i] === FLY) busy = true;
    return busy;
  }
  return {
    x: X, y: Y, z: Z, vx: VX, vy: VY, vz: VZ, wx: WX, wy: WY, wz: WZ, state: ST, radius: r,
    /** Part tags and whether each is on. */
    tag: PT,
    on: PON,
    /** Anything flying or rolling. */
    get busy() {
      return busy;
    },
    /** Parts added. */
    get parts() {
      return np;
    },
    /** A flat one-sided rectangle: centre, its normal (unit), its u axis (unit) and half sizes along u and n × u. */
    quad(cx: number, cy: number, cz: number, nx: number, ny: number, nz: number, ux: number, uy: number, uz: number, hu: number, hv: number, e = 0.6, mu = 0.3, tag = 0) {
      const p = part(QUAD, e, mu, tag), d = p * 16;
      PD[d] = cx; PD[d + 1] = cy; PD[d + 2] = cz; PD[d + 3] = nx; PD[d + 4] = ny; PD[d + 5] = nz;
      PD[d + 6] = ux; PD[d + 7] = uy; PD[d + 8] = uz;
      PD[d + 9] = ny * uz - nz * uy; PD[d + 10] = nz * ux - nx * uz; PD[d + 11] = nx * uy - ny * ux;
      PD[d + 12] = hu; PD[d + 13] = hv;
      return p;
    },
    /** A horizontal torus: centre, radius and tube radius. */
    ring(cx: number, cy: number, cz: number, R: number, tube: number, e = 0.5, mu = 0.2, tag = 0) {
      const p = part(RING, e, mu, tag), d = p * 16;
      PD[d] = cx; PD[d + 1] = cy; PD[d + 2] = cz; PD[d + 3] = R; PD[d + 4] = tube;
      return p;
    },
    /** A thin shell about the vertical axis through (cx, cz): radius r0 at y0 to r1 at y1. */
    shell(cx: number, cz: number, y0: number, r0: number, y1: number, r1: number, thick: number, e = 0.4, mu = 0.2, tag = 0) {
      const p = part(SHELL, e, mu, tag), d = p * 16;
      PD[d] = cx; PD[d + 1] = cz; PD[d + 2] = y0; PD[d + 3] = r0; PD[d + 4] = y1; PD[d + 5] = r1; PD[d + 6] = thick / 2;
      return p;
    },
    /** Move part p by (dx, dy, dz) over dt seconds (its velocity for bounces; dt 0: placed, still). */
    move(p: number, dx: number, dy: number, dz: number, dt = 0) {
      const d = p * 16, k = PK[p]!;
      if (k === SHELL) (PD[d] = PD[d]! + dx), (PD[d + 1] = PD[d + 1]! + dz), (PD[d + 2] = PD[d + 2]! + dy), (PD[d + 4] = PD[d + 4]! + dy);
      else (PD[d] = PD[d]! + dx), (PD[d + 1] = PD[d + 1]! + dy), (PD[d + 2] = PD[d + 2]! + dz);
      PD[d + 13] = dt > 0 ? dx / dt : 0; PD[d + 14] = dt > 0 ? dy / dt : 0; PD[d + 15] = dt > 0 ? dz / dt : 0;
    },
    /** Part p's numbers (see the layout above), to read where it is. */
    data: PD,
    /** Put ball i in flight from (x, y, z) at (vx, vy, vz), spinning (wx, wy, wz). */
    launch(i: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, wx = 0, wy = 0, wz = 0) {
      X[i] = x; Y[i] = y; Z[i] = z; VX[i] = vx; VY[i] = vy; VZ[i] = vz; WX[i] = wx; WY[i] = wy; WZ[i] = wz;
      ST[i] = FLY; QT[i] = 0; LAST[i] = -1;
      busy = true;
    },
    /** Take ball i out of play (it stays where it is). */
    drop(i: number) {
      ST[i] = OUT;
    },
    /** Advance dt seconds in `sub` sub-steps; returns `busy`. */
    step,
    /** Step at dt until nothing flies or `max` steps pass; returns the steps taken. */
    run(dt = 1 / 60, max = 1200) {
      let n = 0;
      while (n < max && step(dt)) n++;
      return n;
    },
  };
}
export type Toss = ReturnType<typeof toss>;
