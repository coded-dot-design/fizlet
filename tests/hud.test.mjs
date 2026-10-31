// @fzlt/core/hud (Node, on a tiny fake DOM that counts writes): change-only writes, formats, meter and
// flag, feed and banner from the event ring, and zero allocation in the steady state.
// The real DOM (exact restore, 0 mutations on unchanged frames) is in tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { hud } = await import("../src/hud.ts");

const writes = new Int32Array(1);
const kidReads = new Int32Array(1); // `el.children` reads (this fake builds a new array per read)
class Text {
  nodeType = 3;
  nextSibling = null;
  #v;
  constructor(v) {
    this.#v = v;
  }
  get nodeValue() {
    return this.#v;
  }
  set nodeValue(v) {
    writes[0]++;
    this.#v = v;
  }
}
const doc = { createTextNode: (v) => new Text(v), createElement: (t) => new El(t) };
class El {
  nodeType = 1;
  nextSibling = null;
  ownerDocument = doc;
  childNodes = [];
  attrs = new Map();
  set = new Set();
  constructor(tag = "DIV", text) {
    this.tagName = tag.toUpperCase();
    if (text !== undefined) this.appendChild(new Text(text));
    const props = new Map(), set = this.set;
    this.style = {
      getPropertyValue: (p) => props.get(p) ?? "",
      getPropertyPriority: () => "",
      setProperty: (p, v) => (writes[0]++, props.set(p, v)),
      removeProperty: (p) => props.delete(p),
    };
    this.classList = { contains: (c) => set.has(c), toggle: (c, on) => (writes[0]++, on ? set.add(c) : set.delete(c), on) };
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get children() {
    kidReads[0]++;
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get text() {
    return this.childNodes.map((n) => n.nodeValue ?? n.text).join("");
  }
  appendChild(n) {
    const l = this.childNodes[this.childNodes.length - 1];
    if (l) l.nextSibling = n;
    this.childNodes.push(n);
    return n;
  }
  hasAttribute(a) {
    return this.attrs.has(a);
  }
  getAttribute(a) {
    return this.attrs.get(a) ?? null;
  }
  setAttribute(a, v) {
    writes[0]++;
    this.attrs.set(a, String(v));
  }
  removeAttribute(a) {
    this.attrs.delete(a);
  }
}

test("num: writes only when the shown value changes; int, clock, rank, pct, custom", () => {
  const e = createEngine();
  const v = new Float64Array(4);
  const kills = new El("b", "0"), clock = new El("b", "3:00"), rank = new El("b"), pct = new El("b"), pad = new El("b");
  hud(e, null)
    .num(kills, () => v[0])
    .num(clock, () => v[1], "clock")
    .num(rank, () => v[2], "rank")
    .num(pct, () => v[3], "pct")
    .num(pad, [v, 0], (n) => String(Math.round(n)).padStart(6, "0"));
  v[1] = 180;
  v[2] = 1;
  e.advance(0);
  assert.deepEqual([kills.text, clock.text, rank.text, pct.text, pad.text], ["0", "3:00", "#1", "0%", "000000"]);
  const before = writes[0];
  for (let i = 0; i < 100; i++) e.advance(0);
  v[1] = 179.5; // still shows 2:59 → one write, then none while it stays inside that second
  e.advance(0);
  v[1] = 179.01;
  e.advance(0);
  assert.equal(writes[0] - before, 1, "unchanged frames write nothing; one write per shown change");
  assert.equal(clock.text, "2:59");
  v[1] = 65;
  v[0] = 12.4;
  v[2] = 3;
  v[3] = 0.756;
  e.advance(0);
  assert.deepEqual([kills.text, clock.text, rank.text, pct.text, pad.text], ["12", "1:05", "#3", "76%", "000012"]);
  v[1] = -3;
  e.advance(0);
  assert.equal(clock.text, "0:00", "a clock never shows negative time");
  v[1] = 3600 + 9;
  e.advance(0);
  assert.equal(clock.text, "60:09", "past the cache it still formats");
  e.destroy();
  assert.deepEqual([kills.text, clock.text], ["0", "3:00"], "destroy restores the text");
});

test("meter and flag: whole-percent width, low class, progressbar value, class follows", () => {
  const e = createEngine();
  const v = new Float64Array([1, 0]);
  const bar = new El("u"), box = new El("div");
  bar.attrs.set("role", "progressbar");
  hud(e, null).meter(bar, () => v[0], 0.34).flag(box, "hot", () => v[1] > 0);
  e.advance(0);
  assert.equal(bar.style.getPropertyValue("width"), "100%");
  assert.equal(bar.getAttribute("aria-valuenow"), "100");
  assert.equal(bar.set.has("low"), false);
  const w = writes[0];
  v[0] = 1.0001; // clamps to 100%: nothing to write
  e.advance(0);
  assert.equal(writes[0], w);
  v[0] = 2 / 6;
  v[1] = 1;
  e.advance(0);
  assert.equal(bar.style.getPropertyValue("width"), "33%");
  assert.equal(bar.set.has("low"), true);
  assert.equal(box.set.has("hot"), true);
  e.destroy();
  assert.equal(box.set.has("hot"), false);
  assert.equal(bar.set.has("low"), false);
});

test("feed and banner: driven by the event ring, newest first, capped at rows", () => {
  const e = createEngine();
  const list = new El("ol"), banner = new El("div");
  banner.appendChild(new El("b"));
  banner.appendChild(new El("span"));
  const NAMES = ["YOU", "RAVEN", "BISON", "VIPER", "KITE"];
  let played = 0;
  hud(e, null)
    .feed(list, 3, "kill", (a, b) => NAMES[a] + " ✕ " + NAMES[b])
    .banner(banner, "streak", (a) => [a + " KILL STREAK", "AIRSTRIKE READY"], () => played++);
  e.advance(0);
  assert.equal(list.children.length, 0, "nothing is built before the first event");
  const w = writes[0];
  for (let i = 0; i < 50; i++) e.advance(0);
  assert.equal(writes[0], w, "no events, no writes");
  const q = [];
  e.add({ step: (x) => q.splice(0).forEach(([t, a, b]) => x.events.emit(t, a, b)) });
  q.push(["kill", 0, 1]);
  e.advance(1 / 60);
  assert.deepEqual(list.children.map((r) => r.text), ["YOU ✕ RAVEN", "", ""]);
  // Several events in one frame: rows rotate, the cap holds, each row is written once.
  q.push(["kill", 2, 3], ["kill", 4, 0], ["boom", 1, 1], ["kill", 1, 2], ["streak", 3]);
  e.advance(1 / 60);
  assert.deepEqual(list.children.map((r) => r.text), ["RAVEN ✕ BISON", "KITE ✕ YOU", "BISON ✕ VIPER"]);
  assert.equal(list.children.length, 3, "never more rows than asked for");
  assert.deepEqual(banner.children.map((c) => c.text), ["3 KILL STREAK", "AIRSTRIKE READY"]);
  assert.equal(played, 1);
  // Rows and text nodes are found on the first event only: later event frames read no DOM.
  const reads = kidReads[0];
  q.push(["kill", 3, 4], ["streak", 4]);
  e.advance(1 / 60);
  assert.equal(kidReads[0], reads, "an event frame reads no children");
  assert.deepEqual(list.children.map((r) => r.text), ["VIPER ✕ KITE", "RAVEN ✕ BISON", "KITE ✕ YOU"]);
  assert.equal(played, 2);
  e.destroy();
});

const youngGCs = (frames, run) => minorGCs(() => run(frames));

test("zero allocation in the steady state, bounded when values change", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine({ events: 16 });
  const s = new Float64Array(4); // kills, clock, rank, hp
  const els = Array.from({ length: 6 }, () => new El("b", ""));
  const list = new El("ol"), banner = new El("div");
  banner.appendChild(new El("b"));
  const LINES = ["A ✕ B", "C ✕ D"], STREAK = ["STREAK"];
  const h = hud(e, null)
    .num(els[0], () => s[0]) // whole numbers from a getter: no boxing
    .num(els[1], [s, 1], "clock") // running fractions from a typed-array slot
    .num(els[2], () => s[2], "rank")
    .meter(els[3], [s, 3], 0.3)
    .flag(els[4], "low", () => s[3] < 0.3)
    .feed(list, 4, "kill", (a) => LINES[a & 1])
    .banner(banner, "streak", () => STREAK); // callbacks that return what they have: nothing allocates
  const mode = new Int32Array(1), ring = e.events;
  // The HUD system alone, as the kernel test runs the kernel alone (engine.advance also calls
  // performance.now(), which boxes on some Node versions and would hide the brick's own number).
  const render = h.system.render;
  const frame = () => {
    ring.clear();
    if (mode[0]) {
      s[1] += 1 / 60; // the clock ticks: a write once a second
      s[0] = (s[0] + 1) % 1000; // the score changes every frame
      s[3] = (s[3] + 0.01) % 1;
      if (mode[0] === 2 && s[0] % 30 === 0) ring.emit("kill", s[0]), ring.emit("streak");
    }
    render(e, 0);
  };
  const run = (n) => {
    for (let i = 0; i < n; i++) frame();
  };
  // Warm up every path (fills the string caches once).
  mode[0] = 2;
  run(20000);
  mode[0] = 0;
  run(1000);
  const w = writes[0];
  const still = await youngGCs(1000000, run);
  assert.equal(writes[0], w, "unchanged values: not one write");
  mode[0] = 1;
  const moving = await youngGCs(1000000, run);
  mode[0] = 2;
  const events = await youngGCs(1000000, run);
  console.log(`# hud young GCs over 1M frames: unchanged ${still}, every value changing ${moving}, + feed/banner events ${events}`);
  assert.ok(still <= 1, `unchanged values: ${still} young GCs`);
  assert.ok(moving <= 1, `changing values reuse cached strings: ${moving} young GCs`);
  // Events read no DOM and box nothing; `line`/`text` here return strings and arrays they hold.
  assert.ok(events <= 1, `events: ${events} young GCs`);
  e.destroy();
});
