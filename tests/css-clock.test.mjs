// fzlt/css-clock in Node: the clock property runs from 0s down to -(span × loops)s, rests there
// (the first frame of every animation whose duration divides span) and the engine settles; a
// pointer plays it again; hold keeps the frame; reduced motion lands on the rest frame at once;
// destroy gives the root's style back. Real @keyframes in Chromium: tests/css-clock.mjs.
import test from "node:test";
import assert from "node:assert/strict";

const { cssClock } = await import("../src/css-clock.ts");

function el(init = {}) {
  const props = new Map(Object.entries(init)), attrs = new Map(), on = new Map();
  const style = {
    getPropertyValue: (p) => props.get(p) ?? "",
    getPropertyPriority: () => "",
    setProperty: (p, v) => (v ? props.set(p, v) : props.delete(p)),
    removeProperty: (p) => props.delete(p),
  };
  return {
    style, props, on,
    hasAttribute: (n) => attrs.has(n), getAttribute: (n) => attrs.get(n) ?? null, setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n),
    addEventListener: (t, f) => on.set(t, f), removeEventListener: (t) => on.delete(t),
  };
}
const run = (c, sec) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) c.engine.advance(1 / 60); };
const t = (root) => parseFloat(root.props.get("--fz-t"));

test("css-clock: runs span × loops seconds, rests on frame one, settles; a pointer replays", () => {
  const root = el(), c = cssClock(root, { span: 2, loops: 2, motion: true });
  run(c, 1);
  assert.ok(Math.abs(t(root) + 1) < 0.02, `one second in: ${t(root)}`);
  run(c, 3.2);
  assert.equal(t(root), -4, "rests at -(span × loops)s: every 1 s or 2 s loop is on its first frame");
  assert.equal(c.tl.playing, false);
  run(c, 1);
  assert.ok(c.engine.stats().paused.includes("settled"), "the engine settles");
  root.on.get("pointerenter")();
  run(c, 0.5);
  assert.ok(t(root) > -1 && t(root) < 0, `a pointer plays it again: ${t(root)}`);
  c.destroy();
});

test("css-clock: hold keeps the frame; release plays on", () => {
  const root = el(), c = cssClock(root, { span: 6, motion: true });
  run(c, 1);
  c.hold(true);
  const at = t(root);
  run(c, 1);
  assert.equal(t(root), at, "held");
  root.on.get("pointerenter")();
  run(c, 0.5);
  assert.equal(t(root), at, "a pointer does not override the hold");
  c.hold(false);
  run(c, 0.5);
  assert.ok(t(root) < at, "released");
  c.destroy();
});

test("css-clock: reduced motion rests at once; destroy gives the style back", () => {
  const root = el({ color: "red" }), c = cssClock(root, { span: 1, loops: 3, motion: false, prop: "--k" });
  run(c, 1 / 30);
  assert.equal(root.props.get("--k"), "-3s", "lands on the rest frame");
  c.destroy();
  assert.deepEqual([...root.props], [["color", "red"]], "Recall");
});

test("css-clock: zero allocation in its steps while it plays, and in whole frames at rest", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const { minorGCs } = await import("./gc.mjs");
  const root = el(), c = cssClock(root, { span: 2, loops: 1e6, motion: true });
  // Steps only: render writes one style string a frame (outside the step), as fzlt/timeline does.
  const steps = (n) => { for (let i = 0; i < n; i++) c.tl.step(c.engine, 1 / 60); };
  steps(20000);
  gc();
  const playing = await minorGCs(() => steps(200000));
  assert.ok(playing <= 1, `young-generation GCs over 200k css-clock steps: ${playing}`);
  // At rest (held): whole frames (read, steps, render) write nothing and allocate nothing.
  c.hold(true);
  run(c, 0.1);
  const frames = (n) => { for (let i = 0; i < n; i++) c.engine.advance(1 / 60); };
  frames(20000);
  gc();
  const rest = await minorGCs(() => frames(200000));
  assert.ok(rest <= 1, `young-generation GCs over 200k frames at rest: ${rest}`);
  c.destroy();
});
