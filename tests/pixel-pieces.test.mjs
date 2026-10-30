// The hand-built pixel pieces (site/gallery/pieces/), headless: their stories run on plain numbers
// (no DOM), so the games in them are checked here. The welder's sparks can light the rocket's fuse
// (by collision) and the rocket flies and bursts; the rain's taps raise the storm, and shorts blow
// the sign. Each settles. Their posters, written into their stages, are current.
import test from "node:test";
import assert from "node:assert/strict";
import { pixels } from "../site/gallery/pieces/pixel-stage.ts";
import * as W from "../site/gallery/pieces/pink-sparks-burst-tap.ts";
import * as R from "../site/gallery/pieces/cyan-purple-neon-rain-falls.ts";
import { posters } from "../scripts/pixel-posters.mjs";

const run = (w, sec, each) => { for (let i = 0; i < sec * 60; i++) (w.step(1 / 60), each?.(i)); };

test("welder: a tap welds there (clamped onto the plate); sparks bounce and settle; the scene goes still", () => {
  const w = W.welder(pixels(W.GW, W.GH), 3);
  w.tap(10, 10); // far off the plate: welds at its nearest corner
  assert.deepEqual([w.state[0], w.state[1]], [75, 25]);
  let arc = false;
  run(w, 2, () => (arc ||= w.state[7] === 3));
  assert.ok(arc, "the arc strikes");
  w.paint();
  run(w, 12);
  assert.equal(w.busy(), false, "settled: nothing left moving");
});

test("welder: hot sparks landing on the fuse light it; the rocket flies, bursts, and a new one drops in", () => {
  // Weld at the plate's right edge, again and again, until a spark lights the fuse (seeded: repeatable).
  let lit = 0;
  for (let seed = 1; seed < 40 && !lit; seed++) {
    const w = W.welder(pixels(W.GW, W.GH), seed), seen = new Set();
    for (let k = 0; k < 6 && !seen.has(1); k++) (w.tap(113, 43), run(w, 2.5, () => seen.add(w.state[23])));
    if (!seen.has(1)) continue;
    lit = seed;
    run(w, 8, () => seen.add(w.state[23]));
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4], "lit, flies, bursts, a new one drops in");
    assert.equal(w.state[23], 0, "ready again");
    run(w, 6);
    assert.equal(w.busy(), false, "settled");
  }
  assert.ok(lit > 0, "some run lights the fuse");
  // The odds follow the physics: welds at the plate's right edge (next to the fuse) light it often,
  // welds at the far left never do (one weld per seeded run).
  const odds = (x, y) => {
    let n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const w = W.welder(pixels(W.GW, W.GH), seed);
      w.tap(x, y);
      let l = 0;
      run(w, 2.5, () => (l ||= w.state[23] === 1 ? 1 : 0));
      n += l;
    }
    return n;
  };
  const near = odds(113, 43), far = odds(75, 25);
  assert.ok(near >= 12 && far === 0, `near the fuse ${near}/30, far ${far}/30`);
});

test("rain: a tap pours, taps during the storm raise it, shorts dim the sign, the third blows it; then it settles", () => {
  const w = R.rain(pixels(R.GW, R.GH), 9);
  w.tap();
  assert.equal(w.state[18], 1, "level 1");
  run(w, 1);
  w.tap(), run(w, 0.4), w.tap(), run(w, 0.4), w.tap();
  assert.equal(w.state[18], 4, "level 4 after three more taps");
  let dark = 0, blew = false;
  run(w, 8, () => ((dark += w.lit() ? 0 : 1), (blew ||= w.state[20] >= 0)));
  for (let k = 0; k < 6 && !blew; k++) (w.tap(), run(w, 3, () => (blew ||= w.state[20] >= 0)));
  assert.ok(dark > 0, "the sign went dark (shorts)");
  assert.ok(blew, "the sign blew");
  run(w, 20);
  assert.equal(w.lit(), true, "lit again");
  assert.equal(w.busy(), false, "settled");
  w.paint();
});

test("the pieces' posters (between the markers in their stages) are current", async () => {
  const list = await posters();
  assert.deepEqual(list.map((p) => p.id).sort(), ["cyan-purple-neon-rain-falls", "pink-sparks-burst-tap"]);
  for (const p of list) assert.ok(p.html.includes(`<!-- poster -->${p.svg}<!-- /poster -->`), `${p.file}: run node scripts/pixel-posters.mjs`);
});
