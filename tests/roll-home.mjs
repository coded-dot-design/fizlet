// Roll Home (site/gallery/pieces/roll/roll-home.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet, as the gallery has them), mounted through @fzlt/core/slot: it
// mounts (the poster steps aside), the diorama fills the stage and draws, and it settles to no frames
// with no audio before a gesture; every key is 44 px or more, wide (720) and tall (the phone shape,
// 358 wide). The keyboard plays it (Space pops the dome: the die is the model's roll, the pawn hops
// that far; the bot answers; then 2 picks the second pawn); touch plays it (a tap on the dome rolls).
// After every move each pawn on the board stands on the track's space for its model position.
// Recall mid-game gives the page back byte for byte; reduced motion keeps the still poster. The
// game itself: tests/roll-home.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/roll/roll-home.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/roll-home.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#roll-home" role="img" aria-label="Roll Home" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
// Every pawn on the board stands on the track's space for its model position (home: off the track).
const agree = (p, at) => p.evaluate(() => Array.from(scene.m.pos).map((v) => (v === 24 ? -1 : v))).then(async (want) => assert.deepEqual((await p.evaluate(() => scene.state)).at, want, `${at}: the track agrees with the model`));

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
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 2 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, mute and ROLL ≥ 44 px`);
    await settle(p, `${at}: idle`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    await p.evaluate(() => scene.reset(1106));
    if (!phone) {
      // The keyboard: Space pops the dome; both pawns stand on the porch, so the first one goes.
      await p.focus("[data-fizlet-slot] .rh-play");
      const want = await p.evaluate(() => scene.m.rolls);
      await p.keyboard.press(" ");
      await p.waitForFunction(() => scene.state.anim === 1, null, { timeout: 3000 });
      assert.equal(await p.evaluate((n) => scene.m.rolls === n + 1 && scene.state.die >= 1, want), true, `${at}: Space rolled`);
      await p.waitForFunction(() => scene.state.anim === 2, null, { timeout: 5000 });
      await yourRoll(p);
      await agree(p, `${at}: first move`);
      assert.ok(await p.evaluate(() => scene.m.pos[0] !== 0 && scene.m.stats[4] >= 1), `${at}: your pawn left the porch and the bot answered`);
      // Now the pawns stand apart: a roll asks which one; 2 moves the second.
      await p.keyboard.press(" ");
      await p.waitForFunction(() => scene.state.phase === 1 && scene.state.anim === 0, null, { timeout: 5000 });
      const keys = await p.evaluate(() => [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).length);
      assert.equal(keys, 4, `${at}: PAWN 1 and PAWN 2 come up to pick`);
      const before = await p.evaluate(() => scene.m.pos[1]);
      await p.keyboard.press("2");
      await p.waitForFunction(() => scene.state.anim === 2, null, { timeout: 3000 });
      assert.notEqual(await p.evaluate(() => scene.m.pos[1]), before, `${at}: 2 moved the second pawn`);
      await yourRoll(p);
      await agree(p, `${at}: the picked move`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
    } else {
      // Touch: a tap on the dome rolls.
      const box = await p.locator("[data-fizlet-slot]").boundingBox();
      const [x, y] = await p.evaluate(() => scene.domeScreen());
      await p.touchscreen.tap(box.x + x, box.y + y);
      await p.waitForFunction(() => scene.m.rolls === 1, null, { timeout: 3000 });
      await yourRoll(p);
      await agree(p, `${at}: after a tap`);
    }
    await settle(p, `${at}: after play`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    // Recall mid-game: the page comes back byte for byte.
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
  console.log("roll-home: mounts, the diorama draws and settles (no audio before a gesture); wide: Space rolls, the pawn hops, the bot answers, 2 picks a pawn, M mutes; tall: a tap on the dome rolls; the track agrees with the model; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
