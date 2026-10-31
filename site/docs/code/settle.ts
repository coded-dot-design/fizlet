// Docs code (shown on /docs/loop/): a settling, capped engine for a page hero.
import { createEngine } from "fzlt";
declare const stage: HTMLElement, moving: () => boolean;
// ---
const e = createEngine({
  root: stage,
  settle: 0.5, // sleep half a second after the last busy() call
  fps: 30,     // an ambient hero needs no more
  pause: { reducedMotion: true },
});
e.add({
  step(e) { if (moving()) e.busy(); }, // something moved this frame
});
e.start();
e.wake(); // a settled engine wakes on input, start() or wake()
