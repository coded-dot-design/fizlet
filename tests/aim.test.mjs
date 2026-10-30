// fizlet/aim (Node, headless): lead meets the target (checked by flying the shot), cones are
// Blitz's fire check, sight is grid's line of sight, pick takes the nearest foe it may shoot, and
// none of it allocates per step.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { aim } = await import("../src/aim.ts");
const { actors } = await import("../src/actor.ts");
const { board, BLOCKED, COVER } = await import("../src/grid.ts");
const { seeded } = await import("../src/kernel/random.ts");

const bodies = (n) => ({ x: new Float64Array(n), y: new Float64Array(n), a: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n) });
const put = (b, i, x, y, a = 0, vx = 0, vy = 0) => ((b.x[i] = x), (b.y[i] = y), (b.a[i] = a), (b.vx[i] = vx), (b.vy[i] = vy));

test("lead: a still target is aimed at where it stands, t = distance / speed", () => {
  const b = bodies(2), s = aim(b);
  put(b, 0, 0, 0); put(b, 1, 300, 400);
  assert.equal(s.lead(0, 1, 250), true);
  assert.deepEqual(Array.from(s.out.subarray(0, 4)), [300, 400, 2, 500]);
  put(b, 1, 0, 0);
  assert.equal(s.lead(0, 1, 250), true, "on top of it");
  assert.deepEqual(Array.from(s.out.subarray(0, 4)), [0, 0, 0, 0]);
});

test("lead: a shot flown at the aim point meets the mover (10,000 seeded cases)", () => {
  const b = bodies(2), s = aim(b), R = seeded(17);
  let caught = 0;
  for (let k = 0; k < 10000; k++) {
    const speed = 50 + R() * 600, tv = R() * speed * 1.6, dir = R() * 7;
    put(b, 0, R() * 900, R() * 600);
    put(b, 1, R() * 900, R() * 600, 0, Math.cos(dir) * tv, Math.sin(dir) * tv);
    const ok = s.lead(0, 1, speed), [ax, ay, t, d] = s.out;
    if (tv < speed) assert.ok(ok, `a slower target is always caught (case ${k})`);
    if (!ok) {
      assert.equal(t, -1);
      // Never caught: the closing speed along the line never reaches the shot's at any time ahead.
      for (let tt = 0.01; tt < 60; tt *= 1.5) {
        const gx = b.x[1] + b.vx[1] * tt - b.x[0], gy = b.y[1] + b.vy[1] * tt - b.y[0];
        assert.ok(Math.hypot(gx, gy) > speed * tt * (1 - 1e-6), `case ${k}: a miss at t=${tt}`);
      }
      continue;
    }
    caught++;
    assert.ok(t >= 0);
    // The target is at the aim point at t, and the shot, flying straight at speed, gets there at t.
    const tol = 1e-6 * (1 + d);
    assert.ok(Math.abs(b.x[1] + b.vx[1] * t - ax) < tol && Math.abs(b.y[1] + b.vy[1] * t - ay) < tol, `case ${k}: target at aim point`);
    assert.ok(Math.abs(d - speed * t) < tol, `case ${k}: the shot arrives at t`);
    assert.ok(Object.is(d, Math.hypot(ax - b.x[0], ay - b.y[0])), "exact hypot");
    // The earliest meeting: no earlier time where the shot could already be there.
    for (let f = 1; f < 8; f++) {
      const tt = (t * f) / 8, gx = b.x[1] + b.vx[1] * tt - b.x[0], gy = b.y[1] + b.vy[1] * tt - b.y[0];
      assert.ok(Math.hypot(gx, gy) >= speed * tt - tol, `case ${k}: met earlier at ${tt}`);
    }
  }
  assert.ok(caught > 7000, `${caught} caught`);
});

test("lead: a target as fast as the shot is caught only coming in; one fleeing faster never", () => {
  const b = bodies(2), s = aim(b);
  put(b, 0, 0, 0); put(b, 1, 100, 0, 0, -200, 0);
  assert.equal(s.lead(0, 1, 200), true, "head on, same speed");
  assert.ok(Math.abs(s.out[2] - 0.25) < 1e-12 && Math.abs(s.out[0] - 50) < 1e-9);
  put(b, 1, 100, 0, 0, 200, 0);
  assert.equal(s.lead(0, 1, 200), false, "running away at the same speed");
  assert.deepEqual(Array.from(s.out.subarray(0, 3)), [100, 0, -1], "out: where it stands");
  put(b, 1, 100, 0, 0, 300, 0);
  assert.equal(s.lead(0, 1, 200), false, "faster and away");
  put(b, 1, 100, 0, 0, -300, 50);
  assert.equal(s.lead(0, 1, 200), true, "faster but coming across: the early crossing");
  assert.ok(s.out[2] > 0 && s.out[2] < 0.5);
});

test("lead: no velocity arrays means a standing target", () => {
  const b = bodies(2), s = aim({ x: b.x, y: b.y });
  put(b, 0, 0, 0); put(b, 1, 30, 40, 0, 999, 999);
  s.lead(0, 1, 10);
  assert.deepEqual(Array.from(s.out.subarray(0, 4)), [30, 40, 5, 50]);
});

test("cone: the same answer as Blitz's fire check (|wrapped error| < 0.12 and within 460)", () => {
  const b = bodies(2), s = aim(b), R = seeded(3);
  // dom-battlefield-blitz src/game.ts 1007–1008 (MIT): aim = atan2 to the target, err off the turret.
  const blitz = (t, o, ta) => {
    const aimA = Math.atan2(o.y - t.y, o.x - t.x), err = Math.abs(Math.atan2(Math.sin(aimA - ta), Math.cos(aimA - ta)));
    return err < 0.12 && Math.hypot(o.x - t.x, o.y - t.y) <= 460;
  };
  for (let k = 0; k < 100000; k++) {
    const t = { x: R() * 960, y: R() * 640 }, o = { x: R() * 960, y: R() * 640 }, ta = (R() - 0.5) * 40;
    put(b, 0, t.x, t.y, ta); put(b, 1, o.x, o.y);
    assert.equal(s.cone(0, 1, 0.12, 460), blitz(t, o, ta), `case ${k}`);
  }
});

test("cone: signed off-heading angle across ±π, inclusive range, a circle without headings", () => {
  const b = bodies(2), s = aim(b);
  put(b, 0, 0, 0, Math.PI - 0.05); put(b, 1, -100, -10);
  assert.equal(s.cone(0, 1, 0.2, 200), true, "wraps the short way round");
  assert.ok(s.out[2] > 0 && s.out[2] < 0.2, `turn left by ${s.out[2]}`);
  put(b, 1, -100, 10);
  s.cone(0, 1, 0.2, 200);
  assert.ok(s.out[2] < 0, "turn right");
  put(b, 1, 0, 100);
  assert.equal(s.cone(0, 1, 0.5, 100), false, "outside the cone");
  assert.equal(s.cone(0, 1, Math.PI, 100), true, "a full circle, range inclusive");
  assert.equal(s.cone(0, 1, Math.PI, 99.99), false);
  const c = aim({ x: b.x, y: b.y });
  assert.equal(c.cone(0, 1, 0, 100), true, "no headings: every cone is a circle");
});

test("sees: grid's line of sight, symmetric, cover by mask, everything without a board", () => {
  const g = board(10, 10, { cell: 32 }), b = bodies(3);
  g.flags[5 * 10 + 5] = BLOCKED; // a wall at cell (5, 5)
  g.flags[2 * 10 + 5] = COVER;
  put(b, 0, 1 * 32 + 16, 5 * 32 + 16); put(b, 1, 9 * 32 + 16, 5 * 32 + 16); put(b, 2, 9 * 32 + 16, 2 * 32 + 16);
  const s = aim({ ...b, board: g }), hard = aim({ ...b, board: g, mask: BLOCKED | COVER });
  assert.equal(s.sees(0, 1), false, "the wall");
  assert.equal(s.sees(1, 0), false, "symmetric");
  put(b, 1, 9 * 32 + 16, 2 * 32 + 16);
  put(b, 0, 1 * 32 + 16, 2 * 32 + 16);
  assert.equal(s.sees(0, 1), true, "cover lets a shot by");
  assert.equal(hard.sees(0, 1), false, "unless the mask says cover blocks");
  assert.equal(aim(b).sees(0, 1), true, "no board");
});

test("pick: the nearest foe in the cone and in sight, on an actor table", () => {
  const g = board(20, 20, { cell: 10 });
  const A = actors({ cap: 8, sides: 2 });
  const s = aim({ x: A.x, y: A.y, a: A.a, board: g, foe: (i, j) => A.alive[j] === 1 && A.side[j] !== A.side[i] });
  const at = (side, x, y) => { const i = A.spawn(side, 1); A.x[i] = x; A.y[i] = y; return i; };
  const me = at(0, 15, 105), mate = at(0, 40, 105), hidden = at(1, 60, 105), behind = at(1, 5, 105), far = at(1, 150, 125), off = at(1, 15, 150);
  g.flags[10 * 20 + 5] = BLOCKED; // between me and `hidden`
  assert.equal(s.pick(me, A.list, A.n, 0.4, 500), far, "not my mate, not behind the wall, not behind me, not off the cone");
  assert.equal(s.out[0], 150, "out is the pick's");
  assert.equal(s.pick(me, A.list, A.n, Math.PI, 500), behind, "a full circle: the one behind me is nearest");
  g.flags.fill(0);
  assert.equal(s.pick(me, A.list, A.n, 0.4, 500), hidden, "wall gone");
  assert.equal(s.pick(me, A.list, A.n, 0.4, 44), -1, "out of range");
  A.kill(hidden);
  assert.equal(s.pick(me, A.list, A.n, 0.4, 500), far, "the dead are skipped by foe");
  void mate; void off;
  // Ties go to the earlier row; with no foe filter every other row counts.
  const b = bodies(3), t = aim(b);
  put(b, 0, 0, 0); put(b, 1, 10, 0); put(b, 2, 0, 10);
  assert.equal(t.pick(0, new Int32Array([2, 1, 0]), 3, Math.PI, 100), 2);
  assert.equal(t.pick(0, new Int32Array([1, 2, 0]), 3, Math.PI, 100), 1);
});

test("aim: zero allocation across 100k steps (lead, cone, sight and pick for 32 actors)", async (t) => {
  const minors = async (on) => {
    const g = board(30, 20, { cell: 32 });
    for (let k = 0; k < 40; k++) g.flags[(k * 37) % 600] = BLOCKED;
    const A = actors({ cap: 32, sides: 2 });
    const s = aim({ x: A.x, y: A.y, a: A.a, vx: A.vx, vy: A.vy, board: g, foe: (i, j) => A.alive[j] === 1 && A.side[j] !== A.side[i] });
    for (let k = 0; k < 32; k++) {
      const i = A.spawn(k & 1, 1);
      A.x[i] = (k * 97) % 960; A.y[i] = (k * 53) % 640; A.a[i] = k * 0.7; A.vx[i] = (k % 7) - 3; A.vy[i] = (k % 5) - 2;
    }
    let hits = 0;
    const step = () => {
      if (!on) return;
      for (let k = 0; k < A.n; k++) {
        const i = A.list[k];
        A.a[i] += 0.01;
        const j = s.pick(i, A.list, A.n, 0.6, 500);
        if (j >= 0 && s.lead(i, j, 400) && s.sees(i, j)) hits++;
        if (s.cone(i, (i + 1) & 31, 0.3, 300)) hits++;
      }
    };
    for (let f = 0; f < 2000; f++) step();
    const minor = await minorGCs(() => { for (let f = 0; f < 100000; f++) step(); });
    return [minor, hits];
  };
  const [bare] = await minors(false), [withAim, hits] = await minors(true);
  t.diagnostic(`young GCs over 100k steps × 32 actors (best of 3 windows): bare ${bare}, with ${withAim}; ${hits} shots`);
  assert.ok(hits > 0);
  assert.ok(withAim <= bare + 1, `young-generation GCs: ${withAim} with aim, ${bare} bare`);
});
