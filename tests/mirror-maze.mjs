// Mirror Maze (site/gallery/pieces/mirror/mirror-maze.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide). Wide: the keyboard plays board 1 (an arrow picks the mirror,
// Space turns it: the moves count, the crystal lights at par, the next board slides in), then
// clicks solve board 2 at par, and R resets a board. Tall: taps solve board 1. Recall mid-maze gives
// the page back byte for byte; reduced motion keeps the still poster. The puzzles themselves:
// tests/mirror-maze.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/mirror/mirror-maze.ts"; export { LEVELS, PARS, par, load } from "./site/gallery/pieces/mirror/model.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/mirror-maze.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#mirror-maze" role="img" aria-label="Mirror Maze" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });
const yourRoll = (p) => p.waitForFunction(() => scene.state.phase === 0 && scene.state.turn === 0 && scene.state.anim === 0 && !scene.state.card, null, { timeout: 20000 });
const boardReady = (p, l) => p.waitForFunction((l) => scene.state.level === l && scene.state.phase === 0, l, { timeout: 15000 });

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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.every(Boolean) && keys.length,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 2 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, mute and RESET ≥ 44 px`);
    await settle(p, `${at}: idle`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    const box = await p.locator("[data-fizlet-slot]").boundingBox();
    // The puzzles' data from the page's own bundle: each board's starting looks, pars and the looks that solve it.
    const D = await p.evaluate(() => ({ start: cv.LEVELS.map((l) => l.mirror.map((m) => m[2])), PARS: cv.PARS, sol: [0, 1].map((l) => { const w = new Uint8Array(8); cv.par(l, cv.load(l), w); return Array.from(w.slice(0, cv.LEVELS[l].mirror.length)); }) }));
    const press = async (i) => {
      const [x, y] = await p.evaluate((i) => scene.mirrorScreen(i), i);
      if (phone) await p.touchscreen.tap(box.x + x, box.y + y);
      else await p.mouse.click(box.x + x, box.y + y);
    };
    if (!phone) {
      // Board 1 by keyboard: the arrow shows the mirror, Space turns it (one move each).
      await p.focus("[data-fizlet-slot] .mm-play");
      await p.keyboard.press("ArrowRight");
      const [want] = D.sol[0], start = D.start[0][0];
      for (let k = 0; k < ((want - start + 4) & 3); k++) await p.keyboard.press(" ");
      assert.equal(await p.evaluate(() => scene.state.moves), D.PARS[0], `${at}: Space turned the mirror, the moves count`);
      await p.waitForFunction(() => scene.state.lit === 1, null, { timeout: 5000 });
      await boardReady(p, 1);
      assert.equal(await p.evaluate(() => scene.state.total), D.PARS[0], `${at}: board 1 cleared at par, board 2 slid in`);
      // R resets: a turn, then R, and the board is back to its start with no moves.
      await press(0);
      await p.waitForFunction(() => scene.state.moves === 1);
      await p.keyboard.press("r");
      assert.deepEqual(await p.evaluate(() => [scene.state.moves, scene.bd.look[0]]), [0, D.start[1][0]], `${at}: R resets the board`);
      // Board 2 by clicks, at par.
      const sol = D.sol[1];
      for (let i = 0; i < sol.length; i++) for (let k = 0; k < ((sol[i] - D.start[1][i] + 4) & 3); k++) await press(i), await p.waitForTimeout(60);
      await p.waitForFunction(() => scene.state.lit === 1, null, { timeout: 5000 });
      await boardReady(p, 2);
      assert.equal(await p.evaluate(() => scene.state.total), D.PARS[0] + D.PARS[1], `${at}: board 2 cleared at par by clicks`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
    } else {
      // Taps: board 1.
      const [want] = D.sol[0], start = D.start[0][0];
      for (let k = 0; k < ((want - start + 4) & 3); k++) await press(0), await p.waitForTimeout(60);
      await boardReady(p, 1);
      assert.equal(await p.evaluate(() => scene.state.total), D.PARS[0], `${at}: a tap turned the mirror; board 1 cleared`);
    }
    await settle(p, `${at}: after play`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    // Recall mid-maze: the page comes back byte for byte.
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
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
  console.log("mirror-maze: mounts, the diorama draws and settles (no audio before a gesture); wide: arrows and Space solve board 1 at par, the next board slides in, R resets, clicks solve board 2 at par, M mutes; tall: taps solve board 1; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
