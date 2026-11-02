// Toast Tell (site/gallery/pieces/toast-tell.ts) in Chromium, on its own stage, mounted through
// @fzlt/core/slot as the gallery does: the demo exchange plays (a tell, a dodge, one counter) and the
// scene settles to no frames; then a bout by keyboard only: read each tell (toast up: ↓ ducks; red
// eyes: ← slips), Space counters, three counters and his count to KO, and it sleeps again; a wrong
// dodge is a hit; the buttons are 44 px or more and a tap on PUNCH starts a bout; M mutes; Recall
// gives the page back; reduced motion keeps the poster.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/toast-tell.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8"); // the gallery's own sheets: the keys are Board UI keys (site/gallery/pieces/keys.ts)
const html = `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#toast-tell" role="img" aria-label="Toast Tell" style="position:relative;width:720px;aspect-ratio:16/9;margin:0;container:stage/size">${readFileSync("site/gallery/stages/toast-tell.html", "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;
const browser = await chromium.launch(launchOptions());
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const st = (p) => p.evaluate(() => { const S = scene.sim.S; return { mode: S[0], op: S[2], ot: S[3], kind: S[4], pl: S[6], ohp: S[9], yhp: S[10], counters: S[12], taken: S[14], kos: S[15] }; });
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
  const m = await p.evaluate(() => ({ canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, small: [...document.querySelectorAll("[data-fizlet-slot] button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length, buttons: document.querySelectorAll("[data-fizlet-slot] button").length, role: document.querySelector("figure").getAttribute("role") }));
  assert.deepEqual(m, { canvas: 1, small: 0, buttons: 4, role: "figure" }, "toast-tell: canvas, SLIP DUCK PUNCH and mute (44 px or more); the figure's role=img becomes role=figure for real controls (#215)");
  // The demo: one read, one counter, then it waits and sleeps.
  await until(p, () => scene.sim.S[12] >= 1, 900, "toast-tell: the demo lands a counter");
  await until(p, () => scene.engine.paused.includes("settled"), 900, "toast-tell: settles after the demo");
  const quiet = await p.evaluate(async () => { const a = scene.engine.stats().frames; for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r)); return scene.engine.stats().frames - a; });
  assert.equal(quiet, 0, "toast-tell: settled, no frames");

  // Keyboard only.
  await p.focus("[data-fizlet-slot]");
  await p.evaluate(() => scene.engine.stop());
  await p.keyboard.press("Space");
  assert.equal((await st(p)).mode, 1, "toast-tell: Space starts a bout");
  for (let i = 0; i < 400; i++) {
    const s = await st(p);
    if (s.mode !== 1) break;
    if (s.op === 1 && s.ot > 0.3 && s.pl === 0) await p.keyboard.press(s.kind === 1 ? "ArrowDown" : "ArrowLeft");
    else if (s.op === 4 && s.ot > 0.1 && s.pl === 0) await p.keyboard.press("Space");
    await run(p, 0.05);
  }
  let s = await st(p);
  assert.deepEqual([s.mode, s.counters - 1, s.taken], [2, 3, 0], "toast-tell: reading every tell by keyboard: three counters, no hits, his count");
  await run(p, 5);
  s = await st(p);
  assert.deepEqual([s.mode, s.kos], [0, 1], "toast-tell: KO, then it waits");
  // A wrong dodge is a hit.
  await p.keyboard.press("Space");
  for (let i = 0; i < 100 && (await st(p)).taken === 0; i++) {
    const s = await st(p);
    if (s.op === 1 && s.ot > 0.3 && s.pl === 0) await p.keyboard.press(s.kind === 1 ? "ArrowLeft" : "ArrowDown");
    await run(p, 0.05);
  }
  assert.equal((await st(p)).taken, 1, "toast-tell: the wrong dodge is a hit");
  await p.keyboard.press("KeyM");
  assert.equal(await p.evaluate(() => document.querySelector('[data-id="9"]').getAttribute("aria-pressed")), "true", "toast-tell: M mutes");
  await run(p, 40);
  assert.equal((await st(p)).mode, 0, "toast-tell: the bout ends (a count or the cap) and it waits");
  // A tap on PUNCH starts a bout.
  await p.click('[data-id="3"]');
  assert.equal((await st(p)).mode, 1, "toast-tell: a tap on PUNCH starts a bout");
  await p.evaluate(() => scene.engine.start());
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.isEqualNode(window.bodyWas), running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, "toast-tell: Recall gives the page back");
  assert.deepEqual(errs, [], "toast-tell: no page errors");
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
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, drawn: true }, "toast-tell: reduced motion keeps the poster");
  await ctx.close();
  console.log("toast-tell: demo then settles; a keyboard bout reads every tell to a KO count; wrong dodge hits; PUNCH tap starts; M mutes; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
