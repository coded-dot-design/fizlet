// Browser contract tests (Playwright + Chromium): the ledger gives the page back exactly, auto-pause
// rules, one real requestAnimationFrame for many engines, destroy leaves nothing running, and the
// debug guard catches layout reads in a step.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

const bundle = (await build({
  stdin: { contents: 'export * from "./src/index.ts"; export { guardLayout } from "./src/debug.ts";', resolveDir: process.cwd(), loader: "ts" },
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

  assert.deepEqual(errors, []);
  console.log("Browser: ledger restores exactly, host edits win, one rAF for many engines, auto-pause (hidden, editable, offscreen), destroy, layout guard passed.");
} catch (e) {
  console.error(`::error title=Fizlet browser test (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
}
