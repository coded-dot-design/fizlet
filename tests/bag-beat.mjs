// Bag Beat (site/gallery/pieces/bag-beat.ts) in Chromium, on its own stage, mounted through
// @fzlt/core/slot as the gallery does: the demo keeps the beat and the scene settles to no frames; then a
// round by keyboard only (Space on the beat builds a streak; one early press clunks), the bell, and it
// sleeps again; the buttons are 44 px or more and a tap on PUNCH starts a round; M mutes; Recall
// gives the page back; reduced motion keeps the poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/bag-beat.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8"); // the gallery's own sheets: the keys are Board UI keys (site/gallery/pieces/keys.ts)
const html = `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#bag-beat" role="img" aria-label="Bag Beat" style="position:relative;width:720px;aspect-ratio:16/9;margin:0;container:stage/size">${readFileSync("site/gallery/stages/bag-beat.html", "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;
const browser = await chromium.launch(launchOptions());
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const st = (p) => p.evaluate(() => { const S = scene.sim.S; return { mode: S[0], ph: S[2], live: S[4], streak: S[5], best: S[6], hits: S[7], clunks: S[8] }; });
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
  assert.deepEqual(m, { canvas: 1, small: 0, buttons: 2 }, "bag-beat: canvas, PUNCH and mute (44 px or more)");
  await until(p, () => scene.sim.S[7] >= 6, 900, "bag-beat: the demo keeps the beat");
  await until(p, () => scene.engine.paused.includes("settled"), 900, "bag-beat: settles after the demo");
  const quiet = await p.evaluate(async () => { const a = scene.engine.stats().frames; for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r)); return scene.engine.stats().frames - a; });
  assert.equal(quiet, 0, "bag-beat: settled, no frames");

  await p.focus("[data-fizlet-slot]");
  await p.evaluate(() => scene.engine.stop());
  await p.keyboard.press("Space");
  assert.equal((await st(p)).mode, 1, "bag-beat: Space starts a round");
  for (let i = 0; i < 700; i++) {
    const s = await st(p);
    if (s.mode !== 1) break;
    if (s.live && s.ph > 0.985) await p.keyboard.press("Space");
    await run(p, 1 / 60);
  }
  let s = await st(p);
  assert.ok(s.best >= 8 && s.clunks === 0, `bag-beat: on the beat by keyboard, a streak (${s.best})`);
  assert.equal(s.mode, 2, "bag-beat: the bell");
  await run(p, 3);
  // Early: a clunk.
  await p.keyboard.press("Space");
  await run(p, 0.2);
  await p.keyboard.press("Space");
  s = await st(p);
  assert.equal(s.clunks, 1, "bag-beat: early is a clunk");
  await p.keyboard.press("KeyM");
  assert.equal(await p.evaluate(() => document.querySelector('[data-id="9"]').getAttribute("aria-pressed")), "true", "bag-beat: M mutes");
  await run(p, 14);
  assert.equal((await st(p)).mode, 0, "bag-beat: after the bell it waits");
  await p.click('[data-id="1"]');
  assert.equal((await st(p)).mode, 1, "bag-beat: a tap on PUNCH starts a round");
  await p.evaluate(() => scene.engine.start());
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.isEqualNode(window.bodyWas), running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, "bag-beat: Recall gives the page back");
  assert.deepEqual(errs, [], "bag-beat: no page errors");
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
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, drawn: true }, "bag-beat: reduced motion keeps the poster");
  await ctx.close();
  console.log("bag-beat: demo then settles; a keyboard round on the beat builds a streak to the bell; early clunks; PUNCH tap starts; M mutes; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
