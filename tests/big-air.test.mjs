// Big Air's run (site/gallery/pieces/bikes/air-show.ts) and its trick scorer (tricks.ts), headless,
// on the Bikes series' shared bike (bike.ts). The arena is the same every build, its kickers and
// landings stamped and painted; the clock waits for the gas; the autopilot rides a minute: tricks held
// and put away, back flips on the light bike, clean landings on the down ramps, five judges at the end;
// a trick still out on landing is a bail; the scorer's rules; and a run allocates little.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const A = await import("../site/gallery/pieces/bikes/air-show.ts");
const T = await import("../site/gallery/pieces/bikes/tricks.ts");
const B = await import("../site/gallery/pieces/bikes/bike.ts");

/** Ride a run with the autopilot (and an optional override) until done; the events seen. */
function ride(r, n, over) {
  const I = new Float64Array(6), ev = [];
  for (let i = 0; i < n && r.phase !== A.DONE; i++) {
    over?.(I, r);
    r.step(1 / 60, I, !over);
    for (let k = 0; k < r.n; k++) ev.push([r.ev[k * 2], r.ev[k * 2 + 1]]);
    r.clear();
  }
  return ev;
}

test("big air: the arena is the same every build; the kickers stand up and are painted", () => {
  const a = A.arena(), b = A.arena();
  assert.deepEqual(Array.from(a.h), Array.from(b.h));
  for (const s0 of A.KICK) {
    const i = Math.round((s0 + A.KICK_L - 0.2) / (A.LAP / A.NT)) % A.NT, x = A.TRACK[i * 2], z = A.TRACK[i * 2 + 1];
    assert.ok(a.height(x, z) > 2.2, `the kicker's lip stands ${a.height(x, z).toFixed(2)} up`);
    assert.equal(a.kindAt(x, z), A.KIND_STEEL, "and is steel");
  }
});

test("big air: the clock waits for the gas; a minute of the autopilot scores tricks, flips and clean landings", () => {
  const r = A.airShow();
  r.go(B.TWO_STROKE);
  const I = new Float64Array(6);
  I[3] = 0.4;
  for (let i = 0; i < 30; i++) r.step(1 / 60, I), r.clear();
  assert.equal(r.phase, A.READY, "steering alone does not start it");
  assert.equal(r.clock, A.RUN_T, "and the clock waits");
  const ev = ride(r, 60 * 70);
  const S = r.sc.S;
  assert.equal(r.phase, A.DONE, "the minute ran out");
  assert.ok(ev.some((e) => e[0] === A.E_TRICK), "tricks out");
  assert.ok(S[T.FLIPS] >= 1, `back flips: ${S[T.FLIPS]}`);
  assert.ok(S[T.CLEANS] >= 4, `clean landings: ${S[T.CLEANS]} of ${S[T.JUMPS]}`);
  assert.ok(S[T.SEEN] >= 7, "three or more different tricks");
  assert.ok(S[T.SC] > 2500, `score ${S[T.SC]}`);
  const jd = r.sc.JD;
  assert.ok(jd[5] > 50 && jd[5] < 100, `judges ${Array.from(jd.slice(0, 6)).join(", ")}`);
  for (let k = 0; k < 5; k++) assert.ok(Math.abs(jd[k] - jd[5]) < 3, "the judges roughly agree");
  assert.deepEqual(ev.filter((e) => e[0] === A.E_END).length, 1);
});

test("big air: the heavy bike lands clean; a trick still out on landing is a bail", () => {
  const r = A.airShow();
  r.go(B.FOUR_STROKE);
  ride(r, 60 * 70);
  assert.ok(r.sc.S[T.CLEANS] >= 6 && r.sc.S[T.CRASHES] <= 2, `4-stroke: ${r.sc.S[T.CLEANS]} clean, ${r.sc.S[T.CRASHES]} crashes`);
  const q = A.airShow();
  q.go(B.FOUR_STROKE);
  // The autopilot to the first lip, then TRICK held all the way down.
  let held = false;
  const ev = ride(q, 60 * 10, (I, run) => {
    run.autopilot(I);
    if (run.b.air > 0.1) held = true;
    if (held) (I[4] = 1), (I[2] = 0);
  });
  assert.ok(ev.some((e) => e[0] === A.E_CRASH && e[1] === B.BAIL), "landed with the trick out: a bail");
  assert.equal(q.sc.S[T.CB], 0, "the combo is gone");
});

test("big air: the trick scorer: hops, holds, flips, the combo, sketchy and bails", () => {
  const s = T.tricks({ minAir: 0.35, clean: 0.3 });
  s.air(0.2);
  assert.equal(s.land(0, true), T.HOP, "a hop scores nothing");
  s.air(1);
  s.hold(0, 0.5, 0.5);
  assert.equal(s.J[0], 0, "a trick scores once it is all the way out");
  s.hold(0, 1, 0.5);
  assert.equal(s.land(0.1, true), T.CLEAN);
  const one = s.S[T.PTS];
  assert.ok(one > 150, `a held trick: ${one}`);
  s.air(1);
  s.hold(0, 1, 0.5);
  s.land(0.1, true);
  assert.ok(s.S[T.PTS] > one, "the combo multiplies the next");
  s.air(1.3);
  s.spin(6.4);
  assert.equal(s.land(0.5, false), T.SKETCHY);
  assert.equal(s.S[T.LFLIPS], 1, "a flip counted");
  assert.equal(s.S[T.CB], 0, "sketchy: the combo is gone");
  s.crash();
  assert.equal(s.S[T.CRASHES], 1);
  const jd = s.judges(7);
  assert.equal(jd[5], Math.round(((jd[0] + jd[1] + jd[2] + jd[3] + jd[4]) / 5) * 10) / 10);
});

test("big air: a run allocates little", async () => {
  const r = A.airShow(), I = new Float64Array(6);
  const work = () => {
    r.go(B.TWO_STROKE);
    for (let i = 0; i < 60 * 62 && r.phase !== A.DONE; i++) (r.step(1 / 60, I, true), r.clear());
  };
  for (let k = 0; k < 3; k++) work();
  const n = await minorGCs(work);
  assert.ok(n <= 3, `young-generation GCs over a run: ${n}`);
});
