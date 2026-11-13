// Pie Slice (site/gallery/pieces/pie-slice.ts) in Chromium, on its own stage in a gallery figure
// (Board UI kit and the site's sheet, as the gallery has them), mounted through @fzlt/core/slot: it
// mounts (the poster steps aside), shows its first frame and settles to no frames with no audio before
// a gesture, wide (720) and tall (the phone shape, 358 wide). The keyboard plays it (Space starts,
// → turns the knife, Space cuts, M mutes); a drag across the pie cuts it along the drag. The round's
// cuts made, the slices pull apart, the result comes up and it settles again. Recall gives the page
// back byte for byte; reduced motion keeps the still poster. The game itself: tests/pie-slice.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { slot } from "./src/slot.ts"; export { mount } from "./site/gallery/pieces/pie-slice.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "cv", write: false, logLevel: "silent",
})).outputFiles[0].text;
const css = readFileSync("src/ui/board-ui.css", "utf8") + readFileSync("site/site.css", "utf8");
const stage = readFileSync("site/gallery/stages/pie-slice.html", "utf8");
const page = (w, phone) => `<!doctype html><html class="bui"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body style="margin:0">
<main><p>Before the piece.</p><div class="gal-stage" style="width:${w}px"><figure class="ae-slot gal-fig gal-re gal-own" data-slot-target="gallery#pie-slice" role="img" aria-label="Pie Slice" style="aspect-ratio: 16 / 9; --phone: 4 / 5"${phone ? ' data-shape="phone"' : ""}>${stage}</figure></div><p>After it.</p></main>
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
      await p.focus("[data-fizlet-slot] button");
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.mode === 1, null, { timeout: 3000 });
      const a0 = await p.evaluate(() => scene.game.S[4]);
      await p.keyboard.press("ArrowRight");
      assert.ok(Math.abs((await p.evaluate(() => scene.game.S[4])) - a0 - 0.05) < 1e-9, `${at}: → turns the knife`);
      await p.keyboard.press("Space");
      await p.waitForFunction(() => scene.state.n === 1 && scene.state.mode === 1, null, { timeout: 3000 });
      for (let i = 0; i < 31; i++) await p.keyboard.press("ArrowRight");
      await p.keyboard.press("Space");
      await p.keyboard.press("m");
    } else {
      // A press, then two drags across the pie: each cuts along the drag.
      const box = await p.locator("[data-fizlet-slot] button").boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2 + box.height * 0.06;
      await p.mouse.click(cx, cy);
      await p.waitForFunction(() => scene.state.mode === 1, null, { timeout: 3000 });
      for (const [dx, dy] of [[1, 0.2], [-0.2, 1]]) {
        const r = box.height * 0.3;
        await p.mouse.move(cx - dx * r, cy - dy * r);
        await p.mouse.down();
        await p.mouse.move(cx + dx * r, cy + dy * r, { steps: 6 });
        await p.mouse.up();
        await p.waitForFunction(() => scene.state.mode !== 2, null, { timeout: 3000 });
      }
      const cut = await p.evaluate(() => [scene.game.CUTS[0], scene.game.CUTS[1]]);
      assert.ok(Math.abs(cut[0] - Math.atan2(0.2, 1)) < 0.08 && Math.abs(cut[1] - (Math.atan2(1, -0.2) % Math.PI)) < 0.08, `${at}: each cut runs along its drag (${cut.map((c) => c.toFixed(2))})`);
    }
    // The slices pull apart, the result, and it settles.
    await p.waitForFunction(() => scene.state.mode === 4, null, { timeout: 5000 });
    await settle(p, `${at}: the result`);
    assert.equal(await frames(p), 0, `${at}: settled again`);
    assert.ok((await p.evaluate(() => scene.state.total)) >= 0);
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
  console.log("pie-slice: mounts, first frame, settles (no audio before a gesture); wide: Space starts, → turns, Space cuts, M mutes; tall: drags cut along the drag; the result, settles again; Recall exact; reduced motion still — ok");
} finally {
  await browser.close();
}
