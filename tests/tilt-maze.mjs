// Tilt Maze (site/gallery/pieces/maze/tilt-maze.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide). Wide: holding → rolls the ball along the first lane (the
// numbers count, the clock runs), letting go levels the board and it settles; a drag leans the
// board toward the drag; a ball over a hole drops through and comes back to the start (a fall
// counted); R puts the ball back; the steady hand rolls board 1 into the cup and board 2 drops in;
// M mutes. Tall: a drag leans the board. Recall mid-board gives the page back byte for byte;
// reduced motion keeps the still poster. The physics itself: tests/tilt-maze.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/maze/tilt-maze.ts"; export { LEVELS } from "./site/gallery/pieces/maze/tilt.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/tilt-maze.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#tilt-maze" role="img" aria-label="Tilt Maze" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), g = cvs.getContext("2d"), px = g.getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.length >= 2 && keys.every(Boolean),
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: true }, `${at}: mounts, the poster steps aside, the diorama fills and draws, the keys ≥ 44 px`);
    await settle(p, `${at}: idle`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    const box = await p.locator("[data-fizlet-slot]").boundingBox();
    // A drag leans the board toward it (+x on the board: the way the first lane runs).
    const [x0, y0, x1, y1] = await p.evaluate(() => scene.dragFor(1, 0));
    await p.mouse.move(box.x + x0, box.y + y0);
    await p.mouse.down();
    await p.mouse.move(box.x + x1, box.y + y1, { steps: 5 });
    await p.waitForFunction(() => scene.state.tx > 0.1 && Math.abs(scene.state.tz) < 0.03, null, { timeout: 5000 }).catch(async () => { throw new Error(`${at}: the drag leans the board: ${JSON.stringify(await p.evaluate(() => scene.state))}`); });
    await p.waitForFunction(() => scene.bd.vx > 0.3, null, { timeout: 5000 });
    await p.mouse.up();
    await p.waitForFunction(() => scene.state.tx === 0 && scene.state.tz === 0, null, { timeout: 5000 });
    await settle(p, `${at}: after the drag`);
    assert.ok(await p.evaluate(() => scene.state.t > 0), `${at}: the clock ran while the ball rolled`);
    if (!phone) {
      // R: back to the start; then hold → and the ball rolls along the first lane, passing numbers.
      await p.focus("[data-fizlet-slot] .tm-play");
      await p.keyboard.press("r");
      assert.deepEqual(await p.evaluate(() => [scene.bd.x, scene.bd.z, scene.state.far, scene.state.t]), [...(await p.evaluate(() => cv.LEVELS[0].path[0])), 0, 0], `${at}: R puts the ball on the start`);
      await p.keyboard.down("ArrowRight");
      await p.waitForFunction(() => scene.state.far >= 1, null, { timeout: 8000 });
      await p.keyboard.up("ArrowRight");
      await settle(p, `${at}: after the arrows`);
      assert.ok(await p.evaluate(() => scene.state.t > 0 && scene.state.tx === 0), `${at}: the arrow rolled the ball, the board levelled off`);
      // A ball rolling over a hole drops through and comes back to the start.
      const falls = await p.evaluate(() => { const h = cv.LEVELS[0].holes[0], f = scene.state.falls; Object.assign(scene.bd, { x: h[0] - 0.9, z: h[1], vx: 3, vz: 0 }); scene.engine.wake(); return f; });
      await p.waitForFunction((f) => scene.state.falls === f + 1 && scene.state.ball === 0, falls, { timeout: 5000 });
      assert.deepEqual(await p.evaluate(() => [scene.bd.x, scene.bd.z]), await p.evaluate(() => cv.LEVELS[0].path[0]), `${at}: down the hole and back on the start`);
      // The steady hand: board 1 into the cup, then board 2 drops in.
      await p.evaluate(() => scene.autopilot(true));
      await p.waitForFunction(() => scene.state.level === 1 && scene.state.phase === 0, null, { timeout: 60000 });
      assert.ok(await p.evaluate(() => scene.state.times[0] > 5), `${at}: board 1 in the cup, its time kept; board 2 dropped in`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
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
  console.log("tilt-maze: mounts, the diorama draws and settles (no audio before a gesture); a drag leans the board and the ball rolls, letting go levels it; wide: R back to the start, → rolls the first lane, a hole drops the ball back to the start, the steady hand clears board 1 and board 2 drops in, M mutes; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
