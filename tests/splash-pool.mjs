// Splash Pool (site/gallery/pieces/pool/splash-pool.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide). The keyboard plays it (2 picks the cannonball, arrows aim, Enter
// drops: it splashes and sinks; D drains: the whirlpool takes what floats and the refill brings it
// back; M mutes), and ripples alone, dropped by mouse clicks, bring the duck to the flag. Touch plays
// it (a tap on the water drops a ball that floats, the item key cycles, DRAIN drains). Recall gives
// the page back byte for byte; reduced motion keeps the still poster. The water's physics:
// tests/splash-pool.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/pool/splash-pool.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/splash-pool.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#splash-pool" role="img" aria-label="Splash Pool" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 30000 }).catch(() => { throw new Error(`${what}: never settled`); });
/** Floater i's state and speed; drops in flight or sinking. */
const calm = (p) => p.waitForFunction(() => {
  const F = scene.pool.F, D = scene.pool.D;
  for (let i = 0; i < 10; i++) if (D[i * 8 + 7] === 1 || D[i * 8 + 7] === 2) return false;
  return F[7] === 1 && Math.hypot(F[2], F[3]) < 0.03;
}, null, { timeout: 15000 });

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
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 3 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, keys ≥ 44 px`);
    await settle(p, `${at}: at rest`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The keyboard: 2 picks the cannonball, ← ← Enter drops it; it splashes, sinks, lies on the floor.
      await p.focus("[data-fizlet-slot] .sp-play");
      await p.keyboard.press("2");
      assert.equal(await p.evaluate(() => scene.state.item), 1, `${at}: 2 picks the cannonball`);
      assert.equal(await p.evaluate(() => document.querySelector(".gk[aria-label^='What you drop']").textContent), "ROCK");
      await p.keyboard.press("ArrowLeft");
      await p.keyboard.press("ArrowUp");
      await p.keyboard.press("Enter");
      assert.equal(await p.evaluate(() => scene.state.drops), 1, `${at}: Enter drops`);
      await p.waitForFunction(() => scene.pool.D[7] === 2, null, { timeout: 4000 });
      await p.waitForFunction(() => scene.pool.D[7] === 3, null, { timeout: 6000 });
      // D: the whirlpool takes what floats, the refill gives it back.
      await p.keyboard.press("d");
      assert.equal(await p.evaluate(() => scene.state.drain), true, `${at}: D drains`);
      await p.waitForFunction(() => scene.pool.F[7] === 3 || scene.pool.F[7] === 2, null, { timeout: 6000 });
      await p.waitForFunction(() => !scene.state.drain && scene.state.floaters >= 2, null, { timeout: 10000 });
      assert.equal(await p.evaluate(() => scene.state.duck), 1, `${at}: the duck is back afloat`);
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // The diving board: a click twangs it and flips the cannonball off its tip into the water.
      await calm(p);
      const bb = await p.locator("[data-fizlet-slot]").boundingBox(), [bx, by] = await p.evaluate(() => scene.boardTip());
      const d0 = await p.evaluate(() => scene.state.drops);
      await p.mouse.click(bb.x + bx, bb.y + by);
      assert.equal(await p.evaluate(() => scene.state.drops), d0 + 1, `${at}: the board flips one in`);
      await p.waitForFunction(() => scene.pool.D.some((v, i) => i % 8 === 7 && v === 2), null, { timeout: 4000 });
      await p.evaluate(() => (scene.pool.drops = 0));
      // Ripples only: cannonballs clicked down a step behind the duck bring it to the flag.
      await calm(p);
      const box = await p.locator("[data-fizlet-slot]").boundingBox();
      for (let k = 0; k < 18 && !(await p.evaluate(() => scene.state.homes)); k++) {
        const [x, y] = await p.evaluate(() => {
          const F = scene.pool.F, gx = 4.08, gz = -2.33, dx = F[0] - gx, dz = F[1] - gz, d = Math.hypot(dx, dz);
          return scene.screen(F[0] + (dx / d) * 1.1, F[1] + (dz / d) * 1.1);
        });
        await p.mouse.click(box.x + x, box.y + y);
        await p.waitForFunction(() => scene.state.homes || scene.pool.D.some((v, i) => i % 8 === 7 && v === 1), null, { timeout: 3000 }).catch(() => {});
        await calm(p).catch(() => {});
      }
      assert.equal(await p.evaluate(() => scene.state.homes), 1, `${at}: the duck reached the flag`);
      await p.waitForFunction(() => /Best \d+$/.test(document.querySelector(".sp-n").textContent), null, { timeout: 3000 }).catch(() => assert.fail(`${at}: the best run shows`));
      assert.match(await p.evaluate(() => document.querySelector(".sp-live").textContent), /Corner pocket/, `${at}: the win is read out`);
    } else {
      // Touch: a tap on the water drops a beach ball, which floats; the item key cycles; DRAIN drains.
      const box = await p.locator("[data-fizlet-slot]").boundingBox();
      const [x, y] = await p.evaluate(() => scene.screen(1.5, 1));
      await p.touchscreen.tap(box.x + x, box.y + y);
      assert.equal(await p.evaluate(() => scene.state.drops), 1, `${at}: a tap drops`);
      await p.waitForFunction(() => scene.state.floaters === 3, null, { timeout: 4000 });
      await p.tap(".gk[aria-label^='What you drop']");
      // The pick changes on the piece's next update after the tap: wait on that state, not the same instant.
      await p.waitForFunction(() => scene.state.item === 1, null, { timeout: 3000 }).catch(() => {});
      assert.equal(await p.evaluate(() => scene.state.item), 1, `${at}: the item key cycles`);
      await p.tap(".gk[aria-label^='Drain']");
      assert.equal(await p.evaluate(() => scene.state.drain), true, `${at}: DRAIN drains`);
      await p.waitForFunction(() => /Drops 1 /.test(document.querySelector(".sp-n").textContent), null, { timeout: 3000 }).catch(() => assert.fail(`${at}: the drops sticker counts`));
    }
    // Recall mid-play: the page comes back byte for byte.
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
  console.log("splash-pool: mounts, the diorama draws and settles (no audio before a gesture); wide: the keyboard picks, aims, drops and drains (2, arrows, Enter, D, M), the board flips one in, clicked ripples bring the duck to the flag; tall: a tap drops a ball that floats, the item key cycles, DRAIN drains; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
