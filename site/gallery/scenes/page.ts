// The page scene: the second scene type. It reads real page elements (the headings or buttons in
// its slot) through fizlet/board-page: targets only, re-measured only after a scroll, resize or
// change, so a running frame reads no layout. It draws on a canvas in the slot's stage, and it
// writes to page elements only through the engine's ledger: one data attribute per element, styled
// by one sheet the ledger adds, so Recall gives the page back byte for byte. Mounted through
// fizlet/slot: it loads near the viewport, never under reduced motion. Two effects, chosen by data:
//   sweep  a scanline sweeps down and lights up every element it passes (tap: it starts there)
//   pool   rain falls on the element you hover (or tap) and pools along its top edge
import { createEngine } from "../../../src/kernel/index";
import { boardPage } from "../../../src/board-page";
import type { SlotScene, SlotTap } from "../../../src/slot";

export interface PageFx {
  effect: "sweep" | "pool";
  /** The page elements it reads (CSS selector, inside the slot). */
  select: string;
  /** Hex colours, from the Board UI tokens. */
  colors: string[];
  /** pool: drops a second while it rains. sweep: the line's thickness in px. */
  count: number;
  /** sweep: seconds the line takes to cross. pool: seconds it rains after a hover or tap. */
  seconds: number;
  /** Seconds a lit element (or a pool) takes to fade. */
  glow: number;
  /** Seconds between automatic replays while visible; 0: on mount and on input only (then it sleeps). */
  loop: number;
  /** Size multiplier. */
  scale: number;
}
export type PageScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(x?: number, y?: number): void };

const CAP = 240, LEVELS = 6, ATTR = "data-fizlet-lit";

export function page(stage: HTMLElement, root: HTMLElement, p: PageFx, first: SlotTap | null = null): PageScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const L = engine.ledger, nc = p.colors.length, sweep = p.effect === "sweep";
  const board = boardPage(engine, { root, text: false, targets: p.select, still: Infinity });
  const T = board.targets;
  // The stage lets the pointer through to the page it reads; the canvas is ours (the ledger's).
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // One sheet for every lit level and colour, made once: a frame writes only a value from LIT.
  const LIT: string[] = [""];
  let css = "";
  for (let c = 0; c < nc; c++)
    for (let l = 1; l <= LEVELS; l++) {
      const v = `${c}-${l}`, a = Math.round((l / LEVELS) * 255).toString(16).padStart(2, "0"), col = p.colors[c]!;
      LIT[c * LEVELS + l] = v;
      css += `[${ATTR}="${v}"]{color:${col}!important;text-shadow:0 0 ${l * 2}px ${col}${a},0 0 ${l * 5}px ${col}${a}!important}`;
    }
  const sheet = L.add(document.createElement("style"));
  sheet.textContent = css;
  document.head.append(sheet);

  // State, one typed array (no boxed doubles in a step): width, height, dpr, stage left, stage top,
  // resized, line y (-1: idle), trigger pending, trigger x, trigger y, rain seconds left, rain carry,
  // loop timer, active target (-1: none), rain x0, rain x1.
  const s = new Float64Array([0, 0, 1, 0, 0, 1, -1, 1, -1, -1, 0, 0, 0, -1, 0, 0]);
  if (first) (s[8] = first.x), (s[9] = first.y);
  const lit = new Float32Array(32);
  // Drops: x, y, vy, life (s), state (0 free, 1 falling, 2 pooled), colour, edge y.
  const dx = new Float32Array(CAP), dy = new Float32Array(CAP), dv = new Float32Array(CAP), dl = new Float32Array(CAP), de = new Float32Array(CAP);
  const ds = new Uint8Array(CAP), dc = new Uint8Array(CAP);
  const ro = new ResizeObserver(() => ((s[5] = 1), engine.wake()));
  ro.observe(stage);
  const moved = () => (s[5] = 1);
  addEventListener("scroll", moved, { signal: engine.signal, passive: true, capture: true });
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = (x = -1, y = -1) => ((s[8] = x), (s[9] = y), (s[7] = 1), engine.wake());
  const at = (ev: PointerEvent) => {
    const r = stage.getBoundingClientRect(); // one read per input, outside any frame
    play(ev.clientX - r.left, ev.clientY - r.top);
  };
  root.addEventListener("pointerdown", at, { signal: engine.signal });
  if (!sweep) root.addEventListener("pointerover", (ev) => (ev.target as Element).closest?.(p.select) && at(ev), { signal: engine.signal });

  /** The target under a stage point, or -1. */
  const under = (x: number, y: number) => {
    for (let i = 0; i < T.length && i < 32; i++) {
      const t = T[i]!, l = t.x - s[3]!, top = t.y - s[4]!;
      if (t.w > 0 && x >= l - 4 && x <= l + t.w + 4 && y >= top - 4 && y <= top + t.h + 4) return i;
    }
    return -1;
  };
  const trigger = (x: number, y: number) => {
    if (sweep) return void (s[6] = y >= 0 ? y : 0);
    const i = x >= 0 ? under(x, y) : 0, t = T[i];
    s[13] = t && t.w > 0 ? i : -1;
    // Over a target: rain across it. Elsewhere (a tap off the targets): a band around the tap.
    if (s[13]! >= 0) (s[14] = t!.x - s[3]!), (s[15] = t!.x - s[3]! + t!.w);
    else (s[14] = (x >= 0 ? x : s[0]! / 2) - 30 * p.scale), (s[15] = s[14]! + 60 * p.scale);
    s[10] = p.seconds;
  };
  function paint() {
    const w = s[0]!, h = s[1]!, d = s[2]!, sc = p.scale;
    for (let i = 0; i < T.length && i < 32; i++) {
      const l = lit[i]! > 0 ? Math.ceil(lit[i]! * LEVELS) : 0;
      L.attr(T[i]!.el as HTMLElement, ATTR, l ? LIT[(i % nc) * LEVELS + l]! : null);
    }
    // A new size resets the context: scale it once then (a per-frame setTransform with a double boxes it).
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) (canvas.width = Math.round(w * d)), (canvas.height = Math.round(h * d)), ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (sweep && s[6]! >= 0) {
      // The line, and a fading trail above it.
      const y = s[6]!, th = p.count * sc;
      ctx.fillStyle = p.colors[0]!;
      for (let k = 1; k <= 6; k++) (ctx.globalAlpha = 0.07 * (7 - k)), ctx.fillRect(0, y - th - k * 5 * sc, w, 5 * sc);
      ctx.globalAlpha = 1;
      ctx.fillRect(0, y - th, w, th);
      ctx.fillStyle = p.colors[nc > 1 ? 1 : 0]!;
      ctx.fillRect(0, y - th / 3, w, th / 3);
    }
    for (let k = 0; k < CAP; k++) {
      if (!ds[k]) continue;
      ctx.fillStyle = p.colors[dc[k]!]!;
      if (ds[k] === 1) (ctx.globalAlpha = 0.9), ctx.fillRect(dx[k]! - sc / 2, dy[k]! - 10 * sc, 1.5 * sc, 10 * sc);
      else (ctx.globalAlpha = dl[k]! / p.glow), ctx.fillRect(dx[k]! - 3 * sc, dy[k]! - 2 * sc, 6 * sc, 2 * sc);
    }
    ctx.globalAlpha = 1;
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
      const w = s[0]!, h = s[1]!;
      let live = 0;
      if (s[7]) (s[7] = 0), trigger(s[8]!, s[9]!);
      if (p.loop > 0 && (s[12] = s[12]! + dt) >= p.loop) (s[12] = 0), trigger(-1, -1);
      for (let i = 0; i < 32; i++) if (lit[i]! > 0) (lit[i] = lit[i]! - dt / p.glow), live++;
      if (sweep && s[6]! >= 0) {
        const y0 = s[6]!, y1 = y0 + (h / p.seconds) * dt;
        for (let i = 0; i < T.length && i < 32; i++) {
          const t = T[i]!, mid = t.y - s[4]! + t.h / 2;
          if (t.w > 0 && mid > y0 && mid <= y1) lit[i] = 1;
        }
        s[6] = y1 > h + 40 ? -1 : y1;
        live++;
      }
      if (!sweep) {
        const g = 900 * p.scale, a = s[13]!, t = a >= 0 ? T[a] : undefined, edge = t && t.w > 0 ? t.y - s[4]! : h + 8;
        if (s[10]! > 0) {
          s[10] = s[10]! - dt;
          s[11] = s[11]! + p.count * dt;
          for (let k = 0; k < CAP && s[11]! >= 1; k++)
            if (!ds[k]) (s[11] = s[11]! - 1), (ds[k] = 1), (dx[k] = s[14]! + e.random() * (s[15]! - s[14]!)), (dy[k] = -8 - e.random() * 40), (dv[k] = 160 * p.scale), (de[k] = edge), (dc[k] = (e.random() * nc) | 0);
          if (s[11]! >= 1) s[11] = 0; // the pool is full: drop the rest
          live++;
        }
        for (let k = 0; k < CAP; k++) {
          if (ds[k] === 1) {
            dv[k] = dv[k]! + g * dt;
            dy[k] = dy[k]! + dv[k]! * dt;
            if (dy[k]! >= de[k]!) {
              if (de[k]! > h) ds[k] = 0;
              else (ds[k] = 2), (dy[k] = de[k]!), (dl[k] = p.glow), (dx[k] = dx[k]! + (e.random() - 0.5) * 6), a >= 0 && a < 32 && (lit[a] = lit[a]! + 0.12 > 1 ? 1 : lit[a]! + 0.12);
            }
          } else if (ds[k] === 2 && (dl[k] = dl[k]! - dt) <= 0) ds[k] = 0;
          if (ds[k]) live++;
        }
      }
      if (live > 0 || p.loop > 0) e.busy();
    },
    // A tiny hook V8 inlines: the frame's alpha (a double) is never boxed to call it.
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for these params: the page it reads is the slot's own markup. */
export const scene = (p: PageFx) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => page(stage, slot, p, first);
