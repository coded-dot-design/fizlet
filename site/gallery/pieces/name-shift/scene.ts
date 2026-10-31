/**
 * The name shift (Fizlet → fzlt), live: the launch logo animation. The markup and every pose are the
 * poster's (art.ts); this clones it into the slot's stage and plays the story once with
 * @fzlt/core/timeline, moving only the root's progress properties (`--a` … `--m`), so the step
 * allocates nothing and the render writes a few custom properties, change-only, through the ledger.
 *
 * - Plays once, when at least 40% of the figure is on screen; then the timeline ends and the kernel
 *   settles (0 frames). Off screen or in a hidden tab the kernel pauses it.
 * - The Replay key (a real Board UI key) plays it again from the start.
 * - Reduced motion: @fzlt/core/slot never loads it; the poster is the final lockup, still.
 * - Recall: the clone and the key are ledger nodes and every write goes through the ledger, so
 *   destroy() gives the page back byte for byte.
 */
import { createEngine } from "../../../../src/kernel/index";
import { timeline } from "../../../../src/timeline";
import type { SlotMount } from "../../../../src/slot";

export const mount: SlotMount = (stage, fig) => {
  const engine = createEngine({ root: stage, settle: 0.3 });
  const root = engine.ledger.add(fig.querySelector(".ns")!.cloneNode(true) as HTMLElement);
  // A fresh node of our own, not on the page yet: the poster's placeholder bits come off it.
  root.className = "ns";
  root.removeAttribute("style");
  root.removeAttribute("aria-hidden");
  for (const el of root.querySelectorAll(".ns-head,.ns-act")) el.setAttribute("aria-hidden", "true");
  const key = root.appendChild(document.createElement("button"));
  key.type = "button";
  key.className = "bui-key ns-re";
  key.textContent = "↻ Replay";
  key.setAttribute("aria-label", "Replay the name shift");
  stage.append(root);

  // The story, in seconds. Each property goes 0 → 1 (the ram and the stack screen go and come back).
  const tl = timeline(engine);
  const go = (p: string, at: number, dur: number, ease = "out", v: number[] = [0, 1]) => tl.to(root, { [p]: v }, { at, dur, ease });
  go("--a", 0, 0.7, "back"); // FIZ + LET drop onto the floor: FIZLET
  go("--b", 1.7, 0.9, "inOut"); // into the press
  go("--r", 2.6, 1, "linear", [0, 1, 0.25, 1, 0]); // the ram, twice
  go("--e", 2.95, 0.8, "linear"); // the E is punched out of the top
  go("--o", 3.7, 0.8); // out come fiz + lt
  go("--j", 4.75, 0.75, "linear"); // the i pops out and falls
  go("--i", 4.75, 0.35); // and fiz closes up: fzlt
  go("--f", 5.75, 0.5); // fzlt is lifted
  go("--sb", 5.75, 2, "linear", [0, 1, 1, 0]); // the press says "stack"
  for (let k = 1; k <= 5; k++) go(`--k${k}`, 6 + (k - 1) * 0.28, 0.6, "linear"); // the bricks come out of it and stack
  go("--g", 7.75, 0.3, "in"); // fzlt lands on top
  go("--l", 8.3, 0.55, "back"); // the lockup
  go("--m", 8.7, 0.5); // the caption
  tl.seek(0); // the first frame waits, posed, until the figure is in view

  const io = new IntersectionObserver((list) => {
    if (!list[list.length - 1]!.isIntersecting) return;
    io.disconnect();
    tl.play();
  }, { threshold: 0.4 });
  io.observe(fig);
  engine.signal.addEventListener("abort", () => io.disconnect());
  key.addEventListener("click", () => (tl.seek(0), tl.play()), { signal: engine.signal });
  engine.start();
  const scene = { destroy: () => engine.destroy(), accessible: true, engine, tl };
  return scene;
};
