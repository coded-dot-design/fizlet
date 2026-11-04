// Two-Minute Sesh (site/gallery/pieces/skate/two-minute-sesh.ts) in Chromium, on its own stage in a
// gallery figure (Board UI kit and the site's sheet, as the gallery has them), mounted through
// @fzlt/core/slot: it mounts (the poster steps aside), plays its attract run and settles to no frames
// with no audio before a gesture; wide (720) the art fills the stage and the pad stays off on a mouse;
// tall (the phone shape, 358 wide) the pad sits under the art with every key 44 px or more. The
// keyboard plays it (Space starts the run, → pushes, Space ollies, J flips in the air, M mutes) and
// so does the pad (OLLIE starts it, → pushes); the HUD stickers follow (clock, score). Recall mid-run
// gives the page back byte for byte; reduced motion keeps the still poster. The run itself:
// tests/two-minute-sesh.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/skate/two-minute-sesh.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/two-minute-sesh.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#two-minute-sesh" role="img" aria-label="Two-Minute Sesh" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      // Wide: the art is the 16:9 stage. Tall: full width, taller than 16:9 (the view follows the rider).
      const shownArt = (a, f) => Math.abs(a.width - f.width) < 6 && (f.width / f.height > 1.4 ? Math.abs(a.width / a.height - 16 / 9) < 0.03 : a.height / a.width > 0.62);
      const pad = document.querySelector(".ss-pad"), shown = !!pad.offsetParent;
      const keys = [document.querySelector(".ss-mute"), ...(shown ? pad.querySelectorAll("button") : [])].map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height) >= 44; });
      return {
        canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length,
        poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display,
        art: shownArt(art, fig), wide: fig.width / fig.height > 1.4,
        pad: shown, keys: keys.every(Boolean) && keys.length,
        artAbovePad: !shown || art.bottom <= pad.getBoundingClientRect().top + 1,
      };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", art: true, wide: !phone, pad: phone, keys: phone ? 6 : 1, artAbovePad: true }, `${at}: mounts, the poster steps aside, the art fills its frame, the pad only where it belongs, keys ≥ 44 px`);
    // The attract run plays, then it settles: no frames, no audio, the page as it was.
    await settle(p, `${at}: after the attract run`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The keyboard: focus the play key; Space starts the run, → pushes, Space ollies, J flips.
      await p.focus("[data-fizlet-slot] .ss-play");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 3000 });
      const x0 = await p.evaluate(() => scene.state.x);
      await p.keyboard.down("ArrowRight");
      await p.waitForFunction((x0) => scene.state.x > x0 + 8, x0, { timeout: 3000 });
      await p.keyboard.up("ArrowRight");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.st === 1, null, { timeout: 3000 });
      await p.keyboard.press("j");
      await p.waitForFunction(() => scene.run.S[10] > 0 || scene.run.cb.active, null, { timeout: 3000 });
      await p.keyboard.press("m");
      assert.equal(await p.evaluate(() => document.querySelector(".ss-mute").getAttribute("aria-pressed")), "false", `${at}: M mutes`);
    } else {
      // Touch: OLLIE on the pad starts the run, → pushes.
      await p.click(".ss-pad button[aria-label^='Ollie']");
      await p.waitForFunction(() => scene.state.mode === 2, null, { timeout: 3000 });
      const x0 = await p.evaluate(() => scene.state.x);
      const box = await p.locator(".ss-pad [data-d='3']").boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await p.waitForFunction((x0) => scene.state.x > x0 + 8, x0, { timeout: 3000 });
      await p.mouse.up();
    }
    // The HUD stickers follow the run: the clock counts down.
    await p.waitForFunction(() => document.querySelector(".ss-clock").textContent !== "0:45", null, { timeout: 3000 });
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
  console.log("two-minute-sesh: mounts, attract run, settles (no audio before a gesture); wide: keyboard plays (Space, →, J, M), no pad on a mouse; tall: pad under the art, keys ≥ 44 px, OLLIE and → play; HUD follows; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
