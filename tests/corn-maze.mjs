// Corn Maze (site/gallery/pieces/maze/corn-maze.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws the
// whole field, and it settles to no frames with no audio before a gesture, waiting at the gate;
// every key is 44 px or more, wide (720) and tall (the phone shape, 358 wide). Wide: an arrow walks
// you in (the camera follows, the light starts to run down), letting go stops you in a room; clicks
// walk you to a pumpkin (taken: the count goes up) and on to the scarecrow (found: the end card);
// a crow you walk by scatters; V (MAP) pulls the camera over the field and back, and a click on the
// map walks you there; M mutes; NEW FIELD
// starts another. Tall: taps walk you in and to the scarecrow. The light running out ends it in the
// dark. Recall mid-walk gives the page back byte for byte; reduced motion keeps the still poster.
// The field itself: tests/corn-maze.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/maze/corn-maze.ts"; export { LIGHT } from "./site/gallery/pieces/maze/corn.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/corn-maze.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#corn-maze" role="img" aria-label="Corn Maze" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
        keys: keys.every(Boolean) && keys.length,
        phase: scene.state.phase,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 2, phase: 0 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, mute and MAP ≥ 44 px, it waits at the gate`);
    await settle(p, `${at}: idle`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    const box = await p.locator("[data-fizlet-slot]").boundingBox();
    const press = async (cell) => {
      const [x, y] = await p.evaluate((c) => scene.cellScreen(c), cell);
      if (phone) await p.touchscreen.tap(box.x + x, box.y + y);
      else await p.mouse.click(box.x + x, box.y + y);
    };
    /** Walk to cell c by taps/clicks (again whenever you stop), until `done`. */
    const walkTo = async (c, done) => {
      // From the map the whole field is in view: a tap there sends you anywhere.
      if (!(await p.evaluate(() => scene.state.map))) await p.click("[data-fizlet-slot] .gk:nth-child(2)");
      await p.waitForTimeout(700);
      for (let k = 0; k < 160; k++) {
        if (await p.evaluate(done)) return;
        if (await p.evaluate(() => scene.field.at === scene.field.to)) await press(c);
        await p.waitForTimeout(300);
      }
      throw new Error(`${at}: never got to ${c}: ${JSON.stringify(await p.evaluate(() => scene.state))} ${JSON.stringify(await p.evaluate((c) => [scene.field.at, scene.field.pathN, scene.field.pathI, scene.cellScreen(c), scene.field.path[scene.field.pathN - 1]], c))}`);
    };
    if (!phone) {
      await p.focus("[data-fizlet-slot] .cm-play");
      // The first arrow that leads somewhere from the gate's room (the camera faces up the field).
      let moved = false;
      for (const k of ["ArrowUp", "ArrowLeft", "ArrowRight"]) {
        await p.keyboard.down(k);
        moved = await p.waitForFunction(() => scene.state.phase === 1 && scene.field.at !== scene.field.start, null, { timeout: 1500 }).then(() => true, () => false);
        await p.keyboard.up(k);
        if (moved) break;
      }
      assert.ok(moved, `${at}: an arrow walks you in`);
      await p.waitForFunction(() => scene.field.at === scene.field.to, null, { timeout: 5000 });
      assert.ok(await p.evaluate(() => scene.state.light < cv.LIGHT), `${at}: an arrow walked you in; the light runs down`);
      // MAP and back.
      await p.keyboard.press("v");
      assert.equal(await p.evaluate(() => scene.state.map), true, `${at}: V shows the map`);
      await p.keyboard.press("v");
      // A crow: walk you next to one (a test hook on the model), it scatters.
      await p.evaluate(() => { const f = scene.field, c = f.crow[0], g = f.g; const o = [c + 1, c - 1, c + g.cols, c - g.cols].find((i) => !(g.flags[i] & 1)); Object.assign(f, { at: o, to: o, prog: 0, pathN: 0 }); scene.engine.wake(); });
      await p.waitForFunction(() => scene.state.crowsAway > 0, null, { timeout: 5000 });
      // Clicks: to a pumpkin, then the scarecrow.
      const pk = await p.evaluate(() => scene.field.pumpkin[0]);
      await walkTo(pk, () => scene.state.taken >= 1);
      await walkTo(await p.evaluate(() => scene.field.scare), () => scene.state.state === 2);
      await p.waitForFunction(() => scene.state.card, null, { timeout: 8000 });
      assert.ok(await p.evaluate(() => scene.state.taken >= 1 && /pumpkin/.test(document.querySelector(".cm-card p").textContent)), `${at}: a pumpkin taken, the scarecrow found, the card says so`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // NEW FIELD: a new maze waits at the gate; then the light runs out.
      await p.click("[data-fizlet-slot] .cm-again");
      await p.waitForFunction(() => scene.state.phase === 0 && !scene.state.card && scene.state.taken === 0, null, { timeout: 5000 });
      await p.keyboard.press(" ");
      await p.evaluate(() => (scene.field.light = 0.2));
      await p.waitForFunction(() => scene.state.state === 3 && scene.state.card, null, { timeout: 8000 });
      assert.match(await p.evaluate(() => document.querySelector(".cm-card b").textContent), /Lights out/, `${at}: the light ran out`);
    } else {
      await press(await p.evaluate(() => scene.field.start));
      await p.waitForFunction(() => scene.state.phase === 1, null, { timeout: 5000 });
      await walkTo(await p.evaluate(() => scene.field.scare), () => scene.state.state === 2);
      await p.waitForFunction(() => scene.state.card, null, { timeout: 8000 });
    }
    await settle(p, `${at}: after play`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
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
  console.log("corn-maze: mounts, the field draws and settles at the gate (no audio before a gesture); wide: an arrow walks you in and the light runs down, V maps, a crow scatters, clicks take a pumpkin and find the scarecrow (card), M mutes, NEW FIELD waits at the gate, the light runs out; tall: taps find the scarecrow; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
