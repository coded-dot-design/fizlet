// Big Air's arena and run, headless (tests/big-air.test.mjs rides it with no browser). One fixed
// tabletop freestyle arena on @fzlt/core/terrain: an oval of dirt with two big steel kickers and two
// dirt landings, one pair on each straight, so a rider loops round hitting one, then the other. The
// bike is ./bike.ts with the freestyle feel (a lighter gravity for hang time, more pitch in the air),
// the tricks are ./tricks.ts. The run: a minute from the first gas; in the air, TRICK with the stick
// picks a trick (the stick then poses the rider instead of pitching the bike); weight back (or forward)
// with no trick turns a flip; land on the down ramp, clean, to score; land with the trick still out
// and it is a bail. Then five judges score it. `autopilot` rides it (the poster, the tests). Zero
// allocation per step in the run's own code.
import { terrain, type Terrain } from "../../../../src/terrain";
import { bike, type Bike, type Power, TWO_STROKE, B_CRASH, B_LAND } from "./bike";
import { tricks, TRICKS, HOP } from "./tricks";

export const COLS = 116, ROWS = 56, CELL = 0.45, HX = (COLS * CELL) / 2, HZ = (ROWS * CELL) / 2;
export const TRACK_W = 4.2, KIND_TRACK = 1, KIND_STEEL = 2, KIND_LAND = 3;
export const PICK = 0, READY = 1, RUN = 2, DONE = 3;
/** Seconds in a run. */
export const RUN_T = 60;
/** Events: [type, value]. */
export const E_START = 1, E_AIR = 2, E_TRICK = 3, E_LAND = 4, E_CRASH = 5, E_RESPAWN = 6, E_END = 7, E_FLIP = 8;
/** The freestyle feel: lighter gravity (hang time), more pitch from the rider in the air. */
export const GRAVITY = 14, AIR_PITCH = 13;
const RESPAWN = 1.5;

// ---- the oval: two straights and two half turns (left), resampled ----
const A = 15.5, B = 6.5, DS = 0.5;
const PLAN = [2 * A, -1, -1, 2 * A, -1, -1];
export const LAP = PLAN.reduce((s, v) => s + (v < 0 ? (Math.PI / 2) * B : v), 0);
export const NT = Math.round(LAP / DS);
export const TRACK = new Float64Array(NT * 2), YAW = new Float64Array(NT);
export const TURN = new Uint8Array(NT);
{
  const fine = 0.01;
  let x = -A, z = B, psi = 0, s = 0, k = 0, next = 0;
  for (let sec = 0; sec < PLAN.length; sec++) {
    const v = PLAN[sec]!, len = v < 0 ? (Math.PI / 2) * B : v, n = Math.round(len / fine);
    for (let i = 0; i < n; i++) {
      if (s >= next - 1e-9 && k < NT) (TRACK[k * 2] = x), (TRACK[k * 2 + 1] = z), (YAW[k] = psi), (TURN[k] = v < 0 ? 1 : 0), k++, (next = k * (LAP / NT));
      const d = len / n;
      if (v < 0) psi += d / B;
      x += Math.cos(psi) * d;
      z -= Math.sin(psi) * d;
      s += d;
    }
  }
  for (; k < NT; k++) (TRACK[k * 2] = TRACK[(k - 1) * 2]!), (TRACK[k * 2 + 1] = TRACK[(k - 1) * 2 + 1]!), (YAW[k] = YAW[k - 1]!);
}
export const sAt = (i: number) => (i * LAP) / NT;
/** The two jumps: the kicker's start along the lap. Kicker 4 long up to 3.0, a gap, the landing. */
export const KICK = [11, 2 * A + Math.PI * B + 11];
export const KICK_L = 4.4, KICK_H = 2.6, GAP = 6.4, LAND_H = 2.4, LAND_F = 0.7, LAND_D = 7.5;
const sm = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Height over the floor at lap distance s into PF, the part into FK (0 floor, 1 kicker, 2 landing face, 3 down ramp). */
export const PF = new Float64Array(2), FK = new Int32Array(1);
export function prof(s: number) {
  s = ((s % LAP) + LAP) % LAP;
  FK[0] = 0;
  PF[0] = 0;
  PF[1] = 0;
  for (let k = 0; k < 2; k++) {
    const d = s - KICK[k]!;
    if (d < 0 || d > KICK_L + GAP + LAND_F + LAND_D) continue;
    if (d < KICK_L) return void ((FK[0] = 1), (PF[0] = KICK_H * (d / KICK_L) ** 1.35), (PF[1] = (KICK_H * 1.35 * (d / KICK_L) ** 0.35) / KICK_L));
    if (d < KICK_L + 0.35) return void ((FK[0] = 1), (PF[0] = KICK_H * (1 - (d - KICK_L) / 0.35)), (PF[1] = -KICK_H / 0.35));
    const e = d - KICK_L - GAP;
    if (e < 0) return;
    if (e < LAND_F) return void ((FK[0] = 2), (PF[0] = LAND_H * sm(e / LAND_F)), (PF[1] = LAND_H / LAND_F));
    const f = (e - LAND_F) / LAND_D;
    return void ((FK[0] = 3), (PF[0] = LAND_H * (1 - sm(f))), (PF[1] = (-LAND_H * 6 * f * (1 - f)) / LAND_D));
  }
}
export const FLOOR = 0.2;

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

/** The arena: a dirt floor, the oval worn into it, the kickers and landings stamped. Pure. */
export function arena(): Terrain {
  const t = terrain({ cols: COLS, rows: ROWS, cell: CELL });
  t.noise({ seed: 20261120, amp: 0.5, scale: 6, octaves: 2 });
  t.shape((x, z, h) => {
    const ex = Math.min(1, (HX - Math.abs(x)) / 1.8), ez = Math.min(1, (HZ - Math.abs(z)) / 1.8), e = Math.max(0, Math.min(ex, ez));
    return h * e * e * (3 - 2 * e);
  });
  const half = TRACK_W / 2, edge = 1.2;
  t.shape((x, z, h) => {
    near(x, z);
    const d = NR[0]!;
    if (d >= half + edge) return h;
    prof(sAt(NR[1]! + NR[2]!));
    const ramp = PF[0]!, w = d <= half ? 1 : 1 - sm((d - half) / edge);
    // The ramps keep their width (steel and packed dirt), the floor blends into the dirt round it.
    return ramp > 0.01 ? (d <= half + 0.1 ? FLOOR + ramp : h + (FLOOR + ramp * Math.max(0, 1 - (d - half) / 0.5) - h) * w) : h + (FLOOR - h) * w;
  });
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS * 2; i++) {
      const x = t.x0 + ((i >> 1) + (i & 1 ? 1 : 2) / 3) * CELL, z = t.z0 + (j + (i & 1 ? 2 : 1) / 3) * CELL;
      near(x, z);
      if (NR[0]! > half) continue;
      prof(sAt(NR[1]! + NR[2]!));
      t.kind[j * COLS * 2 + i] = FK[0] === 1 ? KIND_STEEL : FK[0]! >= 2 ? KIND_LAND : KIND_TRACK;
    }
  return t;
}

/** The track's two edges, [x, y, z] per point, left then right. */
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

/** The speed the autopilot wants at each point: fast on the run-up, easy round the turns. */
const WANT = new Float64Array(NT);
for (let i = 0; i < NT; i++) {
  let w = 16.5;
  for (let a = 0; a <= 16; a++) if (TURN[(i + a) % NT]) w = Math.min(w, 9 + a * 0.35);
  prof(sAt(i));
  if (FK[0]! >= 2) w = 12;
  WANT[i] = w;
}

/** A run: the bike, the trick out, the clock, the score. */
export function airShow(seed = 20261120) {
  const t = arena();
  const freestyle = (p: Power): Power => ({ ...p, airPitch: AIR_PITCH * (p.gyr < 0.6 ? 1.12 : 1) });
  const b: Bike = bike(t, freestyle(TWO_STROKE), { gravity: GRAVITY });
  const sc = tricks();
  // S: phase, clock (left), started, near index, trick id (−1 none), trick amount, last pitch, autopilot jump count, air flag, crash time.
  const S = new Float64Array(12);
  const PH = 0, CLK = 1, NI = 3, TID = 4, TAM = 5, PP = 6, AJ = 7, AIRF = 8, FL = 9;
  const ev = new Float64Array(16);
  let nev = 0;
  const emit = (type: number, v: number) => void (nev < 8 && ((ev[nev * 2] = type), (ev[nev * 2 + 1] = v), nev++));
  const IN = new Float64Array(6), LD = new Float64Array(2), G4 = new Float64Array(4);

  function place(i: number) {
    const yaw = YAW[i]!;
    b.reset(TRACK[i * 2]!, TRACK[i * 2 + 1]!, yaw);
    S[NI] = i;
  }
  function reset(power?: Power) {
    if (power) b.use(freestyle(power));
    S.fill(0);
    S[TID] = -1;
    S[CLK] = RUN_T;
    sc.reset();
    nev = 0;
    place(0);
  }
  function track() {
    near(b.pos[0]!, b.pos[2]!, S[NI]!, 8);
    S[NI] = NR[1]!;
  }
  /** Where the bike comes down, as a lap distance, and in how long: LD = [s, seconds] (the autopilot lands on the slope there). */
  function landing() {
    let x = b.pos[0]!, y = b.pos[1]! - 0.68, z = b.pos[2]!, vy = b.vy;
    const vx = b.cy * b.speed, vz = -b.sy * b.speed;
    let k = 0;
    for (; k < 80; k++) {
      x += vx * 0.03; z += vz * 0.03; vy -= GRAVITY * 0.03; y += vy * 0.03;
      t.sample(x, z, G4);
      if (y <= G4[0]!) break;
    }
    near(x, z, S[NI]!, 40);
    LD[0] = sAt(NR[1]! + NR[2]!);
    LD[1] = k * 0.03;
  }

  /** Inputs that ride the arena: out = [gas, brake, lean, steer, trick held]. */
  function autopilot(out: Float64Array) {
    const i = S[NI]!, sp = b.speed, look = (4 + Math.max(0, sp) * 0.2) | 0, k = (i + look) % NT;
    const fx = b.cy, fz = -b.sy, ux = TRACK[k * 2]! - b.pos[0]!, uz = TRACK[k * 2 + 1]! - b.pos[2]!, ul = Math.sqrt(ux * ux + uz * uz) || 1;
    out[3] = Math.max(-1, Math.min(1, ((fx * uz - fz * ux) / ul) * 2.6));
    out[4] = 0;
    const p = b.pitch, rate = (p - S[PP]!) * 60;
    S[PP] = p;
    if (b.air > 0) {
      // Every other jump a back flip if the air allows it (decided at take-off); the rest a trick, held
      // through the top and put away in time for the landing.
      landing();
      prof(LD[0]! + 0.4);
      const slope = FK[0] === 3 || FK[0] === 0 ? Math.atan(PF[1]!) : -0.3;
      if (b.air < 0.02) S[FL] = (S[AJ]! & 1) === 1 && LD[1]! > (b.power.gyr < 0.6 ? 1.1 : 1.4) ? 1 : 0;
      const flip = S[FL] === 1;
      out[0] = 0;
      out[1] = 0;
      // Pull until the rotation left to stop (ω² / 2α) brings it round to the slope.
      if (flip && p + (rate > 0 ? (rate * rate) / (2 * AIR_PITCH * 0.6) : 0) < 6.283185307179586 + slope) out[2] = 1;
      else {
        // Level to the landing: pitch (less the flip) matched to the slope it meets.
        const cur = flip ? p - 6.283185307179586 : p, err = slope - (cur + rate * (flip ? 0.45 : 0.3));
        out[2] = Math.max(-1, Math.min(1, err * 3));
        if (!flip && b.air > 0.15 && LD[1]! > 0.5) out[4] = 1;
      }
    } else {
      out[0] = sp < WANT[i]! ? 1 : 0;
      out[1] = sp > WANT[i]! + 0.6 ? 1 : 0;
      prof(sAt(i + 1));
      // Up a kicker the weight goes a little back (no nose dive off the lip); elsewhere the front stays down.
      out[2] = FK[0] === 1 ? 0.25 : b.rel > 0.12 ? -1 : b.rel > 0.05 ? -0.4 : 0;
    }
    return out;
  }

  /** The trick the stick picks while TRICK is held: fwd LANTERN, back CANNONBALL, side PIXEL SPLIT, none SKY PLANK. */
  function pick(lean: number, steer: number) {
    return lean < -0.5 ? 1 : lean > 0.5 ? 3 : steer > 0.5 || steer < -0.5 ? 2 : 0;
  }

  /** Advance dt: I = [gas, brake, lean, steer, trick held]; `auto` rides it. True while anything moves. */
  function step(dt: number, I: Float64Array, auto = false) {
    const ph = S[PH]!;
    if (ph === PICK || ph === DONE) {
      b.set(0, ph === DONE ? 1 : 0, 0, 0);
      const m = b.step(dt);
      b.clear();
      return m;
    }
    if (auto) autopilot(IN), (I = IN);
    if (ph === READY && (I[0]! > 0 || I[1]! > 0)) (S[PH] = RUN), emit(E_START, 0);
    if (S[PH] === RUN) S[CLK] = Math.max(0, S[CLK]! - dt);
    if (b.crashed) {
      b.set(0, 0, 0, 0);
      b.step(dt);
      events();
      if (b.crashTime > RESPAWN) {
        // Back on the floor before this jump's kicker (never in the gap), or just behind where it fell.
        let i = (S[NI]! - 2 + NT) % NT;
        for (let k = 0; k < 2; k++) {
          const d = (((sAt(i) - KICK[k]!) % LAP) + LAP) % LAP;
          if (d < KICK_L + GAP + LAND_F + LAND_D + 1) i = Math.round((((KICK[k]! - 10.5) % LAP) + LAP) % LAP / (LAP / NT)) % NT;
        }
        place(i);
        S[TID] = -1;
        S[TAM] = 0;
        emit(E_RESPAWN, 0);
      }
      if (S[CLK] === 0 && S[PH] === RUN) end();
      return true;
    }
    // The trick: TRICK held in the air with the stick picks one and poses the rider (no pitch from the
    // stick while it is out); let go and the rider gets back on.
    const air = b.air > 0.08, want = air && I[4]! > 0;
    let lean = I[2]!;
    if (want) {
      const id = auto ? (S[AJ]! >> 1) % 4 : pick(I[2]!, I[3]!);
      if (S[TID]! !== id) (S[TID] = id), (S[TAM] = Math.min(S[TAM]!, 0.3)), emit(E_TRICK, id);
      S[TAM] = Math.min(1, S[TAM]! + 5 * dt);
      lean = 0;
    } else S[TAM] = Math.max(0, S[TAM]! - 6 * dt);
    if (S[TAM] === 0) S[TID] = -1;
    b.set(S[PH] === RUN || S[PH] === READY ? I[0]! : 0, I[1]!, lean, I[3]!, S[TAM]!);
    const moving = b.step(dt);
    if (b.air > 0) {
      sc.air(dt);
      if (S[TID]! >= 0) sc.hold(S[TID]!, S[TAM]!, dt);
      sc.spin(b.airSpin);
      S[AIRF] = 1;
    }
    events();
    track();
    if (!b.crashed && (Math.abs(b.pos[0]!) > HX - 0.3 || Math.abs(b.pos[2]!) > HZ - 0.3)) b.knock(5), events();
    if (S[CLK] === 0 && S[PH] === RUN && !b.air) end();
    return moving || S[PH] === RUN;
  }
  function events() {
    for (let k = 0; k < b.n; k++) {
      const type = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (type === B_LAND && !b.crashed) {
        prof(sAt(S[NI]!));
        const kind = sc.land(v, FK[0] === 3);
        if (kind !== HOP) emit(E_LAND, kind), (S[AJ] = S[AJ]! + 1);
        S[AIRF] = 0;
      } else if (type === B_CRASH) sc.crash(), emit(E_CRASH, v), (S[AIRF] = 0), (S[AJ] = S[AJ]! + 1);
    }
    b.clear();
  }
  function end() {
    S[PH] = DONE;
    sc.judges(seed);
    emit(E_END, sc.JD[5]!);
  }
  /** Ready to ride on `power` (the clock starts with the first gas). */
  function go(power: Power) {
    reset(power);
    S[PH] = READY;
  }

  reset();
  return {
    t, b, sc, S, ev,
    get n() { return nev; },
    clear: () => void (nev = 0),
    get phase() { return S[PH]!; },
    /** Seconds left. */
    get clock() { return S[CLK]!; },
    /** The trick out (−1 none) and how far out (0..1). */
    get trick() { return S[TID]!; },
    get trickAmount() { return S[TAM]!; },
    nearIndex: () => S[NI]!,
    step, reset, go, autopilot,
    names: TRICKS,
  };
}
export type AirShow = ReturnType<typeof airShow>;
