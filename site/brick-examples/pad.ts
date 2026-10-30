// The usage example on bricks/pad.html: the page shows what follows the "// ---" line; this file is
// typechecked against the source (npm run typecheck), so the example can't drift from the API.
import { createEngine } from "../../src/index";
import { controls } from "../../src/input";
import { pad } from "../../src/pad";
const e = createEngine();
// ---
const input = controls(e, { keys: { fire: ["Space"], auto: ["KeyQ"] } });
const touch = pad(e, input, { scheme: "stick", actions: [
  { intent: "fire", label: "FIRE", hold: true },   // the big primary key
  { intent: "auto", label: "AUTO", toggle: true },
] });
touch.setScheme("dpad"); // the game still reads input.down, hit and axis
