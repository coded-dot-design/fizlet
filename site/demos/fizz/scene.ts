// The fizz: an arcade soda can, side view and top-down view of the same moment, held still (two
// cameras, no zoom: the eye cuts between them). A tap crunches the can; the tab lifts and the lid
// pops; foam swells in the opening; then the fizz erupts up and out of the card: droplets, bubbles
// that swell and pop, foam, rings and flecks, in every size.
// Bricks: the kernel (settle + fps cap), fizlet/fx (two pools: the spray on a layer above the card,
// the top view's fizz inside it; kinds as data), fizlet/sprite (spriteURL: each frame of both views
// becomes an image once, drawn crisp at device pixels).
// Every node and style it adds goes through the engine's ledger, so Recall gives the page back.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter } from "../../../src/fx";
import { spriteURL, type SpriteDef } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { CAN, TOP, C, H, T, W, MOUTH, HOLE } from "./can";

export type FizzScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  /** Crunch it now (or again): the same as a tap on the can. */
  pop(): void;
};

// fx's ring part (id 2); the rest are kinds as data, in can units (scaled by S: the can is 40 S tall).
const RING = 2, UP = -Math.PI / 2, ROUND = Math.PI * 2;
// fx colour indices: ink, cyan, green, pink-light, pink, muted.
const INK = 0, SYS = 1, AIM = 3;
const COLORS = [C.ink, C.sys, C.go, C.aim, C.attack, C.muted];

/** The scene. The spray flies over the slot's parent box (and up above the card, over the card's
 *  width only; it never takes a pointer). It crunches by itself after 0.8 s, or at once on a tap. */
export function fizz(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FizzScene {
  const host = slot.parentElement!;
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const L = engine.ledger;
  // Two pools: the spray flies over the card (and out of it); the top view's fizz stays inside.
  const fx = effects({ cap: 900, colors: COLORS, words: ["CRUNCH!", "PSSHH!"], scorch: 0 });
  const fxT = effects({ cap: 360, colors: COLORS, scorch: 0, gravity: 0 });
  const { ids: { drop, bubble, foam, seal, ring, fleck }, emit } = emitter(fx, {
    drop: { shape: "streak", drag: 0.45, gravity: 1, angle: UP, spread: 0.5, speed: [120, 240], size: [0.35, 1.1], life: [0.9, 1.7] },
    bubble: { shape: "frame", drag: 1.4, gravity: -0.2, angle: UP, spread: 1.3, speed: [40, 150], size: [0.3, 1.1], life: [0.4, 1] },
    foam: { shape: "square", drag: 3, gravity: -0.1, angle: UP, spread: 2.2, speed: [8, 55], size: [0.8, 2.4], life: [0.4, 1.1] },
    seal: { shape: "square", drag: 2.2, gravity: 0.3, angle: UP, spread: 3.4, speed: [90, 220], size: [0.25, 0.6], life: [0.2, 0.45] },
    ring: { shape: "ring", drag: 1.8, gravity: -0.1, angle: UP, spread: 1.6, speed: [30, 140], size: [0.4, 1.4], life: [0.25, 0.6] },
    fleck: { shape: "square", drag: 1, gravity: 0.8, angle: UP, spread: 1.9, speed: [70, 260], size: [0.25, 0.9], life: [0.5, 1.2] },
  });
  const { ids: { tpop, tbub, tring }, emit: emitT } = emitter(fxT, {
    tpop: { shape: "square", drag: 2, gravity: 0, angle: 0, spread: ROUND, speed: [8, 45], size: [0.3, 1], life: [0.35, 0.9] },
    tbub: { shape: "frame", drag: 2.4, gravity: 0, angle: 0, spread: ROUND, speed: [4, 30], size: [0.3, 1.3], life: [0.4, 1] },
    tring: { shape: "ring", drag: 2, gravity: 0, angle: 0, spread: ROUND, speed: [6, 26], size: [0.4, 1], life: [0.3, 0.7] },
  });

  // The card: one canvas in the slot stage. The spray: a second canvas over the host box, reaching
  // up above the card. Both on one pixel grid (P CSS px per art pixel), so the spray is pixels too.
  const canvas = L.add(document.createElement("canvas")), layer = L.add(document.createElement("canvas"));
  canvas.style.cssText = layer.style.cssText = "position:absolute;left:0;top:0;z-index:3;pointer-events:none;image-rendering:pixelated";
  layer.ariaHidden = "true";
  stage.append(canvas);
  if (getComputedStyle(host).position === "static") L.style(host, "position", "relative");
  host.append(layer);
  const ctx = canvas.getContext("2d")!, lx = layer.getContext("2d")!;

  // Layout in art pixels. Side can at K per sprite pixel, top view at KT; S, ST: the same in can
  // units (particle speeds and sizes). x0, y0: the side can's top left; mx, my: its opening; hx, hy:
  // the opening in the top view; oy: the spray layer's headroom above the card.
  let P = 2, w = 0, h = 0, K = 1, KT = 1, S = 2, ST = 2, cx = 0, by = 0, tx = 0, ty = 0, oy = 0, x0 = 0, y0 = 0, mx = 0, my = 0, hx = 0, hy = 0, resized = true;
  const ro = new ResizeObserver(() => ((resized = true), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect());

  // The story, in seconds since the crunch (t; -1: not yet). The tab lifts at 0.45 and the lid pops
  // at 0.6; foam swells; the fizz erupts at 1. The drip: its row down the side (dy; -1: none; 72: the floor).
  let st = -1, wait = first ? 0 : 0.8, sn = 0, snt = 0, tab = 0, dent = 0, dy = -1, dirty = true;

  // Each frame of both views, rasterised once into a bitmap at its pixel size, then scaled up crisp:
  // no SVG work per frame.
  const img = (d: SpriteDef, f: number) => {
    const c = document.createElement("canvas"), i = new Image();
    i.onload = () => ((c.width = i.width), (c.height = i.height), c.getContext("2d")!.drawImage(i, 0, 0), (dirty = true), engine.wake());
    i.src = spriteURL(d, f);
    return c;
  };
  const side = [0, 1, 2, 3, 4, 5].map((f) => img(CAN, f)), down = [0, 1, 2].map((f) => img(TOP, f));
  const again = () => ((wait = 0), engine.wake());
  stage.addEventListener("pointerdown", (e) => e.isPrimary && again(), { signal: engine.signal });

  engine.add({
    read() {
      if (!resized) return;
      resized = false;
      const q = stage.getBoundingClientRect(), r = host.getBoundingClientRect();
      P = Math.max(1, Math.round(q.height / 200));
      canvas.style.width = (w = canvas.width = Math.ceil(q.width / P)) * P + "px";
      canvas.style.height = (h = canvas.height = Math.ceil(q.height / P)) * P + "px";
      // The spray layer: the card's width, from 70% of the card's height above it down to its bottom.
      const up = Math.round(q.height * 0.7);
      oy = Math.round(up / P);
      layer.style.width = w * P + "px";
      layer.style.height = (layer.height = oy + h) * P + "px";
      layer.width = w;
      layer.style.top = q.top - r.top - oy * P + "px";
      layer.style.left = q.left - r.left + "px";
      K = Math.max(1, Math.min(Math.round((h * 0.62) / H), Math.floor((h * 0.8) / H), Math.floor((w * 0.48) / W)));
      KT = Math.max(1, Math.round(Math.min(w * 0.36, h * 0.6) / T));
      S = 2 * K;
      ST = 2 * KT;
      cx = Math.round(w * 0.3);
      by = Math.round(h * 0.86);
      tx = Math.round(w * 0.73);
      ty = Math.round(h * 0.47);
      x0 = cx - (W / 2) * K;
      y0 = by - H * K;
      mx = x0 + MOUTH.x * K;
      my = y0 + MOUTH.y * K;
      hx = tx + (HOLE.x - T / 2) * KT;
      hy = ty + (HOLE.y - T / 2) * KT;
      fx.gravity = 160 * S;
      dirty = true;
    },
    step(e, dt) {
      if (wait >= 0 && (wait -= dt) < 0) {
        // Crunch: the can squeezes and dents, flecks fly; the tab, the pop and the fizz follow.
        st = 0;
        dy = -1;
        tab = dent = 0;
        fx.word(mx - 10 * S, y0 + 18 * S, 0, AIM, 5 * S);
        emit(fleck, x0 + 20 * K, y0 + 56 * K, 16, INK, 2, S);
      }
      fx.step(dt);
      fxT.step(dt);
      if (st >= 0) {
        const t = (st += dt), at = (x: number) => t - dt < x && t >= x;
        if (t >= 0.08) dent = 3;
        // The tab lifts (a hiss of tiny bubbles), then stands up: the lid pops.
        if (at(0.45)) (tab = 1), emit(bubble, mx, my, 6, INK, 2, S * 0.4), emitT(tbub, hx, hy, 5, INK, 2, ST * 0.5);
        if (at(0.6)) {
          tab = 2;
          fx.spawn(RING, mx, my, 0, 0, 3 * S, 0.5, INK);
          emit(seal, mx - 4 * K, my, 18, INK, 2, S); // the seal breaks: a fan of flecks off the lid
          fx.word(mx - 6 * S, my - 8 * S, 1, SYS, 5 * S);
          emit(foam, mx, my, 14, INK, 1, S);
          emitT(tring, hx, hy, 6, SYS, 1, ST);
        }
        // Foam swells in the opening, then the fizz erupts: every kind, every size.
        if (t > 0.6 && t < 1) (sn += dt * 40), emit(foam, mx, my, Math.floor(sn), INK, 1, S * 0.8), emitT(tbub, hx, hy, Math.floor(sn), INK, 1, ST), (sn %= 1);
        if (at(1)) {
          emit(drop, mx, my, 70, INK, 2, S);
          emit(bubble, mx, my, 60, INK, 2, S);
          emit(ring, mx, my, 24, INK, 2, S);
          emit(fleck, mx, my, 40, INK, 2, S);
          emit(foam, mx, my, 20, INK, 1, S);
          emitT(tpop, hx, hy, 40, INK, 2, ST);
          emitT(tring, hx, hy, 10, SYS, 1, ST);
        }
        if (at(1.8)) emit(bubble, mx, my, 40, INK, 2, S), emit(drop, mx, my, 30, INK, 2, S); // a glug
        if (t > 1 && t < 3.8) {
          const k = (1 - (t - 1) / 2.8) ** 1.3;
          sn += dt * 200 * k;
          snt += dt * 90 * k;
          const n = Math.floor(sn), m = Math.floor(snt), third = Math.ceil(n / 3);
          emit(drop, mx, my, third, INK, 2, S);
          emit(bubble, mx, my, third, INK, 2, S);
          emit(n % 4 ? fleck : ring, mx, my, n - 2 * third, INK, 2, S);
          emitT(m % 3 ? tpop : tbub, hx, hy, m, INK, 2, ST);
          sn -= n;
          snt -= m;
        }
        // The drip: stop-and-go down the shaded edge (column 35), then a splash on the floor.
        if (t > 1.4 && dy < 72 && (dy = Math.min(72, Math.max(22, dy) + dt * (8 + 28 * Math.abs(Math.sin(t * 3.1))))) === 72)
          emit(fleck, x0 + 36 * K, by - 1, 8, INK, 2, S * 0.3);
        if (t > 5.2) st = -2; // the story is over: the last frame stays, the engine settles
      }
      if (wait >= 0 || st >= 0 || fx.live || fxT.live) (e.busy(), (dirty = true));
    },
    render() {
      if (!dirty) return;
      dirty = false;
      // The card: both views, the floor shadow, the drip, the top view's fizz.
      ctx.resetTransform();
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      // Crunch: squash about the base for 0.3 s. Pop: the can kicks up for 0.15 s as the lid gives.
      const c = st >= 0 && st < 0.3 ? Math.sin((st / 0.3) * Math.PI) * 0.12 : st >= 0.6 && st < 0.75 ? -Math.sin(((st - 0.6) / 0.15) * Math.PI) * 0.06 : 0;
      ctx.fillStyle = C.base;
      ctx.fillRect(x0 - 2 * K, by, (W + 4) * K, K * 3);
      ctx.setTransform(1 + c, 0, 0, 1 - c, -cx * c, by * c);
      ctx.drawImage(side[tab + dent]!, x0 - K, y0 - K, (W + 2) * K, (H + 2) * K);
      ctx.resetTransform();
      ctx.drawImage(down[tab]!, tx - (T / 2 + 1) * KT, ty - (T / 2 + 1) * KT, (T + 2) * KT, (T + 2) * KT);
      if (dy > 0) {
        const x = x0 + 35 * K, y = Math.floor(dy);
        ctx.fillStyle = C.aim;
        ctx.fillRect(x, y0 + 20 * K, 2 * K, (y - 20) * K);
        ctx.fillStyle = C.ink;
        if (y < 72) ctx.fillRect(x, y0 + (y - 2) * K, 2 * K, K * 3);
        else ctx.fillRect(x - K, by, K * 6, K * 2); // the puddle
      }
      fxT.draw(ctx);
      // The spray layer: the card's pixels, shifted down by the headroom above the card.
      lx.resetTransform();
      lx.clearRect(0, 0, layer.width, layer.height);
      lx.setTransform(1, 0, 0, 1, 0, oy);
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
