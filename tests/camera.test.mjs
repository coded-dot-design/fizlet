// fizlet/camera in Node: easing, settling, contain, screen<->world, reduced motion (motion: false),
// zero allocation while it eases. The DOM half (ledger writes, Recall exact, the page never scrolls
// sideways, prefers-reduced-motion) is tests/camera.mjs in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine, STEP } = await import("../src/kernel/index.ts");
const { camera, zoomAt, flyTo, fit, toScreen } = await import("../src/camera.ts");

// Just enough of an element for the ledger: inline style properties and attributes.
function stage(w = 800, h = 400) {
  const props = new Map(), attrs = new Map();
  const style = {
    getPropertyValue: (p) => props.get(p) ?? "",
    getPropertyPriority: () => "",
    setProperty: (p, v) => (v ? props.set(p, v) : props.delete(p)),
    removeProperty: (p) => props.delete(p),
    get cssText() {
      return [...props].map(([k, v]) => `${k}: ${v};`).join(" ");
    },
  };
  return {
    style, props, parentElement: null,
    hasAttribute: (n) => attrs.has(n), getAttribute: (n) => attrs.get(n) ?? null,
    setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n),
    getBoundingClientRect: () => ({ width: w, height: h }),
  };
}
const run = (e, sec) => {
  for (let t = 0; t < sec; t += 1 / 60) e.advance(1 / 60);
};

test("camera: zoomAt eases in about a fixed point, settles exactly, home gives the page back", () => {
  const e = createEngine({ settle: 0.2 }), el = stage(), cam = camera(e, el), out = new Float64Array(2);
  e.start();
  zoomAt(cam, 200, 100, 2);
  run(e, 0.1);
  assert.ok(cam.moving && cam.zoom > 1 && cam.zoom < 2, `eases (${cam.zoom})`);
  // The zoom point stays put on screen the whole way.
  toScreen(cam, 200, 100, out);
  assert.ok(Math.abs(out[0] - 200) < 1e-6 && Math.abs(out[1] - 100) < 1e-6, `${out}`);
  run(e, 2);
  assert.equal(cam.moving, false);
  assert.equal(cam.zoom, 2, "lands exactly on the target");
  assert.equal(el.props.get("transform"), "translate(-200.00px,-100.00px) scale(2.0000)");
  assert.equal(el.props.get("transform-origin"), "0 0");
  run(e, 0.5);
  assert.ok(e.paused.includes("settled"), "the engine sleeps once the camera rests");
  cam.home();
  assert.equal(e.running, true, "a move wakes it");
  run(e, 2);
  assert.equal(cam.zoom, 1);
  assert.equal(el.props.size, 0, "home: transform, origin and will-change all removed");
  cam.toWorld(10, 20, out);
  assert.deepEqual([...out], [10, 20], "home: screen and world agree");
});

test("camera: contain keeps the stage over its own box; limits clamp the zoom", () => {
  const e = createEngine(), el = stage(800, 400), cam = camera(e, el, { max: 3 }), out = [0, 0];
  e.start();
  flyTo(cam, 790, 10, 9); // a corner, past the zoom limit
  run(e, 3);
  assert.equal(cam.zoom, 3, "clamped to max");
  // translate stays within [size * (1 - z), 0] on both axes: no edge of the stage shows.
  const [, tx, ty] = el.props.get("transform").match(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/).map(Number);
  assert.ok(tx <= 0 && tx >= 800 * (1 - 3) - 1e-6 && ty <= 0 && ty >= 400 * (1 - 3) - 1e-6, `${tx}, ${ty}`);
  cam.toWorld(400, 200, out);
  assert.ok(out[0] > 600 && out[1] < 100, `the centre shows the corner side (${out})`);
  cam.pan(-10000, 10000); // a wild drag: still contained, and at once (no easing)
  e.advance(1 / 60);
  cam.toWorld(0, 0, out);
  assert.ok(out[0] <= 800 && out[1] >= 0, `${out}`);
  // contain: false lets the stage move off its box.
  const e2 = createEngine(), c2 = camera(e2, stage(), { contain: false, motion: false });
  e2.start();
  flyTo(c2, 0, 0, 1);
  e2.advance(1 / 60);
  assert.equal(c2.moving, false, "motion: false jumps in one step");
  toScreen(c2, 0, 0, out);
  assert.deepEqual(out, [400, 200], "world 0,0 at the centre");
});

test("camera: fit frames a box; bad input is ignored; options are checked", () => {
  const e = createEngine(), cam = camera(e, stage(800, 400), { motion: false });
  e.start();
  fit(cam, 100, 100, 200, 100, 0);
  e.advance(1 / 60);
  assert.equal(cam.zoom, 4, "min(800 / 200, 400 / 100)");
  cam.to(NaN, 0, 2);
  cam.pan(Infinity, 0);
  e.advance(1 / 60);
  assert.equal(cam.zoom, 4);
  assert.throws(() => camera(e, stage(), { ease: 0 }), RangeError);
  assert.throws(() => camera(e, stage(), { min: -1 }), RangeError);
});

test("camera: zero allocation while it eases", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine(), cam = camera(e, stage());
  e.start();
  const s = new Float64Array(1);
  // Step only (render builds the transform string, once a frame, outside the step).
  const work = (n) => {
    for (let i = 0; i < n; i++) {
      if ((s[0]++ & 63) === 0) cam.to((i * 7) % 800, (i * 3) % 400, 1 + (i % 3));
      cam.step(e, 1 / 60);
    }
  };
  work(20000);
  gc();
  const minor = await minorGCs(() => work(200000));
  assert.ok(minor <= 1, `young-generation GCs over 200k camera steps: ${minor}`);
});

test("camera: reduced motion is read in the read phase, never in a step (P5)", () => {
  // A prefers-reduced-motion query that counts where it is read from.
  const where = [];
  let e;
  const saved = globalThis.matchMedia;
  globalThis.matchMedia = () => ({
    get matches() {
      where.push(e.phase);
      return false;
    },
  });
  try {
    e = createEngine();
    const cam = camera(e, stage());
    zoomAt(cam, 200, 100, 2);
    run(e, 0.5);
    assert.ok(cam.zoom > 1, "it eased");
    assert.ok(where.length > 0, "the setting is read");
    const inStep = where.filter((p) => p === STEP).length;
    assert.equal(inStep, 0, `read in a step ${inStep} times`);
  } finally {
    globalThis.matchMedia = saved;
  }
});

test("camera: a pan or a move doesn't re-measure the stage (P6)", () => {
  const el = stage();
  let reads = 0;
  const box = el.getBoundingClientRect;
  el.getBoundingClientRect = () => (reads++, box());
  const e = createEngine(), cam = camera(e, el);
  assert.equal(reads, 1, "measured once at setup");
  zoomAt(cam, 400, 200, 2);
  run(e, 0.2);
  // A drag: one pan per frame.
  for (let f = 0; f < 60; f++) cam.pan(3, 1), e.advance(1 / 60);
  flyTo(cam, 100, 100, 3);
  run(e, 1);
  assert.equal(reads, 1, `layout read ${reads - 1} more times while panning and moving`);
  assert.equal(cam.width, 800);
});
