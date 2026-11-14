// Moto Track's bike (site/gallery/pieces/bikes/bike.ts, shared by the Bikes series) and its race
// (moto-course.ts), headless. The bike: the same inputs give the same ride, bit for bit; the 4-stroke
// pulls flat out with the front down, the 2-stroke's hit pops it up; weight back with the gas held
// loops it out; the rear brake saves a wheelie past the balance point; a rider tapping the gas (with a
// human's reaction time) holds a wheelie for seconds; in the air the weight pitches it, and nosing in
// crashes. The race: the course is the same every build; the clock waits for the gate; the autopilot
// takes the player through three laps on either bike with no crash; a bike's ride allocates nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const B = await import("../site/gallery/pieces/bikes/bike.ts");
const M = await import("../site/gallery/pieces/bikes/moto-course.ts");
const flat = { sample(x, z, o) { o[0] = 0; o[1] = 0; o[2] = 1; o[3] = 0; return 0; } };

/** Ride `p` on the flat for `secs` with ctl(t, bike) → [gas, brake, lean]; the events seen. */
function ride(p, secs, ctl) {
  const b = B.bike(flat, p), ev = [];
  b.reset(0, 0, 0);
  let maxRel = 0;
  for (let i = 0; i < secs * 60; i++) {
    const [g, br, l] = ctl(i / 60, b);
    b.set(g, br, l, 0);
    b.step(1 / 60);
    for (let k = 0; k < b.n; k++) ev.push([b.ev[k * 2], b.ev[k * 2 + 1]]);
    b.clear();
    if (!b.crashed) maxRel = Math.max(maxRel, b.rel);
  }
  return { b, ev, maxRel };
}

test("bike: deterministic, bit for bit", () => {
  const ctl = (t) => [t < 2 ? 1 : 0.3, t > 3 ? 0.5 : 0, Math.sin(t * 3), 0];
  const a = ride(B.TWO_STROKE, 4, ctl).b, c = ride(B.TWO_STROKE, 4, ctl).b;
  assert.deepEqual([...a.pos, ...a.rot, a.speed, a.rpm], [...c.pos, ...c.rot, c.speed, c.rpm]);
});

test("bike: the 4-stroke pulls with the front down; the 2-stroke's hit pops it; weight back and the gas loops it", () => {
  const four = ride(B.FOUR_STROKE, 3, () => [1, 0, 0]);
  assert.ok(four.maxRel < 0.15 && !four.b.crashed, `4-stroke flat out: front down (${four.maxRel.toFixed(2)} rad)`);
  assert.ok(four.b.speed > 15, "and it pulls to its top speed");
  const two = ride(B.TWO_STROKE, 3, () => [1, 0, 0]);
  assert.ok(two.ev.some((e) => e[0] === B.B_WHEELIE), "2-stroke flat out: the hit lifts the front (a wheelie)");
  assert.ok(two.maxRel > 0.2 && !two.b.crashed, `and it comes back down (${two.maxRel.toFixed(2)} rad)`);
  for (const p of [B.TWO_STROKE, B.FOUR_STROKE]) {
    const loop = ride(p, 3, () => [1, 0, 1]);
    assert.ok(loop.b.crashed && loop.b.crash === B.LOOP, `${p.name}: weight back and the gas held loops it out`);
  }
});

test("bike: the rear brake saves a wheelie past the balance point; tapping the gas holds one", () => {
  for (const p of [B.TWO_STROKE, B.FOUR_STROKE]) {
    let braked = 0;
    const save = ride(p, 4, (t, b) => {
      if (b.balance > 1.05) braked = 1;
      return braked ? [0, b.contact[1] ? 0 : 1, 0] : [1, 0, 1];
    });
    assert.ok(braked && !save.b.crashed && save.b.contact[1], `${p.name}: past the balance point, the brake brings it down`);
    // A rider on keys with a 150 ms reaction: gas on below the balance zone, off in it.
    const seen = [];
    const hold = ride(p, 10, (t, b) => {
      seen.push(b.balance + 0.15 * (b.S[3] / b.bp));
      const bal = seen[Math.max(0, seen.length - 10)];
      return [bal < 0.9 ? 1 : 0, bal > 1.12 ? 1 : 0, 1];
    });
    const longest = Math.max(0, ...hold.ev.filter((e) => e[0] === B.B_WHEELIE).map((e) => e[1]), hold.b.wheelie);
    assert.ok(!hold.b.crashed && longest > 3, `${p.name}: a wheelie held for ${longest.toFixed(1)} s`);
  }
});

test("bike: in the air the weight pitches it; nosing in crashes, level lands", () => {
  // A ramp up to 3 units over 6, then a drop to the flat.
  const ramp = { sample(x, z, o) { const on = x > 0 && x < 6, s = on ? 0.5 : 0, l = Math.hypot(1, s); o[0] = on ? x * 0.5 : 0; o[1] = -s / l; o[2] = 1 / l; o[3] = 0; return 0; } };
  const jump = (lean) => {
    const b = B.bike(ramp, B.TWO_STROKE);
    b.reset(-6, 0, 0, 13);
    let air = 0, mid = 0, crashed = false, kind = 0;
    for (let i = 0; i < 240; i++) {
      b.set(b.air > 0 ? 0 : 0.6, 0, b.air > 0 ? lean : 0, 0);
      b.step(1 / 60);
      if (b.air > 0) air = Math.max(air, b.air);
      if (b.air > 0.35 && !mid) mid = b.pitch;
      if (b.crashed && !crashed) (crashed = true), (kind = b.crash);
      b.clear();
    }
    return { air, mid, crashed, kind };
  };
  const fwd = jump(-1), level = jump(0.15), back = jump(1);
  assert.ok(level.air > 0.6, `off the lip: ${level.air.toFixed(2)} s of air`);
  assert.ok(fwd.mid < level.mid && level.mid < back.mid, `weight forward pitches it down, back up (${fwd.mid.toFixed(2)} < ${level.mid.toFixed(2)} < ${back.mid.toFixed(2)})`);
  assert.ok(fwd.crashed && fwd.kind === B.ENDO, "nosed in: over the bars");
  assert.ok(!level.crashed, "near level: rides away");
});

test("moto track: the course is the same every build; the track is painted; the features stand up", () => {
  const a = M.course(), b = M.course();
  assert.deepEqual(Array.from(a.h), Array.from(b.h));
  for (let i = 0; i < M.NT; i += 20) assert.notEqual(a.kindAt(M.TRACK[i * 2], M.TRACK[i * 2 + 1]), 0, `point ${i} is on the track`);
  assert.ok(Math.max(...[...Array(200)].map((_, k) => M.profile((k / 200) * M.LAP))) > 1.3, "the triple stands up");
  assert.ok(Math.abs(M.TRACK[0] - M.TRACK[(M.NT - 1) * 2]) < 1, "the loop closes");
});

test("moto track: the gate holds them; the autopilot races three laps clean on either bike", () => {
  for (const p of [B.TWO_STROKE, B.FOUR_STROKE]) {
    const r = M.motoRace(), I = new Float64Array(5), ev = [];
    r.go(p);
    I[0] = 1;
    for (let i = 0; i < 60; i++) r.step(1 / 60, I, false), r.clear();
    assert.equal(r.phase, M.GRID, "counting down");
    assert.ok(Math.abs(r.riders[0].speed) < 0.05, "held at the gate with the gas on");
    assert.ok(r.riders[0].rpm > 0.3, "revving");
    for (let i = 0; i < 60 * 80 && r.phase !== M.DONE; i++) {
      r.step(1 / 60, I, true);
      for (let k = 0; k < r.n; k++) ev.push([r.ev[k * 3], r.ev[k * 3 + 1], r.ev[k * 3 + 2]]);
      r.clear();
    }
    assert.equal(r.phase, M.DONE, `${p.name}: finished`);
    assert.deepEqual(ev.filter((e) => e[0] === M.E_LAP && e[1] === 0).map((e) => e[2]), [1, 2], "laps in order");
    assert.equal(r.crashes(0), 0, `${p.name}: no crash`);
    assert.ok(r.finishTime(0) > 25 && r.finishTime(0) < 60, `${p.name}: ${r.finishTime(0).toFixed(1)} s`);
    assert.ok(ev.some((e) => e[0] === M.E_LAND && e[2] < 0.3), "clean landings");
  }
});

test("moto track: a bike's ride allocates nothing; a whole race stays near it", async () => {
  const b = B.bike(flat, B.TWO_STROKE);
  const ride1 = () => {
    b.reset(0, 0, 0);
    for (let i = 0; i < 6000; i++) (b.set(i % 90 < 60 ? 1 : 0, i % 90 > 80 ? 1 : 0, Math.sin(i * 0.05), Math.sin(i * 0.02)), b.step(1 / 60), b.clear());
  };
  ride1();
  const one = await minorGCs(ride1);
  assert.ok(one <= 1, `one bike, 6,000 steps: ${one} young-generation GCs`);
  // Four bikes on the terrain: V8 still boxes a few doubles per substep across the instances (a
  // scavenge or two per race, measured; one bike measures none): bounded here so it cannot grow.
  const r = M.motoRace(), I = new Float64Array(5);
  const work = () => {
    r.go(B.TWO_STROKE);
    for (let i = 0; i < 60 * 45 && r.phase !== M.DONE; i++) (r.step(1 / 60, I, true), r.clear());
  };
  for (let k = 0; k < 3; k++) work();
  const n = await minorGCs(work);
  assert.ok(n <= 5, `young-generation GCs over a race of four: ${n}`);
});
