// The two heroes pixel pieces (site/gallery/pieces/), headless: their stories run on plain numbers (no
// DOM), so the games in them are checked here. Gecko climbs the page: the line sticks only to
// something solid, the swing hits the window cleaner's cradle and the tower (and only the tower's
// letters are knocked), a line that falls short ends in a SPLAT, the pigeon settles on his head.
// Spin it back: meteors throw only the letters they reach, the laps spin the world backwards and
// the page's past plays in reverse until every letter is home and the clock reads the minute before;
// spinning on past that brings the dinosaurs, and one more tap brings their meteor. Each settles.
import test from "node:test";
import assert from "node:assert/strict";
import { pixels } from "../site/gallery/pieces/pixel-stage.ts";
import * as WC from "../site/gallery/pieces/wall-crawler-climbs-page.ts";
import * as SB from "../site/gallery/pieces/spin-it-back.ts";

const run = (w, sec, each) => { for (let i = 0; i < sec * 60; i++) (w.step(1 / 60), each?.(i)); };
// Climber state slots: x, y, mode (0 standing, 1 clinging, 2 air, 3 flat), line (0 none, 2 stuck), pigeon (2: on his head), word, word age.
const HX = 0, HY = 1, MODE = 4, LN = 10, QM = 22, WD = 31, WT = 34;
const words = (w, sec) => { const seen = new Set(); run(w, sec, () => w.state[WT] === 0 || seen.add(w.state[WD])); return seen; };

test("Gecko: the opening swing hits the cradle and the tower, then he climbs to the roof and the pigeon lands on his head", () => {
  const knocks = [];
  const w = WC.climber(pixels(WC.GW, WC.GH), 5, { knock: (x, y, p) => knocks.push([x, y, p]) });
  w.tap(108, 4); // the jib, as the piece does on its own
  let hooked = false;
  const said = new Set();
  run(w, 8, () => ((hooked ||= w.state[LN] === 2), w.state[WT] < 0.02 && said.add(w.state[WD])));
  assert.ok(hooked, "the line sticks to the jib");
  assert.ok(said.has(2), "the window cleaner shouts HEY!");
  assert.ok(knocks.length > 0 && knocks.every(([x, y]) => WC.solid(x, y) === 2), "only the tower's letters are knocked, where he hits it");
  assert.deepEqual([w.state[MODE], w.state[HY]], [0, 22], "standing on the roof");
  assert.equal(w.state[QM], 2, "the pigeon on his head");
  assert.equal(w.busy(), false, "settled");
  w.paint();
});

test("Gecko: a line at thin air flops; a line that falls short is a fall, and a fall from the roof is a SPLAT", () => {
  const w = WC.climber(pixels(WC.GW, WC.GH), 5);
  w.tap(108, 4);
  run(w, 8);
  const at = [w.state[HX], w.state[HY]];
  w.tap(130, 70); // sky: nothing to stick to
  assert.equal(w.state[MODE], 0, "standing: he does not jump at nothing");
  run(w, 2);
  assert.deepEqual([w.state[HX], w.state[HY]], at, "still where he was");
  // From the roof's right end, the foot of the crane is out of reach: he leaps anyway.
  const v = WC.climber(pixels(WC.GW, WC.GH), 5);
  v.state[HX] = 100, v.state[HY] = 22;
  v.tap(150, 82);
  assert.equal(v.state[MODE], 2, "in the air");
  let flat = false;
  run(v, 6, () => (flat ||= v.state[MODE] === 3));
  assert.ok(flat, "SPLAT on the street");
  run(v, 6);
  assert.equal(v.state[MODE], 0, "back on his feet");
  assert.equal(v.busy(), false, "settled");
});

// A page for the rewinder: NOTHING / BROKE., letters 8 × 12 art px (the stage's headline, roughly).
const page = () => {
  const xs = [...[0, 1, 2, 3, 4, 5, 6].map((i) => 12 + i * 9), ...[0, 1, 2, 3, 4, 5].map((i) => 16 + i * 9)];
  const ys = xs.map((_, i) => (i < 7 ? 21 : 35));
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), w: new Float32Array(xs.length).fill(8), h: new Float32Array(xs.length).fill(12) };
};
// Rewinder slots: speed, frames of the page's past, the frame playing (-1: none), deep in the past, dinosaur, auto.
const W = 3, NF = 8, F = 9, DEEP = 12, DM = 13, AUTO = 23;

test("spin it back: meteors throw only the letters they reach; the laps rewind the page to exactly how it was, clock and all", () => {
  const w = SB.rewinder(pixels(SB.GW, SB.GH), 2, page());
  run(w, 0.2);
  const minute = w.clock();
  w.tap(13, 21); // the N of NOTHING
  run(w, 3);
  const thrown = [...w.loose].map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  assert.ok(thrown.includes(0) && !thrown.includes(12), `only letters near the hit: ${thrown}`);
  assert.ok(thrown.every((i) => w.oy[i] >= 15), "and they lie low on the page (on the clock, or at the bottom)");
  assert.ok(w.state[NF] > 30 && w.clock() > minute, "the page's past is recorded; the clock moved on");
  w.tap(120, 50); // space: a lap
  let rewound = false, after = -1;
  run(w, 6, () => (w.state[F] >= 0 ? (rewound = true) : rewound && after < 0 && (after = w.clock())));
  assert.ok(rewound, "the world spun backwards");
  assert.deepEqual([...w.ox, ...w.oy, ...w.ro].filter((v) => v), [], "every letter home, unturned");
  assert.equal(w.state[NF], 0, "the past is used up");
  assert.equal(after, minute, "the clock ran back to the minute before");
  run(w, 4);
  assert.equal(w.busy(), false, "settled");
  w.paint();
});

test("spin it back: on its own it plays the whole story once and settles with the page whole", () => {
  const w = SB.rewinder(pixels(SB.GW, SB.GH), 7, page());
  w.state[AUTO] = 0.01;
  let messy = 0, back = false;
  run(w, 12, () => ((messy = Math.max(messy, w.loose.reduce((a, b) => a + (b ? 1 : 0), 0))), (back ||= w.state[F] >= 0)));
  assert.ok(messy >= 3 && back, `meteors knocked ${messy} letters, then it rewound`);
  assert.deepEqual([...w.ox, ...w.oy].filter((v) => v), [], "whole again");
  assert.equal(w.busy(), false, "settled");
});

test("spin it back: spin too far and the dinosaurs come back; their meteor sends them off and the clock returns", () => {
  const w = SB.rewinder(pixels(SB.GW, SB.GH), 3, page());
  for (let k = 0; k < 9 && !w.state[DM]; k++) (w.tap(120, 40), run(w, 0.25));
  run(w, 2);
  assert.ok(w.state[DEEP] > 2, "deep in the past");
  assert.equal(SB.YEARS[w.clock() - 1440], "65M BC", "the clock says so");
  run(w, 4);
  assert.equal(w.state[DM], 3, "a dinosaur stands on the page");
  assert.equal(w.busy(), false, "and the scene sleeps with it there");
  w.tap(30, 40);
  run(w, 4);
  assert.equal(w.state[DM], 0, "its meteor came; it is gone");
  assert.ok(w.clock() < 1440, "the clock tells the time again");
  assert.ok(w.state[W] < 1);
});
