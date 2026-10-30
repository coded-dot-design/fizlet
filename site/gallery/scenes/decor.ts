// The decor scene: a page scene (like page.ts) that dresses the page's own elements. It reads them
// through fizlet/board-page (targets only, re-measured only after a scroll, resize or change: a
// running frame reads no layout), draws on a canvas in the slot's stage and writes to page elements
// only through the engine's ledger (one data attribute per element, styled by one sheet the ledger
// adds), so Recall gives the page back byte for byte. Mounted through fizlet/slot: it loads near the
// viewport, never under reduced motion. Each effect is its own export and the entry imports only the
// one it plays (`scene(settle, {...})`), so a page ships one effect:
//   settle    flakes (snow, leaves) fall and settle on the elements' top edges, and stay
//   lights    a string of bulbs along each element's top edge: a chase, then steady (asleep)
//   jingle    the element you hover (or tap) swings like an ornament and glows
//   dash      comic speed lines rush past the elements (hover or tap one: past that one)
//   halftone  a wave of halftone dots spreads from the tap and lights each element it reaches
//   wipe      a comic panel wipes across and lights each element it passes
import { createEngine } from "../../../src/kernel/index";
import { boardPage } from "../../../src/board-page";
import type { SlotScene, SlotTap } from "../../../src/slot";

export interface DecorFx {
  effect: "settle" | "lights" | "jingle" | "dash" | "halftone" | "wipe";
  /** The page elements it reads (CSS selector, inside the slot). */
  select: string;
  /** Hex colours, from the Board UI tokens. */
  colors: string[];
  /** settle, dash: particles a second while it plays. lights: px between bulbs. halftone, wipe: px (dot grid, panel width). jingle: degrees of swing. */
  count: number;
  /** Seconds it plays after a trigger (mount, tap, hover, loop). */
  seconds: number;
  /** Seconds a lit element takes to fade. */
  glow: number;
  /** Seconds between automatic replays while visible; 0: on mount and on input only (then it sleeps). */
  loop: number;
  /** Size multiplier. */
  scale: number;
}
export type DecorScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(x?: number, y?: number): void };

type Engine = ReturnType<typeof createEngine>;
type Target = { el: Element; x: number; y: number; w: number; h: number };
/** What an effect sees: the params, the state, the targets, the particle pool and the canvas. */
export interface Decor {
  p: DecorFx;
  /**
   * State, one typed array (no boxed doubles): 0 width, 1 height, 2 dpr, 3 stage left, 4 stage top,
   * 5 resized, 6 progress (-1: idle), 7 trigger pending, 8 trigger x, 9 trigger y, 10 seconds left,
   * 11 carry, 12 loop timer, 13 active target (-1: none), 14 dt, 15 time, 16 origin x, 17 origin y,
   * 18 spawn cursor, 19 live this frame.
   */
  s: Float64Array;
  T: readonly Target[];
  /** Per target: lit (0-1) and a second value an effect may use (jingle: swing seconds left). */
  lit: Float32Array;
  aux: Float32Array;
  /** Particles: x, y, speed, length or life, phase or vx; state (0 free, 1 moving, 2 settled); colour. */
  px: Float32Array; py: Float32Array; pv: Float32Array; pl: Float32Array; pp: Float32Array; ps: Uint8Array; pc: Uint8Array;
  ctx: CanvasRenderingContext2D;
  e: Engine;
}
export interface Effect {
  /** Hover (pointerover an element it reads) triggers it, like a tap. */
  hover: boolean;
  trigger(d: Decor): void;
  /** One step (dt in s[14]); adds to s[19] while anything moves. */
  step(d: Decor): void;
  paint(d: Decor): void;
  /** The attribute value (an index into the sheet's values, 0: none) for target i this frame. */
  look?(d: Decor, i: number): number;
  /** The sheet: its values and css (default: a glow per colour and level). */
  sheet?(p: DecorFx, attr: string): [string[], string];
}

const CAP = 240, MAX = 32, LEVELS = 6, ATTR = "data-fizlet-lit";

/** The stage-relative box of target i: left, top (no layout read: board-page's last measure). */
const left = (d: Decor, i: number) => d.T[i]!.x - d.s[3]!;
const top = (d: Decor, i: number) => d.T[i]!.y - d.s[4]!;
const n = (d: Decor) => (d.T.length < MAX ? d.T.length : MAX);
/** The target under a stage point, or -1. */
function under(d: Decor, x: number, y: number) {
  for (let i = 0; i < n(d); i++) {
    const t = d.T[i]!, l = left(d, i), tp = top(d, i);
    if (t.w > 0 && x >= l - 4 && x <= l + t.w + 4 && y >= tp - 4 && y <= tp + t.h + 4) return i;
  }
  return -1;
}
/** A free particle slot (settled ones are reused, oldest first), or -1. */
function slot(d: Decor) {
  for (let k = 0; k < CAP; k++) {
    const q = (d.s[18]! + k) % CAP;
    if (d.ps[q] !== 1) return (d.s[18] = (q + 1) % CAP), q;
  }
  return -1;
}
/** Spawns as many particles as `count` a second makes this step, while seconds are left. */
function spawning(d: Decor) {
  const s = d.s;
  if (s[10]! <= 0) return 0;
  s[10] = s[10]! - s[14]!;
  s[11] = s[11]! + d.p.count * s[14]!;
  const k = Math.floor(s[11]!);
  s[11] = s[11]! - k;
  s[19] = s[19]! + 1;
  return k;
}
const glowLevel = (d: Decor, i: number) => (d.lit[i]! > 0 ? (i % d.p.colors.length) * LEVELS + Math.ceil(d.lit[i]! * LEVELS) : 0);
function glowSheet(p: DecorFx, attr: string): [string[], string] {
  const v: string[] = [""];
  let css = "";
  for (let c = 0; c < p.colors.length; c++)
    for (let l = 1; l <= LEVELS; l++) {
      const a = Math.round((l / LEVELS) * 255).toString(16).padStart(2, "0"), col = p.colors[c]!;
      v[c * LEVELS + l] = `${c}-${l}`;
      css += `[${attr}="${c}-${l}"]{color:${col}!important;text-shadow:0 0 ${l * 2}px ${col}${a},0 0 ${l * 5}px ${col}${a}!important}`;
    }
  return [v, css];
}
/** A front moving from 0 to `end` in p.seconds (s[6]; -1 when done). */
function front(d: Decor, end: number) {
  const s = d.s;
  if (s[6]! < 0) return -1;
  s[6] = s[6]! + (end / d.p.seconds) * s[14]!;
  if (s[6]! > end) return (s[6] = -1);
  s[19] = s[19]! + 1;
  return s[6]!;
}

/** Flakes fall and settle on the elements' top edges (and the floor), and stay until reused. */
export const settle: Effect = {
  hover: false,
  trigger: (d) => ((d.s[10] = d.p.seconds), (d.s[16] = d.s[8]!)),
  step(d) {
    const { s, e, p } = d, w = s[0]!, h = s[1]!, dt = s[14]!, sc = p.scale, nc = p.colors.length;
    for (let m = spawning(d); m > 0; m--) {
      const k = slot(d);
      if (k < 0) break;
      d.ps[k] = 1;
      d.px[k] = s[16]! >= 0 ? s[16]! + (e.random() - 0.5) * w * 0.4 : e.random() * w;
      d.py[k] = -4 - e.random() * 20;
      d.pv[k] = (110 + e.random() * 70) * sc;
      d.pp[k] = e.random() * 6.2832;
      d.pc[k] = (e.random() * nc) | 0;
    }
    for (let k = 0; k < CAP; k++) {
      if (d.ps[k] !== 1) continue;
      const y0 = d.py[k]!, y1 = y0 + d.pv[k]! * dt, x = (d.px[k] = d.px[k]! + Math.sin(s[15]! * 3 + d.pp[k]!) * 18 * sc * dt);
      d.py[k] = y1;
      s[19] = s[19]! + 1;
      if (y1 >= h - 1) ((d.py[k] = h - 1), (d.ps[k] = 2));
      else
        for (let i = 0; i < n(d); i++) {
          const t = d.T[i]!, l = left(d, i), tp = top(d, i);
          // About half stick (a block element is as wide as the page: the rest fall on to the next).
          if (t.w > 0 && x >= l && x <= l + t.w && y0 < tp && y1 >= tp && (d.pp[k]! * (i + 3)) % 6.2832 < 3) {
            d.py[k] = tp;
            d.ps[k] = 2;
            d.lit[i] = d.lit[i]! + 0.15 > 1 ? 1 : d.lit[i]! + 0.15;
            break;
          }
        }
    }
  },
  paint(d) {
    const { ctx, p } = d, z = 2 * p.scale;
    for (let k = 0; k < CAP; k++) {
      if (!d.ps[k]) continue;
      ctx.fillStyle = p.colors[d.pc[k]!]!;
      ctx.fillRect(d.px[k]! - z / 2, d.py[k]! - z, z, z);
    }
  },
};

/** A string of bulbs along each element's top edge: a chase for p.seconds, then steady and asleep. */
export const lights: Effect = {
  hover: false,
  trigger: (d) => void (d.s[6] = 0),
  step(d) {
    const s = d.s;
    if (s[6]! < 0) return;
    s[6] = s[6]! + s[14]!;
    if (s[6]! >= d.p.seconds) s[6] = -1;
    s[19] = s[19]! + 1;
    for (let i = 0; i < n(d); i++) d.lit[i] = 1;
  },
  paint(d) {
    const { ctx, p, s } = d, sc = p.scale, gap = p.count * sc, nc = p.colors.length, chase = s[6]! >= 0, beat = Math.floor(s[6]! * 8);
    let g = 0;
    for (let i = 0; i < n(d); i++) {
      const t = d.T[i]!;
      if (t.w <= 0) continue;
      const l = left(d, i) - 6 * sc, y = top(d, i) - 7 * sc, w = t.w + 12 * sc;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p.colors[0]!;
      ctx.fillRect(l, y - sc, w, sc);
      for (let x = l + gap / 2; x < l + w; x += gap, g++) {
        const on = !chase || (g + beat) % 3 === 0;
        ctx.fillStyle = p.colors[g % nc]!;
        if (on) (ctx.globalAlpha = 0.3), ctx.fillRect(x - 6 * sc, y - 3 * sc, 12 * sc, 13 * sc);
        ctx.globalAlpha = on ? 1 : 0.3;
        ctx.fillRect(x - 2.5 * sc, y, 5 * sc, 6 * sc);
      }
    }
    ctx.globalAlpha = 1;
  },
};

/** The element you hover (or tap) swings from its top like an ornament, and glows (mount: all of them). */
export const jingle: Effect = {
  hover: true,
  trigger(d) {
    const i = d.s[8]! >= 0 ? under(d, d.s[8]!, d.s[9]!) : -1;
    for (let j = 0; j < n(d); j++) if (i < 0 || j === i) (d.aux[j] = d.p.seconds), (d.lit[j] = 1);
  },
  step(d) {
    for (let i = 0; i < n(d); i++) if (d.aux[i]! > 0) (d.aux[i] = d.aux[i]! - d.s[14]!), (d.s[19] = d.s[19]! + 1);
  },
  paint() {},
  // Seven swing angles (-3..3) per colour: value index = colour * 7 + angle + 4.
  look(d, i) {
    const a = d.aux[i]!;
    if (a <= 0) return 0;
    const q = Math.round(Math.sin((d.p.seconds - a) * 16) * (a / d.p.seconds) * 3);
    return (i % d.p.colors.length) * 7 + q + 4;
  },
  sheet(p, attr) {
    const v: string[] = [""];
    let css = "";
    for (let c = 0; c < p.colors.length; c++)
      for (let q = -3; q <= 3; q++) {
        const col = p.colors[c]!;
        v[c * 7 + q + 4] = `${c}${q}`;
        css += `[${attr}="${c}${q}"]{display:inline-block;transform-origin:50% 0;transform:rotate(${((q * p.count) / 3).toFixed(2)}deg);color:${col}!important;text-shadow:0 0 6px ${col},0 0 14px ${col}88!important}`;
      }
    return [v, css];
  },
};

/** Comic speed lines rush past the elements, right to left (hover or tap one: past that one). */
export const dash: Effect = {
  hover: true,
  trigger(d) {
    d.s[10] = d.p.seconds;
    d.s[13] = d.s[8]! >= 0 ? under(d, d.s[8]!, d.s[9]!) : -1;
  },
  step(d) {
    const { s, e, p } = d, w = s[0]!, h = s[1]!, dt = s[14]!, sc = p.scale, nt = n(d);
    for (let m = spawning(d); m > 0; m--) {
      const k = slot(d), i = s[13]! >= 0 ? s[13]! : (e.random() * nt) | 0, t = d.T[i];
      if (k < 0) break;
      d.ps[k] = 1;
      d.px[k] = w + e.random() * 40;
      d.py[k] = t && t.w > 0 ? top(d, i) + e.random() * t.h : e.random() * h;
      d.pv[k] = (700 + e.random() * 500) * sc;
      d.pl[k] = (20 + e.random() * 70) * sc;
      d.pc[k] = (e.random() * p.colors.length) | 0;
      if (t && t.w > 0) d.lit[i] = 1;
    }
    for (let k = 0; k < CAP; k++) {
      if (d.ps[k] !== 1) continue;
      d.px[k] = d.px[k]! - d.pv[k]! * dt;
      if (d.px[k]! + d.pl[k]! < 0) d.ps[k] = 0;
      else s[19] = s[19]! + 1;
    }
  },
  paint(d) {
    const { ctx, p } = d, th = 1.5 * p.scale;
    ctx.globalAlpha = 0.85;
    for (let k = 0; k < CAP; k++) {
      if (d.ps[k] !== 1) continue;
      ctx.fillStyle = p.colors[d.pc[k]!]!;
      ctx.fillRect(d.px[k]!, d.py[k]!, d.pl[k]!, th);
    }
    ctx.globalAlpha = 1;
  },
};

/** A wave of halftone dots spreads from the tap (mount: the top left) and lights each element it reaches. */
export const halftone: Effect = {
  hover: false,
  trigger(d) {
    d.s[16] = d.s[8]! >= 0 ? d.s[8]! : 0;
    d.s[17] = d.s[9]! >= 0 ? d.s[9]! : 0;
    d.s[6] = 0;
  },
  step(d) {
    const s = d.s, w = s[0]!, h = s[1]!, band = 6 * d.p.count * d.p.scale;
    const r = front(d, Math.sqrt(w * w + h * h) + band);
    if (r < 0) return;
    for (let i = 0; i < n(d); i++) {
      const t = d.T[i]!, cx = left(d, i) + t.w / 2 - s[16]!, cy = top(d, i) + t.h / 2 - s[17]!;
      if (t.w > 0 && d.lit[i]! <= 0 && cx * cx + cy * cy <= r * r) d.lit[i] = 1;
    }
  },
  paint(d) {
    const { ctx, p, s } = d, r = s[6]!;
    if (r < 0) return;
    const gap = p.count * p.scale, band = 6 * gap, w = s[0]!, h = s[1]!, nc = p.colors.length;
    for (let y = gap / 2; y < h; y += gap)
      for (let x = gap / 2; x < w; x += gap) {
        const dx = x - s[16]!, dy = y - s[17]!, u = (r - Math.sqrt(dx * dx + dy * dy)) / band;
        if (u <= 0 || u >= 1) continue;
        ctx.fillStyle = p.colors[u < 0.35 || nc < 2 ? 0 : 1]!;
        ctx.beginPath();
        ctx.arc(x, y, gap * 0.55 * (1 - u), 0, 6.2832);
        ctx.fill();
      }
  },
};

/** A comic panel (a slanted band with an ink edge) wipes left to right and lights each element it passes. */
export const wipe: Effect = {
  hover: false,
  trigger: (d) => void (d.s[6] = 0),
  step(d) {
    const s = d.s, band = d.p.count * d.p.scale, x = front(d, s[0]! + band * 2) - band;
    if (s[6]! < 0) return;
    for (let i = 0; i < n(d); i++) {
      const t = d.T[i]!;
      if (t.w > 0 && d.lit[i]! <= 0 && left(d, i) + t.w / 2 <= x) d.lit[i] = 1;
    }
  },
  paint(d) {
    const { ctx, p, s } = d;
    if (s[6]! < 0) return;
    const sc = p.scale, band = p.count * sc, x = s[6]! - band, h = s[1]!, sk = h * 0.25, nc = p.colors.length;
    ctx.fillStyle = p.colors[0]!;
    ctx.beginPath();
    ctx.moveTo(x - band + sk, 0), ctx.lineTo(x + sk, 0), ctx.lineTo(x - sk, h), ctx.lineTo(x - band - sk, h);
    ctx.fill();
    ctx.lineWidth = 5 * sc;
    ctx.strokeStyle = "#07060f";
    ctx.beginPath();
    ctx.moveTo(x + sk, 0), ctx.lineTo(x - sk, h);
    ctx.stroke();
    ctx.lineWidth = 2 * sc;
    ctx.strokeStyle = p.colors[nc > 1 ? 1 : 0]!;
    ctx.beginPath();
    ctx.moveTo(x - band + sk, 0), ctx.lineTo(x - band - sk, h);
    ctx.stroke();
  },
};

export function decor(stage: HTMLElement, root: HTMLElement, fx: Effect, p: DecorFx, first: SlotTap | null = null): DecorScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const L = engine.ledger;
  const board = boardPage(engine, { root, text: false, targets: p.select, still: Infinity });
  // The stage lets the pointer through to the page it reads; the canvas is ours (the ledger's).
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
  stage.append(canvas);
  // One sheet for every value an element can take, made once: a frame writes only a value from it.
  const [VALUES, css] = (fx.sheet ?? glowSheet)(p, ATTR);
  const sheet = L.add(document.createElement("style"));
  sheet.textContent = css;
  document.head.append(sheet);
  const d: Decor = {
    p, e: engine, T: board.targets, ctx: canvas.getContext("2d")!,
    s: new Float64Array([0, 0, 1, 0, 0, 1, -1, 1, -1, -1, 0, 0, 0, -1, 0, 0, -1, -1, 0, 0]),
    lit: new Float32Array(MAX), aux: new Float32Array(MAX),
    px: new Float32Array(CAP), py: new Float32Array(CAP), pv: new Float32Array(CAP), pl: new Float32Array(CAP), pp: new Float32Array(CAP), ps: new Uint8Array(CAP), pc: new Uint8Array(CAP),
  };
  const s = d.s, look = fx.look ?? glowLevel;
  if (first) (s[8] = first.x), (s[9] = first.y);
  const ro = new ResizeObserver(() => ((s[5] = 1), engine.wake()));
  ro.observe(stage);
  addEventListener("scroll", () => (s[5] = 1), { signal: engine.signal, passive: true, capture: true });
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = (x = -1, y = -1) => ((s[8] = x), (s[9] = y), (s[7] = 1), engine.wake());
  const at = (ev: PointerEvent) => {
    const r = stage.getBoundingClientRect(); // one read per input, outside any frame
    play(ev.clientX - r.left, ev.clientY - r.top);
  };
  root.addEventListener("pointerdown", at, { signal: engine.signal });
  if (fx.hover) root.addEventListener("pointerover", (ev) => (ev.target as Element).closest?.(p.select) && at(ev), { signal: engine.signal });

  function paint() {
    const w = s[0]!, h = s[1]!, r = s[2]!, ctx = d.ctx;
    for (let i = 0; i < n(d); i++) {
      const v = look(d, i);
      L.attr(d.T[i]!.el as HTMLElement, ATTR, v ? VALUES[v]! : null);
    }
    // A new size resets the context: scale it once then (a per-frame setTransform with a double boxes it).
    if (canvas.width !== Math.round(w * r) || canvas.height !== Math.round(h * r)) (canvas.width = Math.round(w * r)), (canvas.height = Math.round(h * r)), ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);
    fx.paint(d);
  }
  engine.add({
    read() {
      if (!s[5]) return;
      s[5] = 0;
      const r = stage.getBoundingClientRect(); // after a resize or a scroll only
      s[0] = r.width;
      s[1] = r.height;
      s[2] = Math.min(2, devicePixelRatio || 1);
      s[3] = r.left;
      s[4] = r.top;
    },
    step(e, dt) {
      s[14] = dt;
      s[15] = s[15]! + dt;
      s[19] = 0;
      if (s[7]) (s[7] = 0), fx.trigger(d);
      if (p.loop > 0 && (s[12] = s[12]! + dt) >= p.loop) (s[12] = 0), (s[8] = s[9] = -1), fx.trigger(d);
      for (let i = 0; i < MAX; i++) if (d.lit[i]! > 0) (d.lit[i] = d.lit[i]! - dt / p.glow), (s[19] = s[19]! + 1);
      fx.step(d);
      if (s[19]! > 0 || p.loop > 0) e.busy();
    },
    // A tiny hook V8 inlines: the frame's alpha (a double) is never boxed to call it.
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for one effect and its params: the page it reads is the slot's own markup. */
export const scene = (fx: Effect, p: DecorFx) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => decor(stage, slot, fx, p, first);
