// The "how it works" labs (DOM VIRUS's Under the hood, now Fizlet scenes; the hub vendors them).
// Each lab is one engine on the shared clock (one requestAnimationFrame for every engine on the
// page): read caches layout, step moves state (no DOM, no layout reads, no allocation), render
// writes the DOM only through the engine's ledger, so destroy() (Recall) gives the figure back
// exactly. Seeded random for anything that changes state. It settles when idle (no frames at all)
// and sleeps off screen (kernel pause rules). Reduced motion: nothing moves on its own; the buttons
// still work and show their result at once.
import { createEngine, type Engine } from "../../src/kernel/index";

/** A mounted lab: its engine (the hub's HUD reads it) and how many things it is moving. */
export interface Lab {
  engine: Engine;
  /** Entities alive right now (pooled things in use, plus the lab's fixed actors). */
  entities(): number;
  destroy(): void;
}
export interface LabOptions {
  /** Seed for `engine.random` (each lab has its own default). */
  seed?: number;
  /** Called when the lab wakes: on screen again, or input (the hub's HUD wakes with it). */
  onWake?: () => void;
}
export type LabMount = (figure: HTMLElement, o?: LabOptions) => Lab;

/** Seconds a lab plays on its own (attract mode) after it comes on screen or after the last input;
 *  then it finishes what is moving and settles until the next input or visit. */
export const ATTRACT = 12;

export const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
export const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
/** The text node an element shows (made once if the markup left it empty). */
export const textOf = (el: Element): Text => (el.firstChild as Text | null) ?? el.appendChild(document.createTextNode(""));

/**
 * The engine for one lab figure. `show` runs when the figure comes on screen (and once at mount if
 * it already is). The returned `input()` marks a user action: it wakes a settled engine and starts
 * the attract window again; `attract()` (read in a step) says whether the lab may play on its own.
 */
export function labEngine(figure: HTMLElement, seed: number, o: LabOptions, show: () => void) {
  const engine = createEngine({ root: figure, settle: 0.5, seed: o.seed ?? seed });
  // Clock facts in one typed array (no boxed numbers in a step): last show or input, last input.
  const t = new Float64Array([0, -1e9]);
  const wake = () => {
    t[0] = engine.time;
    engine.wake();
    o.onWake?.();
  };
  const io = new IntersectionObserver((list) => {
    if (!list[list.length - 1]!.isIntersecting) return;
    wake();
    show();
  }, { rootMargin: "40px 0px" });
  io.observe(figure);
  engine.signal.addEventListener("abort", () => io.disconnect(), { once: true });
  // Buttons drawn disabled on a still poster (the gallery's, before the scene loads) come alive
  // here, through the ledger: Recall puts the poster back.
  for (const b of figure.querySelectorAll<HTMLButtonElement>("[data-fzl-poster]")) engine.ledger.attr(b, "disabled", null);
  engine.start();
  return {
    engine,
    input() {
      t[1] = engine.time;
      wake();
    },
    /** True while the lab may act on its own: in the attract window, `idle` s after the last input. */
    attract(idle: number) {
      return engine.time - t[0]! < ATTRACT && engine.time - t[1]! > idle;
    },
    /** Seconds since the last input. */
    get quiet() {
      return engine.time - t[1]!;
    },
  };
}

/** Linear keyframes at even offsets (as the Web Animations API spaces them), progress p in 0..1,
 *  quantised to `steps` (CSS steps(n), jump-end) when given. Allocation-free. */
export function kf(values: readonly number[], p: number, steps = 0): number {
  if (p <= 0) return values[0]!;
  if (p >= 1) return values[values.length - 1]!;
  if (steps) p = Math.floor(p * steps) / steps;
  const seg = values.length - 1, at = p * seg, i = Math.min(seg - 1, Math.floor(at));
  return values[i]! + (values[i + 1]! - values[i]!) * (at - i);
}

/** A figure's markup, as a still poster (buttons disabled until a scene runs) or live. */
export const key = (attrs: string, label: string, poster: boolean, cls = "lab-key") =>
  `<button class="${cls}" ${attrs}${poster ? " disabled data-fzl-poster" : ""}>${label}</button>`;
