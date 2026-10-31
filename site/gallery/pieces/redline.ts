// "Redline": a short drag sprint against the pace ghost, on an engine that runs hot. Hold GAS and
// the bike pulls, and the needle climbs; let off and it cools. Past the red the engine pops: smoke,
// a stall, the ghost slides by. Puddles on the way cool it with a splash (and cost a little speed).
// Beat the ghost to the flag by riding the edge of the red.
// Keys (focus in the stage): hold Space, ↑ or → for gas; M mutes.
// Bricks: the kernel (fixed step, settle: on the line the scene is still and it sleeps; its ledger
// for the canvas and the controls), @fzlt/core/sound and @fzlt/core/slot; the bike, dust and controls are
// moto-kit.ts. The sprint (`sprint`) is plain numbers: no DOM, no allocation a step.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { controls, rig, BIKE, CMD, DIRT, DIRT2, GO, GOLD, H, HOT, INK, PAPER, RIDER, W } from "./moto-kit";

/** Modes: on the line, the sprint, at the flag. */
export const WAIT = 0, RACE = 1, DONE = 2;
export const LEN = 420, PUDDLES = [110, 200, 290, 360];
const GY = 64, VMAX = 80, GHOST = 65;
// State slots.
const MODE = 0, T = 1, X = 2, V = 3, HEAT = 4, GAS = 5, BLOWN = 6, GX = 7, GV = 8, CLOCK = 9, WON = 10, BOT = 11, SPLASH = 12, BLOWS = 13, WINS = 14, LOSSES = 15, SPIN = 16, GSPIN = 17;

/** The sprint on plain numbers. `emit(type)` names what happened. */
export function sprint(emit: (type: string, v: number) => void) {
  const S = new Float64Array(20);
  const line = () => ((S[X] = S[GX] = 0), (S[V] = S[GV] = S[HEAT] = S[BLOWN] = S[CLOCK] = 0), (S[SPLASH] = -1));
  line();
  function go(bot: boolean) {
    if (S[MODE] === RACE) return false;
    line();
    (S[MODE] = RACE), (S[T] = 0), (S[BOT] = bot ? 1 : 0), (S[WON] = 0);
    emit("go", 1);
    return true;
  }
  function step(dt: number) {
    S[T] = S[T]! + dt;
    if (S[MODE] === WAIT) return false;
    if (S[MODE] === DONE) {
      // Both coast to a stop past the flag; then back to the line.
      S[V] = Math.max(0, S[V]! - 50 * dt);
      S[GV] = Math.max(0, S[GV]! - 50 * dt);
      S[X] = S[X]! + S[V]! * dt;
      S[GX] = S[GX]! + S[GV]! * dt;
      S[HEAT] = Math.max(0, S[HEAT]! - 0.4 * dt);
      S[SPIN] = S[SPIN]! + S[V]! * dt * 0.4;
      S[GSPIN] = S[GSPIN]! + S[GV]! * dt * 0.4;
      if (S[T]! > 2.6) (S[MODE] = WAIT), line();
      return true;
    }
    S[CLOCK] = S[CLOCK]! + dt;
    if (S[BOT]) S[GAS] = S[HEAT]! < (S[GAS] ? 0.9 : 0.6) ? 1 : 0; // the demo rides the edge of the red
    const gas = S[GAS]! && S[BLOWN]! <= 0;
    if (S[BLOWN]! > 0) {
      S[BLOWN] = S[BLOWN]! - dt;
      S[V] = Math.max(0, S[V]! - 30 * dt);
      S[HEAT] = Math.max(0.45, S[HEAT]! - 0.5 * dt);
    } else {
      S[V] = gas ? S[V]! + 75 * (1 - S[V]! / VMAX) * dt : Math.max(0, S[V]! - 14 * dt);
      S[HEAT] = gas ? S[HEAT]! + (0.22 + (S[V]! / VMAX) * 0.38) * dt : Math.max(0, S[HEAT]! - 0.55 * dt);
      if (S[HEAT]! >= 1) (S[HEAT] = 1), (S[BLOWN] = 1.3), (S[V] = S[V]! * 0.6), (S[BLOWS] = S[BLOWS]! + 1), emit("blow", 1);
    }
    const was = S[X]!;
    S[X] = was + S[V]! * dt;
    for (let i = 0; i < PUDDLES.length; i++) {
      const p = PUDDLES[i]!;
      if (was < p && S[X]! >= p) (S[HEAT] = Math.max(0, S[HEAT]! - 0.35)), (S[V] = S[V]! * 0.93), (S[SPLASH] = p), emit("splash", 1);
    }
    // The ghost: a steady pace.
    S[GV] = S[GV]! + (GHOST - S[GV]!) * Math.min(1, dt * 1.6);
    S[GX] = S[GX]! + S[GV]! * dt;
    S[SPIN] = S[SPIN]! + S[V]! * dt * 0.4;
    S[GSPIN] = S[GSPIN]! + S[GV]! * dt * 0.4;
    if (S[X]! >= LEN || S[GX]! >= LEN) {
      S[WON] = S[X]! >= LEN && S[X]! - LEN >= S[GX]! - LEN ? 1 : 0;
      S[WON] ? (S[WINS] = S[WINS]! + 1) : (S[LOSSES] = S[LOSSES]! + 1);
      (S[MODE] = DONE), (S[T] = 0);
      emit(S[WON] ? "win" : "lose", 1);
    }
    if (S[BOT] && S[X]! > PUDDLES[0]! + 20) (S[MODE] = WAIT), line(), (S[BOT] = 0), emit("turn", 1); // the demo stops after its first splash
    return true;
  }
  return { S, step, go };
}

export type RedlineScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof sprint> };

export function redline(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RedlineScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const sim = sprint((type, v) => engine.events.emit(type, 0, 0, 0, 0, v));
  const S = sim.S;
  const skin = slot.querySelector<HTMLElement>("[data-mx]") ?? stage;
  const k = rig(engine, stage, skin, { go: "ready", blow: "boom", splash: "hit", win: "win", lose: "end" });
  const g = k.g, col = k.col;
  const WD = new Float64Array(2);
  WD[1] = 9;
  const say = (w: number) => ((WD[0] = w), (WD[1] = 0));
  const WORDS = ["GO!", "BLOWN!", "SPLASH", "YOU WIN!", "GHOSTED", "YOUR TURN"];
  const B = controls(engine, stage, [
    { id: 7, label: "GAS", aria: "Gas (hold, space)", hold: true },
    { id: 8, label: "♪", aria: "Mute (M)" },
  ], (id, down) => (id === 7 ? gas(down) : mute(), engine.wake()));
  const mute = () => {
    k.snd.on = !k.snd.on;
    B[1]!.textContent = k.snd.on ? "♪" : "✕";
    B[1]!.setAttribute("aria-pressed", k.snd.on ? "false" : "true");
  };
  const gas = (down: boolean) => {
    if (S[BOT]) (S[MODE] = 0), (S[BOT] = 0);
    if (down && S[MODE] === WAIT) sim.go(false);
    S[GAS] = down ? 1 : 0;
  };
  engine.ledger.attr(stage, "tabindex", "0");
  engine.ledger.attr(stage, "role", "application");
  engine.ledger.attr(stage, "aria-label", "Redline. Hold space for gas, let off to cool. Beat the ghost. M: mute.");
  engine.ledger.style(stage, "touch-action", "manipulation");
  const key = (e: KeyboardEvent, down: boolean) => {
    const c = e.code;
    if (e.target !== stage) return;
    if (c === "Space" || c === "ArrowUp" || c === "ArrowRight" || c === "KeyW") !e.repeat && gas(down);
    else if (c === "KeyM") down && !e.repeat && mute();
    else return;
    e.preventDefault();
    engine.wake();
  };
  stage.addEventListener("keydown", (e) => key(e, true), { signal: engine.signal });
  stage.addEventListener("keyup", (e) => key(e, false), { signal: engine.signal });
  if (!first) sim.go(true), engine.busy(4);

  engine.add({
    read() {
      k.read();
    },
    step(e, dt) {
      const m = S[MODE]!, b = S[BLOWS]!, sp = S[SPLASH]!, bot = S[BOT]!;
      const moving = sim.step(dt);
      if (m === WAIT && S[MODE] === RACE) say(0);
      if (S[BLOWS] !== b) (k.dust(46, GY - 6, 18, -10, -20, 30, INK, 2), k.shake(0.9), say(1));
      if (S[SPLASH] !== sp && S[SPLASH]! >= 0) (k.dust(40, GY - 1, 16, 4, -30, 40, RIDER, 1.2), say(2));
      if (m === RACE && S[MODE] === DONE) say(S[WON] ? 3 : 4);
      if (bot && !S[BOT] && S[MODE] === WAIT) say(5);
      if (S[MODE] === RACE && S[GAS] && S[BLOWN]! <= 0) k.dust(32, GY - 1, 1, -S[V]! * 0.4 - 6, -5, 8, DIRT2, 1);
      if (S[MODE] === RACE && S[HEAT]! > 0.8 && S[BLOWN]! <= 0 && (S[T]! * 60) % 4 < 1) k.dust(33, GY - 5, 1, -18, -6, 6, HOT, 0.9);
      if (S[BLOWN]! > 0 && (S[T]! * 60) % 3 < 1) k.dust(42, GY - 8, 1, -6, -16, 8, PAPER, 2.4);
      WD[1] = WD[1]! + dt;
      const flying = k.step(dt);
      if (moving || flying || WD[1]! < 1.2) e.busy();
    },
    render() {
      k.begin();
      const cam = S[X]! - 40, m = S[MODE]!, heat = S[HEAT]!;
      k.sky(cam);
      // Ground, the distance posts, the puddles, the flag.
      g.fillStyle = col[DIRT]!;
      g.fillRect(-4, GY, W + 8, H - GY + 4);
      g.fillStyle = col[DIRT2]!;
      g.fillRect(-4, GY, W + 8, 1.4);
      for (let i = 0; i < 30; i++) {
        const x = ((((i * 37.1 - cam) % 180) + 180) % 180) - 10;
        g.fillRect(x, GY + 5 + ((i * 13.3) % 18), 2.2, 0.8);
      }
      for (let d = 0; d <= LEN; d += 60) {
        const x = d - cam;
        if (x < -10 || x > W + 10) continue;
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = 0.6;
        g.fillRect(x, GY - 6, 0.8, 6);
        g.globalAlpha = 1;
      }
      for (let i = 0; i < PUDDLES.length; i++) {
        const x = PUDDLES[i]! - cam;
        if (x < -20 || x > W + 20) continue;
        g.fillStyle = col[RIDER]!;
        g.globalAlpha = 0.75;
        g.beginPath();
        g.ellipse(x, GY + 0.6, 9, 1.6, 0, 0, 6.3);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = col[PAPER]!;
        g.fillRect(x - 4, GY, 3, 0.5);
      }
      const fx = LEN - cam;
      if (fx > -10 && fx < W + 10) {
        g.fillStyle = col[PAPER]!;
        g.fillRect(fx, GY - 22, 0.8, 22);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
          g.fillStyle = col[(r + c) & 1 ? INK : PAPER]!;
          g.fillRect(fx + 0.8 + c * 2.2, GY - 22 + r * 2.2, 2.2, 2.2);
        }
        g.fillStyle = col[PAPER]!;
        g.globalAlpha = 0.5;
        for (let y = 0; y < 4; y++) g.fillRect(fx - 0.6, GY + y * 3, 1.6, 1.5);
        g.globalAlpha = 1;
      }
      // The ghost (see-through, a lane back), then you.
      g.globalAlpha = 0.45;
      k.bike(S[GX]! - cam, GY - 3, 0, S[GSPIN]!, 0, 1);
      g.globalAlpha = 1;
      // Heat shimmer over a hot engine; a nose-up pull when the gas comes on.
      const pull = S[GAS] && S[BLOWN]! <= 0 && m === RACE ? -0.06 : 0;
      k.bike(40, GY, pull + (S[BLOWN]! > 0 ? Math.sin(S[T]! * 40) * 0.02 : 0), S[SPIN]!, S[GAS] ? -0.4 : 0.3, 1);
      if (heat > 0.6) {
        g.strokeStyle = col[heat > 0.85 ? BIKE : HOT]!;
        g.globalAlpha = (heat - 0.6) * 2;
        g.lineWidth = 0.4;
        g.beginPath();
        for (let j = 0; j < 3; j++) {
          const x = 38 + j * 2;
          g.moveTo(x, GY - 6);
          for (let y = 0; y < 8; y++) g.lineTo(x + Math.sin(S[T]! * 20 + y + j) * 0.6, GY - 7 - y);
        }
        g.stroke();
        g.globalAlpha = 1;
      }
      k.drawDust();
      // The heat gauge: an arc, green to gold to red, and the needle.
      const cx = 22, cy = 24;
      for (let i = 0; i < 20; i++) {
        const u = i / 20, a = Math.PI + u * Math.PI;
        g.fillStyle = col[u < 0.6 ? GO : u < 0.82 ? GOLD : BIKE]!;
        g.globalAlpha = u <= heat ? 1 : 0.3;
        g.fillRect(cx + Math.cos(a) * 12 - 1, cy + Math.sin(a) * 12 - 1, 2, 2);
      }
      g.globalAlpha = 1;
      const na = Math.PI + heat * Math.PI + (heat > 0.85 ? Math.sin(S[T]! * 50) * 0.04 : 0);
      g.strokeStyle = col[PAPER]!;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx, cy), g.lineTo(cx + Math.cos(na) * 10, cy + Math.sin(na) * 10);
      g.stroke();
      g.fillStyle = col[PAPER]!;
      g.fillRect(cx - 1.4, cy - 1.4, 2.8, 2.8);
      k.word(S[BLOWN]! > 0 ? "BLOWN" : "HEAT", cx, cy + 5, 4, S[BLOWN]! > 0 ? BIKE : PAPER);
      // The race: how far, how far the ghost is, the clock.
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.4;
      g.fillRect(50, 6, 90, 2);
      g.globalAlpha = 1;
      g.fillStyle = col[CMD]!;
      g.fillRect(50 + Math.min(1, S[GX]! / LEN) * 88, 4.4, 2, 5);
      g.fillStyle = col[GOLD]!;
      g.fillRect(50 + Math.min(1, S[X]! / LEN) * 88, 4, 2.4, 6);
      if (m !== WAIT) k.word(S[CLOCK]!.toFixed(2) + "s", 150, 16, 5, GOLD);
      if (m === WAIT) k.word(S[WINS]! + S[LOSSES]! ? "WINS " + S[WINS] + " · HOLD GAS, MIND THE RED" : "HOLD GAS · MIND THE RED · BEAT THE GHOST", 95, 18, 4, PAPER, 0.9);
      if (S[BOT] && m === RACE) k.word("DEMO", 95, 18, 4, PAPER, 0.9);
      if (WD[1]! < 1.2) {
        const w = WD[0]!, u = WD[1]!;
        k.word(WORDS[w]!, 80, 38 - u * 5, w >= 3 ? 10 : 8, w === 1 || w === 4 ? BIKE : w === 2 ? RIDER : w === 3 ? GO : GOLD, Math.min(1, (1.2 - u) * 3), Math.sin(w * 2.3) * 0.1);
      }
    },
  });

  engine.start();
  if (first) gas(true), gas(false);
  return {
    engine, sim, accessible: true,
    poster: () => k.poster(),
    destroy: () => engine.destroy(),
  } as RedlineScene & { poster(): void };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => redline(stage, slot, first);
/** The poster: the demo at speed, the needle near the red. */
export const posterAt = 1.6;
