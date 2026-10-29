// fizlet/camera in Chromium: the page is the camera. A zoom keeps its point fixed on screen, eases
// and settles (the engine sleeps), the page never scrolls sideways (contain clips the parent), Recall
// mid-move gives the page back byte for byte, and with reduced motion every move jumps.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/kernel/index.ts"; export { camera, zoomAt, flyTo } from "./src/camera.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div id="frame"><main id="page" style="position:relative;width:100%;height:600px;background:#0b0918;display:flow-root">
<h1 style="color:#ff2e88">Host page</h1><i id="dot" style="position:absolute;left:300px;top:200px;width:2px;height:2px"></i>
</main></div><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const before = document.body.innerHTML;
      const frame = (n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      const dot = () => document.getElementById("dot").getBoundingClientRect();
      const e = fz.createEngine({ settle: 0.3 }), cam = fz.camera(e, document.getElementById("page"));
      e.start();
      const d0 = dot();
      fz.zoomAt(cam, 300, 200, 2.5);
      await frame(6);
      const mid = { zoom: cam.zoom, moving: cam.moving, d: dot() };
      await new Promise((ok) => setTimeout(ok, 2000));
      const end = { zoom: cam.zoom, settled: e.paused.includes("settled"), d: dot(), clip: document.getElementById("frame").style.overflow,
        scrollW: document.scrollingElement.scrollWidth, innerW: innerWidth };
      fz.flyTo(cam, 850, 50, 3);
      await frame(4);
      e.destroy(); // Recall mid-move
      return { d0, mid, end, same: document.body.innerHTML === before, scrollAfter: document.scrollingElement.scrollWidth };
    });
    assert.ok(r.mid.moving && r.mid.zoom > 1 && r.mid.zoom < 2.5, `eases (${r.mid.zoom})`);
    for (const d of [r.mid.d, r.end.d]) assert.ok(Math.abs(d.x - r.d0.x) < 0.6 && Math.abs(d.y - r.d0.y) < 0.6, `the zoom point stays put (${d.x}, ${d.y} vs ${r.d0.x}, ${r.d0.y})`);
    assert.equal(r.end.zoom, 2.5);
    assert.ok(r.end.settled, "settles: the engine sleeps");
    assert.equal(r.end.clip, "clip", "contain clips the parent (it had overflow: visible)");
    assert.ok(r.end.scrollW <= r.end.innerW, `the page never scrolls sideways (${r.end.scrollW} > ${r.end.innerW})`);
    assert.equal(r.same, true, "Recall mid-move restores the page byte for byte");
    assert.deepEqual(errs, []);
    await p.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const e = fz.createEngine(), cam = fz.camera(e, document.getElementById("page"));
      e.start();
      fz.zoomAt(cam, 300, 200, 2);
      // A few frames: the first advances no time; then one fixed step lands the whole move.
      await new Promise((ok) => setTimeout(ok, 120));
      const out = { zoom: cam.zoom, moving: cam.moving, steps: e.steps < 12 };
      e.destroy();
      return out;
    });
    assert.deepEqual(r, { zoom: 2, moving: false, steps: true }, "reduced motion: the move jumps, no easing");
    await ctx.close();
  }
  console.log("camera: eases, zoom point fixed, settles, contained (no sideways scroll), Recall exact mid-move, reduced motion jumps — ok");
} finally {
  await browser.close();
}
