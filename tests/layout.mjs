// fzlt/layout in Chromium, drawn with fzlt/view-canvas: a 30-node graph lays out on the real
// frame clock, comes to rest, and then the page asks for 0 frames; a drag (pin) moves it and it
// settles again; reduced motion lands on the rest at once (one step); Recall gives the
// page back byte for byte. Algorithm and zero allocation: tests/layout.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { layout } from "./src/layout.ts"; export { viewCanvas } from "./src/view-canvas.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root" style="width: 480px; height: 320px"></div><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  for (const reduced of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 600, height: 400 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const root = document.getElementById("root"), before = document.body.innerHTML;
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const e = fz.createEngine({ root, settle: 0.5 });
      const lay = fz.layout(e, { cap: 32, cx: 240, cy: 160 });
      for (let i = 0; i < 30; i++) lay.add();
      for (let i = 0; i < 24; i++) lay.link(i, (i + 1) % 24);
      for (let i = 0; i < 24; i += 4) lay.link(i, 24);
      for (let i = 24; i < 29; i++) lay.link(i, i + 1);
      let draws = 0;
      const v = fz.viewCanvas(e, root, { label: "graph", draw(ctx) {
        draws++;
        ctx.fillStyle = "#000";
        for (let i = 0; i < lay.size; i++) ctx.fillRect(lay.x[i] - 3, lay.y[i] - 3, 6, 6);
      } });
      // Steps the layout took to rest, counted by a system that runs after it in each step (not
      // e.steps: a slow first frame can run a second, idle step in the same frame).
      let restSteps = 0, rested = false;
      e.add({ step() { if (!rested) restSteps++, (rested = lay.resting); }, render() { if (!lay.resting) v.dirty(); } });
      e.start();
      const t0 = performance.now();
      let layoutFrames = 0;
      for (let i = 0; i < 900 && !lay.resting; i++) await frame(), layoutFrames++;
      const restMs = performance.now() - t0;
      for (let i = 0; i < 60 && !e.paused.includes("settled"); i++) await frame();
      const f0 = e.stats().frames;
      for (let i = 0; i < 60; i++) await frame();
      const framesSettled = e.stats().frames - f0;
      const inside = Array.from({ length: lay.size }, (_, i) => lay.x[i] > 0 && lay.x[i] < 480 && lay.y[i] > 0 && lay.y[i] < 320).every(Boolean);
      // A drag: pin the hub somewhere else, wait for rest and settle again.
      lay.pin(24, 120, 80);
      const awake = e.running;
      for (let i = 0; i < 900 && !lay.resting; i++) await frame();
      for (let i = 0; i < 60 && !e.paused.includes("settled"); i++) await frame();
      const f1 = e.stats().frames;
      for (let i = 0; i < 30; i++) await frame();
      const pinned = [lay.x[24], lay.y[24]], framesSettled2 = e.stats().frames - f1;
      e.destroy();
      return { layoutFrames, restSteps, restMs, framesSettled, inside, awake, pinned, framesSettled2, draws, recall: document.body.innerHTML === before };
    });
    if (reduced) assert.equal(r.restSteps, 1, "reduced motion: at rest after one step");
    else assert.ok(r.restSteps > 30 && r.restSteps <= 300, `animated: ${r.restSteps} steps to rest`);
    assert.equal(r.framesSettled, 0, "at rest: 0 frames");
    assert.ok(r.inside, "every node on the canvas");
    assert.ok(r.awake, "a pin wakes the engine");
    assert.deepEqual(r.pinned, [120, 80]);
    assert.equal(r.framesSettled2, 0, "settled again after the drag: 0 frames");
    assert.ok(r.recall, "Recall restores the page byte for byte");
    assert.deepEqual(errs, []);
    console.log(`layout (Chromium${reduced ? ", reduced motion" : ""}): 30 nodes at rest after ${r.restSteps} step${r.restSteps === 1 ? "" : "s"}, ${r.layoutFrames} frames (${Math.round(r.restMs)} ms), ${r.draws} draws, then 0 frames; drag, settle, Recall ✓`);
    await p.close();
  }
} finally {
  await browser.close();
}
