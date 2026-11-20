import {
  Ledger
} from "./chunks/chunk-RXTVZ32U.js";

// src/slot.ts
var REDUCE = "(prefers-reduced-motion: reduce)";
var findSlot = (target, doc = document) => [...doc.querySelectorAll(".ae-slot[data-slot-target]")].find((f) => f.dataset.slotTarget === target) ?? null;
function slot(target, load, opts = {}) {
  const el = typeof target === "string" ? findSlot(target) : target;
  const ctl = new AbortController(), ledger = new Ledger();
  const motion = matchMedia(REDUCE);
  let scene = null, io = null, run = 0, first = null, go = null;
  el?.addEventListener("pointerdown", (ev) => {
    if (scene || motion.matches || !ev.isPrimary) return;
    const r = el.getBoundingClientRect();
    first = { x: ev.clientX - r.left, y: ev.clientY - r.top, at: ev.timeStamp };
    if (go) go();
    else if (io) disarm(), void mount();
  }, { signal: ctl.signal, capture: true });
  function unmount() {
    run++;
    go?.();
    scene?.destroy();
    scene = null;
    ledger.restore();
  }
  async function mount(wait = 0) {
    const id = ++run;
    if (wait > 0 && !first)
      await new Promise((done) => {
        const idle = typeof requestIdleCallback === "function", t = idle ? requestIdleCallback(() => go?.(), { timeout: wait }) : setTimeout(() => go?.(), 1);
        go = () => {
          go = null;
          idle ? cancelIdleCallback(t) : clearTimeout(t);
          done();
        };
        ctl.signal.addEventListener("abort", go, { once: true });
      });
    if (id !== run) return;
    const make = await load();
    if (id !== run || !el || ctl.signal.aborted || motion.matches) return;
    if (getComputedStyle(el).position === "static") ledger.style(el, "position", "relative");
    for (const c of el.querySelectorAll(":scope>.ae-slot__placeholder,:scope>.ae-slot__fallback")) ledger.style(c, "display", "none");
    const stage = ledger.add(document.createElement("div"));
    stage.setAttribute("data-fizlet-slot", el.dataset.slotTarget ?? "");
    stage.style.cssText = "position:absolute;inset:0;contain:strict;overflow:hidden;content-visibility:auto";
    el.append(stage);
    scene = make(stage, el, first);
    first = null;
    if (scene.accessible) ledger.attr(el, "role", "figure");
    else stage.setAttribute("aria-hidden", "true");
  }
  function arm() {
    if (!el || io || scene || motion.matches || ctl.signal.aborted) return;
    io = new IntersectionObserver((list) => {
      if (!list[list.length - 1].isIntersecting) return;
      disarm();
      void mount(opts.idle ?? 1e3);
    }, { rootMargin: opts.margin ?? "200px" });
    io.observe(el);
  }
  function disarm() {
    io?.disconnect();
    io = null;
  }
  motion.addEventListener("change", () => motion.matches ? (disarm(), unmount()) : arm(), { signal: ctl.signal });
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
    }
  };
}
export {
  findSlot,
  slot
};
