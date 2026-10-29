// The fizz demo (site/demos/fizz/) in Chromium: it mounts through fizlet/slot, animates (the tab
// pops, fizz spawns, the page zooms), settles (no frames), wakes on a tap, Recall gives the page
// back byte for byte, and reduced motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { fizz } from "./site/demos/fizz/scene.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div style="overflow:clip"><main id="page" data-fizz-zoom class="host" data-x="1">
<h1 style="color:#ff2e88">Host page</h1>
<figure class="ae-slot" data-slot-target="fizz#hero" role="img" aria-label="A soda can" style="width:640px;height:400px;margin:0">
<svg class="ae-slot__placeholder" viewBox="0 0 10 10"><rect width="10" height="10"/></svg></figure>
<p>Copy after the can.</p></main></div>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  // ---------- Mount, animate, settle, wake, Recall ----------
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      const fig = document.querySelector("figure.ae-slot");
      window.hero = fz.slot(fig, () => (stage, el, first) => (window.scene = fz.fizz(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    const mounted = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
      hidden: document.querySelector("[data-fizlet-slot]").getAttribute("aria-hidden"),
    }));
    assert.deepEqual(mounted, { canvas: true, poster: "none", hidden: "true" }, "mounts a canvas in the slot stage; the poster steps aside");

    // Animates: the tab pops by itself, particles fly, the page zooms in on the opening.
    await p.waitForTimeout(1500);
    const mid = await p.evaluate(() => {
      const el = document.getElementById("page"), st = scene.engine.stats();
      return { frames: st.frames, live: st.paused.length === 0, transform: el.style.transform, origin: el.style.transformOrigin };
    });
    assert.ok(mid.frames > 10 && mid.live, `animates (${mid.frames} frames)`);
    assert.match(mid.transform, /^translate\(-?[0-9.]+px, -?[0-9.]+px\) scale\(1\.[0-9]+\)$/, `the page zooms through fizlet/camera (${mid.transform})`);
    assert.equal(mid.origin, "0px 0px", "the camera transforms from the stage corner");
    const px = await p.evaluate(() => {
      const c = document.querySelector("[data-fizlet-slot] canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    assert.ok(px > 500, `the can is drawn (${px} pixels)`);

    // Settles: the story ends, the page is back at scale 1, and the engine stops asking for frames.
    await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 10000 });
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 600));
      return { more: scene.engine.stats().frames - a, transform: document.getElementById("page").style.transform };
    });
    assert.deepEqual(still, { more: 0, transform: "" }, "settled: no frames, zoom given back");

    // A tap on the can wakes it and cracks it again.
    const box = await p.locator("[data-fizlet-slot]").boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7);
    await p.waitForTimeout(700);
    const again = await p.evaluate(() => ({ running: scene.engine.running, transform: document.getElementById("page").style.transform }));
    assert.ok(again.running && /scale/.test(again.transform), "a tap wakes it and zooms again");

    // Recall mid-zoom: the page comes back exactly.
    const after = await p.evaluate(() => (hero.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, "Recall restores the page byte for byte");
    assert.deepEqual(errs, [], "no page errors");
    await p.close();
  }

  // ---------- Reduced motion: the poster is the still frame; the scene never mounts ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.setContent(PAGE);
    const rm = await p.evaluate(async () => {
      let made = 0;
      const before = document.body.innerHTML;
      const h = fz.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, fz.fizz(stage, el, first)), { idle: 0 });
      await new Promise((r) => setTimeout(r, 800));
      return { made, mounted: h.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display };
    });
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: "inline" }, "reduced motion: still poster, no scene");
    await ctx.close();
  }
  console.log("fizz: mounts, animates, zooms, settles, wakes, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
