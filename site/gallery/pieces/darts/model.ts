// Darts' game: 501 down to zero, double out, you vs a bot, pure and seeded. No DOM, no clock, no
// renderer, no allocation once a game exists (`resetGame` reuses one). The board is a real one in
// millimetres (board face: x right, y up, the bull at 0): the bull 50, the outer bull 25, the treble
// and double rings, twenty beds in the usual order. A throw is four integers (where the reticle was,
// in tenths of a millimetre; the power level; how crooked the flick was), and where the dart lands
// is + − × ÷ only, so the same throws play the same game bit for bit (online play later: only those
// integers cross the wire). The beds are found by comparisons with fixed boundary vectors (no
// `Math.atan2`, which may differ in the last bit between browsers). Tests: tests/darts.test.mjs.
import type { Random } from "../../../../src/kernel/random";

/** The rings' radii (mm): inner bull, outer bull, treble in and out, double in and out, the board face. */
export const R_IN = 6.35, R_BULL = 15.9, R_T0 = 99, R_T1 = 107, R_D0 = 162, R_D1 = 170, R_FACE = 225;
/** The beds, clockwise from the top. */
export const ORDER = Int8Array.from([20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]);
/** Half a wire's width (mm): a dart this close to one bounces out. */
export const WIRE = 0.2;
/** The throw: power levels, the level that hits the reticle, and how far a dart drops per level off it. */
export const STEPS = 100, IDEAL = 70, DROP = 1.6, CROOK = 0.12;
/** Where the reticle may go (mm from the bull). */
export const REACH = 260;
/** 501, three darts a visit. */
export const START = 501, DARTS = 3;
/** Phases: a dart to throw (aim), the visit's end (count, pull the darts), over. */
export const AIM = 0, VISIT = 1, OVER = 2;
/** Bed codes: seg × 4 + mult (mult 0 a miss, 1 single, 2 double, 3 treble; seg 25 the bulls). */
export const code = (seg: number, mult: number) => seg * 4 + mult;

// The bed boundaries: unit vectors at 9° + 18°·k clockwise from the top, from five fixed sines.
const SN = [0.15643446504023087, 0.45399049973954675, 0.7071067811865476, 0.8910065241883679, 0.9876883405951378];
const BX = new Float64Array(20), BY = new Float64Array(20);
for (let k = 0; k < 20; k++) {
  const a = (9 + 18 * k) % 90, q = ((9 + 18 * k) / 90) | 0, j = (a - 9) / 18, s = SN[j]!, c = SN[4 - j]!;
  // (sin ψ, cos ψ) by quadrant.
  BX[k] = q === 0 ? s : q === 1 ? c : q === 2 ? -s : -c;
  BY[k] = q === 0 ? c : q === 1 ? -s : q === 2 ? -c : s;
}

/** The bed index (0..19, into ORDER) of the point (x, y): the wedge it is in. */
export function wedge(x: number, y: number) {
  for (let k = 0; k < 20; k++) {
    const p = (k + 19) % 20;
    if (BX[p]! * y - BY[p]! * x < 0 && BX[k]! * y - BY[k]! * x >= 0) return k;
  }
  return 0;
}
/** How far (mm) the point is from the nearest wire (rings and the radial wires between 25 and the double). */
export function wireGap(x: number, y: number) {
  const r = Math.sqrt(x * x + y * y);
  let d = Math.min(Math.abs(r - R_IN), Math.abs(r - R_BULL), Math.abs(r - R_T0), Math.abs(r - R_T1), Math.abs(r - R_D0), Math.abs(r - R_D1));
  if (r > R_BULL && r < R_D1)
    for (let k = 0; k < 20; k++) {
      // Distance to the radial wire along BX, BY (on its own side of the bull).
      const along = BX[k]! * x + BY[k]! * y;
      if (along > 0) d = Math.min(d, Math.abs(BX[k]! * y - BY[k]! * x));
    }
  return d;
}

/** Score the point (x, y) into out = [seg, mult, points] (mult 0: off the scoring area); returns the points. */
export function score(x: number, y: number, out: { [i: number]: number }) {
  const r2 = x * x + y * y;
  let seg = 0, mult = 0;
  if (r2 <= R_IN * R_IN) (seg = 25), (mult = 2);
  else if (r2 <= R_BULL * R_BULL) (seg = 25), (mult = 1);
  else if (r2 <= R_D1 * R_D1) {
    seg = ORDER[wedge(x, y)]!;
    mult = r2 >= R_D0 * R_D0 ? 2 : r2 >= R_T0 * R_T0 && r2 <= R_T1 * R_T1 ? 3 : 1;
  }
  out[0] = seg;
  out[1] = mult;
  return (out[2] = seg * mult);
}

/** Where a throw lands (mm) into out = [x, y]: the reticle (ax, ay in tenths of a mm), dropped or
 *  lifted by a soft or a hard throw (level off IDEAL), pushed sideways by a crooked flick. */
export function land(ax: number, ay: number, level: number, crook: number, out: { [i: number]: number }) {
  out[0] = ax / 10 + crook * CROOK;
  out[1] = ay / 10 + (level - IDEAL) * DROP;
  return out;
}

export interface Game {
  seed: number;
  phase: number;
  /** What each side has left, and what it had when its visit started. */
  rem: Int16Array;
  from: Int16Array;
  /** Whose visit (0 you, 1 the bot), the dart in it (0..2), the winner (−1), the visit busted. */
  turn: number;
  dart: number;
  winner: number;
  bust: number;
  /** This visit's darts: where they landed (mm), bed code, points, bounced out (1). */
  dx: Float64Array;
  dy: Float64Array;
  bed: Int16Array;
  pts: Int16Array;
  out: Uint8Array;
  /** Visits so far per side and the last eight scores per side (−1 a bust), newest last. */
  visits: Int16Array;
  log: Int16Array;
  /** Darts thrown per side. */
  thrown: Int16Array;
}

const SC = new Float64Array(3), LP = new Float64Array(2);

export function newGame(seed: number): Game {
  const g: Game = {
    seed: 0, phase: AIM, rem: new Int16Array(2), from: new Int16Array(2), turn: 0, dart: 0, winner: -1, bust: 0,
    dx: new Float64Array(DARTS), dy: new Float64Array(DARTS), bed: new Int16Array(DARTS), pts: new Int16Array(DARTS), out: new Uint8Array(DARTS),
    visits: new Int16Array(2), log: new Int16Array(16), thrown: new Int16Array(2),
  };
  return resetGame(g, seed);
}
/** Start `g` over in place (no allocation): 501 each, you throw first. */
export function resetGame(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.phase = AIM;
  g.rem.fill(START);
  g.from.fill(START);
  g.turn = g.dart = g.bust = 0;
  g.winner = -1;
  g.visits.fill(0);
  g.log.fill(0);
  g.thrown.fill(0);
  clearVisit(g);
  return g;
}
function clearVisit(g: Game) {
  g.dx.fill(0), g.dy.fill(0), g.bed.fill(0), g.pts.fill(0), g.out.fill(0);
}

/** Throw the next dart: the reticle (ax, ay, tenths of a mm), the level (0..STEPS) and the crook.
 *  false: not now. Then the dart's landing, bed and points are in this visit's slots; a bust puts
 *  the score back where the visit started; a double that reaches 0 wins. */
export function throwDart(g: Game, ax: number, ay: number, level: number, crook: number) {
  if (g.phase !== AIM) return false;
  const i = g.dart, s = g.turn;
  land(ax, ay, level, crook, LP);
  const x = LP[0]!, y = LP[1]!;
  g.dx[i] = x;
  g.dy[i] = y;
  g.thrown[s] = g.thrown[s]! + 1;
  const r2 = x * x + y * y;
  // On a wire (inside the face): it bounces out and scores nothing.
  if (r2 < (R_D1 + 1) * (R_D1 + 1) && wireGap(x, y) < WIRE) (g.out[i] = 1), (g.bed[i] = 0), (g.pts[i] = 0);
  else score(x, y, SC), (g.bed[i] = code(SC[0]!, SC[1]!)), (g.pts[i] = SC[2]!);
  const left = g.rem[s]! - g.pts[i]!, dbl = (g.bed[i]! & 3) === 2;
  g.dart++;
  if (left < 0 || left === 1 || (left === 0 && !dbl)) (g.bust = 1), (g.rem[s] = g.from[s]!), (g.phase = VISIT);
  else if (left === 0) (g.rem[s] = 0), (g.winner = s), (g.phase = VISIT);
  else (g.rem[s] = left), (g.phase = g.dart >= DARTS ? VISIT : AIM);
  return true;
}

/** The visit's end: log it, then the next side's visit (or the game is over). Returns the new phase. */
export function endVisit(g: Game) {
  if (g.phase !== VISIT) return g.phase;
  const s = g.turn, o = s * 8;
  g.log.copyWithin(o, o + 1, o + 8);
  g.log[o + 7] = g.bust ? -1 : g.from[s]! - g.rem[s]!;
  g.visits[s] = g.visits[s]! + 1;
  if (g.winner >= 0) return (g.phase = OVER);
  g.turn = s ^ 1;
  g.dart = 0;
  g.bust = 0;
  g.from[g.turn] = g.rem[g.turn]!;
  clearVisit(g);
  return (g.phase = AIM);
}

// ---- checkouts ----
// Every finish from 2 to 170 in one, two or three darts, the last one a double (or the bull): the
// fewest darts, then the usual choices (trebles high first, a good double to finish). Built once.
const SETUP: number[] = [], FINISH: number[] = [];
for (let s = 20; s >= 1; s--) SETUP.push(code(s, 3));
SETUP.push(code(25, 2), code(25, 1));
for (let s = 20; s >= 1; s--) SETUP.push(code(s, 1));
for (let s = 20; s >= 1; s--) SETUP.push(code(s, 2));
for (const s of [20, 16, 18, 12, 10, 8, 19, 17, 15, 14, 13, 11, 9, 7, 6, 5, 4, 3, 2, 1]) FINISH.push(code(s, 2));
FINISH.push(code(25, 2));
const val = (c: number) => (c >> 2) * (c & 3);
/** Per score (0..170) and darts (1..3): the route, three codes (0 unused); `OUTN` its length (0 none). */
const OUT = new Int16Array(171 * 3 * 3), OUTN = new Int8Array(171 * 3);
for (let rem = 2; rem <= 170; rem++)
  for (let n = 1; n <= 3; n++) {
    const at = (rem * 3 + n - 1) * 3;
    let found = 0;
    // One dart: the double itself. Two: a good double first, then what sets it up. Three: the
    // biggest first dart, then a good double, then the second dart that bridges them.
    for (const f of FINISH) if (!found && val(f) === rem) (OUT[at] = f), (found = 1);
    if (n >= 2) for (const f of FINISH) for (const a of SETUP) if (!found && val(a) + val(f) === rem) (OUT[at] = a), (OUT[at + 1] = f), (found = 2);
    if (n >= 3)
      for (const a of SETUP) for (const f of FINISH) for (const b of SETUP)
        if (!found && val(a) + val(b) + val(f) === rem) (OUT[at] = a), (OUT[at + 1] = b), (OUT[at + 2] = f), (found = 3);
    OUTN[rem * 3 + n - 1] = found;
  }
/** The checkout for `rem` with `darts` left into out (codes): its length, or 0 if there is none. */
export function checkout(rem: number, darts: number, out: { [i: number]: number }) {
  if (rem < 2 || rem > 170 || darts < 1) return 0;
  const n = OUTN[rem * 3 + Math.min(3, darts) - 1]!, at = (rem * 3 + Math.min(3, darts) - 1) * 3;
  for (let k = 0; k < 3; k++) out[k] = k < n ? OUT[at + k]! : 0;
  return n;
}
/** A bed's name: T20, D16, 25, BULL, 7, or MISS. */
export const bedName = (c: number) => {
  const s = c >> 2, m = c & 3;
  return m === 0 ? "MISS" : s === 25 ? (m === 2 ? "BULL" : "25") : (m === 3 ? "T" : m === 2 ? "D" : "") + s;
};

// ---- aiming ----
/** The middle of a bed (mm) into out = [x, y]: a single aims at its outer single (the fat one). */
export function bedAt(c: number, out: { [i: number]: number }) {
  const s = c >> 2, m = c & 3;
  if (s === 25) return (out[0] = 0), (out[1] = m === 2 ? 0 : -11), out;
  let k = 0;
  while (ORDER[k] !== s) k++;
  // The bed's centre line: halfway between its two boundaries.
  const p = (k + 19) % 20, ux = BX[p]! + BX[k]!, uy = BY[p]! + BY[k]!, l = Math.sqrt(ux * ux + uy * uy);
  const r = m === 3 ? (R_T0 + R_T1) / 2 : m === 2 ? (R_D0 + R_D1) / 2 : (R_T1 + R_D0) / 2;
  out[0] = (ux / l) * r;
  out[1] = (uy / l) * r;
  return out;
}
const CO = new Int16Array(3);
/** What the bot goes for: the checkout's first dart, else a single that leaves a double, else T20. */
export function botTarget(g: Game) {
  const rem = g.rem[g.turn]!, left = DARTS - g.dart;
  if (checkout(rem, left, CO)) return CO[0]!;
  if (rem <= 60) for (const d of [32, 40, 16, 24, 36, 20, 8, 12, 4, 2]) if (rem - d >= 1 && rem - d <= 20) return code(rem - d, 1);
  return code(20, 3);
}
/** The bot's throw into out = [ax, ay (tenths of a mm), level, crook]: its target with a seeded
 *  human spread (`spread` mm, about a σ), a level near the ideal and a little crook. */
export function botAim(g: Game, rnd: Random, out: { [i: number]: number }, spread = 15) {
  bedAt(botTarget(g), SC);
  const ex = (rnd() + rnd() + rnd() - 1.5) * spread * 1.4, ey = (rnd() + rnd() + rnd() - 1.5) * spread * 1.4;
  out[0] = Math.round((SC[0]! + ex) * 10);
  out[1] = Math.round((SC[1]! + ey) * 10);
  out[2] = IDEAL + Math.round((rnd() - 0.5) * 4);
  out[3] = Math.round((rnd() - 0.5) * 40);
  return out;
}
