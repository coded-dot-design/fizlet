// fzlt/view-canvas in Chromium at 2× and 1×: the backing store is the CSS size × the screen's
// density, a dirty box repaints only its own pixels (the rest of the canvas keeps what it had), a
// resize redraws everything at the new size, the engine settles to 0 frames with only a canvas on
// it, and Recall gives the page back byte for byte. Zero allocation: tests/view-canvas.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { viewCanvas } from "./src/view-canvas.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root" style="width: 200px; height: 100px; color: red">text</div><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: dpr });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const root = document.getElementById("root"), before = document.body.innerHTML;
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const e = fz.createEngine({ root, settle: 0.25 });
      let color = "rgb(255, 0, 0)", draws = 0;
      const v = fz.viewCanvas(e, root, { draw(ctx) { draws++; ctx.fillStyle = color; ctx.fillRect(0, 0, 1e4, 1e4); } });
      e.start();
      for (let i = 0; i < 5; i++) await frame();
      const px = (x, y) => Array.from(v.ctx.getImageData(x * v.dpr, y * v.dpr, 1, 1).data.slice(0, 3)).join(",");
      const size = [v.canvas.width, v.canvas.height, v.width, v.height, v.dpr, getComputedStyle(root).position];
      color = "rgb(0, 0, 255)";
      v.dirty([50, 25, 20.5, 10]);
      await frame();
      const after = { inside: px(60, 30), edge: px(70, 30), outside: px(10, 10), right: px(71, 30) };
      for (let i = 0; i < 40 && !e.paused.includes("settled"); i++) await frame();
      const f0 = e.stats().frames;
      for (let i = 0; i < 30; i++) await frame();
      const framesSettled = e.stats().frames - f0, drawsSettled = draws;
      root.style.width = "300px";
      color = "rgb(0, 255, 0)";
      for (let i = 0; i < 4; i++) await frame();
      const resized = [v.canvas.width, v.width, px(250, 50), px(10, 10)];
      root.style.width = "200px"; // the test's own edit back (the ledger never restores over a host edit)
      e.destroy();
      return { size, after, framesSettled, drawsSettled, resized, recall: document.body.innerHTML === before };
    });
    assert.deepEqual(r.size, [200 * dpr, 100 * dpr, 200, 100, dpr, "relative"], `backing store at ${dpr}×`);
    assert.deepEqual(r.after, { inside: "0,0,255", edge: "0,0,255", outside: "255,0,0", right: "255,0,0" }, `a dirty box repaints only its own pixels at ${dpr}×`);
    assert.equal(r.framesSettled, 0, "settled: 0 frames");
    assert.equal(r.drawsSettled, 2, "two draws: the first frame and the dirty box");
    assert.deepEqual(r.resized, [300 * dpr, 300, "0,255,0", "0,255,0"], "a resize redraws everything");
    assert.ok(r.recall, "Recall restores the page byte for byte");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("view-canvas (Chromium): 2× and 1× backing store, dirty boxes repaint only their pixels, resize, settled at 0 frames, Recall ✓");
} finally {
  await browser.close();
}
