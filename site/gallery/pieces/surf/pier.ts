// "Shoot the Pier" (surf-sesh; Lip Line's second wave): the rite of passage. A surfer rides the wave
// in toward the beach (down the stage, toward you), straight under the old pier: rows of pilings
// stand across the water and scroll past, and you weave through the gaps between them (hold and drag
// across the stage, or ← → / A D). Under the deck it's dark, with shafts of light between the planks;
// the gaps tighten and the wave runs faster toward the far end, where dead centre through the
// tightest gaps threads the needle. Touch a piling and the foam rolls you (so close: you're back up
// a few rows on). Burst out into the sun, ride the shorebreak in, the crowd cheers and the banner
// says what the beach thinks of you. The whitewater chases from behind all the way.
// Bricks: the kernel (fixed step; settle: it sleeps on the banner and when idle; its ledger for every
// page write, so Recall gives the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The rig
// (pixel canvas, hold + steer input, keys, synth, spray, pop words) and the sea's art: kit.ts; the
// surfer: surfer.ts. The
// ride is `pierRun()`: plain numbers, no DOM (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEEP, DEMO, DONE, FOAM2, H, IDLE, KEY, NUM, PLAY, W, WATER, WOOD, WOOD2, rig, spray, words, type Pad } from "./kit";
import { print, textW } from "../pix";
import { CROUCH, LEAN_L, LEAN_R, RIDE, front, tumble } from "./surfer";

/** The rider's feet (screen y), the rows (count, first one's world y, the gap between rows). */
export const RY = 34, NR = 14, ROW0 = 112, RG = 20;
/** The last row's world y, the beach's. */
export const ROWN = ROW0 + (NR - 1) * RG, BEACH = ROWN + 78;
/** A piling's reach: closer than this to its centre and you hit it. */
export const HIT = 4;
// State slots.
const MODE = 0, T = 1, D = 2, X = 3, VX = 4, SCORE = 5, CHAIN = 6, BEST = 7, THREADS = 8, WIPES = 9, WIPE = 10, HELD = 11, CARD = 12;
const NEEDLES = 14, FIN = 15, NEXTROW = 16, SUN = 18, CAUSE = 19;
/** Events this step (for the synth): threaded, wipeout, start, the finish, the needle. */
export const EV_THREAD = 0, EV_WIPE = 1, EV_START = 2, EV_END = 3, EV_NEEDLE = 4;
/** What wiped you out: a piling. */
export const BY_PILING = 2;
const WORDS = ["NICE!", "THREAD THE NEEDLE!", "SO CLOSE!", "SHOT IT!"];
const FOAM = 0, MIST = 1;

/** The ride: plain numbers (headless-testable). `pad` (kit.ts, `track`): [0] held, [1] presses, [3] pointer x, [5] pointer over, [6] steer keys. */
export function pierRun(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(20), ev = new Uint8Array(5);
  // Rows: the pilings' spacing and offset (pilings at OFF + k × SP).
  const SP = new Float64Array(NR), OFF = new Float64Array(NR);
  const sp = spray(140, R), wd = words(WORDS);
  /** The gap centre nearest x in row i. */
  const gapAt = (i: number, x: number) => OFF[i]! + (Math.floor((x - OFF[i]!) / SP[i]!) + 0.5) * SP[i]!;
  function course() {
    for (let i = 0; i < NR; i++) (SP[i] = 21 - (7 * i) / (NR - 1)), (OFF[i] = R() * SP[i]!);
  }
  function reset(d: number) {
    (S[D] = d), (S[X] = 80), (S[VX] = 0), (S[CHAIN] = 0), (S[SUN] = 0), (S[FIN] = 0);
    S[NEXTROW] = 0;
    for (let i = 0; i < NR; i++) if (ROW0 + i * RG < d + RY + 1) S[NEXTROW] = i + 1;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[SCORE] = 0), (S[BEST] = 0), (S[THREADS] = 0), (S[WIPES] = 0), (S[WIPE] = 0), (S[NEEDLES] = 0), (S[CARD] = 0);
    course();
    reset(0);
    ev[EV_START] = 1;
  }
  function wipe(by: number) {
    (S[WIPE] = 0.001), (S[CAUSE] = by), (S[WIPES] = S[WIPES]! + 1), (S[CHAIN] = 0);
    sp.burst(S[X]!, RY - 6, 26, 64, -1.5708, 3, 2, FOAM);
    wd.say(2, 80, 44, 2);
    ev[EV_WIPE] = 1;
  }
  S[MODE] = demo ? DEMO : IDLE;
  course();
  reset(0);
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 1.2))) start(), (mode = PLAY);
    const riding = (mode === PLAY || mode === DEMO) && !S[FIN];
    if (riding) {
      // The wave carries you in, faster toward the far end; in the shorebreak it lets go.
      const d = S[D]!, f = Math.max(0, Math.min(1, (d - ROW0 + 60) / (NR * RG)));
      let v = 40 + 26 * f;
      if (d > ROWN) v = Math.max(14, v * (1 - (d - ROWN) / (BEACH - ROWN)));
      if (S[WIPE]! > 0) v = 22;
      S[D] = d + v * dt;
      if (S[WIPE]! > 0) {
        S[WIPE] = S[WIPE]! + dt;
        if (S[WIPE]! > 1.6) {
          // So close: back up on the board a few rows on, in the middle.
          S[WIPE] = 0;
          // The rows that went by in the foam are behind you; a little room before the next.
          while (S[NEXTROW]! < NR && ROW0 + S[NEXTROW]! * RG <= S[D]! + RY + 12) S[NEXTROW] = S[NEXTROW]! + 1;
          const k = S[NEXTROW]!;
          (S[X] = k < NR ? gapAt(k, 80) : 80), (S[VX] = 0);
        }
      } else {
        // Steering: a held pointer pulls you across to it; ← → (A D) lean; let go and hold the line.
        const x = S[X]!;
        let want = 0;
        if (mode === DEMO) want = ghost() - x;
        else if (pad[0]! > 0 && pad[5]! > 0) want = pad[3]! - x;
        else want = pad[6]! * 40;
        S[HELD] = mode === PLAY && (pad[0]! > 0 || pad[6] !== 0) ? 1 : 0;
        S[VX] = Math.max(-80, Math.min(80, want * 9));
        S[X] = Math.max(6, Math.min(154, x + S[VX]! * dt));
        if (Math.abs(S[VX]!) > 30 && R() < 0.4) sp.burst(S[X]! - Math.sign(S[VX]!) * 4, RY + 2, 2, 30, S[VX]! > 0 ? 3.6 : -0.5, 0.8, 1, FOAM);
        // A row reaches your feet: through a gap, or into a piling.
        const k = S[NEXTROW]!;
        if (k < NR && ROW0 + k * RG <= S[D]! + RY) {
          S[NEXTROW] = k + 1;
          const xx = S[X]!, gc = gapAt(k, xx);
          if (Math.abs(xx - gc) > SP[k]! / 2 - HIT) wipe(BY_PILING);
          else {
            (S[CHAIN] = Math.min(9, S[CHAIN]! + 1)), (S[THREADS] = S[THREADS]! + 1), (S[BEST] = Math.max(S[BEST]!, S[CHAIN]!));
            const needle = SP[k]! <= 16 && Math.abs(xx - gc) <= 1.2;
            if (mode === PLAY) (S[SCORE] = S[SCORE]! + 5 * S[CHAIN]! + (needle ? 25 : Math.abs(xx - gc) <= 2 ? 5 : 0)), needle && (S[NEEDLES] = S[NEEDLES]! + 1);
            sp.burst(xx - 5, RY, 4, 30, 2.8, 0.8, 1, MIST), sp.burst(xx + 5, RY, 4, 30, 0.3, 0.8, 1, MIST);
            let young = 9;
            for (let j = 0; j < wd.N; j++) young = Math.min(young, wd.T[j]!);
            if (young > (needle ? 0.7 : 1.05)) wd.say(needle ? 1 : 0, 80, RY + (needle ? 24 : 14), needle ? 1 : 0);
            ev[needle ? EV_NEEDLE : EV_THREAD] = 1;
          }
        }
      }
      // Out from under the deck into the sun.
      if (!S[SUN] && S[D]! + RY > ROWN + 14) (S[SUN] = 1), mode === PLAY && !S[WIPE] && wd.say(3, 80, RY - 20, 1);
      // The shorebreak sets you down on the sand.
      if (S[D]! >= BEACH - RY - 6 && !S[WIPE]) {
        S[FIN] = 0.001;
        if (mode === PLAY) {
          if (!S[WIPES]) S[SCORE] = S[SCORE]! + 50;
          (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1);
        }
      }
    }
    if (S[MODE] === DONE) (S[CARD] = S[CARD]! + dt), (S[FIN] = S[FIN]! + dt);
    if (mode === DEMO && S[T]! > 5.2 && !S[WIPE]) (S[MODE] = IDLE), course(), reset(0);
    const moving = sp.step(dt, 40) + wd.step(dt);
    return riding || S[WIPE]! > 0 || moving > 0 || (S[MODE] === DONE && S[CARD]! < 2.6);
  }
  /** The attract run's line: the gap in the next row nearest to you. */
  function ghost() {
    const k = S[NEXTROW]!, x = S[X]!;
    if (k >= NR) return 80;
    let g = gapAt(k, x);
    if (g < 8) g += SP[k]!;
    if (g > 152) g -= SP[k]!;
    return g;
  }
  return { S, ev, sp, wd, step, SP, OFF, gapAt, ghost, pad };
}
export type PierRun = ReturnType<typeof pierRun>;

export type PierScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: PierRun; poster(): void; readonly state: { mode: number; score: number; threads: number; wipes: number; needles: number; fin: number } };

const FOAMC = C.ink, SAND = C.hurt, WET = C.advance, SKIN = "#d99a6c", SHADE = "rgba(7,6,15,.5)", SHAFT = "rgba(238,240,251,.16)";
const FAN = ["c", "a", "b", "o", "w", "y"];

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): PierScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold and drag to steer", { thread: "click", needle: "power", wipe: "boom", start: "ready", end: "win" }, true, true);
  const g = r.g;
  const ride = pierRun((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { SP, OFF, sp, wd } = ride;
  if (first) r.pad[1] = 1;
  // Steer keys on the ride key: ← / A and → / D (pad[6]: -1, 0, +1); the first one also starts a ride.
  const keys = new Float64Array(2), pad = r.pad;
  const side = (e: KeyboardEvent) => (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ? 0 : e.key === "ArrowRight" || e.key === "d" || e.key === "D" ? 1 : -1);
  const lean = (e: KeyboardEvent, on: number) => {
    const i = side(e);
    if (i < 0 || e.target !== r.ride) return;
    e.preventDefault();
    if (e.repeat) return;
    if (on && !keys[0] && !keys[1]) pad[1] = pad[1]! + 1;
    keys[i] = on;
    pad[6] = keys[1]! - keys[0]!;
    engine.wake();
  };
  stage.addEventListener("keydown", (e) => lean(e, 1), { signal: engine.signal });
  stage.addEventListener("keyup", (e) => lean(e, 0), { signal: engine.signal });
  const SPRAY = [FOAMC, FOAM2];
  const WCOL = [C.ink, C.hurt, C.attack];
  const px = (x: number, y: number, w: number, h: number, c: string) => ((g.fillStyle = c), g.fillRect(x | 0, y | 0, w, h));
  /** Pixel text with a rim (pix.ts's 3 × 5 font), centred on x. */
  function say(s: string, x: number, y: number, c: string, k: number) {
    const w = textW(s, k), x0 = Math.round(x - w / 2);
    for (let d = 0; d < 4; d++) print(g, s, x0 + (d === 0 ? -1 : d === 1 ? 1 : 0), y + (d === 2 ? -1 : d === 3 ? 1 : 0), C.rim, k);
    print(g, s, x0, y, c, k);
  }
  /** One row of pilings, base at screen y: posts up into the deck, a barnacle band, wet bases, foam. */
  function row(i: number, y: number) {
    const s = SP[i]!;
    for (let x = OFF[i]! - s; x < W + 4; x += s) {
      const c = Math.round(x);
      px(c - 2, y - 18, 4, 18, WOOD), px(c - 2, y - 18, 1, 18, WOOD2);
      px(c - 2, y - 7, 4, 3, C.muted), px(c - 1, y - 6, 1, 1, C.ink), px(c + 1, y - 7, 1, 1, C.rim);
      px(c - 2, y - 4, 4, 4, DEEP), px(c - 2, y - 1, 4, 1, C.rim);
      px(c - 3, y, 6, 1, FOAMC), px(c - 4, y + 1, 2, 1, FOAM2), px(c + 2, y + 1, 2, 1, FOAM2);
    }
  }
  engine.add({
    read() {
      r.read();
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_THREAD]) e.events.emit("thread");
      if (ev[EV_NEEDLE]) e.events.emit("needle");
      if (ev[EV_WIPE]) e.events.emit("wipe");
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const t = S[T]!, d = S[D]!, mode = S[MODE]!;
      // The water: blue, chop streaks running up past you.
      px(0, 0, W, H, WATER);
      for (let k = 0; k < 22; k++) {
        const y = ((k * 29 - d * 1.0) % 96 + 96) % 96 - 4;
        px((k * 53) % 150, y, 4 + (k % 4) * 2, 1, k & 1 ? FOAM2 : C.sys);
      }
      // The beach: sand comes up from below, the wet edge and the shorebreak's foam lines.
      const by = BEACH - d;
      if (by < H) {
        px(0, by, W, H, SAND);
        px(0, by, W, 3, WET);
        for (let k = 0; k < 4; k++) px((k * 47 + t * 6) % 170 - 10, by - 4 - (k & 1) * 3, 28, 1, FOAMC);
        // The crowd strip on the sand: shirts, heads, arms up when they cheer.
        const cheer = mode === DONE && S[CARD]! < 2.4;
        for (let k = 0; k < 22; k++) {
          const x = 4 + k * 7, hop = cheer ? (((t * 8) | 0) + k) & 1 : 0, y = by + 26 + (k & 1) * 3 - hop;
          px(x, y, 5, 6, C.rim), px(x + 1, y + 1, 3, 5, KEY[FAN[k % 6]!]!), px(x + 1, y - 3, 3, 3, C.rim), px(x + 2, y - 2, 1, 1, SKIN);
          if (cheer && (k + ((t * 5) | 0)) % 3) px(x - 1, y - 4, 1, 3, C.rim), px(x + 5, y - 4, 1, 3, C.rim);
        }
      }
      // Under the pier: the deck's shadow, with shafts of light through the planks.
      const p0 = ROW0 - 30 - d, p1 = ROWN + 8 - d;
      if (p1 > 0 && p0 < H) {
        const a = Math.max(0, p0), b = Math.min(H, p1);
        px(0, a, W, b - a, SHADE);
        for (let y = Math.ceil((a + d) / 9) * 9 - d; y < b; y += 9) px(0, y, W, 2, SHAFT);
        if (p0 > 0) px(0, p0, W, 2, C.rim);
      }
      // The rows behind you, then you, then the rows still ahead (they stand in front of you).
      const k0 = S[NEXTROW]!;
      for (let i = 0; i < k0; i++) {
        const y = ROW0 + i * RG - d;
        if (y > -2 && y < H + 20) row(i, y);
      }
      // The surfer (surfer.ts): an arm thrown out into each turn, low under the deck, tall in the sun.
      if (!S[WIPE]) {
        const vx = S[VX]!, pose = vx < -25 ? LEAN_L : vx > 25 ? LEAN_R : d + RY < ROWN + 14 && d + RY > ROW0 - 30 ? CROUCH : RIDE;
        front(g, S[X]!, (mode === DONE ? RY + Math.min(1, S[FIN]! * 2) * 14 : RY) - 1, mode === DONE ? RIDE : pose);
      } else if (S[WIPE]! < 1.1) tumble(g, S[X]! + Math.sin(S[WIPE]! * 12) * 3, RY - S[WIPE]! * 14, t);
      for (let i = k0; i < NR; i++) {
        const y = ROW0 + i * RG - d;
        if (y > -2 && y < H + 20) row(i, y);
      }
      // The next gap: two green ticks on the water, so the line reads at a glance.
      if (k0 < NR && mode !== IDLE && !S[WIPE]) {
        const y = ROW0 + k0 * RG - d, gx = ride.ghost() | 0;
        if (y < H && Math.abs(gx - S[X]!) < 40) px(gx - 3, y - 1, 2, 1, C.go), px(gx + 2, y - 1, 2, 1, C.go);
      }
      // The whitewater chasing from behind: a frothy band across the top.
      const surge = S[WIPE]! > 0 || mode === DONE ? 0 : 1;
      for (let x = 0; x < W; x += 2) {
        const h = 7 + Math.sin(x * 0.21 + t * 5) * 2 + ((x * 7 + ((t * 20) | 0)) % 5 === 0 ? 2 : 0);
        px(x, 0, 2, h * surge + 1, FOAMC), px(x, h * surge, 2, 1, FOAM2);
      }
      // The wipeout: a foam ball rolls over you and floods the frame, then drains.
      if (S[WIPE]! > 0) {
        const w = S[WIPE]!, rad = Math.min(130, 6 + w * w * 120), cx = S[X]!, cy = RY - 6 + w * 10;
        const drain = w > 1.15 ? Math.min(1, (w - 1.15) / 0.45) : 0;
        g.save();
        g.beginPath();
        g.rect(0, 0, W, H * (1 - drain));
        g.clip();
        for (let k = 0; k < 28; k++) {
          const an = w * 9 + k * 0.62, rr = rad * (0.35 + ((k * 7) % 10) / 15), s = 4 + (k % 4) * 3 + rad * 0.12;
          px(cx + Math.cos(an) * rr - s / 2, cy + Math.sin(an) * rr * 0.8 - s / 2, s, s, k % 3 ? FOAMC : FOAM2);
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
        if (u < 1.1) say(WORDS[wd.I[i]!]!, wd.X[i]!, (wd.Y[i]! - u * 8) | 0, WCOL[wd.K[i]!]!, wd.I[i]! === 2 ? 2 : 1);
      }
      // The score chip, and the run to the beach: a strip that fills toward the flag.
      const sc = NUM[Math.min(999, S[SCORE]! | 0)]!;
      px(3, 3, textW(sc) + 6, 9, C.rim);
      print(g, sc, 6, 5, C.hurt, 1);
      if (mode === PLAY) px(3, 13, 30, 3, C.rim), px(4, 14, 28 * Math.min(1, d / (BEACH - RY)), 1, C.go), px(32, 10, 1, 6, C.rim), px(33, 10, 2, 2, C.attack);
      if (mode === IDLE || (mode === DEMO && t > 4.2)) say("HOLD + DRAG TO STEER", 80, 80, C.ink, 1);
      if (mode === DONE && S[CARD]! > 0.3) {
        // The banner pops: SHOT THE PIER, the points, what the beach thinks of you.
        const pop = Math.min(1, (S[CARD]! - 0.3) * 5), h = (34 * pop) | 0, y0 = 21 - (h >> 1);
        px(28, y0, 104, h, C.rim), px(29, y0 + 1, 102, Math.max(0, h - 2), C.cmd), px(29, y0 + 1, 102, 2, C.attack);
        if (pop === 1) {
          say("SHOT THE PIER", 80, y0 + 5, C.ink, 1);
          const sw = textW(sc, 2), x0 = 80 - ((sw + 14) >> 1);
          say(sc, x0 + (sw >> 1), y0 + 13, C.hurt, 2);
          print(g, "PTS", x0 + sw + 3, y0 + 18, C.ink, 1);
          say(S[WIPES] ? (S[WIPES]! > 1 ? "KEEP PADDLING" : "RESPECT") : "LOCAL LEGEND", 80, y0 + 26, S[WIPES] ? C.ink : C.go, 1);
        }
        if (S[CARD]! > 1.2) say("TAP TO GO AGAIN", 80, 82, C.ink, 1);
      }
    },
  });

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, threads: S[THREADS]!, wipes: S[WIPES]!, needles: S[NEEDLES]!, fin: S[FIN]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, under the pier, weaving through the pilings. */
export const posterAt = 3.4;
