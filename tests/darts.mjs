// Darts (site/gallery/pieces/darts/darts.ts) in Chromium, on its own stage in a gallery figure (Board
// UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster steps aside),
// the diorama fills the stage and draws, it settles to no frames with no audio before a gesture, and
// every key is 44 px or more, wide (720) and tall (the phone shape, 358 wide). The mouse plays it on
// the wide stage (a real press on the board, a hold that sways the reticle and keeps the engine
// awake, a flick up that throws), the keyboard on the tall one (arrows and Space); the visit's other
// darts by Space, the bot answers with its visit, your next one comes up. Recall mid-game gives the
// page back byte for byte; reduced motion keeps the poster. The game itself: tests/darts.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/darts/darts.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/darts.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#darts" role="img" aria-label="Darts" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });
const myShot = (p) => p.waitForFunction(() => scene.state.phase === 0 && scene.state.turn === 0 && scene.state.ready, null, { timeout: 40000 });
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
        drawn: px[3] === 255, view: scene.state.view, keys: keys.every(Boolean) && keys.length,
      };
    });
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, view: "OCHE", keys: 2 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, keys ≥ 44 px`);
    await myShot(p);
    await settle(p, `${at}: your shot`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // A real flick: press on the treble 20, hold (the reticle sways: frames run), flick up, let go.
      const box = await p.locator("[data-fizlet-slot] .br-play").boundingBox();
      const [a] = await p.evaluate(() => [scene.screen(0, 103)]);
      await p.mouse.move(box.x + a[0], box.y + a[1]);
      await p.mouse.down();
      const aimed = await p.evaluate(() => [scene.state.aimX, scene.state.aimY]);
      assert.ok(Math.hypot(aimed[0], aimed[1] - 103) < 3, `${at}: the press puts the reticle where it is: ${aimed}`);
      assert.ok((await frames(p, 10)) >= 8, `${at}: holding, the reticle sways`);
      for (let k = 1; k <= 5; k++) await p.mouse.move(box.x + a[0], box.y + a[1] - k * 28);
      await p.mouse.up();
      assert.equal(await p.evaluate(() => scene.state.flying), true, `${at}: the flick throws`);
      await p.waitForFunction(() => scene.state.dart === 1 && !scene.state.flying, null, { timeout: 15000 });
      assert.ok(await p.evaluate(() => Math.abs(scene.g.dx[0]) < 60 && scene.g.dy[0] > 40), `${at}: the dart went up the board, near where it was aimed`);
      await p.focus("[data-fizlet-slot] .br-play");
    } else {
      // The keyboard: focus the play surface; ↑ aims up, Space throws.
      await p.focus("[data-fizlet-slot] .br-play");
      await p.keyboard.press("ArrowUp");
      assert.ok(Math.abs(await p.evaluate(() => scene.state.aimY) - 109) < 0.01, `${at}: the keys aim`);
      await p.keyboard.press(" ");
      assert.equal(await p.evaluate(() => scene.state.flying), true, `${at}: Space throws`);
      await p.waitForFunction(() => scene.state.dart === 1 && !scene.state.flying, null, { timeout: 15000 });
    }
    // The visit's other two darts by Space, then the bot's visit, and yours comes up again.
    for (let d = 0; d < 2; d++) {
      await p.waitForFunction(() => scene.state.phase !== 0 || (scene.state.turn === 0 && scene.state.ready), null, { timeout: 15000 });
      if (await p.evaluate(() => scene.state.phase !== 0)) break;
      await p.keyboard.press(" ");
    }
    await p.waitForFunction(() => scene.state.turn === 1, null, { timeout: 15000 });
    await myShot(p);
    assert.deepEqual(await p.evaluate(() => [scene.g.visits[0], scene.g.visits[1], scene.g.thrown[1]]), [1, 1, 3], `${at}: you threw a visit, the bot answered with three darts`);
    assert.ok(await p.evaluate(() => scene.state.you < 501 || scene.g.log[7] === -1), `${at}: your visit counted`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    // Recall mid-round: the page as it was, byte for byte.
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
  console.log("darts: mounts, draws and settles (no audio before a gesture); wide: a press, a hold that sways and a real flick throws; tall: arrows and Space; a visit, the bot's visit; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
