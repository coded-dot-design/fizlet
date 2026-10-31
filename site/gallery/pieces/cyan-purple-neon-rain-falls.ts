// "Cyan and purple neon rain falls when you tap": a cyberpunk side street at night. A skyline, a
// street lamp, a corner shop with a pink awning, a cat in its lit doorway, and over the door a real
// neon sign: FIZLET, page text in the stage. On load a drizzle passes. A tap brings the downpour:
// cyan and violet streaks in three depths leaning with the wind, crowns on the pavement, rings in
// the puddles that break up the sign's reflection, water sheeting off the awning, the cat ducking
// back into the doorway, one roll of far lightning. Drops that hit the sign can short it: it buzzes
// off and on, spits a few sparks, and its reflection blinks with it. The sign is the only page text,
// and it changes only then. Then the rain eases to a drizzle, the puddles go still, it settles.
// Bricks: the kernel (fixed step, settle: no frames once still; the ledger: the sign's flicker and
// the canvas both go back on Recall) and fzlt/slot. The scene is palette indices in one small
// buffer (./pixel-stage.ts); the sign's box is a clear hole in it, so the real text shows through.
import { createEngine } from "../../../src/kernel/index";
import type { SlotTap } from "../../../src/slot";
import { art, blit, dot, fill, pixelCanvas, pixels, type Pixels } from "./pixel-stage";

/** The art, in art pixels: 160 × 90 (16:9), scaled crisp to the card. */
export const GW = 160, GH = 90;
// Palette: clear (the sign's hole), then Fizlet brand tokens: rim, line, base, cmd, muted, ink,
// attack, aim, sys, go, hurt.
export const PALETTE = ["", "#07060f", "#3b3170", "#3f296a", "#9a63ff", "#aea4d6", "#f6f3ff", "#ff2e88", "#ff7389", "#19f0ff", "#39ffb0", "#ffc21a"] as const;
const H = 0, K = 1, L = 2, B = 3, V = 4, M = 5, I = 6, P = 7, A = 8, C = 9, Y = 11;
/** Bright colours: these show in a puddle's reflection; the rest reflect as dark water. */
const BRIGHT = Uint8Array.from([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
/** The lightning's colours: sky and clouds lit up for a frame or two. */
const FLASH = Uint8Array.from([H, L, B, V, M, I, I, P, A, C, 10, Y]);
/** The sign: its frame, and the hole the real text shows through (the stage html matches it). */
export const SIGN = { x: 98, y: 14, w: 51, h: 15 };
const HORIZON = 66, WALK = 69;
const CAP = 700, SPL = 260, RIP = 72;

// The sign's reflection: FIZLET in a 5 × 7 pixel font (only the puddles show it).
const FONT: Record<string, string[]> = {
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
};
// The cat: sitting, and ducked down with its ears back; the tail flicks on frame 2.
const CMAP = { k: K, c: C, l: L };
const CAT = [
  art([".k...k..", ".kk.kk..", ".kkkkk..", ".kckck..", ".kkkkk..", "..kkkk..", ".kkkkkk.", ".kkkkkk.", ".kkkkkkk"], CMAP),
  art(["........", "........", ".kk..kk.", ".kkkkkk.", ".klkkl..", ".kkkkk..", "kkkkkkk.", "kkkkkkkk", "kkkkkkkk"], CMAP),
  art([".k...k..", ".kk.kk..", ".kkkkk..", ".kckck..", ".kkkkk..", "..kkkk.k", ".kkkkkkk", ".kkkkkk.", ".kkkkkk."], CMAP),
];

// A passer-by under a green umbrella (two walking frames); the rain bounces off the canopy.
const WMAP = { k: K, v: V, m: M, l: L, g: 10, i: I };
const WALKER = [
  art(["...igggi...", ".ggggggggg.", "ggggggggggg", "g..g.k.g..g", ".....k.....", "....mm.....", "....mm.....", "...vvvk....", "...vvvk....", "...vvv.....", "...vvv.....", "...l.l.....", "...l.l.....", "..ll.ll...."], WMAP),
  art(["...igggi...", ".ggggggggg.", "ggggggggggg", "g..g.k.g..g", ".....k.....", "....mm.....", "....mm.....", "...vvvk....", "...vvvk....", "...vvv.....", "...vvv.....", "....l......", "....l......", "...ll......"], WMAP),
];
/** Puddles: centre, radii. A reflection row maps back up the scene by `k` rows per row. */
const PUD = [[124, 81, 31, 6], [44, 80, 20, 4], [84, 86, 11, 2.5]] as const;
/** Each puddle's reflection: the scene row its top row shows, and rows of scene per puddle row. The
 *  sign's puddle skips the wall below the sign (a cheat, so FIZLET shows upside down in it). */
const REF = [[75, SIGN.y + SIGN.h + 1, 1.3], [76, 31, 1.6], [84, HORIZON - 2, 4]] as const;
const inPuddle = (x: number, y: number) => {
  for (let i = 0; i < PUD.length; i++) {
    const [cx, cy, rx, ry] = PUD[i]!, dx = (x - cx) / rx, dy = (y - cy) / ry;
    // A ragged edge: the outline wobbles a pixel or so with x.
    if (dx * dx + dy * dy < 1 - 0.18 * ((((x * 7) ^ (y * 3)) & 3) / 3)) return i;
  }
  return -1;
};

/** The still street, drawn once from a fixed seed (so the poster and the live scene agree). */
function street(p: Pixels) {
  const rs = new Uint32Array([1234567]);
  const r = () => ((rs[0] = Math.imul(rs[0]!, 1664525) + 1013904223), rs[0]! / 4294967296);
  fill(p, 0, 0, GW, GH, K);
  // Low cloud: a lumpy band of base under the top edge.
  for (let x = 0; x < GW; x++) {
    const h = 5 + Math.round(2 * Math.sin(x * 0.11) + 1.5 * Math.sin(x * 0.29 + 1));
    fill(p, x, 0, 1, h, B);
    if ((x & 1) === 0) dot(p, x, h, B);
  }
  // Far skyline: line-colour towers, a few dim windows.
  for (let x = 0; x < GW; ) {
    const w = 6 + Math.floor(r() * 10), top = 24 + Math.floor(r() * 18);
    fill(p, x, top, w, HORIZON - top, L);
    if (r() < 0.3) fill(p, x + (w >> 1), top - 4, 1, 4, L);
    for (let y = top + 3; y < HORIZON - 4; y += 3) for (let i = x + 1; i < x + w - 1; i += 2) if (r() < 0.12) dot(p, i, y, r() < 0.7 ? B : r() < 0.6 ? V : M);
    x += w + Math.floor(r() * 3);
  }
  // Left: a near tower, its edge lit, windows violet, cyan and one warm.
  fill(p, 0, 16, 40, HORIZON - 16, B);
  fill(p, 39, 16, 1, HORIZON - 16, L);
  fill(p, 0, 14, 42, 2, L);
  for (let y = 20; y < 60; y += 5) for (let x = 3; x < 37; x += 5) {
    const q = r();
    fill(p, x, y, 3, 3, q < 0.5 ? K : q < 0.72 ? V : q < 0.86 ? L : q < 0.95 ? C : Y);
  }
  // The street lamp: a pole, an arm, the head and its bulb.
  fill(p, 47, 28, 2, WALK - 28, L);
  fill(p, 47, 27, 8, 1, L);
  fill(p, 52, 27, 5, 2, M);
  fill(p, 53, 29, 3, 1, I);
  fill(p, 46, WALK - 2, 4, 2, L);
  // Right: the corner shop's wall (dark brick), the sign's frame and hole, its brackets.
  fill(p, 88, 6, GW - 88, HORIZON - 6, K);
  fill(p, 88, 6, GW - 88, 1, L);
  for (let y = 9; y < HORIZON; y += 4) for (let x = 88 + ((y >> 2) & 1) * 4; x < GW; x += 8) fill(p, x, y, 5, 1, L);
  fill(p, 88, 6, 1, HORIZON - 6, L);
  const { x: sx, y: sy, w: sw, h: sh } = SIGN;
  fill(p, sx - 3, sy - 3, sw + 6, sh + 6, K);
  fill(p, sx - 2, sy - 2, sw + 4, sh + 4, L);
  fill(p, sx - 2, sy - 2, sw + 4, 1, M);
  fill(p, sx, sy, sw, sh, H);
  for (const x of [sx + 6, sx + sw - 7]) fill(p, x, sy - 6, 1, 4, M), fill(p, x - 1, sy - 7, 3, 1, L);
  for (const [x, y] of [[sx - 1, sy - 1], [sx + sw, sy - 1], [sx - 1, sy + sh], [sx + sw, sy + sh]]) dot(p, x!, y!, V);
  // The shop window (violet, blinds), the door (warm light), the pink awning over it.
  fill(p, 94, 47, 24, 15, L);
  fill(p, 95, 48, 22, 13, V);
  for (let y = 49; y < 61; y += 2) fill(p, 95, y, 22, 1, B);
  fill(p, 104, 54, 4, 7, K), fill(p, 103, 52, 6, 3, K);
  fill(p, 125, 48, 20, HORIZON - 48, L);
  fill(p, 126, 49, 18, HORIZON - 49, Y);
  fill(p, 126, 49, 18, 1, A);
  fill(p, 140, 56, 2, 1, L);
  fill(p, 119, 43, 32, 1, I);
  for (let x = 119; x < 151; x++) fill(p, x, 44, 1, 3, ((x - 119) >> 2) & 1 ? I : P);
  for (let x = 119; x < 151; x += 2) dot(p, x, 47, ((x - 119) >> 2) & 1 ? I : P);
  // Pavement, kerb, road; the door's warm light spills onto the pavement.
  fill(p, 0, HORIZON, GW, WALK - HORIZON, B);
  fill(p, 0, HORIZON, GW, 1, M);
  for (let x = 4; x < GW; x += 12) dot(p, x, HORIZON + 1, L);
  fill(p, 0, WALK, GW, 1, M);
  fill(p, 0, WALK + 1, GW, 1, L);
  fill(p, 0, WALK + 2, GW, GH - WALK - 2, K);
  for (let y = WALK + 4; y < GH; y += 3) for (let x = (y * 7) % 13; x < GW; x += 13) fill(p, x, y, 3, 1, L);
  for (let x = 6; x < GW; x += 22) fill(p, x, 82, 9, 1, M);
  for (let y = HORIZON + 1; y < WALK; y++) for (let x = 124 - (y - HORIZON) * 2; x < 146 + (y - HORIZON) * 2; x++) if ((x + y) & 1) dot(p, x, y, Y);
  // The puddles: still water (dark); their reflections are drawn live.
  for (let y = WALK + 2; y < GH; y++) for (let x = 0; x < GW; x++) if (inPuddle(x, y) >= 0) dot(p, x, y, inPuddle(x, y - 1) < 0 ? B : L);
}

/** The scene's state and story, without the DOM: the live mount and the poster both run it. */
export function rain(p: Pixels, seed: number) {
  const bg = new Uint8Array(GW * GH), px = p.px;
  street(p);
  bg.set(px);
  // The sign's text as pixels (1: lit), for the reflection.
  const text = new Uint8Array(SIGN.w * SIGN.h);
  [..."FIZLET"].forEach((ch, n) => FONT[ch]!.forEach((row, y) => [...row].forEach((c, x) => c === "#" && (text[(4 + y) * SIGN.w + 5 + n * 7 + x] = 1))));
  const rs = new Uint32Array([seed >>> 0 || 1]);
  const rnd = () => ((rs[0] = Math.imul(rs[0]!, 1664525) + 1013904223), rs[0]! / 4294967296);
  // State, one typed array: time since the tap (-1: none), drizzle left, rain carry, wind, short
  // time (-1: none), short cooldown, a short owed this downpour, flash time, bolt x, awning water,
  // drip carry, cat flinch, clock, intensity, ripple energy (one per puddle: 3), the sign's lit state.
  // Then the game: storm level (each tap during a storm raises it), the sign's damage (shorts so
  // far), time since it blew (-1: it hasn't), the passer-by's x (-99: nobody) and stride, and
  // whether the passer-by is running (startled).
  const s = new Float64Array(32);
  const T = 0, DRZ = 1, CARRY = 2, WIND = 3, SH = 4, SHCD = 5, OWED = 6, FL = 7, BX = 8, AWN = 9, DRIP = 10, FLINCH = 11, CLOCK = 12, INT = 13, RIP0 = 14, LIT = 17, LVL = 18, DMG = 19, BLOW = 20, WX = 21, WS = 22, RUN = 23;
  s[BLOW] = -1;
  s[WX] = -99;
  s[T] = -1;
  s[SH] = -1;
  s[FL] = -1;
  s[LIT] = 1;
  // Drops: position, velocity, depth (0 far, 1 mid, 2 near, 3 a drip off the awning), where it lands.
  const X = new Float32Array(CAP), Yd = new Float32Array(CAP), VX = new Float32Array(CAP), VY = new Float32Array(CAP), GY = new Float32Array(CAP), Z = new Uint8Array(CAP);
  // Splashes and sparks: position, velocity, life, colour. Ripples: centre, age.
  const SX = new Float32Array(SPL), SY = new Float32Array(SPL), SVX = new Float32Array(SPL), SVY = new Float32Array(SPL), SL = new Float32Array(SPL), SC = new Uint8Array(SPL), SG = new Float32Array(SPL);
  const RX = new Float32Array(RIP), RY = new Float32Array(RIP), RA = new Float32Array(RIP);
  // The bolt: a fixed zig-zag, offset to BX when it strikes.
  const BOLT = new Int8Array(24);
  const n = new Uint32Array(3); // drops, splashes, ripples

  function drop(x: number, y: number, vx: number, vy: number, gy: number, z: number) {
    const i = n[0]!;
    if (i >= CAP) return;
    n[0] = i + 1;
    X[i] = x, Yd[i] = y, VX[i] = vx, VY[i] = vy, GY[i] = gy, Z[i] = z;
  }
  /** A droplet, spark or (gravity < 0) a wisp of smoke. */
  function splash(x: number, y: number, vx: number, vy: number, life: number, c: number, g = 300) {
    const i = n[1]!;
    if (i >= SPL) return;
    n[1] = i + 1;
    SX[i] = x, SY[i] = y, SVX[i] = vx, SVY[i] = vy, SL[i] = life, SC[i] = c, SG[i] = g;
  }
  function ripple(x: number, y: number, pud: number) {
    const i = n[2]!;
    s[RIP0 + pud] = Math.min(1.6, s[RIP0 + pud]! + 0.07);
    if (i >= RIP) return;
    n[2] = i + 1;
    RX[i] = x, RY[i] = y, RA[i] = 0;
  }
  /** The downpour, now; tapped again while it pours, the storm gets worse (up to level 4). */
  function tap() {
    const was = s[T]!, storming = was >= 0 && was < 6.5;
    s[LVL] = storming ? Math.min(4, s[LVL]! + 1) : 1;
    s[T] = storming ? Math.max(0.5, Math.min(was, 2)) : 0;
    s[OWED] = s[LVL]! >= 2 ? 1 : 0;
    s[DRZ] = 0;
    if (!storming || s[LVL]! >= 3) s[FL] = -0.6 - rnd() * 0.5; // thunder rolls in, nearer each level
    if (s[WX]! < -90) (s[WX] = -12), (s[RUN] = 0);
  }
  /** A short: the sign buzzes. The third in a row blows it. */
  function short(x: number) {
    s[SHCD] = 1.2;
    s[OWED] = 0;
    s[DMG] = s[DMG]! + 1;
    if (s[DMG]! >= 3) {
      // Blown: a shower of sparks off the whole sign, smoke, dark for a while; the cat bolts and the
      // passer-by runs for it.
      s[BLOW] = 0, s[DMG] = 0, s[SH] = -1, s[FLINCH] = 0;
      if (s[WX]! > -90) s[RUN] = 1;
      for (let k = 0; k < 46; k++) splash(SIGN.x + rnd() * SIGN.w, SIGN.y + SIGN.h * rnd(), -70 + rnd() * 140, -90 + rnd() * 70, 0.4 + rnd() * 0.7, k % 4 === 0 ? Y : k & 1 ? I : C);
      for (let k = 0; k < 8; k++) splash(SIGN.x + 6 + rnd() * (SIGN.w - 12), SIGN.y + 2, -4 + rnd() * 8, -10 - rnd() * 8, 1.4 + rnd(), k & 1 ? M : L, -6);
      return;
    }
    s[SH] = 0;
    for (let k = 0; k < 9; k++) splash(x, SIGN.y - 2, -40 + rnd() * 80, -50 - rnd() * 50, 0.35 + rnd() * 0.3, k & 1 ? I : C);
  }
  /** On load: a light drizzle passes. */
  const drizzle = () => (s[DRZ] = 3.2);

  // The downpour's shape: up in half a second, a heavy two seconds, easing to a drizzle by 6.5 s,
  // the drizzle to 8.5 s, then dry.
  const curve = (t: number) => {
    if (t < 0) return 0;
    if (t < 0.5) return (t / 0.5) ** 2 * (3 - (2 * t) / 0.5);
    if (t < 2.6) return 1;
    if (t < 6.5) { const k = (t - 2.6) / 3.9; return 1 - 0.9 * k * k * (3 - 2 * k); }
    return t < 8.5 ? 0.1 : 0;
  };

  function step(dt: number) {
    s[CLOCK] = s[CLOCK]! + dt;
    if (s[T]! >= 0 && (s[T] = s[T]! + dt) > 8.5) s[T] = -1;
    if (s[DRZ]! > 0) s[DRZ] = Math.max(0, s[DRZ]! - dt);
    const it = Math.max(curve(s[T]!) * (0.8 + 0.2 * s[LVL]!), s[DRZ]! > 0 ? 0.09 : 0);
    s[INT] = it;
    s[WIND] = -(0.12 + 0.16 * it);
    // The passer-by: strolls left to right under the umbrella (runs once startled), then is gone.
    if (s[WX]! > -90) {
      const v = s[RUN] ? 46 : 17;
      s[WX] = s[WX]! + v * dt;
      s[WS] = s[WS]! + v * dt;
      if (s[WX]! > GW + 8) s[WX] = -99;
    }
    const ux = s[WX]! + 5, uy = WALK - 1 - 14 - (s[RUN] ? 1 : 0); // the canopy's centre and top
    // New drops across the top (and off the right edge, which the wind blows in from).
    s[CARRY] = s[CARRY]! + dt * 230 * it;
    while (s[CARRY]! >= 1) {
      s[CARRY] = s[CARRY]! - 1;
      const q = rnd(), z = q < 0.38 ? 0 : q < 0.75 ? 1 : 2, vy = (z === 0 ? 95 : z === 1 ? 135 : 180) * (0.88 + rnd() * 0.24);
      const gy = z === 0 ? HORIZON - 4 - rnd() * 8 : z === 1 ? HORIZON + rnd() * 12 : 74 + rnd() * 16;
      drop(rnd() * (GW + 30), -4 - rnd() * 8, vy * s[WIND]!, vy, gy, z);
    }
    // Water off the awning: it collects what lands on it and sheets off the front edge.
    if (s[AWN]! > 0) {
      s[DRIP] = s[DRIP]! + dt * Math.min(40, s[AWN]! * 6);
      s[AWN] = Math.max(0, s[AWN]! * (1 - 1.5 * dt) - 0.3 * dt);
      while (s[DRIP]! >= 1) (s[DRIP] = s[DRIP]! - 1), drop(120 + rnd() * 30, 48, 0, 10 + rnd() * 20, HORIZON + 1 + rnd() * 2, 3);
    }
    // Drops fall; a mid drop over the sign lands on it; over the awning, on it; else on the ground.
    for (let i = n[0]! - 1; i >= 0; i--) {
      const z = Z[i]!, y0 = Yd[i]!;
      if (z === 3) VY[i] = VY[i]! + 260 * dt;
      X[i] = X[i]! + VX[i]! * dt;
      const y = (Yd[i] = y0 + VY[i]! * dt), x = X[i]!;
      let hit = y >= GY[i]!, sign = false, awn = false;
      if (z === 1 && y0 < SIGN.y - 3 && y >= SIGN.y - 3 && x >= SIGN.x - 3 && x < SIGN.x + SIGN.w + 3) hit = sign = true;
      if ((z === 1 || z === 2) && y0 < 43 && y >= 43 && x >= 119 && x < 151) hit = awn = true;
      let brolly = false;
      if (z === 2 && y0 < uy && y >= uy - 1 && Math.abs(x - ux) <= 5.5) hit = brolly = true;
      if (!hit) continue;
      const m = (n[0] = n[0]! - 1), c = (i & 1) ? C : V;
      if (sign) {
        splash(x, SIGN.y - 4, -8 + rnd() * 16, -25 - rnd() * 20, 0.25, C);
        // A short: water gets into the sign. Likelier the worse the storm; one is owed per tap once
        // it's past level 1, so tapping on is how you blow it.
        if (s[SHCD]! <= 0 && s[BLOW]! < 0 && s[INT]! > 0.6 && ((s[OWED] && s[T]! > 0.7) || rnd() < 0.006 * s[LVL]! * s[LVL]!)) short(x);
      } else if (brolly) {
        // Off the umbrella: a bounce outwards, and a drip off the rim.
        const side = x < ux ? -1 : 1;
        splash(x, uy - 1, side * (20 + rnd() * 20), -15 - rnd() * 15, 0.25, I);
        if (rnd() < 0.3) drop(ux + side * 5, uy + 3, 0, 20, WALK - 1, 3);
      } else if (awn) {
        s[AWN] = Math.min(8, s[AWN]! + 0.35);
        if (rnd() < 0.5) splash(x, 42, -10 + rnd() * 20, -20 - rnd() * 15, 0.2, I);
      } else {
        const gy = Math.round(GY[i]!), pud = z === 0 ? -1 : inPuddle(Math.round(x), gy);
        if (pud >= 0) ripple(x, gy, pud);
        else if (z > 0) {
          splash(x, gy - 1, -18 - rnd() * 10, -22 - rnd() * 22, 0.22, c);
          splash(x, gy - 1, 12 + rnd() * 10, -22 - rnd() * 22, 0.22, c);
          if (z === 3 && x > 126 && x < 146) s[FLINCH] = 0.25;
        } else if (rnd() < 0.3) splash(x, gy, 0, -12, 0.12, V);
      }
      X[i] = X[m]!, Yd[i] = Yd[m]!, VX[i] = VX[m]!, VY[i] = VY[m]!, GY[i] = GY[m]!, Z[i] = Z[m]!;
    }
    for (let i = n[1]! - 1; i >= 0; i--) {
      if ((SL[i] = SL[i]! - dt) <= 0) {
        const m = (n[1] = n[1]! - 1);
        SX[i] = SX[m]!, SY[i] = SY[m]!, SVX[i] = SVX[m]!, SVY[i] = SVY[m]!, SL[i] = SL[m]!, SC[i] = SC[m]!, SG[i] = SG[m]!;
        continue;
      }
      SVY[i] = SVY[i]! + SG[i]! * dt;
      SX[i] = SX[i]! + SVX[i]! * dt;
      SY[i] = SY[i]! + SVY[i]! * dt;
    }
    for (let i = n[2]! - 1; i >= 0; i--) {
      if ((RA[i] = RA[i]! + dt) >= 0.7) {
        const m = (n[2] = n[2]! - 1);
        RX[i] = RX[m]!, RY[i] = RY[m]!, RA[i] = RA[m]!;
      }
    }
    for (let k = 0; k < 3; k++) s[RIP0 + k] = Math.max(0, s[RIP0 + k]! * (1 - 1.6 * dt) - 0.02 * dt);
    // The short's flicker: off and on for half a second, buzzing (a fixed pattern of 50 ms beats).
    if (s[SHCD]! > 0) s[SHCD] = s[SHCD]! - dt;
    if (s[SH]! >= 0) {
      // Each short buzzes longer than the last (the sign's damage).
      const b = Math.floor((s[SH] = s[SH]! + dt) / 0.05), end = 7 + 6 * s[DMG]!;
      s[LIT] = b >= end ? 1 : (0b1011001011010010100110101 >> b) & 1;
      if (b >= end) s[SH] = -1;
    }
    if (s[BLOW]! >= 0) {
      // Blown: dark three seconds, a sputter back to life, then lit again (and the storm resets).
      const b = (s[BLOW] = s[BLOW]! + dt);
      s[LIT] = b < 3.2 ? 0 : b < 3.9 ? (0b0101101 >> Math.floor((b - 3.2) / 0.1)) & 1 : 1;
      if (b >= 4.6) s[BLOW] = -1;
    }
    if (s[FL]! > -5 && s[FL] !== -1) {
      const was = s[FL]!;
      s[FL] = was + dt;
      if (was < 0 && s[FL]! >= 0) {
        // The bolt: a ragged line down from the cloud, somewhere over the far towers.
        s[BX] = 56 + rnd() * 26;
        let x = 0;
        for (let k = 0; k < BOLT.length; k++) BOLT[k] = x = Math.max(-6, Math.min(6, x + Math.round(rnd() * 4 - 2)));
      }
      if (s[FL]! > 0.3) s[FL] = -1;
    }
    if (s[FLINCH]! > 0) s[FLINCH] = s[FLINCH]! - dt;
  }

  function busy() {
    return s[T]! >= 0 || s[DRZ]! > 0 || s[BLOW]! >= 0 || s[WX]! > -90 || n[0]! > 0 || n[1]! > 0 || n[2]! > 0 || s[SH]! >= 0 || s[FL] !== -1 || s[AWN]! > 0 || s[FLINCH]! > 0 || s[RIP0]! + s[RIP0 + 1]! + s[RIP0 + 2]! > 0.001;
  }

  /** Lightning on now: 0.00–0.06 s and 0.10–0.18 s after it strikes. */
  const flashing = () => { const f = s[FL]!; return (f >= 0 && f < 0.06) || (f >= 0.1 && f < 0.18); };

  function paint() {
    px.set(bg);
    const flash = flashing();
    if (flash) {
      for (let i = 0; i < HORIZON * GW; i++) px[i] = FLASH[px[i]!]!;
      const bx = s[BX]!;
      for (let k = 0; k < BOLT.length; k++) {
        const x = bx + BOLT[k]!, y = 6 + k;
        dot(p, x, y, I);
        if (k > 0 && BOLT[k] !== BOLT[k - 1]) dot(p, bx + BOLT[k - 1]!, y, I);
        if (k === 9) for (let j = 1; j < 6; j++) dot(p, x + j, y + j, M);
      }
    }
    // The puddles: the street above, upside down and squashed three to one, the sign's text (lit
    // or not) where its hole is; each row shifted by the ripples on that puddle.
    const t = s[CLOCK]!, lit = s[LIT]!;
    for (let y = WALK + 2; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const pud = inPuddle(x, y);
        if (pud < 0 || inPuddle(x, y - 1) < 0) continue; // the near rim stays: it catches the light
        const r = REF[pud]!, e = s[RIP0 + pud]!, sx = Math.round(x + Math.sin(y * 1.9 + t * 9 + pud) * e * 1.6), sy = Math.round(r[1] - (y - r[0]) * r[2]);
        if (sx < 0 || sx >= GW || sy < 0 || sy >= HORIZON) continue;
        let c = px[sy * GW + sx]!;
        if (c === H) c = text[(sy - SIGN.y) * SIGN.w + sx - SIGN.x] ? (lit ? C : L) : K;
        // Bright things reflect (dimmed on every third row: water); the rest is dark water.
        px[y * GW + x] = BRIGHT[c] ? ((y + (e > 0.2 ? Math.round(t * 20) : 0)) % 3 === 0 ? L : c) : c === K ? K : L;
      }
    // Rings on the puddles.
    for (let i = 0; i < n[2]!; i++) {
      const a = RA[i]!, r = 1 + a * 9, c = a < 0.2 ? C : a < 0.42 ? V : L;
      for (let k = 0; k < 16; k++) {
        const x = Math.round(RX[i]! + Math.cos(k * 0.3927) * r), y = Math.round(RY[i]! + Math.sin(k * 0.3927) * r * 0.32);
        if (inPuddle(x, y) >= 0) dot(p, x, y, c);
      }
    }
    // The cat in the doorway: ducks back while it pours, flinches at a drip, else sits; when the
    // sign blows it bolts inside, then peeks back out.
    const bl = s[BLOW]!;
    if (bl < 0 || bl > 2.4) blit(p, CAT[bl >= 0 && bl < 3.6 ? 1 : s[INT]! > 0.55 ? 1 : s[FLINCH]! > 0 ? 2 : 0]!, 131, 57);
    // The passer-by, in front of the shop.
    if (s[WX]! > -90) blit(p, WALKER[Math.floor(s[WS]! / 4) & 1]!, Math.round(s[WX]!), WALK - 15 - (s[RUN] ? 1 : 0));
    // The rain: far drops are short and violet and pass behind the sign; mid ones too; near ones
    // are long, cyan or violet with a white head, in front of everything.
    const w = s[WIND]!;
    for (let i = 0; i < n[0]!; i++) {
      const z = Z[i]!, x = X[i]!, y = Yd[i]!, len = z === 0 ? 2 : z === 1 ? 3 : z === 2 ? 5 : 2;
      const c = z === 0 ? V : z === 3 ? C : i & 1 ? C : V;
      for (let k = 0; k < len; k++) {
        const xx = Math.round(x - w * k), yy = Math.round(y - k);
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        const o = yy * GW + xx;
        if (z < 2 && bg[o] === H) continue;
        px[o] = z === 2 && k === 0 ? I : c;
      }
    }
    for (let i = 0; i < n[1]!; i++) dot(p, SX[i]!, SY[i]!, SC[i]!);
  }

  return { step, paint, busy, tap, drizzle, state: s, lit: () => s[LIT]! > 0 };
}

export type RainScene = { engine: ReturnType<typeof createEngine>; pour(): void; destroy(): void };

/**
 * The slot mount: the street on a pixel canvas in the stage; a tap brings the downpour. The sign is
 * the stage's own element ([data-neon-sign]): its flicker is one attribute, set through the ledger.
 */
export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RainScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const p = pixels(GW, GH), w = rain(p, (Math.random() * 4294967296) >>> 0), view = pixelCanvas(engine.ledger, stage, p, PALETTE);
  const sign = slot.querySelector<HTMLElement>("[data-neon-sign]");
  const dirty = new Uint8Array([1]);
  const pour = () => (w.tap(), engine.wake());
  if (first) w.tap();
  else w.drizzle();
  stage.addEventListener("pointerdown", (e) => e.isPrimary && pour(), { signal: engine.signal });
  engine.add({
    step(e, dt) {
      w.step(dt);
      if (w.busy()) (e.busy(), (dirty[0] = 1));
    },
    render(e) {
      // The sign goes dark only while a short has it (change-only: the ledger skips a same write).
      if (sign) e.ledger.attr(sign, "data-short", w.lit() ? null : "");
      if (!dirty[0]) return;
      dirty[0] = 0;
      w.paint();
      view.show();
    },
  });
  engine.start();
  return { engine, pour, destroy: () => engine.destroy() };
}

/** The poster: the same street, run headless into the heavy rain, as one still frame. */
export function poster() {
  const p = pixels(GW, GH), w = rain(p, 11);
  w.tap();
  for (let i = 0; i < 60 * 0.8; i++) w.step(1 / 60);
  w.state[4] = -1; // the poster's sign is lit
  w.state[17] = 1;
  w.paint();
  return p;
}
