// Air Hockey (site/gallery/pieces/air-hockey/air-hockey.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the diorama fills the stage and draws, it settles to no frames with no audio before a
// gesture (the puck waits on your side), and every key is 44 px or more, wide (720) and tall (the
// phone shape, 358 wide). The mouse plays it on the wide stage (a real drag: the mallet chases the
// pointer through the puck and sends it), the keyboard on the tall one (a held arrow steers the
// mallet up the table into the puck). Recall mid-rally gives the page back byte for byte; reduced
// motion keeps the poster. The game itself: tests/air-hockey.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/air-hockey/air-hockey.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/air-hockey.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#air-hockey" role="img" aria-label="Air Hockey" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
        drawn: px[3] === 255, view: scene.state.view, keys: keys.every(Boolean) && keys.length,
      };
    });
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, view: phone ? "END" : "SIDE", keys: 2 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, keys ≥ 44 px`);
    await settle(p, `${at}: the face-off`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // A real drag: press by your mallet, sweep through the puck toward the bot's end.
      const box = await p.locator("[data-fizlet-slot] .br-play").boundingBox();
      const pts = await p.evaluate(() => [scene.screen(-0.8, 0), scene.screen(-0.6, 0), scene.screen(-0.3, 0), scene.screen(-0.1, 0)]);
      await p.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
      await p.mouse.down();
      assert.ok(await p.evaluate(() => scene.state.dragging), `${at}: the press grabs the mallet`);
      for (let k = 1; k < 4; k++) await p.mouse.move(box.x + pts[k][0], box.y + pts[k][1], { steps: 4 });
      await p.waitForFunction(() => scene.g.w.vx[0] > 1, null, { timeout: 10000 });
      await p.mouse.up();
    } else {
      // The keyboard: hold ↑ (up the table, toward the bot) until the mallet meets the puck.
      await p.focus("[data-fizlet-slot] .br-play");
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(() => scene.g.w.vx[0] > 0.5, null, { timeout: 10000 });
      await p.keyboard.up("ArrowUp");
      assert.ok(await p.evaluate(() => scene.state.tx > -820), `${at}: the keys steer the mallet`);
    }
    assert.ok(await p.evaluate(() => scene.g.hits[1] >= 1), `${at}: you hit the puck`);
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
  console.log("air-hockey: mounts, draws and settles (no audio before a gesture); wide: a real drag sends the puck; tall: a held arrow steers into it; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
