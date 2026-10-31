// Docs code (shown on /guides/astro-slot/): a scene for an astro-base-engine slot.
// ---
// hero-scene.ts: build inside the stage; return destroy.
import { createEngine } from "fzlt";
import { effects } from "fzlt/fx";
import type { SlotTap } from "fzlt/slot";

export function mount(stage: HTMLElement, figure: HTMLElement, first: SlotTap | null) {
  // settle: no frames once nothing moves; fps: an ambient hero needs no more than 30.
  const engine = createEngine({ root: stage, pause: { reducedMotion: true }, settle: 0.5, fps: 30 });
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!, fx = effects();
  engine.add({
    step: (e, dt) => { fx.step(dt); if (fx.live) e.busy(); },
    render: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); fx.draw(ctx); },
  });
  stage.addEventListener("pointerdown", (ev) => { fx.blast(ev.offsetX, ev.offsetY); engine.wake(); }, { signal: engine.signal });
  if (first) fx.blast(first.x, first.y); // the tap that loaded the scene
  engine.start();
  return { destroy: () => engine.destroy() };
}
