// Gin Rummy (site/gallery/pieces/gin/gin-rummy.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the diorama fills the stage and draws, the deal plays and settles to no frames with no
// audio before a gesture, every key is 44 px or more, wide (720) and tall (the phone shape, 358
// wide). Wide: the mouse taps the stock, picks a card and taps it again to throw it; the bot plays
// its turn. Tall: the keys (T takes the discard, the arrows pick, Enter throws). Both: a hand set up
// to knock knocks (K), both hands go down in melds and the points are counted; Enter deals the next
// hand. Recall mid-game gives the page back byte for byte; reduced motion keeps the poster. The rules
// and the bot: tests/gin-rummy.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/gin/gin-rummy.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/gin-rummy.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#gin-rummy" role="img" aria-label="Gin Rummy" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
/** Your turn to draw again (the bot has played). */
const yours = (p) => p.waitForFunction(() => scene.state.turn === 0 && scene.state.phase === 0 && !scene.state.busy, null, { timeout: 15000 });
const pt = async (p, where) => { const b = await p.locator("[data-fizlet-slot] .ct-play").boundingBox(); return [b.x + where[0], b.y + where[1]]; };

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone, phone ? "light" : "dark"));
    await mount(p);
    await p.waitForFunction(() => window.scene && scene.engine.stats().frames > 2);
    await p.waitForFunction(() => scene.g.k.count(2) === 10);
    await settle(p, `${at}: the deal`);
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
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, keys: 3 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, three keys ≥ 44 px`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    assert.deepEqual(await p.evaluate(() => [scene.g.k.count(2), scene.g.k.count(3), scene.g.k.count(1), scene.state.turn]), [10, 10, 1, 0], `${at}: ten each, one up, your turn`);
    if (!phone) {
      const [sx, sy] = await pt(p, await p.evaluate(() => scene.cardScreen(scene.g.k.top(0))));
      await p.mouse.click(sx, sy);
      assert.deepEqual(await p.evaluate(() => [scene.g.k.count(2), scene.state.phase]), [11, 1], `${at}: the stock tap drew a card`);
      await settle(p, `${at}: after the draw`);
      // Pick the first card in your hand, then tap it again: thrown.
      const c = await p.evaluate(() => { for (let i = 0; i < 11; i++) { const c = scene.g.k.at(2, i); if (c !== scene.state.picked) return c; } });
      const [x, y] = await pt(p, await p.evaluate((c) => scene.cardScreen(c), c));
      await p.mouse.click(x, y);
      assert.equal(await p.evaluate(() => scene.state.picked), c, `${at}: a tap picks the card`);
      await p.mouse.click(x, y);
      assert.deepEqual(await p.evaluate((c) => [scene.g.k.pile[c], scene.g.k.count(2)], c), [1, 10], `${at}: a second tap throws it`);
    } else {
      await p.focus("[data-fizlet-slot] .ct-play");
      const up = await p.evaluate(() => scene.g.k.top(1));
      await p.keyboard.press("t");
      assert.equal(await p.evaluate((c) => scene.g.k.pile[c], up), 2, `${at}: T took the discard`);
      await p.keyboard.press("ArrowLeft");
      const c = await p.evaluate(() => scene.state.picked);
      assert.ok(c >= 0, `${at}: the arrows pick a card`);
      if (c === up) await p.keyboard.press("ArrowRight");
      const thrown = await p.evaluate(() => scene.state.picked);
      await p.keyboard.press("Enter");
      assert.equal(await p.evaluate((c) => scene.g.k.pile[c], thrown), 1, `${at}: Enter threw it`);
    }
    await yours(p);
    assert.equal(await p.evaluate(() => scene.g.k.count(3)), 10, `${at}: the bot drew and threw`);
    await settle(p, `${at}: the bot's turn`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    // A hand that knocks: A♠2♠3♠ 4♥4♣4♦ 9♣10♣J♣ 2♥, and the stock's top a K♦ to throw.
    await p.evaluate(() => {
      const k = scene.g.k, mine = [0, 1, 2, 16, 29, 42, 34, 35, 36, 14];
      while (k.count(2)) k.move(k.top(2), 0, 0, 0);
      for (const c of mine) k.move(c, 2, -1, 1);
      k.move(51, 0, -1, 0);
      scene.refresh();
    });
    await settle(p, `${at}: the rigged hand`);
    await p.focus("[data-fizlet-slot] .ct-play");
    await p.keyboard.press("s");
    assert.equal(await p.evaluate(() => scene.state.picked), 51, `${at}: the K♦ picked to throw`);
    await p.keyboard.press("k");
    await p.waitForFunction(() => scene.state.showing, null, { timeout: 10000 });
    const r = await p.evaluate(() => [scene.g.knocker, scene.g.dead[0], scene.g.end, scene.g.score[0] + scene.g.score[1] > 0]);
    assert.deepEqual(r, [0, 2, r[2], true], `${at}: you knocked with 2; points scored`);
    await settle(p, `${at}: the showdown`);
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => !scene.state.showing && scene.g.hands === 2);
    // Recall: the page as it was, byte for byte.
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
  console.log("gin-rummy: mounts, deals and settles (no audio before a gesture); wide: the mouse draws, picks and throws; tall: T, arrows, Enter; the bot plays; a knock lays the hands down and scores; the next hand deals; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
