// The usage example on bricks/slot.html (see pad.ts); hero.ts re-exports its mount.
import { createEngine } from "../../src/index";
import { slot, type SlotMount } from "../../src/slot";
// ---
slot("home#hero", () => import("./hero.js").then((m) => m.mount));

// hero.ts: build inside the stage, return destroy
export const mount: SlotMount = (stage, _figure, first) => {
  const e = createEngine({ root: stage, settle: 0.5, fps: 30 });
  if (first) { /* the tap that loaded the scene: first.x, first.y */ }
  e.start();
  return { destroy: () => e.destroy() };
};
