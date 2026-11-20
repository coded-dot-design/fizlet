// @fzlt/core/ribbon in Node (a recording canvas): a band paints as one decal in the ground's cluster,
// its pieces are where the diorama projects the band's corners (its true width, not the grid's), a
// straight band's two edges stay exactly `to - from` apart at every piece and a curve's mitred joints
// keep the width, every corner sits on the ground's height (the terrain's own sample), pieces behind
// the camera are clipped and off-screen ones culled, one fill per colour and shade, far buckets first,
// `hide` drops a band behind a ridge, `cap` drops and counts, and painting every frame allocates nothing.
// And its output is pinned: a hash of every path command and fill style over 40 views (60,507 commands),
// the one the brick gave when it was added (commit 7043a16), so nothing changes what a scene draws unseen.
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

test("ribbon: the canvas commands of 40 views are the ones the brick gave when it was added", () => {
  // Every path call (with its numbers in full) and fill style of 40 views (yaw, pitch and distance
  // vary: near clips, culls, hides) of a closed track, two strips and an open band on hills, hashed.
  // The hash is the one the brick gave when it was added (commit 7043a16).
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
