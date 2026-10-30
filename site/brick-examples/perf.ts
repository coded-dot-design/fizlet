// The usage example on bricks/perf.html (see pad.ts).
import { createEngine } from "../../src/index";
import { perf } from "../../src/perf";
const e = createEngine();
// ---
const overlay = perf(e, { corner: "tr" }); // F9 toggles it
overlay.show(true); // fps, frame-time bars, dropped, work, live, heap
// it reads the engine's frames: no rAF and no allocation of its own
