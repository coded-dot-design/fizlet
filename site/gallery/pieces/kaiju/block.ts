// DOM Kaiju's city block and round, headless (tests/dom-kaiju.test.mjs plays it with no browser).
// One block on a table, seen side-on: five buildings of different heights along the back of a street
// (floors of windows, a roof), a sidewalk and the street in front. The monster walks the street,
// jumps, climbs a building's face up and down, steps onto its roof, punches windows and grabs tiny
// people. Every punch on a window makes a hole; enough holes and the building shakes, then pancakes
// down floor by floor and the monster drops off. Soldiers walk in from the street's ends and throw
// pebbles, some windows hold a sniper, and a helicopter circles and fires; a punch knocks it out of
// the air. A person grabbed from a window (or off the street) is a snack: health back and a "nom".
// The round ends when the block is flat or the monster's health is out.
// Two small parts here are brick candidates: the destructible building (a grid of cells per face,
// holes, a collapse threshold, a shake, then a floor-by-floor pancake with continuous heights) and
// the climber (walk, air, climb a face, stand on a roof, hand over to the next face, drop off).
// Deterministic (one seeded random, fixed inputs → the same round) and zero allocation per step.
import { seeded } from "../../../../src/kernel/random";

export const READY = 0, RUN = 1, DONE = 2;
/** Monster modes. */
export const WALK = 0, AIR = 1, CLIMB = 2, ROOF = 3, KO = 4;
/** Events (one ring, read and cleared each step): what, and a value. */
export const E_START = 1, E_PUNCH = 2, E_HOLE = 3, E_SHAKE = 4, E_FLOOR = 5, E_FLAT = 6, E_HELI = 7, E_HELI_CRASH = 8, E_NOM = 9,
  E_HURT = 10, E_FLING = 11, E_DROP = 12, E_KO = 13, E_END = 14, E_WHIFF = 15, E_SHOT = 16, E_STOMP = 17, E_JUMP = 18, E_LAND = 19, E_CLIMB = 20;

/** The street: x from −SX to SX; z of the street walk, a face being climbed, a roof. */
/** The monster's scale: about four floors tall (./monster.ts draws it at this size). */
export const MK = 1.3;
export const SX = 15.5, ZS = 1.9, ZC = 0.98, ZR = -1.45, DEPTH = 3, STREET0 = 0.9, STREET1 = 5.6;
/** The buildings: left x, columns (one unit each), floors (one unit each), look. */
export const BLD = [
  -12.6, 4, 5, 0,
  -7.9, 5, 8, 1,
  -2.1, 4, 4, 2,
  2.7, 4, 7, 3,
  7.7, 5, 6, 4,
];
export const NB = BLD.length / 4;
/** Each building's first cell, and the total. A cell is floor × columns + column, on the front face. */
export const C0 = new Int32Array(NB + 1);
for (let b = 0; b < NB; b++) C0[b + 1] = C0[b]! + BLD[b * 4 + 1]! * BLD[b * 4 + 2]!;
export const NC = C0[NB]!;
export const TOTAL_FLOORS = BLD.reduce((a, v, i) => (i % 4 === 2 ? a + v : a), 0);
/** Holes it takes to bring a building down. */
export const NEED = new Int32Array(NB);
for (let b = 0; b < NB; b++) NEED[b] = Math.max(4, Math.ceil(BLD[b * 4 + 1]! * BLD[b * 4 + 2]! * 0.42));
/** Cells: 2 intact, 1 cracked, 0 a hole. Occupants: 0 none, 1 a person, 2 a sniper. */
export const INTACT = 2, CRACKED = 1, HOLE = 0;
/** Building states. */
export const STAND = 0, SHAKE = 1, FALL = 2, RUBBLE = 3;
export const MAX_HP = 100, SHAKE_T = 1.0, FLOOR_T = 0.26, DROP_T = 0.2;
/** Pools: soldiers, pebbles, parachutes. */
export const NS = 6, NP = 40, NCH = 18;
const G = 26, PUNCH_CD = 0.27, GRAB_CD = 0.4;
/** Climbing: the fist's height over the feet, and how far below the roof the feet stop. */
const CLIMB_FIST = 2.9, CLIMB_TOP = 1.6;

/** A round on the block. `step(dt, mx, my, punch, jump, grab)`: mx, my −1..1 (my up), the keys 1 on the press. */
export function blockRun(seed = 20261115) {
  const rnd = seeded(seed);
  /** [0] phase, [1] time, [2] score, [3] holes, [4] buildings flat, [5] helicopters down, [6] snacks, [7] soldiers flung, [8] floors down, [9] end delay, [10] best. */
  const S = new Float64Array(12);
  /** The monster: [0] x, [1] y, [2] z, [3] vx, [4] vy, [5] mode, [6] face, [7] hp, [8] punch cooldown, [9] punch anim, [10] grab anim,
   *  [11] hurt, [12] on building, [13] walk phase, [14] grab cooldown, [15] invulnerable, [16] fist x, [17] fist y, [18] mouth (nom), [19] land squash,
   *  [20] a punch pressed during the cooldown (it lands when the cooldown ends), [21] the same for a grab. */
  const M = new Float64Array(22);
  // Cells and their people.
  const cell = new Uint8Array(NC), occ = new Uint8Array(NC), ocT = new Float64Array(NC), crackT = new Float64Array(NC);
  /** Buildings: [state, holes, timer, floors removed, drop (1 → 0), shake] per building. */
  const B = new Float64Array(NB * 6);
  /** Soldiers: [alive, x, z, dir, state (0 walk, 1 aim), timer, want, step] per soldier. */
  const SO = new Float64Array(NS * 8);
  /** Pebbles: [life, x, y, z, vx, vy, vz, from heli] per pebble. */
  const PB = new Float64Array(NP * 8);
  /** Parachutes: [life, x, y, z, vx, vy, kind (1 person, 2 soldier), landed, t] per chute. */
  const CH = new Float64Array(NCH * 9);
  /** The helicopter: [0] state (0 away, 1 flying, 2 falling), x, y, z, vx, vy, [6] fire timer, [7] burst left, [8] away timer, [9] spin, [10] t, [11] tilt. */
  const HE = new Float64Array(12);
  const ev = new Float64Array(64);
  /** Spawn timers: [0] soldiers, [1] new people at windows. */
  const T = new Float64Array(2);
  const run = {
    S, M, cell, occ, B, SO, PB, CH, HE, ev, n: 0, crackT,
    reset, step, clear, autopilot, top, yOff, cellAt, standing, inFront,
  };

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
  /** The building whose face spans x (inset by `m`), standing, or −1. */
  function inFront(x: number, m: number) {
    for (let b = 0; b < NB; b++) {
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      if (x >= x0 + m && x <= x0 + w - m && standing(b)) return b;
    }
    return -1;
  }
  /** The cell of building b at world (x, y), or −1 (a floor already down, outside the face). */
  function cellAt(b: number, x: number, y: number) {
    const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, col = Math.floor(x - x0), fl = Math.floor(y - yOff(b));
    if (col < 0 || col >= w || fl < B[b * 6 + 3]! || fl >= f) return -1;
    return C0[b]! + fl * w + col;
  }

  function reset(s = seed) {
    rnd.state = s;
    S.fill(0);
    M.fill(0);
    M[0] = -3.6; M[2] = ZS; M[6] = 1; M[7] = MAX_HP; M[12] = -1;
    cell.fill(INTACT);
    occ.fill(0);
    ocT.fill(0);
    crackT.fill(0);
    B.fill(0);
    SO.fill(0);
    PB.fill(0);
    CH.fill(0);
    HE.fill(0);
    HE[8] = 6;
    T[0] = 2.5;
    T[1] = 1.5;
    for (let b = 0; b < NB; b++) {
      const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      for (let fl = 0; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c, r = rnd();
        occ[i] = r < 0.16 ? 1 : r < 0.22 && fl > 0 ? 2 : 0;
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
  function pebble(x: number, y: number, z: number, speed: number, heli: number) {
    let j = -1;
    for (let i = 0; i < NP; i++) if (PB[i * 8]! <= 0) { j = i; break; }
    if (j < 0) return;
    // Aimed at the monster's chest, with a little scatter.
    const tx = M[0]! + (rnd() - 0.5) * 1.1, ty = M[1]! + 2.1 + (rnd() - 0.5) * 1.1, tz = M[2]!;
    const dx = tx - x, dy = ty - y, dz = tz - z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, o = j * 8;
    PB[o] = 2.4; PB[o + 1] = x; PB[o + 2] = y; PB[o + 3] = z;
    PB[o + 4] = (dx / l) * speed; PB[o + 5] = (dy / l) * speed; PB[o + 6] = (dz / l) * speed; PB[o + 7] = heli;
    emit(E_SHOT, heli);
  }
  function hurt(n: number) {
    if (M[15]! > 0 || M[5] === KO || S[0] !== RUN) return;
    M[7] = Math.max(0, M[7]! - n);
    M[11] = 0.3;
    M[15] = 0.12;
    emit(E_HURT, n);
    if (M[7]! <= 0) {
      M[5] = KO;
      M[3] = 0;
      M[4] = Math.max(0, M[4]!);
      M[12] = -1;
      emit(E_KO, 0);
      S[9] = 1.8;
    }
  }

  // ---- the buildings ----
  function hole(i: number, b: number) {
    if (cell[i] === HOLE) return false;
    cell[i] = HOLE;
    crackT[i] = 0.35;
    B[b * 6 + 1]!++;
    S[3]!++;
    S[2]! += 10;
    const w = BLD[b * 4 + 1]!, r = i - C0[b]!, fl = (r / w) | 0, c = r - fl * w;
    const x = BLD[b * 4]! + c + 0.5, y = yOff(b) + fl + 0.5;
    if (occ[i] === 1) chute(x, y, 0.3, 1, (rnd() - 0.5) * 2);
    else if (occ[i] === 2) chute(x, y, 0.3, 2, (rnd() - 0.5) * 2), S[7]!++, (S[2]! += 50);
    occ[i] = 0;
    // The neighbours crack.
    for (let k = 0; k < 4; k++) {
      const cc = c + (k === 0 ? -1 : k === 1 ? 1 : 0), ff = fl + (k === 2 ? -1 : k === 3 ? 1 : 0);
      if (cc < 0 || cc >= w || ff < 0 || ff >= BLD[b * 4 + 2]!) continue;
      const j = C0[b]! + ff * w + cc;
      if (cell[j] === INTACT && rnd() < 0.55) cell[j] = CRACKED;
    }
    emit(E_HOLE, i);
    if (B[b * 6] === STAND && B[b * 6 + 1]! >= NEED[b]!) (B[b * 6] = SHAKE), (B[b * 6 + 2] = SHAKE_T), emit(E_SHAKE, b);
    return true;
  }
  /** Punch the face of building b near (x, y): the nearest window that is not a hole yet. */
  function punchFace(b: number, x: number, y: number) {
    const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, rem = B[b * 6 + 3]!;
    const c0 = Math.max(0, Math.min(w - 1, Math.floor(x - x0))), f0 = Math.floor(y - yOff(b));
    if (f0 < rem - 2 || f0 > f) return false;
    let best = -1, bd = 9;
    for (let df = -2; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
      const fl = f0 + df, c = c0 + dc;
      if (fl < rem || fl >= f || c < 0 || c >= w) continue;
      const i = C0[b]! + fl * w + c;
      if (cell[i] === HOLE) continue;
      const d = Math.abs(df) * 1.1 + Math.abs(dc) + (dc * M[6]! < 0 ? 0.3 : 0);
      if (d < bd) (bd = d), (best = i);
    }
    return best >= 0 && hole(best, b);
  }
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
          B[o + 4] = fl + 1 < f ? 1 : 0;
          S[8]!++;
          S[2]! += 40;
          emit(E_FLOOR, b);
          if (fl + 1 >= f) {
            B[o] = RUBBLE;
            B[o + 5] = 0;
            S[4]!++;
            S[2]! += 500;
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
    if (M[12] !== b || (M[5] !== CLIMB && M[5] !== ROOF)) return;
    M[5] = AIR;
    M[12] = -1;
    M[3] = M[6]! * 2;
    M[4] = 3;
  }

  // ---- the monster ----
  function fist() {
    const md = M[5]!, f = M[6]!;
    if (md === CLIMB) (M[16] = M[0]! + f * 1.25), (M[17] = M[1]! + CLIMB_FIST);
    else if (md === ROOF) (M[16] = M[0]! + f * 2), (M[17] = M[1]! + 2.4);
    else (M[16] = M[0]! + f * 1.95), (M[17] = M[1]! + 1.6);
  }
  function punch() {
    M[8] = PUNCH_CD;
    M[9] = 1;
    fist();
    const fx = M[16]!, fy = M[17]!, md = M[5]!;
    emit(E_PUNCH, 0);
    // The helicopter first (a jump or a roof gets you up to it).
    if (HE[0] === 1 && Math.abs(HE[1]! - fx) < 2 && Math.abs(HE[2]! - fy) < 1.7) {
      HE[0] = 2;
      HE[4] = M[6]! * 4;
      HE[5] = 2;
      S[5]!++;
      S[2]! += 250;
      emit(E_HELI, 0);
      return;
    }
    let hit = false;
    // Soldiers on the street, from the street.
    if ((md === WALK || md === AIR) && M[1]! < 2.5)
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.5) {
          SO[o] = 0;
          chute(SO[o + 1]!, 0.6, SO[o + 2]!, 2, M[6]! * 3);
          S[7]!++;
          S[2]! += 50;
          emit(E_FLING, s);
          hit = true;
        }
      }
    // The face in front: the one climbed, or the one at the fist.
    let b = md === CLIMB ? M[12]! : -1;
    if (b < 0 && md !== ROOF && M[2]! < ZS + 0.6) b = inFront(fx, -0.35);
    if (b >= 0 && standing(b) && punchFace(b, fx, fy)) hit = true;
    else if (md === CLIMB) {
      // At the face's edge the fist may reach the next one over.
      const b2 = inFront(fx, -0.2);
      if (b2 >= 0 && b2 !== b && punchFace(b2, fx, fy)) hit = true;
    }
    if (!hit) emit(E_WHIFF, 0);
  }
  function grab() {
    M[14] = GRAB_CD;
    M[10] = 1;
    fist();
    const fx = M[16]!, fy = M[17]! + 0.2, md = M[5]!;
    // A person at a window within reach.
    let best = -1, bd = 2.2;
    for (let b = 0; b < NB; b++) {
      if (!standing(b) || (md !== CLIMB && md !== ROOF && M[2]! > ZS + 0.6)) continue;
      const x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!;
      if (fx < x0 - 1.5 || fx > x0 + w + 1.5) continue;
      for (let fl = B[b * 6 + 3]!; fl < f; fl++) for (let c = 0; c < w; c++) {
        const i = C0[b]! + fl * w + c;
        if (!occ[i]) continue;
        const dx = x0 + c + 0.5 - fx, dy = yOff(b) + fl + 0.5 - fy, d = Math.abs(dx) + Math.abs(dy) * 0.8;
        if (d < bd) (bd = d), (best = i);
      }
    }
    if (best >= 0) {
      const kind = occ[best]!;
      occ[best] = 0;
      return snack(kind === 2 ? 12 : 16);
    }
    // A soldier off the street.
    if (md === WALK || (md === AIR && M[1]! < 2))
      for (let s = 0; s < NS; s++) {
        const o = s * 8;
        if (SO[o]! > 0 && Math.abs(SO[o + 1]! - fx) < 1.7) return void ((SO[o] = 0), S[7]!++, snack(12));
      }
    // A parachute in reach.
    for (let k = 0; k < NCH; k++) {
      const o = k * 9;
      if (CH[o]! > 0 && !CH[o + 7] && Math.abs(CH[o + 1]! - fx) < 1.3 && Math.abs(CH[o + 2]! - fy) < 1.4) return void ((CH[o] = 0), snack(16));
    }
    emit(E_WHIFF, 1);
  }
  function snack(hp: number) {
    M[7] = Math.min(MAX_HP, M[7]! + hp);
    M[18] = 0.6;
    S[6]!++;
    S[2]! += 100;
    emit(E_NOM, hp);
  }
  function stepMonster(dt: number, mx: number, my: number, jump: number) {
    const md = M[5]!;
    if (Math.abs(mx) > 0.25 && md !== KO) M[6] = mx > 0 ? 1 : -1;
    M[8] = Math.max(0, M[8]! - dt); M[11] = Math.max(0, M[11]! - dt); M[14] = Math.max(0, M[14]! - dt); M[15] = Math.max(0, M[15]! - dt); M[18] = Math.max(0, M[18]! - dt);
    M[9] = Math.max(0, M[9]! - dt * 4.5); M[10] = Math.max(0, M[10]! - dt * 3.5); M[19] = Math.max(0, M[19]! - dt * 5);
    if (md === WALK) {
      M[3] = mx * 5.2;
      M[0] = M[0]! + M[3]! * dt;
      M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 8);
      M[13] = M[13]! + Math.abs(M[3]!) * dt * 1.3;
      const b = inFront(M[0]!, 0.45);
      if (my > 0.5 && b >= 0) return void ((M[5] = CLIMB), (M[12] = b), (M[1] = 0.05), emit(E_CLIMB, b));
      if (jump) (M[5] = AIR), (M[4] = 11), emit(E_JUMP, 0);
    } else if (md === AIR || md === KO) {
      if (md === AIR) M[3] = M[3]! + (mx * 4.8 - M[3]!) * Math.min(1, dt * 6);
      else M[3] = M[3]! * (1 - dt * 3);
      M[4] = M[4]! - G * dt;
      M[0] = M[0]! + M[3]! * dt;
      const y0 = M[1]!;
      M[1] = y0 + M[4]! * dt;
      // A roof under it, if it came from that height.
      const rb = inFront(M[0]!, 0.1);
      const over = rb >= 0 && M[2]! < ZC - 0.2 && y0 >= top(rb) - 0.05;
      if (!over) M[2] = M[2]! + (ZS - M[2]!) * Math.min(1, dt * 7);
      if (over && M[4]! <= 0 && M[1]! <= top(rb)) return void ((M[1] = top(rb)), (M[4] = 0), (M[5] = md === KO ? KO : ROOF), (M[12] = rb), (M[19] = 1), emit(E_LAND, 1));
      // Catch a face on the way (up held).
      const fb = inFront(M[0]!, 0.45);
      if (md === AIR && my > 0.4 && fb >= 0 && M[1]! < top(fb) - CLIMB_TOP && M[1]! > 0.2) return void ((M[5] = CLIMB), (M[12] = fb), (M[4] = 0), emit(E_CLIMB, fb));
      if (M[1]! <= 0) {
        const fall = -M[4]!;
        M[1] = 0;
        M[4] = 0;
        M[5] = md === KO ? KO : WALK;
        M[12] = -1;
        M[19] = Math.min(1, fall / 12);
        emit(E_LAND, 0);
        // Landing on soldiers flattens their plans (they bounce off with a parachute).
        for (let s = 0; s < NS; s++) {
          const o = s * 8;
          if (SO[o]! > 0 && Math.abs(SO[o + 1]! - M[0]!) < 1.6 && fall > 4) (SO[o] = 0), chute(SO[o + 1]!, 0.5, SO[o + 2]!, 2, (SO[o + 1]! - M[0]! > 0 ? 1 : -1) * 3), S[7]!++, (S[2]! += 50), emit(E_STOMP, s);
        }
      }
    } else if (md === CLIMB) {
      const b = M[12]!, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!, tp = top(b);
      M[2] = M[2]! + (ZC - M[2]!) * Math.min(1, dt * 9);
      M[1] = M[1]! + my * 3.4 * dt;
      M[0] = M[0]! + mx * 2.8 * dt;
      M[13] = M[13]! + (Math.abs(my) + Math.abs(mx) * 0.6) * dt * 2;
      const hi = tp - CLIMB_TOP;
      if (M[1]! > hi) M[1] = hi;
      if (M[1]! >= hi - 0.01 && my > 0.5) return void ((M[5] = ROOF), (M[1] = tp), (M[2] = ZR), (M[19] = 0.6), emit(E_LAND, 2));
      if (M[1]! <= 0 && my < -0.3) return void ((M[1] = 0), (M[5] = WALK), (M[12] = -1));
      if (M[1]! < 0) M[1] = 0;
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 7), (M[3] = M[6]! * 4), emit(E_JUMP, 1));
      if (M[0]! < x0 + 0.3 || M[0]! > x0 + w - 0.3) {
        // At the edge: reach across the gap to the next face if it stands this high; else let go.
        const s = M[0]! < x0 + 0.3 ? -1 : 1, nb = b + s;
        const ok = mx * s > 0.25 && nb >= 0 && nb < NB && standing(nb) && top(nb) - CLIMB_TOP >= M[1]! && Math.abs(BLD[nb * 4]! + (s > 0 ? 0 : BLD[nb * 4 + 1]!) - M[0]!) < 1.3;
        if (ok) (M[12] = nb), (M[0] = s > 0 ? BLD[nb * 4]! + 0.35 : BLD[nb * 4]! + BLD[nb * 4 + 1]! - 0.35), emit(E_CLIMB, nb);
        else if (M[0]! < x0 || M[0]! > x0 + w) {
          if (M[1]! < 0.3) (M[5] = WALK), (M[12] = -1);
          else (M[5] = AIR), (M[12] = -1), (M[4] = 0), (M[3] = mx * 3);
        }
      }
    } else if (md === ROOF) {
      const b = M[12]!, x0 = BLD[b * 4]!, w = BLD[b * 4 + 1]!;
      M[1] = top(b);
      M[0] = M[0]! + mx * 4 * dt;
      M[13] = M[13]! + Math.abs(mx) * 4 * dt * 1.3;
      if (my < -0.5) return void ((M[5] = CLIMB), (M[1] = top(b) - CLIMB_TOP), (M[2] = ZC - 0.4));
      if (jump) return void ((M[5] = AIR), (M[12] = -1), (M[4] = 10), (M[3] = mx * 4.8), emit(E_JUMP, 2));
      if (M[0]! < x0 + 0.1 || M[0]! > x0 + w - 0.1) (M[5] = AIR), (M[12] = -1), (M[4] = 2), (M[3] = mx * 4.8);
    }
    if (M[0]! < -SX) M[0] = -SX;
    if (M[0]! > SX) M[0] = SX;
  }

  // ---- the army ----
  function stepArmy(dt: number) {
    const t = S[1]!, mx = M[0]!;
    // Soldiers walk in from the ends, stop at their range, and throw.
    T[0]! -= dt;
    if (T[0]! <= 0) {
      T[0] = Math.max(1.7, 3.6 - t * 0.035) * (0.7 + rnd() * 0.6);
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
      const dx = mx - SO[o + 1]!, d = Math.abs(dx);
      SO[o + 3] = dx > 0 ? 1 : -1;
      if (d > SO[o + 6]! + 0.5) (SO[o + 1] = SO[o + 1]! + SO[o + 3]! * 2.6 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else if (d < SO[o + 6]! - 1.2) (SO[o + 1] = SO[o + 1]! - SO[o + 3]! * 2.2 * dt), (SO[o + 4] = 0), (SO[o + 7] = SO[o + 7]! + dt * 9);
      else SO[o + 4] = 1;
      SO[o + 5]! -= dt;
      if (SO[o + 5]! <= 0 && d < 11) (SO[o + 5] = 1.9 + rnd() * 1.2), pebble(SO[o + 1]! + SO[o + 3]! * 0.2, 0.55, SO[o + 2]!, 8, 0);
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
      T[1] = 1.1 + rnd() * 0.8;
      const b = Math.floor(rnd() * NB);
      if (B[b * 6] === STAND) {
        const w = BLD[b * 4 + 1]!, f = BLD[b * 4 + 2]!, i = C0[b]! + Math.floor(rnd() * f) * w + Math.floor(rnd() * w);
        if (cell[i] !== HOLE && !occ[i]) (occ[i] = rnd() < 0.3 ? 2 : 1), (ocT[i] = 2 + rnd() * 2);
      }
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
      const ht = HE[10]!, tx = mx + Math.cos(ht * 0.55) * (3.8 + Math.sin(ht * 0.37) * 2.3), ty = Math.min(11.5, Math.max(5, M[1]! + 4.3 + Math.sin(ht * 1.3) * 1.3));
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
    // Pebbles fly; one that reaches the monster stings.
    for (let k = 0; k < NP; k++) {
      const o = k * 8;
      if (PB[o]! <= 0) continue;
      PB[o]! -= dt;
      PB[o + 1] = PB[o + 1]! + PB[o + 4]! * dt; PB[o + 2] = PB[o + 2]! + PB[o + 5]! * dt; PB[o + 3] = PB[o + 3]! + PB[o + 6]! * dt;
      const dx = PB[o + 1]! - M[0]!, dy = PB[o + 2]! - (M[1]! + 2), dz = PB[o + 3]! - M[2]!;
      if (M[5] !== KO && dx * dx + dy * dy * 0.45 + dz * dz * 0.4 < 1.7) (PB[o] = 0), hurt(PB[o + 7] ? 5 : 4);
      else if (PB[o + 2]! < 0) PB[o] = 0;
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
        if (CH[o + 2]! <= 0) (CH[o + 2] = 0), (CH[o + 7] = 1), (CH[o + 4] = CH[o + 1]! > M[0]! ? 4.5 : -4.5);
      } else {
        CH[o + 1] = CH[o + 1]! + CH[o + 4]! * dt;
        if (Math.abs(CH[o + 1]!) > SX + 2) CH[o] = 0;
      }
    }
  }

  function step(dt: number, mx: number, my: number, p: number, jump: number, g: number) {
    const ph = S[0]!;
    if (ph === DONE) return stepFall(dt);
    if (ph === READY) {
      if (!(p || jump || g || Math.abs(mx) > 0.3 || Math.abs(my) > 0.3)) return false;
      S[0] = RUN;
      emit(E_START, 0);
    }
    S[1] = S[1]! + dt;
    stepMonster(dt, M[5] === KO ? 0 : mx, M[5] === KO ? 0 : my, M[5] === KO ? 0 : jump);
    if (M[5] !== KO) {
      if (p) M[20] = 0.3;
      if (g) M[21] = 0.3;
      if (M[20]! > 0 && M[8]! <= 0) (M[20] = 0), punch();
      if (M[21]! > 0 && M[14]! <= 0) (M[21] = 0), grab();
      M[20] = Math.max(0, M[20]! - dt);
      M[21] = Math.max(0, M[21]! - dt);
    }
    stepBuildings(dt);
    stepArmy(dt);
    if (S[9]! > 0) {
      S[9]! -= dt;
      if (S[9]! <= 0) end();
    } else if (S[4] === NB) S[9] = 1.6;
    return true;
  }
  /** After the end: what is still falling settles (a last floor, a parachute). */
  function stepFall(dt: number) {
    let any = false;
    for (let b = 0; b < NB; b++) if (B[b * 6 + 4]! > 0) (B[b * 6 + 4] = Math.max(0, B[b * 6 + 4]! - dt / DROP_T)), (any = true);
    if (M[1]! > 0 || M[19]! > 0 || M[9]! > 0) {
      M[4] = M[4]! - G * dt;
      M[1] = Math.max(0, M[1]! + M[4]! * dt);
      if (M[1] === 0) M[4] = 0;
      M[19] = Math.max(0, M[19]! - dt * 5);
      M[9] = Math.max(0, M[9]! - dt * 4.5);
      any = true;
    }
    return any;
  }
  function end() {
    S[0] = DONE;
    S[9] = 0;
    if (S[2]! > S[10]!) S[10] = S[2]!;
    emit(E_END, S[4] === NB ? 1 : 0);
  }

  // ---- the autopilot (the poster, the tests): the nearest standing building, up its face, punch;
  // swat the helicopter when it comes near, snack when hurt. ----
  const A = new Float64Array(4); // [0] target building, [1] hold timer, [2] jump cool, [3] punch alt
  function autopilot(I: Float64Array) {
    I[0] = I[1] = I[2] = I[3] = I[4] = 0;
    if (S[0] === DONE || M[5] === KO) return;
    if (S[0] === READY) return void (I[0] = 0.6);
    const x = M[0]!, md = M[5]!;
    let tb = A[0]!;
    if (tb < 0 || !standing(tb) || B[tb * 6] !== STAND) {
      tb = -1;
      let bd = Infinity;
      for (let b = 0; b < NB; b++) {
        if (B[b * 6] !== STAND) continue;
        const cx = BLD[b * 4]! + BLD[b * 4 + 1]! / 2, d = Math.abs(cx - x);
        if (d < bd) (bd = d), (tb = b);
      }
      A[0] = tb;
    }
    // The helicopter in reach: face it and punch (a jump if it is above the fist).
    fist();
    if (HE[0] === 1 && Math.abs(HE[1]! - x) < 2.6 && HE[2]! - M[17]! < 3.2 && HE[2]! - M[17]! > -1.5) {
      I[0] = HE[1]! > x ? 0.3 : -0.3;
      if (Math.abs(HE[2]! - M[17]!) < 1.4) I[2] = 1;
      else if (md === WALK && A[2]! <= 0) (I[3] = 1), (A[2] = 0.8);
      else if (md === CLIMB) I[1] = Math.max(-1, Math.min(1, (HE[2]! - M[17]!) * 2));
    }
    A[2] = Math.max(0, A[2]! - 1 / 60);
    if (I[2] || I[1]) return;
    // Hungry: grab what is near.
    if (M[7]! < 70 && M[14]! <= 0) I[4] = 1;
    if (tb < 0) return;
    const x0 = BLD[tb * 4]!, w = BLD[tb * 4 + 1]!, cx = x0 + w / 2;
    if (md === WALK || md === AIR) {
      if (Math.abs(cx - x) > 0.6) I[0] = cx > x ? 1 : -1;
      else I[1] = 1;
      // Soldiers at the fist on the way.
      for (let s = 0; s < NS; s++) if (SO[s * 8]! > 0 && Math.abs(SO[s * 8 + 1]! - M[16]!) < 1.3) I[2] = 1;
    } else if (md === CLIMB) {
      if (M[12] !== tb) return void (I[1] = -1);
      // Work the face: climb to the lowest row with windows left, sweep across it, punch.
      const f = BLD[tb * 4 + 2]!, rem = B[tb * 6 + 3]!;
      let row = -1;
      for (let fl = rem; fl < f && row < 0; fl++) for (let c = 0; c < w; c++) if (cell[C0[tb]! + fl * w + c] !== HOLE) { row = fl; break; }
      const wantY = Math.max(0, Math.min(top(tb) - CLIMB_TOP, row + 0.5 - CLIMB_FIST + yOff(tb)));
      I[1] = Math.abs(wantY - M[1]!) > 0.15 ? Math.max(-1, Math.min(1, (wantY - M[1]!) * 2)) : 0;
      A[1] = A[1]! + 1 / 60;
      const sweep = Math.sin(A[1]! * 1.4) * (w / 2 - 0.6);
      I[0] = Math.max(-1, Math.min(1, (cx + sweep - x) * 1.5));
      if (Math.abs(I[0]!) < 0.25) I[0] = A[3]! > 0 ? 0.26 : -0.26;
      if (M[8]! <= 0) (I[2] = 1), (A[3] = -A[3]! || 1);
    } else if (md === ROOF) I[1] = -1;
  }

  reset();
  return run;
}
export type BlockRun = ReturnType<typeof blockRun>;
