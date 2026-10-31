// "Lip Line" (surf-sesh): carve a rolling wave at dusk. Hold to climb the face, let go to drop back
// to the trough. A curl feathers along the lip toward you: meet it at the top as it passes and you
// SNAP off it (spray, points, and the next snap in a chain is worth more); hit the lip anywhere else
// and you CHOP (the chain breaks, you lose speed). Ten seconds a ride, then the score card, then it
// sleeps until the next press.
// Bricks: the kernel (fixed step; settle: it sleeps on the card and when idle; its ledger for every
// page write, so Recall gives the page back byte for byte), fizlet/slot, fizlet/sound. The rig (canvas,
// hold input, keys, synth, spray, words): kit.ts. The ride itself is `lipLine()`, plain numbers, no
// DOM, so its step is tested headless (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
const SX = 60, CREST = 26, TROUGH = 74, MARK_V = 44;
// State slots.
const MODE = 0, T = 1, LEFT = 2, Y = 3, VY = 4, SCROLL = 5, SPEED = 6, MX = 7, NEXT = 8, SCORE = 9, CHAIN = 10, BEST = 11, SNAPS = 12, CHOPS = 13, TRAIL = 14, LEAN = 15, CARD = 16, HELD = 17, FLASH = 18, BOB = 19;
/** Events this step (for the synth): snap, chop, start, end. */
export const EV_SNAP = 0, EV_CHOP = 1, EV_START = 2, EV_END = 3;
const WORDS = ["SNAP!", "CHOP", "RAD!", "GNARLY!", "STOKED!"];
/** Spray colour slots. */
const FOAM = 0, MIST = 1, GLOW = 2;

/** The ride: plain numbers (headless-testable). `pad`: [0] held, [1] presses. */
export function lipLine(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(24), ev = new Uint8Array(4);
  const sp = spray(160, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  (S[Y] = 0.3), (S[SPEED] = demo ? 1 : 0), (S[MX] = demo ? 128 : -99), (S[NEXT] = 0.6);
  const surferY = () => TROUGH - S[Y]! * (TROUGH - CREST);
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[CHAIN] = 0), (S[BEST] = 0), (S[SNAPS] = 0), (S[CHOPS] = 0), (S[SPEED] = 1);
    (S[MX] = 150), (S[NEXT] = 0);
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
    // Who holds: the rider, or (the attract run) a ghost that times the first curl.
    const held = mode === PLAY ? pad[0]! > 0 : mode === DEMO ? S[MX]! - SX < 30 && S[MX]! - SX > -4 && S[Y]! < 0.97 : false;
    S[HELD] = held ? 1 : 0;
    if (riding) {
      S[VY] = S[VY]! + (held ? 3.6 : -4) * dt;
      S[VY] = S[VY]! * (1 - 0.5 * dt);
      S[Y] = S[Y]! + S[VY]! * dt;
      if (S[Y]! <= 0) {
        // A bottom turn: speed back up, a fan of foam off the rail.
        if (S[VY]! < -0.6) sp.burst(SX - 3, TROUGH + 1, 5, 24, -2.6, 0.9, 1.4, FOAM);
        (S[Y] = 0), (S[VY] = 0), (S[SPEED] = Math.min(1, S[SPEED]! + 0.15));
      }
      if (S[Y]! >= 1) {
        S[Y] = 1;
        const y = CREST;
        if (Math.abs(S[MX]! - SX) < 10) {
          // The snap: off the curl, the chain grows.
          S[CHAIN] = Math.min(5, S[CHAIN]! + 1);
          S[SCORE] = S[SCORE]! + 10 * S[CHAIN]!;
          S[BEST] = Math.max(S[BEST]!, S[CHAIN]!);
          S[SNAPS] = S[SNAPS]! + 1;
          S[VY] = -1.7;
          S[FLASH] = 0.25;
          sp.burst(SX + 2, y - 2, 26, 70, -1.9, 1.6, 1.8, FOAM);
          sp.burst(SX + 2, y - 4, 10, 40, -1.6, 2.4, 2.6, MIST);
          sp.burst(S[MX]!, y - 1, 8, 50, -1.5708, 1.2, 1.2, GLOW);
          wd.say(S[CHAIN]! >= 4 ? 4 : S[CHAIN]! === 3 ? 3 : S[CHAIN]! === 2 ? 2 : 0, SX + 8, y - 10, S[CHAIN]! >= 3 ? 1 : 0);
          (S[MX] = -99), (S[NEXT] = 0.5 + R() * 0.7);
          ev[EV_SNAP] = 1;
        } else {
          // The chop: the lip knocks you back, the chain breaks.
          (S[CHAIN] = 0), (S[CHOPS] = S[CHOPS]! + 1), (S[VY] = -1), (S[SPEED] = S[SPEED]! * 0.7);
          sp.burst(SX, y, 10, 30, -1.5708, 2.2, 1.4, MIST);
          wd.say(1, SX + 6, y - 9, 2);
          ev[EV_CHOP] = 1;
        }
      }
      // Carving throws a trail off the rail.
      S[TRAIL] = S[TRAIL]! + dt * Math.abs(S[VY]!) * 30;
      while (S[TRAIL]! > 1) (S[TRAIL] = S[TRAIL]! - 1), sp.burst(SX - 4, surferY() + 1, 1, 34, S[VY]! > 0 ? 2.7 : -2.9, 0.7, 1, FOAM);
      // The curl travels along the lip toward you; a new one feathers in from the right.
      if (S[MX]! > -50) S[MX] = S[MX]! - MARK_V * (0.7 + 0.3 * S[SPEED]!) * dt;
      if (S[MX]! < SX - 14 && S[MX]! > -50) (S[MX] = -99), (S[CHAIN] = mode === PLAY ? 0 : S[CHAIN]!), (S[NEXT] = 0.3 + R() * 0.6);
      if (S[MX]! <= -50) {
        S[NEXT] = S[NEXT]! - dt;
        if (S[NEXT]! <= 0) S[MX] = W + 10;
      }
      S[SCROLL] = S[SCROLL]! + dt * (30 + 30 * S[SPEED]!);
      S[SPEED] = Math.max(0.4, S[SPEED]! - dt * 0.03);
      S[LEAN] = S[LEAN]! + (Math.max(-1, Math.min(1, S[VY]!)) - S[LEAN]!) * Math.min(1, dt * 8);
      S[BOB] = S[BOB]! + dt;
    }
    if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      if (S[LEFT] === 0) (S[MODE] = DONE), (S[CARD] = 0), (S[MX] = -99), (ev[EV_END] = 1), wd.say(4, W / 2, 40, 1);
    } else if (mode === DEMO && S[T]! > 3.4) {
      (S[MODE] = IDLE), (S[MX] = -99), (S[SCORE] = 0), (S[CHAIN] = 0);
    } else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    if (S[MODE] === IDLE || S[MODE] === DONE) {
      // Off the wave: the rider settles to a glide on the face, then everything is still.
      S[VY] = 0;
      const k = Math.min(1, dt * 4), d = (0.35 - S[Y]!) * k;
      S[Y] = Math.abs(d) < 0.0005 ? 0.35 : S[Y]! + d;
      S[LEAN] = Math.abs(S[LEAN]!) < 0.002 ? 0 : S[LEAN]! * (1 - k);
    }
    S[FLASH] = Math.max(0, S[FLASH]! - dt);
    const moving = sp.step(dt, 60) + wd.step(dt);
    return riding || moving > 0 || S[FLASH]! > 0 || (S[MODE] === DONE && S[CARD]! < 1.4) || Math.abs(S[Y]! - 0.35) > 0.0005 || S[LEAN] !== 0;
  }
  return { S, ev, sp, wd, step, surferY };
}
export type LipLine = ReturnType<typeof lipLine>;

export type LipScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: LipLine; poster(): void; readonly state: { mode: number; score: number; snaps: number; chops: number; best: number; left: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): LipScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to carve up the wave", { snap: "power", chop: "hit", start: "ready", end: "win" });
  const g = r.g;
  const ride = lipLine((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S;
  if (first) r.pad[1] = 1;
  const SPRAY = [C.ink, "rgba(246,243,255,.55)", C.go];
  const WCOL = [C.ink, C.hurt, C.aim];
  // The dusk, made once a resize (gradients are objects).
  let sky: CanvasGradient | string = C.raised, face: CanvasGradient | string = C.sys;
  engine.add({
    read() {
      r.read();
      if (typeof sky === "string") {
        const s = g.createLinearGradient(0, 0, 0, 40);
        s.addColorStop(0, C.surface), s.addColorStop(0.45, C.cmd), s.addColorStop(0.8, C.attack), s.addColorStop(1, C.advance);
        const f = g.createLinearGradient(0, CREST, 0, H);
        f.addColorStop(0, C.sys), f.addColorStop(0.35, "#0b8aa8"), f.addColorStop(1, C.surface);
        (sky = s), (face = f);
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_SNAP]) e.events.emit("snap", 0, 0, 0, 0, 1 + S[10]! / 4);
      if (ev[EV_CHOP]) e.events.emit("chop");
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      r.begin();
      const t = S[T]!, sc = S[SCROLL]!;
      // Sky, the sun on the horizon, the far line of swell.
      g.fillStyle = sky;
      g.fillRect(0, 0, W, 42);
      g.fillStyle = C.hurt;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(126, 38, 9, Math.PI, 0);
      g.fill();
      g.globalAlpha = 0.5;
      for (let k = 0; k < 4; k++) g.fillRect(114 + k * 2, 31 + k * 2.2, 24 - k * 4, 0.7);
      g.globalAlpha = 1;
      g.fillStyle = C.line;
      g.fillRect(0, 36, W, 6);
      g.fillStyle = C.cmd;
      g.globalAlpha = 0.5;
      for (let k = 0; k < 9; k++) g.fillRect(((k * 23 - sc * 0.15) % 180 + 180) % 180 - 10, 37 + (k % 3) * 1.6, 9, 0.6);
      g.globalAlpha = 1;
      // The wave: a face that stands up from the left shoulder into the peak, a lip of foam.
      g.fillStyle = face;
      g.beginPath();
      g.moveTo(0, 46);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, crest(x, sc));
      g.lineTo(W, H), g.lineTo(0, H);
      g.fill();
      // Lines on the face run with the wave.
      g.strokeStyle = "rgba(246,243,255,.22)";
      g.lineWidth = 0.6;
      for (let k = 0; k < 7; k++) {
        const y = CREST + 8 + k * 6.5, off = ((k * 37 - sc * (1 + k * 0.15)) % 60 + 60) % 60;
        g.beginPath();
        for (let x = -off; x < W; x += 60) g.moveTo(x, y + Math.sin(x * 0.05 + k) * 1.2), g.lineTo(x + 26, y + Math.sin((x + 26) * 0.05 + k) * 1.2);
        g.stroke();
      }
      // The lip: a ribbon of foam along the crest; the curl glows where it feathers.
      g.strokeStyle = C.ink;
      g.lineWidth = 2.2;
      g.beginPath();
      for (let x = 0; x <= W; x += 4) x === 0 ? g.moveTo(x, crest(x, sc)) : g.lineTo(x, crest(x, sc));
      g.stroke();
      const mx = S[MX]!;
      if (mx > -40) {
        const cy = crest(mx, sc);
        g.fillStyle = C.go;
        g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 20);
        g.beginPath();
        g.ellipse(mx, cy, 11, 5, 0, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
        // The feathering curl: a hook of white over the glow.
        g.fillStyle = C.ink;
        g.beginPath();
        g.moveTo(mx - 7, cy + 0.5);
        g.quadraticCurveTo(mx - 2, cy - 7, mx + 5, cy - 3.5);
        g.quadraticCurveTo(mx + 1, cy - 3, mx + 1, cy + 1);
        g.fill();
        g.strokeStyle = C.go;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(mx - 5, cy + 3), g.lineTo(mx + 5, cy + 3);
        g.stroke();
      }
      // The rider.
      rider(SX, ride.surferY(), S[LEAN]!, S[HELD]!, S[FLASH]!);
      r.drawSpray(ride.sp, SPRAY);
      r.drawWords(ride.wd, WCOL);
      const mode = S[MODE]!;
      r.hud(S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.hurt);
      if (mode === IDLE || (mode === DEMO && t > 2.4)) r.caption("HOLD TO CARVE", 82, 9, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.6)";
        g.beginPath();
        g.roundRect(44, 46, 72, 34, 6);
        g.fill();
        r.caption(NUM[Math.min(999, S[SCORE]! | 0)]!, 58, 14, C.hurt);
        r.caption(S[BEST]! >= 3 ? "BIG CHAIN" : S[SNAPS]! ? "NICE LINE" : "PADDLE BACK?", 69, 6, C.ink);
        if (S[CARD]! > 0.8) r.caption("HOLD TO RIDE AGAIN", 76, 5, C.muted);
      }
    },
  });
  /** The crest's height at x (the wave stands taller toward the peak on the right). */
  function crest(x: number, sc: number) {
    const peak = x / W;
    return CREST + 14 * (1 - peak) * (1 - peak) + Math.sin(x * 0.07 - sc * 0.05) * 0.9;
  }
  /** The rider: a short board on the face, crouched to stand by the lean; a halo of light on a snap. */
  function rider(x: number, y: number, lean: number, held: number, flash: number) {
    g.save();
    g.translate(x, y);
    g.rotate(-lean * 0.55);
    if (flash > 0) {
      g.fillStyle = C.hurt;
      g.globalAlpha = flash * 2;
      g.beginPath();
      g.arc(0, -6, 10, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    // Board: a rail and a fin.
    g.fillStyle = C.attack;
    g.beginPath();
    g.ellipse(0, 0, 8, 1.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = C.ink;
    g.fillRect(-6, -0.3, 12, 0.6);
    g.fillStyle = C.rim;
    g.beginPath();
    g.moveTo(-5, 1), g.lineTo(-6.5, 3.2), g.lineTo(-3.5, 1);
    g.fill();
    // Body: crouched while climbing, tall on the drop.
    const c = held ? 1 : 0, hip = -5 + c * 1.4, sh = -10 + c * 2.4;
    g.strokeStyle = C.rim;
    g.lineWidth = 1.8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3, -0.8), g.lineTo(-1.2, hip), g.lineTo(2.6, -0.8);
    g.moveTo(-1.2, hip), g.lineTo(0.2, sh);
    g.moveTo(0.2, sh + 1), g.lineTo(-5, sh + 2.5 - c);
    g.moveTo(0.2, sh + 1), g.lineTo(5, sh - 1 + c * 2);
    g.stroke();
    g.fillStyle = C.rim;
    g.beginPath();
    g.arc(0.6, sh - 2, 1.9, 0, TAU);
    g.fill();
    // Trunks.
    g.fillStyle = C.sys;
    g.fillRect(-2.4, hip - 1, 3.6, 2);
    g.restore();
  }

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, snaps: S[SNAPS]!, chops: S[CHOPS]!, best: S[BEST]!, left: S[LEFT]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, the first snap just thrown (scripts/gallery-posters.mjs). */
export const posterAt = 1.9;
