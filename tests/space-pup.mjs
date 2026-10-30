// The space pup pieces (site/gallery/pieces/space-pup-*.ts) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does: it mounts (the
// poster steps aside), plays its intro and settles to no frames with the page untouched; taps reach
// the page (belly rubs until the zoomies; notches until the walkway flings him) and knock real
// letters off their place; it settles again with every letter home; Recall mid-play gives the page
// back byte for byte; reduced motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { bellyRub } from "./site/gallery/pieces/space-pup-belly-rub-zoomies.ts"; export { walkway } from "./site/gallery/pieces/space-pup-walkway-flings.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "sp", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

// tap: where to tap (fractions of the stage); taps: at most how many, one each time `ready` holds,
// until `gone` (it's set off); wild: the mode in which letters fly.
const PIECES = [
  { id: "space-pup-belly-rub-zoomies", make: "bellyRub", tap: [118 / 240, 96 / 135], ready: "scene.mode === 2", gone: "scene.mode >= 3", wild: 4, taps: 14 },
  { id: "space-pup-walkway-flings", make: "walkway", tap: [0.4, 0.4], ready: "scene.mode === 0", gone: "scene.mode >= 1", wild: 1, taps: 8 },
];

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails after `frames` frames without it.
const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok()) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond, frames, what });

/** Settled: no more frames, and the figure's elements exactly as they were. */
const still = (p) => p.evaluate(async () => {
  const a = scene.engine.stats().frames;
  await new Promise((r) => setTimeout(r, 400));
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]").remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    for (const e of root.querySelectorAll("[data-hit]")) e.removeAttribute("data-hit");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was), lit: document.querySelectorAll("figure [data-hit]").length };
});

try {
  for (const pc of PIECES) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id));
    await p.evaluate(() => {
      let s = 0x2f6b1d3;
      Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = sp.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = sp[make](stage, el, first)), { idle: 0 });
    }, pc.make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${pc.id}: mounts its canvas; the poster steps aside`);

    // The intro plays, then it settles: no frames, nothing on the page moved.
    await until(p, 'scene.engine.paused.includes("settled")', 3000, `${pc.id}: settles after its intro`);
    assert.deepEqual(await still(p), { more: 0, same: true, lit: 0 }, `${pc.id}: settled, the page untouched`);

    // Taps until it goes wild, and real letters fly.
    const box = await p.locator("figure").boundingBox();
    for (let i = 0; i < pc.taps; i++) {
      if (await p.evaluate((c) => new Function(`return (${c})`)(), pc.gone)) break;
      await until(p, pc.ready, 600, `${pc.id}: ready for tap ${i + 1}`);
      await p.mouse.click(box.x + box.width * pc.tap[0], box.y + box.height * pc.tap[1]);
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    await until(p, `scene.mode === ${pc.wild}`, 600, `${pc.id}: the taps set it off`);
    await until(p, `document.querySelector("figure i[style*='--x']")`, 600, `${pc.id}: a letter is knocked off its place`);

    // It settles again with every letter home.
    await until(p, 'scene.engine.paused.includes("settled")', 3000, `${pc.id}: settles after the chaos`);
    assert.deepEqual(await still(p), { more: 0, same: true, lit: 0 }, `${pc.id}: every letter home, no frames`);

    // Recall mid-play: the page comes back byte for byte.
    await p.mouse.click(box.x + box.width * pc.tap[0], box.y + box.height * pc.tap[1]);
    await until(p, "scene.engine.running", 60, `${pc.id}: a tap wakes it`);
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${pc.id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${pc.id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still frame; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = sp.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, sp[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 240 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("space pup: both mount, settle untouched, taps set them off and knock real letters, settle with every letter home, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
