// Gravy Boat (site/gallery/pieces/gravy-boat.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet, as the gallery has them), mounted through @fzlt/core/slot: it
// mounts (the poster steps aside), shows its first frame and settles to no frames with no audio before
// a gesture, wide (720) and tall (the phone shape, 358 wide). The keyboard plays it (Space held pours,
// let go stops, M mutes); a press held on the stage pours, a release stops. The table moves while
// it plays and waits (settles) after two plates with no pour. Recall gives the page back byte for
// byte; reduced motion keeps the still poster. The game itself: tests/gravy-boat.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/gravy-boat.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/gravy-boat.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#gravy-boat" role="img" aria-label="Gravy Boat" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      const fig = document.querySelector("figure").getBoundingClientRect(), st = document.querySelector("[data-fizlet-slot]").getBoundingClientRect(), c = document.querySelector("[data-fizlet-slot] canvas").getBoundingClientRect();
      return { canvas: document.querySelectorAll("[data-fizlet-slot] canvas[aria-hidden='true']").length, poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display, fills: Math.abs(c.width - st.width) < 2 && Math.abs(c.height - st.height) < 2 && st.width > fig.width - 8, wide: fig.width / fig.height > 1.4 };
    });
    assert.deepEqual(m, { canvas: 1, poster: "none", fills: true, wide: !phone }, `${at}: mounts, the poster steps aside, the canvas fills the stage`);
    await settle(p, `${at}: first frame`);
    assert.equal(await frames(p), 0, `${at}: settled, no frames`);
    assert.equal(await p.evaluate(() => window.audio || 0), 0, `${at}: no audio before a gesture`);
    if (!phone) {
      // The keyboard: Space held pours (the stream thickens), let go stops, M mutes.
      await p.focus("[data-fizlet-slot] button");
      await p.keyboard.down("Space");
      await p.waitForFunction(() => scene.state.mode === 1 && scene.run.S[5] > 1, null, { timeout: 3000 });
      await p.keyboard.up("Space");
      await p.waitForFunction(() => scene.run.S[5] === 0, null, { timeout: 3000 });
      await p.keyboard.press("m");
    } else {
      // A press held on the stage pours; a release stops.
      const box = await p.locator("[data-fizlet-slot] button").boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await p.waitForFunction(() => scene.state.mode === 1 && scene.run.S[5] > 1, null, { timeout: 3000 });
      await p.mouse.up();
      await p.waitForFunction(() => scene.run.S[5] === 0, null, { timeout: 3000 });
    }
    // The gravy lands; the plates pass; with no more pouring the table waits and it settles.
    await p.waitForFunction(() => scene.run.LV.some((l) => l > 0) || scene.run.ns > 0, null, { timeout: 5000 });
    await p.waitForFunction(() => scene.state.mode === 3, null, { timeout: 20000 });
    await settle(p, `${at}: the table waits`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    // Recall after a round: the page comes back byte for byte.
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
  console.log("gravy-boat: mounts, first frame, settles (no audio before a gesture); wide: Space held pours, let go stops, M mutes; tall: a held press pours; the table waits and settles again; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
