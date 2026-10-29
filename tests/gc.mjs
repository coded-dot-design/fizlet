// Young-generation GC counting for the zero-allocation tests (run node with --expose-gc).
// A stray scavenge can come from the test runner or JIT work in a busy process, so a check
// measures several windows and keeps the best one: real per-step allocation shows in every
// window (dozens or more), while noise does not.
import { PerformanceObserver, constants } from "node:perf_hooks";

/** Runs `work` in `windows` separate measured windows; returns the fewest minor GCs seen. */
export async function minorGCs(work, windows = 3) {
  let best = Infinity;
  for (let w = 0; w < windows && best > 0; w++) {
    globalThis.gc?.();
    let minor = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
    });
    obs.observe({ entryTypes: ["gc"] });
    work();
    await new Promise((r) => setTimeout(r, 50));
    obs.disconnect();
    best = Math.min(best, minor);
  }
  return best;
}
