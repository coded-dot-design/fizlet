// @fzlt/core/diorama in Node (a fake canvas and a recording 2D context): the projection math, `fit`
// keeps every point in the safe rect, the painter's sort (a near face after a far one; fixed clusters,
// anchored clusters and layers; `below`; `behind`; points and decals in the sort), `on` (a child follows its
// parent's move, tilt and sink; alpha and tint inherited; its shadow lies on the tilted top), picking
// returns the front-most object, `ground` hits the plane, capacities, and a draw() every frame
// allocates nothing. Real pixels and a real click in Chromium: tests/diorama.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { createEngine } = await import("../src/index.ts");

/** A 2D context that records each fill as { style, alpha, pts } (an arc is a one-point path), or
 *  nothing when `rec` is null. One class for every test: its methods stay monomorphic call targets. */
class FakeCtx {
  constructor(rec) { this.rec = rec; this.path = []; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; }
  setTransform(a, b, c, d, e, f) { if (this.rec) this.rec.ops.push(["setTransform", a, b, c, d, e, f]); }
  fillRect(x, y, w, h) { if (this.rec) this.rec.ops.push(["fillRect", this.fillStyle, x, y, w, h]); }
  clearRect(x, y, w, h) { if (this.rec) this.rec.ops.push(["clearRect", x, y, w, h]); }
  beginPath() { if (this.rec) this.path = []; }
  moveTo(x, y) { if (this.rec) this.path.push([x, y]); }
  lineTo(x, y) { if (this.rec) this.path.push([x, y]); }
  arc(x, y, r) { if (this.rec) this.path.push([x, y, r]); }
  closePath() {}
  fill() { if (this.rec) this.rec.fills.push({ style: this.fillStyle, alpha: this.globalAlpha, pts: this.path }); }
  stroke() {}
}
function fakeCanvas(w = 400, h = 300, record = true) {
  const fills = [], ops = [], ctx = new FakeCtx(record ? { fills, ops } : null);
  const canvas = { clientWidth: w, clientHeight: h, width: 0, height: 0, getContext: () => ctx };
  return { canvas, ctx, fills, ops, reset: () => { fills.length = 0; ops.length = 0; } };
}
// An emissive face is drawn at full shade (level 32 of 40: ×0.996), so a fill names its colour.
const FULL = { "#ff0000": "rgb(253,0,0)", "#00ff00": "rgb(0,253,0)", "#0000ff": "rgb(0,0,253)" };
const firstFill = (fills, col) => fills.findIndex((f) => f.style === FULL[col]);
const side = (d) => Object.assign(d.cam, { yaw: 0, pitch: 0, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.8 });
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test("diorama: projection math (orbit camera, focal length, screen shift, behind the camera)", () => {
  const { canvas } = fakeCanvas(400, 300), d = diorama(canvas, { maxDpr: 2 });
  assert.deepEqual([d.width, d.height, canvas.width, canvas.height], [400, 300, 400, 300], "sized from the client box at dpr 1");
  side(d);
  const f = 150 / Math.tan(0.4), out = new Float64Array(3);
  close(d.focal(), f, 1e-9, "focal = (H / 2) / tan(fov / 2)");
  assert.ok(d.project(0, 0, 0, out));
  assert.deepEqual([...out], [200, 150, 20], "the target is the centre, at the camera distance");
  d.project(1, 2, 0, out);
  close(out[0], 200 + f / 20, 1e-9, "x right");
  close(out[1], 150 - (2 * f) / 20, 1e-9, "y up is screen up");
  d.project(0, 0, 10, out);
  close(out[2], 10, 1e-9, "depth along the view axis");
  assert.equal(d.project(0, 0, 25, out), false, "behind the camera");
  d.cam.yaw = Math.PI / 2; // the eye on +x, looking down −x: world −z is screen right
  d.project(0, 0, -1, out);
  close(out[0], 200 + f / 20, 1e-9, "yaw turns the view");
  d.cam.yaw = 0;
  d.cam.ox = 30;
  d.cam.oy = -10;
  d.project(0, 0, 0, out);
  assert.deepEqual([out[0], out[1]], [230, 140], "ox, oy shift the picture");
  d.cam.ox = d.cam.oy = 0;
  d.cam.pitch = Math.PI / 2; // straight down: still a valid basis
  d.project(1, 0, 0, out);
  assert.ok(Number.isFinite(out[0]) && out[0] > 200, "top-down view keeps x to the right");
  d.resize(800, 600, 3);
  assert.deepEqual([d.width, d.height, d.dpr, canvas.width, canvas.height], [800, 600, 2, 1600, 1200], "resize: density capped at maxDpr");
});

test("diorama: fit() frames every point inside the safe rect, tight on one side", () => {
  const { canvas } = fakeCanvas(390, 700), d = diorama(canvas);
  const pts = [];
  for (let i = 0; i < 40; i++) pts.push(Math.sin(i * 1.7) * 12, Math.abs(Math.cos(i * 0.9)) * 3, Math.cos(i * 2.3) * 7);
  for (const [yaw, pitch] of [[-0.5, 0.85], [0.9, 0.4], [2.5, 1.2]]) {
    const safe = { x0: 16, y0: 120, x1: 374, y1: 560 };
    Object.assign(d.cam, { yaw, pitch, dist: 3, tx: 0, ty: 0, tz: 0, fov: 0.62 });
    assert.equal(d.fit(d.cam, pts, safe), d.cam);
    const out = new Float64Array(3);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      assert.ok(d.project(pts[i], pts[i + 1], pts[i + 2], out), "in front of the camera");
      x0 = Math.min(x0, out[0]); x1 = Math.max(x1, out[0]); y0 = Math.min(y0, out[1]); y1 = Math.max(y1, out[1]);
    }
    const eps = 1e-6;
    assert.ok(x0 >= safe.x0 - eps && x1 <= safe.x1 + eps && y0 >= safe.y0 - eps && y1 <= safe.y1 + eps, `inside at yaw ${yaw}: ${[x0, y0, x1, y1]}`);
    assert.ok(x1 - x0 > (safe.x1 - safe.x0) * 0.999 || y1 - y0 > (safe.y1 - safe.y0) * 0.999, "as big as fits");
    close((x0 + x1) / 2, (safe.x0 + safe.x1) / 2, 1e-6, "centred x");
    close((y0 + y1) / 2, (safe.y0 + safe.y1) / 2, 1e-6, "centred y");
  }
  const c = { ...d.cam, yaw: 9 };
  d.clamp({ yaw: [-1, 1], dist: [5, 6] }, c);
  assert.deepEqual([c.yaw, c.dist], [1, 6], "clamp holds a camera in its limits");
});

test("diorama: the painter's sort: depth, layers, fixed and anchored clusters, below", () => {
  const p = fakeCanvas(), d = diorama(p.canvas, { background: "#ffffff" });
  side(d);
  d.cluster("one", { at: [0, 0, 0] });
  // Added near first: the sort, not the order of add, puts the far one first.
  d.add({ id: "near", size: [2, 2, 2], pos: [0, 0, 4], color: "#ff0000", emissive: true, cluster: "one" });
  d.add({ id: "far", size: [2, 2, 2], pos: [0, 0, -4], color: "#00ff00", emissive: true, cluster: "one" });
  d.draw();
  assert.equal(p.ops[1][1], "#ffffff", "the background first");
  assert.ok(firstFill(p.fills, "#00ff00") < firstFill(p.fills, "#ff0000"), "a far face draws before a near one");
  assert.equal(p.fills.filter((f) => f.style === FULL["#ff0000"]).length, 1, "back faces culled: a box faced head on shows one face");
  assert.equal(d.stats.faces, 2);

  d.get("far").layer = 6; // a higher layer draws after, whatever its depth
  p.reset(); d.draw();
  assert.ok(firstFill(p.fills, "#00ff00") > firstFill(p.fills, "#ff0000"), "layer beats depth inside a cluster");

  // Clusters: a fixed one draws before every unfixed one; unfixed ones far to near by their anchor.
  d.clear();
  d.cluster("room", { fixed: 0 });
  d.cluster("front", { at: [0, 0, 5] });
  d.cluster("back", { at: [0, 0, -5] });
  d.add({ size: [2, 2, 2], pos: [0, 0, 6], color: "#ff0000", emissive: true, cluster: "room", layer: 9 });
  d.add({ size: [2, 2, 2], pos: [0, 0, -2], color: "#00ff00", emissive: true, cluster: "front", layer: 0 });
  d.add({ size: [2, 2, 2], pos: [0, 0, 3], color: "#0000ff", emissive: true, cluster: "back", layer: 9 });
  p.reset(); d.draw();
  assert.deepEqual(["#ff0000", "#0000ff", "#00ff00"].map((c) => firstFill(p.fills, c)), [0, 1, 2], "fixed, then far cluster, then near cluster");
  d.cluster("front", { at: [0, 0, -9] }); // move the anchor behind: it ranks first among the unfixed
  p.reset(); d.draw();
  assert.deepEqual(["#ff0000", "#00ff00", "#0000ff"].map((c) => firstFill(p.fills, c)), [0, 1, 2], "anchors re-rank each draw");

  // below: the faces under the cut plane draw on their own layer (here before the water at 3).
  d.clear();
  d.cluster("tray", { at: [0, 0, 0] });
  d.add({ id: "water", size: [6, 1, 6], pos: [0, -1, 0], color: "#0000ff", emissive: true, cluster: "tray", layer: 3, alpha: 0.8 });
  d.add({ id: "hull", size: [2, 2, 2], pos: [0, -2, 2], color: "#ff0000", emissive: true, cluster: "tray", layer: 4, below: { y: -0.5, layer: 2 } });
  d.cam.pitch = 0.5;
  p.reset(); d.draw();
  const hullFills = p.fills.map((f, i) => [f.style, i]).filter(([s]) => s === FULL["#ff0000"]).map(([, i]) => i);
  const water = firstFill(p.fills, "#0000ff");
  assert.ok(hullFills.some((i) => i < water) && hullFills.some((i) => i > water), "the hull's under-water faces before the water, the rest after");
});

test("diorama: points and decals sort among the faces", () => {
  const p = fakeCanvas(), d = diorama(p.canvas);
  side(d);
  d.cluster("c", { at: [0, 0, 0] });
  d.add({ size: [2, 2, 0.2], pos: [0, 0, 3], color: "#ff0000", emissive: true, cluster: "c" });
  d.add({ size: [2, 2, 0.2], pos: [0, 0, -3], color: "#00ff00", emissive: true, cluster: "c" });
  const sparks = d.points({ cap: 4, cluster: "c", layer: 4, color: "#0000ff" });
  sparks.n = 1;
  sparks.x[0] = 0; sparks.y[0] = 1; sparks.z[0] = 0; sparks.r[0] = 0.5; sparks.a[0] = 0.5;
  const seen = [];
  d.decal("c", 4, () => seen.push(["decal", p.fills.length]), [0, 1, 1]);
  d.draw();
  const spark = p.fills.findIndex((f) => f.style === "#0000ff");
  assert.ok(firstFill(p.fills, "#00ff00") < spark && spark < firstFill(p.fills, "#ff0000"), "a point between two faces draws between them");
  assert.equal(p.fills[spark].alpha, 0.5, "the point's alpha");
  const [x, y, r] = p.fills[spark].pts[0];
  close(x, 200, 1e-9, "screen x"); close(y, 150 - d.focal() / 20, 1e-9, "screen y"); close(r, (0.5 * d.focal()) / 20, 1e-9, "radius scales with depth");
  assert.deepEqual([sparks.sx[0], sparks.sy[0]], [x, y], "sx, sy kept for a custom painter");
  assert.equal(seen[0][1], spark + 1, "a decal with `at` sorts by that depth (just in front of the point)");
  assert.equal(d.stats.points, 1);
  sparks.a[0] = 0;
  p.reset(); d.draw();
  assert.equal(p.fills.filter((f) => f.style === "#0000ff").length, 0, "alpha 0 skips a point");
  // A custom painter gets the index; no cluster: after every cluster.
  const own = [], late = d.points({ cap: 2, paint: (ctx, i, pool) => own.push([i, pool.sx[i]]) });
  late.n = 1;
  late.z[0] = -5;
  p.reset(); d.draw();
  assert.deepEqual(own.map(([i]) => i), [0]);
  close(own[0][1], 200, 1e-9, "paint reads its screen position");
});

test("diorama: `behind`: a wheel draws over the body on the near side, under it on the far side", () => {
  const p = fakeCanvas(), d = diorama(p.canvas, { background: "#ffffff" });
  // A car: a body on the root (layer 5), four hubs above it (their tyres at 6) that drop 1.5 on the far
  // side (to 4.5, under the body). Each wheel has its own colour.
  d.add({ id: "car", shape: "group", size: [2, 0, 1.2] });
  d.add({ size: [2.4, 0.8, 1.2], pos: [0, 0.2, 0], color: "#ff0000", emissive: true, on: "car" });
  const W = [[1, 0.8, "#00ff00", "rgb(0,253,0)"], [1, -0.8, "#0000ff", "rgb(0,0,253)"], [-1, 0.8, "#ffff00", "rgb(253,253,0)"], [-1, -0.8, "#00ffff", "rgb(0,253,253)"]];
  const hubs = W.map(([x, z, col], i) => {
    const hub = d.add({ id: "h" + i, shape: "group", size: [0.6, 0, 0.6], pos: [x, 0, z], on: "car", behind: 1.5 });
    d.add({ size: [0.7, 0.7, 0.3], color: col, emissive: true, on: "h" + i });
    return hub;
  });
  const span = (style) => { const i = p.fills.map((f, k) => (f.style === style ? k : -1)).filter((k) => k >= 0); return [Math.min(...i), Math.max(...i)]; };
  const car = d.get("car");
  let checked = 0;
  for (let h = 0; h < 16; h++)
    for (const yaw of [0, 0.7, 2, 3.5, 5]) {
      Object.assign(d.cam, { yaw, pitch: 0.45, dist: 12, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.8 });
      const a = (car.rot[1] = (h / 16) * Math.PI * 2);
      car.rot[2] = h % 3 ? 0.2 : 0; // pitched too (a turn about the car's own z leaves x, z across it level)
      d.draw(); p.reset(); d.draw();
      const r = span(FULL["#ff0000"]), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (const [x, z, , style] of W) {
        // The wheel's place across the car, turned with it (y, then z: x tips with the pitch), on the camera's forward.
        const c2 = Math.cos(car.rot[2]), wx = Math.cos(a) * x * c2 + Math.sin(a) * z, wz = -Math.sin(a) * x * c2 + Math.cos(a) * z;
        const dz = wx * fx * Math.cos(0.45) + wz * fz * Math.cos(0.45) - Math.sin(car.rot[2]) * x * Math.sin(0.45);
        if (Math.abs(dz) < 0.05) continue; // side on to the camera: either order is right
        const s = span(style);
        if (s[1] < 0) continue;
        checked++;
        if (dz > 0) assert.ok(s[1] < r[0], `heading ${h} yaw ${yaw} wheel ${x},${z}: a far wheel before the body`);
        else assert.ok(s[0] > r[1], `heading ${h} yaw ${yaw} wheel ${x},${z}: a near wheel after the body`);
      }
    }
  assert.ok(checked > 200, `checked ${checked}`);
  // Off (0, the default): every wheel draws on its own layer over the body again.
  for (const hb of hubs) hb.behind = 0;
  d.draw(); p.reset(); d.draw();
  for (const [, , , style] of W) assert.ok(span(style)[0] > span(FULL["#ff0000"])[1], "behind 0: every wheel on its layer, over the body");
});

test("diorama: `on`: a child follows its parent's move, tilt and sink; alpha and tint inherited", () => {
  const p = fakeCanvas(), d = diorama(p.canvas);
  side(d);
  const base = d.add({ id: "base", size: [4, 1, 4], color: "#0000ff", emissive: true });
  const kid = d.add({ id: "kid", size: [1, 1, 1], on: "base", pos: [1, 0, 0], color: "#ff0000", emissive: true });
  assert.equal(kid.parent, base);
  assert.deepEqual([base.layer, kid.layer], [4, 5], "a child's layer defaults to its parent's + 1 (it draws after what it rests on)");
  d.draw();
  assert.deepEqual([...kid.M.slice(9)], [1, 1, 0], "rests on the parent's top centre, offset by pos");
  base.pos[0] = 3; base.pos[1] = -0.5; // move and sink
  d.draw();
  assert.deepEqual([...kid.M.slice(9)], [4, 0.5, 0], "moves and sinks with the parent");
  base.pos[0] = base.pos[1] = 0;
  base.rot[2] = Math.PI / 2; // tilt: the parent's +y turns to −x
  d.draw();
  close(kid.M[9], -1, 1e-12, "tilted x"); close(kid.M[10], 1, 1e-12, "tilted y");
  close(kid.M[1], -1, 1e-12, "the child's up axis turns with it");
  base.rot[2] = 0;
  base.alpha = 0.5; kid.alpha = 0.5; base.tint = "#00ff00";
  p.reset(); d.draw();
  const kidFill = p.fills.filter((f) => f.alpha === 0.25);
  assert.ok(kidFill.length > 0, "alpha multiplies down");
  assert.ok(kidFill.every((f) => f.style === FULL["#00ff00"]), "the parent's tint colours the child");
  kid.tint = "#0000ff";
  p.reset(); d.draw();
  assert.ok(p.fills.filter((f) => f.alpha === 0.25).every((f) => f.style === FULL["#0000ff"]), "its own tint wins");
  d.on(kid, null);
  d.draw();
  assert.deepEqual([kid.parent, kid.M[10]], [null, 0], "on(ob, null) lifts it off");
  assert.throws(() => diorama(fakeCanvas().canvas, { maxVerts: 10 }).add({ size: [1, 1, 1], shape: "cyl", sides: 8 }), RangeError, "past maxVerts");
});

test("diorama: a blob shadow lies on its parent's top, tilted with it", () => {
  const p = fakeCanvas(), d = diorama(p.canvas, { shadowColor: "#123456" });
  Object.assign(d.cam, { yaw: 0.3, pitch: 0.7, dist: 18, tx: 0, ty: 0, tz: 0, fov: 0.8 });
  const base = d.add({ id: "base", size: [8, 1, 8], color: "#0000ff" });
  d.add({ id: "kid", size: [1, 1, 1], on: "base", pos: [2, 0, 0], color: "#ff0000", shadow: 0.3 });
  const centre = () => {
    p.reset(); d.draw();
    const s = p.fills.find((f) => f.style === "#123456");
    assert.ok(s, "a shadow");
    return [s.pts.reduce((a, q) => a + q[0], 0) / s.pts.length, s.pts.reduce((a, q) => a + q[1], 0) / s.pts.length];
  };
  for (const tilt of [0, 0.35]) {
    base.rot[0] = tilt;
    const [x, y] = centre(), want = new Float64Array(3), M = base.M;
    // The point under the child on the parent's (tilted) top: M · (2, top, 0).
    d.project(M[9] + M[0] * 2 + M[1], M[10] + M[3] * 2 + M[4], M[11] + M[6] * 2 + M[7], want);
    close(x, want[0], 1.5, `shadow centre x at tilt ${tilt}`);
    close(y, want[1], 1.5, `shadow centre y at tilt ${tilt}`);
  }
  assert.equal(d.stats.shadows, 1);
});

test("diorama: pick() returns the front-most object; root() climbs to the tagged one", () => {
  const p = fakeCanvas(), d = diorama(p.canvas);
  side(d);
  const ship = d.add({ id: "ship", shape: "group", size: [2, 0, 2], pos: [0, 0, 2], tag: { ship: 1 } });
  const hull = d.add({ id: "hull", size: [2, 2, 2], on: "ship" });
  const back = d.add({ id: "back", size: [4, 4, 1], pos: [0, -1, -3] });
  const glass = d.add({ id: "glass", size: [6, 6, 0.1], pos: [0, -2, 5], alpha: 0.3, pick: false });
  d.draw();
  const out = new Float64Array(3);
  d.project(0, 1, 3, out);
  assert.equal(d.pick(out[0], out[1]), hull, "the near box, through a pick: false pane");
  assert.equal(d.root(d.pick(out[0], out[1])), ship, "root: the tagged ancestor");
  d.project(1.8, 2.5, -2.5, out);
  assert.equal(d.pick(out[0], out[1]), back, "beside the near box: the far one");
  assert.equal(d.pick(5, 5), null, "nothing there");
  hull.hidden = true;
  d.draw();
  d.project(0, 1, 3, out);
  assert.equal(d.pick(out[0], out[1]), back, "a hidden object is not picked");
  assert.equal(glass.pick, false);
});

test("diorama: ground() meets the plane under a screen point", () => {
  const { canvas } = fakeCanvas(), d = diorama(canvas);
  Object.assign(d.cam, { yaw: -0.5, pitch: 0.85, dist: 30, tx: 2, ty: 1, tz: -1, ox: 12, oy: -8, fov: 0.62 });
  const hit = new Float64Array(3), out = new Float64Array(3);
  assert.ok(d.ground(200 + 12, 150 - 8, 1, hit), "the centre ray meets y = 1");
  for (const [a, b] of [[hit[0], 2], [hit[1], 1], [hit[2], -1]]) close(a, b, 1e-9, "at the target");
  for (const [x, y] of [[40, 260], [350, 90], [210, 200]]) {
    assert.ok(d.ground(x, y, 0.5, hit));
    close(hit[1], 0.5, 0, "on the plane");
    d.project(hit[0], hit[1], hit[2], out);
    close(out[0], x, 1e-6, "projects back to x"); close(out[1], y, 1e-6, "projects back to y");
  }
  assert.equal(d.ground(200, 0, 40, hit), false, "a plane above the eye: the ray looks down, never meets it");
});

test("diorama: works on the kernel (a render system), never keeps it awake", () => {
  const p = fakeCanvas(), d = diorama(p.canvas), e = createEngine({ settle: 0.1 });
  d.add({ size: [1, 1, 1] });
  let draws = 0;
  e.add({ render: () => (d.draw(), draws++) });
  e.start();
  for (let i = 0; i < 20; i++) e.advance(1 / 60);
  assert.ok(draws > 0 && e.paused.includes("settled"), "draws, then the engine settles");
  e.destroy();
});

test("diorama: zero allocation per draw() (a turning camera, moving parts, shadows, points, decals)", async (t) => {
  const minors = async (on) => {
    const p = fakeCanvas(400, 300, false), d = diorama(p.canvas, { background: () => "#eeeeee", overlay() {} });
    d.cluster("room", { fixed: 0 });
    d.add({ id: "floor", size: [20, 0.5, 20], pos: [0, -0.5, 0], color: "#d9d3ca", cluster: "room", layer: 0 });
    const ships = [];
    for (let i = 0; i < 6; i++) {
      const s = d.add({ id: "s" + i, shape: "group", size: [2, 0, 0.7], on: "floor", pos: [i * 2 - 6, 0, i % 2 ? 2 : -2], shadow: 0.2, tag: i, below: { y: 0.1, layer: 2 } });
      d.add({ id: "h" + i, shape: "prism", outline: [[-1, -0.3], [0.7, -0.3], [1, 0], [0.7, 0.3], [-1, 0.3]], taper: 0.7, size: [2, 0.4, 0.6], on: "s" + i, color: "#4f8fb5" });
      d.add({ id: "f" + i, shape: "cyl", sides: 9, top: 0.8, size: [0.3, 0.4, 0.3], on: "h" + i, color: "#e05a47", shadow: 0.1 });
      d.add({ id: "w" + i, shape: "wedge", size: [0.4, 0.3, 0.4], on: "h" + i, pos: [0.5, 0, 0], color: "#ffffff", tint: i % 2 ? "#ff0000" : null });
      ships.push(s);
    }
    const fx = d.points({ cap: 32, cluster: "@floor", layer: 5 });
    fx.n = 32;
    for (let i = 0; i < 32; i++) (fx.x[i] = Math.sin(i)), (fx.y[i] = 1 + (i % 3)), (fx.z[i] = Math.cos(i)), (fx.r[i] = 0.1);
    const at = new Float64Array([0, 0.5, 0]);
    d.decal("@floor", 3, () => {}, at);
    d.decal("room", 0.5, () => {});
    const cam = d.cam, s = new Float64Array(1);
    const frame = () => {
      s[0] += 0.01;
      cam.yaw = Math.sin(s[0]);
      for (let i = 0; i < ships.length; i++) (ships[i].rot[2] = Math.sin(s[0] + i) * 0.2), (ships[i].pos[1] = Math.cos(s[0] + i) * 0.3);
      if (on) d.draw();
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 30000; i++) frame(); });
  };
  const bare = await minors(false), withDraw = await minors(true);
  t.diagnostic(`young GCs over 30k frames (best of 3 windows): bare ${bare}, with a draw() every frame ${withDraw}`);
  assert.ok(withDraw <= bare + 1, `young-generation GCs over 30k frames: ${withDraw} with diorama, ${bare} bare`);
});

test("diorama: capacities drop and count, never overflow", () => {
  const p = fakeCanvas(), d = diorama(p.canvas, { maxFaces: 3 });
  side(d);
  for (let i = 0; i < 3; i++) d.add({ size: [1, 1, 1], pos: [i * 2 - 2, 0, 0], color: "#ff0000", emissive: true });
  d.cam.pitch = 0.6;
  d.draw();
  assert.equal(d.stats.faces, 3);
  assert.ok(d.stats.dropped > 0, "the rest counted as dropped");
});

test("diorama: no Math.hypot (the exact hypot rule)", () => {
  assert.doesNotMatch(readFileSync("src/diorama.ts", "utf8"), /Math\.hypot/);
});
