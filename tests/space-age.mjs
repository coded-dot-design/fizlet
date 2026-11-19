// The space-age pieces (site/gallery/pieces/): the bubble-top and rush hour, in Chromium, each on
// its own stage (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does: it
// plays on its own, the sign's real letters move only once something reaches them, a tap has a
// consequence (the car flies, a beacon makes a pile-up), it settles to no frames with the page
// exactly as it was, Recall mid-play gives the page back byte for byte, and reduced motion keeps the
// still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as car } from "./site/gallery/pieces/bubble-top-car-puffs-smoke-rings.ts"; export { mount as rush } from "./site/gallery/pieces/sky-city-rush-hour-pile-up.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "sa", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

// `moved`: a letter of the sign (or the billboard) is off its spot. `tap` (world units, 160 × 90)
// and `woke`: what the tap does.
const PIECES = [
  { id: "bubble-top-car-puffs-smoke-rings", make: "car", tap: [100, 40], woke: "scene.mode === 1" },
  { id: "sky-city-rush-hour-pile-up", make: "rush", tap: [96, 30], woke: "scene.cars > 0" },
];
const MOVED = "figure [class$='-t'] i[style*='--t'], figure .sa2-bb i[style*='--t']";

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails only after the scene has
// drawn `frames` frames without it (or stopped drawing for good).
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

try {
  for (const pc of PIECES) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(pc.id));
    await p.evaluate((make) => {
      window.before = document.body.innerHTML;
      window.figBefore = document.querySelector("figure").innerHTML;
      window.h = sa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = sa[make](stage, el, first)), { idle: 0 });
    }, pc.make);
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${pc.id}: mounts its canvas on the stage; the poster steps aside`);

    // It plays on its own: something reaches the sign and a letter moves.
    await until(p, (sel) => document.querySelector(sel), MOVED, 900, `${pc.id}: a letter is hit`);
    // It settles: no frames, and every letter back exactly as it was.
    await until(p, () => scene.engine.paused.includes("settled"), null, 6000, `${pc.id}: settles`);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 500));
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
    assert.deepEqual(still, { more: 0, same: true }, `${pc.id}: settled, no frames, the letters back in place`);

    // A tap: it wakes and acts.
    const box = await p.locator("figure").boundingBox();
    await p.mouse.click(box.x + (box.width * pc.tap[0]) / 160, box.y + (box.height * pc.tap[1]) / 90);
    await until(p, (w) => scene.engine.running && new Function(`return ${w}`)(), pc.woke, 300, `${pc.id}: the tap acts`);

    // Recall mid-play: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${pc.id}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${pc.id}: no page errors`);
    await p.close();

    // Reduced motion: the poster is the still; the scene never mounts.
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const q = await ctx.newPage();
    await q.setContent(page(pc.id));
    const rm = await q.evaluate(async (make) => {
      let made = 0;
      const before = document.body.innerHTML;
      const s = sa.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, sa[make](stage, el, first)), { idle: 0 });
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("space age: both mount, play, hit the sign's letters, settle with the page in place, act on a tap, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
