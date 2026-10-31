// The brick cards' shared frame: one canvas stage per card, the brick's own block drawn the Board UI
// way (flat role colour, rim, hard shadow), a floor, and a live readout of the engine's state.
// Every card is a fizlet/slot scene (`SlotMount`), so the bricks page, a brick's docs page, a note
// card or a gallery hero mounts it the same way and gets lazy load, reduced motion and Recall free.
// Each card supplies its own idea; this file is only the frame they share.
import { createEngine, type Engine } from "../../src/index";
import type { SlotTap } from "../../src/slot";

/** Drawing units: every card draws on a 320 × 200 stage, scaled to its slot. */
export const W = 320, H = 200, FLOOR = 178;
const RIM = "#07060f", FONT = "800 9px ui-monospace, Menlo, monospace";

export interface Card {
  e: Engine;
  ctx: CanvasRenderingContext2D;
  c: HTMLCanvasElement;
  /** The card's role colour (the brick's `--k-<role>`), its tag and measured gzip bytes (from the build). */
  tone: string;
  tag: string;
  bytes: number;
  /** "2.1 KB": the measured size, as the brick's label shows it. */
  kb: string;
  /** 1 on a light page (read in the system's `read`, never in a step). */
  theme: Uint8Array;
  /** 1 when the stage must be drawn again (mount, theme change, resize); a card's render clears it. */
  dirty: Uint8Array;
  /** [device px, CSS px] per drawing unit (the backing store matches the slot: lines and text stay sharp). */
  px: Float64Array;
  /** The slot's stage, for a card that adds DOM of its own (camera, timeline, hud). */
  stage: HTMLElement;
}
export interface CardScene {
  /** A press at (x, y) in drawing units (also the slot's first tap). */
  tap(x: number, y: number): void;
  /** The pointer over the stage (drawing units), or x = -1 when it leaves. Optional. */
  hover?(x: number, y: number): void;
  /** What the readout says on the left (called twice a second, outside the loop). */
  read(): string;
}

const light = () => document.documentElement.dataset.theme === "light";
export const ink = (t: Uint8Array) => (t[0] ? "#14121f" : "#e9e6ff");
export const faint = (t: Uint8Array) => (t[0] ? "rgba(20,18,31,.14)" : "rgba(233,230,255,.12)");

/**
 * Mount a card into the slot's stage. `make` builds the scene on the frame (it adds its own systems
 * to `card.e`); the frame owns the canvas, the pointer, the readout and the engine's lifetime.
 */
export function mountCard(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, make: (card: Card) => CardScene) {
  const c = document.createElement("canvas");
  c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:manipulation;cursor:pointer";
  stage.append(c);
  const ctx = c.getContext("2d")!;
  // The backing store is the slot's size in device pixels (not 320 × 200 stretched): sharp at any
  // width and any DPR. Re-sized (outside the loop) when the slot changes size.
  const px = new Float64Array(2); // device px per unit, CSS px per unit
  const size = () => {
    px[1] = Math.max(1, stage.clientWidth || W) / W;
    px[0] = px[1] * Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(W * px[0]);
    c.height = Math.round(H * px[0]);
    ctx.setTransform(px[0], 0, 0, px[0], 0, 0);
  };
  size();
  const tone = getComputedStyle(slot).getPropertyValue("--tone").trim() || "#39ffb0";
  const bytes = Number(slot.dataset.bytes) || 0;
  const e = createEngine({ root: c, settle: 0.6, pause: { reducedMotion: true } });
  const theme = new Uint8Array(1);
  theme[0] = light() ? 1 : 0;
  e.add({ read() { theme[0] = light() ? 1 : 0; } });
  const dirty = new Uint8Array([1]);
  const card: Card = { e, ctx, c, tone, tag: slot.dataset.tag ?? "", bytes, kb: `${(bytes / 1024).toFixed(1)} KB`, theme, dirty, px, stage };
  const ro = new ResizeObserver(() => (size(), (dirty[0] = 1), e.wake()));
  ro.observe(stage);
  e.signal.addEventListener("abort", () => ro.disconnect());
  // The page's theme key flips data-theme: draw once more in the new colours, then sleep again.
  const mo = new MutationObserver(() => ((dirty[0] = 1), e.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  e.signal.addEventListener("abort", () => mo.disconnect());
  const scene = make(card);

  // The readout: the card's own number on the left, the engine's state on the right (AWAKE n fps,
  // or ASLEEP once it settles: the frame count stops, which is the point).
  const out = document.createElement("p");
  out.className = "bc-read";
  out.setAttribute("aria-hidden", "true");
  out.innerHTML = "<span></span><b></b>";
  stage.append(out);
  const [left, right] = out.children as unknown as [HTMLElement, HTMLElement];
  let last = 0;
  const put = () => {
    const s = e.stats(), f = s.frames - last;
    last = s.frames;
    const state = e.running ? `AWAKE · ${f * 2} FPS` : s.paused.includes("offscreen") ? "OFF SCREEN · 0 FPS" : "ASLEEP · 0 FPS";
    const l = scene.read();
    if (left.textContent !== l) left.textContent = l;
    if (right.textContent !== state) right.textContent = state, out.classList.toggle("on", e.running);
  };
  const id = setInterval(put, 500);
  e.signal.addEventListener("abort", () => clearInterval(id));

  const p = new Float64Array(2);
  const at = (ev: PointerEvent) => {
    const r = c.getBoundingClientRect(); // one read per event, outside the loop
    p[0] = ((ev.clientX - r.left) * W) / r.width;
    p[1] = ((ev.clientY - r.top) * H) / r.height;
  };
  const kick = () => (e.running ? e.busy() : e.wake());
  c.addEventListener("pointerdown", (ev) => (at(ev), scene.tap(p[0]!, p[1]!), kick(), put()), { signal: e.signal });
  if (scene.hover) {
    c.addEventListener("pointermove", (ev) => (at(ev), scene.hover!(p[0]!, p[1]!), kick()), { signal: e.signal });
    c.addEventListener("pointerleave", () => scene.hover!(-1, -1), { signal: e.signal });
  }
  e.start();
  if (first) {
    const r = slot.getBoundingClientRect();
    scene.tap((first.x * W) / r.width, (first.y * H) / r.height);
    kick();
  }
  put();
  // `engine` and `tap` are for the allocation test (frames by hand) and a host that drives a card.
  return { destroy: () => e.destroy(), engine: e, tap: scene.tap };
}

/**
 * A Board UI kit layer over the canvas (pad, ui): a `.bui` root the size of the stage, its `--u`
 * scaled so the kit's controls keep their proportions in any card (`units` kit px = the card's
 * height; 400 puts a 128 px stick at a third of it), its theme following the page's. The wrapper
 * lets pointer events through; the kit's own controls take them. The page brings board-ui.css.
 */
export function kit(card: Card, units = 400) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:absolute;inset:0;container-type:size;pointer-events:none";
  const root = document.createElement("div");
  root.className = "bui";
  root.style.cssText = `position:absolute;inset:0;--u:calc(100cqh / ${units})`;
  const theme = () => (root.dataset.theme = light() ? "light" : "dark");
  theme();
  wrap.append(root);
  card.stage.insertBefore(wrap, card.c.nextSibling);
  const mo = new MutationObserver(theme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  card.e.signal.addEventListener("abort", () => mo.disconnect());
  return root;
}

/** The floor line and the faint grid every card stands on. */
export function ground(card: Card) {
  const { ctx, theme } = card;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = faint(theme);
  ctx.fillRect(0, FLOOR, W, 2);
}

/**
 * A brick, the Board UI way: flat face in `color`, 2px rim, a hard shadow under it (`lift` raises the
 * face off its base, `squash` flattens it on landing, 0..1). `label` is drawn on the face.
 */
export function brick(card: Card, x: number, y: number, w: number, h: number, color: string, label: string, squash = 0, lift = 3) {
  const { ctx } = card;
  if (squash === 0) {
    // A still brick sits on whole device pixels: crisp edges, crisp label.
    const k = card.px[0]!;
    x = Math.round(x * k) / k;
    y = Math.round(y * k) / k;
  }
  const sw = w * (1 + squash * 0.18), sh = h * (1 - squash * 0.28), sx = x - (sw - w) / 2, sy = y + (h - sh);
  ctx.fillStyle = RIM;
  ctx.fillRect(sx - 2, sy - 2 + lift, sw + 4, sh + 4);
  ctx.fillStyle = color;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(sx, sy, sw, 2);
  if (label && sh > 9) {
    ctx.fillStyle = RIM;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Snapped to whole device pixels: text on a half pixel is blurred across two.
    const k = card.px[0]!;
    ctx.fillText(label, Math.round((sx + sw / 2) * k) / k, Math.round((sy + sh / 2) * k) / k);
  }
}
