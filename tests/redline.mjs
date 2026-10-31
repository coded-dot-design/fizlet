// Redline (site/gallery/pieces/redline.ts) in Chromium, on its own stage, mounted through
// @fzlt/core/slot as the gallery does: the demo rides to its first splash and the scene settles to no
// frames; then a sprint by keyboard only: hold Space to pull, let off near the red, beat the ghost to
// the flag; flat out blows the engine; the buttons are 44 px or more and holding GAS starts a sprint;
// M mutes; Recall gives the page back; reduced motion keeps the poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/redline.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#redline" role="img" aria-label="Redline" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync("site/gallery/stages/redline.html", "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;
const browser = await chromium.launch(launchOptions());
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const st = (p) => p.evaluate(() => { const S = scene.sim.S; return { mode: S[0], heat: S[4], gas: S[5], won: S[10], blows: S[13], wins: S[14] }; });
const until = (p, cond, frames, what) => p.evaluate(async ({ cond, frames, what }) => {
  const ok = new Function(`return (${cond})()`), start = scene.engine.stats().frames;
  while (!ok()) {
    if (scene.engine.stats().frames - start > frames) throw new Error(what);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), frames, what });

try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(html);
  await p.evaluate(() => {
    window.bodyWas = document.body.cloneNode(true);
    window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
  });
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({ canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, small: [...document.querySelectorAll("[data-fizlet-slot] button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length, buttons: document.querySelectorAll("[data-fizlet-slot] button").length }));
  assert.deepEqual(m, { canvas: 1, small: 0, buttons: 2 }, "redline: canvas, GAS and mute (44 px or more)");
  await until(p, () => scene.engine.paused.includes("settled"), 1200, "redline: settles after the demo");
  const quiet = await p.evaluate(async () => { const a = scene.engine.stats().frames; for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r)); return scene.engine.stats().frames - a; });
  assert.equal(quiet, 0, "redline: settled, no frames");

  // Keyboard: ride the edge of the red.
  await p.focus("[data-fizlet-slot]");
  await p.evaluate(() => scene.engine.stop());
  let held = false;
  for (let i = 0; i < 600; i++) {
    const s = await st(p);
    if (i > 0 && s.mode !== 1) break;
    const want = i === 0 || s.heat < (held ? 0.92 : 0.7);
    if (want !== held) (want ? await p.keyboard.down("Space") : await p.keyboard.up("Space"), (held = want));
    await run(p, 1 / 30);
  }
  if (held) await p.keyboard.up("Space");
  let s = await st(p);
  assert.deepEqual([s.mode, s.won, s.blows], [2, 1, 0], "redline: by keyboard, riding the edge beats the ghost with no blows");
  await run(p, 3);
  // Flat out: it blows.
  await p.keyboard.down("Space");
  await run(p, 4);
  await p.keyboard.up("Space");
  s = await st(p);
  assert.ok(s.blows >= 1, "redline: flat out blows the engine");
  await p.keyboard.press("KeyM");
  assert.equal(await p.evaluate(() => document.querySelector('[data-id="8"]').getAttribute("aria-pressed")), "true", "redline: M mutes");
  await run(p, 30);
  assert.equal((await st(p)).mode, 0, "redline: back on the line");
  const b = await p.locator('[data-id="7"]').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  s = await st(p);
  await p.mouse.up();
  assert.deepEqual([s.mode, s.gas], [1, 1], "redline: holding GAS starts a sprint");
  await p.evaluate(() => scene.engine.start());
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.isEqualNode(window.bodyWas), running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, "redline: Recall gives the page back");
  assert.deepEqual(errs, [], "redline: no page errors");
  await p.close();

  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(html);
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, drawn: img.naturalWidth > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, drawn: true }, "redline: reduced motion keeps the poster");
  await ctx.close();
  console.log("redline: demo then settles; a keyboard sprint on the edge of the red beats the ghost; flat out blows; GAS hold starts; M mutes; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
