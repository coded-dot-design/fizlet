// @fzlt/core/terrain in Node: heights interpolate on the same two triangles per cell the view draws,
// normals are the faces' (and agree with the heights' slopes), the stamps (bump, ramp, whoops, berm,
// a flat ribbon that paints its kind) shape what they say, seeded noise is the same bit for bit from
// the same seed (and uses no builtin sine or cosine, which can differ between browsers), the view
// draws shaded faces by band, steep and kind, culls, draws far chunks coarser with stitched edges,
// paints far to near, and queries and draws allocate nothing. Real pixels: tests/terrain-drive.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { terrain, terrainView } = await import("../src/terrain.ts");
const { diorama } = await import("../src/diorama.ts");

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

/** A 2D context that records each filled path: its points, fill and the order. */
class FakeCtx {
  constructor() { this.fills = []; this.pts = []; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; this.rec = false; }
  setTransform() {}
  fillRect() {}
  clearRect() {}
  beginPath() { this.pts.length = 0; }
  moveTo(x, y) { if (this.rec) this.pts.push(x, y); }
  lineTo(x, y) { if (this.rec) this.pts.push(x, y); }
  arc() {}
  closePath() {}
  fill() { if (this.rec) this.fills.push({ fill: this.fillStyle, pts: this.pts.slice(), alpha: this.globalAlpha }); }
  stroke() {}
}
const canvas = () => { const ctx = new FakeCtx(); return { ctx, clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx }; };

test("terrain: height on the drawn triangles, clamped at the edges; data in, rows along x", () => {
  // 2 × 1 cells, cell 2, from (0, 0): vertex heights row 0: 0 1 2, row 1: 3 5 4.
  const t = terrain({ cols: 2, rows: 1, cell: 2, x0: 0, z0: 0, heights: [0, 1, 2, 3, 5, 4] });
  assert.equal(t.h.length, 6);
  for (const [i, j, h] of [[0, 0, 0], [1, 0, 1], [2, 0, 2], [0, 1, 3], [1, 1, 5], [2, 1, 4]]) {
    assert.equal(t.at(i, j), h);
    assert.equal(t.height(i * 2, j * 2), h, `vertex ${i},${j}`);
  }
  // Cell 0 is split along (0,0)–(2,2): the triangle with (2,0) below the diagonal, the one with (0,2) above.
  close(t.height(1.5, 0.5), 0 + (1 - 0) * 0.75 + (5 - 1) * 0.25, 1e-12, "the triangle with corner 10");
  close(t.height(0.5, 1.5), 0 + (5 - 3) * 0.25 + (3 - 0) * 0.75, 1e-12, "the triangle with corner 01");
  close(t.height(1, 1), 2.5, 1e-12, "on the diagonal both agree");
  assert.equal(t.height(-5, 0), 0, "clamped to the grid's edge");
  assert.equal(t.height(9, 9), 4);
  const c = terrain({ cols: 4, rows: 2 });
  assert.deepEqual([c.x0, c.z0, c.cell], [-2, -1, 1], "centred on 0 by default");
  assert.throws(() => terrain({ cols: 0, rows: 1 }), RangeError);
});

test("terrain: normals are the faces' and agree with the heights' slopes; sample gives both", () => {
  const t = terrain({ cols: 8, rows: 8, cell: 0.5 });
  t.shape((x, z) => 0.5 * x - 0.25 * z + 1);
  const n = new Float64Array(3), s = new Float64Array(4);
  const want = [-0.5, 1, 0.25].map((v) => v / Math.sqrt(0.25 + 1 + 0.0625));
  for (const [x, z] of [[0.1, 0.2], [-1.3, 1.1], [1.9, -1.7]]) {
    t.normal(x, z, n);
    for (let k = 0; k < 3; k++) close(n[k], want[k], 1e-12, `plane normal ${k} at ${x},${z}`);
    t.sample(x, z, s);
    close(s[0], 0.5 * x - 0.25 * z + 1, 1e-12, "sample's height");
    for (let k = 0; k < 3; k++) assert.equal(s[k + 1], n[k]);
  }
  // A bumpy field: each face's normal is unit length and matches the height's finite differences inside it.
  const b = terrain({ cols: 16, rows: 16, cell: 0.5 });
  b.noise({ seed: 3, amp: 2, scale: 2 });
  const e = 1e-6;
  for (const [x, z] of [[0.3, 0.1], [-1.12, 2.4], [2.21, -0.37], [-3.3, -3.1]]) {
    b.normal(x, z, n);
    close(Math.hypot(n[0], n[1], n[2]), 1, 1e-12, "unit");
    const sx = (b.height(x + e, z) - b.height(x - e, z)) / (2 * e), sz = (b.height(x, z + e) - b.height(x, z - e)) / (2 * e);
    close(-n[0] / n[1], sx, 1e-6, `slope x at ${x},${z}`);
    close(-n[2] / n[1], sz, 1e-6, `slope z at ${x},${z}`);
  }
});

test("terrain: stamps: bump, ramp (rise, lip, back), whoops, berm, ribbon (flat, blended, painted)", () => {
  const t = terrain({ cols: 40, rows: 40, cell: 0.5 });
  t.bump(2, 3, 2, 1.5);
  assert.equal(t.height(2, 3), 1.5, "the bump's top");
  assert.equal(t.height(2 + 2.5, 3), 0, "nothing past its radius");
  assert.ok(t.height(3, 3) > 0.5 && t.height(3, 3) < 1.5, "smooth between");
  const v0 = t.version;
  t.bump(2, 3, 2, -1.5);
  assert.ok(t.version > v0, "a stamp bumps the version");
  for (let i = 0; i < t.h.length; i++) close(t.h[i], 0, 1e-12, "a dip cancels the bump");

  const r = terrain({ cols: 40, rows: 20, cell: 0.5 });
  r.ramp([-6, 0], [2, 0], { width: 3, height: 2, back: 1, edge: 1 });
  close(r.height(-6, 0), 0, 1e-12, "starts at the ground");
  close(r.height(-2, 0), 1, 1e-12, "half way up");
  close(r.height(2, 0), 2, 1e-12, "the lip");
  close(r.height(2.5, 0), 1, 1e-12, "falls back over `back`");
  close(r.height(3, 0), 0, 1e-12, "and is gone");
  close(r.height(-2, 1.5), 1, 1e-12, "full height across its width");
  close(r.height(-2, 2.5), 0, 1e-12, "faded out past width + edge");

  const w = terrain({ cols: 48, rows: 8, cell: 0.25 });
  w.whoops([-5, 0], [5, 0], { count: 5, height: 0.4, width: 1 });
  let peaks = 0;
  for (let x = -4.95; x < 5; x += 0.1) if (w.height(x, 0) > w.height(x - 0.1, 0) && w.height(x, 0) >= w.height(x + 0.1, 0)) peaks++;
  assert.equal(peaks, 5, "five humps");
  close(Math.max(...Array.from({ length: 101 }, (_, i) => w.height(-5 + i * 0.1, 0))), 0.4, 0.02, "each 0.4 high");

  // A berm along +x: side 1 raises the right of travel, which is +z (diorama's right, heading +x).
  const bm = terrain({ cols: 40, rows: 20, cell: 0.5 });
  bm.berm([-8, 0, 8, 0], { width: 4, height: 1, side: 1 });
  assert.ok(bm.height(0, 2) > 0.9 && bm.height(0, -2) < 0.05 && bm.height(0, 0) > 0.1 && bm.height(0, 0) < 0.4, `banked to +z: ${bm.height(0, -2)}, ${bm.height(0, 0)}, ${bm.height(0, 2)}`);
  const bl = terrain({ cols: 40, rows: 20, cell: 0.5 });
  bl.berm([-8, 0, 8, 0], { width: 4, height: 1, side: -1 });
  close(bl.height(0, -2), bm.height(0, 2), 1e-9, "side −1 mirrors it");

  // A ribbon over hills: level across its width (at the ground's height under each point), blended outside, kind painted.
  const g = terrain({ cols: 64, rows: 64, cell: 0.5 });
  g.noise({ seed: 11, amp: 3, scale: 6 });
  const before = [g.height(-10, 0), g.height(10, 0)];
  g.ribbon([-10, 0, 10, 0], { width: 4, edge: 2, kind: 1 });
  close(g.height(-10, 0), before[0], 1e-9, "the start keeps its ground height");
  close(g.height(10, 0), before[1], 1e-9, "so does the end");
  for (const x of [-6, 0, 5])
    for (const z of [-1.9, -1, 0, 1, 1.9]) close(g.height(x, z), g.height(x, 0), 1e-9, `level across the track at ${x},${z}`);
  assert.equal(g.kindAt(0, 0), 1);
  assert.equal(g.kindAt(0, 1.7), 1);
  assert.equal(g.kindAt(0, 3), 0, "outside the width: no kind");
  const s = new Float64Array(4);
  assert.equal(g.sample(2, 0.5, s), 1, "sample returns the kind (for grip)");
});

test("terrain: seeded noise: the same seed, the same heights bit for bit; the generator has no sine or cosine", () => {
  const make = (seed, o = {}) => terrain({ cols: 48, rows: 32, cell: 0.5 }).noise({ seed, amp: 2.5, scale: 7, octaves: 4, ...o });
  const a = make(20261113), b = make(20261113), c = make(20261114);
  assert.deepEqual(Buffer.from(a.h.buffer), Buffer.from(b.h.buffer), "bit for bit");
  assert.notDeepEqual(Array.from(a.h), Array.from(c.h), "another seed, another field");
  let lo = Infinity, hi = -Infinity;
  for (const v of a.h) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  assert.ok(lo >= 0 && hi <= 2.5 && hi - lo > 1, `0..amp: ${lo.toFixed(3)}..${hi.toFixed(3)}`);
  // Dunes: ridged and stretched across the wind: heights vary more along the wind (x) than across it (z).
  const d = make(5, { ridge: 1, wind: [1, 0], stretch: 4 });
  let along = 0, across = 0;
  for (let j = 1; j < 32; j++) for (let i = 1; i < 48; i++) (along += Math.abs(d.at(i, j) - d.at(i - 1, j))), (across += Math.abs(d.at(i, j) - d.at(i, j - 1)));
  assert.ok(along > 2 * across, `crests run across the wind: ${along.toFixed(1)} along vs ${across.toFixed(1)} across`);
  assert.deepEqual(Buffer.from(d.h.buffer), Buffer.from(make(5, { ridge: 1, wind: [1, 0], stretch: 4 }).h.buffer));
  // Every stamp and the queries use + − × ÷ and square roots only: the same course in every browser.
  const src = readFileSync(new URL("../src/terrain.ts", import.meta.url), "utf8"), gen = src.slice(0, src.indexOf("export function terrainView"));
  assert.doesNotMatch(gen, /Math\.(sin|cos|tan|atan2?|exp|log|pow|hypot)\b/, "no builtin transcendental in terrain()");
});

test("terrain view: shaded faces by band, steep and kind; culled; far chunks coarser, edges stitched; far to near", () => {
  const cv = canvas(), d = diorama(cv);
  const t = terrain({ cols: 32, rows: 32, cell: 1 });
  t.shape((x, z) => (x > 8 ? (x - 8) * 1.5 : 0) + (z < -8 ? 3 : 0)); // flat, a steep slope at x > 8, a raised plateau at z < −8
  t.ribbon([-12, 4, 4, 4], { width: 3, edge: 0, y: 0, kind: 1 });
  const tv = terrainView(d, t, { bands: [[1, "#102030"], [99, "#405060"]], steep: 0.3, steepColor: "#ff0000", kinds: ["#00ff00"], light: [0, 1, 0], ambient: 1 });
  Object.assign(d.cam, { yaw: 0, pitch: 1.2, dist: 60, tx: 0, ty: 0, tz: 0 });
  cv.ctx.rec = true;
  d.draw();
  const fills = cv.ctx.fills, by = (f) => fills.filter((x) => x.fill === f).length;
  // ambient 1: every face at full brightness, shade 32 → rgb(col × (0.5 + 32/40 × 0.62)).
  const lit = (r, g, b) => `rgb(${(r * 0.996) | 0},${(g * 0.996) | 0},${(b * 0.996) | 0})`;
  assert.ok(by(lit(0x10, 0x20, 0x30)) > 100, "the low band on the flat");
  assert.ok(by(lit(0x40, 0x50, 0x60)) > 50, "the high band on the plateau");
  assert.ok(by(lit(255, 0, 0)) > 20, "steep faces in the steep colour");
  assert.ok(by(lit(0, 255, 0)) > 40, "the ribbon's kind in its colour");
  assert.equal(tv.stats.faces, fills.length);
  assert.ok(tv.stats.faces <= 32 * 32 * 2 && tv.stats.faces > 1500, `about every face once: ${tv.stats.faces}`);
  // Far to near: the first faces painted are farther (higher on screen from this camera) than the last.
  const ys = fills.map((f) => (f.pts[1] + f.pts[3] + f.pts[5]) / 3), k = (ys.length / 10) | 0;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(ys.slice(0, k)) < mean(ys.slice(-k)) - 100, "the far rows first");
  // Turned away: nothing on screen, nothing drawn.
  Object.assign(d.cam, { yaw: Math.PI, pitch: -0.3, dist: 5, tx: 0, ty: 30, tz: -40 });
  d.draw();
  assert.equal(tv.stats.faces, 0, "culled");

  // LOD: chunks past 20 units draw every 2nd vertex, past 40 every 4th; a fine edge follows its coarse neighbour's line.
  const big = terrain({ cols: 64, rows: 64, cell: 1 });
  big.noise({ seed: 9, amp: 4, scale: 5 });
  const cv2 = canvas(), d2 = diorama(cv2), lv = terrainView(d2, big, { lod: [20, 40] });
  Object.assign(d2.cam, { yaw: 0, pitch: 0.9, dist: 30, tx: 0, ty: 0, tz: 20 });
  d2.draw();
  const strides = new Set(lv.stride);
  assert.deepEqual([...strides].sort(), [1, 2, 4], "three levels of detail");
  const [NX] = lv.chunks;
  // Stitching, from the drawn triangles: no triangle edge on that border may end at an odd vertex's true height.
  cv2.ctx.rec = true;
  cv2.ctx.fills.length = 0;
  d2.draw();
  const drawn = new Set(cv2.ctx.fills.flatMap((f) => [0, 2, 4].map((q) => `${f.pts[q].toFixed(3)},${f.pts[q + 1].toFixed(3)}`)));
  let onLine = 0, off = 0;
  for (let k2 = 0; k2 < lv.stride.length; k2++) {
    if (lv.stride[k2] !== 1 || k2 % NX === NX - 1 || lv.stride[k2 + 1] !== 2) continue;
    const i = ((k2 % NX) + 1) * 8, j0 = ((k2 / NX) | 0) * 8, o = new Float64Array(3);
    for (let b = 1; b < 8; b += 2) {
      const mid = (big.at(i, j0 + b - 1) + big.at(i, j0 + b + 1)) / 2;
      d2.project(big.x0 + i, mid, big.z0 + j0 + b, o);
      if (drawn.has(`${o[0].toFixed(3)},${o[1].toFixed(3)}`)) onLine++;
      d2.project(big.x0 + i, big.at(i, j0 + b), big.z0 + j0 + b, o);
      if (Math.abs(big.at(i, j0 + b) - mid) > 1e-3 && drawn.has(`${o[0].toFixed(3)},${o[1].toFixed(3)}`)) off++;
    }
  }
  assert.ok(onLine > 0 && off === 0, `fine edge vertices drawn on the coarse line: ${onLine} on, ${off} at their own height`);
  assert.throws(() => terrainView(diorama(canvas()), big, { chunk: 6 }), RangeError);
});

test("terrain view: depth sort puts a cluster per chunk in diorama's ranking; shadows lie on the slope", () => {
  const cv = canvas(), d = diorama(cv), t = terrain({ cols: 16, rows: 16, cell: 1 });
  t.shape((x) => x * 0.5 + 4);
  const tv = terrainView(d, t, { sort: "depth", chunk: 4, shadows: 2, shadowColor: "#000000" });
  Object.assign(d.cam, { yaw: 0.4, pitch: 0.8, dist: 30, tx: 0, ty: 0, tz: 0 });
  tv.shadow(1, 2, 1, 1, 0.5);
  cv.ctx.rec = true;
  d.draw();
  d.draw();
  const shadow = cv.ctx.fills.filter((f) => f.fill === "#000000" && f.alpha === 0.5);
  assert.equal(shadow.length, 2, "the shadow, once per draw");
  // Its outline sits on the slope: project its east and west points at their ground heights.
  const o = new Float64Array(3);
  d.project(3, t.height(3, 1) + 0.03, 1, o);
  close(shadow[1].pts[0], o[0], 1e-6, "east point x on the ground");
  close(shadow[1].pts[1], o[1], 1e-6, "east point y on the ground");
  assert.equal(tv.chunks[0] * tv.chunks[1], 16);
});

test("terrain: zero allocation in queries and in drawing (ground, depth, level of detail, shadows)", async (t) => {
  const g = terrain({ cols: 64, rows: 64, cell: 1 });
  g.noise({ seed: 7, amp: 3, scale: 12 });
  g.ramp([0, 0], [5, 0], { height: 1.5 });
  const out = new Float64Array(4), S = new Float64Array(4);
  const loops = {
    sample: () => { for (let i = 0; i < 1000; i++) (S[0] = (i % 60) - 30.3), (S[1] = ((i * 7) % 60) - 29.7), g.sample(S[0], S[1], out); },
    normal: () => { for (let i = 0; i < 1000; i++) (S[0] = (i % 60) - 30.3), (S[1] = ((i * 7) % 60) - 29.7), g.normal(S[0], S[1], out); },
    height: () => { for (let i = 0; i < 1000; i++) (S[0] = (i % 60) - 30.3), (S[1] = ((i * 7) % 60) - 29.7), (S[2] += g.height(S[0], S[1])); },
  };
  for (const [name, q] of Object.entries(loops)) {
    for (let i = 0; i < 300; i++) q();
    const n = await minorGCs(() => { for (let i = 0; i < 2000; i++) q(); });
    t.diagnostic(`${name}: young GCs over 2M queries: ${n}`);
    assert.ok(n <= 1, `${name}: ${n} young GCs`);
  }
  for (const o of [{}, { sort: "depth" }, { lod: [20, 40] }]) {
    const d = diorama(canvas());
    d.add({ id: "car", size: [1.8, 0.5, 1], color: "#e04a3a" });
    Object.assign(d.cam, { yaw: 0.3, pitch: 0.6, dist: 30 });
    const bare = await minorGCs(() => { for (let i = 0; i < 3000; i++) d.draw(); });
    const tv = terrainView(d, g, { ...o, shadows: 2 });
    tv.shadow(0, 1.3, 2.1, 0.8, 0.4);
    for (let i = 0; i < 1500; i++) d.draw();
    const n = await minorGCs(() => { for (let i = 0; i < 3000; i++) (d.cam.yaw += 0.001), d.draw(); });
    t.diagnostic(`draw ${JSON.stringify(o)}: young GCs over 3k frames: ${n} (bare diorama ${bare}), ${tv.stats.faces} faces`);
    assert.ok(n <= bare + 1, `draw ${JSON.stringify(o)}: ${n} young GCs, bare ${bare}`);
  }
});
