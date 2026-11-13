// Table for Twelve's dinner (site/gallery/pieces/table/table-for-twelve.ts): pure numbers, no DOM,
// seeded. Twelve guests sit round a long table, six a side. The places a dish can sit make a ring
// of NN nodes: the kitchen end (node 0), the near side's six seats left to right (1..6), the far end
// (7), the far side's six seats right to left (8..13), and back to the kitchen end. A dish comes out
// at an end; the guest who wants it shows it in a thought bubble. You hold one dish at a time and
// pass it one node along the ring, on (+1) or, once the table passes both ways, back (−1). A dish
// that reaches the guest who wants it is served: hot (its heat above 0) is a happy guest and points
// (more the hotter, plus the streak), cold is a grumble and none. Its heat runs down from 1 to 0 over
// the course's HEAT seconds (the view shows it as steam). Four courses, each faster than the last
// (dishes come quicker and cool sooner); from the third the table passes both ways and dishes come
// from the far end too. When the last course is served: DINNER IS SERVED.
// tests/table-for-twelve.test.mjs plays it headless (the passing rules, the heat timer, scoring, the
// courses, the end, the same seed, and zero allocation).
import { seeded } from "../../../../src/kernel/random";

/** Seats, ring nodes, the two ends. */
export const NSEAT = 12, NN = 14, HEAD = 0, FOOT = 7;
/** The node each seat's place is (seats 0..5 the near side left to right, 6..11 the far side right
 *  to left), and the seat at each node (−1: an end). */
export const SEAT_NODE = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13];
export const NODE_SEAT = [-1, 0, 1, 2, 3, 4, 5, -1, 6, 7, 8, 9, 10, 11];
/** The dishes. */
export const NK = 6, MASH = 0, BEANS = 1, CRAN = 2, ROLLS = 3, GRAVY = 4, YAMS = 5;
export const NAMES = ["mashed potatoes", "green beans", "cranberry sauce", "rolls", "gravy", "sweet potatoes"];
/** The courses: dishes in each, seconds between dishes, seconds a dish stays hot; both ways from. */
export const COURSES = 4, C_N = [4, 5, 6, 7], C_GAP = [3.2, 2.6, 2.1, 1.7], C_HEAT = [13, 11.5, 10, 8.5], BOTH_FROM = 2;
export const RUN_N = 22;
/** The pause between courses (s). */
export const BREAK_S = 1.9;
export const IDLE = 0, PLAY = 1, BREAK = 2, DONE = 3;
/** A dish: not out yet, on the table, served hot, served cold. */
export const D_WAIT = 0, D_TABLE = 1, D_HOT = 2, D_COLD = 3;
/** Events this call. */
export const EV_START = 0, EV_SPAWN = 1, EV_PASS = 2, EV_REFUSE = 3, EV_HOT = 4, EV_COLD = 5, EV_CHILL = 6, EV_COURSE = 7, EV_TWIST = 8, EV_DONE = 9, EV_SELECT = 10, EV_BREAK = 11;
/** Points: a hot dish, more per fifth of heat left, the streak bonus a dish (to STREAK_MAX). */
export const HOT_PTS = 50, HEAT_PTS = 10, STREAK_PTS = 10, STREAK_MAX = 5;
// State slots.
export const MODE = 0, COURSE = 1, T = 2, NEXT = 3, OUT = 4, SERVED = 5, SCORE = 6, HOT = 7, COLD = 8, STREAK = 9, BEST = 10, BOTH = 11, SEL = 12, DIR = 13, LSEAT = 14, LPTS = 15, BRK = 16, SEED = 17, LDISH = 18, LPASS = 19;

export type Table = ReturnType<typeof table>;

/** The forward hops from node a to node b round the ring. */
export const hopsOn = (a: number, b: number) => (b - a + NN) % NN;

/** One dinner. */
export function table(seed: number) {
  const S = new Float64Array(20);
  /** Dishes: kind, node, heat (1 hot .. 0 cold), state, the seat that wants it, the course it came out in. */
  const DK = new Uint8Array(RUN_N), DN = new Uint8Array(RUN_N), DH = new Float64Array(RUN_N), DS = new Uint8Array(RUN_N), DW = new Int8Array(RUN_N), DC = new Uint8Array(RUN_N);
  /** Seats: the dish kind wanted (−1: none), the dish bringing it, how many served there. */
  const WANT = new Int8Array(NSEAT), WD = new Int8Array(NSEAT), NSERVED = new Uint8Array(NSEAT);
  /** Scratch for the draws (no allocation). */
  const PICK = new Int8Array(NSEAT);
  const ev = new Uint8Array(12);
  let R = seeded(seed);

  function reset() {
    S.fill(0);
    S[SEED] = seed;
    S[SEL] = S[LSEAT] = S[LDISH] = S[LPASS] = -1;
    S[DIR] = 1;
    DK.fill(0), DN.fill(0), DH.fill(0), DS.fill(0), DW.fill(-1), DC.fill(0);
    WANT.fill(-1), WD.fill(-1), NSERVED.fill(0);
    R = seeded(seed);
    ev.fill(0);
  }
  function start() {
    ev.fill(0);
    if (S[MODE] === PLAY || S[MODE] === BREAK) return false;
    reset();
    S[MODE] = PLAY;
    S[NEXT] = 0.5;
    ev[EV_START] = ev[EV_COURSE] = 1;
    return true;
  }
  /** Dishes out so far in course c. */
  const before = (c: number) => {
    let n = 0;
    for (let i = 0; i < c; i++) n += C_N[i]!;
    return n;
  };
  const onTable = () => {
    let n = 0;
    for (let i = 0; i < RUN_N; i++) if (DS[i] === D_TABLE) n++;
    return n;
  };
  /** The next dish out: a kind nobody is waiting on, for a guest who is waiting on nothing, at the
   *  kitchen end (or, once both ways, either end). False (try again soon) when every kind is out. */
  function spawn() {
    const i = S[OUT]!;
    let nk = 0, ns = 0;
    for (let k = 0; k < NK; k++) {
      let used = false;
      for (let s = 0; s < NSEAT; s++) if (WANT[s] === k) used = true;
      if (!used) PICK[nk++] = k;
    }
    if (!nk) return false;
    const k = PICK[(R() * nk) | 0]!;
    for (let s = 0; s < NSEAT; s++) if (WANT[s]! < 0) PICK[ns++] = s;
    if (!ns) return false;
    const seat = PICK[(R() * ns) | 0]!;
    const end = S[BOTH] && R() < 0.5 ? FOOT : HEAD;
    (DK[i] = k), (DN[i] = end), (DH[i] = 1), (DS[i] = D_TABLE), (DW[i] = seat), (DC[i] = S[COURSE]!);
    (WANT[seat] = k), (WD[seat] = i);
    S[OUT] = i + 1;
    S[LDISH] = i;
    ev[EV_SPAWN] = 1;
    if (S[SEL]! < 0) (S[SEL] = i), (ev[EV_SELECT] = 1);
    return true;
  }
  /** Serve dish i to the seat at its node. */
  function serve(i: number, seat: number) {
    const hot = DH[i]! > 0;
    DS[i] = hot ? D_HOT : D_COLD;
    (WANT[seat] = -1), (WD[seat] = -1);
    NSERVED[seat] = NSERVED[seat]! + 1;
    let pts = 0;
    if (hot) {
      pts = HOT_PTS + HEAT_PTS * Math.ceil(DH[i]! * 5) + STREAK_PTS * Math.min(STREAK_MAX, S[STREAK]!);
      S[STREAK] = S[STREAK]! + 1;
      if (S[STREAK]! > S[BEST]!) S[BEST] = S[STREAK]!;
      S[HOT] = S[HOT]! + 1;
      ev[EV_HOT] = 1;
    } else (S[STREAK] = 0), (S[COLD] = S[COLD]! + 1), (ev[EV_COLD] = 1);
    S[SCORE] = S[SCORE]! + pts;
    (S[LSEAT] = seat), (S[LPTS] = pts);
    S[SERVED] = S[SERVED]! + 1;
    // The next dish to hold: the one that has been out longest.
    if (S[SEL] === i) {
      S[SEL] = -1;
      for (let j = 0; j < RUN_N; j++) if (DS[j] === D_TABLE) {
        S[SEL] = j;
        break;
      }
    }
  }
  /** Pass the held dish one node: on (+1) or back (−1, once the table passes both ways). */
  function pass(dir: number) {
    ev.fill(0);
    const i = S[SEL]!;
    if (S[MODE] !== PLAY || i < 0) return false;
    if (dir < 0 && !S[BOTH]) return (ev[EV_REFUSE] = 1), false;
    const n = (DN[i]! + dir + NN) % NN;
    DN[i] = n;
    (S[DIR] = dir), (S[LPASS] = i);
    ev[EV_PASS] = 1;
    const seat = NODE_SEAT[n]!;
    if (seat >= 0 && WANT[seat] === DK[i]) serve(i, seat);
    return true;
  }
  /** Pass the held dish to node n, if it is next to it (the way the table passes). */
  function passTo(n: number) {
    ev.fill(0);
    const i = S[SEL]!;
    if (S[MODE] !== PLAY || i < 0) return false;
    if (hopsOn(DN[i]!, n) === 1) return pass(1);
    if (hopsOn(n, DN[i]!) === 1) return pass(-1);
    return false;
  }
  /** Hold dish i. */
  function select(i: number) {
    ev.fill(0);
    if (S[MODE] !== PLAY || DS[i] !== D_TABLE || S[SEL] === i) return false;
    S[SEL] = i;
    ev[EV_SELECT] = 1;
    return true;
  }
  /** Hold the next (d = 1) or the last (d = −1) dish on the table. */
  function cycle(d: number) {
    ev.fill(0);
    if (S[MODE] !== PLAY) return false;
    const s = S[SEL]!;
    for (let k = 1; k <= RUN_N; k++) {
      const j = (((s < 0 ? 0 : s) + d * k) % RUN_N + RUN_N) % RUN_N;
      if (DS[j] === D_TABLE && j !== s) return select(j);
    }
    return false;
  }
  /** Time runs: dishes come out, cool down; a course ends when all of it is served. */
  function step(dt: number) {
    ev.fill(0);
    const m = S[MODE]!;
    if (m === BREAK) {
      if ((S[BRK] = S[BRK]! - dt) > 0) return;
      S[COURSE] = S[COURSE]! + 1;
      S[MODE] = PLAY;
      (S[T] = 0), (S[NEXT] = 0.5);
      ev[EV_COURSE] = 1;
      if (S[COURSE] === BOTH_FROM) (S[BOTH] = 1), (ev[EV_TWIST] = 1);
      return;
    }
    if (m !== PLAY) return;
    const c = S[COURSE]!, last = before(c + 1);
    S[T] = S[T]! + dt;
    for (let i = 0; i < RUN_N; i++) {
      if (DS[i] !== D_TABLE || DH[i]! <= 0) continue;
      DH[i] = DH[i]! - dt / C_HEAT[DC[i]!]!;
      if (DH[i]! <= 0) (DH[i] = 0), (ev[EV_CHILL] = 1);
    }
    if (S[OUT]! < last && (S[NEXT] = S[NEXT]! - dt) <= 0) S[NEXT] = spawn() ? C_GAP[c]! : 0.3;
    if (S[OUT]! >= last && !onTable()) {
      if (c >= COURSES - 1) (S[MODE] = DONE), (ev[EV_DONE] = 1);
      else (S[MODE] = BREAK), (S[BRK] = BREAK_S), (ev[EV_BREAK] = 1);
    }
  }
  const api = { S, DK, DN, DH, DS, DW, DC, WANT, WD, NSERVED, ev, reset, start, step, pass, passTo, select, cycle, onTable };
  reset();
  return api;
}

/** The autopilot (the tests and the poster): hold the dish nearest its guest and pass it the short
 *  way (only on while the table passes one way). Returns the direction it passed, or 0. */
export function autopilot(f: Table) {
  const S = f.S;
  let best = 99, bi = -1, bd = 0;
  for (let i = 0; i < RUN_N; i++) {
    if (f.DS[i] !== D_TABLE) continue;
    const to = SEAT_NODE[f.DW[i]!]!, on = hopsOn(f.DN[i]!, to), back = hopsOn(to, f.DN[i]!);
    const d = S[BOTH] && back < on ? -1 : 1, h = d > 0 ? on : back;
    if (h < best) (best = h), (bi = i), (bd = d);
  }
  if (bi < 0) return 0;
  if (S[SEL] !== bi) f.select(bi);
  f.pass(bd);
  return bd;
}
