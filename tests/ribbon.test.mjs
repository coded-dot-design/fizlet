// @fzlt/core/ribbon in Node (a recording canvas): a band paints as one decal in the ground's cluster,
// its pieces are where the diorama projects the band's corners (its true width, not the grid's), a
// straight band's two edges stay exactly `to - from` apart at every piece and a curve's mitred joints
// keep the width, every corner sits on the ground's height (the terrain's own sample), pieces behind
// the camera are clipped and off-screen ones culled, one fill per colour and shade, far buckets first,
// `hide` drops a band behind a ridge, `cap` drops and counts, and painting every frame allocates nothing.
// The four additions: a scene that uses none of them issues the very canvas commands of the brick
// before them (a hash of 60,507 path commands over 40 views); `runs` changes a band's colour along the line,
// with gaps and a period; `bands` under-laps and files a row in one bucket; `cut` clips at the crest
// instead of painting through the hill; the public pieces paint a layout's own polygons in one winding;
// and all of it together still allocates nothing per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { terrain, terrainView } = await import("../src/terrain.ts");
const { ribbon } = await import("../src/ribbon.ts");

/** A canvas context that records paths (point lists) and fills (with their style). */
class Rec {
  constructor() { this.paths = []; this.fills = []; this.cur = null; this.fillStyle = ""; this.rec = true; this.log = null; }
  setTransform() {} fillRect() {} clearRect() {} arc() {} stroke() {} save() {} restore() {} rect() {} clip() {} ellipse() {} strokeRect() {} drawImage() {}
  beginPath() { if (this.log) this.log.push("b"); if (this.rec) this.cur = []; }
  moveTo(x, y) { if (this.log) this.log.push("m" + x + "," + y); if (this.rec) this.cur.push([[x, y]]); }
  lineTo(x, y) { if (this.log) this.log.push("l" + x + "," + y); if (this.rec && this.cur) this.cur.at(-1)?.push([x, y]); }
  closePath() { if (this.log) this.log.push("c"); }
  fill() { if (this.log) this.log.push("f" + this.fillStyle); if (this.rec && this.cur) this.fills.push({ style: this.fillStyle, polys: this.cur }); }
}
const scene = (ctx) => {
  const d = diorama({ clientWidth: 640, clientHeight: 400, width: 0, height: 0, getContext: () => ctx });
  Object.assign(d.cam, { yaw: 0.3, pitch: 0.7, dist: 16, tx: 0, ty: 0, tz: 0, fov: 0.8 });
  return d;
};
const flat = () => terrain({ cols: 32, rows: 32, cell: 1, x0: -16, z0: -16 });
const near = (a, b, e, m = "") => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);

test("ribbon: a straight band on flat ground lands where the diorama projects its corners", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  const r = ribbon(d, t, { step: 2, buckets: 1 });
  r.band([-6, 0, 6, 0], -1, 1, "#d08040");
  ctx.rec = false; d.draw(); ctx.rec = true; ctx.fills.length = 0;
  d.draw();
  const polys = ctx.fills.flatMap((f) => f.polys);
  assert.equal(r.stats.pieces, 6, "12 units in steps of 2");
  assert.equal(polys.length, 6);
  assert.ok(r.stats.fills >= 1 && r.stats.fills <= 6 && ctx.fills.length === r.stats.fills, `one fill per shade: ${r.stats.fills}`);
  // The band's far ends, projected by the diorama, are corners of the first and last pieces.
  const P = new Float64Array(3);
  const has = (x, z) => {
    d.project(x, 0.004, z, P);
    return polys.some((poly) => poly.some(([px, py]) => Math.abs(px - P[0]) < 1e-6 && Math.abs(py - P[1]) < 1e-6));
  };
  for (const [x, z] of [[-6, -1], [-6, 1], [6, -1], [6, 1]]) assert.ok(has(x, z), `corner (${x}, ${z}) painted`);
});

test("ribbon: corners on the ground's height (the terrain's own sample); a curve's mitred joints keep the width", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  t.noise({ seed: 3, amp: 1.5 });
  const r = ribbon(d, t, { step: 0.5, buckets: 1, lift: 0 });
  // A closed square loop: four 90° joints.
  const loop = [-5, -5, 5, -5, 5, 5, -5, 5];
  r.band(loop, -0.8, 0.8, "#808080", true);
  const S = new Float64Array(4);
  ctx.rec = false;
  d.draw();
  assert.ok(r.stats.pieces >= 80, `pieces: ${r.stats.pieces}`);
  // Draped, and the width at a joint: the mitred offsets of corner (5, -5) reach (5 ± 0.8, -5 ∓ 0.8), the miter √2 × 0.8.
  const g = { h: t.h, x0: t.x0, z0: t.z0, cols: t.cols, rows: t.rows, cell: t.cell };
  const ctx2 = new Rec(), d2 = scene(ctx2), r2 = ribbon(d2, g, { step: 10, buckets: 1, lift: 0 });
  r2.band(loop, -0.8, 0.8, "#808080", true);
  d2.draw();
  const P = new Float64Array(3);
  const polys = ctx2.fills.flatMap((f) => f.polys);
  for (const [x, z] of [[5.8, -5.8], [4.2, -4.2]]) {
    t.sample(x, z, S);
    d2.project(x, S[0], z, P);
    assert.ok(polys.some((poly) => poly.some(([px, py]) => Math.abs(px - P[0]) < 1e-6 && Math.abs(py - P[1]) < 1e-6)), `mitred corner (${x}, ${z}) on the ground`);
  }
});

test("ribbon: clipped at the near plane, culled off screen, hidden behind a ridge, capped", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  Object.assign(d.cam, { yaw: 0, pitch: 0.12, dist: 6, tx: 0, ty: 0.5, tz: 0 });
  const r = ribbon(d, t, { step: 1, buckets: 4 });
  // A band from far in front to far behind the eye (at z ≈ 6): pieces behind are dropped or cut.
  r.band([0, -14, 0, 14], -0.5, 0.5, "#ffffff");
  ctx.rec = false; d.draw(); ctx.rec = true; ctx.fills.length = 0; d.draw();
  const polys = ctx.fills.flatMap((f) => f.polys);
  assert.ok(r.stats.pieces > 5 && r.stats.pieces < 28, `some pieces, not all 28: ${r.stats.pieces}`);
  for (const poly of polys) for (const [x, y] of poly) assert.ok(Number.isFinite(x) && Number.isFinite(y) && y > -1e4 && y < 1e4, "clipped, finite");
  // Far first: the first fill's pieces are higher on screen (farther) than the last's.
  const meanY = (f) => { const p = f.polys.flat(); return p.reduce((a, q) => a + q[1], 0) / p.length; };
  assert.ok(meanY(ctx.fills[0]) <= meanY(ctx.fills.at(-1)), "painted far to near");
  // Off screen: a band far to the side paints nothing.
  r.clear();
  r.band([200, -5, 200, 5], -1, 1, "#ffffff");
  d.draw();
  assert.equal(r.stats.pieces, 0, "culled");
  // A ridge between the eye and a band: `hide` drops it, without it the band is painted.
  const t2 = flat();
  for (let j = 0; j <= 32; j++) for (let i = 0; i <= 32; i++) t2.h[j * 33 + i] = Math.abs(j - 16 - 2) <= 1 ? 3 : 0;
  for (const hide of [false, true]) {
    const c3 = new Rec(), d3 = scene(c3);
    Object.assign(d3.cam, { yaw: 0, pitch: 0.15, dist: 14, tx: 0, ty: 0, tz: 0 });
    const r3 = ribbon(d3, t2, { step: 1, hide });
    r3.band([-3, -8, 3, -8], -0.5, 0.5, "#ffffff");
    d3.draw();
    if (hide) assert.equal(r3.stats.pieces, 0, "behind the ridge: hidden");
    else assert.ok(r3.stats.pieces > 0, "painted without hide");
  }
  // Cap: past it, pieces are dropped and counted.
  const d4 = scene(new Rec());
  const r5 = ribbon(d4, t, { step: 0.25, cap: 10 });
  r5.band([-6, 0, 6, 0], -1, 1, "#ffffff");
  d4.draw();
  assert.ok(r5.stats.pieces === 10 && r5.stats.dropped > 0, `capped: ${r5.stats.pieces}, dropped ${r5.stats.dropped}`);
});

test("ribbon: bad options throw; a one-point line throws", () => {
  const d = scene(new Rec()), t = flat();
  assert.throws(() => ribbon(d, t, { step: 0 }), RangeError);
  assert.throws(() => ribbon(d, t).band([0, 0], -1, 1, "#ffffff"), RangeError);
});

test("ribbon: painting a track with edge strips every frame allocates nothing", async (t) => {
  const ctx = new Rec(), d = scene(ctx), tr = flat();
  tr.noise({ seed: 5, amp: 1 });
  terrainView(d, tr, { bands: [[Infinity, "#9c7a55"]] });
  const r = ribbon(d, tr, { step: 0.5, hide: true });
  const loop = [];
  for (let i = 0; i < 24; i++) loop.push(Math.cos((i / 24) * 6.283) * 9, Math.sin((i / 24) * 6.283) * 6);
  r.band(loop, -1.5, 1.5, "#c8a070", true);
  r.band(loop, -1.8, -1.5, "#f0f0e0", true);
  r.band(loop, 1.5, 1.8, "#f0f0e0", true);
  ctx.rec = false;
  let f = 0;
  const frames = (n, on) => { for (let k = 0; k < n; k++, f++) if (on) (d.cam.yaw = f * 0.01), d.draw(); };
  frames(200, true);
  const bare = await minorGCs(() => frames(2000, false)), withRibbon = await minorGCs(() => frames(2000, true));
  // The diorama's own draw allocates nothing per frame either (its own test); this one adds the decal.
  t.diagnostic(`young GCs over 2,000 frames (best of 3 windows): bare ${bare}, drawn ${withRibbon}; pieces ${r.stats.pieces}`);
  assert.ok(r.stats.pieces > 50);
  assert.ok(withRibbon <= bare, `painting allocates: ${withRibbon} young GCs (bare ${bare})`);
});

test("ribbon: a scene with none of the additions issues the same canvas commands as before them", () => {
  // Every path call (with its numbers in full) and fill style of 40 views (yaw, pitch and distance
  // vary: near clips, culls, hides) of a closed track, two strips and an open band on hills, hashed.
  // The hash is the one the brick gave before runs, bands, cut and the public pieces (commit 7043a16).
  const log = [], ctx = new Rec();
  ctx.rec = false; ctx.log = log;
  const d = scene(ctx), t = flat();
  t.noise({ seed: 5, amp: 2.5 });
  const r = ribbon(d, t, { step: 0.5, hide: true });
  const loop = [];
  for (let i = 0; i < 24; i++) loop.push(Math.cos((i / 24) * 6.283) * 9, Math.sin((i / 24) * 6.283) * 6);
  r.band(loop, -1.5, 1.5, "#c8a070", true);
  r.band(loop, -1.8, -1.5, "#f0f0e0", true);
  r.band(loop, 1.5, 1.8, "#f0f0e0", true);
  r.band([-12, -9, -2, 3, 6, 4, 13, 12], -0.4, 0.4, "#405060");
  let pieces = 0;
  for (let f = 0; f < 40; f++) { d.cam.yaw = f * 0.16; d.cam.pitch = 0.15 + (f % 7) * 0.1; d.cam.dist = 6 + (f % 5) * 5; d.draw(); pieces += r.stats.pieces; }
  assert.equal(pieces, 11741);
  assert.equal(log.length, 60507);
  assert.equal(createHash("sha256").update(log.join("\n")).digest("hex"), "9711f00428f8ba9cbeb7989c2baf8bcc57d9ff3ae8edd459bb07f4e8748e2deb");
});

/** Draw once and return the fills' polygons with their style; `has(polys, x, y, z)`: a corner there. */
const drawn = (ctx, d) => { ctx.fills.length = 0; d.draw(); return ctx.fills.flatMap((f) => f.polys.map((poly) => ({ poly, style: f.style }))); };
const corner = (d, polys, x, z, y = 0.004) => {
  const P = new Float64Array(3);
  d.project(x, y, z, P);
  return polys.findIndex(({ poly }) => poly.some(([px, py]) => Math.abs(px - P[0]) < 1e-6 && Math.abs(py - P[1]) < 1e-6));
};

test("ribbon runs: the colour changes along the line at exact distances, with gaps and a period", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  const r = ribbon(d, t, { step: 2, buckets: 1 });
  // A dashed line: 2 units on, 2 off, along 12 units: three dashes of one piece each, and nothing between.
  r.band([-6, 0, 6, 0], -1, 1, "#ffffff", false, { at: [2], colors: [null], period: 4 });
  let polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 3, "three dashes");
  for (const x of [-6, -4, -2, 0, 2, 4]) for (const z of [-1, 1]) assert.ok(corner(d, polys, x, z) >= 0, `a dash ends at x ${x}`);
  for (const x of [-3, 1, 5, 6]) assert.equal(corner(d, polys, x, 1), -1, `nothing at x ${x}: a gap`);
  // A run boundary inside a segment and off the step grid: the colour changes exactly there, each
  // stretch cut into its own pieces (3 units: 2, then 9 units: 5).
  r.clear();
  r.band([-6, 0, 6, 0], -1, 1, "#ff0000", false, { at: [3], colors: ["#0000ff"] });
  polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 7);
  const red = polys.filter((q) => /^rgb\((\d+),0,0\)$/.test(q.style)), blue = polys.filter((q) => /^rgb\(0,0,(\d+)\)$/.test(q.style));
  assert.equal(red.length, 2); assert.equal(blue.length, 5);
  assert.ok(corner(d, red, -3, 1) >= 0 && corner(d, blue, -3, 1) >= 0, "red ends and blue starts at 3 units along");
  assert.equal(corner(d, red, 6, 1), -1);
  // A kerb that alternates round a closed loop (period 1.5: 0.75 red, 0.75 white), and a band with
  // no colour of its own, painted only where its runs say (a strip that stops and starts).
  r.clear();
  const loop = [-5, -5, 5, -5, 5, 5, -5, 5];
  r.band(loop, 1, 1.3, "#ff0000", true, { at: [0.75], colors: ["#ffffff"], period: 1.5 });
  polys = drawn(ctx, d);
  const reds = polys.filter((q) => /^rgb\((\d+),0,0\)$/.test(q.style)).length, whites = polys.length - reds;
  assert.ok(reds >= 26 && Math.abs(reds - whites) <= 1, `40 units in 0.75s: ${reds} red, ${whites} white`);
  r.clear();
  r.band([-6, 0, 6, 0], -1, 1, null, false, { at: [4, 8], colors: ["#00ff00", null] });
  polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 2, "only 4..8 units along");
  assert.ok(corner(d, polys, -2, 1) >= 0 && corner(d, polys, 2, 1) >= 0 && corner(d, polys, -6, 1) < 0 && corner(d, polys, 6, 1) < 0);
});

test("ribbon bands: a band reaches under the neighbour painted over it, and a row shares one bucket", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  // The line runs across the view (along x), the camera low: the three bands lie at three depths.
  Object.assign(d.cam, { yaw: 0, pitch: 0.35, dist: 14 });
  const r = ribbon(d, t, { step: 2, buckets: 48 });
  // Run-off, asphalt, run-off: the run-off's colour is made first, so it reaches under the asphalt.
  assert.equal(r.bands([-6, 0, 6, 0], [-2, -1, 1, 2], ["#00aa00", "#333333", "#00aa00"]), 0);
  let polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 18);
  const green = polys.filter((q) => /^rgb\(0,\d+,0\)$/.test(q.style)), grey = polys.filter((q) => !/^rgb\(0,\d+,0\)$/.test(q.style));
  for (const z of [-2, -0.85, 0.85, 2]) assert.ok(corner(d, green, 6, z) >= 0, `run-off edge at ${z}`);
  for (const z of [-1, 1]) assert.ok(corner(d, grey, 6, z) >= 0 && corner(d, green, 6, z) < 0, `asphalt edge at ${z}, no run-off edge there`);
  // In every row the asphalt is painted after both run-offs (its far one would sit in a farther
  // bucket by its own depth, its near one in a nearer).
  for (const x of [-4, -2, 0, 2, 4, 6]) {
    const a = corner(d, polys, x, 1), g0 = corner(d, polys, x, -2), g1 = corner(d, polys, x, 2);
    assert.ok(a > g0 && a > g1 && g0 >= 0 && g1 >= 0, `row at x ${x}: asphalt (${a}) over the run-offs (${g0}, ${g1})`);
  }
  // lap 0: edge to edge. A null colour leaves its band out; runs per band.
  r.clear();
  r.bands([-6, 0, 6, 0], [-2, -1, 1, 2], ["#00aa00", null, "#00aa00"], { lap: 0, runs: [null, null, { at: [6], colors: [null] }] });
  polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 9, "6 pieces, and 3 of the band that stops half way");
  assert.ok(corner(d, polys, 6, -1) >= 0 && corner(d, polys, 6, -0.85) < 0 && corner(d, polys, 6, 1) < 0 && corner(d, polys, 0, 1) >= 0);
});

test("ribbon cut: a band that goes over a crest is clipped at the crest, not painted through the hill", () => {
  // A round ridge across the view; a band from in front of it, over it, down its far side.
  const t2 = flat();
  for (let j = 0; j <= 32; j++) for (let i = 0; i <= 32; i++) t2.h[j * 33 + i] = 3 * Math.exp(-(((j - 16) / 3) ** 2));
  const out = {};
  for (const mode of ["hide", "cut"]) {
    const ctx = new Rec(), d = scene(ctx);
    Object.assign(d.cam, { yaw: 0.2, pitch: 0.25, dist: 14, tx: 0, ty: 0, tz: 4 });
    const r = ribbon(d, t2, { step: 2, buckets: 1, lift: 0, [mode]: true });
    r.band([0.3, 7, 0.3, -11], -0.5, 0.5, "#ffffff");
    out[mode] = { polys: drawn(ctx, d), d, r, pieces: r.stats.pieces };
  }
  const { d, r } = out.cut, WP = r.WP, P = new Float64Array(3);
  // Where each edge of the band (x = −0.2 and 0.8) goes out of view, by the painter's own test.
  const crest = (x) => {
    for (let z = 6; z > -10; z -= 0.002) {
      WP[0] = x; WP[2] = z; r.hy(WP, 0);
      if (r.hidden(0)) return [x, WP[1], z];
    }
  };
  const ca = crest(-0.2), cb = crest(0.8);
  assert.ok(ca[2] < 0.5 && ca[2] > -3 && cb[2] < 0.5 && cb[2] > -3, `the edges go behind the crest at z ${ca[2].toFixed(2)} and ${cb[2].toFixed(2)}`);
  // The piece across it: its far corners are hidden. `hide` paints it whole (a corner still shows),
  // `cut` ends it at the crest, within the halving's reach (2 units / 256) of where the edge goes out of view.
  const zf = 7 - 2 * Math.ceil((7 - Math.min(ca[2], cb[2])) / 2), hf = 3 * Math.exp(-((zf / 3) ** 2));
  assert.equal(out.cut.pieces, out.hide.pieces, "the same pieces, one of them cut");
  assert.ok(corner(out.hide.d, out.hide.polys, -0.2, zf, hf) >= 0, `hide alone paints on to the hidden corner at z ${zf}`);
  assert.equal(corner(d, out.cut.polys, -0.2, zf, hf), -1, "cut does not");
  for (const c of [ca, cb]) {
    d.project(c[0], c[1], c[2], P);
    const best = Math.min(...out.cut.polys.flatMap(({ poly }) => poly.map(([x, y]) => Math.hypot(x - P[0], y - P[1]))));
    assert.ok(best < 0.75, `a cut corner where the edge at x ${c[0]} goes behind the crest (${best.toFixed(3)} px off)`);
  }
  // Pieces wholly in view are untouched: the first is the same polygon either way.
  assert.deepEqual(out.cut.polys[0].poly, out.hide.polys[0].poly);
});

test("ribbon pieces: a layout's own polygons through WP, hy, emit, bucket and color, in one winding", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  t.noise({ seed: 2, amp: 1 });
  const r = ribbon(d, t, { buckets: 4 });
  const c = r.color("#3060c0"), WP = r.WP, S = new Float64Array(4);
  assert.equal(r.color("#3060c0"), c, "one index per colour");
  let eye = null;
  // Two overlapping quads wound opposite ways and a triangle, every corner on the ground.
  const quad = (x, z, flip) => {
    const X = [x, x + 2, x + 2, x], Z = [z, z, z + 2, z + 2];
    for (let i = 0; i < 4; i++) { const k = flip ? 3 - i : i; WP[i * 3] = X[k]; WP[i * 3 + 2] = Z[k]; r.hy(WP, i * 3); }
    r.emit(c);
  };
  r.layout(() => {
    eye = [r.B[0], r.B[1], r.B[2]];
    r.bucket(WP, 0);
    quad(0, 0, false); quad(1, 1, true);
    WP[0] = -4; WP[2] = 0; WP[3] = -2; WP[5] = 0; WP[6] = -3; WP[8] = 2;
    for (let i = 0; i < 3; i++) r.hy(WP, i * 3);
    r.emit(c, 3);
  });
  const polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 3);
  assert.deepEqual(polys.map((q) => q.poly.length).sort(), [3, 4, 4]);
  const area = (poly) => poly.reduce((a, q, i) => { const n = poly[(i + 1) % poly.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0);
  assert.ok(polys.every((q) => area(q.poly) < 0), "one winding on screen (the bands' own)");
  r.band([-6, -6, 6, -6], -1, 1, "#3060c0");
  assert.ok(drawn(ctx, d).every((q) => area(q.poly) < 0), "the bands wind the same way");
  r.clear();
  // Corners on the ground (the terrain's own sample plus the lift), the eye where the diorama's is.
  t.sample(2, 0, S);
  assert.ok(corner(d, polys, 2, 0, S[0] + 0.004) >= 0, "hy is the ground's height plus lift");
  const cm = d.cam;
  near(eye[1], cm.ty + cm.dist * Math.sin(cm.pitch), 1e-9, "B's eye");
  // A theme change: the slot repainted, the light turned; the fills follow.
  const before = polys[0].style;
  r.color("#c03030", c);
  const after = drawn(ctx, d)[0].style;
  assert.notEqual(after, before);
  assert.ok(/^rgb\((\d+),(\d+),\2\)$/.test(after), `repainted: ${after}`);
  r.light([0, 1, 0], 0.2);
  assert.notEqual(drawn(ctx, d)[0].style, after, "the light changes the shade");
  r.layout(null);
  d.draw();
  assert.equal(r.stats.pieces, 0, "layout removed");
});

test("ribbon: runs, bands, cut and a layout's own polygons every frame allocate nothing", async (t) => {
  const ctx = new Rec(), d = scene(ctx), tr = flat();
  tr.noise({ seed: 5, amp: 2.5 });
  terrainView(d, tr, { bands: [[Infinity, "#9c7a55"]] });
  d.cam.pitch = 0.3;
  const r = ribbon(d, tr, { step: 0.5, cut: true, buckets: 12 });
  const loop = [];
  for (let i = 0; i < 24; i++) loop.push(Math.cos((i / 24) * 6.283) * 9, Math.sin((i / 24) * 6.283) * 6);
  r.bands(loop, [-2.2, -1.5, 1.5, 2.2], ["#70a060", "#444444", "#70a060"], { closed: true });
  r.band(loop, -0.08, 0.08, "#ffffff", true, { at: [1.5], colors: [null], period: 3 });
  r.band(loop, -1.8, -1.5, "#e04030", true, { at: [0.6], colors: ["#f0f0f0"], period: 1.2 });
  const c = r.color("#203040"), WP = r.WP;
  r.layout(() => {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 6.283, b = ((k + 1) / 24) * 6.283;
      WP[0] = 0; WP[2] = 0; WP[3] = Math.cos(a) * 2; WP[5] = Math.sin(a) * 2; WP[6] = Math.cos(b) * 2; WP[8] = Math.sin(b) * 2;
      for (let i = 0; i < 3; i++) r.hy(WP, i * 3);
      r.bucket(WP, 0);
      r.emit(c, 3);
    }
  });
  ctx.rec = false;
  let f = 0;
  const frames = (n, on) => { for (let k = 0; k < n; k++, f++) if (on) (d.cam.yaw = f * 0.01), d.draw(); };
  frames(200, true);
  const bare = await minorGCs(() => frames(2000, false)), withAll = await minorGCs(() => frames(2000, true));
  t.diagnostic(`young GCs over 2,000 frames (best of 3 windows): bare ${bare}, drawn ${withAll}; pieces ${r.stats.pieces}`);
  assert.ok(r.stats.pieces > 300, `pieces ${r.stats.pieces}`);
  assert.ok(withAll <= bare, `painting allocates: ${withAll} young GCs (bare ${bare})`);
});
