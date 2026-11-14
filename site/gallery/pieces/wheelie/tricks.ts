// Wheelie City's trick scorer, headless and game-agnostic (brick candidate: a ground-trick scorer
// beside dune's air scorer). Feed it each step: the nose angle, the balance point and its sweet
// spot, the ground speed, the throttle, and whether it is in the air. It calls a trick on once the
// nose has been up for a moment on the back wheel: a WHEELIE (on the gas) or a MANUAL (balanced off
// the gas), measures its distance, its time and the time held in the sweet spot, and banks it when
// the front comes down clean. A hop is banked on a landing, a stoppie (on the front wheel) as it ends. Tricks banked close together build a
// combo (×2 … ×6). Bonus flags (a crosswalk, a sprinkler, a grumpy neighbour) add to the trick in
// progress. A loop-out (or any crash) drops the trick and the combo. Zero allocation per step.

/** S: score, combo, trick on (0 none, 1 up), distance, time, sweet time, gas time, flags, gap since
 *  the last bank, last points, last kind, best wheelie m, best wheelie s, best manual m, hops, tricks,
 *  last bonus share, best combo. */
export const SC = 0, CB = 1, ON = 2, DIST = 3, TIME = 4, SWEET = 5, GAS = 6, FLAGS = 7, GAP = 8, PTS = 9, KIND = 10, BEST_W = 11, BEST_WS = 12, BEST_M = 13, HOPS = 14, COUNT = 15, BONUS = 16, TOP = 17;
/** Kinds. */
export const WHEELIE = 1, MANUAL = 2, HOP = 3, STOPPIE = 4;
/** Bonus flags. */
export const F_CROSS = 1, F_SPRINK = 2, F_GRUMP = 4, F_HOP = 8;
/** Returns of `step`: nothing, banked, dropped. */
export const NONE = 0, BANKED = 1;
const UP = 0.14, HOLD = 0.25, COMBO_GAP = 2.5, MAXCB = 5;

export function tricks() {
  const S = new Float64Array(18);
  let upT = 0;
  /** One step. Returns BANKED on the step a trick is banked (read S[PTS], S[KIND]). */
  function step(dt: number, nose: number, balance: number, sweet: number, speed: number, gas: number, air: boolean) {
    S[GAP] = S[GAP]! + dt;
    if (S[GAP]! > COMBO_GAP && !S[ON] && S[CB]! > 0) S[CB] = 0;
    if (air) return NONE;
    if (nose > UP) {
      upT += dt;
      if (!S[ON] && upT >= HOLD) (S[ON] = 1), (S[DIST] = S[TIME] = S[SWEET] = S[GAS] = 0);
      if (S[ON]) {
        S[DIST] = S[DIST]! + Math.abs(speed) * dt;
        S[TIME] = S[TIME]! + dt;
        if (Math.abs(balance - nose) < sweet) S[SWEET] = S[SWEET]! + dt;
        if (gas > 0.15) S[GAS] = S[GAS]! + dt;
      }
      return NONE;
    }
    upT = 0;
    return S[ON] ? bank() : NONE;
  }
  function bank() {
    const manual = S[GAS]! < S[TIME]! * 0.3, k = manual ? MANUAL : WHEELIE, f = S[FLAGS]!;
    let bonus = 0;
    if (f & F_CROSS) bonus += 0.5;
    if (f & F_SPRINK) bonus += 0.5;
    if (f & F_GRUMP) bonus += 0.5;
    if (f & F_HOP) bonus += 0.25;
    const base = (S[DIST]! * 10 + S[TIME]! * 20 + S[SWEET]! * 45) * (manual ? 1.5 : 1);
    if (S[GAP]! <= COMBO_GAP && S[COUNT]! > 0) S[CB] = Math.min(MAXCB, S[CB]! + 1);
    const pts = Math.round(base * (1 + bonus)) * (1 + S[CB]!);
    S[PTS] = pts; S[KIND] = k; S[BONUS] = bonus;
    S[SC] = S[SC]! + pts;
    if (k === WHEELIE && S[DIST]! > S[BEST_W]!) (S[BEST_W] = S[DIST]!), (S[BEST_WS] = S[TIME]!);
    if (k === MANUAL && S[DIST]! > S[BEST_M]!) S[BEST_M] = S[DIST]!;
    S[TOP] = Math.max(S[TOP]!, S[CB]!);
    S[COUNT] = S[COUNT]! + 1;
    S[ON] = 0; S[FLAGS] = 0; S[GAP] = 0;
    return BANKED;
  }
  /** A hop landed after `air` seconds; `wheelie`: it landed on the back wheel (the wheelie goes on). */
  function hop(air: number, wheelie: boolean) {
    if (air < 0.15) return NONE;
    S[HOPS] = S[HOPS]! + 1;
    if (wheelie && S[ON]) {
      S[FLAGS] = S[FLAGS]! | F_HOP;
      return NONE;
    }
    if (S[GAP]! <= COMBO_GAP && S[COUNT]! > 0) S[CB] = Math.min(MAXCB, S[CB]! + 1);
    const pts = Math.round(30 + air * 120) * (1 + S[CB]!);
    S[PTS] = pts; S[KIND] = HOP; S[BONUS] = 0;
    S[SC] = S[SC]! + pts;
    S[TOP] = Math.max(S[TOP]!, S[CB]!);
    S[COUNT] = S[COUNT]! + 1;
    S[GAP] = 0;
    return BANKED;
  }
  /** A stoppie (up on the front wheel) of `secs` seconds, banked as it comes down. */
  function stoppie(secs: number) {
    if (S[GAP]! <= COMBO_GAP && S[COUNT]! > 0) S[CB] = Math.min(MAXCB, S[CB]! + 1);
    const pts = Math.round(40 + secs * 90) * (1 + S[CB]!);
    S[PTS] = pts; S[KIND] = STOPPIE; S[BONUS] = 0;
    S[SC] = S[SC]! + pts;
    S[TOP] = Math.max(S[TOP]!, S[CB]!);
    S[COUNT] = S[COUNT]! + 1;
    S[GAP] = 0;
    return BANKED;
  }
  /** Add a bonus flag to the trick in progress (true if there is one). */
  function bonus(flag: number) {
    if (!S[ON]) return false;
    const had = (S[FLAGS]! & flag) !== 0;
    S[FLAGS] = S[FLAGS]! | flag;
    return !had;
  }
  /** A crash: the trick in progress and the combo are gone. */
  function drop() {
    S[ON] = 0; S[FLAGS] = 0; S[CB] = 0; upT = 0;
  }
  function reset() {
    S.fill(0);
    upT = 0;
  }
  return { S, step, hop, stoppie, bonus, drop, reset };
}
export type Tricks = ReturnType<typeof tricks>;
