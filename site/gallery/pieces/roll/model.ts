// "Roll Home"'s game, pure and seeded (no DOM, no clock): a loop of 24 spaces with two ladders and
// two chutes, you against one bot, two tokens each. Every token starts on space 0 (the porch) and
// goes once round the loop; a roll that reaches or passes the porch again takes it home. Land on an
// opponent and it goes back to the porch (the porch is safe); a ladder or a chute where you land
// takes you along it; a 6 rolls again. First with both tokens home wins.
// The die is @fzlt/core/dice's `roll(seed)`, and each roll's seed comes from the match's seed and
// its roll count, so the pop dome (`popDome.press(seed)`) lands on the value the model plays.
// tests/roll-home.test.mjs plays it; the scene is ./roll-home.ts.
import { roll } from "../../../../src/dice";

/** Spaces on the loop; a token's position is 0..23, HOME once it is in. */
export const SPACES = 24, HOME = 24;
/** Jumps, [from, to]: two ladders (forward) and two chutes (back). The scene's track uses the same table. */
export const JUMPS: readonly (readonly [number, number])[] = [[1, 4], [7, 13], [15, 5], [21, 17]];
/** Phases: roll the die, pick a token, over. */
export const ROLL = 0, PICK = 1, OVER = 2;
/** What a move did (bits of `move`'s result). */
export const FINISH = 1, LADDER = 2, CHUTE = 4, CAPTURE = 8, AGAIN = 16, WIN = 32;

const JUMP = new Int8Array(SPACES).fill(-1);
for (const [a, b] of JUMPS) JUMP[a] = b;
/** The jump at space s, or −1. */
export const jumpAt = (s: number) => JUMP[s]!;

export interface Match {
  seed: number;
  /** Each token's position (player p's token t is p × 2 + t): 0..23, or HOME. */
  pos: Int8Array;
  turn: number;
  phase: number;
  /** The die's value this turn (0 before the roll). */
  die: number;
  /** Rolls so far (the next roll's seed comes from it). */
  rolls: number;
  winner: number;
  /** The last move: token, from, where the steps ended, where it landed (after a jump), what it did, the tokens it sent back (bits). */
  last: { tok: number; from: number; stop: number; land: number; did: number; sent: number };
  /** Per player: moves made, tokens sent back, ladders and chutes taken. */
  stats: Int16Array;
}

export function newMatch(seed: number): Match {
  const m: Match = { seed: 0, pos: new Int8Array(4), turn: 0, phase: ROLL, die: 0, rolls: 0, winner: -1, last: { tok: -1, from: 0, stop: 0, land: 0, did: 0, sent: 0 }, stats: new Int16Array(8) };
  reset(m, seed);
  return m;
}
export function reset(m: Match, seed: number) {
  m.seed = seed >>> 0;
  m.pos.fill(0);
  m.turn = m.phase = m.die = m.rolls = 0;
  m.winner = -1;
  m.last.tok = -1;
  m.last.from = m.last.stop = m.last.land = m.last.did = m.last.sent = 0;
  m.stats.fill(0);
}
/** The seed of the next roll (integer maths: the same match rolls the same dice everywhere). */
export const rollSeed = (m: Match) => (Math.imul(m.seed ^ 0x5bd1e995, 2654435761) + Math.imul(m.rolls + 1, 40503)) >>> 0;
/** Tokens of player p still out (not home). */
export function homeCount(m: Match, p: number) {
  return (m.pos[p * 2] === HOME ? 1 : 0) + (m.pos[p * 2 + 1] === HOME ? 1 : 0);
}
/** Can token k move now (it is the turn's player's and not home)? */
export const canMove = (m: Match, k: number) => m.phase === PICK && k >> 1 === m.turn && m.pos[k] !== HOME;
/** Roll the die for the turn's player: the value (1..6) from rollSeed(m). The phase becomes PICK. */
export function rollDie(m: Match) {
  if (m.phase !== ROLL) return 0;
  m.die = roll(rollSeed(m));
  m.rolls++;
  m.phase = PICK;
  return m.die;
}
/** Where token k would land on value v: the space (or HOME), before captures. `stop` (P[0]) is where
 *  the steps end, `land` (P[1]) after a jump. */
const P = new Int8Array(2);
export function plan(m: Match, k: number, v: number, out: { [i: number]: number } = P) {
  const p = m.pos[k]!;
  if (p === HOME) return (out[0] = out[1] = HOME), HOME;
  const s = p + v >= SPACES ? HOME : p + v, j = s === HOME ? -1 : JUMP[s]!;
  out[0] = s;
  out[1] = j >= 0 ? j : s;
  return out[1]!;
}
/** Is the other token of the turn's player worth asking about (both out, and they would land apart)? */
export function choice(m: Match) {
  const a = m.turn * 2, b = a + 1;
  if (m.pos[a] === HOME || m.pos[b] === HOME) return false;
  return m.pos[a] !== m.pos[b];
}
/** Move token k by the die: steps, a jump, captures, home; then the turn passes (a 6 keeps it).
 *  Returns what it did (FINISH | LADDER | CHUTE | CAPTURE | AGAIN | WIN), or −1 if it may not move. */
export function move(m: Match, k: number) {
  if (!canMove(m, k)) return -1;
  const p = m.turn, v = m.die, from = m.pos[k]!, L = m.last;
  plan(m, k, v, P);
  const stop = P[0]!, land = P[1]!;
  let did = 0, sent = 0;
  if (land === HOME) did |= FINISH;
  else if (land !== stop) did |= land > stop ? LADDER : CHUTE;
  m.pos[k] = land;
  // Land on them (never on the porch): they go back to it.
  if (land !== HOME && land !== 0)
    for (let o = 0; o < 4; o++)
      if (o >> 1 !== p && m.pos[o] === land) (m.pos[o] = 0), (sent |= 1 << o), (did |= CAPTURE);
  m.stats[p * 4] = m.stats[p * 4]! + 1;
  if (did & CAPTURE) m.stats[p * 4 + 1] = m.stats[p * 4 + 1]! + 1;
  if (did & LADDER) m.stats[p * 4 + 2] = m.stats[p * 4 + 2]! + 1;
  if (did & CHUTE) m.stats[p * 4 + 3] = m.stats[p * 4 + 3]! + 1;
  L.tok = k; L.from = from; L.stop = stop; L.land = land; L.sent = sent;
  if (homeCount(m, p) === 2) (did |= WIN), (m.phase = OVER), (m.winner = p);
  else {
    if (v === 6) did |= AGAIN;
    else m.turn = 1 - p;
    m.phase = ROLL;
  }
  m.die = 0;
  L.did = did;
  return did;
}
/** The bot's pick for the turn's player: home first, then a capture, a ladder, the token that would
 *  land safest, never a chute when there is another way; `rnd` breaks ties. */
export function botPick(m: Match, rnd: () => number) {
  const p = m.turn, v = m.die;
  let best = -1, top = -1e9;
  for (let t = 0; t < 2; t++) {
    const k = p * 2 + t, at = m.pos[k]!;
    if (at === HOME) continue;
    plan(m, k, v, P);
    const stop = P[0]!, land = P[1]!;
    let s = rnd() * 0.5;
    if (land === HOME) s += 100;
    else {
      if (land > stop) s += 40;
      if (land < stop) s -= 50;
      for (let o = 0; o < 4; o++) if (o >> 1 !== p && m.pos[o] === land && land !== 0) s += 60;
      // An opponent one to six behind the landing space could land on it next.
      for (let o = 0; o < 4; o++) {
        const q = m.pos[o]!;
        if (o >> 1 === p || q === HOME || land === 0) continue;
        const d = land - q;
        if (d >= 1 && d <= 6) s -= 8;
      }
      s += (land - at) * 0.5;
    }
    if (s > top) (top = s), (best = k);
  }
  return best;
}
