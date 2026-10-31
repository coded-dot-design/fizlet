// fizlet/view-canvas in Node (a fake DOM and a recording 2D context): the backing store is the CSS
// size × devicePixelRatio (capped), nothing is drawn until something is dirty, a dirty box is
// snapped out to whole device pixels, cleared and clipped, boxes union, a resize re-measures, a
// settled engine wakes for one redraw and settles again, destroy() is Recall, and a step that dirties
// a box every frame allocates nothing. Real pixels in Chromium: tests/view-canvas.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { viewCanvas } = await import("../src/view-canvas.ts");

function fakePage({ w = 300, h = 150, dpr = 1, position = "static" } = {}) {
  const calls = [], listeners = new Map(), observers = [];
  const ctx = {};
  for (const k of ["setTransform", "save", "restore", "beginPath", "rect", "clip", "clearRect", "fillRect"]) ctx[k] = (...a) => calls.push([k, ...a]);
  const styled = () => {
    const props = new Map(), attrs = new Map();
    return {
      props, attrs,
      style: {
        cssText: "",
        getPropertyValue: (p) => props.get(p) ?? "",
        getPropertyPriority: () => "",
        setProperty: (p, v) => (v ? props.set(p, v) : props.delete(p)),
        removeProperty: (p) => props.delete(p),
      },
      hasAttribute: (n) => attrs.has(n), getAttribute: (n) => attrs.get(n) ?? null, setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n),
    };
  };
  const win = {
    devicePixelRatio: dpr,
    getComputedStyle: () => ({ position }),
    addEventListener: (t, f, o) => (listeners.set(t, f), o?.signal?.addEventListener("abort", () => listeners.delete(t))),
  };
  const children = [];
  const doc = {
    defaultView: win,
    createElement: () => {
      const c = { ...styled(), width: 300, height: 150, getContext: () => ctx, remove: () => children.splice(children.indexOf(c), 1) };
      return c;
    },
  };
  const root = { ...styled(), ownerDocument: doc, clientWidth: w, clientHeight: h, append: (c) => children.push(c) };
  globalThis.ResizeObserver = class {
    constructor(f) { this.f = f; observers.push(this); }
    observe() {}
    disconnect() { this.gone = true; }
  };
  return { root, win, ctx, calls, children, listeners, observers };
}
const frames = (e, k) => { for (let i = 0; i < k; i++) e.advance(1 / 60); };

test("view-canvas: backing store at the screen's density, capped; one draw until something changes", () => {
  const p = fakePage({ w: 300, h: 150, dpr: 3 }), e = createEngine();
  let draws = 0;
  const v = viewCanvas(e, p.root, { draw: () => draws++ });
  frames(e, 1);
  assert.deepEqual([v.canvas.width, v.canvas.height, v.dpr, v.width, v.height], [600, 300, 2, 300, 150], "dpr 3 capped at 2");
  assert.equal(draws, 1, "the first frame draws the whole canvas");
  frames(e, 30);
  assert.equal(draws, 1, "nothing dirty, nothing drawn");
  assert.equal(p.children[0], v.canvas, "one canvas, in the root");
  assert.equal(p.root.props.get("position"), "relative", "a static root becomes the canvas's containing block");
  assert.equal(v.canvas.attrs.get("aria-hidden"), "true");
  e.destroy();

  const q = fakePage({ dpr: 1.5 }), e2 = createEngine(), v2 = viewCanvas(e2, q.root, { draw() {}, maxDpr: 4, label: "A graph" });
  frames(e2, 1);
  assert.deepEqual([v2.canvas.width, v2.canvas.height], [450, 225], "dpr 1.5");
  assert.deepEqual([v2.canvas.attrs.get("role"), v2.canvas.attrs.get("aria-label")], ["img", "A graph"]);
  e2.destroy();
});

test("view-canvas: a dirty box is snapped to device pixels, cleared, clipped; boxes union", () => {
  const p = fakePage({ dpr: 2 }), e = createEngine(), boxes = [];
  const v = viewCanvas(e, p.root, { draw: (_, b) => boxes.push([...b]) });
  frames(e, 1);
  p.calls.length = 0;
  v.dirty([10.3, 10, 5, 5]);
  frames(e, 1);
  assert.deepEqual(boxes[1], [10, 10, 5.5, 5], "x 20.6 → 20 and 30.6 → 31 device px");
  assert.deepEqual(p.calls.map((c) => c[0]), ["save", "setTransform", "beginPath", "rect", "clip", "clearRect", "setTransform", "restore"]);
  assert.deepEqual(p.calls[5], ["clearRect", 20, 20, 11, 10], "cleared in whole device pixels");
  assert.deepEqual(p.calls[6], ["setTransform", 2, 0, 0, 2, 0, 0], "drawing is in CSS px");
  v.dirty([0, 0, 4, 4]);
  v.dirty([100, 50, 10, 10]);
  frames(e, 1);
  assert.deepEqual(boxes[2], [0, 0, 110, 60], "two boxes, one union");
  v.dirty([-50, -50, 20, 20]);
  frames(e, 1);
  assert.equal(boxes.length, 3, "a box off the canvas draws nothing");
  v.dirty([290, 140, 50, 50]);
  frames(e, 1);
  assert.deepEqual(boxes[3], [290, 140, 10, 10], "clamped to the canvas");
  e.destroy();
});

test("view-canvas: a resize or a zoom re-measures in the read phase and redraws everything", () => {
  const p = fakePage({ w: 200, h: 100 }), e = createEngine(), boxes = [];
  const v = viewCanvas(e, p.root, { draw: (_, b) => boxes.push([...b]) });
  frames(e, 1);
  p.root.clientWidth = 400;
  frames(e, 1);
  assert.equal(v.width, 200, "no layout read without a resize");
  p.observers[0].f();
  frames(e, 1);
  assert.deepEqual([v.width, v.canvas.width, boxes.at(-1)[2]], [400, 400, 400]);
  p.win.devicePixelRatio = 2;
  p.listeners.get("resize")();
  frames(e, 1);
  assert.deepEqual([v.dpr, v.canvas.width, v.canvas.height], [2, 800, 200], "a zoom: the window's resize");
  e.destroy();
  assert.ok(p.observers[0].gone && !p.listeners.has("resize"), "observer and listener go with the engine");
});

test("view-canvas: never keeps the engine awake; dirty() wakes a settled engine for one redraw", () => {
  const p = fakePage(), e = createEngine({ settle: 0.1 });
  let draws = 0;
  const v = viewCanvas(e, p.root, { draw: () => draws++ });
  e.start();
  frames(e, 10);
  assert.ok(e.paused.includes("settled"), "settles with only a canvas on it");
  v.dirty([0, 0, 10, 10]);
  assert.ok(e.running, "dirty() wakes it");
  frames(e, 1);
  assert.equal(draws, 2);
  frames(e, 10);
  assert.ok(e.paused.includes("settled"), "and it settles again");
  e.stop();
  v.dirty();
  assert.deepEqual(e.paused, ["stopped"], "a stopped engine stays stopped");
  e.destroy();
});

test("view-canvas: destroy() is Recall: the canvas goes, the root's style comes back", () => {
  const p = fakePage(), e = createEngine();
  viewCanvas(e, p.root, { draw() {} });
  frames(e, 2);
  e.destroy();
  assert.deepEqual(p.children, [], "canvas removed");
  assert.deepEqual([...p.root.props], [], "position given back");
  const q = fakePage({ position: "absolute" }), e2 = createEngine();
  viewCanvas(e2, q.root, { draw() {} });
  assert.equal(q.root.props.size, 0, "a positioned root is not touched");
  e2.destroy();
});

test("view-canvas: zero allocation across 1M frames, a dirty box and a redraw every frame", async (t) => {
  const minors = async (on) => {
    const p = fakePage({ dpr: 2 }), e = createEngine({ maxSteps: 1 });
    const v = viewCanvas(e, p.root, { draw() {} });
    for (const k of Object.keys(p.ctx)) p.ctx[k] = () => {}; // the fake context records nothing
    const b = new Float64Array([0, 20.5, 8.25, 8]);
    e.add({ step() { if (!on) return; b[0] = (b[0] + 1.25) % 280; v.dirty(b); } });
    const run = (k) => { for (let i = 0; i < k; i++) e.advance(1 / 60); };
    run(2000);
    const minor = await minorGCs(() => run(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withView = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with a redraw every frame ${withView}`);
  assert.ok(withView <= bare + 1, `young-generation GCs over 1M frames: ${withView} with view-canvas, ${bare} bare`);
});

test("view-canvas: no Math.hypot (the exact hypot rule)", () => {
  assert.doesNotMatch(readFileSync("src/view-canvas.ts", "utf8"), /Math\.hypot/);
});
