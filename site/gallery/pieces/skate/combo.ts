// The trick scorer (skate-sesh): one combo at a time, as plain numbers. A brick candidate: Two-Minute
// Sesh uses it, and the next trick piece (skate or surf) takes it as is.
//
//   const c = combo(NAMES)        names: every trick and gap a piece can score, by id
//   c.add(id, pts)                a trick lands in the combo: its points (halved for each repeat of the
//                                 same trick in this combo), and the multiplier goes up by one
//   c.tick(pts)                   points that keep coming without a new trick (a grind, a manual, a
//                                 held grab)
//   c.mult · c.value · c.active   the multiplier (tricks in the combo), points × multiplier, any trick
//   c.bank()                      a clean landing: the combo's value goes on the score, fills the
//                                 special meter and may be the best combo; returns what it banked
//   c.bail()                      a slam: the combo is lost and the meter drops; returns what was lost
//   c.special · c.full · c.spend  the special meter (0..1); full unlocks one special trick
//   c.text(best?)                 the combo string ("KICKFLIP + 50-50 + MANUAL"), made only when the
//                                 HUD asks (`c.ver` changes on every edit)
//
// Steps allocate nothing: the combo is a typed-array ring; only text() makes a string.
/** Slots of `S`: points, tricks, special, best value, score, last bank, length, version. */
const BASE = 0, COUNT = 1, SPECIAL = 2, BEST = 3, SCORE = 4, LAST = 5, LEN = 6, VER = 7, BLEN = 8;

export function combo(names: readonly string[], cap = 8, fill = 3000) {
  const S = new Float64Array(9), T = new Uint8Array(cap), B = new Uint8Array(cap), REP = new Uint8Array(names.length);
  const clear = () => ((S[BASE] = S[COUNT] = S[LEN] = 0), REP.fill(0), (S[VER] = S[VER]! + 1));
  const join = (L: Uint8Array, n: number) => {
    let s = n > cap ? "… " : "";
    for (let i = Math.max(0, n - cap); i < n; i++) s += (i > Math.max(0, n - cap) ? " + " : "") + names[L[i % cap]!];
    return s;
  };
  return {
    S,
    get mult() {
      return Math.max(1, S[COUNT]!);
    },
    get value() {
      return Math.floor(S[BASE]! * Math.max(1, S[COUNT]!));
    },
    get active() {
      return S[COUNT]! > 0;
    },
    get score() {
      return S[SCORE]!;
    },
    get best() {
      return S[BEST]!;
    },
    get special() {
      return S[SPECIAL]!;
    },
    get full() {
      return S[SPECIAL]! >= 1;
    },
    get ver() {
      return S[VER]!;
    },
    /** A trick lands in the combo; returns the points it added (before the multiplier). */
    add(id: number, pts: number) {
      const p = Math.round(pts / (1 + REP[id]!));
      REP[id] = Math.min(255, REP[id]! + 1);
      T[S[LEN]! % cap] = id;
      (S[LEN] = S[LEN]! + 1), (S[COUNT] = S[COUNT]! + 1), (S[BASE] = S[BASE]! + p), (S[VER] = S[VER]! + 1);
      return p;
    },
    /** Points with no new trick (only while a combo is going). */
    tick(pts: number) {
      if (S[COUNT]! > 0) S[BASE] = S[BASE]! + pts;
    },
    bank() {
      const v = Math.floor(S[BASE]! * S[COUNT]!);
      if (v > S[BEST]!) {
        S[BEST] = v;
        S[BLEN] = S[LEN]!;
        B.set(T);
      }
      (S[SCORE] = S[SCORE]! + v), (S[LAST] = v), (S[SPECIAL] = Math.min(1, S[SPECIAL]! + v / fill));
      clear();
      return v;
    },
    bail() {
      const v = Math.floor(S[BASE]! * S[COUNT]!);
      S[SPECIAL] = S[SPECIAL]! >= 1 ? 0.5 : Math.max(0, S[SPECIAL]! - 0.25);
      clear();
      return v;
    },
    /** Points outside any combo (a bonus): straight on the score. */
    bonus(pts: number) {
      S[SCORE] = S[SCORE]! + pts;
      S[VER] = S[VER]! + 1;
    },
    /** Use the special meter up (a special that costs it). */
    spend() {
      S[SPECIAL] = 0;
    },
    /** A new run: score, best, meter and combo back to zero. */
    reset() {
      S.fill(0);
      clear();
    },
    text: (best = false) => (best ? join(B, S[BLEN]!) : join(T, S[LEN]!)),
  };
}
export type Combo = ReturnType<typeof combo>;
