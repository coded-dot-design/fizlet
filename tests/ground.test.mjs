// @fzlt/core/ground in Node (a fake canvas that records its path): `seg` lands both ends on the
// diorama's own projection and drops a line with an end at the eye; `spot` is focal × r / depth wide
// and, at the middle of the view, as tall as the true projected ring; `ring` lies on a ground's
// heights and closes; `shadow` fades and narrows with lift and puts the alpha back; `horizon` is where
// far level ground projects; and a frame of them allocates nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { diorama } = await import("../src/diorama.ts");
const { terrain } = await import("../src/terrain.ts");
const { at, seg, spot, ring, shadow, horizon } = await import("../src/ground.ts");

/** A context that records path calls (and nothing else). */
class Rec {
  log = []; globalAlpha = 1; fills = [];
  setTransform() {} fillRect() {} clearRect() {} stroke() {} arc() {}
  beginPath() { this.log.length = 0; }
  moveTo(x, y) { this.log.push(["M", x, y]); }
  lineTo(x, y) { this.log.push(["L", x, y]); }
  closePath() { this.log.push(["Z"]); }
  ellipse(x, y, rx, ry) { this.log.push(["E", x, y, rx, ry]); }
  fill() { this.fills.push(this.globalAlpha); }
}
/** The same calls with nothing kept (the allocation test). */
class Null { globalAlpha = 1; setTransform() {} fillRect() {} clearRect() {} stroke() {} arc() {} beginPath() {} moveTo() {} lineTo() {} closePath() {} ellipse() {} fill() {} }
const scene = (ctx = new Rec(), cam = {}) => {
  const d = diorama({ clientWidth: 800, clientHeight: 600, width: 0, height: 0, getContext: () => ctx });
  Object.assign(d.cam, { yaw: 0.4, pitch: 0.6, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 }, cam);
  d.draw();
  return { d, ctx };
};
const near = (a, b, e = 1e-9, m = "") => assert.ok(Math.abs(a - b) < e, `${m} ${a} vs ${b}`);

// First, while this process has seen one diorama and one context: the calls below inline, as in a game
// with one scene (a second diorama on the page makes `d.project` a shared call site: see src/ground.ts).
test("ground: a frame of lines, spots, rings and shadows allocates nothing (0 young GCs over 20k frames)", async () => {
  const { d, ctx } = scene(new Null());
  const hill = terrain({ cols: 16, rows: 16, cell: 1 });
  hill.noise({ seed: 3, amp: 1, scale: 5 });
  let sum = 0;
  const work = () => {
    for (let f = 0; f < 20000; f++) {
      d.cam.yaw = f * 0.001;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) if (seg(d, ctx, i - 6, 0, -4, i - 6, 0.2, 4)) sum += at[2];
      for (let i = 0; i < 4; i++) spot(d, ctx, i, 0, i - 2, 1.2);
      ring(d, ctx, 1, 1, 2, hill, 0.03);
      ring(d, ctx, -2, 0, 1, 0);
      shadow(d, ctx, 0, 0, 0, 1, (f % 50) * 0.1);
      sum += horizon(d);
    }
  };
  work(); // warm up
  const gcs = await minorGCs(work);
  assert.ok(sum !== 0);
  assert.ok(gcs <= 1, `${gcs} young GCs`);
});

test("ground: seg lands both ends on the diorama's projection; at is the far end; an end at the eye drops it", () => {
  const { d, ctx } = scene(), P = [0, 0, 0], Q = [0, 0, 0];
  ctx.beginPath();
  assert.equal(seg(d, ctx, -3, 0, 1, 4, 0.5, -2), true);
  d.project(-3, 0, 1, P); d.project(4, 0.5, -2, Q);
  assert.deepEqual(ctx.log, [["M", P[0], P[1]], ["L", Q[0], Q[1]]]);
  assert.deepEqual([...at], Q, "at: B on screen with its depth");
  // The eye, and a point behind it.
  const E = d.eye([0, 0, 0]);
  ctx.beginPath();
  assert.equal(seg(d, ctx, 0, 0, 0, E[0], E[1], E[2]), false, "an end at the eye");
  assert.equal(seg(d, ctx, E[0] * 2, E[1] * 2, E[2] * 2, 0, 0, 0), false, "an end behind the camera");
  assert.equal(ctx.log.length, 0, "nothing added");
  // `near`: a point 1 from the eye passes at the default 0.5 and is dropped at 2.
  const k = 1 - 1 / 20;
  assert.equal(seg(d, ctx, 0, 0, 0, E[0] * k, E[1] * k, E[2] * k), true);
  assert.equal(seg(d, ctx, 0, 0, 0, E[0] * k, E[1] * k, E[2] * k, 2), false);
});

test("ground: spot is focal × r / depth wide; its default height matches the true ring at the view's middle", () => {
  for (const pitch of [0.25, 0.6, 1.1]) {
    const { d, ctx } = scene(new Rec(), { pitch }), C = [0, 0, 0];
    ctx.beginPath();
    assert.equal(spot(d, ctx, 0, 0, 0, 1.5), true);
    d.project(0, 0, 0, C);
    const [m, e] = ctx.log;
    near(e[1], C[0]); near(e[2], C[1]);
    near(e[3], (d.focal() * 1.5) / C[2], 1e-9, "rx");
    near(e[4] / e[3], Math.sin(pitch), 1e-9, "flat");
    assert.deepEqual(m, ["M", C[0] + e[3], C[1]], "starts its own subpath (no line from the last one)");
    // The exact projected ring's extents agree within 3% across and 6% down.
    ctx.beginPath();
    assert.equal(ring(d, ctx, 0, 0, 1.5, 0, 0, 64), true);
    const xs = ctx.log.filter((p) => p[0] !== "Z").map((p) => p[1]), ys = ctx.log.filter((p) => p[0] !== "Z").map((p) => p[2]);
    const w = (Math.max(...xs) - Math.min(...xs)) / 2, h = (Math.max(...ys) - Math.min(...ys)) / 2;
    assert.ok(Math.abs(w / e[3] - 1) < 0.03, `pitch ${pitch}: width ${w} vs ${e[3]}`);
    assert.ok(Math.abs(h / e[4] - 1) < 0.06, `pitch ${pitch}: height ${h} vs ${e[4]}`);
  }
  const { d, ctx } = scene();
  ctx.beginPath();
  spot(d, ctx, 2, 0, 1, 1, 0.28);
  near(ctx.log[1][4] / ctx.log[1][3], 0.28, 1e-12, "your own flatness");
  const E = d.eye([0, 0, 0]);
  assert.equal(spot(d, ctx, E[0] * 3, E[1] * 3, E[2] * 3, 1), false, "behind the camera");
});

test("ground: ring lies on a plane or on a ground's heights, lifted, and closes", () => {
  const { d, ctx } = scene(), P = [0, 0, 0];
  const hill = terrain({ cols: 16, rows: 16, cell: 1 });
  hill.noise({ seed: 7, amp: 1.5, scale: 4 });
  ctx.beginPath();
  assert.equal(ring(d, ctx, 1, -2, 2, hill, 0.05, 12), true);
  assert.equal(ctx.log.length, 13);
  assert.deepEqual(ctx.log[12], ["Z"]);
  assert.equal(ctx.log[0][0], "M");
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, x = 1 + Math.cos(a) * 2, z = -2 + Math.sin(a) * 2;
    d.project(x, hill.height(x, z) + 0.05, z, P);
    near(ctx.log[i][1], P[0], 1e-9, `x ${i}`); near(ctx.log[i][2], P[1], 1e-9, `y ${i}`);
  }
  ctx.beginPath();
  ring(d, ctx, 0, 0, 1, 2, 0, 4);
  d.project(1, 2, 0, P);
  near(ctx.log[0][2], P[1], 1e-9, "a number is the plane's y");
  const E = d.eye([0, 0, 0]);
  assert.equal(ring(d, ctx, E[0], E[2], 30, E[1]), false, "a ring round the eye is not drawn");
});

test("ground: shadow fades and narrows with lift, never to nothing, and puts the alpha back", () => {
  const { d, ctx } = scene();
  ctx.globalAlpha = 0.5;
  assert.equal(shadow(d, ctx, 0, 0, 0, 1), true);
  near(ctx.fills[0], 0.5 * 0.33, 1e-12, "at rest: alpha × the context's");
  const r0 = ctx.log[1][3];
  assert.equal(ctx.globalAlpha, 0.5, "alpha put back");
  shadow(d, ctx, 0, 0, 0, 1, 2, 0.34, 0.05, 0.28);
  near(ctx.fills[1], 0.5 * (0.34 - 0.1), 1e-12, "lifted 2 at fade 0.05");
  near(ctx.log[1][3] / r0, 0.95, 1e-12, "narrower by half the fade");
  near(ctx.log[1][4] / ctx.log[1][3], 0.28, 1e-12);
  shadow(d, ctx, 0, 0, 0, 1, 1000);
  near(ctx.fills[2], 0.5 * 0.33 / 4, 1e-12, "floor: a quarter of its strength");
  near(ctx.log[1][3] / r0, 0.5, 1e-12, "floor: half its width");
  shadow(d, ctx, 0, 0, 0, 1, -3);
  near(ctx.fills[3], 0.5 * 0.33, 1e-12, "under the ground counts as on it");
  const E = d.eye([0, 0, 0]);
  assert.equal(shadow(d, ctx, E[0] * 2, E[1] * 2, E[2] * 2, 1), false);
  assert.equal(ctx.fills.length, 4, "not drawn: no fill");
  assert.equal(ctx.globalAlpha, 0.5);
});

test("ground: horizon is where far level ground projects, with the camera's shift and any pitch", () => {
  for (const cam of [{ pitch: 0.1 }, { pitch: 0.3, oy: 40, yaw: 2 }, { pitch: 0.2, fov: 0.9, ty: 3, dist: 8 }]) {
    const { d } = scene(new Rec(), cam), P = [0, 0, 0], E = d.eye([0, 0, 0]);
    // A ground point 1e7 away, straight ahead of the eye.
    d.project(E[0] - Math.sin(d.cam.yaw) * 1e7, 0, E[2] - Math.cos(d.cam.yaw) * 1e7, P);
    near(horizon(d), P[1], 0.01, JSON.stringify(cam));
  }
  const { d } = scene(new Rec(), { pitch: 1.2, fov: 0.6 });
  assert.ok(horizon(d) < 0, "looking down past the field of view: above the canvas");
});
