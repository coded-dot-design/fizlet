// Rat Race's model (site/gallery/pieces/maze/rat-race.ts draws it): your mouse against a rival mouse
// through a seeded cardboard maze to the cheese in the middle. Pure: a @fzlt/core/grid board carved by
// ./carve.ts (a perfect maze, so every room reaches the cheese, plus loops), two doors on two loops
// that swap every few seconds (one open, one shut: shutting a loop never cuts a room off), the mice
// moving cell to cell. You steer (a direction you hold or a room you tap, A* on the board); the rival
// re-plans its A* at every room, now and then stops to sniff, and walks a little slower than you.
// A shutting door in a mouse's face bonks it back. `step` allocates nothing (tests/rat-race.test.mjs).
import { board, BLOCKED, type Board } from "../../../../src/grid";
import { seeded } from "../../../../src/kernel/index";
import { carve, door, isRoom, room, type Maze } from "./carve";

/** Rooms across and down. */
export const CW = 9, CH = 7;
/** World size of a room and of a wall (the cardboard is thin). */
export const RS = 1.5, WT = 0.3;
/** Your speed and the rival's (world units / s), the door swap period (s), the sniff pause (s). */
export const SPEED = 3.4, RIVAL = 2.85, SWAP = 3.2, SNIFF = 0.45;
export const YOU = 0, RIV = 1;

/** A mouse: the cell it is leaving, the cell it is entering, how far (0..1), its heading (0 +x,
 *  1 −x, 2 +z, 3 −z), a pause, and a bonk timer. */
export type Mouse = { at: number; to: number; prog: number; dir: number; wait: number; bonk: number; moved: boolean };
export type Race = {
  g: Board; maze: Maze; seed: number; cheese: number; start: Int32Array; mice: Mouse[];
  /** The doors' cells and which one is open. */
  doors: Int32Array; open: number; swapT: number;
  /** Your wish: a held direction (−1 none), and a tapped room's path. */
  want: number; path: Int32Array; pathN: number; pathI: number;
  /** 0 ready, 1 racing, 2 won by `winner`. */
  state: number; winner: number; t: number;
  /** Events since the reader last looked (bits): 1 door swap, 2 bonk you, 4 bonk rival, 8 sniff, 16 won. */
  ev: number;
  rand: () => number; buf: Int32Array;
  /** The rival's plan, and how many rooms it strays before it plans again. */
  rpath: Int32Array; rN: number; rI: number; stray: number;
};
export const READY = 0, RACING = 1, WON = 2;
export const EV_SWAP = 1, EV_BONK0 = 2, EV_BONK1 = 4, EV_SNIFF = 8, EV_WON = 16;
const DC = [1, -1, 0, 0], DR = [0, 0, 1, -1];

/** A grid column or row index to world (the maze centred on 0). */
export function pos(i: number, n: number) {
  const k = i >> 1, w = n * (RS + WT) + WT;
  return k * (RS + WT) + (i & 1 ? WT + RS / 2 : WT / 2) - w / 2;
}
/** A grid index's width in world units. */
export const span = (i: number) => (i & 1 ? RS : WT);

export function newRace(): Race {
  const g = board(2 * CW + 1, 2 * CH + 1);
  const n = g.cols * g.rows, m = () => ({ at: 0, to: 0, prog: 0, dir: 0, wait: 0, bonk: 0, moved: false });
  return {
    g, maze: { cw: CW, ch: CH, loops: new Int32Array(1), nLoops: 0 }, seed: 0, cheese: 0, start: new Int32Array(2), mice: [m(), m()],
    doors: new Int32Array(2), open: 0, swapT: 0, want: -1, path: new Int32Array(n), pathN: 0, pathI: 0,
    state: READY, winner: -1, t: 0, ev: 0, rand: seeded(1), buf: new Int32Array(n), rpath: new Int32Array(n), rN: 0, rI: 0, stray: 0,
  };
}

/** Distance in steps from a to b with the doors as they stand (−1: none). */
export const steps = (r: Race, a: number, b: number) => r.g.path(a, b, r.buf, 0, BLOCKED);

/** Round `seed`: carve the maze, pick the doors, put the cheese in the middle and the mice on the
 *  two corners whose walks to it are the most even (yours never the shorter by more than a little). */
export function load(seed: number, r: Race = newRace()) {
  r.seed = seed;
  r.rand = seeded((seed * 2654435761) >>> 0 || 1);
  const g = r.g;
  r.maze = carve(g, CW, CH, r.rand, 7);
  r.cheese = room(g, CW >> 1, CH >> 1);
  // Doors: the two loops nearest the middle (they matter to both mice), the first one open.
  const L = r.maze.loops, n = r.maze.nLoops;
  let a = -1, b = -1, da = 1e9, db = 1e9;
  for (let i = 0; i < n; i++) {
    const c = L[i]! % g.cols, w = (L[i]! / g.cols) | 0, d = Math.abs(c - CW) + Math.abs(w - CH);
    if (d < da) (b = a), (db = da), (a = L[i]!), (da = d);
    else if (d < db) (b = L[i]!), (db = d);
  }
  r.doors[0] = a;
  r.doors[1] = b;
  r.open = 0;
  door(g, b, false);
  // Corners: the pair with the most even walks to the cheese, you on the one a little further.
  const C = [room(g, 0, CH - 1), room(g, CW - 1, 0), room(g, 0, 0), room(g, CW - 1, CH - 1)];
  const D = C.map((c) => steps(r, c, r.cheese));
  let best = 1e9, y = 0, v = 1;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j && D[i]! >= D[j]! && D[i]! - D[j]! < best) (best = D[i]! - D[j]!), (y = i), (v = j);
  r.start[YOU] = C[y]!;
  r.start[RIV] = C[v]!;
  for (let k = 0; k < 2; k++) {
    const M = r.mice[k]!;
    M.at = M.to = r.start[k]!;
    M.prog = 0;
    M.wait = M.bonk = 0;
    M.moved = false;
    M.dir = (r.start[k]! % g.cols) < CW ? 0 : 1;
  }
  r.swapT = 0;
  r.want = -1;
  r.pathN = r.pathI = 0;
  r.rN = r.rI = r.stray = 0;
  r.state = READY;
  r.winner = -1;
  r.t = 0;
  r.ev = 0;
  return r;
}

/** The cell one step from i in direction d, or −1 off the board or into a shut cell. */
function next(r: Race, i: number, d: number) {
  const g = r.g, c = (i % g.cols) + DC[d]!, w = ((i / g.cols) | 0) + DR[d]!;
  if (c < 0 || w < 0 || c >= g.cols || w >= g.rows) return -1;
  const j = w * g.cols + c;
  return g.flags[j]! & BLOCKED ? -1 : j;
}
/** Open ways out of room i (a count). */
function exits(r: Race, i: number) {
  let k = 0;
  for (let d = 0; d < 4; d++) if (next(r, i, d) >= 0) k++;
  return k;
}
/** Head for room `to` (tapped): your path, by A*. Returns false if there is none. */
export function tapTo(r: Race, to: number) {
  if (!isRoom(r.g, to)) return false;
  const M = r.mice[YOU]!, from = M.prog > 0 ? M.to : M.at, n = r.g.path(from, to, r.path, 0, BLOCKED);
  if (n <= 0) return false;
  r.pathN = n;
  r.pathI = 0;
  r.want = -1;
  return true;
}
/** Hold a direction (−1 lets go). */
export function hold(r: Race, d: number) {
  r.want = d;
  if (d >= 0) r.pathN = r.pathI = 0;
}
/** Start the race. */
export function go(r: Race) {
  if (r.state === READY) r.state = RACING;
}

/** At a cell's centre: choose the next cell for mouse k (or stay). */
function choose(r: Race, k: number) {
  const M = r.mice[k]!, here = M.at;
  if (here === r.cheese) {
    r.state = WON;
    r.winner = k;
    r.ev |= EV_WON;
    return;
  }
  let to = -1;
  if (k === YOU && r.pathI < r.pathN) {
    to = r.path[r.pathI]!;
    if (r.g.flags[to]! & BLOCKED) (to = -1), (r.pathN = r.pathI = 0); // a door shut on the way: stop
    else r.pathI++;
  } else if (k === RIV) {
    // The rival follows its plan; it plans again (A*, the doors as they stand) when the plan runs out
    // or a door has shut across it. Committing to a plan keeps it from dithering as the doors swap.
    if (r.stray > 0 && !isRoom(r.g, here)) to = next(r, here, M.dir);
    else if (r.stray > 0) r.stray--;
    if (to < 0 && (r.rI >= r.rN || r.g.flags[r.rpath[r.rI]!]! & BLOCKED)) (r.rN = Math.max(0, r.g.path(here, r.cheese, r.rpath, 0, BLOCKED))), (r.rI = 0);
    if (to < 0 && r.rI < r.rN) {
      to = r.rpath[r.rI++]!;
      // At a fork it does not know the maze: now and then it stops to sniff the air, and now and then
      // it follows its nose down the wrong way (never straight back), finds the dead end and re-plans.
      if (isRoom(r.g, here) && exits(r, here) > 2) {
        const u = r.rand();
        if (u < 0.3) (M.wait = SNIFF), (r.ev |= EV_SNIFF);
        else if (u < 0.6) {
          const d = Math.floor(r.rand() * 4), w = next(r, here, d);
          if (w >= 0 && w !== to && d !== (M.dir ^ 1)) (to = w), (r.rN = r.rI = 0), (r.stray = 2);
        }
      }
    } else if (!isRoom(r.g, here)) to = next(r, here, M.dir);
  } else if (r.want >= 0) {
    // The way you hold, or on along the way you were going until it opens.
    to = next(r, here, r.want);
    if (to < 0 && M.moved) to = next(r, here, M.dir);
  }
  M.moved = to >= 0;
  if (to < 0) {
    M.to = here;
    M.prog = 0;
    return;
  }
  const dc = (to % r.g.cols) - (here % r.g.cols);
  M.dir = dc > 0 ? 0 : dc < 0 ? 1 : to > here ? 2 : 3;
  M.to = to;
  M.prog = 0;
}

/** Run the race for dt seconds. Returns true while anything moves. */
export function step(r: Race, dt: number) {
  if (r.state !== RACING) return false;
  r.t += dt;
  // The doors swap: the open one shuts, the shut one opens. A mouse in the shutting doorway is bonked
  // back to the room it came from.
  r.swapT += dt;
  if (r.swapT >= SWAP) {
    r.swapT -= SWAP;
    const shut = r.doors[r.open]!, opened = r.doors[1 - r.open]!;
    r.open = 1 - r.open;
    door(r.g, opened, true);
    door(r.g, shut, false);
    r.ev |= EV_SWAP;
    for (let k = 0; k < 2; k++) {
      const M = r.mice[k]!;
      if (M.to === shut && M.at !== shut) {
        const a = M.at;
        M.at = shut;
        M.to = a;
        M.prog = 1 - M.prog;
        M.dir ^= 1;
        M.bonk = 0.6;
        r.ev |= k ? EV_BONK1 : EV_BONK0;
        if (k === YOU) r.pathN = r.pathI = 0;
        else r.rN = r.rI = 0;
      }
    }
  }
  for (let k = 0; k < 2 && r.state === RACING; k++) {
    const M = r.mice[k]!;
    if (M.bonk > 0) M.bonk = Math.max(0, M.bonk - dt);
    if (M.wait > 0) {
      M.wait = Math.max(0, M.wait - dt);
      continue;
    }
    let left = dt * (k === YOU ? SPEED : RIVAL) * (M.bonk > 0.3 ? 0.4 : 1);
    for (let guard = 0; guard < 8 && left > 0 && r.state === RACING; guard++) {
      if (M.to === M.at) {
        choose(r, k);
        if (M.to === M.at || M.wait > 0) break;
      }
      const a = M.at, b = M.to, len = M.dir < 2 ? (span(a % r.g.cols) + span(b % r.g.cols)) / 2 : (span((a / r.g.cols) | 0) + span((b / r.g.cols) | 0)) / 2;
      const need = (1 - M.prog) * len;
      if (left < need) {
        M.prog += left / len;
        left = 0;
      } else {
        left -= need;
        M.at = b;
        M.prog = 0;
        choose(r, k);
      }
    }
  }
  return true;
}

/** Mouse k's world point (x, z) into out. */
export function where(r: Race, k: number, out: Float64Array, o = 0) {
  const M = r.mice[k]!, g = r.g, ac = M.at % g.cols, ar = (M.at / g.cols) | 0, bc = M.to % g.cols, br = (M.to / g.cols) | 0;
  out[o] = pos(ac, CW) + (pos(bc, CW) - pos(ac, CW)) * M.prog;
  out[o + 1] = pos(ar, CH) + (pos(br, CH) - pos(ar, CH)) * M.prog;
}
/** The room nearest a world point (x, z). */
export function roomAt(r: Race, x: number, z: number) {
  const s = RS + WT, c = Math.max(0, Math.min(CW - 1, Math.floor((x + (CW * s + WT) / 2 - WT / 2) / s))), w = Math.max(0, Math.min(CH - 1, Math.floor((z + (CH * s + WT) / 2 - WT / 2) / s)));
  return room(r.g, c, w);
}
