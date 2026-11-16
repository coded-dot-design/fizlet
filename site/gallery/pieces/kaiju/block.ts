// DOM Kaiju's city block and round, headless (tests/dom-kaiju.test.mjs plays it with no browser).
// One block on a table, seen side-on: five buildings of different heights along the back of a street,
// with gaps between them. The monster walks the street, jumps at a building's side wall (a jump at a
// wall grabs it) and climbs it, hanging on the side. Hanging there, it punches the face right next to
// it: left or right by where it faces (a hole in the nearest window of that floor, then the next one
// in: it eats into the building from the side), up or down with the stick (the floor above or below).
// Enough holes and the building shakes, then pancakes floor by floor and the monster drops off. Some
// parts are live (power boxes and neon signs on the edge windows, antennas on the roofs): punching or
// grabbing one shocks the monster: a little health, it lets go and drops. People wave and panic at the
// windows; GRAB pulls the one next to it out and eats it (health back, a "nom"); some windows hold a
// sniper instead. Soldiers walk in and throw pebbles, a tank rolls in and fires shells, a helicopter
// circles and fires; punches knock the helicopter out of the air and blow up the tank. The round ends
// when the block is flat or the monster's health is out.
// Two parts here are brick candidates: the destructible building (a grid of cells per face, holes
// eaten in from the sides, live cells, a collapse threshold, a shake, then a floor-by-floor pancake
// with continuous heights) and the wall climber (walk, a jump that grabs a wall, hang and climb a side,
// the roof, a wall jump across a gap, drop-off).
// Deterministic (one seeded random, fixed inputs → the same round) and zero allocation per step.
import { seeded } from "../../../../src/kernel/random";

export const READY = 0, RUN = 1, DONE = 2;
/** Monster modes. */
export const WALK = 0, AIR = 1, CLIMB = 2, ROOF = 3, KO = 4;
/** Events (one ring, read and cleared each step): what, and a value. */
export const E_START = 1, E_PUNCH = 2, E_HOLE = 3, E_SHAKE = 4, E_FLOOR = 5, E_FLAT = 6, E_HELI = 7, E_HELI_CRASH = 8, E_NOM = 9,
  E_HURT = 10, E_FLING = 11, E_DROP = 12, E_KO = 13, E_END = 14, E_WHIFF = 15, E_SHOT = 16, E_STOMP = 17, E_JUMP = 18, E_LAND = 19, E_CLIMB = 20,
  E_SHOCK = 21, E_TANK = 22, E_BONK = 23, E_OUT = 24, E_BURN = 25, E_JOIN = 26, E_CHIP = 27, E_CRACK = 28;
/** The monsters: the hero (an ape, player one), and two rivals (a crystal crab-beast, a tentacle blob), each the AI or player two. */
export const NM = 3, MW = 36, HERO = 0, CRAB = 1, BLOB = 2;
/** Who drives a monster. */
export const P1 = 0, P2 = 1, AI = 2;
/** A monster in play, waiting to come in, or out (knocked out, run off). */
export const OUT = 0, IN = 1, WAIT = 2;

/** The monster's scale: about four floors tall (./monster.ts draws it at this size). */
export const MK = 1.3;
/** The street: x from −SX to SX; z of the street walk, of a side wall being climbed (in the gap), of a roof. */
export const SX = 17, ZS = 1.9, ZW = -1.3, ZR = -1.45, DEPTH = 3, STREET0 = 0.9, STREET1 = 5.6;
/** The buildings: left x, columns (one unit each), floors (one unit each), look. Gaps of 2.6 between. */
export const BLD = [
  -15.2, 4, 5, 0,
  -8.6, 5, 8, 1,
  -1.0, 3, 4, 2,
  4.6, 4, 7, 3,
  11.2, 4, 6, 4,
];
export const NB = BLD.length / 4;
/** Each building's first cell, and the total. A cell is floor × columns + column, on the front face. */
export const C0 = new Int32Array(NB + 1);
for (let b = 0; b < NB; b++) C0[b + 1] = C0[b]! + BLD[b * 4 + 1]! * BLD[b * 4 + 2]!;
export const NC = C0[NB]!;
export const TOTAL_FLOORS = BLD.reduce((a, v, i) => (i % 4 === 2 ? a + v : a), 0);
/** Live parts on the edge windows: building, floor, column, kind (0 a power box, 1 a neon sign). */
export const LIVE = [0, 2, 3, 0, 1, 5, 0, 1, 1, 2, 4, 0, 2, 2, 0, 0, 3, 4, 3, 1, 4, 3, 0, 0];
/** Per cell: 1 when live. */
export const LIVE_CELL = new Uint8Array(NC);
for (let k = 0; k < LIVE.length; k += 4) LIVE_CELL[C0[LIVE[k]!]! + LIVE[k + 1]! * BLD[LIVE[k]! * 4 + 1]! + LIVE[k + 2]!] = 1;
/** A live antenna on the roof (its x), or NaN: the odd looks have one. */
export const ANT = new Float64Array(NB);
for (let b = 0; b < NB; b++) ANT[b] = BLD[b * 4 + 3]! % 2 ? BLD[b * 4]! + BLD[b * 4 + 1]! - 0.8 : NaN;
/** Holes it takes to bring a building down. */
export const NEED = new Int32Array(NB);
for (let b = 0; b < NB; b++) NEED[b] = Math.max(4, Math.ceil(BLD[b * 4 + 1]! * BLD[b * 4 + 2]! * 0.26));
/** Cells: 2 intact, 1 cracked, 0 a hole. Occupants: 0 none, 1 a person, 2 a sniper, 3 something hot (a steaming pot: it burns). */
export const INTACT = 2, CRACKED = 1, HOLE = 0;
/** Building states. */
export const STAND = 0, SHAKE = 1, FALL = 2, RUBBLE = 3;
export const MAX_HP = 100, SHAKE_T = 1.0, FLOOR_T = 0.3, DROP_T = 0.22, SHOCK_HP = 7;
/** Pools: soldiers, pebbles and shells, parachutes. */
export const NS = 6, NP = 40, NCH = 18;
/** Hanging on a side: the monster's x from the wall, its hand over its feet, how far under the roof its feet stop. */
export const WALLX = 1.0, HAND = 1.9, CLIMB_TOP = 1.6;
/** The punch, arcade style: always the same timing (a wind-up, the hit on a fixed frame, a recovery), one per
 *  press, a steady rhythm while held; a window takes a fixed number of hits: a crack, then a hole. */
export const PUNCH_CD = 0.24, PUNCH_HIT = 0.08, HITS_CRACK = 2, HITS_HOLE = 3;
const G = 26, GRAB_CD = 0.4;

/** A round on the block. `step(dt, mx, my, punch, jump, grab)`: mx, my −1..1 (my up), the keys 1 on the press. */
export function blockRun(seed = 20261115, rivals = 2) {
  const rnd = seeded(seed);
  /** [0] phase, [1] time, [2] score, [3] holes, [4] buildings flat, [5] helicopters down, [6] snacks, [7] soldiers flung, [8] floors down,
   *  [9] end delay, [10] best, [11] tanks, [12] shocks, [13] last hole (cell), [14] last punch direction (0 side, 1 up, −1 down). */
  const S = new Float64Array(16);
  /** The monster: [0] x, [1] y, [2] z, [3] vx, [4] vy, [5] mode, [6] face, [7] hp, [8] punch cooldown, [9] punch anim, [10] grab anim,
   *  [11] hurt, [12] on building, [13] walk phase, [14] grab cooldown, [15] invulnerable, [16] fist x, [17] fist y, [18] mouth (nom),
   *  [19] land squash, [20] a punch pressed during the cooldown (it lands when the cooldown ends), [21] the same for a grab,
   *  [22] the side of the building it hangs on (−1 its left wall, 1 its right), [23] shock (flicker time left). */
  /** Per monster (MW numbers each) the fields above, then [24] in play (IN, WAIT, OUT), [25] its score, [26] its snacks, [27] its holes,
   *  [28] who drives it (P1, P2, AI), [29] knocked out (shrunk, running off), [30] the wait before it comes in, [31] its kind,
   *  [32] its last punch's direction (0 the window in front, 1 the one above, −1 the one below),
   *  [33] climbing up (> 0) or down (< 0) a moment ago, [34] the time to the punch's hit frame, [35] that punch's direction. */
  const MS = new Float64Array(NM * MW), MV: Float64Array[] = [];
  for (let k = 0; k < NM; k++) MV.push(MS.subarray(k * MW, k * MW + MW));
  let M = MV[0]!, cur = 0;
  const setCur = (k: number) => void ((cur = k), (M = MV[k]!));
  /** The last monster to punch each building (its floors and its fall score to it). */
  const LH = new Int8Array(NB);
  /** Hits each window has taken. */
  const HIT = new Uint8Array(NC);
  const cell = new Uint8Array(NC), occ = new Uint8Array(NC), ocT = new Float64Array(NC), crackT = new Float64Array(NC);
  /** Buildings: [state, holes, timer, floors removed, drop (1 → 0), shake] per building. */
  const B = new Float64Array(NB * 6);
  /** Soldiers: [alive, x, z, dir, state (0 walk, 1 aim), timer, want, step] per soldier. */
  const SO = new Float64Array(NS * 8);
  /** Pebbles and shells: [life, x, y, z, vx, vy, vz, kind (0 pebble, 1 helicopter, 2 tank shell)] each. */
  const PB = new Float64Array(NP * 8);
  /** Parachutes: [life, x, y, z, vx, vy, kind (1 person, 2 soldier), landed, t] per chute. */
  const CH = new Float64Array(NCH * 9);
  /** The helicopter: [0] state (0 away, 1 flying, 2 falling), x, y, z, vx, vy, [6] fire timer, [7] burst left, [8] away timer, [9] spin, [10] t, [11] tilt. */
  const HE = new Float64Array(12);
  /** The tank: [0] state (0 away, 1 rolling, 2 a wreck), [1] x, [2] dir, [3] fire timer, [4] away timer, [5] wreck timer, [6] recoil, [7] z, [8] tread phase. */
  const TK = new Float64Array(9);
  const ev = new Float64Array(64);
  /** Spawn timers: [0] soldiers, [1] new people at windows. */
  const T = new Float64Array(2);
  const IA = new Float64Array(5);
  /** The autopilot, per monster: [0] target building, [1] side, [2] jump cool, [3] side tries, [4] grab cool, [5] bonk cool. */
  const AS = new Float64Array(NM * 8), AV: Float64Array[] = [];
  for (let k = 0; k < NM; k++) AV.push(AS.subarray(k * 8, k * 8 + 8));
  let A = AV[0]!;
  const run = {
    S, M: MV[0]!, MV, cell, HIT, occ, B, SO, PB, CH, HE, TK, ev, n: 0, crackT, rivals,
    reset, step, clear, autopilot, top, yOff, standing, wallX, rowOf, sideTarget, join, setCur,
    /** Humans still in the round. */
    humans,
  };
  function pts(n: number) {
    S[2]! += n;
    M[25]! += n;
  }
  function humans() {
    let n = 0;
    for (let k = 0; k < NM; k++) if (MV[k]![28]! !== AI && MV[k]![24] === IN) n++;
    return n;
  }
  /** Player two takes the crab (true), or gives it back to the AI. */
  function join(on: boolean) {
    const C = MV[CRAB]!;
    C[28] = on ? P2 : AI;
    if (on && C[24] !== IN) (C[24] = WAIT), (C[30] = 0);
    emit(E_JOIN, on ? 1 : 0);
  }
  /** The nearest monster in play to x (the army aims at it), or 0. */
  function nearest(x: number) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[5] === KO) continue;
      const d = Math.abs(O[0]! - x);
      if (d < bd) (bd = d), (best = k);
    }
    return best;
  }

  function emit(t: number, v: number) {
    if (run.n < 32) (ev[run.n * 2] = t), (ev[run.n * 2 + 1] = v), run.n++;
  }
  function clear() {
    run.n = 0;
  }
  /** A building's roof height now (it sinks while it pancakes). */
  function top(b: number) {
    return BLD[b * 4 + 2]! - B[b * 6 + 3]! + B[b * 6 + 4]!;
  }
  /** World y of floor 0's bottom for building b (floors removed sink the rest). */
  function yOff(b: number) {
    return -B[b * 6 + 3]! + B[b * 6 + 4]!;
  }
  function standing(b: number) {
    return B[b * 6]! < FALL;
  }
  /** Where the monster hangs on building b's side s (−1 left, 1 right). */
  function wallX(b: number, s: number) {
    return s < 0 ? BLD[b * 4]! - WALLX : BLD[b * 4]! + BLD[b * 4 + 1]! + WALLX;
  }
  /** The floor of building b at world height y (clamped to the floors still up). */
  function rowOf(b: number, y: number) {
    return Math.max(B[b * 6 + 3]!, Math.min(BLD[b * 4 + 2]! - 1, Math.floor(y - yOff(b))));
  }

  function reset(s = seed) {
    rnd.state = s;
    S.fill(0);
    const keepP2 = MV[CRAB]![28] === P2;
    MS.fill(0);
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      O[0] = k === HERO ? -4.6 : k === CRAB ? SX + 1 : -SX - 1; O[2] = ZS; O[6] = k === CRAB ? -1 : 1; O[7] = MAX_HP; O[12] = -1; O[31] = k;
      O[28] = k === HERO ? P1 : k === CRAB && keepP2 ? P2 : AI;
      O[24] = k === HERO ? IN : k <= rivals || O[28] === P2 ? WAIT : OUT;
      O[30] = k === CRAB ? 1.5 : 16;
    }
    for (let k = 0; k < NM * 8; k++) AS[k] = 0;
    for (let k = 0; k < NM; k++) AS[k * 8] = -1;
    LH.fill(0);
    setCur(0);
    cell.fill(INTACT);
    HIT.fill(0);
    occ.fill(0);
    ocT.fill(0);
    crackT.fill(0);
    B.fill(0);
    SO.fill(0);
    PB.fill(0);
    CH.fill(0);
    HE.fill(0);
    HE[8] = 6;
    TK.fill(0);
    TK[4] = 9;
    T[0] = 2.5;
    T[1] = 1.2;
    for (let b = 0; b < NB; b++) {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c, r = rnd();
        occ[i] = LIVE_CELL[i] ? 0 : r < 0.18 ? 1 : r < 0.24 && fl > 0 ? 2 : r < 0.27 ? 3 : 0;
        ocT[i] = 1.5 + rnd() * 3;
      }
    }
    run.n = 0;
  }

  // ---- the people ----
  function chute(x: number, y: number, z: number, kind: number, vx: number) {
    let j = -1, lo = Infinity;
    for (let i = 0; i < NCH; i++) {
      if (CH[i * 9]! <= 0) { j = i; break; }
      if (CH[i * 9 + 8]! < lo) (lo = CH[i * 9 + 8]!), (j = i);
    }
    const o = j * 9;
    CH[o] = 1; CH[o + 1] = x; CH[o + 2] = y; CH[o + 3] = z; CH[o + 4] = vx; CH[o + 5] = 3.2; CH[o + 6] = kind; CH[o + 7] = 0; CH[o + 8] = 0;
  }
  function pebble(x: number, y: number, z: number, speed: number, kind: number) {
    let j = -1;
    for (let i = 0; i < NP; i++) if (PB[i * 8]! <= 0) { j = i; break; }
    if (j < 0) return;
    // Aimed at the nearest monster's chest, with a little scatter.
    const O = MV[nearest(x)]!, tx = O[0]! + (rnd() - 0.5) * 1.1, ty = O[1]! + 2.1 + (rnd() - 0.5) * 1.1, tz = O[2]!;
    const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, o = j * 8;
    PB[o] = 2.4; PB[o + 1] = x; PB[o + 2] = y; PB[o + 3] = z;
    PB[o + 4] = (dx / l) * speed; PB[o + 5] = (dy / l) * speed; PB[o + 6] = (dz / l) * speed; PB[o + 7] = kind;
    emit(E_SHOT, kind);
  }
  function hurt(n: number) {
    if (M[15]! > 0 || M[5] === KO || S[0] !== RUN) return;
    M[7] = Math.max(0, M[7]! - n);
    M[11] = 0.3;
    M[15] = 0.12;
    emit(E_HURT, n);
    if (M[7]! <= 0) knockOut();
  }
  /** Out of health: it shrinks to a tiny figure that drops and runs off the table. */
  function knockOut() {
    M[5] = KO;
    M[29] = 1;
    M[3] = 0;
    M[4] = Math.max(0, M[4]!);
    M[12] = -1;
    emit(E_KO, cur);
  }
  /** A live part bites: a zap, a little health, it lets go and drops away from the wall. */
  function shock(at: number) {
    M[23] = 0.9;
    M[7] = Math.max(0, M[7]! - SHOCK_HP);
    M[11] = 0.3;
    M[15] = 0.5;
    S[12]!++;
    emit(E_SHOCK, at);
    const wasOn = M[5] === CLIMB || M[5] === ROOF;
    M[5] = AIR;
    M[12] = -1;
    M[4] = 3.5;
    M[3] = wasOn ? -M[6]! * 3 : 0;
    if (M[7]! <= 0) knockOut();
  }

  // ---- the buildings ----
  /** One hit on window i of building b: a chip, a crack, then a hole (HITS_CRACK, HITS_HOLE). */
  function strike(i: number, b: number) {
    if (cell[i] === HOLE || LIVE_CELL[i]) return false;
    HIT[i]!++;
    LH[b] = cur;
    crackT[i] = 0.2;
    if (HIT[i]! < HITS_HOLE) {
      if (HIT[i] === HITS_CRACK) (cell[i] = CRACKED), pts(2), emit(E_CRACK, i);
      else pts(1), emit(E_CHIP, i);
      return true;
    }
    return hole(i, b);
  }
  function hole(i: number, b: number) {
    if (cell[i] === HOLE || LIVE_CELL[i]) return false;
    cell[i] = HOLE;
    crackT[i] = 0.35;
    B[b * 6 + 1]!++;
    S[3]!++;
    M[27]!++;
    pts(10);
    S[13] = i;
    LH[b] = cur;
    const w = BLD[b * 4 + 1]!, r = i - C0[b]!, fl = (r / w) | 0, c = r - fl * w;
    const x = BLD[b * 4]! + c + 0.5, y = yOff(b) + fl + 0.5;
    if (occ[i] === 1) chute(x, y, 0.3, 1, (rnd() - 0.5) * 2);
    else if (occ[i] === 2) chute(x, y, 0.3, 2, (rnd() - 0.5) * 2), S[7]!++, pts(50);
    occ[i] = 0;
    void c;
    emit(E_HOLE, i);
    if (B[b * 6] === STAND && B[b * 6 + 1]! >= NEED[b]!) (B[b * 6] = SHAKE), (B[b * 6 + 2] = SHAKE_T), emit(E_SHAKE, b);
    return true;
  }
  /** The cell a sideways punch from x reaches on floor fl of building tb: the first window that is not a hole yet,
   *  from the near edge in (it eats in from the side); −1 when the floor is gone through. */
  function rowTarget(tb: number, fl: number, fromLeft: boolean) {
    const w = BLD[tb * 4 + 1]!;
    if (fl < B[tb * 6 + 3]! || fl >= BLD[tb * 4 + 2]!) return -1;
    for (let k = 0; k < w; k++) {
      const i = C0[tb]! + fl * w + (fromLeft ? k : w - 1 - k);
      if (cell[i] !== HOLE) return i;
    }
    return -1;
  }
  /** The one window a punch from the wall hits now: on the floor at the hand (d 0), the one above (1) or below
   *  (−1), the first window that is not a hole yet from the wall in; −1 when that floor is gone through. */
  function sideTarget(d: number) {
    const b = M[12]!, s = M[22]!;
    if (b < 0 || !standing(b)) return -1;
    const fl = Math.floor(M[1]! + HAND - yOff(b)) + d;
    return rowTarget(b, fl, s < 0);
  }
  const bOf = (i: number) => {
    let b = 0;
    while (C0[b + 1]! <= i) b++;
    return b;
  };
  function stepBuildings(dt: number) {
    for (let b = 0; b < NB; b++) {
      const o = b * 6, st = B[o]!;
      if (B[o + 4]! > 0) B[o + 4] = Math.max(0, B[o + 4]! - dt / DROP_T);
      if (st === SHAKE) {
        B[o + 5] = 1;
        B[o + 2]! -= dt;
        if (B[o + 2]! <= 0) (B[o] = FALL), (B[o + 2] = 0), emit(E_DROP, b), dropOff(b);
      } else if (st === FALL) {
        B[o + 5] = 1;
        B[o + 2]! -= dt;
        if (B[o + 2]! <= 0) {
          B[o + 2] = FLOOR_T;
          // The bottom floor goes; everyone on it parachutes out; the rest falls into its place.
          const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, fl = B[o + 3]!;
          for (let c = 0; c < w; c++) {
            const i = C0[b]! + fl * w + c;
            if (occ[i]) chute(BLD[b * 4]! + c + 0.5, 0.5 + rnd() * 0.6, 0.4, occ[i]!, (rnd() - 0.5) * 3), (occ[i] = 0);
            cell[i] = HOLE;
          }
          B[o + 3] = fl + 1;
          B[o + 4] = 1;
          S[8]!++;
          S[2]! += 40;
          MV[LH[b]!]![25]! += 40;
          emit(E_FLOOR, b);
          if (fl + 1 >= f) {
            B[o] = RUBBLE;
            B[o + 5] = 0;
            S[4]!++;
            S[2]! += 500;
            MV[LH[b]!]![25]! += 500;
            emit(E_FLAT, b);
          }
        }
        // People in the windows above jump for it as it goes.
        if (rnd() < dt * 3) {
          const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, fl = B[o + 3]! + 1 + Math.floor(rnd() * Math.max(1, f - B[o + 3]! - 1));
          const c = Math.floor(rnd() * w), i = C0[b]! + Math.min(f - 1, fl) * w + c;
          if (fl < f && occ[i]) chute(BLD[b * 4]! + c + 0.5, yOff(b) + fl + 0.5, 0.4, occ[i]!, (rnd() - 0.5) * 3), (occ[i] = 0);
        }
      } else B[o + 5] = B[o + 1]! >= NEED[b]! - 2 && st === STAND ? 0.25 : 0;
    }
  }
  /** The building under the monster goes: it drops off. */
  function dropOff(b: number) {
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[12] !== b || (O[5] !== CLIMB && O[5] !== ROOF)) continue;
      O[3] = O[5] === CLIMB ? O[22]! * 2 : O[6]! * 2;
      O[5] = AIR;
      O[12] = -1;
      O[4] = 3;
    }
  }

  // ---- the monster ----
  function fist() {
    const md = M[5]!, f = M[6]!;
    if (md === CLIMB) (M[16] = M[0]! + f * 1.35), (M[17] = M[1]! + HAND);
    else if (md === ROOF) (M[16] = M[0]! + f * 2), (M[17] = M[1]! + 2.4);
    else (M[16] = M[0]! + f * 1.95), (M[17] = M[1]! + 1.6);
  }
  /** A punch starts: the wind-up; its direction is fixed now (on a wall: the climb's direction, else the
   *  window in front), the hit lands PUNCH_HIT later, the next punch can start PUNCH_CD later. */
  function punch(my: number) {
    const md = M[5]!;
    const d = md === CLIMB ? (my > 0.3 ? 1 : my < -0.3 ? -1 : M[33]! > 0 ? 1 : M[33]! < 0 ? -1 : 0) : md === ROOF && my < -0.4 ? -1 : 0;
    M[8] = PUNCH_CD;
    M[9] = 1;
    M[34] = PUNCH_HIT;
    M[35] = d;
    S[14] = d;
    M[32] = d;
    emit(E_PUNCH, d);
  }
  /** The punch's hit frame. */
  function landPunch() {
    fist();
    const fx = M[16]!, fy = M[17]!, md = M[5]!, d = M[35]!;
    // The helicopter first (a jump, a wall or a roof gets you up to it).
    if (HE[0] === 1 && Math.abs(HE[1]! - fx) < 2 && Math.abs(HE[2]! - fy) < 1.7) {
      HE[0] = 2;
      HE[4] = M[6]! * 4;
      HE[5] = 2;
      S[5]!++;
      pts(250);
      emit(E_HELI, cur);
      return;
    }
    // Another monster in reach: a bonk (off a wall, off a roof). On a wall, one hanging beside it either way.
    for (let j = 0; j < NM; j++) {
      const O = MV[j]!;
      if (j === cur || O[24] !== IN || O[5] === KO) continue;
      const side = md === CLIMB ? Math.abs(O[0]! - M[0]!) < 2.6 && fy > O[1]! + 0.2 && fy < O[1]! + 3.6 : false;
      if (side || (Math.abs(O[0]! - fx) < 1.5 && (O[0]! - M[0]!) * M[6]! > 0 && fy > O[1]! + 0.3 && fy < O[1]! + 3.6)) return bonk(j);
    }
    if (md === CLIMB) {
      const i = sideTarget(d);
      if (i >= 0) return void (LIVE_CELL[i] ? shock(i) : strike(i, bOf(i)));
      return void emit(E_WHIFF, 0);
    }
    if (md === ROOF) {
      // Down through the roof: the top floor under the fist; the antenna bites.
      const b = M[12]!;
      if (ANT[b]! === ANT[b]! && Math.abs(ANT[b]! - fx) < 1.1) return shock(-1 - b);
      if (d < 0) {
        const w = BLD[b * 4 + 1]!, c = Math.max(0, Math.min(w - 1, Math.floor(M[0]! - BLD[b * 4]!)));
        for (let fl = BLD[b * 4 + 2]! - 1; fl >= B[b * 6 + 3]! && fl >= BLD[b * 4 + 2]! - 2; fl--) {
          const i = C0[b]! + fl * w + c;
          if (cell[i] === HOLE) continue;
          return void (LIVE_CELL[i] ? shock(i) : strike(i, b));
        }
      }
      return void emit(E_WHIFF, 0);
    }
    // From the street: soldiers and the tank (the buildings are smashed from their sides).
    let hit = false;
    if (M[1]! < 2.5) {
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.5) {
          SO[o] = 0;
          chute(SO[o + 1]!, 0.6, SO[o + 2]!, 2, M[6]! * 3);
          S[7]!++;
          pts(50);
          emit(E_FLING, s);
          hit = true;
        }
      }
      if (TK[0] === 1 && Math.abs(TK[1]! - fx) < 2.2) tankBoom(), (hit = true);
    }
    if (!hit) emit(E_WHIFF, 0);
  }
  function tankBoom() {
    TK[0] = 2;
    TK[5] = 4;
    TK[4] = 13;
    S[11]!++;
    pts(300);
    emit(E_TANK, TK[1]!);
  }
  /** Monster j takes a punch: health, and off whatever it hangs on. */
  function bonk(j: number) {
    const O = MV[j]!;
    O[7] = Math.max(0, O[7]! - 6);
    O[11] = 0.3;
    if (O[5] === CLIMB || O[5] === ROOF) (O[5] = AIR), (O[12] = -1), (O[4] = 4), (O[3] = M[6]! * 5), (O[15] = 0.7);
    else O[3] = M[6]! * 3;
    pts(30);
    emit(E_BONK, j);
    if (O[7]! <= 0) {
      const k = cur;
      setCur(j);
      knockOut();
      setCur(k);
    }
  }
  function grab() {
    M[14] = GRAB_CD;
    M[10] = 1;
    fist();
    const fx = M[16]!, fy = M[17]! + 0.2, md = M[5]!;
    if (md === CLIMB) {
      // A person at a window right next to the hand, on either side (the facing side first).
      let best = -1, bd = 9;
      for (let side = -1; side <= 1; side += 2) {
        const tb = side === -M[22]! ? M[12]! : M[12]! + side;
        if (tb < 0 || tb >= NB || !standing(tb)) continue;
        const x0 = BLD[tb * 4]!, w = BLD[tb * 4 + 1]!, edge = side > 0 ? x0 : x0 + w;
        if (Math.abs(edge - M[0]!) > 2.4) continue;
        const r0 = rowOf(tb, fy);
        for (let fl = r0 - 1; fl <= r0 + 1; fl++) {
          if (fl < B[tb * 6 + 3]! || fl >= BLD[tb * 4 + 2]!) continue;
          for (let k = 0; k < 2; k++) {
            const c = side > 0 ? k : w - 1 - k, i = C0[tb]! + fl * w + c;
            if (!occ[i]) continue;
            const d = Math.abs(fl - r0) + k * 0.6 + (side === M[6] ? 0 : 0.5) + (occ[i] === 3 ? 2 : 0);
            if (d < bd) (bd = d), (best = i);
          }
        }
      }
      if (best >= 0) {
        const kind = occ[best]!;
        // Something hot: it burns, and stays.
        if (kind === 3) return burn(best);
        occ[best] = 0;
        return snack(kind === 2 ? 12 : 16, best);
      }
      // No one there: the hand closes on what is next to it; a live part bites.
      const i = sideTarget(0);
      if (i >= 0 && LIVE_CELL[i]) return shock(i);
      return void emit(E_WHIFF, 1);
    }
    if (md === ROOF && ANT[M[12]!]! === ANT[M[12]!]! && Math.abs(ANT[M[12]!]! - fx) < 1.1) return shock(-1 - M[12]!);
    // A soldier off the street.
    if (md === WALK || (md === AIR && M[1]! < 2))
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.7) return void ((SO[o] = 0), S[7]!++, snack(12, -1));
      }
    // A parachute in reach.
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      if (CH[o]! > 0 && !CH[o + 7] && Math.abs(CH[o + 1]! - fx) < 1.3 && Math.abs(CH[o + 2]! - fy) < 1.4) return void ((CH[o] = 0), snack(16, -1));
    }
    emit(E_WHIFF, 1);
  }
  function snack(hp: number, from: number) {
    M[7] = Math.min(MAX_HP, M[7]! + hp);
    M[18] = 0.6;
    S[6]!++;
    M[26]!++;
    pts(100);
    S[15] = cur;
    emit(E_NOM, from);
  }
  function burn(i: number) {
    S[15] = cur;
    emit(E_BURN, i);
    M[15] = 0;
    hurt(5);
    M[23] = Math.max(M[23]!, 0.25);
  }
  /** A side wall to catch at x (moving by v), or −1: the monster's x is at its hanging spot, heading at the building. */
  function wallAt(x: number, v: number, y: number, r: number) {
    for (let b = 0; b < NB; b++) {
      if (!standing(b) || y > top(b) - CLIMB_TOP + 0.3) continue;
      for (let s = -1; s <= 1; s += 2) {
        if (Math.abs(x - wallX(b, s)) < r && v * -s > 0.2) return b * 2 + (s > 0 ? 1 : 0);
      }
    }
    return -1;
  }
  function hang(code: number) {
    const b = code >> 1, s = code & 1 ? 1 : -1;
    M[5] = CLIMB;
    M[12] = b;
    M[22] = s;
    M[0] = wallX(b, s);
    M[3] = 0;
    M[4] = 0;
    M[6] = -s;
    M[33] = 0;
    if (M[1]! < 0.05) M[1] = 0.05;
    emit(E_CLIMB, b);
  }
  function stepMonster(dt: number, mx: number, my: number, jump: number) {
    const md = M[5]!;
    if (Math.abs(mx) > 0.25 && md !== KO && md !== CLIMB) M[6] = mx > 0 ? 1 : -1;
    M[8] = Math.max(0, M[8]! - dt); M[11] = Math.max(0, M[11]! - dt); M[14] = Math.max(0, M[14]! - dt); M[15] = Math.max(0, M[15]! - dt); M[18] = Math.max(0, M[18]! - dt);
    M[9] = Math.max(0, M[9]! - dt * 4.5); M[10] = Math.max(0, M[10]! - dt * 3.5); M[19] = Math.max(0, M[19]! - dt * 5); M[23] = Math.max(0, M[23]! - dt);
    if (md === WALK) {
      M[3] = mx * 5.2;
      M[0] = M[0]! + M[3]! * dt;
      M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 8);
      M[13] = M[13]! + Math.abs(M[3]!) * dt * 1.3;
      // Up at a side wall climbs it.
      if (my > 0.5) {
        const w = wallAt(M[0]!, M[6]!, 0, 0.9);
        if (w >= 0) return hang(w);
      }
      if (jump) (M[5] = AIR), (M[4] = 11), (M[3] = mx * 5.2), emit(E_JUMP, 0);
    } else if (md === KO && M[1]! <= 0) {
      // Shrunk: a tiny figure running for the nearest end of the table, then out.
      M[3] = M[0]! < 0 ? -6.5 : 6.5;
      M[0] = M[0]! + M[3]! * dt;
      M[13] = M[13]! + dt * 12;
      M[2] = M[2]! + (ZS + 1.4 - M[2]!) * Math.min(1, dt * 4);
      if (Math.abs(M[0]!) > SX + 2.5) (M[24] = OUT), emit(E_OUT, cur);
      return;
    } else if (md === AIR || md === KO) {
      if (md === AIR) M[3] = M[3]! + (mx * 5 - M[3]!) * Math.min(1, dt * 5);
      else M[3] = M[3]! * (1 - dt * 3);
      M[4] = M[4]! - G * dt;
      const x0 = M[0]!;
      M[0] = x0 + M[3]! * dt;
      const y0 = M[1]!;
      M[1] = y0 + M[4]! * dt;
      // A jump at a wall grabs it (the hanging spot crossed, or reached, heading at the building).
      if (md === AIR && M[23]! <= 0 && M[15]! <= 0 && M[1]! > 0.15) {
        const v = M[3]! || M[6]! * 0.5, w = wallAt(M[0]!, v, M[1]!, 0.55 + Math.abs(M[0]! - x0));
        if (w >= 0) return hang(w);
      }
      // A roof under it, if it came from that height.
      let rb = -1;
      for (let b = 0; b < NB; b++) if (standing(b) && M[0]! > BLD[b * 4]! + 0.1 && M[0]! < BLD[b * 4]! + BLD[b * 4 + 1]! - 0.1) rb = b;
      const over = rb >= 0 && M[2]! < ZS - 1.2 && y0 >= top(rb) - 0.05;
      if (!over) M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 5);
      if (over && M[4]! <= 0 && M[1]! <= top(rb)) return void ((M[1] = top(rb)), (M[4] = 0), (M[5] = md === KO ? KO : ROOF), (M[12] = rb), (M[19] = 1), emit(E_LAND, 1));
      if (M[1]! <= 0) {
        const fall = -M[4]!;
        M[1] = 0;
        M[4] = 0;
        M[5] = md === KO ? KO : WALK;
        M[12] = -1;
        M[19] = Math.min(1, fall / 12);
        emit(E_LAND, 0);
        if (md === KO) return;
        // Landing on soldiers sends them packing; on the tank, it blows.
        if (fall > 4) {
          for (let s = 0; s < NS; s++) {
            const o = s * 8;
            if (SO[o]! > 0 && Math.abs(SO[o + 1]! - M[0]!) < 1.6) (SO[o] = 0), chute(SO[o + 1]!, 0.5, SO[o + 2]!, 2, (SO[o + 1]! - M[0]! > 0 ? 1 : -1) * 3), S[7]!++, pts(50), emit(E_STOMP, s);
          }
          if (TK[0] === 1 && Math.abs(TK[1]! - M[0]!) < 1.9) tankBoom();
        }
      }
    } else if (md === CLIMB) {
      // Hanging on a side: up and down; facing either way; a jump pushes off (and catches the wall across the gap).
      const b = M[12]!, s = M[22]!, tp = top(b);
      M[2] = M[2]! + (ZW - M[2]!) * Math.min(1, dt * 9);
      M[0] = M[0]! + (wallX(b, s) - M[0]!) * Math.min(1, dt * 12);
      // Still while a punch is out (it never drifts off its spot); the last way it climbed sets the next punch.
      const mv = M[8]! > 0 ? 0 : my;
      M[1] = M[1]! + mv * 3.4 * dt;
      M[13] = M[13]! + Math.abs(mv) * dt * 2;
      if (mv > 0.3) M[33] = 0.35;
      else if (mv < -0.3) M[33] = -0.35;
      else if (M[8]! <= 0) M[33] = M[33]! > 0 ? Math.max(0, M[33]! - dt) : Math.min(0, M[33]! + dt);
      const hi = tp - CLIMB_TOP;
      if (M[1]! > hi) M[1] = hi;
      if (M[1]! >= hi - 0.01 && mv > 0.5) {
        M[5] = ROOF;
        M[1] = tp;
        M[2] = ZR;
        M[0] = s < 0 ? BLD[b * 4]! + 0.8 : BLD[b * 4]! + BLD[b * 4 + 1]! - 0.8;
        M[19] = 0.6;
        return void emit(E_LAND, 2);
      }
      if (M[1]! <= 0.05 && mv < -0.3 && M[33]! < -0.3) return void ((M[1] = 0), (M[5] = WALK), (M[12] = -1), (M[33] = 0));
      if (M[1]! < 0.05) M[1] = 0.05;
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 7.5), (M[3] = s * 5.5), (M[6] = s), emit(E_JUMP, 1));
    } else if (md === ROOF) {
      const b = M[12]!, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      M[1] = top(b);
      M[0] = M[0]! + mx * 4 * dt;
      M[13] = M[13]! + Math.abs(mx) * 4 * dt * 1.3;
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 10), (M[3] = mx * 4.8), emit(E_JUMP, 2));
      if (M[0]! < x0 + 0.1 || M[0]! > x0 + w - 0.1) (M[5] = AIR), (M[12] = -1), (M[4] = 2), (M[3] = mx * 4.8);
    }
    if (M[0]! < -SX - 1) M[0] = -SX - 1;
    if (M[0]! > SX + 1) M[0] = SX + 1;
    // A rival comes in from the table's end: it walks onto the street.
    if (md === WALK && Math.abs(M[0]!) > SX - 0.5 && M[31] !== HERO) M[0] = M[0]! - (M[0]! > 0 ? 1 : -1) * dt * 3;
    if (md === WALK && M[31] === HERO) M[0] = Math.max(-SX, Math.min(SX, M[0]!));
  }

  // ---- the army ----
  function stepArmy(dt: number) {
    const t = S[1]!, F = MV[nearest(0)]!, mx = F[0]!;
    // Soldiers walk in from the ends, stop at their range, and throw.
    T[0]! -= dt;
    if (T[0]! <= 0) {
      T[0] = Math.max(2.4, 4.2 - t * 0.03) * (0.7 + rnd() * 0.6);
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0) continue;
        const side = mx > 6 ? -1 : mx < -6 ? 1 : rnd() < 0.5 ? -1 : 1;
        SO[o] = 1; SO[o + 1] = side * (SX + 1); SO[o + 2] = STREET0 + 1.9 + rnd() * 2.2; SO[o + 3] = -side; SO[o + 4] = 0; SO[o + 5] = 1 + rnd(); SO[o + 6] = 3.5 + rnd() * 3; SO[o + 7] = rnd() * 6;
        break;
      }
    }
    for (let s = 0; s < NS; s++) {
      const o = s * 8;
      if (SO[o]! <= 0) continue;
      const dx = MV[nearest(SO[o + 1]!)]![0]! - SO[o + 1]!, d = Math.abs(dx);
      SO[o + 3] = dx > 0 ? 1 : -1;
      if (d > SO[o + 6]! + 0.5) (SO[o + 1] = SO[o + 1]! + SO[o + 3]! * 2.6 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else if (d < SO[o + 6]! - 1.2) (SO[o + 1] = SO[o + 1]! - SO[o + 3]! * 2.2 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else SO[o + 4] = 1;
      SO[o + 5]! -= dt;
      if (SO[o + 5]! <= 0 && d < 11) (SO[o + 5] = 2.4 + rnd() * 1.4), pebble(SO[o + 1]! + SO[o + 3]! * 0.2, 0.55, SO[o + 2]!, 8, 0);
    }
    // Snipers in the windows.
    for (let b = 0; b < NB; b++) {
      if (B[b * 6] !== STAND) continue;
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = B[b * 6 + 3]!; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c;
        if (occ[i] !== 2) continue;
        ocT[i] = ocT[i]! - dt;
        if (ocT[i]! <= 0) {
          ocT[i] = 2.6 + rnd() * 1.6;
          const x = x0 + c + 0.5;
          if (Math.abs(x - mx) < 9) pebble(x, yOff(b) + fl + 0.5, 0.2, 7, 0);
        }
      }
    }
    // New people come to the windows (snacks, and a sniper now and then).
    T[1]! -= dt;
    if (T[1]! <= 0) {
      T[1] = 0.9 + rnd() * 0.7;
      const b = Math.floor(rnd() * NB);
      if (B[b * 6] === STAND) {
        const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, i = C0[b]! + Math.floor(rnd() * f) * w + Math.floor(rnd() * w);
        if (cell[i] !== HOLE && !occ[i] && !LIVE_CELL[i]) {
          const r = rnd();
          occ[i] = r < 0.25 ? 2 : r < 0.33 ? 3 : 1;
          ocT[i] = 2 + rnd() * 2;
        }
      }
    }
    // The tank: rolls in from the far side, stops at its range, fires shells; punched or stomped, it blows.
    if (TK[0] === 0) {
      TK[4]! -= dt;
      if (TK[4]! <= 0) {
        const side = mx > 0 ? -1 : 1;
        TK[0] = 1; TK[1] = side * (SX + 2); TK[2] = -side; TK[3] = 2.5; TK[6] = 0; TK[7] = STREET0 + 3.1;
      }
    } else if (TK[0] === 1) {
      const dx = mx - TK[1]!;
      TK[2] = dx > 0 ? 1 : -1;
      if (Math.abs(dx) > 7.5) (TK[1] = TK[1]! + TK[2]! * 1.8 * dt), (TK[8] = TK[8]! + dt * 1.8);
      TK[6] = Math.max(0, TK[6]! - dt * 3);
      TK[3]! -= dt;
      if (TK[3]! <= 0 && Math.abs(dx) < 12) (TK[3] = 3.2 + rnd()), (TK[6] = 1), pebble(TK[1]! + TK[2]! * 1.7, 1.05, TK[7]!, 9, 2);
    } else if (TK[0] === 2) {
      TK[5]! -= dt;
      if (TK[5]! <= 0) TK[0] = 0;
    }
    // The helicopter: in from a side, circles the monster, fires bursts; punched, it spins down.
    const he = HE[0]!;
    HE[10] = HE[10]! + dt;
    if (he === 0) {
      HE[8]! -= dt;
      if (HE[8]! <= 0) {
        const side = mx > 0 ? -1 : 1;
        HE[0] = 1; HE[1] = side * (SX + 3); HE[2] = 9; HE[3] = 2.6; HE[4] = 0; HE[5] = 0; HE[6] = 2.5; HE[7] = 0; HE[10] = 0;
      }
    } else if (he === 1) {
      // It swings in close now and then (the time to swat it), then stands off.
      const ht = HE[10]!, tx = mx + Math.cos(ht * 0.55) * (3.8 + Math.sin(ht * 0.37) * 2.3), ty = Math.min(11.5, Math.max(5, F[1]! + 4.3 + Math.sin(ht * 1.3) * 1.3));
      const ax = (tx - HE[1]!) * 1.6 - HE[4]! * 1.4, ay = (ty - HE[2]!) * 2 - HE[5]! * 1.8;
      HE[4] = HE[4]! + ax * dt; HE[5] = HE[5]! + ay * dt;
      const sp = Math.abs(HE[4]!);
      if (sp > 6) HE[4] = (HE[4]! / sp) * 6;
      HE[1] = HE[1]! + HE[4]! * dt; HE[2] = HE[2]! + HE[5]! * dt;
      HE[11] = HE[11]! + (Math.max(-0.4, Math.min(0.4, HE[4]! * 0.08)) - HE[11]!) * Math.min(1, dt * 4);
      HE[6]! -= dt;
      if (HE[6]! <= 0) {
        if (HE[7]! <= 0) HE[7] = 3;
        pebble(HE[1]!, HE[2]! - 0.4, HE[3]!, 10, 1);
        HE[7]!--;
        HE[6] = HE[7]! > 0 ? 0.14 : 2.6 + rnd();
      }
    } else if (he === 2) {
      HE[5] = HE[5]! - G * 0.55 * dt;
      HE[1] = HE[1]! + HE[4]! * dt; HE[2] = HE[2]! + HE[5]! * dt;
      HE[9] = HE[9]! + dt * 9;
      if (HE[2]! <= 0.4) (HE[0] = 0), (HE[8] = 6.5), (HE[9] = 0), emit(E_HELI_CRASH, HE[1]!);
    }
    // Pebbles and shells fly; one that reaches the monster stings.
    for (let k = 0; k < NP; k++) {
      const o = k * 8;
      if (PB[o]! <= 0) continue;
      PB[o]! -= dt;
      PB[o + 1] = PB[o + 1]! + PB[o + 4]! * dt; PB[o + 2] = PB[o + 2]! + PB[o + 5]! * dt; PB[o + 3] = PB[o + 3]! + PB[o + 6]! * dt;
      for (let k = 0; k < NM; k++) {
        const O = MV[k]!;
        if (O[24] !== IN || O[5] === KO) continue;
        const dx = PB[o + 1]! - O[0]!, dy = PB[o + 2]! - (O[1]! + 2), dz = PB[o + 3]! - O[2]!;
        if (dx * dx + dy * dy * 0.45 + dz * dz * 0.4 < 1.35) {
          PB[o] = 0;
          setCur(k);
          hurt(PB[o + 7] === 2 ? 6 : PB[o + 7] ? 3 : 3);
          break;
        }
      }
      if (PB[o]! > 0 && PB[o + 2]! < 0) PB[o] = 0;
    }
    // Parachutes float down, land and run for it.
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      if (CH[o]! <= 0) continue;
      CH[o + 8] = CH[o + 8]! + dt;
      if (!CH[o + 7]) {
        CH[o + 5] = Math.max(-1.25, CH[o + 5]! - 9 * dt);
        CH[o + 4] = CH[o + 4]! * (1 - dt * 0.8);
        CH[o + 1] = CH[o + 1]! + CH[o + 4]! * dt; CH[o + 2] = CH[o + 2]! + CH[o + 5]! * dt;
        CH[o + 3] = CH[o + 3]! + (STREET0 + 2.4 - CH[o + 3]!) * Math.min(1, dt * 0.8);
        if (CH[o + 2]! <= 0) (CH[o + 2] = 0), (CH[o + 7] = 1), (CH[o + 4] = CH[o + 1]! > mx ? 4.5 : -4.5);
      } else {
        CH[o + 1] = CH[o + 1]! + CH[o + 4]! * dt;
        if (Math.abs(CH[o + 1]!) > SX + 2) CH[o] = 0;
      }
    }
  }

  function step(dt: number, mx: number, my: number, p: number, jump: number, g: number, mx2 = 0, my2 = 0, p2 = 0, j2 = 0, g2 = 0) {
    const ph = S[0]!;
    if (ph === DONE) return stepFall(dt);
    if (ph === READY) {
      if (!(p || jump || g || Math.abs(mx) > 0.3 || Math.abs(my) > 0.3 || p2 || j2 || g2 || Math.abs(mx2) > 0.3 || Math.abs(my2) > 0.3)) return false;
      S[0] = RUN;
      emit(E_START, 0);
    }
    S[1] = S[1]! + dt;
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] === WAIT && (O[30] = O[30]! - dt) <= 0) O[24] = IN;
      if (O[24] !== IN) continue;
      const who = O[28]!;
      if (who === AI) autopilot(IA, k);
      else if (who === P1) (IA[0] = mx), (IA[1] = my), (IA[2] = p), (IA[3] = jump), (IA[4] = g);
      else (IA[0] = mx2), (IA[1] = my2), (IA[2] = p2), (IA[3] = j2), (IA[4] = g2);
      setCur(k);
      const ko = M[5] === KO;
      stepMonster(dt, ko ? 0 : IA[0]!, ko ? 0 : IA[1]!, ko ? 0 : IA[3]!);
      if (M[5] !== KO) {
        if (IA[2]) M[20] = 0.3;
        if (IA[4]) M[21] = 0.3;
        if (M[20]! > 0 && M[8]! <= 0) (M[20] = 0), punch(IA[1]!);
        if (M[34]! > 0 && (M[34] = M[34]! - dt) <= 0) (M[34] = 0), M[5] !== KO && landPunch();
        if (M[21]! > 0 && M[14]! <= 0 && M[5] !== KO) (M[21] = 0), grab();
        M[20] = Math.max(0, M[20]! - dt);
        M[21] = Math.max(0, M[21]! - dt);
      }
    }
    setCur(0);
    stepBuildings(dt);
    stepArmy(dt);
    setCur(0);
    if (S[9]! > 0) {
      S[9]! -= dt;
      if (S[9]! <= 0) end();
    } else if (S[4] === NB || humans() === 0) S[9] = S[4] === NB ? 1.6 : 1.2;
    return true;
  }
  /** After the end: what is still falling settles (a last floor, the monster). */
  function stepFall(dt: number) {
    let any = false;
    for (let b = 0; b < NB; b++) if (B[b * 6 + 4]! > 0) (B[b * 6 + 4] = Math.max(0, B[b * 6 + 4]! - dt / DROP_T)), (any = true);
    for (let k = 0; k < NM; k++) {
      const O = MV[k]!;
      if (O[24] !== IN || O[29]) continue;
      if (O[11]! > 0 || O[18]! > 0) (O[11] = Math.max(0, O[11]! - dt)), (O[18] = Math.max(0, O[18]! - dt)), (any = true);
      if (O[1]! > 0 || O[19]! > 0 || O[9]! > 0 || O[23]! > 0) {
        O[4] = O[4]! - G * dt;
        O[1] = Math.max(0, O[1]! + O[4]! * dt);
        if (O[1] === 0) O[4] = 0;
        O[19] = Math.max(0, O[19]! - dt * 5);
        O[9] = Math.max(0, O[9]! - dt * 4.5);
        O[23] = Math.max(0, O[23]! - dt);
        any = true;
      }
    }
    return any;
  }
  function end() {
    S[0] = DONE;
    S[9] = 0;
    if (S[2]! > S[10]!) S[10] = S[2]!;
    emit(E_END, S[4] === NB ? 1 : 0);
  }

  // ---- the autopilot (the poster, the tests): the nearest standing building, a jump at its side
  // wall, then work the floors from there (the windows that are not live first); swat the helicopter
  // when it comes near, blow up the tank, snack when hurt. ----
  function autopilot(I: Float64Array, k = 0) {
    setCur(k);
    A = AV[k]!;
    I[0] = I[1] = I[2] = I[3] = I[4] = 0;
    if (S[0] === DONE || M[5] === KO || M[24] !== IN) return;
    if (S[0] === READY) return void (I[0] = 0.6);
    const x = M[0]!, md = M[5]!, rival = M[31] !== HERO;
    A[5] = Math.max(0, A[5]! - 1 / 60);
    // A rival bonks whoever is in reach, now and then.
    if (rival && A[5]! <= 0 && M[8]! <= 0) {
      fist();
      for (let j = 0; j < NM; j++) {
        const O = MV[j]!;
        if (j === k || O[24] !== IN || O[5] === KO) continue;
        if (Math.abs(O[0]! - x) < 2.4 && M[17]! > O[1]! + 0.3 && M[17]! < O[1]! + 3.6) {
          A[5] = 1.4;
          I[0] = O[0]! > x ? 0.3 : -0.3;
          I[2] = 1;
          return;
        }
      }
    }
    A[2] = Math.max(0, A[2]! - 1 / 60);
    A[4] = Math.max(0, A[4]! - 1 / 60);
    // The helicopter in reach: face it and punch.
    fist();
    if (HE[0] === 1 && Math.abs(HE[1]! - x) < 2.8 && HE[2]! - M[17]! < 3.2 && HE[2]! - M[17]! > -1.5 && md !== ROOF) {
      I[0] = HE[1]! > x ? 0.3 : -0.3;
      if (Math.abs(HE[2]! - M[17]!) < 1.4) return void (I[2] = 1);
      if (md === WALK && A[2]! <= 0) return void ((I[3] = 1), (A[2] = 0.8));
      if (md === CLIMB) return void (I[1] = Math.max(-1, Math.min(1, (HE[2]! - M[17]!) * 2)));
    }
    // The tank on the street near: go and punch it.
    if (TK[0] === 1 && (md === WALK || md === AIR) && Math.abs(TK[1]! - x) < 5) {
      I[0] = TK[1]! > x ? 1 : -1;
      if (Math.abs(TK[1]! - x) < 2.6) (I[0] *= 0.3), (I[2] = 1);
      return;
    }
    // Hungry: grab the person next to the hand.
    // Hungry (a rival always is: it steals the snacks): grab the person next to the hand.
    if ((rival || M[7]! < 85) && md === CLIMB && A[4]! <= 0 && personNear()) return void ((I[4] = 1), (A[4] = rival ? 0.9 : 0.5));
    if (md === ROOF) return void ((I[0] = A[1]! < 0 ? -1 : 1), (I[3] = 0));
    // On a wall: work it; nothing left this side, the other.
    if (md === CLIMB) {
      if (A[0] !== M[12] || A[1] !== M[22]) A[3] = 0;
      A[0] = M[12]!;
      A[1] = M[22]!;
      const b = M[12]!, s = M[22]!;
      I[0] = -s * 0.3; // face the building
      // What a punch would hit from here: a window that is not live, punch; else climb on, then the other side.
      const i = sideTarget(0);
      if (i >= 0 && !LIVE_CELL[i] && B[b * 6] === STAND) {
        // Settled (no climb a moment ago): the punch goes to the window in front; hold it.
        if (M[33] === 0) I[2] = 1;
        return;
      }
      if (B[b * 6] === STAND && M[1]! < top(b) - CLIMB_TOP - 0.05 && A[3]! < 1) return void (I[1] = 1);
      // Nothing more from up here: down and round.
      A[3] = 1;
      if (M[1]! > 0.1 && B[b * 6] === STAND) return void (I[1] = -1);
      A[1] = -s;
      A[3] = 0;
      return void (I[3] = 1);
    }
    // On the street: pick a building and a side, walk at its wall, jump at it.
    let tb = A[0]!;
    if (tb < 0 || B[tb * 6] !== STAND || (goodRow(tb, -1) < 0 && goodRow(tb, 1) < 0)) {
      tb = -1;
      let bd = Infinity;
      for (let b = 0; b < NB; b++) {
        if (B[b * 6] !== STAND || (goodRow(b, -1) < 0 && goodRow(b, 1) < 0)) continue;
        const cx = BLD[b * 4]! + BLD[b * 4 + 1]! / 2, d = Math.abs(cx - x);
        if (d < bd) (bd = d), (tb = b);
      }
      A[0] = tb;
      A[1] = 0;
    }
    if (tb < 0) return;
    let s = A[1]!;
    if (!s || goodRow(tb, s) < 0) s = A[1] = goodRow(tb, -1) >= 0 && (goodRow(tb, 1) < 0 || Math.abs(wallX(tb, -1) - x) < Math.abs(wallX(tb, 1) - x)) ? -1 : 1;
    const wx = wallX(tb, s), dx = wx - x;
    if (md === WALK) {
      // Run up and jump at the wall from a little way off (the jump grabs it).
      if (Math.abs(dx) > 1.6) I[0] = dx > 0 ? 1 : -1;
      else if ((-s > 0) === (dx > -0.2 && dx < 1.6) || (-s < 0) === (dx < 0.2 && dx > -1.6)) (I[0] = -s), A[2]! <= 0 && ((I[3] = 1), (A[2] = 0.5));
      else I[0] = dx > 0 ? 1 : -1;
    } else if (md === AIR) I[0] = -s;
  }
  /** The floor a punch from side s of building b should go for (lowest first), skipping floors whose next window in is live. */
  function goodRow(b: number, s: number) {
    if (B[b * 6] !== STAND) return -1;
    const f = BLD[b * 4 + 2]!, tp = BLD[b * 4 + 2]!;
    for (let fl = B[b * 6 + 3]!; fl < f; fl++) {
      if (fl + 0.5 - HAND > tp - CLIMB_TOP + 0.6) break;
      const i = rowTarget(b, fl, s < 0);
      if (i >= 0 && !LIVE_CELL[i]) return fl;
    }
    return -1;
  }
  function personNear() {
    const b = M[12]!, s = M[22]!, w = BLD[b * 4 + 1]!, r0 = rowOf(b, M[1]! + HAND + 0.2);
    for (let fl = r0 - 1; fl <= r0 + 1; fl++) {
      if (fl < B[b * 6 + 3]! || fl >= BLD[b * 4 + 2]!) continue;
      for (let k = 0; k < 2; k++) {
        const o = occ[C0[b]! + fl * w + (s < 0 ? k : w - 1 - k)]!;
        if (o === 1 || o === 2) return true;
      }
    }
    return false;
  }

  reset();
  return run;
}
export type BlockRun = ReturnType<typeof blockRun>;
