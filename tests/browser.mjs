// Browser contract tests (Playwright + Chromium): the ledger gives the page back exactly, auto-pause
// rules, one real requestAnimationFrame for many engines, destroy leaves nothing running, and the
// debug guard catches layout reads in a step, and fizlet/slot (lazy, reduced motion, a11y, Recall).
// debug guard catches layout reads in a step. Sprites: pixel-exact Sherman tile, drawn pixels, cache
// cap, SVG for page characters, and no JS heap allocation in a draw loop (sampled heap profiler).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = (await build({
  stdin: { contents: 'export * from "./src/index.ts"; export { guardLayout } from "./src/debug.ts"; export { controls } from "./src/input.ts"; export { embed } from "./src/embed.ts"; export { sound } from "./src/sound.ts"; export { slot, findSlot } from "./src/slot.ts"; export { sprites } from "./src/sprite.ts"; export { sherman } from "./tests/fixtures/sherman.mjs";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fizlet", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body>
<h1 id="title" class="hero" style="color: red">Hello <b>page</b></h1>
<p id="copy" data-x="1">Some text to wreck.</p>
<input id="field">
<div style="height:3000px"></div>
<div id="far">far down</div>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let where = "start";
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent(PAGE);

  where = "ledger";
  const result = await page.evaluate(() => {
    const { createEngine } = fizlet;
    // Attribute order is not a value the page can see; compare with attributes sorted.
    const snap = () => [...document.body.querySelectorAll("*")].map((n) => n.tagName + [...n.attributes].map((a) => a.name + "=" + a.value).sort().join("|") + "#" + [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("")).join("\n");
    const before = snap();
    const e = createEngine();
    const L = e.ledger;
    const title = document.getElementById("title"), copy = document.getElementById("copy");
    L.text(copy.firstChild, "S0me t3xt t0 wr3ck.");
    L.style(title, "transform", "rotate(4deg)");
    L.style(title, "color", "lime");
    L.style(copy, "--hp", "3");
    L.attr(copy, "data-x", "2");
    L.attr(copy, "aria-busy", "true");
    L.attr(title, "class", null);
    L.cls(copy, "smashed", true);
    const debris = L.add(document.createElement("canvas"));
    document.body.append(debris);
    const during = snap();
    // Writing the same value again touches nothing (change-only).
    let mutations = 0;
    const mo = new MutationObserver((list) => (mutations += list.length));
    mo.observe(document.body, { subtree: true, attributes: true, characterData: true, childList: true });
    L.style(title, "transform", "rotate(4deg)");
    L.attr(copy, "data-x", "2");
    L.cls(copy, "smashed", true);
    L.text(copy.firstChild, "S0me t3xt t0 wr3ck.");
    const flushed = mo.takeRecords().length + mutations;
    mo.disconnect();
    e.destroy();
    const titleStyle = document.getElementById("title").getAttribute("style");
    return { same: snap() === before, changed: during !== before, flushed, size: L.size, titleStyle };
  });
  assert.equal(result.changed, true, "the engine changed the page");
  assert.equal(result.flushed, 0, "rewriting the same values makes no DOM mutations");
  assert.equal(result.same, true, "destroy (Recall) restores the exact DOM");
  assert.equal(result.size, 0);
  assert.equal(result.titleStyle, "color: red", "the style attribute text comes back byte for byte");

  where = "host-wins";
  const host = await page.evaluate(() => {
    const e = fizlet.createEngine(), L = e.ledger;
    const copy = document.getElementById("copy");
    L.style(copy, "color", "blue");
    L.attr(copy, "data-x", "9");
    copy.style.color = "purple"; // the host page edits after us
    copy.setAttribute("data-x", "host");
    const refused = !L.style(copy, "color", "green") && !L.attr(copy, "data-x", "10");
    e.destroy();
    const keep = copy.style.color === "purple" && copy.getAttribute("data-x") === "host";
    copy.style.color = "";
    copy.removeAttribute("style");
    copy.setAttribute("data-x", "1");
    return { refused, keep };
  });
  assert.deepEqual(host, { refused: true, keep: true }, "a newer host edit always wins");

  where = "one-raf";
  const raf = await page.evaluate(async () => {
    let calls = 0;
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (calls++, real(cb));
    const engines = [1, 2, 3, 4].map(() => fizlet.createEngine());
    let steps = 0;
    engines.forEach((e) => (e.add({ step: () => steps++ }), e.start()));
    await new Promise((r) => setTimeout(r, 500));
    const frames = engines[0].stats().frames;
    engines.forEach((e) => e.destroy());
    window.requestAnimationFrame = real;
    return { calls, frames, steps };
  });
  assert.ok(raf.frames > 5, "it ran");
  assert.ok(raf.calls <= raf.frames + 2, `one rAF per frame for 4 engines (calls ${raf.calls}, frames ${raf.frames})`);
  assert.ok(raf.steps > raf.frames * 3, "every engine stepped");

  where = "auto-pause";
  const pause = await page.evaluate(async () => {
    const out = {};
    const root = document.getElementById("title");
    const e = fizlet.createEngine({ root });
    e.start();
    out.running = e.running;
    // Hidden tab.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.hidden = e.paused.join();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.back = e.running;
    // Typing in the host page's field.
    document.getElementById("field").focus();
    out.editing = e.paused.join();
    document.getElementById("field").blur();
    out.afterEdit = e.running;
    // Root scrolled off screen.
    document.getElementById("far").scrollIntoView();
    await new Promise((r) => setTimeout(r, 300));
    out.offscreen = e.paused.join();
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    out.onscreen = e.running;
    e.destroy();
    // After destroy, page events no longer reach it.
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    out.dead = e.running === false && e.signal.aborted;
    return out;
  });
  assert.deepEqual(pause, { running: true, hidden: "hidden", back: true, editing: "editable", afterEdit: true, offscreen: "offscreen", onscreen: true, dead: true });

  where = "layout-guard";
  const guard = await page.evaluate(() => {
    const e = fizlet.createEngine();
    fizlet.guardLayout(e);
    const el = document.getElementById("copy");
    e.add({ read: () => el.getBoundingClientRect(), step: () => el.offsetWidth, render: () => el.clientWidth });
    e.advance(1 / 60 + 1e-6);
    const v = e.violations;
    e.destroy();
    return v;
  });
  assert.equal(guard, 1, "only the read inside the step counts");

  where = "input";
  const inp = await page.evaluate(() => {
    const e = fizlet.createEngine({ root: document.getElementById("title") });
    const c = fizlet.controls(e, { keys: { fire: ["Space"], left: ["KeyA"], right: ["KeyD"] } });
    e.start();
    const key = (type, code, target = window) => target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
    key("keydown", "Space");
    key("keydown", "KeyD");
    e.advance(0);
    const first = [c.hit("fire"), c.down("fire"), c.axis("left", "right")];
    e.advance(0);
    const second = [c.hit("fire"), c.down("fire")];
    key("keyup", "Space");
    e.advance(0);
    const released = c.down("fire");
    // Keys typed in the host page's own field never count.
    key("keydown", "KeyA", document.getElementById("field"));
    e.advance(0);
    const typed = c.down("left");
    c.press("fire");
    e.advance(0);
    const onScreen = c.hit("fire");
    c.press("fire", false);
    e.destroy();
    key("keydown", "Space");
    return { first, second, released, typed, onScreen, after: c.down("fire") };
  });
  assert.deepEqual(inp, { first: [true, true, 1], second: [false, true], released: false, typed: false, onScreen: true, after: false });

  where = "embed";
  const emb = await page.evaluate(async () => {
    let mounted = 0, destroyed = 0, cmd = "";
    const game = fizlet.embed(() => (host) => {
      mounted++;
      cmd = host.style.getPropertyValue("--k-cmd") + "|" + host.style.getPropertyValue("--k-sys");
      return { destroy: () => destroyed++ };
    }, { name: "blitz", palette: { cmd: "#8573ee", sys: "red; background: url(x)" }, easterEgg: { sequence: ["KeyB", "Enter"].map((k) => (k === "KeyB" ? "b" : k)), gesture: false, scope: { sequence: "all" } } });
    const press = (key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    const dormant = mounted;
    press("b");
    press("Enter");
    await new Promise((r) => setTimeout(r, 50));
    const opened = game.opened;
    const toggle = [...document.querySelectorAll("[data-blitz-ignore]")].some((h) => h.shadowRoot?.querySelector("button"));
    press("Escape");
    const closed = !game.opened && destroyed === 1;
    game.destroy();
    // open: false waits closed behind the toggle key.
    const waiting = fizlet.embed(() => () => ({ destroy() {} }), { name: "wait", open: false });
    const waitKey = [...document.querySelectorAll("[data-wait-ignore]")].some((h) => h.shadowRoot?.querySelector("button")?.textContent.includes("WAIT"));
    const waitClosed = !waiting.opened;
    waiting.destroy();
    return { dormant, mounted, opened, toggle, closed, cmd, waitKey, waitClosed, left: document.querySelectorAll("[data-fizlet-host], [data-blitz-ignore]").length };
  });
  assert.deepEqual(emb, { dormant: 0, mounted: 1, opened: true, toggle: true, closed: true, cmd: "#8573ee|", waitKey: true, waitClosed: true, left: 0 }, "dormant until the sequence, palette hex only, Escape closes, destroy cleans up");

  where = "slot";
  // The markup and CSS astro-base-engine renders for `[slot animation]` (engine/astro_base_engine/render.py).
  const fig = (target, label) => `<figure class="ae-slot ae-slot--16x9" data-slot="animation" data-slot-target="${target}" role="img" aria-label="${label}"><p class="ae-slot__placeholder">Animation here: ${label}</p><figcaption class="ae-slot__fallback">Still: ${label}</figcaption></figure>`;
  const SLOT_PAGE = `<!doctype html><meta charset="utf-8"><style>.ae-slot{margin:0;display:grid;place-items:center;border:1px dashed #999;aspect-ratio:16/9;width:400px}</style><body>
${fig("home#hero", "Sparks over the logo")}<div style="height:3000px"></div>${fig("home#below", "A blast below the fold")}
<script>${bundle}</script></body>`;
  const sp = await browser.newPage({ viewport: { width: 800, height: 600 } });
  sp.on("pageerror", (e) => errors.push(e.message));
  await sp.setContent(SLOT_PAGE);
  await sp.evaluate(() => {
    // Attribute order is not a value the page can see; compare with attributes sorted.
    window.snap = () => [...document.body.querySelectorAll("*")].map((n) => n.tagName + [...n.attributes].map((a) => a.name + "=" + a.value).sort().join("|") + "#" + [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join("")).join("\n");
    window.before = snap();
    window.loads = 0;
    // A scene: its own engine on the stage, a canvas that fills it.
    window.scene = (accessible) => () => (loads++, (stage) => {
      const e = fizlet.createEngine({ root: stage }), c = e.ledger.add(document.createElement("canvas"));
      stage.append(c);
      e.add({ render: () => {} });
      e.start();
      return { destroy: () => e.destroy(), accessible };
    });
    window.frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const lazy = await sp.evaluate(async () => {
    const below = fizlet.slot("home#below", scene(false), { margin: "0px" });
    await frame();
    const idle = { mounted: below.mounted, loads };
    below.el.scrollIntoView();
    await frame();
    await frame();
    const f = below.el, stage = f.querySelector("[data-fizlet-slot]");
    const cs = stage && getComputedStyle(stage);
    const on = {
      mounted: below.mounted, loads, target: stage?.dataset.fizletSlot, contain: cs?.contain, size: [stage?.clientWidth, stage?.clientHeight].join("x"),
      role: f.getAttribute("role"), label: f.getAttribute("aria-label"), hidden: stage?.getAttribute("aria-hidden"),
      placeholder: getComputedStyle(f.querySelector(".ae-slot__placeholder")).display, canvas: !!stage?.querySelector("canvas"),
    };
    below.destroy();
    window.scrollTo(0, 0);
    const missing = fizlet.slot("nope#nothing", scene(false));
    missing.destroy();
    return { idle, on, back: snap() === before, missingEl: missing.el };
  });
  assert.deepEqual(lazy.idle, { mounted: false, loads: 0 }, "nothing loads before the slot nears the viewport");
  assert.deepEqual(lazy.on, { mounted: true, loads: 1, target: "home#below", contain: "strict", size: "400x225", role: "img", label: "A blast below the fold", hidden: "true", placeholder: "none", canvas: true }, "the scene mounts contained, sized to the slot, role=img + aria-label kept");
  assert.equal(lazy.back, true, "destroy gives the slot back exactly");
  assert.equal(lazy.missingEl, null, "an unknown target is inert");

  const a11y = await sp.evaluate(async () => {
    const hero = fizlet.slot(fizlet.findSlot("home#hero"), scene(true));
    await frame();
    await frame();
    const role = hero.el.getAttribute("role"), label = hero.el.getAttribute("aria-label"), hidden = hero.el.querySelector("[data-fizlet-slot]").hasAttribute("aria-hidden");
    hero.destroy();
    return { role, label, hidden, back: snap() === before };
  });
  assert.deepEqual(a11y, { role: null, label: "Sparks over the logo", hidden: false, back: true }, "a scene with real accessible content drops role=img; destroy puts it back");

  await sp.emulateMedia({ reducedMotion: "reduce" });
  const calm = await sp.evaluate(async () => {
    loads = 0;
    const hero = fizlet.slot("home#hero", scene(false));
    await frame();
    await frame();
    const reduced = { mounted: hero.mounted, loads, fallback: getComputedStyle(hero.el.querySelector(".ae-slot__fallback")).display, same: snap() === before };
    window.heroSlot = hero;
    return reduced;
  });
  assert.deepEqual(calm, { mounted: false, loads: 0, fallback: "block", same: true }, "reduced motion: the fallback stays, the scene never loads");
  await sp.emulateMedia({ reducedMotion: "no-preference" });
  const allowed = await sp.evaluate(async () => (await frame(), await frame(), heroSlot.mounted));
  assert.equal(allowed, true, "motion allowed again: the scene mounts");
  await sp.emulateMedia({ reducedMotion: "reduce" });
  const stopped = await sp.evaluate(async () => {
    await frame();
    const r = { mounted: heroSlot.mounted, same: snap() === before };
    heroSlot.destroy();
    return r;
  });
  assert.deepEqual(stopped, { mounted: false, same: true }, "reduced motion turned on mid-scene: the scene goes, the fallback comes back");
  await sp.close();

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, slot passed.");
  where = "sprite";
  const spr = await page.evaluate(async () => {
    const { sprites, sherman } = fizlet;
    // Reference: the hull tile exactly as sherman-bytes/src/sprites.ts paints it (copied for the test).
    const original = (color, frame) => {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 32;
      const c = tile.getContext("2d");
      c.fillStyle = "#151020";
      c.fillRect(3, 5, 26, 7);
      c.fillRect(3, 21, 26, 7);
      c.fillStyle = "#8573ee";
      for (let i = 0; i < 6; i++) (c.fillRect(4 + i * 4 + frame, 6, 2, 5), c.fillRect(4 + i * 4 + frame, 22, 2, 5));
      c.fillStyle = color;
      c.fillRect(5, 11, 22, 11);
      c.fillRect(9, 9, 13, 15);
      c.fillRect(25, 13, 4, 7);
      c.fillStyle = "#241a35";
      c.fillRect(7, 12, 4, 9);
      c.fillRect(13, 13, 4, 7);
      c.fillStyle = "#06c4ff";
      c.fillRect(20, 14, 2, 5);
      c.fillRect(18, 16, 6, 1);
      return tile;
    };
    const pixels = (t) => {
      const c = document.createElement("canvas");
      c.width = t.width;
      c.height = t.height;
      const x = c.getContext("2d");
      x.drawImage(t, 0, 0);
      return x.getImageData(0, 0, t.width, t.height).data;
    };
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const sp = sprites(sherman, { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }, { team: "#fff8d4" }] });
    const out = {};
    out.offscreen = sp.tile("hull") instanceof OffscreenCanvas;
    out.identical = [0, 1].every((f) => same(pixels(sp.tile("hull", f)), pixels(original("#39ffb0", f)))) && same(pixels(sp.tile("hull", 0, 1, 1)), pixels(original("#ff5c8f", 0)));
    // Drawn pixels: pivot at (x, y), scale, rotation, palette.
    const cv = document.createElement("canvas");
    cv.width = cv.height = 200;
    const ctx = cv.getContext("2d");
    const at = (x, y) => "#" + [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
    sp.draw(ctx, "hull", 0, 50, 50);
    sp.draw(ctx, sp.ids.hull, 0, 140, 50, 0, 2, 1);
    sp.draw(ctx, "hull", 0, 50, 150, Math.PI);
    sp.draw(ctx, "turret", 0, 140, 150, 0, 1, 2);
    out.drawn = [at(50 - 16 + 20, 50 - 16 + 16), at(50 - 16 + 6, 50 - 16 + 16), at(50 - 16 + 4, 50 - 16 + 6), at(0, 0),
      at(140 - 32 + 41, 50 - 32 + 33), at(140 - 32 + 12, 50 - 32 + 32), at(50 - 5, 150 - 1), at(140 - 7 + 1, 150 - 8 + 8)];
    // The cache is capped.
    const small = sprites(sherman, { cap: 4, palettes: [{}, {}, {}] });
    for (let p = 0; p < 3; p++) for (let s = 1; s <= 3; s++) small.draw(ctx, "hull", 0, 0, 0, 0, s, p);
    out.cap = [small.size, small.baked];
    // An SVG page character: same size, crisp.
    const img = new Image();
    img.src = sp.url("hull", 1, 1);
    await img.decode();
    out.img = [img.naturalWidth, img.naturalHeight];
    return out;
  });
  assert.deepEqual(spr, {
    offscreen: true, identical: true,
    drawn: ["#06c4ff", "#39ffb0", "#8573ee", "#000000", "#06c4ff", "#ff5c8f", "#06c4ff", "#fff8d4"],
    cap: [4, 9], img: [32, 32],
  }, "sprite tiles match the Sherman original, draw places the pivot, the cache stays capped");

  where = "sprite-alloc";
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const sp = fizlet.sprites(fizlet.sherman, { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }] });
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const ctx = cv.getContext("2d"), a = new Float64Array(1);
    window.drawLoop = (n) => {
      for (let k = 0; k < n; k++) {
        for (let i = 0; i < 32; i++) sp.draw(ctx, i & 1, (i >> 1) & 1, i * 7.5, 40.25, a[0] + i, 1 + ((i >> 2) & 1), (i >> 3) & 1);
        a[0] += 0.01;
      }
    };
    window.drawLoop(2000); // bake and warm up
  });
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.startSampling", { samplingInterval: 64, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  await page.evaluate(() => window.drawLoop(5000)); // 160k draws
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  const inDraw = (n, under) => {
    const here = under || /(^|\.)(draw|tile|drawLoop)$/.test(n.callFrame.functionName);
    return (here ? n.selfSize : 0) + n.children.reduce((s, c) => s + inDraw(c, here), 0);
  };
  const bytes = inDraw(profile.head, false);
  assert.ok(bytes < 16384, `JS heap allocated by 160k sprite draws: ${bytes} bytes (sampled)`);

  assert.deepEqual(errors, []);
  console.log(`Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard, input, embed, sprite (draw loop: ${bytes} bytes sampled) passed.`);
} catch (e) {
  console.error(`::error title=Fizlet browser test (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
}
