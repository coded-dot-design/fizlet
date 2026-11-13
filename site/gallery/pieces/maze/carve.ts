// The maze pieces' carver (Rat Race, Corn Maze): a seeded perfect maze on a @fzlt/core/grid board,
// then a few loops knocked through. A maze of cw × ch rooms lives on a (2cw + 1) × (2ch + 1) board:
// room (c, r) is cell (2c + 1, 2r + 1), the cells between rooms are walls (BLOCKED) or gaps (open),
// the even-even cells are posts (always BLOCKED). A perfect maze is a tree: one way between any two
// rooms, every room reachable, so it is always solvable; a loop is an extra gap (a second way round),
// which is where a piece puts a door that may shut without cutting anything off.
// Iterative recursive backtracker on a fixed stack (no recursion); the same seed, the same maze.
// A brick candidate (`grid`'s `maze()`), kept here until a third piece needs it.
import { BLOCKED, type Board } from "../../../../src/grid";

/** A maze's shape on its board, and the loops knocked through (gap cells), filled by `carve`. */
export type Maze = { cw: number; ch: number; loops: Int32Array; nLoops: number };

/** Room (c, r)'s cell. */
export const room = (g: Board, c: number, r: number) => (2 * r + 1) * g.cols + 2 * c + 1;
/** True when cell i is a room (odd column, odd row). */
export const isRoom = (g: Board, i: number) => ((i % g.cols) & 1) === 1 && (((i / g.cols) | 0) & 1) === 1;

const DC = [1, -1, 0, 0], DR = [0, 0, 1, -1];

/** Carve a perfect maze of cw × ch rooms into g (cols 2cw + 1, rows 2ch + 1) with `rand`, then knock
 *  out `loops` more walls between rooms (never on the border). Returns the maze. */
export function carve(g: Board, cw: number, ch: number, rand: () => number, loops = 0): Maze {
  if (g.cols !== 2 * cw + 1 || g.rows !== 2 * ch + 1) throw new RangeError("carve: the board must be (2cw + 1) × (2ch + 1)");
  g.flags.fill(BLOCKED);
  const n = cw * ch, seen = new Uint8Array(n), stack = new Int32Array(n), opts = new Int32Array(4);
  let top = 0;
  const start = Math.floor(rand() * n);
  stack[top++] = start;
  seen[start] = 1;
  g.flags[room(g, start % cw, (start / cw) | 0)] = 0;
  while (top) {
    const cur = stack[top - 1]!, c = cur % cw, r = (cur / cw) | 0;
    let k = 0;
    for (let d = 0; d < 4; d++) {
      const nc = c + DC[d]!, nr = r + DR[d]!;
      if (nc >= 0 && nr >= 0 && nc < cw && nr < ch && !seen[nr * cw + nc]) opts[k++] = d;
    }
    if (!k) {
      top--;
      continue;
    }
    const d = opts[Math.floor(rand() * k)]!, nc = c + DC[d]!, nr = r + DR[d]!, nx = nr * cw + nc;
    seen[nx] = 1;
    g.flags[(2 * r + 1 + DR[d]!) * g.cols + 2 * c + 1 + DC[d]!] = 0;
    g.flags[room(g, nc, nr)] = 0;
    stack[top++] = nx;
  }
  // Loops: walls between two rooms, chosen at random, opened.
  const m: Maze = { cw, ch, loops: new Int32Array(Math.max(1, loops)), nLoops: 0 };
  for (let tries = 0; m.nLoops < loops && tries < loops * 40; tries++) {
    const col = 1 + Math.floor(rand() * (g.cols - 2)), row = 1 + Math.floor(rand() * (g.rows - 2)), i = row * g.cols + col;
    // A wall between rooms: one coordinate odd, the other even.
    if (((col + row) & 1) === 0 || !(g.flags[i]! & BLOCKED)) continue;
    g.flags[i] = 0;
    m.loops[m.nLoops++] = i;
  }
  return m;
}

/** Open (0) or shut (BLOCKED) cell i. */
export const door = (g: Board, i: number, open: boolean) => void (g.flags[i] = open ? 0 : BLOCKED);
