// Cup Toss's game: toss a ping-pong ball into a triangle of ten cups at the far end of a table, pure
// and seeded. No DOM, no clock, no renderer, no allocation once a game exists (`resetGame` reuses
// one). The ball is ../bar/toss.ts (flight, spin, bounces off the table and off the cups' rims and
// walls); a ball that drops inside a cup clears it. Twenty balls to clear the rack; at six cups and at
// three the rack is pulled in tight (a re-rack). A toss is three integers (the aim, the power level
// and the spin), so the same tosses play the same game bit for bit. Family friendly: the cups hold
// nothing. Tests: tests/cup-toss.test.mjs.
import { toss, FLY, REST, type Toss, type TossEvents } from "../bar/toss";

/** Metres. The table top is y = 0: from x = −0.2 (your end) to 2.2, z ±0.45. */
export const TX0 = -0.2, TX1 = 2.2, TW = 0.45, FLOOR = -0.76;
/** The ball: radius, where it leaves your hand. */
export const BR = 0.02, HX = 0, HY = 0.3;
/** A cup: rim radius, base radius, height, wall; the rack's apex and the row spacing. */
export const RC = 0.046, RB = 0.032, CH = 0.12, APEX = 1.62, ROW = 0.0797;
/** Cups, balls a game. */
export const CUPS = 10, BALLS = 20;
/** A toss: power levels, aim steps (± from straight down the table), spin steps (±), the loft. */
export const STEPS = 100, AIMS = 120, SPINS = 10, LOFT = 0.7330382858376184; // 42°
/** Speed at level 0 and at full power (m/s); sidespin per spin step and the backspin (rad/s). */
export const V0 = 2.2, V1 = 5.6, SIDE = 6, BACK = 12;
/** Phases: aim, the ball in the air, the toss's result (shown), over. */
export const AIM = 0, FLY_ = 1, SHOWN = 2, OVER = 3;
/** Tags: the table, the floor; a cup's rim is 10 + c, its wall 30 + c. */
export const T_TABLE = 1, T_FLOOR = 2;

export interface Game {
  w: Toss;
  seed: number;
  phase: number;
  /** Each cup: where it stands (x, z), on the table (1) or cleared (0); its rim and wall parts. */
  cx: Float64Array;
  cz: Float64Array;
  cup: Uint8Array;
  rim: Int16Array;
  wall: Int16Array;
  /** Balls thrown, cups cleared, the run of makes and the best run; re-racks done. */
  thrown: number;
  made: number;
  streak: number;
  best: number;
  racks: number;
  /** The last toss: the cup it cleared (−1 a miss), whether it bounced on the table first, rim
   *  touches, how long it flew (s). */
  hit: number;
  bounced: number;
  rims: number;
  t: number;
}

/** The rack: row by row from the apex (the cup nearest you), x and z per slot, for 10, 6 and 3 cups. */
const RACK10 = [0, 0, 1, -0.5, 1, 0.5, 2, -1, 2, 0, 2, 1, 3, -1.5, 3, -0.5, 3, 0.5, 3, 1.5];
const RACK6 = [0, 0, 1, -0.5, 1, 0.5, 2, -1, 2, 0, 2, 1];
const RACK3 = [0, 0, 1, -0.5, 1, 0.5];

export function newGame(seed: number, events?: TossEvents): Game {
  const w = toss({ balls: 1, parts: 2 + 2 * CUPS, radius: BR, inertia: 2 / 3, drag: 0.09, magnus: 0.0032, sub: 10, events });
  w.quad((TX0 + TX1) / 2, 0, 0, 0, 1, 0, 1, 0, 0, (TX1 - TX0) / 2, TW, 0.82, 0.22, T_TABLE);
  w.quad(0, FLOOR, 0, 0, 1, 0, 1, 0, 0, 20, 20, 0.6, 0.3, T_FLOOR);
  const g: Game = {
    w, seed: 0, phase: AIM, cx: new Float64Array(CUPS), cz: new Float64Array(CUPS), cup: new Uint8Array(CUPS),
    rim: new Int16Array(CUPS), wall: new Int16Array(CUPS), thrown: 0, made: 0, streak: 0, best: 0, racks: 0, hit: -1, bounced: 0, rims: 0, t: 0,
  };
  for (let c = 0; c < CUPS; c++) {
    g.rim[c] = w.ring(0, CH, 0, RC, 0.004, 0.5, 0.15, 10 + c);
    g.wall[c] = w.shell(0, 0, 0, RB, CH, RC, 0.004, 0.45, 0.2, 30 + c);
  }
  return resetGame(g, seed);
}

/** Stand cup c at (x, z): its rim and wall go with it. */
function place(g: Game, c: number, x: number, z: number) {
  const d = g.w.data, r = g.rim[c]! * 16, s = g.wall[c]! * 16;
  g.w.move(g.rim[c]!, x - d[r]!, 0, z - d[r + 2]!);
  g.w.move(g.wall[c]!, x - d[s]!, 0, z - d[s + 1]!);
  g.cx[c] = x;
  g.cz[c] = z;
}
/** Put the cups left on the table into a rack (`slots`: row, column pairs) from the apex. */
function rack(g: Game, slots: number[]) {
  let k = 0;
  for (let c = 0; c < CUPS; c++) {
    if (!g.cup[c]) continue;
    place(g, c, APEX + slots[k * 2]! * ROW, slots[k * 2 + 1]! * 2 * RC);
    k++;
  }
}
/** Start `g` over in place (no allocation): ten cups racked, twenty balls. */
export function resetGame(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.phase = AIM;
  g.cup.fill(1);
  for (let c = 0; c < CUPS; c++) (g.w.on[g.rim[c]!] = 1), (g.w.on[g.wall[c]!] = 1);
  rack(g, RACK10);
  g.thrown = g.made = g.streak = g.best = g.racks = 0;
  g.hit = -1;
  g.bounced = g.rims = 0;
  g.t = 0;
  g.w.drop(0);
  g.w.launch(0, HX, HY, 0, 0, 0, 0);
  g.w.drop(0);
  return g;
}
/** Cups on the table. */
export function left(g: Game) {
  let n = 0;
  for (let c = 0; c < CUPS; c++) n += g.cup[c]!;
  return n;
}

const SC = new Float64Array(2);
/** sin and cos of a small angle a (|a| < 0.6) into SC, from a short series: the same bits everywhere. */
function sc(a: number) {
  const a2 = a * a;
  SC[0] = a * (1 - (a2 / 6) * (1 - (a2 / 20) * (1 - (a2 / 42) * (1 - a2 / 72))));
  SC[1] = 1 - (a2 / 2) * (1 - (a2 / 12) * (1 - (a2 / 30) * (1 - (a2 / 56) * (1 - a2 / 90))));
}
const SL = 0.6691306063588582, CL = 0.7431448254773942; // sin, cos of the loft (42°)
/** The launch for (aim, level, spin) into out = [vx, vy, vz, wx, wy, wz]. */
export function launchOf(aim: number, level: number, spin: number, out: { [i: number]: number }) {
  const v = V0 + ((V1 - V0) * level) / STEPS;
  sc((aim / AIMS) * 0.5);
  const h = v * CL;
  out[0] = h * SC[1]!; out[1] = v * SL; out[2] = h * SC[0]!;
  // Back-spin about the axis across the flight, side-spin about the vertical.
  out[3] = -SC[0]! * BACK; out[4] = spin * SIDE; out[5] = SC[1]! * BACK;
  return out;
}
const LV = new Float64Array(6);
/** Toss the ball: aim (−AIMS..AIMS: ±0.5 rad), level (0..STEPS), spin (−SPINS..SPINS). false: not now. */
export function shoot(g: Game, aim: number, level: number, spin: number) {
  if (g.phase !== AIM) return false;
  aim = Math.max(-AIMS, Math.min(AIMS, aim | 0));
  level = Math.max(0, Math.min(STEPS, level | 0));
  spin = Math.max(-SPINS, Math.min(SPINS, spin | 0));
  launchOf(aim, level, spin, LV);
  g.w.launch(0, HX, HY, 0, LV[0]!, LV[1]!, LV[2]!, LV[3]!, LV[4]!, LV[5]!);
  g.thrown++;
  g.hit = -1;
  g.bounced = g.rims = 0;
  g.t = 0;
  g.phase = FLY_;
  return true;
}
/** A toss event (from the ball's flight): it touched the table or a rim. Wire it from `toss:hit`. */
export function touched(g: Game, tag: number) {
  if (g.phase !== FLY_) return;
  if (tag === T_TABLE && g.hit < 0) g.bounced = 1;
  else if (tag >= 10 && tag < 30) g.rims++;
}
/** Advance the flight dt seconds: a ball inside a cup clears it; a ball that rests, drops to the
 *  floor or flies too long is a miss. Returns the phase (SHOWN once the toss is decided). */
export function step(g: Game, dt: number) {
  if (g.phase !== FLY_) return g.phase;
  const w = g.w;
  w.step(dt);
  g.t += dt;
  const x = w.x[0]!, y = w.y[0]!, z = w.z[0]!;
  // Into a cup: inside its rim, below it and still above its base.
  for (let c = 0; c < CUPS; c++) {
    if (!g.cup[c]) continue;
    const dx = x - g.cx[c]!, dz = z - g.cz[c]!;
    if (y < CH - BR * 0.5 && y > 0 && dx * dx + dz * dz < (RC - BR * 0.55) * (RC - BR * 0.55)) {
      g.hit = c;
      g.cup[c] = 0;
      w.on[g.rim[c]!] = w.on[g.wall[c]!] = 0;
      w.drop(0);
      g.made++;
      g.streak++;
      if (g.streak > g.best) g.best = g.streak;
      return (g.phase = SHOWN);
    }
  }
  if (w.state[0] === REST || y < FLOOR + 0.1 || g.t > 6 || (w.state[0] !== FLY && w.state[0] !== REST)) {
    w.drop(0);
    g.streak = 0;
    return (g.phase = SHOWN);
  }
  return g.phase;
}
/** Run the toss to its result at once (reduced motion, tests); returns the steps taken. */
export function run(g: Game, dt = 1 / 60) {
  let n = 0;
  while (g.phase === FLY_ && n < 1000) step(g, dt), n++;
  return n;
}
/** After the result is shown: a re-rack at six and at three, the next ball, or the game is over. */
export function next(g: Game) {
  if (g.phase !== SHOWN) return g.phase;
  const n = left(g);
  if (n === 0 || g.thrown >= BALLS) return (g.phase = OVER);
  if (n === 6 && g.racks === 0) rack(g, RACK6), (g.racks = 1);
  else if (n === 3 && g.racks < 2) rack(g, RACK3), (g.racks = 2);
  return (g.phase = AIM);
}
/** Would a re-rack happen on `next` now (for the view to animate the cups first)? */
export const reracks = (g: Game) => g.phase === SHOWN && g.thrown < BALLS && ((left(g) === 6 && g.racks === 0) || (left(g) === 3 && g.racks < 2));
/** Stars for a cleared rack: 3 in 12 balls or fewer, 2 in 16, 1 in 20; 0 if not cleared. */
export const stars = (g: Game) => (left(g) ? 0 : g.thrown <= 12 ? 3 : g.thrown <= 16 ? 2 : 1);

/** The aim and level that put the ball over cup c (straight line in plan, power for its distance),
 *  for the poster and the tests: out = [aim, level]. */
export function aimAt(g: Game, c: number, out: { [i: number]: number }) {
  const dx = g.cx[c]! - HX, dz = g.cz[c]!;
  // aim: the plan angle in steps (a small angle: atan by a short series of dz/dx).
  const t = dz / dx, a = t * (1 - (t * t) / 3 + (t * t * t * t) / 5);
  out[0] = Math.round((a / 0.5) * AIMS);
  // level: search the drop point at the rim's height (a few flights, no allocation).
  let best = 0, err = 1e9;
  for (let lv = 0; lv <= STEPS; lv++) {
    const d = rangeOf(lv) - Math.sqrt(dx * dx + dz * dz);
    if (Math.abs(d) < err) (err = Math.abs(d)), (best = lv);
  }
  out[1] = best;
  return out;
}
const RG = new Float64Array(STEPS + 1).fill(NaN);
/** How far a straight toss at `level` goes before it falls to a rim's height (no spin to the side). */
function rangeOf(level: number) {
  if (RG[level] === RG[level]) return RG[level]!;
  launchOf(0, level, 0, LV);
  let x = HX, y = HY, vx = LV[0]!, vy = LV[1]!;
  const h = 1 / 600;
  for (let k = 0; k < 4000; k++) {
    const sp = Math.sqrt(vx * vx + vy * vy), dr = 1 - 0.09 * sp * h;
    vx = vx * dr - 0.0032 * LV[5]! * vy * h;
    vy = vy * dr - 9.8 * h + 0.0032 * LV[5]! * vx * h;
    x += vx * h;
    y += vy * h;
    if (vy < 0 && y < CH) break;
  }
  return (RG[level] = x - HX);
}
