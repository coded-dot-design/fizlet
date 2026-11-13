// Pocket Harbour's town (site/gallery/pieces/harbour/town.ts), headless: every toy started by a tap
// runs its course and stops by itself (so the scene settles), a second tap while it runs does
// nothing; the boat leaves its mooring and comes back to it nose out; the truck's loop starts and
// ends where it parks; at dusk the lamps come on one by one; the cat is found only where it hides,
// five times in five different spots; the same seed hides it the same way; and a busy evening
// allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const T = await import("../site/gallery/pieces/harbour/town.ts");
const { BOAT, TRUCK, GULLS, BEAM, DUR, LAMPS, SPOTS, E_FOUND, E_MISS, E_START, E_END, E_LAMP } = T;
const run = (t, sec) => { const ev = []; for (let i = 0; i < sec * 60; i++) { t.step(1 / 60); for (let k = 0; k < t.n; k++) ev.push([t.ev[k * 2], t.ev[k * 2 + 1]]); t.clear(); } return ev; };

test("pocket harbour: each toy runs its course once and stops by itself", () => {
  const t = T.town(1);
  for (const k of [BOAT, TRUCK, GULLS, BEAM]) assert.equal(t.start(k), true);
  assert.equal(t.start(BOAT), false, "a second tap while it runs does nothing");
  assert.equal(t.idle(), false);
  const ev = run(t, Math.max(...DUR) + 0.5);
  assert.deepEqual(ev.filter((e) => e[0] === E_END).map((e) => e[1]).sort(), [0, 1, 2, 3]);
  assert.equal(t.idle(), true, "all still: the scene can settle");
});

test("pocket harbour: the boat comes back to its mooring nose out; the truck parks where it started", () => {
  const t = T.town(1), a = new Float64Array(3), b = new Float64Array(3);
  t.boat(a);
  t.start(BOAT);
  run(t, DUR[BOAT] / 2);
  const mid = new Float64Array(3);
  t.boat(mid);
  assert.ok(Math.hypot(mid[0] - a[0], mid[1] - a[1]) > 5, "out in the bay half way");
  run(t, DUR[BOAT]);
  t.boat(b);
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6 && Math.abs(b[2] - a[2]) < 1e-6, "moored again, as it was");
  t.truck(a);
  t.start(TRUCK);
  run(t, DUR[TRUCK] + 0.1);
  t.truck(b);
  assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6, "parked");
  assert.ok(T.ROAD_LOOP.length > 30 && T.BOAT_LOOP.length > 20, "real loops");
});

test("pocket harbour: at dusk the lamps come on one by one, and the beam sweeps; by day they go off", () => {
  const t = T.town(1);
  t.setNight(true);
  assert.equal(t.T[BEAM] >= 0, true, "the beam starts at dusk");
  const on = [];
  for (let i = 0; i < 240; i++) { t.step(1 / 60); for (let k = 0; k < t.n; k++) if (t.ev[k * 2] === E_LAMP) on.push([i, t.ev[k * 2 + 1]]); t.clear(); }
  assert.deepEqual(on.map((e) => e[1]), [...Array(LAMPS).keys()], "in order along the quay");
  assert.ok(on.every((e, k) => !k || e[0] > on[k - 1][0]), "one at a time");
  t.setNight(false);
  assert.deepEqual(Array.from(t.lamp), Array(LAMPS).fill(0));
  t.toggleLamp(2);
  assert.equal(t.lamp[2], 1, "but any lamp can be poked on");
});

test("pocket harbour: the cat is found only where it hides, five times in five spots", () => {
  const t = T.town(7), seen = new Set();
  for (let f = 0; f < SPOTS; f++) {
    const s = t.spot(), wrong = (s + 1) % SPOTS;
    assert.equal(t.look(wrong), false, "not there");
    assert.equal(t.ev[0], E_MISS);
    t.clear();
    assert.equal(t.look(s), true, `found ${s}`);
    assert.equal(t.look(s), false, "once");
    seen.add(s);
    run(t, 2.4);
    assert.equal(t.H[0], f + 1);
  }
  assert.equal(seen.size, SPOTS, "every spot once");
  const a = T.town(3), b = T.town(3);
  assert.deepEqual(Array.from(a.order), Array.from(b.order), "the same seed hides it the same way");
});

test("pocket harbour: a busy evening allocates nothing", async () => {
  const t = T.town(1), o = new Float64Array(3);
  const work = (n) => {
    for (let r = 0; r < n; r++) {
      t.reset(r + 1);
      t.setNight(r % 2 === 0);
      for (const k of [BOAT, TRUCK, GULLS, BEAM]) t.start(k);
      for (let i = 0; i < 700; i++) {
        t.step(1 / 60);
        t.boat(o); t.truck(o); t.gull(i % 3, o); t.beam(o);
        if (i === 30) t.look(t.spot());
        t.clear();
      }
    }
  };
  work(2);
  const n = await minorGCs(() => work(20));
  assert.ok(n <= 1, `young-generation GCs: ${n}`);
});
