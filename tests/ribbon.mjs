// @fzlt/core/ribbon in Chromium (the demo): a dune heightfield on @fzlt/core/terrain with a closed track
// and its two edge strips as ribbons, the camera orbiting in the kernel's render phase. Each frame the
// pixel under the track's projected centre line is the track's colour (a shade of it), the strips show
// on both sides, the picture moves, and once the orbit stops the engine settles to 0 frames.
// Then the four additions, each on its own still canvas, by pixel: a dashed line and an alternating kerb
// (`runs`: paint on the dashes, ground in the gaps, the kerb's two colours in turn); two bands with an
// under-lap show no ground along their seam (`bands`); a band over a ridge stops at the crest with
// `cut` where `hide` alone paints on down the far side; and a layout's own disc through the public
// pieces (`WP`, `hy`, `bucket`, `emit`) is painted where it was put.
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

/** The four additions: one still canvas each (in the page). Returns what the pixels show. */
function additions() {
  const mk = (id) => {
    const cv = document.createElement("canvas");
    cv.id = id; cv.style.cssText = "display:block;width:480px;height:300px";
    document.body.appendChild(cv);
    return cv;
  };
  const GROUND = "#00c000", P = new Float64Array(3);
  /** A scene: flat or ridged ground in green, the camera set, ribbons made by `make`. */
  const sceneOf = (id, cam, ridge, opts, make) => {
    const d = fz.diorama(mk(id), { background: () => "#bfe3f2" });
    const t = fz.terrain({ cols: 40, rows: 40, cell: 0.5, x0: -10, z0: -10 });
    if (ridge) for (let j = 0; j <= 40; j++) for (let i = 0; i <= 40; i++) t.h[j * 41 + i] = 3 * Math.exp(-((((j - 20) * 0.5) / 2) ** 2));
    fz.terrainView(d, t, { bands: [[Infinity, GROUND]] });
    const r = fz.ribbon(d, t, opts);
    make(r);
    Object.assign(d.cam, { tx: 0, ty: 0, tz: 0, fov: 0.7 }, cam);
    d.draw();
    return { d, t, r };
  };
  /** The pixel where world (x, y, z) lands: [r, g, b]. */
  const px = (s, x, z, y) => {
    if (y === undefined) { const S = new Float64Array(4); s.t.sample(x, z, S); y = S[0]; }
    s.d.project(x, y, z, P);
    const k = s.d.dpr, q = s.d.ctx.getImageData(Math.round(P[0] * k), Math.round(P[1] * k), 1, 1).data;
    return [q[0], q[1], q[2]];
  };
  const kind = ([r, g, b]) => (g > r + 40 && g > b + 40 ? "ground" : r > g + 40 && b > g + 40 ? "magenta" : r > g + 40 && r > b + 40 ? "red" : b > g + 40 && b > r + 40 ? "blue" : "other");
  const out = {};

  // 1. Runs: a dashed line (2 units on, 2 off) and a kerb that alternates every unit.
  const top = { yaw: 0, pitch: 1.2, dist: 24 };
  const a = sceneOf("runs", top, false, { step: 0.5 }, (r) => {
    r.band([-8, 0, 8, 0], -0.4, 0.4, "#c000c0", false, { at: [2], colors: [null], period: 4 });
    r.band([-8, 3, 8, 3], -0.4, 0.4, "#c00000", false, { at: [1], colors: ["#0000c0"], period: 2 });
  });
  out.dash = [-7, -5, -3, -1, 1, 3, 5, 7].map((x) => kind(px(a, x, 0)));
  out.dashEnds = [-6.15, -5.85, -4.15, -3.85].map((x) => kind(px(a, x, 0)));
  out.kerb = [-7.5, -6.5, -5.5, -4.5, -3.5, -2.5].map((x) => kind(px(a, x, 3)));

  // 2. Bands: red then blue, meeting on the line; the view turned so the seam crosses the pixel grid.
  //    Along the seam, the most ground (green) that shows through: none with the under-lap.
  const seam = (id, lap) => {
    const s = sceneOf(id, { yaw: 0.37, pitch: 0.9, dist: 18 }, false, { step: 0.5 }, (r) => r.bands([-8, -1, 8, 1.3], [-1.5, 0, 1.5], ["#c00000", "#0000c0"], { lap }));
    const k = s.d.dpr;
    let g = 0, n = 0;
    for (let u = 0.02; u < 0.98; u += 0.002) {
      const x = -8 + 16 * u, z = -1 + 2.3 * u;
      s.d.project(x, 0.004, z, P);
      const q = s.d.ctx.getImageData(Math.round(P[0] * k) - 1, Math.round(P[1] * k) - 1, 3, 3).data;
      for (let i = 0; i < q.length; i += 4) (g = Math.max(g, q[i + 1])), n++;
    }
    return { g, n, sides: [kind(px(s, 0, -0.9)), kind(px(s, 0, 1.2))] };
  };
  out.lap = seam("lap", 0.15);
  out.nolap = seam("nolap", 0);

  // 3. Cut: a band over a round ridge, seen low and from the side, so what is painted past the crest
  //    lands on the ridge's near face beside the band. Every band-coloured pixel of each canvas.
  const over = (id, opts) => {
    const s = sceneOf(id, { yaw: 0.7, pitch: 0.2, dist: 20, ty: 1 }, true, { step: 1, ...opts }, (r) => r.band([0, 9, 0, -9], -0.6, 0.6, "#c000c0"));
    const cv = s.d.ctx.canvas, q = s.d.ctx.getImageData(0, 0, cv.width, cv.height).data, mask = new Uint8Array(cv.width * cv.height), WP = s.r.WP;
    let n = 0, first = null;
    for (let i = 0; i < mask.length; i++) if (q[i * 4] > q[i * 4 + 1] + 40 && q[i * 4 + 2] > q[i * 4 + 1] + 40) (mask[i] = 1), n++;
    // Where the band's middle goes out of view, by the painter's own test.
    for (let z = 8; z > -8 && first === null; z -= 0.05) {
      WP[0] = 0; WP[2] = z; s.r.hy(WP, 0);
      if (s.r.hidden(0)) first = z;
    }
    return { mask, n, first, pieces: s.r.stats.pieces };
  };
  const hide = over("hide", { hide: true }), cut = over("cut", { cut: true });
  let through = 0, extra = 0;
  for (let i = 0; i < hide.mask.length; i++) (through += hide.mask[i] & ~cut.mask[i] & 1), (extra += cut.mask[i] & ~hide.mask[i] & 1);
  out.cut = { hide: hide.n, cut: cut.n, through, extra, first: cut.first, pieces: cut.pieces, hidePieces: hide.pieces };

  // 4. Pieces: a layout's own disc (24 triangles through WP, hy, bucket, emit) beside a band.
  const b = sceneOf("pieces", top, false, { step: 0.5 }, (r) => {
    r.band([-8, -3, 8, -3], -0.4, 0.4, "#c00000");
    const c = r.color("#0000c0"), WP = r.WP;
    r.layout(() => {
      for (let k = 0; k < 24; k++) {
        const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1.04) / 24) * Math.PI * 2;
        // Every other triangle wound the other way: the painter gives them one winding.
        const u = k & 1 ? a1 : a0, v = k & 1 ? a0 : a1;
        WP[0] = 3; WP[2] = 2; WP[3] = 3 + Math.cos(u) * 2; WP[5] = 2 + Math.sin(u) * 2; WP[6] = 3 + Math.cos(v) * 2; WP[8] = 2 + Math.sin(v) * 2;
        for (let i = 0; i < 3; i++) r.hy(WP, i * 3);
        r.bucket(WP, 0);
        r.emit(c, 3);
      }
    });
  });
  const ring = [];
  for (let k = 0; k < 24; k++) ring.push(kind(px(b, 3 + Math.cos(((k + 0.02) / 24) * Math.PI * 2) * 1.5, 2 + Math.sin(((k + 0.02) / 24) * Math.PI * 2) * 1.5)));
  out.disc = { middle: kind(px(b, 3, 2)), ring, outside: kind(px(b, 3, 4.4)), band: kind(px(b, 0, -3)), pieces: b.r.stats.pieces };
  return out;
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
  // The four additions.
  const A = await p.evaluate(additions);
  if (SHOTS) for (const id of ["runs", "lap", "nolap", "hide", "cut", "pieces"]) await p.locator("#" + id).screenshot({ path: join(SHOTS, `ribbon-${id}.png`) });
  // 1. Runs: dashes at 0..2, 4..6, …: paint, gap, paint, gap; each dash ends within 0.15 units of its
  //    distance; the kerb's colours in turn.
  assert.deepEqual(A.dash, ["magenta", "ground", "magenta", "ground", "magenta", "ground", "magenta", "ground"], "the dashed line");
  assert.deepEqual(A.dashEnds, ["magenta", "ground", "ground", "magenta"], "a dash ends and the next starts where the runs say");
  assert.deepEqual(A.kerb, ["red", "blue", "red", "blue", "red", "blue"], "the kerb alternates");
  // 2. Under-lap: both bands there, and no ground along the seam (9 px round 480 points on it); edge
  //    to edge (lap 0), the two anti-aliased edges let the ground through.
  assert.deepEqual(A.lap.sides, ["red", "blue"]);
  assert.ok(A.lap.g <= 6, `no seam with the under-lap: green at most ${A.lap.g} of 255 over ${A.lap.n} px`);
  assert.ok(A.nolap.g > A.lap.g + 20, `edge to edge the ground shows through (green up to ${A.nolap.g}): the under-lap is what closes it`);
  // 3. Cut: the same pieces; hide alone paints the piece across the crest whole (its far end down the
  //    ridge's near face); cut ends it at the crest, takes nothing else away and adds nothing.
  assert.ok(A.cut.first !== null && A.cut.first < 2 && A.cut.first > -3, `the band goes behind the crest at z ${A.cut.first}`);
  assert.equal(A.cut.pieces, A.cut.hidePieces);
  assert.ok(A.cut.through > 150, `hide alone paints ${A.cut.through} px past the crest`);
  // (The few px cut alone colours are its new edge's own anti-aliasing, where hide's flap had the ground's colour blended in.)
  assert.ok(A.cut.extra <= 24, `cut paints nothing hide does not, bar its new edge's anti-aliasing (${A.cut.extra} px)`);
  assert.ok(A.cut.cut > 2000 && A.cut.cut > A.cut.hide * 0.6, `the near side stays: ${A.cut.cut} px of ${A.cut.hide}`);
  // 4. Pieces: the disc where the layout put it, whole (no hole where its triangles overlap), beside the band.
  assert.deepEqual([A.disc.middle, A.disc.outside, A.disc.band], ["blue", "ground", "red"]);
  assert.ok(A.disc.ring.every((k) => k === "blue"), `the disc is whole: ${A.disc.ring.join(" ")}`);
  assert.ok(A.disc.pieces >= 24 + 32, `the band's pieces and the disc's: ${A.disc.pieces}`);
  assert.deepEqual(errs, [], "no page errors");
  console.log(`ribbon: track and edge strips painted, moving, settled; runs, under-lap (seam green ${A.lap.g} against ${A.nolap.g}), crest cut (${A.cut.through} px that hide alone paints past the crest) and a layout's own disc`);
} finally {
  await browser.close();
}
