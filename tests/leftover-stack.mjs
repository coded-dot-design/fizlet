// Leftover Stack (site/gallery/pieces/fridge/leftover-stack.ts) in Chromium, on its own stage in a
// gallery figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), the diorama fills the stage and draws, the
// start card is up, and it settles to no frames with no audio before a gesture; every key is 44 px
// or more, wide (720) and tall (the phone shape, 358 wide). The keyboard plays it (Space opens the
// fridge, ← → ↑ ↓ aim, R turns, Space drops, M mutes); touch plays it (OPEN THE FRIDGE, then a press
// and release on the fridge drops the dish there). Tall, where the counter is out of frame, a NEXT
// sticker in the stage (over the keys, clear of the head) shows the next dish drawn; wide, the counter
// shows it and the sticker stays hidden. It settles again between dishes. Recall mid-night
// gives the page back byte for byte; reduced motion keeps the still poster. The fridge itself:
// tests/leftover-stack.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/fridge/leftover-stack.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/leftover-stack.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#leftover-stack" role="img" aria-label="Leftover Stack" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), px = cvs.getContext("2d").getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] > canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        wide: fig.width / fig.height > 1.4,
        keys: keys.every(Boolean) && keys.length,
        card: scene.state.card,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, wide: !phone, keys: 3, card: true }, `${at}: mounts, the poster steps aside, the diorama fills and draws, the start card, keys ≥ 44 px`);
    await settle(p, `${at}: at the start line`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      await p.focus("[data-fizlet-slot] .ls-play");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.mode === 1 && !scene.state.card, null, { timeout: 3000 });
      const k0 = await p.evaluate(() => [scene.state.shelf, scene.state.col, scene.f.S[4]]);
      await p.keyboard.press("ArrowUp");
      await p.keyboard.press("ArrowRight");
      assert.deepEqual(await p.evaluate(() => [scene.state.shelf, scene.state.col]), [k0[0] + 1, k0[1] + 1], `${at}: ↑ a shelf, → a column`);
      // R turns a dish that isn't square (w and d swap); a square one stays as it is.
      const turns = await p.evaluate(() => scene.f.w(scene.f.S[3], 0) !== scene.f.d(scene.f.S[3], 0));
      await p.keyboard.press("r");
      assert.equal(await p.evaluate(() => scene.f.S[4]), turns ? 1 - k0[2] : k0[2], `${at}: R turns it`);
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.idx === 1, null, { timeout: 3000 });
      await p.keyboard.press("ArrowDown");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.idx === 2, null, { timeout: 3000 });
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector("[data-fizlet-slot] .gk").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
      // The sticker repaints on the next frame after the score changes: wait on that state, not the same instant.
      await p.waitForFunction(() => document.querySelector(".ls-chip span").textContent === "" + scene.state.score, null, { timeout: 3000 }).catch(() => {});
      assert.equal(await p.evaluate(() => document.querySelector(".ls-chip span").textContent), "" + (await p.evaluate(() => scene.state.score)), `${at}: the score sticker counts`);
    } else {
      await p.tap(".ls-go");
      await p.waitForFunction(() => scene.state.mode === 1 && !scene.state.card, null, { timeout: 3000 });
      const box = await p.locator("[data-fizlet-slot] .ls-play").boundingBox();
      await p.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.42, { steps: 3 });
      await p.mouse.up();
      await p.waitForFunction(() => scene.state.idx === 1, null, { timeout: 3000 });
    }
    // The dish lands, the next one comes off the counter; it settles again.
    await settle(p, `${at}: after a drop`);
    const nx = await p.evaluate(() => {
      const el = document.querySelector("[data-fizlet-slot] .ls-next"), st = document.querySelector("[data-fizlet-slot]").getBoundingClientRect();
      if (el.hidden || getComputedStyle(el).display === "none") return { shown: false };
      const r = el.getBoundingClientRect(), hd = document.querySelector(".ls-head").getBoundingClientRect(), keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].map((k) => k.getBoundingClientRect());
      const c = el.querySelector("canvas"), px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 3; i < px.length; i += 4) ink += px[i] > 0;
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return { shown: true, inside: r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom, clear: !hit(r, hd) && !keys.some((k) => hit(r, k)), drawn: ink > 200, named: el.getAttribute("aria-label").startsWith("Next: ") };
    });
    assert.deepEqual(nx, phone ? { shown: true, inside: true, clear: true, drawn: true, named: true } : { shown: false }, `${at}: the NEXT dish is in view (tall: the inset; wide: the counter)`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${at}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${at}: no page errors`);
    await p.close();
  }
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
  console.log("leftover-stack: mounts, the diorama draws, the start card, settles (no audio before a gesture); wide: Space opens, arrows aim, R turns, Space drops, M mutes; tall: OPEN and a press drops; settles between dishes; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
