// Boardwalk Run (site/gallery/pieces/skate/boardwalk-run.ts) in Chromium, on its own stage in a
// gallery figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), plays its attract run and settles to no frames
// with no audio before a gesture; wide (720) the art fills the stage and the pad stays off on a mouse;
// tall (the phone shape, 358 wide) the pad sits under the art with every key 44 px or more. The
// keyboard plays it (Space drops in, → pushes, ↓ ducks, Space ollies, J flips in the air, M mutes) and
// so does the pad (OLLIE drops in, ↓ ducks); the bottom bar follows (time). Recall mid-run gives the
// page back byte for byte; reduced motion keeps the still poster. The run itself:
// tests/boardwalk-run.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/skate/boardwalk-run.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/boardwalk-run.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#boardwalk-run" role="img" aria-label="Boardwalk Run" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
    const p = await browser.newPage({ viewport: { width: w + 40, height: 800 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(page(w, phone));
    await p.evaluate(() => {
      window.before = document.body.innerHTML;
      window.h = cv.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = cv.mount(stage, el, first)), { idle: 0 });
    });
    await p.waitForFunction(() => window.scene);
    const m = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), fig = r("figure"), art = r("[data-fizlet-slot] canvas");
      const pad = document.querySelector(".bw-pad"), shown = !!pad.offsetParent;
      const keys = [document.querySelector(".bw-mute"), ...(shown ? pad.querySelectorAll("button") : [])].map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        art: Math.abs(art.width - fig.width) < 6 && (fig.width / fig.height > 1.4 ? Math.abs(art.width / art.height - 16 / 9) < 0.03 : art.height / art.width > 0.62), wide: fig.width / fig.height > 1.4,
        pad: shown, keys: keys.every(Boolean) && keys.length,
        artAbovePad: !shown || art.bottom <= pad.getBoundingClientRect().top + 1,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", art: true, wide: !phone, pad: phone, keys: phone ? 7 : 1, artAbovePad: true }, `${at}: mounts, the poster steps aside, the art fills its frame (taller on a phone), the pad only where it belongs, keys ≥ 44 px`);
    // The attract run plays, then it settles: no frames, no audio, the page as it was.
    await settle(p, `${at}: after the attract run`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The keyboard: focus the play key; Space drops in, → pushes, ↓ ducks, Space ollies, J flips.
      await p.focus("[data-fizlet-slot] .bw-play");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 3000 });
      await p.keyboard.down("ArrowRight");
      await p.waitForFunction(() => scene.run.S[5] > 50, null, { timeout: 3000 });
      await p.keyboard.up("ArrowRight");
      await p.keyboard.down("ArrowDown");
      await p.waitForFunction(() => scene.run.S[15] === 1, null, { timeout: 3000 });
      await p.keyboard.up("ArrowDown");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.st === 1 && scene.run.S[3] > 5, null, { timeout: 3000 });
      await p.keyboard.press("j");
      await p.waitForFunction(() => scene.run.S[7] > 0 || scene.run.cb.active, null, { timeout: 3000 });
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".bw-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
    } else {
      // Touch: OLLIE on the pad drops in, ↓ ducks.
      await p.click(".bw-pad button[aria-label^='Ollie']");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 3000 });
      const box = await p.locator(".bw-pad [data-d='1']").boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.run.S[15] === 1, null, { timeout: 3000 });
      await p.mouse.up();
    }
    // The bottom bar follows the run: the clock counts up.
    await p.waitForFunction(() => document.querySelectorAll(".bw-bar span")[1].textContent !== "0:00.0", null, { timeout: 3000 });
    // Recall mid-run: the page comes back byte for byte.
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
  console.log("boardwalk-run: mounts, attract run, settles (no audio before a gesture); wide: keyboard plays (Space, →, ↓, J, M), no pad on a mouse; tall: pad under the art, keys ≥ 44 px, OLLIE and ↓ play; bottom bar follows; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
