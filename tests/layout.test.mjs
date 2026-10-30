// fizlet/layout in Node: the Barnes-Hut pass matches the exact pairwise sum at theta 0 and stays
// close at the default; a graph settles (links near their length, no node on another) and then the
// engine sleeps; runs replay bit for bit; reduced motion lands on exactly the animated run's rest;
// pin, free and heat; fixed capacity; and a hot run allocates nothing. Pixels: tests/layout.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { layout } = await import("../src/layout.ts");
const { hypot } = await import("../src/steer.ts");

/** A ring of `k` nodes with a spoke to a hub, plus a tail: cycles, a hub and leaves. */
function graph(e, o = {}) {
  const k = o.k ?? 24, lay = layout(e, { cap: k + 8, motion: true, ...o });
  for (let i = 0; i < k + 6; i++) lay.add();
  for (let i = 0; i < k; i++) lay.link(i, (i + 1) % k);
  for (let i = 0; i < k; i += 4) lay.link(i, k);
  for (let i = k; i < k + 5; i++) lay.link(i, i + 1);
  return lay;
}
const frames = (e, n) => { for (let i = 0; i < n; i++) e.advance(1 / 60); };
const until = (e, lay, max = 2000) => { let f = 0; while (!lay.resting && f < max) e.advance(1 / 60), f++; return f; };

test("layout: Barnes-Hut at theta 0 is the exact pairwise sum; at 0.9 within a few percent", (t) => {
  const run = (theta) => {
    const e = createEngine(), lay = layout(e, { cap: 64, theta, gravity: 0, motion: true, still: 0 });
    for (let i = 0; i < 64; i++) lay.add();
    const x0 = Float64Array.from(lay.x), y0 = Float64Array.from(lay.y);
    e.advance(1 / 60); // one tick, no links: repulsion only
    return { dx: lay.x.map((v, i) => v - x0[i]), dy: lay.y.map((v, i) => v - y0[i]), x0, y0, alpha: lay.alpha };
  };
  const exact = run(0), bh = run(0.9);
  // The same tick by brute force: v_i = -Σ_j (x_j - x_i) · charge · alpha / max(1, d²), then × keep.
  // alpha starts at 1 and cools once before the forces: this tick's alpha is 1 - decay.
  const w = 30 * (1 - (1 - 0.001 ** (1 / 300))), keep = 0.6;
  let worst = 0, err = 0, norm = 0;
  for (let i = 0; i < 64; i++) {
    let fx = 0, fy = 0;
    for (let j = 0; j < 64; j++) {
      if (j === i) continue;
      const dx = exact.x0[j] - exact.x0[i], dy = exact.y0[j] - exact.y0[i];
      const d2 = Math.max(1, dx * dx + dy * dy);
      fx -= (dx * w) / d2;
      fy -= (dy * w) / d2;
    }
    worst = Math.max(worst, Math.abs(fx * keep - exact.dx[i]), Math.abs(fy * keep - exact.dy[i]));
    err += hypot(bh.dx[i] - exact.dx[i], bh.dy[i] - exact.dy[i]);
    norm += hypot(exact.dx[i], exact.dy[i]);
  }
  t.diagnostic(`theta 0 vs brute force: worst ${worst.toExponential(1)} px; theta 0.9 vs exact: ${((100 * err) / norm).toFixed(2)}% of the displacement`);
  assert.ok(exact.alpha > 0 && worst < 1e-12, `theta 0 matches brute force (worst ${worst})`);
  assert.ok(err / norm < 0.05, `theta 0.9 within 5% of exact: ${((100 * err) / norm).toFixed(2)}%`);
});

test("layout: a graph settles with links near their length, then the engine sleeps", (t) => {
  const e = createEngine({ settle: 0.5 }), lay = graph(e);
  e.start();
  const steps = until(e, lay);
  assert.ok(lay.resting && steps <= 300, `rests within the 300-tick cooling: ${steps} steps`);
  assert.equal(lay.alpha, 0);
  let off = 0;
  for (let k = 0; k < 24; k++) off = Math.max(off, Math.abs(hypot(lay.x[(k + 1) % 24] - lay.x[k], lay.y[(k + 1) % 24] - lay.y[k]) - 40));
  assert.ok(off < 20, `ring links within 20 px of 40: worst ${off.toFixed(1)} px`);
  let close = Infinity;
  for (let i = 0; i < lay.size; i++) for (let j = i + 1; j < lay.size; j++) close = Math.min(close, hypot(lay.x[i] - lay.x[j], lay.y[i] - lay.y[j]));
  assert.ok(close > 10, `no node on another: closest pair ${close.toFixed(1)} px`);
  t.diagnostic(`30 nodes, 35 links: at rest after ${steps} steps; ring links within ${off.toFixed(1)} px of 40; closest pair ${close.toFixed(1)} px`);
  frames(e, 31);
  assert.ok(e.paused.includes("settled"), "nothing busy: the engine settles");
  assert.ok(lay.x.every((v) => Number.isFinite(v)));
  lay.heat();
  assert.ok(e.running && !lay.resting, "heat() wakes it");
  e.destroy();
});

test("layout: a run replays bit for bit; reduced motion lands exactly where the animated run rests", () => {
  const rest = (motion) => {
    const e = createEngine(), lay = graph(e, { motion });
    const steps = until(e, lay);
    return { steps, x: Array.from(lay.x), y: Array.from(lay.y) };
  };
  const a = rest(true), b = rest(true), still = rest(false);
  assert.deepEqual(a, b, "replay");
  assert.equal(still.steps, 1, "reduced motion: one step");
  assert.deepEqual([still.x, still.y], [a.x, a.y], "the same rest, bit for bit");
});

test("layout: pin holds a node, the rest flows round it; free lets go; nearest and bounds", () => {
  const e = createEngine({ settle: 0.5 }), lay = graph(e);
  e.start();
  until(e, lay);
  frames(e, 31);
  assert.ok(e.paused.includes("settled"));
  const before = lay.x[25];
  lay.pin(24, 300, -200);
  assert.ok(e.running && lay.alpha >= 0.3, "a pin warms it up and wakes the engine");
  until(e, lay);
  assert.deepEqual([lay.x[24], lay.y[24]], [300, -200], "pinned");
  assert.notEqual(lay.x[25], before, "its neighbours followed");
  assert.equal(lay.nearest(301, -199, 5), 24);
  assert.equal(lay.nearest(5000, 5000, 5), -1);
  const b = lay.bounds(new Float64Array(4));
  assert.ok(b[2] >= 300 && b[1] <= -200, `bounds hold the pinned node: ${[...b]}`);
  lay.free(24);
  until(e, lay);
  assert.notEqual(lay.x[24], 300, "free: it drifts back");
  lay.pin(24, NaN, 0);
  lay.pin(99, 0, 0);
  assert.ok(lay.x.every((v) => Number.isFinite(v)), "bad pins are ignored");
  e.destroy();
});

test("layout: fixed capacity; bad links refused; no Math.hypot", () => {
  const e = createEngine(), lay = layout(e, { cap: 3, links: 2, motion: true });
  assert.deepEqual([lay.add(), lay.add(), lay.add(), lay.add()], [0, 1, 2, -1], "cap nodes");
  assert.deepEqual([lay.link(0, 0), lay.link(0, 7), lay.link(0, 1), lay.link(1, 2), lay.link(0, 2)], [-1, -1, 0, 1, -1], "self, missing, full");
  const twins = layout(e, { cap: 3, motion: true });
  twins.add(5, 5), twins.add(5, 5), twins.add(5, 5);
  frames(e, 400);
  assert.ok(twins.x.every(Number.isFinite), "nodes on one spot stay finite");
  e.destroy();
  assert.doesNotMatch(readFileSync("src/layout.ts", "utf8"), /Math\.hypot\(/);
});

test("layout: zero allocation across 100k hot steps (48 nodes, 60 links, kept warm)", async (t) => {
  const minors = async (on) => {
    const e = createEngine({ maxSteps: 1 }), lay = graph(e, { k: 40 });
    e.add({ step() { if (on) lay.heat(); } });
    if (!on) lay.step = () => {};
    frames(e, 2000);
    const minor = await minorGCs(() => frames(e, 100000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withLayout = await minors(true);
  t.diagnostic(`young GCs over 100k steps (best of 3 windows): bare ${bare}, with layout ${withLayout}`);
  assert.ok(withLayout <= bare + 1, `young-generation GCs over 100k steps: ${withLayout} with layout, ${bare} bare`);
});
