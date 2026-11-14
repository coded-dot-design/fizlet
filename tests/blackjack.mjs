// Blackjack (site/gallery/pieces/blackjack/blackjack.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the diorama fills the stage and draws, the first round deals itself and settles to
// no frames with no audio before a gesture, and every key is 44 px or more, wide (720) and tall (the
// phone shape, 358 wide). The first shoe is seeded, so the first round is always the queen of hearts
// and the two of diamonds against the seven of diamonds. Wide: the mouse plays it (HIT, STAND, the
// dealer draws, the chips go home, DEAL again). Tall: the keys (H, S, Enter). Recall mid-game gives
// the page back byte for byte; reduced motion keeps the poster. The rules: tests/blackjack.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/blackjack/blackjack.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/blackjack.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#blackjack" role="img" aria-label="Blackjack" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
/** The round is over and the chips are home. */
const home = (p) => p.waitForFunction(() => scene.state.phase === 3 && !scene.state.busy && scene.state.shown === scene.state.bank, null, { timeout: 15000 });
const hand = (p) => p.evaluate(() => [scene.g.k.at(2, 0), scene.g.k.at(2, 1), scene.g.k.at(1, 0)]);

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone, phone ? "light" : "dark"));
    await mount(p);
    await p.waitForFunction(() => window.scene && scene.engine.stats().frames > 2);
    await p.waitForFunction(() => scene.state.phase === 1);
    await settle(p, `${at}: the first deal`);
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
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, keys: 5 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, five keys ≥ 44 px`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    assert.deepEqual(await hand(p), [11 + 13, 1 + 39, 6 + 39], `${at}: the seeded first round: Q♥ 2♦ against 7♦`);
    assert.deepEqual(await p.evaluate(() => [scene.g.bank, scene.state.shown]), [980, 980], `${at}: the bet is out on the table`);
    if (!phone) {
      const key = (s) => p.locator(`[data-fizlet-slot] .gk:text-is("${s}")`).click();
      await key("HIT");
      await p.waitForFunction(() => scene.g.k.count(2) === 3);
      if (await p.evaluate(() => scene.state.phase === 1)) await key("STAND");
      await home(p);
      const r = await p.evaluate(() => [scene.g.result[0], scene.g.bank, scene.g.paid[0]]);
      assert.ok(r[0] >= 1, `${at}: the round settled (result ${r[0]})`);
      assert.equal(r[1], 980 + r[2], `${at}: chips: 980 + what came back`);
      await key("BET 20");
      assert.equal(await p.evaluate(() => scene.g.base), 50, `${at}: the bet key steps 20 → 50`);
      await key("DEAL");
      await p.waitForFunction(() => scene.state.phase !== 3 || scene.g.rounds === 2);
      assert.equal(await p.evaluate(() => scene.g.bet[0]), 50, `${at}: dealt again at 50`);
    } else {
      await p.focus("[data-fizlet-slot] .ct-play");
      await p.keyboard.press("h");
      await p.waitForFunction(() => scene.g.k.count(2) === 3);
      if (await p.evaluate(() => scene.state.phase === 1)) await p.keyboard.press("s");
      await home(p);
      await p.keyboard.press("Enter");
      await p.waitForFunction(() => scene.g.rounds === 2);
    }
    await settle(p, `${at}: the second round`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    // Recall mid-game: the page as it was, byte for byte.
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
  console.log("blackjack: mounts, deals the seeded first round and settles (no audio before a gesture); wide: the mouse hits, stands, raises the bet and deals again; tall: the keys; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
