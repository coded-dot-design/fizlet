// @fzlt/core/water in Chromium: a small pool on a diorama (a table, rims, two depth bands and the
// surface, a boat with a wake going round) drawn from the kernel's render phase. The canvas is not
// blank and the pool shows its water colour; a splash throws white water over the surface (a column
// and drops where there were none), then everything ends and the engine settles to 0 frames. Under
// prefers-reduced-motion the surface is `still` by default: its clock stays at 0 and a splash is short.
// The maths, pools and zero allocation: tests/water.test.mjs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export { water } from "./src/water.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

/** The scene, in the page: `window.pool(opts)` builds it, starts the engine and returns helpers. */
const SCENE = `
window.pool = (o = {}) => {
  const cv = document.getElementById("cv"), d = fz.diorama(cv, { background: "#efe8de", shadowColor: "#3a2d3c" });
  Object.assign(d.cam, { yaw: -0.55, pitch: 0.78, dist: 17, tx: 0, ty: 0.6, tz: 0.2, fov: 0.62 });
  d.cluster("table", { fixed: 0 });
  d.add({ id: "table", size: [12, 0.6, 9], pos: [0, -0.6, 0], color: "#c69a6f", cluster: "table", pick: false });
  d.cluster("pool", { at: [0, 0.8, 0] });
  // Rims behind the water, low glass in front, then the water: two depth bands and the surface.
  d.add({ size: [8.8, 1.1, 0.4], pos: [0, 0, -3.2], color: "#f7f2e8", cluster: "pool", layer: 0.5, pick: false });
  d.add({ size: [0.4, 1.1, 6], pos: [4.2, 0, 0], color: "#f7f2e8", cluster: "pool", layer: 0.5, pick: false });
  const w = fz.water(d, { rect: [-4, -3, 4, 3], level: 0.8, cluster: "pool", bands: [{ h: 0.3, color: "#4f8fb5" }, { h: 0.25, color: "#6db0cf" }], depth: 0.25, idle: o.idle ?? 1.5, seed: 3 });
  d.add({ size: [8.8, 1.1, 0.4], pos: [0, 0, 3.2], color: "#e3f4fb", alpha: 0.32, cluster: "pool", layer: 6, pick: false });
  d.add({ size: [0.4, 1.1, 6], pos: [-4.2, 0, 0], color: "#e3f4fb", alpha: 0.32, cluster: "pool", layer: 6, pick: false });
  const boat = d.add({ id: "boat", shape: "group", size: [1.6, 0, 0.5], pos: [0, 0.72, 0], cluster: "pool", layer: 4 });
  d.add({ size: [1.6, 0.3, 0.5], on: "boat", color: "#f08e6f" });
  d.add({ size: [0.6, 0.25, 0.4], on: "boat", pos: [-0.2, 0, 0], color: "#ffffff" });
  w.wake(boat);
  const e = fz.createEngine({ settle: 0.25 });
  let sail = o.sail ?? 0, a = 0;
  e.add({
    step(_, dt) {
      if (sail > 0) {
        sail -= dt, (a += dt * 0.6);
        boat.pos[0] = Math.cos(a) * 2.2, (boat.pos[2] = Math.sin(a) * 1.4), (boat.rot[1] = -a - Math.PI / 2);
        e.busy();
      }
      if (w.step(dt)) e.busy();
    },
    render: () => d.draw(),
  });
  e.start();
  const out = new Float64Array(3);
  return {
    d, w, e, boat,
    at: (x, y, z) => (d.project(x, y, z, out), [out[0], out[1]]),
    // Near-white pixels in a box round a screen point (the splash's column and drops are white).
    white(x, y, r) {
      const k = d.dpr, img = d.ctx.getImageData(Math.round((x - r) * k), Math.round((y - r * 3) * k), Math.round(2 * r * k), Math.round(3.5 * r * k)).data;
      let n = 0;
      for (let i = 0; i < img.length; i += 4) if (img[i] > 235 && img[i + 1] > 235 && img[i + 2] > 235) n++;
      return n;
    },
    colours() {
      const img = d.ctx.getImageData(0, 0, cv.width, cv.height).data, c = new Set();
      for (let i = 0; i < img.length; i += 4 * 97) c.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2]);
      return c.size;
    },
  };
};
window.fr = (n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); });
window.settle = async () => {
  for (let i = 0; i < 900 && !window.P.e.paused.includes("settled"); i++) await window.fr(1);
  const f0 = window.P.e.stats().frames;
  await window.fr(20);
  return { settled: window.P.e.paused.includes("settled"), frames: window.P.e.stats().frames - f0 };
};`;
export const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#efe8de"><canvas id="cv" style="display:block;width:480px;height:320px;margin:16px"></canvas><script>${bundle}</script><script>${SCENE}</script></body>`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch(launchOptions());
  try {
    for (const dpr of [2, 1]) {
      const p = await browser.newPage({ viewport: { width: 520, height: 360 }, deviceScaleFactor: dpr });
      const errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(PAGE);
      const r = await p.evaluate(async () => {
        const P = (window.P = window.pool({ sail: 1 }));
        await window.fr(30);
        const [sx, sy] = P.at(1.2, 0.8, 0.6), water = P.at(-2.5, 0.8, -1.8);
        const px = Array.from(P.d.ctx.getImageData(Math.round(water[0] * P.d.dpr), Math.round(water[1] * P.d.dpr), 1, 1).data.slice(0, 3));
        const before = P.white(sx, sy, 22), still = P.w.still;
        P.w.splash(1.2, 0.6);
        await window.fr(18);
        const after = P.white(sx, sy, 22), live = P.w.live, colours = P.colours(), t = P.w.time;
        return { px, before, after, live, colours, still, t, size: [P.d.ctx.canvas.width, P.d.dpr] };
      });
      assert.deepEqual(r.size, [480 * dpr, dpr], `backing store at ${dpr}×`);
      assert.equal(r.still, false);
      assert.ok(r.colours >= 12, `not blank: ${r.colours} colours`);
      assert.ok(r.px[2] > 150 && r.px[2] > r.px[0] + 30, `the pool is water blue: ${r.px}`);
      assert.ok(r.live > 30 && r.after > r.before + 40, `a splash throws white water: ${r.before} → ${r.after} white px, ${r.live} drops`);
      assert.ok(r.t > 0.5, `the surface rolls: ${r.t}`);
      const s = await p.evaluate(() => window.settle());
      assert.ok(s.settled && s.frames === 0, `settles to 0 frames: ${JSON.stringify(s)}`);
      assert.equal(await p.evaluate(() => window.P.w.live), 0, "every drop back in the water");
      assert.deepEqual(errs, []);
      await p.close();
    }
    // Reduced motion: still by default; the clock never moves and a splash is short.
    const p = await browser.newPage({ viewport: { width: 520, height: 360 }, reducedMotion: "reduce" });
    await p.setContent(PAGE);
    const r = await p.evaluate(async () => {
      const P = (window.P = window.pool({ idle: 6 }));
      await window.fr(10);
      P.w.splash(0, 0);
      await window.fr(2);
      const live = P.w.live, s = await window.settle();
      return { still: P.w.still, t: P.w.time, live, s };
    });
    assert.ok(r.still && r.t === 0 && r.live === 10, `still: ${JSON.stringify(r)}`);
    assert.ok(r.s.settled && r.s.frames === 0, "still water settles");
    await p.close();
    console.log("water (Chromium): 2× and 1×, a pool with bands, foam, a wake and a splash of white water; settles; still under reduced motion ✓");
  } finally {
    await browser.close();
  }
}
