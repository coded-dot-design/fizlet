// Dune Hop's air scorer: airtime in, points out, with a combo for clean landings. Small and general on
// purpose (a brick candidate for any vehicle or rider game that judges its landings): it knows
// nothing about the vehicle, only how long it was in the air and how far off the slope it came
// down. Call `land(air, err)` once per landing, `crash()` when it goes wrong, `reset()` for a new run.
// - A landing under `minAir` seconds is a bump: no points, the combo stands.
// - Clean (err ≤ `clean` radians): air × `perSec` points × (1 + combo), then the combo grows.
// - Sketchy (err over `clean`): the points at × 1, and the combo is gone.
// - A crash scores nothing for the jump and loses the combo.
// No allocation: the state is one Float64Array (score, combo, best air, clean landings, last points,
// last air, last kind, longest combo).

/** What `land` returns: no score (a bump), a clean landing, a sketchy one. */
export const BUMP = 0, CLEAN = 1, SKETCHY = 2;
export const SC = 0, CB = 1, BEST = 2, CLEANS = 3, PTS = 4, AIR = 5, KIND = 6, TOP = 7;

export interface StuntOptions {
  /** Shortest airtime that scores, seconds (default 0.3). */
  minAir?: number;
  /** Most off-slope error for a clean landing, radians (default 0.2). */
  clean?: number;
  /** Points per second of air (default 100). */
  perSec?: number;
}

export function stunt(o: StuntOptions = {}) {
  const minAir = o.minAir ?? 0.3, clean = o.clean ?? 0.2, perSec = o.perSec ?? 100;
  const S = new Float64Array(8);
  return {
    /** [score, combo, best air, clean landings, last points, last air, last kind, longest combo]. */
    S,
    /** A landing after `air` seconds, `err` radians off the slope: BUMP, CLEAN or SKETCHY. */
    land(air: number, err: number) {
      if (air < minAir) return BUMP;
      const ok = err <= clean, pts = Math.round(air * perSec) * (ok ? 1 + S[CB]! : 1);
      S[SC] = S[SC]! + pts;
      S[PTS] = pts;
      S[AIR] = air;
      S[BEST] = Math.max(S[BEST]!, air);
      S[KIND] = ok ? CLEAN : SKETCHY;
      if (ok) (S[CB] = S[CB]! + 1), (S[CLEANS] = S[CLEANS]! + 1), (S[TOP] = Math.max(S[TOP]!, S[CB]!));
      else S[CB] = 0;
      return S[KIND]!;
    },
    /** It went wrong: the jump scores nothing and the combo is lost. */
    crash() {
      S[CB] = 0;
      S[PTS] = 0;
    },
    /** A new run. */
    reset: () => S.fill(0),
  };
}
export type Stunt = ReturnType<typeof stunt>;
