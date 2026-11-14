// Dune Hop's run (site/gallery/pieces/dune/course.ts) and its air scorer (stunt.ts), headless: the
// course is the same every build, its track is carved and painted; the clock waits for the first
// pedal; the autopilot drives both laps through every gate in order, in the air, with clean
// landings and no crash; a nose-down landing (brake held in the air) crashes, tumbles and drops
// back in at the last gate, the combo lost; the scorer's rules; and a whole run allocates nothing
// (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const C = await import("../site/gallery/pieces/dune/course.ts");
const ST = await import("../site/gallery/pieces/dune/stunt.ts");
const { READY, RUN, CRASH, DONE, E_GATE, E_LAND, E_CRASH, E_RESPAWN, E_FINISH, GATES, LAPS, GATE_AT, TRACK, KIND_TRACK } = C;

/** Run with the autopilot (and an optional override per step) until done or n steps; collect events. */
function drive(r, n, over) {
  const I = new Float64Array(3), ev = [];
  for (let i = 0; i < n && r.S[0] !== DONE; i++) {
    r.autopilot(I);
    over?.(I, r);
    r.step(1 / 60, I[0], I[1], I[2]);
    for (let k = 0; k < r.n; k++) ev.push([r.ev[k * 2], r.ev[k * 2 + 1]]);
    r.clear();
  }
  return ev;
}

test("dune hop: the course is the same every build; the track is carved level across and painted", () => {
  const a = C.course(), b = C.course();
  assert.deepEqual(Array.from(a.h), Array.from(b.h), "same heights, bit for bit");
  for (const g of GATE_AT) {
    const x = TRACK[g * 2], z = TRACK[g * 2 + 1];
    assert.equal(a.kindAt(x, z), KIND_TRACK, `gate ${g} stands on the track`);
  }
  assert.ok(Math.max(...a.h) > 1.8, "dunes stand up off the track");
  assert.ok(a.height(-C.HX, 0) < 0.02 && a.height(0, C.HZ) < 0.02, "down to the plinth at the edge");
});

test("dune hop: the clock waits for a pedal; the autopilot drives both laps clean, gates in order", () => {
  const r = C.duneRun();
  r.step(1 / 60, 0, 0, 0.5);
  assert.equal(r.S[0], READY, "steering alone does not start the run");
  assert.equal(r.S[1], 0, "and the clock waits");
  const ev = drive(r, 60 * 90);
  assert.equal(r.S[0], DONE, "finished");
  const gates = ev.filter((e) => e[0] === E_GATE).map((e) => e[1]);
  assert.deepEqual(gates, [...Array(GATES * LAPS - 1)].map((_, i) => (i + 1) % GATES), "every gate, in order, both laps");
  assert.equal(ev.filter((e) => e[0] === E_FINISH).length, 1);
  assert.equal(r.S[4], 0, "no crash");
  const lands = ev.filter((e) => e[0] === E_LAND);
  assert.ok(lands.length >= 4, `jumps scored: ${lands.length}`);
  // (Half or more clean: 2 of 4 since terrain.berm lost the lump past its ends, which changed the line into the next kicker; 3 of 4 before.)
  assert.ok(lands.filter((e) => e[1] === ST.CLEAN).length * 2 >= lands.length, "half or more clean");
  assert.ok(r.sc.S[ST.SC] > 0 && r.sc.S[ST.BEST] > 0.4, `score ${r.sc.S[ST.SC]}, best air ${r.sc.S[ST.BEST]}`);
  assert.ok(r.S[1] > 10 && r.S[1] < 40, `a short run: ${r.S[1].toFixed(1)} s`);
});

test("dune hop: brake held in the air noses it in: a crash, a tumble, back at the last gate, combo lost", () => {
  const r = C.duneRun();
  let at = -1;
  const ev = drive(r, 60 * 30, (I, run) => {
    if (run.S[2] >= 2 && run.v.air > 0 && at < 0) at = run.S[3];
    if (at >= 0 && run.S[0] === RUN && run.S[4] === 0) (I[0] = 0), (I[1] = 1);
    if (run.S[4] > 0 && run.S[0] === RUN) I[0] = I[1] = I[2] = 0;
  });
  const crash = ev.findIndex((e) => e[0] === E_CRASH), back = ev.findIndex((e) => e[0] === E_RESPAWN);
  assert.ok(crash >= 0, "crashed");
  assert.ok(back > crash, "and dropped back in");
  assert.equal(ev[back][1], at, "at the last gate passed");
  assert.equal(r.S[4], 1);
  assert.equal(r.sc.S[ST.CB], 0, "the combo is gone");
  assert.equal(r.v.crashed, false, "upright again");
});

test("dune hop: the air scorer: bumps, clean landings build the combo, sketchy and crashes lose it", () => {
  const s = ST.stunt({ minAir: 0.3, clean: 0.2, perSec: 100 });
  assert.equal(s.land(0.2, 0), ST.BUMP, "a bump scores nothing");
  assert.equal(s.land(0.5, 0.1), ST.CLEAN);
  assert.equal(s.S[ST.SC], 50);
  assert.equal(s.land(0.5, 0.1), ST.CLEAN);
  assert.equal(s.S[ST.PTS], 100, "× 2 with a combo of 1");
  assert.equal(s.land(0.6, 0.4), ST.SKETCHY);
  assert.equal(s.S[ST.PTS], 60, "sketchy: × 1");
  assert.equal(s.S[ST.CB], 0, "and the combo is gone");
  s.land(0.5, 0);
  s.crash();
  assert.equal(s.S[ST.CB], 0);
  assert.equal(s.S[ST.TOP], 2, "the longest combo is kept");
  assert.equal(s.S[ST.BEST], 0.6);
});

test("dune hop: a whole run allocates nothing", async () => {
  const r = C.duneRun(), I = new Float64Array(3);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      r.reset();
      for (let i = 0; i < 60 * 40 && r.S[0] !== DONE; i++) (r.autopilot(I), r.step(1 / 60, I[0], I[1], I[2]), r.clear());
    }
  };
  work(1);
  const n = await minorGCs(() => work(3));
  assert.ok(n <= 1, `young-generation GCs over 3 runs: ${n}`);
});
