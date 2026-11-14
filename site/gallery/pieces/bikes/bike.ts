// The Bikes series' bike: a pure, seeded, fixed-step dirt bike (or e-bike) on a heightfield, shared
// by Moto Track, Big Air and Wheelie City (this file is the same, byte for byte, in each). Where
// @fzlt/core/drive's bike leans and lands, this one also wheelies: it is a rigid body in its own
// vertical plane (pitch, heave, speed along the heading) on two sprung wheels, so the torque does the
// work. The drive force pushes at the rear contact, under the centre of mass, and lifts the front;
// the ground pushes back at each wheel; the rider's weight (lean) moves the centre of mass and with
// it the balance point. Too much gas lifts the front (a wheelie), more loops it out; the rear brake
// brings it down; lean forward with the brake and it stands on the front (a stoppie, a "manual").
// - Inputs (`input`, or `set`): gas 0..1, brake 0..1, lean −1..1 (+1 back: on the ground it shifts
//   the weight back, in the air it pitches the nose up), steer −1..1 (+1 right), trick 0..1 (how
//   far off the seat the rider is: land like that and it is a bail). Keys are on or off, so the
//   throttle rolls on at the engine's `roll` rate and snaps shut.
// - The engine is data (`Power`): a torque curve over the revs, the gears (an automatic box, no
//   clutch: a slipping launch), how fast it revs, the mass and pitch inertia. TWO_STROKE is light
//   and peaky (little down low, a hard hit high in the revs: easy to loop), FOUR_STROKE is heavy and
//   torquey (a smooth pull from the bottom, slow to rotate: stable), E_MOTO is all torque at once,
//   E_BIKE a light pedal-assist bike.
// - Out: `pos` (the centre of mass), `rot` (diorama's [roll, yaw, pitch]), per wheel (0 rear, 1 front)
//   `wheel` centres, `comp`, `spin`, `contact`; `rpm`, `gear`, `speed`, `air`, `rel` (pitch off the
//   ground's slope), `balance` (rel over the balance point: 1 is balanced on the rear), `wheelie` /
//   `stoppie` (seconds so far), `airSpin` (pitch turned in this jump), `crashed` and `crash` (LOOP,
//   ENDO, CASE, BAIL, STRIKE) with a tumble for the bike and a slide for the rider (`rider`, `riderRot`).
// - Events (`ev`, `n`, `clear()`): B_AIR, B_LAND (value: how far off the slope, radians), B_CRASH
//   (value: the kind), B_WHEELIE (value: seconds held, on the way down), B_STOPPIE, B_SHIFT (gear).
// Deterministic: only + − × ÷ and square roots, with its own polynomial sine and arctangent (the
// builtins may differ in the last bit between browsers), so the same inputs give the same ride.
// Zero allocation per step (typed arrays; locals). World units and seconds, angles in radians.

/** The ground: height and normal under (x, z) into out = [h, nx, ny, nz]; returns a surface kind. */
export interface BikeGround {
  sample(x: number, z: number, out: { [i: number]: number }): number;
}

/** An engine and chassis, as data. */
export interface Power {
  /** Short name for the HUD. */
  name: string;
  /** Mass (1 is a mid bike): heavier pushes on, rotates slower. */
  mass: number;
  /** Radius of gyration for pitch: bigger is slower to wheelie, loop and flip. */
  gyr: number;
  /** Drive force at the peak of the curve in the lowest gear (per unit mass at mass 1). */
  force: number;
  /** Torque over the revs, 0..1 at even steps from 0 to the limiter. */
  curve: ArrayLike<number>;
  /** Top speed in each gear (the last is the bike's). */
  gears: ArrayLike<number>;
  /** Revs the slipping clutch holds at a launch, 0..1 of the throttle. */
  launch: number;
  /** How fast the revs follow, 1/s (a flywheel is slow). */
  rev: number;
  /** How fast the throttle rolls on, 1/s (it shuts at once). */
  roll: number;
  /** Shift up at these revs, down when the lower gear would be under `down`. */
  up: number;
  down: number;
  /** Pitch the rider can put in the air at full lean, rad/s². */
  airPitch: number;
  /** Tyre grip (traction and turning), in g. */
  grip: number;
  /** Most braking, units/s² (front and rear). */
  brake: number;
  /** The engine voice's pitch at idle and at the limiter (Hz), its wave. */
  voice: [idle: number, top: number, wave: OscillatorType];
}

/** Light and peaky: little down low, a hard hit high in the revs (easy to loop out). */
export const TWO_STROKE: Power = {
  name: "2-STROKE", mass: 0.9, gyr: 0.58, force: 19,
  curve: [0.14, 0.17, 0.22, 0.32, 0.55, 0.92, 1, 0.92, 0.6],
  gears: [6.4, 9.8, 13.2, 17.2], launch: 0.55, rev: 10, roll: 9, up: 0.95, down: 0.66,
  airPitch: 7.5, grip: 1.1, brake: 21, voice: [92, 330, "sawtooth"],
};
/** Heavy and torquey: a smooth pull from the bottom, slow to rotate (stable). */
export const FOUR_STROKE: Power = {
  name: "4-STROKE", mass: 1.15, gyr: 0.68, force: 18.5,
  curve: [0.62, 0.8, 0.92, 0.98, 1, 0.97, 0.9, 0.78, 0.6],
  gears: [6.8, 10.2, 13.4, 16.6], launch: 0.34, rev: 5.5, roll: 5.5, up: 0.9, down: 0.5,
  airPitch: 5.6, grip: 1.2, brake: 22, voice: [46, 150, "square"],
};
/** Electric dirt bike: every newton at once, one gear, a whine. */
export const E_MOTO: Power = {
  name: "E-MOTO", mass: 0.85, gyr: 0.6, force: 14,
  curve: [1, 1, 1, 0.97, 0.9, 0.8, 0.68, 0.56, 0.44],
  gears: [15.5], launch: 0, rev: 30, roll: 10, up: 1.1, down: 0,
  airPitch: 6.5, grip: 1.12, brake: 20, voice: [180, 900, "sine"],
};
/** Pedal-assist e-bike: light, slow, easy to lift. */
export const E_BIKE: Power = {
  name: "E-BIKE", mass: 0.55, gyr: 0.5, force: 9,
  curve: [1, 1, 0.98, 0.94, 0.86, 0.74, 0.6, 0.45, 0.3],
  gears: [9], launch: 0, rev: 30, roll: 8, up: 1.1, down: 0,
  airPitch: 7, grip: 1.05, brake: 14, voice: [240, 620, "sine"],
};

/** Chassis shape (defaults: a full-size motocross bike in diorama units). */
export interface BikeShape {
  /** Rear and front axle, forward of the centre of mass (rear negative), at full stretch. */
  rear?: number;
  front?: number;
  /** Axles under the centre of mass at full stretch. */
  drop?: number;
  /** Wheel radius. */
  radius?: number;
  /** Suspension travel, and its sag at rest. */
  travel?: number;
  sag?: number;
  /** How far full lean moves the centre of mass along the bike. */
  shift?: number;
  /** Gravity (diorama's 20). */
  gravity?: number;
  /** Steps per `step()` (4 keeps the springs stiff at 60 Hz). */
  substeps?: number;
}

/** Events. */
export const B_AIR = 1, B_LAND = 2, B_CRASH = 3, B_WHEELIE = 4, B_STOPPIE = 5, B_SHIFT = 6;
/** Crash kinds: looped out backwards, over the bars, cased (landed too hard), bailed (landed off the seat), hit the frame. */
export const LOOP = 1, ENDO = 2, CASE = 3, BAIL = 4, STRIKE = 5;

const PI = 3.141592653589793, TAU = 6.283185307179586, RISE = 1.0, FALL = 0.9;
/** Arctangent from a polynomial (within 1e-5 rad; identical in every browser). */
export function atan(s: number) {
  const a = s < 0 ? -s : s, t = a > 1 ? 1 / a : a, q = t * t, r = t * (0.999866 + q * (-0.3302995 + q * (0.180141 + q * (-0.085133 + q * 0.0208351)))), v = a > 1 ? PI / 2 - r : r;
  return s < 0 ? -v : v;
}
/** Sine from a polynomial (reduced to ±π/2, odd terms to x¹⁵). */
export function sin(x: number) {
  x -= TAU * Math.floor(x / TAU + 0.5);
  x = x > PI / 2 ? PI - x : x < -PI / 2 ? -PI - x : x;
  const q = x * x;
  return x * (1 - (q / 6) * (1 - (q / 20) * (1 - (q / 42) * (1 - (q / 72) * (1 - (q / 110) * (1 - (q / 156) * (1 - q / 210)))))));
}
export const cos = (x: number) => sin(x + PI / 2);
/** An angle wrapped to −π..π. */
export const wrap = (a: number) => a - TAU * Math.floor(a / TAU + 0.5);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// S: the state, by index.
const YAW = 0, YR = 1, P = 2, W = 3, ROLL = 4, VF = 5, VY = 6, AIR = 7, THR = 8, RPM = 9, GEAR = 10, WT = 11, WD = 12, ST = 13, SLOPE = 14,
  CK = 15, CT = 16, LERR = 17, LAIR = 18, ASPIN = 19, STEER = 20, CY = 21, SY = 22, SLIP = 23, LASTW = 24, BAL = 25, BP = 26, DUST = 27,
  LEAN = 28, LDROP = 29, TRICK = 30, TQ = 31;

/** A bike on `ground` with engine `power`: set `input` (or `set`), `step(dt)` from the engine's
 *  fixed step, draw from `pos`, `rot`, `wheel`, `comp`, `spin`, `rider`. */
export function bike(ground: BikeGround, power: Power, shape: BikeShape = {}) {
  const AR = shape.rear ?? -0.66, AF = shape.front ?? 0.84, AH = shape.drop ?? 0.42, R = shape.radius ?? 0.34, TRAV = shape.travel ?? 0.3, SAG = shape.sag ?? 0.09;
  const SH = shape.shift ?? 0.17, g = shape.gravity ?? 20, sub = shape.substeps ?? 4, BASE = AF - AR;
  let pw = power, m = 1, I = 1, K = 1, C = 1;
  const S = new Float64Array(32), input = new Float64Array(5), pos = new Float64Array(3), rot = new Float64Array(3);
  const wheel = new Float64Array(6), comp = new Float64Array(2), spin = new Float64Array(2), contact = new Uint8Array(2), GH = new Float64Array(2), GS = new Float64Array(2), WF = new Float64Array(2);
  const G = new Float64Array(4), F = new Uint8Array(4); // F: crashed, in the air, at rest, wheelie on
  // The tumble: bike velocity (3), spin rates (3); the rider: pos (3), vel (3), rot (3).
  const TV = new Float64Array(6), rider = new Float64Array(3), RV = new Float64Array(3), riderRot = new Float64Array(3);
  const ev = new Float64Array(16);
  let nev = 0;
  const emit = (type: number, v: number) => void (nev < 8 && ((ev[nev * 2] = type), (ev[nev * 2 + 1] = v), nev++));

  /** Swap the engine (a new bike choice); keeps the place. */
  function use(p: Power) {
    pw = p;
    m = p.mass;
    I = m * p.gyr * p.gyr;
    // Springs sag by SAG under the bike's weight shared by two wheels; damped a little under critical.
    K = (m * g) / (2 * SAG);
    C = 2 * 0.62 * Math.sqrt(K * m * 0.5);
  }
  use(power);

  function curve(r: number) {
    const c = pw.curve, n = c.length - 1;
    if (r >= 1) return 0; // the limiter
    const u = (r < 0 ? 0 : r) * n, i = Math.floor(u), f = u - i;
    return c[i]! + (c[i + 1 < n ? i + 1 : n]! - c[i]!) * f;
  }

  /** One substep of h seconds on the ground or in the air. */
  function sub1(h: number) {
    const gas = clamp(input[0]!, 0, 1), br = clamp(input[1]!, 0, 1), ln = clamp(input[2]!, -1, 1), stIn = clamp(input[3]!, -1, 1), tk = clamp(input[4]!, 0, 1);
    let thr = S[THR]!;
    thr += (gas - thr) * Math.min(1, (gas > thr ? pw.roll : 8) * h);
    S[THR] = thr;
    S[LEAN] = S[LEAN]! + (ln - S[LEAN]!) * Math.min(1, 9 * h);
    S[TRICK] = tk;
    const lean = S[LEAN]!, yaw = S[YAW]!, cy = cos(yaw), sy = sin(yaw), fx = cy, fz = -sy, th = S[P]!, cp = cos(th), sp = sin(th);
    let x = pos[0]!, y = pos[1]!, z = pos[2]!, vf = S[VF]!, vy = S[VY]!, w = S[W]!;
    let Ff = 0, Fu = 0, tq = 0, nc = 0, slip = 0, Nr = 0;
    const gears = pw.gears, ng = gears.length;
    let gear = S[GEAR]!;
    const wrpm = (vf < 0 ? -vf : vf) / gears[gear]!;
    // Revs: tied to the rear wheel on the ground (a slipping launch under it), free in the air.
    for (let i = 0; i < 2; i++) {
      const ox = (i ? AF : AR) + SH * lean, oy = -AH, wf = ox * cp - oy * sp, wu = ox * sp + oy * cp;
      const wx = x + fx * wf, wz = z + fz * wf, wy = y + wu;
      ground.sample(wx, wz, G);
      const gh = G[0]!, s = -(G[1]! * fx + G[3]! * fz) / G[2]!, pen = gh + R - wy;
      GH[i] = gh; GS[i] = s; WF[i] = wf;
      wheel[i * 3] = wx; wheel[i * 3 + 2] = wz;
      if (pen > 0) {
        const L = Math.sqrt(1 + s * s), nf = -s / L, nu = 1 / L, tf = 1 / L, tu = s / L;
        // The contact point from the centre of mass, and its velocity along the normal (+: leaving).
        const cf = wf - R * nf, cu = wu - R * nu, pv = (vf - w * cu) * nf + (vy + w * cf) * nu;
        let N = K * (pen < TRAV ? pen : TRAV) + (pen > TRAV ? 14 * K * (pen - TRAV) : 0) - C * pv;
        N = N > 0 ? N : 0;
        // Along the ground: drive (rear), brakes (both), rolling drag; each held to the tyre's grip.
        const vt = (vf - w * cu) * tf + (vy + w * cf) * tu, most = pw.grip * N;
        let Ft = 0;
        if (!i) {
          Nr = N;
          let want = thr > 0 ? (pw.force * curve(S[RPM]!) * thr * gears[0]!) / gears[gear]! : 0;
          if (want > most) (slip = (want - most) / want), (want = most);
          Ft += want;
        }
        if (br > 0) {
          // The front brake does most, unless the front is up (then the rear is all there is).
          const share = i ? 0.62 : contact[1] || S[AIR]! > 0 ? 0.38 : 0.55, b = pw.brake * m * br * share, stop = (m * 0.5 * (vt < 0 ? -vt : vt)) / h;
          Ft -= (vt > 0 ? 1 : -1) * Math.min(b, stop, most);
        }
        Ft -= (vt > 0 ? 1 : -1) * Math.min(m * 0.35, (m * 0.5 * (vt < 0 ? -vt : vt)) / h);
        const fF = N * nf + Ft * tf, fU = N * nu + Ft * tu;
        Ff += fF; Fu += fU;
        tq += cf * fU - cu * fF;
        nc++;
        contact[i] = 1;
        comp[i] = pen < TRAV ? pen : TRAV;
        wheel[i * 3 + 1] = wy + comp[i]!;
      } else {
        contact[i] = 0;
        comp[i] = 0;
        wheel[i * 3 + 1] = wy;
      }
    }
    // The ground's pitch under the two wheels (their ground heights over the distance between).
    const slope = atan((GH[1]! - GH[0]!) / (WF[1]! - WF[0]! || 1));
    S[SLOPE] = slope;
    // The engine: the gear for the speed, the revs, the torque the next substep pushes with.
    if (gear < ng - 1 && wrpm > pw.up) (gear++), emit(B_SHIFT, gear);
    else if (gear > 0 && (vf < 0 ? -vf : vf) / gears[gear - 1]! < pw.down) (gear--), emit(B_SHIFT, gear);
    S[GEAR] = gear;
    const wr = (vf < 0 ? -vf : vf) / gears[gear]!, target = contact[0] ? Math.max(wr, pw.launch * thr) + slip * 0.35 : thr * 1.02;
    S[RPM] = clamp(S[RPM]! + (target - S[RPM]!) * Math.min(1, pw.rev * h), 0, 1.04);
    S[SLIP] = slip;
    // The rider: on the ground the weight back lifts the front (and forward drops it); in the air the
    // lean pitches it, the spinning rear wheel lifts the nose on the gas and the brake dips it.
    // Up on one wheel the rider's arms and legs soak the rotation: it rises no faster than RISE rad/s
    // (time to catch it), and on the rear alone the brake also stops the wheel, which turns the bike
    // nose down.
    if (nc) {
      tq += lean * m * 2.6;
      if (contact[0] !== contact[1]) w -= w * 3.2 * h + (contact[0] ? br * 20 * h : 0);
    }
    else w += (lean * pw.airPitch + thr * 0.9 - br * 2.4) * h - w * 0.35 * h;
    // Air drag and the speed: forward along the heading, heave, pitch.
    Ff -= 0.0035 * m * vf * (vf < 0 ? -vf : vf);
    vf += (Ff / m) * h;
    vy += (Fu / m - g) * h;
    w += (tq / I) * h;
    if (contact[0] && !contact[1]) w = w > RISE ? RISE : w < -FALL ? -FALL : w;
    // Steering: a curvature that tightens less at speed, held to the grip (more in a berm); a wheelie
    // steers by leaning, a little; in the air the heading holds.
    let yr = S[YR]!;
    const delta = (stIn * 0.62) / (1 + (vf < 0 ? -vf : vf) / 11);
    let goal = (-vf * delta) / BASE;
    if (nc) {
      ground.sample(x, z, G);
      const bank = (G[1]! * sy + G[3]! * cy) * (stIn > 0 ? 1 : -1), most = pw.grip * g * (1 + clamp(bank * 2.2, 0, 0.9));
      if (goal * vf > most || goal * vf < -most) goal = (goal * vf > 0 ? most : -most) / (vf || 1);
      yr += (goal * (contact[1] ? 1 : 0.4) - yr) * Math.min(1, (contact[1] ? 9 : 3) * h);
    } else yr -= yr * Math.min(1, 2 * h);
    S[STEER] = delta;
    const lroll = clamp(nc ? atan((vf * yr) / g) : S[ROLL]! * (1 - 0.8 * h), -0.85, 0.85);
    S[ROLL] = S[ROLL]! + (lroll - S[ROLL]!) * Math.min(1, 8 * h);
    x += fx * vf * h; z += fz * vf * h; y += vy * h;
    let th2 = th + w * h;
    S[YAW] = wrap(yaw + yr * h);
    S[YR] = yr;
    // Wheels: rolling with the ground, or spun by the engine in the air.
    for (let i = 0; i < 2; i++) {
      const a = spin[i]! + (vf / R + (i ? 0 : (contact[0] ? 0 : thr * 30) + slip * 25)) * h;
      spin[i] = a - TAU * Math.floor(a / TAU);
    }
    // Air, landings, wheelies, crashes.
    const rel = wrap(th2 - slope), bpa = atan((-(AR + SH * lean)) / (AH + R - SAG));
    S[BP] = bpa;
    S[BAL] = rel / bpa;
    if (!nc) {
      if (!F[1]) (F[1] = 1), (S[ASPIN] = 0);
      if (S[AIR]! < 0.1 && S[AIR]! + h >= 0.1) emit(B_AIR, 0);
      S[AIR] = S[AIR]! + h;
      S[ASPIN] = S[ASPIN]! + w * h;
      endWheelie();
    } else {
      if (F[1]) {
        const air = S[AIR]!, err = rel < 0 ? -rel : rel, drop = -(vy * (1 / Math.sqrt(1 + GS[0]! * GS[0]!)) - vf * (GS[0]! / Math.sqrt(1 + GS[0]! * GS[0]!)));
        S[LAIR] = air; S[LERR] = err; S[LDROP] = drop;
        if (air > 0.18) {
          emit(B_LAND, err);
          if (tk > 0.35) crash(BAIL);
          else if (err > 0.82) crash(rel > 0 ? LOOP : ENDO);
          else if (drop > 26) crash(CASE);
        }
        F[1] = 0;
        S[AIR] = 0;
        // Back on the ground, the pitch is measured from here (a flip lands as its remainder).
        th2 = slope + rel;
      }
      // Up on the back wheel, or the front.
      if (contact[0] && !contact[1] && rel > 0.1 && vf > 0.8) (S[WT] = S[WT]! + h), (S[WD] = S[WD]! + vf * h), (F[3] = 1);
      else endWheelie();
      if (contact[1] && !contact[0] && rel < -0.08 && vf > 0.8) S[ST] = S[ST]! + h;
      else if (S[ST]! > 0) (S[ST]! > 0.3 && emit(B_STOPPIE, S[ST]!)), (S[ST] = 0);
      if (!F[0] && rel > bpa + 0.62) crash(LOOP);
      else if (!F[0] && rel < -1.05) crash(ENDO);
    }
    // The frame on the ground (cased into a face, or bottomed out): a crash.
    if (!F[0]) {
      ground.sample(x, z, G);
      if (y - G[0]! < 0.12) crash(STRIKE);
    }
    S[DUST] = contact[0] ? Math.min(1, slip * 0.9 + ((vf < 0 ? -vf : vf) / 16) * 0.45 + thr * 0.25) : 0;
    // At rest: still on both wheels, no gas: nothing moves (the engine settles).
    const still = nc === 2 && gas === 0 && (vf < 0 ? -vf : vf) < 0.06 && !F[0];
    if (still) (vf = 0), (x = pos[0]!), (z = pos[2]!), (S[YR] = 0);
    F[2] = still && (vy < 0 ? -vy : vy) < 0.004 && (w < 0 ? -w : w) < 0.004 && S[RPM]! < 0.002 ? 1 : 0;
    if (F[2]) (vy = 0), (w = 0), (y = pos[1]!), (th2 = th);
    if (!F[0]) {
      pos[0] = x; pos[1] = y; pos[2] = z;
      S[VF] = vf; S[VY] = vy; S[W] = w; S[P] = th2;
      S[TQ] = Nr;
    }
  }
  function endWheelie() {
    if (!F[3]) return;
    F[3] = 0;
    S[LASTW] = S[WT]!;
    if (S[WT]! > 0.25) emit(B_WHEELIE, S[WT]!);
    S[WT] = 0;
  }
  function crash(kind: number) {
    if (F[0]) return;
    F[0] = 1;
    F[3] = 0;
    S[CK] = kind;
    S[CT] = 0;
    const fx = cos(S[YAW]!), fz = -sin(S[YAW]!), vf = S[VF]!;
    // The bike tumbles on (half its speed, a hop, end over end the way it fell); the rider is thrown clear.
    TV[0] = fx * vf * 0.55; TV[1] = 2.5 + (vf < 0 ? -vf : vf) * 0.12 + (S[VY]! > 0 ? S[VY]! * 0.3 : 0); TV[2] = fz * vf * 0.55;
    TV[3] = 2.5 + (vf < 0 ? -vf : vf) * 0.25; TV[4] = 1.2; TV[5] = kind === LOOP || kind === STRIKE ? 3.5 : -5;
    rider[0] = pos[0]! + fx * 0.1; rider[1] = pos[1]! + 0.55; rider[2] = pos[2]! + fz * 0.1;
    RV[0] = fx * vf * 0.8; RV[1] = 3 + (vf < 0 ? -vf : vf) * 0.15; RV[2] = fz * vf * 0.8;
    riderRot[0] = 0; riderRot[1] = S[YAW]!; riderRot[2] = S[P]!;
    emit(B_CRASH, kind);
  }
  /** The tumble after a crash: the bike and the rider, thrown, bouncing and sliding to a stop. */
  function tumble(h: number) {
    S[CT] = S[CT]! + h;
    let moving = 0;
    for (let k = 0; k < 2; k++) {
      const p = k ? rider : pos, v = k ? RV : TV, r = k ? riderRot : null, lift = k ? 0.18 : 0.3;
      v[1] = v[1]! - g * h;
      p[0] = p[0]! + v[0]! * h; p[1] = p[1]! + v[1]! * h; p[2] = p[2]! + v[2]! * h;
      ground.sample(p[0]!, p[2]!, G);
      const low = G[0]! + lift, on = p[1]! <= low;
      if (on) {
        p[1] = low;
        v[1] = v[1]! < -1 ? -v[1]! * 0.32 : 0;
        const f = Math.min(1, 3.2 * h);
        v[0] = v[0]! - v[0]! * f; v[2] = v[2]! - v[2]! * f;
      }
      if (r) {
        r[2] = r[2]! + (on ? 0 : 6) * h + ((v[0]! < 0 ? -v[0]! : v[0]!) + (v[2]! < 0 ? -v[2]! : v[2]!)) * 0.9 * h;
        r[0] = r[0]! + (on ? (1.35 - r[0]!) * Math.min(1, 4 * h) : 3 * h);
      } else {
        // End over end and onto its side; on the ground the spin dies and it lies flat.
        S[P] = S[P]! + TV[5]! * h;
        S[ROLL] = S[ROLL]! + TV[3]! * h;
        S[YAW] = wrap(S[YAW]! + TV[4]! * h);
        if (on) {
          TV[3] = TV[3]! * (1 - Math.min(1, 5 * h)); TV[4] = TV[4]! * (1 - Math.min(1, 5 * h)); TV[5] = TV[5]! * (1 - Math.min(1, 5 * h));
          // Settle on its side, the frame level with the ground.
          const side = S[ROLL]! - TAU * Math.floor(S[ROLL]! / TAU), want = side < PI ? PI / 2 : PI * 1.5;
          S[ROLL] = S[ROLL]! + (want - side) * Math.min(1, 5 * h);
          S[P] = S[P]! + (wrap(S[SLOPE]! - S[P]!)) * Math.min(1, 5 * h);
        }
      }
      const sp = (v[0]! < 0 ? -v[0]! : v[0]!) + (v[1]! < 0 ? -v[1]! : v[1]!) + (v[2]! < 0 ? -v[2]! : v[2]!);
      if (sp > 0.03 || !on) moving = 1;
    }
    S[RPM] = S[RPM]! * (1 - Math.min(1, 2 * h));
    S[THR] = 0;
    S[VF] = TV[0]! * cos(S[YAW]!) - TV[2]! * sin(S[YAW]!);
    return moving;
  }

  /** Advance dt seconds (the engine's fixed step) in substeps; true while anything moves. */
  function step(dt: number) {
    const h = dt / sub;
    let moving = 0;
    for (let i = 0; i < sub; i++) if (F[0]) moving |= tumble(h);
    else sub1(h);
    rot[0] = -S[ROLL]!; rot[1] = S[YAW]!; rot[2] = S[P]!;
    S[CY] = cos(S[YAW]!); S[SY] = sin(S[YAW]!);
    return F[0] ? moving > 0 || S[CT]! < 0.6 : !F[2];
  }

  /** Put it down at (x, z) facing `yaw`: on its wheels at sag, level with the ground, still, idle. */
  function reset(x: number, z: number, yaw = 0, speed = 0) {
    S.fill(0); F.fill(0); TV.fill(0); RV.fill(0); spin.fill(0); input.fill(0);
    nev = 0;
    S[YAW] = yaw;
    const fx = cos(yaw), fz = -sin(yaw);
    ground.sample(x + fx * AR, z + fz * AR, G);
    const a = G[0]!;
    ground.sample(x + fx * AF, z + fz * AF, G);
    const b = G[0]!, sl = atan((b - a) / BASE), c = cos(sl), s = sin(sl);
    S[P] = S[SLOPE] = sl;
    S[VF] = speed;
    // The centre of mass so the rear axle sits at sag over its ground.
    pos[0] = x; pos[2] = z;
    pos[1] = a + R - SAG - (AR * s - AH * c);
    contact[0] = contact[1] = 1;
    comp[0] = comp[1] = SAG;
    for (let i = 0; i < 2; i++) {
      const ox = i ? AF : AR, wf = ox * c + AH * s;
      wheel[i * 3] = x + fx * wf; wheel[i * 3 + 1] = pos[1]! + ox * s - AH * c + SAG; wheel[i * 3 + 2] = z + fz * wf;
    }
    rider.set(pos);
    riderRot.fill(0);
    rot[0] = 0; rot[1] = yaw; rot[2] = sl;
    S[CY] = fx; S[SY] = -fz;
  }
  reset(0, 0, 0);

  const api = {
    /** [gas, brake, lean (+ back), steer (+ right), trick (off the seat)]: set each step. */
    input,
    set(gas: number, brake: number, lean: number, steer: number, trick = 0) {
      input[0] = gas; input[1] = brake; input[2] = lean; input[3] = steer; input[4] = trick;
    },
    step,
    reset,
    use,
    /** The centre of mass, world. */
    pos,
    /** Diorama's order: [roll about x, yaw about y, pitch about z (nose up +)]. */
    rot,
    /** Per wheel (0 rear, 1 front): centre [x, y, z, …], spring compression, rolling angle, on the ground. */
    wheel, comp, spin, contact,
    /** After a crash: the rider's place and turn ([roll, yaw, pitch]) as they slide. */
    rider, riderRot,
    /** The axles' places along the bike from the centre of mass, the drop under it, the wheel radius. */
    rear: AR, front: AF, drop: AH, radius: R, travel: TRAV,
    /** The raw state (see the getters). */
    S,
    /** Events since the last `clear`: [type, value] pairs, `n` of them. */
    ev,
    get n() { return nev; },
    clear() { nev = 0; },
    get power() { return pw; },
    get yaw() { return S[YAW]!; },
    get speed() { return S[VF]!; },
    get vy() { return S[VY]!; },
    /** Pitch, radians (nose up +). */
    get pitch() { return S[P]!; },
    /** Pitch off the ground's slope under it (a wheelie is +). */
    get rel() { return wrap(S[P]! - S[SLOPE]!); },
    /** The balance point now (rel at which the bike balances on its rear wheel, with this lean). */
    get bp() { return S[BP]!; },
    /** rel over the balance point: 1 is balanced, over 1 is going over. */
    get balance() { return S[BAL]!; },
    get rpm() { return S[RPM]!; },
    get gear() { return S[GEAR]!; },
    get throttle() { return S[THR]!; },
    /** 0..1: the rear tyre spinning past its grip. */
    get slip() { return S[SLIP]!; },
    /** 0..1: how hard the rear throws dirt. */
    get dust() { return S[DUST]!; },
    /** The rider's weight, smoothed (−1 forward .. +1 back). */
    get lean() { return S[LEAN]!; },
    /** The front wheel's steering angle. */
    get steerAngle() { return S[STEER]!; },
    /** Seconds in the air (0 on the ground) and the pitch turned since take-off. */
    get air() { return S[AIR]!; },
    get airSpin() { return S[ASPIN]!; },
    /** The current wheelie (seconds, distance), the last one's seconds, and the current stoppie. */
    get wheelie() { return S[WT]!; },
    get wheelieDist() { return S[WD]!; },
    get lastWheelie() { return S[LASTW]!; },
    get stoppie() { return S[ST]!; },
    /** The last landing: air seconds, how far off the slope (radians), how hard (downward speed). */
    get landAir() { return S[LAIR]!; },
    get landErr() { return S[LERR]!; },
    get landDrop() { return S[LDROP]!; },
    get crashed() { return F[0] === 1; },
    /** The crash kind (LOOP, ENDO, CASE, BAIL, STRIKE) and seconds since it. */
    get crash() { return S[CK]!; },
    get crashTime() { return S[CT]!; },
    get resting() { return F[2] === 1; },
    /** The heading's cosine and sine (deterministic). */
    get cy() { return S[CY]!; },
    get sy() { return S[SY]!; },
  };
  return api;
}
export type Bike = ReturnType<typeof bike>;

/** Two riders on the ground plane closer than `r` (centre to centre) push apart, half each, and
 *  trade a little speed (the one behind slows). Deterministic; true on a contact. */
export function nudge(a: Bike, b: Bike, r = 0.9) {
  if (a.crashed || b.crashed) return false;
  const dx = b.pos[0]! - a.pos[0]!, dz = b.pos[2]! - a.pos[2]!, d2 = dx * dx + dz * dz;
  if (d2 >= r * r || (a.pos[1]! - b.pos[1]! > 0.8 || b.pos[1]! - a.pos[1]! > 0.8)) return false;
  const d = Math.sqrt(d2) || 1e-6, push = (r - d) / 2, nx = dx / d, nz = dz / d;
  a.pos[0] = a.pos[0]! - nx * push; a.pos[2] = a.pos[2]! - nz * push;
  b.pos[0] = b.pos[0]! + nx * push; b.pos[2] = b.pos[2]! + nz * push;
  // The one whose heading points at the other is behind: it loses a little.
  const ab = a.cy * nx - a.sy * nz, ba = -(b.cy * nx - b.sy * nz);
  if (ab > ba) a.S[5] = a.S[5]! * 0.97;
  else b.S[5] = b.S[5]! * 0.97;
  return true;
}
