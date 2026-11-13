// Flip Match (site/gallery/pieces/flip/flip-match.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster steps
// aside), the diorama fills the stage and draws, the deal plays and settles to no frames with no
// audio before a gesture, and every key is 44 px or more, wide (720) and tall (the phone shape, 358
// wide). The mouse plays it on the wide stage (a miss turns back, a pair goes to your pile), the
// keyboard on the tall one (Space, arrows, Enter). Recall mid-game gives the page back byte for
// byte; reduced motion keeps the poster. The game itself: tests/flip-match.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/flip/flip-match.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/flip-match.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#flip-match" role="img" aria-label="Flip Match" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });
const mount = (p) => p.evaluate(() => {
  window.before = document.body.innerHTML;
  window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
});

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone));
    await mount(p);
    await p.waitForFunction(() => window.scene && scene.engine.stats().frames > 2);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), fig = r("figure"), art = r("[data-fizlet-slot] canvas");
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), px = cvs.getContext("2d").getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255, keys: keys.every(Boolean) && keys.length,
      };
    });
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, keys: 2 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, keys ≥ 44 px`);
    await settle(p, `${at}: the deal`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    const faces = await p.evaluate(() => Array.from({ length: 16 }, (_, i) => scene.g.k.top(i + 1) >> 1));
    const miss = faces.findIndex((f) => f !== faces[0]), pair = faces.indexOf(faces[0], 1);
    const box = await p.locator("[data-fizlet-slot] .fm-play").boundingBox();
    const idle = () => p.waitForFunction(() => scene.state.up === 0 && !scene.state.busy, null, { timeout: 10000 });
    if (!phone) {
      // The mouse: a miss (both turn back), then a pair (to your pile).
      const tap = async (i) => { const [x, y] = await p.evaluate((i) => scene.cellScreen(i), i); await p.mouse.click(box.x + x, box.y + y); };
      await tap(0);
      await tap(miss);
      assert.deepEqual(await p.evaluate(() => [scene.state.up, scene.state.moves]), [2, 1], `${at}: two up, one move`);
      await idle();
      assert.equal(await p.evaluate(() => scene.g.k.up.reduce((a, b) => a + b, 0)), 0, `${at}: the miss turned back`);
      await tap(0);
      await tap(pair);
      await idle();
    } else {
      // The keys: Space shows the cursor (on cell 5), arrows move it, Enter turns the card.
      await p.focus("[data-fizlet-slot] .fm-play");
      await p.keyboard.press(" ");
      const go = async (i) => {
        const c = await p.evaluate(() => scene.state.cursor);
        for (let k = 0; k < Math.abs((i % 4) - (c % 4)); k++) await p.keyboard.press(i % 4 > c % 4 ? "ArrowRight" : "ArrowLeft");
        for (let k = 0; k < Math.abs((i >> 2) - (c >> 2)); k++) await p.keyboard.press(i >> 2 > c >> 2 ? "ArrowDown" : "ArrowUp");
        assert.equal(await p.evaluate(() => scene.state.cursor), i, `${at}: the cursor on cell ${i}`);
        await p.keyboard.press("Enter");
      };
      await go(0);
      await go(pair);
      await idle();
    }
    assert.deepEqual(await p.evaluate(() => [scene.state.found, scene.g.k.count(17)]), [1, 2], `${at}: a pair in your pile`);
    await settle(p, `${at}: after the pair`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    // Recall mid-game: the page as it was, byte for byte.
    const same = await p.evaluate(() => (h.destroy(), document.body.innerHTML === before));
    assert.equal(same, true, `${at}: Recall gives the page back`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
  // Reduced motion: the poster is the still frame; the scene never mounts.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(720, false));
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, cv.mount(stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, "reduced motion keeps the poster");
  await ctx.close();
  console.log("flip-match: mounts, deals and settles (no audio before a gesture); wide: the mouse misses then pairs; tall: the keys pair; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
