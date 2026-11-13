// Salvo Bay (site/gallery/pieces/salvo/salvo-bay.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, and it
// settles to no frames with no audio before a gesture; every key is 44 px or more, wide (720) and
// tall (the phone shape, 358 wide). The keyboard plays it (X a random fleet, S start, arrows and
// Enter fire, M mutes; a shell flies and lands, the bot answers); touch plays it (RANDOM, START,
// then a tap on a cell of the enemy bay fires there). Recall mid-battle gives the page back byte
// for byte; reduced motion keeps the still poster. The game itself: tests/salvo-bay.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/salvo/salvo-bay.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/salvo-bay.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#salvo-bay" role="img" aria-label="Salvo Bay" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 20000 }).catch(() => { throw new Error(`${what}: never settled`); });
const yourTurn = (p) => p.waitForFunction(() => scene.state.phase === 1 && scene.state.turn === 0 && !scene.state.anim && !scene.state.shell && !scene.state.tween, null, { timeout: 15000 });

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
        backing: cvs.width >= Math.floor(art.width) && cvs.height >= Math.floor(art.height),
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.every(Boolean) && keys.length,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, backing: true, drawn: true, wide: !phone, keys: 5 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, keys ≥ 44 px`);
    // The bay bobs a while, then it settles: no frames, no audio, the page as it was.
    await settle(p, `${at}: placement`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The keyboard: focus the play surface; X random fleet, S start, → ↓ Enter fires.
      await p.focus("[data-fizlet-slot] .sb-play");
      await p.keyboard.press("x");
      await p.waitForFunction(() => scene.m.sides[0].sx.every((x) => x >= 0));
      await p.keyboard.press("s");
      await p.waitForFunction(() => scene.state.phase === 1);
      await yourTurn(p);
      await p.keyboard.press("ArrowRight");
      await p.keyboard.press("ArrowDown");
      assert.equal(await p.evaluate(() => scene.state.cursor), 36, `${at}: the arrows move the cursor`);
      await p.keyboard.press("Enter");
      await p.waitForFunction(() => scene.state.shell, null, { timeout: 3000 });
      assert.equal(await p.evaluate(() => scene.m.sides[1].shots[36] > 0 && scene.m.sides[0].n[0]), 1, `${at}: Enter fired at the cursor`);
      // It lands, and the bot answers (every shot passes the turn).
      await p.waitForFunction(() => scene.m.sides[1].n[0] === 1, null, { timeout: 8000 });
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      await yourTurn(p);
    } else {
      // Touch: RANDOM, START, then a tap on an enemy cell fires there.
      await p.tap(".gk[aria-label^='Random']");
      await p.waitForFunction(() => scene.m.sides[0].sx.every((x) => x >= 0));
      await p.tap(".gk[aria-label^='Start']");
      await yourTurn(p);
      const box = await p.locator("[data-fizlet-slot]").boundingBox();
      const [x, y] = await p.evaluate(() => scene.cellScreen(1, 27));
      await p.touchscreen.tap(box.x + x, box.y + y);
      await p.waitForFunction(() => scene.m.sides[1].shots[27] > 0, null, { timeout: 3000 });
      assert.equal(await p.evaluate(() => scene.state.shell), true, `${at}: a tap on a cell fires a shell`);
    }
    // The stickers follow the battle: one shot fired.
    await p.waitForFunction(() => /Shots 1$/.test(document.querySelector(".sb-n").textContent), null, { timeout: 3000 }).catch(() => assert.fail(`${at}: the shots sticker counts`));
    // Recall mid-battle: the page comes back byte for byte.
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
  console.log("salvo-bay: mounts, the diorama draws and settles (no audio before a gesture); wide: the keyboard places, starts and fires (X, S, arrows, Enter, M); tall: RANDOM, START and a tap fire; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
