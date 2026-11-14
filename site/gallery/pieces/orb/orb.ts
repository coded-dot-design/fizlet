// The orb: a small round world for diorama scenes (a brick candidate, `@fzlt/core/orb`). Headless
// maths only, no DOM and no clock; Moon Rover (./moon-rover.ts) is its first scene.
// - A sphere of radius `radius` with a seeded surface: craters (bowl, rim) and broad hills, plus
//   flat-topped features a game adds (`ramp`: a wedge the wheels climb). `height(x, y, z)` is the
//   height over the radius along a unit direction.
// - `tiles(freq)`: a geodesic shell (an icosahedron cut into 20 × freq² triangles, each corner lifted
//   to the surface) for drawing: one flat face per tile, shared corners, no cracks.
// - `chart()`: a ground for `@fzlt/core/drive` on the curved surface. The car drives in a local
//   tangent frame (x, z on the plane that touches the sphere under it, y up from the radius); after
//   every step `recentre(car)` moves the frame under the car again, carrying its axes along the
//   way (parallel transport) and turning the car's velocity into the new frame, so gravity always
//   points at the centre, jumps follow the curve and the heading stays continuous.
// - `view()`: the camera rule of a round world: the car stays at the top of the picture and the
//   world turns under it. It keeps a smoothed up and forward, the rotation Q from orb space into
//   the diorama's world (forward is −z, up is +y, the centre at (0, −radius, 0)), the eye in orb
//   space for horizon culling (`facing`), and depth-sort anchors for diorama clusters (`anchor`).
// - `euler(M, out)`: a rotation matrix into diorama's [x, y, z] angles, so anything placed in orb
//   space can be posed as a diorama object.
// Deterministic: the surface, the chart and the transport (every per-step call) use + − × ÷ and square roots only, so the
// same inputs give the same path everywhere. Zero allocation in every per-step and per-frame call.

/** Options for `orb()`. */
export interface OrbOptions {
  /** Sphere radius, world units (default 26). */
  radius?: number;
  /** Surface seed (default 1). */
  seed?: number;
  /** Craters (default 34). */
  craters?: number;
  /** Broad hills (default 14). */
  hills?: number;
  /** Deepest crater, units (default 1.6). */
  depth?: number;
}

/** A small seeded random (an LCG on integers: identical in every engine). */
function lcg(seed: number) {
  const s = new Uint32Array([seed >>> 0 || 1]);
  return () => ((s[0] = Math.imul(s[0]!, 1664525) + 1013904223), s[0]! / 4294967296);
}

/** A seeded round world: its surface, tiles to draw it, a drive ground and the camera rule. */
export function orb(o: OrbOptions = {}) {
  const R = o.radius ?? 26, nc = o.craters ?? 34, nh = o.hills ?? 14, dep = o.depth ?? 1.6, rnd = lcg(o.seed ?? 1);
  // Craters: centre (3), cos of the radius, 1 / (1 − cos), depth. Hills: centre, cos, 1 / (1 − cos), height.
  const CR = new Float64Array(nc * 6), HL = new Float64Array(nh * 6);
  // Ramps a game adds: centre (3), forward (3), side (3), half length, half width, height.
  const RP = new Float64Array(16 * 12);
  let nr = 0;
  const U = new Float64Array(3);
  /** A seeded unit vector into U, by rejection in the cube (no trig). */
  function randDir() {
    for (;;) {
      const x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1, d = x * x + y * y + z * z;
      if (d > 0.01 && d < 1) { const k = 1 / Math.sqrt(d); U[0] = x * k; U[1] = y * k; U[2] = z * k; return; }
    }
  }
  for (let i = 0; i < nc; i++) {
    randDir();
    // Angular radius 0.07..0.2 rad (about 2 to 5 units on the default moon); the big ones deeper.
    const a = 0.07 + rnd() * rnd() * 0.15, c = 1 - (a * a) / 2 + (a * a * a * a) / 24;
    CR.set([U[0]!, U[1]!, U[2]!, c, 1 / (1 - c), dep * (0.35 + 0.65 * ((a - 0.07) / 0.15)) * (0.6 + rnd() * 0.4)], i * 6);
  }
  for (let i = 0; i < nh; i++) {
    randDir();
    const a = 0.22 + rnd() * 0.3, c = 1 - (a * a) / 2 + (a * a * a * a) / 24;
    HL.set([U[0]!, U[1]!, U[2]!, c, 1 / (1 - c), (rnd() * 2 - 1) * 1.1], i * 6);
  }

  // The hot path takes its inputs from a typed array and writes its result back (a double passed to
  // or returned from a call the JIT does not inline is boxed): HQ = [x, y, z, height].
  const HQ = new Float64Array(4);
  /** HQ[3] = terrain height over the radius along unit HQ[0..2]: hills, then craters (bowl and rim). */
  function tq() {
    const x = HQ[0]!, y = HQ[1]!, z = HQ[2]!;
    let h = 0;
    for (let i = 0; i < nh * 6; i += 6) {
      const d = x * HL[i]! + y * HL[i + 1]! + z * HL[i + 2]!;
      if (d <= HL[i + 3]!) continue;
      const t = (1 - d) * HL[i + 4]!, s = 1 - t;
      h += HL[i + 5]! * s * s * (1 + 2 * t);
    }
    for (let i = 0; i < nc * 6; i += 6) {
      const d = x * CR[i]! + y * CR[i + 1]! + z * CR[i + 2]!, lim = 1 - (1 - CR[i + 3]!) * 1.9;
      if (d <= lim) continue;
      // s: distance from the centre in crater radii (1 is the rim crest).
      const s = Math.sqrt((1 - d) * CR[i + 4]!), D = CR[i + 5]!;
      if (s < 1) h -= D * Math.min(0.82, 1 - s * s);
      const r = (s - 1) / 0.38;
      if (r > -1 && r < 1) { const q = 1 - r * r; h += D * 0.34 * q * q; }
    }
    HQ[3] = h;
  }
  /** HQ[3] += the ramps' height along unit HQ[0..2]. */
  function rq() {
    const x = HQ[0]!, y = HQ[1]!, z = HQ[2]!;
    let h = 0;
    for (let i = 0; i < nr * 12; i += 12) {
      const dx = x * R - RP[i]!, dy = y * R - RP[i + 1]!, dz = z * R - RP[i + 2]!;
      const a = dx * RP[i + 3]! + dy * RP[i + 4]! + dz * RP[i + 5]!, b = dx * RP[i + 6]! + dy * RP[i + 7]! + dz * RP[i + 8]!;
      const L = RP[i + 9]!, W = RP[i + 10]!;
      if (a > -L && a < L && b > -W && b < W) h = Math.max(h, (RP[i + 11]! * (a + L)) / (2 * L));
    }
    HQ[3] = HQ[3]! + h;
  }
  /** HQ[3] = the surface height (terrain and ramps) along unit HQ[0..2]. */
  function hq() {
    tq();
    if (nr) rq();
  }
  /** Terrain height over the radius along unit (x, y, z) (no ramps). */
  const terrain = (x: number, y: number, z: number) => ((HQ[0] = x), (HQ[1] = y), (HQ[2] = z), tq(), HQ[3]!);
  /** Surface height over the radius along unit (x, y, z): terrain plus ramps. */
  const height = (x: number, y: number, z: number) => ((HQ[0] = x), (HQ[1] = y), (HQ[2] = z), hq(), HQ[3]!);

  /** A tangent frame at unit u = U[iu..iu+2], forward as close to f = Fh[jf..jf+2] as it goes:
   *  out = [e1 (fwd), u, e2] rows (as columns, a right-handed rotation: e2 = e1 × u). */
  function frameA(U: ArrayLike<number>, iu: number, Fh: ArrayLike<number>, jf: number, out: Float64Array) {
    const ux = U[iu]!, uy = U[iu + 1]!, uz = U[iu + 2]!, fx = Fh[jf]!, fy = Fh[jf + 1]!, fz = Fh[jf + 2]!, d = fx * ux + fy * uy + fz * uz;
    let ax = fx - d * ux, ay = fy - d * uy, az = fz - d * uz, l = Math.sqrt(ax * ax + ay * ay + az * az);
    if (l < 1e-9) { ax = uy; ay = -ux; az = 0; l = Math.sqrt(ax * ax + ay * ay) || 1; if (l < 1e-6) (ax = 1), (ay = az = 0), (l = 1); }
    ax /= l; ay /= l; az /= l;
    out[0] = ax; out[1] = ay; out[2] = az;
    out[3] = ux; out[4] = uy; out[5] = uz;
    out[6] = ay * uz - az * uy; out[7] = az * ux - ax * uz; out[8] = ax * uy - ay * ux;
    return out;
  }
  const FA = new Float64Array(6);
  /** `frameA` from numbers: unit (ux, uy, uz), forward hint (fx, fy, fz). */
  function frame(ux: number, uy: number, uz: number, fx: number, fy: number, fz: number, out: Float64Array) {
    FA[0] = ux; FA[1] = uy; FA[2] = uz; FA[3] = fx; FA[4] = fy; FA[5] = fz;
    return frameA(FA, 0, FA, 3, out);
  }

  /** Add a ramp at unit u facing f: `len` long, `wide` wide, rising to `high` at its lip. */
  function ramp(u: ArrayLike<number>, f: ArrayLike<number>, len: number, wide: number, high: number) {
    const F = frameA(u, 0, f, 0, new Float64Array(9)), i = nr++ * 12;
    RP.set([u[0]! * R, u[1]! * R, u[2]! * R, F[0]!, F[1]!, F[2]!, F[6]!, F[7]!, F[8]!, len / 2, wide / 2, high], i);
  }

  // ---- tiles: a geodesic shell ----
  /** 20 · freq² triangles: corners (9 per tile, lifted to the terrain), centroid, normal (into the
   *  sky), each corner's unit direction (9). For drawing (`terrain`, no ramps). */
  function tiles(freq: number) {
    const p = (1 + Math.sqrt(5)) / 2;
    const IV = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    const IF = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const n = 20 * freq * freq, C = new Float64Array(n * 9), D = new Float64Array(n * 9), M = new Float64Array(n * 3), N = new Float64Array(n * 3), H = new Float64Array(n);
    const cache = new Map<string, number[]>();
    // A lattice point on face (a, b, c) with integer weights (i, j, k), i + j + k = freq: its unit
    // direction and lifted corner, the same from every face that shares it.
    const pt = (a: number[], b: number[], c: number[], i: number, j: number, k: number) => {
      const x = (a[0]! * i + b[0]! * j + c[0]! * k) / freq, y = (a[1]! * i + b[1]! * j + c[1]! * k) / freq, z = (a[2]! * i + b[2]! * j + c[2]! * k) / freq;
      const key = Math.round(x * 1e6) + "," + Math.round(y * 1e6) + "," + Math.round(z * 1e6);
      let v = cache.get(key);
      if (!v) {
        const l = Math.sqrt(x * x + y * y + z * z), ux = x / l, uy = y / l, uz = z / l, r = R + terrain(ux, uy, uz);
        cache.set(key, (v = [ux, uy, uz, ux * r, uy * r, uz * r]));
      }
      return v;
    };
    let t = 0;
    const put = (A: number[], B: number[], Cc: number[]) => {
      const o = t * 9;
      for (let k = 0; k < 3; k++) {
        const v = [A, B, Cc][k]!;
        C[o + k * 3] = v[3]!; C[o + k * 3 + 1] = v[4]!; C[o + k * 3 + 2] = v[5]!;
        D[o + k * 3] = v[0]!; D[o + k * 3 + 1] = v[1]!; D[o + k * 3 + 2] = v[2]!;
      }
      const mx = (A[3]! + B[3]! + Cc[3]!) / 3, my = (A[4]! + B[4]! + Cc[4]!) / 3, mz = (A[5]! + B[5]! + Cc[5]!) / 3;
      const e1x = B[3]! - A[3]!, e1y = B[4]! - A[4]!, e1z = B[5]! - A[5]!, e2x = Cc[3]! - A[3]!, e2y = Cc[4]! - A[4]!, e2z = Cc[5]! - A[5]!;
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (nx * mx + ny * my + nz * mz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
      M[t * 3] = mx; M[t * 3 + 1] = my; M[t * 3 + 2] = mz;
      N[t * 3] = nx; N[t * 3 + 1] = ny; N[t * 3 + 2] = nz;
      const ml = Math.sqrt(mx * mx + my * my + mz * mz);
      H[t] = terrain(mx / ml, my / ml, mz / ml);
      t++;
    };
    for (const f of IF) {
      const a = IV[f[0]!]!, b = IV[f[1]!]!, c = IV[f[2]!]!;
      for (let i = 0; i < freq; i++)
        for (let j = 0; j < freq - i; j++) {
          const k = freq - i - j;
          put(pt(a, b, c, k, i, j), pt(a, b, c, k - 1, i + 1, j), pt(a, b, c, k - 1, i, j + 1));
          if (j < freq - i - 1) put(pt(a, b, c, k - 1, i + 1, j), pt(a, b, c, k - 2, i + 1, j + 1), pt(a, b, c, k - 1, i, j + 1));
        }
    }
    return { n, corners: C, dirs: D, centre: M, normal: N, height: H };
  }

  // ---- the ground for drive: a tangent chart under the car ----
  /** A drive ground on the sphere: `at(u, f)` puts the chart's origin at unit u facing f; `sample`
   *  is the surface in the chart; `recentre(car)` moves the chart under the car after each step. */
  function chart() {
    // F: e1 (0-2), up o (3-5), e2 (6-8). T: scratch.
    const F = new Float64Array(9), T = new Float64Array(9), CQ = new Float64Array(3);
    /** CQ[2] = the surface's height over the chart plane at (CQ[0], CQ[1]) = (x, z): the chart's y. */
    function yq() {
      const x = CQ[0]!, z = CQ[1]!, px = R * F[3]! + x * F[0]! + z * F[6]!, py = R * F[4]! + x * F[1]! + z * F[7]!, pz = R * F[5]! + x * F[2]! + z * F[8]!;
      const l = Math.sqrt(px * px + py * py + pz * pz);
      HQ[0] = px / l; HQ[1] = py / l; HQ[2] = pz / l;
      hq();
      const s = R + HQ[3]!;
      CQ[2] = Math.sqrt(Math.max(0, s * s - x * x - z * z)) - R;
    }
    const g = {
      /** The chart frame: e1, up, e2 (orb space). */
      F,
      /** Put the origin at unit u, e1 toward f. */
      at(u: ArrayLike<number>, f: ArrayLike<number>) {
        frameA(u, 0, f, 0, F);
      },
      /** DriveGround: out = [height, nx, ny, nz] in the chart; returns kind 0. */
      sample(x: number, z: number, out: { [i: number]: number }) {
        const e = 0.18;
        CQ[0] = x; CQ[1] = z; yq();
        const h = CQ[2]!;
        CQ[0] = x + e; yq();
        const hx = CQ[2]!;
        CQ[0] = x; CQ[1] = z + e; yq();
        let nx = -(hx - h) / e, nz = -(CQ[2]! - h) / e;
        const l = Math.sqrt(nx * nx + 1 + nz * nz);
        nx /= l; nz /= l;
        out[0] = h; out[1] = nx; out[2] = 1 / l; out[3] = nz;
        return 0;
      },
      /** Ground height under the origin (the chart y of the surface there). */
      ground: () => ((CQ[0] = CQ[1] = 0), yq(), CQ[2]!),
      /** Move the origin under `car` (anything with `pos` and `vel` in the chart): the frame is carried
       *  along the move (minimal rotation), pos becomes (0, y′, 0) and vel is turned into the new frame. */
      recentre(car: { pos: Float64Array; vel: Float64Array }) {
        const p = car.pos, x = p[0]!, yy = p[1]!, z = p[2]!;
        if (x * x + z * z < 1e-12) return;
        // The car's point in orb space and the new up.
        const Px = (R + yy) * F[3]! + x * F[0]! + z * F[6]!, Py = (R + yy) * F[4]! + x * F[1]! + z * F[7]!, Pz = (R + yy) * F[5]! + x * F[2]! + z * F[8]!;
        const qx = R * F[3]! + x * F[0]! + z * F[6]!, qy = R * F[4]! + x * F[1]! + z * F[7]!, qz = R * F[5]! + x * F[2]! + z * F[8]!, ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
        const bx = qx / ql, by = qy / ql, bz = qz / ql, ax = F[3]!, ay = F[4]!, az = F[5]!;
        // Minimal rotation a → b (Rodrigues with k = a × b, c = a · b): R v = c v + k × v + k (k · v) / (1 + c).
        const kx = ay * bz - az * by, ky = az * bx - ax * bz, kz = ax * by - ay * bx, c = ax * bx + ay * by + az * bz, w = 1 / (1 + c);
        const e = F;
        const kv = kx * e[0]! + ky * e[1]! + kz * e[2]!;
        let ex = c * e[0]! + (ky * e[2]! - kz * e[1]!) + kx * kv * w, ey = c * e[1]! + (kz * e[0]! - kx * e[2]!) + ky * kv * w, ez = c * e[2]! + (kx * e[1]! - ky * e[0]!) + kz * kv * w;
        // Keep it exact: e1 ⟂ b, unit.
        const d = ex * bx + ey * by + ez * bz;
        ex -= d * bx; ey -= d * by; ez -= d * bz;
        const el = Math.sqrt(ex * ex + ey * ey + ez * ez);
        ex /= el; ey /= el; ez /= el;
        // Velocity, orb space, before the frame moves.
        const v = car.vel, vx = v[0]! * F[0]! + v[1]! * F[3]! + v[2]! * F[6]!, vy = v[0]! * F[1]! + v[1]! * F[4]! + v[2]! * F[7]!, vz = v[0]! * F[2]! + v[1]! * F[5]! + v[2]! * F[8]!;
        T[0] = ex; T[1] = ey; T[2] = ez; T[3] = bx; T[4] = by; T[5] = bz;
        T[6] = ey * bz - ez * by; T[7] = ez * bx - ex * bz; T[8] = ex * by - ey * bx;
        F.set(T);
        p[0] = 0; p[1] = Px * bx + Py * by + Pz * bz - R; p[2] = 0;
        v[0] = vx * F[0]! + vy * F[1]! + vz * F[2]!;
        v[1] = vx * F[3]! + vy * F[4]! + vz * F[5]!;
        v[2] = vx * F[6]! + vy * F[7]! + vz * F[8]!;
      },
      /** A chart point (x, y, z) into orb space: out = [x, y, z]. */
      toOrb(x: number, yy: number, z: number, out: { [i: number]: number }) {
        out[0] = (R + yy) * F[3]! + x * F[0]! + z * F[6]!;
        out[1] = (R + yy) * F[4]! + x * F[1]! + z * F[7]!;
        out[2] = (R + yy) * F[5]! + x * F[2]! + z * F[8]!;
        return out;
      },
    };
    return g;
  }

  // ---- the camera rule: the car at the top, the world turning under it ----
  /** The view: `follow(up, fwd, k)` eases the frame (k: 0..1 this frame; 1 snaps); then `Q` (orb →
   *  world rows: right, up, back), `world(p, out)`, `eye(e)` (the camera eye in world, for the
   *  horizon), `facing(p)` and `anchor(p, nudge, out)`. */
  function view() {
    const UP = new Float64Array([0, 1, 0]), FW = new Float64Array([1, 0, 0]), Q = new Float64Array(9), E = new Float64Array(3), T = new Float64Array(9);
    function build() {
      frameA(UP, 0, FW, 0, T);
      // Rows: right = fwd × up... world x = e2 (e1 × u), world y = up, world z = −fwd.
      Q[0] = T[6]!; Q[1] = T[7]!; Q[2] = T[8]!;
      Q[3] = T[3]!; Q[4] = T[4]!; Q[5] = T[5]!;
      Q[6] = -T[0]!; Q[7] = -T[1]!; Q[8] = -T[2]!;
      FW[0] = T[0]!; FW[1] = T[1]!; FW[2] = T[2]!;
    }
    build();
    return {
      /** Orb → world rotation, rows (a diorama object matrix). */
      Q,
      /** The smoothed up and forward (orb space). */
      up: UP,
      fwd: FW,
      /** Ease toward up u and forward f by k (0..1); returns how far the forward still has to turn (0..2). */
      follow(u: ArrayLike<number>, f: ArrayLike<number>, k: number, ku = 1) {
        let ux = UP[0]! + (u[0]! - UP[0]!) * ku, uy = UP[1]! + (u[1]! - UP[1]!) * ku, uz = UP[2]! + (u[2]! - UP[2]!) * ku;
        const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        UP[0] = ux; UP[1] = uy; UP[2] = uz;
        const gap = (FW[0]! - f[0]!) * (FW[0]! - f[0]!) + (FW[1]! - f[1]!) * (FW[1]! - f[1]!) + (FW[2]! - f[2]!) * (FW[2]! - f[2]!);
        FW[0] = FW[0]! + (f[0]! - FW[0]!) * k; FW[1] = FW[1]! + (f[1]! - FW[1]!) * k; FW[2] = FW[2]! + (f[2]! - FW[2]!) * k;
        build();
        return gap;
      },
      /** Orb point p (x, y, z) to world: out = Q p + (0, −R, 0). */
      world(x: number, y: number, z: number, out: { [i: number]: number }) {
        out[0] = Q[0]! * x + Q[1]! * y + Q[2]! * z;
        out[1] = Q[3]! * x + Q[4]! * y + Q[5]! * z - R;
        out[2] = Q[6]! * x + Q[7]! * y + Q[8]! * z;
        return out;
      },
      /** Set the eye (world) for `facing`; it is kept in orb space. */
      eye(x: number, y: number, z: number) {
        const wy = y + R;
        E[0] = Q[0]! * x + Q[3]! * wy + Q[6]! * z;
        E[1] = Q[1]! * x + Q[4]! * wy + Q[7]! * z;
        E[2] = Q[2]! * x + Q[5]! * wy + Q[8]! * z;
      },
      /** The eye in orb space. */
      E,
      /** How far the eye is over the plane through orb point p square to its radius (units; < 0:
       *  past the horizon, as seen from that point). */
      facing(x: number, y: number, z: number) {
        const l = Math.sqrt(x * x + y * y + z * z) || 1;
        return (E[0]! * x + E[1]! * y + E[2]! * z) / l - l;
      },
      /** A depth-sort anchor for orb point p: its world point moved `nudge` toward the eye (so the
       *  tiles under it draw first); out = [x, y, z] world. */
      anchor(x: number, y: number, z: number, nudge: number, out: Float64Array, o = 0) {
        let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        dx = x + (dx / l) * nudge; dy = y + (dy / l) * nudge; dz = z + (dz / l) * nudge;
        out[o] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
        out[o + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
        out[o + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
        return out;
      },
    };
  }

  return { radius: R, height, terrain, HQ, hq, frame, frameA, ramp, tiles, chart, view, craters: CR, hills: HL };
}

/** What `orb()` returns. */
export type Orb = ReturnType<typeof orb>;

/** A rotation matrix (rows, 9) into diorama's angles [x, y, z] (M = Ry · Rx · Rz). */
export function euler(M: ArrayLike<number>, out: { [i: number]: number }) {
  const s = Math.max(-1, Math.min(1, -M[5]!));
  out[0] = Math.asin(s);
  if (Math.abs(s) < 0.999999) {
    out[1] = Math.atan2(M[2]!, M[8]!);
    out[2] = Math.atan2(M[3]!, M[4]!);
  } else {
    out[1] = Math.atan2(-M[6]!, M[0]!);
    out[2] = 0;
  }
  return out;
}

/** out = A · B (3 × 3, rows); out may not be A or B. */
export function mul3(A: ArrayLike<number>, B: ArrayLike<number>, out: { [i: number]: number }) {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) out[r * 3 + c] = A[r * 3]! * B[c]! + A[r * 3 + 1]! * B[3 + c]! + A[r * 3 + 2]! * B[6 + c]!;
  return out;
}

/** out = columns (a, b, c) as rows of a matrix whose columns are the three vectors (a frame
 *  [e1, up, e2] given as rows → the object matrix with those as its local x, y, z axes). */
export function columns(F: ArrayLike<number>, out: { [i: number]: number }) {
  out[0] = F[0]!; out[1] = F[3]!; out[2] = F[6]!;
  out[3] = F[1]!; out[4] = F[4]!; out[5] = F[7]!;
  out[6] = F[2]!; out[7] = F[5]!; out[8] = F[8]!;
  return out;
}
