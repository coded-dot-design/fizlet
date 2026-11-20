// @fzlt/core/ground in Chromium (the demo): a diorama floor with a decal that paints, through `ground`,
// a grid of lines (`seg`), two light pools (`spot`), a hazard ring (`ring`) and the shadow of a ball
// that bobs (`shadow`), under a sky filled down to `horizon`. The pixels say so: the sky ends at the
// horizon row, a grid line and the ring are their colours where the diorama projects them, the pool is
// lighter than the floor beside it, and the shadow under the ball is darker on the ground than in the
// air (and lighter again while the ball is high). Screenshots when GROUND_SHOTS names a folder.
// Geometry and allocation: tests/ground.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.GROUND_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export * from "./src/ground.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0"><canvas id="cv" style="display:block;width:640px;height:420px"></canvas><script>${bundle}</script></body>`;

function setup() {
  const cv = document.getElementById("cv"), FLOOR = "#6f8f5a";
  let lift = 0;
  const d = fz.diorama(cv, {
    edge: false, ambient: 1, light: [0, 1, 0],
    // The sky: one colour down to the horizon, the ground's colour under it.
    background: () => "#6f8f5a",
    overlay: null,
  });
  d.cluster("sky", { fixed: -10 });
  d.decal("sky", 0, (ctx) => { ctx.fillStyle = "#9cc7ee"; ctx.fillRect(0, 0, d.width, Math.max(0, fz.horizon(d))); });
  d.cluster("floor", { fixed: 0 });
  d.add({ id: "floor", size: [40, 0.2, 40], pos: [0, -0.2, 0], color: FLOOR, cluster: "floor", layer: 0, emissive: true, pick: false });
  d.decal("floor", 5, (ctx) => {
    // Grid lines: one path, one stroke.
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = -4; i <= 4; i += 2) fz.seg(d, ctx, i, 0, -6, i, 0, 6), fz.seg(d, ctx, -6, 0, i, 6, 0, i);
    ctx.stroke();
    // Two light pools.
    ctx.fillStyle = "#fff3a0"; ctx.globalAlpha = 0.6; ctx.beginPath();
    fz.spot(d, ctx, -3, 0, 3, 0.9); fz.spot(d, ctx, 3, 0, 3, 0.9);
    ctx.fill(); ctx.globalAlpha = 1;
    // A hazard ring.
    ctx.strokeStyle = "#e2342b"; ctx.lineWidth = 5; ctx.beginPath();
    if (fz.ring(d, ctx, 3, -3, 0.9, 0)) ctx.stroke();
    // The ball's shadow.
    ctx.fillStyle = "#000000";
    fz.shadow(d, ctx, -3, 0, -3, 0.8, lift, 0.5, 0.1);
  });
  const ball = d.add({ id: "ball", shape: "cyl", sides: 12, size: [0.7, 0.7, 0.7], pos: [-3, 0.6, -3], color: "#3555c8", emissive: true });
  Object.assign(d.cam, { yaw: 0.3, pitch: 0.2, dist: 18, tx: 0, ty: 0, tz: 0, fov: 0.6 });
  const P = [0, 0, 0];
  const px = (x, y, z) => { d.project(x, y, z, P); const k = d.dpr, q = d.ctx.getImageData(Math.round(P[0] * k), Math.round(P[1] * k), 1, 1).data; return [q[0], q[1], q[2], P[0], P[1]]; };
  window.G = {
    d, px,
    draw(l) { lift = l; ball.pos[1] = 0.6 + l; d.draw(); },
    horizon: () => fz.horizon(d),
    row(y) { const k = d.dpr, q = d.ctx.getImageData(Math.round(320 * k), Math.round(y * k), 1, 1).data; return [q[0], q[1], q[2]]; },
  };
  window.G.draw(0);
}

const browser = await chromium.launch(launchOptions());
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  await p.evaluate(setup);
  if (SHOTS) await p.locator("#cv").screenshot({ path: join(SHOTS, "ground.png") });
  const r = await p.evaluate(() => {
    const { px, horizon, row } = window.G, h = horizon();
    return {
      h, above: row(h - 3), below: row(h + 3),
      line: px(2, 0, 1), floor: px(1, 0, 1), ring: px(3 + 0.9, 0, -3), inRing: px(3, 0, -3),
      pool: px(-3, 0, 3.5), shadow: px(-3, 0, -3 + 0.6), beside: px(-3, 0, -3 + 1.4),
    };
  });
  const lum = (c) => c[0] + c[1] + c[2], is = (c, rgb, m) => assert.ok(Math.abs(c[0] - rgb[0]) + Math.abs(c[1] - rgb[1]) + Math.abs(c[2] - rgb[2]) < 40, `${m}: ${c.slice(0, 3)} vs ${rgb}`);
  const SKY = [0x9c, 0xc7, 0xee], FLOOR = [0x6f, 0x8f, 0x5a];
  assert.ok(r.h > 20 && r.h < 200, `the horizon is on screen (${r.h})`);
  is(r.above, SKY, "sky above the horizon");
  is(r.below, FLOOR, "ground under it");
  is(r.line, [255, 255, 255], "a grid line where the diorama projects it");
  is(r.floor, FLOOR, "bare floor between the lines");
  is(r.ring, [0xe2, 0x34, 0x2b], "the ring on its radius");
  is(r.inRing, FLOOR, "the ring is a line, not a disc");
  assert.ok(lum(r.pool) > lum(FLOOR) + 60, `a light pool is lighter than the floor (${r.pool.slice(0, 3)})`);
  assert.ok(lum(r.shadow) < lum(r.beside) - 60, `the shadow is darker than the floor beside it (${r.shadow.slice(0, 3)} vs ${r.beside.slice(0, 3)})`);
  // The ball up in the air: the shadow fades.
  const high = await p.evaluate(() => { window.G.draw(3); return window.G.px(-3, 0, -3 + 0.3); });
  const low = await p.evaluate(() => { window.G.draw(0); return window.G.px(-3, 0, -3 + 0.3); });
  if (SHOTS) await p.evaluate(() => window.G.draw(3)), await p.locator("#cv").screenshot({ path: join(SHOTS, "ground-lift.png") });
  assert.ok(lum(high) > lum(low) + 40, `lifted: a fainter shadow (${high.slice(0, 3)} vs ${low.slice(0, 3)})`);
  assert.ok(lum(high) < lum(FLOOR) - 15, "but still there");
  assert.deepEqual(errs, [], "no page errors");
  console.log("ground: horizon, lines, ring, pools and a lifting shadow where the diorama projects them");
} finally {
  await browser.close();
}
