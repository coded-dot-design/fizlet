// Battlefield Blitz's landing hero on fizlet.com: the game's own attract mode (its committed build,
// dist/blitz.mjs, vendored byte for byte and loaded next to this script), as the game's page runs
// it: createBlitz on the hero's demo layer, every tank a bot. Attract mode never ends on its own, so
// the stage rests it: REST seconds with no input and its engine stops (a still frame, no frames at
// all); the next input plays it on. Recall: destroy() gives the hero back.
import { expose, rest } from "./stage";
import { createBlitz } from "./vendor/battlefield-blitz/blitz.mjs";

const host = document.getElementById("bz-demo")!;
const blitz = createBlitz(host, { mode: "board", demo: true, bots: 6 });
let resting = false;
const stop = rest(() => ((resting = true), blitz.engine.stop()), () => ((resting = false), blitz.engine.start()));
expose({
  recall: () => (stop(), blitz.destroy()),
  get resting() {
    return resting && !blitz.engine.running;
  },
});
