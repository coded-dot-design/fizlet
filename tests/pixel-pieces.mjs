// The hand-built pixel pieces (site/gallery/pieces/) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html) in a slot: it mounts (the poster steps aside), plays, a tap wakes
// it, it settles to no frames, the rain's sign goes dark only while a short has it (one attribute,
// through the ledger) and is back as it was, and Recall gives the page back byte for byte. Reduced
// motion keeps the poster (the scene never loads).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as welder } from "./site/gallery/pieces/pink-sparks-burst-tap.ts"; export { mount as rain } from "./site/gallery/pieces/cyan-purple-neon-rain-falls.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "pp", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0">
<main id="page"><h1>Host page</h1>
<figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="A piece" style="position:relative;width:640px;height:360px;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure>
<p>Copy after it.</p></main><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
const settled = (p) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 25000 });
try {
  for (const [id, fn] of [["pink-sparks-burst-tap", "welder"], ["cyan-purple-neon-rain-falls", "rain"]]) {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(id));
    await p.evaluate((fn) => {
      window.before = document.body.innerHTML;
      window.hero = pp.slot(document.querySelector("figure"), () => (stage, el, first) => (window.scene = pp[fn](stage, el, first)), { idle: 0 });
    }, fn);
    await p.waitForFunction(() => window.scene);
    const up = await p.evaluate(() => ({
      canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(up, { canvas: 1, poster: "none" }, `${id}: one pixel canvas in the stage; the poster steps aside`);
    await p.waitForTimeout(800);
    assert.ok(await p.evaluate(() => scene.engine.stats().frames > 5), `${id}: plays on load`);
    await settled(p);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 500));
      return scene.engine.stats().frames - a;
    });
    assert.equal(still, 0, `${id}: settled, no frames`);

    const box = await p.locator("figure").boundingBox();
    if (fn === "rain") {
      // Tap on through the storm: the sign shorts (and blows); it is dark only then, and back after.
      const sign = await p.evaluate(() => document.querySelector("[data-neon-sign]").outerHTML);
      await p.evaluate(() => {
        window.darkSeen = 0;
        new MutationObserver(() => document.querySelector("[data-neon-sign]").hasAttribute("data-short") && window.darkSeen++).observe(document.querySelector("[data-neon-sign]"), { attributes: true });
      });
      for (let k = 0; k < 4; k++) await p.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4), await p.waitForTimeout(350);
      assert.ok(await p.evaluate(() => scene.engine.running), "a tap wakes it");
      await p.waitForFunction(() => window.darkSeen > 0, null, { timeout: 15000 });
      await settled(p);
      assert.equal(await p.evaluate(() => document.querySelector("[data-neon-sign]").outerHTML), sign, "the sign is back as it was");
    } else {
      await p.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.55);
      await p.waitForTimeout(400);
      assert.ok(await p.evaluate(() => scene.engine.running), "a tap wakes it");
      await settled(p);
    }
    // Recall, mid-play: the page comes back exactly.
    await p.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => (hero.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still; the scene never mounts.
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(id));
    const rm = await q.evaluate(async (fn) => {
      let made = 0;
      const h = pp.slot(document.querySelector("figure"), () => (s, el, f) => (made++, pp[fn](s, el, f)), { idle: 0 });
      await new Promise((r) => setTimeout(r, 600));
      return { made, mounted: h.mounted, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display !== "none" };
    }, fn);
    assert.deepEqual(rm, { made: 0, mounted: false, poster: true }, `${id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("pixel pieces: welder and rain mount, play, wake on a tap, settle, the sign darkens only on a short and comes back, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
