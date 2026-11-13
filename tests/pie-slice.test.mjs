// Pie Slice's game (site/gallery/pieces/pie-slice.ts, `pie()`), headless: a cut goes through the
// middle (a line: its angle folds into [0, π)), the knife runs, and after the round's cuts (2, then 3,
// then 4) the slices are both ends of every cut, sorted, their sizes adding up to the whole pie; even
// cuts are FAIR SHARES (three stars), uneven ones fewer (two or more is fair; under that the kid
// grabs the biggest); crumbs come off the knife and the dish's rim keeps them in; the rounds go 2, 3,
// 4 and round again; the same seed plays the same; and a whole game allocates nothing
// (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { pie, IDLE, AIM, CUT, SPLIT, DONE, ROUNDS, KNIFE, RIM, EV_FAIR, EV_GRAB, EV_SPLIT } = await import("../site/gallery/pieces/pie-slice.ts");
const MODE = 0, T = 1, ROUND = 2, N = 3, STARS = 5, TOTAL = 6, BIG = 7, RATIO = 8;
/** Make a round's cuts at these angles and play it out to its result. */
function round(p, angles) {
  for (const a of angles) {
    assert.equal(p.S[MODE], AIM);
    assert.ok(p.cut(a));
    assert.equal(p.S[MODE], CUT);
    for (let t = 0; t < KNIFE + 0.05; t += 1 / 60) p.step(1 / 60);
  }
  assert.equal(p.S[MODE], SPLIT);
  let fair = 0, grab = 0;
  for (let t = 0; t < 1; t += 1 / 60) p.step(1 / 60), (fair += p.ev[EV_FAIR]), (grab += p.ev[EV_GRAB]);
  assert.equal(p.S[MODE], DONE);
  return { fair, grab };
}
const even = (n, off = 0.3) => Array.from({ length: n }, (_, i) => off + (i * Math.PI) / n);

test("pie slice: even cuts are fair shares, three stars", () => {
  const p = pie(1);
  assert.equal(p.S[MODE], IDLE);
  assert.equal(p.cut(1), false, "no cutting before it starts");
  p.next();
  const r = round(p, even(2));
  assert.deepEqual(r, { fair: 1, grab: 0 });
  assert.equal(p.S[STARS], 3);
  assert.equal(p.S[TOTAL], 3);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(p.SZ[i] - 0.25) < 1e-9, "four quarters");
});

test("pie slice: the slices are both ends of every cut, and they add up to the pie", () => {
  const p = pie(2);
  p.next();
  round(p, [0.2, 3.6]);
  // 3.6 folds to 3.6 − π.
  assert.ok(Math.abs(p.CUTS[1] - (3.6 - Math.PI)) < 1e-9, "a line's angle folds into [0, π)");
  const sum = p.SZ.slice(0, 4).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  for (let i = 1; i < 4; i++) assert.ok(p.A[i] >= p.A[i - 1], "sorted");
  assert.ok(Math.abs(p.SZ[p.S[BIG]] - Math.max(...p.SZ.slice(0, 4))) < 1e-12, "the biggest is marked");
});

test("pie slice: lopsided cuts get the kid; nearly even is fair enough", () => {
  const p = pie(3);
  p.next();
  const r = round(p, [0.1, 0.5]);
  assert.deepEqual(r, { fair: 0, grab: 1 }, "two cuts close together: I CALL THAT ONE");
  assert.ok(p.S[RATIO] < 0.7);
  assert.equal(p.S[STARS], 0);
  // The next pie (3 cuts), each a little off: two stars.
  for (let t = 0; t < 1; t += 1 / 60) p.step(1 / 60);
  assert.ok(p.next());
  assert.equal(p.S[ROUND], 1);
  const q = round(p, [0, Math.PI / 3 + 0.06, (2 * Math.PI) / 3]);
  assert.equal(q.fair, 1);
  assert.equal(p.S[STARS], 2, `fair enough (${p.S[RATIO].toFixed(3)})`);
});

test("pie slice: the rounds go 2, 3, 4 cuts and round again; a press waits for the result", () => {
  const p = pie(4);
  p.next();
  for (let r = 0; r < 4; r++) {
    assert.equal(p.cuts(), ROUNDS[r % 3]);
    round(p, even(p.cuts(), 0.1 * r));
    assert.equal(p.next(), false, "too soon for the next pie");
    for (let t = 0; t < 1; t += 1 / 60) p.step(1 / 60);
    assert.ok(p.next());
    assert.equal(p.S[N], 0);
    if (r === 2) assert.equal(p.S[TOTAL], 0, "a new game after the third pie: the stars start over");
  }
});

test("pie slice: crumbs come off the knife and the dish's rim keeps them in; then it settles", () => {
  const p = pie(5);
  p.next();
  p.cut(0.7);
  let busy = true, n = 0;
  for (let i = 0; i < 600 && busy; i++) busy = p.step(1 / 60), n++;
  assert.ok(p.CA.some(Boolean), "crumbs");
  for (let k = 0; k < p.CA.length; k++) if (p.CA[k]) assert.ok(Math.hypot(p.CX[k], p.CY[k]) <= RIM - 1.5 + 1e-9, "inside the rim");
  assert.equal(busy, false, `still after ${n} steps`);
  assert.equal(p.S[MODE], AIM);
});

test("pie slice: the same seed plays the same; a whole game allocates nothing", async () => {
  const play = (p) => {
    for (let r = 0; r < 3; r++) {
      if (p.S[MODE] === IDLE || p.S[MODE] === DONE) p.next();
      for (let c = 0; c < p.cuts(); c++) {
        p.cut(c * 0.9 + 0.2);
        for (let i = 0; i < 30; i++) p.step(1 / 60);
      }
      for (let i = 0; i < 120; i++) p.step(1 / 60);
    }
  };
  const a = pie(9), b = pie(9);
  play(a), play(b);
  assert.deepEqual(Array.from(a.CX), Array.from(b.CX));
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
  void T, EV_SPLIT;
  const p = pie(10);
  play(p);
  assert.equal(await minorGCs(() => { for (let k = 0; k < 300; k++) play(p); }), 0);
});
