// The fizz: an arcade soda can that pops, sprays and drips while the page itself zooms in on it.
// Mounted through fizlet/slot. Bricks: the kernel (settle + fps cap), fizlet/fx (gravity and named
// kinds: spray, bubbles, splash; pop words), fizlet/sprite (the can), fizlet/camera (the page is the
// camera: one eased transform on a host element, through the ledger, so Recall gives it back).
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter, KINDS, type Kind } from "../../../src/fx";
import { camera } from "../../../src/camera";
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

// The blast's ring part (fx ids 0-5); the other kinds are data, in art pixels (scaled by K).
const RING = 2, UP = -Math.PI / 2;
const KIND = {
  bubble: KINDS.bubble,
  spray: { shape: "square" as const, drag: 1.4, gravity: 0.4, angle: UP, spread: 1.3, speed: [40, 130], size: [0.75, 2.25], life: [0.6, 1.3] },
  splash: { shape: "square" as const, drag: 1.4, gravity: 1, angle: UP, spread: 2.4, speed: [15, 40], size: [1, 1], life: [0.35, 0.5] },
} satisfies Record<string, Kind>;
// fx colour indices.
const INK = 0, SYS = 1, AIM = 3;

export function fizz(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, o: FizzOptions = {}): FizzScene {
  const zoomEl = o.zoom === undefined ? slot.closest<HTMLElement>("[data-fizz-zoom]") : o.zoom;
  const Z = o.scale ?? 1.5, delay = o.delay ?? 0.7, fx0 = o.x ?? 0.5;
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const fx = effects({ cap: 260, colors: [C.ink, C.sys, C.go, C.aim, C.attack], words: ["PSST!", "FIZZ"], scorch: 0 });
  const { ids, emit } = emitter(fx, KIND);
  const cam = zoomEl && camera(engine, zoomEl, { ease: 5 });
  const art = sprites({ can: CAN });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;

  // Layout in art pixels (P CSS px each); the can is drawn at K art px per sprite pixel.
  let P = 4, w = 0, h = 0, K = 1, g = 200, cx = 0, by = 0, resized = true, sw = stage.clientWidth, sh = stage.clientHeight;
  const ro = new ResizeObserver((l) => {
    const b = l[0]!.contentRect;
    if (b.width !== sw || b.height !== sh) (sw = b.width), (sh = b.height), (resized = true), engine.wake();
  });
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  // The story, in seconds. t: time since the pop (-1: sealed). Drips: column, start, end row, row now.
  const s = { t: -1, wait: first ? 0 : delay, bubbles: 0, ox: 0, oy: 0, dirty: true, origin: false };
  const drips = [
    { col: 16, at: 0.35, end: 36, y: -1, fall: -1, puddle: false },
    { col: 3, at: 1.2, end: 24, y: -1, fall: -1, puddle: false },
  ];
  const left = () => cx - (W / 2) * K, top = () => by - H * K;
  const mouthX = () => left() + (MOUTH.x + 0.5) * K, mouthY = () => top() + MOUTH.y * K;

  function pop() {
    s.t = 0;
    s.bubbles = 0;
    s.origin = true; // the read phase zooms in on the opening
    for (const d of drips) (d.y = -1), (d.fall = -1), (d.puddle = false);
    const x = mouthX(), y = mouthY();
    emit(ids.spray, x, y, 44, 0, 4, K);
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
        fx.gravity = g = 200 * K;
        s.dirty = true;
      }
      if (s.origin && cam) {
        s.origin = false;
        // Measure the opening while the page is at rest (mid-zoom, the last origin still holds).
        if (cam.zoom === 1 && !cam.moving) {
          const r = zoomEl!.getBoundingClientRect(), q = stage.getBoundingClientRect();
          s.ox = q.left - r.left + mouthX() * P;
          s.oy = q.top - r.top + mouthY() * P;
        }
        cam.zoomAt(s.ox, s.oy, Z);
      }
    },
    step(e, dt) {
      if (s.wait >= 0 && (s.wait -= dt) < 0) pop();
      fx.step(dt);
      if (s.t >= 0) {
        const t = (s.t += dt);
        // The page zooms in on the opening (read phase), holds through the fizz, then is given back.
        if (t - dt < 3.1 && t >= 3.1) cam?.home();
        // Fizz: bubbles rise off the opening, fast at first, then fewer.
        if (t < 2.8) {
          s.bubbles += dt * 70 * (1 - t / 2.8) ** 1.5;
          const n = Math.floor(s.bubbles);
          emit(ids.bubble, mouthX(), mouthY(), n, INK, 2, K);
          s.bubbles -= n;
        }
        if (t - dt < 0.6 && t >= 0.6) fx.word(mouthX() + 8 * K, mouthY() - 4 * K, 1, SYS, 6 * K);
        // Drips: stop-and-go down the side, then off the base and onto the floor.
        for (const d of drips) {
          if (t < d.at) continue;
          if (d.y < 0) d.y = 10;
          if (d.y < d.end) d.y = Math.min(d.end, d.y + dt * (2 + 9 * Math.abs(Math.sin((t - d.at) * 3.1 + d.col))));
          else if (d.end >= 36 && d.fall < 0) d.fall = t;
          // Off the base it falls under the pool's gravity, then splashes on the floor.
          if (d.fall >= 0 && !d.puddle && top() + 37 * K + 0.5 * g * (t - d.fall) ** 2 >= by)
            (d.puddle = true), emit(ids.splash, left() + (d.col + 1.5) * K, by - 1, 6, INK, 2, K);
        }
        if (t > 4) s.t = -2; // the story is over: the last frame stays, the engine settles
      }
      if (s.wait >= 0 || s.t >= 0 || fx.live || fx.shake) (e.busy(), (s.dirty = true));
    },
    render() {
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
        else if (!d.puddle) ctx.fillRect(x + K, Math.round(y0 + 37 * K + 0.5 * g * (s.t - d.fall) ** 2), K, K * 2);
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
