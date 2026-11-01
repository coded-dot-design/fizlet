// Pip's Bubbles (site/gallery/pieces/pip/bubbles.ts) in Chromium, on its own stage
// (site/gallery/stages/pip-narwhal-blows-bubbles.html), mounted through @fzlt/core/slot as the gallery
// does: Pip swims in and plays the intro (a bubble pops the log's letters, a big one, the tusk pokes
// it into a spray), it sleeps off screen mid-play and settles to no frames with the page in place.
// Then, through the real pointer: a tap on Pip blows a small bubble and a second tap puffs it big;
// a tap on the big one sends Pip's tusk into it (a spray of small ones); a tap on a small one pops
// it; popping enough makes Pip spin. It settles again with every letter home, Recall mid-play gives
// the page back byte for byte, and reduced motion keeps the still poster. Every wait is on the
// scene's frames or state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ID = "pip-narwhal-blows-bubbles";
const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { bubbles } from "./site/gallery/pieces/pip/bubbles.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "pb", write: false, logLevel: "silent",
})).outputFiles[0].text;

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${ID}" role="img" aria-label="${ID}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${ID}.html`, "utf8")}</figure><p>After it.</p><div style="height:3000px"></div></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, and fails only after the scene has
// drawn `frames` frames without it (or, if it stops drawing, after 15 s with no new frame).
const until = (p, cond, arg, frames, what) => p.evaluate(async ({ cond, arg, frames, what }) => {
  const ok = new Function("arg", `return (${cond})(arg)`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok(arg)) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000 && !scene.engine.running) throw new Error(`${what}: the scene stopped first (${JSON.stringify([scene.mode, scene.bubbles, scene.big, scene.x, scene.y])})`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), arg, frames, what });

/** Settled: no frames, and every element it moved back as it was (style text compared as the browser reads it). */
const settledInPlace = (p) => p.evaluate(async () => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
  const norm = (root) => {
    root.querySelector("[data-fizlet-slot]")?.remove();
    root.querySelector(".ae-slot__placeholder")?.removeAttribute("style"); // the slot's own: poster hidden
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return { more: scene.engine.stats().frames - a, same: norm(document.querySelector("figure").cloneNode(true)) === norm(was) };
});
/** A tap at art pixel (x, y) of the 160 × 90 grid, through the real pointer. */
const tapAt = async (p, x, y) => {
  const b = await p.locator("figure").boundingBox();
  await p.mouse.click(b.x + (x / 160) * b.width, b.y + (y / 90) * b.height);
};
const settle = async (p, what) => {
  await until(p, () => scene.engine.paused.includes("settled"), null, 3000, `${what}: settles`);
  assert.deepEqual(await settledInPlace(p), { more: 0, same: true }, `${what}: settled, no frames, every letter home`);
};

try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(html);
  // Same run every time: the scene seeds its engine (every roll) from Math.random once, at mount.
  await p.evaluate(() => {
    let s = 0x2f6b1d3;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = pb.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = pb.bubbles(stage, el, first)), { idle: 0 });
  });
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({
    canvas: !!document.querySelector("[data-fizlet-slot] canvas[aria-hidden='true']"),
    poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
    persona: /AI AGENT PERSONA/.test(document.querySelector(".pb-f").textContent),
  }));
  assert.deepEqual(m, { canvas: true, poster: "none", persona: true }, "mounts its canvas over the stage; the poster steps aside; the stage says Pip is an AI agent persona");

  // The intro: Pip swims in, its bubbles pop the log's letters, the big one gets the tusk.
  await until(p, () => scene.mode === 0 && scene.bubbles > 0, null, 300, "Pip swims in and blows");
  await until(p, () => document.querySelector(".pb i[data-hit]") && document.querySelector(".pb i[style*='--ty']"), null, 600, "a bubble pops a letter (it jumps and fizzes)");
  await until(p, () => scene.big === 1, null, 300, "the second bubble puffs up big");
  await until(p, () => scene.mode === 2, null, 600, "Pip dashes at it, tusk first");
  await until(p, () => scene.big === 0 && scene.bubbles >= 4, null, 120, "the tusk pokes it into a spray");
  const untouched = await p.evaluate(() => [...document.querySelectorAll(".pb i")].filter((e) => !e.hasAttribute("style")).length);
  assert.ok(untouched > 0, "only what's hit moves");
  // Scrolled away mid-play, it sleeps (no frames at all); back on screen, it plays on.
  await p.evaluate(() => window.scrollTo(0, 2500));
  await p.waitForFunction(() => scene.engine.paused.includes("offscreen"), null, { timeout: 15000 });
  const away = await p.evaluate(async () => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    return scene.engine.stats().frames - a;
  });
  assert.equal(away, 0, "off screen, no frames");
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForFunction(() => !scene.engine.paused.includes("offscreen"), null, { timeout: 15000 });
  await settle(p, "the intro");

  // Tap Pip: a small bubble. Tap again while it's fresh: it puffs up big.
  const pip = await p.evaluate(() => [scene.x, scene.y]);
  await tapAt(p, ...pip);
  await until(p, () => scene.bubbles === 1 && scene.big === 0, null, 60, "a tap on Pip blows a small bubble");
  await tapAt(p, ...pip);
  await until(p, () => scene.bubbles === 1 && scene.big === 1, null, 60, "a second tap puffs it into a big one");
  // Tap the big one: Pip's tusk pokes it into small ones.
  await until(p, () => scene.at(0)[1] < 58, null, 120, "the big one rises clear of Pip");
  await tapAt(p, ...(await p.evaluate(() => scene.at(0))));
  await until(p, () => scene.big === 0 && scene.bubbles >= 4, null, 120, "the tusk pokes the big bubble into a spray");
  // Tap a bubble: it pops.
  const n0 = await p.evaluate(() => scene.bubbles), [sx, sy] = await p.evaluate(() => scene.at(0));
  await tapAt(p, sx, sy);
  await until(p, (n) => scene.bubbles < n, n0, 30, "a tapped bubble pops");
  // Keep blowing: enough pops and Pip does a happy spin.
  while (!(await p.evaluate(() => scene.spins))) {
    await until(p, () => scene.mode === 0 || scene.mode === 3, null, 600, "Pip is free to blow");
    await p.evaluate(() => scene.tap(scene.x, scene.y));
    await until(p, () => scene.bubbles === 0 || scene.spins > 0, null, 900, "the bubble rises and pops what it hits");
  }
  await until(p, () => scene.mode === 4 || scene.spins > 0, null, 10, "a happy spin");
  await settle(p, "after the spin");

  // Recall mid-play gives the page back byte for byte.
  await tapAt(p, ...(await p.evaluate(() => [scene.x, scene.y])));
  await until(p, () => document.querySelector(".pb i[style*='--']"), null, 600, "playing again");
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, "Recall mid-play restores the page byte for byte");
  assert.deepEqual(errs, [], "no page errors");
  await p.close();

  // Reduced motion: the still poster (drawn from the scene), and the scene never mounts.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(html);
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = pb.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, pb.bubbles(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth === 160 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, "reduced motion keeps the poster drawn from the scene");
  await ctx.close();
  console.log("pip bubbles: Pip swims in, bubbles pop the letters they hit, a tap blows, a second tap puffs, the tusk pokes a big one into a spray, a tapped bubble pops, a happy spin, sleeps off screen, settles with the page in place, Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
