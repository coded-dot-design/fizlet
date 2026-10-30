// The "how it works" labs (site/labs/, the same scenes DOM VIRUS's Under the hood runs) as gallery
// slot scenes. The lab's figure is the slot's poster (buttons disabled until it runs); mounting
// runs the lab on that figure. The slot's stage lets the pointer through to it; destroy() stops
// the lab's engine and Recall gives the poster back exactly.
import { board, duel, pipeline, pool, recall, type LabMount } from "../../labs/index";
import type { SlotMount } from "../../../src/slot";

const slotted = (lab: LabMount): SlotMount => (stage, slot) => {
  stage.style.pointerEvents = "none";
  const run = lab(slot.querySelector<HTMLElement>(".fzl")!);
  return { destroy: () => run.destroy(), accessible: true };
};
export const poolLab = /* @__PURE__ */ slotted(pool);
export const recallLab = /* @__PURE__ */ slotted(recall);
export const duelLab = /* @__PURE__ */ slotted(duel);
export const boardLab = /* @__PURE__ */ slotted(board);
export const pipelineLab = /* @__PURE__ */ slotted(pipeline);
