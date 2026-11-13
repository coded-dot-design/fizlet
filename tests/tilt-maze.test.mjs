// Tilt Maze's physics (site/gallery/pieces/maze/tilt.ts), headless: every board's numbered line
// keeps clear of the holes and the walls (so it can be rolled), and a steady hand (`pilot`: tilt
// toward the next number at a sensible speed) rolls the ball from the start to the cup on every
// board without a fall; the ball rolls the way the board leans, stops on a level board, bounces off
// a wall with less speed than it came in, and drops into a hole it rolls over (and comes back to the
// start); the boards get harder (more holes, a longer line); and a whole board's physics allocates
// nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/maze/tilt.ts");
const { LEVELS } = M;
const segD = (px, pz, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = Math.max(0, Math.min(1, l ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l : 0));
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
};
const run = (l, max = 120) => {
  const bd = M.load(l), out = new Float64Array(2);
  let t = 0;
  while (t < max && bd.state === M.ROLLING) M.pilot(bd, out), M.tilt(bd, out[0], out[1]), M.step(bd, 1 / 60), (t += 1 / 60);
  return { bd, t };
};

test("tilt maze: every numbered line keeps clear of the holes and the walls", () => {
  assert.equal(LEVELS.length, 3);
  const frame = [[-9, -9, -M.HW, 9], [M.HW, -9, 9, 9], [-9, -9, 9, -M.HD], [-9, M.HD, 9, 9]];
  for (const [l, L] of LEVELS.entries()) {
    for (let i = 0; i + 1 < L.path.length; i++) {
      for (const h of L.holes) assert.ok(segD(h[0], h[1], L.path[i], L.path[i + 1]) >= 0.84, `board ${l + 1}: the line from ${i} to ${i + 1} clears hole ${h}`);
      for (let s = 0; s <= 20; s++) {
        const a = L.path[i], b = L.path[i + 1], x = a[0] + ((b[0] - a[0]) * s) / 20, z = a[1] + ((b[1] - a[1]) * s) / 20;
        for (const w of [...L.walls, ...frame]) {
          const d = Math.hypot(x - Math.max(w[0], Math.min(w[2], x)), z - Math.max(w[1], Math.min(w[3], z)));
          assert.ok(d >= M.BALL + 0.1, `board ${l + 1}: the line from ${i} to ${i + 1} clears wall ${w}`);
        }
      }
    }
    for (const h of L.holes) assert.ok(Math.abs(h[0]) + M.HOLE <= M.HW + 0.01 && Math.abs(h[1]) + M.HOLE <= M.HD + 0.01, `board ${l + 1}: hole ${h} is on the board`);
  }
});

test("tilt maze: a steady hand rolls every board from the start to the cup, no falls", () => {
  for (let l = 0; l < LEVELS.length; l++) {
    const { bd, t } = run(l);
    assert.equal(bd.state, M.HOME, `board ${l + 1}: in the cup (reached ${bd.far} of ${LEVELS[l].path.length - 1})`);
    assert.equal(bd.falls, 0, `board ${l + 1}: no falls`);
    assert.equal(bd.far, LEVELS[l].path.length - 1, `board ${l + 1}: every number passed, in order`);
    assert.ok(t > 8 && t < 60, `board ${l + 1}: ${t.toFixed(1)} s`);
  }
  assert.ok(LEVELS[0].holes.length < LEVELS[1].holes.length && LEVELS[0].path.length < LEVELS[2].path.length, "the boards get harder");
});

test("tilt maze: the ball rolls downhill, stops on the level, bounces softer, drops into a hole and comes back", () => {
  const bd = M.load(0);
  M.tilt(bd, 0.1, 0);
  for (let i = 0; i < 30; i++) M.step(bd, 1 / 60);
  assert.ok(bd.vx > 0.5 && Math.abs(bd.vz) < 1e-9, `rolls toward the low side: ${bd.vx}`);
  M.tilt(bd, 1, -1);
  assert.deepEqual([bd.tx, bd.tz], [M.MAX_TILT, -M.MAX_TILT], "the tilt is clamped");
  M.tilt(bd, 0, 0);
  let moving = true;
  for (let i = 0; i < 600 && moving; i++) moving = M.step(bd, 1 / 60);
  assert.equal(moving, false, "stops on a level board");
  // Into the right-hand frame at speed: it comes back slower.
  const b2 = M.load(0);
  (b2.x = 6), (b2.z = -3.4), (b2.vx = 6);
  for (let i = 0; i < 20; i++) M.step(b2, 1 / 60);
  assert.ok(b2.vx < 0 && -b2.vx < 6 * 0.6 && b2.x <= M.HW - M.BALL + 1e-9 && b2.knock > 4, `bounced: ${b2.vx}`);
  // Over a hole: it drops, counts a fall; respawn puts it back on the start.
  const b3 = M.load(0), h = LEVELS[0].holes[0];
  (b3.x = h[0] - 1), (b3.z = h[1]), (b3.vx = 3);
  for (let i = 0; i < 60 && b3.state === M.ROLLING; i++) M.step(b3, 1 / 60);
  assert.deepEqual([b3.state, b3.hole, b3.falls], [M.FALLING, 0, 1], "drops into the hole");
  M.respawn(b3);
  assert.deepEqual([b3.x, b3.z, b3.state, b3.far], [...LEVELS[0].path[0], M.ROLLING, 0], "back on the start");
});

test("tilt maze: rolling a whole board allocates nothing", async () => {
  const out = new Float64Array(2), bd = M.load(2);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      if (bd.state !== M.ROLLING) M.load(2, bd);
      M.pilot(bd, out), M.tilt(bd, out[0], out[1]), M.step(bd, 1 / 60);
    }
  };
  work(2000);
  globalThis.gc?.();
  const n = await minorGCs(() => work(30000));
  assert.ok(n <= 1, `young-generation GCs over 30,000 steps: ${n}`);
});
