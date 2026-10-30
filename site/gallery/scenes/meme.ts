// The meme scene: tiny internet-meme bits in old-school pixel art, played once and then asleep on
// the last frame (a tap plays it again). Original characters only: no real coins, logos, tickers or
// mascots, and no money talk. Bits: a "to the moon" rocket that launches off a button, diamond hands
// that won't let go, a candle chart that pumps then dumps, and an original laser-eyes mascot.
// Bricks: the kernel (settle + fps cap), fizlet/sprite (the pixel art, baked once) and fizlet/fx
// (exhaust, sparkles, sparks, pop words, shake). Mounted through fizlet/slot: it loads near the
// viewport, never under reduced motion, and destroy() gives the page back.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter, SPARK, type Kind } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";

export type Bit = "rocket" | "diamond" | "candles" | "laser";
export interface Meme {
  bit: Bit;
  /** Hex colours from the Board UI tokens: main, second, sparks, text, white. */
  colors: string[];
  /** Seconds after the bit ends before it plays again while visible; 0: once, then it sleeps. */
  loop: number;
  /** Size multiplier for the art. */
  scale: number;
}
export type MemeScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(): void };

// Pixel art (m: main, s: second, w: white, k: dark, e: eye).
const ART = {
  rocket: ["...w...", "..mmm..", "..msm..", ".mmmmm.", ".msssm.", ".mmmmm.", ".mmmmm.", ".mmmmm.", "smmmmms", "ss...ss"],
  moon: ["...wwwww...", "..wwwwwwww.", ".wwwkwwwwww", "wwwkkwwwwww", "wwwwwwwwkww", "wwwwwwwkkww", "wkwwwwwwwww", ".wwwwwkwww.", "..wwwwwwww.", "...wwwww..."],
  gem: ["...mmmmmmm...", "..mwmmmmmwm..", ".mmmmmmmmmmm.", "mmmmwmmmmmmmm", ".mmmmmmmmmmm.", "..mmmmmmmmm..", "...mmmmmmm...", "....mmmmm....", ".....mmm.....", "......m......"],
  hand: ["..sss....", ".sssss...", "sssssss..", "ssssssss.", "sssssss..", ".sssss...", "..ssss...", "..ssss...", "..ssss..."],
  pal: ["..mm........mm..", ".mmmm......mmmm.", ".mmmmmmmmmmmmmm.", "mmmmmmmmmmmmmmmm", "mmmwweemmmwweemm", "mmmwweemmmwweemm", "mmmmmmmmmmmmmmmm", "mmmmmmkkkkmmmmmm", ".mmmmmmmmmmmmmm.", ".mmmmsssssssmmm.", "..mmmsssssssmm..", "...mmmmmmmmmm...", "...mm......mm..."],
};
const WORDS = ["3", "2", "1", "TO THE MOON!", "SELL?", "PANIC", "FUD", "NOPE", "DIAMOND HANDS", "PUMP", "DUMP", "LASER EYES: ON", "PUMP THEN DUMP"];
// Each bit's caption (a word) and when it comes up; it stays on the last frame.
const CAPTION: Record<Bit, [number, number]> = { rocket: [3, 2.85], diamond: [8, 2.8], candles: [12, 2.9], laser: [11, 1.3] };
// Exhaust: squares that fall back from the nozzle and fade.
const EXHAUST: Kind = { shape: "square", drag: 2.4, gravity: 0.3, angle: 1.5708, spread: 0.7, speed: [30, 70], size: [1, 2.5], life: [0.3, 0.7] };
const STAR: Kind = { shape: "frame", drag: 2.2, gravity: 0, angle: 0, spread: 6.2832, speed: [10, 40], size: [2, 4], life: [0.4, 0.9] };
// Candles: closes on a 0-90 grid (lower is higher), the last one the dump.
const CLOSES = [60, 56, 58, 50, 44, 47, 38, 30, 33, 22, 14, 80];
const LENGTH: Record<Bit, number> = { rocket: 3.4, diamond: 3.6, candles: 3.4, laser: 3.2 };
const VW = 160, VH = 90, DARK = "#07060f", PANEL = "#1b1636";

export function meme(stage: HTMLElement, p: Meme, _first: SlotTap | null = null): MemeScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const [cm, c2, cs, ct, cw] = p.colors as [string, string, string, string, string];
  const fx = effects({ cap: 220, colors: p.colors, words: WORDS, scorch: 0, gravity: 120 });
  const { ids, emit } = emitter(fx, { x: EXHAUST, t: STAR, s: SPARK });
  const colors = { m: "m", s: "s", w: cw, k: DARK, e: "e" };
  const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));
  const art = (rows: string[]) => ({ frames: rows, colors });
  const spr = sprites(
    { rocket: art(ART.rocket), moon: art(ART.moon), gem: art(ART.gem), left: art(ART.hand), right: art(mirror(ART.hand)), pal: art(ART.pal) },
    { palettes: [{ m: cm, s: c2, e: DARK }, { m: cm, s: c2, e: c2, w: cs }] },
  );
  const end = LENGTH[p.bit] + 0.4, sc = p.scale;
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // State: width, height, dpr, resized, time, cue (next scripted moment), x, y, shake hand, loop timer.
  const s = new Float64Array([0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  // Stars in the sky (fixed for the scene): x, y pairs.
  const sky = new Float32Array(48);
  for (let i = 0; i < 48; i += 2) (sky[i] = engine.random() * VW), (sky[i + 1] = engine.random() * VH * 0.8);
  // Flying words at the diamond: x, word, side (diamond bit).
  const fly = new Float64Array([-30, 4, 1, 190, 5, -1, -60, 6, 1]);
  const reset = () => {
    s[4] = s[5] = s[8] = s[9] = 0;
    fly.set([-30, 4, 1, 190, 5, -1, -70, 6, 1]);
    fx.clear();
  };
  const ro = new ResizeObserver(() => ((s[3] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = () => (reset(), engine.wake());
  stage.addEventListener("pointerdown", play, { signal: engine.signal });
  // Cue `n` fires once, when time passes `at`.
  const cue = (n: number, at: number) => s[5] === n && s[4]! >= at && ((s[5] = n + 1), true);
  const word = (w: number, x: number, y: number, c: number, size: number) => fx.word(x, y, w, c, size);

  function step(dt: number) {
    const t = s[4]!;
    if (p.bit === "rocket") {
      if (cue(0, 0.3)) word(0, 80, 56, 3, 14);
      if (cue(1, 0.8)) word(1, 80, 56, 3, 14);
      if (cue(2, 1.3)) word(2, 80, 56, 3, 14), fx.kick(3);
      // Lift-off at 1.6 s: ease in towards the moon, exhaust from the nozzle all the way.
      const k = Math.min(1, Math.max(0, (t - 1.6) / 1.2)), e = k * k * k;
      s[6] = 80 + 46 * e;
      s[7] = 62 - 44 * e;
      if (k > 0 && k < 1) emit(ids.x, s[6]!, s[7]! + 10, 4, 0, 3, 1);
      if (cue(3, 2.85)) emit(ids.t, 126, 20, 16, 2, 3, 1), fx.kick(4);
    } else if (p.bit === "diamond") {
      // Words fly in at the hands and bounce off with a NOPE; the gem twinkles.
      for (let i = 0; i < 9; i += 3) {
        if (t < 0.4 + i * 0.25 || fly[i + 2] === 0) continue;
        fly[i] = fly[i]! + fly[i + 2]! * dt * 120;
        if ((fly[i + 2]! > 0 && fly[i]! >= 52) || (fly[i + 2]! < 0 && fly[i]! <= 108)) {
          emit(ids.s, fly[i]!, 50, 10, 2, 1, 0.35);
          word(7, fly[i]!, 40, 3, 8);
          fx.kick(2);
          s[8] = 0.2;
          fly[i + 2] = 0;
        }
      }
      s[8] = Math.max(0, s[8]! - dt);
      if (t > 0.3 && t < 3 && ((t * 30) | 0) % 9 === 0) emit(ids.t, 80 + (engine.random() - 0.5) * 30, 45 + (engine.random() - 0.5) * 20, 1, 4, 1, 1);
      if (cue(0, 2.8)) emit(ids.t, 80, 48, 18, 2, 3, 1.4);
    } else if (p.bit === "candles") {
      if (cue(0, 2.1)) word(9, 104, 34, 0, 12);
      if (cue(1, 2.75)) word(10, 128, 64, 1, 14), fx.kick(8), emit(ids.s, 144, 30, 20, 1, 1, 0.4);
    } else {
      if (cue(0, 1.2)) fx.kick(3);
      // Beams from 1.2 s to 2.6 s: sparks where they hit the edge.
      if (t > 1.2 && t < 2.6) emit(ids.s, VW - 2, 34, 2, 1, 2, 0.4), emit(ids.s, VW - 2, 54, 2, 1, 2, 0.4);
    }
  }

  function paint() {
    const w = s[0]!, h = s[1]!, d = s[2]!, t = s[4]!;
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      // A fixed 160 × 90 grid, centred and scaled to fit: one transform per resize.
      const k = Math.min(canvas.width / VW, canvas.height / VH);
      ctx.setTransform(k, 0, 0, k, (canvas.width - VW * k) / 2, (canvas.height - VH * k) / 2);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = DARK;
    ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
    const sh = fx.shake * 0.25;
    if (sh) ctx.save(), ctx.translate(Math.round(Math.sin(t * 70) * sh), Math.round(Math.cos(t * 53) * sh));
    ctx.fillStyle = PANEL;
    for (let i = 0; i < 48; i += 2) ctx.fillRect(sky[i]! | 0, sky[i + 1]! | 0, 1, 1);
    if (p.bit === "rocket") {
      spr.draw(ctx, "moon", 0, 128, 18, 0, 2 * sc);
      // The launch button: pressed at 0.2 s, lit while it counts down.
      const down = t > 0.2 ? 2 : 0;
      ctx.fillStyle = PANEL;
      ctx.fillRect(56, 80, 48, 6);
      ctx.fillStyle = t > 0.2 && t < 1.6 && (t * 6) & 1 ? cw : c2;
      ctx.fillRect(60, 74 + down, 40, 6 - down);
      ctx.font = "700 5px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = DARK;
      ctx.fillText("LAUNCH", 80, 79 + down);
      spr.draw(ctx, "rocket", 0, s[6]!, s[7]!, t > 1.6 ? 0.7 * Math.min(1, (t - 1.6) * 2) : 0, 2 * sc);
    } else if (p.bit === "diamond") {
      spr.draw(ctx, "gem", 0, 80, 46, 0, 2 * sc);
      const j = s[8]! > 0 ? ((t * 60) & 1) * 2 - 1 : 0;
      spr.draw(ctx, "left", 0, 62 + j, 50, 0, 2 * sc);
      spr.draw(ctx, "right", 0, 98 - j, 50, 0, 2 * sc);
      ctx.font = "900 8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = ct;
      for (let i = 0; i < 9; i += 3) if (fly[i + 2] !== 0 && t >= 0.4 + i * 0.25) ctx.fillText(WORDS[fly[i + 1]!]!, fly[i]!, 52);
    } else if (p.bit === "candles") {
      // Axes, then one candle every 0.18 s: up candles in the main colour, the dump in the second.
      ctx.fillStyle = PANEL;
      ctx.fillRect(10, 84, 144, 1);
      ctx.fillRect(10, 6, 1, 78);
      const n = Math.min(CLOSES.length, Math.floor(t / 0.18) + 1), drop = t > 2.4 ? Math.min(1, (t - 2.4) / 0.35) : 0;
      for (let i = 0; i < n; i++) {
        const open = i ? CLOSES[i - 1]! : 64, last = i === CLOSES.length - 1;
        const close = last ? open + (CLOSES[i]! - open) * drop : CLOSES[i]!;
        const top = Math.min(open, close), x = 16 + i * 11;
        ctx.fillStyle = close > open ? c2 : cm;
        ctx.fillRect(x + 2, top - 3, 1, Math.abs(close - open) + 6);
        ctx.fillRect(x, top, 5, Math.max(1, Math.abs(close - open)));
      }
    } else {
      // The mascot charges (eyes blink to the beam colour), then fires two beams across the stage.
      const charged = t > 0.5 && (t > 1.2 || (t * 10) & 1) ? 1 : 0;
      spr.draw(ctx, "pal", 0, 40, 46, 0, 2.5 * sc, charged);
      if (t > 1.2 && t < 2.6) {
        // One beam from each eye, fanning out to the edge; a white core.
        ctx.lineCap = "square";
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i ? 51 : 34, 42);
          ctx.lineTo(VW, i ? 54 : 34);
          ctx.strokeStyle = c2;
          ctx.lineWidth = 3 + ((t * 30) & 1);
          ctx.stroke();
          ctx.strokeStyle = cw;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    fx.draw(ctx);
    if (sh) ctx.restore();
    const [cap, at] = CAPTION[p.bit];
    if (t >= at) {
      ctx.font = "900 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = DARK;
      ctx.strokeText(WORDS[cap]!, 80, 14);
      ctx.fillStyle = ct;
      ctx.fillText(WORDS[cap]!, 80, 14);
    }
  }
  reset();
  engine.add({
    read() {
      if (!s[3]) return;
      s[3] = 0;
      s[0] = stage.clientWidth;
      s[1] = stage.clientHeight;
      s[2] = Math.min(2, devicePixelRatio || 1);
    },
    step(e, dt) {
      const t = (s[4] = s[4]! + dt);
      step(dt);
      fx.step(dt);
      if (p.loop > 0 && t > end && (s[9] = s[9]! + dt) >= p.loop) reset();
      if (t < end || fx.live > 0 || p.loop > 0) e.busy();
    },
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for these params: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export const scene = (p: Meme) => (stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null) => meme(stage, p, first);
