// @fzlt/core/ui (Node, on tests/fake-dom.mjs): the Board UI kit's behaviour half. mount isolates and
// shares sheets, applyPalette takes hex only and restores, the press helpers fire once, setting
// survives storage that throws, launch honours reduced motion, every listener follows the signal
// (Recall), and the per-press paths allocate nothing. tokens.test.mjs checks the CSS against
// tokens.json; the browser suite runs the kit in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import { installPage } from "./fake-dom.mjs";
import { minorGCs } from "./gc.mjs";

const ui = await import("../src/ui/board-ui.ts");

test("ui: mount builds the .bui root in a shadow root; one constructed sheet per CSS text, appended", () => {
  const page = installPage();
  const keep = Object.getOwnPropertyDescriptor(globalThis, "CSSStyleSheet");
  try {
    // No constructable sheets: a <style> in the shadow root.
    const a = page.doc.body.appendChild(page.doc.createElement("div"));
    const root = ui.mount(a, ".bui{}", { theme: "light", side: 1, palette: { go: "#00ff00" } });
    assert.equal(root.className, "bui");
    assert.equal(root.parentNode, a.shadowRoot);
    assert.equal(a.shadowRoot.children[0].tagName, "STYLE");
    assert.equal(a.shadowRoot.children[0].textContent, ".bui{}");
    assert.equal(root.style.contain, "style", "style containment only (rule 8)");
    assert.equal(root.dataset.theme, "light");
    assert.equal(root.dataset.side, "1");
    assert.equal(root.style.getPropertyValue("--k-go"), "#00ff00");
    // Constructable sheets: shared by text, appended after the page's own.
    let made = 0;
    globalThis.CSSStyleSheet = class {
      constructor() {
        made++;
      }
      replaceSync(t) {
        this.text = t;
      }
    };
    const host = () => {
      const h = page.doc.createElement("div"), s = h.attachShadow();
      s.adoptedStyleSheets = [];
      return h;
    };
    const own = { mine: true }, b = host(), c = host(), d = host();
    b.shadowRoot.adoptedStyleSheets = [own];
    ui.mount(b, "A");
    ui.mount(c, "A");
    ui.mount(d, "B");
    ui.mount(b, "A"); // remounting adds no second copy
    assert.equal(made, 2, "one sheet per distinct text");
    assert.equal(b.shadowRoot.adoptedStyleSheets.length, 2);
    assert.equal(b.shadowRoot.adoptedStyleSheets[0], own, "the host's own sheet is kept, first");
    assert.equal(b.shadowRoot.adoptedStyleSheets[1], c.shadowRoot.adoptedStyleSheets[0], "same text, same sheet");
    assert.notEqual(c.shadowRoot.adoptedStyleSheets[0], d.shadowRoot.adoptedStyleSheets[0]);
  } finally {
    keep ? Object.defineProperty(globalThis, "CSSStyleSheet", keep) : delete globalThis.CSSStyleSheet;
    page.restore();
  }
});

test("ui: applyPalette sets valid hex colours on known roles only, and its undo restores the page's values", () => {
  const page = installPage();
  try {
    const root = page.doc.createElement("div");
    root.style.setProperty("--k-sys", "#111111");
    const undo = ui.applyPalette(root, { sys: "#39ffb0", fire: "#F0A", aim: "red", cmd: "#12345", bogus: "#fff", teamA: "#ff5c8f80", go: 42 });
    assert.equal(root.style.getPropertyValue("--k-sys"), "#39ffb0");
    assert.equal(root.style.getPropertyValue("--k-fire"), "#F0A");
    assert.equal(root.style.getPropertyValue("--team-a"), "#ff5c8f80");
    for (const v of ["--k-aim", "--k-cmd", "--k-go", "--bogus"]) assert.equal(root.style.getPropertyValue(v), "", `${v}: not a hex colour or not a role`);
    undo();
    assert.equal(root.style.getPropertyValue("--k-sys"), "#111111", "the page's own value comes back");
    assert.equal(root.style.getPropertyValue("--k-fire"), "");
    assert.equal(root.style.getPropertyValue("--team-a"), "");
  } finally {
    page.restore();
  }
});

test("ui: readouts builds labelled values in order, with tones", () => {
  const page = installPage();
  try {
    const parent = page.doc.createElement("div");
    const { group, values } = ui.readouts(parent, [["SCORE"], ["HP", "team"], ["FOE", "enemy"]], true);
    assert.equal(group.parentNode, parent);
    assert.equal(group.className, "bui-readouts bui-on-map");
    assert.equal(values.length, 3);
    assert.deepEqual(values.map((v) => v.tagName), ["B", "B", "B"]);
    assert.deepEqual(group.children.map((c) => [c.textContent, c.dataset.tone]), [["SCORE", undefined], ["HP", "team"], ["FOE", "enemy"]]);
  } finally {
    page.restore();
  }
});

test("ui: press fires once per touch (the click after it is skipped) and once per click; Recall removes it", () => {
  const page = installPage();
  try {
    const el = page.doc.createElement("button"), ctl = new AbortController();
    let n = 0;
    ui.press(el, () => n++, ctl.signal);
    el.dispatch("touchstart", { cancelable: true });
    assert.equal(n, 1);
    el.dispatch("touchstart", { cancelable: false }); // uncancellable: a click follows
    el.dispatch("click");
    assert.equal(n, 2, "the click after an uncancellable touch is the same press");
    el.dispatch("click");
    assert.equal(n, 3, "a plain click presses");
    ctl.abort();
    assert.equal(el.count(), 0);
    el.dispatch("click");
    assert.equal(n, 3);
  } finally {
    page.restore();
  }
});

test("ui: pressCue shows the pressed face for Enter (and Space on a button) until key up or focus out", () => {
  const page = installPage();
  try {
    const root = page.doc.createElement("div"), ctl = new AbortController();
    const btn = root.appendChild(page.doc.createElement("button")), link = root.appendChild(page.doc.createElement("a"));
    btn.className = "bui-key";
    link.className = "bui-key";
    const label = btn.appendChild(page.doc.createElement("span"));
    ui.pressCue(root, ctl.signal);
    root.dispatch("keydown", { key: "Enter", target: label });
    assert.equal(btn.classList.contains("down"), true, "from a child of the key");
    root.dispatch("keyup", { target: label });
    assert.equal(btn.classList.contains("down"), false);
    root.dispatch("keydown", { key: " ", target: link });
    assert.equal(link.classList.contains("down"), false, "Space doesn't activate a link");
    root.dispatch("keydown", { key: " ", target: btn });
    assert.equal(btn.classList.contains("down"), true);
    root.dispatch("focusout", { target: btn });
    assert.equal(btn.classList.contains("down"), false);
    assert.equal(root.count("touchstart"), 1, "one passive touchstart lets iOS apply :active");
    ctl.abort();
    assert.equal(root.count(), 0, "Recall: every listener follows the signal");
  } finally {
    page.restore();
  }
});

test("ui: setting reads, flips and remembers; storage that throws only makes it forget", () => {
  const page = installPage();
  const keep = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    const store = new Map([["k", "1"]]);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
    const btn = page.doc.createElement("button"), ctl = new AbortController(), seen = [];
    const s = ui.setting(btn, "k", (on) => seen.push(on), ctl.signal);
    assert.equal(s.on, true);
    assert.equal(btn.getAttribute("aria-pressed"), "true");
    btn.dispatch("click");
    assert.equal(store.get("k"), "0");
    assert.deepEqual(seen, [true, false]);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
    const b2 = page.doc.createElement("button");
    const s2 = ui.setting(b2, "k", () => {}, ctl.signal, true);
    assert.equal(s2.on, true, "the fallback when storage throws");
    b2.dispatch("click");
    assert.equal(s2.on, false, "it still flips");
    ctl.abort();
  } finally {
    keep ? Object.defineProperty(globalThis, "localStorage", keep) : delete globalThis.localStorage;
    page.restore();
  }
});

test("ui: launch with reduced motion runs the action at once, draws no burst, and is done in 90 ms", async () => {
  const page = installPage();
  try {
    const btn = page.doc.body.appendChild(page.doc.createElement("button"));
    let acted = 0, done = 0;
    ui.launch(btn, () => acted++, { reduced: true, done: () => done++ });
    assert.equal(acted, 1, "the action runs inside the click (user activation kept)");
    assert.equal(page.doc.body.children.length, 1, "no burst layer");
    assert.equal(btn.classList.contains("bui-igniting"), false);
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(done, 1);
  } finally {
    page.restore();
  }
});

// ui has no step: what it runs often is the press paths, on every key and tap on a board. They
// must not allocate (the fake's classList allocates, so the key paths run on targets outside a key).
test("ui: zero allocation on the press paths (touches, clicks, keys outside a key, key up, focus out)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const page = installPage();
  try {
    const root = page.doc.createElement("div"), plain = root.appendChild(page.doc.createElement("p"));
    plain.closest = () => null; // a target with no key above it, read without the fake's selector parsing
    const btn = page.doc.createElement("button"), ctl = new AbortController();
    let n = 0, sink = null;
    ui.pressCue(root, ctl.signal);
    ui.press(btn, () => n++, ctl.signal);
    const fns = [...root.listeners, ...btn.listeners].map((l) => l.fn);
    const ev = { key: "Enter", target: plain, cancelable: true, preventDefault() {} };
    const run = (n) => {
      for (let i = 0; i < n; i++) for (let k = 0; k < fns.length; k++) fns[k](ev);
    };
    const leak = (n) => {
      for (let i = 0; i < n; i++) sink = { k: ev.key, i }; // the self-check: one object per press
    };
    run(20000);
    const presses = await minorGCs(() => run(1000000));
    leak(20000);
    const control = await minorGCs(() => leak(1000000));
    console.log(`# ui young GCs over 1M rounds of touchstart, keydown, keyup, focusout and click: ${presses}; self-check, an allocating handler: ${control}`);
    assert.ok(n > 0 && sink);
    assert.ok(control >= 5, `the method sees one object per press: ${control}`);
    assert.ok(presses <= 1, `press paths: ${presses} young GCs`);
    ctl.abort();
  } finally {
    page.restore();
  }
});
