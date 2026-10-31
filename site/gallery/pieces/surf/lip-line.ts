// "Lip Line" (surf-sesh): Pip the pixel narwhal rides a big side-on wave. The breaking section, a
// wall of whitewater, sweeps in from the left behind you: ride low on the face to run ahead of it,
// climb to the lip to SNAP off it for points (snaps chain), but up high you slow down and the wall
// gains. An old pier's pilings hang down into the face (ride under them) and a gull glides low
// across it (ride over it). The wall, a piling or the gull wipes you out: the frame floods with
// foam, the board pops up, and you get the next ride. Ten seconds, then the score card, then it
// sleeps until the next press.
// Chunky pixel art on one 160 × 90 canvas scaled up crisp; the caption font is pix.ts's 3 × 5.
// Bricks: the kernel (fixed step; settle: it sleeps on the card and when idle; its ledger for every
// page write, so Recall gives the page back byte for byte), fzlt/slot, fzlt/sound. The rig
// (canvas, hold input, keys, synth, spray): kit.ts. The ride itself is `lipLine()`, plain numbers, no
// DOM, so its step is tested headless (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, W, rig, spray, words, type Pad } from "./kit";
import { print, textW } from "../pix";

export const ROUND = 10;
/** The face: the lip's line, the trough; the camera's speed along the wave. */
export const CREST = 24, TROUGH = 74, CAM = 30;
const NP = 6;
// State slots.
const MODE = 0, T = 1, LEFT = 2, Y = 3, VY = 4, RX = 5, WX = 6, SCORE = 7, CHAIN = 8, BEST = 9, SNAPS = 10, WIPES = 11, WIPE = 12, FLOW = 13, HELD = 14, CARD = 15;
const NEXTP = 16, GX = 17, GY = 18, NEXTG = 19, BX = 20, BY = 21, BVY = 22, CAUSE = 23, GK = 24, AIR = 25, AIRS = 26, RYW = 27;
/** Events this step (for the synth): snap, wipeout, start, end. */
export const EV_SNAP = 0, EV_WIPE = 1, EV_START = 2, EV_END = 3;
/** What wiped you out: the wall, the pier (a piling or a crossbeam), the gull or the hopper. */
export const BY_WALL = 1, BY_PILING = 2, BY_GULL = 3;
const WORDS = ["SNAP!", "RAD!", "AIR!", "WIPEOUT!"];
/** Spray slots: foam, mist. */
const FOAM = 0, MIST = 1;

/** The ride: plain numbers (headless-testable). `pad`: [0] held, [1] presses. */
export function lipLine(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(28), ev = new Uint8Array(4);
  // Pilings: x on screen, how far down the face they hang (art y of the bottom); -99 none.
  const PX = new Float64Array(NP).fill(-99), PB = new Float64Array(NP), PL = new Uint8Array(NP); // PL: a crossbeam to the next piling
  const sp = spray(140, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  reset();
  if (demo) pier(150), (S[NEXTP] = 4.5);
  else (S[GX] = 120), (S[GY] = 64); // the still: a gull on the face
  /** The rider's art y (feet on the board). */
  const ry = () => TROUGH - S[Y]! * (TROUGH - CREST);
  function reset() {
    (S[Y] = 0.4), (S[VY] = 0), (S[RX] = 74), (S[WX] = 8), (S[NEXTP] = 1.2), (S[NEXTG] = 2.6), (S[GX] = -99), (S[CHAIN] = 0);
    PX.fill(-99);
  }
  /** A stretch of pier: three or four pilings, each hanging to its own depth. */
  function pier(x: number) {
    const n = 3 + (R() < 0.5 ? 1 : 0), deep = 38 + R() * 10;
    for (let k = 0, i = 0; k < n && i < NP; i++) if (PX[i]! < -40) (PX[i] = x + k * 15), (PB[i] = deep + (R() - 0.5) * 6), (PL[i] = k < n - 1 ? 1 : 0), k++;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[BEST] = 0), (S[SNAPS] = 0), (S[WIPES] = 0), (S[WIPE] = 0);
    reset();
    ev[EV_START] = 1;
  }
  function wipe(by: number) {
    (S[WIPE] = 0.001), (S[AIR] = 0), (S[CAUSE] = by), (S[WIPES] = S[WIPES]! + 1), (S[CHAIN] = 0);
    const y = ry();
    // The board pops up out of the foam; the rider is gone into it.
    (S[BX] = S[RX]!), (S[BY] = S[RYW] = y), (S[BVY] = -90);
    sp.burst(S[RX]!, y - 4, 24, 60, -1.5708, 2.8, 2, FOAM);
    if (by === BY_GULL) S[GX] = -99;
    wd.say(3, 80, 30, 2);
    ev[EV_WIPE] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 0.8))) start(), (mode = PLAY);
    const riding = mode === PLAY || mode === DEMO;
    if (riding && S[WIPE]! > 0) {
      // The wipeout: the foam floods the frame, then the next ride.
      S[WIPE] = S[WIPE]! + dt;
      S[BVY] = S[BVY]! + 160 * dt;
      S[BY] = S[BY]! + S[BVY]! * dt;
      S[WX] = S[WX]! + 210 * dt;
      if (S[WIPE]! > 1.65) (S[WIPE] = 0), reset();
    } else if (riding) {
      // Who holds: the rider, or (the attract run) a ghost that reads the face ahead.
      const held = mode === PLAY ? pad[0]! > 0 : S[Y]! + S[VY]! * 0.2 < ghost();
      S[HELD] = held ? 1 : 0;
      if (S[AIR]) {
        // Air off the lip: a short hop above the crest, then land it back on the face.
        S[VY] = S[VY]! - 10 * dt;
        S[Y] = S[Y]! + S[VY]! * dt;
        if (S[Y]! <= 1) {
          (S[AIR] = 0), (S[Y] = 0.99), (S[VY] = -1.2);
          if (mode === PLAY) (S[SCORE] = S[SCORE]! + 20 * S[CHAIN]!), (S[AIRS] = S[AIRS]! + 1);
          sp.burst(S[RX]!, CREST, 16, 50, -1.5708, 2.4, 1.4, FOAM);
          wd.say(2, S[RX]! + 6, CREST - 12, 1);
          ev[EV_SNAP] = 1;
        }
      } else {
        S[VY] = S[VY]! + (held ? 3.6 : -4) * dt;
        S[VY] = S[VY]! * (1 - 0.5 * dt);
        S[Y] = S[Y]! + S[VY]! * dt;
      }
      if (S[Y]! <= 0) {
        if (S[VY]! < -0.6) sp.burst(S[RX]! - 3, TROUGH, 5, 26, -2.6, 0.9, 1, FOAM);
        (S[Y] = 0), (S[VY] = 0);
      }
      if (S[Y]! >= 1 && !S[AIR] && S[VY]! > 1.7) {
        // Up the face fast: launch.
        (S[AIR] = 1), (S[CHAIN] = Math.min(9, S[CHAIN]! + 1));
        sp.burst(S[RX]!, CREST - 1, 18, 60, -1.7, 1.4, 1.4, FOAM);
      } else if (S[Y]! >= 1 && !S[AIR]) {
        // The snap off the lip: spray, points, the chain grows.
        S[Y] = 1;
        S[CHAIN] = Math.min(9, S[CHAIN]! + 1);
        if (mode === PLAY) (S[SCORE] = S[SCORE]! + 10 * S[CHAIN]!), (S[SNAPS] = S[SNAPS]! + 1), (S[BEST] = Math.max(S[BEST]!, S[CHAIN]!));
        S[VY] = -1.7;
        sp.burst(S[RX]! + 2, CREST - 1, 22, 70, -1.9, 1.6, 1.4, FOAM);
        sp.burst(S[RX]!, CREST - 3, 8, 40, -1.6, 2.4, 2, MIST);
        wd.say(S[CHAIN]! > 2 ? 1 : 0, S[RX]! + 6, CREST - 10, S[CHAIN]! > 2 ? 1 : 0);
        ev[EV_SNAP] = 1;
      }
      // Low on the face is fast, up at the lip is slow; the wall sweeps right, faster as the ride goes on.
      const v = 20 + 26 * (1 - S[Y]!);
      S[RX] = Math.min(132, S[RX]! + (v - CAM) * dt);
      S[WX] = S[WX]! + (4.5 + (mode === PLAY ? (ROUND - S[LEFT]!) * 0.9 : 0)) * dt;
      if (S[WX]! >= S[RX]! - 6) wipe(BY_WALL);
      // The pier and the gull come along the face toward you.
      const y = ry();
      for (let i = 0; i < NP; i++) {
        if (PX[i]! < -40) continue;
        PX[i] = PX[i]! - CAM * dt;
        if (!S[WIPE] && S[RX]! > PX[i]! - 4.5 && S[RX]! < PX[i]! + (PL[i] ? 15 : 4.5) && y - 9 < PB[i]! - (S[RX]! > PX[i]! + 4.5 ? 3 : 0)) wipe(BY_PILING);
        if (PX[i]! < -20) PX[i] = -99;
      }
      S[NEXTP] = S[NEXTP]! - dt;
      if (S[NEXTP]! <= 0 && S[GX]! < S[RX]! - 10) pier(W + 8), (S[NEXTP] = 3.4 + R() * 1.4);
      if (S[GX]! > -40) {
        // The gull glides; the hopper bounces along the flat water.
        S[GX] = S[GX]! - (CAM + (S[GK] ? 8 : 22)) * dt;
        S[GY] = S[GK] ? TROUGH - 3 - Math.abs(Math.sin(S[T]! * 6)) * 9 : 63 + Math.sin(S[T]! * 3) * 3;
        if (!S[WIPE] && Math.abs(S[GX]! - S[RX]!) < 6 && Math.abs(S[GY]! - (y - 5)) < 6) wipe(BY_GULL);
        if (S[GX]! < -20) S[GX] = -99;
      }
      S[NEXTG] = S[NEXTG]! - dt;
      if (S[NEXTG]! <= 0) {
        // A gull, but never while a pier is still ahead.
        let clear = 1;
        for (let i = 0; i < NP; i++) if (PX[i]! > S[RX]! - 12) clear = 0;
        if (clear) (S[GX] = W + 10), (S[GK] = R() < 0.4 ? 1 : 0), (S[NEXTG] = 3 + R() * 1.6);
      }
      S[FLOW] = S[FLOW]! + dt;
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0 && !S[WIPE]) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1);
    } else if (mode === DEMO && S[T]! > 4.4 && !S[WIPE]) (S[MODE] = IDLE), (S[SCORE] = 0);
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    const moving = sp.step(dt, 70) + wd.step(dt);
    return riding || moving > 0 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  /** The attract run's line: under a piling ahead, over a gull ahead, else up for a snap. */
  function ghost() {
    let want = 1.3;
    for (let i = 0; i < NP; i++) if (PX[i]! > S[RX]! - 6 && PX[i]! < S[RX]! + 34) want = 0;
    if (S[GX]! > S[RX]! - 4 && S[GX]! < S[RX]! + 46) want = 0.62;
    if (S[RX]! - S[WX]! < 26) want = Math.min(want, 0.1);
    return want;
  }
  return { S, ev, sp, wd, step, ry, PX, PB, PL, ghost };
}
export type LipLine = ReturnType<typeof lipLine>;

export type LipScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: LipLine; poster(): void; readonly state: { mode: number; score: number; snaps: number; wipes: number; best: number; left: number } };

// The palette: Board UI tokens plus the sea's three in-between shades.
const TEAL2 = "#0b8aa8", SKY = "#eef0fb", SKY2 = "#e6e4f8", FACE = "#006e91", DEEP = "#0b4a6e", WATER = "#2b6fd6", FOAMC = C.ink, FOAM2 = "#bfe9ff", WOOD = "#3f296a", WOOD2 = "#6a3ae6";
/** Sprites: rows of keys (k rim, c body, s belly, w white, y tusk/beak, o orange, b board). */
const PIP = ["........y", ".......y.", "..kkkky..", ".kccccck.", "kccwkccck", "kcccccccck", "kcsssscck.", ".kkkkkkk.."];
const GULL = [["kk.......kk", "kwwk...kwwk", ".kwwkkkwwk.", "..kwwwwkok.", "....kk....."], ["....kkk....", "..kwwwwwkok", ".kwwwwwwwk.", "kwk.....kwk", "k.........k"]];
const HOP = [".k...k.", "..kak..", ".kaaak.", "kawawak", ".k.k.k."];
const KEY: Record<string, string> = { a: C.attack, k: C.rim, c: C.cmd, s: "#b48cff", w: C.ink, y: C.hurt, o: C.advance };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): LipScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to climb the wave", { snap: "power", wipe: "boom", start: "ready", end: "win" }, true);
  const g = r.g;
  const ride = lipLine((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { PX, PB, PL, sp, wd } = ride;
  if (first) r.pad[1] = 1;
  const SPRAY = [FOAMC, FOAM2, C.ink];
  const WCOL = [C.ink, C.hurt, C.attack];
  const px = (x: number, y: number, w: number, h: number, c: string) => ((g.fillStyle = c), g.fillRect(x | 0, y | 0, w, h));
  function sprite(rows: readonly string[], x: number, y: number, flip: boolean, flipY = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]!;
      for (let i = 0; i < row.length; i++) {
        const k = row[i]!;
        if (k !== ".") px(x + (flip ? row.length - 1 - i : i), y + (flipY ? rows.length - 1 - j : j), 1, 1, KEY[k]!);
      }
    }
  }
  /** Pixel text with a rim (pix.ts's 3 × 5 font), centred on x. */
  function say(s: string, x: number, y: number, c: string, k: number) {
    const w = textW(s, k), x0 = Math.round(x - w / 2);
    for (let d = 0; d < 4; d++) print(g, s, x0 + (d === 0 ? -1 : d === 1 ? 1 : 0), y + (d === 2 ? -1 : d === 3 ? 1 : 0), C.rim, k);
    print(g, s, x0, y, c, k);
  }
  /** The crest's art y at x: the wave stands tallest by the break. */
  const crest = (x: number, f: number) => CREST + Math.round((Math.max(0, x - S[WX]!) / W) * 9 + Math.sin(x * 0.11 - f * 4) * 0.8);
  engine.add({
    read() {
      r.read();
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_SNAP]) e.events.emit("snap", 0, 0, 0, 0, 1 + S[CHAIN]! / 4);
      if (ev[EV_WIPE]) e.events.emit("wipe");
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const f = S[FLOW]!, mode = S[MODE]!, wx = S[WX]!, fl = f * 30;
      // Sky: two light bands, a sun, drifting cloud blocks.
      px(0, 0, W, H, SKY);
      px(0, 12, W, 10, SKY2);
      px(128, 6, 8, 8, C.hurt), px(127, 7, 10, 6, C.hurt);
      for (let k = 0; k < 3; k++) {
        const x = ((k * 61 - f * 3) % 190 + 190) % 190 - 20;
        px(x, 5 + k * 3, 14, 2, C.ink), px(x + 3, 3 + k * 3, 7, 2, C.ink);
      }
      // The wave face, column by column: a teal face under a white lip, deep at the trough.
      for (let x = 0; x < W; x++) {
        const c = crest(x, f);
        // Bands from the lip down: cyan glint, light teal, the face, deep at the trough (dithered seams).
        px(x, c, 1, 4, C.sys);
        px(x, c + 4, 1, 7, TEAL2);
        px(x, c + 11, 1, TROUGH - c - 11, FACE);
        px(x, TROUGH - 13, 1, 13, DEEP);
        px(x, c + 10 + (x & 1), 1, 1, FACE);
        px(x, c + 4 - (x & 1), 1, 1, TEAL2);
        px(x, TROUGH - 14 - (x & 1), 1, 1, DEEP);
        // The lip: froth that bubbles along the top.
        const fr = (((x * 7 + ((fl | 0) * 3)) % 5) + 5) % 5;
        px(x, c - 1 - (fr > 3 ? 1 : 0), 1, 2, FOAMC);
      }
      // Streaks on the face run back toward the break.
      for (let k = 0; k < 10; k++) {
        const x = ((k * 37 + fl * 1.1) % 176) - 8, y = CREST + 10 + ((k * 13) % 34);
        px(x, y, 6 + (k % 3) * 3, 1, k & 1 ? C.sys : DEEP);
      }
      // The water in front of the wave: mid-blue with a lighter, streaky chop band.
      px(0, TROUGH, W, H - TROUGH, WATER);
      for (let k = 0; k < 14; k++) px(((k * 23 - fl * 1.5) % 176 + 176) % 176 - 8, TROUGH + 2 + (k % 3) * 2, 5 + (k % 4), 1, FOAM2);
      // The pier: a deck across the top, pilings hanging into the face.
      for (let i = 0; i < NP; i++) {
        const x = PX[i]! | 0;
        if (x < -30) continue;
        px(x - 8, 0, 16, 3, WOOD), px(x - 8, 3, 16, 1, WOOD2);
        px(x - 1, 3, 3, PB[i]! - 3, WOOD);
        px(x - 1, 3, 1, PB[i]! - 3, WOOD2);
        px(x - 1, PB[i]! - 1, 3, 2, C.rim);
        px(x - 2, (PB[i]! - 2) | 0, 5, 1, FOAMC); // where the face wraps the post
        if (PL[i]) px(x + 2, PB[i]! - 6, 12, 2, WOOD), px(x + 2, PB[i]! - 6, 12, 1, WOOD2), px(x + 2, 14, 12, 2, WOOD); // the crossbeams
      }
      // The gull: two wing frames, gliding low.
      if (S[GX]! > -30) sprite(S[GK] ? HOP : GULL[((f * 6) | 0) & 1]!, S[GX]! - 4, S[GY]! - 2, false);
      // The rider: Pip on a board, leaning with the face.
      if (!S[WIPE]) {
        const y = ride.ry() | 0, x = S[RX]! | 0, tilt = S[VY]! > 0.4 ? -1 : S[VY]! < -0.4 ? 1 : 0;
        sprite(PIP, x - 5, y - 9 + (S[HELD] ? 1 : 0), false);
        px(x - 7, y - 1 + tilt, 7, 1, C.attack), px(x, y - 1, 7, 1, C.attack), px(x - 6, y, 13, 1, C.rim);
      } else if (S[WIPE]! < 1.2) {
        // The fall: Pip rolls over and over in the foam, dragged back; the board flips and pops up.
        const w = S[WIPE]!, o = (w * 11) | 0;
        sprite(PIP, S[BX]! - 5 - w * 26, S[RYW]! - 7 + Math.sin(w * 14) * 3 + w * 6, (o & 1) > 0, (o & 2) > 0);
        const v = ((w * 12) | 0) & 1;
        px(S[BX]! - (v ? 1 : 5), S[BY]! - 6 - (v ? 5 : 1), v ? 2 : 10, v ? 10 : 2, C.attack);
      }
      // The breaking wall behind: vertical streaks of white and blue, a frothy diagonal edge, a
      // foam ball tumbling in the pocket.
      if (wx > -12) {
        g.save();
        g.beginPath();
        g.moveTo(-1, CREST - 7);
        for (let y = CREST - 7; y <= TROUGH + 4; y += 2) g.lineTo(Math.round(wx - (y - CREST) * 0.35 - (((y * 5 + (fl | 0)) % 4) + 4) % 4), y);
        g.lineTo(-1, TROUGH + 4);
        g.clip();
        px(-1, CREST - 7, wx + 2, TROUGH - CREST + 12, FOAMC);
        for (let x = 0; x < wx + 1; x += 2) {
          const col = ((x * 3 + ((fl | 0) >> 1)) % 5 + 5) % 5;
          if (col > 2) px(x, CREST - 7 + ((x * 7) % 9), 1, TROUGH - CREST + 4, col === 3 ? FOAM2 : C.sys);
        }
        g.restore();
        // The lip pitching out ahead of the wall: an arch of foam over a dark pocket.
        const c0 = crest(wx, f);
        for (let k = 0; k <= 32; k++) {
          const t = (k & 15) / 15, hx = wx + 2 + t * 16, hy = c0 - Math.sin(t * 3.1416) * 7 + t * t * 9;
          if (k < 16) px(hx, hy + 2, 1, 7 * t, DEEP);
          else px(hx, hy, 2, 2, t > 0.85 ? FOAM2 : FOAMC);
        }
      }
      if (wx > -10) {
        const bx = wx - 6, by = TROUGH - 8;
        for (let k = 0; k < 6; k++) {
          const a = f * 7 + k * 1.05;
          px(bx + Math.cos(a) * 4, by + Math.sin(a) * 4, 3, 3, k & 1 ? FOAMC : FOAM2);
        }
      }
      // The wipeout: the whole frame floods with foam, a white band rising under it.
      if (S[WIPE]! > 0) {
        const w = S[WIPE]!, rise = Math.min(1, Math.max(0, w - 0.55) * 2.2) * (w > 1.2 ? Math.max(0, 1 - (w - 1.2) * 2.5) : 1);
        for (let y = 0; y < H; y += 2) px(0, y, W * rise, 2, ((y >> 1) + ((fl | 0) >> 1)) % 3 ? FOAMC : FOAM2);
        if (rise > 0.6) px(0, H - 20, W, 20, FOAMC);
      }
      r.drawSpray(sp, SPRAY);
      // Words: the snaps and the wipeout.
      for (let i = 0; i < wd.N; i++) {
        const t = wd.T[i]!;
        if (t < 1.1) say(WORDS[wd.I[i]!]!, wd.X[i]!, (wd.Y[i]! - t * 8) | 0, WCOL[wd.K[i]!]!, 2);
      }
      // The score chip and the clock bar.
      px(3, 3, textW(NUM[Math.min(999, S[SCORE]! | 0)]!) + 6, 9, C.rim);
      print(g, NUM[Math.min(999, S[SCORE]! | 0)]!, 6, 5, C.hurt, 1);
      if (mode === PLAY) px(3, 13, (26 * S[LEFT]!) / ROUND, 1, S[LEFT]! < 3 ? C.attack : C.hurt);
      if (mode === IDLE || (mode === DEMO && S[T]! > 3.4)) say("HOLD TO CLIMB", 80, 82, C.ink, 1);
      if (mode === DONE && S[CARD]! > 0.5) {
        px(46, 30, 68, 30, C.rim);
        say(NUM[Math.min(999, S[SCORE]! | 0)]!, 80, 34, C.hurt, 3);
        say(S[BEST]! >= 3 ? "BIG CHAIN" : S[WIPES] ? "WASHED" : "CLEAN RIDE", 80, 47, C.ink, 1);
        if (S[CARD]! > 0.8) say("HOLD TO GO", 80, 53, C.muted, 1);
      }
    },
  });

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, snaps: S[SNAPS]!, wipes: S[WIPES]!, best: S[BEST]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, under the pier ahead of the wall (scripts/gallery-posters.mjs). */
export const posterAt = 2.4;
