// fizlet/perf (Node, on a tiny fake DOM): the frame ring, fps and dropped-frame math, the kernel's
// frame facts (timing, live), show/hide through the ledger, the key, and zero allocation
// while shown. The real DOM (chart pixels, Recall byte for byte, settle) is in tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { perf, FrameRing, fps, missed, BARS, WINDOW } = await import("../src/perf.ts");

const calls = new Int32Array(2); // fillRect, clearRect
class Text {
  constructor(v) {
    this.nodeValue = v;
  }
}
class El {
  attrs = new Map();
  removed = false;
  constructor(tag) {
    this.tagName = tag;
  }
  getAttribute(n) {
    return this.attrs.has(n) ? this.attrs.get(n) : null;
  }
  hasAttribute(n) {
    return this.attrs.has(n);
  }
  setAttribute(n, v) {
    this.attrs.set(n, String(v));
  }
  removeAttribute(n) {
    this.attrs.delete(n);
  }
  append(n) {
    (this.kids ??= []).push(n);
  }
  remove() {
    this.removed = true;
  }
}
const ctx = {
  fillStyle: "",
  fillRect: () => calls[0]++,
  clearRect: () => calls[1]++,
};
/** The template perf builds: a root, its canvas first, six readouts. */
function fakeDoc() {
  const keys = [];
  const doc = {
    body: new El("BODY"),
    keys,
    addEventListener: (type, fn, opt) => keys.push({ type, fn, opt }),
    createElement(tag) {
      const tpl = new El(tag);
      Object.defineProperty(tpl, "innerHTML", {
        set(html) {
          const root = new El("DIV"), canvas = new El("CANVAS");
          canvas.getContext = () => ctx;
          for (const [, k, v] of html.slice(0, html.indexOf(" style=")).matchAll(/ ([\w-]+)(?:=([\w-]+))?/g)) root.setAttribute(k, v ?? "");
          const bs = [...html.matchAll(/<b[^>]*>(\w+)<\/b>/g)].map((m) => Object.assign(new El("B"), { firstChild: new Text(m[1]) }));
          Object.assign(root, { html, firstChild: canvas, querySelectorAll: () => bs, bs });
          tpl.firstChild = root;
        },
      });
      return tpl;
    },
  };
  return doc;
}
/** perf() on the fake DOM (the engine is made without one, so it adds no page listeners). */
function setup(opts = {}) {
  const e = createEngine();
  const doc = (globalThis.document = fakeDoc());
  try {
    const p = perf(e, opts);
    return { e, p, doc, read: () => p.el.bs.map((b) => b.firstChild.nodeValue) };
  } finally {
    delete globalThis.document;
  }
}

test("perf: the frame ring keeps the last cap frames, oldest first, in a typed array", () => {
  const r = new FrameRing(4);
  assert.ok(r.ms instanceof Float32Array);
  for (let i = 1; i <= 6; i++) r.push(i * 10);
  assert.equal(r.size, 4);
  assert.deepEqual([0, 1, 2, 3].map((k) => r.ms[r.slot(k)]), [30, 40, 50, 60]);
  const half = new FrameRing(8);
  half.push(5);
  half.push(7);
  assert.deepEqual([half.size, half.ms[half.slot(0)], half.ms[half.slot(1)]], [2, 5, 7]);
});

test("perf: fps and dropped-frame math", () => {
  assert.equal(fps(30, 500), 60);
  assert.equal(fps(0, 0), 0);
  assert.ok(Math.abs(fps(30, 1000) - 30) < 1e-9);
  const b = 1000 / 60;
  assert.deepEqual([missed(16.7, b), missed(24, b), missed(26, b), missed(33.4, b), missed(50, b), missed(100, b)], [0, 0, 1, 1, 2, 5]);
});

test("kernel: timing and live describe the frame (typed-array slots, no allocation)", () => {
  const e = createEngine();
  const pool = e.pool("bits", 8, () => ({})), other = e.pool("more", 4, () => ({}));
  const seen = [];
  e.add({
    step() {
      const t = performance.now();
      while (performance.now() - t < 2);
    },
    render: (en) => seen.push(en.timing[0], en.timing[1]),
  });
  assert.ok(e.timing instanceof Float64Array && e.timing.length === 2);
  e.advance(0.02);
  assert.ok(Math.abs(seen[0] - 0.02) < 1e-12, "render sees this frame's delta");
  assert.equal(seen[1], 0, "and the work of the last finished frame (none yet)");
  assert.ok(e.timing[1] >= 2 && e.timing[1] < 50, `work ${e.timing[1]} ms: read, one 2 ms step, render`);
  pool.acquire();
  pool.acquire();
  other.acquire();
  assert.equal(e.live, 3);
  e.advance(0);
  assert.equal(e.timing[0], 0, "a frame that advances nothing reads 0");
  assert.ok(e.timing[1] < 2, "and no step ran in it");
});

test("perf: hidden and off by default; show() goes through the ledger and back", () => {
  const changes = [];
  const { e, p, doc } = setup({ change: (on) => changes.push(on) });
  assert.equal(p.on, false);
  assert.equal(p.el.getAttribute("hidden"), "");
  assert.equal(p.el.getAttribute("aria-hidden"), "true");
  assert.match(p.el.html, /contain:layout paint style/);
  assert.match(p.el.html, /box-sizing:content-box;width:120px/, "sized for content-box whatever the page sets globally");
  assert.match(p.el.html, /role=group aria-label=Performance data-fizlet-ignore/);
  assert.match(p.el.html, /position:absolute|position:fixed/);
  assert.deepEqual(doc.body.kids, [p.el], "no root: it goes on the body");
  assert.match(p.el.html, /position:fixed;top:8px;right:8px/, "fixed in the top right corner of the page");
  p.show(true);
  assert.deepEqual([p.on, p.el.hasAttribute("hidden"), p.el.hasAttribute("aria-hidden")], [true, false, false]);
  p.show(true);
  p.show();
  assert.deepEqual([p.on, p.el.getAttribute("hidden"), p.el.getAttribute("aria-hidden")], [false, "", "true"]);
  assert.deepEqual(changes, [true, false], "change runs once per real change");
  // The key: F9 by default, auto-repeat ignored, tied to its own signal.
  const key = doc.keys.find((k) => k.type === "keydown");
  key.fn({ code: "F9", repeat: false });
  key.fn({ code: "F9", repeat: true });
  key.fn({ code: "KeyP", repeat: false });
  assert.equal(p.on, true);
  e.destroy();
  assert.equal(p.el.removed, true);
  assert.equal(key.opt.signal.aborted, true, "the key listener goes with the engine");
  p.show(false);
  assert.equal(p.on, true, "inert after destroy");
});

test("perf: numbers every window, dropped frames, a paused frame is no frame", () => {
  const { e, p, read } = setup({ on: true, key: null, corner: "bl" });
  assert.match(p.el.html, /bottom:8px;left:8px/);
  e.advance(0); // first frame after start: no interval
  assert.equal(p.frames, 0);
  for (let i = 0; i < 30; i++) e.advance(1 / 60);
  assert.equal(p.frames, 30);
  const [f, ms, drop, , live, heap] = read();
  assert.deepEqual([f, ms, drop, live, heap], ["60", "16.7", "0", "0", "--"]);
  e.advance(0.05); // a 50 ms frame: two frames dropped
  assert.equal(p.dropped, 2);
  for (let i = 0; i < 30; i++) e.advance(1 / 60);
  assert.equal(read()[2], "2");
  assert.equal(p.ring.size, 61);
  assert.ok(calls[0] > 0, "the chart draws while shown");
});

test("perf: shown, it allocates nothing per frame (chart, numbers, ring)", async () => {
  const { e, p } = setup({ on: true, key: null });
  const pool = e.pool("bodies", 64, () => ({ x: 0 }));
  e.add({ step: () => (pool.size < 32 ? pool.acquire() : pool.releaseAt(0)) });
  const run = (n) => {
    for (let i = 0; i < n; i++) e.advance(i % 97 ? 1 / 60 : 0.05);
  };
  run(20000); // warm up: every cached string made, every path optimised
  const before = calls[0];
  const minor = await minorGCs(() => run(200000));
  assert.ok(calls[0] - before > 200000 * BARS, "it really drew every frame");
  assert.ok(p.frames > 200000 && WINDOW === 500);
  assert.ok(minor <= 1, `young-generation GCs over 200k shown frames: ${minor}`);
  e.destroy();
});

/** A host element with inline styles (for the ledger) and a computed position. */
function hostEl(tag, position = "static") {
  const h = new El(tag), props = new Map();
  h.position = position;
  h.style = {
    getPropertyValue: (p) => props.get(p) ?? "",
    getPropertyPriority: () => "",
    setProperty: (p, v) => props.set(p, v),
    removeProperty: (p) => props.delete(p),
  };
  h.props = props;
  return h;
}
function withComputed(fn) {
  const saved = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (el) => ({ position: el.position ?? "static", getPropertyValue: () => "" });
  try {
    return fn();
  } finally {
    if (saved) globalThis.getComputedStyle = saved;
    else delete globalThis.getComputedStyle;
  }
}

test("perf: a canvas or svg host puts the overlay on the page, fixed (P11)", () => {
  for (const [tag, own] of [["CANVAS", { getContext: () => null }], ["svg", { ownerSVGElement: null }]]) {
    const host = Object.assign(hostEl(tag), own);
    const { p, doc } = setup({ host });
    assert.equal(host.kids, undefined, `${tag}: a child of a replaced element never shows`);
    assert.deepEqual(doc.body.kids, [p.el], `${tag}: on the body instead`);
    assert.match(p.el.html, /position:fixed/);
  }
});

test("perf: a static host is made relative while shown (through the ledger), so the corner is the host's (P11)", () =>
  withComputed(() => {
    const host = hostEl("DIV", "static");
    const { e, p } = setup({ host, key: null });
    assert.deepEqual(host.kids, [p.el]);
    assert.match(p.el.html, /position:absolute/);
    assert.equal(host.props.get("position"), undefined, "hidden: the host is untouched");
    p.show(true);
    assert.equal(host.props.get("position"), "relative", "shown: the overlay's corner is the host's");
    p.show(false);
    assert.equal(host.props.get("position"), undefined, "hidden again: given back");
    p.show(true);
    e.destroy();
    assert.equal(host.props.get("position"), undefined, "Recall gives it back");
    // A host that is already positioned is never touched.
    const fixed = hostEl("DIV", "fixed");
    const f = setup({ host: fixed, key: null, on: true });
    assert.equal(fixed.props.size, 0);
    f.e.destroy();
  }));
