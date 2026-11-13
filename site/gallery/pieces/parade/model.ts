// Parade Day's float (site/gallery/pieces/parade/parade-day.ts): pure numbers, no DOM, seeded. The
// street runs from the start line (z = 0) to the grandstand (z = −LEN), straight down −z. The
// handlers walk it at a steady pace with the balloon tied over them: the team's x walks toward where
// you lean (−1..1), and the balloon swings after it on its lines (a damped spring) while the gusts
// push it sideways. Lampposts stand on both curbs, their arms and banners reaching into the street at
// balloon height; a balloon that passes one with its side over the arm bumps it (a squash, a push
// away), and the third bump lets the air out. Reach the finish line for the score: distance, minus
// the bumps, plus the finish and, with no bumps at all, the Perfect float bonus.
// tests/parade-day.test.mjs plays it headless (the autopilot floats every seed clean; no hands, it
// deflates; zero allocation a step).
import { seeded } from "../../../../src/kernel/random";

/** The street: length (start line to finish line), half-width (curb to curb), the balloon's half-width. */
export const LEN = 64, HALF = 3, BR = 1.2;
/** Walking pace (units a second), the team's reach and walking speed across, the balloon's swing. */
export const PACE = 3.3, TEAM = 2.6, WALK = 4, K = 9, C = 4.4, MAXX = 2.75;
/** Lampposts: how many, the first one's z and the gap between them. */
export const NP = 13, P0 = -7, GAP = 4.4;
/** Gusts: how many, and the warning before each one blows (the wind sock turns first). */
export const NG = 7, WARN = 1.1;
export const IDLE = 0, RUN = 1, DEFLATE = 2, DONE = 3;
/** Events this step. */
export const EV_START = 0, EV_BUMP = 1, EV_GUST = 2, EV_DEFLATE = 3, EV_FINISH = 4, EV_FLAT = 5;
/** Score parts: points per metre (a unit is 10 m), per bump, the finish, the perfect float. */
export const PER_M = 1, BUMP_PTS = 100, FINISH_PTS = 200, PERFECT_PTS = 500;

export type Float = ReturnType<typeof float>;

/** One parade. `I[0]` is the lean (−1..1), `I[1]` presses since the last step (a press starts it). */
export function float(seed: number, I: Float64Array) {
  // State: mode, time, z, team x, balloon x, its velocity, bumps, the squash clock, the deflate clock,
  // the wind now, the sock's reading (eases toward the next gust), the run clock, the last bump's post.
  const S = new Float64Array(16);
  const MODE = 0, T = 1, Z = 2, HX = 3, BX = 4, VX = 5, BUMPS = 6, SQ = 7, DF = 8, WIND = 9, SOCK = 10, RT = 11, LAST = 12, SPD = 13;
  // Posts: z, side (−1 left, 1 right), reach into the street from the curb, hit clock (≥ 0: swinging).
  const PZ = new Float64Array(NP * 2), PS = new Int8Array(NP * 2), PR = new Float64Array(NP * 2), PH = new Float64Array(NP * 2).fill(-1);
  // Gusts: z where it starts blowing, direction × strength, how long (in z) it blows.
  const GZ = new Float64Array(NG), GF = new Float64Array(NG), GL = new Float64Array(NG);
  const ev = new Uint8Array(6);
  let np = 0;

  function course(s: number) {
    const R = seeded(s);
    np = 0;
    let lastSide = R() < 0.5 ? -1 : 1;
    for (let k = 0; k < NP; k++) {
      const z = P0 - k * GAP, d = k / (NP - 1);
      // Every third post (after the first two) is a gate: an arm on each side, the gap off centre.
      if (k > 1 && k % 3 === 2) {
        const gap = 3.9 - d * 0.3, c = (R() - 0.5) * 2 * (HALF - gap / 2 - 0.25), l = c - gap / 2 + HALF, r = HALF - (c + gap / 2);
        (PZ[np] = z), (PS[np] = -1), (PR[np++] = Math.max(0.4, l));
        (PZ[np] = z), (PS[np] = 1), (PR[np++] = Math.max(0.4, r));
      } else {
        // A single arm, mostly on the other side from the last one; it reaches further down the street.
        lastSide = R() < 0.75 ? -lastSide : lastSide;
        (PZ[np] = z), (PS[np] = lastSide), (PR[np++] = 1.3 + d * 0.9 + R() * 0.4);
      }
    }
    // Gusts between the posts: alternating sides mostly, stronger down the street.
    let dir = R() < 0.5 ? -1 : 1;
    for (let g = 0; g < NG; g++) {
      (GZ[g] = -4 - g * 8.6 - R() * 2), (GL[g] = 3.5 + R() * 3), (GF[g] = dir * (3.2 + (g / NG) * 2.6 + R() * 1.2));
      dir = R() < 0.7 ? -dir : dir;
    }
    PH.fill(-1);
  }
  function reset() {
    S.fill(0);
    S[LAST] = -1;
    S[SPD] = PACE;
    PH.fill(-1);
  }
  course(seed);
  reset();

  /** The wind at z: 0 outside a gust, a quick ramp in and out. */
  function windAt(z: number) {
    for (let g = 0; g < NG; g++) {
      const u = (GZ[g]! - z) / GL[g]!;
      if (u < 0 || u > 1) continue;
      return GF[g]! * Math.min(1, u * 5, (1 - u) * 4);
    }
    return 0;
  }
  /** The next gust's force within the warning (what the wind sock reads), else the wind now. */
  function sockAt(z: number) {
    const ahead = WARN * S[SPD]!;
    for (let g = 0; g < NG; g++) {
      const d = z - GZ[g]!;
      if (d > 0 && d < ahead) return GF[g]!;
    }
    return windAt(z);
  }

  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = I[1]!;
    I[1] = 0;
    const mode = S[MODE]!;
    if (presses && mode === IDLE) {
      reset();
      S[MODE] = RUN;
      ev[EV_START] = 1;
      return true;
    }
    if (mode === IDLE || mode === DONE) {
      if (S[SQ]! > 0) S[SQ] = Math.max(0, S[SQ]! - dt);
      return S[SQ]! > 0 || swinging(dt);
    }
    S[RT] = S[RT]! + dt;
    // The walk: full pace while it floats; a sagging balloon slows them to a stop.
    if (mode === DEFLATE) {
      S[DF] = Math.min(1, S[DF]! + dt / 1.8);
      S[SPD] = PACE * Math.max(0, 1 - S[DF]! * 1.6);
      if (S[DF]! >= 1) (S[MODE] = DONE), (ev[EV_FLAT] = 1);
    }
    const z0 = S[Z]!, z = (S[Z] = z0 - S[SPD]! * dt);
    // The team walks across toward the lean (they can only walk so fast).
    const want = (mode === RUN ? Math.max(-1, Math.min(1, I[0]!)) : 0) * TEAM, hx = S[HX]!;
    S[HX] = hx + Math.max(-WALK * dt, Math.min(WALK * dt, want - hx));
    // The balloon swings after them; the wind pushes it.
    const w = (S[WIND] = mode === RUN ? windAt(z) : 0);
    if (mode === RUN && w && !windAt(z0)) ev[EV_GUST] = 1;
    S[SOCK] = S[SOCK]! + (sockAt(z) - S[SOCK]!) * (1 - Math.exp(-4 * dt));
    let vx = S[VX]! + (K * (S[HX]! - S[BX]!) - C * S[VX]! + w) * dt, bx = S[BX]! + vx * dt;
    if (bx > MAXX) (bx = MAXX), (vx = Math.min(0, vx));
    else if (bx < -MAXX) (bx = -MAXX), (vx = Math.max(0, vx));
    (S[BX] = bx), (S[VX] = vx);
    if (S[SQ]! > 0) S[SQ] = Math.max(0, S[SQ]! - dt);
    swinging(dt);
    // A post passed: its arm and banner reach in from the curb; the balloon's side over it bumps.
    if (mode === RUN)
      for (let i = 0; i < np; i++) {
        const pz = PZ[i]!;
        if (!(z0 > pz && z <= pz) || i === S[LAST]) continue;
        const edge = HALF - PR[i]!, side = PS[i]!;
        if (side * bx + BR > edge) {
          S[LAST] = i;
          S[BUMPS] = S[BUMPS]! + 1;
          (S[SQ] = 0.5), (PH[i] = 0);
          S[VX] = -side * 4.2;
          ev[EV_BUMP] = 1;
          if (S[BUMPS]! >= 3) (S[MODE] = DEFLATE), (S[DF] = 0), (ev[EV_DEFLATE] = 1);
        }
      }
    if (S[MODE] === RUN && z <= -LEN) (S[Z] = -LEN), (S[MODE] = DONE), (ev[EV_FINISH] = 1);
    return true;
  }
  function swinging(dt: number) {
    let on = false;
    for (let i = 0; i < np; i++) if (PH[i]! >= 0) (PH[i] = PH[i]! + dt), PH[i]! > 2.4 ? (PH[i] = -1) : (on = true);
    return on;
  }
  /** Metres walked (a unit is 10 m). */
  const metres = () => Math.round(-S[Z]! * 10);
  const finished = () => S[MODE] === DONE && S[BUMPS]! < 3;
  /** The score: distance, minus the bumps, plus the finish and the perfect float. */
  function score() {
    const b = S[BUMPS]!, f = finished();
    return Math.max(0, metres() * PER_M - b * BUMP_PTS + (f ? FINISH_PTS : 0) + (f && !b ? PERFECT_PTS : 0));
  }
  return {
    S, I, ev, PZ, PS, PR, PH, GZ, GF, GL, step, windAt, sockAt, metres, finished, score, course, reset,
    get np() {
      return np;
    },
  };
}

/** The autopilot (the poster's run and the tests): lean the team so the balloon rides the safe line
 *  past the next post, into the wind. Writes the lean into `I[0]`. */
export function autopilot(f: Float, I: Float64Array) {
  const S = f.S, z = S[2]!;
  let lo = -MAXX + 0.15, hi = MAXX - 0.15, near = Infinity;
  for (let i = 0; i < f.np; i++) {
    const d = z - f.PZ[i]!;
    if (d < -0.3 || d > near + 0.01 || d > 7) continue;
    if (d < near - 0.01) (near = d), (lo = -MAXX + 0.15), (hi = MAXX - 0.15);
    const edge = HALF - f.PR[i]! - BR - 0.3;
    f.PS[i]! > 0 ? (hi = Math.min(hi, edge)) : (lo = Math.max(lo, -edge));
  }
  const target = near < Infinity ? Math.max(lo, Math.min(hi, (lo + hi) / 2)) : 0;
  // At rest the balloon sits wind / K off the team: lean that much into it.
  I[0] = Math.max(-1, Math.min(1, (target - (f.windAt(z) + f.windAt(z - 2)) / 2 / K) / TEAM));
}
