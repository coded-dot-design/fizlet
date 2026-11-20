// @fzlt/core/backdrop in Chromium (the demo): a sunset drawn in code (sky bands, a sun, far and near hills
// from the art's edges) on a 1200 × 840 art, fitted to frames of three shapes at 2×. Fidelity: the
// pixels at known art points are the art's colours wherever the fit puts them; a frame wider or taller
// than the art shows the hills and the floor right to its corners (no gap); the pan slides the near
// hills more than the far ones; one paint per layer per size; the engine settles once the pan stops.
// Screenshots when BACKDROP_SHOTS names a folder. Fit, bleed, packing and allocation: tests/backdrop.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.BACKDROP_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export * from "./src/backdrop.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="cv" style="display:block;width:100vw;height:100vh"></canvas><script>${bundle}</script></body>`;

function setup() {
  const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  const ART = { w: 1200, h: 840, safe: [100, 120, 1100, 780] };
  const C = { sky: "#2d1a4f", mid: "#8c287a", glow: "#dd4487", sun: "#fdc947", far: "#382260", near: "#1d1238", floor: "#20163c" };
  const bd = fz.backdrop(ART, [
    { paint(c) { fz.band(c, ART, C.sky, -4000, 4200); fz.band(c, ART, C.mid, 200, 300); fz.band(c, ART, C.glow, 300, 450); c.fillStyle = C.sun; c.beginPath(); c.arc(820, 300, 150, 0, Math.PI * 2); c.fill(); } },
    { depth: 0.3, paint(c) { fz.fill(c, ART, C.far, [0, 380, 300, 300, 600, 400, 900, 320, 1199, 390, 1199, 520, 0, 520]); } },
    { depth: 1, paint(c) { fz.fill(c, ART, C.near, [0, 470, 400, 430, 800, 500, 1199, 450, 1199, 560, 0, 560]); fz.band(c, ART, C.floor, 560, 4840); } },
  ], { pan: 60 });
  const e = fz.createEngine({ settle: 0.25 });
  let pan = 0, panning = false, draws = 0;
  const size = () => { const dpr = devicePixelRatio, w = innerWidth, h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; return { w, h, dpr }; };
  let S = size();
  e.add({ step(_, dt) { if (panning) (pan = Math.min(60, pan + dt * 120)), e.busy(), pan >= 60 && (panning = false); }, render() { ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); bd.draw(ctx, S.w, S.h, S.dpr, pan); draws++; } });
  e.start();
  /** The colour at art point (x, y), wherever the fit puts it (a layer at depth dz panned by p). */
  const at = (x, y, dz = 0) => {
    const [s, dx, dy] = bd.fit, X = (x * s + dx + pan * dz) * S.dpr, Y = (y * s + dy) * S.dpr, d = ctx.getImageData(Math.round(X), Math.round(Y), 1, 1).data;
    return "#" + ((d[0] << 16) | (d[1] << 8) | d[2]).toString(16).padStart(6, "0");
  };
  const px = (X, Y) => { const d = ctx.getImageData(X, Y, 1, 1).data; return "#" + ((d[0] << 16) | (d[1] << 8) | d[2]).toString(16).padStart(6, "0"); };
  window.bd = { bd, C, at, px, resize: () => (S = size(), e.wake()), pan: () => ((panning = true), e.wake()), get paints() { return bd.stats.paints; }, get draws() { return draws; }, get paused() { return e.paused.join(); }, get S() { return S; } };
}

const browser = await chromium.launch(launchOptions());
try {
  for (const [w, h] of [[1200, 840], [1440, 600], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    await p.evaluate(setup);
    const frames = (n) => p.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    await frames(4);
    const r = await p.evaluate(() => {
      const { at, px, C, S } = window.bd, W = S.w * S.dpr - 1, H = S.h * S.dpr - 1;
      return { C, sun: at(820, 300), sky: at(100, 150), glow: at(1090, 340), far: at(620, 420, 0.3), near: at(400, 500, 1), floor: at(600, 700, 1), corners: [px(0, H), px(W, H)], paints: window.bd.paints };
    });
    const { C } = r;
    assert.deepEqual([r.sun, r.glow, r.far, r.near, r.floor], [C.sun, C.glow, C.far, C.near, C.floor], `${w}×${h}: the art's colours where the fit puts them`);
    assert.ok([C.sky, C.mid].includes(r.sky) || r.sky === C.sky, `${w}×${h}: sky ${r.sky}`);
    assert.deepEqual(r.corners, [C.floor, C.floor], `${w}×${h}: the floor runs to the bottom corners`);
    assert.equal(r.paints, 3, "one paint per layer");
    if (SHOTS) await p.screenshot({ path: join(SHOTS, `backdrop-${w}x${h}.png`) });
    // Pan: the near hills move the whole pan, the far ones 0.3 of it.
    await p.evaluate(() => window.bd.pan());
    await p.waitForFunction(() => window.bd.paused.includes("settled"), null, { timeout: 5000 });
    const q = await p.evaluate(() => { const { at, C } = window.bd; return { near: at(400, 500, 1), far: at(620, 420, 0.3), nearUnpanned: at(400, 500, 0) === C.near, paints: window.bd.paints }; });
    assert.equal(q.near, r.C.near, "the near hills, panned with depth 1");
    assert.equal(q.far, r.C.far, "the far hills, panned with depth 0.3");
    assert.equal(q.paints, 3, "panning repaints nothing");
    const n0 = await p.evaluate(() => window.bd.draws);
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.bd.draws), n0, "settled: 0 frames");
    if (SHOTS && w === 1440) await p.screenshot({ path: join(SHOTS, `backdrop-${w}x${h}-panned.png`) });
    assert.deepEqual(errs, [], "no page errors");
    await ctx.close();
  }
  console.log("backdrop: fitted at three shapes, the art's colours in place, edges filled, parallax, settled");
} finally {
  await browser.close();
}
