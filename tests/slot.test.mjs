// @fzlt/core/slot (Node, on tests/fake-dom.mjs): lazy (near the viewport, then idle), the safe first
// tap, reduced motion (never loads; turning it on takes a running scene down), accessibility,
// Recall (destroy gives the slot back as the engine drew it), and no allocation on a tap once the
// scene is up. The browser, fizz and layers suites run it in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { installPage, settle } from "./fake-dom.mjs";
import { minorGCs } from "./gc.mjs";

const { slot, findSlot } = await import("../src/slot.ts");
const REDUCE = "(prefers-reduced-motion: reduce)";

/** The engine's figure: `<figure class="ae-slot" data-slot-target role="img" aria-label>` with a
 *  placeholder and a fallback caption inside. */
function figure(page, target = "home#hero") {
  const f = page.doc.body.appendChild(page.doc.createElement("figure"));
  f.className = "ae-slot";
  f.setAttribute("data-slot-target", target);
  f.setAttribute("role", "img");
  f.setAttribute("aria-label", "A swarm crossing the page");
  const ph = f.appendChild(page.doc.createElement("div"));
  ph.className = "ae-slot__placeholder";
  const fb = f.appendChild(page.doc.createElement("figcaption"));
  fb.className = "ae-slot__fallback";
  return { f, ph, fb };
}
function scene(opts = {}) {
  const s = { made: [], destroyed: 0 };
  s.mount = (stage, el, first) => (s.made.push({ stage, el, first }), { destroy: () => s.destroyed++, ...opts });
  return s;
}
/** Snapshot of what the page shows: attributes and inline style of the figure and its children. */
const snap = (f) => JSON.stringify([f, ...f.children].map((n) => [n.tagName, n.getAttribute("role"), n.getAttribute("style"), n.getAttribute("aria-hidden")]));

test("slot: findSlot finds the figure or a box inside one, by its exact target", () => {
  const page = installPage();
  try {
    const { f } = figure(page, "home#hero");
    const outer = page.doc.body.appendChild(page.doc.createElement("figure"));
    outer.className = "ae-slot-figure";
    const box = outer.appendChild(page.doc.createElement("div"));
    box.className = "ae-slot";
    box.setAttribute("data-slot-target", "pricing#diagram");
    assert.equal(findSlot("home#hero"), f);
    assert.equal(findSlot("pricing#diagram"), box);
    assert.equal(findSlot("home#her"), null);
    assert.equal(slot("nowhere#x", () => scene().mount).el, null, "no slot: a handle that does nothing");
  } finally {
    page.restore();
  }
});

test("slot: loads only near the viewport and once idle; builds a contained, aria-hidden stage", async () => {
  const page = installPage();
  try {
    const { f, ph, fb } = figure(page);
    const before = snap(f), s = scene();
    let loads = 0;
    const h = slot("home#hero", () => (loads++, s.mount), { margin: "300px", idle: 500 });
    assert.equal(page.observers.length, 1);
    assert.equal(page.observers[0].opts.rootMargin, "300px");
    page.observers[0].fire(false);
    await settle();
    assert.equal(loads, 0, "far from the viewport: nothing loads");
    page.observers[0].fire(true);
    assert.equal(page.observers.length, 0, "near: the observer is done");
    await settle();
    assert.equal(loads, 0, "near, but the main thread isn't idle yet");
    page.idle();
    await settle();
    assert.equal(loads, 1);
    assert.equal(h.mounted, true);
    const { stage, el, first } = s.made[0];
    assert.equal(el, f);
    assert.equal(first, null);
    assert.equal(stage.parentNode, f);
    assert.equal(stage.getAttribute("data-fizlet-slot"), "home#hero");
    assert.equal(stage.getAttribute("aria-hidden"), "true");
    assert.match(stage.style.cssText, /contain: strict/);
    assert.match(stage.style.cssText, /content-visibility: auto/);
    assert.equal(f.style.position, "relative", "a static figure becomes the stage's containing block");
    assert.equal(ph.style.display, "none");
    assert.equal(fb.style.display, "none");
    assert.equal(f.getAttribute("role"), "img", "role=img stays: the scene isn't accessible content");
    h.destroy();
    assert.equal(s.destroyed, 1);
    assert.equal(stage.parentNode, null);
    assert.equal(snap(f), before, "Recall: the slot is back as the engine drew it");
    assert.equal(f.count(), 0, "and its tap listener is gone");
  } finally {
    page.restore();
  }
});

test("slot: an accessible scene drops role=img; Recall puts it back", async () => {
  const page = installPage();
  try {
    const { f } = figure(page);
    const h = slot(f, () => scene({ accessible: true }).mount, { idle: 0 });
    page.observers[0].fire(true);
    await settle();
    assert.equal(f.getAttribute("role"), null);
    h.destroy();
    assert.equal(f.getAttribute("role"), "img");
  } finally {
    page.restore();
  }
});

test("slot: a first tap loads at once and reaches the scene as numbers, not as the event", async () => {
  const page = installPage();
  try {
    const { f } = figure(page);
    f.rect = { left: 100, top: 40, width: 600, height: 300 };
    const s = scene();
    const h = slot(f, () => s.mount);
    f.dispatch("pointerdown", { isPrimary: false, clientX: 1, clientY: 1, timeStamp: 1 });
    await settle();
    assert.equal(s.made.length, 0, "a second finger doesn't start it");
    f.dispatch("pointerdown", { isPrimary: true, clientX: 130, clientY: 90, timeStamp: 1234 });
    await settle();
    assert.equal(s.made.length, 1, "no idle wait after a tap");
    assert.deepEqual(s.made[0].first, { x: 30, y: 50, at: 1234 });
    assert.equal(page.observers.length, 0);
    h.destroy();
  } finally {
    page.restore();
  }
});

test("slot: reduced motion keeps the placeholder; turned on mid-run the scene goes; turned off it can come back", async () => {
  const page = installPage();
  try {
    const { f } = figure(page);
    const before = snap(f);
    const motion = globalThis.matchMedia(REDUCE);
    motion.matches = true;
    const s = scene();
    let loads = 0;
    const h = slot(f, () => (loads++, s.mount), { idle: 0 });
    assert.equal(page.observers.length, 0, "reduced motion: never armed");
    f.dispatch("pointerdown", { isPrimary: true, clientX: 0, clientY: 0, timeStamp: 0 });
    await settle();
    assert.equal(loads, 0, "a tap doesn't load it either");
    motion.set(false);
    assert.equal(page.observers.length, 1, "motion allowed again: armed");
    page.observers[0].fire(true);
    await settle();
    assert.equal(h.mounted, true);
    motion.set(true);
    assert.equal(h.mounted, false);
    assert.equal(s.destroyed, 1, "the running scene is destroyed");
    assert.equal(snap(f), before, "and the fallback is back");
    h.destroy();
    assert.equal(motion.count(), 0, "its media listener is gone");
  } finally {
    page.restore();
  }
});

test("slot: destroy during the load or the idle wait: the scene never mounts", async () => {
  const page = installPage();
  try {
    const { f } = figure(page);
    const before = snap(f), s = scene();
    let resolve;
    const h = slot(f, () => new Promise((r) => (resolve = r)), { idle: 0 });
    page.observers[0].fire(true);
    await settle();
    h.destroy();
    resolve(s.mount);
    await settle();
    assert.equal(s.made.length, 0);
    const h2 = slot(f, () => s.mount, { idle: 1000 });
    page.observers[0].fire(true);
    h2.destroy(); // inside the idle wait
    page.idle();
    await settle();
    assert.equal(s.made.length, 0);
    assert.equal(snap(f), before);
  } finally {
    page.restore();
  }
});

// slot has no step: its scene's engine does the frames. What the slot itself runs while a scene is
// up is its tap listener, on every pointerdown on the slot (a game's every tap). It must not allocate.
test("slot: zero allocation on taps once the scene is up", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const page = installPage();
  try {
    const { f } = figure(page);
    const h = slot(f, () => scene().mount, { idle: 0 });
    page.observers[0].fire(true);
    await settle();
    assert.equal(h.mounted, true);
    const [tap] = f.listeners.map((l) => l.fn), ev = { isPrimary: true, clientX: 5, clientY: 5, timeStamp: 0 };
    let sink = null;
    const leak = (e) => void (sink = { x: e.clientX }); // the self-check: a listener that allocates
    const run = (fn) => (n) => {
      for (let i = 0; i < n; i++) (ev.clientX = i & 63), fn(ev);
    };
    run(tap)(20000);
    const taps = await minorGCs(() => run(tap)(1000000));
    run(leak)(20000);
    const control = await minorGCs(() => run(leak)(1000000));
    console.log(`# slot young GCs over 1M taps on a running scene: ${taps}; self-check, an allocating listener: ${control}`);
    assert.ok(sink);
    assert.ok(control >= 5, `the method sees one object per tap: ${control}`);
    assert.ok(taps <= 1, `taps on a running scene: ${taps} young GCs`);
    h.destroy();
  } finally {
    page.restore();
  }
});
