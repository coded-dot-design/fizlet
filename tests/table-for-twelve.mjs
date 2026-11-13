// Table for Twelve (site/gallery/pieces/table/table-for-twelve.ts) in Chromium, on its own stage in a
// gallery figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, the
// start card is up, and it settles to no frames with no audio before a gesture; every key is 44 px
// or more, wide (720) and tall (the phone shape, 358 wide). The keyboard plays it (Space serves
// dinner, Enter passes the dish on, ← back is refused while the table passes one way, → passes it
// on, M mutes); touch plays it (SERVE DINNER, a tap on the place next to the dish passes it there, a
// drag along the table passes it place to place). The whole dinner runs to DINNER IS SERVED (the
// end card) and it settles again. Recall (after the dinner wide, mid-dinner tall) gives the page back
// byte for byte; reduced motion keeps the still poster. The dinner itself: tests/table-for-twelve.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/table/table-for-twelve.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/table-for-twelve.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#table-for-twelve" role="img" aria-label="Table for Twelve" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    await p.waitForFunction(() => scene.engine.stats().frames > 2);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), fig = r("figure"), art = r("[data-fizlet-slot] canvas");
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), px = cvs.getContext("2d").getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] > canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.every(Boolean) && keys.length,
        card: scene.state.card,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 3, card: true }, `${at}: mounts, the poster steps aside, the diorama fills and draws, the start card, keys ≥ 44 px`);
    await settle(p, `${at}: at the start line`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .tt-play");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.mode === 1 && !scene.state.card && scene.state.held === 0, null, { timeout: 5000 });
      assert.equal(await p.evaluate(() => scene.state.node), 0, `${at}: the first dish comes out at the kitchen end`);
      await p.keyboard.press("Enter");
      assert.equal(await p.evaluate(() => scene.f.DN[0]), 1, `${at}: Enter passes it on`);
      await p.keyboard.press("ArrowLeft");
      assert.equal(await p.evaluate(() => scene.f.DN[0]), 1, `${at}: ← (back) is refused while the table passes one way`);
      const served = await p.evaluate(() => scene.f.DS[0]);
      if (served === 1) {
        await p.keyboard.press("ArrowRight");
        assert.equal(await p.evaluate(() => scene.f.DN[0] === 2 || scene.f.DS[0] > 1), true, `${at}: → passes it on`);
      }
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // The dinner plays to its end (the clock run by hand): the end card comes up and it settles.
      await p.evaluate(() => {
        scene.engine.stop();
        scene.autoplay(true);
        for (let i = 0; i < 30 * 200 && scene.state.mode !== 3; i++) scene.engine.advance(1 / 30);
        for (let i = 0; i < 30 * 3; i++) scene.engine.advance(1 / 30);
        scene.engine.start();
      });
      const end = await p.evaluate(() => ({ mode: scene.state.mode, card: scene.state.card, served: scene.state.served, title: document.querySelector(".tt-card b").textContent, score: +document.querySelector(".tt-chip span").textContent }));
      assert.deepEqual({ ...end, score: end.score > 0, title: ["Every dish hot!", "Seconds, anyone?"].includes(end.title) }, { mode: 3, card: true, served: 22, title: true, score: true }, `${at}: dinner is served, the end card, the score sticker counts`);
    } else {
      await p.tap(".tt-go");
      await p.waitForFunction(() => scene.state.mode === 1 && !scene.state.card && scene.state.held === 0, null, { timeout: 5000 });
      const box = await p.locator("[data-fizlet-slot] .tt-play").boundingBox();
      const xy = (n) => p.evaluate((n) => scene.at(n), n);
      const [x1, y1] = await xy(1);
      await p.touchscreen.tap(box.x + x1, box.y + y1);
      await p.waitForFunction(() => scene.f.DN[0] === 1 || scene.f.DS[0] > 1, null, { timeout: 3000 });
      if (await p.evaluate(() => scene.f.DS[0] === 1)) {
        const [x3, y3] = await xy(3), [x2, y2] = await xy(2);
        await p.mouse.move(box.x + x1, box.y + y1);
        await p.mouse.down();
        await p.mouse.move(box.x + x2, box.y + y2, { steps: 4 });
        await p.mouse.move(box.x + x3, box.y + y3, { steps: 4 });
        await p.mouse.up();
        assert.equal(await p.evaluate(() => scene.f.DN[0] >= 2 || scene.f.DS[0] > 1), true, `${at}: a drag passes it place to place`);
      }
      assert.equal(await p.evaluate(() => scene.state.mode), 1, `${at}: playing`);
    }
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
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
  console.log("table-for-twelve: mounts, the diorama draws, the start card, settles (no audio before a gesture); wide: Space serves, Enter passes on, ← refused one way, → on, M mutes, the dinner to DINNER IS SERVED and settles; tall: SERVE DINNER, a tap and a drag pass; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
