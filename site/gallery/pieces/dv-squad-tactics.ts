// "Squad tactics": DOM Battlefield's display card from domvirus.com, as a gallery micro. Markup and
// stylesheet are dom-virus's own (site/vendor/dom-virus/squad-tactics.*, vendored at a pinned commit
// by scripts/vendor-dom-virus.mjs): patrols, turret sweeps, shells and blasts are its @keyframes,
// paused, their time read from --fz-t. fizlet/css-clock moves that time on the kernel clock: three
// 6 s plays, then it rests on frame one and the engine settles (0 frames); a pointer or coming back
// into view plays it again; destroy() is Recall. Reduced motion never loads this: the poster is
// frame one.
import { cssClock } from "../../../src/css-clock";
import type { SlotScene } from "../../../src/slot";

export function mount(stage: HTMLElement, slot: HTMLElement) {
  stage.style.pointerEvents = "none";
  const c = cssClock(slot.querySelector<HTMLElement>(".battlefield-display")!, { span: 6, loops: 3, fps: 30 });
  return { engine: c.engine, destroy: () => c.destroy() } satisfies SlotScene & Record<string, unknown>;
}
