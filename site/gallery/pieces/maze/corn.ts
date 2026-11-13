// Corn Maze's model (site/gallery/pieces/maze/corn-maze.ts draws it): a corn field cut into a maze at
// dusk, a scarecrow in the middle. Pure: a @fzlt/core/grid board carved by ./carve.ts (a perfect maze,
// so the scarecrow and every room can be reached, plus a couple of loops), the scarecrow in the dead
// end nearest the middle, pumpkins off the shortest way (dead ends first),
// lanterns at the forks (they light as you pass, so they mark where you have been), crows on the
// corn that scatter when you come close and settle somewhere else later. You walk room to room (a
// direction you hold, or a room you tap, A* on the board) while the light runs out; find the
// scarecrow before it is dark. `step` allocates nothing (tests/corn-maze.test.mjs).
import { board, BLOCKED, type Board } from "../../../../src/grid";
import { seeded } from "../../../../src/kernel/index";
import { carve, isRoom, room, type Maze } from "./carve";

/** Rooms across and down, the world size of a grid cell (corridors and corn rows alike). */
export const CW = 7, CH = 7, CELL = 1.5;
/** Walking speed (world units / s), the light at the start (s), pumpkins and lanterns at most,
 *  crows, how near (cells) scares a crow, how long one stays away (s). */
export const SPEED = 3.6, LIGHT = 90, PUMPKINS = 4, LANTERNS = 7, CROWS = 5, SCARE = 2.3, AWAY = 7;
export const READY = 0, WALKING = 1, FOUND = 2, DARK = 3;
/** Events since the reader last looked (bits): 1 a pumpkin, 2 a lantern lit, 4 crows scattered,
 *  8 a crow landed, 16 found, 32 dark. `evI` holds the last pumpkin's, lantern's or crow's index. */
export const EV_PUMPKIN = 1, EV_LANTERN = 2, EV_CROW = 4, EV_LAND = 8, EV_FOUND = 16, EV_DARK = 32;
const DC = [1, -1, 0, 0], DR = [0, 0, 1, -1];

export type Field = {
  g: Board; maze: Maze; seed: number; start: number; crow0: number; scare: number;
  /** Pumpkins: cells, taken. Lanterns: cells, lit. */
  pumpkin: Int32Array; nP: number; got: Uint8Array; taken: number;
  lantern: Int32Array; nL: number; lit: Uint8Array;
  /** Crows: perch cell, state (0 perched, 1 flying off, 2 away), timer, the way it flew (radians). */
  crow: Int32Array; crowS: Uint8Array; crowT: Float64Array; crowA: Float64Array;
  /** You: the cell you are leaving, the cell you are entering, how far, heading, a held way, a path. */
  at: number; to: number; prog: number; dir: number; want: number; moved: boolean;
  path: Int32Array; pathN: number; pathI: number;
  light: number; state: number; t: number; ev: number; evI: number;
  rand: () => number;
};

export function newField(): Field {
  const g = board(2 * CW + 1, 2 * CH + 1, { cell: CELL }), n = g.cols * g.rows;
  return {
    g, maze: { cw: CW, ch: CH, loops: new Int32Array(1), nLoops: 0 }, seed: 0, start: 0, crow0: 0, scare: 0,
    pumpkin: new Int32Array(PUMPKINS), nP: 0, got: new Uint8Array(PUMPKINS), taken: 0,
    lantern: new Int32Array(LANTERNS), nL: 0, lit: new Uint8Array(LANTERNS),
    crow: new Int32Array(CROWS), crowS: new Uint8Array(CROWS), crowT: new Float64Array(CROWS), crowA: new Float64Array(CROWS),
    at: 0, to: 0, prog: 0, dir: 3, want: -1, moved: false, path: new Int32Array(n), pathN: 0, pathI: 0,
    light: LIGHT, state: READY, t: 0, ev: 0, evI: 0, rand: seeded(1),
  };
}

/** Open ways out of cell i (a count). */
export function exits(f: Field, i: number) {
  let k = 0;
  for (let d = 0; d < 4; d++) if (next(f, i, d) >= 0) k++;
  return k;
}
/** The cell one step from i in direction d (0 +x, 1 −x, 2 +z, 3 −z), or −1 off the board or into corn. */
export function next(f: Field, i: number, d: number) {
  const g = f.g, c = (i % g.cols) + DC[d]!, w = ((i / g.cols) | 0) + DR[d]!;
  if (c < 0 || w < 0 || c >= g.cols || w >= g.rows) return -1;
  const j = w * g.cols + c;
  return g.flags[j]! & BLOCKED ? -1 : j;
}

/** A corn cell next to a path (a crow can sit there and be seen), not too near the start, or −1. */
function perch(f: Field, avoid: number) {
  const g = f.g;
  for (let tries = 0; tries < 60; tries++) {
    const i = Math.floor(f.rand() * g.cols * g.rows), c = i % g.cols, r = (i / g.cols) | 0;
    if (!(g.flags[i]! & BLOCKED) || c === 0 || r === 0 || c === g.cols - 1 || r === g.rows - 1) continue;
    let open = 0;
    for (let d = 0; d < 4; d++) if (next(f, i, d) >= 0) open++;
    const ac = avoid % g.cols, ar = (avoid / g.cols) | 0;
    if (open && Math.abs(c - ac) + Math.abs(r - ar) > 4 && i !== f.crow[0] && i !== f.crow[1] && i !== f.crow[2] && i !== f.crow[3] && i !== f.crow[4]) return i;
  }
  return -1;
}

/** Field `seed`: carve it, the scarecrow in the middle, you at the gate on the near side, pumpkins in
 *  dead ends (the farthest from the gate first), lanterns at forks, crows on the corn. */
export function load(seed: number, f: Field = newField()) {
  f.seed = seed;
  f.rand = seeded((seed * 2654435761) >>> 0 || 1);
  const g = f.g;
  f.maze = carve(g, CW, CH, f.rand, 2);
  f.start = room(g, CW >> 1, CH - 1);
  // The scarecrow stands in the dead end nearest the middle (a dead end: you never walk through him
  // on the way to somewhere else).
  f.scare = room(g, CW >> 1, CH >> 1);
  let near = 1e9;
  for (let c = 0; c < CW; c++)
    for (let r = 0; r < CH; r++) {
      const i = room(g, c, r), d = Math.abs(c - (CW >> 1)) + Math.abs(r - (CH >> 1)) + (r > CH >> 1 ? 0.5 : 0);
      if (i !== f.start && exits(f, i) === 1 && d < near) (near = d), (f.scare = i);
    }
  // Dead ends and forks; the shortest way to the scarecrow (pumpkins are off it: each one a detour).
  f.nP = f.nL = 0;
  const buf = f.path, n = g.cols * g.rows, on = new Uint8Array(n), score = new Float64Array(n);
  const sn = g.path(f.start, f.scare, buf, 0, BLOCKED);
  for (let k = 0; k < sn; k++) on[buf[k]!] = 1;
  for (let i = 0; i < n; i++) {
    score[i] = -1;
    if (!isRoom(g, i) || i === f.start || i === f.scare) continue;
    const e = exits(f, i);
    if (e >= 3 && f.nL < LANTERNS) f.lantern[f.nL++] = i;
    // Dead ends first, then the farthest rooms from the gate.
    else if (!on[i]) score[i] = (e === 1 ? 100 : 0) + g.path(f.start, i, buf, 0, BLOCKED) + f.rand();
  }
  // The best rooms get the pumpkins, never two side by side.
  for (let k = 0; k < PUMPKINS; k++) {
    let b = -1;
    for (let i = 0; i < n; i++) if (score[i]! >= 0 && (b < 0 || score[i]! > score[b]!)) b = i;
    if (b < 0) break;
    f.pumpkin[f.nP++] = b;
    score[b] = -1;
    for (let d = 0; d < 4; d++) for (let s = 1; s <= 2; s++) {
      const j = b + (d === 0 ? s : d === 1 ? -s : d === 2 ? s * g.cols : -s * g.cols);
      if (j >= 0 && j < n) score[j] = -1;
    }
  }
  f.got.fill(0);
  f.lit.fill(0);
  f.taken = 0;
  f.crow.fill(-1);
  for (let k = 0; k < CROWS; k++) (f.crow[k] = perch(f, f.start)), (f.crowS[k] = 0), (f.crowT[k] = 0), (f.crowA[k] = 0);
  f.at = f.to = f.start;
  f.prog = 0;
  f.dir = 3;
  f.want = -1;
  f.moved = false;
  f.pathN = f.pathI = 0;
  f.light = LIGHT;
  f.state = READY;
  f.t = 0;
  f.ev = 0;
  return f;
}

/** Head for room `to`: your path, by A*. False if there is none. */
export function tapTo(f: Field, to: number) {
  if (!isRoom(f.g, to) || f.state > WALKING) return false;
  const from = f.prog > 0 ? f.to : f.at, n = f.g.path(from, to, f.path, 0, BLOCKED);
  if (n <= 0) return false;
  (f.pathN = n), (f.pathI = 0), (f.want = -1);
  return true;
}
/** Hold a way (−1 lets go). */
export function hold(f: Field, d: number) {
  f.want = d;
  if (d >= 0) f.pathN = f.pathI = 0;
}
export function go(f: Field) {
  if (f.state === READY) f.state = WALKING;
}

/** At a cell's centre: what is here, then the next cell. */
function arrive(f: Field) {
  const here = f.at;
  for (let k = 0; k < f.nP; k++) if (!f.got[k] && f.pumpkin[k] === here) (f.got[k] = 1), f.taken++, (f.ev |= EV_PUMPKIN), (f.evI = k);
  for (let k = 0; k < f.nL; k++) if (!f.lit[k] && f.lantern[k] === here) (f.lit[k] = 1), (f.ev |= EV_LANTERN), (f.evI = k);
  if (here === f.scare) {
    f.state = FOUND;
    f.ev |= EV_FOUND;
    f.to = here;
    return;
  }
  let to = -1;
  if (f.pathI < f.pathN) to = f.path[f.pathI++]!;
  else if (!isRoom(f.g, here) && f.moved) to = next(f, here, f.dir); // between rooms: keep going
  else if (f.want >= 0) {
    to = next(f, here, f.want);
    if (to < 0 && f.moved) to = next(f, here, f.dir);
  }
  f.moved = to >= 0;
  if (to < 0) {
    f.to = here;
    f.prog = 0;
    return;
  }
  const dc = (to % f.g.cols) - (here % f.g.cols);
  f.dir = dc > 0 ? 0 : dc < 0 ? 1 : to > here ? 2 : 3;
  f.to = to;
  f.prog = 0;
}

/** Your world point (x, z) into out (the board's origin at the field's corner). */
export function where(f: Field, out: Float64Array, o = 0) {
  const g = f.g, ac = f.at % g.cols, ar = (f.at / g.cols) | 0, bc = f.to % g.cols, br = (f.to / g.cols) | 0;
  out[o] = (ac + 0.5 + (bc - ac) * f.prog) * CELL;
  out[o + 1] = (ar + 0.5 + (br - ar) * f.prog) * CELL;
}

/** Run the walk for dt seconds. Returns true while anything moves. */
export function step(f: Field, dt: number) {
  let moving = false;
  // Crows: scared off when you come near; back on another stalk a while later.
  const g = f.g, pc = (f.at % g.cols) + ((f.to % g.cols) - (f.at % g.cols)) * f.prog, pr = ((f.at / g.cols) | 0) + (((f.to / g.cols) | 0) - ((f.at / g.cols) | 0)) * f.prog;
  for (let k = 0; k < CROWS; k++) {
    const s = f.crowS[k]!, c = f.crow[k]!;
    if (c < 0) continue;
    if (s === 0) {
      const dc = (c % g.cols) - pc, dr = ((c / g.cols) | 0) - pr;
      if (f.state === WALKING && dc * dc + dr * dr < SCARE * SCARE) (f.crowS[k] = 1), (f.crowT[k] = 0), (f.crowA[k] = Math.atan2(dr, dc) + (f.rand() - 0.5)), (f.ev |= EV_CROW), (f.evI = k);
    } else {
      f.crowT[k] = f.crowT[k]! + dt;
      if (s === 1) moving = true; // away: it waits for you to walk on
      if (s === 1 && f.crowT[k]! > 1.4) f.crowS[k] = 2;
      if (s === 2 && f.crowT[k]! > AWAY && f.state === WALKING) {
        const p = perch(f, f.at);
        if (p >= 0) (f.crow[k] = p), (f.crowS[k] = 0), (f.ev |= EV_LAND), (f.evI = k);
      }
    }
  }
  if (f.state !== WALKING) return moving;
  f.t += dt;
  f.light = Math.max(0, f.light - dt);
  if (f.light <= 0) {
    f.state = DARK;
    f.ev |= EV_DARK;
    return true;
  }
  let left = dt * SPEED;
  for (let guard = 0; guard < 8 && left > 0 && f.state === WALKING; guard++) {
    if (f.to === f.at) {
      arrive(f);
      if (f.to === f.at) break;
    }
    const need = (1 - f.prog) * CELL;
    if (left < need) (f.prog += left / CELL), (left = 0);
    else (left -= need), (f.at = f.to), (f.prog = 0), arrive(f);
  }
  return true;
}
