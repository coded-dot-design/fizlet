// The fizz: an arcade soda can that pops, sprays and drips while the page itself zooms in on it.
// Mounted through fizlet/slot. Bricks: the kernel (settle + fps cap), fizlet/fx (spray, bubbles,
// splat, pop words), fizlet/sprite (the can). There is no camera brick: the "camera" is one
// transform on a host element, written through the engine's ledger so Recall gives it back.
import { createEngine } from "../../../src/kernel/index";
import { effects } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { CAN, C, H, MOUTH, W } from "./can";

export interface FizzOptions {
  /** The element that zooms (the page). Default: the slot's closest `[data-fizz-zoom]`; none, no zoom.
   *  Its parent should clip (`overflow: clip`) so the zoom never scrolls the page sideways. */
  zoom?: HTMLElement | null;
  /** How far the page zooms in (default 1.5). */
  scale?: number;
  /** Seconds before the tab pops by itself (default 0.7). A tap pops it at once. */
  delay?: number;
  /** Where the can stands, as a fraction of the stage width (default 0.5). */
  x?: number;
}
export type FizzScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  /** Pop the tab now (or crack it again): the same as a tap on the can. */
  pop(): void;
};

// fx particle kinds (fizlet/fx does not export them yet).
const DEBRIS = 0, RING = 2;
// fx colour indices.
const INK = 0, SYS = 1, GO = 2, AIM = 3;

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export function fizz(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, o: FizzOptions = {}): FizzScene {
  const zoomEl = o.zoom === undefined ? slot.closest<HTMLElement>("[data-fizz-zoom]") : o.zoom;
  const Z = o.scale ?? 1.5, delay = o.delay ?? 0.7, fx0 = o.x ?? 0.5;
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const fx = effects({ cap: 260, colors: [C.ink, C.sys, C.go, C.aim, C.attack], words: ["PSST!", "FIZZ"], scorch: 0 });
  const art = sprites({ can: CAN });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // Layout in art pixels (P CSS px each); the can is drawn at K art px per sprite pixel.
  let P = 4, w = 0, h = 0, K = 1, cx = 0, by = 0, resized = true, sw = stage.clientWidth, sh = stage.clientHeight;
  const ro = new ResizeObserver((l) => {
    const b = l[0]!.contentRect;
    if (b.width !== sw || b.height !== sh) (sw = b.width), (sh = b.height), (resized = true), engine.wake();
  });
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  // The story, in seconds. t: time since the pop (-1: sealed). Drips: column, start, end row, row now.
  const s = { t: -1, wait: first ? 0 : delay, bubbles: 0, ox: 0, oy: 0, z: 1, dirty: true, origin: false };
  const drips = [
    { col: 16, at: 0.35, end: 36, y: -1, fall: -1, v: 0, puddle: false },
    { col: 3, at: 1.2, end: 24, y: -1, fall: -1, v: 0, puddle: false },
  ];
  const left = () => cx - (W / 2) * K, top = () => by - H * K;
  const mouthX = () => left() + (MOUTH.x + 0.5) * K, mouthY = () => top() + MOUTH.y * K;

  function pop() {
    s.t = 0;
    s.bubbles = 0;
    s.origin = s.z === 1; // read the zoom origin once, while the page is at rest
    for (const d of drips) (d.y = -1), (d.fall = -1), (d.puddle = false);
    const x = mouthX(), y = mouthY();
    for (let i = 0; i < 44; i++) {
      const a = -Math.PI / 2 + (engine.random() - 0.5) * 1.3, v = K * (40 + engine.random() * 90);
      fx.spawn(DEBRIS, x, y, Math.cos(a) * v, Math.sin(a) * v, K * (1 + (i % 3)) * 0.75, 0.6 + engine.random() * 0.7, i % 4);
    }
    fx.spawn(RING, x, y, 0, 0, 2 * K, 0.45, INK);
    fx.word(x - 8 * K, y - 6 * K, 0, AIM, 6 * K);
    fx.kick(6);
    engine.wake();
  }

  const again = () => ((s.wait = 0), engine.wake());
  stage.addEventListener("pointerdown", (e) => e.isPrimary && again(), { signal: engine.signal });

  engine.add({
    read() {
      if (resized) {
        resized = false;
        P = Math.min(4, Math.max(2, Math.round(sh / 150)));
        canvas.width = w = Math.ceil(sw / P);
        canvas.height = h = Math.ceil(sh / P);
        canvas.style.width = w * P + "px";
        canvas.style.height = h * P + "px";
        K = Math.max(1, Math.min(Math.round((h * 0.6) / H), Math.floor((h * 0.8) / H)));
        cx = Math.round(w * fx0);
        by = Math.round(h * 0.86);
        s.dirty = true;
      }
      if (s.origin && zoomEl) {
        s.origin = false;
        const r = zoomEl.getBoundingClientRect(), q = stage.getBoundingClientRect();
        s.ox = Math.round(q.left - r.left + mouthX() * P);
        s.oy = Math.round(q.top - r.top + mouthY() * P);
      }
    },
    step(e, dt) {
      if (s.wait >= 0 && (s.wait -= dt) < 0) pop();
      fx.step(dt);
      if (s.t >= 0) {
        const t = (s.t += dt);
        // Fizz: bubbles rise off the opening, fast at first, then fewer.
        if (t < 2.8) {
          s.bubbles += dt * 70 * (1 - t / 2.8) ** 1.5;
          for (; s.bubbles >= 1; s.bubbles--) {
            const x = mouthX() + (e.random() - 0.5) * 3 * K;
            fx.spawn(DEBRIS, x, mouthY(), (e.random() - 0.5) * 16 * K, -K * (25 + e.random() * 50), K * (e.random() < 0.25 ? 1.5 : 1), 0.7 + e.random() * 0.9, e.random() < 0.7 ? INK : SYS);
          }
        }
        if (t - dt < 0.6 && t >= 0.6) fx.word(mouthX() + 8 * K, mouthY() - 4 * K, 1, SYS, 6 * K);
        // Drips: stop-and-go down the side, then off the base and onto the floor.
        for (const d of drips) {
          if (t < d.at) continue;
          if (d.y < 0) d.y = 10;
          if (d.y < d.end) d.y = Math.min(d.end, d.y + dt * (2 + 9 * Math.abs(Math.sin((t - d.at) * 3.1 + d.col))));
          else if (d.end >= 36 && d.fall < 0) (d.fall = 0), (d.v = 0);
          if (d.fall >= 0 && !d.puddle) {
            d.v += 200 * K * dt;
            d.fall += d.v * dt;
            if (top() + 37 * K + d.fall >= by) {
              d.puddle = true;
              const x = left() + (d.col + 1.5) * K;
              for (let i = 0; i < 6; i++) fx.spawn(DEBRIS, x, by - 1, (i - 2.5) * 12 * K, -K * (15 + e.random() * 15), K, 0.4, i % 2 ? SYS : INK);
            }
          }
        }
        // The page zooms in on the opening, holds through the fizz, then gives the page back.
        s.z = t < 0.9 ? 1 + (Z - 1) * ease(t / 0.9) : t < 3.1 ? Z : 1 + (Z - 1) * (1 - ease((t - 3.1) / 0.9));
        if (t > 4) s.t = -2, s.z = 1; // the story is over: the last frame stays, the engine settles
      }
      if (s.wait >= 0 || s.t >= 0 || fx.live || fx.shake) (e.busy(), (s.dirty = true));
    },
    render() {
      if (zoomEl) {
        const L = engine.ledger, on = s.z !== 1;
        L.style(zoomEl, "transform-origin", on ? `${s.ox}px ${s.oy}px` : "");
        L.style(zoomEl, "transform", on ? `scale(${s.z.toFixed(4)})` : "");
        L.style(zoomEl, "will-change", on ? "transform" : "");
      }
      if (!s.dirty) return;
      s.dirty = false;
      const k = fx.shake ? Math.round(fx.shake / 5) * (engine.steps % 4 < 2 ? 1 : -1) : 0;
      ctx.setTransform(1, 0, 0, 1, k, 0);
      ctx.clearRect(-8, 0, w + 16, h);
      const x0 = left(), y0 = top();
      // A hard shadow straight below, then the can.
      ctx.fillStyle = C.base;
      ctx.fillRect(x0 - K, by, (W + 2) * K, K * 2);
      art.draw(ctx, "can", s.t === -1 ? 0 : 1, cx, by, 0, K);
      for (const d of drips) {
        if (d.y < 0) continue;
        const x = x0 + d.col * K;
        ctx.fillStyle = C.aim;
        ctx.fillRect(x, y0 + 10 * K, K, (Math.floor(d.y) - 10) * K);
        ctx.fillStyle = C.ink;
        if (d.fall < 0) ctx.fillRect(x, y0 + (Math.floor(d.y) - 1) * K, K, K * 2);
        else if (!d.puddle) ctx.fillRect(x + K, Math.round(y0 + 37 * K + d.fall), K, K * 2);
        else ctx.fillRect(x, by, K * 3, K), (ctx.fillStyle = C.sys), ctx.fillRect(x + K, by, K, K);
      }
      fx.draw(ctx);
    },
  });
  engine.start();

  return {
    engine,
    pop: again,
    destroy: () => engine.destroy(),
  };
}

/** For `slot(target, () => import("./scene").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => fizz(stage, slot, first);
