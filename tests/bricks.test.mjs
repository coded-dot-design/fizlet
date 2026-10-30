// Brick tests (Node): collide, fx, sprite, the pad's maths and input's step-side API. Input listeners, pad, sound and embed need a browser: tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { Grid, circles, circleRect, segCircle, inRect, overlap } = await import("../src/collide.ts");
const { effects } = await import("../src/fx.ts");
const { sprites, spriteSVG, spriteURL } = await import("../src/sprite.ts");
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

test("pad: stickAt and dpadAt allocate nothing (exact hypot, no Math.hypot call)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const v = new Float64Array(2), sum = new Float64Array(2), d = new Float64Array(2);
  // The same vector as the Math.hypot form, bit for bit.
  for (const [dx, dy] of [[0.31, -0.42], [3, 4], [-0.2, 0.05], [1e-9, 0.7], [0.6, 0.6]]) {
    const m = Math.hypot(dx, dy), k = m < 0.15 ? 0 : (Math.min(1, m) - 0.15) / (1 - 0.15) / m;
    stickAt(dx, dy, v);
    assert.deepEqual([v[0], v[1]], [dx * k, dy * k]);
  }
  // One drag per call, as a pointermove handler runs it.
  const drag = () => {
    d[0] = Math.sin(++sum[1] * 0.001) * 1.3;
    d[1] = Math.cos(sum[1] * 0.0013) * 1.1;
    stickAt(d[0], d[1], v);
    sum[0] += v[0] + dpadAt(d[0], d[1]);
  };
  const run = (n) => {
    for (let i = 0; i < n; i++) drag();
  };
  run(100000); // warm up
  const minor = await minorGCs(() => run(1000000));
  console.log(`ℹ pad stickAt + dpadAt over 1M fractional drags: ${minor} young GCs`);
  assert.equal(minor, 0);
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
  const hits = new Int32Array(2); // [hits, frame]
  const frame = () => {
    // A live fx scene, not an empty pool: a blast every 8th frame keeps ~150 particles alive.
    if ((hits[1]++ & 7) === 0) fx.blast(xs[hits[1] & 63], ys[hits[1] & 63], 2);
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
  const minor = await minorGCs(() => {
    for (let i = 0; i < 200000; i++) frame();
  });
  assert.ok(hits[0] > 0);
  assert.ok(fx.live > 50, `the fx pool is populated (${fx.live} live)`);
  // Grid and fx keep every running number in typed arrays (no number crosses a call V8 may not
  // inline), so even mixed into one big frame they allocate nothing. One stray scavenge can come
  // from the test runner; a real per-frame allocation shows up as dozens.
  assert.ok(minor <= 1, `young-generation GCs over 200k frames: ${minor}`);
});

// Hardening (engineering review 2026-10-29, §8): capacities, saturation, validated inputs, bounded work.
test("collide: entity, index and query capacities are separate and saturation is counted", () => {
  // 4 entities, 6 index nodes (one per covered cell), results cut by the caller's buffer.
  const g = new Grid(10, 4, 100, 100, 6);
  assert.equal(g.cap, 4);
  assert.equal(g.nodes, 6);
  for (let i = 0; i < 4; i++) g.insert(i, 5, 5, 1); // 4 nodes, one cell each
  assert.equal(g.dropped, 0);
  g.insert(0, 10, 10, 4); // covers 4 cells, only 2 nodes left
  assert.equal(g.dropped, 2, "the index refuses nodes past its own capacity and counts them");
  const out = new Int32Array(2);
  const n = g.query(5, 5, 1, out);
  assert.equal(n, 2);
  assert.equal(g.missed, 2, "the last query says how many ids did not fit in out");
  assert.equal(g.truncated, 1, "and truncated queries are counted, never silent");
  const big = new Int32Array(8);
  assert.equal(g.query(5, 5, 1, big), 4);
  assert.equal(g.missed, 0);
  assert.equal(g.truncated, 1);
});

test("collide: inputs are validated (finite numbers, integer capacities, ids in range)", () => {
  assert.throws(() => new Grid(0, 4, 10, 10), RangeError);
  assert.throws(() => new Grid(NaN, 4, 10, 10), RangeError);
  assert.throws(() => new Grid(8, 2.5, 10, 10), RangeError);
  assert.throws(() => new Grid(8, 0, 10, 10), RangeError);
  assert.throws(() => new Grid(8, 4, Infinity, 10), RangeError);
  assert.throws(() => new Grid(8, 4, 10, 10, -1), RangeError);
  const g = new Grid(8, 4, 64, 64);
  assert.throws(() => g.resize(NaN, 10), RangeError);
  g.insert(4, 1, 1, 1); // id out of range: would alias the dedupe stamps
  g.insert(-1, 1, 1, 1);
  g.insert(1.5, 1, 1, 1);
  g.insert(0, NaN, 1, 1);
  g.insert(0, 1, Infinity, 1);
  g.insert(0, 1, 1, -2);
  assert.equal(g.rejected, 6, "bad inserts are refused and counted");
  const out = new Int32Array(4);
  assert.equal(g.query(1, 1, 4, out), 0, "nothing was indexed");
  assert.equal(g.query(NaN, 1, 4, out), 0);
  assert.equal(g.rejected, 7, "a non-finite query is counted too");
});

test("fx: a full pool stops the blast's work and counts the drops", () => {
  const fx = effects({ cap: 8 });
  fx.blast(0, 0, 1); // 5 + 15 + 4 = 24 wanted, 8 fit
  assert.equal(fx.live, 8);
  assert.equal(fx.dropped, 16, "every refused particle is counted");
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) fx.blast(0, 0, 1e6); // 5,000,010 debris wanted each: none can fit
  const ms = performance.now() - t0;
  assert.ok(ms < 20, `a full pool does no per-particle work (10 huge blasts took ${ms.toFixed(1)} ms)`);
  fx.blast(0, 0, 200); // 1,010 debris wanted
  assert.equal(fx.dropped, 16 + 10 * (5 + 5000010 + 4) + 5 + 1010 + 4);
  assert.equal(fx.live, 8);
});

test("fx: inputs are validated (capacities, finite numbers, a life that ends)", () => {
  assert.throws(() => effects({ cap: 0 }), RangeError);
  assert.throws(() => effects({ cap: 1.5 }), RangeError);
  assert.throws(() => effects({ scorch: -1 }), RangeError);
  assert.throws(() => effects({ colors: Array(257).fill("#000") }), RangeError);
  const fx = effects({ cap: 16 });
  assert.equal(fx.spawn(0, 0, 0, 0, 0, 4, NaN, 0), false, "a particle that never dies would leak the pool");
  assert.equal(fx.spawn(0, NaN, 0, 0, 0, 4, 1, 0), false);
  fx.blast(NaN, 0, 1);
  fx.blast(0, 0, Infinity);
  assert.equal(fx.live, 0);
  assert.equal(fx.shake, 0, "a rejected blast has no effect");
  assert.ok(fx.dropped >= 4);
  const nos = effects({ cap: 64, scorch: 0 });
  nos.blast(0, 0, 1);
  assert.ok(nos.live > 0, "scorch: 0 turns scorch marks off");
});

test("fx: a live, populated scene (emitting every frame) allocates nothing", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const fx = effects({ cap: 300 });
  const xs = new Float64Array(8);
  for (let i = 0; i < 8; i++) xs[i] = i * 80;
  const peak = new Float64Array(2); // [sum of live, frames]
  const frame = (f) => {
    // A blast every 4th frame plus a pop word each frame: the pool stays busy and often full.
    if (f % 4 === 0) fx.blast(xs[f & 7], 200, 1 + (f & 3));
    fx.word(xs[(f >> 1) & 7], 100, f % 5, f & 7);
    fx.kick(0.5);
    fx.step(1 / 60);
    peak[0] += fx.live;
    peak[1]++;
  };
  for (let f = 0; f < 20000; f++) frame(f);
  peak[0] = peak[1] = 0;
  const minor = await minorGCs(() => {
    for (let f = 0; f < 200000; f++) frame(f);
  });
  const avg = peak[0] / peak[1];
  assert.ok(avg > 150, `the scene is populated (average live particles: ${avg.toFixed(0)})`);
  assert.ok(fx.dropped > 0, "and saturated: drops happen and are counted");
  console.log(`fx live scene: ${avg.toFixed(0)} particles alive on average, ${fx.dropped} dropped, ${minor} young GCs`);
  assert.ok(minor <= 1, `young-generation GCs over 200k live fx frames: ${minor}`);
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
  const def = { frames: ["x"], colors: { x: "#f00" }, outline: "rim" }, pals = [{ rim: "#eaf8ff" }];
  const svg = spriteSVG(def, 0, pals);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3" viewBox="0 0 3 3" shape-rendering="crispEdges">'));
  assert.ok(svg.includes('<rect x="1" y="1" width="1" height="1" fill="#f00"/>'));
  assert.ok(spriteURL(def, 0, pals).startsWith("data:image/svg+xml,%3Csvg"));
  assert.equal(sp.svg, undefined, "the SVG half stands alone (spriteSVG), so canvas-only scenes leave it out");
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

test("sprite: an id that names no sprite throws, never another sprite's tile", () => {
  // Before the fix the cache key of an unknown id came out as 0, so once sprite 0 was baked a typo
  // (or an id past the end) silently returned sprite 0's tile, and draw() painted nothing.
  const sp = sprites({ a: { frames: ["1"], colors: { 1: "#f00" } }, b: { frames: ["11"], colors: { 1: "#0f0" } } }, { canvas: fakeCanvas });
  const a = sp.tile("a");
  assert.equal(sp.tile(0), a);
  assert.notEqual(sp.tile("b"), a);
  const ctx = { imageSmoothingEnabled: true, drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {} };
  for (const bad of ["nope", "toString", 2, -1, 0.5, NaN]) {
    assert.throws(() => sp.tile(bad), RangeError, `tile(${String(bad)})`);
    assert.throws(() => sp.draw(ctx, bad, 0, 0, 0), RangeError, `draw(${String(bad)})`);
  }
  assert.equal(sp.baked, 2, "nothing baked for a bad id");
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
  const minor = await minorGCs(() => {
    for (let i = 0; i < 100000; i++) frame();
  });
  assert.equal(sp.baked, 12, "hull 2 frames + turret 1, x 2 scales x 2 palettes");
  assert.equal(minor, 0, `young-generation GCs over 3.2M draws: ${minor}`);
});

test("input: intents resolve once; id() gives a step a number, and a typo throws at setup", async () => {
  globalThis.addEventListener ??= () => {};
  const { createEngine } = await import("../src/index.ts");
  const { controls } = await import("../src/input.ts");
  const target = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100 }) };
  const e = createEngine();
  // 64 intents: by name or by number, a lookup is one Map read (no scan of the names).
  const keys = Object.fromEntries(Array.from({ length: 64 }, (_, i) => ["i" + i, ["Key" + i]]));
  const c = controls(e, { target, keys: { ...keys, fire: ["Space"], left: ["KeyA"], right: ["KeyD"] } });
  const FIRE = c.id("fire"), LEFT = c.id("left"), RIGHT = c.id("right");
  assert.deepEqual([c.id("i0"), c.id("i63"), FIRE, RIGHT], [0, 63, 64, 66]);
  assert.throws(() => c.id("fier"), /fizlet\/input: no fier/);
  const seen = [];
  e.add({ step: () => void seen.push([c.hit(FIRE), c.hit("fire"), c.down(FIRE), c.down("fire"), c.axis(LEFT, RIGHT), c.axis("left", "right")]) });
  c.press("fire");
  e.advance(1 / 60);
  c.press("right");
  e.advance(1 / 60);
  c.press("fire", false);
  e.advance(1 / 60);
  assert.deepEqual(seen, [
    [true, true, true, true, 0, 0],
    [false, false, true, true, 1, 1],
    [false, false, false, false, 1, 1],
  ], "a handle and its name read the same");
  assert.equal(c.down("fier"), false, "a name that is no intent still reads false (no throw in a step)");
  if (typeof gc === "function") {
    const n = new Int32Array(1);
    e.add({ step: () => void (n[0] += +c.hit(FIRE) + +c.down(RIGHT) + c.axis(LEFT, RIGHT, 0)) });
    for (let i = 0; i < 20000; i++) e.advance(1 / 60);
    const minor = await minorGCs(() => {
      for (let i = 0; i < 1000000; i++) e.advance(1 / 60);
    });
    console.log(`ℹ input by number over 1M frames (65 intents): ${minor} young GCs`);
    assert.ok(minor <= 3, `young-generation GCs over 1M frames: ${minor}`); // the bound of the test below
  }
  e.destroy();
});

test("input: hit() and down() in a step allocate nothing", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  // No DOM in node: listeners go nowhere; the step-side API is what's measured (presses and their
  // edges are covered in tests/browser.mjs).
  globalThis.addEventListener ??= () => {};
  const { createEngine } = await import("../src/index.ts");
  const { controls } = await import("../src/input.ts");
  const target = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100 }) };
  const e = createEngine();
  const c = controls(e, { target, keys: { fire: ["Space"], left: ["KeyA", "ArrowLeft"] } });
  const n = new Int32Array(1);
  e.add({
    step: () => {
      if (c.hit("fire") || c.pointer.hit || c.down("left")) n[0]++;
      n[0] += c.axis("left", "fire", 0) + 1;
    },
  });
  for (let i = 0; i < 20000; i++) e.advance(1 / 60);
  const minor = await minorGCs(() => {
    for (let i = 0; i < 1000000; i++) e.advance(1 / 60);
  });
  e.destroy();
  assert.ok(n[0] > 1000000, "it stepped");
  // 0.2.4's input reads 0-2 here too (strays from the test above); boxing one number per frame
  // (reading engine.time in read) showed as 7-9.
  assert.ok(minor <= 3, `young-generation GCs over 1M frames: ${minor}`);
});

test("input: press() and steer() wake a settled engine (on-screen keys, fizlet/pad)", async () => {
  // A pad key is [data-fizlet-ignore], so its pointerdown never reaches input's own wake: before
  // the fix a tap on a settled engine was latched but never stepped until something else woke it.
  globalThis.addEventListener ??= () => {};
  const { createEngine } = await import("../src/index.ts");
  const { controls } = await import("../src/input.ts");
  const target = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100 }) };
  const e = createEngine({ settle: 0.1 });
  const c = controls(e, { target, keys: { fire: ["Space"] } });
  let fired = 0;
  e.add({ step: () => c.hit("fire") && fired++ });
  e.start();
  const sleep = () => {
    for (let i = 0; i < 12 && e.running; i++) e.advance(1 / 60);
    assert.deepEqual(e.paused, ["settled"], "nothing busy: it settles");
  };
  sleep();
  c.press("fire");
  assert.equal(e.running, true, "press() wakes it");
  e.advance(1 / 60);
  assert.equal(fired, 1, "and the press is stepped");
  c.press("fire", false);
  sleep();
  c.steer(1, 0);
  assert.equal(e.running, true, "steer() wakes it");
  assert.equal(c.axis("left", "right", 0), 1);
  sleep();
  c.press("nope");
  assert.deepEqual(e.paused, ["settled"], "an unknown intent does nothing");
  e.destroy();
});

// Gravity and named kinds (phase 2: page interactions).
const { emitter, KINDS } = await import("../src/fx.ts");

test("fx: gravity pulls each kind by its share; kinds are data", () => {
  const fx = effects({ cap: 64, gravity: 300 }), { ids, emit } = emitter(fx, KINDS);
  assert.deepEqual(ids, { bubble: 6, spark: 7, drip: 8, debris: 9 });
  fx.gravity = NaN; // ignored
  emit(ids.drip, 0, 0, 1);
  emit(ids.bubble, 0, 0, 1);
  assert.equal(fx.live, 2);
  const { f } = fx.raw, VY = f[3];
  for (let i = 0; i < 20; i++) fx.step(1 / 60);
  assert.ok(VY[0] > 50, `a drip falls (vy ${VY[0]})`);
  assert.ok(VY[1] < 0, `a bubble floats up (vy ${VY[1]})`);
  // Without gravity the blast is as before: its debris only slows down.
  const calm = effects({ cap: 64 });
  calm.blast(0, 0, 1);
  const v0 = calm.raw.f[3][5];
  calm.step(1 / 60);
  assert.ok(Math.abs(calm.raw.f[3][5]) <= Math.abs(v0));
});

test("fx: emit is bounded, validated, and a second emitter adds after the first", () => {
  const fx = effects({ cap: 10 }), a = emitter(fx, { bubble: KINDS.bubble });
  a.emit(a.ids.bubble, 5, 5, 4, 1, 3);
  assert.equal(fx.live, 4);
  const cols = fx.raw.col.slice(0, 4);
  assert.ok(cols.every((c) => c >= 1 && c <= 3), `colours from the range (${cols})`);
  a.emit(a.ids.bubble, 0, 0, 1e9);
  assert.equal(fx.live, 10);
  assert.equal(fx.dropped, 1e9 - 6, "the rest are counted, not looped over");
  a.emit(a.ids.bubble, NaN, 0, 3);
  a.emit(0, 0, 0, 3); // ids 0-5 are the blast's own parts, not emitter kinds
  a.emit(a.ids.bubble, 0, 0, Infinity);
  assert.equal(fx.dropped, 1e9 - 6 + 3);
  const b = emitter(fx, { spark: KINDS.spark });
  assert.deepEqual(b.ids, { spark: 7 });
  assert.throws(() => emitter(fx, { bad: { ...KINDS.spark, life: [0, 0] } }), RangeError, "a life that never ends");
  assert.throws(() => emitter(fx, { bad: { ...KINDS.spark, shape: "blob" } }), RangeError);
  assert.equal(effects({ gravity: NaN }).raw.st[4], 0, "non-finite gravity is ignored");
});

test("fx: emitting kinds under gravity allocates nothing", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const fx = effects({ cap: 400, gravity: 240 }), { ids, emit } = emitter(fx, KINDS), s = new Int32Array(1);
  const frame = () => {
    const i = s[0]++;
    emit(ids.bubble + (i & 3), (i * 13) % 640, 100, 3, i & 3, 2, 1.5);
    fx.step(1 / 60);
  };
  for (let i = 0; i < 20000; i++) frame();
  gc();
  const minor = await minorGCs(() => {
    for (let i = 0; i < 200000; i++) frame();
  });
  assert.ok(fx.live > 50, `populated (${fx.live})`);
  assert.ok(minor <= 1, `young-generation GCs over 200k frames: ${minor}`);
});

test("K5: no plain-sqrt distance in a brick; the exact hypot (fizlet/steer) is the one place", async () => {
  // Math.sqrt(x * x + y * y) differs from Math.hypot in the last bit for ~40% of inputs, and a
  // replay that keeps every bit needs the same distance everywhere (fizlet-engine context/06 K5).
  const { readdirSync, readFileSync } = await import("node:fs");
  const dirs = ["src", "src/kernel", "src/ui"], plain = /Math\.sqrt\(\s*([\w.[\]!]+)\s*\*\s*\1\s*\+\s*([\w.[\]!]+)\s*\*\s*\2\s*\)/;
  const found = [];
  for (const d of dirs)
    for (const f of readdirSync(d).filter((f) => f.endsWith(".ts")))
      readFileSync(`${d}/${f}`, "utf8").split("\n").forEach((l, i) => {
        if (plain.test(l) && !(f === "steer.ts" && /\bp \* p \+ q \* q\b/.test(l))) found.push(`${d}/${f}:${i + 1}`);
      });
  assert.deepEqual(found, [], "use hypot from ./steer");
});
