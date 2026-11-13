// Hold'em (site/gallery/pieces/holdem/holdem.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster steps
// aside), the diorama fills the stage and draws, the first hand deals, the bots act and it settles on
// your move with no frames and no audio before a gesture, every key 44 px or more, wide (720) and tall
// (the phone shape, 358 wide). Wide: the mouse checks and calls a hand down to the end; the hand is
// paid, NEXT HAND deals again. Tall: the keys (the arrows size a raise, R raises, F folds, Enter the
// next hand). Every chip is kept throughout. Recall mid-game gives the page back byte for byte;
// reduced motion keeps the poster. The rules, ranking and bots: tests/holdem.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/holdem/holdem.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/holdem.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#holdem" role="img" aria-label="Hold'em" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
const chips = (p) => p.evaluate(() => [...scene.g.stack, ...scene.g.bet].reduce((a, b) => a + b, 0) + scene.g.pot);
/** Your move, or the hand is over; and nothing still moving. */
const ready = (p) => p.waitForFunction(() => (scene.state.toAct === 0 || scene.state.phase >= 5) && !scene.state.busy, null, { timeout: 30000 });

try {
  for (const [w, phone] of [[720, false], [358, true]]) {
    const at = `@${w}${phone ? " tall" : ""}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone, phone ? "light" : "dark"));
    await mount(p);
    await p.waitForFunction(() => window.scene && scene.engine.stats().frames > 2);
    await ready(p);
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
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, keys: 5 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, five keys ≥ 44 px`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    assert.deepEqual(await p.evaluate(() => [scene.state.toAct, scene.g.k.count(2), scene.g.hand]), [0, 2, 1], `${at}: your move, two cards, hand 1`);
    assert.equal(await chips(p), 4000, `${at}: every chip at the table`);
    if (!phone) {
      // Check and call it down.
      for (let i = 0; i < 12 && (await p.evaluate(() => scene.state.phase < 5)); i++) {
        await p.locator('[data-fizlet-slot] .gk[data-id="2"]').click();
        await ready(p);
        assert.equal(await chips(p), 4000, `${at}: chips kept`);
      }
    } else {
      await p.focus("[data-fizlet-slot] .ct-play");
      const r0 = await p.evaluate(() => scene.state.raiseTo);
      await p.keyboard.press("ArrowUp");
      assert.equal(await p.evaluate(() => scene.state.raiseTo), r0 + 20, `${at}: ↑ sizes the raise up a big blind`);
      await p.keyboard.press("r");
      assert.equal(await p.evaluate(() => scene.g.bet[0]), r0 + 20, `${at}: R raised to it`);
      await ready(p);
      if (await p.evaluate(() => scene.state.phase < 5)) await p.keyboard.press("f");
      assert.equal(await p.evaluate(() => scene.g.folded[0] || scene.state.phase >= 5 ? 1 : 0), 1, `${at}: F folded`);
      await ready(p);
    }
    await p.waitForFunction(() => scene.state.phase >= 5 && !scene.state.busy, null, { timeout: 30000 });
    assert.equal(await chips(p), 4000, `${at}: chips kept after the hand`);
    assert.ok(await p.evaluate(() => scene.g.won.some((x) => x > 0)), `${at}: the pot was paid`);
    await settle(p, `${at}: the hand`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    if (await p.evaluate(() => scene.state.phase === 5)) {
      if (phone) await p.keyboard.press("Enter");
      else await p.locator('[data-fizlet-slot] .gk[data-id="5"]').click();
      await p.waitForFunction(() => scene.g.hand === 2);
    }
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
  console.log("holdem: mounts, deals, the bots act, settles on your move (no audio before a gesture); wide: the mouse checks and calls a hand down; tall: arrows, R, F, Enter; chips kept; the next hand deals; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
