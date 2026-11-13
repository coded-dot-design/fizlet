// @fzlt/core/diorama in Chromium at 2× and 1×: a small scene drawn from the kernel's render phase
// fills the canvas's backing store at the screen's density (not blank: the background, shaded faces,
// a shadow), a real click picks the object under it (front-most, its tagged root), a click on the
// background picks nothing, and the engine settles to 0 frames with only a diorama on it. The
// projection, sort, picking maths and zero allocation per draw: tests/diorama.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="cv" style="display:block;width:400px;height:300px;margin:20px"></canvas><script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    const p = await browser.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor: dpr });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const cv = document.getElementById("cv"), frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      const d = fz.diorama(cv, { background: "#f0ebe3", shadowColor: "#000000" });
      Object.assign(d.cam, { yaw: -0.5, pitch: 0.7, dist: 16, tx: 0, ty: 0.5, tz: 0, fov: 0.62 });
      d.cluster("table", { fixed: 0 });
      d.add({ id: "table", size: [10, 0.4, 7], pos: [0, -0.4, 0], color: "#c69a6f", cluster: "table", pick: false });
      d.add({ id: "far", size: [3, 2.4, 1.2], on: "table", pos: [0, 0, -2], color: "#2f6fd6", shadow: 0.25 });
      const ship = d.add({ id: "ship", shape: "group", size: [1.6, 0, 1.6], on: "table", pos: [-0.2, 0, 1.6], shadow: 0.3, tag: { ship: 1 } });
      d.add({ id: "hull", size: [1.6, 1, 1.6], on: "ship", color: "#e04a3a" });
      d.add({ id: "cap", shape: "cyl", sides: 10, top: 0, size: [1, 0.8, 1], on: "hull", color: "#ffd23f" });
      const e = fz.createEngine({ settle: 0.25 });
      let draws = 0;
      e.add({ render: () => (d.draw(), draws++) });
      e.start();
      window.dio = d;
      window.eng = e;
      window.picks = [];
      cv.addEventListener("click", (ev) => {
        const ob = d.pick(ev.offsetX, ev.offsetY);
        window.picks.push([ob ? ob.id : null, d.root(ob)?.id ?? null]);
      });
      for (let i = 0; i < 5; i++) await frame();
      const px = (x, y) => Array.from(d.ctx.getImageData(Math.round(x * d.dpr), Math.round(y * d.dpr), 1, 1).data.slice(0, 3));
      const out = new Float64Array(3), at = (x, y, z) => (d.project(x, y, z, out), [out[0], out[1]]);
      // Distinct colours over a coarse grid: a blank or one-colour canvas has one.
      const img = d.ctx.getImageData(0, 0, cv.width, cv.height).data, colours = new Set();
      for (let i = 0; i < img.length; i += 4 * 97) colours.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2]);
      const near = at(-0.2, 0.3, 2.39), farTop = at(0.9, 2.4, -2), corner = [4, 4];
      return {
        size: [cv.width, cv.height, d.width, d.height, d.dpr], colours: colours.size, draws, ship: ship.id,
        corner: px(...corner), near: px(...near), farTop: px(...farTop), near0: near, far0: farTop, stats: { ...d.stats },
      };
    });
    assert.deepEqual(r.size, [400 * dpr, 300 * dpr, 400, 300, dpr], `backing store at ${dpr}×`);
    assert.ok(r.colours >= 6, `not blank: ${r.colours} colours`);
    assert.deepEqual(r.corner, [0xf0, 0xeb, 0xe3], "the background where nothing is");
    assert.ok(r.near[0] > 100 && r.near[0] > 2 * r.near[1] && r.near[0] > 2 * r.near[2], `the red hull is red on its front face: ${r.near}`);
    assert.ok(r.farTop[2] > 120 && r.farTop[2] > 1.5 * r.farTop[0], `the blue block's top is blue: ${r.farTop}`);
    assert.ok(r.stats.faces > 10 && r.stats.shadows === 2, `faces and shadows drawn: ${JSON.stringify(r.stats)}`);
    // Real clicks: the page maps them to canvas CSS px and asks pick() (and root()).
    const box = await p.locator("#cv").boundingBox();
    await p.mouse.click(box.x + r.near0[0], box.y + r.near0[1]);
    await p.mouse.click(box.x + r.far0[0], box.y + r.far0[1]);
    await p.mouse.click(box.x + 4, box.y + 4);
    await p.waitForFunction(() => window.picks.length === 3);
    assert.deepEqual(await p.evaluate(() => window.picks), [["hull", "ship"], ["far", "table"], [null, null]], "a click picks the front-most object (root: its tagged ancestor, or the top of its chain), the background nothing");
    // Nothing keeps the engine awake: it settles, then runs 0 frames.
    const settled = await p.evaluate(async () => {
      const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      for (let i = 0; i < 60 && !window.eng.paused.includes("settled"); i++) await frame();
      const f0 = window.eng.stats().frames;
      for (let i = 0; i < 20; i++) await frame();
      const frames = window.eng.stats().frames - f0;
      window.eng.destroy();
      return frames;
    });
    assert.equal(settled, 0, "settled: 0 frames");
    assert.deepEqual(errs, []);
    await p.close();
  }
  console.log("diorama (Chromium): 2× and 1× backing store, a shaded scene with shadows, clicks pick the front-most object ✓");
} finally {
  await browser.close();
}
