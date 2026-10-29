// The home page's "Blast it. Recall it." demo as a gallery slot scene: the figure's markup waits in
// a <template> inside the slot (built by site/pages/index.mjs playFigure), and comes onto the stage
// only when the slot mounts. destroy() stops the engine (Recall included); the slot removes the stage.
import { run } from "../../demo";
import type { SlotMount } from "../../../src/slot";

export const mount: SlotMount = (stage, slot) => {
  stage.append(slot.querySelector("template")!.content.cloneNode(true));
  const engine = run(stage.querySelector<HTMLElement>("[data-demo]")!);
  return { destroy: () => engine.destroy(), accessible: true };
};
