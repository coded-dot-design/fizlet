/**
 * fizlet/scene: an animation recipe as data. A scene is JSON: a **stage** (a fixed pixel grid
 * fitted to the box, a background, a starfield, shake, the clock), a **cast** (sprites, rects,
 * text and lines, drawn in order, each value a number, a track or a blink on the scene clock), the
 * **cues** (one-shot fx moments: a pop word, a kick, a burst) and the **gags** (a running bit: an
 * fx emitter held open over a window, following a track). One player runs them all, so a gallery
 * entry ships its data, not its own code.
 *
 * Bricks: the kernel (fps cap, settle), fizlet/fx (particles, words, shake), fizlet/sprite (pixel
 * art, baked once), fizlet/timeline's easings, and fizlet/slot (`scene(data)` is a slot mount).
 * The contract: time moves in the step on numbers only (no DOM, no allocation); one canvas, added
 * through the ledger, so `destroy()` gives the page back exactly; after `end` seconds it rests on
 * the last frame and the engine settles (`busy(sec)` holds it awake until then); a tap plays it
 * again. With reduced motion it draws the poster frame (no cues, no gags) and settles.
 */
import { createEngine, type Engine, type System } from "./kernel/index";
import { effects, emitter, KINDS, type Kind } from "./fx";
import { sprites, type SpriteDef } from "./sprite";
import { EASES } from "./timeline";
import type { SlotMount, SlotScene } from "./slot";

/**
 * A value on the scene clock `t` (seconds):
 * - a number or a string (a colour): constant;
 * - a track `[from, to, at, dur, ease?]`: `from` until `at`, then eased to `to` over `dur` seconds
 *   (an EASES name, default "linear"); `dur` 0 jumps once `t` is past `at`, and works on strings;
 * - a blink `{ blink: [a, b], hz, on?: [from, to], then? }`: `a` before `from`; inside the window
 *   `b` on odd ticks of `hz` per second, `a` on even ones; `then` (default `a`) from `to` on.
 */
export type Val = number | string | readonly [number | string, number | string, number, number, string?] | Blink;
export interface Blink { blink: readonly [number | string, number | string]; hz: number; on?: readonly [number, number?]; then?: number | string }

/** Shown while `from <= t < to` (`to` left out: from then on). */
type On = { on?: readonly [number, number?] };
/** A sprite from `art`: centre at (x, y), turned by `rot` radians, `scale` px per art pixel, a palette index. */
export type SpriteItem = On & { sprite: string; x: Val; y: Val; rot?: Val; scale?: Val; pal?: Val };
/** A filled rectangle `[x, y, w, h]`. */
export type RectItem = On & { rect: readonly [Val, Val, Val, Val]; fill: Val };
/** One line of text; with `stroke` it gets an outline `lw` wide first. */
export type TextItem = On & { text: string; x: Val; y: Val; font: string; fill: Val; align?: CanvasTextAlign; stroke?: Val; lw?: Val };
/** A line `[x0, y0, x1, y1]`. */
export type LineItem = On & { line: readonly [Val, Val, Val, Val]; stroke: Val; lw: Val; cap?: CanvasLineCap };
export type Item = SpriteItem | RectItem | TextItem | LineItem;

/**
 * A cue, once, when `t` passes its time (in order; several may share a time):
 * `[t, "word", word, x, y, colour, size]`, `[t, "kick", amount]` or
 * `[t, "emit", kind, x, y, n, colour, colours, scale]` (fizlet/fx's word, kick and emit).
 */
export type Cue = readonly [number, "word" | "kick" | "emit", ...(number | string)[]];
/** A gag: every step while `from < t < to`, emit `n` of `kind` at (x + dx, y + dy); x and y may be tracks. */
export interface Gag { emit: string; on: readonly [number, number]; x: Val; y: Val; dx?: number; dy?: number; n: number; c?: number; cn?: number; scale?: number }

export interface SceneData {
  /** Format version: 1. */
  v: 1;
  stage: {
    /** The grid in scene pixels, fitted to the box and centred. */
    w: number;
    h: number;
    /** Frame-rate cap (default 30). */
    fps?: number;
    /** Background colour (painted past the grid too). */
    bg: string;
    /** Seconds it plays before it rests on the last frame. */
    end: number;
    /** Seconds after `end` before it plays again while visible; 0 (default): once, then it sleeps. */
    loop?: number;
    /** Seconds held still before the clock starts (an intro delay; default 0). */
    delay?: number;
    /** Starfield: `[count, colour, share of the height]`, seeded from the engine. */
    stars?: readonly [number, string, number];
    /** fx shake to scene pixels (default 0: none). */
    shake?: number;
    /** The reduced-motion poster: the time drawn (default `end`). */
    poster?: number;
  };
  /** fizlet/fx options, and its particle kinds by name (a Kind, or a name in fx's KINDS). */
  fx?: { cap?: number; gravity?: number; scorch?: number; colors?: string[]; words?: string[]; kinds?: Record<string, Kind | keyof typeof KINDS> };
  /** Pixel art by name: rows of characters (fizlet/sprite), coloured by `ink` and `palettes`. */
  art?: Record<string, string[]>;
  ink?: Record<string, string>;
  palettes?: Record<string, string>[];
  /** Drawn in order, under the effects; shaken with them. */
  cast?: Item[];
  /** Drawn last, above the effects, never shaken (captions). */
  over?: Item[];
  cue?: Cue[];
  gag?: Gag[];
}

export interface SceneOptions {
  /** Animate (default: yes, unless the visitor prefers reduced motion; then the poster frame). */
  motion?: boolean;
}
/** The mounted scene: its engine, `play()` from the start, `destroy()` (Recall), and the system
 *  the engine runs (read, step, render). */
export type Scene = SlotScene & System & { engine: Engine; play(): void };

/** Mount scene `d` on `stage` (any positioned box). Returns its engine, `play()` and `destroy()`. */
export function mountScene(stage: HTMLElement, d: SceneData, o: SceneOptions = {}): Scene {
  const st = d.stage, VW = st.w, VH = st.h, f = d.fx ?? {}, cast = d.cast ?? [], over = d.over ?? [], cues = d.cue ?? [], gags = d.gag ?? [];
  const motion = o.motion ?? !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const engine = createEngine({ root: stage, fps: st.fps ?? 30, settle: 0.5 });
  const fx = effects({ cap: 220, scorch: 0, ...f });
  const kinds: Record<string, Kind> = {};
  for (const k in f.kinds) kinds[k] = typeof f.kinds[k] === "string" ? KINDS[f.kinds[k] as keyof typeof KINDS] : (f.kinds[k] as Kind);
  const { ids, emit } = emitter(fx, kinds);
  const art: Record<string, SpriteDef> = {};
  for (const k in d.art) art[k] = { frames: d.art[k]!, ...(d.ink && { colors: d.ink }) };
  const spr = sprites(art, d.palettes && { palettes: d.palettes });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // State: width, height, dpr, resized, time, next cue, loop timer, a gag's x and y, a value.
  const s = new Float64Array(10);
  s[2] = s[3] = 1;
  // A number now (plus `d`) into slot `i`: the step's values. Written, never returned: the clock
  // is read here, not passed, and no new number crosses a call (it would be boxed).
  const put = (v: any, i: number, d = 0) => {
    const t = s[4]!;
    s[i] = (typeof v !== "object" ? v : !(v[3] > 0) ? (t > v[2] ? v[1] : v[0]) : v[0] + (v[1] - v[0]) * EASES[v[4] ?? "linear"]!(Math.min(1, Math.max(0, (t - v[2]) / v[3])))) + d;
  };
  // Any value now (render): a blink, a jump (numbers or words), a track.
  const val = (v: any): any => {
    const t = s[4]!, on = v?.on ?? [0];
    return typeof v !== "object" ? v
      : v.blink ? (t < on[0] ? v.blink[0] : t < (on[1] ?? Infinity) ? v.blink[(t * v.hz) & 1] : v.then ?? v.blink[0])
      : !(v[3] > 0) ? (t > v[2] ? v[1] : v[0])
      : (put(v, 9), s[9]);
  };
  const shown = (it: On) => !it.on || (s[4]! >= it.on[0] && s[4]! < (it.on[1] ?? Infinity));
  const sky = new Float32Array(2 * (st.stars?.[0] ?? 0));
  for (let i = 0; i < sky.length; i += 2) (sky[i] = engine.random() * VW), (sky[i + 1] = engine.random() * VH * st.stars![2]);
  const end = st.end, delay = st.delay ?? 0, loop = st.loop ?? 0, shake = st.shake ?? 0;
  const reset = () => {
    s[4] = motion ? -delay : st.poster ?? end;
    s[5] = motion ? 0 : cues.length;
    s[6] = 0;
    fx.clear();
    // Something is scheduled until the scene ends (its intro delay included): hold the engine awake.
    engine.busy(motion ? end - s[4]! : 0);
  };
  const ro = new ResizeObserver(() => ((s[3] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = () => (reset(), engine.wake());
  if (motion) stage.addEventListener("pointerdown", play, { signal: engine.signal });

  function step(dt: number) {
    const t = (s[4] = s[4]! + dt);
    if (t < 0) return;
    for (let c: Cue; s[5]! < cues.length && t >= (c = cues[s[5]!]!)[0]; s[5] = s[5]! + 1) {
      if (c[1] === "word") fx.word(c[3] as number, c[4] as number, c[2] as number, c[5] as number, c[6] as number);
      else if (c[1] === "kick") fx.kick(c[2] as number);
      else emit(ids[c[2] as string]!, c[3] as number, c[4] as number, c[5] as number, c[6] as number, c[7] as number, c[8] as number);
    }
    for (const g of gags)
      // A gag on a track hands emit a new x and y each step (32 B: fx's emit takes numbers).
      if (t > g.on[0] && t < g.on[1]) put(g.x, 7, g.dx), put(g.y, 8, g.dy), emit(ids[g.emit]!, s[7]!, s[8]!, g.n, g.c, g.cn, g.scale);
  }

  function draw(items: Item[]) {
    for (let i = 0; i < items.length; i++) {
      const it: any = items[i];
      if (!shown(it)) continue;
      if (it.sprite) spr.draw(ctx, it.sprite, 0, val(it.x), val(it.y), val(it.rot ?? 0), val(it.scale ?? 1), val(it.pal ?? 0));
      else if (it.rect) (ctx.fillStyle = val(it.fill)), ctx.fillRect(val(it.rect[0]), val(it.rect[1]), val(it.rect[2]), val(it.rect[3]));
      else if (it.line) {
        ctx.lineCap = it.cap ?? "butt";
        ctx.beginPath();
        ctx.moveTo(val(it.line[0]), val(it.line[1]));
        ctx.lineTo(val(it.line[2]), val(it.line[3]));
        ctx.strokeStyle = val(it.stroke);
        ctx.lineWidth = val(it.lw);
        ctx.stroke();
      } else {
        const x = val(it.x), y = val(it.y);
        ctx.font = it.font;
        ctx.textAlign = it.align ?? "start";
        if (it.stroke) (ctx.lineWidth = val(it.lw ?? 1)), (ctx.strokeStyle = val(it.stroke)), ctx.strokeText(it.text, x, y);
        ctx.fillStyle = val(it.fill);
        ctx.fillText(it.text, x, y);
      }
    }
  }

  function paint() {
    const w = s[0]!, h = s[1]!, dp = s[2]!, t = s[4]!;
    if (canvas.width !== Math.round(w * dp) || canvas.height !== Math.round(h * dp)) {
      canvas.width = Math.round(w * dp);
      canvas.height = Math.round(h * dp);
      // The grid, centred and scaled to fit: one transform per resize.
      const k = Math.min(canvas.width / VW, canvas.height / VH);
      ctx.setTransform(k, 0, 0, k, (canvas.width - VW * k) / 2, (canvas.height - VH * k) / 2);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = st.bg;
    ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
    const sh = fx.shake * shake;
    if (sh) ctx.save(), ctx.translate(Math.round(Math.sin(t * 70) * sh), Math.round(Math.cos(t * 53) * sh));
    if (st.stars) ctx.fillStyle = st.stars[1];
    for (let i = 0; i < sky.length; i += 2) ctx.fillRect(sky[i]! | 0, sky[i + 1]! | 0, 1, 1);
    draw(cast);
    fx.draw(ctx);
    if (sh) ctx.restore();
    draw(over);
  }
  reset();
  // The scene is its own system: read measures, step moves the clock, render paints.
  const sys: Scene = {
    engine, play, destroy: () => engine.destroy(),
    read() {
      if (!s[3]) return;
      s[3] = 0;
      s[0] = stage.clientWidth;
      s[1] = stage.clientHeight;
      s[2] = Math.min(2, devicePixelRatio || 1);
    },
    step(e, dt) {
      if (!motion) return;
      step(dt);
      fx.step(dt);
      if (loop > 0 && s[4]! > end && (s[6] = s[6]! + dt) >= loop) reset();
      if (fx.live > 0 || loop > 0) e.busy();
    },
    render: paint,
  };
  engine.add(sys);
  engine.start();
  return sys;
}

/** Scene data as a slot mount: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export const scene = (d: SceneData, o?: SceneOptions): SlotMount => (stage) => mountScene(stage, d, o);
