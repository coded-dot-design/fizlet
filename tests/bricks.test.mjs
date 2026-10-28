// Brick tests (Node): collide and fx. Input, sound and embed need a browser: tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver, constants } from "node:perf_hooks";

const { Grid, circles, circleRect, segCircle, inRect, overlap } = await import("../src/collide.ts");
const { effects } = await import("../src/fx.ts");

test("collide: shape tests", () => {
  const X = new Float64Array([0, 9, 30]), Y = new Float64Array(3), R = new Float64Array([5, 5, 5]);
  assert.equal(overlap(X, Y, R, 0, 1), true);
  assert.equal(overlap(X, Y, R, 0, 2), false);
  assert.equal(circles(0, 0, 5, 9, 0, 5), true);
  assert.equal(circles(0, 0, 5, 11, 0, 5), false);
  assert.equal(circleRect(5, 5, 2, 6, 0, 10, 10), true);
  assert.equal(circleRect(0, 0, 2, 6, 0, 10, 10), false);
  assert.equal(inRect(3, 3, 0, 0, 5, 5), true);
  // A fast shot passing straight through a target still hits (no tunnelling).
  const t = segCircle(0, 0, 100, 0, 50, 0, 5);
  assert.ok(t > 0.4 && t < 0.5);
  assert.equal(segCircle(0, 10, 100, 10, 50, 0, 5), -1);
  assert.equal(segCircle(50, 0, 60, 0, 50, 0, 5), 0, "starting inside counts as an immediate hit");
});

test("collide: the grid finds neighbours once, stays bounded", () => {
  const g = new Grid(32, 16, 320, 240);
  g.insert(0, 10, 10, 4);
  g.insert(1, 40, 10, 30); // spans several cells
  g.insert(2, 300, 200, 4);
  const out = new Int32Array(8);
  const n = g.query(20, 10, 20, out);
  assert.deepEqual([...out.slice(0, n)].sort(), [0, 1], "each id once, far ones skipped");
  g.clear();
  assert.equal(g.query(20, 10, 20, out), 0);
  for (let i = 0; i < 200; i++) g.insert(i % 16, 160, 120, 200);
  assert.ok(g.dropped > 0, "a full node store refuses inserts instead of growing");
});

test("fx: blast spawns, particles age out, the pool is capped", () => {
  const fx = effects({ cap: 40 });
  fx.blast(100, 100, 1);
  assert.ok(fx.live > 10);
  assert.ok(fx.shake > 0);
  fx.word(10, 10, 0, 1);
  for (let i = 0; i < 100; i++) fx.blast(0, 0, 2);
  assert.equal(fx.live, 40, "never more than cap");
  for (let i = 0; i < 200; i++) fx.step(1 / 60);
  assert.equal(fx.live, 0, "everything ages out");
  assert.equal(fx.shake, 0);
});

test("collide + fx: near-zero allocation while stepping", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const g = new Grid(32, 64, 640, 480), out = new Int32Array(64), fx = effects({ cap: 300 });
  const xs = new Float64Array(64), ys = new Float64Array(64), rs = new Float64Array(64).fill(12);
  for (let i = 0; i < 64; i++) (xs[i] = (i * 9) % 640), (ys[i] = (i % 8) * 18);
  const hits = new Int32Array(1);
  const frame = () => {
    g.clear();
    for (let i = 0; i < 64; i++) g.add(xs, ys, rs, i);
    for (let i = 0; i < 64; i++) {
      const n = g.near(xs, ys, rs, i, out);
      for (let k = 0; k < n; k++) if (out[k] !== i && overlap(xs, ys, rs, i, out[k])) hits[0]++;
      xs[i] = (xs[i] + 1.5) % 640;
    }
    fx.step(1 / 60);
  };
  for (let i = 0; i < 20000; i++) frame();
  gc();
  let minor = 0;
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
  });
  obs.observe({ entryTypes: ["gc"] });
  for (let i = 0; i < 200000; i++) frame();
  await new Promise((r) => setTimeout(r, 50));
  obs.disconnect();
  assert.ok(hits[0] > 0);
  // The bricks never allocate on their own (each passes 0 alone). Mixed into one big frame, V8's
  // inlining limits can box a few numbers: well under one young GC per 2,000 frames. A real
  // per-frame allocation (an array, an object, a closure) shows up as thousands here.
  assert.ok(minor <= 100, `young-generation GCs over 200k frames: ${minor}`);
});
