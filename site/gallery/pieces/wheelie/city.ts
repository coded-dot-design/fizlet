// Wheelie City's block and session, headless (tests/wheelie-city.test.mjs plays it with no browser).
// The table: two long boulevards (north and south, 94 units end to end: room for a wheelie of eight
// seconds and more without a turn) joined by four avenues and a cross street, round four blocks. The
// middle two are the old town: four houses with lawns and driveways in the west, an apartment building
// and a corner store over two more houses in the east (one with a dog in a fenced front yard); the
// outer two are rows of houses along the boulevards, with their own crosswalks and sprinklers. Curbs, two crosswalks, a speed bump, a
// plywood kicker someone left on the west avenue, parked cars, trees and streetlights. The bike is
// the Bikes series' shared bike (../bikes/bike.ts) through ./ride.ts on this ground; ./tricks.ts scores it. A session is one
// minute from the first touch of the gas: wheelies, manuals and hops score, with bonuses for a
// trick across a crosswalk, through a sprinkler or past a neighbour who has come out to shake a
// fist. Loop it out, nose it in or land off balance and it is a crash: the trick and the combo are
// gone, a tumble, then back up; ride hard into something and it is a crash too (a bonk). `autopilot` rides the loop with wheelies (the poster, the
// tests). Zero allocation per step.
import { hypot } from "../../../../src/steer";
import { ride, RIDES } from "./ride";
import { B_CRASH, B_STOPPIE } from "../bikes/bike";
import { tricks, ON, F_CROSS, F_SPRINK, F_GRUMP, BANKED } from "./tricks";

export const HX = 49, HZ = 14, CURB = 0.12, SESSION = 60;
export const READY = 0, RUN = 1, CRASH = 2, DONE = 3;
/** Ground kinds. */
export const K_ROAD = 0, K_WALK = 1, K_LAWN = 2, K_DRIVE = 3;
/** Events (one ring, read and cleared each step): what, and a value. */
export const E_START = 1, E_TRICK = 2, E_CRASH = 3, E_RESPAWN = 4, E_GRUMP = 5, E_BARK = 6, E_SPLASH = 7, E_BONUS = 8, E_END = 9, E_HOP = 10, E_AIR = 11;
const TAU = 6.283185307179586, CRASH_T = 1.8, R_BIKE = 0.45, BONK_V = 5;

/** Streets as rects [x0, z0, x1, z1]: north, south, west avenue, east avenue, the cross street. */
export const ROADS = [-47, -10.5, 47, -6.5, -47, 6.5, 47, 10.5, -47, -10.5, -43, 10.5, 43, -10.5, 47, 10.5, -17, -10.5, -13, 10.5, 13, -10.5, 17, 10.5, -2, -6.5, 2, 6.5];
/** The boulevards' length end to end (the long straights). */
export const BOULEVARD = 94;
/** The two blocks [x0, z0, x1, z1]. */
export const BLOCKS = [-13, -6.5, -2, 6.5, 2, -6.5, 13, 6.5, -43, -6.5, -17, 6.5, 17, -6.5, 43, 6.5];
/** Driveways [x0, z0, x1, z1] (from the curb to the house's side). */
export const DRIVES = [-8.9, -6.5, -7.6, -0.8, -4.4, -6.5, -3.1, -0.8, -8.9, 0.8, -7.6, 6.5, -4.4, 0.8, -3.1, 6.5, 6.1, 0.8, 7.4, 6.5, 10.6, 0.8, 11.9, 6.5];
/** Buildings: x, z (centre), w, d, height, face (−1 faces north, +1 south), look (0..3 house, 4 flats, 5 store). */
export const HOUSES = [
  -10.5, -2.2, 3, 2.8, 1.9, -1, 0,
  -6.0, -2.2, 3, 2.8, 1.9, -1, 1,
  -10.5, 2.2, 3, 2.8, 1.9, 1, 2,
  -6.0, 2.2, 3, 2.8, 1.9, 1, 3,
  5.4, -2.3, 4.4, 3.4, 4.2, -1, 4,
  10.1, -2.2, 3.6, 2.8, 2.3, -1, 5,
  4.5, 2.2, 3, 2.8, 1.9, 1, 1,
  9.0, 2.2, 3, 2.8, 1.9, 1, 0,
];
// The outer blocks: five houses a row facing each boulevard, a driveway beside each.
for (const x0 of [-42, 18]) for (let k = 0; k < 5; k++) for (const f of [-1, 1]) {
  const x = x0 + 1.5 + k * 4.75;
  HOUSES.push(x, f * 2.2, 3, 2.8, 1.9, f, (k * 2 + (f > 0 ? 1 : 0) + (x0 > 0 ? 1 : 0)) % 4);
  DRIVES.push(x + 1.6, f < 0 ? -6.5 : 0.8, x + 2.9, f < 0 ? -0.8 : 6.5);
}
export const NH = HOUSES.length / 7;
/** Parked cars: x, z, yaw, look. */
export const CARS = [-10.6, -7.3, 0, 0, 7.6, -7.3, 0, 1, -10.6, 7.3, Math.PI, 2, 13.8, -1.5, Math.PI / 2, 3, -3.75, -4.4, Math.PI / 2, 1, -35.5, 7.3, Math.PI, 3, 30, -7.3, 0, 2, 43.8, 2.5, Math.PI / 2, 0, -24, -7.3, 0, 1, 11.25, 4.4, -Math.PI / 2, 2];
export const NCARS = CARS.length / 4, CAR_L = 2.3, CAR_W = 1.1;
/** Crosswalks [x0, z0, x1, z1]: on the cross street by the north corner, on the south street by the east corner. */
export const CROSS = [-2, -5.9, 2, -4.7, 10.6, 6.5, 11.8, 10.5, -30.6, 6.5, -29.4, 10.5, 25.6, 6.5, 26.8, 10.5, -21.4, -10.5, -20.2, -6.5, 34.4, -10.5, 35.6, -6.5];
/** The speed bump on the north street (x, half width) and the kicker on the west avenue (z0, z1, x0, x1, height). */
export const BUMP = [4, 0.45, 0.16];
export const KICK = [0.8, 2.2, -16.4, -13.6, 0.42];
/** Sprinklers: x, z, aim (radians: 0 is +x), phase. */
export const SPRINK = [-10.5, -4.6, -Math.PI / 2, 0, -6.0, 4.6, Math.PI / 2, 2.1, 4.5, 4.6, Math.PI / 2, 4.2, -35.25, 4.6, Math.PI / 2, 1.3, 24.25, 4.6, Math.PI / 2, 3.3, 33.75, -4.6, -Math.PI / 2, 5.1, -21, -4.6, -Math.PI / 2, 2.6];
export const NSP = SPRINK.length / 4, SP_REACH = 2.6;
/** The dog's yard (in front of the last house): x0, x1, z (where it trots), and its fence [x0, z0, x1, z1]. */
export const DOG = [7.8, 10.2, 5.0];
export const FENCE = [7.4, 3.6, 10.6, 5.6];
/** Neighbours: house index (−1 store front), door x, door z, face, zone [x0, z0, x1, z1]. */
export const NEIGH: number[] = [];
// (On the outer blocks, every other house has someone at home.)
for (const h of [0, 1, 2, 3, 6, 4, 5, ...Array.from({ length: NH - 8 }, (_, k) => 8 + k).filter((h) => ((h - 8) >> 1) % 2 === 0)]) {
  const o = h * 7, x = HOUSES[o]!, z = HOUSES[o + 1]!, d = HOUSES[o + 3]!, f = HOUSES[o + 5]!, fz = z + (f * d) / 2;
  NEIGH.push(h, x - 0.5, fz, f, x - 3.4, f < 0 ? -10.5 : fz, x + 3.4, f < 0 ? fz : 10.5);
}
export const NN = NEIGH.length / 8;
/** What they shout (comic and generic, never mean). */
export const LINES = ["HEY! MY LAWN!", "SLOW DOWN!", "I JUST MOWED THAT!", "WHEELS DOWN, KID!", "NOT THE PETUNIAS!", "IT'S SUNDAY!", "BACK IN MY DAY…", "KEEP IT ON THE ROAD!"];
/** Trees and streetlights: x, z (on the verge outside the ring and in the back yards). */
export const TREES = [-48.2, -12.4, -41, -12.4, -33, -12.4, -26, -12.4, -19, -12.4, -12, -12.4, -5, -12.4, 5, -12.4, 12, -12.4, 19, -12.4, 26, -12.4, 33, -12.4, 41, -12.4, 48.2, -12.4, -48.2, 12.4, -40, 12.4, -30, 12.4, -21, 12.4, -9, 12.4, 1, 12.4, 9, 12.4, 21, 12.4, 30, 12.4, 40, 12.4, 48.2, 12.4, -48.4, -4, -48.4, 4, 48.4, -4, 48.4, 4, -8.3, 0, -3.5, 0.2, 3.3, 0.1, 11.6, 0, -37.5, 0, -27.5, 0.1, -22, 0, 22.5, 0, 28, 0.1, 37.5, 0];
export const LAMPS = [-47.6, -11.2, 47.6, -11.2, -47.6, 11.2, 47.6, 11.2, -32, -11.2, 32, 11.2, -17.6, -11.2, 17.6, 11.2, -2.5, -6.0, 2.5, 6.0, -12.5, -6.0, 12.5, 6.0, -25, 11.2, 25, -11.2, -38, 11.2, 38, -11.2];
/** The autopilot's loop round the ring (x, z), anticlockwise from above starting east on the south street. */
export const ROUTE = [45.1, 8.6, 45.1, -8.6, -45, -8.6, -45, 8.6];
export const START = [-9, 8.7, 0];
/** The autopilot's gains (tuned headless): under the balance point by, gas at rest, nose rate per radian off, most nose rate, gas per rate error, gas per unit of speed under the target, lean per rate error, target speed, brake dead band, brake gain. */
export const AP = [0.008, 0.077, 33.317, 2.172, 0.387, 0.04, 0.729, 3.383, 0.391, 1.244];

const inR = (x: number, z: number, R: ArrayLike<number>, o: number) => x >= R[o]! && x <= R[o + 2]! && z >= R[o + 1]! && z <= R[o + 3]!;
// (Results go through Q, never returned: a double returned from a call that is not inlined is boxed.)
const Q = new Float64Array(2);
// The rects the ground reads each sample, as typed arrays (a plain array of doubles can change shape).
const RD = Float64Array.from(ROADS), DR = Float64Array.from(DRIVES), BL = Float64Array.from(BLOCKS);
/** Distance to the nearest road (0 on one), for the curb's edge: into Q[0]. */
function roadGap(x: number, z: number) {
  Q[0] = 1e9;
  for (let o = 0; o < RD.length; o += 4) {
    const ax = RD[o]! - x, bx = x - RD[o + 2]!, az = RD[o + 1]! - z, bz = z - RD[o + 3]!;
    const dx = ax > bx ? (ax > 0 ? ax : 0) : bx > 0 ? bx : 0, dz = az > bz ? (az > 0 ? az : 0) : bz > 0 ? bz : 0, d = dx > dz ? dx : dz;
    if (d < Q[0]!) Q[0] = d;
  }
}
/** The ground's height at (x, z): into Q[1]. */
function heightQ(x: number, z: number) {
  roadGap(x, z);
  const g = Q[0]!;
  if (g > 0) return void (Q[1] = g >= 0.08 ? CURB : CURB * (g / 0.08));
  let h = 0;
  const bx = Math.abs(x - BUMP[0]!);
  if (bx < BUMP[1]! && z < -6.5) {
    const u = bx / BUMP[1]!;
    h += BUMP[2]! * (1 - u * u);
  }
  if (x > KICK[2]! && x < KICK[3]! && z > KICK[0]! && z < KICK[1]!) h += (KICK[4]! * (z - KICK[0]!)) / (KICK[1]! - KICK[0]!);
  Q[1] = h;
}
/** The ground's height at (x, z). */
export function height(x: number, z: number) {
  heightQ(x, z);
  return Q[1]!;
}
export function kindAt(x: number, z: number) {
  roadGap(x, z);
  const g = Q[0]!;
  if (g <= 0) return K_ROAD;
  for (let o = 0; o < DR.length; o += 4) if (x >= DR[o]! && x <= DR[o + 2]! && z >= DR[o + 1]! && z <= DR[o + 3]!) return K_DRIVE;
  for (let o = 0; o < BL.length; o += 4)
    if (x >= BL[o]! && x <= BL[o + 2]! && z >= BL[o + 1]! && z <= BL[o + 3]!) return x - BL[o]! < 1 || BL[o + 2]! - x < 1 || z - BL[o + 1]! < 1 || BL[o + 3]! - z < 1 ? K_WALK : K_LAWN;
  return g < 1.2 ? K_WALK : K_LAWN;
}
/** The ground for the bike: height and normal (from the neighbours), and the kind. */
export const ground = {
  sample(x: number, z: number, out: { [i: number]: number }) {
    const e = 0.05;
    heightQ(x + e, z); const hx1 = Q[1]!;
    heightQ(x - e, z); const hx0 = Q[1]!;
    heightQ(x, z + e); const hz1 = Q[1]!;
    heightQ(x, z - e); const hz0 = Q[1]!;
    heightQ(x, z);
    const nx = -(hx1 - hx0) / (2 * e), nz = -(hz1 - hz0) / (2 * e), l = Math.sqrt(nx * nx + nz * nz + 1);
    out[0] = Q[1]!; out[1] = nx / l; out[2] = 1 / l; out[3] = nz / l;
    return kindAt(x, z);
  },
};

/** Solid boxes [x0, z0, x1, z1] the bike runs into: the buildings, the cars, the dog's fence, trees, lamps. */
export const SOLID: number[] = [];
for (let h = 0; h < NH; h++) {
  const o = h * 7, x = HOUSES[o]!, z = HOUSES[o + 1]!, w = HOUSES[o + 2]! / 2, d = HOUSES[o + 3]! / 2;
  SOLID.push(x - w, z - d, x + w, z + d);
}
for (let c = 0; c < NCARS; c++) {
  const o = c * 4, x = CARS[o]!, z = CARS[o + 1]!, along = Math.abs(Math.cos(CARS[o + 2]!)) > 0.5, a = (along ? CAR_L : CAR_W) / 2, b = (along ? CAR_W : CAR_L) / 2;
  SOLID.push(x - a, z - b, x + a, z + b);
}
SOLID.push(FENCE[0]!, FENCE[3]! - 0.1, FENCE[2]!, FENCE[3]! + 0.1, FENCE[0]! - 0.1, FENCE[1]!, FENCE[0]! + 0.1, FENCE[3]!, FENCE[2]! - 0.1, FENCE[1]!, FENCE[2]! + 0.1, FENCE[3]!);
for (let k = 0; k < TREES.length; k += 2) SOLID.push(TREES[k]! - 0.25, TREES[k + 1]! - 0.25, TREES[k]! + 0.25, TREES[k + 1]! + 0.25);
for (let k = 0; k < LAMPS.length; k += 2) SOLID.push(LAMPS[k]! - 0.12, LAMPS[k + 1]! - 0.12, LAMPS[k]! + 0.12, LAMPS[k + 1]! + 0.12);

/** A session on the block. Inputs each step: gas, brake, lean (−1 back .. 1 forward), steer, hop. */
export function cityRun() {
  const bike = ride(ground), sc = tricks();
  // S: phase, time left, ride, crash timer, grumps, splashes, barks, route leg, hop air, crash reason, wall hit, sprinkler clock, landed in a wheelie.
  const S = new Float64Array(13);
  const ev = new Float64Array(32);
  let n = 0;
  // Neighbours: timer (out while > 0), cooldown, line. Sprinklers: cooldown. Dog: x, bark timer, cooldown, hop.
  const NB = new Float64Array(NN * 3), SPC = new Float64Array(NSP), DG = new Float64Array(4);
  function emit(type: number, v: number) {
    if (n < 16) (ev[n * 2] = type), (ev[n * 2 + 1] = v), n++;
  }
  function crashed(why: number) {
    if (S[0] !== RUN) return;
    S[0] = CRASH; S[3] = CRASH_T; S[9] = why;
    sc.drop();
    emit(E_CRASH, why);
  }
  function reset(which = S[2]!) {
    S.fill(0);
    S[1] = SESSION; S[2] = which;
    bike.use(which, START[0]!, START[1]!, START[2]!);
    sc.reset();
    NB.fill(0); SPC.fill(0); DG.fill(0);
    DG[0] = (DOG[0]! + DOG[1]!) / 2;
    n = 0;
  }
  /** Bump out of anything solid and the table's rim; a hard hit is a crash. */
  function collide() {
    const p = bike.b.pos;
    for (let o = 0; o < SOLID.length; o += 4) {
      const cx = Math.max(SOLID[o]!, Math.min(SOLID[o + 2]!, p[0]!)), cz = Math.max(SOLID[o + 1]!, Math.min(SOLID[o + 3]!, p[2]!));
      let dx = p[0]! - cx, dz = p[2]! - cz;
      const dd = hypot(dx, dz);
      if (dd >= R_BIKE) continue;
      if (dd > 1e-6) (dx /= dd), (dz /= dd);
      else (dx = -bike.b.cy), (dz = bike.b.sy);
      p[0] = cx + dx * R_BIKE; p[2] = cz + dz * R_BIKE;
      hit(bike.wall(dx, dz, BONK_V));
    }
    for (let a = 0; a < 3; a += 2) {
      const lim = (a ? HZ : HX) - 0.5;
      if (Math.abs(p[a]!) > lim) {
        const s = p[a]! > 0 ? 1 : -1;
        p[a] = s * lim;
        hit(bike.wall(a ? 0 : -s, a ? -s : 0, BONK_V));
      }
    }
  }
  function hit(v: number) {
    // (A hard hit is a crash, STRIKE, called through the shared bike's own crash event.)
    S[10] = v;
  }
  function step(dt: number, gas: number, brake: number, lean: number, steer: number, hop: number) {
    const ph = S[0]!;
    if (ph === READY && gas > 0) (S[0] = RUN), emit(E_START, 0);
    const live = S[0] === RUN;
    const wasAir = bike.air, b = bike.b;
    let moving = bike.step(dt, live || ph === READY ? gas : 0, live ? brake : ph === DONE ? 0.35 : brake, ph === DONE ? (bike.nose > 0.05 ? 1 : 0) : lean, ph === DONE ? 0 : steer, live ? hop : 0);
    for (let k = 0; k < b.n; k++) {
      const t = b.ev[k * 2]!, v = b.ev[k * 2 + 1]!;
      if (t === B_CRASH) crashed(v);
      else if (t === B_STOPPIE && S[0] === RUN && sc.stoppie(v) === BANKED) emit(E_TRICK, sc.S[10]!);
    }
    b.clear();
    collide();
    const x = b.pos[0]!, z = b.pos[2]!, speed = b.speed < 0 ? -b.speed : b.speed;
    if (S[0] === RUN) {
      S[1] = Math.max(0, S[1]! - dt);
      // The trick in progress, and a hop when it lands.
      if (bike.air) {
        if (!wasAir) emit(E_AIR, 0);
        S[8] = S[8]! + dt;
      } else if (wasAir) {
        const r = sc.hop(S[8]!, bike.nose > 0.14);
        if (r === BANKED) emit(E_HOP, 0);
        S[8] = 0;
      }
      if (sc.step(dt, bike.nose, bike.balance, bike.spec.sweet, speed, b.throttle, bike.air) === BANKED) emit(E_TRICK, sc.S[10]!);
      if (sc.S[ON]) {
        for (let o = 0; o < CROSS.length; o += 4) if (inR(x, z, CROSS, o) && sc.bonus(F_CROSS)) emit(E_BONUS, F_CROSS);
      }
      if (S[1] === 0) {
        if (sc.S[ON] && sc.step(dt, 0, 1, 0, 0, 0, false) === BANKED) emit(E_TRICK, sc.S[10]!);
        S[0] = DONE;
        emit(E_END, 0);
      }
    } else if (S[0] === CRASH) {
      S[3] = S[3]! - dt;
      S[1] = Math.max(0, S[1]! - dt);
      moving = true;
      if (S[3]! <= 0) {
        S[0] = S[1]! > 0 ? RUN : DONE;
        bike.reset(x, z, b.yaw);
        collide();
        emit(S[0] === DONE ? E_END : E_RESPAWN, 0);
      }
    }
    if (S[0] === RUN || S[0] === CRASH) if (world(dt, x, z, speed)) moving = true;
    return moving || S[0] === RUN;
  }
  /** Neighbours, sprinklers and the dog. True while any of them moves. */
  function world(dt: number, x: number, z: number, speed: number) {
    let any = false;
    const on = sc.S[ON] === 1, loud = on || speed > 9 || kindAt(x, z) === K_LAWN;
    for (let i = 0; i < NN; i++) {
      const o = i * 8, b = i * 3, inZone = x > NEIGH[o + 4]! && x < NEIGH[o + 6]! && z > NEIGH[o + 5]! && z < NEIGH[o + 7]!;
      if (NB[b + 1]! > 0) NB[b + 1] = NB[b + 1]! - dt;
      if (NB[b]! > 0) {
        NB[b] = Math.max(0, NB[b]! - dt);
        any = true;
        if (inZone && on && NB[b]! < 2.2 && sc.bonus(F_GRUMP)) emit(E_BONUS, F_GRUMP);
      } else if (inZone && loud && NB[b + 1]! <= 0 && S[0] === RUN) {
        NB[b] = 2.6; NB[b + 1] = 8; NB[b + 2] = (S[4]! * 3 + i) % LINES.length;
        S[4] = S[4]! + 1;
        emit(E_GRUMP, i);
        any = true;
      }
    }
    S[11] = S[11]! + dt;
    for (let i = 0; i < NSP; i++) {
      const o = i * 4, dx = x - SPRINK[o]!, dz = z - SPRINK[o + 1]!, dd = hypot(dx, dz);
      if (SPC[i]! > 0) SPC[i] = SPC[i]! - dt;
      if (dd > SP_REACH || dd < 0.2 || SPC[i]! > 0) continue;
      let da = Math.atan2(-dz, dx) - sprinklerAim(i);
      da -= TAU * Math.floor(da / TAU + 0.5);
      if (Math.abs(da) < 0.45) {
        SPC[i] = 1.2;
        S[5] = S[5]! + 1;
        emit(E_SPLASH, i);
        if (sc.bonus(F_SPRINK)) emit(E_BONUS, F_SPRINK);
      }
    }
    any = true; // the sprinklers turn while the session runs
    // The dog trots along its fence after the bike and barks when it is close.
    const dz = Math.abs(z - DOG[2]!), want = dz < 9 ? Math.max(DOG[0]!, Math.min(DOG[1]!, x)) : (DOG[0]! + DOG[1]!) / 2, dx = want - DG[0]!;
    DG[0] = DG[0]! + Math.max(-4 * dt, Math.min(4 * dt, dx));
    if (DG[2]! > 0) DG[2] = Math.max(0, DG[2]! - dt);
    if (DG[3]! > 0) DG[3] = DG[3]! - dt;
    if (hypot(x - DG[0]!, z - DOG[2]!) < 5.5 && DG[3]! <= 0) (DG[2] = 0.6), (DG[3] = 1.6), (S[6] = S[6]! + 1), emit(E_BARK, 0);
    return any || Math.abs(dx) > 0.01 || DG[2]! > 0;
  }
  /** Where sprinkler i points now (radians, 0 is +x, anticlockwise from above). */
  function sprinklerAim(i: number) {
    const o = i * 4;
    return SPRINK[o + 2]! + 1.15 * Math.sin(S[11]! * 1.3 + SPRINK[o + 3]!);
  }
  // ---- the autopilot: round the ring, a wheelie down each straight, the front down for the corners ----
  function autopilot(I: Float64Array) {
    const b = bike.b, x = b.pos[0]!, z = b.pos[2]!;
    let leg = S[7]!;
    const tx = ROUTE[leg * 2]!, tz = ROUTE[leg * 2 + 1]!;
    let dist = hypot(tx - x, tz - z);
    if (dist < 2.6) (leg = S[7] = (leg + 1) % 4), (dist = hypot(ROUTE[leg * 2]! - x, ROUTE[leg * 2 + 1]! - z));
    const ax = ROUTE[leg * 2]!, az = ROUTE[leg * 2 + 1]!;
    let err = Math.atan2(-(az - z), ax - x) - b.yaw;
    err -= TAU * Math.floor(err / TAU + 0.5);
    const v = b.speed, th = bike.nose, up = th > 0.06, ahead = dist - v * AP[6]!;
    // In a wheelie the bike steers by leaning: aim early, and drop the front well before a corner.
    I[3] = Math.max(-1, Math.min(1, -err * (up ? 3.4 : 2.4)));
    I[4] = 0;
    const straight = Math.abs(err) < 0.3 && ahead > 3.5, goal = bike.balance - AP[0]!, om = b.S[3]!, e = goal - th;
    if (straight && v > 2.5) {
      // Hold it just under the balance point at a steady speed: a wanted nose rate from the angle off
      // it; the gas and the weight back give rate, the weight forward and the brake take it away; the
      // gas also holds the speed (past it the bike would run into its limiter and drop the front).
      const want = Math.max(-AP[3]!, Math.min(AP[3]!, e * AP[2]!)), er = want - om, vt = AP[7]!;
      I[0] = Math.max(0, Math.min(1, AP[1]! + er * AP[4]! + (vt - v) * AP[5]!));
      I[2] = Math.max(-1, Math.min(1, -er * AP[6]!));
      I[1] = er < -AP[8]! || v > vt + 2 ? Math.min(1, (-er - AP[8]!) * AP[9]! + (v > vt + 2 ? 0.3 : 0)) : 0;
      if (I[1]! < 0) I[1] = 0;
    } else if (up) {
      I[0] = 0; I[1] = 0.3; I[2] = 1;
    } else {
      I[0] = v < (ahead < 3.5 ? 4.2 : 6.5) ? 0.7 : 0;
      I[1] = v > 5 && ahead < 3.5 ? 0.6 : 0;
      I[2] = 0.3;
    }
  }
  reset(0);
  return {
    S, ev, bike, sc, NB, SPC, DG,
    get n() { return n; },
    clear() { n = 0; },
    step, reset, autopilot, sprinklerAim,
    /** Pick a ride (0..2) before the session starts. */
    choose(i: number) { reset(i); },
  };
}
export type CityRun = ReturnType<typeof cityRun>;
export { RIDES };
