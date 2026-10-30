// fizlet/announce in Node: one polite region per page (made on the first word), events in words
// through the ring, coalesced by key, at most one write per gap, the same sentence read twice,
// flush, Recall (destroy and the engine's), and zero allocation in frames with nothing to say.
// In a real page with axe-core: tests/announce.mjs.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/kernel/index.ts");
const { announce } = await import("../src/announce.ts");

function page() {
  const body = { kids: [], append(n) { this.kids.push(n); n.parent = body; } };
  const doc = {
    body,
    querySelector: (sel) => body.kids.find((n) => sel === "[data-fz-announce]" && n.attrs.has("data-fz-announce")) ?? null,
    createElement: () => {
      const n = {
        attrs: new Map(), style: { cssText: "" }, textContent: "", parent: null, writes: 0,
        setAttribute: (k, v) => n.attrs.set(k, v),
        get isConnected() { return !!n.parent; },
        remove() { if (n.parent) n.parent.kids.splice(n.parent.kids.indexOf(n), 1), (n.parent = null); },
      };
      let text = "";
      Object.defineProperty(n, "textContent", { get: () => text, set: (v) => ((text = v), n.writes++) });
      return n;
    },
  };
  return doc;
}
const DT = 1 / 60;
const words = (e) => (e.type === "score" ? `Score ${e.a}` : e.type === "lives" ? `${e.a} lives` : e.type === "over" ? "Game over" : null);
const said = (doc) => doc.body.kids[0]?.textContent.replace(/ $/, "");

test("announce: no region until there is something to say; then one polite, atomic, hidden region", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const doc = page(), e = createEngine(), a = announce(e, { words, doc });
    e.advance(DT);
    assert.equal(doc.body.kids.length, 0, "nothing said, nothing made");
    a.say("hello", "Ready");
    mock.timers.tick(0);
    const el = doc.body.kids[0];
    assert.equal(doc.body.kids.length, 1);
    assert.equal(el.attrs.get("role"), "status");
    assert.equal(el.attrs.get("aria-live"), "polite");
    assert.equal(el.attrs.get("aria-atomic"), "true");
    assert.ok(el.attrs.has("data-fz-announce"));
    assert.match(el.style.cssText, /clip-path:inset\(50%\)/);
    assert.doesNotMatch(el.style.cssText, /display:\s*none|visibility/, "hidden from the eye, not from the reader");
    assert.equal(said(doc), "Ready");
    // A second engine on the page shares the region.
    const b = announce(createEngine(), { doc });
    b.say("x", "Two");
    mock.timers.tick(1000);
    assert.equal(doc.body.kids.length, 1, "one region per page");
    assert.equal(said(doc), "Two");
    a.destroy();
    b.destroy();
  } finally {
    mock.timers.reset();
  }
});

test("announce: events in words, coalesced by key, at most one write per gap", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const doc = page(), e = createEngine(), a = announce(e, { words, doc, gap: 1 });
    const step = e.add({ step: (en) => (fire ? fire(en) : 0) });
    let fire = (en) => en.events.emit("lives", 3);
    e.advance(DT);
    mock.timers.tick(0);
    assert.equal(said(doc), "3 lives", "the first word is read at once");
    // Score ticks every frame for half a second; lives drops once; an unknown event stays quiet.
    let s = 0;
    fire = (en) => {
      en.events.emit("score", (s += 10));
      en.events.emit("noise", 1);
      if (s === 100) en.events.emit("lives", 2);
    };
    for (let i = 0; i < 30; i++) e.advance(DT), mock.timers.tick(1000 / 60);
    const el = doc.body.kids[0];
    assert.equal(el.writes, 1, "nothing more within the gap");
    mock.timers.tick(500);
    assert.equal(el.writes, 2, "one write when the gap ends");
    assert.equal(said(doc), "Score 300. 2 lives", "latest score, in first-queued order");
    fire = (en) => en.events.emit("over");
    e.advance(DT);
    mock.timers.tick(999);
    assert.equal(el.writes, 2, "still within the gap");
    mock.timers.tick(1);
    assert.equal(said(doc), "Game over");
    e.remove(step);
    a.destroy();
  } finally {
    mock.timers.reset();
  }
});

test("announce: the same sentence twice is read twice; empty says nothing; flush ignores the gap", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const doc = page(), a = announce(createEngine(), { doc, gap: 2 });
    a.say("lives", "1 life");
    mock.timers.tick(0);
    const el = doc.body.kids[0], first = el.textContent;
    a.say("lives", "1 life");
    mock.timers.tick(2000);
    assert.notEqual(el.textContent, first, "the text changes, so the reader reads it again");
    assert.equal(said(doc), "1 life");
    a.say("score", "");
    mock.timers.tick(5000);
    assert.equal(el.writes, 2, "empty text is not queued");
    a.say("over", "You win");
    a.flush();
    assert.equal(said(doc), "You win", "flush reads at once");
    mock.timers.tick(5000);
    assert.equal(el.writes, 3, "and leaves no timer behind");
    a.destroy();
  } finally {
    mock.timers.reset();
  }
});

test("announce: Recall: destroy (or the engine's) removes the timer, the system and the region it made", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const doc = page(), e = createEngine(), a = announce(e, { words, doc });
    a.say("x", "One");
    mock.timers.tick(0);
    a.say("x", "Two");
    e.destroy();
    assert.equal(doc.body.kids.length, 0, "the region is gone");
    mock.timers.tick(5000);
    assert.equal(doc.body.kids.length, 0, "no write after destroy");
    // A region the page made itself stays.
    const own = doc.createElement();
    own.setAttribute("data-fz-announce", "");
    doc.body.append(own);
    const b = announce(createEngine(), { doc });
    b.say("x", "Hi");
    mock.timers.tick(0);
    assert.equal(own.textContent.trim(), "Hi", "an existing region is used");
    b.destroy();
    assert.equal(doc.body.kids.length, 1, "and left in the page");
  } finally {
    mock.timers.reset();
  }
});

test("announce: zero allocation in frames with nothing to say", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine(), a = announce(e, { words, doc: page() });
  e.add({ step: (en) => en.events.emit("tick", 1) }); // an event with no words: read, not said
  e.start();
  const frames = (n) => {
    for (let i = 0; i < n; i++) e.advance(DT);
  };
  frames(20000);
  gc();
  const minor = await minorGCs(() => frames(200000));
  assert.ok(minor <= 1, `young-generation GCs over 200k frames: ${minor}`);
  a.destroy();
  e.destroy();
});
