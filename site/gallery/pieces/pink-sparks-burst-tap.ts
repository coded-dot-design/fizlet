// "Pink sparks burst where you tap": Sparky, a little welding robot, at its bench after hours. Tap
// the steel plate and Sparky rolls over, drops its mask and strikes an arc right there: hot pink
// sparks with real spark physics (a white-hot head cooling through pink to dark as it falls, bounces
// off the bench and the floor, now and then bursts in two), the arc lighting the workshop, a molten
// bead that cools to steel, scorch marks that glow and fade, a curl of smoke. Then the mask comes up
// and Sparky looks pleased with itself. It welds once by itself on load; every tap welds again.
// Bricks: the kernel (fixed step, settle: no frames once still; the ledger: Recall gives the page
// back) and fzlt/slot. The scene is palette indices in one small buffer (./pixel-stage.ts).
import { createEngine } from "../../../src/kernel/index";
import type { SlotTap } from "../../../src/slot";
import { art, at, blit, dot, fill, line, pixelCanvas, pixels, type Pixels } from "./pixel-stage";

/** The art, in art pixels: 128 × 72 (16:9), scaled crisp to the card. */
export const GW = 128, GH = 72;
// Palette (Fizlet brand tokens): rim, line, base, cmd, muted, ink, attack, aim, sys, go, hurt.
export const PALETTE = ["#07060f", "#3b3170", "#3f296a", "#9a63ff", "#aea4d6", "#f6f3ff", "#ff2e88", "#ff7389", "#19f0ff", "#39ffb0", "#ffc21a"] as const;
const K = 0, L = 1, B = 2, V = 3, M = 4, I = 5, P = 6, A = 7, C = 8, G = 9, Y = 10;
const MAP = { k: K, l: L, b: B, v: V, m: M, i: I, p: P, a: A, c: C, g: G, y: Y };
/** What each colour turns into in the arc's light: right at it, and on the steel around it. */
const LIT = Uint8Array.from([L, V, V, A, I, I, A, I, I, I, I]), GLOW = Uint8Array.from([K, L, B, V, I, I, P, A, C, G, Y]);

// The room. Floor (row 60 down), the bench top (row 46, x 40–126), the plate on it.
const FLOOR = 60, TOP = 46, BX0 = 40, BX1 = 126, PX0 = 72, PX1 = 116, PY0 = 22;
// Where a weld can land: inside the plate.
const TX0 = 75, TX1 = 113, TY0 = 25, TY1 = 43;
const ARC = 0.8, CAP = 480, BEADS = 24, PUFFS = 20;
// Sparky's arm: two segments of ARM px; at rest it hangs straight, forward and down, torch low.
const ARM = 10, REST_X = 23, REST_Y = 9;
/** The chance one hot spark landing on the fuse lights it (each spark gets one try). */
const FUSE_ODDS = 0.03;

// Sparky: antenna, head (mask up: eyes look; happy; mask down: slit, slit in the arc), body, treads.
const ANT = art(["kkk", "kgk", "kkk", ".m.", ".m."], MAP);
const frame = (r5: string, r6: string, r7 = "kmkkkkkkkkmk") =>
  art(["kkkkkkkkkkkk", "kllllllllllk", "kkkkkkkkkkkk", "kmmmmmmmmmmk", "kmkkkkkkkkmk", r5, r6, r7, "kmmmmmmmmmmk", "kkkkkkkkkkkk"], MAP);
const mask = (s: string) => art(["", "", "kkkkkkkkkkkk", "kllllllllllk", "kllllllllllk", "klkkkkkkkklk", `kl${s.repeat(8)}lk`, "kllllllllllk", "kllllllllllk", "kkkkkkkkkkkk"], MAP);
const HEAD = [frame("kmkkkckkckmk", "kmkkkckkckmk"), frame("kmkkckkkckmk", "kmkckckckcmk", "kmkkkccckkmk"), mask("c"), mask("i"), frame("kmkcckkcckmk", "kmkcckkcckmk", "kmkkkcckkkmk")];
// The rocket: a pink firework in a tin on the bench, its fuse trailing to the bench top.
const ROCKET = art([".a.", "aaa", "ppp", "iii", "ppp", "ppp", "iii", "ppp", "ppp", "ppp", "lml"], MAP);
const RX0 = 119, RY0 = 30; // the rocket's top left, standing in its tin
/** The fuse, from its tip on the bench up to the rocket. */
const FUSE = [[125, 45], [125, 44], [125, 43], [124, 42], [123, 41]] as const;
const BODY = art([".....kmmk.....", "kkkkkkkkkkkkkk", "kmvvvvvvvvvvbk", "kvkkkkkkkkvvbk", "kvkgkykpkkvvbk", "kvkkkkkkkkvvbk", "kvvvvvvvvvvvbk", "kvvvvvvvvvvvbk", "kbbbbbbbbbbbbk", "kkkkkkkkkkkkkk"], MAP);
const TREADS = ["llmllmllmllmll", "lmllmllmllmllm", "mllmllmllmllml"].map((t) =>
  art([".kkkkkkkkkkkkkk.", `k${t}k`, "klkkkkkkkkkkkklk", "klkmkkkmkkkmkklk", `k${t}k`, ".kkkkkkkkkkkkkk."], MAP));

/** The still room (wall, window, pegboard, shelf, lamp, bench, plate, floor), drawn once. */
function room(p: Pixels) {
  fill(p, 0, 0, GW, GH, K);
  // Window: a night sky, a crescent moon, two stars, the frame and sill.
  fill(p, 6, 5, 19, 16, L);
  fill(p, 7, 6, 17, 14, B);
  fill(p, 15, 6, 1, 14, L);
  fill(p, 7, 12, 17, 1, L);
  fill(p, 18, 7, 3, 3, I);
  fill(p, 19, 7, 2, 2, B);
  dot(p, 9, 8, M), dot(p, 12, 15, I), dot(p, 21, 16, M);
  fill(p, 5, 21, 21, 1, M);
  // Pegboard with its tools: a wrench, a pink-handled hammer, a cyan screwdriver, pliers.
  fill(p, 30, 7, 34, 29, L);
  fill(p, 31, 8, 32, 27, B);
  for (let y = 10; y < 34; y += 4) for (let x = 33; x < 62; x += 4) dot(p, x, y, K);
  for (let i = 0; i < 14; i++) fill(p, 35 + (i >> 1), 12 + i, 2, 1, M);
  fill(p, 34, 10, 4, 2, M), dot(p, 35, 10, B), fill(p, 41, 25, 4, 2, M), dot(p, 43, 26, B);
  fill(p, 47, 11, 7, 3, M), fill(p, 47, 13, 7, 1, L), fill(p, 49, 14, 2, 12, P), fill(p, 49, 25, 2, 1, K);
  fill(p, 57, 11, 2, 6, C), fill(p, 57, 16, 2, 1, L), fill(p, 57.5, 17, 1, 9, M);
  line(p, 39, 30, 44, 22, M), line(p, 40, 30, 45, 22, M), fill(p, 39, 30, 6, 2, V);
  // The shelf: a pink soda can (the Fizz can's cousin), a cyan can, a jar of bolts.
  fill(p, 86, 12, 31, 1, M);
  fill(p, 86, 13, 31, 1, L);
  fill(p, 89, 14, 2, 8, L), fill(p, 112, 14, 2, 8, L);
  fill(p, 91, 4, 6, 8, P), fill(p, 91, 4, 6, 1, M), fill(p, 91, 7, 6, 2, C), fill(p, 96, 5, 1, 7, A);
  fill(p, 100, 6, 5, 6, C), fill(p, 100, 6, 5, 1, I), fill(p, 100, 9, 5, 1, L);
  fill(p, 108, 7, 7, 5, V), fill(p, 108, 6, 7, 1, M), dot(p, 110, 9, M), dot(p, 112, 10, M), dot(p, 111, 8, I);
  // The lamp: a cord, a shade, a warm bulb (off: the arc is the light here).
  fill(p, 70, 0, 1, 5, L);
  fill(p, 68, 5, 5, 1, M);
  fill(p, 67, 6, 7, 2, L);
  fill(p, 69, 8, 3, 1, Y);
  // Baseboard and floor (planks).
  fill(p, 0, 58, GW, 2, L);
  fill(p, 0, FLOOR, GW, GH - FLOOR, B);
  for (let x = 0; x < GW; x += 2) dot(p, x, FLOOR, L);
  for (let y = 64; y < GH; y += 4) for (let x = ((y >> 2) & 1) * 9; x < GW; x += 18) fill(p, x, y, 12, 1, L);
  // The bench: top, legs, a brace, a pink toolbox under it.
  fill(p, BX0, TOP, BX1 - BX0, 1, M);
  fill(p, BX0, TOP + 1, BX1 - BX0, 2, L);
  fill(p, BX0, TOP + 3, BX1 - BX0, 1, K);
  fill(p, 44, 49, 3, 11, L), fill(p, 119, 49, 3, 11, L);
  fill(p, 47, 54, 72, 1, L);
  fill(p, 96, 54, 14, 6, P), fill(p, 96, 54, 14, 1, A), fill(p, 101, 52, 4, 1, M), fill(p, 101, 53, 1, 1, M), fill(p, 104, 53, 1, 1, M), fill(p, 96, 57, 14, 1, K);
  // The plate: steel, a highlight along the top, bolts, two pink clamps.
  fill(p, PX0 - 1, PY0 - 1, PX1 - PX0 + 2, TOP - PY0 + 1, K);
  fill(p, PX0, PY0, PX1 - PX0, TOP - PY0, M);
  fill(p, PX0, PY0, PX1 - PX0, 1, I);
  fill(p, PX1 - 1, PY0 + 1, 1, TOP - PY0 - 1, L);
  for (const [x, y] of [[74, 24], [113, 24], [74, 43], [113, 43]]) dot(p, x!, y!, L);
  for (const x of [78, 106]) fill(p, x - 1, 42, 6, 5, K), fill(p, x, 43, 4, 3, P), fill(p, x, 43, 4, 1, A);
  // The rocket's tin.
  fill(p, 117, 40, 9, 6, K), fill(p, 118, 41, 7, 5, L), fill(p, 118, 41, 7, 1, M), fill(p, 120, 43, 3, 1, B);
}

/** The scene's state and story, without the DOM: the live mount and the poster both run it. */
export function welder(p: Pixels, seed: number) {
  const bg = new Uint8Array(GW * GH), px = p.px;
  room(p);
  bg.set(px);
  const rs = new Uint32Array([seed >>> 0 || 1]);
  const rnd = () => ((rs[0] = Math.imul(rs[0]!, 1664525) + 1013904223), rs[0]! / 4294967296);
  // State, one typed array (nothing boxes in the step).
  const s = new Float64Array(32);
  const TX = 0, TY = 1, RX = 2, GOAL = 3, ODO = 4, AX = 5, AY = 6, PH = 7, PT = 8, QX = 9, QY = 10, Q = 11, WAIT = 12, HAPPY = 13, CARRY = 14, LIT_R = 15, PUFF = 16, NB = 17, MASK = 18, VEL = 19, BOB = 20, JIT = 21, LEAN = 22, RK = 23, RT = 24, RY = 25, RV = 26, RXX = 27, FLASH = 28;
  // The rocket: RK 0 ready, 1 fuse lit (RT since), 2 flying (RY, RV, RXX), 3 spent (RT since the burst).
  s[RX] = s[GOAL] = 14;
  s[AX] = 14 + 15 + REST_X;
  s[AY] = 47 + REST_Y;
  s[WAIT] = -1;
  // Sparks: position, velocity, age, life; landed: how many times it has bounced.
  const X = new Float32Array(CAP), Yp = new Float32Array(CAP), VX = new Float32Array(CAP), VY = new Float32Array(CAP), AGE = new Float32Array(CAP), LIFE = new Float32Array(CAP), HIT = new Uint8Array(CAP);
  // A spark's own colour (0: the weld's pink, cooling; else a firework colour), and its gravity share.
  const COL = new Uint8Array(CAP), GR = new Float32Array(CAP), TRY = new Uint8Array(CAP);
  const n = new Uint32Array(2); // live sparks, live puffs
  // Beads (molten, then steel), scorch on the bench and the floor (age per column; < 0: none), smoke.
  const BXs = new Float32Array(BEADS), BYs = new Float32Array(BEADS), BAGE = new Float32Array(BEADS).fill(99);
  const SB = new Float32Array(GW).fill(99), SF = new Float32Array(GW).fill(99);
  const SX = new Float32Array(PUFFS), SY = new Float32Array(PUFFS), SVX = new Float32Array(PUFFS), SAGE = new Float32Array(PUFFS), SLIFE = new Float32Array(PUFFS);

  function spark(x: number, y: number, vx: number, vy: number, life: number, age: number, c = 0, g = 1) {
    const i = n[0]!;
    if (i >= CAP) return;
    n[0] = i + 1;
    X[i] = x, Yp[i] = y, VX[i] = vx, VY[i] = vy, LIFE[i] = life, AGE[i] = age, HIT[i] = 0, COL[i] = c, GR[i] = g, TRY[i] = 0;
  }
  /** Smoke (rises) or, with `dust` set, a puff of floor dust kicked out sideways (settles fast). */
  function puff(x: number, y: number, dust = 0) {
    const i = n[1]!;
    if (i >= PUFFS) return;
    n[1] = i + 1;
    SX[i] = x + rnd() * 2 - 1, SY[i] = y, SVX[i] = dust ? dust * (6 + rnd() * 10) : 2 + rnd() * 5, SAGE[i] = dust ? 0.5 : 0, SLIFE[i] = dust ? 0.9 + rnd() * 0.3 : 1.4 + rnd() * 0.9;
  }
  /** Weld at (x, y), in art pixels (clamped onto the plate). Queued while an arc burns. */
  function tap(x: number, y: number) {
    x = Math.min(TX1, Math.max(TX0, x));
    y = Math.min(TY1, Math.max(TY0, y));
    if (s[PH] === 3) return void ((s[QX] = x), (s[QY] = y), (s[Q] = 1));
    s[TX] = x, s[TY] = y, s[PH] = 1, s[PT] = 0, s[WAIT] = -1;
    s[GOAL] = Math.min(90, Math.max(12, x - 24));
  }

  function step(dt: number) {
    if (s[WAIT]! > 0 && (s[WAIT] = s[WAIT]! - dt) <= 0) tap(98, 31);
    const ph = s[PH]!;
    s[PT] = s[PT]! + dt;
    // Roll: ease to the goal, at most 240 px/s; the treads turn with the distance.
    // Anticipation: a beat leaning back before it sets off; it leans into the roll, and when it
    // brakes it kicks up dust and bobs on its treads.
    const d = s[GOAL]! - s[RX]!, go = ph !== 1 || s[PT]! > 0.07;
    const v = go ? Math.max(-240 * dt, Math.min(240 * dt, d * 14 * dt)) : 0, was = s[VEL]!;
    s[RX] = Math.abs(d) < 0.2 ? s[GOAL]! : s[RX]! + v;
    s[ODO] = s[ODO]! + Math.abs(v);
    s[VEL] = v / dt;
    s[LEAN] = !go && Math.abs(d) > 1 ? -Math.sign(d) : Math.abs(s[VEL]!) > 40 ? Math.sign(s[VEL]!) : 0;
    if (Math.abs(was) > 60 && Math.abs(s[VEL]!) < 60) {
      s[BOB] = 0.16;
      for (let i = 0; i < 4; i++) puff(s[RX]! + (was > 0 ? 1 : 15), FLOOR - 1 - (i & 1), was > 0 ? -1 : 1);
    }
    if (s[BOB]! > 0) s[BOB] = s[BOB]! - dt;
    // The torch: to the weld while welding, else down at rest.
    const sx = s[RX]! + 15, sy = 47, aim = ph >= 1 && ph <= 3;
    const gx = aim ? s[TX]! : sx + REST_X, gy = aim ? s[TY]! : sy + REST_Y, k = Math.min(1, dt * 16);
    s[AX] = s[AX]! + (gx - s[AX]!) * k;
    s[AY] = s[AY]! + (gy - s[AY]!) * k;
    s[MASK] = ph >= 2 && (ph < 4 || s[PT]! < 0.35) ? 1 : 0;
    if (ph === 1 && Math.abs(d) < 0.5 && Math.abs(gx - s[AX]!) < 0.6 && Math.abs(gy - s[AY]!) < 0.6) (s[PH] = 2), (s[PT] = 0);
    if (ph === 2 && s[PT]! > 0.12) {
      // Strike: the arc lights, a bead starts to pool.
      s[PH] = 3, s[PT] = 0, s[BOB] = 0.08;
      const b = s[NB]! % BEADS;
      BXs[b] = Math.round(s[TX]!), BYs[b] = Math.round(s[TY]!), BAGE[b] = 0;
      s[NB] = s[NB]! + 1;
    }
    if (ph === 3) {
      // The arc: sparks in a fan, mostly up and out; a few fast streamers low and wide; smoke.
      // The fountain: most of it pours out and down off the arc onto the bench (and bounces); the
      // rest in a short fan up and back, falling in arcs.
      const t = s[PT]!, x = s[TX]!, y = s[TY]!, dir = 0.55;
      s[JIT] = rnd() < 0.5 ? 0 : rnd() < 0.5 ? -1 : 1;
      s[CARRY] = s[CARRY]! + dt * (t < 0.08 ? 380 : 110);
      while (s[CARRY]! >= 1) {
        s[CARRY] = s[CARRY]! - 1;
        const wide = rnd() < 0.3, a = wide ? -1.7 + (rnd() - 0.5) * 2 : dir + (rnd() + rnd() - 1) * 1.1, sp = wide ? 35 + rnd() * 55 : 40 + rnd() * 90;
        spark(x + rnd() * 2 - 1, y + rnd() * 2 - 1, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + rnd() * 0.8, 0);
      }
      s[LIT_R] = 19 + rnd() * 9;
      if ((s[PUFF] = s[PUFF]! + dt * 9) >= 1) (s[PUFF] = 0), puff(x, y - 2);
      if (t >= ARC) {
        s[PH] = 4, s[PT] = 0, s[LIT_R] = 0, s[JIT] = 0;
        for (let i = 0; i < 4; i++) puff(x, y - 1);
      }
    }
    if (ph === 4) {
      if (s[Q]) (s[Q] = 0), tap(s[QX]!, s[QY]!);
      else if (s[PT]! > 0.6) (s[PH] = 0), (s[HAPPY] = 1.1);
    }
    if (s[HAPPY]! > 0) s[HAPPY] = s[HAPPY]! - dt;
    // Sparks: gravity, a little drag, bounce off the bench top and the floor (losing most of the
    // bounce, sliding to a stop), sometimes burst in two while white hot. Scorch where hot ones land.
    // Removal swaps in the last spark (already stepped, or born this step): every spark steps once.
    for (let i = n[0]! - 1; i >= 0; i--) {
      const age = (AGE[i] = AGE[i]! + dt), life = LIFE[i]!;
      if (age >= life || X[i]! < -2 || X[i]! > GW + 2) {
        const m = (n[0] = n[0]! - 1);
        X[i] = X[m]!, Yp[i] = Yp[m]!, VX[i] = VX[m]!, VY[i] = VY[m]!, AGE[i] = AGE[m]!, LIFE[i] = LIFE[m]!, HIT[i] = HIT[m]!, COL[i] = COL[m]!, GR[i] = GR[m]!, TRY[i] = TRY[m]!;
        continue;
      }
      const y0 = Yp[i]!;
      VY[i] = VY[i]! + 240 * GR[i]! * dt;
      VX[i] = VX[i]! * (1 - 1.1 * dt);
      X[i] = X[i]! + VX[i]! * dt;
      Yp[i] = y0 + VY[i]! * dt;
      const x = X[i]!, top = x >= BX0 && x < BX1 && y0 <= TOP ? TOP : FLOOR;
      // The fuse: a hot weld spark that lands on it may light it (where you weld sets the odds).
      if (!s[RK] && !COL[i] && !TRY[i] && x >= 122.5 && x < 126.5 && Yp[i]! >= 40 && Yp[i]! <= 46.5 && ((TRY[i] = 1), age < life * 0.4 && rnd() < FUSE_ODDS)) (s[RK] = 1), (s[RT] = 0);
      if (Yp[i]! >= top && VY[i]! > 0) {
        Yp[i] = top;
        const hot = age / life < 0.5, col = x | 0;
        if (!HIT[i] && hot && col >= 0 && col < GW) top === TOP ? (SB[col] = 0) : (SF[col] = 0);
        HIT[i] = HIT[i]! + 1;
        VY[i] = VY[i]! < 30 ? 0 : -VY[i]! * (0.28 + rnd() * 0.22);
        VX[i] = VX[i]! * (VY[i] ? 0.7 : 0.9);
      }
      if (!HIT[i] && !COL[i] && age < life * 0.3 && rnd() < 0.004 && n[0]! < CAP - 2) {
        for (let j = 0; j < 2; j++) {
          const a = rnd() * 6.2832, sp = 20 + rnd() * 30;
          spark(x, Yp[i]!, VX[i]! * 0.4 + Math.cos(a) * sp, VY[i]! * 0.4 + Math.sin(a) * sp, life * 0.5, life * 0.15);
        }
      }
    }
    // The rocket. Lit: the fuse fizzes down to it (Sparky sees it). Then it goes: a wobbling climb on a
    // trail of sparks and smoke, a burst of colour up under the ceiling that lights the room, and a
    // fresh rocket drops into the tin a little later.
    const rk = s[RK]!;
    if (rk === 1) {
      const t = (s[RT] = s[RT]! + dt), f = FUSE[Math.min(4, Math.floor(t / 0.24))]!;
      if (rnd() < 0.5) spark(f[0] + 0.5, f[1], -15 + rnd() * 30, -20 - rnd() * 30, 0.2 + rnd() * 0.2, 0, rnd() < 0.5 ? Y : I, 0.6);
      if (t >= 1.2) (s[RK] = 2), (s[RT] = 0), (s[RY] = RY0), (s[RV] = -8), (s[RXX] = RX0), puff(121, 44), puff(123, 44);
    } else if (rk === 2) {
      const t = (s[RT] = s[RT]! + dt);
      s[RV] = s[RV]! - 130 * dt;
      s[RY] = s[RY]! + s[RV]! * dt;
      s[RXX] = RX0 + Math.sin(t * 19) * 0.8 - t * t * 110;
      for (let k = 0; k < 3; k++) spark(s[RXX]! + 1.5, s[RY]! + 11, -12 + rnd() * 24, 30 + rnd() * 50, 0.15 + rnd() * 0.25, 0, rnd() < 0.4 ? Y : rnd() < 0.5 ? I : A, 0.4);
      if (rnd() < 0.35) puff(s[RXX]! + 1, s[RY]! + 12);
      if (s[RY]! < 15) {
        // The burst: rings of colour (two speeds), slow to fall.
        const bx = s[RXX]! + 1.5, by = s[RY]!;
        for (let k = 0; k < 64; k++) {
          const a = (k / 32) * 3.1416 + rnd() * 0.1, sp = k & 1 ? 55 + rnd() * 10 : 28 + rnd() * 8;
          spark(bx, by, Math.cos(a) * sp, Math.sin(a) * sp, 0.9 + rnd() * 0.6, 0, k % 4 === 0 ? C : k % 4 === 1 ? P : k % 4 === 2 ? Y : I, 0.25);
        }
        s[RK] = 3, s[RT] = 0, s[FLASH] = 0.12, s[HAPPY] = 1.8;
      }
    } else if (rk === 3 && (s[RT] = s[RT]! + dt) > 2.6) (s[RK] = 4), (s[RT] = 0);
    else if (rk === 4 && (s[RT] = s[RT]! + dt) > 0.45) s[RK] = 0;
    if (s[FLASH]! > 0) s[FLASH] = s[FLASH]! - dt;
    // Smoke: rises, drifts, thins.
    let q = n[1]!;
    for (let i = q - 1; i >= 0; i--) {
      if ((SAGE[i] = SAGE[i]! + dt) >= SLIFE[i]!) {
        q--;
        SX[i] = SX[q]!, SY[i] = SY[q]!, SVX[i] = SVX[q]!, SAGE[i] = SAGE[q]!, SLIFE[i] = SLIFE[q]!;
        continue;
      }
      SX[i] = SX[i]! + SVX[i]! * dt;
      SVX[i] = SVX[i]! * (1 - 2 * dt);
      SY[i] = SY[i]! - (SY[i]! > FLOOR - 4 ? 3 : 11) * dt;
    }
    n[1] = q;
    for (let b = 0; b < BEADS; b++) if (BAGE[b]! < 9) BAGE[b] = BAGE[b]! + dt;
    for (let x = 0; x < GW; x++) {
      if (SB[x]! < 9) SB[x] = SB[x]! + dt;
      if (SF[x]! < 9) SF[x] = SF[x]! + dt;
    }
  }

  /** Still moving (or about to): the engine stays awake. */
  function busy() {
    if (s[PH] || s[RK] || s[FLASH]! > 0 || s[WAIT]! > 0 || n[0] || n[1] || s[HAPPY]! > 0 || Math.abs(s[GOAL]! - s[RX]!) > 0) return true;
    if (s[BOB]! > 0 || Math.abs(s[AX]! - s[RX]! - 15 - REST_X) > 0.3 || Math.abs(s[AY]! - 47 - REST_Y) > 0.3) return true;
    for (let b = 0; b < BEADS; b++) if (BAGE[b]! < 4.6) return true;
    for (let x = 0; x < GW; x++) if (SB[x]! < 1.8 || SF[x]! < 1.8) return true;
    return false;
  }

  /** Molten to steel: a bead's colour at an age (the arc burns for ARC seconds). */
  const beadColor = (a: number) => (a < ARC + 0.25 ? I : a < ARC + 0.8 ? Y : a < ARC + 1.5 ? A : a < ARC + 2.3 ? P : a < ARC + 3 ? B : L);
  /** A spark's head and tail colours as it cools. */
  const head = (t: number) => (t < 0.15 ? I : t < 0.42 ? A : t < 0.82 ? P : B);
  const tail = (t: number) => (t < 0.15 ? A : t < 0.6 ? P : B);
  const mark = (a: number) => (a < 0.25 ? A : a < 0.7 ? P : a < 1.8 ? K : -1);

  function arm(x0: number, y0: number, x1: number, y1: number) {
    for (let o = 0; o < 4; o++) line(p, x0 + (o === 0 ? -1 : o === 1 ? 2 : 0), y0 + (o === 2 ? -1 : o === 3 ? 2 : 0), x1 + (o === 0 ? -1 : o === 1 ? 2 : 0), y1 + (o === 2 ? -1 : o === 3 ? 2 : 0), K);
    line(p, x0, y0 + 1, x1, y1 + 1, B);
    line(p, x0 + 1, y0 + 1, x1 + 1, y1 + 1, B);
    line(p, x0, y0, x1, y1, V);
  }

  function paint() {
    px.set(bg);
    // Beads on the plate, each with a scorch ring that glows, darkens and fades away.
    for (let b = 0; b < BEADS; b++) {
      const a = BAGE[b]!;
      if (a > 50) continue;
      const bx = BXs[b]!, by = BYs[b]!;
      if (a < 4.6) {
        const dens = a < ARC ? 1 : 1 - (a - ARC) / (4.6 - ARC);
        // A heat ring that darkens to a scorch, then thins out and is gone (an ordered pattern: no shimmer).
        for (let j = -2; j <= 2; j++) for (let i = -4; i <= 4; i++) {
          const r = i * i * 0.45 + j * j * 1.3;
          if (r < 1.6 || r > 6.5 || ((i * 5 + j * 3 + 40) % 8) / 8 >= dens) continue;
          const xx = bx + i, yy = by + j;
          if (xx > PX0 && xx < PX1 - 1 && yy > PY0 && yy < TOP) dot(p, xx, yy, a < ARC + 0.3 ? (r < 3.5 ? P : A) : a < ARC + 1.2 ? B : L);
        }
      }
      const c = beadColor(a);
      fill(p, bx - 1, by, 3, 1, c);
      dot(p, bx, by - 1, c);
      if (c === L) dot(p, bx, by - 1, I);
    }
    // Scorch on the bench top and the floor.
    for (let x = 0; x < GW; x++) {
      const b = mark(SB[x]!), f = mark(SF[x]!);
      if (b >= 0 && x >= BX0 && x < BX1) dot(p, x, TOP, b);
      if (f >= 0) dot(p, x, FLOOR, f);
    }
    // The rocket: in its tin (and its fuse), flying, gone, or dropping back in with a bounce.
    const rk = s[RK]!;
    if (rk === 0 || rk === 1) {
      blit(p, ROCKET, RX0, RY0);
      const burnt = rk === 1 ? Math.floor(s[RT]! / 0.24) : -1;
      for (let k = 0; k < FUSE.length; k++) if (k >= burnt) dot(p, FUSE[k]![0], FUSE[k]![1], k === burnt ? (rnd() < 0.5 ? I : Y) : M);
    } else if (rk === 2) blit(p, ROCKET, Math.round(s[RXX]!), Math.round(s[RY]!));
    else if (rk === 4) {
      // Drops in from above, lands, settles: down, one small hop.
      const t = s[RT]!, y = t < 0.25 ? RY0 - 30 * (1 - t / 0.25) ** 2 : RY0 - Math.round(Math.sin(((t - 0.25) / 0.2) * 3.1416) * 2);
      blit(p, ROCKET, RX0, Math.round(y));
      for (let k = 0; k < FUSE.length; k++) dot(p, FUSE[k]![0], FUSE[k]![1], M);
    }
    // The chalk mark where you tapped, until the arc strikes.
    const ph = s[PH]!;
    if (ph === 1 || ph === 2) {
      const x = s[TX]!, y = s[TY]!;
      dot(p, x - 1, y - 1, C), dot(p, x + 1, y + 1, C), dot(p, x + 1, y - 1, C), dot(p, x - 1, y + 1, C), dot(p, x, y, C);
    }
    // Sparky.
    const rx = Math.round(s[RX]!), lean = rk === 1 ? -1 : s[LEAN]!, bob = s[BOB]! > 0 ? 1 : 0, hop = s[HAPPY]! > 0.75 && (s[HAPPY]! * 6) % 1 < 0.5 ? -1 : 0;
    blit(p, TREADS[(Math.floor(s[ODO]! / 2) % 3)]!, rx, 54);
    blit(p, BODY, rx + 1, 44 + bob + hop);
    blit(p, HEAD[s[MASK] ? (ph === 3 ? 3 : 2) : rk === 1 || rk === 2 ? 4 : s[HAPPY]! > 0 ? 1 : 0]!, rx + 2 + lean, 34 + bob + hop);
    blit(p, ANT, rx + 6 + lean * 2, (s[MASK] ? 31 : 29) + bob * 2 + hop);
    // The arm (two segments, the elbow dropped), the hand, the torch to its tip.
    const sx = rx + 15, sy = 47 + bob + hop, tx = s[AX]! + s[JIT]!, ty = s[AY]! - Math.abs(s[JIT]!);
    let ux = tx - sx, uy = ty - sy;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const hx = tx - ux * 5, hy = ty - uy * 5, dd = Math.min(ARM * 2, Math.max(3, Math.hypot(hx - sx, hy - sy)));
    const ang = Math.atan2(hy - sy, hx - sx), bend = Math.acos(Math.min(1, Math.max(-1, dd / (2 * ARM))));
    const eb = ty < sy - 4 ? -bend : bend; // reaching up: the elbow out and up; else down
    const ex = sx + Math.cos(ang + eb) * ARM, ey = sy + Math.sin(ang + eb) * ARM;
    arm(sx, sy, ex, ey);
    arm(ex, ey, hx, hy);
    fill(p, ex - 1, ey - 1, 3, 3, K), fill(p, ex, ey, 2, 2, M);
    fill(p, sx - 1, sy - 1, 3, 3, K), fill(p, sx, sy, 2, 2, M);
    line(p, hx, hy, tx, ty, I, L);
    fill(p, hx - 1, hy - 1, 3, 3, K), fill(p, hx - 1, hy - 1, 2, 2, M);
    // The arc's light: everything near it lit, thinning out with distance (ordered dither).
    const R = s[LIT_R]!;
    if (ph === 3 && R > 0) {
      const cx = s[TX]!, cy = s[TY]!, r2 = R * R;
      for (let y = Math.max(0, (cy - R) | 0); y < Math.min(GH, cy + R); y++)
        for (let x = Math.max(0, (cx - R) | 0); x < Math.min(GW, cx + R); x++) {
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d2 > r2) continue;
          const f = d2 / r2, o = y * GW + x;
          if (f < 0.02) px[o] = LIT[px[o]!]!;
          else if (f < 0.07) px[o] = GLOW[px[o]!]!;
        }
    }
    // The burst lights the whole room for a frame or two.
    if (s[FLASH]! > 0) for (let i = 0; i < px.length; i++) px[i] = GLOW[px[i]!] === K ? L : px[i]!;
    // Smoke, then the sparks over everything.
    for (let i = 0; i < n[1]!; i++) {
      const k = SAGE[i]! / SLIFE[i]!, x = SX[i]!, y = SY[i]!, c = k < 0.35 ? M : L;
      dot(p, x, y, c);
      if (k < 0.7) dot(p, x + 1, y - 1, c), dot(p, x - 1, y + 1, L);
      if (k < 0.4) dot(p, x + 1, y, c);
    }
    for (let i = 0; i < n[0]!; i++) {
      const t = AGE[i]! / LIFE[i]!, x = X[i]!, y = Yp[i]!;
      if (COL[i]) {
        const c = t < 0.65 ? COL[i]! : t < 0.85 ? B : L, sp = Math.hypot(VX[i]!, VY[i]!) || 1, len = Math.min(3, sp * 0.04);
        line(p, x - (VX[i]! / sp) * len, y - (VY[i]! / sp) * len, x, y, t < 0.3 ? I : c, c);
      } else if (HIT[i] && !VY[i]) dot(p, x, y - 1, head(t));
      else {
        // A streak: where it was 50 ms ago (at least two pixels long), so it reads as a line, not a dot.
        const sp = Math.hypot(VX[i]!, VY[i]!) || 1, len = Math.min(6, Math.max(2, sp * 0.05));
        const lx = (VX[i]! / sp) * len, ly = (VY[i]! / sp) * len;
        line(p, x - lx, y - ly, x, y, head(t), tail(t));
      }
    }
    // The arc itself: a white-hot star that won't hold still.
    if (ph === 3) {
      const x = Math.round(s[TX]!), y = Math.round(s[TY]!), r = rnd() < 0.5 ? 1 : 2;
      for (let i = -r; i <= r; i++) dot(p, x + i, y, I), dot(p, x, y + i, I);
      dot(p, x + r + 1, y, A), dot(p, x - r - 1, y, A), dot(p, x, y - r - 1, A);
      if (r === 2) dot(p, x - 1, y - 1, I), dot(p, x + 1, y - 1, I);
    }
  }

  return { step, paint, busy, tap, at: (x: number, y: number) => at(p, x, y), state: s };
}

export type WelderScene = { engine: ReturnType<typeof createEngine>; weld(x: number, y: number): void; destroy(): void };

/** The slot mount: the room on a pixel canvas in the stage; a tap welds where it lands. */
export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): WelderScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const p = pixels(GW, GH), w = welder(p, (Math.random() * 4294967296) >>> 0), view = pixelCanvas(engine.ledger, stage, p, PALETTE);
  const dirty = new Uint8Array([1]);
  const weld = (x: number, y: number) => (w.tap(x, y), engine.wake());
  /** A tap at (px, py) CSS px in a box of (bw, bh): to art pixels. */
  const fromPage = (px: number, py: number, bw: number, bh: number) => weld((px / bw) * GW, (py / bh) * GH);
  if (first) {
    const r = stage.getBoundingClientRect(); // once, at mount: outside any frame
    fromPage(first.x, first.y, r.width || 1, r.height || 1);
  } else w.state[12] = 0.9; // welds once by itself, a moment after it loads
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    fromPage(e.clientX - r.left, e.clientY - r.top, r.width || 1, r.height || 1);
  }, { signal: engine.signal });
  engine.add({
    step(e, dt) {
      w.step(dt);
      if (w.busy()) (e.busy(), (dirty[0] = 1));
    },
    render() {
      if (!dirty[0]) return;
      dirty[0] = 0;
      w.paint();
      view.show();
    },
  });
  engine.start();
  return { engine, weld, destroy: () => engine.destroy() };
}

/** The poster: the same scene, run headless to the middle of a weld, as one still frame. */
export function poster() {
  const p = pixels(GW, GH), w = welder(p, 7);
  w.tap(100, 30);
  for (let i = 0; i < 60 * 1.5; i++) {
    w.step(1 / 60);
    if (w.state[7] === 3 && w.state[8]! > 0.42) break;
  }
  w.paint();
  return p;
}
