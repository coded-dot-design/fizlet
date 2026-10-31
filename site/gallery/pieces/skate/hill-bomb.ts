// "Hill Bomb" (skate-sesh): straight down a hill road, seen from above, faster every second. Hold to
// carve up the road, let go and you drift back down. Thread the cones: a close pass scores, a cone to
// the wheels wobbles you and bleeds speed, and the curb is worse. Ten seconds a run, then the score
// card, then you roll to a stop and it sleeps until the next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), fizlet/slot, fizlet/sound. The rig: kit.ts. The run is `hillBomb()`, plain
// numbers, no DOM (tests/skate-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
const SX = 40, TOP = 22, BOT = 84, MID = (TOP + BOT) / 2, N = 10, V0 = 70, V1 = 132, ACC = 240;
// State slots.
const MODE = 0, T = 1, LEFT = 2, Y = 3, VY = 4, SPEED = 5, SCROLL = 6, SCORE = 7, HITS = 8, CLOSE = 9, WOB = 10, NEXT = 11, CARD = 12, HELD = 13, DIST = 14, CURB = 15, PATTERN = 16;
/** Events this step: start, a close pass, a hit, the curb, the end. */
export const EV_START = 0, EV_CLOSE = 1, EV_HIT = 2, EV_CURB = 3, EV_END = 4;
const WORDS = ["CLOSE!", "WOBBLE", "CURB!", "BOMBED IT", "+5", "SO CLOSE!"];
const DUST = 0, CHIP = 1, SPARK = 2;

export function hillBomb(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(20), ev = new Uint8Array(5);
  const CX = new Float64Array(N).fill(-99), CY = new Float64Array(N), CD = new Uint8Array(N); // cone x, y, passed/hit
  const sp = spray(160, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  (S[Y] = MID), (S[SPEED] = demo ? V0 : 0), (S[NEXT] = 40);
  if (demo) cone(110, MID + 6), cone(150, MID - 14), cone(150, MID + 22);
  function cone(x: number, y: number) {
    for (let i = 0; i < N; i++) if (CX[i]! < -20) return void ((CX[i] = x), (CY[i] = y), (CD[i] = 0));
  }
  /** The next bit of the course: a single cone, a gate (two with a gap), or a line across. */
  function spawn(x: number) {
    const p = S[PATTERN]! % 3;
    S[PATTERN] = S[PATTERN]! + 1 + (R() < 0.3 ? 1 : 0);
    if (p === 0) cone(x, TOP + 8 + R() * (BOT - TOP - 16));
    else if (p === 1) {
      const gap = TOP + 14 + R() * (BOT - TOP - 28);
      cone(x, gap - 11), cone(x, gap + 11);
    } else {
      const off = R() * 12;
      cone(x, TOP + 6 + off), cone(x + 14, MID + off * 0.3), cone(x + 28, BOT - 6 - off);
    }
    S[NEXT] = 40 + R() * 22;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[HITS] = 0), (S[CLOSE] = 0), (S[DIST] = 0), (S[CURB] = 0), (S[WOB] = 0);
    if (S[SPEED]! < V0) S[SPEED] = V0;
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
    // The ghost steers for the widest gap ahead.
    let held = mode === PLAY ? pad[0]! > 0 : false;
    if (mode === DEMO) {
      let want = MID;
      for (let i = 0; i < N; i++) if (CX[i]! > SX && CX[i]! < SX + 44 && Math.abs(CY[i]! - S[Y]!) < 9) want = CY[i]! > S[Y]! ? CY[i]! - 14 : CY[i]! + 14;
      held = S[Y]! + S[VY]! * 0.12 > want;
    }
    S[HELD] = held ? 1 : 0;
    if (riding) {
      // Carve: hold to climb the road, let go to drift down it.
      S[VY] = S[VY]! + (held ? -ACC : ACC) * dt;
      S[VY] = S[VY]! * (1 - 3 * dt);
      S[Y] = S[Y]! + S[VY]! * dt;
      if (S[Y]! < TOP + 3 || S[Y]! > BOT - 3) {
        S[Y] = S[Y]! < MID ? TOP + 3 : BOT - 3;
        S[VY] = -S[VY]! * 0.3;
        if (S[CURB]! <= 0) {
          (S[CURB] = 0.5), (S[SPEED] = S[SPEED]! * 0.7), (S[WOB] = 0.6), (S[HITS] = S[HITS]! + 1);
          wd.say(2, SX + 10, S[Y]! < MID ? TOP + 10 : BOT - 12, 2);
          sp.burst(SX, S[Y]!, 10, 40, S[Y]! < MID ? 1.5708 : -1.5708, 2, 1.2, SPARK);
          ev[EV_CURB] = 1;
        }
      }
      S[CURB] = Math.max(0, S[CURB]! - dt);
      const target = mode === PLAY ? V0 + ((V1 - V0) * (ROUND - S[LEFT]!)) / ROUND : V0;
      S[SPEED] = S[SPEED]! + (target - S[SPEED]!) * Math.min(1, dt * 0.9);
    } else {
      S[SPEED] = S[SPEED]! * (1 - dt * 1.6);
      if (S[SPEED]! < 1) S[SPEED] = 0;
      S[VY] = S[VY]! * (1 - dt * 6);
      if (Math.abs(S[VY]!) < 0.05) S[VY] = 0;
      S[Y] = S[Y]! + S[VY]! * dt;
    }
    const dx = S[SPEED]! * dt;
    S[SCROLL] = S[SCROLL]! + dx;
    S[DIST] = S[DIST]! + dx;
    if (mode === PLAY) while (S[DIST]! >= 25) (S[DIST] = S[DIST]! - 25), (S[SCORE] = S[SCORE]! + 1);
    S[NEXT] = S[NEXT]! - dx;
    if (riding && S[NEXT]! <= 0) spawn(W + 10);
    // The cones: a hit wobbles you; a close pass scores.
    for (let i = 0; i < N; i++) {
      if (CX[i]! < -20) continue;
      CX[i] = CX[i]! - dx;
      const ddx = CX[i]! - SX, ddy = CY[i]! - S[Y]!;
      if (!CD[i] && Math.abs(ddx) < 4 && Math.abs(ddy) < 4.5) {
        (CD[i] = 2), (S[WOB] = 0.6), (S[SPEED] = S[SPEED]! * 0.6), (S[HITS] = S[HITS]! + 1), (S[VY] = S[VY]! + (ddy > 0 ? -60 : 60));
        wd.say(1, SX + 8, S[Y]! - 10, 2);
        sp.burst(CX[i]!, CY[i]!, 10, 50, 0, TAU, 1.2, CHIP);
        ev[EV_HIT] = 1;
      } else if (!CD[i] && ddx < -4) {
        CD[i] = 1;
        if (Math.abs(ddy) < 9 && mode === PLAY) {
          const tight = Math.abs(ddy) < 6.5;
          (S[CLOSE] = S[CLOSE]! + 1), (S[SCORE] = S[SCORE]! + (tight ? 10 : 5));
          wd.say(tight ? 5 : 0, SX + 12, CY[i]! < S[Y]! ? S[Y]! + 10 : S[Y]! - 10, tight ? 1 : 0);
          ev[EV_CLOSE] = 1;
        }
      }
    }
    S[WOB] = Math.max(0, S[WOB]! - dt);
    // Grit off the wheels and speed lines.
    if (S[SPEED]! > 40 && R() < dt * (S[SPEED]! / 6)) sp.burst(SX - 6, S[Y]! + (R() - 0.5) * 3, 1, 20, Math.PI, 0.4, 0.8, DUST);
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1), wd.say(3, 80, 40, 1);
    } else if (mode === DEMO && S[T]! > 3.4) S[MODE] = IDLE;
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    const moving = sp.step(dt, 0) + wd.step(dt);
    return riding || S[SPEED]! > 0 || S[VY] !== 0 || S[WOB]! > 0 || moving > 0 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  return { S, ev, sp, wd, step, CX, CY, CD };
}
export type HillBomb = ReturnType<typeof hillBomb>;

export type BombScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: HillBomb; poster(): void; readonly state: { mode: number; score: number; hits: number; close: number; left: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): BombScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to carve up the road, let go to drift down", { start: "ready", close: "click", hit: "hurt", curb: "hit", end: "win" });
  const g = r.g;
  const ride = hillBomb((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, { CX, CY, CD } = ride;
  if (first) r.pad[1] = 1;
  const DEBRIS = ["rgba(174,164,214,.55)", C.advance, C.hurt];
  const WCOL = [C.fallin, C.hurt, C.attack];
  engine.add({
    read() {
      r.read();
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_CLOSE]) e.events.emit("close");
      if (ev[EV_HIT]) e.events.emit("hit");
      if (ev[EV_CURB]) e.events.emit("curb");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const sc = S[SCROLL]!, mode = S[MODE]!;
      // The hillside from above: verges with tufts and fence posts, the curbs, the asphalt.
      g.fillStyle = "#123d2a";
      g.fillRect(0, 0, W, H);
      g.fillStyle = C.go;
      g.globalAlpha = 0.35;
      for (let k = 0; k < 16; k++) {
        const x = ((k * 23 - sc) % 368 + 368) % 368 - 8, y = (k * 7) % 14 + 2;
        g.fillRect(x, y, 2, 1), g.fillRect(x + 1, y - 1, 1, 1);
      }
      g.globalAlpha = 1;
      g.fillStyle = C.fallin;
      for (let k = 0; k < 9; k++) g.fillRect(((k * 20 - sc) % 180 + 180) % 180 - 10, 15, 1.2, 3);
      g.fillStyle = C.line;
      g.fillRect(0, TOP - 2, W, H - TOP + 2);
      g.fillStyle = C.surface;
      g.fillRect(0, TOP, W, BOT - TOP);
      g.fillStyle = "#123d2a";
      g.fillRect(0, BOT + 2, W, H - BOT - 2);
      g.fillStyle = C.ink;
      for (let k = 0; k < 14; k++) {
        const x = ((k * 12 - sc) % 168 + 168) % 168 - 8;
        g.globalAlpha = k & 1 ? 0.9 : 0.3;
        g.fillRect(x, TOP - 2, 6, 1.4), g.fillRect(x + 6, BOT + 0.6, 6, 1.4);
      }
      g.globalAlpha = 1;
      // The centre line, dashes rushing by; speed streaks when it's fast.
      g.fillStyle = C.hurt;
      for (let k = 0; k < 8; k++) g.fillRect(((k * 24 - sc) % 192 + 192) % 192 - 16, MID - 0.6, 12, 1.2);
      const fast = Math.max(0, (S[SPEED]! - 90) / 50);
      if (fast > 0) {
        g.strokeStyle = C.ink;
        g.globalAlpha = 0.25 * fast;
        g.lineWidth = 0.4;
        g.beginPath();
        for (let k = 0; k < 7; k++) {
          const x = ((k * 53 - sc * 1.6) % 200 + 200) % 200 - 20, y = TOP + 4 + ((k * 17) % (BOT - TOP - 8));
          g.moveTo(x, y), g.lineTo(x + 18, y);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
      // Cones from above: an orange square base, a round top with a white band.
      for (let i = 0; i < N; i++) {
        const x = CX[i]!, y = CY[i]!;
        if (x < -20 || x > W + 10) continue;
        if (CD[i] === 2) continue; // knocked flying: the chips show it
        g.fillStyle = C.rim;
        g.globalAlpha = 0.4;
        g.fillRect(x - 3, y - 1.6, 6.5, 5);
        g.globalAlpha = 1;
        g.fillStyle = C.advance;
        g.fillRect(x - 3.2, y - 3.2, 6.4, 6.4);
        g.beginPath();
        g.arc(x, y, 2.6, 0, TAU);
        g.fillStyle = C.ink;
        g.fill();
        g.beginPath();
        g.arc(x, y, 1.6, 0, TAU);
        g.fillStyle = C.advance;
        g.fill();
      }
      // The rider from above: a long board along the road, crouched, carving with the lean.
      const lean = Math.max(-1, Math.min(1, S[VY]! / 80)), wob = S[WOB]! > 0 ? Math.sin(S[WOB]! * 40) * 0.25 : 0;
      g.save();
      g.translate(SX, S[Y]!);
      g.rotate(lean * 0.35 + wob);
      g.fillStyle = C.rim;
      g.globalAlpha = 0.35;
      g.beginPath();
      g.ellipse(1.5, 2, 9, 3, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = C.cmd;
      g.beginPath();
      g.roundRect(-9, -2.4, 18, 4.8, 2.4);
      g.fill();
      g.fillStyle = C.ink;
      g.fillRect(-7, -3.2, 2, 0.8), g.fillRect(-7, 2.4, 2, 0.8), g.fillRect(5, -3.2, 2, 0.8), g.fillRect(5, 2.4, 2, 0.8);
      // Shoulders across, head forward, arms out for balance.
      g.strokeStyle = C.attack;
      g.lineWidth = 2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-1, -4.5 - lean * 1.5), g.lineTo(1, 4.5 - lean * 1.5);
      g.stroke();
      g.strokeStyle = C.ink;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-0.5, -4 - lean), g.lineTo(-4, -7.5 - lean * 2);
      g.moveTo(0.5, 4 - lean), g.lineTo(4, 7.5 - lean * 2);
      g.stroke();
      g.fillStyle = C.hurt;
      g.beginPath();
      g.arc(2, 0, 2.2, 0, TAU);
      g.fill();
      g.restore();
      r.drawSpray(ride.sp, DEBRIS);
      r.drawWords(ride.wd, WCOL);
      r.hud(S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.fallin);
      // The speedo: a bar that fills as the hill takes you.
      g.fillStyle = "rgba(7,6,15,.55)";
      g.fillRect(48, 7, 40, 3.5);
      g.fillStyle = S[SPEED]! > 115 ? C.attack : C.fallin;
      g.fillRect(48, 7, 40 * Math.min(1, S[SPEED]! / V1), 3.5);
      if (mode === IDLE || (mode === DEMO && S[T]! > 2.6)) r.caption("HOLD TO CARVE UP · LET GO TO DRIFT", MID - 14, 6, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.65)";
        g.beginPath();
        g.roundRect(42, MID - 18, 76, 32, 6);
        g.fill();
        r.caption(NUM[Math.min(999, S[SCORE]! | 0)]!, MID - 7, 14, C.fallin);
        r.caption(S[HITS] === 0 ? "NOT ONE CONE" : S[CLOSE]! >= 4 ? "THREADED IT" : "WOBBLY BOMB", MID + 4, 6, C.ink);
        if (S[CARD]! > 0.8) r.caption("PRESS TO BOMB AGAIN", MID + 10.5, 5, C.muted);
      }
    },
  });

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, hits: S[HITS]!, close: S[CLOSE]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, threading the first gate (scripts/gallery-posters.mjs). */
export const posterAt = 1.4;
