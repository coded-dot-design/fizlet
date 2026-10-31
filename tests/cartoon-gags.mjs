// The classic cartoon gags (site/gallery/pieces/anvil-drops-where-you-click.ts and
// fuse-burns-along-text-lines.ts) in Chromium, each on its own stage, mounted through fizlet/slot as
// the gallery does. For each: it plays its intro, the page's own letters move only where something
// hits them, it settles to no frames with the page exactly as it was, real clicks play the gag
// (an anvil on PLUM, a crater in the headline, a double-click piano; a fuse lit and blown out), Recall
// mid-play gives the page back byte for byte, and reduced motion keeps the still poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { lookOutBelow } from "./site/gallery/pieces/anvil-drops-where-you-click.ts"; export { shortFuse } from "./site/gallery/pieces/fuse-burns-along-text-lines.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "cg", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:800px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails only after the scene has
// drawn `frames` frames without it (or stopped drawing for 15 s while not running).
const until = (p, cond, arg, frames, what) => p.evaluate(async ({ cond, arg, frames, what }) => {
  const ok = new Function("arg", `return (${cond})(arg)`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok(arg)) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), arg, frames, what });

/** Art px (160 × 90) to a page point on the figure. */
const at = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  return [b.x + (x / 160) * b.width, b.y + (y / 90) * b.height];
};

/** Settled: no frames for a while, and the figure's markup as it was (style text as the browser reads it). */
async function settledInPlace(p, id) {
  await until(p, () => scene.engine.paused.includes("settled"), null, 4000, `${id}: settles`);
  const still = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    await new Promise((r) => setTimeout(r, 400));
    const fig = document.querySelector("figure").cloneNode(true);
    fig.querySelector("[data-fizlet-slot]").remove();
    fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
    const norm = (root) => {
      for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
      return root.innerHTML;
    };
    const was = document.createElement("figure");
    was.innerHTML = window.figBefore;
    return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
  });
  assert.deepEqual(still, { more: 0, same: true }, `${id}: settled, no frames, the page's letters back in place`);
}

async function open(id, make) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(id));
  await p.evaluate((make) => {
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = cg.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cg[make](stage, el, first)), { idle: 0 });
  }, make);
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
  assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas on the stage; the poster steps aside`);
  return { p, errs };
}

async function recallAndStill(p, errs, id, make) {
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, `${id}: Recall restores the page byte for byte`);
  assert.deepEqual(errs, [], `${id}: no page errors`);
  await p.close();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(id));
  const rm = await q.evaluate(async (make) => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cg.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cg[make](stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth === 160 };
  }, make);
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
  await ctx.close();
}

try {
  // ---------- Look out below! ----------
  {
    const id = "anvil-drops-where-you-click", make = "lookOutBelow";
    const { p, errs } = await open(id, make);
    // The intro anvil knocks the forecast's first word aside on its way down; then all is still.
    await until(p, () => document.querySelector(".lb-d i[style*='--r']"), null, 600, `${id}: the intro anvil knocks a word aside`);
    await settledInPlace(p, id);
    // A click on PLUM (standing, not wary yet): the anvil flattens him. BONK.
    const px = await p.evaluate(() => scene.plum);
    await p.mouse.click(...(await at(p, px, 76)));
    await until(p, () => scene.bonks === 1, null, 400, `${id}: an anvil on PLUM is a bonk`);
    // A click on a headline letter: it squashes into a crater, and springs back once the anvil goes.
    const box = await p.locator(".lb-h i").nth(2).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await until(p, () => document.querySelector(".lb-h i:nth-child(3)[style*='--q']"), null, 400, `${id}: the letter it lands on squashes`);
    // A double-click: a piano instead (a deeper squash).
    const b2 = await p.locator(".lb-h2 i").nth(1).boundingBox();
    await p.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await until(p, () => document.querySelector(".lb-h2 i[style*='--q: 0.4']"), null, 400, `${id}: a double-click drops a piano`);
    await settledInPlace(p, id);
    // Once bitten: a shadow at his feet and he runs (a dodge).
    const px2 = await p.evaluate(() => scene.plum);
    await p.mouse.click(...(await at(p, px2, 76)));
    await until(p, () => scene.dodges === 1, null, 400, `${id}: once bitten, he dodges a drop at his feet`);
    // Recall mid-play.
    await p.mouse.click(...(await at(p, 30, 76)));
    await until(p, () => scene.engine.running, null, 60, `${id}: awake`);
    await recallAndStill(p, errs, id, make);
  }

  // ---------- Short fuse ----------
  {
    const id = "fuse-burns-along-text-lines", make = "shortFuse";
    const { p, errs } = await open(id, make);
    // The intro: a spark runs to the bundle, the letters it passes hop, BOOM; he gets back to sleep.
    await until(p, () => document.querySelector(".sf-3 i[style*='--y']"), null, 600, `${id}: a letter hops as the spark passes`);
    await until(p, () => scene.booms === 1, null, 600, `${id}: the intro spark reaches the bundle`);
    await settledInPlace(p, id);
    assert.equal(await p.evaluate(() => scene.mode), 0, `${id}: PLUM is back asleep`);
    // Light the fuse at its start (a click on it), then blow the spark out (a click on the spark;
    // a stub can sputter back, so keep blowing until it's out for good).
    const [fx, fy] = await p.evaluate(() => [scene.fuse.fx[4], scene.fuse.fy[4]]);
    await p.mouse.click(...(await at(p, fx, fy)));
    await until(p, () => scene.sparks.length === 1, null, 60, `${id}: a click lights the fuse`);
    for (let i = 0; i < 8; i++) {
      const s = await p.evaluate(() => (scene.sparks.length ? [scene.fuse.fx[scene.sparks[0] | 0], scene.fuse.fy[scene.sparks[0] | 0]] : null));
      if (!s) break;
      await p.mouse.click(...(await at(p, s[0], s[1])));
      await until(p, () => !scene.sparks.length, null, 60, `${id}: a click on the spark blows it out`);
      await until(p, () => scene.saved === 1 || scene.sparks.length === 1, null, 200, `${id}: out for good, or back`);
      if (await p.evaluate(() => scene.saved === 1)) break;
    }
    assert.equal(await p.evaluate(() => [scene.saved, scene.booms].join()), "1,1", `${id}: blowing out the spark saves him`);
    await settledInPlace(p, id);
    // Recall mid-play: a fresh spark burning.
    await p.mouse.click(...(await at(p, fx, fy + 14)));
    await until(p, () => scene.sparks.length === 1, null, 60, `${id}: lit again`);
    await recallAndStill(p, errs, id, make);
  }
  console.log("cartoon gags: both mount, play their intro, move the page only where hit, settle with the page in place, play the gag on real clicks (bonk, crater, piano, dodge; light and blow out), Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
