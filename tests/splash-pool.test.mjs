// Splash Pool's water (site/gallery/pieces/pool/model.ts) in Node: the mirror images of a pulse are
// the right ones; a front comes back off a wall (the push at a point flips once the reflection
// passes); a cannonball behind the duck pushes it away; ripples alone bring it to the flag (the run
// and the best are counted; it flies back to the start); a drop on the duck is a foul; the drain
// swallows what floats and the refill gives it all back; everything comes to rest; and a busy step
// allocates nothing. The scene in Chromium: tests/splash-pool.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/pool/model.ts");
const { FS } = M;

const run = (p, sec, seen) => {
  for (let i = 0, n = Math.round(sec * 60); i < n; i++) {
    M.step(p, 1 / 60);
    if (seen) for (let e = 0; e < p.ne; e++) seen.push(p.E[e * 5]);
  }
};
const restFor = (p, max = 60) => {
  let t = 0;
  while (M.step(p, 1 / 60) && t < max) t += 1 / 60;
  return t;
};

// First, while the JIT has seen only this workload (the tests below exercise rare branches on other
// pools, and the deopts that follow show up as a young GC or two in a window).
test("splash-pool: a busy step allocates nothing", async (t) => {
  // The inputs come from fixed tables (a number made in the test's own loop would be the test's allocation).
  const p = M.newPool(), s = new Float64Array(1), XS = [-3, 1, 2.5, -1], ZS = [1, -1.5, 2, 0];
  const frame = () => {
    const i = s[0]++, k = (i / 300) & 3;
    if (i % 300 === 1) M.drop(p, M.ITEMS[k], XS[k], ZS[k]);
    if (i % 300 === 150) M.pulse(p, -2, 1, 0.6);
    if (i % 3000 === 10) M.drainPool(p);
    M.step(p, 1 / 60);
  };
  for (let i = 0; i < 30000; i++) frame();
  // The baseline: the same steps on a pool where nothing happens (the test runner's own noise).
  const still = M.newPool();
  for (let i = 0; i < 6000; i++) M.step(still, 1 / 60);
  const bare = await minorGCs(() => { for (let i = 0; i < 20000; i++) M.step(still, 1 / 60); });
  const busy = await minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  t.diagnostic(`young GCs over 20k steps: bare ${bare}, busy ${busy}`);
  assert.ok(busy <= bare + 1, `young-generation GCs: ${busy}`);
});

test("splash-pool: a pulse's mirror images across the walls, with their bounce counts", () => {
  const out = new Float64Array(36 * 3), n = M.images(1, -1, out), all = [];
  for (let i = 0; i < n; i++) all.push([+out[i * 3].toFixed(3), +out[i * 3 + 1].toFixed(3), out[i * 3 + 2]]);
  const has = (x, z, b) => all.some((a) => a[0] === x && a[1] === z && a[2] === b);
  assert.ok(has(1, -1, 0), "itself, no bounce");
  assert.ok(has(2 * M.X1 - 1, -1, 1), "across the right wall, one bounce");
  assert.ok(has(2 * M.X0 - 1, -1, 1), "across the left wall");
  assert.ok(has(1, 2 * M.Z0 + 1, 1) && has(1, 2 * M.Z1 + 1, 1), "across the far and near walls");
  assert.ok(has(2 * M.X1 - 1, 2 * M.Z0 + 1, 2), "a corner: two bounces");
  assert.ok(all.every((a) => a[2] <= 3), "three bounces at most");
});

test("splash-pool: a front reflects off the wall (the push at a point turns round)", () => {
  const p = M.newPool(), out = new Float64Array(3);
  p.F.fill(0);
  // The source at x = 2, the point at x = 3.5 (the wall at 4.5): the direct front passes going +x at
  // 0.6 s, the reflection comes back going −x at (2.5 + 1) / C = 1.4 s.
  M.pulse(p, 2, 0, 1);
  const pushAt = (age) => (p.P[2] = age, M.field(p, 3.5, 0, out)[1]);
  assert.ok(pushAt(1.5 / M.C) > 0.05, "the direct front pushes away from the source (+x)");
  assert.ok(pushAt(3.5 / M.C) < -0.02, "the reflected front pushes back (−x)");
  assert.ok(Math.abs(pushAt(2.4 / M.C)) < 0.02, "in between, still water");
  // Heights are the same at mirror points about the source's axis (a symmetric pool, a centred drop).
  M.reset(p), p.P.fill(0), M.pulse(p, 0, 0, 1), (p.P[2] = 1.1);
  assert.ok(Math.abs(M.field(p, 1.3, 0.7, out)[0] - M.field(p, -1.3, -0.7, new Float64Array(3))[0]) < 1e-9, "symmetric");
});

test("splash-pool: a cannonball behind the duck pushes it away; the water comes to rest", () => {
  const p = M.newPool(), x0 = p.F[0], z0 = p.F[1];
  M.drop(p, M.ROCK, x0 - 1, z0 + 0.9);
  run(p, 4);
  const dx = p.F[0] - x0, dz = p.F[1] - z0;
  assert.ok(dx > 0.4 && dz < -0.3, `the duck moved away from the drop (${dx.toFixed(2)}, ${dz.toFixed(2)})`);
  assert.equal(p.F[7], M.F_AFLOAT);
  assert.equal(p.drops, 1);
  const t = restFor(p);
  assert.ok(t < 30, `rests (${t.toFixed(1)} s)`);
  assert.equal(p.busy, false);
  const k = p.D.findIndex((v, i) => i % M.DS === 7 && v === M.D_REST);
  assert.ok(k >= 0 && Math.abs(p.D[k - 5] - M.FLOOR - M.RAD[M.ROCK] * 0.7) < 1e-9, "the stone lies on the floor");
});

test("splash-pool: ripples only, the duck reaches the flag; the run and the best are counted", () => {
  const p = M.newPool(), seen = [];
  let drops = 0;
  // Each time: a cannonball a step behind the duck, on the line from the flag through it.
  while (p.F[7] === M.F_AFLOAT && drops < 20) {
    const dx = p.F[0] - M.GOAL[0], dz = p.F[1] - M.GOAL[1], d = Math.hypot(dx, dz);
    M.drop(p, M.ROCK, p.F[0] + (dx / d) * 1.1, p.F[1] + (dz / d) * 1.1);
    drops++;
    run(p, 4, seen);
  }
  assert.ok(seen.includes(M.E_HOME), `home in ${drops} drops`);
  assert.ok(drops <= 14, `${drops} drops`);
  assert.equal(p.homes, 1);
  assert.equal(p.best, drops);
  assert.equal(p.drops, 0, "a new run");
  assert.ok(!seen.includes(M.E_FOUL), "no foul");
  // Its lap, its flight back, a splash at the start.
  run(p, M.HOME_T + M.FLY_T + 0.2, seen);
  assert.ok(seen.includes(M.E_BACK));
  assert.equal(p.F[7], M.F_AFLOAT);
  assert.ok(Math.hypot(p.F[0] - M.START[0], p.F[1] - M.START[1]) < 0.3, "back at the start");
});

test("splash-pool: a drop on the duck is a foul; a ball bounces off the float ring", () => {
  const p = M.newPool(), seen = [];
  M.drop(p, M.PEBBLE, p.F[0], p.F[1]);
  run(p, 1, seen);
  assert.ok(seen.includes(M.E_BONK) && seen.includes(M.E_FOUL), "bonk, foul");
  assert.equal(p.F[7], M.F_FLY);
  assert.equal(p.drops, 0, "the run starts again");
  run(p, 1.5, seen);
  assert.equal(p.F[7], M.F_AFLOAT, "the duck is back");
  const ring = [p.F[FS], p.F[FS + 1]];
  seen.length = 0;
  M.drop(p, M.BALL, ring[0] + 0.3, ring[1]);
  run(p, 2.5, seen);
  assert.ok(seen.includes(M.E_BONK) && !seen.includes(M.E_FOUL));
  const ball = 2 * FS;
  assert.equal(p.F[ball + 7], M.F_AFLOAT, "the ball floats");
  assert.ok(Math.hypot(p.F[ball] - p.F[FS], p.F[ball + 1] - p.F[FS + 1]) >= M.RAD[M.BALL] + M.RAD[M.RING] - 1e-6, "beside the ring, not in it");
});

test("splash-pool: the drain swallows what floats, then the refill gives it all back", () => {
  const p = M.newPool(), seen = [];
  M.drop(p, M.BALL, 2, 1.5), M.drop(p, M.DUCKY, -1, -1.5);
  run(p, 2);
  assert.equal(M.drainPool(p), true);
  assert.equal(M.drainPool(p), false, "once at a time");
  run(p, M.PULL, seen);
  const gulps = seen.filter((e) => e === M.E_GULP).length;
  assert.ok(gulps >= 3, `${gulps} went down`);
  run(p, M.REFILL + 3, seen);
  assert.equal(seen.filter((e) => e === M.E_POP).length, gulps, "each one back");
  assert.equal(M.draining(p), -1, "the cycle ends");
  for (let i = 0; i < 4; i++) assert.equal(p.F[i * FS + 7], M.F_AFLOAT, `floater ${i} afloat`);
  assert.ok(restFor(p) < 40);
});
