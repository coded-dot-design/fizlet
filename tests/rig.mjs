// @fzlt/core/rig in Chromium (the demo): a diorama figure on a stool, two legs and two arms on `limb`,
// posed in the kernel's render phase: the feet pedal a circle and the hands hold a bar that bobs. Each
// frame the projected tip of every lower bone lands on its target's projection (within half a pixel),
// the picture is drawn (not blank) and moves between frames, and once the pedalling stops the engine
// settles to 0 frames. Screenshots when RIG_SHOTS names a folder. Solves and allocation: tests/rig.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.RIG_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export * from "./src/rig.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#efe8de"><canvas id="cv" style="display:block;width:640px;height:420px"></canvas><script>${bundle}</script></body>`;

function setup() {
  const cv = document.getElementById("cv");
  const d = fz.diorama(cv, { background: () => "#efe8de", light: [0.5, 1, 0.4], ambient: 0.55 });
  d.cluster("floor", { fixed: 0 });
  d.add({ id: "floor", size: [6, 0.2, 4], pos: [0, -0.2, 0], color: "#d9d3ca", cluster: "floor", layer: 0, pick: false });
  d.add({ id: "fig", shape: "group", size: [1, 0, 1], pos: [0, 0, 0] });
  d.add({ size: [0.36, 0.5, 0.36], pos: [-0.25, 0, 0], on: "fig", color: "#8f8aa0", shape: "cyl", sides: 10 }); // the stool
  d.add({ id: "hip", shape: "group", size: [0.1, 0, 0.1], pos: [-0.25, 0.62, 0], on: "fig" });
  d.add({ size: [0.2, 0.5, 0.3], pos: [0, 0, 0], on: "hip", color: "#4f7bd9", layer: 6, rot: [0, 0, -0.25] }); // the torso
  d.add({ size: [0.2, 0.2, 0.2], pos: [0.13, 0.52, 0], on: "hip", color: "#e7c39d", layer: 6, shape: "cyl", sides: 10 }); // the head
  d.add({ size: [0.06, 0.78, 0.06], pos: [0.23, 0, 0.16], on: "fig", color: "#4a4f62" }); // the bar's posts
  d.add({ size: [0.06, 0.78, 0.06], pos: [0.23, 0, -0.16], on: "fig", color: "#4a4f62" });
  const limbs = [];
  for (const [name, l1, l2, bend, z, col, root] of [
    ["legL", 0.34, 0.36, 1, 0.09, "#2b3047", [0, 0, 0.09]], ["legR", 0.34, 0.36, 1, -0.09, "#2b3047", [0, 0, -0.09]],
    ["armL", 0.24, 0.24, -1, 0.14, "#4f7bd9", [0.08, 0.42, 0.14]], ["armR", 0.24, 0.24, -1, -0.14, "#4f7bd9", [0.08, 0.42, -0.14]],
  ]) {
    const L = fz.limb(d, name, { on: "hip", l1, l2, bend });
    d.add({ size: [l1, 0.07, 0.07], pos: [l1 / 2, -0.035, 0], on: name + ":a", color: col, layer: 7 });
    d.add({ size: [l2, 0.06, 0.06], pos: [l2 / 2, -0.03, 0], on: name + ":b", color: col, layer: 7 });
    limbs.push({ L, root, l2 });
  }
  const T = new Float64Array(12), P = new Float64Array(3), Q = new Float64Array(3);
  let t = 0, pedal = true;
  const targets = () => {
    const a = t * 3;
    // Pedals: a circle in front of the hip, the two feet half a turn apart; hands on the bobbing bar.
    T[0] = 0.28 + 0.1 * Math.cos(a); T[1] = -0.42 + 0.1 * Math.sin(a); T[2] = 0.09;
    T[3] = 0.28 - 0.1 * Math.cos(a); T[4] = -0.42 - 0.1 * Math.sin(a); T[5] = -0.09;
    const bob = 0.03 * Math.sin(a * 2);
    T[6] = 0.48; T[7] = 0.18 + bob; T[8] = 0.16;
    T[9] = 0.48; T[10] = 0.18 + bob; T[11] = -0.16;
  };
  const e = fz.createEngine({ settle: 0.25 });
  let draws = 0;
  e.add({
    step(_, dt) { if (pedal) (t += dt), e.busy(); },
    render() {
      targets();
      for (let i = 0; i < 4; i++) { const { L, root } = limbs[i]; L.reach(root[0], root[1], root[2], T[i * 3], T[i * 3 + 1], T[i * 3 + 2]); }
      d.draw();
      draws++;
    },
  });
  e.start();
  /** Max screen distance (px) between each lower bone's drawn tip and its target, this frame. */
  function miss() {
    const H = d.get("hip").M;
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      const { L, l2 } = limbs[i], M = L.b.M, x = T[i * 3], y = T[i * 3 + 1], z = T[i * 3 + 2];
      d.project(M[9] + M[0] * l2, M[10] + M[3] * l2, M[11] + M[6] * l2, P);
      d.project(H[9] + H[0] * x + H[1] * y + H[2] * z, H[10] + H[3] * x + H[4] * y + H[5] * z, H[11] + H[6] * x + H[7] * y + H[8] * z, Q);
      worst = Math.max(worst, Math.hypot(P[0] - Q[0], P[1] - Q[1]));
    }
    return worst;
  }
  Object.assign(d.cam, { yaw: -0.5, pitch: 0.35, tx: 0.1, ty: 0.55, tz: 0, fov: 0.6, dist: 4 });
  window.rig = { d, e, miss, stop: () => (pedal = false), get draws() { return draws; }, get running() { return e.paused.join(); } };
}

const browser = await chromium.launch(launchOptions());
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(PAGE);
  await p.evaluate(setup);
  const frames = (n) => p.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const sample = () => p.evaluate(() => {
    const { d } = window.rig, cv = d.ctx.canvas, img = d.ctx.getImageData(0, 0, cv.width, cv.height).data, colours = new Set();
    let h = 0;
    for (let i = 0; i < img.length; i += 4 * 37) colours.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2]), (h = (h * 31 + img[i] + img[i + 1] * 7) | 0);
    return { colours: colours.size, h, miss: window.rig.miss() };
  });
  await frames(5);
  const hs = new Set();
  for (let k = 0; k < 6; k++) {
    await frames(4);
    const s = await sample();
    assert.ok(s.colours >= 12, `a figure is drawn, not blank: ${s.colours} colours`);
    assert.ok(s.miss < 0.5, `every hand and foot on its target: ${s.miss.toFixed(3)} px`);
    hs.add(s.h);
    if (SHOTS && k === 0) await p.locator("#cv").screenshot({ path: join(SHOTS, "rig.png") });
  }
  assert.ok(hs.size >= 4, `the limbs move between frames (${hs.size} distinct pictures)`);
  await p.evaluate(() => window.rig.stop());
  await p.waitForFunction(() => window.rig.running.includes("settled"), null, { timeout: 5000 });
  const n0 = await p.evaluate(() => window.rig.draws);
  await frames(1).catch(() => {});
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.rig.draws), n0, "settled: 0 frames");
  assert.deepEqual(errs, [], "no page errors");
  console.log("rig: limbs on target, moving, settled");
} finally {
  await browser.close();
}
