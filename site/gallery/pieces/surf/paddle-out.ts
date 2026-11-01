// "Paddle Out" (surf-sesh): get out to the lineup before the set closes it. You paddle on your own;
// walls of whitewater roll in at you. Hold to duck-dive (push the board under, and the wave rolls
// over your back) and let go to come up and paddle again. Dive too early and your breath runs out
// before the foam has passed; too late and it washes you back toward the beach. Reach the lineup in
// ten seconds and you are out. Then the score card, then it sleeps until the next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The rig: kit.ts. The paddle is `paddleOut()`, plain
// numbers, no DOM (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, caption, drawWords, hud, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
const SX = 56, SEA = 46, GOAL = 100, PADDLE = 14, N = 3, WAVE_V = 52;
// State slots.
const MODE = 0, T = 1, LEFT = 2, DIST = 3, DEPTH = 4, AIR = 5, SCORE = 6, DIVES = 7, WASH = 8, WASHES = 9, NEXT = 10, CARD = 11, HELD = 12, STROKE = 13, OUT = 14, SETK = 15, GASP = 16;
/** Events this step: start, a clean dive, washed, out at the lineup, the end. */
export const EV_START = 0, EV_DIVE = 1, EV_WASH = 2, EV_OUT = 3, EV_END = 4;
const WORDS = ["UNDER!", "WASHED!", "OUT THE BACK!", "OUT OF AIR", "CLEAN"];
const FOAM = 0, BUBBLE = 1, MIST = 2;

export function paddleOut(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(20), ev = new Uint8Array(5);
  // Whitewater walls: x of the front, width of the foam, height, whether you were under it as it passed.
  const WX = new Float64Array(N).fill(-99), WW = new Float64Array(N), WH = new Float64Array(N), WU = new Uint8Array(N), WD = new Uint8Array(N);
  const sp = spray(200, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  (S[AIR] = 1), (S[NEXT] = 0.4);
  if (demo) wave(118);
  function wave(x: number) {
    for (let i = 0; i < N; i++) {
      if (WX[i]! > -60) continue;
      const big = S[SETK]! % 3 === 2 ? 1 : 0;
      S[SETK] = S[SETK]! + 1;
      (WX[i] = x), (WW[i] = big ? 22 : 13 + R() * 4), (WH[i] = big ? 22 : 14 + R() * 4), (WU[i] = 1), (WD[i] = 0);
      return;
    }
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[DIST] = 0), (S[SCORE] = 0), (S[DIVES] = 0), (S[WASHES] = 0), (S[OUT] = 0), (S[AIR] = 1), (S[WASH] = 0), (S[NEXT] = 0.5), (S[SETK] = 0);
    WX.fill(-99);
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
    // The ghost dives as the foam reaches it and comes up once it has passed.
    let held = mode === PLAY ? pad[0]! > 0 : false;
    if (mode === DEMO) for (let i = 0; i < N; i++) if (WX[i]! - SX < 6 && WX[i]! + WW[i]! - SX > -2) held = true;
    // Out of air: up you come, and you have to let go before the next dive.
    if (!held) S[GASP] = 0;
    if (S[AIR]! <= 0) S[GASP] = 1;
    if (S[GASP]) held = false;
    S[HELD] = held ? 1 : 0;
    if (riding) {
      // Diving: the board goes under, breath drains; up: it refills.
      const d0 = S[DEPTH]!;
      S[DEPTH] = Math.max(0, Math.min(1, d0 + (held ? 8 : -3.5) * dt));
      if (held) S[AIR] = S[AIR]! - dt / 1.1;
      else S[AIR] = Math.min(1, S[AIR]! + dt * 0.8);
      if (S[AIR]! <= 0 && d0 > 0.5) wd.say(3, SX, SEA - 16, 2), (S[AIR] = 0);
      if (d0 < 0.5 && S[DEPTH]! >= 0.5) sp.burst(SX + 4, SEA, 6, 30, -1.5708, 1.2, 1, FOAM);
      if (S[DEPTH]! > 0.4 && S[T]! * 20 % 1 < dt * 20) sp.burst(SX + (Math.sin(S[T]! * 7) * 3), SEA + 6 + S[DEPTH]! * 10, 1, 14, -1.5708, 0.8, 1, BUBBLE);
      // Paddling: forward on the surface (slow under), the washes push you back.
      if (S[WASH]! > 0) {
        S[WASH] = S[WASH]! - dt;
        S[DIST] = Math.max(0, S[DIST]! - dt * 22);
      } else if (mode === PLAY) S[DIST] = Math.min(GOAL, S[DIST]! + dt * PADDLE * (S[DEPTH]! > 0.5 ? 0.45 : 1));
      S[STROKE] = S[STROKE]! + dt * (S[DEPTH]! > 0.5 || S[WASH]! > 0 ? 0 : 7);
      // The sets: whitewater walls roll in from the right.
      S[NEXT] = S[NEXT]! - dt;
      if (S[NEXT]! <= 0 && S[OUT] === 0) (S[NEXT] = S[SETK]! % 3 === 2 ? 1.9 : 1.15 + R() * 0.4), wave(W + 8);
      for (let i = 0; i < N; i++) {
        if (WX[i]! <= -60) continue;
        WX[i] = WX[i]! - WAVE_V * dt;
        const over = WX[i]! < SX + 1 && WX[i]! + WW[i]! > SX - 3;
        if (over && !WD[i]) {
          if (S[DEPTH]! < 0.5) {
            // Washed: back toward the beach, tumbling in the foam.
            (WD[i] = 1), (WU[i] = 0), (S[WASH] = 0.7), (S[DEPTH] = 0), (S[WASHES] = S[WASHES]! + 1);
            sp.burst(SX, SEA - 2, 24, 60, -2.2, 1.8, 1.8, FOAM);
            sp.burst(SX, SEA - 4, 10, 40, -1.5708, 2.4, 2.4, MIST);
            wd.say(1, SX + 4, SEA - 20, 2);
            ev[EV_WASH] = 1;
          }
        }
        if (!WD[i] && WX[i]! + WW[i]! < SX - 3) {
          // It rolled over your back: a clean dive.
          WD[i] = 1;
          if (mode === PLAY) (S[DIVES] = S[DIVES]! + 1), (S[SCORE] = S[SCORE]! + 10 + (WW[i]! > 20 ? 10 : 0));
          wd.say(WW[i]! > 20 ? 4 : 0, SX + 6, SEA - 18, 0);
          sp.burst(SX - 2, SEA - 2, 8, 30, -2.4, 1, 1.2, MIST);
          ev[EV_DIVE] = 1;
        }
        if (WX[i]! + WW[i]! < -20) WX[i] = -99;
      }
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[DIST]! >= GOAL && !S[OUT]) {
        (S[OUT] = 1), (S[SCORE] = S[SCORE]! + 30 + Math.round(S[LEFT]! * 5));
        wd.say(2, 92, 24, 1);
        sp.burst(SX + 6, SEA - 2, 30, 50, -1.5708, 2.4, 1.6, MIST);
        ev[EV_OUT] = 1;
      }
      if (S[LEFT] === 0 || S[OUT]) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1), WX.fill(-99);
    } else if (mode === DEMO && S[T]! > 3.8 && S[DEPTH] === 0) (S[MODE] = IDLE), WX.fill(-99);
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    if (S[MODE] === IDLE || S[MODE] === DONE) {
      S[DEPTH] = Math.max(0, S[DEPTH]! - dt * 3.5);
      S[AIR] = Math.min(1, S[AIR]! + dt);
    }
    const moving = sp.step(dt, 50) + wd.step(dt);
    return riding || moving > 0 || S[DEPTH]! > 0 || S[AIR]! < 1 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  return { S, ev, sp, wd, step, WX, WW, WH };
}
export type PaddleOut = ReturnType<typeof paddleOut>;

export type PaddleScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: PaddleOut; poster(): void; readonly state: { mode: number; score: number; dives: number; washes: number; dist: number; out: number; left: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): PaddleScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to duck-dive under the whitewater", { start: "ready", dive: "click", wash: "hurt", out: "win", end: "end" });
  const g = r.g;
  const ride = paddleOut((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { WX, WW, WH } = ride;
  if (first) r.pad[1] = 1;
  const SPRAY = [C.ink, "rgba(25,240,255,.7)", "rgba(246,243,255,.45)"];
  const WCOL = [C.sys, C.go, C.aim];
  let sky: CanvasGradient | string = C.raised, deep: CanvasGradient | string = C.line;
  engine.add({
    read() {
      r.read();
      if (typeof sky === "string") {
        const s = g.createLinearGradient(0, 0, 0, SEA);
        s.addColorStop(0, C.line), s.addColorStop(0.7, C.cmd), s.addColorStop(1, C.aim);
        const d = g.createLinearGradient(0, SEA, 0, H);
        d.addColorStop(0, "#1b3f8f"), d.addColorStop(1, C.bg);
        (sky = s), (deep = d);
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_DIVE]) e.events.emit("dive");
      if (ev[EV_WASH]) e.events.emit("wash");
      if (ev[EV_OUT]) e.events.emit("out");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const t = S[T]!, mode = S[MODE]!, prog = S[DIST]! / GOAL;
      // Dawn above the water line; the sea cut open below it (you see the dive).
      g.fillStyle = sky;
      g.fillRect(0, 0, W, SEA);
      // The lineup out back: surfers sitting on the horizon, nearer as you make it out.
      const hz = SEA - 6;
      g.fillStyle = C.bg;
      g.globalAlpha = 0.35 + prog * 0.5;
      for (let k = 0; k < 3; k++) {
        const x = 128 + k * 9 - prog * 18, s = 0.6 + prog * 0.6;
        g.fillRect(x - 3 * s, hz + 2, 6 * s, 1);
        g.beginPath();
        g.arc(x, hz - 1.5 * s, 1.1 * s, 0, TAU);
        g.fill();
        g.fillRect(x - 0.6 * s, hz - 0.6 * s, 1.2 * s, 2.6 * s);
      }
      g.globalAlpha = 1;
      // The beach behind you (left), shrinking as you go.
      g.fillStyle = C.hurt;
      g.globalAlpha = 0.6;
      g.fillRect(0, SEA - 3, 20 - prog * 18, 3);
      g.globalAlpha = 1;
      g.fillStyle = deep;
      g.fillRect(0, SEA, W, H - SEA);
      // Light rays under the surface.
      g.fillStyle = C.sys;
      g.globalAlpha = 0.06;
      for (let k = 0; k < 5; k++) {
        const x = ((k * 41 + t * 6) % 200) - 20;
        g.beginPath();
        g.moveTo(x, SEA), g.lineTo(x + 8, SEA), g.lineTo(x - 6, H), g.lineTo(x - 18, H);
        g.fill();
      }
      g.globalAlpha = 1;
      // The surface: a gentle chop.
      g.strokeStyle = C.sys;
      g.lineWidth = 0.8;
      g.beginPath();
      for (let x = 0; x <= W; x += 5) x ? g.lineTo(x, SEA + Math.sin(x * 0.12 + t * 3) * 0.6) : g.moveTo(x, SEA);
      g.stroke();
      // The whitewater walls: a rolling face of foam, churn under it.
      for (let i = 0; i < 3; i++) {
        const x = WX[i]!, w = WW[i]!, h = WH[i]!;
        if (x <= -60) continue;
        g.fillStyle = C.ink;
        g.globalAlpha = 0.25;
        g.beginPath();
        g.ellipse(x + w / 2, SEA + 4, w * 0.7, 6 + h * 0.35, 0, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        // A tumbling wall of foam: puffs, tallest at the front, churning.
        for (let k = 0; k < 6; k++) {
          const f = k / 5, ph = h * (1 - f * 0.6), rr = ph * 0.42 + 1.5;
          g.globalAlpha = 0.8 + 0.2 * (1 - f);
          g.beginPath();
          g.arc(x + 2 + f * w, SEA - ph + rr + Math.sin(t * 8 + k * 1.9 + i) * 1.2, rr, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
        g.fillRect(x, SEA - 3, w + 4, 4);
        g.fillStyle = C.sys;
        g.globalAlpha = 0.45;
        g.fillRect(x - 1, SEA - h * 0.4, 2, h * 0.4 + 1);
        g.globalAlpha = 1;
      }
      // The paddler.
      paddler(SX, SEA + S[DEPTH]! * 15, S[DEPTH]!, S[STROKE]!, S[WASH]!);
      r.drawSpray(ride.sp, SPRAY);
      drawWords(r, ride.wd, WCOL);
      hud(r, S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.sys);
      // How far out (a line to the lineup), and breath.
      g.fillStyle = "rgba(7,6,15,.55)";
      g.fillRect(48, 8, 56, 3);
      g.fillStyle = C.go;
      g.fillRect(48, 8, 56 * prog, 3);
      g.fillStyle = C.ink;
      g.fillRect(103, 6.5, 1, 6);
      if (S[AIR]! < 1) {
        g.fillStyle = C.rim;
        g.fillRect(SX - 7, SEA + 26, 14, 2);
        g.fillStyle = S[AIR]! < 0.3 ? C.attack : C.sys;
        g.fillRect(SX - 7, SEA + 26, 14 * S[AIR]!, 2);
      }
      if (mode === IDLE || (mode === DEMO && t > 2.8)) caption(r, "HOLD TO DUCK-DIVE · LET GO TO PADDLE", 80, 6, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.65)";
        g.beginPath();
        g.roundRect(40, 18, 80, 32, 6);
        g.fill();
        caption(r, NUM[Math.min(999, S[SCORE]! | 0)]!, 29, 14, C.sys);
        caption(r, S[OUT] ? (S[WASHES] ? "MADE IT OUT" : "MADE IT OUT, DRY HAIR") : "STILL IN THE IMPACT ZONE", 40, 6, C.ink);
        if (S[CARD]! > 0.8) caption(r, "HOLD TO PADDLE AGAIN", 46.5, 5, C.muted);
      }
    },
  });
  /** The paddler on the board: arms windmill on the surface, the nose pushes under for a dive. */
  function paddler(x: number, y: number, depth: number, stroke: number, wash: number) {
    g.save();
    g.translate(x, y);
    g.rotate(wash > 0 ? Math.sin(wash * 18) * 0.6 : depth * 0.35);
    g.fillStyle = C.aim;
    g.beginPath();
    g.ellipse(0, 0, 9, 1.5, 0, 0, TAU);
    g.fill();
    g.fillStyle = C.ink;
    g.fillRect(-7, -0.3, 14, 0.5);
    // Lying on it: legs back, chest up, head forward.
    g.strokeStyle = C.rim;
    g.lineWidth = 1.8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-8, -1.6), g.lineTo(-1, -2.2), g.lineTo(3.6, -3.2 + depth * 1.6);
    const a = Math.sin(stroke), b = Math.cos(stroke);
    g.moveTo(2.6, -3), g.lineTo(2.6 + a * 4, -3 + Math.abs(b) * 4.4);
    g.stroke();
    g.fillStyle = C.rim;
    g.beginPath();
    g.arc(5.4, -4.4 + depth * 1.8, 1.8, 0, TAU);
    g.fill();
    g.fillStyle = C.go;
    g.fillRect(-2.5, -3.6, 4.5, 1.8);
    g.restore();
  }

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, dives: S[DIVES]!, washes: S[WASHES]!, dist: S[DIST]!, out: S[OUT]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, under the first wall of foam (scripts/gallery-posters.mjs). */
export const posterAt = 1.25;
