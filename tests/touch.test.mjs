// @fzlt/core/touch in Node (a fake document): lockTouch adds its four listeners in the capture phase,
// not passive; on a surface it cancels iOS's gesture events and any multi-touch touchstart/touchmove,
// never one finger; off the surfaces it leaves everything (unless `null` locks the whole page); a custom
// selector replaces SURFACES; release() removes exactly what it added; and handling events allocates
// nothing. Real taps and pinches in Chromium and WebKit: tests/touch.mjs, tests/webkit-touch.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { lockTouch, SURFACES } = await import("../src/touch.ts");

const fakeDoc = () => {
  const L = [];
  return {
    L,
    addEventListener: (type, fn, opt) => L.push({ type, fn, opt }),
    removeEventListener: (type, fn, opt) => {
      const i = L.findIndex((l) => l.type === type && l.fn === fn && l.opt.capture === opt.capture);
      if (i >= 0) L.splice(i, 1);
    },
    fire(ev) { for (const l of L) if (l.type === ev.type) l.fn(ev); },
  };
};
/** An element that matches `sel` when it is in `matches` (closest() climbs no further in the fake). */
const HIT = {};
const el = (matches) => ({ closest: (sel) => (matches.includes(sel) ? HIT : null) });
const ev = (type, target, touches = 1) => ({ type, target, touches: { length: touches }, prevented: 0, preventDefault() { this.prevented++; } });

test("lockTouch: four capture, non-passive listeners; release removes them", () => {
  const doc = fakeDoc();
  const release = lockTouch(doc);
  assert.deepEqual(doc.L.map((l) => l.type), ["gesturestart", "gesturechange", "touchstart", "touchmove"]);
  for (const l of doc.L) assert.deepEqual(l.opt, { capture: true, passive: false });
  release();
  assert.equal(doc.L.length, 0, "every listener gone");
  release();
  assert.equal(doc.L.length, 0, "a second release is harmless");
});

test("lockTouch: on a surface, gestures and multi-touch are cancelled, one finger never", () => {
  const doc = fakeDoc(), on = el([SURFACES]), off = el([]);
  const release = lockTouch(doc);
  const cases = [["gesturestart", on, 1, 1], ["gesturechange", on, 2, 1], ["touchstart", on, 2, 1], ["touchmove", on, 3, 1],
    ["touchstart", on, 1, 0], ["touchmove", on, 1, 0], ["gesturestart", off, 1, 0], ["touchmove", off, 2, 0]];
  for (const [type, target, n, want] of cases) {
    const e = ev(type, target, n);
    doc.fire(e);
    assert.equal(e.prevented, want, `${type} with ${n} finger(s) ${target === on ? "on" : "off"} a surface`);
  }
  // A target with no closest() (a text node, the document) is off every surface.
  const bare = ev("touchmove", {}, 2);
  doc.fire(bare);
  assert.equal(bare.prevented, 0);
  release();
  const after = ev("gesturestart", on);
  doc.fire(after);
  assert.equal(after.prevented, 0, "released: the page has its gestures back");
});

test("lockTouch: null locks the whole page; a custom selector replaces SURFACES", () => {
  const doc = fakeDoc();
  const r1 = lockTouch(doc, null);
  const e1 = ev("touchmove", el([]), 2), e2 = ev("touchmove", el([]), 1);
  doc.fire(e1); doc.fire(e2);
  assert.deepEqual([e1.prevented, e2.prevented], [1, 0], "anywhere, still never one finger");
  r1();
  const r2 = lockTouch(doc, ".board");
  const e3 = ev("gesturestart", el([".board"])), e4 = ev("gesturestart", el([SURFACES]));
  doc.fire(e3); doc.fire(e4);
  assert.deepEqual([e3.prevented, e4.prevented], [1, 0]);
  r2();
});

test("lockTouch: handling 2M events allocates nothing", async (t) => {
  const doc = fakeDoc(), on = el([SURFACES]);
  const release = lockTouch(doc);
  const evs = [ev("touchmove", on, 2), ev("touchmove", on, 1), ev("gesturechange", on, 2), ev("touchstart", el([]), 2)];
  const fns = doc.L.map((l) => [l.type, l.fn]);
  const run = (n, live) => {
    for (let i = 0; i < n; i++) {
      const e = evs[i & 3];
      if (live) for (let k = 0; k < 4; k++) if (fns[k][0] === e.type) fns[k][1](e);
    }
  };
  run(5000, true);
  const bare = await minorGCs(() => run(2000000, false), 5), live = await minorGCs(() => run(2000000, true), 5);
  t.diagnostic(`young GCs over 2M events (best of 5 windows): bare ${bare}, handled ${live}`);
  assert.ok(live <= bare, `handling allocates: ${live} young GCs (bare ${bare})`);
  release();
});
