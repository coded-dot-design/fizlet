// The usage example on bricks/board-page.html (see pad.ts).
import { createEngine } from "../../src/index";
import { boardPage } from "../../src/board-page";
const e = createEngine();
declare const px: number, py: number;
// ---
const board = boardPage(e, { exclude: ".no-game" });
const near = new Int32Array(16);
e.add({ step() {
  const n = board.near(px, py, 12, near);         // on-screen glyphs, no layout reads
  for (let k = 0; k < n; k++) board.consume(near[k]!); // a 0 or 1 in the page's own text
} });
