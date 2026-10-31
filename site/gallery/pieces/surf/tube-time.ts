// "Tube Time" (surf-sesh): inside the barrel. Hold to pump toward the light, let go and the wave
// drags you back toward the foam ball. The pocket (the green glow on the wall) wanders; ride inside
// it for the big points. Too slow and the foam eats you (WORKED); too fast and you shoot out the
// shoulder early. Last ten seconds and the barrel spits you out in a blast of mist. Then the score
// card, then it sleeps until the next press.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), fizlet/slot, fizlet/sound. The rig: kit.ts. The ride is `tubeTime()`, plain
// numbers, no DOM (tests/surf-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, caption, drawWords, hud, DEMO, DONE, H, IDLE, NUM, PLAY, TAU, W, rig, spray, words, type Pad } from "./kit";

export const ROUND = 10;
const X0 = 26, X1 = 134, FLOOR = 70;
// State slots.
const MODE = 0, T = 1, LEFT = 2, X = 3, V = 4, POCKET = 5, SCORE = 6, IN = 7, HELD = 8, END = 9, CARD = 10, FLOW = 11, PTS = 12, SURGE = 13, LEAN = 14, INSIDE = 15;
/** Events this step: start, in the pocket, worked, out, spit. */
export const EV_START = 0, EV_POCKET = 1, EV_WORKED = 2, EV_OUT = 3, EV_SPIT = 4;
/** How a ride ended: still riding, the foam, the shoulder, spat out. */
export const RIDING = 0, WORKED = 1, OUT = 2, SPIT = 3;
const WORDS = ["IN THE POCKET", "WORKED!", "TOO EARLY", "SPIT!", "DEEP!"];
const FOAM = 0, MIST = 1, GLOW = 2;
const PW = 0.13; // half the pocket's width

export function tubeTime(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(20), ev = new Uint8Array(5);
  const sp = spray(200, R), wd = words(WORDS);
  S[MODE] = demo ? DEMO : IDLE;
  (S[X] = 0.45), (S[POCKET] = 0.5);
  const px = () => X0 + S[X]! * (X1 - X0);
  /** The pocket wanders: two slow swells. */
  const pocketAt = (t: number) => 0.52 + 0.17 * Math.sin(t * 0.9) + 0.07 * Math.sin(t * 2.3 + 1);
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[PTS] = 0), (S[X] = 0.45), (S[V] = 0), (S[END] = RIDING), (S[INSIDE] = 0);
    ev[EV_START] = 1;
  }
  function finish(how: number) {
    (S[MODE] = DONE), (S[CARD] = 0), (S[END] = how);
    const x = px();
    if (how === SPIT) {
      S[SCORE] = S[SCORE]! + 25;
      sp.burst(x + 8, FLOOR - 10, 60, 120, 0, 1.4, 2.4, MIST);
      sp.burst(x + 8, FLOOR - 6, 24, 90, -0.4, 1, 1.4, FOAM);
      wd.say(3, 100, 34, 1);
      ev[EV_SPIT] = 1;
    } else if (how === WORKED) {
      sp.burst(x, FLOOR - 6, 40, 60, -1.5708, 3, 2.2, FOAM);
      wd.say(1, 60, 36, 2);
      ev[EV_WORKED] = 1;
    } else {
      sp.burst(x + 6, FLOOR - 6, 20, 70, -0.3, 1.2, 1.6, FOAM);
      wd.say(2, 108, 36, 2);
      ev[EV_OUT] = 1;
    }
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    if (presses > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 0.8))) start(), (mode = PLAY);
    const riding = mode === PLAY || mode === DEMO, t = S[T]!;
    if (riding) {
      S[POCKET] = pocketAt(t);
      // The ghost (attract run) chases the pocket.
      const held = mode === PLAY ? pad[0]! > 0 : S[X]! < S[POCKET]! - 0.02 + S[V]! * -0.4;
      S[HELD] = held ? 1 : 0;
      // The wave drags you back; it surges now and then.
      S[SURGE] = Math.max(0, Math.sin(t * 1.7 + 0.6)) * 0.55;
      S[V] = S[V]! + ((held ? 1.05 : 0) - 0.42 - S[SURGE]!) * dt;
      S[V] = S[V]! * (1 - 1.1 * dt);
      S[X] = S[X]! + S[V]! * dt;
      S[LEAN] = S[LEAN]! + (Math.max(-1, Math.min(1, S[V]! * 3)) - S[LEAN]!) * Math.min(1, dt * 6);
      const d = Math.abs(S[X]! - S[POCKET]!), inside = d < PW ? 1 : 0;
      S[IN] = S[IN]! + ((inside ? 1 : 0) - S[IN]!) * Math.min(1, dt * 6);
      if (mode === PLAY) {
        S[PTS] = S[PTS]! + dt * (inside ? 12 * (1 - d / PW) + 6 : 2);
        while (S[PTS]! >= 1) (S[PTS] = S[PTS]! - 1), (S[SCORE] = S[SCORE]! + 1);
        if (inside && !S[INSIDE]) wd.say(S[SCORE]! > 40 ? 4 : 0, px(), FLOOR - 26, 0), (ev[EV_POCKET] = 1);
        S[INSIDE] = inside;
      }
      // Spray off the rail, mist from the foam ball, and drops from the lip.
      if (R() < dt * 30) sp.burst(px() - 5, FLOOR - 1, 1, 26, -2.7, 0.6, 1, FOAM);
      if (R() < dt * 40) sp.burst(X0 - 8 + R() * 10, 40 + R() * 30, 1, 30, -0.4, 1.4, 1.8, MIST);
      if (R() < dt * 14) sp.burst(X0 + R() * (X1 - X0), 16 + R() * 6, 1, 6, 1.5708, 0.5, 0.8, GLOW);
      S[FLOW] = S[FLOW]! + dt;
      if (mode === PLAY) {
        S[LEFT] = Math.max(0, S[LEFT]! - dt);
        if (S[X]! <= 0) (S[X] = 0), finish(WORKED);
        else if (S[X]! >= 1) (S[X] = 1), finish(OUT);
        else if (S[LEFT] === 0) finish(SPIT);
      } else {
        S[X] = Math.max(0.1, Math.min(0.9, S[X]!));
        if (t > 3.2) (S[MODE] = IDLE), (S[HELD] = 0);
      }
    } else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    if (S[MODE] === IDLE || S[MODE] === DONE) {
      S[V] = 0;
      S[LEAN] = Math.abs(S[LEAN]!) < 0.002 ? 0 : S[LEAN]! * (1 - Math.min(1, dt * 6));
      S[IN] = S[IN]! < 0.002 ? 0 : S[IN]! * (1 - Math.min(1, dt * 4));
    }
    const moving = sp.step(dt, 30) + wd.step(dt);
    return riding || moving > 0 || (S[MODE] === DONE && S[CARD]! < 1.4) || S[LEAN] !== 0 || S[IN] !== 0;
  }
  return { S, ev, sp, wd, step, px };
}
export type TubeTime = ReturnType<typeof tubeTime>;

export type TubeScene = SlotScene & { engine: ReturnType<typeof createEngine>; ride: TubeTime; poster(): void; readonly state: { mode: number; score: number; end: number; left: number; x: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): TubeScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Hold to pump toward the light", { start: "ready", pocket: "click", worked: "boom", out: "end", spit: "win" });
  const g = r.g;
  const ride = tubeTime((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = ride.S;
  if (first) r.pad[1] = 1;
  const SPRAY = [C.ink, "rgba(168,255,62,.35)", "rgba(246,243,255,.6)"];
  const WCOL = [C.go, C.hurt, C.attack];
  let wall: CanvasGradient | string = C.raised, eye: CanvasGradient | string = C.ink;
  engine.add({
    read() {
      r.read();
      if (typeof wall === "string") {
        const w = g.createLinearGradient(0, 0, W, 0);
        w.addColorStop(0, C.bg), w.addColorStop(0.35, "#0d3b3a"), w.addColorStop(0.8, "#178a6a"), w.addColorStop(1, C.go);
        const e = g.createRadialGradient(150, 48, 2, 150, 48, 34);
        e.addColorStop(0, C.ink), e.addColorStop(0.4, C.fallin), e.addColorStop(1, "rgba(168,255,62,0)");
        (wall = w), (eye = e);
      }
    },
    step(e, dt) {
      if (ride.step(dt)) e.busy();
      const ev = ride.ev;
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_POCKET]) e.events.emit("pocket");
      if (ev[EV_WORKED]) e.events.emit("worked");
      if (ev[EV_OUT]) e.events.emit("out");
      if (ev[EV_SPIT]) e.events.emit("spit");
    },
    render() {
      r.begin();
      const t = S[FLOW]!, mode = S[MODE]!;
      // The wall of the wave, lit from the mouth.
      g.fillStyle = wall;
      g.fillRect(0, 0, W, H);
      g.fillStyle = eye;
      g.fillRect(100, 0, 60, H);
      // Streaks of water rushing up the wall and over the top (right to left).
      g.strokeStyle = "rgba(246,243,255,.16)";
      g.lineWidth = 0.7;
      g.beginPath();
      for (let k = 0; k < 14; k++) {
        const x = ((k * 29 - t * (70 + (k % 4) * 12)) % 190 + 190) % 190 - 15, y = 22 + (k % 7) * 6.5;
        g.moveTo(x, y), g.lineTo(x + 14, y - 2.5);
      }
      g.stroke();
      // The lip throwing over: a thick curl across the top, its edge feathering.
      g.fillStyle = "#0b2a2c";
      g.beginPath();
      g.moveTo(0, 0), g.lineTo(W, 0), g.lineTo(W, 6);
      for (let x = W; x >= 0; x -= 8) g.lineTo(x, 14 + Math.sin(x * 0.09 + t * 5) * 1.6 + (1 - x / W) * 8);
      g.fill();
      g.strokeStyle = C.ink;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let x = W; x >= 0; x -= 4) x === W ? g.moveTo(x, 14 + Math.sin(x * 0.09 + t * 5) * 1.6) : g.lineTo(x, 14 + Math.sin(x * 0.09 + t * 5) * 1.6 + (1 - x / W) * 8);
      g.stroke();
      // The pocket: a glow on the wall where the wave is fastest.
      const pk = X0 + S[POCKET]! * (X1 - X0), pw = PW * (X1 - X0);
      g.fillStyle = C.go;
      g.globalAlpha = 0.08 + 0.16 * S[IN]!;
      g.beginPath();
      g.ellipse(pk, FLOOR - 14, pw, 22, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 0.85;
      g.fillRect(pk - pw, FLOOR + 3, pw * 2, 1.4);
      g.globalAlpha = 1;
      // The floor of the barrel: the face you ride, curving up into the wall.
      g.fillStyle = "#0b2a2c";
      g.beginPath();
      g.moveTo(0, FLOOR + 2);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, FLOOR + 2 + Math.sin(x * 0.06 - t * 3) * 0.8);
      g.lineTo(W, H), g.lineTo(0, H);
      g.fill();
      g.fillStyle = C.sys;
      g.globalAlpha = 0.5;
      g.fillRect(0, FLOOR + 1.6, W, 0.8);
      g.globalAlpha = 1;
      // The rider, crouched low in the tube.
      const x = ride.px();
      rider(x, FLOOR + 1, S[LEAN]!, S[HELD]!, S[MODE] === DONE && S[END] === WORKED);
      // The foam ball: churning white on the left, chasing.
      const fx = X0 - 10 + S[SURGE]! * 6;
      g.fillStyle = C.ink;
      for (let k = 0; k < 9; k++) {
        const a = t * (3 + k * 0.4) + k * 1.7;
        g.globalAlpha = 0.55 + 0.4 * ((k * 37) % 10) / 10;
        g.beginPath();
        g.arc(fx + Math.cos(a) * 5 - 4, 46 + Math.sin(a * 1.3) * 11 + k * 2, 7 + (k % 3) * 2.5, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      r.drawSpray(ride.sp, SPRAY);
      drawWords(r, ride.wd, WCOL);
      hud(r, S[SCORE]!, S[LEFT]!, ROUND, mode === PLAY, C.go);
      if (mode === IDLE || (mode === DEMO && S[T]! > 2.2)) caption(r, "HOLD TO PUMP · STAY IN THE GLOW", 84, 6, C.ink);
      if (mode === DONE && S[CARD]! > 0.5) {
        g.fillStyle = "rgba(7,6,15,.65)";
        g.beginPath();
        g.roundRect(40, 30, 80, 34, 6);
        g.fill();
        caption(r, NUM[Math.min(999, S[SCORE]! | 0)]!, 42, 14, C.go);
        caption(r, S[END] === SPIT ? "SPAT OUT CLEAN" : S[END] === WORKED ? "THE FOAM GOT YOU" : "OUT TOO EARLY", 53, 6, C.ink);
        if (S[CARD]! > 0.8) caption(r, "HOLD TO GO AGAIN", 60, 5, C.muted);
      }
    },
  });
  /** The rider: low crouch, a hand trailing on the wall; tumbling when the foam takes them. */
  function rider(x: number, y: number, lean: number, held: number, eaten: boolean) {
    if (eaten) return;
    g.save();
    g.translate(x, y);
    g.rotate(lean * 0.12);
    g.fillStyle = C.hurt;
    g.beginPath();
    g.ellipse(0, -1, 7.5, 1.3, 0, 0, TAU);
    g.fill();
    g.fillStyle = C.rim;
    g.fillRect(-5.5, -1.3, 11, 0.6);
    const c = held ? 1.2 : 0, hip = -4.4 + c, sh = -8.4 + c * 1.2;
    g.strokeStyle = C.rim;
    g.lineWidth = 1.8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-3, -2), g.lineTo(-0.5, hip), g.lineTo(2.8, -2);
    g.moveTo(-0.5, hip), g.lineTo(1.6, sh);
    g.moveTo(1.2, sh + 1.2), g.lineTo(-4.5, sh - 3); // the trailing hand, up on the wall
    g.moveTo(1.2, sh + 1.2), g.lineTo(5.2, sh + 3);
    g.stroke();
    g.fillStyle = C.rim;
    g.beginPath();
    g.arc(2.4, sh - 1.8, 1.8, 0, TAU);
    g.fill();
    g.fillStyle = C.cmd;
    g.fillRect(-2, hip - 1, 3.4, 2);
    g.restore();
  }

  engine.start();
  return {
    engine,
    ride,
    get state() {
      return { mode: S[MODE]!, score: S[SCORE]!, end: S[END]!, left: S[LEFT]!, x: S[X]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, deep in the pocket (scripts/gallery-posters.mjs). */
export const posterAt = 1.6;
