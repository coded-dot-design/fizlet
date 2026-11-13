// Salvo Bay's game: pure, seeded, turn based. No DOM, no clock, no renderer, no allocation once a
// match exists (typed arrays; `resetMatch` reuses one). Every change is `place()` or `fire()`, so the
// same seed and the same inputs give the same game.
// Online play, later: each peer runs this model from the room's seed and only the inputs cross the
// wire over Fizlet's presence/room bricks (a fleet commit, then the shots as cell numbers). Hidden
// fleets then need a commit-reveal: send a hash of the placement first, reveal it at the end.
// Tests: tests/salvo-bay.test.mjs.

/** The bay is N × N cells; a cell is y * N + x. */
export const N = 8, CELLS = 64;
/** The fleet: ship lengths, and their names. */
export const FLEET = [4, 3, 3, 2], NAMES = ["Whale", "Heron", "Otter", "Minnow"];
/** Phases. */
export const PLACE = 0, BATTLE = 1, OVER = 2;
/** Shot results (and the shots grid's marks): 0 refused / none, then miss, hit, sunk. */
export const MISS = 1, HIT = 2, SUNK = 3;

/** One side: where its ships are, what has been fired at it, and what it fired. */
export interface Side {
  /** Ship i's first cell (x, y; −1 while not placed) and direction (0 along x, 1 along y). */
  sx: Int8Array;
  sy: Int8Array;
  dir: Uint8Array;
  /** Hits on ship i, and 1 once it is sunk. */
  hits: Uint8Array;
  sunk: Uint8Array;
  /** Per cell: the ship on it, or −1. */
  grid: Int8Array;
  /** Per cell: what a shot at it found (0 not fired at, MISS, HIT, SUNK). */
  shots: Uint8Array;
  /** Shots this side fired, and how many hit. */
  n: Uint16Array;
}
/** A match: two sides, the phase, whose turn, the winner (−1), and the last shot's ship. */
export interface Match {
  seed: number;
  phase: number;
  turn: number;
  winner: number;
  /** The ship the last fire() hit (−1 on a miss). */
  ship: number;
  sides: [Side, Side];
  /** The bot's candidate cells (scratch). */
  cand: Int16Array;
}

const side = (): Side => ({
  sx: new Int8Array(4), sy: new Int8Array(4), dir: new Uint8Array(4), hits: new Uint8Array(4), sunk: new Uint8Array(4),
  grid: new Int8Array(CELLS), shots: new Uint8Array(CELLS), n: new Uint16Array(2),
});

/** A new match in placement, both fleets on the dock. */
export function newMatch(seed: number): Match {
  const m: Match = { seed: 0, phase: PLACE, turn: 0, winner: -1, ship: -1, sides: [side(), side()], cand: new Int16Array(CELLS * 4) };
  return resetMatch(m, seed);
}
/** Start `m` over in place (no allocation). */
export function resetMatch(m: Match, seed: number) {
  m.seed = seed >>> 0;
  m.phase = PLACE;
  m.turn = 0;
  m.winner = m.ship = -1;
  for (let p = 0; p < 2; p++) {
    const s = m.sides[p]!;
    s.sx.fill(-1), s.sy.fill(-1), s.dir.fill(0), s.hits.fill(0), s.sunk.fill(0), s.grid.fill(-1), s.shots.fill(0), s.n.fill(0);
  }
  return m;
}

/** Cell k (0 ≤ k < length) of ship i on side s. */
export const cellOf = (s: Side, i: number, k: number) => (s.sy[i]! + (s.dir[i] ? k : 0)) * N + s.sx[i]! + (s.dir[i] ? 0 : k);
/** Can side p's ship i go at (x, y) facing dir (its own old cells don't count)? */
export function canPlace(m: Match, p: number, i: number, x: number, y: number, dir: number) {
  const L = FLEET[i]!;
  if (x < 0 || y < 0 || (dir ? y + L : x + L) > N || (dir ? x : y) >= N) return false;
  const g = m.sides[p]!.grid;
  for (let k = 0; k < L; k++) {
    const c = g[(y + (dir ? k : 0)) * N + x + (dir ? 0 : k)]!;
    if (c !== -1 && c !== i) return false;
  }
  return true;
}
/** Take side p's ship i back to the dock. */
export function unplace(m: Match, p: number, i: number) {
  const s = m.sides[p]!;
  if (s.sx[i]! < 0) return;
  for (let k = 0; k < FLEET[i]!; k++) s.grid[cellOf(s, i, k)] = -1;
  s.sx[i] = s.sy[i] = -1;
}
/** Put side p's ship i at (x, y) facing dir; false (nothing changes) when it can't go there. */
export function place(m: Match, p: number, i: number, x: number, y: number, dir: number) {
  if (m.phase !== PLACE || !canPlace(m, p, i, x, y, dir)) return false;
  unplace(m, p, i);
  const s = m.sides[p]!;
  (s.sx[i] = x), (s.sy[i] = y), (s.dir[i] = dir);
  for (let k = 0; k < FLEET[i]!; k++) s.grid[cellOf(s, i, k)] = i;
  return true;
}
/** Every ship of side p somewhere legal, from `rnd`. */
export function randomFleet(m: Match, p: number, rnd: () => number) {
  for (let i = 0; i < FLEET.length; i++) unplace(m, p, i);
  for (let i = 0; i < FLEET.length; i++)
    for (let t = 0; t < 500; t++) if (place(m, p, i, (rnd() * N) | 0, (rnd() * N) | 0, rnd() < 0.5 ? 1 : 0)) break;
}
/** Is every ship of side p placed? */
export function ready(m: Match, p: number) {
  const s = m.sides[p]!;
  for (let i = 0; i < FLEET.length; i++) if (s.sx[i]! < 0) return false;
  return true;
}
/** From placement to battle once both fleets are out (you fire first). */
export function begin(m: Match) {
  if (m.phase !== PLACE || !ready(m, 0) || !ready(m, 1)) return false;
  m.phase = BATTLE;
  m.turn = 0;
  return true;
}
/** Side `by` fires at (x, y) on the other side: 0 (not allowed: not its turn, off the bay, fired
 *  there already), MISS, HIT or SUNK; the ship hit is `m.ship`. A sunk ship marks all its cells. */
export function fire(m: Match, by: number, x: number, y: number) {
  const t = m.sides[1 - by]!, c = y * N + x;
  m.ship = -1;
  if (m.phase !== BATTLE || m.turn !== by || x < 0 || y < 0 || x >= N || y >= N || t.shots[c]) return 0;
  const me = m.sides[by]!, i = t.grid[c]!;
  me.n[0]!++;
  if (i < 0) return (t.shots[c] = MISS), (m.turn = 1 - by), MISS;
  me.n[1]!++;
  t.hits[i]!++;
  t.shots[c] = HIT;
  m.ship = i;
  let r = HIT;
  if (t.hits[i]! >= FLEET[i]!) {
    t.sunk[i] = 1;
    r = SUNK;
    for (let k = 0; k < FLEET[i]!; k++) t.shots[cellOf(t, i, k)] = SUNK;
  }
  if (shipsLeft(m, 1 - by) === 0) (m.phase = OVER), (m.winner = by);
  else m.turn = 1 - by;
  return r;
}
/** Ships of side p still afloat. */
export function shipsLeft(m: Match, p: number) {
  const s = m.sides[p]!;
  let n = 0;
  for (let i = 0; i < FLEET.length; i++) n += s.sunk[i] ? 0 : 1;
  return n;
}
/** What side `by` knows of cell (x, y) on the other side: −1 off the bay, else its shot mark. */
const at = (s: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : s[y * N + x]!);
const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
/** The bot's next cell for side `by`. It reads only what a player could know (its own shot marks on
 *  the other bay): finish a line of hits, else try around a hit, else hunt on a checkerboard (every
 *  ship is two or longer), else any cell left. Never a cell it fired at; −1 when none is left. */
export function botPick(m: Match, by: number, rnd: () => number) {
  const s = m.sides[1 - by]!.shots, cand = m.cand;
  let n = 0;
  for (let c = 0; c < CELLS; c++) {
    if (s[c] !== HIT) continue;
    const x = c & 7, y = c >> 3;
    for (let d = 0; d < 4; d++) {
      if (at(s, x + DX[d]!, y + DY[d]!) !== HIT) continue;
      let k = 1;
      while (at(s, x + DX[d]! * k, y + DY[d]! * k) === HIT) k++;
      if (at(s, x + DX[d]! * k, y + DY[d]! * k) === 0) cand[n++] = (y + DY[d]! * k) * N + x + DX[d]! * k;
    }
  }
  if (!n)
    for (let c = 0; c < CELLS; c++) {
      if (s[c] !== HIT) continue;
      const x = c & 7, y = c >> 3;
      for (let d = 0; d < 4; d++) if (at(s, x + DX[d]!, y + DY[d]!) === 0) cand[n++] = (y + DY[d]!) * N + x + DX[d]!;
    }
  if (!n) for (let c = 0; c < CELLS; c++) if (!s[c] && (((c & 7) + (c >> 3)) & 1) === 0) cand[n++] = c;
  if (!n) for (let c = 0; c < CELLS; c++) if (!s[c]) cand[n++] = c;
  return n ? cand[(rnd() * n) | 0]! : -1;
}
