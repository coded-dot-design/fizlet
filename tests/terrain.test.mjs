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

const { terrain, terrainView, terrainWindow } = await import("../src/terrain.ts");
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

test("terrain: a berm runs out past each end: no lump on the centre line beyond it, the bank fades to the ground over edge", () => {
  // A straight bank and a bent one (a left turn), each 4 wide with a 1 unit edge.
  for (const pts of [[-8, 0, 8, 0], [-8, 0, 0, 0, 6, -6]]) {
    const t = terrain({ cols: 80, rows: 80, cell: 0.25 });
    t.berm(pts, { width: 4, height: 1, edge: 1, side: 1 });
    const n = pts.length / 2;
    for (const [e, p] of [[0, 1], [n - 1, n - 2]]) {
      // Out of the end along the end segment's direction: the centre line's height (0.25 inside) only falls.
      const ex = pts[e * 2], ez = pts[e * 2 + 1], dx = ex - pts[p * 2], dz = ez - pts[p * 2 + 1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
      const inside = t.height(ex - ux * 0.5, ez - uz * 0.5);
      close(inside, 0.25, 0.03, `the bank's centre just inside end ${e}`);
      let last = inside;
      for (let s = 0; s <= 3; s += 0.125) {
        const y = t.height(ex + ux * s, ez + uz * s);
        assert.ok(y <= last + 1e-9, `end ${e}, ${s} past it: ${y.toFixed(3)} after ${last.toFixed(3)} (no lump)`);
        last = y;
      }
      close(t.height(ex + ux * 1.25, ez + uz * 1.25), 0, 1e-9, `flat ground ${1.25} past end ${e}`);
      // The outside of the bank (its high side) runs out the same way.
      const sg = e === 0 ? -1 : 1, ox = ex - sg * uz * 2, oz = ez + sg * ux * 2; // right of travel (u points out of the end: against travel at the start)
      assert.ok(t.height(ox - ux * 0.5, oz - uz * 0.5) > 0.85, "the high side just inside the end");
      assert.ok(t.height(ox + ux * 0.5, oz + uz * 0.5) < t.height(ox, oz) && t.height(ox + ux * 1.25, oz + uz * 1.25) === 0, "and runs out past it");
    }
  }
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

/** A sharp dune crest across the fixed diagonal: the crest line x + z = 0 runs through vertices, a
 *  gentle windward side (slope 0.3 along x + z) and a steep slip face (1.5). Exact on adaptive cells. */
const dune = (x, z) => (x + z < 0 ? 3 + 0.3 * (x + z) : 3 - 1.5 * (x + z));

test("terrain: split adaptive follows a crest: heights exact on the ridge, normals agree with slopes, kinds in range", () => {
  const fixed = terrain({ cols: 24, rows: 24, cell: 1 }), ad = terrain({ cols: 24, rows: 24, cell: 1, split: "adaptive" });
  fixed.shape(dune); ad.shape(dune);
  assert.equal(fixed.split, "fixed");
  assert.equal(ad.split, "adaptive");
  let eF = 0, eA = 0;
  for (let k = 0, r = 12345; k < 4000; k++) {
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    const x = (r & 0xffff) / 3277 - 10, z = (r >>> 16) / 3277 - 10;
    eF = Math.max(eF, Math.abs(fixed.height(x, z) - dune(x, z)));
    eA = Math.max(eA, Math.abs(ad.height(x, z) - dune(x, z)));
  }
  assert.ok(eF > 0.4, `the fixed diagonal cuts the crest: max error ${eF}`);
  assert.ok(eA < 1e-9, `the adaptive one lies on it: max error ${eA}`);
  // Both triangles of a split-along-10–01 cell: height continuous, normal from the face's own slopes.
  const t = terrain({ cols: 1, rows: 1, cell: 2, x0: 0, z0: 0, split: "adaptive", heights: [0, 3, 1, 3.2] });
  for (const [i, j, h] of [[0, 0, 0], [1, 0, 3], [0, 1, 1], [1, 1, 3.2]]) close(t.height(i * 2, j * 2), h, 1e-12, `vertex ${i},${j}`);
  close(t.height(1, 1), 2, 1e-12, "on the 10–01 diagonal: the mean of its ends");
  const n = new Float64Array(3), o = new Float64Array(4);
  for (const [x, z] of [[0.4, 0.5], [1.6, 1.3]]) {
    const e = 1e-4, sx = (t.height(x + e, z) - t.height(x - e, z)) / (2 * e), sz = (t.height(x, z + e) - t.height(x, z - e)) / (2 * e), l = Math.sqrt(sx * sx + sz * sz + 1);
    t.normal(x, z, n);
    close(n[0], -sx / l, 1e-6, "nx"); close(n[1], 1 / l, 1e-6, "ny"); close(n[2], -sz / l, 1e-6, "nz");
  }
  t.kind[0] = 7; t.kind[1] = 9;
  assert.equal(t.sample(1.6, 1.3, o), 7, "the triangle with 11 is kind's first");
  assert.equal(t.kindAt(0.4, 0.5), 9, "the one with 00 its second");
  // A tie (flat, or the same difference both ways) keeps the fixed diagonal.
  const flat = terrain({ cols: 1, rows: 1, cell: 1, x0: 0, z0: 0, split: "adaptive", heights: [0, 2, 1, -1] });
  close(flat.height(0.3, 0.6), 0, 1e-12, "tie: split along 00–11 (along 10–01 it would be 1.2)");
});

test("terrain view: split adaptive draws a sharp crest as one straight fold (no stair-step faces); default is bit for bit 0.25.0", () => {
  // Shades: every face is either the windward slope's or the slip face's; a fold face across the crest has its own.
  const fills = (shape, split, yaw) => {
    const cv = canvas(), d = diorama(cv), t = terrain({ cols: 24, rows: 24, cell: 1 });
    t.shape(shape);
    terrainView(d, t, { light: [0.6, 1, 0.6], ambient: 0.3, steep: 1, split });
    Object.assign(d.cam, { yaw, pitch: 0.7, dist: 30, tx: 0, ty: 0, tz: 0 });
    cv.ctx.rec = true;
    d.draw();
    return cv.ctx.fills.map((f) => f.fill);
  };
  // The two sides' own shades: each plane alone.
  const pure = new Set([fills((x, z) => 3 + 0.3 * (x + z), undefined, 0.4)[0], fills((x, z) => 3 - 1.5 * (x + z), undefined, 0.4)[0]]);
  assert.equal(pure.size, 2);
  for (const yaw of [0.4, 2.2, -2.5]) {
    const stair = (split) => fills(dune, split, yaw).filter((f) => !pure.has(f)).length;
    const f = stair(undefined), a = stair("adaptive");
    assert.ok(f >= 10, `fixed: fold faces (stair-steps) along the crest at yaw ${yaw}: ${f}`);
    assert.equal(a, 0, `adaptive: every face is the windward or the slip face's shade at yaw ${yaw}`);
  }
  // The view takes the terrain's split by default; its own option overrides it.
  const cv = canvas(), d = diorama(cv), t = terrain({ cols: 8, rows: 8, split: "adaptive" });
  t.shape(dune);
  terrainView(d, t, { light: [0.6, 1, 0.6], ambient: 0.3, steep: 1 });
  Object.assign(d.cam, { yaw: 0.4, pitch: 0.7, dist: 20, tx: 0, ty: 0, tz: 0 });
  cv.ctx.rec = true;
  d.draw();
  assert.equal(new Set(cv.ctx.fills.map((x) => x.fill)).size, 2, "inherits adaptive from the terrain");

  // Default options, drawn and queried: the same strings and numbers as 0.25.0, hashed (FNV-1a).
  class Rec { constructor() { this.s = ""; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; }
    setTransform() {} fillRect() {} clearRect() {} arc() {} closePath() {}
    beginPath() { this.s += "B"; } moveTo(x, y) { this.s += "M" + x.toFixed(4) + "," + y.toFixed(4); } lineTo(x, y) { this.s += "L" + x.toFixed(4) + "," + y.toFixed(4); }
    fill() { this.s += "F" + this.fillStyle; } stroke() { this.s += "S"; } }
  const ctx = new Rec(), d0 = diorama({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx });
  const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
  const g = terrain({ cols: 48, rows: 48, cell: 1 });
  g.noise({ seed: 5, amp: 4, scale: 9, ridge: 0.8, wind: [1, 0.4], stretch: 3 });
  g.ribbon([-20, 3, 20, 5], { width: 3, kind: 1 });
  let q = "";
  const o = new Float64Array(4);
  for (let i = 0; i < 400; i++) q += g.sample((i % 20) * 2.3 - 23, ((i * 7) % 20) * 2.3 - 23, o) + o.join(",");
  const tv = terrainView(d0, g, { bands: [[1, "#102030"], [2.5, "#405060"], [99, "#a0b0c0"]], steep: 0.5, steepColor: "#200010", kinds: ["#00ff00"], lod: [14, 26], shadows: 1 });
  tv.shadow(0, 1, 2, 1, 0.5);
  for (const [yaw, pitch, dist] of [[0.3, 0.6, 30], [2.1, 0.35, 18], [-1.2, 0.9, 40]]) Object.assign(d0.cam, { yaw, pitch, dist, tx: 0, ty: 0, tz: 0 }), d0.draw();
  assert.equal(fnv(q), "4ef791d5", "queries as 0.25.0");
  assert.equal(fnv(ctx.s), "95ee5913", "drawing as 0.25.0");
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
  const ga = terrain({ cols: 64, rows: 64, cell: 1, split: "adaptive" });
  ga.h.set(g.h);
  loops.adaptive = () => { for (let i = 0; i < 1000; i++) (S[0] = (i % 60) - 30.3), (S[1] = ((i * 7) % 60) - 29.7), ga.sample(S[0], S[1], out); };
  for (const [name, q] of Object.entries(loops)) {
    for (let i = 0; i < 300; i++) q();
    const n = await minorGCs(() => { for (let i = 0; i < 2000; i++) q(); });
    t.diagnostic(`${name}: young GCs over 2M queries: ${n}`);
    assert.ok(n <= 1, `${name}: ${n} young GCs`);
  }
  for (const o of [{}, { sort: "depth" }, { lod: [20, 40] }, { lod: [20, 40], split: "adaptive" }]) {
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

// terrainWindow: a terrain that slides over a pure ground. The ground here: a hash per vertex and per
// 8-vertex block (rough, so adaptive cells flip both ways) and kinds on some cells, written straight
// into the window's arrays by lattice point (only integers cross the fill call).
const hsh = (i, j, s) => {
  let n = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s, 0x9e3779b1);
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
};
const ground = (seed) => (i0, j0, i1, j1, t) => {
  const W1 = t.cols + 1, oi = t.origin[0], oj = t.origin[1], h = t.h, kind = t.kind, c = t.cell;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const gi = oi + i, gj = oj + j, x = gi * c;
      h[j * W1 + i] = 2 * hsh(gi >> 3, gj >> 3, seed) + 0.6 * hsh(gi, gj, seed + 1) + Math.sqrt(x * x * 1e-4 + 1);
    }
  for (let j = j0; j < j1; j++)
    for (let i = i0; i < i1; i++) {
      const k = hsh(oi + i, oj + j, seed + 2) < 0.2 ? 1 : 0, q = (j * t.cols + i) * 2;
      kind[q] = k; kind[q + 1] = k * 2;
    }
};
/** A plain terrain at lattice point (oi, oj), filled whole by the same ground. */
const fixedAt = (o, oi, oj, seed) => {
  const t = terrain({ cols: o.cols, rows: o.rows ?? o.cols, cell: o.cell, split: o.split, x0: oi * o.cell, z0: oj * o.cell });
  ground(seed)(0, 0, t.cols, t.rows, { ...t, h: t.h, kind: t.kind, origin: [oi, oj] });
  return t;
};
const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

test("terrainWindow: after 200 random slides it equals a fresh terrain at its place, bit for bit (heights, kinds, queries)", () => {
  for (const o of [{ cols: 32, rows: 24, cell: 0.5, step: 8, split: "adaptive" }, { cols: 20, cell: 1.25, step: 4 }]) {
    const w = terrainWindow({ ...o, fill: ground(11) }), r = lcg(5), out = new Float64Array(4), ref = new Float64Array(4), n = new Float64Array(3), m = new Float64Array(3);
    assert.equal(w.split, o.split || "fixed");
    assert.equal(w.rows, o.rows ?? o.cols, "rows default to cols");
    let x = 3.3, z = -7.1;
    for (let s = 0; s < 200; s++) {
      // Walks (follow), short jumps and far ones (a whole refill) by moveTo, in any direction.
      const pick = r();
      if (pick < 0.5) { x += (r() - 0.5) * 40; z += (r() - 0.5) * 40; w.follow(x, z); }
      else if (pick < 0.85) w.moveTo(w.origin[0] + Math.floor((r() - 0.5) * 2 * (o.cols - 1)), w.origin[1] + Math.floor((r() - 0.5) * 2 * (w.rows - 1)));
      else w.moveTo(Math.floor((r() - 0.5) * 4000), Math.floor((r() - 0.5) * 4000));
      const f = fixedAt(o, w.origin[0], w.origin[1], 11);
      assert.equal(w.x0, f.x0); assert.equal(w.z0, f.z0);
      assert.deepEqual(new Uint8Array(w.h.buffer), new Uint8Array(f.h.buffer), `heights after slide ${s}`);
      assert.deepEqual(w.kind, f.kind, `kinds after slide ${s}`);
      for (let q = 0; q < 40; q++) {
        // Points inside and a little past the edges (clamped like a fixed terrain's).
        const px = w.x0 + (r() * 1.1 - 0.05) * w.cols * w.cell, pz = w.z0 + (r() * 1.1 - 0.05) * w.rows * w.cell;
        assert.equal(w.sample(px, pz, out), f.sample(px, pz, ref));
        assert.deepEqual(out, ref);
        assert.equal(w.height(px, pz), f.height(px, pz));
        assert.deepEqual(w.normal(px, pz, n), f.normal(px, pz, m));
        assert.equal(w.kindAt(px, pz), f.kindAt(px, pz));
      }
    }
  }
});

test("terrainWindow: only the new strips are filled; version bumps once per slide; follow slides by whole steps", () => {
  const calls = [], g = ground(3);
  const w = terrainWindow({ cols: 32, rows: 32, cell: 0.5, step: 8, fill: (i0, j0, i1, j1, t) => (calls.push([i0, j0, i1, j1]), g(i0, j0, i1, j1, t)) });
  assert.equal(w.version, 0);
  assert.equal(calls.length, 0, "nothing filled before the first move");
  assert.equal(w.follow(0.1, 0.1), true);
  assert.deepEqual(calls, [[0, 0, 32, 32]], "the first move fills it all");
  assert.deepEqual([w.stats.slides, w.stats.filled, w.version], [1, 33 * 33, 1]);
  // (0.1, 0.1) is in step cell 0 (cells 0..7): the window's middle step, origin −16 + 4 = −12.
  assert.deepEqual(Array.from(w.origin), [-12, -12]);
  assert.equal(w.follow(3.9, 3.9), false, "inside the middle step: no slide");
  assert.equal(w.version, 1);
  // One step along +x: 8 new vertex columns (+ the one kept column the range takes), all rows.
  calls.length = 0;
  assert.equal(w.follow(4.1, 0), true);
  assert.deepEqual(calls, [[24, 0, 32, 32]]);
  assert.deepEqual([w.stats.slides, w.stats.filled, w.version, w.x0], [2, 33 * 33 + 9 * 33, 2, -4 * 0.5]);
  // A diagonal step back (−x, −z): the new rows first, then the new columns beside the kept rows.
  calls.length = 0;
  w.moveTo(w.origin[0] - 8, w.origin[1] - 8);
  assert.deepEqual(calls, [[0, 0, 32, 8], [0, 8, 8, 32]]);
  // +x +z, and an odd stride: every new vertex and cell covered, nothing else but one kept line each.
  calls.length = 0;
  w.moveTo(w.origin[0] + 5, w.origin[1] + 3);
  assert.deepEqual(calls, [[0, 29, 32, 32], [27, 0, 32, 29]]);
  assert.equal(w.moveTo(w.origin[0], w.origin[1]), false, "no move, no fill, no bump");
  assert.equal(w.version, 4);
  // A jump past the window: a whole refill.
  calls.length = 0;
  w.moveTo(500, -500);
  assert.deepEqual(calls, [[0, 0, 32, 32]]);
});

test("terrainWindow: the same seed streams the same bytes; the surface is continuous across slides and strip seams", () => {
  const walk = (seed) => {
    const w = terrainWindow({ cols: 48, cell: 0.5, step: 8, split: "adaptive", fill: ground(seed) }), H = new Float64Array(400);
    let k = 0;
    for (let s = 0; s < 4000; s++) {
      const x = s * 0.37, z = Math.sqrt(s) * 3 - s * 0.11;
      w.follow(x, z);
      if (s % 10 === 0) H[k++] = w.height(x, z);
    }
    return [new Uint8Array(w.h.buffer).join(), new Uint8Array(H.buffer).join(), w.stats.slides];
  };
  const a = walk(42), b = walk(42), c = walk(43);
  assert.ok(a[2] > 60, `it streamed: ${a[2]} slides`);
  assert.deepEqual(a, b, "same seed, same window bytes and the same heights on the way");
  assert.notEqual(a[0], c[0], "another seed, another ground");
  // A point kept across a slide reads the same height before and after (only the origin moved).
  const w = terrainWindow({ cols: 48, cell: 0.5, step: 8, split: "adaptive", fill: ground(9) }), r = lcg(77);
  w.follow(0, 0);
  for (let s = 0; s < 60; s++) {
    const pts = [];
    for (let q = 0; q < 50; q++) pts.push(w.x0 + (0.4 + r() * 0.2) * 24, w.z0 + (0.4 + r() * 0.2) * 24);
    const before = pts.map((_, q) => (q & 1 ? 0 : w.height(pts[q], pts[q + 1])));
    w.moveTo(w.origin[0] + ((s & 3) - 1.5 > 0 ? 8 : -8), w.origin[1] + (s % 3) - 1);
    pts.forEach((_, q) => q & 1 || close(w.height(pts[q], pts[q + 1]), before[q], 1e-9, `kept point after slide ${s}`));
  }
  // Across the seam a slide leaves (between the kept columns and the filled ones) the surface has no
  // step: walking a line over it, each move between samples a hundredth of a cell apart stays tiny.
  const t = terrainWindow({ cols: 32, cell: 1, step: 8, split: "adaptive", fill: ground(2) });
  t.moveTo(0, 0); t.moveTo(8, 3);
  const seam = t.x0 + 24, zz = t.z0 + 10.37;
  let prev = t.height(seam - 2, zz), worst = 0;
  for (let x = seam - 2; x <= seam + 2; x += 0.01) worst = Math.max(worst, Math.abs(t.height(x, zz) - prev)), (prev = t.height(x, zz));
  assert.ok(worst < 0.05, `no step at the seam: ${worst}`);
});

test("terrainWindow: its view re-anchors on every slide and draws what a fixed terrain at that place draws", () => {
  for (const vo of [{}, { lod: [10, 20] }, { sort: "depth", lod: [12] }]) {
    const o = { cols: 32, rows: 32, cell: 0.5, split: "adaptive" };
    const cw = canvas(), dw = diorama(cw), w = terrainWindow({ ...o, step: 8, fill: ground(4) });
    w.follow(0, 0);
    const tw = terrainView(dw, w, { ...vo, kinds: ["#556677", "#887766"], shadows: 1 });
    for (const [x, z, yaw] of [[0, 0, 0.3], [9.3, 2.1, 1.2], [21, -14, -2.4], [-30, 40, 2.9]]) {
      w.follow(x, z);
      const cf = canvas(), df = diorama(cf), f = fixedAt(o, w.origin[0], w.origin[1], 4);
      const tf = terrainView(df, f, { ...vo, kinds: ["#556677", "#887766"], shadows: 1 });
      for (const [d, v] of [[dw, tw], [df, tf]]) Object.assign(d.cam, { yaw, pitch: 0.6, dist: 14, tx: x, ty: 0, tz: z }), v.shadow(0, x, z, 0.8, 0.3);
      // Depth mode ranks chunks on anchors from the last update (diorama ranks clusters before the
      // view's first decal runs): the fresh view's are from before its camera was set, so both update.
      tw.update(); tf.update();
      cw.ctx.rec = cf.ctx.rec = true;
      cw.ctx.fills.length = 0;
      dw.draw(); df.draw();
      assert.ok(tw.stats.faces > 200, `${JSON.stringify(vo)} at ${x},${z}: faces drawn ${tw.stats.faces}`);
      assert.deepEqual(cw.ctx.fills, cf.ctx.fills, `${JSON.stringify(vo)} at ${x},${z}: the same faces, places and shades`);
    }
  }
});

test("terrainWindow: zero allocation while streaming 10 km (follow and a wheel's sample every step)", async (t) => {
  const w = terrainWindow({ cols: 64, cell: 0.5, step: 8, split: "adaptive", fill: ground(1) }), out = new Float64Array(4), S = new Float64Array(3);
  // 10 km at 0.1 a step, bending: 100,000 follows and samples, a slide every 4 units of travel.
  const run = () => {
    for (let s = 0; s < 100000; s++) {
      S[0] += 0.1; S[1] += S[2] * 0.1; S[2] = S[2] > 0.5 ? -0.5 : S[2] + 0.0001;
      w.follow(S[0], S[1]);
      w.sample(S[0], S[1], out);
    }
  };
  run();
  const s0 = w.stats.slides, n = await minorGCs(run);
  t.diagnostic(`young GCs over 10 km (${w.stats.slides - s0} slides): ${n}`);
  assert.ok(w.stats.slides - s0 > 2000, `it streamed: ${w.stats.slides - s0} slides`);
  assert.ok(n <= 1, `${n} young GCs`);
});
