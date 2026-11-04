// The dev-humor minis (site/gallery/pieces/dev/), headless: their games are plain numbers, so they
// are checked here. Day 1 → Day 30: a tap is one day, a hold fast-forwards, the desk fills with cups
// (which land, shove each other and never rest on the laptop or on each other) and notes, day 30
// holds until a tap ships it, and it is Day 1 again. 127 Little Bugs: a patch takes one off the
// counter, then the patch hatches more (99 → 98 → 127), bugs run from the cursor, the stamp lands
// after a few patches and flings the bugs under it, and a tap starts a new sprint at 99. Both settle,
// and their steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { deskRot, LAST, CR, cupsFor, notesFor } = await import("../site/gallery/pieces/dev/day-thirty.ts");
const { bugSwarm, START, STAMP_AT, BUGN, STAMPBOX } = await import("../site/gallery/pieces/dev/little-bugs.ts");

const run = (r, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), r.step(1 / 60)); };
const settled = (r) => { for (let i = 0; i < 900; i++) if (!r.step(1 / 60)) return true; return false; };
// Day 1 → Day 30 slots: 0 mode, 2 day, 3 goal, 7 cups, 8 notes, 11 ships. 127 Little Bugs: 0 mode, 2 count, 3 shown, 5 patches, 9 stamp, 14 sprints.

test("day 1 → day 30: the attract run blurs two weeks, then it is day 1 again and the scene goes still", () => {
  for (let seed = 1; seed <= 4; seed++) {
    const pad = new Float64Array(6), r = deskRot(seed, pad, true);
    let top = 0;
    run(r, 4, () => (top = Math.max(top, r.S[2])));
    assert.ok(top >= 12, `seed ${seed}: the attract run reaches day ${top}`);
    run(r, 1);
    assert.equal(r.S[2], 1, "back to day 1");
    assert.equal(r.S[7], 1, "one coffee");
    assert.ok(settled(r), "idle: no more frames");
  }
});

test("day 1 → day 30: a tap is a day, a hold fast-forwards, the cups never rest on the laptop or on each other, a tap ships it", () => {
  const pad = new Float64Array(6), r = deskRot(7, pad, false), S = r.S;
  for (let d = 2; d <= 6; d++) {
    pad[1] = 1;
    run(r, 0.6);
    assert.equal(S[2], d, `tap ${d - 1}: day ${d}`);
  }
  assert.equal(S[7], cupsFor(6));
  assert.equal(S[8], notesFor(6));
  pad[0] = 1;
  run(r, 4);
  pad[0] = 0;
  assert.equal(S[2], LAST, "held: day 30");
  assert.ok(settled(r), "day 30 holds");
  assert.equal(S[7], cupsFor(LAST));
  assert.equal(S[8], notesFor(LAST));
  const { X, Y, Z } = r.cups;
  for (let i = 0; i < S[7]; i++) {
    assert.equal(Z[i], 0, `cup ${i} landed`);
    assert.ok(!(X[i] > 281 - CR + 1 && X[i] < 519 + CR - 1 && Y[i] > 156 - CR + 1 && Y[i] < 386 + CR - 1), `cup ${i} is off the laptop (${X[i] | 0}, ${Y[i] | 0})`);
    for (let j = i + 1; j < S[7]; j++) assert.ok(Math.hypot(X[i] - X[j], Y[i] - Y[j]) > CR * 2 - 3, `cups ${i} and ${j} don't overlap`);
  }
  pad[1] = 1;
  run(r, 0.2);
  assert.equal(S[0], 3, "a tap on day 30 ships it");
  assert.equal(S[11], 1);
  run(r, 2.5);
  assert.equal(S[2], 1, "and it is day 1 again");
  assert.equal(S[7], 1);
  assert.ok(settled(r));
});

test("127 little bugs: the attract run patches one and the patch hatches more (99 → 98 → 127), then the swarm hides", () => {
  const pad = new Float64Array(6), r = bugSwarm(3, pad, true), S = r.S;
  let low = START;
  run(r, 4, () => (low = Math.min(low, S[3])));
  assert.equal(low, START - 1, "the counter ticks down to 98 first");
  assert.equal(S[2], 127, "then climbs to 127");
  assert.ok(settled(r), "idle: the bugs stop, no more frames");
  assert.equal(S[3], 127, "the counter shows it");
});

test("127 little bugs: a tap on a bug patches it, a miss doesn't, bugs run from the cursor, the stamp lands and a tap starts a new sprint", () => {
  const pad = new Float64Array(6), r = bugSwarm(5, pad, false), S = r.S, B = r.bugs;
  const live = () => { for (let i = 0; i < BUGN; i++) if (B.ST[i] === 1) return i; return -1; };
  // A miss: far from every bug (the panel's top-left corner, cleared first).
  for (let i = 0; i < BUGN; i++) if (B.ST[i] === 1 && B.X[i] < 30 && B.Y[i] < 40) B.X[i] = 120;
  (pad[3] = 4), (pad[4] = 23), (pad[5] = 1), (pad[1] = 1);
  run(r, 1 / 60);
  assert.equal(S[5], 0, "a miss patches nothing");
  // The cursor next to a bug: it runs.
  pad[5] = 0;
  assert.ok(settled(r));
  const b = live();
  (pad[3] = B.X[b] - 3), (pad[4] = B.Y[b]), (pad[5] = 1);
  const d0 = Math.hypot(B.X[b] - pad[3], B.Y[b] - pad[4]);
  run(r, 0.3);
  assert.ok(Math.hypot(B.X[b] - pad[3], B.Y[b] - pad[4]) > d0 + 3, "the bug ran from the cursor");
  let count = S[2];
  for (let k = 1; k <= STAMP_AT; k++) {
    const i = live();
    (pad[3] = B.X[i]), (pad[4] = B.Y[i]), (pad[1] = 1);
    run(r, 1 / 60);
    assert.equal(S[5], k, `patch ${k}`);
    assert.equal(S[2], count - 1, "the patch takes one off");
    run(r, 1.2);
    assert.ok(S[2] > count - 1, `…and hatches more: ${count - 1} → ${S[2]}`);
    count = S[2];
  }
  assert.ok(S[9] > 0 && S[0] === 3, "the stamp landed");
  run(r, 0.4);
  for (let i = 0; i < BUGN; i++) if (B.ST[i] === 1) assert.ok(!(Math.abs(B.X[i] - STAMPBOX[0]) < STAMPBOX[2] - 6 && Math.abs(B.Y[i] - STAMPBOX[1]) < STAMPBOX[3] - 6), `bug ${i} was flung out from under the stamp`);
  pad[5] = 0;
  assert.ok(settled(r), "the cursor gone: the swarm hides");
  pad[1] = 1;
  run(r, 1 / 60);
  assert.equal(S[2], START, "a new sprint: 99");
  assert.equal(S[14], 1);
  assert.ok(settled(r));
});

test("dev-humor: zero allocation in the steps (the desk flat out, the swarm patched and stamped)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  {
    const pad = new Float64Array(6), r = deskRot(11, pad, false);
    const steps = (n) => { for (let i = 0; i < n; i++) { pad[0] = (i >> 6) & 1; if ((i & 31) === 0) pad[1] = 1; r.step(1 / 60); } };
    steps(20000);
    gc();
    const n = await minorGCs(() => steps(200000));
    assert.ok(n <= 1, `deskRot: young-generation GCs over 200k steps: ${n}`);
  }
  {
    const pad = new Float64Array(6), r = bugSwarm(11, pad, false);
    const steps = (n) => { for (let i = 0; i < n; i++) { pad[3] = 80 + Math.sin(i * 0.01) * 60; pad[4] = 56; pad[5] = 1; if ((i & 63) === 0) pad[1] = 1; r.step(1 / 60); } };
    steps(20000);
    gc();
    const n = await minorGCs(() => steps(200000));
    assert.ok(n <= 1, `bugSwarm: young-generation GCs over 200k steps: ${n}`);
  }
});
