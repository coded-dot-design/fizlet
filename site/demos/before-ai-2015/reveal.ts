// The page's story, told by the scroll: 2015, then the remake, then the arcade. Each [data-reveal]
// part (a section head, an act, a panel) fades up as it comes into view, scrubbed, not triggered:
// its progress is where it sits in the viewport, so the same scroll position always gives the same
// frame, scrolling back plays it backwards, and nothing waits on a timer. In the row of three, the
// acts come in one after another (2015 first). No scroll-jacking: the page scrolls as it always does;
// the engine only reads the scroll. One engine (kernel + @fzlt/core/timeline): it wakes on scroll and
// resize, settles 0.4 s after (no frames when still), and a part already in view at load is shown as
// it is (never hidden after it painted). Only opacity and translate move: no layout shift. Reduced
// motion: never runs (every part as written). destroy() gives every style back (the ledger).
import { createEngine } from "../../../src/kernel/index";
import { timeline, type Timeline } from "../../../src/timeline";

/** How far below the viewport's bottom a part starts (0) and how far up it is done (1), as
 *  fractions of the viewport height; an act's turn in its row delays it by STAGGER. */
const START = 0.02, SPAN = 0.3, STAGGER = 0.08;

export function reveal(root: HTMLElement) {
  const e = createEngine({ root, settle: 0.4 });
  const parts = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
  const n = parts.length;
  const tls: Timeline[] = parts.map((el) => timeline(e).to(el, { opacity: [0, 1], translate: ["0px 36px", "0px 0px"] }, { dur: 1, ease: "out" }));
  // Its turn in a row of siblings that sit side by side (0 when stacked: each is its own row).
  const turn = new Float64Array(n), top = new Float64Array(n), sent = new Float64Array(n).fill(-1);
  const g = new Float64Array(3); // scrollY, viewport height, geometry stale (1)
  g[2] = 1;
  e.add({
    read() {
      if (g[2]) {
        const y = scrollY;
        for (let i = 0; i < n; i++) {
          // The layout box, without the translate the reveal itself writes.
          const el = parts[i]!, r = el.getBoundingClientRect(), t = el.style.translate;
          top[i] = r.top + y - (t ? parseFloat(t.split(" ")[1] ?? "0") : 0);
          const prev = parts[i - 1];
          turn[i] = prev && prev.parentElement === el.parentElement && Math.abs(top[i]! - top[i - 1]!) < 2 ? turn[i - 1]! + 1 : 0;
        }
        g[1] = innerHeight;
        g[2] = 0;
      }
      g[0] = scrollY;
      const vh = g[1]!;
      for (let i = 0; i < n; i++) {
        // 0 while the part's top is below the fold, 1 once it has risen SPAN of the viewport.
        const rise = (g[0]! + vh * (1 - START) - top[i]!) / vh - turn[i]! * STAGGER;
        const p = Math.round(Math.min(1, Math.max(0, rise / SPAN)) * 1000) / 1000;
        if (p !== sent[i]) (sent[i] = p), tls[i]!.seek(p);
      }
    },
  });
  const on = { passive: true, signal: e.signal };
  addEventListener("scroll", () => e.wake(), on);
  addEventListener("resize", () => ((g[2] = 1), e.wake()), on);
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (m) => m.matches && e.destroy(), { signal: e.signal });
  e.start();
  return e;
}
