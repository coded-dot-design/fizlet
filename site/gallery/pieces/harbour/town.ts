// Pocket Harbour's town, headless (tests/pocket-harbour.test.mjs plays it with no browser): what the
// toys are doing and the hunt for the cat, as plain numbers the scene draws from. Every toy is a
// short timeline started by a tap that ends by itself (so the engine settles): the boat leaves the
// dock, loops the bay and moors again; the truck drives the harbour road once round; the gulls
// lift off, circle and land; the lighthouse sweeps its beam three times round; a lamp or a window
// switches; at dusk the lamps come on one by one along the quay. The cat hides in five spots, one at
// a time; find it (tap it, or what it hides in) and it hops out, then slips off to the next.
// Paths are closed Catmull-Rom loops sampled once by arc length. Zero allocation per step.

const TAU = 6.283185307179586;
/** The toys with a timeline: the boat, the truck, the gulls, the lighthouse's beam. */
export const BOAT = 0, TRUCK = 1, GULLS = 2, BEAM = 3;
/** How long each runs, seconds. */
export const DUR = [10, 8, 6.5, 6];
export const LAMPS = 6, HOUSES = 6, SPOTS = 5, GULL_N = 3;
/** The cat's spots: 0 behind the crates on the quay, 1 on a roof ridge, 2 in the moored dinghy,
 *  3 under the bench, 4 by the lighthouse door. */
export const SPOT_NAMES = ["behind the crates", "up on a roof", "in the dinghy", "under the bench", "at the lighthouse door"];
/** Events for the scene: [type, value]. */
export const E_START = 1, E_END = 2, E_LAMP = 3, E_WINDOW = 4, E_FOUND = 5, E_HUNT = 6, E_NIGHT = 7, E_MISS = 8;

/** A closed loop through `pts` [x, z, …]: `at(u, out)` gives [x, z, yaw] at u (0..1 of its length). */
export function loop(pts: ArrayLike<number>, samples = 256) {
  const n = pts.length >> 1, X = new Float64Array(samples + 1), Z = new Float64Array(samples + 1), L = new Float64Array(samples + 1), C = new Float64Array(2);
  const cr = (i: number, t: number) => {
    const g = (k: number, a: number) => pts[(((i + k) % n + n) % n) * 2 + a]!;
    for (let a = 0; a < 2; a++) {
      const p0 = g(-1, a), p1 = g(0, a), p2 = g(1, a), p3 = g(2, a);
      C[a] = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    }
  };
  for (let s = 0; s <= samples; s++) {
    const f = (s / samples) * n, i = Math.min(n - 1, Math.floor(f));
    cr(i, f - i);
    X[s] = C[0]!;
    Z[s] = C[1]!;
    L[s] = s ? L[s - 1]! + Math.hypot(X[s]! - X[s - 1]!, Z[s]! - Z[s - 1]!) : 0;
  }
  const total = L[samples]!;
  return {
    length: total,
    at(u: number, out: { [i: number]: number }) {
      const want = (u - Math.floor(u)) * total;
      let lo = 0, hi = samples;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        L[m]! <= want ? (lo = m) : (hi = m);
      }
      const k = (want - L[lo]!) / (L[hi]! - L[lo]! || 1);
      out[0] = X[lo]! + (X[hi]! - X[lo]!) * k;
      out[1] = Z[lo]! + (Z[hi]! - Z[lo]!) * k;
      out[2] = Math.atan2(-(Z[hi]! - Z[lo]!), X[hi]! - X[lo]!);
      return out;
    },
  };
}

/** The boat's loop round the bay, from its mooring by the pier and back (nose out, as it started). */
export const BOAT_LOOP = loop([-1.7, 2.2, -1.5, 5.2, 1.2, 7.4, 5.6, 7.8, 8.2, 6.4, 7.4, 3.4, 4.2, 1.9, 0.6, 1.0]);
/** The harbour road: along the quay, up the side, along the back street and down. */
export const ROAD_LOOP = loop([-7, -1.45, 0, -1.45, 6, -1.45, 9.2, -2.2, 9.6, -4.4, 8.6, -6.1, 0, -6.2, -8, -6.2, -11, -5.6, -11.6, -3.4, -10.6, -1.7]);

/** Smooth start and stop over the run (0..1 → 0..1). */
const ease = (u: number) => u * u * (3 - 2 * u);

export function town(seed = 1) {
  // Each toy's clock (−1 idle), the lamps (on, and a countdown to switch on), the windows, the hunt.
  const T = new Float64Array(4).fill(-1), lamp = new Uint8Array(LAMPS), lampAt = new Float64Array(LAMPS).fill(-1), win = new Uint8Array(HOUSES);
  // Hunt: spot order (a shuffle of the five), found count, the cat's clock since the last find (−1: hiding).
  const order = new Uint8Array(SPOTS), H = new Float64Array(3);
  const ev = new Float64Array(16), out = new Float64Array(3);
  let nev = 0, night = false;
  const emit = (t: number, v: number) => nev < 8 && ((ev[nev * 2] = t), (ev[nev * 2 + 1] = v), nev++);

  function shuffle(s: number) {
    for (let i = 0; i < SPOTS; i++) order[i] = i;
    let h = s | 0;
    for (let i = SPOTS - 1; i > 0; i--) {
      h = (Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0;
      const j = (h >>> 0) % (i + 1), x = order[i]!;
      order[i] = order[j]!;
      order[j] = x;
    }
  }
  function reset(s = seed) {
    T.fill(-1);
    lampAt.fill(-1);
    win.fill(0);
    lamp.fill(night ? 1 : 0);
    H[0] = H[1] = 0;
    H[2] = -1;
    shuffle(s);
    nev = 0;
  }
  /** Start toy k (a tap): false if it is already going. */
  function start(k: number) {
    if (T[k]! >= 0) return false;
    T[k] = 0;
    emit(E_START, k);
    return true;
  }
  /** Dusk or day: at dusk the lamps come on one by one along the quay; at day they go off. */
  function setNight(on: boolean) {
    if (on === night) return;
    night = on;
    for (let i = 0; i < LAMPS; i++) on ? (lampAt[i] = 0.35 + i * 0.28) : ((lampAt[i] = -1), (lamp[i] = 0));
    if (!on) win.fill(0);
    emit(E_NIGHT, on ? 1 : 0);
    if (on) start(BEAM);
  }
  function toggleLamp(i: number) {
    lampAt[i] = -1;
    lamp[i] = lamp[i] ? 0 : 1;
    emit(E_LAMP, i);
  }
  function toggleWindow(i: number) {
    win[i] = win[i] ? 0 : 1;
    emit(E_WINDOW, i);
  }
  /** A look at spot s: the cat is there (found: it hops out) or not. */
  function look(s: number) {
    if (H[0]! >= SPOTS || H[2]! >= 0) return false;
    if (order[H[0]!] !== s) return emit(E_MISS, s), false;
    H[2] = 0;
    H[0] = H[0]! + 1;
    emit(E_FOUND, s);
    return true;
  }
  /** Where the cat is drawn: the spot it was just found in (while it hops out and slips away), else
   *  the one it hides in now (all found: it stays in the last, sat up). */
  const spot = () => (H[2]! >= 0 && H[2]! < 1.6 ? order[H[0]! - 1]! : H[0]! < SPOTS ? order[H[0]!]! : order[SPOTS - 1]!);

  /** Advance dt; true while anything moves. */
  function step(dt: number) {
    let busy = false;
    for (let k = 0; k < 4; k++) {
      if (T[k]! < 0) continue;
      T[k] = T[k]! + dt;
      busy = true;
      if (T[k]! >= DUR[k]!) (T[k] = -1), emit(E_END, k);
    }
    for (let i = 0; i < LAMPS; i++)
      if (lampAt[i]! >= 0) {
        busy = true;
        lampAt[i] = lampAt[i]! - dt;
        if (lampAt[i]! < 0) (lampAt[i] = -1), (lamp[i] = 1), emit(E_LAMP, i);
      }
    if (H[2]! >= 0) {
      busy = true;
      H[2] = H[2]! + dt;
      if (H[2]! >= 2.2) (H[2] = -1), emit(E_HUNT, H[0]!);
    }
    return busy;
  }

  // ---- poses the scene reads ----
  /** The boat: [x, z, yaw] on its loop, and its speed 0..1 (eased away from and back to the mooring). */
  function boat(o: Float64Array) {
    const t = T[BOAT]!, u = t < 0 ? 0 : ease(t / DUR[BOAT]!);
    BOAT_LOOP.at(u, o);
    return t < 0 ? 0 : Math.sin(Math.PI * u);
  }
  /** The truck on the road: [x, z, yaw]; returns its speed 0..1. */
  function truck(o: Float64Array) {
    const t = T[TRUCK]!, u = t < 0 ? 0 : ease(t / DUR[TRUCK]!);
    ROAD_LOOP.at(u, o);
    return t < 0 ? 0 : Math.sin(Math.PI * u);
  }
  /** Gull i in flight: how far up (0 perched .. 1 flying), its angle round the circle, its wing beat. */
  function gull(i: number, o: Float64Array) {
    const t = T[GULLS]!;
    if (t < 0) return (o[0] = 0), (o[1] = 0), (o[2] = 0), o;
    const D = DUR[GULLS]!, up = Math.min(1, t / 1.1, (D - t) / 1.1);
    o[0] = ease(Math.max(0, up));
    o[1] = (i / GULL_N) * TAU + t * 0.9;
    o[2] = Math.sin(t * 15 + i * 2) * (0.35 + 0.65 * o[0]!);
    return o;
  }
  /** The beam's angle (radians round the tower) and strength 0..1 (on all night once swept). */
  function beam(o: Float64Array) {
    const t = T[BEAM]!;
    if (t < 0) return (o[0] = night ? 3 * TAU : 0), (o[1] = night ? 1 : 0), o;
    const D = DUR[BEAM]!;
    o[0] = ease(t / D) * 3 * TAU;
    o[1] = night ? 1 : Math.min(1, t * 2, (D - t) * 2);
    return o;
  }

  reset(seed);
  return {
    /** Toy clocks (−1 idle). */
    T,
    /** Lamps on (1) or off; windows lit. */
    lamp,
    win,
    /** Hunt: [found, -, cat clock since the last find (−1 hiding)]; the spot order. */
    H,
    order,
    get night() {
      return night;
    },
    /** Events since the last `clear`: [type, value] × `n`. */
    ev,
    get n() {
      return nev;
    },
    clear: () => void (nev = 0),
    start,
    setNight,
    toggleLamp,
    toggleWindow,
    look,
    spot,
    step,
    reset,
    boat,
    truck,
    gull,
    beam,
    /** True when every toy is idle and nothing waits. */
    idle() {
      for (let k = 0; k < 4; k++) if (T[k]! >= 0) return false;
      for (let i = 0; i < LAMPS; i++) if (lampAt[i]! >= 0) return false;
      return H[2]! < 0;
    },
    scratch: out,
  };
}
export type Town = ReturnType<typeof town>;
