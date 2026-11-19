// fizlet/actor (Node, headless): spawn, kill, sweep and handles keep a fixed table honest, a seeded
// run replays row for row, events ring for the HUD and sound, and 1M busy steps allocate nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { actors } = await import("../src/actor.ts");
const { steer } = await import("../src/steer.ts");
const { seeded } = await import("../src/kernel/random.ts");

const alive = (A) => Array.from(A.list.subarray(0, A.n)).filter((i) => A.alive[i]);

test("spawn fills rows from 0, refuses when full, and zeroes the body", () => {
  const A = actors({ cap: 3 });
  assert.deepEqual([A.spawn(0, 10), A.spawn(1, 5, 2, 4), A.spawn(0, 1)], [0, 1, 2]);
  assert.equal(A.spawn(0, 1), -1, "full");
  assert.equal(A.spawn(9, 1), -1, "no such side");
  assert.deepEqual([A.live, A.n, A.count(0), A.count(1), A.count(7), A.count(-1)], [3, 3, 2, 1, 0, 0]);
  assert.deepEqual([A.side[1], A.kind[1], A.tags[1], A.hp[1], A.max[1]], [1, 2, 4, 5, 5]);
  A.x[1] = 50; A.vx[1] = 3; A.r[1] = 9;
  A.kill(1); A.sweep();
  assert.equal(A.spawn(1, 7), 1, "the freed row");
  assert.deepEqual([A.x[1], A.vx[1], A.r[1], A.hp[1]], [0, 0, 0, 7]);
});

test("kill marks dead at once; sweep gives rows back and keeps spawn order", () => {
  const A = actors({ cap: 8 });
  for (let k = 0; k < 6; k++) A.spawn(k % 2, 1);
  assert.equal(A.kill(2), true);
  assert.equal(A.kill(2), false, "already dead");
  A.kill(4);
  assert.deepEqual([A.live, A.n, A.count(0)], [4, 6, 1], "dead rows stay on the list until sweep");
  A.sweep();
  assert.deepEqual(Array.from(A.list.subarray(0, A.n)), [0, 1, 3, 5]);
  assert.deepEqual([A.spawn(0, 1), A.spawn(0, 1), A.spawn(0, 1)], [4, 2, 6], "freed rows first, newest freed first");
  assert.deepEqual(Array.from(A.list.subarray(0, A.n)), [0, 1, 3, 5, 4, 2, 6], "new actors go on the end");
});

test("killing mid-loop never skips or repeats an actor", () => {
  const A = actors({ cap: 32 }), R = seeded(5);
  for (let k = 0; k < 32; k++) A.spawn(k & 1, 1);
  for (let round = 0; round < 20; round++) {
    const seen = new Set(), expect = alive(A);
    for (let k = 0; k < A.n; k++) {
      const i = A.list[k];
      if (!A.alive[i]) continue;
      seen.add(i);
      if (R() < 0.3) A.kill(i); // itself
      const j = A.list[(R() * A.n) | 0];
      if (R() < 0.2 && j !== i && !seen.has(j)) A.kill(j); // one not visited yet
    }
    for (const i of seen) assert.ok(expect.includes(i));
    A.sweep();
    while (A.spawn(round & 1, 1) >= 0 && R() < 0.8);
  }
  assert.equal(A.n, A.live);
  assert.equal(A.count(0) + A.count(1), A.live);
});

test("hurt and heal: damage, the kill, the clamp; events on the ring", () => {
  const e = createEngine();
  const A = actors({ cap: 4, events: e.events });
  const i = A.spawn(1, 10);
  A.x[i] = 30; A.y[i] = 40;
  assert.equal(A.hurt(i, 4), false);
  A.heal(i, 100);
  assert.equal(A.hp[i], 10, "never over max");
  assert.equal(A.hurt(i, 6), false);
  assert.equal(A.hurt(i, 4), true, "that one killed it");
  assert.equal(A.hurt(i, 4), false, "the dead take no damage");
  A.heal(i, 5);
  assert.equal(A.hp[i], 0, "nor healing");
  const ev = [];
  for (let k = 0; k < e.events.size; k++) {
    const v = e.events.at(k);
    ev.push([v.type, v.a, v.b, v.x, v.y, v.v]);
  }
  assert.deepEqual(ev, [
    ["actor:spawn", 0, 1, 0, 0, 10],
    ["actor:hurt", 0, 1, 30, 40, 4],
    ["actor:hurt", 0, 1, 30, 40, 6],
    ["actor:hurt", 0, 1, 30, 40, 4],
    ["actor:kill", 0, 1, 30, 40, 0],
  ]);
  e.destroy();
});

test("handles outlive rows: get() is -1 once that actor is gone, even when its row lives again", () => {
  const A = actors({ cap: 2 });
  const i = A.spawn(0, 1), h = A.ref(i);
  assert.equal(A.get(h), i);
  A.kill(i);
  assert.equal(A.get(h), -1, "dead");
  A.sweep();
  const j = A.spawn(0, 1);
  assert.equal(j, i, "same row");
  assert.equal(A.get(h), -1, "a new actor, not the old one");
  assert.equal(A.get(A.ref(j)), j);
  assert.equal(A.get(-1), -1);
  A.clear();
  assert.equal(A.get(A.ref(j)), -1, "clear: everyone gone");
  assert.equal(A.live, 0);
  assert.equal(A.spawn(0, 1), 0);
  // Handles stay small integers (never a boxed double) at any capacity, across many generations.
  const B = actors({ cap: 5000 });
  for (let k = 0; k < 3e5; k++) {
    const r = B.spawn(0, 1), hh = B.ref(r);
    assert.ok(hh >= 0 && hh < 2 ** 30 && Number.isInteger(hh));
    B.kill(r); B.sweep();
    if (B.get(hh) !== -1) assert.fail("stale handle came back");
  }
});

test("tags: has every bit, set and clear", () => {
  const A = actors({ cap: 2 }), TANK = 1, ARMOR = 2, LEADER = 4;
  const i = A.spawn(0, 1, 0, TANK | ARMOR);
  assert.ok(A.has(i, TANK) && A.has(i, TANK | ARMOR) && !A.has(i, LEADER | TANK));
  A.tag(i, LEADER); A.tag(i, TANK, false);
  assert.equal(A.tags[i], ARMOR | LEADER);
});

test("nearest: the closest foe in range, by side bits and tag bits; ties to the earlier spawn", () => {
  const A = actors({ cap: 8 }), put = (s, x, y, t = 0) => { const i = A.spawn(s, 1, 0, t); A.x[i] = x; A.y[i] = y; return i; };
  const me = put(0, 0, 0), friend = put(0, 1, 0), far = put(1, 100, 0), near = put(1, 3, 4), tie = put(1, 4, 3), hq = put(2, 50, 0, 8);
  assert.equal(A.nearest(me), friend, "any side");
  assert.equal(A.nearest(me, Infinity, 1 << 1), near, "foes (side 1); a tie goes to the earlier");
  assert.equal(A.nearest(me, 4.9, 1 << 1), -1, "out of range");
  assert.equal(A.nearest(me, 5, 1 << 1), near, "range is inclusive");
  assert.equal(A.nearest(me, Infinity, ~1, 8), hq, "every side but mine, tagged 8");
  A.kill(near);
  assert.equal(A.nearest(me, Infinity, 1 << 1), tie, "the dead are skipped before sweep");
  A.kill(tie); A.kill(far);
  assert.equal(A.nearest(me, Infinity, 1 << 1), -1);
});

test("shares a body with fizlet/steer: both move the same numbers", () => {
  const m = steer({ cap: 4 }), A = actors({ cap: 4, x: m.x, y: m.y, a: m.a });
  const i = A.spawn(0, 1);
  m.place(i, 100, 100, 0);
  m.seek(i, 300, 100, 1 / 60);
  assert.equal(A.x, m.x);
  assert.ok(A.x[i] > 100 && A.y[i] === 100);
});

test("a seeded skirmish replays row for row", () => {
  const run = () => {
    const R = seeded(99), A = actors({ cap: 40, sides: 2 }), log = [];
    for (let f = 0; f < 3000; f++) {
      if (R() < 0.2) {
        const i = A.spawn((R() * 2) | 0, 3);
        if (i >= 0) (A.x[i] = R() * 500), (A.y[i] = R() * 500);
      }
      for (let k = 0; k < A.n; k++) {
        const i = A.list[k];
        if (!A.alive[i]) continue;
        const j = A.nearest(i, 120, 1 << (1 - A.side[i]));
        if (j >= 0 && A.hurt(j, 1)) log.push(`${f}:${i}>${j}`);
      }
      A.sweep();
    }
    return log.join(",");
  };
  const a = run();
  assert.ok(a.length > 100);
  assert.equal(run(), a);
});

test("actor: zero allocation across 1M steps (64 actors spawning, fighting, dying, swept)", async (t) => {
  const minors = async (on) => {
    const e = createEngine({ maxSteps: 1 });
    const A = actors({ cap: 64, sides: 2, events: e.events });
    let h = -1;
    // Driven directly, not through e.advance(): the frame loop's own noise (a few GCs on some Node
    // builds) would hide a small leak here. Same shape as a system's step.
    const sys = {
      step() {
        e.events.clear();
        if (!on) return;
        while (A.live < 48) {
          const i = A.spawn(A.live & 1, 3, 1, 2);
          // Spread by integers, not e.random(): a double returned from a call that isn't inlined
          // is boxed, and this step is big enough that it isn't (the harness's cost, not actor's).
          A.x[i] = (A.n * 97) % 400; A.y[i] = (A.n * 31) % 400;
        }
        for (let k = 0; k < A.n; k++) {
          const i = A.list[k];
          if (!A.alive[i]) continue;
          A.x[i] += 0.5; A.tag(i, 4, A.x[i] > 200);
          const j = A.nearest(i, 90, 1 << (1 - A.side[i]), 2);
          if (j >= 0) A.hurt(j, 0.25);
          if (A.has(i, 4) && A.x[i] > 400) A.kill(i);
          A.heal(i, 0.01);
          if (A.get(h) < 0) h = A.ref(i);
        }
        A.sweep();
      },
    };
    const frames = (n) => { for (let f = 0; f < n; f++) sys.step(); };
    frames(2000);
    const minor = await minorGCs(() => frames(1000000));
    e.destroy();
    return minor;
  };
  const bare = await minors(false), withActors = await minors(true);
  t.diagnostic(`young GCs over 1M steps (best of 3 windows): bare ${bare}, with ${withActors}`);
  assert.ok(withActors <= bare + 1, `young-generation GCs over 1M steps: ${withActors} with actors, ${bare} bare`);
});
