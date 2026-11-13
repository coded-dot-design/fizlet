// "Mirror Maze"'s puzzles, pure (no DOM, no clock): five hand-made boards on a grid, each an emitter,
// fixed blockers, two to four mirrors you turn (a tap turns one 45°: four looks, since a mirror's
// two faces are the same) and, later, a fixed splitter; light every target to clear a board. The
// light is @fzlt/core/beam's: `load` puts a level's parts on a beam board, `turn` turns a mirror
// and re-runs it, `solved` says whether every target is lit. `par` is the fewest turns that solve
// a board (a search over every mirror state); tests/mirror-maze.test.mjs proves each board is
// solvable at its par. The scene is ./mirror-maze.ts.
import { beam, MIRROR, SPLITTER, TARGET, type Beam } from "../../../../src/beam";

/** One board: its grid size, the emitter (cell and direction: 0 east, 2 south, 4 west, 6 north, in
 *  45° steps), blockers, turnable mirrors with their starting look (0..3, ×45°), fixed splitters
 *  and the targets. Rows grow toward the viewer (+z). */
export interface Level {
  name: string;
  w: number;
  h: number;
  emit: readonly [number, number, number];
  block: readonly (readonly [number, number])[];
  mirror: readonly (readonly [number, number, number])[];
  split: readonly (readonly [number, number, number])[];
  target: readonly (readonly [number, number])[];
}
export const CELL = 1.6, COLS = 7, ROWS = 5;
export const LEVELS: readonly Level[] = [
  { name: "First light", w: 7, h: 5, emit: [0, 2, 0], block: [[6, 2], [2, 0]], mirror: [[4, 2, 2]], split: [], target: [[4, 0]] },
  { name: "Round the post", w: 7, h: 5, emit: [0, 0, 0], block: [[5, 0], [1, 2], [6, 2]], mirror: [[3, 0, 0], [3, 4, 3], [5, 3, 0]], split: [], target: [[6, 4]] },
  { name: "Zigzag", w: 7, h: 5, emit: [0, 0, 0], block: [[4, 0], [2, 4], [6, 3], [4, 1]], mirror: [[2, 0, 3], [2, 3, 0], [5, 3, 1], [5, 1, 2]], split: [], target: [[6, 1]] },
  { name: "Half and half", w: 7, h: 5, emit: [3, 4, 6], block: [[0, 2], [6, 1], [3, 0]], mirror: [[1, 2, 0], [3, 1, 1], [5, 1, 2]], split: [[3, 2, 1]], target: [[1, 0], [5, 0]] },
  { name: "Hall of mirrors", w: 7, h: 5, emit: [0, 1, 0], block: [[1, 4], [3, 0], [6, 2]], mirror: [[2, 3, 0], [5, 1, 3], [4, 4, 0], [4, 3, 1]], split: [[2, 1, 1], [4, 1, 1]], target: [[0, 3], [6, 4], [6, 1]] },
];

/** The kind of part i on a loaded board, and which mirror it is (−1 if not one you turn). */
export interface Board {
  b: Beam;
  /** Part index per turnable mirror. */
  mirrors: Int16Array;
  /** Each turnable mirror's look now (0..3). */
  look: Uint8Array;
  /** Part indices of the targets. */
  targets: Int16Array;
  level: number;
  /** Turns made on this board. */
  moves: number;
}
const Q = Math.PI / 4;
/** A beam board for every level size: 64 parts is plenty. */
export function newBoard(): Board {
  return { b: beam({ cap: 32, segs: 128, hits: 64, bounces: 24, grid: { cell: CELL, x0: (-COLS * CELL) / 2, z0: (-ROWS * CELL) / 2 }, bounds: [(-COLS * CELL) / 2, (-ROWS * CELL) / 2, (COLS * CELL) / 2, (ROWS * CELL) / 2] }), mirrors: new Int16Array(8), look: new Uint8Array(8), targets: new Int16Array(8), level: 0, moves: 0 };
}
/** Count of turnable mirrors and targets on level l. */
export const counts = (l: number) => [LEVELS[l]!.mirror.length, LEVELS[l]!.target.length] as const;
/** Put level l's parts on a fresh board (new parts: call between levels, not per frame). */
export function load(l: number, bd: Board = newBoard()) {
  const L = LEVELS[l]!;
  const b = (bd.b = beam({ cap: 32, segs: 128, hits: 64, bounces: 24, grid: { cell: CELL, x0: (-L.w * CELL) / 2, z0: (-L.h * CELL) / 2 }, bounds: [(-L.w * CELL) / 2, (-L.h * CELL) / 2, (L.w * CELL) / 2, (L.h * CELL) / 2] }));
  bd.level = l;
  bd.moves = 0;
  b.add({ kind: "emitter", col: L.emit[0], row: L.emit[1], a: L.emit[2] * Q, tag: "emit" });
  for (const [c, r] of L.block) b.add({ kind: "blocker", col: c, row: r, r: CELL * 0.36, tag: "block" });
  L.mirror.forEach(([c, r, k], i) => ((bd.mirrors[i] = b.add({ kind: "mirror", col: c, row: r, a: k * Q, len: CELL * 0.84, tag: i })), (bd.look[i] = k)));
  for (const [c, r, k] of L.split) b.add({ kind: "splitter", col: c, row: r, a: k * Q, len: CELL * 0.84, tag: "split" });
  L.target.forEach(([c, r], i) => (bd.targets[i] = b.add({ kind: "target", col: c, row: r, r: CELL * 0.3, tag: "t" + i })));
  b.run();
  return bd;
}
/** Set mirror i's look to k (0..3) without counting a move; re-runs the light. */
export function setLook(bd: Board, i: number, k: number) {
  const b = bd.b, p = bd.mirrors[i]!;
  bd.look[i] = k & 3;
  b.set(p, b.x[p]!, b.z[p]!, (k & 3) * Q);
  b.run();
}
/** Turn mirror i by 45° (one move); re-runs the light. Returns the new look. */
export function turn(bd: Board, i: number) {
  setLook(bd, i, bd.look[i]! + 1);
  bd.moves++;
  return bd.look[i]!;
}
/** Targets lit now. */
export function lit(bd: Board) {
  let n = 0;
  const [, t] = counts(bd.level);
  for (let i = 0; i < t; i++) if (bd.b.lit[bd.targets[i]!]) n++;
  return n;
}
export const solved = (bd: Board) => lit(bd) === counts(bd.level)[1];
/** The fewest turns from the starting looks that light every target (−1 if none), by trying every
 *  state of the mirrors; leaves the board in its starting looks. `best` gets the solving looks. */
export function par(l: number, bd: Board = load(l), best?: Uint8Array) {
  const L = LEVELS[l]!, n = L.mirror.length;
  let top = -1;
  for (let s = 0; s < 1 << (2 * n); s++) {
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const k = (s >> (2 * i)) & 3;
      cost += (k - L.mirror[i]![2] + 4) & 3;
      const p = bd.mirrors[i]!;
      bd.b.set(p, bd.b.x[p]!, bd.b.z[p]!, k * Q);
      bd.look[i] = k;
    }
    if (top >= 0 && cost >= top) continue;
    bd.b.run();
    if (solved(bd)) {
      top = cost;
      if (best) for (let i = 0; i < n; i++) best[i] = bd.look[i]!;
    }
  }
  for (let i = 0; i < n; i++) setLook(bd, i, L.mirror[i]![2]);
  bd.moves = 0;
  return top;
}
/** The pars of every level (computed once). */
export const PARS = LEVELS.map((_, l) => par(l));
export { MIRROR, SPLITTER, TARGET };
