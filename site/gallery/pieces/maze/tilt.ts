// Tilt Maze's model (site/gallery/pieces/maze/tilt-maze.ts draws it): a steel ball on a wooden
// labyrinth board, pure and allocation-free. Units are board units (the board is 14 × 10, x to the
// right, z toward you); the tilt is two angles in radians: `tx` lifts the left edge (the ball rolls
// to +x), `tz` lifts the back edge (the ball rolls to +z). Gravity along the tilted plane, scaled by
// 5/7 for a rolling solid ball, a little rolling drag, wall bounces with a restitution and a
// scrub of the spin along the wall, holes with a lip that pulls the ball in, and a finish cup.
// `step(bd, dt)` runs the physics at a fixed sub-step; `pilot(bd, out)` is a steady hand that tilts
// toward the next numbered point (tests/tilt-maze.test.mjs proves every board can be cleared with
// it, and the scene's poster uses it).

/** One board: walls (x0, z0, x1, z1 boxes), holes (x, z), the numbered path (x, z points: the
 *  first is the start, the last the finish cup), a name. */
export type Level = { name: string; walls: number[][]; holes: number[][]; path: number[][] };

/** The board's inside: x in [−HW, HW], z in [−HD, HD]. */
export const HW = 7, HD = 5;
/** The ball's radius, a hole's radius, the finish cup's radius, a wall's thickness. */
export const BALL = 0.36, HOLE = 0.56, CUP = 0.62, WALL = 0.3;
/** The most tilt (radians, each way), gravity (board units / s²). */
export const MAX_TILT = 0.16, G = 40;
const SUB = 1 / 240, DRAG = 0.55, ROLL = 0.35, BOUNCE = 0.38, SCRUB = 0.88, LIP = 18, VMAX = 11;

const h = (z: number, x0: number, x1: number) => [x0, z - WALL / 2, x1, z + WALL / 2];
const v = (x: number, z0: number, z1: number) => [x - WALL / 2, z0, x + WALL / 2, z1];

export const LEVELS: Level[] = [
  {
    name: "Warm-up",
    walls: [h(-1.7, -HW, 4), h(1.7, -4, HW)],
    holes: [[-1, -2.3], [2.6, -4.4], [2.2, -1], [-2.2, 1], [0.2, 2.3], [3, 4.4]],
    path: [[-5.6, -3.4], [-2.5, -3.4], [1, -3.4], [5.6, -3.4], [5.6, 0], [3.8, 0], [0, 0], [-3.6, 0], [-5.6, 0], [-5.6, 3.4], [-2.5, 3.4], [1.5, 3.4], [5.4, 3.4]],
  },
  {
    name: "Switchbacks",
    walls: [v(-3.5, -HD, 2.6), v(0, -2.6, HD), v(3.5, -HD, 2.6)],
    holes: [[-6.3, -1], [-4.2, 1.3], [-5.25, 4.4], [-0.7, -0.4], [-2.8, 1.9], [-2.8, -2.4], [2.8, -1.5], [0.7, 1.5], [0.7, -2], [4.2, 1.5], [6.3, -0.3], [4.2, -2.3]],
    path: [[-5.25, -3.8], [-5.25, 0], [-5.25, 3.5], [-3.4, 3.8], [-1.75, 3.5], [-1.75, 0.2], [-1.75, -3.6], [0, -3.9], [1.75, -3.6], [1.75, 0], [1.75, 3.6], [3.5, 3.9], [5.25, 3.4], [5.25, 0], [5.25, -3.8]],
  },
  {
    name: "The Gauntlet",
    walls: [h(-1.7, -HW, 4), h(1.7, -4, HW)],
    holes: [[-4, -3.35], [-0.6, -3.35], [2.8, -3.35], [3, 0], [-0.4, 0], [-3.8, 0], [-2.6, 3.35], [0.8, 3.35], [4.2, 3.35], [6.45, -4.45], [6.45, 1.15], [-6.45, -1.1], [-6.45, 4.45]],
    path: [[-6, -3.35], [-4.8, -4.35], [-3.2, -4.35], [-1.4, -2.35], [0.2, -2.35], [2, -4.35], [3.6, -4.35], [5.5, -3], [5.5, 0], [3.8, 1], [2.2, 1], [0.4, -1], [-1.2, -1], [-3, 1], [-4.6, 1], [-5.6, 0.4], [-5.6, 3.35], [-3.4, 4.35], [-1.8, 4.35], [0, 2.35], [1.6, 2.35], [3.4, 4.35], [5, 4.35], [6, 3.4]],
  },
];

/** The board as it plays: ball position, velocity, tilt, the furthest numbered point reached, the
 *  state (0 rolling, 1 falling into hole `hole`, 2 in the cup), time on the board and falls. */
export type Board = {
  level: number; x: number; z: number; vx: number; vz: number; tx: number; tz: number;
  far: number; state: number; hole: number; fall: number; t: number; falls: number; acc: number;
  /** The last wall hit's speed into it (for a click), cleared by the reader. */
  knock: number;
};
export const ROLLING = 0, FALLING = 1, HOME = 2;

export function newBoard(): Board {
  return { level: 0, x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, far: 0, state: ROLLING, hole: -1, fall: 0, t: 0, falls: 0, acc: 0, knock: 0 };
}
/** Board l, the ball on the start, level, at rest. */
export function load(l: number, bd: Board = newBoard()) {
  bd.level = l;
  bd.falls = 0;
  bd.t = 0;
  return respawn(bd);
}
/** The ball back on the start (after a fall). */
export function respawn(bd: Board) {
  const p = LEVELS[bd.level]!.path[0]!;
  bd.x = p[0]!;
  bd.z = p[1]!;
  bd.vx = bd.vz = 0;
  bd.far = 0;
  bd.state = ROLLING;
  bd.hole = -1;
  bd.fall = 0;
  bd.acc = 0;
  return bd;
}
/** Set the tilt (clamped). */
export function tilt(bd: Board, tx: number, tz: number) {
  bd.tx = Math.max(-MAX_TILT, Math.min(MAX_TILT, tx));
  bd.tz = Math.max(-MAX_TILT, Math.min(MAX_TILT, tz));
}

// The ball while a step runs (x, z, vx, vz, the hardest knock): typed, so nothing boxes.
const S = new Float64Array(5);
/** The frame, as four boxes outside the board. */
const FRAME = [[-HW - 1, -HD - 1, -HW, HD + 1], [HW, -HD - 1, HW + 1, HD + 1], [-HW - 1, -HD - 1, HW + 1, -HD], [-HW - 1, HD, HW + 1, HD + 1]];
/** Push the ball out of box w (x0, z0, x1, z1) if it overlaps; bounce. The box goes in whole, not as
 *  four numbers: a call that is not inlined would box each one. */
function wallHit(w: number[]) {
  const x0 = w[0]!, z0 = w[1]!, x1 = w[2]!, z1 = w[3]!, x = S[0]!, z = S[1]!, nx = Math.max(x0, Math.min(x1, x)), nz = Math.max(z0, Math.min(z1, z));
  let dx = x - nx, dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= BALL * BALL) return;
  if (d2 < 1e-18) {
    // The centre is inside the box: out the nearest side.
    const l = x - x0, r = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, r, t, b);
    (dx = m === l ? -1 : m === r ? 1 : 0), (dz = m === t ? -1 : m === b ? 1 : 0);
    S[0] = m === l ? x0 - BALL : m === r ? x1 + BALL : x;
    S[1] = m === t ? z0 - BALL : m === b ? z1 + BALL : z;
  } else {
    const d = Math.sqrt(d2);
    (dx /= d), (dz /= d);
    S[0] = nx + dx * BALL;
    S[1] = nz + dz * BALL;
  }
  const vx = S[2]!, vz = S[3]!, vn = vx * dx + vz * dz;
  if (vn < 0) {
    // Reflect the part into the wall (with the restitution), scrub the part along it.
    const tx = vx - vn * dx, tz = vz - vn * dz;
    S[2] = tx * SCRUB - vn * BOUNCE * dx;
    S[3] = tz * SCRUB - vn * BOUNCE * dz;
    if (-vn > S[4]!) S[4] = -vn;
  }
}

/** Run the physics for dt seconds (fixed sub-steps; the remainder carries). Returns true while
 *  anything moves. */
export function step(bd: Board, dt: number) {
  const L = LEVELS[bd.level]!;
  if (bd.state === HOME) return false;
  if (bd.state === FALLING) {
    bd.fall += dt;
    bd.t += dt;
    // The ball slides to the hole's centre as it drops.
    const H = L.holes[bd.hole], k = Math.min(1, dt * 14);
    if (H) (bd.x += (H[0]! - bd.x) * k), (bd.z += (H[1]! - bd.z) * k);
    return true;
  }
  bd.acc += dt;
  bd.t += dt;
  const ax = G * (5 / 7) * Math.sin(bd.tx), az = G * (5 / 7) * Math.sin(bd.tz), Hs = L.holes, Ws = L.walls, Pp = L.path, E = Pp[Pp.length - 1]!;
  (S[0] = bd.x), (S[1] = bd.z), (S[2] = bd.vx), (S[3] = bd.vz), (S[4] = bd.knock);
  let acc = bd.acc, state = ROLLING;
  while (acc >= SUB) {
    acc -= SUB;
    let gx = ax, gz = az;
    // Hole lips: inside a hole's rim, the edge pulls the ball in.
    for (let i = 0; i < Hs.length; i++) {
      const H = Hs[i]!, dx = H[0]! - S[0]!, dz = H[1]! - S[1]!, d2 = dx * dx + dz * dz;
      if (d2 < HOLE * HOLE) {
        const d = Math.sqrt(d2);
        if (d < HOLE - BALL * 0.45) {
          state = FALLING;
          bd.hole = i;
          break;
        }
        const k = (LIP * (HOLE - d)) / HOLE / (d || 1);
        (gx += dx * k), (gz += dz * k);
      }
    }
    if (state !== ROLLING) break;
    const ex = E[0]! - S[0]!, ez = E[1]! - S[1]!;
    if (ex * ex + ez * ez < (CUP - BALL * 0.3) * (CUP - BALL * 0.3)) {
      state = HOME;
      break;
    }
    let vx: number = S[2]! + gx * SUB, vz: number = S[3]! + gz * SUB;
    // Rolling drag: a little proportional, a little constant (it stops on a level board).
    const sp = Math.sqrt(vx * vx + vz * vz);
    if (sp > 0) {
      const ns = Math.max(0, sp - (sp * DRAG + ROLL) * SUB), k = Math.min(ns, VMAX) / sp;
      (vx *= k), (vz *= k);
    }
    (S[2] = vx), (S[3] = vz), (S[0] += vx * SUB), (S[1] += vz * SUB);
    // The frame and the walls.
    for (let i = 0; i < 4; i++) wallHit(FRAME[i]!);
    for (let i = 0; i < Ws.length; i++) wallHit(Ws[i]!);
  }
  (bd.x = S[0]!), (bd.z = S[1]!), (bd.vx = S[2]!), (bd.vz = S[3]!), (bd.knock = S[4]!), (bd.acc = acc);
  if (state === FALLING) {
    bd.state = FALLING;
    bd.fall = 0;
    bd.falls++;
    return true;
  }
  if (state === HOME) {
    bd.state = HOME;
    bd.far = Pp.length - 1;
    bd.vx = bd.vz = 0;
    return true;
  }
  // The furthest numbered point the ball has come near, in order.
  for (let i = bd.far + 1; i < Pp.length && i <= bd.far + 2; i++) {
    const dx = Pp[i]![0]! - bd.x, dz = Pp[i]![1]! - bd.z;
    if (dx * dx + dz * dz < 0.9 * 0.9) bd.far = i;
  }
  return bd.vx * bd.vx + bd.vz * bd.vz > 0.0004 || Math.abs(ax) + Math.abs(az) > ROLL * 1.05;
}

/** A steady hand: the tilt that rolls the ball toward the next numbered point at a sensible speed
 *  (slower into the turns). Writes [tx, tz] into out. */
export function pilot(bd: Board, out: Float64Array) {
  const P = LEVELS[bd.level]!.path, i = Math.min(P.length - 1, bd.far + 1), T = P[i]!;
  const dx = T[0]! - bd.x, dz = T[1]! - bd.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
  const sp = Math.min(2.6, 0.6 + d * 1.1), wx = (dx / d) * sp, wz = (dz / d) * sp;
  const k = 0.06;
  out[0] = Math.max(-MAX_TILT, Math.min(MAX_TILT, (wx - bd.vx) * k + Math.sign(dx) * 0.012 * Math.min(1, Math.abs(dx))));
  out[1] = Math.max(-MAX_TILT, Math.min(MAX_TILT, (wz - bd.vz) * k + Math.sign(dz) * 0.012 * Math.min(1, Math.abs(dz))));
  return out;
}
