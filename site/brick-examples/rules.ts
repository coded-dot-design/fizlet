// The usage example on bricks/rules.html (see pad.ts).
import { createEngine } from "../../src/index";
import { waves, drops, score } from "../../src/rules";
const e = createEngine();
declare let hp: number;
declare const enemies: number, px: number, py: number, spawn: () => void, spot: (out: Float64Array) => boolean, hit: boolean;
// ---
const w = waves(e, { alive: () => enemies });
const d = drops(e, { kinds: ["repair", "charge"], every: 6, place: (out) => spot(out) });
const s = score(e, { levels: [8, 24, 50] });
e.add({ step() {
  if (w.ready()) { spawn(); w.spawned(); }
  if (d.collect(px, py, 24) === "repair") hp++;
  if (hit) s.add(25, 4);  // 25 points × the combo, 4 xp: event "score"
} });
