// Leftover Stack's fridge (site/gallery/pieces/fridge/leftover-stack.ts): pure numbers, no DOM,
// seeded. The fridge has three shelves, each a grid of cells: COLS across, DEPTH front to back, and
// CLEAR[s] levels of headroom. The night's leftovers come off the counter one at a time (a seeded
// run of RUN_N, checked at build time so the autopilot can pack every one of them). The next item
// has a footprint (w across, d deep) and a height (h levels); R turns it (w and d swap). You pick
// the shelf and the column; it slides as far back as it can and rests on what is under it: the
// lowest spot first, then the back-most. If it only goes in sticking out past the door line (a
// deep dish, or the back row taken), it goes in sticking out: the door bumps it, and on the third
// bump the door won't close. A shelf whose every cell is covered is full (a bonus). Pack the whole
// run and the door shuts: the finish bonus, and with no bumps the perfect pack.
// tests/leftover-stack.test.mjs plays it headless (fits, overlap, support, scoring, the bumps, the
// end, and zero allocation).
import { seeded } from "../../../../src/kernel/random";

/** The grid: columns, rows deep, shelves; each shelf's headroom (levels, bottom shelf first). */
export const COLS = 6, DEPTH = 2, NS = 3, CLEAR = [3, 2, 2];
/** The run: how many leftovers a night, and the least volume they fill (of 84 cells). */
export const RUN_N = 17, FILL = 56;
/** The leftovers: footprint across, deep, height (levels). Kind ids index KIND_W/D/H and NAMES. */
export const KIND_W = [2, 2, 1, 3, 1, 3, 1, 2], KIND_D = [1, 2, 1, 2, 1, 1, 1, 2], KIND_H = [1, 1, 2, 1, 1, 1, 2, 2];
export const NAMES = ["pie half", "stuffing tray", "gravy jar", "foil turkey", "cranberry tub", "casserole", "stack of rolls", "mashed potatoes"];
export const PIE = 0, TRAY = 1, JAR = 2, TURKEY = 3, TUB = 4, CASS = 5, ROLLS = 6, MASH = 7;
export const IDLE = 0, PLAY = 1, OVER = 2, PACKED = 3;
/** Why it ended: the door (three bumps) or no room for the next one. */
export const WHY_DOOR = 1, WHY_ROOM = 2;
/** Events this call. */
export const EV_START = 0, EV_DROP = 1, EV_BUMP = 2, EV_FULL = 3, EV_REFUSE = 4, EV_OVER = 5, EV_PACKED = 6, EV_TURN = 7, EV_MOVE = 8;
/** Points: per cell of volume packed, a full shelf, the packed fridge, the perfect pack. */
export const PER_CELL = 10, FULL_PTS = 150, PACK_PTS = 200, PERFECT_PTS = 500;
export const NCELL = NS * COLS * DEPTH;
const cell = (s: number, c: number, z: number) => (s * COLS + c) * DEPTH + z;

export type Fridge = ReturnType<typeof fridge>;

/** One night's fridge. */
export function fridge(seed: number) {
  // State: mode, why it ended, the item index, its kind, turned, shelf, column, bumps, score, full
  // shelves (bits), the seed in play.
  const S = new Float64Array(12);
  const MODE = 0, WHY = 1, IDX = 2, KIND = 3, ROT = 4, SH = 5, COL = 6, BUMPS = 7, SCORE = 8, FULL = 9, SEED = 10;
  /** The run's kinds. */
  const SEQ = new Uint8Array(RUN_N);
  /** Cell heights (levels filled) and the item on top of each cell (−1: none). */
  const H = new Uint8Array(NCELL), TOP = new Int16Array(NCELL).fill(-1);
  /** Placed items: kind, turned, shelf, column, z (back row 0), rest (levels), how far it sticks out, the item it rests on (−1: the shelf). */
  const PK = new Uint8Array(RUN_N), PR = new Uint8Array(RUN_N), PS = new Uint8Array(RUN_N), PC = new Uint8Array(RUN_N), PZ = new Uint8Array(RUN_N), PY = new Uint8Array(RUN_N), PO = new Uint8Array(RUN_N), PU = new Int16Array(RUN_N);
  /** The last fit: ok, z, rest, sticks out. */
  const F = new Int16Array(4);
  const ev = new Uint8Array(9);

  const w = (k: number, r: number) => (r ? KIND_D[k]! : KIND_W[k]!), d = (k: number, r: number) => (r ? KIND_W[k]! : KIND_D[k]!);

  /** Where kind k (turned r) goes on shelf s at column c: F = [ok, z, rest, sticks out]. */
  function fit(k: number, r: number, s: number, c: number) {
    const iw = w(k, r), id = d(k, r), ih = KIND_H[k]!;
    F[0] = 0;
    if (c < 0 || c + iw > COLS) return false;
    // In: every z that keeps it inside the door line; the lowest rest, then the back-most.
    let best = 99, bz = -1;
    for (let z0 = 0; z0 + id <= DEPTH; z0++) {
      const rest = restAt(s, c, iw, z0, id);
      if (rest + ih <= CLEAR[s]! && rest < best) (best = rest), (bz = z0);
    }
    if (bz >= 0) return (F[0] = 1), (F[1] = bz), (F[2] = best), (F[3] = 0), true;
    // Out: pushed as far back as it goes, one row past the door line.
    const z0 = Math.max(0, DEPTH - id + 1);
    if (z0 >= DEPTH) return false;
    const rest = restAt(s, c, iw, z0, id);
    if (rest + ih > CLEAR[s]!) return false;
    return (F[0] = 1), (F[1] = z0), (F[2] = rest), (F[3] = z0 + id - DEPTH), true;
  }
  function restAt(s: number, c: number, iw: number, z0: number, id: number) {
    let rest = 0;
    for (let x = c; x < c + iw; x++) for (let z = z0; z < Math.min(DEPTH, z0 + id); z++) rest = Math.max(rest, H[cell(s, x, z)]!);
    return rest;
  }
  /** Any place at all for kind k (either way round, sticking out or not). */
  function room(k: number) {
    for (let s = 0; s < NS; s++) for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) if (fit(k, r, s, c)) return true;
    return false;
  }
  const full = (s: number) => {
    for (let i = s * COLS * DEPTH; i < (s + 1) * COLS * DEPTH; i++) if (!H[i]) return false;
    return true;
  };

  function clearBoard() {
    H.fill(0);
    TOP.fill(-1);
    PU.fill(-1);
    S[IDX] = S[BUMPS] = S[SCORE] = S[FULL] = S[WHY] = S[ROT] = 0;
    S[SH] = 0;
    S[COL] = 2;
    S[KIND] = SEQ[0]!;
  }
  /** The night's run: a seeded draw (one turkey and one bowl of mash at most), re-drawn until the
   *  autopilot packs all of it with no bumps, so every night can be won. */
  function draw(s: number, tries: number) {
    const R = seeded(s * 31 + tries * 977 + 7);
    let turkey = 0, mash = 0, vol = 0;
    for (let i = 0; i < RUN_N; i++) {
      let k = (R() * 8) | 0;
      if ((k === TURKEY && turkey) || (k === MASH && mash)) k = (R() * 3) | 0 ? TUB : PIE;
      if (k === TURKEY) turkey = 1;
      if (k === MASH) mash = 1;
      SEQ[i] = k;
    }
    // The first one off the counter is always a big one: the turkey, the tray or the mash.
    if (SEQ[0] !== TURKEY && SEQ[0] !== TRAY && SEQ[0] !== MASH) SEQ[0] = turkey ? TRAY : TURKEY;
    for (let i = 0; i < RUN_N; i++) vol += KIND_W[SEQ[i]!]! * KIND_D[SEQ[i]!]! * KIND_H[SEQ[i]!]!;
    return vol;
  }
  /** Can the autopilot pack the drawn run with no bumps? */
  function packs() {
    clearBoard();
    S[MODE] = PLAY;
    for (let i = 0; i < RUN_N && S[MODE] === PLAY; i++) autopilot(api), drop();
    return S[MODE] === PACKED && !S[BUMPS];
  }
  /** The night's run: a seeded draw (one turkey and one bowl of mash at most), re-drawn until it
   *  fills at least FILL cells and the autopilot packs all of it with no bumps, so every night is
   *  tight and can be won (else the fullest draw that packs). */
  function course(s: number) {
    S[SEED] = s;
    let best = -1, bestVol = -1;
    for (let tries = 0; tries < 80; tries++) {
      const vol = draw(s, tries);
      if (vol <= bestVol || !packs()) continue;
      (best = tries), (bestVol = vol);
      if (vol >= FILL) break;
    }
    draw(s, best < 0 ? 0 : best);
    reset();
  }
  function reset() {
    clearBoard();
    S[MODE] = IDLE;
    ev.fill(0);
  }
  function start() {
    ev.fill(0);
    if (S[MODE] === PLAY) return false;
    clearBoard();
    S[MODE] = PLAY;
    ev[EV_START] = 1;
    return true;
  }
  /** Move the next item: dc columns, ds shelves (it keeps inside the fridge). */
  function move(dc: number, ds: number) {
    ev.fill(0);
    if (S[MODE] !== PLAY) return false;
    const k = S[KIND]!, iw = w(k, S[ROT]!), c = Math.max(0, Math.min(COLS - iw, S[COL]! + dc)), s = Math.max(0, Math.min(NS - 1, S[SH]! + ds));
    if (c === S[COL] && s === S[SH]) return false;
    (S[COL] = c), (S[SH] = s), (ev[EV_MOVE] = 1);
    return true;
  }
  /** Put it at shelf s, column c (a pointer). */
  function moveTo(s: number, c: number) {
    return move(c - S[COL]!, s - S[SH]!) || false;
  }
  /** Turn it a quarter (w and d swap); it keeps inside the fridge. */
  function turn() {
    ev.fill(0);
    if (S[MODE] !== PLAY) return false;
    const k = S[KIND]!;
    if (KIND_W[k] === KIND_D[k]) return false;
    S[ROT] = 1 - S[ROT]!;
    S[COL] = Math.max(0, Math.min(COLS - w(k, S[ROT]!), S[COL]!));
    ev[EV_TURN] = 1;
    return true;
  }
  /** Drop it where it is. */
  function drop() {
    ev.fill(0);
    if (S[MODE] !== PLAY) return false;
    const i = S[IDX]!, k = S[KIND]!, r = S[ROT]!, s = S[SH]!, c = S[COL]!;
    if (!fit(k, r, s, c)) return (ev[EV_REFUSE] = 1), false;
    const z0 = F[1]!, rest = F[2]!, out = F[3]!, iw = w(k, r), id = d(k, r), top = rest + KIND_H[k]!;
    (PK[i] = k), (PR[i] = r), (PS[i] = s), (PC[i] = c), (PZ[i] = z0), (PY[i] = rest), (PO[i] = out), (PU[i] = -1);
    for (let x = c; x < c + iw; x++)
      for (let z = z0; z < Math.min(DEPTH, z0 + id); z++) {
        const q = cell(s, x, z);
        if (rest && H[q] === rest && PU[i] < 0) PU[i] = TOP[q]!;
        (H[q] = top), (TOP[q] = i);
      }
    S[SCORE] = S[SCORE]! + PER_CELL * iw * id * KIND_H[k]!;
    ev[EV_DROP] = 1;
    if (out) (S[BUMPS] = S[BUMPS]! + 1), (ev[EV_BUMP] = 1);
    if (!((S[FULL]! >> s) & 1) && full(s)) (S[FULL] = S[FULL]! | (1 << s)), (S[SCORE] = S[SCORE]! + FULL_PTS), (ev[EV_FULL] = 1);
    S[IDX] = i + 1;
    if (S[BUMPS]! >= 3) return (S[MODE] = OVER), (S[WHY] = WHY_DOOR), (ev[EV_OVER] = 1), true;
    if (i + 1 >= RUN_N) {
      S[MODE] = PACKED;
      S[SCORE] = S[SCORE]! + PACK_PTS + (S[BUMPS] ? 0 : PERFECT_PTS);
      ev[EV_PACKED] = 1;
      return true;
    }
    const nk = SEQ[i + 1]!;
    (S[KIND] = nk), (S[ROT] = 0);
    S[COL] = Math.max(0, Math.min(COLS - KIND_W[nk]!, S[COL]!));
    if (!room(nk)) (S[MODE] = OVER), (S[WHY] = WHY_ROOM), (ev[EV_OVER] = 1);
    return true;
  }
  const api = { S, SEQ, H, TOP, PK, PR, PS, PC, PZ, PY, PO, PU, F, ev, fit, room, full, course, reset, start, move, moveTo, turn, drop, w, d };
  course(seed);
  return api;
}

/** The autopilot (the build-time check, the poster and the tests): the placement that leaves the
 *  fewest gaps under it, low and back, never sticking out if anything else fits. Sets the shelf,
 *  column and turn; the caller drops. */
export function autopilot(f: { S: Float64Array; H: Uint8Array; F: Int16Array; fit: (k: number, r: number, s: number, c: number) => boolean; w: (k: number, r: number) => number; d: (k: number, r: number) => number }) {
  const S = f.S, k = S[3]!;
  let best = Infinity, bs = 0, bc = 0, br = 0;
  for (let s = 0; s < NS; s++)
    for (let r = 0; r < 2; r++) {
      if (r && KIND_W[k] === KIND_D[k]) continue;
      for (let c = 0; c < COLS; c++) {
        if (!f.fit(k, r, s, c)) continue;
        const z0 = f.F[1]!, rest = f.F[2]!, out = f.F[3]!, iw = f.w(k, r), id = f.d(k, r);
        let holes = 0;
        for (let x = c; x < c + iw; x++) for (let z = z0; z < Math.min(DEPTH, z0 + id); z++) holes += rest - f.H[(s * COLS + x) * DEPTH + z]!;
        // Headroom left over a tall item is fine; a one-level sliver over a short one wastes a row.
        const cost = out * 1000 + holes * 12 + rest * 2 + s * 0.6 + z0 * 0.2 + c * 0.01 + r * 0.001;
        if (cost < best) (best = cost), (bs = s), (bc = c), (br = r);
      }
    }
  (S[5] = bs), (S[6] = bc), (S[4] = br);
}
