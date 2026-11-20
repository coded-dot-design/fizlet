// @fzlt/core/diorama's `glide` in Node: the camera eases to a goal by 1 − e^(−rate·dt) a step, lands
// exactly, leaves the fields the goal does not name, snaps when asked; and easing allocates nothing.
// The allocation test runs first, in a process that has seen one camera and one shape of goal (a game's
// case): with goals of several shapes at one call site V8 stops inlining the per-field helper and boxes
// its result (measured: 3 young GCs per 1M steps in tests/diorama.test.mjs's process).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { diorama, glide } = await import("../src/diorama.ts");

class NullCtx { setTransform() {} fillRect() {} clearRect() {} beginPath() {} moveTo() {} lineTo() {} arc() {} closePath() {} fill() {} stroke() {} }
const ctx = new NullCtx();
const fakeCanvas = () => ({ canvas: { clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => ctx } });

test("diorama: glide() allocates nothing (0 young GCs over 1M steps)", async () => {
  const d = diorama(fakeCanvas().canvas);
  // As games set a view: whole numbers into the camera's fields.
  Object.assign(d.cam, { yaw: 0, pitch: 1, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0 });
  const A = { ...d.cam, yaw: 1, pitch: 0.9, dist: 12, tx: 4, ty: 1, tz: -3, ox: 60, oy: -20 }, B = { ...d.cam };
  let moves = 0;
  const work = () => {
    for (let i = 0; i < 1e6; i++) if (glide(d.cam, (i / 400) & 1 ? A : B, 5.5, 1 / 60)) moves++;
  };
  work(); // warm up
  const gcs = await minorGCs(work);
  assert.ok(moves > 0);
  assert.ok(gcs <= 1, `${gcs} young GCs`);
});

test("diorama: glide() eases the camera to a goal, lands exactly, leaves unnamed fields, snaps when asked", () => {
  const d = diorama(fakeCanvas().canvas);
  Object.assign(d.cam, { yaw: 0, pitch: 0.5, dist: 20, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, fov: 0.6 });
  const goal = { ...d.cam, yaw: 1, pitch: 0.9, dist: 12, tx: 4, ty: 1, tz: -3, ox: 60, oy: -20 };
  assert.equal(glide(d.cam, goal, 5.5, 1 / 60), true);
  const k = 1 - Math.exp(-5.5 / 60);
  assert.ok(Math.abs(d.cam.yaw - k) < 1e-12 && Math.abs(d.cam.dist - (20 - 8 * k)) < 1e-12 && Math.abs(d.cam.ox - 60 * k) < 1e-12, "each field moves 1 − e^(−rate·dt) of the way");
  let n = 1;
  while (glide(d.cam, goal, 5.5, 1 / 60) && n < 2000) n++;
  assert.ok(n > 30 && n < 200, `settles in a second or two (${n} frames)`);
  assert.deepEqual({ ...d.cam }, goal, "lands exactly on the goal");
  assert.equal(glide(d.cam, goal), false, "at rest: false");
  // Only the named fields move.
  assert.equal(glide(d.cam, { tx: 9 }, 3, 0.1), true);
  assert.ok(d.cam.tx > 4 && d.cam.tx < 9);
  assert.deepEqual({ ...d.cam, tx: 0 }, { ...goal, tx: 0 });
  // A cut.
  assert.equal(glide(d.cam, { tx: -2, yaw: 3, fov: 0.4 }, 5.5, 1 / 60, true), false);
  assert.deepEqual([d.cam.tx, d.cam.yaw, d.cam.fov], [-2, 3, 0.4]);
  // A goal just inside the tolerance lands at once.
  assert.equal(glide(d.cam, { yaw: 3 + 4e-4, ox: d.cam.ox + 0.3 }), false);
  assert.equal(d.cam.yaw, 3 + 4e-4);
});
