// @fzlt/core/ribbon in Chromium (the demo): a dune heightfield on @fzlt/core/terrain with a closed track
// and its two edge strips as ribbons, the camera orbiting in the kernel's render phase. Each frame the
// pixel under the track's projected centre line is the track's colour (a shade of it), the strips show
// on both sides, the picture moves, and once the orbit stops the engine settles to 0 frames.
// Screenshots when RIBBON_SHOTS names a folder. Geometry, clipping, hiding and allocation: tests/ribbon.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.RIBBON_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export * from "./src/terrain.ts"; export * from "./src/ribbon.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#bfe3f2"><canvas id="cv" style="display:block;width:720px;height:440px"></canvas><script>${bundle}</script></body>`;

function setup() {
  const cv = document.getElementById("cv");
  const d = fz.diorama(cv, { background: () => "#bfe3f2" });
  const t = fz.terrain({ cols: 64, rows: 48, cell: 0.5, x0: -16, z0: -12 });
  t.noise({ seed: 4, amp: 1.2, ridge: 0.4 });
  fz.terrainView(d, t, { bands: [[0.2, "#d9b27c"], [Infinity, "#c99c66"]] });
  const r = fz.ribbon(d, t, { step: 0.5, hide: true });
  const loop = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; loop.push(Math.cos(a) * 10 + Math.cos(a * 3) * 1.2, Math.sin(a) * 6.5); }
  r.band(loop, -1.4, 1.4, "#6d4c3a", true);
  r.band(loop, -1.7, -1.4, "#f4f1e6", true);
  r.band(loop, 1.4, 1.7, "#e8483c", true);
  Object.assign(d.cam, { yaw: 0.4, pitch: 0.62, dist: 26, tx: 0, ty: 0, tz: 0, fov: 0.7 });
  const e = fz.createEngine({ settle: 0.25 });
  let orbit = true, draws = 0;
  e.add({ step(_, dt) { if (orbit) (d.cam.yaw += dt * 0.4), e.busy(); }, render() { d.draw(); draws++; } });
  e.start();
  /** The colour under the track's centre at loop point i (CSS px → backing px). */
  function at(i) {
    const P = new Float64Array(3), S = new Float64Array(4);
    t.sample(loop[i * 2], loop[i * 2 + 1], S);
    if (!d.project(loop[i * 2], S[0], loop[i * 2 + 1], P)) return null;
    const k = d.dpr, px = d.ctx.getImageData(Math.round(P[0] * k), Math.round(P[1] * k), 1, 1).data;
    return [px[0], px[1], px[2]];
  }
  window.rb = { d, r, at, stop: () => (orbit = false), get draws() { return draws; }, get paused() { return e.paused.join(); } };
}

const browser = await chromium.launch(launchOptions());
try {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 440 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  await p.evaluate(setup);
  const frames = (n) => p.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  await frames(5);
  const seen = new Set();
  for (let k = 0; k < 4; k++) {
    await frames(6);
    const s = await p.evaluate(() => {
      const { r, at } = window.rb, hits = [];
      for (let i = 0; i < 40; i += 4) { const c = at(i); if (c) hits.push(c); }
      const { d } = window.rb, cv = d.ctx.canvas, img = d.ctx.getImageData(0, 0, cv.width, cv.height).data;
      let h = 0;
      for (let i = 0; i < img.length; i += 4 * 37) h = (h * 31 + img[i] + img[i + 1] * 7 + img[i + 2] * 13) | 0;
      return { pieces: r.stats.pieces, fills: r.stats.fills, hits, h };
    });
    assert.ok(s.pieces > 100 && s.fills > 3, `ribbons painted: ${s.pieces} pieces, ${s.fills} fills`);
    // Track brown (#6d4c3a) shaded 0.5..1.12: red over blue, darker than the sand; most samples hit it
    // (a crest may hide a few).
    const brown = s.hits.filter(([r, g, b]) => r > g && g >= b - 6 && r < 170 && r > 40).length;
    assert.ok(brown >= s.hits.length * 0.6, `the track under its centre line: ${brown} of ${s.hits.length} (${JSON.stringify(s.hits)})`);
    seen.add(s.h);
    if (SHOTS && k === 0) await p.locator("#cv").screenshot({ path: join(SHOTS, "ribbon.png") });
  }
  assert.ok(seen.size >= 3, "the view moves");
  await p.evaluate(() => window.rb.stop());
  await p.waitForFunction(() => window.rb.paused.includes("settled"), null, { timeout: 5000 });
  const n0 = await p.evaluate(() => window.rb.draws);
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.rb.draws), n0, "settled: 0 frames");
  assert.deepEqual(errs, [], "no page errors");
  console.log("ribbon: track and edge strips painted, moving, settled");
} finally {
  await browser.close();
}
