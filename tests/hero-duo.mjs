// The two hero gallery pieces (site/gallery/pieces/) in Chromium, each on its own stage
// (site/gallery/stages/<id>.html), mounted through fizlet/slot as the gallery does: it plays, a tap
// has a consequence, the page's own elements move only when something reaches them, it settles to
// no frames with the page exactly as it was, Recall mid-play gives the page back byte for byte, and
// reduced motion keeps the still poster (the scene never mounts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { whoosh } from "./site/gallery/pieces/red-cape-whooshes-top.ts"; export { landing } from "./site/gallery/pieces/hero-lands-cyan-shockwave-tap.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "hd", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const PIECES = [
  { id: "red-cape-whooshes-top", make: "whoosh", moved: ".rc23-flag[style*='--r']", tap: [0.2, 0.32] },
  { id: "hero-lands-cyan-shockwave-tap", make: "landing", moved: ".hl26-k[style*='--y']", tap: [0.5, 0.62] },
];

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds in the page, and fails only after
// the scene has drawn `frames` frames without it (or, if it stops drawing, after `idle` ms with no
// new frame). A loaded machine just takes longer; a stuck scene still fails.
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
    // Same run every time: the scenes seed their engine (and so every roll) from Math.random once,
    // at mount, so a fixed Math.random makes the story deterministic.
    await p.evaluate(() => {
      let s = 0x2f6b1d3;
      Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    const mount = () => p.evaluate((make) => {
      window.before ??= document.body.innerHTML;
      window.figBefore ??= document.querySelector("figure").innerHTML;
      const fig = document.querySelector("figure.ae-slot");
      window.h = hd.slot(fig, () => (stage, el, first) => (window.scene = hd[make](stage, el, first)), { idle: 0 });
    }, pc.make);
    await mount();
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({
      canvas: !!document.querySelector("[data-fizlet-slot] canvas"),
      poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    }));
    assert.deepEqual(m, { canvas: true, poster: "none" }, `${pc.id}: mounts its canvas on the stage; the poster steps aside`);

    // It plays on its own, and the page's elements move only once something reaches them.
    await until(p, (sel) => document.querySelector(sel), pc.moved, 600, `${pc.id}: a page element moves`);
    // It settles: no frames, and every element it moved is back exactly as it was.
    await until(p, () => scene.engine.paused.includes("settled"), null, 4000, `${pc.id}: settles`);
    const still = await p.evaluate(async () => {
      const a = scene.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 500));
      const fig = document.querySelector("figure").cloneNode(true);
      fig.querySelector("[data-fizlet-slot]").remove();
      fig.querySelector(".ae-slot__placeholder").removeAttribute("style"); // the slot's own: poster hidden
      // The same elements, attributes and styles as before (style text compared as the browser
      // reads it: a settled element may keep an empty or re-spaced style attribute; Recall below
      // checks the bytes).
      const norm = (root) => {
        for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
        return root.innerHTML;
      };
      const was = document.createElement("figure");
      was.innerHTML = window.figBefore;
      return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
    });
    assert.deepEqual(still, { more: 0, same: true }, `${pc.id}: settled, no frames, the page's elements back in place`);

    // A tap: it wakes, and its consequence reaches the page again.
    const box = await p.locator("figure").boundingBox();
    await p.mouse.click(box.x + box.width * pc.tap[0], box.y + box.height * pc.tap[1]);
    await until(p, (sel) => scene.engine.running && document.querySelector(sel), pc.moved, 600, `${pc.id}: a tap reaches the page`);

    // Recall mid-play: the page comes back byte for byte.
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
      const s = hd.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, hd[make](stage, el, first)), { idle: 0 });
      // State, not time: the poster has loaded and a few frames have passed (the slot would have
      // mounted by now if it were going to).
      const img = document.querySelector(".ae-slot__placeholder");
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
      return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
    }, pc.make);
    assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${pc.id}: reduced motion keeps the poster`);
    await ctx.close();
  }
  console.log("hero duo: both mount, play, move the page only where hit, settle with the page in place, wake on a tap, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
