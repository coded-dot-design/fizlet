// The fizz: an arcade soda can, side view and top-down view of the same moment. A tap crunches the
// can, the tab pops, and the fizz sprays up and out of the card. fizlet/camera moves inside the card
// only: in on the opening, across to the top view while it fizzes, then home.
// Bricks: the kernel (settle + fps cap), fizlet/fx (two pools: the spray on a layer above the card,
// the top view's fizz inside it; kinds as data), fizlet/sprite (spriteURL: each frame of both views
// becomes an image once, drawn crisp), fizlet/camera.
// Every node and style it adds goes through the engine's ledger, so Recall gives the page back.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter } from "../../../src/fx";
import { camera } from "../../../src/camera";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { CAN, TOP, C, H, T, W } from "./can";

export type FizzScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  /** Crunch it now (or again): the same as a tap on the can. */
  pop(): void;
};

// fx's ring part (id 2); the rest are kinds as data, in art pixels (scaled by K).
const RING = 2, UP = -Math.PI / 2, ROUND = Math.PI * 2;
const sq = "square" as const;
// fx colour indices: ink, cyan, green, pink-light, pink, muted.
const INK = 0, SYS = 1, AIM = 3;
const COLORS = [C.ink, C.sys, C.go, C.aim, C.attack, C.muted];

/** The scene. The spray flies over the slot's parent box (and up above the card, over the card's
 *  width only; it never takes a pointer). It crunches by itself after 0.8 s, or at once on a tap. */
export function fizz(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FizzScene {
  const Z = 1.8, host = slot.parentElement!;
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const L = engine.ledger;
  // Two pools: the spray flies over the card (and out of it); the top view's fizz stays inside.
  const fx = effects({ cap: 700, colors: COLORS, words: ["CRUNCH!", "PSSHH!"], scorch: 0 });
  const fxT = effects({ cap: 300, colors: COLORS, scorch: 0, gravity: 0 });
  const { ids: { geyser, burst }, emit } = emitter(fx, {
    geyser: { shape: sq, drag: 0.5, gravity: 1, angle: UP, spread: 0.55, speed: [110, 230], size: [0.75, 1.75], life: [0.9, 1.7] },
    burst: { shape: sq, drag: 1.2, gravity: 0.7, angle: UP, spread: 1.9, speed: [70, 260], size: [0.75, 2], life: [0.6, 1.4] },
  });
  const { ids: { pop }, emit: emitT } = emitter(fxT, { pop: { shape: sq, drag: 2, gravity: 0, angle: 0, spread: ROUND, speed: [8, 45], size: [1, 2], life: [0.35, 0.9] } });

  // The card: a world inside the slot stage (the camera moves it; the stage clips it) holding one
  // pixel canvas. The spray: a second pixel canvas over the host box, reaching up above the card.
  const world = L.add(document.createElement("div"));
  world.style.cssText = "position:absolute;inset:0";
  const canvas = document.createElement("canvas"), layer = L.add(document.createElement("canvas"));
  canvas.style.cssText = layer.style.cssText = "position:absolute;left:0;top:0;z-index:3;pointer-events:none;image-rendering:pixelated";
  layer.ariaHidden = "true";
  world.append(canvas);
  stage.append(world);
  if (getComputedStyle(host).position === "static") L.style(host, "position", "relative");
  host.append(layer);
  const ctx = canvas.getContext("2d")!, lx = layer.getContext("2d")!;
  const cam = camera(engine, world);

  // Layout in art pixels (P CSS px each). Side can at K art px per sprite pixel, top view at KT.
  // x0, y0: the side can's top left; mx, my: its opening; hx, hy: the opening in the top view.
  let P = 4, w = 0, h = 0, K = 1, KT = 1, cx = 0, by = 0, tx = 0, ty = 0, oy = 0, x0 = 0, y0 = 0, mx = 0, my = 0, hx = 0, hy = 0, resized = true;
  const ro = new ResizeObserver(() => ((resized = true), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect());

  // The story, in seconds since the crunch (t; -1: not yet; the pop is at 0.3). The drip: its row
  // down the side (dy; -1: none yet; 36: it has reached the floor).
  let st = -1, wait = first ? 0 : 0.8, sn = 0, snt = 0, frame = 0, dy = -1, dirty = true;
  const v = [0, 0]; // camera scratch, reused (no allocation per frame)

  // Each frame of both views, rasterised once into a bitmap at its pixel size (side: sealed, open,
  // crunched, crunched open), then scaled up crisp: no SVG work per frame.
  const img = (d: SpriteDef, f: number) => {
    const c = document.createElement("canvas"), i = new Image();
    i.onload = () => ((c.width = i.width), (c.height = i.height), c.getContext("2d")!.drawImage(i, 0, 0), (dirty = true), engine.wake());
    i.src = spriteURL(d, f);
    return c;
  };
  const side = [0, 1, 2, 3].map((f) => img(CAN, f)), down = [img(TOP, 0), img(TOP, 1)];
  const again = () => ((wait = 0), engine.wake());
  stage.addEventListener("pointerdown", (e) => e.isPrimary && again(), { signal: engine.signal });

  engine.add({
    read() {
      if (!resized) return;
      resized = false;
      const q = stage.getBoundingClientRect(), r = host.getBoundingClientRect();
      P = Math.min(4, Math.max(2, Math.round(q.height / 150)));
      canvas.style.width = (w = canvas.width = Math.ceil(q.width / P)) * P + "px";
      canvas.style.height = (h = canvas.height = Math.ceil(q.height / P)) * P + "px";
      // The spray layer, at full CSS resolution (crisp under the zoom): the card's width, from 70%
      // of the card's height above it down to its bottom. Its own edges clip the spray.
      const up = Math.round(q.height * 0.7);
      oy = q.top - r.top + up;
      layer.style.width = (layer.width = q.width) + "px";
      layer.style.height = (layer.height = oy + q.height) + "px";
      layer.style.top = -up + "px";
      layer.style.left = q.left - r.left + "px";
      K = Math.max(1, Math.min(Math.round((h * 0.6) / H), Math.floor((h * 0.8) / H), Math.floor((w * 0.5) / W)));
      KT = Math.max(1, Math.round(Math.min(w * 0.36, h * 0.6) / T));
      cx = Math.round(w * 0.3);
      by = Math.round(h * 0.86);
      tx = Math.round(w * 0.73);
      ty = Math.round(h * 0.47);
      x0 = cx - (W / 2) * K;
      y0 = by - H * K;
      mx = x0 + 11.5 * K; // the opening: can.ts MOUTH (11, 6) and HOLE (10.5, 5)
      my = y0 + 6 * K;
      hx = tx - 0.5 * KT;
      hy = ty - 6 * KT;
      fx.gravity = 160 * K;
      dirty = true;
    },
    step(e, dt) {
      if (wait >= 0 && (wait -= dt) < 0) {
        // Crunch: the can squeezes and dents, flakes fly; the tab pops 0.3 s later.
        st = 0;
        dy = -1;
        fx.word(mx - 10 * K, y0 + 18 * K, 0, AIM, 5 * K);
        emit(burst, x0 + 10 * K, y0 + 28 * K, 14, INK, 2, K * 0.4);
      }
      fx.step(dt);
      fxT.step(dt);
      if (st >= 0) {
        const t = (st += dt), p = t - 0.3, at = (x: number) => p - dt < x && p >= x;
        if (t >= 0.08) frame = p < 0 ? frame | 2 : 3;
        if (at(0)) {
          // Pop: a shock ring, the burst out of the top, the first gush in the top view.
          emit(burst, mx, my, 120, 0, 4, K);
          fx.spawn(RING, mx, my, 0, 0, 3 * K, 0.5, INK);
          fx.word(mx - 6 * K, my - 8 * K, 1, SYS, 5 * K);
          emitT(pop, hx, hy, 40, INK, 2, KT);
          cam.to(mx * P, my * P, Z); // in on the opening
        }
        if (at(1.4)) cam.to(hx * P, hy * P, Z); // across to the top view: a zoom about its opening
        if (at(3)) cam.home();
        if (at(0.9)) emit(burst, mx, my, 70, 0, 4, K); // a glug
        // The fizz: a geyser and bubbles off the side, pops and rings in the top view, easing off.
        if (p > 0 && p < 2.8) {
          const k = (1 - p / 2.8) ** 1.3;
          sn += dt * 190 * k;
          snt += dt * 80 * k;
          const n = Math.floor(sn), m = Math.floor(snt);
          emit(geyser, mx, my, n, 0, 2, K);
          emitT(pop, hx, hy, m, INK, 2, KT);
          sn -= n;
          snt -= m;
        }
        // The drip: stop-and-go down the shaded edge (column 17), then a splash on the floor.
        if (p > 0.6 && dy < 36 && (dy = Math.min(36, Math.max(10, dy) + dt * (4 + 14 * Math.abs(Math.sin(p * 3.1))))) === 36)
          emit(burst, x0 + 18.5 * K, by - 1, 6, INK, 2, K * 0.2);
        if (p > 4.2) st = -2; // the story is over: the last frame stays, the engine settles
      }
      if (wait >= 0 || st >= 0 || fx.live || fxT.live) (e.busy(), (dirty = true));
    },
    render() {
      if (!dirty) return;
      dirty = false;
      // The card: both views, the floor shadow, the drips, the top view's fizz.
      ctx.resetTransform();
      ctx.clearRect(0, 0, w, h);
      const c = st >= 0 && st < 0.3 ? Math.sin((st / 0.3) * Math.PI) * 0.12 : 0;
      ctx.fillStyle = C.base;
      ctx.fillRect(x0 - K, by, (W + 2) * K, K * 2);
      // Crunch: squash about the base for 0.3 s.
      ctx.setTransform(1 + c, 0, 0, 1 - c, -cx * c, by * c);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(side[frame]!, x0 - K, y0 - K, (W + 2) * K, (H + 2) * K);
      ctx.resetTransform();
      ctx.drawImage(down[frame & 1]!, tx - (T / 2 + 1) * KT, ty - (T / 2 + 1) * KT, (T + 2) * KT, (T + 2) * KT);
      if (dy > 0) {
        const x = x0 + 17 * K, y = Math.floor(dy);
        ctx.fillStyle = C.aim;
        ctx.fillRect(x, y0 + 10 * K, K, (y - 10) * K);
        ctx.fillStyle = C.ink;
        if (y < 36) ctx.fillRect(x, y0 + (y - 1) * K, K, K * 2);
        else ctx.fillRect(x, by, K * 3, K); // the puddle
      }
      fxT.draw(ctx);
      // The spray layer, under the camera's own transform, so the spray leaves the can where the
      // card shows it, and only ever flies up and out of the top.
      const z = cam.zoom;
      cam.toWorld(0, 0, v);
      lx.resetTransform();
      lx.clearRect(0, 0, layer.width, layer.height);
      lx.setTransform(z * P, 0, 0, z * P, -v[0]! * z, oy - v[1]! * z);
      fx.draw(lx);
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
