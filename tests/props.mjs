// @fzlt/core/props in Chromium at 2× and 1×: a showroom diorama with every prop on a grid, drawn from
// the kernel's render phase (not blank: the floor, shaded parts, shadows), a real click on each prop
// picks one of its parts and `root()` gives the prop's root, a click on the floor picks nothing, the
// night palette re-themes the kit through one shared colour object (clear, re-add), and the engine
// settles to 0 frames. Screenshots (light, dark) and a short orbit video when PROPS_SHOTS names a
// folder. Counts, footprints, palettes, seeds and allocation: tests/props.test.mjs.
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const SHOTS = process.env.PROPS_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const bundle = (await build({
  stdin: { contents: 'export { createEngine } from "./src/index.ts"; export { diorama } from "./src/diorama.ts"; export * from "./src/props.ts";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "fz", write: false, logLevel: "silent",
})).outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#efe8de"><canvas id="cv" style="display:block;width:900px;height:560px"></canvas><script>${bundle}</script></body>`;

// The showroom, built in the page: build(night) clears and re-adds every prop on a 6 × 3 grid.
function setup() {
  const cv = document.getElementById("cv");
  const LIGHT = { bg: "#efe8de", floor: "#d9d3ca", tile: "#e4ded5" };
  const DARK = { bg: "#141a2c", floor: "#2b3047", tile: "#323854" };
  // One colour object for every prop: the night set (shared keys across the kit).
  const NIGHT = {
    trunk: "#6d5139", leaf: "#3f7a5c", leaf2: "#4f8d68", rock: "#6b6880", rock2: "#7d7a92", cactus: "#3f7a5c", cactus2: "#4f8d68", flower: "#b0607a",
    wall: "#c9c4d4", roof: "#a9544c", trim: "#8f8aa0", door: "#4b4560", glass: "#9cc6d9", brick: "#8f5a52", awning: "#b25e58", awning2: "#cfcadb",
    metal: "#4a4f62", lamp: "#fff4b8", wood: "#94724f", wood2: "#7d5f42", fence: "#cfcadb", post: "#a9a3b5", cone: "#c46c48", cone2: "#d9d4e2",
    stone: "#77798a", stripe: "#c9615a", deck: "#94724f", plank: "#6d5139", buoy: "#c9615a", buoy2: "#d9d4e2", body: "#cfcadb", tire: "#2a2833",
  };
  let night = false;
  const d = fz.diorama(cv, { background: () => (night ? DARK : LIGHT).bg, shadowColor: "#1d1622", light: [0.55, 1, 0.42], ambient: 0.52 });
  const names = Object.keys(fz.PROPS), COLS = 6, SP = 4.6, roots = [];
  const gx = (i) => ((i % COLS) - (COLS - 1) / 2) * SP, gz = (i) => (((i / COLS) | 0) - 1) * SP;
  function build(n) {
    night = n;
    const P = night ? DARK : LIGHT;
    d.clear();
    roots.length = 0;
    d.cluster("floor", { fixed: 0 });
    d.add({ id: "floor", size: [COLS * SP + 1, 0.4, 3 * SP + 1], pos: [0, -0.4, 0], color: P.floor, cluster: "floor", layer: 0, pick: false });
    names.forEach((name, i) => {
      d.add({ size: [SP - 0.4, 0.02, SP - 0.4], on: "floor", pos: [gx(i), 0, gz(i)], color: P.tile, cluster: "floor", layer: 0.2, pick: false });
      roots.push(fz.PROPS[name](d, { id: name, on: "floor", pos: [gx(i), 0, gz(i)], rot: name === "fence" || name === "dock" ? 0 : -0.25, seed: i, colors: night ? NIGHT : undefined }));
    });
  }
  build(false);
  const cam = Object.assign(d.cam, { yaw: -0.22, pitch: 0.82, tx: 0, ty: 0.6, tz: 0, fov: 0.62 });
  const corners = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [0, 3.5]) corners.push(x * (COLS * SP) / 2, y, z * 1.5 * SP);
  d.fit(cam, corners, { x0: 16, y0: 16, x1: d.width - 16, y1: d.height - 16 });
  const e = fz.createEngine({ settle: 0.25 });
  let draws = 0;
  e.add({ render: () => (d.draw(), draws++) });
  e.start();
  window.picks = [];
  cv.addEventListener("click", (ev) => {
    const ob = d.pick(ev.offsetX, ev.offsetY), r = d.root(ob);
    window.picks.push(ob ? [ob.id, r && r.id] : [null, null]);
    if (r && r.id !== "floor") for (const x of roots) x.tint = x === r ? "#ffe27a" : null; // a selection
    e.wake();
  });
  /** A screen point on each prop where pick() returns one of its parts: the projected centres of its parts. */
  function targets() {
    const out = new Float64Array(3), res = {};
    for (const r of roots) {
      const parts = [];
      d.recolor((ob) => ob.parent === r && parts.push(ob));
      for (const p of parts) {
        const m = p.M;
        if (!d.project(m[9] + m[1] * p.size[1] * 0.5, m[10] + m[4] * p.size[1] * 0.5, m[11] + m[7] * p.size[1] * 0.5, out)) continue;
        const hit = d.pick(out[0], out[1]);
        if (hit && d.root(hit) === r) { res[r.id] = [out[0], out[1]]; break; }
      }
    }
    return res;
  }
  window.show = { d, e, build, targets, roots, names, get draws() { return draws; } };
}

const browser = await chromium.launch(launchOptions());
try {
  for (const dpr of [2, 1]) {
    const vid = SHOTS && dpr === 2 ? { dir: join(SHOTS, "video"), size: { width: 900, height: 560 } } : undefined;
    const ctx = await browser.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: dpr, ...(vid ? { recordVideo: vid } : {}) });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.setContent(PAGE);
    await p.evaluate(setup);
    const frames = (n) => p.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    await frames(5);
    const r = await p.evaluate(() => {
      const { d } = window.show, cv = d.ctx.canvas;
      const img = d.ctx.getImageData(0, 0, cv.width, cv.height).data, colours = new Set();
      for (let i = 0; i < img.length; i += 4 * 61) colours.add((img[i] << 16) | (img[i + 1] << 8) | img[i + 2]);
      return { size: [cv.width, cv.height, d.dpr], colours: colours.size, stats: { ...d.stats }, n: window.show.roots.length, corner: Array.from(d.ctx.getImageData(2, 2, 1, 1).data.slice(0, 3)) };
    });
    assert.deepEqual(r.size, [900 * dpr, 560 * dpr, dpr], `backing store at ${dpr}×`);
    assert.equal(r.n, 17, "every prop in the showroom");
    assert.ok(r.colours >= 40, `a furnished scene, not blank: ${r.colours} colours`);
    assert.ok(r.stats.faces > 400 && r.stats.shadows === 17 && r.stats.dropped === 0, `faces and one shadow per prop: ${JSON.stringify(r.stats)}`);
    assert.deepEqual(r.corner, [0xef, 0xe8, 0xde], "the background outside the floor");
    if (SHOTS && dpr === 2) await p.locator("#cv").screenshot({ path: join(SHOTS, "props-light.png") });
    // A real click on every prop picks one of its parts; root() is the prop.
    const box = await p.locator("#cv").boundingBox(), tg = await p.evaluate(() => window.show.targets());
    assert.deepEqual(Object.keys(tg).sort(), [...(await p.evaluate(() => window.show.names))].sort(), "a clickable point on every prop");
    for (const [name, [x, y]] of Object.entries(tg)) {
      await p.mouse.click(box.x + x, box.y + y);
      const last = await p.waitForFunction((k) => window.picks.length === k && window.picks[k - 1], Object.keys(tg).indexOf(name) + 1);
      const [part, root] = await last.jsonValue();
      assert.equal(part, null, `${name}: the hit is an anonymous part`);
      assert.equal(root, name, `${name}: root() is the prop`);
    }
    await p.mouse.click(box.x + 6, box.y + 6);
    await p.waitForFunction((k) => window.picks.length === k, Object.keys(tg).length + 1);
    assert.deepEqual((await p.evaluate(() => window.picks)).at(-1), [null, null], "the background picks nothing");
    if (SHOTS && dpr === 2) {
      await p.mouse.click(box.x + tg.lighthouse[0], box.y + tg.lighthouse[1]);
      await frames(3);
      await p.locator("#cv").screenshot({ path: join(SHOTS, "props-picked.png") });
    }
    // Night: one colour object for every prop, the scene cleared and re-added.
    const dark = await p.evaluate(async () => {
      const { d, build, e } = window.show;
      build(true);
      e.wake();
      d.draw();
      const px = Array.from(d.ctx.getImageData(2, 2, 1, 1).data.slice(0, 3));
      let leaf = 0;
      d.recolor((ob) => (leaf += ob.color === "#3f7a5c" ? 1 : 0));
      return { px, leaf, n: d.stats.objects };
    });
    assert.deepEqual(dark.px, [0x14, 0x1a, 0x2c], "the night background");
    assert.ok(dark.leaf >= 4, `the night leaves on every tree: ${dark.leaf}`);
    if (SHOTS && dpr === 2) {
      await p.locator("#cv").screenshot({ path: join(SHOTS, "props-dark.png") });
      // A slow orbit for the video (the engine draws each frame while the camera turns).
      await p.evaluate(() => window.show.build(false));
      await p.evaluate(() => new Promise((ok) => {
        const { d } = window.show, y0 = d.cam.yaw, t0 = performance.now();
        const f = (t) => { const k = (t - t0) / 5000; d.cam.yaw = y0 + Math.sin(k * Math.PI * 2) * 0.4; d.draw(); k < 1 ? requestAnimationFrame(f) : ok(); };
        requestAnimationFrame(f);
      }));
    }
    // Nothing keeps the engine awake: it settles, then runs 0 frames.
    const settled = await p.evaluate(async () => {
      const { e } = window.show, frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
      for (let i = 0; i < 90 && !e.paused.includes("settled"); i++) await frame();
      const f0 = e.stats().frames;
      for (let i = 0; i < 20; i++) await frame();
      const n = e.stats().frames - f0;
      e.destroy();
      return n;
    });
    assert.equal(settled, 0, "settled: 0 frames");
    assert.deepEqual(errs, []);
    await ctx.close();
    if (vid) {
      const f = readdirSync(vid.dir).find((x) => x.endsWith(".webm"));
      if (f) renameSync(join(vid.dir, f), join(SHOTS, "props-orbit.webm"));
    }
  }
  console.log("props (Chromium): 2× and 1×, a showroom of all 17 props, a real click on each picks its root, night re-theme, settles ✓");
} finally {
  await browser.close();
}
