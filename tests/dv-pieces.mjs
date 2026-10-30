// The two domvirus.com pieces in the gallery (site/gallery/pieces/dv-*.ts on the vendored
// site/vendor/dom-virus/), in Chromium, each on its own stage in a slot: it mounts and plays, settles
// to no frames, plays again on a pointer, and Recall gives the page back byte for byte. The hero's
// first tap starts its mini-game; its pause key stops frames. Reduced motion keeps the poster (the
// scene never loads). The vendored files match ORIGIN.json, and nothing in them links away.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { vendorIncludes } from "../scripts/gallery.mjs";
import { check } from "../scripts/vendor-dom-virus.mjs";

assert.deepEqual(check(), [], "site/vendor/dom-virus matches ORIGIN.json");

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as attack } from "./site/gallery/pieces/dv-under-attack.ts"; export { mount as squad } from "./site/gallery/pieces/dv-squad-tactics.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "dv", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#100a1b">
<main id="page"><h1>Host page</h1>
<figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="A piece" style="position:relative;width:720px;aspect-ratio:4/3;margin:0">${vendorIncludes(readFileSync(`site/gallery/stages/${id}.html`, "utf8"))}</figure>
<p>Copy after it.</p></main><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, ms = 500) => p.evaluate(async (ms) => {
  const a = scene.engine.stats().frames;
  await new Promise((r) => setTimeout(r, ms));
  return scene.engine.stats().frames - a;
}, ms);
const settled = (p) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 60000, polling: 250 });
try {
  for (const [id, fn] of [["dv-under-attack", "attack"], ["dv-squad-tactics", "squad"]]) {
    // Reduced motion: the poster stays and the scene never loads.
    {
      const p = await browser.newPage({ viewport: { width: 900, height: 800 }, reducedMotion: "reduce" });
      await p.setContent(page(id));
      await p.evaluate((fn) => (window.loaded = 0, dv.slot(document.querySelector("figure"), () => (window.loaded++, dv[fn]), { idle: 0 })), fn);
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => ({ loaded: window.loaded, stage: !!document.querySelector("[data-fizlet-slot]"), card: document.querySelector("[data-dv] > *").getBoundingClientRect().height > 100 }));
      assert.deepEqual(r, { loaded: 0, stage: false, card: true }, `${id}: reduced motion keeps the poster, nothing loads`);
      await p.close();
    }
    const p = await browser.newPage({ viewport: { width: 900, height: 800 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(id));
    await p.evaluate((fn) => {
      window.before = document.body.innerHTML;
      window.s = dv.slot(document.querySelector("figure"), () => (stage, el, first) => (window.scene = dv[fn](stage, el, first)), { idle: 0 });
    }, fn);
    await p.waitForFunction(() => window.scene);
    await p.waitForTimeout(800);
    assert.ok((await frames(p)) > 5, `${id}: plays on load`);
    await settled(p);
    assert.equal(await frames(p), 0, `${id}: settled, no frames`);
    // A pointer over the card plays it again, then it settles again.
    const box = await p.locator("figure").boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    assert.ok((await frames(p, 400)) > 3, `${id}: a pointer plays it again`);
    if (fn === "attack") {
      // The first tap on the card starts the mini-game; the pause key stops every frame.
      await p.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.45);
      await p.waitForFunction(() => document.querySelector(".hero-crossover").dataset.play === "true");
      await p.waitForTimeout(600);
      assert.ok((await frames(p, 300)) > 3, `${id}: the game runs`);
      await p.click("[data-motion-toggle]");
      await p.waitForTimeout(100);
      assert.equal(await frames(p, 400), 0, `${id}: paused by its key, no frames`);
      assert.equal(await p.evaluate(() => document.querySelector(".hero-crossover").dataset.motion), "false");
    }
    // Recall: the slot goes, the page is back byte for byte.
    await p.evaluate(() => window.s.destroy());
    assert.equal(await p.evaluate(() => document.body.innerHTML === window.before), true, `${id}: Recall restores the page exactly`);
    assert.deepEqual(errs, [], `${id}: page errors`);
    await p.close();
    console.log(`ok ${id}: plays, settles to 0 frames, wakes on a pointer${fn === "attack" ? ", tap to play, pause key" : ""}, Recall exact, reduced-motion poster`);
  }
} finally {
  await browser.close();
}
