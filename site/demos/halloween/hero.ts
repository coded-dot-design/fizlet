// Halloween heroes: the shared arcade core. One pixel canvas in the slot's stage (art pixels P CSS
// px each, scaled up crisp), an optional spill layer that lets the play fly up out of the card and
// over the page above it, taps and drags as numbers, pop words and the score in the pixel font
// (./font), and the night backdrop baked once per size. Each game is a small module on top (bats,
// smash, slice, cauldron; haunt, the page scene, stands alone) built from Fizlet bricks: the kernel
// (settle + 30 fps cap: still means zero frames), fizlet/sprite (pixel art baked once), fizlet/fx.
// Mounted through fizlet/slot: it loads near the viewport, never under reduced motion, and every
// node and style it adds goes through the engine's ledger, so Recall gives the page back.
import { createEngine, type Engine } from "../../../src/kernel/index";
import type { Effects } from "../../../src/fx";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { PAL } from "./art";
import { aspect, mark } from "../../gallery/aspect";
import { disc, num, text } from "./font";

export { disc, num, text };

/** A hero's data (from the spec): targets a round, seconds a round, size multiplier. */
export interface HeroParams {
  count: number;
  seconds: number;
  scale: number;
}
export interface Game {
  /** A particle pool the core steps and draws over the play (optional). */
  fx?: Effects;
  /** A round starts: on mount, on play(), on a tap while idle. (x, y): art px, or -1. */
  start(x: number, y: number): void;
  /** A press (art px; y from the card's top). */
  tap(x: number, y: number): void;
  /** A move while pressed (art px). */
  drag?(x: number, y: number): void;
  /** Advance; true while anything of the game's own still moves. */
  step(dt: number): boolean;
  /** Draw the play; `oy` is the card's top in the play canvas (art px; > 0 with a spill layer). */
  draw(c: CanvasRenderingContext2D, oy: number): void;
  /** Static scenery over the night sky (baked once per size). */
  scenery?(c: CanvasRenderingContext2D, w: number, h: number): void;
}
export interface HeroOptions {
  /** Fraction of the card's height the play may fly up above it, over the page (0: none). */
  spill?: number;
  /** Pop words, as indices for pop(). Letters: see FONT. */
  words: string[];
  /** CSS for the stage (e.g. touch-action for a swipe game). */
  touch?: string;
  /** Per stage aspect (wide, square, tall: ../../gallery/aspect): art rows the stage is tall (the
   *  pixel size: fewer rows, bigger art; default 90) and where the score's middle sits (a fraction of
   *  the width; 1 or unset: top right). The game reads the class as S[9] for its own layout. */
  rows?: number[];
  hud?: number[];
}
export type HeroScene = SlotScene & { engine: Engine; play(x?: number, y?: number): void };
/** What a game gets: the engine, the state, pops and text. S: [w, h, P, score, round left, …, aspect at 9]. */
export interface Hero {
  e: Engine;
  S: Float64Array;
  /** A pop word (index into words) rising from (x, y) in colour c (PAL index). */
  pop(x: number, y: number, word: number, c: number): void;
  /** Add to the score (it shows top left). */
  add(n: number): void;
  /** Keep the round going (each hit buys time, up to the round's own length). */
  more(s: number): void;
}

/** The night: sky, stars, the moon, two rows of hills. The ground's top is at h * 0.86. */
function night(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = PAL[12]!;
  c.fillRect(0, 0, w, h);
  let s = 7;
  for (let i = 0; i < w / 4; i++) (s = (s * 16807) % 2147483647), (c.fillStyle = PAL[i % 3 ? 10 : 9]!), c.fillRect(s % w, (s >> 8) % Math.round(h * 0.6), 1, 1);
  disc(c, w * 0.8, h * 0.24, Math.round(h * 0.1), PAL[4]!);
  for (let x = 0; x < w; x++) {
    c.fillStyle = PAL[10]!;
    c.fillRect(x, Math.round(h * (0.74 + 0.05 * Math.sin(x * 0.05))), 1, h);
    c.fillStyle = PAL[11]!;
    c.fillRect(x, Math.round(h * (0.86 + 0.015 * Math.sin(x * 0.11 + 1))), 1, h);
  }
}

const POPS = 12;

export function hero(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, o: HeroOptions, make: (h: Hero) => Game): HeroScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const L = engine.ledger, host = slot.parentElement!, spill = o.spill ?? 0;
  const canvas = L.add(document.createElement("canvas"));
  const back = document.createElement("canvas"); // the baked backdrop: never in the page
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;image-rendering:pixelated";
  stage.append(canvas);
  if (o.touch) stage.style.touchAction = o.touch;
  let layer = canvas;
  if (spill) {
    layer = L.add(document.createElement("canvas"));
    layer.style.cssText = canvas.style.cssText + ";z-index:3";
    layer.ariaHidden = "true";
    if (getComputedStyle(host).position === "static") L.style(host, "position", "relative");
    host.append(layer);
  }
  const ctx = canvas.getContext("2d")!, lx = layer.getContext("2d")!, bx = back.getContext("2d")!;
  // State: w, h (art px), P (CSS px an art px), score, round seconds left, resized, spill (art px),
  // pressed, frame count, aspect class (0 wide, 1 square, 2 tall), the class marked. Pops: x, y, life, word, colour. Taps: a queue of (kind, x, y): 1 tap, 2 drag.
  const S = new Float64Array([0, 0, 3, 0, 0, 1, 0, 0, 0, 0, -1]);
  const px = new Float32Array(POPS), py = new Float32Array(POPS), pl = new Float32Array(POPS), pw = new Uint8Array(POPS), pc = new Uint8Array(POPS);
  const q = new Float32Array(48);
  let qn = 0, start = 1, sx = -1, sy = -1, full = 0;
  const h: Hero = {
    e: engine,
    S,
    pop(x, y, word, c) {
      for (let i = 0; i < POPS; i++) if (pl[i]! <= 0) return void ((px[i] = x), (py[i] = y), (pl[i] = 0.9), (pw[i] = word), (pc[i] = c));
    },
    add: (n) => void (S[3] = S[3]! + n),
    more: (s) => void (S[4] = Math.min(full, S[4]! + s)),
  };
  const game = make(h);
  const ro = new ResizeObserver(() => ((S[5] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const push = (k: number, x: number, y: number) => {
    if (qn < 16) (q[qn * 3] = k), (q[qn * 3 + 1] = x), (q[qn * 3 + 2] = y), qn++;
    engine.wake();
  };
  const at = (ev: PointerEvent, k: number) => {
    const r = stage.getBoundingClientRect(), P = S[2]!; // one read per input, outside any frame
    push(k, (ev.clientX - r.left) / P, (ev.clientY - r.top) / P);
  };
  const sig = { signal: engine.signal };
  stage.addEventListener("pointerdown", (ev) => ev.isPrimary && ((S[7] = 1), at(ev, 1)), sig);
  stage.addEventListener("pointermove", (ev) => ev.isPrimary && S[7] && at(ev, 2), sig);
  addEventListener("pointerup", () => (S[7] = 0), sig);
  if (first) (sx = first.x), (sy = first.y);
  const play = (x = -1, y = -1) => (x < 0 ? ((start = 1), engine.wake()) : push(1, x / S[2]!, y / S[2]!));

  engine.add({
    read() {
      if (!S[5]) return;
      S[5] = 0;
      const r = stage.getBoundingClientRect(), k = (S[9] = aspect(r.width, r.height)), P = Math.max(2, Math.round(r.height / (o.rows?.[k] ?? 90)));
      const w = Math.floor(r.width / P), hh = Math.ceil(r.height / P), up = spill ? Math.round(hh * spill) : 0;
      S[0] = w;
      S[1] = hh;
      S[2] = P;
      S[6] = up;
      canvas.width = back.width = w;
      canvas.height = back.height = hh;
      canvas.style.width = w * P + "px";
      canvas.style.height = hh * P + "px";
      canvas.style.left = ((r.width - w * P) >> 1) + "px";
      if (spill) {
        const hr = host.getBoundingClientRect();
        layer.width = w;
        layer.height = hh + up;
        layer.style.width = w * P + "px";
        layer.style.height = (hh + up) * P + "px";
        layer.style.left = r.left - hr.left + ((r.width - w * P) >> 1) + "px";
        layer.style.top = r.top - hr.top - up * P + "px";
      }
      night(bx, w, hh);
      game.scenery?.(bx, w, hh);
      if (sx >= 0) push(1, sx / P, sy / P), (sx = -1); // the tap that loaded it: an intent, as numbers
    },
    step(e, dt) {
      if (!S[0]) return e.busy();
      if (start) (start = 0), (full = S[4] = 0), game.start(-1, -1);
      if (!full && S[4]! > 0) full = S[4]!;
      for (let i = 0; i < qn; i++) {
        const x = q[i * 3 + 1]!, y = q[i * 3 + 2]!;
        if (q[i * 3] === 1) {
          if (S[4]! <= 0) (full = 0), game.start(x, y), (full = S[4]!);
          game.tap(x, y);
        } else game.drag?.(x, y);
      }
      qn = 0;
      let busy = game.step(dt) || S[4]! > 0;
      if (S[4]! > 0) S[4] = S[4]! - dt;
      if (game.fx) game.fx.step(dt), (busy ||= game.fx.live > 0);
      for (let i = 0; i < POPS; i++) if (pl[i]! > 0) (pl[i] = pl[i]! - dt), (py[i] = py[i]! - 14 * dt), (busy = true);
      S[8] = S[8]! + 1;
      if (busy) e.busy();
    },
    render() {
      const w = S[0]!, hh = S[1]!, oy = S[6]!, c = spill ? lx : ctx, sh = game.fx ? Math.round(game.fx.shake / 4) : 0;
      ctx.drawImage(back, 0, 0);
      if (spill) lx.clearRect(0, 0, w, hh + oy);
      c.setTransform(1, 0, 0, 1, sh ? (S[8]! & 1 ? sh : -sh) : 0, 0);
      game.draw(c, oy);
      game.fx?.draw(c);
      for (let i = 0; i < POPS; i++) if (pl[i]! > 0 && (pl[i]! > 0.3 || S[8]! & 2)) text(c, o.words[pw[i]!]!, (px[i]! - o.words[pw[i]!]!.length * 2) | 0, (py[i]! + oy) | 0, pc[i]!);
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (S[3]!) num(ctx, S[3]!, (o.hud?.[S[9]!] ?? 1) < 1 ? Math.round(w * o.hud![S[9]!]!) + (S[3]! < 100 ? 4 : S[3]! < 1000 ? 6 : 8) : w - 3, 3, 2);
      if (S[9] !== S[10]) mark(L, stage, (S[10] = S[9]!));
    },
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}
