// Solitaire (site/gallery/pieces/solitaire/solitaire.ts) in Chromium, on its own stage in a gallery
// figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts (the poster
// steps aside), the diorama fills the stage and draws, the deal plays and settles to no frames with no
// audio before a gesture, every key is 44 px or more, wide (720) and tall (the phone shape, 358
// wide). Wide: the mouse taps the stock, taps a card that goes, drags another onto its column, and
// UNDO takes it back. Tall: the keys (Space draws, the arrows and Enter play a pile, U undoes). Both:
// a position one step from solved plays itself out, the deck flies into the spiral and the solved
// card comes up. Recall mid-game gives the page back byte for byte; reduced motion keeps the poster.
// The rules: tests/solitaire.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/solitaire/solitaire.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/solitaire.html", "utf8");
const page = (w, phone, theme = "dark") => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#solitaire" role="img" aria-label="Solitaire" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
const idle = (p) => p.waitForFunction(() => !scene.state.busy, null, { timeout: 15000 });
/** A card that goes somewhere (to a column if `col`), drawing from the stock until one does: [card, pile] or null. */
const findMove = (p, col) => p.evaluate(async (col) => {
  for (let d = 0; d < 60; d++) {
    for (let c = 0; c < 52; c++) {
      const t = scene.goes(c);
      if (t >= 0 && (!col || t >= 6)) return [c, t];
    }
    document.querySelector("[data-fizlet-slot] .ct-play").dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  }
  return null;
}, col);
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
    await p.waitForFunction(() => scene.g.k.count(6) >= 1);
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
    assert.deepEqual(m, { poster: "none", fills: true, drawn: true, keys: 4 }, `${at}: mounts, the poster steps aside, the diorama fills and draws, four keys ≥ 44 px`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    assert.equal(await p.evaluate(() => scene.g.k.count(0)), 24, `${at}: 24 in the stock`);
    if (!phone) {
      // Tap the stock: a card to the waste.
      const [sx, sy] = await pt(p, await p.evaluate(() => scene.pileScreen(0)));
      await p.mouse.click(sx, sy);
      assert.equal(await p.evaluate(() => scene.g.k.count(1)), 1, `${at}: the stock tap drew one`);
      await idle(p);
      await settle(p, `${at}: after the draw`);
      // Tap a card that goes: it goes.
      let mv = await findMove(p, false);
      assert.ok(mv, `${at}: a card that goes`);
      await idle(p);
      await settle(p, `${at}: before the tap`);
      let [x, y] = await pt(p, await p.evaluate((c) => scene.cardScreen(c), mv[0]));
      await p.mouse.click(x, y);
      assert.equal(await p.evaluate((c) => scene.g.k.pile[c], mv[0]), mv[1], `${at}: the tap sent it`);
      await idle(p);
      await settle(p, `${at}: after the tap`);
      // Drag one onto its column.
      mv = await findMove(p, true);
      assert.ok(mv, `${at}: a card for a column`);
      await idle(p);
      await settle(p, `${at}: before the drag`);
      [x, y] = await pt(p, await p.evaluate((c) => scene.cardScreen(c), mv[0]));
      const [tx, ty] = await pt(p, await p.evaluate((q) => scene.pileScreen(q), mv[1]));
      await p.mouse.move(x, y);
      await p.mouse.down();
      for (let i = 1; i <= 8; i++) await p.mouse.move(x + ((tx - x) * i) / 8, y + ((ty - y) * i) / 8 + 8);
      await p.mouse.up();
      assert.equal(await p.evaluate((c) => scene.g.k.pile[c], mv[0]), mv[1], `${at}: the drag moved it`);
      await idle(p);
      const moves = await p.evaluate(() => scene.g.moves);
      await p.locator('[data-fizlet-slot] .gk:text-is("UNDO")').click();
      assert.equal(await p.evaluate(() => scene.g.moves), moves - 1, `${at}: UNDO took one back`);
    } else {
      await p.focus("[data-fizlet-slot] .ct-play");
      await p.keyboard.press(" ");
      assert.equal(await p.evaluate(() => scene.g.k.count(1)), 1, `${at}: Space drew one`);
      await p.keyboard.press("ArrowDown");
      assert.equal(await p.evaluate(() => scene.state.cursor), 6, `${at}: the cursor on the first column`);
      const mv = await findMove(p, false);
      assert.ok(mv, `${at}: a card that goes`);
      await idle(p);
      const from = await p.evaluate((c) => scene.g.k.pile[c], mv[0]), moves = await p.evaluate(() => scene.g.moves);
      // Walk the cursor to the pile the card is on; Enter plays it.
      if (from === 1) {
        await p.keyboard.press("ArrowUp");
        for (let i = 0; i < 7; i++) await p.keyboard.press("ArrowLeft");
        await p.keyboard.press("ArrowRight");
      } else {
        for (let i = 0; i < 7; i++) await p.keyboard.press("ArrowLeft");
        for (let i = 6; i < from; i++) await p.keyboard.press("ArrowRight");
      }
      assert.equal(await p.evaluate(() => scene.state.cursor), from, `${at}: the cursor on pile ${from}`);
      await p.keyboard.press("Enter");
      assert.ok(await p.evaluate((m) => scene.g.moves > m, moves), `${at}: Enter played it`);
      await idle(p);
      const now = await p.evaluate(() => scene.g.moves);
      await p.keyboard.press("u");
      assert.equal(await p.evaluate(() => scene.g.moves), now - 1, `${at}: U took one back`);
    }
    await settle(p, `${at}: play`);
    assert.ok(await p.evaluate(() => (window.audio || 0) >= 1), `${at}: sound after the gesture`);
    // One step from solved: every card home but the four kings, face up on the columns.
    await p.evaluate(() => {
      const k = scene.g.k;
      k.reset();
      for (let s = 0; s < 4; s++) for (let r = 0; r < 12; r++) k.move(s * 13 + r, 2 + s, -1, 1);
      for (let s = 0; s < 4; s++) k.move(s * 13 + 12, 6 + s, -1, 1);
      scene.g.hn = 0;
      scene.refresh();
    });
    await p.waitForFunction(() => scene.state.card, null, { timeout: 15000 });
    assert.deepEqual(await p.evaluate(() => [scene.state.won, document.querySelector(".ct-card b").textContent]), [true, "Solved!"], `${at}: it plays itself out; solved`);
    await settle(p, `${at}: the finish`);
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
  console.log("solitaire: mounts, deals and settles (no audio before a gesture); wide: the mouse taps the stock, taps and drags cards, UNDO; tall: Space, arrows, Enter, U; the finish plays itself out and the solved card shows; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
