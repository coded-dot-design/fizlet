// fzlt/arcade (Node): the controller's contract where no page is needed: the snapshot before a
// run, a start that fails part-way leaving the page exactly as it was (Recall on failure: no host,
// no listener, no engine), destroy for good, and the card preset's markup escaping. A run (the page
// as the board, the overlay, the HUD, Recall after a run, zero allocation in the HUD write) needs
// a real page: tests/arcade.mjs, tests/arcade-game.mjs and tests/arcade-hud.mjs run it in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { installPage } from "./fake-dom.mjs";

const { arcade, arcadeHud } = await import("../src/arcade.ts");
const { esc } = await import("../src/arcade-parts.ts");

const def = (extra = {}) => ({
  id: "test-game", title: `Null <Invaders> & "co"`, color: "#06c4ff", hint: "Move: WASD", css: ".bui{}", colors: ["#fff"], cues: { shot: "fire" },
  create: () => {
    throw new Error("create must not run in these tests");
  },
  ...extra,
});

test("arcade: before a run the snapshot is idle and pause, resume and stop do nothing", () => {
  const states = [], events = [];
  const g = arcade(def(), { onState: (s) => states.push(s.status), onEvent: (e) => events.push(e.type) });
  assert.deepEqual(g.getSnapshot(), { id: "test-game", status: "idle", elapsed: 0, frameMs: 0, maxFrameMs: 0, notice: "" });
  g.pause();
  g.resume();
  assert.equal(g.getSnapshot().status, "idle");
  assert.deepEqual(states, []);
  g.stop();
  assert.deepEqual(events, ["recall"], "stop always gives the page back (and says so)");
});

test("arcade: a start that fails part-way throws, reports, and leaves the page exactly as it was", () => {
  const page = installPage();
  const keep = Object.fromEntries(["innerWidth", "innerHeight", "scrollX", "scrollY", "devicePixelRatio"].map((k) => [k, globalThis[k]]));
  try {
    Object.assign(globalThis, { innerWidth: 1280, innerHeight: 720, scrollX: 0, scrollY: 0, devicePixelRatio: 1 });
    // The overlay gets a canvas, so the run goes on to create its engine and the page board, which
    // needs the real DOM (Range, TreeWalker) and throws here: the failure lands mid-run.
    Object.defineProperty(page.doc.createElement("div").constructor.prototype, "innerHTML", {
      configurable: true,
      set(html) {
        if (html.includes("<canvas")) {
          const c = this.ownerDocument.createElement("canvas");
          c.getContext = () => ({});
          this.appendChild(c);
        }
      },
    });
    Object.defineProperty(page.doc.createElement("div").constructor.prototype, "firstChild", { configurable: true, get() { return this.children[0] ?? null; } });
    const before = { html: page.doc.documentElement.children.length, body: page.doc.body.children.length, win: page.win.count(), doc: page.doc.count() };
    const errors = [], states = [];
    const g = arcade(def(), { onError: (e) => errors.push(e), onState: (s) => states.push(s.status) });
    assert.throws(() => g.start());
    assert.equal(errors.length, 1, "onError hears the failure");
    assert.match(String(errors[0].stack), /at boardPage/, "it failed after the overlay went on the page and the engine was up");
    assert.equal(g.getSnapshot().status, "idle");
    assert.deepEqual({ html: page.doc.documentElement.children.length, body: page.doc.body.children.length, win: page.win.count(), doc: page.doc.count() }, before, "no host, no listener left behind");
    assert.equal(page.doc.documentElement.getAttribute("style"), null, "no ledger write left on the page");
    g.destroy();
  } finally {
    Object.assign(globalThis, keep);
    page.restore();
  }
});

test("arcade: destroy is final: status destroyed, start throws, a second destroy is a no-op", () => {
  const states = [];
  const g = arcade(def(), { onState: (s) => states.push(s.status) });
  g.destroy();
  assert.equal(g.getSnapshot().status, "destroyed");
  assert.throws(() => g.start(), /destroyed/);
  g.destroy();
  assert.deepEqual(states, ["idle", "destroyed"]);
});

test("arcade: the card preset escapes the game's text; the default HUD is the card", () => {
  assert.equal(esc(`<b a="x">'&'</b>`), "&#60;b a=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/b&#62;");
  const card = arcadeHud();
  assert.equal(typeof card.css, "string");
  assert.equal(typeof card.mount, "function");
  assert.equal(arcadeHud({ nav: [] }).css, card.css, "options change the markup, not the CSS");
});
