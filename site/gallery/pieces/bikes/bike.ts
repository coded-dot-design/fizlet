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

// S: the state, by index.
const YAW = 0, YR = 1, P = 2, W = 3, ROLL = 4, VF = 5, VY = 6, AIR = 7, THR = 8, RPM = 9, GEAR = 10, WT = 11, WD = 12, ST = 13, SLOPE = 14,
  CK = 15, CT = 16, LERR = 17, LAIR = 18, ASPIN = 19, STEER = 20, CY = 21, SY = 22, SLIP = 23, LASTW = 24, BAL = 25, BP = 26, DUST = 27,
  LEAN = 28, LDROP = 29, TRICK = 30, TQ = 31;

/** The read-outs, as getters on one prototype every bike shares (per-bike getters would make a loop
 *  over riders polymorphic, and a double read through one is boxed: young GCs). */
class Ride {
  /** The raw state (see the getters). */
  S: Float64Array;
  /** @internal Flags: crashed, in the air, at rest, wheelie on. */
  _f: Uint8Array;
  /** [gas, brake, lean (+ back), steer (+ right), trick (off the seat)]: set each step. */
  input: Float64Array;
  /** Events since the last `clear`: [type, value] pairs, `n` of them. */
  ev: Float64Array;
  /** @internal The event count. */
  _n: Uint8Array;
  /** @internal The engine. */
  _pw: Power;
  constructor(S: Float64Array, F: Uint8Array, input: Float64Array, ev: Float64Array, n: Uint8Array, pw: Power) {
    this.S = S; this._f = F; this.input = input; this.ev = ev; this._n = n; this._pw = pw;
  }
  /** Set the inputs (the same as writing `input`). */
  set(gas: number, brake: number, lean: number, steer: number, trick = 0) {
    const i = this.input;
    i[0] = gas; i[1] = brake; i[2] = lean; i[3] = steer; i[4] = trick;
  }
  get n() { return this._n[0]!; }
  clear() { this._n[0] = 0; }
  get power() { return this._pw; }
  get yaw() { return this.S[0]!; }
  get speed() { return this.S[5]!; }
  get vy() { return this.S[6]!; }
  /** Pitch, radians (nose up +). */
  get pitch() { return this.S[2]!; }
  /** Pitch off the ground's slope under it (a wheelie is +). */
  get rel() { const a = this.S[2]! - this.S[14]!; return a - TAU * Math.floor(a / TAU + 0.5); }
  /** The balance point now (rel at which the bike balances on its rear wheel, with this lean). */
  get bp() { return this.S[26]!; }
  /** rel over the balance point: 1 is balanced, over 1 is going over. */
  get balance() { return this.S[25]!; }
  get rpm() { return this.S[9]!; }
  get gear() { return this.S[10]!; }
  get throttle() { return this.S[8]!; }
  /** 0..1: the rear tyre spinning past its grip. */
  get slip() { return this.S[23]!; }
  /** 0..1: how hard the rear throws dirt. */
  get dust() { return this.S[27]!; }
  /** The rider's weight, smoothed (−1 forward .. +1 back). */
  get lean() { return this.S[28]!; }
  /** The front wheel's steering angle. */
  get steerAngle() { return this.S[20]!; }
  /** Seconds in the air (0 on the ground) and the pitch turned since take-off. */
  get air() { return this.S[7]!; }
  get airSpin() { return this.S[19]!; }
  /** The current wheelie (seconds, distance), the last one's seconds, and the current stoppie. */
  get wheelie() { return this.S[11]!; }
  get wheelieDist() { return this.S[12]!; }
  get lastWheelie() { return this.S[24]!; }
  get stoppie() { return this.S[13]!; }
  /** The last landing: air seconds, how far off the slope (radians), how hard (downward speed). */
  get landAir() { return this.S[18]!; }
  get landErr() { return this.S[17]!; }
  get landDrop() { return this.S[29]!; }
  get crashed() { return this._f[0] === 1; }
  /** The crash kind (LOOP, ENDO, CASE, BAIL, STRIKE) and seconds since it. */
  get crash() { return this.S[15]!; }
  get crashTime() { return this.S[16]!; }
  get resting() { return this._f[2] === 1; }
  /** The heading's cosine and sine (deterministic). */
  get cy() { return this.S[21]!; }
  get sy() { return this.S[22]!; }
}

/** A bike on `ground` with engine `power`: set `input` (or `set`), `step(dt)` from the engine's
 *  fixed step, draw from `pos`, `rot`, `wheel`, `comp`, `spin`, `rider`. */
export function bike(ground: BikeGround, power: Power, shape: BikeShape = {}) {
  const AR = shape.rear ?? -0.66, AF = shape.front ?? 0.84, AH = shape.drop ?? 0.42, R = shape.radius ?? 0.34, TRAV = shape.travel ?? 0.3, SAG = shape.sag ?? 0.09;
  const SH = shape.shift ?? 0.17, g = shape.gravity ?? 20, sub = shape.substeps ?? 4, BASE = AF - AR;
  // The chassis numbers the engine sets (mass, pitch inertia, spring rate, damping) and the engine's own (in a
  // typed array: doubles in closure variables that change are boxed).
  let pw = power;
  const MK = new Float64Array(16);
  const S = new Float64Array(32), input = new Float64Array(5), pos = new Float64Array(3), rot = new Float64Array(3);
  const wheel = new Float64Array(6), comp = new Float64Array(2), spin = new Float64Array(2), contact = new Uint8Array(2), GH = new Float64Array(2), GS = new Float64Array(2), WF = new Float64Array(2);
  const G = new Float64Array(4), F = new Uint8Array(4); // F: crashed, in the air, at rest, wheelie on
  // The tumble: bike velocity (3), spin rates (3); the rider: pos (3), vel (3), rot (3).
  const TV = new Float64Array(6), rider = new Float64Array(3), RV = new Float64Array(3), riderRot = new Float64Array(3);
  const ev = new Float64Array(16), NV = new Uint8Array(1);
  const emit = (type: number, v: number) => void (NV[0]! < 8 && ((ev[NV[0]! * 2] = type), (ev[NV[0]! * 2 + 1] = v), NV[0] = NV[0]! + 1));

  /** Swap the engine (a new bike choice); keeps the place. */
  function use(p: Power) {
    pw = p;
    const m = p.mass;
    MK[0] = m;
    MK[1] = m * p.gyr * p.gyr;
    // Springs sag by SAG under the bike's weight shared by two wheels; damped a little under critical.
    MK[2] = (m * g) / (2 * SAG);
    MK[3] = 2 * 0.62 * Math.sqrt(MK[2]! * m * 0.5);
    MK[4] = p.force; MK[5] = p.grip; MK[6] = p.brake; MK[7] = p.roll; MK[8] = p.rev; MK[9] = p.launch; MK[10] = p.up; MK[11] = p.down; MK[12] = p.airPitch;
  }
  use(power);

  // X: per substep scratch, so no double crosses a call (one passed or returned through a call the
  // JIT does not inline is boxed: young GCs). [h, gas, brake, lean in, steer in, trick, sin yaw, cos yaw,
  // sin pitch, cos pitch, Ff, Fu, torque, contacts, slip, rear load, ground under the CoM, its normal
  // x, z, atan in ×3, atan out ×3].
  const X = new Float64Array(30);
  const XH = 0, XG = 1, XB = 2, XL = 3, XS = 4, XT = 5, SYW = 6, CYW = 7, SP = 8, CP = 9, QX = 28, QZ = 29, FF = 10, FU = 11, TQX = 12, NC = 13, SL = 14, NR = 15, GY = 16, GNX = 17, GNZ = 18, AI = 19, AO = 22;
  /** The inputs (clamped), the throttle and the weight eased, the heading's and pitch's sines. */
  function inputs() {
    const h = X[XH]!, i0 = input[0]!, i1 = input[1]!, i2 = input[2]!, i3 = input[3]!, i4 = input[4]!;
    const gas = i0 < 0 ? 0 : i0 > 1 ? 1 : i0;
    X[XG] = gas; X[XB] = i1 < 0 ? 0 : i1 > 1 ? 1 : i1; X[XL] = i2 < -1 ? -1 : i2 > 1 ? 1 : i2; X[XS] = i3 < -1 ? -1 : i3 > 1 ? 1 : i3; X[XT] = i4 < 0 ? 0 : i4 > 1 ? 1 : i4;
    const thr = S[THR]!;
    S[THR] = thr + (gas - thr) * Math.min(1, (gas > thr ? MK[7]! : 8) * h);
    S[LEAN] = S[LEAN]! + (X[XL]! - S[LEAN]!) * Math.min(1, 9 * h);
    S[TRICK] = X[XT]!;
    trig();
  }
  /** X[SYW..CP] = sin yaw, cos yaw, sin pitch, cos pitch: the polynomial written out here, so nothing is called. */
  function trig() {
    for (let k = 0; k < 4; k++) {
      let a = (k < 2 ? S[YAW]! : S[P]!) + (k & 1 ? PI / 2 : 0);
      a -= TAU * Math.floor(a / TAU + 0.5);
      a = a > PI / 2 ? PI - a : a < -PI / 2 ? -PI - a : a;
      const q = a * a;
      X[SYW + k] = a * (1 - (q / 6) * (1 - (q / 20) * (1 - (q / 42) * (1 - (q / 72) * (1 - (q / 110) * (1 - (q / 156) * (1 - q / 210)))))));
    }
  }
  /** The ground at (X[QX], X[QZ]) into G: its own small function, so the ground's `sample` inlines here. */
  function samp() {
    ground.sample(X[QX]!, X[QZ]!, G);
  }
  /** Three arctangents at once: X[AO + k] = atan(X[AI + k]). */
  function atans() {
    for (let k = 0; k < 3; k++) {
      const v = X[AI + k]!, a = v < 0 ? -v : v, t = a > 1 ? 1 / a : a, q = t * t, r = t * (0.999866 + q * (-0.3302995 + q * (0.180141 + q * (-0.085133 + q * 0.0208351)))), o = a > 1 ? PI / 2 - r : r;
      X[AO + k] = v < 0 ? -o : o;
    }
  }
  /** The springs: each wheel's place, the ground under it, its push, and along the ground the drive
   *  (rear), the brakes and rolling drag, held to the tyre's grip; summed into X (forces, torque). */
  function springs() {
    const h = X[XH]!, br = X[XB]!, lean = S[LEAN]!, thr = S[THR]!, fx = X[CYW]!, fz = -X[SYW]!, cp = X[CP]!, sp = X[SP]!;
    const x = pos[0]!, y = pos[1]!, z = pos[2]!, vf = S[VF]!, vy = S[VY]!, w = S[W]!, gears = pw.gears, gear = S[GEAR]!;
    let Ff = 0, Fu = 0, tq = 0, nc = 0, slip = 0, Nr = 0;
    for (let i = 0; i < 2; i++) {
      const ox = (i ? AF : AR) + SH * lean, oy = -AH, wf = ox * cp - oy * sp, wu = ox * sp + oy * cp;
      const wx = x + fx * wf, wz = z + fz * wf, wy = y + wu;
      X[QX] = wx; X[QZ] = wz;
      samp();
      const gh = G[0]!, s = -(G[1]! * fx + G[3]! * fz) / G[2]!, pen = gh + R - wy;
      GH[i] = gh; GS[i] = s; WF[i] = wf;
      wheel[i * 3] = wx; wheel[i * 3 + 2] = wz;
      if (pen > 0) {
        const L = Math.sqrt(1 + s * s), nf = -s / L, nu = 1 / L, tf = 1 / L, tu = s / L;
        // The contact point from the centre of mass, and its velocity along the normal (+: leaving).
        const cf = wf - R * nf, cu = wu - R * nu, pv = (vf - w * cu) * nf + (vy + w * cf) * nu;
        let N = MK[2]! * (pen < TRAV ? pen : TRAV) + (pen > TRAV ? 14 * MK[2]! * (pen - TRAV) : 0) - MK[3]! * pv;
        N = N > 0 ? N : 0;
        const vt = (vf - w * cu) * tf + (vy + w * cf) * tu, most = MK[5]! * N, avt = vt < 0 ? -vt : vt;
        let Ft = 0;
        if (!i) {
          Nr = N;
          // The torque curve at the revs (the limiter at the top), through the gear.
          const c = pw.curve, n = c.length - 1, r = S[RPM]!, u = (r < 0 ? 0 : r) * n, k = Math.floor(u), j = k + 1 < n ? k + 1 : n;
          const tqc = r >= 1 ? 0 : c[k]! + (c[j]! - c[k]!) * (u - k);
          let want = thr > 0 ? (MK[4]! * tqc * thr * gears[0]!) / gears[gear]! : 0;
          if (want > most) (slip = (want - most) / want), (want = most);
          Ft += want;
        }
        if (br > 0) {
          // The front brake does most, unless the front is up (then the rear is all there is).
          const share = i ? 0.62 : contact[1] || S[AIR]! > 0 ? 0.38 : 0.55, b = MK[6]! * MK[0]! * br * share, stop = (MK[0]! * 0.5 * avt) / h;
          Ft -= (vt > 0 ? 1 : -1) * Math.min(b, stop, most);
        }
        Ft -= (vt > 0 ? 1 : -1) * Math.min(MK[0]! * 0.35, (MK[0]! * 0.5 * avt) / h);
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
    X[FF] = Ff; X[FU] = Fu; X[TQX] = tq; X[NC] = nc; X[SL] = slip; X[NR] = Nr;
  }
  /** The ground under the centre of mass: its height and normal (a berm's bank, a frame strike). */
  function under() {
    X[QX] = pos[0]!; X[QZ] = pos[2]!;
    samp();
    X[GY] = G[0]!; X[GNX] = G[1]!; X[GNZ] = G[3]!;
  }

  /** One substep of X[XH] seconds on the ground or in the air. */
  function sub1() {
    const h = X[XH]!;
    inputs();
    const gas = X[XG]!, br = X[XB]!, stIn = X[XS]!, tk = X[XT]!, thr = S[THR]!, lean = S[LEAN]!, yaw = S[YAW]!, cy = X[CYW]!, sy = X[SYW]!, fx = cy, fz = -sy, th = S[P]!;
    let x = pos[0]!, y = pos[1]!, z = pos[2]!, vf = S[VF]!, vy = S[VY]!, w = S[W]!;
    const gears = pw.gears, ng = gears.length, avf = vf < 0 ? -vf : vf;
    let gear = S[GEAR]!;
    const wrpm = avf / gears[gear]!;
    springs();
    let Ff = X[FF]!, tq = X[TQX]!;
    const Fu = X[FU]!, nc = X[NC]!, slip = X[SL]!;
    under();
    // The ground's pitch under the two wheels (their ground heights over the distance between), the
    // lean into the turn, the balance point: three arctangents.
    let yr = S[YR]!;
    // (Only the wheels on it count: off a lip the ground under the front has fallen away.)
    X[AI] = contact[0] && contact[1] ? (GH[1]! - GH[0]!) / (WF[1]! - WF[0]! || 1) : contact[0] ? GS[0]! : contact[1] ? GS[1]! : (GH[1]! - GH[0]!) / (WF[1]! - WF[0]! || 1);
    X[AI + 1] = (vf * yr) / g;
    X[AI + 2] = -(AR + SH * lean) / (AH + R - SAG);
    atans();
    // On the ground the slope eases (a lip's edge under one wheel is not the ground's pitch); in the
    // air it holds; it snaps on a landing (judged against the ground it lands on).
    const slope = !nc ? S[SLOPE]! : F[1] ? X[AO]! : S[SLOPE]! + (X[AO]! - S[SLOPE]!) * Math.min(1, 14 * h);
    S[SLOPE] = slope;
    // The engine: the gear for the speed, the revs (tied to the rear wheel on the ground, a slipping
    // launch under it; free in the air).
    if (gear < ng - 1 && wrpm > MK[10]!) (gear++), emit(B_SHIFT, gear);
    else if (gear > 0 && avf / gears[gear - 1]! < MK[11]!) (gear--), emit(B_SHIFT, gear);
    S[GEAR] = gear;
    const wr = avf / gears[gear]!, lw = MK[9]! * thr, target = contact[0] ? (wr > lw ? wr : lw) + slip * 0.35 : thr * 1.02, rp = S[RPM]! + (target - S[RPM]!) * Math.min(1, MK[8]! * h);
    S[RPM] = rp < 0 ? 0 : rp > 1.04 ? 1.04 : rp;
    S[SLIP] = slip;
    // The rider: on the ground the weight back lifts the front (and forward drops it); in the air the
    // lean pitches it, the spinning rear wheel lifts the nose on the gas and the brake dips it.
    // Up on one wheel the rider's arms and legs soak the rotation: it rises no faster than RISE rad/s
    // (time to catch it), and on the rear alone the brake also stops the wheel, which turns the bike
    // nose down.
    if (nc) {
      tq += lean * MK[0]! * 2.6;
      if (contact[0] !== contact[1]) w -= w * 3.2 * h + (contact[0] ? br * 20 * h : 0);
    } else w += (lean * MK[12]! + thr * 0.9 - br * 2.4) * h - w * 0.8 * h;
    // Air drag and the speed: forward along the heading, heave, pitch.
    Ff -= 0.0035 * MK[0]! * vf * avf;
    vf += (Ff / MK[0]!) * h;
    vy += (Fu / MK[0]! - g) * h;
    w += (tq / MK[1]!) * h;
    if (contact[0] && !contact[1]) w = w > RISE ? RISE : w < -FALL ? -FALL : w;
    // Steering: a curvature that tightens less at speed, held to the grip (more in a berm); a wheelie
    // steers by leaning, a little; in the air the heading holds.
    const avn = vf < 0 ? -vf : vf, delta = (stIn * 0.62) / (1 + avn / 11);
    let goal = (-vf * delta) / BASE;
    if (nc) {
      const bank = (X[GNX]! * sy + X[GNZ]! * cy) * (stIn > 0 ? 1 : -1), bb = bank * 2.2, most = MK[5]! * g * (1 + (bb < 0 ? 0 : bb > 0.9 ? 0.9 : bb));
      if (goal * vf > most || goal * vf < -most) goal = (goal * vf > 0 ? most : -most) / (vf || 1);
      yr += (goal * (contact[1] ? 1 : 0.4) - yr) * Math.min(1, (contact[1] ? 9 : 3) * h);
    } else yr -= yr * Math.min(1, 2 * h);
    S[STEER] = delta;
    const lr = nc ? X[AO + 1]! : S[ROLL]! * (1 - 0.8 * h), lroll = lr < -0.85 ? -0.85 : lr > 0.85 ? 0.85 : lr;
    S[ROLL] = S[ROLL]! + (lroll - S[ROLL]!) * Math.min(1, 8 * h);
    x += fx * vf * h; z += fz * vf * h; y += vy * h;
    let th2 = th + w * h;
    const ny = yaw + yr * h;
    S[YAW] = ny - TAU * Math.floor(ny / TAU + 0.5);
    S[YR] = yr;
    // Wheels: rolling with the ground, or spun by the engine in the air.
    for (let i = 0; i < 2; i++) {
      const a = spin[i]! + (vf / R + (i ? 0 : (contact[0] ? 0 : thr * 30) + slip * 25)) * h;
      spin[i] = a - TAU * Math.floor(a / TAU);
    }
    // Air, landings, wheelies, crashes.
    const d0 = th2 - slope, rel = d0 - TAU * Math.floor(d0 / TAU + 0.5), bpa = X[AO + 2]!;
    S[BP] = bpa;
    S[BAL] = rel / bpa;
    if (!nc) {
      // Take-off: the rider soaks most of the kick the lip gives the bike (time to set up the air).
      if (!F[1]) (F[1] = 1), (S[ASPIN] = 0), (w *= 0.4);
      if (S[AIR]! < 0.1 && S[AIR]! + h >= 0.1) emit(B_AIR, 0);
      S[AIR] = S[AIR]! + h;
      S[ASPIN] = S[ASPIN]! + w * h;
      endWheelie();
    } else {
      if (F[1]) {
        const air = S[AIR]!, err = rel < 0 ? -rel : rel, q = 1 / Math.sqrt(1 + GS[0]! * GS[0]!), drop = -(vy * q - vf * GS[0]! * q);
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
      // Over backwards on the rear wheel, or over the bars on the front.
      if (!F[0] && contact[0] && rel > bpa + 0.62) crash(LOOP);
      else if (!F[0] && contact[1] && rel < -1.05) crash(ENDO);
    }
    // The frame on the ground (cased into a face, or bottomed out): a crash.
    if (!F[0] && y - X[GY]! < 0.12) crash(STRIKE);
    const dz = slip * 0.9 + (avn / 16) * 0.45 + thr * 0.25;
    S[DUST] = contact[0] ? (dz > 1 ? 1 : dz) : 0;
    // At rest: still on both wheels, no gas: nothing moves (the engine settles).
    const still = nc === 2 && gas === 0 && avn < 0.06 && !F[0];
    if (still) (vf = 0), (x = pos[0]!), (z = pos[2]!), (S[YR] = 0);
    F[2] = still && (vy < 0 ? -vy : vy) < 0.01 && (w < 0 ? -w : w) < 0.06 && S[RPM]! < 0.002 ? 1 : 0;
    if (F[2]) (vy = 0), (w = 0), (y = pos[1]!), (th2 = th);
    if (!F[0]) {
      pos[0] = x; pos[1] = y; pos[2] = z;
      S[VF] = vf; S[VY] = vy; S[W] = w; S[P] = th2;
      S[TQ] = X[NR]!;
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
  function tumble() {
    const h = X[XH]!;
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
    X[XH] = dt / sub;
    let moving = 0;
    for (let i = 0; i < sub; i++) if (F[0]) moving |= tumble();
    else sub1();
    rot[0] = -S[ROLL]!; rot[1] = S[YAW]!; rot[2] = S[P]!;
    trig();
    S[CY] = X[CYW]!; S[SY] = X[SYW]!;
    return F[0] ? moving > 0 || S[CT]! < 0.6 : !F[2];
  }

  /** Put it down at (x, z) facing `yaw`: on its wheels at sag, level with the ground, still, idle. */
  function reset(x: number, z: number, yaw = 0, speed = 0) {
    S.fill(0); F.fill(0); TV.fill(0); RV.fill(0); spin.fill(0); input.fill(0);
    NV[0] = 0;
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

  const ride = new Ride(S, F, input, ev, NV, pw);
  return Object.assign(ride, {
    step,
    reset,
    /** Swap the engine (a new bike choice); keeps the place. */
    use: (p: Power) => void (use(p), (ride._pw = p)),
    /** Knock it over (off the table, hit by something): a crash of `kind`. */
    knock: (kind: number) => crash(kind),
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
  });
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
