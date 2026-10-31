// Haunted Page: a pixel ghost drifts over the page's own headings, and every heading it passes
// shivers. Point at it and it comes to you; tap and it swoops there, BOO!, and every heading on the
// page shudders. When it has haunted enough it fades away and the scene sleeps.
// A page scene: it reads the slot's real headings through fzlt/board-page (targets only,
// re-measured only after a scroll, resize or change: a frame reads no layout) and writes to them
// only through the engine's ledger: one data attribute per heading, styled by one sheet the ledger
// adds, so Recall gives the page back byte for byte. The ghost is fzlt/sprite pixels (spriteURL:
// each frame becomes a bitmap once) on a pixel canvas that lets the pointer through to the page.
// Bricks: the kernel, fzlt/board-page, fzlt/sprite (the ghost and its BOO!).
import { createEngine } from "../../../src/kernel/index";
import { boardPage } from "../../../src/board-page";
import { spriteURL } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import type { HeroParams } from "./hero";
import { BOO, GHOST, PAL } from "./art";
import { aspect, mark } from "../../gallery/aspect";

const ATTR = "data-fizlet-lit", HEADINGS = "h1,h2,h3,h4,h5,h6,[data-fizlet-heading]", M = 32, TRAIL = 5;
// Its layout per stage aspect (wide, square, tall: ../../gallery/aspect): art rows the stage is tall
// (fewer: a bigger ghost), then its figure of eight: x reach, x speed, y reach, y speed. Wide, it
// sweeps side to side; on a phone's portrait stage it loops down the stacked headings instead.
const LAY = [110, 0.4, 0.7, 0.3, 1.3, 100, 0.36, 0.7, 0.32, 1.3, 104, 0.3, 1.3, 0.36, 0.7];

export function haunt(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null, p: HeroParams) {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 });
  const L = engine.ledger, R = engine.random;
  const T = boardPage(engine, { root: slot, text: false, targets: HEADINGS, still: Infinity }).targets;
  stage.style.pointerEvents = "none"; // the pointer goes through to the page it haunts
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // Shiver levels 1–3 in two phases (each frame flips them): every value made once, in one sheet.
  const LIT = ["", "a1", "a2", "a3", "", "b1", "b2", "b3"];
  let css = "";
  for (let l = 1; l < 4; l++)
    for (const s of [1, -1])
      css += `[${ATTR}="${s > 0 ? "a" : "b"}${l}"]{transform:translate(${s * l}px,${l > 1 ? -s : 0}px) skewX(${-s * l * 2}deg);color:${PAL[l > 2 ? 7 : 2]}!important;text-shadow:${s * l * 2}px 0 ${PAL[0]}aa,0 0 ${l * 4}px ${PAL[7]}88!important}`;
  const sheet = L.add(document.createElement("style"));
  sheet.textContent = css;
  document.head.append(sheet);
  // The ghost's two frames and the BOO!, each rasterised once into a bitmap.
  const ghost = [spriteURL(GHOST, 0), spriteURL(GHOST, 1), spriteURL(BOO)].map((url) => {
    const c = document.createElement("canvas"), i = new Image();
    i.onload = () => ((c.width = i.width), (c.height = i.height), c.getContext("2d")!.drawImage(i, 0, 0), engine.wake());
    i.src = url;
    return c;
  });
  // State: ghost x, y, target x, y (art px), time, fade (0..1), scare (s), since a pointer (s),
  // stage left, top (viewport px), measure, w, h, P, round left (s), BOO life, x, y, frames,
  // layout row (aspect class × 5), the class marked.
  const G = new Float64Array([-12, 30, 0, 0, 0, 0, 0, 9, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, -1]);
  const tx = new Float32Array(TRAIL), ty = new Float32Array(TRAIL), lit = new Float32Array(M), lv = new Uint8Array(M);
  const q = new Float64Array([0, 0, 0]); // pending input: kind (1 tap, 2 point), x, y (CSS px in the stage)
  const at = (ev: PointerEvent, k: number) => {
    if (!ev.isPrimary || (k === 2 && (q[0] === 1 || G[14]! <= 0))) return; // a pointer calls it only while it haunts
    const r = stage.getBoundingClientRect(); // one read per input, outside any frame
    q[0] = k;
    q[1] = ev.clientX - r.left;
    q[2] = ev.clientY - r.top;
    engine.wake();
  };
  const sig = { signal: engine.signal };
  slot.addEventListener("pointerdown", (ev) => at(ev, 1), sig);
  slot.addEventListener("pointermove", (ev) => at(ev, 2), sig);
  addEventListener("scroll", () => (G[10] = 1), { ...sig, passive: true, capture: true });
  const ro = new ResizeObserver(() => ((G[10] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = (x = -1, y = -1) => (x < 0 ? (G[14] = p.seconds) : ((q[0] = 1), (q[1] = x), (q[2] = y)), engine.wake());
  G[14] = p.seconds;
  if (first) (q[0] = 1), (q[1] = first.x), (q[2] = first.y);

  engine.add({
    read() {
      if (!G[10]) return;
      G[10] = 0;
      const r = stage.getBoundingClientRect(), l = (G[19] = aspect(r.width, r.height) * 5), P = Math.max(2, Math.round(r.height / LAY[l]!)); // after a scroll or resize only
      G[8] = r.left;
      G[9] = r.top;
      G[11] = canvas.width = Math.ceil(r.width / P);
      G[12] = canvas.height = Math.ceil(r.height / P);
      G[13] = P;
      canvas.style.width = G[11] * P + "px";
      canvas.style.height = G[12] * P + "px";
    },
    step(e, dt) {
      const w = G[11]!, hh = G[12]!, P = G[13]!, t = (G[4] = G[4]! + dt);
      let live = 0;
      if (q[0]) {
        const x = q[1]! / P, y = q[2]! / P;
        // A tap: BOO there, everything shudders. A pointer: it comes to you while it haunts.
        if (q[0] === 1) (G[14] = Math.max(G[14]!, 2)), (G[6] = 0.6), (G[15] = 0.9), (G[16] = x), (G[17] = y - 14);
        if (q[0] === 1 || G[14]! > 0) (G[2] = x), (G[3] = y), (G[7] = 0), (G[14] = Math.max(G[14]!, 0.6));
        q[0] = 0;
      }
      // Drift on a slow figure of eight unless a pointer called it in the last second.
      const l = G[19]!;
      if ((G[7] = G[7]! + dt) > 1) (G[2] = w * (0.5 + LAY[l + 1]! * Math.sin(t * LAY[l + 2]!))), (G[3] = hh * (0.45 + LAY[l + 3]! * Math.sin(t * LAY[l + 4]!)));
      const k = Math.min(1, dt * (G[6]! > 0 ? 8 : 1.6));
      G[0] = G[0]! + (G[2]! - G[0]!) * k;
      G[1] = G[1]! + (G[3]! - G[1]!) * k;
      G[5] = Math.max(0, Math.min(1, G[5]! + (G[14]! > 0 ? dt * 2 : -dt * 1.5)));
      G[14] = G[14]! - dt;
      G[6] = G[6]! - dt;
      G[15] = G[15]! - dt;
      G[16] = G[16]! + (R() - 0.5) * 0.6;
      if (((t * 12) | 0) !== (((t - dt) * 12) | 0)) {
        for (let i = TRAIL - 1; i > 0; i--) (tx[i] = tx[i - 1]!), (ty[i] = ty[i - 1]!);
        tx[0] = G[0]!;
        ty[0] = G[1]!;
      }
      // Every heading near the ghost shivers (nearer: harder); a BOO shakes them all.
      for (let i = 0; i < T.length && i < M; i++) {
        const b = T[i]!, l = (b.x - G[8]!) / P, top = (b.y - G[9]!) / P;
        const dx = Math.max(l - G[0]!, 0, G[0]! - l - b.w / P), dy = Math.max(top - G[1]!, 0, G[1]! - top - b.h / P);
        const v = b.w > 0 ? Math.max(G[6]! > 0 ? 1 : 0, (1 - Math.sqrt(dx * dx + dy * dy) / 20) * G[5]!) : 0;
        lit[i] = Math.max(v, lit[i]! - dt * 2);
        if (lit[i]! > 0) live++;
      }
      G[18] = G[18]! + 1;
      if (live > 0 || G[5]! > 0 || G[14]! > 0 || G[15]! > 0) e.busy();
    },
    render() {
      const f = G[5]!, t = G[4]!, odd = G[18]! & 1;
      if (G[19] !== G[20]) mark(L, stage, (G[20] = G[19]!) / 5);
      for (let i = 0; i < T.length && i < M; i++) {
        const l = lit[i]! > 0 ? Math.ceil(lit[i]! * 3) + odd * 4 : 0;
        if (l !== lv[i]) (lv[i] = l), L.attr(T[i]!.el as HTMLElement, ATTR, l ? LIT[l]! : null);
      }
      ctx.clearRect(0, 0, G[11]!, G[12]!);
      if (f > 0) {
        for (let i = TRAIL - 1; i > 0; i--) (ctx.globalAlpha = f * 0.08 * (TRAIL - i)), ctx.drawImage(ghost[0]!, Math.round(tx[i]!) - 7, Math.round(ty[i]!) - 7);
        ctx.globalAlpha = f * 0.9;
        ctx.drawImage(ghost[(t * 4) & 1]!, Math.round(G[0]!) - 7, Math.round(G[1]! + Math.sin(t * 4) * 1.5) - 7);
        ctx.globalAlpha = 1;
      }
      if (G[15]! > 0 && (G[15]! > 0.3 || odd)) ctx.drawImage(ghost[2]!, Math.round(G[16]!) - 7, Math.round(G[17]! + (G[15]! - 0.9) * 14));
    },
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() } satisfies SlotScene & { engine: unknown; play(x?: number, y?: number): void };
}

export const scene = (p: HeroParams) => (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => haunt(stage, slot, first, p);
