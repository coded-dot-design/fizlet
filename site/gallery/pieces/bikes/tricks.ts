// Big Air's trick scorer: small and general on purpose (a brick candidate for any rider game that
// scores tricks in the air): it knows nothing about bikes, only which trick is held and how long,
// how far the rider has turned, and how the landing went. Per jump: `air(dt)` while airborne,
// `hold(id, amount, dt)` while a trick is out, `spin(rad)` with the pitch turned so far, then
// `land(err, ramp)` (points, or 0 for a bail) or `crash()`. Over a run it keeps the score, the
// combo (clean landings in a row that did something), the best jump, the tricks seen, and at the end
// `judges(seed)` gives five scores out of 100. No allocation: the state is typed arrays.

/** The tricks, by id (original names). */
export const TRICKS = ["SKY PLANK", "LANTERN", "PIXEL SPLIT", "CANNONBALL"];
/** Points per second held, per trick. */
const PER = [260, 220, 240, 200];
/** What `land` judged: no score (a hop), clean, sketchy. */
export const HOP = 0, CLEAN = 1, SKETCHY = 2;
/** S: score, combo, best jump, cleans, last points, last kind, crashes, jumps, flips, tricks seen
 *  (a bit per trick), last air, top combo, last flips. */
export const SC = 0, CB = 1, BEST = 2, CLEANS = 3, PTS = 4, KIND = 5, CRASHES = 6, JUMPS = 7, FLIPS = 8, SEEN = 9, AIRT = 10, TOP = 11, LFLIPS = 12;

export function tricks(o: { minAir?: number; clean?: number } = {}) {
  const minAir = o.minAir ?? 0.35, clean = o.clean ?? 0.3;
  const S = new Float64Array(14), J = new Float64Array(TRICKS.length + 3); // per jump: seconds per trick, air, turned, tricks used
  const JA = TRICKS.length, JT = JA + 1, JU = JA + 2, JD = new Float64Array(8);
  return {
    S,
    /** This jump so far: seconds per trick, then [air, turned, used]. */
    J,
    /** Five judges' scores (after `judges`). */
    JD,
    /** Airborne for dt more. */
    air(dt: number) {
      J[JA] = J[JA]! + dt;
    },
    /** Trick `id` out at `amount` (0..1) for dt: it scores once it is all the way out. */
    hold(id: number, amount: number, dt: number) {
      if (amount < 0.85) return;
      J[id] = J[id]! + dt;
      J[JU] = J[JU]! | (1 << id);
    },
    /** The pitch turned since take-off (radians, + back). */
    spin(rad: number) {
      J[JT] = rad;
    },
    /** Back on the ground `err` radians off the slope, on a down ramp or not: the points (0: a hop). */
    land(err: number, ramp: boolean) {
      const air = J[JA]!, turned = J[JT]!, flips = Math.round(Math.abs(turned) / 6.283185307179586 - 0.12);
      S[AIRT] = air;
      S[LFLIPS] = flips;
      if (air < minAir) return reset1(), HOP;
      let pts = Math.round(air * 80), used = 0;
      for (let i = 0; i < JA; i++) if (J[i]! > 0) (pts += Math.round(J[i]! * PER[i]!)), used++;
      pts += flips * 650;
      if (used > 1) pts = Math.round(pts * 1.25);
      if (used && flips) pts = Math.round(pts * 1.3);
      const ok = err <= clean, did = used > 0 || flips > 0;
      pts = Math.round(pts * (ok ? 1 : 0.55) * (ramp ? 1.15 : 0.8) * (1 + 0.25 * (ok && did ? S[CB]! : 0)));
      S[SC] = S[SC]! + pts;
      S[PTS] = pts;
      S[KIND] = ok ? CLEAN : SKETCHY;
      S[BEST] = Math.max(S[BEST]!, pts);
      S[JUMPS] = S[JUMPS]! + 1;
      S[FLIPS] = S[FLIPS]! + flips;
      S[SEEN] = S[SEEN]! | J[JU]!;
      if (ok) (S[CLEANS] = S[CLEANS]! + 1), did && (S[CB] = S[CB]! + 1), (S[TOP] = Math.max(S[TOP]!, S[CB]!));
      else S[CB] = 0;
      reset1();
      return S[KIND]!;
    },
    /** It went down: the jump scores nothing, the combo is gone. */
    crash() {
      S[CB] = 0;
      S[PTS] = 0;
      S[CRASHES] = S[CRASHES]! + 1;
      reset1();
    },
    /** Five judges out of 100, each a little their own (seeded): score, variety, clean riding, the big one. */
    judges(seed: number) {
      let seen = 0;
      for (let i = 0; i < JA; i++) seen += (S[SEEN]! >> i) & 1;
      const jumps = S[JUMPS]! || 1, base = 34 + Math.min(40, S[SC]! / 260) + seen * 3 + (S[CLEANS]! / jumps) * 8 + Math.min(6, S[FLIPS]! * 2) - S[CRASHES]! * 3;
      let r = seed >>> 0, sum = 0;
      for (let k = 0; k < 5; k++) {
        r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
        const v = Math.max(10, Math.min(99.5, base + ((r / 4294967296) * 5 - 2.5)));
        JD[k] = Math.round(v * 10) / 10;
        sum += JD[k]!;
      }
      JD[5] = Math.round((sum / 5) * 10) / 10;
      return JD;
    },
    /** A new run. */
    reset() {
      S.fill(0);
      reset1();
    },
  };
  function reset1() {
    J.fill(0);
  }
}
export type Tricks = ReturnType<typeof tricks>;
