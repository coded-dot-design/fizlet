// npm i fizlet, the game on plain numbers (no DOM: the GC test steps it in Node). Bricks ride a belt
// across the top; an order card says what this thing needs (a blaster: kernel, input, fx, sound).
// Tap a brick (or press Space when it's over the chute) and it drops into the box: one the order
// needs snaps in; one it doesn't bounces back out ("+1,265 B you don't need": you pay only for what
// you use). A full order ships: the lid shuts, "added 1 package", the box slides off and the next
// order comes in. With no input the belt coasts to a stop and the scene sleeps.
// Every step writes typed arrays only: no objects, no strings, no closures (tests/launch-day.test.mjs).

/** Belt geometry (art units, 160 × 90). */
export const BW = 27, BH = 14, BELT_Y = 21, SLOTS = 6, GAP = 32, LOOP = SLOTS * GAP, CHUTE = 95;
/** The box (top left, size) and where it rests. */
export const BOX_X = 72, BOX_Y = 62, BOX_W = 46, BOX_H = 24;
/** Modes. */
export const INTRO = 0, IDLE = 1, PLAY = 2;
/** State slots. */
export const T = 0, MODE = 1, SPEED = 2, TARGET = 3, POS = 4, QUIET = 5, ORDER = 6, HAVE = 7, SHIP = 8, SHIPPED = 9, DEMO = 10, NOPES = 11, BOXX = 12, LID = 13, SNAP = 14, NHAVE = 15, OT = 16, STREAK = 17, CLEAN = 18, LAST = 19;
/** Word kinds: a snap (+kernel 3,413 B), "+N B you don't need" (value: the brick), "added 1 package", "already in". */
export const W_SNAP = 0, W_NOPE = 1, W_ADDED = 2, W_DUP = 3;
const FN = 4, WN = 6, PN = 160;

export type NpmSim = ReturnType<typeof npmSim>;

/**
 * The game for `bricks` kinds and `orders` (each a list of brick kinds, kernel first). `rnd` is
 * the engine's seeded random; `emit(type)` reports "grab", "snap", "nope", "ship" (for sound).
 */
export function npmSim(bricks: number, orders: number[][], rnd: () => number, emit: (type: string) => void) {
  const S = new Float64Array(20);
  const belt = new Int8Array(SLOTS);
  // Flying bricks: kind (-1 free), from x, y, age, good (1 snaps, 0 bounces), bounce vx, vy.
  const FK = new Int8Array(FN).fill(-1), FX = new Float32Array(FN), FY = new Float32Array(FN), FT = new Float32Array(FN), FG = new Uint8Array(FN), FVX = new Float32Array(FN), FVY = new Float32Array(FN);
  // In the box, in the order they landed.
  const IN = new Int8Array(8).fill(-1);
  // Words: kind, value, x, y, age (≥ 1.4: gone).
  const WK = new Uint8Array(WN), WV = new Int16Array(WN), WX = new Float32Array(WN), WY = new Float32Array(WN), WT = new Float32Array(WN).fill(9);
  // Particles: x, y, vx, vy, life left, colour slot.
  const PX = new Float32Array(PN), PY = new Float32Array(PN), PVX = new Float32Array(PN), PVY = new Float32Array(PN), PL = new Float32Array(PN), PC = new Uint8Array(PN);
  const cur = new Int32Array(2); // word cursor, particle cursor
  // Orders as bit masks.
  const MASK = new Int32Array(orders.length);
  for (let o = 0; o < orders.length; o++) for (const k of orders[o]!) MASK[o] = MASK[o]! | (1 << k);
  for (let i = 0; i < SLOTS; i++) belt[i] = (i * 5 + 1) % bricks;
  // The first order's bricks are on the first belt (the kernel in the middle: the demo takes it).
  for (let j = 0; j < orders[0]!.length; j++) belt[[2, 4, 0, 5][j % 4]!] = orders[0]![j]!;
  S[TARGET] = 28;
  S[DEMO] = 1.05;
  S[BOXX] = BOX_X;
  (S[CLEAN] = 1), (S[LAST] = -1);

  const slotX = (i: number) => ((S[POS]! + i * GAP) % LOOP + LOOP) % LOOP - BW;
  const need = (k: number) => (MASK[S[ORDER]!]! >> k) & 1;
  const has = (k: number) => (S[HAVE]! >> k) & 1;

  function word(kind: number, v: number, x: number, y: number) {
    const i = cur[0]!;
    cur[0] = (i + 1) % WN;
    (WK[i] = kind), (WV[i] = v), (WX[i] = x), (WY[i] = y), (WT[i] = 0);
  }
  function burst(x: number, y: number, n: number, c: number, spread: number) {
    for (let k = 0; k < n; k++) {
      const i = cur[1]!;
      cur[1] = (i + 1) % PN;
      const a = rnd() * 6.2832, s = spread * (0.4 + rnd() * 0.8);
      (PX[i] = x), (PY[i] = y), (PVX[i] = Math.cos(a) * s), (PVY[i] = Math.sin(a) * s - spread * 0.6), (PL[i] = 0.5 + rnd() * 0.5), (PC[i] = c);
    }
  }
  /** Which belt slot is under (x, y), or -1. */
  function slotAt(x: number, y: number) {
    if (y < BELT_Y - 6 || y > BELT_Y + BH + 6) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < SLOTS; i++) {
      if (belt[i]! < 0) continue;
      const d = Math.abs(slotX(i) + BW / 2 - x);
      if (d < BW / 2 + 4 && d < bd) (bd = d), (best = i);
    }
    return best;
  }
  /** Take belt slot i: the brick drops toward the box. */
  function grab(i: number) {
    const k = belt[i]!;
    if (k < 0) return false;
    let f = -1;
    for (let j = 0; j < FN; j++) if (FK[j]! < 0) { f = j; break; }
    if (f < 0) return false;
    belt[i] = -1;
    (FK[f] = k), (FX[f] = slotX(i)), (FY[f] = BELT_Y), (FT[f] = 0), (FVY[f] = 0), (FG[f] = need(k) && !has(k) && S[SHIP]! < 0 ? 1 : 0);
    // The box takes it now (so a second of the same one bounces).
    if (FG[f]) S[HAVE] = S[HAVE]! | (1 << k);
    emit("grab");
    return true;
  }
  function play() {
    if (S[MODE] !== PLAY) (S[MODE] = PLAY), (S[DEMO] = -1);
    S[QUIET] = 0;
    S[TARGET] = 28;
  }

  S[SHIP] = -1;
  return {
    S, belt, FK, FX, FY, FT, FG, FVX, IN, WK, WV, WX, WY, WT, PX, PY, PL, PC, MASK,
    slotX,
    need,
    /** A tap at (x, y) art units: a brick on the belt there drops. */
    tap(x: number, y: number) {
      play();
      const i = slotAt(x, y);
      return i >= 0 && grab(i);
    },
    /** The key (Space): the brick over the chute drops. */
    key() {
      play();
      let best = -1, bd = 1e9;
      for (let i = 0; i < SLOTS; i++) {
        if (belt[i]! < 0) continue;
        const d = Math.abs(slotX(i) + BW / 2 - CHUTE);
        if (d < bd) (bd = d), (best = i);
      }
      return best >= 0 && bd < GAP / 2 + 2 && grab(best);
    },
    /** One step; true while anything moves. */
    step(dt: number) {
      S[T] = S[T]! + dt;
      if (S[MODE] === INTRO) {
        if (S[DEMO]! > 0 && S[T]! >= S[DEMO]!) {
          S[DEMO] = -1;
          for (let i = 0; i < SLOTS; i++) if (belt[i] === 0 && slotX(i) > 10) grab(i);
        }
        if (S[T]! > 2.4) S[TARGET] = 0;
      } else if (S[MODE] === PLAY) {
        S[QUIET] = S[QUIET]! + dt;
        if (S[QUIET]! > 6) S[TARGET] = 0;
      }
      // The belt eases to its speed; a slot that wraps round the left comes back with a new brick,
      // more often one the order still needs.
      S[SPEED] = S[SPEED]! + (S[TARGET]! - S[SPEED]!) * Math.min(1, dt * (S[TARGET]! > S[SPEED]! ? 3 : 1.6));
      if (S[SPEED]! < 0.05 && S[TARGET] === 0) {
        S[SPEED] = 0;
        if (S[MODE] !== IDLE && S[T]! > 2) S[MODE] = IDLE;
      }
      for (let i = 0; i < SLOTS; i++) {
        const was = slotX(i);
        if (was + S[SPEED]! * dt > LOOP - BW) {
          let k = (rnd() * bricks) | 0;
          if (rnd() < 0.7) {
            const m = MASK[S[ORDER]!]! & ~S[HAVE]!;
            if (m) for (let j = 0, r = (rnd() * bricks) | 0; j < bricks; j++) if ((m >> ((r + j) % bricks)) & 1) { k = (r + j) % bricks; break; }
          }
          belt[i] = k;
        }
      }
      S[POS] = (S[POS]! + S[SPEED]! * dt) % LOOP;
      let moving = S[SPEED]! > 0 ? 1 : 0;
      // Flying bricks: a good one drops into the box and snaps; a bad one hits the lip and bounces off.
      for (let f = 0; f < FN; f++) {
        const k = FK[f]!;
        if (k < 0) continue;
        moving = 1;
        FT[f] = FT[f]! + dt;
        if (FG[f]) {
          if (FT[f]! >= 0.36) {
            FK[f] = -1;
            let n = 0;
            while (n < 8 && IN[n]! >= 0) n++;
            if (n < 8) IN[n] = k;
            S[NHAVE] = n + 1;
            S[SNAP] = 0.25;
            word(W_SNAP, k, S[BOXX]! + BOX_W / 2, BOX_Y - 6);
            burst(S[BOXX]! + BOX_W / 2, BOX_Y, 10, 5, 34);
            emit("snap");
            if ((S[HAVE]! & MASK[S[ORDER]!]!) === MASK[S[ORDER]!]) (S[SHIP] = 0), word(W_ADDED, S[ORDER]!, S[BOXX]! + BOX_W / 2, BOX_Y - 21), emit("ship");
          }
        } else if (FT[f]! < 0.3) {
          // falling toward the lip
        } else {
          if (FVY[f] === 0) {
            (FVX[f] = (FX[f]! + BW / 2 < S[BOXX]! + BOX_W / 2 ? -1 : 1) * 46), (FVY[f] = -50);
            FX[f] = FX[f]! + (S[BOXX]! + (BOX_W - BW) / 2 - FX[f]!);
            FY[f] = BOX_Y - BH - 1;
            word(has(k) && need(k) ? W_DUP : W_NOPE, k, S[BOXX]! + BOX_W / 2, BOX_Y - 17);
            burst(S[BOXX]! + BOX_W / 2, BOX_Y - 2, 6, 2, 26);
            S[NOPES] = S[NOPES]! + 1;
            S[CLEAN] = 0;
            emit("nope");
          }
          FVY[f] = FVY[f]! + 160 * dt;
          FX[f] = FX[f]! + FVX[f]! * dt;
          FY[f] = FY[f]! + FVY[f]! * dt;
          if (FY[f]! > 100 || FX[f]! < -40 || FX[f]! > 200) (FK[f] = -1), (FVY[f] = 0);
        }
      }
      // Shipping: the lid shuts, the box slides off right, a new empty one slides in from the left.
      if (S[SHIP]! >= 0) {
        moving = 1;
        const t = (S[SHIP] = S[SHIP]! + dt);
        S[LID] = Math.min(1, t / 0.35);
        if (t > 0.9) S[BOXX] = BOX_X + (t - 0.9) * (t - 0.9) * 400;
        if (t > 1.5 && S[BOXX]! > 170) {
          // A clean order (no brick it didn't need) adds to the streak; one bounce resets it.
          (S[STREAK] = S[CLEAN] ? S[STREAK]! + 1 : 0), (S[CLEAN] = 1), (S[LAST] = S[ORDER]!), (S[OT] = 0);
          (S[SHIP] = -2), (S[SHIPPED] = S[SHIPPED]! + 1), (S[ORDER] = (S[ORDER]! + 1) % MASK.length), (S[HAVE] = 0), (S[NHAVE] = 0), (S[LID] = 0), (S[BOXX] = -60);
          IN.fill(-1);
        }
      } else if (S[SHIP] === -2) {
        moving = 1;
        S[BOXX] = S[BOXX]! + (BOX_X - S[BOXX]!) * Math.min(1, dt * 9);
        if (Math.abs(S[BOXX]! - BOX_X) < 0.05) (S[BOXX] = BOX_X), (S[SHIP] = -1);
      }
      // The order card types its command in.
      if (S[OT]! < 0.8) (S[OT] = S[OT]! + dt), (moving = 1);
      S[SNAP] = Math.max(0, S[SNAP]! - dt);
      if (S[SNAP]! > 0) moving = 1;
      for (let i = 0; i < WN; i++) if (WT[i]! < 1.4) (WT[i] = WT[i]! + dt), (WY[i] = WY[i]! - dt * 6), (moving = 1);
      for (let i = 0; i < PN; i++) {
        if (PL[i]! <= 0) continue;
        moving = 1;
        PL[i] = PL[i]! - dt;
        PVY[i] = PVY[i]! + 90 * dt;
        PX[i] = PX[i]! + PVX[i]! * dt;
        PY[i] = PY[i]! + PVY[i]! * dt;
      }
      return moving === 1 || S[MODE] === PLAY && S[QUIET]! < 6.5;
    },
  };
}
