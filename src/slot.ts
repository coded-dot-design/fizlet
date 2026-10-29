/**
 * fizlet/slot: mount a Fizlet scene into an astro-base-engine slot,
 *   <figure class="ae-slot" data-slot-target="<page>#<slot>" role="img" aria-label="…">.
 * - Lazy: nothing loads or runs until the slot comes near the viewport.
 * - Reduced motion: the slot keeps its placeholder and fallback; the scene never loads. If the
 *   setting turns on while a scene runs, the scene goes and the fallback comes back.
 * - Accessible: role="img" + aria-label stay unless the scene says it renders real accessible
 *   content (`accessible: true`); until then the stage is aria-hidden.
 * - Contained: the scene gets its own stage inside the slot (contain: strict). Every change the
 *   slot makes goes through a Ledger, so destroy() gives the page back exactly.
 */
import { Ledger } from "./kernel/ledger";

export interface SlotScene {
  /** Remove the scene (its engine's destroy() restores what it changed). */
  destroy(): void;
  /** True when the scene renders real accessible content: the slot drops role="img". */
  accessible?: boolean;
}
/** Build the scene inside `stage` (sized to the slot). `slot` is the figure, read-only. */
export type SlotMount = (stage: HTMLElement, slot: HTMLElement) => SlotScene;
export interface SlotOptions {
  /** How close to the viewport the slot must come before the scene loads (default "200px"). */
  margin?: string;
}

const REDUCE = "(prefers-reduced-motion: reduce)";

/** The slot figure for "<page>#<slot>" (or null). */
export const findSlot = (target: string, doc: Document = document) =>
  [...doc.querySelectorAll<HTMLElement>("figure.ae-slot[data-slot-target]")].find((f) => f.dataset.slotTarget === target) ?? null;

export function slot(target: string | HTMLElement, load: () => Promise<SlotMount> | SlotMount, opts: SlotOptions = {}) {
  const el = typeof target === "string" ? findSlot(target) : target;
  const ctl = new AbortController(), ledger = new Ledger();
  const motion = matchMedia(REDUCE);
  let scene: SlotScene | null = null, io: IntersectionObserver | null = null, run = 0;

  function unmount() {
    run++;
    scene?.destroy();
    scene = null;
    ledger.restore();
  }
  async function mount() {
    const id = ++run;
    const make = await load();
    if (id !== run || !el || ctl.signal.aborted || motion.matches) return;
    if (getComputedStyle(el).position === "static") ledger.style(el, "position", "relative");
    for (const c of el.querySelectorAll<HTMLElement>(":scope > .ae-slot__placeholder, :scope > .ae-slot__fallback")) ledger.style(c, "display", "none");
    const stage = ledger.add(document.createElement("div"));
    stage.setAttribute("data-fizlet-slot", el.dataset.slotTarget ?? "");
    stage.style.cssText = "position:absolute;inset:0;contain:strict;overflow:hidden";
    el.append(stage);
    scene = make(stage, el);
    if (scene.accessible) ledger.attr(el, "role", null);
    else stage.setAttribute("aria-hidden", "true");
  }
  function arm() {
    if (!el || io || scene || motion.matches || ctl.signal.aborted) return;
    io = new IntersectionObserver((list) => {
      if (!list[list.length - 1]!.isIntersecting) return;
      disarm();
      void mount();
    }, { rootMargin: opts.margin ?? "200px" });
    io.observe(el);
  }
  function disarm() {
    io?.disconnect();
    io = null;
  }
  motion.addEventListener("change", () => (motion.matches ? (disarm(), unmount()) : arm()), { signal: ctl.signal });
  arm();

  return {
    /** The slot figure, or null when no slot matches the target. */
    el,
    get mounted() {
      return !!scene;
    },
    /** Remove the scene, the stage and every listener; the slot is back as the engine drew it. */
    destroy() {
      ctl.abort();
      disarm();
      unmount();
    },
  };
}
