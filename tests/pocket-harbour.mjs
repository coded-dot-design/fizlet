// Pocket Harbour (site/gallery/pieces/harbour/pocket-harbour.ts) in Chromium, on its own stage in a
// gallery figure (Board UI kit and the site's sheet), mounted through @fzlt/core/slot: it mounts
// (the poster steps aside), the diorama fills the stage and draws, and it settles to no frames with
// no audio before a gesture; every key is 44 px or more, wide (720) and tall (the phone shape, 358).
// Wide: a click on the boat casts it off and the scene settles again once it is back; the arrows
// walk the cursor and Enter lights a lamp; N brings dusk (the lamps come on); five taps where the
// cat is find it five times and the card comes up. Tall: a tap sends the truck round; the NIGHT key
// flips day and night. Recall mid-play gives the page back byte for byte; reduced motion keeps the
// still poster. The town itself: tests/pocket-harbour.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/harbour/pocket-harbour.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/pocket-harbour.html", "utf8");
const page = (w, phone, theme) => `<!doctype html><html class="bui" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#pocket-harbour" role="img" aria-label="Pocket Harbour" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script>
<script>${bundle}</script></body></html>`;

const browser = await chromium.launch(launchOptions());
const frames = (p, n = 20) => p.evaluate(async (n) => {
  const a = scene.engine.stats().frames;
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
  return scene.engine.stats().frames - a;
}, n);
const settle = (p, what) => p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 30000 }).catch(() => { throw new Error(`${what}: never settled`); });
const at = async (p, name) => {
  const box = await p.locator("[data-fizlet-slot]").boundingBox(), [x, y] = await p.evaluate((n) => scene.screen(n), name);
  return [box.x + x, box.y + y];
};

try {
  for (const [w, phone, theme] of [[720, false, "light"], [358, true, "dark"]]) {
    const where = `@${w}${phone ? " tall" : ""} ${theme}`;
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 }, hasTouch: phone });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone, theme));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene && scene.engine.stats().frames > 2);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), fig = r("figure"), art = r("[data-fizlet-slot] canvas");
      const cvs = document.querySelector("[data-fizlet-slot] canvas"), px = cvs.getContext("2d").getImageData(cvs.width >> 1, cvs.height >> 1, 1, 1).data;
      const keys = [...document.querySelectorAll("[data-fizlet-slot] .gk")].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        fills: Math.abs(art.width - fig.width) < 6 && Math.abs(art.height - fig.height) < 6,
        drawn: px[3] === 255,
        keys: keys.every(Boolean) && keys.length,
        night: scene.state.night,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, drawn: true, keys: 2, night: theme === "dark" }, `${where}: mounts, fills, draws; keys ≥ 44 px; day or night from the site's theme`);
    await settle(p, `${where}: idle`);
    assert.equal(await frames(p), 0, `${where}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${where}: no audio before a gesture`);
    if (!phone) {
      await p.mouse.click(...(await at(p, "boat")));
      await p.waitForFunction(() => scene.town.T[0] >= 0, null, { timeout: 3000 }).catch(() => assert.fail(`${where}: a click casts the boat off`));
      await p.waitForFunction(() => scene.town.T[0] < 0, null, { timeout: 20000 });
      await settle(p, `${where}: after the boat`);
      // The keyboard: → to the first lamp, Enter lights it; N brings dusk.
      await p.focus("[data-fizlet-slot] .ph-play");
      await p.keyboard.press("ArrowRight");
      assert.equal(await p.evaluate(() => scene.state.cursor), "LAMP0", `${where}: the arrows walk the cursor`);
      await p.keyboard.press("Enter");
      assert.equal(await p.evaluate(() => scene.town.lamp[0]), 1, `${where}: Enter lights the lamp`);
      await p.keyboard.press("n");
      await p.waitForFunction(() => scene.state.night && scene.town.lamp.every((l) => l === 1), null, { timeout: 5000 }).catch(() => assert.fail(`${where}: N: dusk, every lamp on`));
      // The hunt: five taps where the cat is.
      for (let f = 1; f <= 5; f++) {
        await p.waitForFunction(() => scene.town.H[2] < 0, null, { timeout: 5000 });
        await p.mouse.click(...(await at(p, "cat")));
        await p.waitForFunction((f) => scene.state.found === f, f, { timeout: 3000 }).catch(async () => assert.fail(`${where}: found ${f} (spot ${await p.evaluate(() => scene.state.spot)})`));
      }
      await p.waitForFunction(() => scene.state.card, null, { timeout: 5000 });
      assert.match(await p.evaluate(() => document.querySelector(".ph-cat").textContent), /CAT 5\/5/, `${where}: the sticker counts`);
      await p.evaluate(() => document.querySelector(".ph-again").click());
      assert.deepEqual(await p.evaluate(() => [scene.state.found, scene.state.card]), [0, false], `${where}: HIDE AGAIN`);
    } else {
      await p.touchscreen.tap(...(await at(p, "truck")));
      await p.waitForFunction(() => scene.town.T[1] >= 0, null, { timeout: 3000 }).catch(() => assert.fail(`${where}: a tap sends the truck`));
      await p.tap(".ph-nk");
      // Day comes on the piece's next update after the tap: wait on that state, not the same instant.
      await p.waitForFunction(() => scene.state.night === false, null, { timeout: 3000 }).catch(() => {});
      assert.equal(await p.evaluate(() => scene.state.night), false, `${where}: the key brings day`);
    }
    const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
    assert.deepEqual(after, { same: true, running: false }, `${where}: Recall restores the page byte for byte`);
    assert.deepEqual(errs, [], `${where}: no page errors`);
    await p.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(720, false, "dark"));
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
  console.log("pocket-harbour: mounts and settles (no audio before a gesture); wide: a click casts the boat off and it settles once moored, arrows + Enter light a lamp, N brings dusk, five taps find the cat, HIDE AGAIN; tall: a tap sends the truck, the key flips day and night; keys ≥ 44 px; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
