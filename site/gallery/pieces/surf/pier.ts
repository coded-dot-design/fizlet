// "Shoot the Pier" (surf-sesh; Lip Line's second wave): a puffin rides a big side-on wave down the
// beach, and an old pier stands across the line. Its pilings hang from the deck, braced with
// crossbeams, so each bay between two pilings leaves one open window: steer through it (hold and
// drag up and down the stage, or hold Space / ↑ to climb and ↓ to drop). Every window threaded pushes
// you further ahead of the whitewater wall sweeping in from the left; dead centre is a SHOT. A gull
// glides low across the face and a flying fish hops along the flat. Hit a beam, the gull, the fish
// or let the wall catch you and a foam ball rolls over the frame. At the end the wave runs down into
// the shorebreak, the beach slides in, the crowd cheers and the banner shows your points.
// Bricks: the kernel (fixed step; settle: it sleeps on the banner and when idle; its ledger for every
// page write, so Recall gives the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The rig
// (pixel canvas, hold + steer input, keys, synth, spray, pop words) and the sea's art: kit.ts. The
// ride is `pierRun()`: plain numbers, no DOM (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEEP, DEMO, DONE, FACE, FOAM2, GULL, H, HOP, IDLE, KEY, NUM, PLAY, SKY, SKY2, TEAL2, W, WATER, WOOD, WOOD2, rig, spray, words, type Pad } from "./kit";
import { line, print, textW } from "../pix";

/** The face (the lip's line and the trough), the camera's speed, a bay's width, the rider's home x. */
export const CREST = 22, TROUGH = 72, CAM = 46, BAY = 18, HOME = 64;
/** The course, as the scroll distance at which each thing reaches the rider: the gull, the pier's
 * three stretches (bays, window height), the fish, the gull again, the beach. */
const GULL1 = 70, FISH = 255, GULL2 = 410, BEACH = 600;
const PIERS = [140, 4, 17, 300, 4, 15, 450, 5, 13];
export const NB = 13;
// State slots.
const MODE = 0, T = 1, D = 2, Y = 3, TY = 4, RX = 5, RXH = 6, WX = 7, SCORE = 8, CHAIN = 9, BEST = 10, THREADS = 11, WIPES = 12, WIPE = 13, HELD = 14, CARD = 15;
const GX = 16, GY = 17, GK = 18, NEXTC = 19, BXS = 20, BYS = 21, BVY = 22, CAUSE = 23, SHOTS = 24, FIN = 25, LANDX = 26;
/** Events this step (for the synth): threaded, wipeout, start, the finish, a shot. */
export const EV_THREAD = 0, EV_WIPE = 1, EV_START = 2, EV_END = 3, EV_SHOT = 4;
/** What wiped you out: the wall, a beam, the gull, the fish. */
export const BY_WALL = 1, BY_BEAM = 2, BY_GULL = 3, BY_FISH = 4;
const WORDS = ["THREADED!", "SHOT!", "WIPEOUT!", "CLEAN!"];
const FOAM = 0, MIST = 1;
/** Bay states: ahead, threaded, hit or washed past. */
const AHEAD = 0, THREADED = 1, GONE = 2;

/** The ride: plain numbers (headless-testable). `pad`: [0] held, [1] presses, [3] pointer y, [4] ↓. */
export function pierRun(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(28), ev = new Uint8Array(5);
  // Bays: world x of the left piling (screen x = it − the scroll), the window's top and bottom, state,
  // and whether a stretch of pier ends after it.
  const BX = new Float64Array(NB), WT = new Float64Array(NB), WB = new Float64Array(NB), BS = new Uint8Array(NB), END = new Uint8Array(NB);
  const sp = spray(160, R), wd = words(WORDS);
  /** The face's lip at the rider: the wave runs down into the shorebreak as the beach comes in. */
  const amp = () => Math.max(0, Math.min(1, (BEACH - 40 - S[D]!) / 90));
  const crestY = () => TROUGH - amp() * (TROUGH - CREST);
  function course() {
    for (let p = 0, i = 0; p < PIERS.length; p += 3) {
      const at = PIERS[p]!, n = PIERS[p + 1]!, h = PIERS[p + 2]!;
      let c = 42 + R() * 18;
      for (let k = 0; k < n; k++, i++) {
        (BX[i] = at + HOME + k * BAY), (WT[i] = c - h / 2), (WB[i] = c + h / 2), (BS[i] = AHEAD), (END[i] = k === n - 1 ? 1 : 0);
        // The next window overlaps this one by the rider's height and a little: a line you can hold.
        c = Math.max(34, Math.min(62, c + (R() - 0.5) * 2 * (h - 10)));
      }
    }
  }
  function reset() {
    (S[Y] = S[TY] = 50), (S[RX] = S[RXH] = HOME), (S[WX] = 6), (S[CHAIN] = 0);
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[D] = 0), (S[SCORE] = 0), (S[BEST] = 0), (S[THREADS] = 0), (S[WIPES] = 0), (S[WIPE] = 0), (S[SHOTS] = 0), (S[FIN] = 0), (S[CARD] = 0);
    (S[GX] = -99), (S[NEXTC] = 0);
    reset();
    course();
    ev[EV_START] = 1;
  }
  function wipe(by: number) {
    (S[WIPE] = 0.001), (S[CAUSE] = by), (S[WIPES] = S[WIPES]! + 1), (S[CHAIN] = 0);
    (S[BXS] = S[RX]!), (S[BYS] = S[Y]!), (S[BVY] = -80);
    sp.burst(S[RX]!, S[Y]! - 4, 26, 64, -1.5708, 2.8, 2, FOAM);
    if (by === BY_GULL || by === BY_FISH) S[GX] = -99;
    wd.say(2, 80, 30, 2);
    ev[EV_WIPE] = 1;
  }
  S[MODE] = demo ? DEMO : IDLE;
  reset();
  course();
  (S[GX] = -99), (S[NEXTC] = 0);
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 1.2))) start(), (mode = PLAY);
    const riding = (mode === PLAY || mode === DEMO) && !S[FIN];
    if (riding) {
      // The camera rolls on down the line, wipeout or not.
      S[D] = S[D]! + CAM * dt;
      const d = S[D]!, a = amp(), top = crestY() + 8;
      if (S[WIPE]! > 0) {
        S[WIPE] = S[WIPE]! + dt;
        S[BVY] = S[BVY]! + 150 * dt;
        S[BYS] = S[BYS]! + S[BVY]! * dt;
        if (S[WIPE]! > 1.6) {
          (S[WIPE] = 0), reset();
          // Back up where nothing is about to hit you: the bays at hand are washed past.
          for (let i = 0; i < NB; i++) if (BS[i] === AHEAD && BX[i]! - d < HOME + 40) BS[i] = GONE;
          if (S[GX]! > 0 && S[GX]! < HOME + 50) S[GX] = -99;
        }
      } else {
        // Steering: a held pointer sets the line; Space / ↑ climbs, ↓ drops; let go and hold the line.
        let ty = S[TY]!;
        const held = mode === PLAY ? pad[0]! > 0 : true;
        if (mode === DEMO) ty = ghost();
        else if (pad[0]! > 0 && pad[3]! >= 0) ty = pad[3]! + 4;
        else if (pad[0]! > 0) ty -= 64 * dt;
        else if (pad[4]! > 0) ty += 64 * dt;
        S[HELD] = held ? 1 : 0;
        S[TY] = ty = Math.max(top, Math.min(86, ty));
        const dy = Math.max(-95 * dt, Math.min(95 * dt, (ty - S[Y]!) * Math.min(1, 12 * dt)));
        S[Y] = Math.max(top, Math.min(86, S[Y]! + dy));
        const y = S[Y]!, rx = S[RX]!;
        if (dy < -0.6 && R() < 0.5) sp.burst(rx - 5, y, 2, 30, 2.6, 0.8, 1, FOAM);
        // The pier: each bay in reach checks the window; the one you leave behind is threaded.
        for (let i = 0; i < NB; i++) {
          if (BS[i] !== AHEAD) continue;
          const x = BX[i]! - d;
          if (x + BAY <= rx) {
            BS[i] = THREADED;
            S[CHAIN] = Math.min(9, S[CHAIN]! + 1);
            S[THREADS] = S[THREADS]! + 1;
            S[BEST] = Math.max(S[BEST]!, S[CHAIN]!);
            S[RXH] = Math.min(108, S[RXH]! + 4);
            const mid = (WT[i]! + WB[i]!) / 2, shot = Math.abs(y - 4 - mid) <= 2.5;
            if (mode === PLAY) (S[SCORE] = S[SCORE]! + 5 * S[CHAIN]! + (shot ? 5 : 0)), shot && (S[SHOTS] = S[SHOTS]! + 1);
            sp.burst(rx + 3, y - 2, shot ? 14 : 8, 50, -0.6, 1.2, 1.2, MIST);
            // One word at a time: a quick run of bays doesn't stack them.
            let young = 9;
            for (let k = 0; k < wd.N; k++) young = Math.min(young, wd.T[k]!);
            if (young > 0.4) wd.say(shot ? 1 : 0, rx + 4, y - 16, shot ? 1 : 0);
            ev[shot ? EV_SHOT : EV_THREAD] = 1;
          } else if (x <= rx && (y - 7 < WT[i]! || y > WB[i]!)) {
            BS[i] = GONE;
            wipe(BY_BEAM);
            break;
          }
        }
        // The wall: steady, faster on the flat (off the wave's push) and as the ride goes on; still
        // once the wave runs down into the shorebreak.
        if (a > 0.5) S[WX] = S[WX]! + (3.5 + d * 0.006 + (y > TROUGH ? 18 : 0)) * dt;
        S[RX] = S[RX]! + Math.max(-8 * dt, Math.min(8 * dt, S[RXH]! - S[RX]!));
        if (!S[WIPE] && S[WX]! >= S[RX]! - 7) wipe(BY_WALL);
      }
      // The gull glides low across the face; the fish hops along the flat.
      if (S[GX]! > -30) {
        S[GX] = S[GX]! - (CAM + (S[GK] ? 6 : 18)) * dt;
        const u = S[GX]!, y = S[Y]!;
        S[GY] = S[GK] ? TROUGH + 6 - Math.abs(Math.sin(u * 0.09)) * 22 : 46 + Math.sin(S[T]! * 3) * 3;
        if (!S[WIPE] && Math.abs(u - S[RX]!) < 6 && S[GY]! > y - 11 && S[GY]! < y + 3) wipe(S[GK] ? BY_FISH : BY_GULL);
        if (S[GX]! < -20) S[GX] = -99;
      }
      // The critters come along the course.
      const next = S[NEXTC]!;
      if (next < 3 && d >= (next === 0 ? GULL1 - 104 / (CAM + 18) * CAM : next === 1 ? FISH - 104 / (CAM + 6) * CAM : GULL2 - 104 / (CAM + 18) * CAM)) {
        (S[GX] = HOME + 104), (S[GK] = next === 1 ? 1 : 0), (S[NEXTC] = next + 1);
      }
      // The beach: when its wet edge reaches the rider, the ride is over.
      if (BEACH + HOME + 4 - S[D]! <= S[RX]! && !S[WIPE]) {
        (S[FIN] = 0.001), (S[LANDX] = S[RX]!);
        if (mode === PLAY && !S[WIPES]) (S[SCORE] = S[SCORE]! + 25), wd.say(3, 80, 24, 1);
        if (mode === PLAY) ev[EV_END] = 1;
      }
    } else if (S[FIN]! > 0) {
      // The run-in: off the board onto the sand, the crowd up on its feet, the banner drops.
      S[FIN] = S[FIN]! + dt;
      if (mode === PLAY && S[FIN]! > 0.4) (S[MODE] = DONE), (S[CARD] = 0);
      if (mode === DEMO) (S[MODE] = IDLE), (S[FIN] = 0), (S[SCORE] = 0), reset(), course(), (S[D] = 0), (S[GX] = -99), (S[NEXTC] = 0);
    }
    if (S[MODE] === DONE) S[CARD] = S[CARD]! + dt;
    if (mode === DEMO && S[T]! > 5 && !S[WIPE]) {
      // The attract run ends once the first stretch of pier is threaded: back to the start, still.
      (S[MODE] = IDLE), (S[SCORE] = 0), reset(), course(), (S[D] = 0), (S[GX] = -99), (S[NEXTC] = 0);
    }
    const moving = sp.step(dt, 70) + wd.step(dt);
    return riding || S[WIPE]! > 0 || moving > 0 || (S[MODE] === DONE && S[CARD]! < 2.6);
  }
  /** The attract run's line: the window of the next bay, away from the gull, up off the flat. */
  function ghost() {
    const d = S[D]!, rx = S[RX]!;
    for (let i = 0; i < NB; i++) {
      const x = BX[i]! - d;
      if (BS[i] === AHEAD && x + BAY > rx && x < rx + 30) return (x + BAY - rx < 7 && i + 1 < NB && !END[i] ? (WT[i]! + WB[i]! + WT[i + 1]! + WB[i + 1]!) / 4 : (WT[i]! + WB[i]!) / 2) + 4;
    }
    if (S[GX]! > rx - 4 && S[GX]! < rx + 50) return S[GK] ? 40 : S[GY]! < 52 ? 64 : 36;
    return 48;
  }
  return { S, ev, sp, wd, step, BX, WT, WB, BS, END, ghost, amp, crestY, pad };
}
export type PierRun = ReturnType<typeof pierRun>;

export type PierScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: PierRun; poster(): void; readonly state: { mode: number; score: number; threads: number; wipes: number; shots: number; fin: number } };

const FOAMC = C.ink, SAND = C.hurt, WET = C.advance;
/** The rider: an original puffin in cyan shades, on a pink board (rows of KEY keys). */
const PUFF = ["...kkk..", "..kkkkbb", ".kkwwkko", ".kkwwkoo", "kkwwwwk.", "kkwwwwk.", ".kwwwk..", "..o.o..."];
const FAN = ["c", "a", "b", "s", "w", "o"];

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): PierScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold and drag to steer", { thread: "click", shot: "power", wipe: "boom", start: "ready", end: "win" }, true, true);
  const g = r.g;
  const ride = pierRun((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { BX, WT, WB, BS, END, sp, wd } = ride;
  if (first) r.pad[1] = 1;
  const SPRAY = [FOAMC, FOAM2];
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
  /** The lattice under or over a window: an X-brace between two pilings from y0 to y1. */
  function brace(x: number, y0: number, y1: number) {
    if (y1 - y0 < 3) return;
    g.fillStyle = WOOD;
    line(g, x + 1, y0, x + BAY - 1, y1), line(g, x + BAY - 1, y0, x + 1, y1);
  }
  engine.add({
    read() {
      r.read();
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_THREAD]) e.events.emit("thread");
      if (ev[EV_SHOT]) e.events.emit("shot");
      if (ev[EV_WIPE]) e.events.emit("wipe");
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const t = S[T]!, d = S[D]!, mode = S[MODE]!, wx = S[WX]!, fl = d * 0.7, a = ride.amp(), cy = ride.crestY();
      // Sky: two light bands, a sun, drifting cloud blocks.
      px(0, 0, W, H, SKY);
      px(0, 12, W, 10, SKY2);
      px(52, 5, 8, 8, C.hurt), px(51, 6, 10, 6, C.hurt);
      for (let k = 0; k < 3; k++) {
        const x = ((k * 61 - d * 0.08) % 190 + 190) % 190 - 20;
        px(x, 4 + k * 3, 14, 2, C.ink), px(x + 3, 2 + k * 3, 7, 2, C.ink);
      }
      // The wave face, column by column, as tall as the course lets it stand.
      const top = TROUGH - a * (TROUGH - CREST);
      for (let x = 0; x < W; x++) {
        const c = Math.round(top + Math.max(0, x - wx) / W * 8 * a + Math.sin(x * 0.11 - t * 4) * 0.8);
        if (c < TROUGH - 2) {
          px(x, c, 1, 4, C.sys);
          px(x, c + 4, 1, Math.max(0, 7 * a), TEAL2);
          px(x, c + 4 + 7 * a, 1, TROUGH - c, FACE);
          px(x, Math.max(c + 6, TROUGH - 13 * a), 1, 13 * a, DEEP);
          px(x, c + 10 + (x & 1), 1, 1, FACE);
        }
        const fr = ((x * 7 + ((fl | 0) * 3)) % 5 + 5) % 5;
        px(x, c - 1 - (fr > 3 ? 1 : 0), 1, 2, FOAMC);
      }
      for (let k = 0; k < 10 * a; k++) {
        const x = ((k * 37 + fl * 1.1) % 176) - 8, y = top + 10 + ((k * 13) % (34 * a + 1));
        px(x, y, 6 + (k % 3) * 3, 1, k & 1 ? C.sys : DEEP);
      }
      // The flat water in front, its chop band; in the run-in, the shorebreak's foam lines.
      px(0, TROUGH, W, H - TROUGH, WATER);
      for (let k = 0; k < 14; k++) px(((k * 23 - fl * 1.5) % 176 + 176) % 176 - 8, TROUGH + 2 + (k % 3) * 2, 5 + (k % 4), 1, FOAM2);
      // The beach slides in from the right: the wet edge, the sand, the crowd, the FINISH arch.
      const bx = (BEACH + HOME - 10 - d) | 0;
      if (bx < W) {
        const cheer = S[FIN]! > 0 ? Math.min(1, S[FIN]!) * (S[CARD]! < 2.4 || mode !== DONE ? 1 : 0) : 0;
        for (let y = 48; y < H; y++) px(bx + (H - y) * 0.6, y, W, 1, y < 52 ? SKY2 : y < 56 ? WET : SAND);
        for (let y = 62; y < H; y += 1) px(bx + (H - y) * 0.6 - 3, y, 3, 1, WET);
        // The crowd strip on the dune line: heads and arms, up when they cheer.
        for (let k = 0; k < 12; k++) {
          const x = bx + 12 + k * 6, hop = cheer ? ((((t * 8) | 0) + k) & 1) : 0, up = cheer && (k + ((t * 5) | 0)) % 3 !== 0;
          if (x > W) break;
          const col = KEY[FAN[k % 6]!]!;
          px(x, 50 - hop, 4, 6, C.rim), px(x + 1, 51 - hop, 2, 4, col);
          px(x + 1, 47 - hop, 2, 2, C.rim);
          if (up) px(x - 1, 45 - hop, 1, 3, C.rim), px(x + 4, 45 - hop, 1, 3, C.rim);
        }
        // An umbrella and the FINISH arch over the landing.
        px(bx + 70, 58, 1, 10, C.rim), px(bx + 64, 56, 13, 2, C.attack), px(bx + 67, 56, 3, 2, C.ink), px(bx + 66, 55, 9, 1, C.attack);
        px(bx + 6, 34, 2, 30, C.rim), px(bx + 46, 34, 2, 30, C.rim);
        px(bx + 4, 34, 46, 9, C.rim), px(bx + 5, 35, 44, 7, C.attack);
        print(g, "FINISH", bx + 15, 36, C.ink, 1);
      }
      // The pilings: posts from the deck down into the water (the rider rides between them).
      for (let i = 0; i < NB; i++) {
        const x = (BX[i]! - d) | 0;
        if (x < -BAY - 4 || x > W + 4) continue;
        px(x - 1, 0, 3, H, WOOD), px(x - 1, 0, 1, H, WOOD2);
        if (END[i]) px(x + BAY - 1, 0, 3, H, WOOD), px(x + BAY - 1, 0, 1, H, WOOD2);
      }
      // The pier's deck and bracing: over each window a crossbeam hanging from the deck, under it
      // a crossbeam braced down into the water. The next window glows.
      let lit = -1;
      for (let i = 0; i < NB; i++) {
        const x = (BX[i]! - d) | 0;
        if (x < -BAY - 4 || x > W + 4) continue;
        if (lit < 0 && BS[i] === 0 && x + BAY > S[RX]! - 3) lit = i;
        const wt = WT[i]! | 0, wb = WB[i]! | 0;
        px(x - 4, 0, BAY + 8, 4, WOOD), px(x - 4, 4, BAY + 8, 1, WOOD2);
        brace(x, 5, wt - 3);
        px(x, wt - 3, BAY, 3, WOOD), px(x, wt - 3, BAY, 1, WOOD2), px(x, wt, BAY, 1, C.rim);
        px(x, wb, BAY, 3, WOOD), px(x, wb, BAY, 1, WOOD2), px(x, wb + 3, BAY, 1, C.rim);
        brace(x, wb + 4, 88);
        if (i === lit && mode !== IDLE) {
          const m = (wt + wb) >> 1, on = ((t * 6) | 0) & 1;
          px(x + 6 + on, m - 1, 1, 3, C.go), px(x + 7 + on, m, 1, 1, C.go), px(x + 10 + on, m - 1, 1, 3, C.go), px(x + 11 + on, m, 1, 1, C.go);
        }
        if (BS[i] === 1) px(x + 2, wt + 1, BAY - 4, 1, C.go);
      }
      // The gull (two wing frames) or the flying fish.
      if (S[GX]! > -30) sprite(S[GK] ? HOP : GULL[((t * 6) | 0) & 1]!, S[GX]! - 4, S[GY]! - 2, false);
      // The rider: the puffin crouched on the board, leaning with the line; then ashore.
      if (S[FIN]! > 0) {
        const f = Math.min(1, S[FIN]! * 1.6), x = (S[LANDX]! + f * 22) | 0, y = (S[Y]! + (64 - S[Y]!) * f - Math.sin(f * 3.14) * 8) | 0;
        sprite(PUFF, x - 4, y - 8, false);
        px(x - 12, 66, 2, 9, C.attack), px(x - 12, 66, 2, 1, C.ink);
      } else if (!S[WIPE]) {
        const y = S[Y]! | 0, x = S[RX]! | 0, dv = S[TY]! - S[Y]!, tilt = dv < -1.5 ? -1 : dv > 1.5 ? 1 : 0;
        sprite(PUFF, x - 4, y - 9 + (S[HELD] && mode === PLAY ? 1 : 0), false);
        px(x - 7, y - 1 - tilt, 7, 1, C.attack), px(x, y - 1 + tilt, 7, 1, C.attack), px(x - 6, y, 13, 1, C.rim);
      } else if (S[WIPE]! < 1.1) {
        const w = S[WIPE]!, o = (w * 11) | 0;
        sprite(PUFF, S[BXS]! - 4 - w * 30, S[BYS]! - 8 + Math.sin(w * 14) * 3 + w * 8, (o & 1) > 0, (o & 2) > 0);
        const v = ((w * 12) | 0) & 1;
        px(S[BXS]! - (v ? 1 : 5), S[BYS]! - 6 - (v ? 5 : 1), v ? 2 : 10, v ? 10 : 2, C.attack);
      }
      // The whitewater wall sweeping in from the left: streaks, a frothy edge, the lip pitching.
      if (wx > -12 && a > 0.05) {
        g.save();
        g.beginPath();
        g.moveTo(-1, top - 7);
        for (let y = top - 7; y <= TROUGH + 4; y += 2) g.lineTo(Math.round(wx - (y - top) * 0.35 - (((y * 5 + (fl | 0)) % 4) + 4) % 4), y);
        g.lineTo(-1, TROUGH + 4);
        g.clip();
        px(-1, top - 7, wx + 2, TROUGH - top + 12, FOAMC);
        for (let x = 0; x < wx + 1; x += 2) {
          const col = ((x * 3 + ((fl | 0) >> 1)) % 5 + 5) % 5;
          if (col > 2) px(x, top - 7 + ((x * 7) % 9), 1, TROUGH - top + 4, col === 3 ? FOAM2 : C.sys);
        }
        g.restore();
        for (let k = 0; k <= 32; k++) {
          const u = (k & 15) / 15, hx = wx + 2 + u * 16, hy = top - Math.sin(u * 3.1416) * 7 * a + u * u * 9 * a;
          if (k < 16) px(hx, hy + 2, 1, 7 * u * a, DEEP);
          else px(hx, hy, 2, 2, u > 0.85 ? FOAM2 : FOAMC);
        }
      }
      // The shorebreak: in the run-in, lines of foam roll in ahead of the rider.
      if (a < 1) for (let k = 0; k < 5; k++) {
        const x = ((k * 41 + d * 0.9) % 200) - 30;
        px(x, cy + 1 + (k % 2) * 3, 18 + (k % 3) * 6, 2, FOAMC), px(x + 3, cy + 3 + (k % 2) * 3, 10, 1, FOAM2);
      }
      // The wipeout: a foam ball rolls over the rider and floods the frame, then drains.
      if (S[WIPE]! > 0) {
        const w = S[WIPE]!, rad = Math.min(130, 6 + w * w * 120), cx = S[BXS]! - 8 + w * 24, cyy = S[BYS]! - 4;
        const drain = w > 1.15 ? Math.min(1, (w - 1.15) / 0.45) : 0;
        g.save();
        g.beginPath();
        g.rect(0, H * drain, W, H);
        g.clip();
        for (let k = 0; k < 28; k++) {
          const an = w * 9 + k * 0.62, rr = rad * (0.35 + ((k * 7) % 10) / 15), s = 4 + (k % 4) * 3 + rad * 0.12;
          px(cx + Math.cos(an) * rr - s / 2, cyy + Math.sin(an) * rr * 0.8 - s / 2, s, s, k % 3 ? FOAMC : FOAM2);
        }
        if (rad > 80) {
          px(0, 0, W, H, FOAMC);
          for (let k = 0; k < 40; k++) px((k * 37 + w * 60) % W, (k * 23 + w * 30) % H, 2 + (k % 3), 2 + (k % 3), FOAM2);
        }
        g.restore();
      }
      r.drawSpray(sp, SPRAY);
      for (let i = 0; i < wd.N; i++) {
        const u = wd.T[i]!;
        if (u < 1.1) say(WORDS[wd.I[i]!]!, Math.max(20, Math.min(140, wd.X[i]!)), Math.max(14, (wd.Y[i]! - u * 8) | 0), WCOL[wd.K[i]!]!, wd.I[i]! === 2 || wd.I[i]! === 3 ? 2 : 1);
      }
      // The score chip, and the run to the beach: a strip that fills toward the flag.
      const sc = NUM[Math.min(999, S[SCORE]! | 0)]!;
      px(3, 3, textW(sc) + 6, 9, C.rim);
      print(g, sc, 6, 5, C.hurt, 1);
      if (mode === PLAY) {
        px(3, 13, 30, 2, C.rim), px(4, 13, 28 * Math.min(1, d / BEACH), 1, C.go), px(32, 10, 1, 4, C.rim), px(33, 10, 2, 2, C.attack);
      }
      if (mode === IDLE || (mode === DEMO && t > 4)) say("HOLD + DRAG TO STEER", 80, 80, C.ink, 1);
      if (mode === DONE && S[CARD]! > 0.3) {
        // The points banner, dropping in over the beach.
        const drop = Math.min(1, (S[CARD]! - 0.3) * 4), y0 = (-22 + drop * 38) | 0;
        px(36, y0, 88, 26, C.rim), px(37, y0 + 1, 86, 24, C.cmd), px(37, y0 + 1, 86, 2, C.attack);
        const sw = textW(sc, 2), x0 = 80 - ((sw + 14) >> 1);
        say(sc, x0 + (sw >> 1), y0 + 5, C.hurt, 2);
        print(g, "PTS", x0 + sw + 3, y0 + 10, C.ink, 1);
        const th = NUM[S[THREADS]! | 0]!;
        print(g, th, 46, y0 + 18, C.ink, 1), print(g, "/13 BAYS", 46 + textW(th) + 1, y0 + 18, C.ink, 1);
        print(g, S[WIPES] ? "WASHED" : "CLEAN", 94, y0 + 18, S[WIPES] ? C.muted : C.go, 1);
        if (S[CARD]! > 1.2) say("TAP TO GO AGAIN", 80, 82, C.ink, 1);
      }
    },
  });

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, threads: S[THREADS]!, wipes: S[WIPES]!, shots: S[SHOTS]!, fin: S[FIN]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, threading the first stretch of pier ahead of the wall. */
export const posterAt = 3.9;
