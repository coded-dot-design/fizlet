// Moon Rover's run, headless (tests/moon-rover.test.mjs): a small moon from ./orb.ts, a rover on
// @fzlt/core/drive through the orb's chart, and the session: a relay of eight beacons on a seam
// round the whole moon (a lap), crystals, crates and rocks, friends on the light side (a wave and a
// beep, then a boost, crystals or a shield), chasers on the dark side that hunt the rover and burn
// up in the sun, the rover's bolts, three shields, a clock. Seeded and fixed-step: the same inputs
// give the same run, bit for bit (+ − × ÷ and square roots only; the drive model is the same).
// Zero allocation per step. Everything is in orb space (the moon's own frame); the scene turns it.
import { drive, type Drive } from "../../../../src/drive";
import { orb } from "./orb";

export const R = 30;
/** Phases. */
export const READY = 0, RUN = 1, DONE = 2;
/** Events: [type, value, x, y, z] (orb space). */
export const E_START = 1, E_CRYSTAL = 2, E_BEACON = 3, E_LAP = 4, E_FRIEND = 5, E_SHOT = 6, E_KILL = 7, E_HIT = 8, E_CRATE = 9, E_DARK = 10, E_JUMP = 11, E_CRASH = 12, E_RIGHT = 13, E_DOWN = 14, E_TIME = 15, E_BUMP = 16, E_SPAWN = 17, E_BURN = 18, E_LAND = 19;
/** Gifts a friend gives. */
export const G_BOOST = 0, G_CRYSTALS = 1, G_SHIELD = 2;
export const BEACONS = 8, CRYSTALS = 44, ROCKS = 40, CRATES = 16, FRIENDS = 6, BASES = 3, RAMPS = 7, SHIPS = 4, BOLTS = 10;
export const TIME = 150, SHIELDS = 3;
/** Inputs: gas, brake, steer (−1..1, + right), fire, boost, jump. */
export const IN_GAS = 0, IN_BRAKE = 1, IN_STEER = 2, IN_FIRE = 3, IN_BOOST = 4, IN_JUMP = 5;
// S: phase, clock left, score, crystals, beacon next, laps, shields, boost meter, hurt (invulnerable s),
// fire cooldown, jump cooldown, dark (0/1), spawn timer, crashed timer, kills, friends met, time run, best lap.
const PH = 0, CLK = 1, SCORE = 2, CRY = 3, NEXT = 4, LAPS = 5, SHD = 6, BOOST = 7, HURT = 8, FCD = 9, JCD = 10, DARK = 11, SPN = 12, DOWN = 13, KILLS = 14, MET = 15, RUN_T = 16;
export { PH, CLK, SCORE, CRY, NEXT, LAPS, SHD, BOOST, HURT, DARK, KILLS, MET, RUN_T };

/** The sun's direction (orb space): the light side is u · SUN > 0. */
export const SUN = (() => { const v = [0.82, 0.42, -0.39], l = Math.hypot(...v); return v.map((x) => x / l); })();

/** A seeded random on integers (identical everywhere). */
function lcg(seed: number) {
  const s = new Uint32Array([seed >>> 0 || 1]);
  return () => ((s[0] = Math.imul(s[0]!, 1664525) + 1013904223), s[0]! / 4294967296);
}
const norm = (v: number[]) => { const l = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!); return [v[0]! / l, v[1]! / l, v[2]! / l]; };
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

export function moonRun(seed = 20261123) {
  const o = orb({ radius: R, seed: 7, craters: 58, hills: 16, depth: 1.9 });
  const S = new Float64Array(20);
  // ---- the world (built once, seeded) ----
  const rnd = lcg(seed);
  const sun = SUN as number[], T1 = norm(cross(sun, [0, 1, 0])), T2 = cross(T1, sun);
  /** The seam: a closed curve round the moon through both sides and both hemispheres (θ in 0..2π). */
  const seam = (th: number) => norm([Math.cos(th) * sun[0]! + Math.sin(th) * T1[0]! + 0.62 * Math.sin(2 * th) * T2[0]!, Math.cos(th) * sun[1]! + Math.sin(th) * T1[1]! + 0.62 * Math.sin(2 * th) * T2[1]!, Math.cos(th) * sun[2]! + Math.sin(th) * T1[2]! + 0.62 * Math.sin(2 * th) * T2[2]!]);
  const TH0 = -0.62;
  // Beacons: unit directions on the seam; beacon 0 is the start and finish.
  const beacon = new Float64Array(BEACONS * 3);
  for (let k = 0; k < BEACONS; k++) beacon.set(seam(TH0 + (k / BEACONS) * Math.PI * 2), k * 3);
  // Placed things: unit dir (3) + radius; kept apart.
  const placed: number[][] = [];
  for (let k = 0; k < BEACONS; k++) placed.push([beacon[k * 3]!, beacon[k * 3 + 1]!, beacon[k * 3 + 2]!, 3.2]);
  const free = (u: number[], r: number) => placed.every((p) => { const d = Math.sqrt(Math.max(0, 2 - 2 * (u[0]! * p[0]! + u[1]! * p[1]! + u[2]! * p[2]!))) * R; return d > r + p[3]!; });
  const randDir = () => { for (;;) { const v = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], d = v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!; if (d > 0.01 && d < 1) return norm(v); } };
  /** A spot near the seam (θ, across offset in radians) or anywhere, kept `r` clear. */
  const spot = (r: number, near: number, test?: (u: number[]) => boolean) => {
    for (let k = 0; k < 400; k++) {
      let u: number[];
      if (rnd() < near) {
        const th = rnd() * Math.PI * 2, c = seam(th), c2 = seam(th + 0.01), f = norm([c2[0]! - c[0]!, c2[1]! - c[1]!, c2[2]! - c[2]!]), side = cross(f, c), a = (rnd() * 2 - 1) * 0.22;
        u = norm([c[0]! + side[0]! * a, c[1]! + side[1]! * a, c[2]! + side[2]! * a]);
      } else u = randDir();
      if (test && !test(u)) continue;
      if (free(u, r)) return placed.push([...u, r]), u;
    }
    const u = randDir();
    return placed.push([...u, r]), u;
  };
  const day = (u: number[]) => u[0]! * sun[0]! + u[1]! * sun[1]! + u[2]! * sun[2]!;
  // Start: just past beacon 0 along the seam, facing beacon 1.
  const start = (() => { const a = seam(TH0 + 0.02), b = seam(TH0 + 0.05), f = norm([b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]), s = cross(f, a); return norm([a[0]! + s[0]! * 0.13, a[1]! + s[1]! * 0.13, a[2]! + s[2]! * 0.13]); })();
  const startF = (() => { const a = seam(TH0 + 0.25); return norm([a[0]! - start[0]!, a[1]! - start[1]!, a[2]! - start[2]!]); })();
  placed.push([...start, 2.5]);
  // Bases (domes) on the light side, two friends at each; a ramp before some beacons.
  const base = new Float64Array(BASES * 3), friend = new Float64Array(FRIENDS * 3), ramp = new Float64Array(RAMPS * 6);
  for (let b = 0; b < BASES; b++) {
    const u = spot(3.6, 0.85, (v) => day(v) > 0.35);
    base.set(u, b * 3);
    for (let k = 0; k < 2; k++) {
      // Friends stand just off the dome, on the seam's side of it.
      const side = norm(cross(u, [0.3, 1, 0.1])), a = (k ? 1 : -1) * 0.1;
      const f = norm([u[0]! + side[0]! * a + (rnd() - 0.5) * 0.04, u[1]! + side[1]! * a + (rnd() - 0.5) * 0.04, u[2]! + side[2]! * a + (rnd() - 0.5) * 0.04]);
      friend.set(f, (b * 2 + k) * 3);
    }
  }
  for (let k = 0; k < RAMPS; k++) {
    const th = TH0 + ((k + 0.55) / RAMPS) * Math.PI * 2 + (rnd() - 0.5) * 0.12, c = seam(th), c2 = seam(th + 0.01), f = norm([c2[0]! - c[0]!, c2[1]! - c[1]!, c2[2]! - c[2]!]);
    const side = cross(f, c), a = (rnd() - 0.5) * 0.06, u = norm([c[0]! + side[0]! * a, c[1]! + side[1]! * a, c[2]! + side[2]! * a]);
    if (!free(u, 2.4)) continue;
    placed.push([...u, 2.4]);
    ramp.set([...u, ...f], k * 6);
    o.ramp(u, f, 3.6, 2.4, 0.95);
  }
  const crystal = new Float64Array(CRYSTALS * 3), rock = new Float64Array(ROCKS * 4), crate = new Float64Array(CRATES * 3);
  for (let i = 0; i < CRYSTALS; i++) crystal.set(spot(1.2, 0.72), i * 3);
  for (let i = 0; i < CRATES; i++) crate.set(spot(1.3, 0.8), i * 3);
  for (let i = 0; i < ROCKS; i++) { const r = 0.45 + rnd() * rnd() * 1.3; rock.set([...spot(r + 1.6, 0.3), r], i * 4); }
  // Lift each to the surface: radius = R + height (the ramps are in now).

  // ---- live state ----
  const got = new Uint8Array(CRYSTALS), smashed = new Uint8Array(CRATES), lit = new Uint8Array(BEACONS);
  const fCool = new Float64Array(FRIENDS), fReact = new Float64Array(FRIENDS), fGift = new Uint8Array(FRIENDS);
  // Ships: alive, unit dir (3), velocity (3, tangent, units/s), age, fleeing; bolts: life, dir (3), tangent (3).
  const SH = new Float64Array(SHIPS * 9), BO = new Float64Array(BOLTS * 7);
  const ev = new Float64Array(64 * 5);
  let n = 0;
  const G = o.chart();
  const car: Drive = drive(G, {
    wheels: [0.72, -0.56, 0.72, 0.56, -0.72, -0.56, -0.72, 0.56], radius: 0.32, rest: 0.34, travel: 0.4, stiffness: 60, progressive: 1, damping: 0.5, rebound: 0.8, inertia: 1.4,
    gravity: 14, accel: 9, top: 13, grip: 0.95, steer: 0.55, steerFall: 14, cg: 0.32, crashPitch: 1.25, crashRoll: 1.2, crashDrop: 40, airPitch: 1.6,
  });
  const P = new Float64Array(3), U = new Float64Array(3), Fw = new Float64Array(3), X3 = new Float64Array(4);
  const rng = new Uint32Array(1);
  const rand = () => ((rng[0] = Math.imul(rng[0]!, 1664525) + 1013904223), rng[0]! / 4294967296);

  /** An event at A[i..i+2] × scale (its point, orb space). Doubles travel in arrays: a double passed
   *  to a call the JIT does not inline is boxed. */
  function emitA(type: number, val: number, A: Float64Array, i: number, scale: number) {
    if (n >= 64) return;
    const k = n++ * 5;
    ev[k] = type; ev[k + 1] = val; ev[k + 2] = A[i]! * scale; ev[k + 3] = A[i + 1]! * scale; ev[k + 4] = A[i + 2]! * scale;
  }
  function reset() {
    S.fill(0);
    S[CLK] = TIME; S[SHD] = SHIELDS; S[BOOST] = 1; S[NEXT] = 1; S[SPN] = 1;
    got.fill(0); smashed.fill(0); lit.fill(0); fCool.fill(0); fReact.fill(0); SH.fill(0); BO.fill(0);
    lit[0] = 1;
    for (let i = 0; i < FRIENDS; i++) fGift[i] = i % 3;
    rng[0] = seed;
    n = 0;
    G.at(start, startF);
    car.reset(0, 0, 0);
    where();
  }
  /** P: the rover's orb point (body), U: its up (the chart's), Fw: its heading (orb space). */
  function where() {
    const F = G.F, cy = car._s[20]!, sy = car._s[21]!, x = car.pos[0]!, y = R + car.pos[1]!, z = car.pos[2]!;
    P[0] = y * F[3]! + x * F[0]! + z * F[6]!; P[1] = y * F[4]! + x * F[1]! + z * F[7]!; P[2] = y * F[5]! + x * F[2]! + z * F[8]!;
    U[0] = F[3]!; U[1] = F[4]!; U[2] = F[5]!;
    Fw[0] = cy * F[0]! - sy * F[6]!; Fw[1] = cy * F[1]! - sy * F[7]!; Fw[2] = cy * F[2]! - sy * F[8]!;
  }
  const HQ = o.HQ;
  /** The rover's point within `lim` units of the surface point over unit dir A[i..i+2]. */
  function near(A: Float64Array, i: number, lim: number) {
    const x = A[i]!, y = A[i + 1]!, z = A[i + 2]!;
    HQ[0] = x; HQ[1] = y; HQ[2] = z;
    o.hq();
    const r = R + HQ[3]!, dx = x * r - P[0]!, dy = y * r - P[1]!, dz = z * r - P[2]!;
    return dx * dx + dy * dy + dz * dz < lim * lim;
  }
  /** Push the rover out of a round obstacle over unit dir A[i..i+2] (kind 0: a rock, its radius at
   *  A[i + 3]; 1: a dome; 2: a beacon's mast), in the chart. */
  function push(A: Float64Array, i: number, kind: number) {
    const x = A[i]!, y = A[i + 1]!, z = A[i + 2]!, r = kind === 0 ? A[i + 3]! * 0.85 : kind === 1 ? 1.6 : 0.3;
    const F = G.F, gx = x * R - R * F[3]!, gy = y * R - R * F[4]!, gz = z * R - R * F[5]!;
    const cx = gx * F[0]! + gy * F[1]! + gz * F[2]! - car.pos[0]!, cz = gx * F[6]! + gy * F[7]! + gz * F[8]! - car.pos[2]!, d = Math.sqrt(cx * cx + cz * cz), m = r + 0.85;
    if (d >= m || d < 1e-6) return false;
    const nx = cx / d, nz = cz / d, v = car.vel, vn = v[0]! * nx + v[2]! * nz;
    car.pos[0] = car.pos[0]! - nx * (m - d);
    car.pos[2] = car.pos[2]! - nz * (m - d);
    if (vn > 0) (v[0] = v[0]! - nx * vn * 1.4), (v[2] = v[2]! - nz * vn * 1.4);
    return vn > 3;
  }
  /** Move unit u (at o) along tangent t (at o + 3) by angle a; keeps both unit and square. */
  function arc(A: Float64Array, i: number) {
    const a = X3[3]!;
    let ux = A[i]! + A[i + 3]! * a, uy = A[i + 1]! + A[i + 4]! * a, uz = A[i + 2]! + A[i + 5]! * a;
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= ul; uy /= ul; uz /= ul;
    let tx = A[i + 3]! - A[i]! * a, ty = A[i + 4]! - A[i + 1]! * a, tz = A[i + 5]! - A[i + 2]! * a;
    const d = tx * ux + ty * uy + tz * uz;
    tx -= d * ux; ty -= d * uy; tz -= d * uz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    A[i] = ux; A[i + 1] = uy; A[i + 2] = uz; A[i + 3] = tx / tl; A[i + 4] = ty / tl; A[i + 5] = tz / tl;
  }

  function step(dt: number, I: ArrayLike<number>) {
    const ph = S[PH]!;
    if (ph === DONE) return false;
    const any = I[IN_GAS]! > 0 || I[IN_BRAKE]! > 0 || I[IN_STEER] !== 0 || I[IN_FIRE]! > 0 || I[IN_BOOST]! > 0 || I[IN_JUMP]! > 0;
    if (ph === READY) {
      if (!any) return false;
      S[PH] = RUN;
      emitA(E_START, 0, P, 0, 1);
    }
    S[RUN_T] = S[RUN_T]! + dt;
    S[CLK] = Math.max(0, S[CLK]! - dt);
    // ---- the rover ----
    const crashed = car.crashed;
    if (crashed) {
      S[DOWN] = S[DOWN]! + dt;
      if (S[DOWN]! > 1.1) {
        S[DOWN] = 0;
        car.reset(0, 0, car.yaw);
        S[HURT] = Math.max(S[HURT]!, 1);
        emitA(E_RIGHT, 0, P, 0, 1);
      }
    }
    car.set(I[IN_GAS]!, I[IN_BRAKE]!, I[IN_STEER]!, 0);
    const air0 = car.air;
    car.step(dt);
    if (!crashed && car.crashed) emitA(E_CRASH, 0, P, 0, 1);
    if (air0 > 0.25 && car.air === 0 && !car.crashed) emitA(E_LAND, Math.round(air0 * 100), P, 0, 1);
    // Boost: a push along the heading while held and the meter lasts; it refills slowly.
    const cy = car._s[20]!, sy = car._s[21]!, onGround = car.air === 0 && !car.crashed;
    if (I[IN_BOOST]! > 0 && S[BOOST]! > 0.02 && onGround) {
      S[BOOST] = Math.max(0, S[BOOST]! - dt * 0.42);
      if (car.speed < 19) (car.vel[0] = car.vel[0]! + cy * 16 * dt), (car.vel[2] = car.vel[2]! - sy * 16 * dt);
    } else S[BOOST] = Math.min(1, S[BOOST]! + dt * 0.11);
    S[JCD] = Math.max(0, S[JCD]! - dt);
    if (I[IN_JUMP]! > 0 && onGround && S[JCD] === 0) (car.vel[1] = car.vel[1]! + 7.2), (S[JCD] = 0.7), emitA(E_JUMP, 0, P, 0, 1);
    // Rocks and domes push back; crates smash.
    where();
    for (let i = 0; i < ROCKS; i++) if (near(rock, i * 4, 5) && push(rock, i * 4, 0)) emitA(E_BUMP, i, P, 0, 1);
    for (let b = 0; b < BASES; b++) if (near(base, b * 3, 5)) push(base, b * 3, 1);
    for (let k = 0; k < BEACONS; k++) if (near(beacon, k * 3, 2)) push(beacon, k * 3, 2);
    G.recentre(car);
    where();
    for (let i = 0; i < CRATES; i++) {
      if (smashed[i] || !near(crate, i * 3, 1.45)) continue;
      smashed[i] = 1;
      car.vel[0] = car.vel[0]! * 0.75; car.vel[2] = car.vel[2]! * 0.75;
      S[SCORE] = S[SCORE]! + 25;
      emitA(E_CRATE, i, crate, i * 3, R);
    }
    // ---- crystals, beacons, friends ----
    for (let i = 0; i < CRYSTALS; i++) {
      if (got[i] || !near(crystal, i * 3, 1.7)) continue;
      got[i] = 1;
      S[CRY] = S[CRY]! + 1;
      S[SCORE] = S[SCORE]! + 50;
      emitA(E_CRYSTAL, i, crystal, i * 3, R);
    }
    const nx = S[NEXT]!;
    if (near(beacon, nx * 3, 4.2)) {
      lit[nx] = 1;
      if (nx === 0) {
        S[LAPS] = S[LAPS]! + 1;
        S[SCORE] = S[SCORE]! + 1500;
        lit.fill(0);
        lit[0] = 1;
        emitA(E_LAP, S[LAPS]!, beacon, 0, R);
      } else {
        S[SCORE] = S[SCORE]! + 200;
        emitA(E_BEACON, nx, beacon, nx * 3, R);
      }
      S[NEXT] = (nx + 1) % BEACONS;
    }
    for (let i = 0; i < FRIENDS; i++) {
      fCool[i] = Math.max(0, fCool[i]! - dt);
      fReact[i] = Math.max(0, fReact[i]! - dt);
      if (fCool[i]! > 0 || !near(friend, i * 3, 3.4)) continue;
      const g = fGift[i]!;
      fCool[i] = 22; fReact[i] = 2.4; fGift[i] = (g + 1) % 3;
      S[MET] = S[MET]! + 1;
      if (g === G_BOOST) (S[BOOST] = 1), (car.vel[0] = car.vel[0]! + cy * 5), (car.vel[2] = car.vel[2]! - sy * 5), (S[SCORE] = S[SCORE]! + 50);
      else if (g === G_CRYSTALS) (S[CRY] = S[CRY]! + 3), (S[SCORE] = S[SCORE]! + 150);
      else if (S[SHD]! < SHIELDS) S[SHD] = S[SHD]! + 1;
      else S[SCORE] = S[SCORE]! + 100;
      emitA(E_FRIEND, i * 4 + g, friend, i * 3, R);
    }
    // ---- light and dark ----
    const pl = Math.sqrt(P[0]! * P[0]! + P[1]! * P[1]! + P[2]! * P[2]!), lightK = (P[0]! * sun[0]! + P[1]! * sun[1]! + P[2]! * sun[2]!) / pl;
    const dark = S[DARK]! ? lightK < 0.04 : lightK < -0.04;
    if (dark !== !!S[DARK]) (S[DARK] = dark ? 1 : 0), emitA(E_DARK, dark ? 1 : 0, P, 0, 1);
    // ---- bolts ----
    S[FCD] = Math.max(0, S[FCD]! - dt);
    if (I[IN_FIRE]! > 0 && S[FCD] === 0 && !car.crashed) {
      S[FCD] = 0.2;
      for (let b = 0; b < BOLTS; b++) {
        const k = b * 7;
        if (BO[k]! > 0) continue;
        BO[k] = 0.75;
        const px = P[0]! + Fw[0]! * 1.1, py = P[1]! + Fw[1]! * 1.1, pz = P[2]! + Fw[2]! * 1.1, l = Math.sqrt(px * px + py * py + pz * pz);
        BO[k + 1] = px / l; BO[k + 2] = py / l; BO[k + 3] = pz / l; BO[k + 4] = Fw[0]!; BO[k + 5] = Fw[1]!; BO[k + 6] = Fw[2]!;
        (X3[0] = px), (X3[1] = py), (X3[2] = pz), emitA(E_SHOT, b, X3, 0, 1);
        break;
      }
    }
    const boltSp = 32 + Math.max(0, car.speed);
    for (let b = 0; b < BOLTS; b++) {
      const k = b * 7;
      if (BO[k]! <= 0) continue;
      BO[k] = BO[k]! - dt;
      X3[3] = (boltSp * dt) / R;
      arc(BO, k + 1);
      const bx = BO[k + 1]!, by = BO[k + 2]!, bz = BO[k + 3]!;
      HQ[0] = bx; HQ[1] = by; HQ[2] = bz; o.hq();
      const br = R + HQ[3]! + 0.75;
      for (let s = 0; s < SHIPS; s++) {
        const q = s * 9;
        if (!SH[q] || SH[q + 8]! > 0) continue;
        HQ[0] = SH[q + 1]!; HQ[1] = SH[q + 2]!; HQ[2] = SH[q + 3]!; o.hq();
        const sr = R + HQ[3]! + 1.5, dx = bx * br - SH[q + 1]! * sr, dy = by * br - SH[q + 2]! * sr, dz = bz * br - SH[q + 3]! * sr;
        if (dx * dx + dy * dy + dz * dz > 1.7 * 1.7) continue;
        SH[q] = 0; BO[k] = 0;
        S[KILLS] = S[KILLS]! + 1;
        S[SCORE] = S[SCORE]! + 100;
        (X3[0] = SH[q + 1]! * sr), (X3[1] = SH[q + 2]! * sr), (X3[2] = SH[q + 3]! * sr), emitA(E_KILL, s, X3, 0, 1);
        break;
      }
      if (BO[k]! <= 0) continue;
      for (let i = 0; i < CRATES; i++) {
        if (smashed[i]) continue;
        const dx = bx - crate[i * 3]!, dy = by - crate[i * 3 + 1]!, dz = bz - crate[i * 3 + 2]!;
        if ((dx * dx + dy * dy + dz * dz) * R * R > 1.0) continue;
        smashed[i] = 1; BO[k] = 0;
        S[SCORE] = S[SCORE]! + 25;
        emitA(E_CRATE, i, crate, i * 3, R);
        break;
      }
    }
    // ---- chasers: they come for the rover in the dark and burn up in the sun ----
    S[HURT] = Math.max(0, S[HURT]! - dt);
    let alive = 0;
    for (let s = 0; s < SHIPS; s++) alive += SH[s * 9]! ? 1 : 0;
    if (S[DARK]) {
      S[SPN] = S[SPN]! - dt;
      const want = (lightK < -0.45 ? 3 : 2) + (S[LAPS]! > 0 ? 1 : 0);
      if (S[SPN]! <= 0 && alive < want) {
        S[SPN] = 3;
        for (let s = 0; s < SHIPS; s++) {
          const q = s * 9;
          if (SH[q]) continue;
          // From over the horizon: ahead and to one side, deeper in the dark.
          const a = rand() * 2 - 1, sx = Fw[0]! + a * (U[1]! * Fw[2]! - U[2]! * Fw[1]!), sy2 = Fw[1]! + a * (U[2]! * Fw[0]! - U[0]! * Fw[2]!), sz = Fw[2]! + a * (U[0]! * Fw[1]! - U[1]! * Fw[0]!);
          let ux = U[0]! + sx * 0.62 - sun[0]! * 0.25, uy = U[1]! + sy2 * 0.62 - sun[1]! * 0.25, uz = U[2]! + sz * 0.62 - sun[2]! * 0.25;
          const l = Math.sqrt(ux * ux + uy * uy + uz * uz);
          ux /= l; uy /= l; uz /= l;
          SH[q] = 1; SH[q + 1] = ux; SH[q + 2] = uy; SH[q + 3] = uz; SH[q + 4] = SH[q + 5] = SH[q + 6] = 0; SH[q + 7] = 0; SH[q + 8] = 0;
          emitA(E_SPAWN, s, SH, q + 1, R);
          break;
        }
      }
    } else S[SPN] = Math.min(S[SPN]!, 0.6);
    for (let s = 0; s < SHIPS; s++) {
      const q = s * 9;
      if (!SH[q]) continue;
      SH[q + 7] = SH[q + 7]! + dt;
      const ux = SH[q + 1]!, uy = SH[q + 2]!, uz = SH[q + 3]!, sl = ux * sun[0]! + uy * sun[1]! + uz * sun[2]!;
      // Toward the rover (a lead on its heading), or away from it once in the sun.
      const lead = 0.4 + s * 0.15, tx0 = P[0]! / pl + Fw[0]! * lead * 0.05 * car.speed / 12, ty0 = P[1]! / pl + Fw[1]! * lead * 0.05 * car.speed / 12, tz0 = P[2]! / pl + Fw[2]! * lead * 0.05 * car.speed / 12;
      let gx = tx0 - ux, gy = ty0 - uy, gz = tz0 - uz;
      const d = gx * ux + gy * uy + gz * uz;
      gx -= d * ux; gy -= d * uy; gz -= d * uz;
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, flee = sl > 0.06 || SH[q + 8]! > 0;
      const sp = flee ? -6 : 9.4 + s * 0.4 + S[LAPS]! * 0.8;
      const k = Math.min(1, 2.4 * dt);
      SH[q + 4] = SH[q + 4]! + ((gx / gl) * sp - SH[q + 4]!) * k;
      SH[q + 5] = SH[q + 5]! + ((gy / gl) * sp - SH[q + 5]!) * k;
      SH[q + 6] = SH[q + 6]! + ((gz / gl) * sp - SH[q + 6]!) * k;
      let vx = SH[q + 4]!, vy = SH[q + 5]!, vz = SH[q + 6]!;
      let nx2 = ux + (vx * dt) / R, ny2 = uy + (vy * dt) / R, nz2 = uz + (vz * dt) / R;
      const nl = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2);
      nx2 /= nl; ny2 /= nl; nz2 /= nl;
      const vd = vx * nx2 + vy * ny2 + vz * nz2;
      vx -= vd * nx2; vy -= vd * ny2; vz -= vd * nz2;
      SH[q + 1] = nx2; SH[q + 2] = ny2; SH[q + 3] = nz2; SH[q + 4] = vx; SH[q + 5] = vy; SH[q + 6] = vz;
      if (flee) {
        SH[q + 8] = SH[q + 8]! + dt;
        if (SH[q + 8]! > 1.4) (SH[q] = 0), emitA(E_BURN, s, SH, q + 1, R);
        continue;
      }
      // Rammed: the rover loses a shield and spins; the ship is spent.
      HQ[0] = nx2; HQ[1] = ny2; HQ[2] = nz2; o.hq();
      const sr = R + HQ[3]! + 1.5, dx = nx2 * sr - P[0]!, dy = ny2 * sr - P[1]!, dz = nz2 * sr - P[2]!;
      if (dx * dx + dy * dy + dz * dz < 1.75 * 1.75 && S[HURT] === 0 && S[PH] === RUN) {
        SH[q] = 0;
        S[HURT] = 1.6;
        S[SHD] = S[SHD]! - 1;
        car.spinOut(rand() < 0.5 ? 5 : -5, 0.55);
        (X3[0] = nx2 * sr), (X3[1] = ny2 * sr), (X3[2] = nz2 * sr), emitA(E_HIT, S[SHD]!, X3, 0, 1);
      }
    }
    if (S[SHD]! <= 0 && S[PH] === RUN) (S[PH] = DONE), emitA(E_DOWN, 0, P, 0, 1);
    else if (S[CLK] === 0 && S[PH] === RUN) (S[PH] = DONE), emitA(E_TIME, 0, P, 0, 1);
    return true;
  }

  /** Drive by itself: to the next beacon, firing at any chaser ahead (the poster, the tests). */
  function autopilot(I: Float64Array) {
    const F = G.F, nx = S[NEXT]!, bx = beacon[nx * 3]!, by = beacon[nx * 3 + 1]!, bz = beacon[nx * 3 + 2]!;
    const tx = bx - F[3]!, ty = by - F[4]!, tz = bz - F[5]!, a = tx * F[0]! + ty * F[1]! + tz * F[2]!, b = tx * F[6]! + ty * F[7]! + tz * F[8]!;
    const cy = car._s[20]!, sy = car._s[21]!, fx = cy, fz = -sy, l = Math.sqrt(a * a + b * b) || 1, dx = a / l, dz = b / l;
    // + is a right turn: the target to the right of the heading (forward × up ... in the chart: z of forward rotated).
    const crossv = fx * dz - fz * dx, dot = fx * dx + fz * dz;
    I.fill(0);
    I[IN_STEER] = Math.max(-1, Math.min(1, (dot < 0 ? (crossv < 0 ? -1 : 1) : crossv * 2.4)));
    I[IN_GAS] = dot > 0.2 || car.speed < 3 ? 1 : 0;
    I[IN_BRAKE] = dot < -0.3 && car.speed > 6 ? 1 : 0;
    for (let s = 0; s < SHIPS; s++) {
      const q = s * 9;
      if (!SH[q]) continue;
      const vx = SH[q + 1]! * R - P[0]!, vy = SH[q + 2]! * R - P[1]!, vz = SH[q + 3]! * R - P[2]!, vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (vl < 24 && (vx * Fw[0]! + vy * Fw[1]! + vz * Fw[2]!) / vl > 0.55) I[IN_FIRE] = 1;
    }
  }
  function clear() { n = 0; }
  reset();
  return {
    orb: o, car, chart: G, S, ev, get n() { return n; }, clear, reset, step, autopilot,
    /** Read the rover's point, up and heading again (after moving it by hand). */
    sync: where,
    beacon, crystal, rock, crate, base, friend, ramp, got, smashed, lit, fReact, fGift, SH, BO, P, U, Fw, start,
    /** 0..1 lit side of unit dir u (> 0: day). */
    day: (x: number, y: number, z: number) => x * sun[0]! + y * sun[1]! + z * sun[2]!,
    seam,
  };
}
export type MoonRun = ReturnType<typeof moonRun>;
