// Air Hockey's game: a top-down air hockey table against a bot, on @fzlt/core/flick, pure and seeded.
// No DOM, no clock, no renderer, no allocation once a game exists (`resetGame` reuses one). The puck
// is a flick disc on almost no friction (it glides on air), the mallets are heavy discs driven toward
// their targets every tick, the rails are fixed boxes with a gap at each end: a puck through the gap
// falls off the table (flick's `off`) and that is a goal. First to 7. Each tick takes your mallet's
// target as two integers (millimetres), so the same targets play the same game bit for bit (online
// play later: only those integers cross the wire). Tests: tests/air-hockey.test.mjs.
import { flick, type Flick, type FlickEvents } from "../../../../src/flick";
import type { Random } from "../../../../src/kernel/random";

/** Metres. The table: length (x, your goal at −x), width (z), the rails, the goal mouth. */
export const L = 2, W = 1, RAIL = 0.05, GOAL = 0.3;
/** Puck and mallet: radius, height. */
export const PR = 0.036, PH = 0.012, MR = 0.05, MH = 0.05;
/** Bodies: 0 the puck, 1 your mallet, 2 the bot's. */
export const PUCK = 0, YOU = 1, BOT = 2;
/** Ticks a second; how hard a mallet chases its target, its top speed (yours, the bot's), the puck's. */
export const HZ = 60, GAIN = 22, VYOU = 7, VBOT = 3.6, VPUCK = 9;
/** Points to win. */
export const WIN = 7;
/** Phases: play, a goal just went in (waiting for the serve), over. */
export const PLAY = 0, GOALED = 1, OVER = 2;

export interface Game {
  w: Flick;
  seed: number;
  phase: number;
  tick: number;
  score: Int16Array;
  /** Who scored last (0 you, 1 the bot; −1 none), the winner (−1). */
  last: number;
  winner: number;
  /** Mallet targets (m): yours, the bot's. The bot's plan: 0 defend, 1 line up, 2 strike; its aim (z at your end). */
  tx: Float64Array;
  tz: Float64Array;
  plan: number;
  aimZ: number;
  /** Ticks into the bot's strike. */
  strike: number;
  /** Hits per mallet this game; the puck's top speed. */
  hits: Int16Array;
  top: number;
}

/** The range a mallet may reach: your half or the bot's, inside the rails. */
const XIN = L / 2 - MR, ZIN = W / 2 - MR;

export function newGame(seed: number, events?: FlickEvents): Game {
  const w = flick({ cap: 16, table: [L + 0.6, W + 0.4], floor: -0.4, sub: 8, tip: 0.2, events });
  w.add({ size: [2 * PR, PH], friction: 0.012, bounce: 0.92, mass: 1, pos: [-0.4, 0] });
  w.add({ size: [2 * MR, MH], friction: 0.6, bounce: 0.6, mass: 8, pos: [-0.8, 0] });
  w.add({ size: [2 * MR, MH], friction: 0.6, bounce: 0.6, mass: 8, pos: [0.8, 0] });
  // The rails: both sides, and each end in two pieces round the goal's mouth. (The table under
  // them is wider than the rails, so a puck only leaves through a mouth.)
  const side = W / 2 + RAIL / 2, end = L / 2 + RAIL / 2, seg = (W - GOAL) / 2 + RAIL;
  w.add({ shape: "box", fixed: true, size: [L + 2 * RAIL, 0.06, RAIL], pos: [0, -side] });
  w.add({ shape: "box", fixed: true, size: [L + 2 * RAIL, 0.06, RAIL], pos: [0, side] });
  for (let s = -1; s <= 1; s += 2) {
    w.add({ shape: "box", fixed: true, size: [RAIL, 0.06, seg], pos: [s * end, -(GOAL / 2 + seg / 2)] });
    w.add({ shape: "box", fixed: true, size: [RAIL, 0.06, seg], pos: [s * end, GOAL / 2 + seg / 2] });
  }
  // Rounded corners: a block across each one, so a puck never sits where no mallet reaches.
  for (let c = 0; c < 4; c++) w.add({ shape: "box", fixed: true, size: [0.13, 0.06, 0.13], yaw: Math.PI / 4, pos: [c & 1 ? L / 2 : -L / 2, c & 2 ? W / 2 : -W / 2] });
  const g: Game = {
    w, seed: 0, phase: PLAY, tick: 0, score: new Int16Array(2), last: -1, winner: -1,
    tx: new Float64Array(3), tz: new Float64Array(3), plan: 0, aimZ: 0, strike: 0, hits: new Int16Array(3), top: 0,
  };
  return resetGame(g, seed);
}
/** Start `g` over in place (no allocation): 0–0, the puck on your side to serve. */
export function resetGame(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.phase = PLAY;
  g.tick = 0;
  g.score.fill(0);
  g.last = g.winner = -1;
  g.hits.fill(0);
  g.top = 0;
  serve(g, 0);
  return g;
}
/** The puck to `side` (0 yours, 1 the bot's) at rest; both mallets home. */
export function serve(g: Game, side: number) {
  const w = g.w;
  w.place(PUCK, side ? 0.45 : -0.45, 0);
  w.place(YOU, -0.82, 0);
  w.place(BOT, 0.82, 0);
  w.run();
  g.tx[YOU] = -0.82; g.tz[YOU] = 0;
  g.tx[BOT] = 0.82; g.tz[BOT] = 0;
  g.plan = 0;
  if (g.phase === GOALED) g.phase = PLAY;
}
/** Clamp a target into mallet m's half. */
function clampT(g: Game, m: number) {
  const lo = m === YOU ? -XIN : MR, hi = m === YOU ? -MR : XIN;
  g.tx[m] = g.tx[m]! < lo ? lo : g.tx[m]! > hi ? hi : g.tx[m]!;
  g.tz[m] = g.tz[m]! < -ZIN ? -ZIN : g.tz[m]! > ZIN ? ZIN : g.tz[m]!;
}
/** Drive mallet m toward its target: a velocity change through flick's impulse (speed-limited). */
function drive(g: Game, m: number, vmax: number) {
  const w = g.w, dx = g.tx[m]! - w.x[m]!, dz = g.tz[m]! - w.z[m]!;
  let vx = dx * GAIN, vz = dz * GAIN;
  const s2 = vx * vx + vz * vz;
  if (s2 > vmax * vmax) {
    const k = vmax / Math.sqrt(s2);
    (vx *= k), (vz *= k);
  }
  // Close enough and slow: leave it at rest (so the table can settle).
  if (dx * dx + dz * dz < 1e-6 && w.vx[m]! * w.vx[m]! + w.vz[m]! * w.vz[m]! < 1e-4) return;
  w.flick(m, (vx - w.vx[m]!) * 8, (vz - w.vz[m]!) * 8);
}
/** One tick: your mallet's target (mm, clamped to your half), the bot thinks, both mallets move, the
 *  puck glides; a puck off the table at an end is a goal. Returns 1 you scored, 2 the bot scored, else 0. */
export function step(g: Game, youX: number, youZ: number, rnd: Random) {
  if (g.phase === OVER) return 0;
  g.tick++;
  g.tx[YOU] = youX / 1000;
  g.tz[YOU] = youZ / 1000;
  clampT(g, YOU);
  if (g.phase === PLAY) think(g, rnd);
  clampT(g, BOT);
  drive(g, YOU, VYOU);
  drive(g, BOT, VBOT);
  const w = g.w;
  w.step(1 / HZ);
  // The puck's top speed (air hockey's pucks stay quick but not wild).
  const pv = w.vx[PUCK]! * w.vx[PUCK]! + w.vz[PUCK]! * w.vz[PUCK]!;
  if (pv > VPUCK * VPUCK) {
    const k = VPUCK / Math.sqrt(pv);
    w.vx[PUCK] = w.vx[PUCK]! * k;
    w.vz[PUCK] = w.vz[PUCK]! * k;
  }
  if (pv > g.top * g.top) g.top = Math.sqrt(pv);
  // The air: a puck that dies deep at an end drifts back out toward the middle (no dead pucks in a mouth).
  const ax = w.x[PUCK]!;
  if (pv < 0.01 && (ax > L / 2 - 0.2 || ax < -L / 2 + 0.2) && !w.off[PUCK]) w.flick(PUCK, ax > 0 ? -0.22 : 0.22, 0);
  // Mallets stay on the table's top (a hard hit can't push one off its half).
  for (let m = YOU; m <= BOT; m++) if (w.off[m]) w.place(m, g.tx[m]!, g.tz[m]!);
  // Through a mouth, past the rails (or off the table): a goal.
  if (g.phase !== PLAY || (!w.off[PUCK] && w.x[PUCK]! < L / 2 + RAIL && w.x[PUCK]! > -L / 2 - RAIL)) return 0;
  const who = w.x[PUCK]! > 0 ? 0 : 1;
  g.score[who] = g.score[who]! + 1;
  g.last = who;
  if (g.score[who]! >= WIN) (g.winner = who), (g.phase = OVER);
  else g.phase = GOALED;
  return who + 1;
}
/** A mallet hit the puck (from flick's `flick:hit`): count it. */
export function hit(g: Game, a: number, b: number) {
  if (a === PUCK && (b === YOU || b === BOT)) g.hits[b] = g.hits[b]! + 1;
  else if (b === PUCK && (a === YOU || a === BOT)) g.hits[a] = g.hits[a]! + 1;
}

/** The bot: defend the mouth while the puck is on your side or coming at it; once it slows on its side
 *  (or crawls back), line up behind it toward a spot at your end (straight, or a bank off a rail),
 *  then strike through it. A little seeded aim and timing, so it can miss. */
function think(g: Game, rnd: Random) {
  const w = g.w, px = w.x[PUCK]!, pz = w.z[PUCK]!, vx = w.vx[PUCK]!, vz = w.vz[PUCK]!;
  const mine = px > 0, coming = vx > 0.4;
  if (!mine || (coming && vx > 1.6)) {
    // Defend: sit in front of the mouth, toward where the puck is headed.
    const t = vx > 0.2 ? (L / 2 - 0.16 - px) / vx : 0, z = pz + vz * (t < 0.6 ? t : 0.6);
    g.tx[BOT] = L / 2 - 0.16;
    g.tz[BOT] = Math.max(-GOAL * 0.7, Math.min(GOAL * 0.7, z * 0.8));
    g.plan = 0;
    return;
  }
  if (g.plan === 0) {
    // Pick a spot at your end: the mouth (a little off), or a bank off the near rail.
    const r = rnd();
    g.aimZ = r < 0.55 ? (rnd() - 0.5) * GOAL * 0.8 : (r < 0.78 ? 1 : -1) * (W - 0.08) - (rnd() - 0.5) * 0.1;
    g.plan = 1;
    g.strike = 0;
  }
  // The line from the spot through the puck: stand behind it, then go through.
  const ex = -L / 2, dx = px - ex, dz = pz - g.aimZ, l = Math.sqrt(dx * dx + dz * dz), ux = dx / l, uz = dz / l;
  const bx = px + ux * (PR + MR + 0.06), bz = pz + uz * (PR + MR + 0.06);
  if (g.plan === 1) {
    g.tx[BOT] = bx;
    g.tz[BOT] = bz;
    const ox = w.x[BOT]! - bx, oz = w.z[BOT]! - bz;
    // In place (or the spot is out of reach, or it took too long): strike.
    if ((ox * ox + oz * oz < 0.0009 && rnd() < 0.2) || bx > XIN || bz > ZIN || bz < -ZIN || ++g.strike > 90) (g.plan = 2), (g.strike = 0);
  } else {
    g.tx[BOT] = px - ux * 0.25;
    g.tz[BOT] = pz - uz * 0.25;
    // Through it and gone (or it missed): think again.
    if (w.x[PUCK]! < 0 || vx < -0.8 || ++g.strike > 24) g.plan = 0;
  }
}
