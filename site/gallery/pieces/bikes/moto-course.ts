// Moto Track's course and race, headless (tests/moto-track.test.mjs races it with no browser). One
// fixed tabletop motocross track on @fzlt/core/terrain: a loop of four straights and four bermed
// left-handers, its floor carved level into rolling dirt, and the features stamped along it from one
// height profile over the lap: the start gate, a rhythm section of doubles, the whoops, the big triple
// and the finish tabletop. Four riders on ./bike.ts (the player and three rivals with their own
// bikes and nerve), the gate, the laps, places, crashes and the respawn. `autopilot` rides a rival
// (or the player, for the poster and the tests). Zero allocation per step.
import { terrain, type Terrain } from "../../../../src/terrain";
import { bike, nudge, type Bike, type Power, TWO_STROKE, FOUR_STROKE, B_CRASH, B_LAND, B_WHEELIE, STRIKE } from "./bike";

export const COLS = 104, ROWS = 68, CELL = 0.45, HX = (COLS * CELL) / 2, HZ = (ROWS * CELL) / 2;
export const TRACK_W = 3.4, KIND_TRACK = 1, KIND_FACE = 2, RIDERS = 4, LAPS = 3;
export const PICK = 0, GRID = 1, RACE = 2, DONE = 3;
/** Events (one ring, read and cleared each step): [type, rider, value]. */
export const E_GATE = 1, E_LAP = 2, E_FINISH = 3, E_CRASH = 4, E_RESPAWN = 5, E_LAND = 6, E_WHEELIE = 7, E_PLACE = 8, E_COUNT = 9;
const COUNT = 3, RESPAWN = 1.45;

// ---- the track: a closed centre line, integrated from straights and left turns, resampled ----
const A = 19.2, B = 10.7, RAD = 5.2, DS = 0.5;
/** The lap's sections in order: straight length, or a 90° left turn of radius RAD. */
const PLAN = [2 * (A - RAD), -1, 2 * (B - RAD), -1, 2 * (A - RAD), -1, 2 * (B - RAD), -1];
export const LAP = PLAN.reduce((s, v) => s + (v < 0 ? (Math.PI / 2) * RAD : v), 0);
export const NT = Math.round(LAP / DS);
/** The centre line, x and z per point (DS apart), and its heading (bike yaw) per point. */
export const TRACK = new Float64Array(NT * 2), YAW = new Float64Array(NT);
/** Where the turns are: 1 per point inside a turn. */
export const TURN = new Uint8Array(NT);
{
  const fine = 0.01;
  let x = -A + RAD, z = B, psi = 0, s = 0, k = 0, next = 0;
  for (let sec = 0; sec < PLAN.length; sec++) {
    const v = PLAN[sec]!, len = v < 0 ? (Math.PI / 2) * RAD : v, n = Math.round(len / fine);
    for (let i = 0; i < n; i++) {
      if (s >= next - 1e-9 && k < NT) (TRACK[k * 2] = x), (TRACK[k * 2 + 1] = z), (YAW[k] = psi), (TURN[k] = v < 0 ? 1 : 0), k++, (next = k * (LAP / NT));
      const d = len / n;
      if (v < 0) psi += d / RAD;
      x += Math.cos(psi) * d;
      z -= Math.sin(psi) * d;
      s += d;
    }
  }
  for (; k < NT; k++) (TRACK[k * 2] = TRACK[(k - 1) * 2]!), (TRACK[k * 2 + 1] = TRACK[(k - 1) * 2 + 1]!), (YAW[k] = YAW[k - 1]!);
}
/** Distance along the lap of point i. */
export const sAt = (i: number) => (i * LAP) / NT;
export const S_TURN1 = 2 * (A - RAD), Q = (Math.PI / 2) * RAD;
const S1 = S_TURN1 + Q, S2 = S1 + 2 * (B - RAD) + Q, S3 = S2 + 2 * (A - RAD) + Q;

/** The features: [kind, start s, …]. The profile is their heights over the lap. */
export const GATE_S = 1.2, LINE_S = 1.6;
const F_DOUBLE = 1, F_WHOOPS = 2, F_TRIPLE = 3, F_TABLE = 4;
export const FEATURES = [
  F_DOUBLE, 7.5, F_DOUBLE, 15.5,
  F_WHOOPS, S1 + 0.6,
  F_TRIPLE, S2 + 9.5,
  F_TABLE, S3 + 1.4,
];
/** Feature names for the HUD, by kind. */
export const FEATURE_NAMES = ["", "RHYTHM", "WHOOPS", "TRIPLE", "TABLETOP"];
/** Which feature is under a lap distance (FK) and its height (PF), from prof(s): no double crosses a call (one returned would be boxed). */
export const FK = new Int32Array(1), PF = new Float64Array(1);
const sm = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** A jump: up a face of `up` to `h`, a short back side, a gap, then a landing: a steep face back up to `lh` and a long down ramp `down`. */
function jump(d: number, up: number, h: number, back: number, gap: number, lh: number, face: number, down: number) {
  if (d < 0) return void (PF[0] = 0);
  if (d < up) return void (PF[0] = h * (d / up) ** 1.25);
  d -= up;
  if (d < back) return void (PF[0] = h * (1 - sm(d / back)));
  d -= back;
  if (d < gap) return void (PF[0] = 0);
  d -= gap;
  if (d < face) return void (PF[0] = lh * sm(d / face));
  d -= face;
  if (d < down) return void (PF[0] = lh * (1 - sm(d / down)));
  return void (PF[0] = 0);
}
/** The track's height over its floor at lap distance s (and which feature: FK). */
export function profile(s: number) {
  prof(s);
  return PF[0]!;
}
export function prof(s: number) {
  s = ((s % LAP) + LAP) % LAP;
  FK[0] = 0;
  for (let k = 0; k < FEATURES.length; k += 2) {
    const kind = FEATURES[k]!, d = s - FEATURES[k + 1]!;
    if (d < 0 || d > 14) continue;
    FK[0] = kind;
    if (kind === F_DOUBLE) return jump(d, 1.8, 0.8, 0.5, 1.6, 0.8, 0.5, 2.4);
    if (kind === F_WHOOPS) {
      if (d > 9.5) continue;
      // Five rollers, round (no face steeper than about 22°).
      return void (PF[0] = 0.25 * (0.5 - 0.5 * Math.cos((d / 1.9) * Math.PI * 2)));
    }
    if (kind === F_TRIPLE) {
      // Up a tall face, a hump in the gap (the middle jump of the three), then the landing face and its long down ramp.
      if (d < 3.2) return void (PF[0] = 1.45 * (d / 3.2) ** 1.25);
      if (d < 3.8) return void (PF[0] = 1.45 - 1.05 * sm((d - 3.2) / 0.6));
      if (d < 6.9) return void (PF[0] = 0.4 + 0.35 * Math.sin(((d - 3.8) / 3.1) * Math.PI));
      if (d < 8) return void (PF[0] = 0.4 + sm((d - 6.9) / 1.1));
      if (d < 12.6) return void (PF[0] = 1.4 * (1 - sm((d - 8) / 4.6)));
      continue;
    }
    if (kind === F_TABLE) {
      if (d < 2.1) return void (PF[0] = 0.95 * (d / 2.1) ** 1.2);
      if (d < 5.3) return void (PF[0] = 0.95);
      if (d < 8) return void (PF[0] = 0.95 * (1 - sm((d - 5.3) / 2.7)));
      continue;
    }
  }
  return void (PF[0] = 0);
}
/** The track floor's height (the ground round it is shaped to it). */
export const FLOOR = 0.3;

/** The nearest point on the centre line to (x, z): NR = [distance, segment, t along it, signed side]. */
export const NR = new Float64Array(4);
export function near(x: number, z: number, from = -1, span = 0) {
  NR[0] = Infinity;
  const a0 = from < 0 ? 0 : from - span, a1 = from < 0 ? NT : from + span;
  for (let q = a0; q < a1; q++) {
    const s = ((q % NT) + NT) % NT, a = s * 2, b = ((s + 1) % NT) * 2, ax = TRACK[a]!, az = TRACK[a + 1]!, dx = TRACK[b]! - ax, dz = TRACK[b + 1]! - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = x - ax - dx * u, pz = z - az - dz * u, d = Math.sqrt(px * px + pz * pz);
    if (d < NR[0]!) (NR[0] = d), (NR[1] = s), (NR[2] = u), (NR[3] = dx * pz - dz * px >= 0 ? 1 : -1);
  }
}

/** The course: terrain with the track carved and the features stamped. Pure: the same every time. */
export function course(): Terrain {
  const t = terrain({ cols: COLS, rows: ROWS, cell: CELL });
  // Rolling dirt round the track, down to the plinth at the edges.
  t.noise({ seed: 20261118, amp: 1.6, scale: 9, octaves: 3, ridge: 0.2 });
  t.shape((x, z, h) => {
    const ex = Math.min(1, (HX - Math.abs(x)) / 2.6), ez = Math.min(1, (HZ - Math.abs(z)) / 2.6), e = Math.max(0, Math.min(ex, ez));
    return h * e * e * (3 - 2 * e) * 0.9;
  });
  const half = TRACK_W / 2, edge = 1.8;
  t.shape((x, z, h) => {
    near(x, z);
    const d = NR[0]!;
    if (d >= half + edge + 0.6) return h;
    const s = sAt(NR[1]! + NR[2]!), y = FLOOR + profile(s), u = d <= half + 0.3 ? 0 : (d - half - 0.3) / edge, w = 1 - sm(u);
    // A low bank of dirt along each side (the track sits in it).
    const lip = d > half + 0.3 && d < half + edge ? 0.22 * Math.sin(((d - half - 0.3) / edge) * Math.PI) : 0;
    return h + (y - h) * w + lip * (1 - w * 0.5);
  });
  // The berms: the outside (right) of each left turn banked up.
  for (let k = 0, i = 0; k < 4; k++) {
    while (i < NT && !TURN[i]) i++;
    const i0 = i;
    while (i < NT && TURN[i]) i++;
    const n = i - i0 + 2, P = new Float64Array(n * 2);
    for (let j = 0; j < n; j++) {
      const q = ((i0 - 1 + j) % NT) * 2;
      P[j * 2] = TRACK[q]!;
      P[j * 2 + 1] = TRACK[q + 1]!;
    }
    t.berm(P, { width: TRACK_W + 1.2, height: 0.75, side: 1, edge: 1.2 });
  }
  // Paint: the track's faces, and the features' faces.
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS * 2; i++) {
      const x = t.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * CELL, z = t.z0 + (j + (i & 1 ? 2 : 1) / 3) * CELL;
      near(x, z);
      if (NR[0]! > half) continue;
      const s = sAt(NR[1]! + NR[2]!), p = profile(s);
      t.kind[j * COLS * 2 + i] = p > 0.05 && FK[0] !== F_WHOOPS ? KIND_FACE : KIND_TRACK;
    }
  return t;
}

/** The track's two edges, [x, y, z] per point, left then right, just over the dirt. */
export function trackEdges(t: Terrain) {
  const E = new Float64Array(NT * 6), half = TRACK_W / 2 + 0.05;
  for (let i = 0; i < NT; i++) {
    const nx = Math.sin(YAW[i]!), nz = Math.cos(YAW[i]!);
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, x = TRACK[i * 2]! + nx * half * s, z = TRACK[i * 2 + 1]! + nz * half * s;
      E[k * NT * 3 + i * 3] = x; E[k * NT * 3 + i * 3 + 1] = t.height(x, z) + 0.04; E[k * NT * 3 + i * 3 + 2] = z;
    }
  }
  return E;
}

/** The speed a rival wants at each point (turns slow, the triple's run-up fast, the whoops skimmed). */
const WANT = new Float64Array(NT);
{
  for (let i = 0; i < NT; i++) {
    const s = sAt(i);
    let w = 14.5;
    // Ahead: the turn (brake into it), a feature (its speed).
    for (let a = 0; a <= 16; a++) {
      const j = (i + a) % NT, sj = sAt(j);
      if (TURN[j]) w = Math.min(w, 8.6 + a * 0.55);
      profile(sj);
      const f = FK[0]!;
      if (f === 1) w = Math.min(w, 10.2 + a * 0.4);
      if (f === 2) w = Math.min(w, 12.5);
      if (f === 3 && a > 3) w = Math.min(w, 12.8);
      if (f === 4) w = Math.min(w, 11.4 + a * 0.3);
    }
    profile(s);
    if (FK[0] === 3) w = 12.8;
    WANT[i] = w;
  }
}

/** A race: four riders, the gate, laps and places. The player is rider 0. */
export function motoRace(seed = 20261118) {
  const t = course();
  const riders: Bike[] = [];
  const POWERS: Power[] = [TWO_STROKE, FOUR_STROKE, TWO_STROKE, FOUR_STROKE];
  for (let r = 0; r < RIDERS; r++) riders.push(bike(t, POWERS[r]!));
  // Per rider: near index, laps, progress (laps × LAP + s), lane, nerve (speed share), finish time,
  // crashes, place, last pitch (for the autopilot), respawn, best lap, lap start, finished.
  const R = new Float64Array(RIDERS * 16);
  const NI = 0, LP = 1, PG = 2, LN = 3, NV = 4, FT = 5, CR = 6, PL = 7, PP = 8, LS = 9, BL = 10, DN = 11, LT = 12, OFF = 13;
  const S = new Float64Array(8); // phase, clock, countdown, gate down, started
  const ev = new Float64Array(48);
  let nev = 0, rnd = seed >>> 0;
  const rand = () => ((rnd = (Math.imul(rnd ^ (rnd >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 4294967296);
  const emit = (type: number, r: number, v: number) => void (nev < 16 && ((ev[nev * 3] = type), (ev[nev * 3 + 1] = r), (ev[nev * 3 + 2] = v), nev++));
  const IN = new Float64Array(5), LD = new Float64Array(1), G4 = new Float64Array(4), HOLD = new Float64Array(3);

  function place(r: number, i: number, lane: number, back = 0) {
    const b = riders[r]!, yaw = YAW[i]!, nx = Math.sin(yaw), nz = Math.cos(yaw);
    b.reset(TRACK[i * 2]! + nx * lane - Math.cos(yaw) * back, TRACK[i * 2 + 1]! + nz * lane + Math.sin(yaw) * back, yaw);
    R[r * 16 + NI] = i;
  }
  function reset(power?: Power) {
    if (power) riders[0]!.use(power), (POWERS[0] = power);
    S.fill(0);
    nev = 0;
    rnd = seed >>> 0;
    R.fill(0);
    const gi = Math.round(GATE_S / (LAP / NT)) - 1;
    for (let r = 0; r < RIDERS; r++) {
      // Lanes across the gate, the player second from the inside.
      const lane = [-0.35, -1.15, 0.45, 1.25][r]!;
      R[r * 16 + LN] = lane;
      R[r * 16 + NV] = r ? 0.9 + rand() * 0.08 : 1;
      place(r, gi, lane, 0.35);
      R[r * 16 + PG] = sAt(gi) - 0.35;
      R[r * 16 + PL] = r;
    }
  }
  /** The nearest track point to rider r, searched round its last; its progress and laps. */
  function track(r: number) {
    const b = riders[r]!, o = r * 16;
    near(b.pos[0]!, b.pos[2]!, R[o + NI]!, 8);
    const was = R[o + PG]!, s = sAt(NR[1]! + NR[2]!), ws = ((was % LAP) + LAP) % LAP;
    R[o + NI] = NR[1]!;
    R[o + OFF] = NR[0]! * NR[3]!;
    // Progress runs on through the laps (the step along the line, wrapped).
    let ds = s - ws;
    ds -= LAP * Math.floor(ds / LAP + 0.5);
    const now = (R[o + PG] = was + ds);
    // Over the line: a lap done.
    const laps = Math.floor((now - LINE_S) / LAP), before = Math.floor((was - LINE_S) / LAP);
    if (laps > before && laps >= 1 && laps > R[o + LP]! && !R[o + DN]) {
      R[o + LP] = laps;
      const lapT = S[1]! - R[o + LT]!;
      R[o + LT] = S[1]!;
      if (!R[o + BL] || lapT < R[o + BL]!) R[o + BL] = lapT;
      if (laps >= LAPS) (R[o + DN] = 1), (R[o + FT] = S[1]!), places(), emit(E_FINISH, r, R[o + PL]!);
      else emit(E_LAP, r, laps);
    }
  }
  function places() {
    for (let r = 0; r < RIDERS; r++) {
      let p = 0;
      for (let q = 0; q < RIDERS; q++) {
        if (q === r) continue;
        const dq = R[q * 16 + DN]!, dr = R[r * 16 + DN]!;
        if (dq && dr ? R[q * 16 + FT]! < R[r * 16 + FT]! : dq ? 1 : dr ? 0 : R[q * 16 + PG]! > R[r * 16 + PG]! || (R[q * 16 + PG] === R[r * 16 + PG] && q < r)) p++;
      }
      if (p !== R[r * 16 + PL] && !R[r * 16 + DN]) {
        if (r === 0 && S[0] === RACE) emit(E_PLACE, 0, p);
        R[r * 16 + PL] = p;
      }
    }
  }

  /** Inputs that ride rider r round the track: out = [gas, brake, lean, steer, trick]. */
  function autopilot(r: number, out: Float64Array) {
    const b = riders[r]!, i = R[r * 16 + NI]!, sp = b.speed, look = 4 + Math.max(0, sp) * 0.22 | 0, k = (i + look) % NT;
    prof(sAt(i + 3));
    const onJump = FK[0] === 1 || FK[0] === 3 || FK[0] === 4, lane = onJump ? R[r * 16 + LN]! * 0.25 : R[r * 16 + LN]! * 0.7;
    const tx = TRACK[k * 2]! + Math.sin(YAW[k]!) * lane, tz = TRACK[k * 2 + 1]! + Math.cos(YAW[k]!) * lane;
    const fx = b.cy, fz = -b.sy, ux = tx - b.pos[0]!, uz = tz - b.pos[2]!, ul = Math.sqrt(ux * ux + uz * uz) || 1;
    const cross = (fx * uz - fz * ux) / ul;
    out[3] = Math.max(-1, Math.min(1, cross * 2.6));
    const want = WANT[i]! * (onJump ? 1 : R[r * 16 + NV]!);
    const p = b.pitch, rate = (p - R[r * 16 + PP]!) * 60;
    R[r * 16 + PP] = p;
    out[4] = 0;
    if (b.air > 0) {
      // In the air: match the ground ahead (a down ramp is nose down), the gas off.
      landing(b);
      prof(LD[0]! + 0.3);
      const hi = PF[0]!;
      prof(LD[0]! - 0.3);
      const slope = Math.atan((hi - PF[0]!) / 0.6);
      const e = slope - (p + rate * 0.25);
      out[2] = Math.max(-1, Math.min(1, e * 3.2));
      out[0] = 0;
      out[1] = 0;
    } else {
      out[0] = sp < want ? 1 : sp < want + 0.8 ? 0.35 : 0;
      out[1] = sp > want + 2 ? 0.8 : 0;
      // Keep the front down (a wheelie out of a turn costs the line).
      const rel = b.rel;
      out[2] = rel > 0.12 ? -1 : rel > 0.05 ? -0.4 : 0;
    }
    return out;
  }
  /** Where a bike in the air comes down: its flight stepped on to the ground ahead, as a lap distance, into LD. */
  function landing(b: Bike) {
    let x = b.pos[0]!, y = b.pos[1]! - 0.7, z = b.pos[2]!, vy = b.vy;
    const vx = b.cy * b.speed, vz = -b.sy * b.speed;
    for (let k = 0; k < 60; k++) {
      x += vx * 0.03; z += vz * 0.03; vy -= 20 * 0.03; y += vy * 0.03;
      t.sample(x, z, G4);
      if (y <= G4[0]!) break;
    }
    near(x, z, R[riders.indexOf(b) * 16 + NI]!, 30);
    LD[0] = sAt(NR[1]! + NR[2]!);
  }
  /** Rider r's bike events into the race's (a crash counts; the player's landings and wheelies). */
  function bikeEvents(r: number) {
    const b = riders[r]!;
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_CRASH) (R[r * 16 + CR] = R[r * 16 + CR]! + 1), emit(E_CRASH, r, v);
      else if (type === B_LAND && !r) emit(E_LAND, 0, v);
      else if (type === B_WHEELIE && !r) emit(E_WHEELIE, 0, v);
    }
    b.clear();
  }
  /** Advance dt with the player's inputs (gas, brake, lean, steer); `auto` rides the player too. */
  function step(dt: number, I: Float64Array, auto = false) {
    const ph = S[0]!;
    let moving = false;
    if (ph === PICK) {
      for (let r = 0; r < RIDERS; r++) riders[r]!.set(0, 1, 0, 0), riders[r]!.step(dt) && (moving = true);
      return moving;
    }
    if (ph === GRID) {
      // The countdown: everyone holds the brake against the gate and revs; it drops on 0.
      const before = Math.ceil(S[2]!);
      S[2] = S[2]! - dt;
      if (Math.ceil(S[2]!) !== before && S[2]! > 0) emit(E_COUNT, 0, Math.ceil(S[2]!));
      for (let r = 0; r < RIDERS; r++) {
        const b = riders[r]!;
        if (r || auto) b.set(0.4 + 0.4 * (Math.sin(S[2]! * 7 + r) > 0 ? 1 : 0), 1, 0, 0);
        else b.set(I[0]!, 1, I[2]!, 0);
        // The gate holds the front wheel: it revs and squats, it does not roll.
        HOLD[0] = b.pos[0]!; HOLD[2] = b.pos[2]!;
        b.step(dt);
        b.pos[0] = HOLD[0]!; b.pos[2] = HOLD[2]!;
        b.S[5] = 0;
      }
      if (S[2]! <= 0) (S[0] = RACE), (S[3] = 1), emit(E_GATE, 0, 0);
      return true;
    }
    S[1] = S[1]! + (ph === RACE ? dt : 0);
    for (let r = 0; r < RIDERS; r++) {
      const b = riders[r]!, o = r * 16;
      if (b.crashed) {
        b.set(0, 0, 0, 0);
        b.step(dt);
        bikeEvents(r);
        if (b.crashTime > RESPAWN) {
          // Back on the track just behind where it went down, facing on.
          let i = (R[o + NI]! - 1 + NT) % NT;
          for (let k = 0; k < 40 && (prof(sAt(i)), PF[0]! > 0.02 || (prof(sAt(i + 2)), PF[0]! > 0.02)); k++) i = (i - 1 + NT) % NT;
          place(r, i, R[o + LN]! * 0.5);
          R[o + PG] = R[o + PG]! - ((((sAt(R[o + NI]!) - sAt(i)) % LAP) + LAP) % LAP);
          emit(E_RESPAWN, r, 0);
        }
        moving = true;
        continue;
      }
      if (R[o + DN]) {
        // Past the flag: roll on, easing off, to a stop on the start straight.
        b.set(0, Math.abs(b.speed) > 0.4 ? 0.5 : 0, 0, autopilot(r, IN)[3]!);
        if (b.step(dt)) moving = true;
        track(r);
        continue;
      }
      if (r || auto) autopilot(r, IN), b.set(IN[0]!, IN[1]!, IN[2]!, IN[3]!, 0);
      else b.set(I[0]!, I[1]!, I[2]!, I[3]!, 0);
      if (b.step(dt)) moving = true;
      bikeEvents(r);
      track(r);
      // Off the table: a crash.
      if (!b.crashed && (Math.abs(b.pos[0]!) > HX - 0.3 || Math.abs(b.pos[2]!) > HZ - 0.3)) b.knock(STRIKE), b.clear(), (R[o + CR] = R[o + CR]! + 1), emit(E_CRASH, r, 9);
    }
    for (let a = 0; a < RIDERS; a++) for (let c = a + 1; c < RIDERS; c++) nudge(riders[a]!, riders[c]!, 0.75);
    places();
    if (S[0] === RACE && R[DN]) (S[0] = DONE), (moving = true);
    return moving || S[0] === RACE;
  }
  /** Line up and start the countdown, on `power`. */
  function go(power: Power) {
    reset(power);
    S[0] = GRID;
    S[2] = COUNT;
    emit(E_COUNT, 0, COUNT);
  }

  reset();
  return {
    t, riders, R, S, ev,
    get n() { return nev; },
    clear: () => void (nev = 0),
    get phase() { return S[0]!; },
    /** Seconds since the gate. */
    get clock() { return S[1]!; },
    /** Countdown seconds left. */
    get count() { return S[2]!; },
    lap: (r: number) => Math.max(1, Math.min(LAPS, R[r * 16 + LP]! + 1)),
    place: (r: number) => R[r * 16 + PL]!,
    finished: (r: number) => R[r * 16 + DN] === 1,
    finishTime: (r: number) => R[r * 16 + FT]!,
    bestLap: (r: number) => R[r * 16 + BL]!,
    crashes: (r: number) => R[r * 16 + CR]!,
    progress: (r: number) => R[r * 16 + PG]!,
    nearIndex: (r: number) => R[r * 16 + NI]!,
    offTrack: (r: number) => R[r * 16 + OFF]!,
    powers: POWERS,
    step, reset, go, autopilot,
    /** Lap distance of the player's next feature (for the HUD): its kind, or 0. */
    feature(r: number) {
      prof(sAt(R[r * 16 + NI]! + 6));
      return FK[0]!;
    },
  };
}
export type MotoRace = ReturnType<typeof motoRace>;
