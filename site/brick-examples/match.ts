// The usage example on bricks/match.html (see pad.ts).
import { createEngine } from "../../src/index";
import { match } from "../../src/match";
const e = createEngine();
declare const board: HTMLElement, resetField: () => void, play: () => void;
// ---
const m = match(e, board, {
  count: 3, seconds: 180,     // 3-2-1, then a three-minute clock
  begin() { resetField(); },  // a new round
  end({ won, why }) { console.log(won, why); }, // why: "time", "flag" or yours
});
e.add({ step() { if (m.phase === "play") play(); } });
