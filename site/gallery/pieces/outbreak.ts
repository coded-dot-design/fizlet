// The Outbreak series' shared core (DOM Virus theme): famous worms from public history, each a micro
// game whose mechanic is the worm's real spread, then the white hats who beat them the way it was
// really done. One stage per piece (site/gallery/stages/<id>.html): the world is real page elements
// (contacts, ports, files) whose state is written through the ledger as one data attribute, styled by
// the stage's sheet, so destroy() gives the page back byte for byte; the things that fly (letters,
// packets, exploits) and the debris are drawn on one canvas.
// What lives here, once: the engine (fixed step, settle: no frames once still), the canvas sized to
// the stage at the device's pixel ratio, the tap queue (one rect read per tap, outside any frame), a
// resize/scroll re-measure, the palette read from the stage's CSS variables (light and dark), a
// particle pool and a ring pool (typed arrays: step allocates nothing) and the end card.
import { createEngine } from "../../../src/kernel/index";
import { hypot } from "../../../src/steer";
export { hypot };

const PARTS = 260, RINGS = 12;
/** Palette slots, from the stage's `--ob-*` variables: background, ink, muted, line, bug, bug2, heal, glow, gold. */
export const BG = 0, INK = 1, MUTED = 2, LINE = 3, BUG = 4, BUG2 = 5, HEAL = 6, GLOW = 7, GOLD = 8;
const VARS = ["bg", "ink", "muted", "line", "bug", "bug2", "heal", "glow", "gold"];
/** Scene numbers every piece shares: [W] width, [H] height (CSS px), [S] scale (width / 640), [DPR], [T] time, [SHAKE]. */
export const W = 0, H = 1, S = 2, DPR = 3, T = 4, SHAKE = 5;

export interface Hooks {
  /** Read layout (one pass, on mount and after a resize or scroll): `r` is the stage's rect. */
  measure(r: DOMRect): void;
  /** One fixed step; return true while something moves (the core keeps the engine awake). */
  step(dt: number, tap: boolean, x: number, y: number): boolean;
  /** Draw the piece (after the canvas is cleared and shaken), before the shared debris. */
  draw(ctx: CanvasRenderingContext2D): void;
  /** Write DOM text and attributes for this frame (through the ledger), when they changed. */
  write?(): void;
}

export function outbreak(stage: HTMLElement, slot: HTMLElement) {
  const engine = createEngine({ root: stage, fps: 60, settle: 0.4 });
  const L = engine.ledger, R = engine.random;
  const root = slot.querySelector<HTMLElement>("[data-ob]")!;
  const endEl = slot.querySelector<HTMLElement>("[data-ob-end]");
  const endText = endEl ? ((endEl.firstChild as Text | null) ?? L.add(endEl.appendChild(document.createTextNode("")))) : null;
  stage.style.pointerEvents = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const G = new Float64Array(8);
  const q = new Float64Array(4); // a pending tap: [0] 1, [1] x, [2] y; [3] measure
  q[3] = 1;
  const col = ["#07060f", "#f6f3ff", "#aea4d6", "#3b3170", "#ff2e88", "#ff7389", "#39ffb0", "#19f0ff", "#ffc21a"];
  const PX = new Float32Array(PARTS), PY = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS), PL = new Float32Array(PARTS), PZ = new Float32Array(PARTS), PC = new Uint8Array(PARTS);
  const RX = new Float32Array(RINGS), RY = new Float32Array(RINGS), RA = new Float32Array(RINGS), RR = new Float32Array(RINGS), RC = new Uint8Array(RINGS);
  const n = new Uint32Array(2); // parts, rings
  let hooks: Hooks | null = null;

  const tap = (x: number, y: number) => ((q[0] = 1), (q[1] = x), (q[2] = y), engine.wake());
  slot.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(ev.clientX - r.left, ev.clientY - r.top);
  }, { signal: engine.signal });
  addEventListener("scroll", () => (q[3] = 1), { signal: engine.signal, passive: true, capture: true });
  const ro = new ResizeObserver(() => ((q[3] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const ob = {
    engine, L, R, G, col, root, ctx,
    /** A bit of debris: position, velocity, life (s), size (px at scale 1), palette slot; gravity pulls it. */
    part(x: number, y: number, vx: number, vy: number, life: number, z: number, c: number) {
      const i = n[0]!;
      if (i >= PARTS) return;
      n[0] = i + 1;
      (PX[i] = x), (PY[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = life), (PZ[i] = z), (PC[i] = c);
    },
    /** `k` bits of debris thrown out of (x, y) at up to `v` px/s. */
    burst(x: number, y: number, k: number, v: number, c: number, c2 = c) {
      const s = G[S]!;
      for (let j = 0; j < k; j++) {
        const a = R() * 6.2832, sp = (0.3 + R() * 0.7) * v * s;
        ob.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 50 * s, 0.4 + R() * 0.5, 2 + R() * 2.5, j & 1 ? c2 : c);
      }
    },
    /** A ring growing out of (x, y) to radius `r` (px at scale 1). */
    ring(x: number, y: number, r: number, c: number) {
      let i = n[1]!;
      if (i < RINGS) n[1] = i + 1;
      else for (let j = (i = 0); j < RINGS; j++) if (RA[j]! > RA[i]!) i = j;
      (RX[i] = x), (RY[i] = y), (RA[i] = 0), (RR[i] = r), (RC[i] = c);
    },
    /** Set the stage's state attribute (`data-ob-state`): the sheet shows the end card on "end". */
    state(v: string | null) {
      L.attr(root, "data-ob-state", v);
    },
    /** The end card's line (written through the ledger). */
    end(text: string) {
      if (endText) L.text(endText, text);
      ob.state("end");
    },
    /** For tests: a tap at (x, y) in CSS px from the stage's top left. */
    tap,
    run(h: Hooks) {
      hooks = h;
      engine.add({
        read() {
          if (!q[3]) return;
          q[3] = 0;
          const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
          (G[W] = r.width), (G[H] = r.height), (G[S] = r.width / 640), (G[DPR] = dpr);
          canvas.width = Math.ceil(r.width * dpr);
          canvas.height = Math.ceil(r.height * dpr);
          canvas.style.width = r.width + "px";
          canvas.style.height = r.height + "px";
          const cs = getComputedStyle(root);
          for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue("--ob-" + VARS[i]).trim() || col[i]!;
          h.measure(r);
        },
        step(e, dt) {
          G[T] = G[T]! + dt;
          const t = q[0] === 1;
          q[0] = 0;
          let busy = h.step(dt, t, q[1]!, q[2]!);
          const s = G[S]!, h0 = G[H]!;
          for (let i = 0; i < n[0]!; i++) {
            PL[i] = PL[i]! - dt;
            if (PL[i]! <= 0) {
              const j = --n[0]!;
              (PX[i] = PX[j]!), (PY[i] = PY[j]!), (PVX[i] = PVX[j]!), (PVY[i] = PVY[j]!), (PL[i] = PL[j]!), (PZ[i] = PZ[j]!), (PC[i] = PC[j]!);
              i--;
              continue;
            }
            PVY[i] = PVY[i]! + 520 * s * dt;
            (PX[i] = PX[i]! + PVX[i]! * dt), (PY[i] = PY[i]! + PVY[i]! * dt);
            if (PY[i]! > h0 - 2) (PY[i] = h0 - 2), (PVY[i] = -PVY[i]! * 0.35), (PVX[i] = PVX[i]! * 0.6);
          }
          for (let i = 0; i < n[1]!; i++) RA[i] = RA[i]! + dt * 2.4;
          while (n[1]! > 0 && RA[n[1]! - 1]! >= 1) n[1] = n[1]! - 1;
          G[SHAKE] = Math.max(0, G[SHAKE]! - dt);
          if (busy || n[0] || n[1] || G[SHAKE]! > 0) e.busy();
        },
        render() {
          hooks!.write?.();
          const dpr = G[DPR]!, s = G[S]!, sh = G[SHAKE]! > 0 ? (R() - 0.5) * 7 * s * G[SHAKE]! * 4 : 0;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, G[W]!, G[H]!);
          ctx.translate(sh, 0);
          hooks!.draw(ctx);
          ctx.lineWidth = 2 * s + 1;
          for (let i = 0; i < n[1]!; i++) {
            ctx.globalAlpha = 1 - RA[i]!;
            ctx.strokeStyle = col[RC[i]!]!;
            ctx.beginPath();
            ctx.arc(RX[i]!, RY[i]!, (6 + RA[i]! * RR[i]!) * s, 0, 6.2832);
            ctx.stroke();
          }
          for (let i = 0; i < n[0]!; i++) {
            ctx.globalAlpha = Math.min(1, PL[i]! * 3);
            ctx.fillStyle = col[PC[i]!]!;
            const z = PZ[i]! * s + 0.5;
            ctx.fillRect(PX[i]! - z / 2, PY[i]! - z / 2, z, z);
          }
          ctx.globalAlpha = 1;
        },
      });
      engine.start();
    },
  };
  return ob;
}

/** Ease a 0..1 time smoothly (no allocation). */
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
