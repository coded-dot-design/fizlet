// Shuffle Shot's game: tabletop shuffleboard on @fzlt/core/flick, pure and seeded. No DOM, no clock,
// no renderer, no allocation once a game exists (`resetGame` reuses one). The board is flick's
// table (the lane along x, the shooter's end at −x); past its edges a puck drops into the gutter
// (flick's floor), and fixed walls box the gutters in. A shot is `sling`'s two integers (angle,
// level), so the same seed and the same shots play the same game bit for bit (online play later:
// only those integers cross the wire). Tests: tests/shuffle-shot.test.mjs.
import { flick, sling, type Flick, type FlickEvents, type Sling } from "../../../../src/flick";
import type { Random } from "../../../../src/kernel/random";

/** The board: length (x) and width (z), the puck's radius and height, where a shot starts. */
export const LEN = 16, WID = 2.4, R = 0.28, PH = 0.2, X0 = -5.6;
/** The far edge, a zone's length and the foul line (short of it a puck scores nothing). */
export const EDGE = LEN / 2, ZONE = 1.25, FOUL = EDGE - 3 * ZONE;
/** Gutter depth (flick's floor), pucks per side, points to win, sliding friction, full-power speed. */
export const GUTTER = -0.34, PER = 4, WIN = 15, MU = 0.22, VMAX = 9.4, G = 9.8;
/** Sling resolution: power levels and directions per turn. */
export const STEPS = 200, TURNS = 4096;
/** Phases: your shot or the bot's (aim), pucks moving (roll), the round's count (tally), over. */
export const AIM = 0, ROLL = 1, TALLY = 2, OVER = 3;

export interface Game {
  w: Flick;
  s: Sling;
  seed: number;
  phase: number;
  /** Points, per side (0 you, 1 the bot). */
  score: Int16Array;
  /** Round number (from 1), who throws first this round, shots thrown (0..8), the winner (−1). */
  round: number;
  first: number;
  k: number;
  winner: number;
  /** The last tally: the side that scored (−1 none) and its points, and per puck what it scored. */
  rs: number;
  rp: number;
  pts: Int8Array;
  /** Per puck: 1 once thrown this round. */
  out: Uint8Array;
}

/** A new game (its flick world: 8 pucks, the gutters' walls). `events` gets flick's hits and falls. */
export function newGame(seed: number, events?: FlickEvents): Game {
  const w = flick({ cap: 16, table: [LEN, WID], floor: GUTTER, floorFriction: 1.2, tip: 0.5, events });
  for (let i = 0; i < 2 * PER; i++) w.add({ size: [2 * R, PH], friction: MU, bounce: 0.82, mass: 1, pos: [-40 - i * 2, 0] });
  // Walls round the gutters (from the gutter's floor up): the far bumper, the two sides, the back.
  const gz = WID / 2 + 0.62;
  w.add({ shape: "box", fixed: true, size: [0.3, 1, 2 * gz + 0.3], pos: [EDGE + 0.95, GUTTER, 0] });
  w.add({ shape: "box", fixed: true, size: [LEN + 2.2, 1, 0.3], pos: [0.1, GUTTER, -gz] });
  w.add({ shape: "box", fixed: true, size: [LEN + 2.2, 1, 0.3], pos: [0.1, GUTTER, gz] });
  w.add({ shape: "box", fixed: true, size: [0.3, 1, 2 * gz + 0.3], pos: [-EDGE - 0.95, GUTTER, 0] });
  const g: Game = {
    w, s: sling({ pull: 2.6, max: VMAX, steps: STEPS, turns: TURNS, min: 0.04 }), seed: 0, phase: AIM, score: new Int16Array(2),
    round: 1, first: 0, k: 0, winner: -1, rs: -1, rp: 0, pts: new Int8Array(2 * PER), out: new Uint8Array(2 * PER),
  };
  return resetGame(g, seed);
}

/** Park every puck off the board (they wait in the racks) and settle them. */
function park(g: Game) {
  for (let i = 0; i < 2 * PER; i++) g.w.place(i, -40 - i * 2, 0);
  g.w.run();
  g.out.fill(0);
}
/** Start `g` over in place (no allocation). */
export function resetGame(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.phase = AIM;
  g.score.fill(0);
  g.round = 1;
  g.first = 0;
  g.k = 0;
  g.winner = -1;
  g.rs = -1;
  g.rp = 0;
  g.pts.fill(0);
  park(g);
  return g;
}

/** Whose shot it is (0 you, 1 the bot), and the puck it throws (side × 4 + its count). */
export const shooter = (g: Game) => (g.first + g.k) & 1;
export const puckOf = (g: Game) => shooter(g) * PER + (g.k >> 1);
/** The points a puck at x scores: 4 hanging over the far edge, then 3, 2, 1, and 0 short of the foul line. */
export const zone = (x: number) => (x > EDGE - R ? 4 : x >= EDGE - ZONE ? 3 : x >= EDGE - 2 * ZONE ? 2 : x >= FOUL ? 1 : 0);
/** A puck still on the board (thrown, not in the gutter). */
export const live = (g: Game, i: number) => g.out[i] === 1 && g.w.off[i] === 0 && g.w.y[i]! > -0.01;

/** Throw the next puck from the line with the shot (angle, level). false: not now. */
export function shoot(g: Game, angle: number, level: number) {
  if (g.phase !== AIM) return false;
  const i = puckOf(g);
  g.w.place(i, X0, 0);
  g.out[i] = 1;
  g.s.set(angle, level);
  g.w.flick(i, g.s.jx, g.s.jz);
  g.phase = ROLL;
  return true;
}

/** After a shot comes to rest: the next shot, or the round's tally. Returns the new phase. */
export function rested(g: Game) {
  if (g.phase !== ROLL || g.w.busy) return g.phase;
  g.k++;
  if (g.k < 2 * PER) return (g.phase = AIM);
  tally(g);
  return (g.phase = TALLY);
}

/** The round's count: only the side with the furthest puck scores, for every puck of theirs past
 *  the other side's furthest. Sets rs (−1: nobody), rp and pts; adds it to the score. */
export function tally(g: Game) {
  furthest(g);
  const far0 = FAR[0]!, far1 = FAR[1]!;
  g.pts.fill(0);
  g.rs = far0 > far1 ? 0 : far1 > far0 ? 1 : -1;
  g.rp = 0;
  if (g.rs < 0) return;
  const beat = g.rs ? far0 : far1;
  for (let i = g.rs * PER; i < g.rs * PER + PER; i++)
    if (live(g, i) && g.w.x[i]! > beat) (g.pts[i] = zone(g.w.x[i]!)), (g.rp += g.pts[i]!);
  g.score[g.rs] = g.score[g.rs]! + g.rp;
}
/** Each side's furthest scoring puck (x, or −Infinity) into FAR (a typed array: a double returned
 *  from a call V8 does not inline is boxed, an allocation each time). */
export const FAR = new Float64Array(2);
export function furthest(g: Game) {
  const x = g.w.x;
  FAR[0] = FAR[1] = -Infinity;
  for (let i = 0; i < 2 * PER; i++) if (live(g, i) && x[i]! >= FOUL && x[i]! > FAR[i < PER ? 0 : 1]!) FAR[i < PER ? 0 : 1] = x[i]!;
}

/** After the tally: the game is over (someone has WIN and the lead), or the next round starts
 *  (the side that scored throws first; the other has the last shot). Returns the new phase. */
export function nextRound(g: Game) {
  if (g.phase !== TALLY) return g.phase;
  const a = g.score[0]!, b = g.score[1]!;
  if ((a >= WIN || b >= WIN) && a !== b) return (g.winner = a > b ? 0 : 1), (g.phase = OVER);
  if (g.rs >= 0) g.first = g.rs;
  g.round++;
  g.k = 0;
  park(g);
  return (g.phase = AIM);
}

/** The bot's shot into out = [angle, level]: knock your leading puck off if it is ahead of its own,
 *  else draw one into the 3 (or the hang); a little seeded wobble in both, so it can miss. */
export function botAim(g: Game, rnd: Random, out: { [i: number]: number }) {
  furthest(g);
  const mine = FAR[1]!, yours = FAR[0]!, w = g.w;
  let tx = EDGE - 0.55 - rnd() * 0.5, tz = (rnd() - 0.5) * 1.2, extra = 0;
  if (yours > mine) {
    // The leading puck of yours: hit it hard enough to clear it off.
    for (let i = 0; i < PER; i++) if (live(g, i) && w.x[i] === yours) (tx = w.x[i]!), (tz = w.z[i]!);
    extra = 3.2;
  } else if (rnd() < 0.3) tx = EDGE - R * 0.6; // go for the hang
  const dx = tx - X0, dz = tz, d = Math.sqrt(dx * dx + dz * dz) + extra, v = Math.sqrt(2 * MU * G * d);
  out[0] = Math.round((Math.atan2(dz, dx) / (2 * Math.PI)) * TURNS) + Math.round((rnd() - 0.5) * 44);
  out[1] = Math.min(STEPS, Math.round((v / VMAX) * STEPS) + Math.round((rnd() - 0.5) * 12));
  return out;
}
