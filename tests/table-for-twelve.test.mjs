// Table for Twelve's dinner (site/gallery/pieces/table/model.ts), headless: the ring of places (the
// kitchen end, the near side, the far end, the far side), passing one place at a time (on only while
// the table passes one way; back too from the third course), a dish served when it reaches the guest
// who wants it; its heat runs down over the course's seconds and stops at cold; hot is points (the
// heat and the streak), cold a grumble and none; the courses come quicker and cool sooner; dishes
// come out at both ends once both ways; the last course served is the end; the same seed plays the
// same dinner; and a whole dinner on a reused table allocates nothing (young-generation GCs, node
// --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/table/model.ts");
const { table, autopilot, hopsOn, IDLE, PLAY, BREAK, DONE, NN, HEAD, FOOT, NSEAT, SEAT_NODE, NODE_SEAT, RUN_N, COURSES, C_N, C_GAP, C_HEAT, BOTH_FROM, D_TABLE, D_HOT, D_COLD, HOT_PTS, HEAT_PTS, STREAK_PTS } = M;
const { MODE, COURSE, SEL, SCORE, HOT, COLD, STREAK, BOTH, SERVED, OUT } = M;
/** A table in play with its first dish out. */
function out(seed = 3) {
  const f = table(seed);
  f.start();
  for (let i = 0; i < 60 && f.S[OUT] === 0; i++) f.step(1 / 30);
  assert.equal(f.S[OUT], 1, "the first dish is out");
  return f;
}
/** Play the dinner through with the autopilot, a pass every `every` seconds. */
function dinner(f, every = 0.2) {
  f.start();
  let t = 0, n = 0;
  while (f.S[MODE] !== DONE && n++ < 200000) {
    f.step(1 / 60);
    if ((t += 1 / 60) >= every) (t = 0), autopilot(f);
  }
}

test("table for twelve: the ring of places", () => {
  assert.equal(NN, 14);
  assert.deepEqual(SEAT_NODE.map((n) => NODE_SEAT[n]), [...Array(NSEAT).keys()], "every seat has its place");
  assert.equal(NODE_SEAT[HEAD], -1);
  assert.equal(NODE_SEAT[FOOT], -1);
  assert.equal(hopsOn(13, 0), 1, "the far side's last place is next to the kitchen end");
  assert.equal(hopsOn(0, 13), 13);
});

test("table for twelve: a dish passes one place at a time, on only until both ways", () => {
  const f = out();
  const i = f.S[SEL];
  assert.equal(i, 0, "the first dish is held");
  assert.equal(f.DN[i], HEAD, "it comes out at the kitchen end");
  const seat = f.DW[i];
  assert.equal(f.WANT[seat], f.DK[i], "its guest is thinking of it");
  assert.equal(f.pass(-1), false, "one way: no passing back");
  assert.equal(f.ev[M.EV_REFUSE], 1);
  assert.equal(f.DN[i], HEAD);
  assert.equal(f.passTo(5), false, "not next to it");
  f.pass(1);
  assert.equal(f.DN[i], 1, "on to the first place");
  assert.equal(f.passTo(0), false, "passTo back is refused too");
  // On round the ring to its guest: served there, hot, and nowhere sooner.
  const to = SEAT_NODE[seat];
  while (f.DS[i] === D_TABLE) {
    const at = f.DN[i];
    f.pass(1);
    if (f.DN[i] !== to) assert.equal(f.DS[i], D_TABLE, `passes by place ${at + 1}`);
  }
  assert.equal(f.DN[i], to);
  assert.equal(f.DS[i], D_HOT);
  assert.equal(f.WANT[seat], -1, "the guest has it");
  assert.equal(f.S[HOT], 1);
  // Both ways: back is allowed.
  f.S[BOTH] = 1;
  for (let k = 0; k < 400 && f.S[OUT] < 2; k++) f.step(1 / 30);
  const j = f.S[SEL], n = f.DN[j];
  assert.equal(f.pass(-1), true);
  assert.equal(f.DN[j], (n + NN - 1) % NN, "back one place, round the ring");
});

test("table for twelve: the heat runs down over the course and stops at cold; cold is a grumble", () => {
  const f = out(5);
  const i = f.S[SEL];
  assert.equal(f.DH[i], 1);
  for (let k = 0; k < 30; k++) f.step(0.1);
  assert.ok(Math.abs(f.DH[i] - (1 - 3 / C_HEAT[0])) < 1e-9, "three seconds take 3/HEAT off");
  let chill = 0;
  for (let k = 0; k < 200; k++) f.step(0.1), (chill += f.ev[M.EV_CHILL]);
  assert.equal(f.DH[i], 0, "cold");
  assert.ok(chill >= 1, "it says so when it goes cold");
  const score = f.S[SCORE];
  while (f.DS[i] === D_TABLE) f.select(i), f.pass(1);
  assert.equal(f.DS[i], D_COLD);
  assert.equal(f.ev[M.EV_COLD], 1);
  assert.equal(f.S[COLD], 1);
  assert.equal(f.S[SCORE], score, "no points for a cold dish");
  assert.equal(f.S[STREAK], 0);
});

test("table for twelve: scoring is the heat left and the streak", () => {
  const f = out(7);
  const i = f.S[SEL];
  f.step(0.5);
  const h = f.DH[i];
  while (f.DS[i] === D_TABLE) f.pass(1);
  assert.equal(f.S[SCORE], HOT_PTS + HEAT_PTS * Math.ceil(h * 5), "a fresh dish: its heat in fifths");
  assert.equal(f.S[STREAK], 1);
  // The next one carries the streak.
  for (let k = 0; k < 400 && f.S[OUT] < 2; k++) f.step(1 / 30);
  const j = f.S[SEL], s0 = f.S[SCORE], h2 = f.DH[j];
  while (f.DS[j] === D_TABLE) f.pass(1);
  assert.equal(f.S[SCORE] - s0, HOT_PTS + HEAT_PTS * Math.ceil(f.DH[j] * 5) + STREAK_PTS * 1);
  assert.ok(f.DH[j] === h2, "heat stops when served");
});

test("table for twelve: the courses come quicker, cool sooner, and turn both ways; then dinner is served", () => {
  for (let c = 1; c < COURSES; c++) {
    assert.ok(C_GAP[c] < C_GAP[c - 1], "dishes come quicker");
    assert.ok(C_HEAT[c] < C_HEAT[c - 1], "and cool sooner");
  }
  assert.equal(C_N.reduce((a, b) => a + b, 0), RUN_N);
  const f = table(11);
  f.start();
  let t = 0, n = 0, course = 0, breaks = 0, twist = 0, foot = 0;
  const outAt = [];
  while (f.S[MODE] !== DONE && n++ < 200000) {
    const was = f.S[OUT];
    f.step(1 / 60);
    t += 1 / 60;
    if (f.S[OUT] > was) {
      outAt.push([f.S[COURSE], t]);
      if (f.DN[f.S[OUT] - 1] === FOOT) foot++;
      if (!f.S[BOTH]) assert.equal(f.DN[f.S[OUT] - 1], HEAD, "one way: out of the kitchen only");
    }
    if (f.ev[M.EV_BREAK]) breaks++, assert.equal(f.S[MODE], BREAK);
    if (f.ev[M.EV_TWIST]) (twist++, assert.equal(f.S[COURSE], BOTH_FROM));
    if (f.ev[M.EV_COURSE]) course++;
    if (n % 6 === 0) autopilot(f);
  }
  assert.equal(f.S[MODE], DONE);
  assert.equal(f.ev[M.EV_DONE], 1);
  assert.equal(f.S[SERVED], RUN_N);
  assert.equal(breaks, COURSES - 1);
  assert.equal(course, COURSES - 1, "a new course after each break");
  assert.equal(twist, 1);
  assert.ok(foot > 0, "dishes come out of the pantry end too once both ways");
  assert.equal(f.S[HOT] + f.S[COLD], RUN_N);
  assert.equal(f.S[HOT], RUN_N, "a quick autopilot serves every dish hot");
  // Within a course the gaps between dishes shrink course by course.
  const gap = (c) => {
    const ts = outAt.filter((o) => o[0] === c).map((o) => o[1]);
    return (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
  };
  for (let c = 1; c < COURSES; c++) assert.ok(gap(c) < gap(c - 1) + 1e-9, `course ${c + 1} is quicker (${gap(c).toFixed(2)} s < ${gap(c - 1).toFixed(2)} s)`);
  // Never more than one guest waits on a kind, and nobody waits on two.
  assert.ok(f.WANT.every((k) => k === -1));
});

test("table for twelve: a slow table goes cold", () => {
  const f = table(4);
  dinner(f, 2.4);
  assert.equal(f.S[MODE], DONE);
  assert.ok(f.S[COLD] > 0, `some dishes arrive cold (${f.S[COLD]})`);
  assert.equal(f.S[HOT] + f.S[COLD], RUN_N);
});

test("table for twelve: the same seed plays the same dinner", () => {
  const a = table(42), b = table(42);
  dinner(a), dinner(b);
  assert.deepEqual(Array.from(a.DK), Array.from(b.DK));
  assert.deepEqual(Array.from(a.DW), Array.from(b.DW));
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
  const c = table(43);
  dinner(c);
  assert.notDeepEqual(Array.from(c.DW), Array.from(a.DW));
  assert.equal(a.S[MODE], DONE);
  assert.equal(table(1).S[MODE], IDLE);
  void PLAY;
});

test("table for twelve: a whole dinner allocates nothing", async () => {
  const f = table(9);
  dinner(f);
  assert.equal(await minorGCs(() => { for (let k = 0; k < 40; k++) f.S[MODE] = DONE, dinner(f), f.cycle(1), f.passTo(3); }), 0);
});
