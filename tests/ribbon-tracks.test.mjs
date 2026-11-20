// @fzlt/core/ribbon-tracks in Node (a recording canvas): what a game's tracks need on top of ribbon, each
// its own export on one painter. `band` paints what ribbon's band paints (the same corners); `runs`
// changes a band's colour along the line at exact distances, with gaps and a period; `bands` under-laps
// and files a row in one bucket; `cut` skips what is behind a crest and clips at the crest instead of
// painting through the hill; the painter's pieces paint a layout's own polygons; and all of it together
// allocates nothing per frame.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { terrain, terrainView } = await import("../src/terrain.ts");
const { ribbon } = await import("../src/ribbon.ts");
const { painter, band, runs, bands, cut, hidden } = await import("../src/ribbon-tracks.ts");

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
/** The exports behind one object, as the tests below use them: a painter with `cut` (exact, or with
 *  `hide` whole pieces only), `band` with its runs, `bands` with theirs, at one step. */
const tracks = (d, g, o = {}) => {
  const P = painter(d, g, o);
  if (o.cut || o.hide) cut(P, !!o.cut);
  return {
    ...P, P,
    band(line, from, to, col, closed, rn) { const ln = band(P, line, from, to, col, closed, o.step); if (rn) runs(P, ln, rn); return ln; },
    bands(line, edges, cols, bo = {}) { const L = bands(P, line, edges, cols, { ...bo, step: o.step }); (bo.runs || []).forEach((rn, k) => rn && runs(P, L[k], rn)); return L; },
    clear: () => (P.lines.length = 0),
    hidden: (q) => hidden(P, q),
  };
};
const near = (a, b, e, m = "") => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);

/** Draw once and return the fills' polygons with their style; `has(polys, x, y, z)`: a corner there. */
const drawn = (ctx, d) => { ctx.fills.length = 0; d.draw(); return ctx.fills.flatMap((f) => f.polys.map((poly) => ({ poly, style: f.style }))); };
const corner = (d, polys, x, z, y = 0.004) => {
  const P = new Float64Array(3);
  d.project(x, y, z, P);
  return polys.findIndex(({ poly }) => poly.some(([px, py]) => Math.abs(px - P[0]) < 1e-6 && Math.abs(py - P[1]) < 1e-6));
};

test("ribbon-tracks band: the very polygons ribbon's band paints, with and without hiding", () => {
  for (const hide of [false, true]) {
    const out = [];
    for (const make of [ribbon, tracks]) {
      const ctx = new Rec(), d = scene(ctx), t = flat();
      t.noise({ seed: 5, amp: 2.5 });
      const r = make(d, t, { step: 0.5, hide });
      const loop = [];
      for (let i = 0; i < 24; i++) loop.push(Math.cos((i / 24) * 6.283) * 9, Math.sin((i / 24) * 6.283) * 6);
      r.band(loop, -1.5, 1.5, "#c8a070", true);
      r.band(loop, -1.8, -1.5, "#f0f0e0", true);
      r.band([-12, -9, -2, 3, 6, 4, 13, 12], -0.4, 0.4, "#405060");
      const frames = [];
      for (let f = 0; f < 12; f++) { d.cam.yaw = f * 0.5; d.cam.pitch = 0.15 + (f % 4) * 0.2; d.cam.dist = 6 + (f % 3) * 8; ctx.fills.length = 0; d.draw(); frames.push(ctx.fills.map((q) => ({ style: q.style, polys: q.polys }))); }
      out.push({ frames, pieces: r.stats.pieces });
    }
    assert.ok(out[0].pieces > 50);
    assert.deepEqual(out[1].frames, out[0].frames, `hide ${hide}: fill for fill, corner for corner`);
  }
});

test("ribbon-tracks: bad input throws", () => {
  const P = painter(scene(new Rec()), flat());
  assert.throws(() => band(P, [0, 0], -1, 1, "#ffffff"), RangeError);
  assert.throws(() => band(P, [0, 0, 1, 1], -1, 1, "#ffffff", false, 0), RangeError);
});

test("ribbon-tracks runs: the colour changes along the line at exact distances, with gaps and a period", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  const r = tracks(d, t, { step: 2, buckets: 1 });
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

test("ribbon-tracks bands: a band reaches under the neighbour painted over it, and a row shares one bucket", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  // The line runs across the view (along x), the camera low: the three bands lie at three depths.
  Object.assign(d.cam, { yaw: 0, pitch: 0.35, dist: 14 });
  const r = tracks(d, t, { step: 2, buckets: 48 });
  // Run-off, asphalt, run-off: the run-off's colour is made first, so it reaches under the asphalt.
  assert.equal(r.bands([-6, 0, 6, 0], [-2, -1, 1, 2], ["#00aa00", "#333333", "#00aa00"]).length, 3);
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

test("ribbon-tracks cut: a band that goes over a crest is clipped at the crest, not painted through the hill", () => {
  // A round ridge across the view; a band from in front of it, over it, down its far side.
  const t2 = flat();
  for (let j = 0; j <= 32; j++) for (let i = 0; i <= 32; i++) t2.h[j * 33 + i] = 3 * Math.exp(-(((j - 16) / 3) ** 2));
  const out = {};
  for (const mode of ["hide", "cut"]) {
    const ctx = new Rec(), d = scene(ctx);
    Object.assign(d.cam, { yaw: 0.2, pitch: 0.25, dist: 14, tx: 0, ty: 0, tz: 4 });
    const r = tracks(d, t2, { step: 2, buckets: 1, lift: 0, [mode]: true });
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

test("ribbon-tracks painter: a layout's own polygons through WP, hy, emit, bucket and color", () => {
  const ctx = new Rec(), d = scene(ctx), t = flat();
  t.noise({ seed: 2, amp: 1 });
  const r = tracks(d, t, { buckets: 4 });
  const c = r.color("#3060c0"), WP = r.WP, S = new Float64Array(4);
  assert.equal(r.color("#3060c0"), c, "one index per colour");
  let eye = null;
  // Two quads and a triangle, wound as the bands' pieces are, every corner on the ground.
  const quad = (x, z, flip) => {
    const X = [x, x + 2, x + 2, x], Z = [z, z, z + 2, z + 2];
    for (let i = 0; i < 4; i++) { const k = flip ? 3 - i : i; WP[i * 3] = X[k]; WP[i * 3 + 2] = Z[k]; r.hy(WP, i * 3); }
    r.emit(c);
  };
  r.layout(() => {
    eye = [r.B[0], r.B[1], r.B[2]];
    r.bucket(WP, 0);
    quad(0, 0, true); quad(3, 1, true);
    WP[0] = -4; WP[2] = 0; WP[3] = -3; WP[5] = 2; WP[6] = -2; WP[8] = 0;
    for (let i = 0; i < 3; i++) r.hy(WP, i * 3);
    r.emit(c, 3);
  });
  const polys = drawn(ctx, d);
  assert.equal(r.stats.pieces, 3);
  assert.deepEqual(polys.map((q) => q.poly.length).sort(), [3, 4, 4]);
  const area = (poly) => poly.reduce((a, q, i) => { const n = poly[(i + 1) % poly.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0);
  assert.ok(polys.every((q) => area(q.poly) < 0), "wound as given: anticlockwise on screen");
  r.band([-6, -6, 6, -6], -1, 1, "#3060c0");
  assert.ok(drawn(ctx, d).every((q) => area(q.poly) < 0), "the bands' pieces wind the same way");
  r.clear();
  // Corners on the ground (the terrain's own sample plus the lift), the eye where the diorama's is.
  t.sample(0, 2, S);
  assert.ok(corner(d, polys, 0, 2, S[0] + 0.004) >= 0, "hy is the ground's height plus lift");
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
  // After d.clear() the decal is gone; `paint` puts it back.
  d.clear();
  ctx.fills.length = 0; d.draw();
  assert.equal(ctx.fills.length, 0, "cleared");
  d.decal("terrain", 0.5, r.paint);
  assert.equal(drawn(ctx, d).length, 3, "painted again");
});

test("ribbon-tracks: runs, bands, cut and a layout's own polygons every frame allocate nothing", async (t) => {
  const ctx = new Rec(), d = scene(ctx), tr = flat();
  tr.noise({ seed: 5, amp: 2.5 });
  terrainView(d, tr, { bands: [[Infinity, "#9c7a55"]] });
  d.cam.pitch = 0.3;
  const r = tracks(d, tr, { step: 0.5, cut: true, buckets: 12 });
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
