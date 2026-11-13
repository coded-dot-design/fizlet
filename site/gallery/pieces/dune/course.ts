// Dune Hop's course and run, headless (tests/dune-hop.test.mjs plays it with no browser). The course
// is one fixed tabletop: ridged dunes from a seed on @fzlt/core/terrain, flattened to the plinth at
// the edges, a closed track carved in on its own smoothed profile and painted as a kind, two kickers, a set of whoops and a banked turn, and eight
// checkpoint gates round it (gate 0 is the start and the finish). The buggy is @fzlt/core/drive on
// that terrain. The run: the clock starts on the first input; pass the gates in order; every jump is
// judged by ./stunt.ts (airtime, clean or sketchy landing, combo); a landing too far off the slope,
// a rollover or a drive off the table crashes: a short tumble, then a respawn at the last gate.
// `autopilot` drives the whole course clean (the poster, the tests). Zero allocation per step.
import { terrain, type Terrain } from "../../../../src/terrain";
import { drive, type Drive } from "../../../../src/drive";
import { hypot } from "../../../../src/steer";
import { stunt, BUMP } from "./stunt";

export const COLS = 84, ROWS = 52, CELL = 0.4, HX = (COLS * CELL) / 2, HZ = (ROWS * CELL) / 2;
export const TRACK_W = 3.6, KIND_TRACK = 1, GATES = 8, LAPS = 2, NT = 96;
export const READY = 0, RUN = 1, CRASH = 2, DONE = 3;
/** Events for the scene (one ring, read and cleared each step): what happened, and a value. */
export const E_GATE = 1, E_LAND = 2, E_CRASH = 3, E_RESPAWN = 4, E_FINISH = 5, E_AIR = 6, E_START = 7;
const TAU = 6.283185307179586, TUMBLE = 1.35;

/** The track's centre line: NT points round a closed loop, x and z (counter-clockwise from above). */
export const TRACK = new Float64Array(NT * 2);
{
  // A rounded rectangle (a superellipse) with a kink on each short side, resampled to even steps.
  const M = 1536, P = new Float64Array(M * 2), L = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) {
    const a = (i / M) * TAU, c = Math.cos(a), s = Math.sin(a), pc = Math.sign(c) * Math.abs(c) ** 0.5, ps = Math.sign(s) * Math.abs(s) ** 0.5;
    P[i * 2] = 12.4 * pc;
    P[i * 2 + 1] = -6.4 * ps + 1.3 * Math.sin(2 * a) * Math.abs(c) ** 3;
  }
  for (let i = 0; i < M; i++) L[i + 1] = L[i]! + Math.hypot(P[((i + 1) % M) * 2]! - P[i * 2]!, P[((i + 1) % M) * 2 + 1]! - P[i * 2 + 1]!);
  for (let k = 0, i = 0; k < NT; k++) {
    const want = (k / NT) * L[M]!;
    while (L[i + 1]! < want) i++;
    const u = (want - L[i]!) / (L[i + 1]! - L[i]! || 1), j = (i + 1) % M;
    TRACK[k * 2] = P[i * 2]! + (P[j * 2]! - P[i * 2]!) * u;
    TRACK[k * 2 + 1] = P[i * 2 + 1]! + (P[j * 2 + 1]! - P[i * 2 + 1]!) * u;
  }
}
/** The gates: track index each stands on (0: the start and the finish). */
export const GATE_AT = Int32Array.from({ length: GATES }, (_, g) => Math.round((g * NT) / GATES));
/** The kickers: [track index of the run-up, height]. Laid on straights, with room to land. */
export const KICKERS = [16, 0.95, 63, 1.0];

/** The course: terrain (stamped), the track as a closed polyline. Pure: the same every time. */
export function course(): Terrain {
  const t = terrain({ cols: COLS, rows: ROWS, cell: CELL });
  t.noise({ seed: 20261109, amp: 2.6, scale: 7.5, octaves: 3, ridge: 0.78, wind: [1, 0.35], stretch: 2.6 });
  // Down to the plinth at the edges (the course is a slab of sand on a table).
  t.shape((x, z, h) => {
    const ex = Math.min(1, (HX - Math.abs(x)) / 2.4), ez = Math.min(1, (HZ - Math.abs(z)) / 2.4), e = Math.max(0, Math.min(ex, ez));
    return h * e * e * (3 - 2 * e);
  });
  // The track: its own gentle profile (the dunes under it, smoothed and lowered), carved in with a
  // soft blend into the sand either side.
  const H = new Float64Array(NT), half = TRACK_W / 2, edge = 2.2;
  for (let i = 0; i < NT; i++) {
    let m = 0;
    for (let k = -9; k <= 9; k++) {
      const j = (((i + k) % NT) + NT) % NT;
      m += t.height(TRACK[j * 2]!, TRACK[j * 2 + 1]!) / 19;
    }
    H[i] = 0.25 + m * 0.5;
  }
  t.shape((x, z, h) => {
    near(x, z);
    const d = NR[0]!;
    if (d >= half + edge) return h;
    const s = NR[1]!, y = H[s]! + (H[(s + 1) % NT]! - H[s]!) * NR[2]!, u = d <= half ? 0 : (d - half) / edge, w = 1 - u * u * (3 - 2 * u);
    return h + (y - h) * w;
  });
  for (let k = 0; k < KICKERS.length; k += 2) {
    const i = KICKERS[k]!, a = i * 2, b = ((i + 3) % NT) * 2;
    t.ramp([TRACK[a]!, TRACK[a + 1]!], [TRACK[b]!, TRACK[b + 1]!], { width: TRACK_W - 0.4, height: KICKERS[k + 1]!, back: 0.6, edge: 0.6 });
  }
  t.whoops([TRACK[74 * 2]!, TRACK[74 * 2 + 1]!], [TRACK[81 * 2]!, TRACK[81 * 2 + 1]!], { width: TRACK_W, height: 0.2, count: 4, edge: 0.8 });
  // A banked turn at the far end (the outside of the bend, on the right going round).
  const bend = new Float64Array(14);
  for (let k = 0; k < 7; k++) (bend[k * 2] = TRACK[(37 + k) * 2]!), (bend[k * 2 + 1] = TRACK[(37 + k) * 2 + 1]!);
  t.berm(bend, { width: TRACK_W + 1, height: 0.6, side: 1, edge: 1 });
  // The track's faces take its kind (its edge is a smooth line the scene draws over the cells).
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS * 2; i++) {
      const x = t.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * CELL, z = t.z0 + (j + (i & 1 ? 2 : 1) / 3) * CELL;
      t.kind[j * COLS * 2 + i] = trackDist(x, z) <= half ? KIND_TRACK : 0;
    }
  return t;
}

/** The track's two edges, [x, y, z] per track point, left then right, just over the sand. */
export function trackEdges(t: Terrain) {
  const E = new Float64Array(NT * 6), half = TRACK_W / 2;
  for (let i = 0; i < NT; i++) {
    const yaw = trackYaw(i), nx = Math.sin(yaw), nz = Math.cos(yaw);
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, x = TRACK[i * 2]! + nx * half * s, z = TRACK[i * 2 + 1]! + nz * half * s;
      E[k * NT * 3 + i * 3] = x; E[k * NT * 3 + i * 3 + 1] = t.height(x, z) + 0.04; E[k * NT * 3 + i * 3 + 2] = z;
    }
  }
  return E;
}
/** Contour lines of the dunes at `levels` (marching squares on the vertex grid), off the track:
 *  per level a Float32Array of segments [x0, y, z0, x1, y, z1, …]. */
export function contours(t: Terrain, levels: ArrayLike<number>) {
  const out: Float32Array[] = [], W1 = COLS + 1;
  for (let l = 0; l < levels.length; l++) {
    const L = levels[l]!, seg: number[] = [], P: number[] = [];
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const h = [t.h[j * W1 + i]!, t.h[j * W1 + i + 1]!, t.h[(j + 1) * W1 + i + 1]!, t.h[(j + 1) * W1 + i]!];
        const cx = [i, i + 1, i + 1, i], cz = [j, j, j + 1, j + 1];
        P.length = 0;
        for (let e = 0; e < 4; e++) {
          const a = h[e]! - L, b = h[(e + 1) & 3]! - L;
          if ((a < 0) !== (b < 0)) {
            const u = a / (a - b), n = (e + 1) & 3;
            P.push(t.x0 + (cx[e]! + (cx[n]! - cx[e]!) * u) * CELL, t.z0 + (cz[e]! + (cz[n]! - cz[e]!) * u) * CELL);
          }
        }
        for (let k = 0; k + 3 < P.length; k += 4) {
          const mx = (P[k]! + P[k + 2]!) / 2, mz = (P[k + 1]! + P[k + 3]!) / 2;
          if (trackDist(mx, mz) < TRACK_W / 2 + 0.6) continue;
          seg.push(P[k]!, L + 0.04, P[k + 1]!, P[k + 2]!, L + 0.04, P[k + 3]!);
        }
      }
    out.push(Float32Array.from(seg));
  }
  return out;
}
/** The nearest point on the track to (x, z): NR = [distance, segment, t along it]. */
const NR = new Float64Array(3);
function near(x: number, z: number) {
  NR[0] = Infinity;
  for (let s = 0; s < NT; s++) {
    const a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), d = hypot(x - ax - dx * u, z - az - dz * u);
    if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u);
  }
}
/** Distance from (x, z) to the track's centre line. */
export const trackDist = (x: number, z: number) => (near(x, z), NR[0]!);
/** The heading (drive's yaw) along the track at index i. */
export function trackYaw(i: number) {
  const a = (((i - 1) % NT) + NT) % NT, b = (i + 1) % NT;
  return Math.atan2(-(TRACK[b * 2 + 1]! - TRACK[a * 2 + 1]!), TRACK[b * 2]! - TRACK[a * 2]!);
}

/** A run on the course: the buggy, the gates, the clock, the scorer, the crash and respawn. */
export function duneRun() {
  const t = course();
  const v: Drive = drive(t, {
    kind: "car", wheels: [0.78, -0.62, 0.78, 0.62, -0.72, -0.62, -0.72, 0.62], radius: 0.34, rest: 0.34, travel: 0.3,
    accel: 9, top: 12, grip: 1.08, steer: 0.62, steerFall: 13, airPitch: 6, crashPitch: 0.72, crashRoll: 1.05, hz: 2.1, damping: 0.7,
    surfaces: [1, 1.08],
  });
  const sc = stunt({ minAir: 0.3, clean: 0.2, perSec: 100 });
  // S: phase, clock, next gate, last gate, crashes, crash time, the last landing's air, near index, started.
  const S = new Float64Array(12);
  const PH = 0, CLK = 1, NEXT = 2, LAST = 3, CR = 4, CT = 5, LAIR = 6, NEAR = 7, GO = 8, PAIR = 9, PP = 10, LAP = 11;
  // The pose the scene draws: the drive's, or the tumble's after a crash. Tumble: pos, vel, rot, spin.
  const pos = new Float64Array(3), rot = new Float64Array(3), TV = new Float64Array(6);
  // Events: [type, value] × 8, n.
  const ev = new Float64Array(16);
  let nev = 0, offTable = false;
  const emit = (type: number, val: number) => nev < 8 && ((ev[nev * 2] = type), (ev[nev * 2 + 1] = val), nev++);
  const passed = new Uint8Array(GATES);

  function place(gate: number) {
    const i = GATE_AT[gate % GATES]!, yaw = trackYaw(i);
    // Just behind the gate, so the respawn faces through it.
    v.reset(TRACK[i * 2]! - Math.cos(yaw) * 1.6, TRACK[i * 2 + 1]! + Math.sin(yaw) * 1.6, yaw);
    S[NEAR] = (i - 2 + NT) % NT;
    pos.set(v.pos);
    rot.set(v.rot);
  }
  function reset() {
    S.fill(0);
    S[NEXT] = 1;
    passed.fill(0);
    passed[0] = 1;
    sc.reset();
    nev = 0;
    offTable = false;
    place(0);
  }
  /** The nearest track index to the buggy, searched a few points either side of the last one. */
  function near() {
    let best = Infinity, bi = S[NEAR]!;
    for (let k = -4; k <= 8; k++) {
      const i = ((S[NEAR]! + k) % NT + NT) % NT, d = (TRACK[i * 2]! - v.pos[0]!) ** 2 + (TRACK[i * 2 + 1]! - v.pos[2]!) ** 2;
      if (d < best) (best = d), (bi = i);
    }
    S[NEAR] = bi;
    return bi;
  }
  function crash(off: boolean) {
    S[PH] = CRASH;
    S[CT] = 0;
    S[CR] = S[CR]! + 1;
    sc.crash();
    offTable = off;
    pos.set(v.pos);
    rot.set(v.rot);
    TV[0] = v.vel[0]! * 0.7; TV[1] = Math.max(3, v.vel[1]! + 4); TV[2] = v.vel[2]! * 0.7;
    // Spin: a roll and a flip, by how it came down.
    TV[3] = 7 + Math.abs(v.speed) * 0.3; TV[4] = 2.2; TV[5] = (v.rot[2]! < 0 ? -1 : 1) * 5;
    emit(E_CRASH, off ? 1 : 0);
  }
  /** The tumble: thrown up, spinning, bouncing on the sand (or off the table's edge, down). */
  function tumble(dt: number) {
    S[CT] = S[CT]! + dt;
    TV[1] = TV[1]! - 20 * dt;
    pos[0] = pos[0]! + TV[0]! * dt; pos[1] = pos[1]! + TV[1]! * dt; pos[2] = pos[2]! + TV[2]! * dt;
    rot[0] = rot[0]! + TV[3]! * dt; rot[1] = rot[1]! + TV[4]! * dt; rot[2] = rot[2]! + TV[5]! * dt;
    const inside = Math.abs(pos[0]!) < HX && Math.abs(pos[2]!) < HZ, g = inside ? t.height(pos[0]!, pos[2]!) + 0.4 : -30;
    if (pos[1]! < g) {
      pos[1] = g;
      TV[1] = Math.abs(TV[1]!) * 0.38;
      TV[0] = TV[0]! * 0.6; TV[2] = TV[2]! * 0.6;
      TV[3] = TV[3]! * 0.55; TV[4] = TV[4]! * 0.5; TV[5] = TV[5]! * 0.55;
    }
    if (S[CT]! >= TUMBLE) {
      S[PH] = RUN;
      place(S[LAST]!);
      emit(E_RESPAWN, S[LAST]!);
    }
  }

  /** Advance dt with the inputs (throttle 0..1, brake 0..1, steer −1..1); true while anything moves. */
  function step(dt: number, th: number, br: number, st: number) {
    const ph = S[PH]!;
    if (ph === READY && (th > 0 || br > 0)) (S[PH] = RUN), (S[GO] = 1), emit(E_START, 0);
    if (S[PH] === READY) return v.set(0, 0, 0), v.step(dt);
    if (S[PH] === CRASH) {
      v.set(0, 0, 0);
      S[CLK] = S[CLK]! + dt;
      tumble(dt);
      return true;
    }
    const done = S[PH] === DONE;
    if (done) v.set(0, Math.abs(v.speed) > 0.3 ? 1 : 0, 0);
    else v.set(th, br, st);
    const wasAir = v.air;
    const moved = v.step(dt);
    // The clock runs while the buggy does (stopped with no pedal, it waits: the engine can settle).
    if (S[PH] === RUN && moved) S[CLK] = S[CLK]! + dt;
    if (wasAir === 0 && v.air > 0) emit(E_AIR, 0);
    if (v.air > 0) S[PAIR] = v.air;
    pos.set(v.pos);
    rot.set(v.rot);
    if (done) return moved;
    // A landing: judged by the scorer (the drive already crashed it when it was too far off).
    if (wasAir > 0 && v.air === 0 && !v.crashed) {
      const k = sc.land(S[PAIR]!, v.landing[1]!);
      if (k !== BUMP) (S[LAIR] = S[PAIR]!), emit(E_LAND, k);
    }
    if (S[PH] !== RUN || !moved) return moved;
    if (v.crashed) return crash(false), true;
    if (Math.abs(v.pos[0]!) > HX - 0.25 || Math.abs(v.pos[2]!) > HZ - 0.25) return crash(true), true;
    near();
    // The next gate: through it when within its half width.
    const g = S[NEXT]! % GATES, gi = GATE_AT[g]!;
    if (hypot(v.pos[0]! - TRACK[gi * 2]!, v.pos[2]! - TRACK[gi * 2 + 1]!) < TRACK_W * 0.75) {
      passed[g] = 1;
      S[LAST] = g;
      S[NEXT] = S[NEXT]! + 1;
      if (g === 0) S[LAP] = S[LAP]! + 1;
      if (S[NEXT]! > GATES * LAPS) (S[PH] = DONE), emit(E_FINISH, 0);
      else emit(E_GATE, g);
      // A new lap: every gate lights again.
      if (g === 0) passed.fill(0), (passed[0] = 1);
    }
    return true;
  }

  /** Inputs that drive the course clean: out = [throttle, brake, steer]. Speed down in the tight
   *  turns, the body levelled in the air. */
  function autopilot(out: Float64Array) {
    const i = S[PH] === CRASH ? S[NEAR]! : near(), k = ((i + 4) % NT) * 2;
    const fx = Math.cos(v.yaw), fz = -Math.sin(v.yaw), ux = TRACK[k]! - v.pos[0]!, uz = TRACK[k + 1]! - v.pos[2]!, ul = hypot(ux, uz) || 1;
    const cross = (fx * uz - fz * ux) / ul, sp = v.speed, want = Math.abs(cross) > 0.35 ? 6.5 : 9.5;
    out[2] = Math.max(-1, Math.min(1, cross * 3));
    const p = v.rot[2]!, rate = (p - S[PP]!) * 60;
    S[PP] = p;
    if (v.air > 0) {
      // Level it: pitch and its rate (nose up +): brake tips the nose down, throttle lifts it.
      const c = p + rate * 0.3;
      out[0] = c < -0.05 ? 1 : 0;
      out[1] = c > 0.05 ? 1 : 0;
    } else {
      out[0] = sp < want ? 1 : sp < want + 1 ? 0.4 : 0;
      out[1] = sp > want + 2.5 ? 0.6 : 0;
    }
    return out;
  }

  reset();
  return {
    /** The terrain (its view draws it). */
    t,
    /** The buggy (wheels, springs, spin). */
    v,
    /** The scorer. */
    sc,
    /** [phase, clock, next gate (counting on through the laps), last gate, crashes, crash time, last landing's air, near index, started, air, -, laps done]. */
    S,
    /** Where to draw the body and how it is turned (the drive's, or the tumble's). */
    pos,
    rot,
    /** 1 for each gate passed this run. */
    passed,
    /** Events since the last `clear`: [type, value] pairs, `n` of them. */
    ev,
    get n() {
      return nev;
    },
    clear: () => void (nev = 0),
    get offTable() {
      return offTable;
    },
    step,
    reset,
    autopilot,
    /** Seconds of tumble before a respawn. */
    tumble: TUMBLE,
  };
}
export type DuneRun = ReturnType<typeof duneRun>;
