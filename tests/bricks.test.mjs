// Brick tests (Node): collide, fx, sprite and the pad's maths. Input, pad, sound and embed need a browser: tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceObserver, constants } from "node:perf_hooks";

const { Grid, circles, circleRect, segCircle, inRect, overlap } = await import("../src/collide.ts");
const { effects } = await import("../src/fx.ts");
const { sprites } = await import("../src/sprite.ts");
const { sherman } = await import("./fixtures/sherman.mjs");

// A fake canvas for Node: fillRect paints a grid of colour strings (integer transforms only).
function fakeCanvas(w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill(""));
  const ctx = { fillStyle: "", k: 1, draws: 0, setTransform(k) { this.k = k; },
    fillRect(x, y, ww, hh) { const k = this.k; for (let j = y * k; j < (y + hh) * k; j++) for (let i = x * k; i < (x + ww) * k; i++) if (px[j] && i >= 0 && i < w) px[j][i] = this.fillStyle; } };
  return { width: w, height: h, px, getContext: () => ctx };
}
const { stickAt, dpadAt } = await import("../src/pad.ts");

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

test("pad: the stick has a dead zone, creeps, and clamps to the unit circle", () => {
  const v = new Float64Array(2);
  stickAt(0.1, 0, v);
  assert.deepEqual([...v], [0, 0], "inside the dead zone nothing moves");
  stickAt(0.3, 0, v);
  assert.ok(v[0] > 0 && v[0] < 0.3, "a light push still creeps (rescaled past the dead zone)");
  stickAt(3, 4, v);
  assert.ok(Math.abs(Math.hypot(v[0], v[1]) - 1) < 1e-9, "a drag past the rim is full speed");
  assert.ok(Math.abs(v[0] / v[1] - 0.75) < 1e-9, "direction kept");
  stickAt(0, -1, v);
  assert.equal(v[1], -1);
});

test("pad: the d-pad reads eight equal sectors", () => {
  const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8;
  assert.equal(dpadAt(0.1, 0.1), 0, "dead zone");
  assert.equal(dpadAt(0, -1), UP);
  assert.equal(dpadAt(0, 1), DOWN);
  assert.equal(dpadAt(-1, 0), LEFT);
  assert.equal(dpadAt(1, 0), RIGHT);
  assert.equal(dpadAt(0.7, -0.7), UP | RIGHT);
  assert.equal(dpadAt(-0.7, 0.7), DOWN | LEFT);
  // Sector borders sit at 22.5° either side of an axis.
  const at = (deg) => dpadAt(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));
  assert.equal(at(20), RIGHT);
  assert.equal(at(25), RIGHT | DOWN);
  assert.equal(at(65), RIGHT | DOWN);
  assert.equal(at(70), DOWN);
  assert.equal(at(-160), LEFT);
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

test("sprite: rows + colour map, roles filled by palettes, frames wrap, pivot", () => {
  const sp = sprites({
    dot: { frames: ["ab", "b."], colors: { a: "team", b: "#000" } },
    blink: { frames: [["x"], ["."]], colors: { x: "hazard" }, ax: 0, ay: 0 },
  }, { palettes: [{ team: "#39ffb0", hazard: "#ff2b4e" }, { team: "#ff5c8f" }, { "*": "#fff" }], canvas: fakeCanvas });
  assert.equal(sp.ids.dot, 0);
  assert.equal(sp.ids.blink, 1);
  assert.equal(sp.w[0], 2);
  assert.equal(sp.h[0], 2);
  assert.deepEqual(sp.tile("dot").px, [["#39ffb0", "#000"], ["#000", ""]]);
  assert.deepEqual(sp.tile("dot", 0, 1, 1).px[0], ["#ff5c8f", "#000"], "palette 1 re-tints the team role only");
  assert.deepEqual(sp.tile("dot", 0, 1, 2).px[0], ["#fff", "#fff"], "* is a flash: every pixel one colour");
  assert.equal(sp.tile("blink", 0, 1, 1).px[0][0], "#ff2b4e", "roles a palette leaves out come from palette 0");
  assert.equal(sp.tile("blink", 3), sp.tile("blink", 1), "frames wrap");
  assert.equal(sp.tile("blink", -1), sp.tile("blink", 1));
  const big = sp.tile("dot", 0, 2.5);
  assert.equal(big.width, 6, "baked at the next whole scale");
  assert.equal(big.px[5][5], "");
  assert.equal(big.px[0][5], "#000");
});

test("sprite: outline rim, SVG for page characters", () => {
  const sp = sprites({ p: { frames: ["x"], colors: { x: "#f00" }, outline: "rim" } }, { palettes: [{ rim: "#eaf8ff" }], canvas: fakeCanvas });
  const t = sp.tile("p");
  assert.equal(t.width, 3);
  assert.deepEqual(t.px[1], ["#eaf8ff", "#f00", "#eaf8ff"]);
  const svg = sp.svg("p");
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3" viewBox="0 0 3 3" shape-rendering="crispEdges">'));
  assert.ok(svg.includes('<rect x="1" y="1" width="1" height="1" fill="#f00"/>'));
  assert.ok(sp.url("p").startsWith("data:image/svg+xml,%3Csvg"));
});

test("sprite: the cache bakes once per key and is capped", () => {
  const sp = sprites({ a: { frames: [["1"], ["1"], ["1"], ["1"]], colors: { 1: "team" } } }, { cap: 5, palettes: [{}, {}, {}], canvas: fakeCanvas });
  const ctx = { imageSmoothingEnabled: true, drawImage() { this.n = (this.n || 0) + 1; }, save() {}, restore() {}, translate() {}, rotate() {} };
  for (let i = 0; i < 100; i++) sp.draw(ctx, 0, 0, 10, 10);
  assert.equal(sp.baked, 1, "one bake, then blits");
  assert.equal(ctx.n, 100);
  assert.equal(ctx.imageSmoothingEnabled, false);
  for (let f = 0; f < 4; f++) for (let p = 0; p < 3; p++) for (const s of [1, 2, 3]) sp.draw(ctx, "a", f, 0, 0, 0.3, s, p);
  assert.equal(sp.size, 5, "never more than cap");
  assert.equal(sp.baked, 4 * 3 * 3 + 0, "every key baked once: 36 keys through a 5-tile cache");
  sp.clear();
  assert.equal(sp.size, 0);
});

test("sprite: the Sherman tank fixture is the original tile size and pivot", () => {
  const sp = sprites(sherman, { palettes: [{ team: "#39ffb0" }, { team: "#fff8d4" }], canvas: fakeCanvas });
  const hull = sp.tile("hull");
  assert.equal(hull.width, 32);
  assert.equal(hull.height, 32);
  assert.equal(hull.px[16][20], "#06c4ff", "the cross");
  assert.equal(hull.px[6][4], "#8573ee", "frame 0 tread link");
  assert.equal(sp.tile("hull", 1).px[6][4], "#151020", "frame 1: the links moved");
  assert.equal(hull.px[16][6], "#39ffb0", "body is the team colour");
  assert.equal(sp.tile("turret", 0, 1, 1).px[8][1], "#fff8d4", "turret flash as a palette");
  const ctx = { drawImage(t, x, y, w, h) { this.at = [x, y, w, h]; } };
  sp.draw(ctx, "hull", 0, 100, 50);
  assert.deepEqual(ctx.at, [84, 34, 32, 32], "drawn at -16, -16 like tankSprites");
});

test("sprite: draw allocates nothing once baked", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const sp = sprites(sherman, { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }], canvas: fakeCanvas });
  const ctx = { imageSmoothingEnabled: false, drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {} };
  const a = new Float64Array(1);
  const frame = () => {
    for (let i = 0; i < 32; i++) sp.draw(ctx, i & 1, (i >> 1) & 1, i * 7.5, 40.25, a[0] + i, 1 + ((i >> 2) & 1), (i >> 3) & 1);
    a[0] += 0.01;
  };
  for (let i = 0; i < 20000; i++) frame();
  gc();
  let minor = 0;
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
  });
  obs.observe({ entryTypes: ["gc"] });
  for (let i = 0; i < 100000; i++) frame();
  await new Promise((r) => setTimeout(r, 50));
  obs.disconnect();
  assert.equal(sp.baked, 12, "hull 2 frames + turret 1, x 2 scales x 2 palettes");
  assert.equal(minor, 0, `young-generation GCs over 3.2M draws: ${minor}`);
});
