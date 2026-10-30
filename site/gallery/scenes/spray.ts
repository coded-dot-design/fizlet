// The spray scene: the particle recipes (burst, rise, fall, trail) are this one scene with different
// data; a tap sets where they leave from (a point bursts there, an edge sprays above or below it, a
// trail crosses the stage at its height). A burst can pop comic words too (fx.word). Bricks: the kernel (settle + fps cap: it sleeps once still) and fizlet/fx (one fixed pool,
// one named particle kind). Mounted through fizlet/slot, so it loads near the viewport, never under
// reduced motion, and destroy() gives the page back (the canvas goes through the ledger).
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter, type Kind } from "../../../src/fx";
import type { SlotScene, SlotTap } from "../../../src/slot";

export interface Spray {
  /** Where particles leave from: a point (the tap, or the centre), the bottom edge, the top edge, or a head crossing left to right (a trail). */
  source: "point" | "bottom" | "top" | "across";
  kind: Kind;
  /** Hex colours, from the Board UI tokens. */
  colors: string[];
  /** Particles per burst (point) or per second (edges). */
  count: number;
  /** Seconds an edge source sprays per trigger (point: ignored). */
  seconds: number;
  /** Pool gravity in px/s² (each kind takes its own share). */
  gravity: number;
  /** Seconds between automatic triggers while visible; 0: on mount and on tap only (then it sleeps). */
  loop: number;
  /** Size multiplier for speed and particle size. */
  scale: number;
  /** Comic words a point burst pops, one a burst, in turn (fizlet/fx pop words). */
  words?: string[];
  /** Hovering the stage plays it too (where the pointer comes in). */
  hover?: boolean;
}
export type SprayScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(x?: number, y?: number): void };

export function spray(stage: HTMLElement, p: Spray, first: SlotTap | null = null): SprayScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const fx = effects({ cap: 320, colors: p.colors, scorch: 0, gravity: p.gravity, ...(p.words && { words: p.words }) });
  const { ids, emit } = emitter(fx, { k: p.kind });
  const K = ids.k, nc = p.colors.length;
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // State, one typed array (no boxed doubles in the step): width, height, device pixel ratio,
  // edge seconds left, edge carry, loop timer, trigger x, trigger y, trigger pending, resized, edge x
  // (where a tap rains from: -1, the whole edge; a trail: the height it crosses at), next word.
  const s = new Float64Array([0, 0, 1, 0, 0, 0, -1, -1, 1, 1, -1, 0]);
  const across = p.source === "across", nw = p.words?.length ?? 0;
  if (first) (s[6] = first.x), (s[7] = first.y);
  const ro = new ResizeObserver(() => ((s[9] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = (x = -1, y = -1) => ((s[6] = x), (s[7] = y), (s[8] = 1), engine.wake());
  const at = (ev: PointerEvent) => {
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    play(ev.clientX - r.left, ev.clientY - r.top);
  };
  stage.addEventListener("pointerdown", at, { signal: engine.signal });
  if (p.hover) stage.addEventListener("pointerenter", at, { signal: engine.signal });

  const trigger = (x: number, y: number) => {
    const w = s[0]!, h = s[1]!;
    if (p.source === "point") {
      const px = x >= 0 ? x : w / 2, py = y >= 0 ? y : h / 2;
      emit(K, px, py, p.count, 0, nc, p.scale);
      if (nw) fx.word(px, py, s[11]!, s[11]! % nc, 34 * p.scale), (s[11] = (s[11]! + 1) % nw);
    } else (s[3] = p.seconds), (s[10] = across ? (y >= 0 ? y : h * 0.3) : x);
  };
  function paint() {
    const w = s[0]!, h = s[1]!, d = s[2]!;
    // A new size resets the context: scale it once then (a per-frame setTransform with a double boxes it).
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) (canvas.width = Math.round(w * d)), (canvas.height = Math.round(h * d)), ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    fx.draw(ctx);
    // A trail's head, while it crosses.
    if (across && s[3]! > 0) (ctx.fillStyle = p.colors[0]!), ctx.fillRect((1 - s[3]! / p.seconds) * (w + 60) - 34, s[10]! - 4 * p.scale, 8 * p.scale, 8 * p.scale);
  }
  engine.add({
    read() {
      if (!s[9]) return;
      s[9] = 0;
      s[0] = stage.clientWidth;
      s[1] = stage.clientHeight;
      s[2] = Math.min(2, devicePixelRatio || 1);
    },
    step(e, dt) {
      if (s[8]) (s[8] = 0), trigger(s[6]!, s[7]!);
      if (p.loop > 0 && (s[5] = s[5]! + dt) >= p.loop) (s[5] = 0), trigger(-1, -1);
      if (s[3]! > 0) {
        s[3] = s[3]! - dt;
        s[4] = s[4]! + p.count * dt;
        const n = Math.floor(s[4]!), w = s[0]!, x = s[10]!;
        s[4] = s[4]! - n;
        // A tap honours its position: the edge sprays in a band around it (else the whole edge).
        if (across) for (let i = 0; i < n; i++) emit(K, (1 - s[3]! / p.seconds) * (w + 60) - 30, x + (e.random() - 0.5) * 8 * p.scale, 1, 0, nc, p.scale);
        else for (let i = 0; i < n; i++) emit(K, x >= 0 ? x + (e.random() - 0.5) * w * 0.3 : e.random() * w, p.source === "top" ? -4 : s[1]! + 4, 1, 0, nc, p.scale);
      }
      fx.step(dt);
      if (fx.live > 0 || s[3]! > 0 || p.loop > 0) e.busy();
    },
    // A tiny hook V8 inlines: the frame's alpha (a double) is never boxed to call it.
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for these params: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export const scene = (p: Spray) => (stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null) => spray(stage, p, first);
