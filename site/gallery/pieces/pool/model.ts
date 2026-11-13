// Splash Pool's water and everything in it, as numbers: pure, seeded by what you do, no DOM, no
// allocation per step (tests/splash-pool.test.mjs). The scene (./splash-pool.ts) draws it.
// - Ripples are pulses: a ring front running out at C units/s from where something hit, a packet of
//   crests and troughs that fades as it spreads. The pool is a rectangle, so a pulse bounces off its
//   walls by the method of images: the same ring, mirrored across one wall, two or three (up to
//   three bounces, a little weaker each time), clipped to the pool. The ring you see, the bob of
//   what floats and the push that moves it all come from the one field (`field`).
// - Floaters (the duck, the float ring, beach balls, more ducks) ride the field: a passing front
//   pushes them away from where it came from, they bob on its crests, bump each other and the walls
//   (a hard knock makes its own small ripple) and slow on drag until they rest.
// - Drops fall from above: a ball or a duck lands and floats, a rock or a pebble splashes and sinks
//   to the floor. One that lands on a floater bonks it (a ball bounces off, a rock dunks it). Bonk
//   the duck and that's a foul: ripples only, the duck flies back to the start.
// - The drain pulls everything afloat into a whirlpool and swallows it; then the return jet refills
//   the pool and spits it all back out, the duck last, at the start.
// - The goal: the duck in the far corner (the flag). Drops are counted per run; the best is kept.
// A brick candidate: the reflecting pulse field (`pulse`, `field`, `images`) is general for any
// rectangular water on @fzlt/core/water (its own rings are round and stop at the walls).

/** The pool, world units: x from X0 to X1, z from Z0 (far) to Z1 (near). */
export const X0 = -4.5, X1 = 4.5, Z0 = -2.75, Z1 = 2.75;
const PW = X1 - X0, PD = Z1 - Z0;
/** Pulse speed (units/s), life (s), the packet's half width and its crest spacing (units). */
export const C = 2.5, LIFE = 4.4, SIG = 0.34, CREST = 0.62;
/** The floor, under the surface (y = 0); things that sink rest on it. */
export const FLOOR = -0.82;
/** Where the duck starts, the corner it is going to (the flag) and how close counts. */
export const START = [-3.3, 1.7], GOAL = [X1 - 0.42, Z0 + 0.42], GOAL_R = 0.62;
/** The drain (the whirlpool over it) and the return jet (on the near-left wall). */
export const DRAIN = [0.3, -0.2], JET = [X0 + 0.25, 0.9];

// Kinds. The duck (always floater 0) and the float ring (always 1); then what you can drop.
export const DUCK = 0, RING = 1, BALL = 2, ROCK = 3, DUCKY = 4, PEBBLE = 5;
/** The drop keys' order: beach ball, the cannonball rock, a rubber duck, a pebble. */
export const ITEMS = [BALL, ROCK, DUCKY, PEBBLE];
export const NAMES = ["duck", "float", "beach ball", "cannonball", "rubber duck", "pebble"];
/** Per kind: radius, mass, splash size, pulse strength, floats. */
export const RAD = [0.38, 0.78, 0.36, 0.38, 0.36, 0.13];
const MASS = [0.8, 1.6, 0.5, 3, 0.8, 0.3], SPLASH = [0.5, 0.8, 0.6, 1.3, 0.48, 0.28], AMP = [0.5, 0.8, 0.75, 1.6, 0.6, 0.38];
export const FLOATS = [1, 1, 1, 0, 1, 0];

// Events for the scene (splash, sound, toast), a fixed ring read after each step.
export const E_SPLASH = 1, E_BONK = 2, E_FOUL = 3, E_HOME = 4, E_GULP = 5, E_POP = 6, E_LAND = 7, E_KNOCK = 8, E_BACK = 9;

// Pulses: x, z, age, strength. Floaters: x z vx vz y vy kind state t spin yaw (FS). Drops: x z y vx
// vz vy kind state (DS). States: floaters 0 free, 1 afloat, 2 going down the drain (t: 0 → 1),
// 3 gone (waiting for the refill), 4 home (the duck celebrating), 5 flying back to the start (t);
// drops 0 free, 1 falling, 2 sinking, 3 on the floor.
export const NP = 14, NF = 8, ND = 10, FS = 11, DS = 8, NE = 24;
const PS = 4, EVS = 5, GD = 9.8;
export const F_AFLOAT = 1, F_DOWN = 2, F_GONE = 3, F_HOME = 4, F_FLY = 5;
export const D_FALL = 1, D_SINK = 2, D_REST = 3;
/** Seconds: the drain pulls, then the jet refills; the duck's home lap; its flight back. */
export const PULL = 3.8, REFILL = 2.6, HOME_T = 1.8, FLY_T = 1;

export type Pool = ReturnType<typeof newPool>;

export function newPool() {
  const p = {
    /** Seconds since the start, the drain's cycle (seconds into it; −1: off), the refill's next pop. */
    S: Float64Array.of(0, -1, 0, 0),
    /** Pulses (x, z, age, strength; strength 0: free). */
    P: new Float64Array(NP * PS),
    /** Floaters (FS each). */
    F: new Float64Array(NF * FS),
    /** Drops (DS each). */
    D: new Float64Array(ND * DS),
    /** Events: type, x, z, a, b. */
    E: new Float64Array(NE * EVS),
    ne: 0,
    /** Drops this run, the best run home (0: none yet), runs home. */
    drops: 0, best: 0, homes: 0,
    /** The order drops were made in (for recycling the oldest). */
    seq: new Float64Array(NF + ND),
    n: 0,
    busy: false,
  };
  reset(p);
  return p;
}

/** Back to the start: the duck and the float ring afloat, nothing else, the water flat. */
export function reset(p: Pool) {
  p.P.fill(0), p.F.fill(0), p.D.fill(0), p.seq.fill(0);
  p.ne = 0, (p.S[1] = -1), p.drops = 0, p.n = 0;
  float(p, 0, DUCK, START[0]!, START[1]!);
  float(p, 1, RING, 0.9, 0.5);
  p.F[0 * FS + 10] = -0.6;
  p.busy = true;
}
function float(p: Pool, i: number, kind: number, x: number, z: number) {
  const q = i * FS, F = p.F;
  F.fill(0, q, q + FS);
  (F[q] = x), (F[q + 1] = z), (F[q + 6] = kind), (F[q + 7] = F_AFLOAT);
}
function emit(p: Pool, type: number, x: number, z: number, a = 0, b = 0) {
  if (p.ne >= NE) return;
  const q = p.ne++ * EVS;
  (p.E[q] = type), (p.E[q + 1] = x), (p.E[q + 2] = z), (p.E[q + 3] = a), (p.E[q + 4] = b);
}

/** A ripple from (x, z), `amp` strong. Past the pool's capacity the weakest one makes room. */
export function pulse(p: Pool, x: number, z: number, amp: number) {
  let k = -1, lo = Infinity;
  for (let i = 0; i < NP; i++) {
    const s = p.P[i * PS + 3]!, a = s ? s * fade(p.P[i * PS + 2]!) : 0;
    if (a < lo) (lo = a), (k = i);
  }
  const q = k * PS;
  (p.P[q] = x), (p.P[q + 1] = z), (p.P[q + 2] = 0), (p.P[q + 3] = amp);
  p.busy = true;
}
/** A pulse's strength left at `age`: fading in time and as the ring spreads. */
export const fade = (age: number) => (age >= LIFE ? 0 : Math.exp(-age / 1.7) * (1 - age / LIFE) / Math.sqrt(1 + 0.9 * C * age));

/** The mirror images of a point across the pool's walls: n of them in IX/IZ-style pairs, each with
 *  its bounce count. out: [x0, z0, bounces0, x1, …]; returns n (up to 36; only those with at most
 *  `max` bounces). */
export function images(x: number, z: number, out: Float64Array, max = 3) {
  (IW[108] = x), (IW[109] = z);
  const n = imagesAt(IW, max);
  out.set(IW.subarray(0, n * 3));
  return n;
}
const IW = new Float64Array(36 * 3 + 2);
/** `images` of (io[108], io[109]) into io. */
function imagesAt(out: Float64Array, max: number) {
  const x = out[108]!, z = out[109]!;
  let n = 0;
  for (let a = 0; a < 6; a++) {
    const k = (a >> 1) - 1, ix = a & 1 ? X0 + 2 * k * PW - (x - X0) : X0 + 2 * k * PW + (x - X0), bx = a & 1 ? Math.abs(2 * k - 1) : 2 * Math.abs(k);
    for (let b = 0; b < 6; b++) {
      const m = (b >> 1) - 1, iz = b & 1 ? Z0 + 2 * m * PD - (z - Z0) : Z0 + 2 * m * PD + (z - Z0), bz = b & 1 ? Math.abs(2 * m - 1) : 2 * Math.abs(m);
      if (bx + bz > max) continue;
      (out[n * 3] = ix), (out[n * 3 + 1] = iz), (out[n * 3 + 2] = bx + bz), n++;
    }
  }
  return n;
}
/** Each bounce keeps this much. */
export const BOUNCE = 0.74;
const IM = new Float64Array(36 * 3 + 2), TAU = 6.283185307179586;
/** The field at (x, z): out = [height, push x, push z] (the push: away from each front, as it passes). */
export function field(p: Pool, x: number, z: number, out: Float64Array) {
  (FX[3] = x), (FX[4] = z), fieldAt(p, FX);
  (out[0] = FX[0]!), (out[1] = FX[1]!), (out[2] = FX[2]!);
  return out;
}
const FX = new Float64Array(5);
/** `field` at (io[3], io[4]) into io[0..2] (no number arguments: a call V8 doesn't inline boxes them). */
function fieldAt(p: Pool, io: Float64Array) {
  const x = io[3]!, z = io[4]!, out = io;
  let h = 0, fx = 0, fz = 0;
  for (let i = 0; i < NP; i++) {
    const q = i * PS, s0 = p.P[q + 3]!;
    if (!s0) continue;
    const age = p.P[q + 2]!, A = s0 * fade(age), r = C * age;
    if (A < 0.002) continue;
    (IM[108] = p.P[q]!), (IM[109] = p.P[q + 1]!);
    const n = imagesAt(IM, 3);
    for (let j = 0; j < n; j++) {
      const dx = x - IM[j * 3]!, dz = z - IM[j * 3 + 1]!, d = Math.sqrt(dx * dx + dz * dz), s = d - r;
      if (s > 3 * SIG || s < -3.2 * SIG) continue;
      const g = Math.exp(-(s * s) / (SIG * SIG)) * A * Math.pow(BOUNCE, IM[j * 3 + 2]!);
      h += g * Math.cos((s * TAU) / CREST);
      if (d > 1e-6) (fx += (g * dx) / d), (fz += (g * dz) / d);
    }
  }
  (out[0] = h * 0.09), (out[1] = fx), (out[2] = fz);
  return out;
}

/** Drop the item `kind` at (x, z) from `h` above the water (vx, vz: thrown along); returns its slot (−1: none). */
export function drop(p: Pool, kind: number, x: number, z: number, h = 2.6, vx = 0, vz = 0) {
  const D = p.D;
  let k = -1;
  for (let i = 0; i < ND && k < 0; i++) if (!D[i * DS + 7]) k = i;
  // Full: the oldest stone on the floor makes room.
  if (k < 0) for (let i = 0, lo = Infinity; i < ND; i++) if (D[i * DS + 7] === D_REST && p.seq[NF + i]! < lo) (lo = p.seq[NF + i]!), (k = i);
  if (k < 0) return -1;
  const q = k * DS;
  (D[q] = clampX(x, RAD[kind]!)), (D[q + 1] = clampZ(z, RAD[kind]!)), (D[q + 2] = h), (D[q + 3] = vx), (D[q + 4] = vz), (D[q + 5] = 0), (D[q + 6] = kind), (D[q + 7] = D_FALL);
  p.seq[NF + k] = ++p.n;
  p.drops++;
  p.busy = true;
  return k;
}
const clampX = (x: number, r: number) => Math.max(X0 + r, Math.min(X1 - r, x));
const clampZ = (z: number, r: number) => Math.max(Z0 + r, Math.min(Z1 - r, z));

/** Pull the plug: the whirlpool, then the refill. */
/** Seconds into the drain's cycle (−1: off). */
export const draining = (p: Pool) => p.S[1]!;

export function drainPool(p: Pool) {
  if (p.S[1]! >= 0) return false;
  (p.S[1] = 0), (p.S[2] = PULL + 0.3);
  p.busy = true;
  return true;
}

const FV = new Float64Array(5);
/** One step of dt seconds. Returns busy (anything still moving). */
export function step(p: Pool, dt: number) {
  const P = p.P, F = p.F, D = p.D, S = p.S;
  (S[0] = S[0]! + dt), (S[3] = dt);
  p.ne = 0;
  let busy = false;
  for (let i = 0; i < NP; i++) {
    const q = i * PS;
    if (!P[q + 3]) continue;
    if ((P[q + 2] = P[q + 2]! + dt) >= LIFE) P[q + 3] = 0;
    else busy = true;
  }
  // The drain's cycle: pull, then refill (the jet puts back what went down, one by one, the duck last).
  if (S[1]! >= 0) {
    busy = true;
    S[1] = S[1]! + dt;
    if (S[1]! >= PULL && S[1]! >= S[2]!) {
      let i = NF - 1;
      while (i >= 0 && F[i * FS + 7] !== F_GONE) i--;
      if (i >= 0) {
        const q = i * FS;
        float(p, i, F[q + 6]!, JET[0]! + 0.35, JET[1]! + (i & 1 ? 0.22 : -0.22));
        (F[q + 2] = 1.7), (F[q + 3] = i & 1 ? 0.35 : -0.45), (F[q + 4] = -0.2), (F[q + 10] = 0);
        pulse(p, F[q]!, F[q + 1]!, 0.35);
        emit(p, E_POP, F[q]!, F[q + 1]!, i);
        S[2] = S[1]! + (i === 1 ? 0.6 : 0.34);
      } else if (S[1]! >= PULL + REFILL) S[1] = -1;
    }
  }
  for (let i = 0; i < ND; i++) if (stepDrop(p, i)) busy = true;
  // Floaters.
  for (let i = 0; i < NF; i++) if (stepFloater(p, i)) busy = true;
  // Floaters bump each other.
  if (bump(p)) busy = true;
  return (p.busy = busy);
}
/** One drop: falling (gravity; a floater in the way is bonked), sinking (slow, drifting), resting. */
function stepDrop(p: Pool, i: number) {
  const F = p.F, D = p.D, dt = p.S[3]!;
  let busy = false;
  const q = i * DS, st = D[q + 7]!;
  if (!st || st === D_REST) return false;
  busy = true;
  const kind = D[q + 6]!, r = RAD[kind]!;
  if (st === D_FALL) {
    D[q + 5] = D[q + 5]! - GD * dt;
    (D[q] = clampX(D[q]! + D[q + 3]! * dt, r)), (D[q + 1] = clampZ(D[q + 1]! + D[q + 4]! * dt, r)), (D[q + 2] = D[q + 2]! + D[q + 5]! * dt);
    // Onto a floater: it gets bonked; a ball or a duck bounces off it, a stone shoves it under.
    if (D[q + 5]! < 0 && D[q + 2]! < 0.45 && D[q + 2]! > 0.05) {
      for (let j = 0; j < NF; j++) {
        const f = j * FS;
        if (F[f + 7] !== F_AFLOAT) continue;
        const dx = F[f]! - D[q]!, dz = F[f + 1]! - D[q + 1]!, d = Math.sqrt(dx * dx + dz * dz) || 1e-6, rr = RAD[F[f + 6]!]! + r * 0.8;
        if (d >= rr) continue;
        const ux = dx / d, uz = dz / d, sink = !FLOATS[kind], fm = MASS[F[f + 6]!]!, k2 = (sink ? 2.4 : 1.2) * MASS[kind]! / fm;
        (F[f + 2] = F[f + 2]! + ux * Math.min(2.6, k2)), (F[f + 3] = F[f + 3]! + uz * Math.min(2.6, k2)), (F[f + 5] = F[f + 5]! - (sink ? 1.8 : 0.8)), (F[f + 9] = F[f + 9]! + (D[q]! - F[f]! > 0 ? 3 : -3));
        if (sink) (D[q + 3] = -ux * 0.8), (D[q + 4] = -uz * 0.8);
        else (D[q + 5] = 2.4), (D[q + 3] = -ux * 1.6), (D[q + 4] = -uz * 1.6), (D[q + 2] = 0.46);
        emit(p, E_BONK, D[q]!, D[q + 1]!, j, kind);
        if (j === 0) foul(p);
        break;
      }
    }
    if (D[q + 2]! <= 0) {
      // In: the splash, its ripple; a floater joins the floaters, a stone sinks.
      const x = D[q]!, z = D[q + 1]!, speed = -D[q + 5]!;
      emit(p, E_SPLASH, x, z, SPLASH[kind]! * Math.min(1.25, 0.55 + speed / 12), kind);
      pulse(p, x, z, AMP[kind]! * Math.min(1.2, 0.5 + speed / 12));
      if (FLOATS[kind]) {
        D[q + 7] = 0;
        const j = slot(p);
        float(p, j, kind, x, z);
        const f = j * FS;
        (F[f + 2] = D[q + 3]! * 0.4), (F[f + 3] = D[q + 4]! * 0.4), (F[f + 4] = -0.12), (F[f + 5] = -Math.min(2, speed * 0.3)), (F[f + 10] = (p.n * 2.4) % TAU);
      } else (D[q + 7] = D_SINK), (D[q + 5] = -Math.min(1.6, speed * 0.25)), (D[q + 3] = D[q + 3]! * 0.3), (D[q + 4] = D[q + 4]! * 0.3);
    }
  } else {
    // Sinking: water drag to a slow fall, a little drift, then the floor.
    D[q + 5] = D[q + 5]! + (-0.9 - D[q + 5]!) * Math.min(1, dt * 3);
    (D[q] = clampX(D[q]! + D[q + 3]! * dt, r)), (D[q + 1] = clampZ(D[q + 1]! + D[q + 4]! * dt, r));
    (D[q + 3] = D[q + 3]! * Math.exp(-dt * 2)), (D[q + 4] = D[q + 4]! * Math.exp(-dt * 2));
    D[q + 2] = D[q + 2]! + D[q + 5]! * dt;
    if (D[q + 2]! <= FLOOR + r * 0.7) (D[q + 2] = FLOOR + r * 0.7), (D[q + 7] = D_REST), emit(p, E_LAND, D[q]!, D[q + 1]!, kind);
  }
  return busy;
}
/** One floater: pushed by the fronts, pulled by the drain, bobbing, bouncing off the walls. */
function stepFloater(p: Pool, i: number) {
  const F = p.F, S = p.S, dt = S[3]!;
  let busy = false;
  const q = i * FS, st = F[q + 7]!;
  if (!st || st === F_GONE) return busy;
  if (st === F_DOWN) {
    busy = true;
    if ((F[q + 8] = F[q + 8]! + dt / 0.7) >= 1) (F[q + 7] = F_GONE), (F[q + 8] = 0);
    F[q + 9] = F[q + 9]! + dt * 14;
    return busy;
  }
  if (st === F_FLY) {
    busy = true;
    if ((F[q + 8] = F[q + 8]! + dt / FLY_T) >= 1) {
      float(p, i, DUCK, START[0]!, START[1]!);
      (F[q + 5] = -1.2), (F[q + 10] = -0.6);
      emit(p, E_SPLASH, START[0]!, START[1]!, 0.42, DUCK), pulse(p, START[0]!, START[1]!, 0.4);
    }
    return busy;
  }
  const kind = F[q + 6]!, r = RAD[kind]!, m = MASS[kind]!;
  (FV[3] = F[q]!), (FV[4] = F[q + 1]!), fieldAt(p, FV);
  // The push of passing fronts (heavier things move less), then drag.
  const km = 2.7 / Math.sqrt(m);
  F[q + 2] = F[q + 2]! + FV[1]! * km * dt;
  F[q + 3] = F[q + 3]! + FV[2]! * km * dt;
  if (S[1]! >= 0 && S[1]! < PULL) {
    // The whirlpool: in and round, harder near the middle; close enough and it goes down.
    const dx = DRAIN[0]! - F[q]!, dz = DRAIN[1]! - F[q + 1]!, d = Math.sqrt(dx * dx + dz * dz) || 1e-6, w = Math.min(1, S[1]! / 0.8);
    // The water itself turns and runs in: what floats is carried along (it eases to the flow).
    const vin = w * (1.5 + 2.2 * Math.max(0, 1 - d / 7)), turn = w * 1.2 * Math.min(1, d / 1.2) * Math.max(0, 1 - d / 9), k = Math.min(1, dt * 3);
    F[q + 2] = F[q + 2]! + ((dx / d) * vin + (dz / d) * turn - F[q + 2]!) * k;
    F[q + 3] = F[q + 3]! + ((dz / d) * vin - (dx / d) * turn - F[q + 3]!) * k;
    F[q + 9] = F[q + 9]! + turn * dt * 2;
    if (d < 0.42 + r * 0.5 && S[1]! > 0.6) {
      (F[q + 7] = F_DOWN), (F[q + 8] = 0), (F[q] = DRAIN[0]!), (F[q + 1] = DRAIN[1]!);
      emit(p, E_GULP, DRAIN[0]!, DRAIN[1]!, i);
      if (i === 0) p.drops = 0;
      busy = true;
      return busy;
    }
  }
  const drag = Math.exp(-dt * (kind === RING ? 0.75 : 0.95));
  (F[q + 2] = F[q + 2]! * drag), (F[q + 3] = F[q + 3]! * drag), (F[q + 9] = F[q + 9]! * Math.exp(-dt * 1.4));
  F[q] = F[q]! + F[q + 2]! * dt;
  F[q + 1] = F[q + 1]! + F[q + 3]! * dt;
  F[q + 10] = F[q + 10]! + F[q + 9]! * dt;
  // The walls: a bounce, and a knock hard enough makes its own ripple.
  wall(p, q, 0), wall(p, q, 1), wall(p, q, 2), wall(p, q, 3);
  // The bob: a spring to the surface.
  F[q + 5] = F[q + 5]! + ((FV[0]! - F[q + 4]!) * 46 - F[q + 5]! * 6.5) * dt;
  F[q + 4] = F[q + 4]! + F[q + 5]! * dt;
  const v2 = F[q + 2]! * F[q + 2]! + F[q + 3]! * F[q + 3]!, off = Math.abs(F[q + 4]! - FV[0]!) + Math.abs(F[q + 5]!);
  if (v2 < 0.0004 && off < 0.004 && Math.abs(F[q + 9]!) < 0.02) (F[q + 2] = F[q + 3] = F[q + 5] = F[q + 9] = 0), (F[q + 4] = FV[0]!);
  else busy = true;
  if (st === F_HOME) {
    busy = true;
    if ((F[q + 8] = F[q + 8]! + dt / HOME_T) >= 1) (F[q + 7] = F_FLY), (F[q + 8] = 0), emit(p, E_BACK, F[q]!, F[q + 1]!);
  } else if (i === 0 && S[1]! < 0) {
    const gx = F[q]! - GOAL[0]!, gz = F[q + 1]! - GOAL[1]!;
    if (gx * gx + gz * gz < GOAL_R * GOAL_R) {
      (F[q + 7] = F_HOME), (F[q + 8] = 0), (p.homes = p.homes + 1);
      if (p.drops && (!p.best || p.drops < p.best)) p.best = p.drops;
      emit(p, E_HOME, F[q]!, F[q + 1]!, p.drops);
      p.drops = 0;
    }
  }
  return busy;
}
/** Floaters bump each other. */
function bump(p: Pool) {
  const F = p.F;
  let busy = false;
  for (let i = 0; i < NF; i++) {
    const a = i * FS;
    if (F[a + 7] !== F_AFLOAT && F[a + 7] !== F_HOME) continue;
    for (let j = i + 1; j < NF; j++) {
      const b = j * FS;
      if (F[b + 7] !== F_AFLOAT && F[b + 7] !== F_HOME) continue;
      const dx = F[b]! - F[a]!, dz = F[b + 1]! - F[a + 1]!, d = Math.sqrt(dx * dx + dz * dz) || 1e-6, rr = RAD[F[a + 6]!]! + RAD[F[b + 6]!]!;
      if (d >= rr) continue;
      const ux = dx / d, uz = dz / d, ma = MASS[F[a + 6]!]!, mb = MASS[F[b + 6]!]!, o = (rr - d) / (ma + mb);
      (F[a] = F[a]! - ux * o * mb), (F[a + 1] = F[a + 1]! - uz * o * mb), (F[b] = F[b]! + ux * o * ma), (F[b + 1] = F[b + 1]! + uz * o * ma);
      const vn = (F[b + 2]! - F[a + 2]!) * ux + (F[b + 3]! - F[a + 3]!) * uz;
      if (vn >= 0) continue;
      const jn = (-1.45 * vn) / (1 / ma + 1 / mb);
      (F[a + 2] = F[a + 2]! - (jn / ma) * ux), (F[a + 3] = F[a + 3]! - (jn / ma) * uz), (F[b + 2] = F[b + 2]! + (jn / mb) * ux), (F[b + 3] = F[b + 3]! + (jn / mb) * uz);
      // A glancing knock turns them.
      (F[a + 9] = F[a + 9]! + vn * 2), (F[b + 9] = F[b + 9]! - vn * 2);
      busy = true;
    }
  }
  return busy;
}
/** Wall w (0 left, 1 right, 2 far, 3 near) against floater q. */
function wall(p: Pool, q: number, w: number) {
  const F = p.F, ax = w >> 1, sgn = w & 1 ? -1 : 1, r = RAD[F[q + 6]!]!, at = w === 0 ? X0 + r : w === 1 ? X1 - r : w === 2 ? Z0 + r : Z1 - r, x = F[q + ax]!;
  if ((x - at) * sgn >= 0) return;
  F[q + ax] = at;
  const v = F[q + 2 + ax]!;
  if (v * sgn >= 0) return;
  F[q + 2 + ax] = -v * 0.45;
  if (-v * sgn > 0.45) {
    pulse(p, F[q]!, F[q + 1]!, Math.min(0.35, -v * sgn * 0.22));
    emit(p, E_KNOCK, F[q]!, F[q + 1]!, -v * sgn);
  }
}
/** A floater slot for a new drop: a free one, else the oldest drop afloat (it leaves with a splash). */
function slot(p: Pool) {
  const F = p.F;
  for (let i = 2; i < NF; i++) if (!F[i * FS + 7]) return (p.seq[i] = ++p.n), i;
  let k = 2;
  for (let i = 2, lo = Infinity; i < NF; i++) if (F[i * FS + 7] === F_AFLOAT && p.seq[i]! < lo) (lo = p.seq[i]!), (k = i);
  emit(p, E_GULP, F[k * FS]!, F[k * FS + 1]!, k, 1);
  p.seq[k] = ++p.n;
  return k;
}
/** The duck was hit: a foul. It flies back to the start; the run starts again. */
function foul(p: Pool) {
  const F = p.F;
  if (F[7] !== F_AFLOAT) return;
  (F[7] = F_FLY), (F[8] = 0);
  emit(p, E_FOUL, F[0]!, F[1]!);
  p.drops = 0;
}

/** The duck's flight back: its position at t (0..1) from (x, z) to the start, out = [x, y, z]. */
export function flight(x: number, z: number, t: number, out: Float64Array) {
  const e = t * t * (3 - 2 * t);
  (out[0] = x + (START[0]! - x) * e), (out[1] = 3.2 * t * (1 - t) * 1.6), (out[2] = z + (START[1]! - z) * e);
  return out;
}
