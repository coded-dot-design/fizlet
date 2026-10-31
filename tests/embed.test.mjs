// fizlet/embed (Node, on tests/fake-dom.mjs): open now or behind the toggle, the easter-egg
// triggers, Escape, a load that loses the race, Recall (destroy leaves no listener, no node), and
// no allocation on the dormant pointer path. The browser suite runs it in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { installPage, settle } from "./fake-dom.mjs";
import { minorGCs } from "./gc.mjs";

const { embed } = await import("../src/embed.ts");

/** A game: mount records its host and config; destroy is counted. */
function game() {
  const g = { mounts: [], destroyed: 0 };
  g.mount = (host, cfg) => (g.mounts.push({ host, cfg }), { destroy: () => g.destroyed++ });
  return g;
}
const toggleOf = (doc) => doc.body.children.find((c) => c.shadowRoot)?.shadowRoot.children.find((c) => c.tagName === "BUTTON") ?? null;
const key = (page, k, target) => page.win.dispatch("keydown", { key: k, target: target ?? page.doc.body });

test("embed: no easter egg opens now; the host carries the ignore and host marks; the palette is checked", async () => {
  const page = installPage();
  try {
    const g = game();
    const em = embed(() => g.mount, { name: "swarm", palette: { sys: "#39ffb0", fire: "red;}body{x:y", nope: "#fff" } });
    await settle();
    assert.equal(g.mounts.length, 1);
    const host = g.mounts[0].host;
    assert.equal(host.parentNode, page.doc.body);
    assert.equal(host.getAttribute("data-swarm-ignore"), "");
    assert.equal(host.getAttribute("data-fizlet-host"), "swarm");
    assert.equal(host.style.getPropertyValue("--k-sys"), "#39ffb0");
    assert.equal(host.style.getPropertyValue("--k-fire"), "", "a colour that isn't a hex value never reaches the page");
    assert.equal(em.opened, true);
    assert.equal(toggleOf(page.doc).textContent, "✕ CLOSE");
    em.destroy();
  } finally {
    page.restore();
  }
});

test("embed: open:false waits behind the toggle key; the key opens and closes; Escape closes", async () => {
  const page = installPage();
  try {
    const g = game();
    let loads = 0;
    const em = embed(() => (loads++, g.mount), { name: "blitz", label: "Battlefield Blitz", open: false });
    await settle();
    assert.equal(loads, 0, "nothing loads before the player asks");
    const btn = toggleOf(page.doc);
    assert.equal(btn.textContent, "▶ BATTLEFIELD BLITZ");
    assert.equal(btn.getAttribute("aria-label"), "Play Battlefield Blitz");
    btn.dispatch("click");
    await settle();
    assert.equal(em.opened, true);
    assert.equal(btn.className, "open");
    assert.equal(btn.getAttribute("aria-label"), "Close Battlefield Blitz");
    key(page, "Escape");
    assert.equal(em.opened, false);
    assert.equal(g.destroyed, 1, "Escape closes: the game gives the page back");
    assert.equal(g.mounts[0].host.parentNode, null, "and its host is gone");
    btn.dispatch("click");
    await settle();
    btn.dispatch("click");
    assert.equal(g.destroyed, 2, "the toggle closes too");
    em.destroy();
  } finally {
    page.restore();
  }
});

test("embed: a close while the game loads wins: the late load never mounts", async () => {
  const page = installPage();
  try {
    const g = game();
    let resolve;
    const em = embed(() => new Promise((r) => (resolve = r)), { name: "late" });
    em.close();
    resolve(g.mount);
    await settle();
    assert.equal(g.mounts.length, 0);
    assert.equal(page.doc.body.children.filter((c) => c.getAttribute("data-fizlet-host")).length, 0);
    em.destroy();
  } finally {
    page.restore();
  }
});

test("embed: the Konami code unlocks; keys typed in a field never count; a slow sequence starts over", async () => {
  const page = installPage();
  try {
    const g = game();
    const em = embed(() => g.mount, { name: "egg", easterEgg: true });
    await settle();
    assert.equal(em.unlocked, false);
    assert.equal(toggleOf(page.doc), null, "dormant: no toggle on the page");
    const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a", "Enter"];
    const field = page.doc.body.appendChild(page.doc.createElement("input"));
    for (const k of CODE) key(page, k, field);
    assert.equal(em.unlocked, false, "typed in an input: ignored");
    const now = performance.now;
    let t = 1000;
    performance.now = () => t;
    try {
      for (const k of CODE.slice(0, 5)) key(page, k);
      t += 2000; // a pause longer than 1.5 s
      for (const k of CODE.slice(5)) key(page, k);
      assert.equal(em.unlocked, false, "the sequence starts over after a pause");
      for (const k of CODE) key(page, k);
    } finally {
      performance.now = now;
    }
    assert.equal(em.unlocked, true);
    await settle();
    assert.equal(g.mounts.length, 1);
    assert.ok(toggleOf(page.doc), "unlocked: the toggle key appears");
    em.destroy();
  } finally {
    page.restore();
  }
});

test("embed: gestures (double-tap, long-press, hold-then-tap) and a click on a selector unlock", async () => {
  const page = installPage();
  try {
    globalThis.matchMedia("(pointer: coarse)").matches = true; // a phone: gestures are mobile-only by default
    const trigger = page.doc.body.appendChild(page.doc.createElement("div"));
    trigger.setAttribute("data-g-trigger", "");
    const down = (el = trigger, x = 10, y = 10) => page.win.dispatch("pointerdown", { target: el, clientX: x, clientY: y });
    const realNow = performance.now, realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
    let t = 10000; // performance.now() well after navigation
    const timers = [];
    performance.now = () => t;
    globalThis.setTimeout = (cb, ms) => timers.push({ cb, at: t + ms });
    globalThis.clearTimeout = (id) => id && timers[id - 1] && (timers[id - 1].cb = () => {});
    const tick = (ms) => {
      t += ms;
      for (const x of timers) if (x.at <= t) (x.cb(), (x.cb = () => {}));
    };
    try {
      const dbl = embed(() => game().mount, { name: "g", easterEgg: { sequence: false, gesture: { on: "[data-g-trigger]", type: "double-tap" } } });
      down();
      tick(500);
      down();
      assert.equal(dbl.unlocked, false, "two taps 500 ms apart are not a double-tap");
      tick(100);
      down();
      assert.equal(dbl.unlocked, true);
      dbl.destroy();
      const long = embed(() => game().mount, { name: "g", easterEgg: { sequence: false, gesture: { on: "[data-g-trigger]", type: "long-press" } } });
      down();
      page.win.dispatch("pointermove", { clientX: 30, clientY: 10 }); // moved 20 px: not a press
      tick(800);
      assert.equal(long.unlocked, false);
      down();
      tick(800);
      assert.equal(long.unlocked, true);
      long.destroy();
      const hold = embed(() => game().mount, { name: "g", easterEgg: { sequence: false } }); // default: hold-tap on [data-g-trigger]
      down();
      tick(1000);
      page.win.dispatch("pointerup", {});
      down();
      assert.equal(hold.unlocked, true, "held 0.9 s, then a tap within 5 s");
      hold.destroy();
      const link = page.doc.body.appendChild(page.doc.createElement("a"));
      link.className = "secret";
      const click = embed(() => game().mount, { name: "c", easterEgg: { sequence: false, gesture: false, click: ".secret" } });
      const ev = page.win.dispatch("click", { target: link });
      assert.equal(click.unlocked, true);
      assert.equal(ev.defaultPrevented, true, "the trigger click doesn't also follow the link");
      click.destroy();
    } finally {
      performance.now = realNow;
      globalThis.setTimeout = realSet;
      globalThis.clearTimeout = realClear;
    }
    await settle();
  } finally {
    page.restore();
  }
});

test("embed: Recall: destroy closes the game and leaves no listener and no node on the page", async () => {
  const page = installPage();
  try {
    const g = game();
    const before = page.win.count();
    const em = embed(() => g.mount, { name: "r", easterEgg: { click: ".x" } });
    assert.ok(page.win.count() > before, "dormant listeners");
    em.unlock();
    await settle();
    assert.equal(page.doc.body.children.length, 2, "the game's host and the toggle key");
    em.destroy();
    assert.equal(g.destroyed, 1);
    assert.equal(page.win.count(), before, "every window listener removed");
    assert.equal(page.doc.body.children.length, 0, "host and toggle removed");
    em.unlock();
    await settle();
    assert.equal(g.mounts.length, 1, "inert after destroy");
  } finally {
    page.restore();
  }
});

// embed has no step: what runs often is the dormant easter egg's pointer listeners, on every pointer
// move over the page (60–120 a second). That path must not allocate.
test("embed: zero allocation on the dormant pointer path (moves with and without a pending press)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const page = installPage();
  try {
    globalThis.matchMedia("(pointer: coarse)").matches = true;
    const trigger = page.doc.body.appendChild(page.doc.createElement("div"));
    trigger.setAttribute("data-a-trigger", "");
    const em = embed(() => game().mount, { name: "a", easterEgg: { sequence: false } });
    const moves = page.win.listeners.filter((l) => l.type === "pointermove").map((l) => l.fn);
    assert.equal(moves.length, 1);
    const move = moves[0], ev = { clientX: 10, clientY: 10, target: trigger, type: "pointermove" };
    let sink = null;
    const leak = (e) => void (sink = { x: e.clientX }); // the self-check: a listener that allocates
    const run = (fn) => (n) => {
      for (let i = 0; i < n; i++) (ev.clientX = 10 + (i & 7)), fn(ev);
    };
    run(move)(20000);
    const idle = await minorGCs(() => run(move)(1000000));
    page.win.dispatch("pointerdown", { target: trigger, clientX: 10, clientY: 10 }); // a press pending: moves are measured
    run(move)(20000);
    const pressing = await minorGCs(() => run(move)(1000000));
    run(leak)(20000);
    const control = await minorGCs(() => run(leak)(1000000));
    console.log(`# embed young GCs over 1M pointer moves: idle ${idle}, during a press ${pressing}; self-check, an allocating listener: ${control}`);
    assert.ok(sink);
    assert.ok(control >= 5, `the method sees one object per move: ${control}`);
    assert.ok(idle <= 1, `dormant moves: ${idle} young GCs`);
    assert.ok(pressing <= 1, `moves during a press: ${pressing} young GCs`);
    em.destroy();
  } finally {
    page.restore();
  }
});
