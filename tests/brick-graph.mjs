// The bricks index's live diagram (site/brick-graph.ts on fizlet/layout and fizlet/view-canvas), on
// the built page in Chromium. Page cost, as the page itself sees it (every requestAnimationFrame
// call counted from before its scripts run): it lays out, then asks for 0 frames a second once
// still and 0 off screen; a drag moves a brick, wakes it and it settles to 0 again; with reduced
// motion it rests on its first step. Recall: mounted by hand (the page's own copy blocked), destroy()
// gives the figure back byte for byte. Run with: npm run site && node tests/brick-graph.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { serve } from "./perf/harness.mjs";

if (!existsSync("site-dist/bricks/index.html")) throw new Error("site-dist/ is missing: run `npm run site` first");
const mountJs = (await build({
  stdin: { contents: 'import { mount } from "./site/brick-graph.ts"; window.__mount = mount;', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", write: false, logLevel: "silent",
})).outputFiles[0].text.replace(/for \(const host of document\.querySelectorAll\("\[data-brick-graph\]"\)\) mount\(host\);/, "");
const COUNT = "window.__raf = 0; { const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => (window.__raf++, r(f)); }";

const site = await serve("site-dist", "/fizlet/");
const browser = await chromium.launch(launchOptions());
const url = `${site.origin}/fizlet/bricks/`;
const rafs = (p, ms) => p.evaluate((ms) => new Promise((ok) => { const a = window.__raf; setTimeout(() => ok(window.__raf - a), ms); }), ms);
try {
  // 1. The page as shipped: lays out, settles, 0 frames still and off screen; a drag; settles again.
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    // Only the diagram's frames: the index's live brick cards (site/brick-cards.ts, tested in
    // tests/brick-cards.mjs) play when the scroll below brings them on screen, so they stay out.
    await ctx.route("**/brick-cards.js", (r) => r.fulfill({ body: "", contentType: "text/javascript" }));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.addInitScript(COUNT);
    await p.goto(url);
    const fig = p.locator("[data-brick-graph]");
    await fig.scrollIntoViewIfNeeded();
    await p.waitForSelector("[data-brick-graph][data-ready]");
    const t0 = Date.now();
    let still = -1;
    while (Date.now() - t0 < 12000 && (still = await rafs(p, 500)) > 0);
    const settleMs = Date.now() - t0;
    const framesSettled = await rafs(p, 1000);
    // A drag: from the busiest brick (the kernel, the biggest dot) across the board.
    const box = await fig.locator("canvas").boundingBox();
    const hub = await p.evaluate(() => {
      const c = document.querySelector("[data-brick-graph] canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      // the widest run of opaque pixels on a row is the kernel's disc
      let best = [0, 0, 0];
      for (let y = 0; y < c.height; y += 2) for (let x = 0, run = 0; x < c.width; x++) {
        run = d[(y * c.width + x) * 4 + 3] > 250 ? run + 1 : 0;
        if (run > best[0]) best = [run, x - run / 2, y];
      }
      return [best[1] / c.width, best[2] / c.height];
    });
    await p.mouse.move(box.x + hub[0] * box.width, box.y + hub[1] * box.height);
    const a0 = await p.evaluate(() => window.__raf);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3, { steps: 12 });
    await p.mouse.up();
    const woke = (await p.evaluate(() => window.__raf)) - a0;
    const t1 = Date.now();
    while (Date.now() - t1 < 12000 && (await rafs(p, 500)) > 0);
    const resettleMs = Date.now() - t1, framesAfterDrag = await rafs(p, 1000);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const framesOffscreen = await rafs(p, 1000);
    console.log(`brick graph${reduced ? " (reduced motion)" : ""}: settled in ${settleMs} ms, then ${framesSettled} frames/s; drag woke it (${woke} rAFs), settled again in ${resettleMs} ms, then ${framesAfterDrag} frames/s; off screen ${framesOffscreen} frames/s`);
    assert.equal(still, 0, "it settles");
    assert.equal(framesSettled, 0, "0 frames a second once still");
    assert.ok(woke > 0, "a drag wakes it");
    assert.equal(framesAfterDrag, 0, "0 frames a second after the drag settles");
    assert.equal(framesOffscreen, 0, "0 frames off screen");
    if (reduced) assert.ok(settleMs < 2500, `reduced motion: lands at once (${settleMs} ms incl. the 0.5 s settle)`);
    assert.deepEqual(errs, []);
    await ctx.close();
  }
  // 2. Recall: the page's copy blocked, one mounted by hand and destroyed.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/brick-graph.js", (r) => r.fulfill({ body: "", contentType: "text/javascript" }));
  const p = await ctx.newPage();
  await p.goto(url);
  await p.addScriptTag({ content: mountJs });
  const r = await p.evaluate(async () => {
    const host = document.querySelector("[data-brick-graph]");
    host.scrollIntoView();
    const before = host.outerHTML;
    const g = window.__mount(host);
    const frame = () => new Promise((ok) => requestAnimationFrame(ok));
    for (let i = 0; i < 600 && !g.layout.resting; i++) await frame();
    const steps = g.engine.steps, rest = g.layout.resting;
    g.engine.destroy();
    return { rest, steps, recall: host.outerHTML === before };
  });
  assert.ok(r.rest, "it rests");
  assert.ok(r.recall, "Recall gives the figure back byte for byte");
  console.log(`brick graph: rests after ${r.steps} steps; Recall exact ✓`);
  await ctx.close();
} finally {
  await browser.close();
  await site.close();
}
