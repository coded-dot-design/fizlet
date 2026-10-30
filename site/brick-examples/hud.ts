// The usage example on bricks/hud.html (see pad.ts).
import { createEngine } from "../../src/index";
import { hud } from "../../src/hud";
const e = createEngine();
declare const wrap: HTMLElement, score: number, NAMES: string[];
// ---
const s = new Float64Array(2); // clock, armor (0..1): fractions in a typed array
hud(e, wrap)
  .num("[data-score]", () => score)        // written only when it changes
  .num("[data-clock]", [s, 0], "clock")    // 2:59
  .meter("[data-hp]", [s, 1], 0.34)        // class "low" at or under 34%
  .feed(".feed", 4, "kill", (a, b) => NAMES[a] + " ✕ " + NAMES[b]);
