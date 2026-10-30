// fizlet/view-dom (Node, on a tiny fake DOM that counts writes): one pooled node per row, change-only
// writes, a still board writes nothing and settles, deaths hide or linger (not with reduced motion),
// a reborn row takes its node back, and a still board's frames allocate nothing. The real DOM
// (Recall byte for byte, settle at 0 frames, reduced motion) is in tests/view-dom.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { actors } = await import("../src/actor.ts");
const { viewDom } = await import("../src/view-dom.ts");

const writes = new Int32Array(1);
const doc = { createElement: (t) => new El(t) };
class El {
  ownerDocument = doc;
  parentNode = null;
  kids = [];
  attrs = new Map();
  props = new Map();
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    const props = this.props;
    this.style = {
      getPropertyValue: (p) => props.get(p) ?? "",
      getPropertyPriority: () => "",
      setProperty: (p, v) => (writes[0]++, props.set(p, v)),
      removeProperty: (p) => (writes[0]++, props.delete(p)),
    };
  }
  hasAttribute(n) { return this.attrs.has(n); }
  getAttribute(n) { return this.attrs.get(n) ?? null; }
  setAttribute(n, v) { writes[0]++; this.attrs.set(n, `${v}`); }
  removeAttribute(n) { writes[0]++; this.attrs.delete(n); }
  appendChild(n) { this.kids.push(n); n.parentNode = this; return n; }
  remove() { const p = this.parentNode; if (p) p.kids.splice(p.kids.indexOf(this), 1); this.parentNode = null; }
}
const setup = (o = {}, cap = 4) => {
  const e = createEngine({ settle: o.settle }), host = new El("div"), A = actors({ cap, sides: 2 });
  const v = viewDom(e, A, host, { motion: true, ...o });
  return { e, host, A, v, frame: (n = 1) => { for (let k = 0; k < n; k++) e.advance(1 / 60); } };
};

test("a row's node comes the first time it shows, with side, kind, transform and --hp", () => {
  const { host, A, v, frame } = setup();
  frame();
  assert.equal(host.kids.length, 0, "no actors, no nodes");
  const i = A.spawn(1, 4, 3);
  A.x[i] = 12.3456; A.y[i] = 7; A.a[i] = 1.5;
  frame();
  const el = v.node(i);
  assert.equal(host.kids.length, 1);
  assert.equal(el.tagName, "I");
  assert.deepEqual([el.getAttribute("hidden"), el.getAttribute("data-side"), el.getAttribute("data-kind")], [null, "1", "3"]);
  assert.equal(el.props.get("transform"), "translate(12.35px,7px) translate(-50%,-50%) rotate(1.5rad)");
  assert.equal(el.props.get("--hp"), "1");
  A.hurt(i, 1);
  frame();
  assert.equal(el.props.get("--hp"), "0.75");
});

test("make, turn: false and center: false", () => {
  const { host, A, v, frame } = setup({ make: (i) => { const b = new El("button"); b.setAttribute("class", `unit u${i}`); return b; }, turn: false, center: false });
  const i = A.spawn(0, 1);
  A.x[i] = 5; A.a[i] = 2;
  frame();
  assert.equal(v.node(i).tagName, "BUTTON");
  assert.equal(v.node(i).getAttribute("class"), "unit u0");
  assert.equal(v.node(i).props.get("transform"), "translate(5px,0px)");
  assert.equal(host.kids[0], v.node(i));
});

test("change-only: a still board writes nothing; one moved actor writes one transform", () => {
  const { A, frame } = setup({}, 16);
  for (let k = 0; k < 16; k++) { const i = A.spawn(k & 1, 3); A.x[i] = k * 10; A.y[i] = k; }
  frame(2);
  writes[0] = 0;
  frame(60);
  assert.equal(writes[0], 0, "still");
  A.x[5] += 0.004;
  frame();
  assert.equal(writes[0], 0, "under 0.01 px is still");
  A.x[5] += 0.5;
  frame();
  assert.equal(writes[0], 1, "one transform");
});

test("settle: a still board lets the engine sleep; a move keeps it awake", () => {
  const { e, A, frame } = setup({ settle: 0.25 });
  const i = A.spawn(0, 1);
  e.start();
  for (let f = 0; f < 30; f++) { A.x[i] += 1; frame(); }
  assert.ok(!e.stats().paused.includes("settled"), "moving: awake");
  frame(20);
  assert.ok(e.stats().paused.includes("settled"), "still: settled");
  e.destroy();
});

test("death hides the node; the row lives again with the same node and fresh attributes", () => {
  const { host, A, v, frame } = setup();
  const i = A.spawn(0, 1, 2);
  A.x[i] = 40;
  frame();
  const el = v.node(i);
  A.kill(i);
  frame();
  assert.equal(el.getAttribute("hidden"), "");
  A.sweep();
  const j = A.spawn(1, 1, 5);
  assert.equal(j, i);
  frame();
  assert.equal(v.node(j), el, "pooled: the row's node");
  assert.equal(host.kids.length, 1);
  assert.deepEqual([el.getAttribute("hidden"), el.getAttribute("data-side"), el.getAttribute("data-kind")], [null, "1", "5"]);
  assert.equal(el.props.get("transform"), "translate(0px,0px) translate(-50%,-50%) rotate(0rad)", "the new actor's body");
  // Killed, swept and reborn between two renders: still a fresh show.
  A.x[j] = 9; frame();
  A.kill(j); A.sweep(); A.spawn(0, 1, 1); frame();
  assert.deepEqual([el.getAttribute("data-side"), el.getAttribute("data-kind")], ["0", "1"]);
});

test("linger: a death keeps data-dead for its seconds and holds the engine awake; reduced motion hides at once", () => {
  const { e, A, v, frame } = setup({ linger: 0.5, settle: 0.1 });
  const i = A.spawn(0, 1);
  frame();
  A.kill(i);
  frame();
  const el = v.node(i);
  assert.equal(el.getAttribute("data-dead"), "");
  assert.equal(el.getAttribute("hidden"), null, "still showing");
  frame(20);
  assert.ok(!e.stats().paused.includes("settled"), "held awake while it lingers");
  frame(15);
  assert.equal(el.getAttribute("hidden"), "", "gone after 0.5 s");
  const r = setup({ linger: 0.5, motion: false });
  const k = r.A.spawn(0, 1);
  r.frame(); r.A.kill(k); r.frame();
  assert.equal(r.v.node(k).getAttribute("hidden"), "", "reduced motion: at once");
  assert.equal(r.v.node(k).getAttribute("data-dead"), null);
});

test("Recall: destroy takes every node away and remove() stops drawing", () => {
  const { e, host, A, v, frame } = setup();
  for (let k = 0; k < 3; k++) A.spawn(0, 1);
  frame();
  assert.equal(host.kids.length, 3);
  v.remove();
  A.x[0] = 99;
  writes[0] = 0;
  frame();
  assert.equal(writes[0], 0, "removed: no writes");
  e.destroy();
  assert.equal(host.kids.length, 0);
});

test("view-dom: zero allocation across 1M frames of a still board (and the linger clock)", async (t) => {
  const minors = async (on) => {
    // bare: the same engine and actors, no view.
    const e = createEngine(), A = actors({ cap: 64, sides: 2 });
    if (on) viewDom(e, A, new El("div"), { linger: 1e9, motion: true });
    const frame = (n) => { for (let k = 0; k < n; k++) e.advance(1 / 60); };
    for (let k = 0; k < 64; k++) { const i = A.spawn(k & 1, 3, k & 3); A.x[i] = k * 7; A.y[i] = k * 3; A.a[i] = k; }
    frame(4);
    for (let k = 0; k < 64; k += 4) A.kill(k); // lingering forever: the step counts them down
    frame(4);
    const minor = await minorGCs(() => frame(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withView = await minors(true);
  t.diagnostic(`young GCs over 1M frames (best of 3 windows): bare ${bare}, with ${withView}`);
  assert.ok(withView <= bare + 1, `young-generation GCs over 1M frames: ${withView} with view-dom, ${bare} bare`);
});
