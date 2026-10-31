// "Pump Pipe" (skate-sesh): a halfpipe under the lights. Hold to crouch as you drop down a wall and
// you pump speed out of it; hold on the way up and it costs you. Get over the coping and you fly:
// tap in the air to flip the board (tap again for another), and have it back under your feet by the
// time you land or you BAIL. Ten seconds a session, then the score card, then it sleeps until the
// next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), fizlet/slot, fizlet/sound. The rig: kit.ts. The session is `pumpPipe()`,
// plain numbers, no DOM (tests/skate-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
// The pipe: two quarter circles (radius RAD) either side of a flat, coping at y CY.
const RAD = 30, FLAT = 48, CX0 = 80 - FLAT / 2, CX1 = 80 + FLAT / 2, CY = 46, FLOOR = CY + RAD;
const ARC = (Math.PI / 2) * RAD, LEN = ARC * 2 + FLAT, G = 200, VMAX = 150, FLIP = 0.42;
// State slots.
const MODE = 0, T = 1, LEFT = 2, U = 3, V = 4, AIR = 5, Z = 6, VZ = 7, SIDE = 8, SPIN = 9, FLIPS = 10, SCORE = 11, BAIL = 12, HELD = 13, CARD = 14, TRICKS = 15, BAILS = 16, BEST = 17, PEAK = 18, QUEUE = 19, LIGHTS = 20;
/** Events this step: start, launch, a trick landed, a bail, the end. */
export const EV_START = 0, EV_AIR = 1, EV_LAND = 2, EV_BAIL = 3, EV_END = 4;
const WORDS = ["FLIP!", "DOUBLE FLIP!", "TRIPLE!", "BAIL!", "AIR", "SESSION!"];
/** Debris slots: sparks off the coping, dust, wood chips. */
const SPARK = 0, DUST = 1, CHIP = 2;

/** Where on the pipe u is: x, y, and the surface angle (0 on the flat, ±π/2 at the coping). */
export function at(u: number, out: Float64Array) {
  if (u < ARC) {
    const th = Math.PI / 2 - u / RAD;
    (out[0] = CX0 - RAD * Math.sin(th)), (out[1] = CY + RAD * Math.cos(th)), (out[2] = th);
  } else if (u <= ARC + FLAT) (out[0] = CX0 + (u - ARC)), (out[1] = FLOOR), (out[2] = 0);
  else {
    const th = (u - ARC - FLAT) / RAD;
    (out[0] = CX1 + RAD * Math.sin(th)), (out[1] = CY + RAD * Math.cos(th)), (out[2] = -th);
  }
  return out;
}

export function pumpPipe(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(24), ev = new Uint8Array(5), P = new Float64Array(3);
  const sp = spray(160, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  (S[U] = demo ? 0.5 : ARC + FLAT / 2), (S[V] = demo ? 30 : 0), (S[LIGHTS] = demo ? 0 : 1);
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[TRICKS] = 0), (S[BAILS] = 0), (S[BEST] = 0), (S[BAIL] = 0);
    if (!S[AIR] && Math.abs(S[V]!) < 90) S[V] = (S[V]! < 0 ? -1 : 1) * 112; // a kick push
    ev[EV_START] = 1;
  }
  function land() {
    S[AIR] = 0;
    const left = S[SIDE]! < 0, frac = S[SPIN]! - Math.floor(S[SPIN]!);
    at(left ? 0.01 : LEN - 0.01, P);
    if (S[SPIN]! > 0 && frac > 0.18 && frac < 0.82) {
      // Board not back under the feet: bail. Slide down slow.
      (S[BAIL] = 0.8), (S[V] = (left ? 1 : -1) * 40), (S[BAILS] = S[BAILS]! + 1);
      wd.say(3, P[0]!, P[1]! - 18, 2);
      sp.burst(P[0]!, P[1]!, 14, 50, -1.5708, 2.6, 1.4, CHIP);
      ev[EV_BAIL] = 1;
    } else {
      // Back in: down the wall at the speed you went up.
      S[V] = (left ? 1 : -1) * Math.abs(S[VZ]!);
      const n = Math.round(S[SPIN]!);
      if (S[MODE] === PLAY) {
        const air = S[PEAK]! / 26;
        S[SCORE] = S[SCORE]! + (n ? 10 * n * n * (1 + air) : 2 + air * 3);
        S[TRICKS] = S[TRICKS]! + n;
        S[BEST] = Math.max(S[BEST]!, n);
      }
      if (n) wd.say(n >= 3 ? 2 : n === 2 ? 1 : 0, 80, 30, n >= 2 ? 1 : 0);
      else wd.say(4, P[0]! + (left ? 12 : -12), P[1]! - 16, 0);
      sp.burst(P[0]!, P[1]!, 10, 60, left ? -0.6 : -2.5, 1.2, 1, SPARK);
      ev[EV_LAND] = 1;
    }
    (S[SPIN] = 0), (S[FLIPS] = 0), (S[QUEUE] = 0);
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 0.8))) start(), (mode = PLAY);
    const riding = mode === PLAY || mode === DEMO;
    S[LIGHTS] = Math.min(1, S[LIGHTS]! + dt * 2);
    // The ghost (attract run): pumps the drops, flips once over the coping.
    let held = mode === PLAY ? pad[0]! > 0 : false;
    at(S[U]!, P);
    const th = P[2]!, down = S[V]! * th > 0; // moving toward the flat
    if (mode === DEMO) held = down && Math.abs(th) > 0.2;
    S[HELD] = held ? 1 : 0;
    if (S[AIR]) {
      // In the air over the coping: a tap starts a flip (more taps queue more).
      const taps = mode === PLAY ? presses : mode === DEMO && S[VZ]! < 30 && S[SPIN] === 0 ? 1 : 0;
      if (taps > 0 && S[BAIL]! <= 0) S[QUEUE] = S[QUEUE]! + taps;
      if (S[QUEUE]! > 0 && S[SPIN]! >= S[FLIPS]!) (S[FLIPS] = S[FLIPS]! + 1), (S[QUEUE] = S[QUEUE]! - 1);
      if (S[SPIN]! < S[FLIPS]!) S[SPIN] = Math.min(S[FLIPS]!, S[SPIN]! + dt / FLIP);
      S[VZ] = S[VZ]! - G * dt;
      S[Z] = S[Z]! + S[VZ]! * dt;
      S[PEAK] = Math.max(S[PEAK]!, S[Z]!);
      if (S[Z]! <= 0) (S[Z] = 0), (S[VZ] = -S[VZ]!), land();
    } else {
      // On the pipe: gravity along the surface, the pump, a little friction.
      const a = G * Math.sin(th) * (S[U]! < ARC ? 1 : S[U]! > ARC + FLAT ? 1 : 0);
      S[V] = S[V]! + a * dt;
      if (riding && S[BAIL]! <= 0 && Math.abs(th) > 0.05) S[V] = S[V]! + (held ? (down ? 70 : -30) : 0) * Math.sign(S[V]!) * dt;
      S[V] = S[V]! - Math.sign(S[V]!) * Math.min(Math.abs(S[V]!), (riding ? 7 : 60) * dt);
      if (!riding) S[V] = S[V]! * (1 - dt * 1.2);
      S[V] = Math.max(-VMAX, Math.min(VMAX, S[V]!));
      S[U] = S[U]! + S[V]! * dt;
      if (S[U]! <= 0 || S[U]! >= LEN) {
        // Over the coping: up you go (sparks off the steel).
        const left = S[U]! <= 0;
        S[U] = left ? 0 : LEN;
        if (Math.abs(S[V]!) > 8 && riding) {
          (S[AIR] = 1), (S[SIDE] = left ? -1 : 1), (S[VZ] = Math.abs(S[V]!)), (S[Z] = 0), (S[PEAK] = 0), (S[V] = 0);
          at(S[U]!, P);
          sp.burst(P[0]!, P[1]!, 8, 50, -1.5708, 1.4, 1, SPARK);
          ev[EV_AIR] = 1;
        } else S[V] = left ? 4 : -4;
      }
      if (S[BAIL]! > 0) S[BAIL] = Math.max(0, S[BAIL]! - dt);
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0 && !S[AIR]) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1), wd.say(5, 80, 30, 1);
    } else if (mode === DEMO && S[T]! > 4.2 && !S[AIR]) (S[MODE] = IDLE), (S[SCORE] = 0);
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    // Off the clock: roll to a stop on the flat.
    if ((S[MODE] === IDLE || S[MODE] === DONE) && !S[AIR] && Math.abs(S[V]!) < 1.5 && S[U]! > ARC - 2 && S[U]! < ARC + FLAT + 2) S[V] = 0;
    const moving = sp.step(dt, 120) + wd.step(dt);
    return riding || S[AIR] === 1 || S[V] !== 0 || moving > 0 || S[BAIL]! > 0 || S[LIGHTS]! < 1 || (S[MODE] === DONE && S[CARD]! < 1.4);
  }
  return { S, ev, sp, wd, step, P };
}
export type PumpPipe = ReturnType<typeof pumpPipe>;

export type PipeScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: PumpPipe; poster(): void; readonly state: { mode: number; score: number; tricks: number; bails: number; best: number; left: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): PipeScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to pump, tap in the air to flip", { start: "ready", air: "click", land: "power", bail: "hurt", end: "win" });
  const g = r.g;
  const ride = pumpPipe((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S, Q = new Float64Array(3);
  if (first) r.pad[1] = 1;
  const DEBRIS = [C.hurt, "rgba(174,164,214,.6)", C.advance];
  const WCOL = [C.ink, C.hurt, C.attack];
  let sky: CanvasGradient | string = C.surface, wood: CanvasGradient | string = C.advance;
  engine.add({
    read() {
      r.read();
      if (typeof sky === "string") {
        const s = g.createLinearGradient(0, 0, 0, H);
        s.addColorStop(0, C.bg), s.addColorStop(0.6, C.raised), s.addColorStop(1, C.cmd);
        const w = g.createLinearGradient(0, CY, 0, FLOOR + 4);
        w.addColorStop(0, C.hurt), w.addColorStop(1, C.advance);
        (sky = s), (wood = w);
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_AIR]) e.events.emit("air");
      if (ev[EV_LAND]) e.events.emit("land");
      if (ev[EV_BAIL]) e.events.emit("bail");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const mode = S[MODE]!, t = S[T]!, lit = S[LIGHTS]!;
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // Two light towers and their cones over the pipe.
      for (let k = 0; k < 2; k++) {
        const x = k ? 146 : 14;
        g.fillStyle = C.line;
        g.fillRect(x - 0.8, 8, 1.6, FLOOR - 8);
        g.fillStyle = C.ink;
        g.fillRect(x - 4, 6, 8, 3);
        g.globalAlpha = 0.07 + 0.06 * lit;
        g.fillStyle = C.hurt;
        g.beginPath();
        g.moveTo(x - 3, 9), g.lineTo(k ? 50 : 110, FLOOR), g.lineTo(k ? 110 : 50, FLOOR), g.lineTo(x + 3, 9);
        g.fill();
        g.globalAlpha = 1;
      }
      // The pipe: plywood walls in the light, the flat, steel coping and the decks.
      g.fillStyle = wood;
      g.beginPath();
      g.moveTo(CX0 - RAD - 12, CY);
      g.lineTo(CX0 - RAD, CY);
      g.arc(CX0, CY, RAD, Math.PI, Math.PI / 2, true);
      g.lineTo(CX1, FLOOR);
      g.arc(CX1, CY, RAD, Math.PI / 2, 0, true);
      g.lineTo(CX1 + RAD + 12, CY);
      g.lineTo(CX1 + RAD + 12, H), g.lineTo(CX0 - RAD - 12, H);
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = C.rim;
      g.lineWidth = 0.5;
      g.globalAlpha = 0.35;
      g.beginPath();
      for (let k = 1; k < 6; k++) g.moveTo(CX0 - RAD + k * 4, CY + 2), g.lineTo(CX0 - RAD + k * 4, H), g.moveTo(CX1 + RAD - k * 4, CY + 2), g.lineTo(CX1 + RAD - k * 4, H);
      for (let k = 0; k < 7; k++) g.moveTo(CX0 + k * 8, FLOOR + 1), g.lineTo(CX0 + k * 8, H);
      g.stroke();
      g.restore();
      g.globalAlpha = 1;
      g.fillStyle = C.raised;
      g.fillRect(CX0 - RAD - 12, CY - 2, 12, 2.4);
      g.fillRect(CX1 + RAD, CY - 2, 12, 2.4);
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(CX0 - RAD, CY - 0.6, 1.3, 0, TAU);
      g.arc(CX1 + RAD, CY - 0.6, 1.3, 0, TAU);
      g.fill();
      // A painted mark on the flat: the pipe's name, no brand.
      g.fillStyle = C.attack;
      g.globalAlpha = 0.5;
      g.font = "900 6px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("PUMP", 80, FLOOR + 7);
      g.globalAlpha = 1;
      // The skater.
      if (S[AIR]) {
        const left = S[SIDE]! < 0, z = S[Z]!, up = S[VZ]! > 0;
        at(left ? 0 : LEN, Q);
        skater(Q[0]! + (left ? 3 : -3), Q[1]! - z, left ? Math.PI / 2 : -Math.PI / 2, up ? (left ? -1 : 1) : left ? 1 : -1, S[SPIN]!, 0);
      } else {
        at(S[U]!, Q);
        skater(Q[0]!, Q[1]!, Q[2]!, S[V]! >= 0 ? 1 : -1, 0, S[BAIL]!);
      }
      r.drawSpray(ride.sp, DEBRIS);
      r.drawWords(ride.wd, WCOL);
      r.hud(S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.hurt);
      if (mode === IDLE || (mode === DEMO && t > 3.4)) r.caption("HOLD ON THE DROP · TAP IN THE AIR", 22, 6, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.65)";
        g.beginPath();
        g.roundRect(42, 12, 76, 32, 6);
        g.fill();
        r.caption(NUM[Math.min(999, S[SCORE]! | 0)]!, 23, 14, C.hurt);
        r.caption(S[BEST]! >= 2 ? "BIG FLIPS" : S[TRICKS]! ? "CLEAN SESSION" : S[BAILS]! ? "SHAKE IT OFF" : "PUMP HARDER", 34, 6, C.ink);
        if (S[CARD]! > 0.8) r.caption("HOLD TO DROP IN AGAIN", 40.5, 5, C.muted);
      }
    },
  });
  /** The skater at (x, y) standing out of the surface at angle `a`, facing `dir`; the board flips
   *  with `spin` (whole turns); `bail` lays them down. */
  function skater(x: number, y: number, a: number, dir: number, spin: number, bail: number) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale(dir, 1);
    // The board: a deck that turns over along its length as it flips.
    const f = Math.cos(spin * TAU);
    g.fillStyle = f >= 0 ? C.attack : C.rim;
    g.beginPath();
    g.roundRect(-6, -1.6 - (1 - Math.abs(f)) * 2.5, 12, Math.max(0.5, 1.4 * Math.abs(f) + 0.3), 0.7);
    g.fill();
    if (Math.abs(f) > 0.4) {
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(-4, f > 0 ? 0.3 : -3.2, 0.9, 0, TAU);
      g.arc(4, f > 0 ? 0.3 : -3.2, 0.9, 0, TAU);
      g.fill();
    }
    g.strokeStyle = C.ink;
    g.lineWidth = 1.8;
    g.lineCap = "round";
    g.beginPath();
    if (bail > 0) {
      // Down on the wood, sliding.
      g.moveTo(-6, -1.5), g.lineTo(4, -1.5), g.moveTo(4, -1.5), g.lineTo(7, -3.5);
      g.stroke();
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(-7.5, -2.2, 1.8, 0, TAU);
      g.fill();
    } else {
      const c = S[HELD]! || S[AIR] ? 1.6 : 0, hip = -7 + c, sh = -12.5 + c * 1.4, lift = spin > 0 ? 2 : 0;
      g.moveTo(-3, -2.4 - lift), g.lineTo(-1, hip), g.lineTo(3, -2.4 - lift);
      g.moveTo(-1, hip), g.lineTo(0, sh);
      g.moveTo(0, sh + 1.2), g.lineTo(-4.5, sh + 3.5 - c * 1.5);
      g.moveTo(0, sh + 1.2), g.lineTo(4.5, sh + 2 - c);
      g.stroke();
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(0.6, sh - 2, 2, 0, TAU);
      g.fill();
      g.fillStyle = C.sys;
      g.fillRect(-1.2, sh - 4.2, 3.8, 1.6); // a helmet visor
      g.fillStyle = C.cmd;
      g.fillRect(-2.2, sh + 0.6, 3.6, 4.6); // the shirt
    }
    g.restore();
  }

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, tricks: S[TRICKS]!, bails: S[BAILS]!, best: S[BEST]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, the board mid-flip over the coping (scripts/gallery-posters.mjs). */
export const posterAt = 2.2;
