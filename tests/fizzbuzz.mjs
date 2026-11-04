// FizzBuzz (site/gallery/pieces/fizzbuzz.ts) in Chromium, on its own stage, mounted through
// @fzlt/core/slot as the gallery does, at 720 and 358 wide: the attract count runs 1 to 15 (the
// fizzy bee) and the scene settles to no frames; then a count by keyboard only: N calls the number,
// F and B call FIZZ and BUZZ (both: FIZZBUZZ), every call judged on the number that ticks next, the
// keys light with the call; Space counts faster; a tap on FIZZ calls it; M mutes; the keys are 44 px
// or more; Recall gives the page back; reduced motion keeps the poster. The rule itself:
// tests/fizzbuzz.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/fizzbuzz.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8"); // the keys are Board UI keys (site/gallery/pieces/keys.ts)
const html = (w) => `<!doctype html><html class="bui" data-theme="dark"><meta charset="utf-8"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#fizzbuzz" role="img" aria-label="FizzBuzz" style="position:relative;width:${w}px;aspect-ratio:16/9;margin:0;container:stage/size">${readFileSync("site/gallery/stages/fizzbuzz.html", "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;
const browser = await chromium.launch(launchOptions());
const run = (p, sec) => p.evaluate((sec) => { for (let i = 0; i < Math.round(sec * 60); i++) scene.engine.advance(1 / 60); }, sec);
const st = (p) => p.evaluate(() => { const S = scene.game.S; return { mode: S[0], n: S[1], beat: S[3], guess: S[4], streak: S[5], res: S[8] }; });
/** Run until the next tick. */
const tick = async (p) => {
  const n = (await st(p)).n;
  for (let i = 0; i < 200 && (await st(p)).n === n; i++) await run(p, 1 / 30);
};

try {
  for (const w of [720, 358]) {
    const p = await browser.newPage({ viewport: { width: w + 40, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(html(w));
    await p.evaluate(() => {
      window.bodyWas = document.body.cloneNode(true);
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => ({ canvas: document.querySelectorAll("[data-fizlet-slot] canvas").length, small: [...document.querySelectorAll("[data-fizlet-slot] button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length, buttons: document.querySelectorAll("[data-fizlet-slot] button").length }));
    assert.deepEqual(m, { canvas: 1, small: 0, buttons: 4 }, `fizzbuzz @${w}: canvas, FIZZ BUZZ 123 and mute (44 px or more)`);
    // The attract count: 1 to 15, then it waits and sleeps.
    await p.waitForFunction(() => scene.game.S[1] === 15 && scene.engine.paused.includes("settled"), null, { timeout: 15000 });
    const quiet = await p.evaluate(async () => { const a = scene.engine.stats().frames; for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r)); return scene.engine.stats().frames - a; });
    assert.equal(quiet, 0, `fizzbuzz @${w}: settled, no frames`);

    // Keyboard only: call every number right, 1 to 16.
    await p.focus("[data-fizlet-slot]");
    await p.evaluate(() => scene.engine.stop());
    await p.keyboard.press("KeyN");
    let s = await st(p);
    assert.deepEqual([s.mode, s.n, s.guess], [2, 0, 4], `fizzbuzz @${w}: N starts the count and calls the number`);
    await run(p, 1 / 60);
    assert.equal(await p.evaluate(() => document.querySelector('[data-fizlet-slot] [data-id="4"]').getAttribute("aria-pressed")), "true", `fizzbuzz @${w}: the 123 key lights with the call`);
    for (let n = 1; n <= 16; n++) {
      if (n > 1) {
        const f = (n % 3 ? 0 : 1) | (n % 5 ? 0 : 2);
        if (f & 1) await p.keyboard.press("KeyF");
        if (f & 2) await p.keyboard.press("KeyB");
        if (!f) await p.keyboard.press(`Digit${n % 10}`);
      }
      await tick(p);
      s = await st(p);
      assert.deepEqual([s.n, s.res, s.streak], [n, 1, n], `fizzbuzz @${w}: ${n} called right`);
    }
    // A wrong call breaks the streak (17 is the number).
    await p.keyboard.press("KeyF");
    await tick(p);
    s = await st(p);
    assert.deepEqual([s.n, s.res, s.streak], [17, 2, 0], `fizzbuzz @${w}: FIZZ on 17 is wrong`);
    const beat = s.beat;
    await p.keyboard.press("Space");
    assert.ok((await st(p)).beat < beat, `fizzbuzz @${w}: Space counts faster`);
    await p.click('[data-fizlet-slot] [data-id="1"]');
    assert.equal((await st(p)).guess, 1, `fizzbuzz @${w}: a tap on FIZZ calls it`);
    await p.keyboard.press("KeyM");
    assert.equal(await p.evaluate(() => document.querySelector('[data-fizlet-slot] [data-id="9"]').getAttribute("aria-pressed")), "true", `fizzbuzz @${w}: M mutes`);
    await p.evaluate(() => scene.engine.start());
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.isEqualNode(window.bodyWas), running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `fizzbuzz @${w}: Recall gives the page back`);
    assert.deepEqual(errs, [], `fizzbuzz @${w}: no page errors`);
    await p.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(html(720));
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, drawn: img.naturalWidth > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, drawn: true }, "fizzbuzz: reduced motion keeps the poster");
  await ctx.close();
  console.log("fizzbuzz: the attract count to 15 then settles; a keyboard count calls 1 to 16 right (N, F, B, both), a wrong call breaks the streak; Space faster; a FIZZ tap calls; M mutes; 44 px keys at 720 and 358; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
