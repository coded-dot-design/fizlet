// fizlet/debug (Node): guardLayout counts layout reads made in the STEP phase only, per engine,
// and stops on its off switch or the engine's destroy; reads still return the real values; a
// guarded getter allocates nothing. The browser suite runs it on real elements in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

globalThis.requestAnimationFrame ??= () => 0; // started engines are advanced by hand here
globalThis.cancelAnimationFrame ??= () => {};

// The layout surface debug patches: rect methods and size getters on Element / HTMLElement, and
// getComputedStyle. Each returns a known value, so a test sees the patch hands it through.
class Element {
  w = 120;
  getBoundingClientRect() {
    return { width: this.w };
  }
  getClientRects() {
    return [{ width: this.w }];
  }
}
for (const p of ["clientWidth", "clientHeight", "clientTop", "clientLeft", "scrollWidth", "scrollHeight", "scrollTop", "scrollLeft"])
  Object.defineProperty(Element.prototype, p, { configurable: true, get() { return this.w; } });
class HTMLElement extends Element {}
for (const p of ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"])
  Object.defineProperty(HTMLElement.prototype, p, { configurable: true, get() { return this.w; } });
Object.assign(globalThis, { Element, HTMLElement, getComputedStyle: () => ({ color: "red" }) });

const { createEngine } = await import("../src/index.ts");
const { guardLayout } = await import("../src/debug.ts");

const el = new HTMLElement();
/** Every layout read debug watches, once: 15 reads. */
const readAll = () => {
  el.getBoundingClientRect();
  el.getClientRects();
  for (const p of ["clientWidth", "clientHeight", "clientTop", "clientLeft", "scrollWidth", "scrollHeight", "scrollTop", "scrollLeft", "offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"]) void el[p];
  getComputedStyle(el);
};
const READS = 15;

test("debug: counts every layout read in a step, none in read or render, and hands the real value through", () => {
  const e = createEngine();
  let seen = null;
  e.add({ read: readAll, step: () => (readAll(), (seen = [el.offsetWidth, el.getBoundingClientRect().width, getComputedStyle(el).color])), render: readAll });
  guardLayout(e);
  assert.equal(e.violations, 0);
  e.advance(1 / 60);
  assert.equal(e.violations, READS + 3, "the step's reads, and only those");
  assert.deepEqual(seen, [120, 120, "red"], "a guarded read returns what the page would");
  readAll();
  assert.equal(e.violations, READS + 3, "outside any frame: not counted");
  e.destroy();
});

test("debug: per engine; the off switch and destroy stop counting", () => {
  const a = createEngine(), b = createEngine();
  a.add({ step: () => void el.offsetWidth });
  b.add({ step: () => void el.clientWidth });
  const off = guardLayout(a);
  guardLayout(b);
  a.advance(1 / 60);
  b.advance(1 / 60);
  assert.equal(a.violations, 1);
  assert.equal(b.violations, 1, "each engine counts its own step's reads");
  off();
  a.advance(1 / 60);
  assert.equal(a.violations, 1, "unguarded: no more counting");
  b.destroy();
  b.advance(1 / 60);
  assert.equal(b.violations, 1, "destroyed: forgotten");
  a.destroy();
});

test("debug: patches once, however many engines it guards", () => {
  const get = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth").get, rect = Element.prototype.getBoundingClientRect, gcs = globalThis.getComputedStyle;
  const e = createEngine();
  guardLayout(e);
  guardLayout(e);
  assert.equal(Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth").get, get);
  assert.equal(Element.prototype.getBoundingClientRect, rect);
  assert.equal(globalThis.getComputedStyle, gcs);
  e.destroy();
});

test("debug: zero allocation: a guarded engine's steps, and guarded size reads in and out of a step", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine();
  let sink = null, w = 0, leak = false;
  e.add({
    step() {
      w += el.offsetWidth + el.clientHeight + el.scrollTop; // three counted reads a step
      if (leak) sink = { w }; // the self-check: a step that allocates
    },
  });
  guardLayout(e);
  e.start();
  const steps = (n) => {
    for (let i = 0; i < n; i++) e.advance(1 / 60);
  };
  const reads = (n) => {
    for (let i = 0; i < n; i++) w += el.offsetWidth + el.scrollLeft;
  };
  steps(20000);
  reads(20000);
  const inStep = await minorGCs(() => steps(1000000));
  const outside = await minorGCs(() => reads(1000000));
  leak = true;
  steps(20000);
  const control = await minorGCs(() => steps(1000000));
  console.log(`# debug young GCs: 1M guarded steps ${inStep}, 1M guarded reads outside a step ${outside}; self-check, an allocating step: ${control}`);
  assert.ok(sink && w > 0);
  assert.ok(e.violations >= 3 * 2000000, "every read in a step was counted");
  assert.ok(control >= 5, `the method sees one object per step: ${control}`);
  assert.ok(inStep <= 1, `guarded steps: ${inStep} young GCs`);
  assert.ok(outside <= 1, `guarded reads outside a step: ${outside} young GCs`);
  e.destroy();
});
