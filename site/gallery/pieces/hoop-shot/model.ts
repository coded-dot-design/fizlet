// Hoop Shot's game: the arcade basketball cabinet, pure and seeded. No DOM, no clock, no renderer, no
// allocation once a game exists (`resetGame` reuses one). Four balls on a ramp that rolls them back
// to you; shoot them at a hoop on a backboard before the clock runs out. The balls are
// ../bar/toss.ts (flight, spin, bounces off the rim, the board, the cage and each other); after 15
// seconds the hoop starts to slide side to side. A basket is a ball that drops down through the
// ring: 2 points (3 in the last 10 seconds), and a swish (no rim) adds 1. A shot is two integers (the
// aim, the power level) at a tick, so the same shots at the same ticks play the same game bit for
// bit. Tests: tests/hoop-shot.test.mjs.
import { toss, FLY, REST, OUT, type Toss, type TossEvents } from "../bar/toss";

/** Metres. The lane runs along x from you (x = 0) to the back (2.65), z ±0.5. */
export const LEN = 2.65, HW = 0.5, RAMP0 = 0.4, RAMP1 = LEN, RISE = 0.38;
/** The ball, and where it sits in your hand. */
export const BR = 0.09, HX = 0.32, HY = 0.62;
/** The hoop: its centre (at rest), ring radius and tube; the backboard's face. */
export const RX = 2.24, RY = 1.78, RR = 0.2, TUBE = 0.012, BX = 2.5;
/** Balls, the round (ticks at 60 a second), when the hoop starts to move and the bonus starts. */
export const BALLS = 4, HZ = 60, ROUND = 45 * HZ, MOVE_AT = 15 * HZ, BONUS_AT = 35 * HZ;
/** How far the hoop slides each way, and how long a sweep takes (ticks). */
export const SWAY = 0.24, SWEEP = 150;
/** A shot: power levels and aim steps (± from straight); speed range (m/s); the loft; back-spin. */
export const STEPS = 100, AIMS = 100, V0 = 4.2, V1 = 7.6, SL = 0.8191520442889918, CL = 0.573576436351046, BACK = 16; // 55°
/** Phases: waiting for your first shot, the round on, over. */
export const READY = 0, ON = 1, OVER = 2;
/** Tags: the rim, the board, the cage (walls, roof, ramp). */
export const T_RIM = 1, T_BOARD = 2, T_CAGE = 3;

export interface Game {
  w: Toss;
  seed: number;
  phase: number;
  tick: number;
  score: number;
  /** Baskets, swishes, shots; the run of baskets; the last basket's points and whether it swished. */
  made: number;
  swish: number;
  shots: number;
  streak: number;
  lastPts: number;
  lastSwish: number;
  /** The hoop's slide now (z of its centre). */
  hz: number;
  /** Per ball: in your hand (1), shot and not back yet (1), scored on this shot (1), rim touches this
   *  shot, its height last tick (for the basket test). */
  hand: Uint8Array;
  out: Uint8Array;
  /** Per ball: ticks since it was shot (a ball out for 10 s is put back in the tray: the cabinet's ball return). */
  air: Uint16Array;
  got: Uint8Array;
  rims: Uint8Array;
  py: Float64Array;
  /** Parts: the ring and the board (they slide). */
  ring: number;
  board: number;
  /** Baskets this tick (bit per ball), for the view's effects. */
  scored: number;
}

const SC = new Float64Array(2);
/** sin and cos of a small angle (|a| < 0.6) into SC: a short series, the same bits everywhere. */
function sc(a: number) {
  const a2 = a * a;
  SC[0] = a * (1 - (a2 / 6) * (1 - (a2 / 20) * (1 - (a2 / 42) * (1 - a2 / 72))));
  SC[1] = 1 - (a2 / 2) * (1 - (a2 / 12) * (1 - (a2 / 30) * (1 - (a2 / 56) * (1 - a2 / 90))));
}

export function newGame(seed: number, events?: TossEvents): Game {
  const w = toss({ balls: BALLS, parts: 12, radius: BR, inertia: 2 / 3, drag: 0.02, magnus: 0.0015, sub: 10, roll: 1.4, events });
  // The ramp (rising to the back), the tray at your end and its front lip, the cage, the roof net,
  // the back wall, the board and the ring.
  const ang = RISE / (RAMP1 - RAMP0), l = Math.sqrt(1 + ang * ang), nx = -ang / l, ny = 1 / l;
  w.quad((RAMP0 + RAMP1) / 2, RISE / 2, 0, nx, ny, 0, ny, -nx, 0, Math.sqrt((RAMP1 - RAMP0) ** 2 + RISE * RISE) / 2, HW, 0.55, 0.3, T_CAGE);
  w.quad(RAMP0 / 2, 0, 0, 0, 1, 0, 1, 0, 0, RAMP0 / 2, HW, 0.35, 0.3, T_CAGE);
  w.quad(0, 0.15, 0, 1, 0, 0, 0, 1, 0, 0.15, HW, 0.3, 0.3, T_CAGE);
  w.quad(LEN / 2, 1.2, -HW, 0, 0, 1, 1, 0, 0, LEN / 2, 1.3, 0.5, 0.2, T_CAGE);
  w.quad(LEN / 2, 1.2, HW, 0, 0, -1, 1, 0, 0, LEN / 2, 1.3, 0.5, 0.2, T_CAGE);
  w.quad(1.8, 2.45, 0, 0, -1, 0, 1, 0, 0, 0.9, HW, 0.3, 0.2, T_CAGE);
  w.quad(LEN, 1.2, 0, -1, 0, 0, 0, 1, 0, 1.3, HW, 0.4, 0.2, T_CAGE);
  w.quad(LEN / 2, -0.3, 0, 0, 1, 0, 1, 0, 0, 20, 20, 0.3, 0.3, T_CAGE); // (a floor under it all, for safety)
  const board = w.quad(BX, RY + 0.18, 0, -1, 0, 0, 0, 1, 0, 0.32, 0.46, 0.62, 0.25, T_BOARD);
  const ring = w.ring(RX, RY, 0, RR, TUBE, 0.55, 0.15, T_RIM);
  const g: Game = {
    w, seed: 0, phase: READY, tick: 0, score: 0, made: 0, swish: 0, shots: 0, streak: 0, lastPts: 0, lastSwish: 0, hz: 0,
    hand: new Uint8Array(BALLS), out: new Uint8Array(BALLS), air: new Uint16Array(BALLS), got: new Uint8Array(BALLS), rims: new Uint8Array(BALLS), py: new Float64Array(BALLS), ring, board, scored: 0,
  };
  return resetGame(g, seed);
}

/** The tray slot of ball i (where it waits at the start). */
const slotZ = (i: number) => -0.33 + i * 0.22;
/** Start `g` over in place (no allocation): the balls in the tray, the hoop still, the clock full. */
export function resetGame(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.phase = READY;
  g.tick = g.score = g.made = g.swish = g.shots = g.streak = g.lastPts = g.lastSwish = g.scored = 0;
  slide(g, 0);
  g.hand.fill(0);
  g.out.fill(0);
  g.air.fill(0);
  g.got.fill(0);
  g.rims.fill(0);
  for (let i = 0; i < BALLS; i++) {
    g.w.launch(i, RAMP0 * 0.5, BR, slotZ(i), 0, 0, 0);
    g.w.state[i] = REST;
    g.py[i] = BR;
  }
  g.w.step(1 / HZ); // (nothing flies: `busy` reads false)
  take(g);
  return g;
}
/** The hoop's slide at tick t: still for MOVE_AT ticks, then a triangle wave of ±SWAY (sums only). */
export function hoopZ(t: number) {
  if (t < MOVE_AT) return 0;
  const u = ((t - MOVE_AT) % (4 * SWEEP)) / SWEEP; // 0..4: centre → +, + → centre, centre → −, − → centre
  return SWAY * (u < 1 ? u : u < 3 ? 2 - u : u - 4);
}
/** Move the ring and the board to z (with their velocity over a tick). */
function slide(g: Game, z: number) {
  const dz = z - g.hz;
  g.w.move(g.ring, 0, 0, dz, dz ? 1 / HZ : 0);
  g.w.move(g.board, 0, 0, dz, dz ? 1 / HZ : 0);
  g.hz = z;
}
/** Seconds left on the clock. */
export const clock = (g: Game) => (ROUND - g.tick) / HZ;
/** The ball in your hand (−1 none). */
export function inHand(g: Game) {
  for (let i = 0; i < BALLS; i++) if (g.hand[i]) return i;
  return -1;
}
/** Ball i is back in the tray: at rest there, or all but (it can nudge against the others). */
function inTray(g: Game, i: number) {
  const w = g.w;
  if (w.state[i] === OUT || w.x[i]! > RAMP0 + 0.1 || w.y[i]! > BR + 0.05) return false;
  return w.state[i] === REST || w.vx[i]! * w.vx[i]! + w.vy[i]! * w.vy[i]! + w.vz[i]! * w.vz[i]! < 0.04;
}
/** Pick up the first ball resting in the tray (if your hand is empty). */
export function take(g: Game) {
  if (inHand(g) >= 0 || g.phase === OVER) return -1;
  for (let i = 0; i < BALLS; i++)
    if (inTray(g, i)) {
      g.hand[i] = 1;
      g.w.drop(i);
      g.w.x[i] = HX; g.w.y[i] = HY; g.w.z[i] = 0;
      return i;
    }
  return -1;
}

const LV = new Float64Array(6);
/** The launch for (aim, level) into out = [vx, vy, vz, wx, wy, wz]. */
export function launchOf(aim: number, level: number, out: { [i: number]: number }) {
  const v = V0 + ((V1 - V0) * level) / STEPS;
  sc((aim / AIMS) * 0.35);
  const h = v * CL;
  out[0] = h * SC[1]!; out[1] = v * SL; out[2] = h * SC[0]!;
  out[3] = -SC[0]! * BACK; out[4] = 0; out[5] = SC[1]! * BACK;
  return out;
}
/** Shoot the ball in your hand: aim (−AIMS..AIMS: ±0.35 rad), level (0..STEPS). The first shot
 *  starts the clock. false: no ball in hand, or the round is over. */
export function shoot(g: Game, aim: number, level: number) {
  const i = inHand(g);
  if (i < 0 || g.phase === OVER) return false;
  aim = Math.max(-AIMS, Math.min(AIMS, aim | 0));
  level = Math.max(0, Math.min(STEPS, level | 0));
  launchOf(aim, level, LV);
  g.hand[i] = 0;
  g.rims[i] = 0;
  g.out[i] = 1;
  g.air[i] = 0;
  g.got[i] = 0;
  g.w.launch(i, HX, HY, 0, LV[0]!, LV[1]!, LV[2]!, LV[3]!, LV[4]!, LV[5]!);
  g.py[i] = HY;
  g.shots++;
  if (g.phase === READY) g.phase = ON;
  return true;
}
/** A toss event: ball `i` touched part tag `tag`. Wire it from `toss:hit`. */
export function touched(g: Game, i: number, tag: number) {
  if (tag === T_RIM && i >= 0 && g.rims[i]! < 255) g.rims[i] = g.rims[i]! + 1;
}
/** One tick (1/60 s): the hoop slides, the balls fly, baskets count, the clock runs, a ball comes to
 *  hand. Returns the phase. Before the first shot nothing moves (the balls wait in the tray). */
export function tick(g: Game) {
  g.scored = 0;
  if (g.phase === READY) return g.phase;
  if (g.phase === ON) {
    g.tick++;
    slide(g, hoopZ(g.tick));
  }
  const w = g.w;
  w.step(1 / HZ);
  for (let i = 0; i < BALLS; i++) {
    if (g.hand[i] || w.state[i] === OUT) continue;
    const y = w.y[i]!, dx = w.x[i]! - RX, dz = w.z[i]! - g.hz;
    // Down through the ring: its centre crossed the ring's plane going down, inside the ring.
    if (g.py[i]! >= RY && y < RY && w.vy[i]! < 0 && dx * dx + dz * dz < (RR - BR * 0.25) * (RR - BR * 0.25) && g.phase === ON) {
      const pts = (g.tick >= BONUS_AT ? 3 : 2) + (g.rims[i] ? 0 : 1);
      g.score += pts;
      g.made++;
      g.streak++;
      g.lastPts = pts;
      g.lastSwish = g.rims[i] ? 0 : 1;
      if (!g.rims[i]) g.swish++;
      g.scored |= 1 << i;
      g.got[i] = 1;
    }
    g.py[i] = y;
    if (g.out[i] && ++g.air[i]! > 10 * HZ) {
      // Lodged somewhere: the ball return drops it back in the tray.
      w.launch(i, RAMP0 * 0.5, BR, slotZ(i), 0, 0, 0);
      w.state[i] = REST;
    }
    // Back in the tray: a shot that never went in breaks the run.
    if (g.out[i] && inTray(g, i)) {
      g.out[i] = 0;
      if (!g.got[i]) g.streak = 0;
    }
  }
  if (g.phase === ON && g.tick >= ROUND) g.phase = OVER;
  take(g);
  return g.phase;
}
