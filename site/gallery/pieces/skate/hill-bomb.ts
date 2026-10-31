// "Hill Bomb" (skate-sesh): straight down a winding hill path, seen from above in chunky pixels, the
// camera rolling down the hill with you and faster every second. Hold to carve right, let go to
// carve left. Stay on the grey path (the grass slows you), shoot the gaps in the wooden fences
// (15 a gate; a fence to the shins is a slam), and where the path forks around a rocky island pick
// a side. Red slalom flags mark the edges; the run starts under the START banner. Ten seconds, then
// the score card, then you roll to a stop and it sleeps until the next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The rig: kit.ts; the bar's font: pix.ts. The run is
// `hillBomb()`, plain numbers, no DOM (tests/skate-sesh.test.mjs: zero allocation). The hill itself
// is a function of how far down you are: no tables, nothing to allocate.
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, W, rig, spray, type Pad } from "./kit";
import { print, textW } from "../pix";

export const ROUND = 10;
/** The rider's row on screen; the path's half width; the first fence and the spacing. */
export const RY = 24, HW = 17, FENCE0 = 170, FENCE_DY = 110, GAP = 8;
// State slots.
const MODE = 0, T = 1, LEFT = 2, X = 3, VX = 4, CAM = 5, SPEED = 6, SCORE = 7, SLAMS = 8, GATES = 9, SLAM = 10, CARD = 11, HELD = 12, NEXTF = 13, GRASS = 14, DIST = 15, WORD = 16, WORDT = 17;
/** Events this step: start, a gate, a slam, the end. */
export const EV_START = 0, EV_GATE = 1, EV_SLAM = 2, EV_END = 3;
const DUST = 0, CHIP = 1;

/** The path's centre x at world row wy (it winds). */
export const pathX = (wy: number) => 80 + 34 * Math.sin(wy * 0.013) + 12 * Math.sin(wy * 0.037 + 1);
/** The rocky island's half width where the path forks (0: no fork). */
export const island = (wy: number) => Math.max(0, Math.sin(wy * 0.0061 - 2.2) - 0.55) * 40;
const hash = (k: number) => {
  const s = Math.sin(k * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
/** Fence k: its row and the centre of its gap. */
export const fenceY = (k: number) => FENCE0 + k * FENCE_DY + hash(k) * 30;
export const gapX = (k: number) => pathX(fenceY(k)) + (hash(k + 7) - 0.5) * 22;

export function hillBomb(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(20), ev = new Uint8Array(4);
  const sp = spray(120, R);
  S[MODE] = demo ? DEMO : IDLE;
  (S[X] = pathX(RY)), (S[SPEED] = demo ? 40 : 0), (S[WORDT] = 9);
  /** Where the attract run (and the tests' rider) aims: the next gate, a fork's left branch, the path. */
  function ghost() {
    const wy = S[CAM]! + RY, k = S[NEXTF]!, fy = fenceY(k);
    if (fy - wy < 46 && !island(fy)) return gapX(k);
    const ahead = wy + 16, iw = island(ahead);
    return iw > 2 ? pathX(ahead) - iw - HW / 2 : pathX(ahead);
  }
  function slam() {
    (S[SLAM] = 0.8), (S[SPEED] = 14), (S[SLAMS] = S[SLAMS]! + 1), (S[VX] = 0), (S[WORD] = 1), (S[WORDT] = 0);
    sp.burst(S[X]!, RY, 14, 40, 0, 6.28, 1, CHIP);
    ev[EV_SLAM] = 1;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[SLAMS] = 0), (S[GATES] = 0), (S[DIST] = 0), (S[SLAM] = 0);
    (S[CAM] = 0), (S[NEXTF] = 0), (S[X] = pathX(RY)), (S[VX] = 0), (S[SPEED] = 40);
    ev[EV_START] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 0.8))) start(), (mode = PLAY);
    const riding = mode === PLAY || mode === DEMO;
    const held = mode === PLAY ? pad[0]! > 0 : S[X]! + S[VX]! * 0.25 < ghost();
    S[HELD] = held ? 1 : 0;
    if (riding && S[SLAM]! <= 0) {
      // Carve: hold for right, let go for left.
      S[VX] = (S[VX]! + (held ? 150 : -150) * dt) * (1 - 2.5 * dt);
      S[X] = Math.max(3, Math.min(W - 3, S[X]! + S[VX]! * dt));
      const target = 40 + (mode === PLAY ? ((ROUND - S[LEFT]!) * 45) / ROUND : 0);
      S[SPEED] = S[SPEED]! + (target - S[SPEED]!) * Math.min(1, dt * 0.8);
    } else if (S[SLAM]! > 0) S[SLAM] = Math.max(0, S[SLAM]! - dt);
    else S[SPEED] = S[SPEED]! < 1 ? 0 : S[SPEED]! * (1 - dt * 1.8);
    const wy = S[CAM]! + RY, c = pathX(wy), iw = island(wy), off = Math.abs(S[X]! - c);
    // The grass slows you and throws up dust; the island's rocks slam you.
    S[GRASS] = off > HW + iw ? 1 : 0;
    if (riding && S[SLAM]! <= 0) {
      if (S[GRASS]) (S[SPEED] = Math.max(22, S[SPEED]! * (1 - 1.4 * dt))), R() < dt * 30 && sp.burst(S[X]!, RY + 3, 1, 14, 1.5708, 1.2, 1, DUST);
      if (iw > 2 && off < iw - 1) slam(), (S[X] = c + (S[X]! < c ? -1 : 1) * (iw + HW / 2));
    }
    const dy = S[SPEED]! * dt;
    S[CAM] = S[CAM]! + dy;
    if (mode === PLAY) {
      S[DIST] = S[DIST]! + dy;
      while (S[DIST]! >= 20) (S[DIST] = S[DIST]! - 20), (S[SCORE] = S[SCORE]! + 1);
    }
    // The fences: through the gap, or into the boards.
    const k = S[NEXTF]!, fy = fenceY(k);
    if (wy >= fy) {
      S[NEXTF] = k + 1;
      if (riding && !island(fy)) {
        if (Math.abs(S[X]! - gapX(k)) > GAP - 2) slam();
        else {
          if (mode === PLAY) (S[GATES] = S[GATES]! + 1), (S[SCORE] = S[SCORE]! + 15);
          (S[WORD] = 0), (S[WORDT] = 0);
          ev[EV_GATE] = 1;
        }
      }
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0 && S[SLAM]! <= 0) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1);
    } else if (mode === DEMO && S[T]! > 3.6) S[MODE] = IDLE;
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    S[WORDT] = S[WORDT]! + dt;
    const moving = sp.step(dt, 0);
    return riding || S[SPEED]! > 0 || S[SLAM]! > 0 || moving > 0 || S[WORDT]! < 0.9 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  return { S, ev, sp, step, ghost };
}
export type HillBomb = ReturnType<typeof hillBomb>;

export type BombScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: HillBomb; poster(): void; readonly state: { mode: number; score: number; slams: number; gates: number; left: number } };

// The hillside: two greens dithered, the path's greys, the fence's wood, the flags' red.
const RED = "#ff2b4e", G1 = "#1f6b3a", G2 = "#2f8a4a", PATH = "#8d88a8", EDGE = "#5d5684", ROCK = "#b9b2e3", WOOD = "#a0522d", WOOD2 = "#6b3a1f";
/** The rider from above (k rim, b board, s shirt, h head). */
const RIDER = [".kkk.", "kbbbk", "kbsbk", "ksssk", "kshsk", "ksssk", "kbsbk", "kbbbk", ".kkk."];
const KEY: Record<string, string> = { k: C.rim, b: C.attack, s: C.cmd, h: C.hurt };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): BombScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to carve right, let go to carve left", { start: "ready", gate: "power", slam: "hurt", end: "win" }, true);
  const g = r.g;
  const ride = hillBomb((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S;
  if (first) r.pad[1] = 1;
  const DEBRIS = ["#c8b98a", WOOD];
  let grass: CanvasPattern | string = G1;
  const px = (x: number, y: number, w: number, h: number, c: string | CanvasPattern) => ((g.fillStyle = c), g.fillRect(x | 0, y | 0, w, h));
  /** Pixel text with a rim (pix.ts's 3 × 5 font), centred on x. */
  function say(s: string, x: number, y: number, c: string, k: number) {
    const x0 = Math.round(x - textW(s, k) / 2);
    for (let d = 0; d < 4; d++) print(g, s, x0 + (d === 0 ? -1 : d === 1 ? 1 : 0), y + (d === 2 ? -1 : d === 3 ? 1 : 0), C.rim, k);
    print(g, s, x0, y, c, k);
  }
  engine.add({
    read() {
      r.read();
      if (typeof grass === "string") {
        // The dither: a 2 × 2 tile, made once.
        const t = document.createElement("canvas");
        t.width = t.height = 2;
        const tg = t.getContext("2d")!;
        (tg.fillStyle = G1), tg.fillRect(0, 0, 2, 2), (tg.fillStyle = G2), tg.fillRect(0, 0, 1, 1), tg.fillRect(1, 1, 1, 1);
        grass = g.createPattern(t, "repeat") ?? G1;
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_GATE]) e.events.emit("gate");
      if (ev[EV_SLAM]) e.events.emit("slam");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const cam = S[CAM]!, mode = S[MODE]!, sh = cam | 0;
      // Grass, dithered and scrolling with the hill.
      g.setTransform(1, 0, 0, 1, 0, -(sh & 1));
      px(0, 0, W, H + 2, grass);
      g.setTransform(1, 0, 0, 1, 0, 0);
      // Rocky patches on the grass.
      for (let cell = Math.floor(cam / 11); cell * 11 < cam + H; cell++) {
        const h = hash(cell), x = h * W, y = cell * 11 - cam;
        if (Math.abs(x - pathX(cell * 11)) < HW + island(cell * 11) + 5) continue;
        px(x, y, 5, 3, EDGE), px(x + 1, y - 1, 3, 1, ROCK), px(x + 3, y + 1, 1, 1, ROCK);
      }
      // The path, row by row, with its rocky island where it forks.
      for (let y = 0; y < H; y++) {
        const wy = cam + y, c = pathX(wy), iw = island(wy), w = HW + iw;
        px(c - w - 1, y, 2 * w + 2, 1, EDGE);
        px(c - w, y, 2 * w, 1, PATH);
        if ((((wy | 0) * 7) & 15) === 3) px(c - w + hash(wy | 0) * 2 * w, y, 2, 1, EDGE); // cracks
        if (iw > 1) px(c - iw, y, 2 * iw, 1, G1), ((wy | 0) & 3) === 0 && px(c - iw + 2 + hash(wy | 0) * (2 * iw - 4), y, 2, 2, ROCK);
      }
      // Slalom flags along the edges, alternating sides; the START banner at the top of the hill.
      for (let k = Math.ceil(cam / 30); k * 30 < cam + H + 4; k++) {
        const wy = k * 30, y = wy - cam, side = k & 1 ? 1 : -1, x = pathX(wy) + side * (HW + island(wy) + 3);
        px(x, y - 4, 1, 5, C.ink), px(x + 1, y - 4, 3, 2, RED);
      }
      if (cam < 70) {
        const y = 50 - cam, c = pathX(50);
        px(c - HW - 4, y - 8, 1, 9, C.ink), px(c + HW + 4, y - 8, 1, 9, C.ink);
        px(c - HW - 3, y - 8, 2 * HW + 7, 7, RED);
        print(g, "START", c - 9, y - 7, C.ink, 1);
      }
      // Wooden fences across the path, each with a gap to shoot.
      for (let k = Math.max(0, S[NEXTF]! - 1); k < S[NEXTF]! + 2; k++) {
        const fy = fenceY(k), y = fy - cam;
        if (y < -4 || y > H + 2 || island(fy)) continue;
        const c = pathX(fy), gx = gapX(k), l = c - HW - 3, rr = c + HW + 3;
        px(l, y - 1, gx - GAP - l, 2, WOOD), px(gx + GAP, y - 1, rr - gx - GAP, 2, WOOD);
        for (let x = l; x < rr; x += 6) if (x < gx - GAP || x > gx + GAP) px(x, y - 2, 1, 4, WOOD2);
        px(gx - GAP - 1, y - 3, 2, 5, WOOD2), px(gx + GAP - 1, y - 3, 2, 5, WOOD2);
      }
      // The rider: leaning into the carve, tumbling in a slam.
      const sl = S[SLAM]!, x = S[X]! | 0;
      for (let j = 0; j < 9; j++) {
        const row = RIDER[sl > 0 ? (((sl * 12) | 0) & 1 ? 8 - j : j) : j]!, lean = sl > 0 ? 0 : (S[VX]! * (j - 4)) / 220;
        for (let i = 0; i < 5; i++) if (row[i] !== ".") px(x - 2 + i + lean, RY - 4 + j, 1, 1, KEY[row[i]!]!);
      }
      r.drawSpray(ride.sp, DEBRIS);
      if (S[WORDT]! < 0.9) say(S[WORD] ? "SLAM!" : "NICE GATE", x, RY - 12 - S[WORDT]! * 8, S[WORD] ? RED : C.hurt, 1);
      // Our bottom bar: the time left and the total.
      px(0, H - 8, W, 8, C.rim);
      print(g, "TIME", 4, H - 6, C.muted, 1);
      print(g, NUM[Math.ceil(mode === PLAY ? S[LEFT]! : ROUND)]!, 22, H - 6, C.ink, 1);
      print(g, "TOTAL", 110, H - 6, C.muted, 1);
      print(g, NUM[Math.min(999, S[SCORE]! | 0)]!, 132, H - 6, C.hurt, 1);
      if (mode === IDLE || (mode === DEMO && S[T]! > 2.8)) say("HOLD RIGHT, LET GO LEFT", 80, 70, C.ink, 1);
      if (mode === DONE && S[CARD]! > 0.5) {
        px(46, 30, 68, 30, C.rim);
        say(NUM[Math.min(999, S[SCORE]! | 0)]!, 80, 34, C.hurt, 3);
        say(S[SLAMS] === 0 ? "CLEAN RUN" : S[GATES]! >= 3 ? "GATE CRASHER" : "BUMPY RUN", 80, 47, C.ink, 1);
        if (S[CARD]! > 0.8) say("PRESS TO GO", 80, 53, C.muted, 1);
      }
    },
  });

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, slams: S[SLAMS]!, gates: S[GATES]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, rolling out under the START banner (scripts/gallery-posters.mjs). */
export const posterAt = 0.9;
