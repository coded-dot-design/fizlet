// The skate-sesh minis (site/gallery/pieces/skate/), headless: their sessions are plain numbers, so
// the games in them are checked here. Pump Pipe: holding on the drops pumps you over the coping,
// holding everywhere does not; a tap in the air flips the board, and a late flip bails. Rail Run: a
// timed ollie clears cones and gaps and lands on rails to grind; rolling on into a cone or a gap
// slams. Hill Bomb: carving the line shoots the fence gates, letting the
// board drift runs onto the grass and into the boards. All three settle, and their steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { pumpPipe, ROUND } = await import("../site/gallery/pieces/skate/pump-pipe.ts");
const { railRun } = await import("../site/gallery/pieces/skate/rail-run.ts");
const { hillBomb } = await import("../site/gallery/pieces/skate/hill-bomb.ts");

const run = (r, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), r.step(1 / 60)); };
const settled = (r) => { for (let i = 0; i < 1200; i++) if (!r.step(1 / 60)) return true; return false; };
// Pump Pipe slots: 3 u, 4 v, 5 air, 7 vz, 9 spin, 10 flips, 11 score, 15 tricks, 16 bails, 18 peak,
// 21 tries left, 22 best air.
const ARC = (Math.PI / 2) * 30, FLAT = 48;
const descending = (S) => { const th = S[3] < ARC ? 1 : S[3] > ARC + FLAT ? -1 : 0; return th !== 0 && S[4] * th > 0; };

test("pump pipe: the attract run gets air and lands a flip, then rolls to a stop on the flat", () => {
  const pad = new Float64Array(3), r = pumpPipe(7, pad, true);
  let landed = 0;
  run(r, 4.5, () => (landed += r.ev[2]));
  assert.ok(landed >= 1, "the ghost lands");
  assert.ok(settled(r), "idle: stopped, no more frames");
});

test("pump pipe: pumping the drops builds air, holding the climbs bleeds it; flips score, a late one bails", () => {
  const peak = (pump) => {
    const pad = new Float64Array(3), r = pumpPipe(3, pad, false), S = r.S;
    pad[1] = 1;
    let top = 0;
    run(r, 6, () => ((pad[0] = pump(S) ? 1 : 0), (top = Math.max(top, S[18]))));
    return top;
  };
  const good = peak(descending), bad = peak((S) => !descending(S));
  assert.ok(good > 18 && good > bad * 2, `air: pumped ${good.toFixed(1)}, held on the climbs ${bad.toFixed(1)}`);
  // A tap at launch flips and lands it clean; a tap at the last moment bails.
  const pad = new Float64Array(3), r = pumpPipe(3, pad, false), S = r.S;
  pad[1] = 1;
  let wasAir = 0, flipped = 0, late = 0;
  run(r, ROUND - 0.2, () => {
    pad[0] = !S[5] && descending(S) ? 1 : 0;
    if (S[5] && !wasAir && !flipped) (pad[1] = 1), (flipped = 1);
    else if (S[5] && flipped && !late && S[15] >= 1 && S[7] < 0 && S[18] > 15 && S[6] < 14) (pad[1] = 1), (late = 1);
    wasAir = S[5];
  });
  assert.ok(S[15] >= 1, `flips landed: ${S[15]}`);
  assert.ok(S[16] >= 1, `a late flip bails: ${S[16]}`);
  assert.ok(S[21] === 3 - S[16], `each bail costs a try: ${S[21]} left`);
  assert.ok(S[22] > 5, `the meter keeps the best air: ${S[22]}`);
  assert.ok(S[11] > 0, "points");
  run(r, 3);
  assert.equal(S[0], 3, "the session ends");
  assert.ok(settled(r), "the card, then still");
});

test("rail run: timed ollies clear, grind and score; rolling on slams; then it rolls to a stop", () => {
  let pad = new Float64Array(3), r = railRun(5, pad, false), S = r.S;
  pad[1] = 1;
  r.step(1 / 60);
  // The rider pops a beat before each obstacle (like the attract run).
  run(r, 10, () => {
    if (S[5] !== 0) return;
    for (let i = 0; i < 6; i++) {
      const d = r.OX[i] - 38, k = r.OK[i];
      if (k && d > 0 && d < (k === 3 ? 9 : k === 2 ? 16 : 18)) pad[1] = 1;
    }
  });
  assert.equal(S[0], 3, "the bell");
  assert.ok(S[12] >= 1, `grinds: ${S[12]}`);
  assert.ok(S[13] >= 3, `clean obstacles: ${S[13]}`);
  assert.equal(S[11], 0, "no slams");
  assert.ok(S[8] > 30, `points: ${S[8]}`);
  assert.ok(settled(r), "rolls to a stop, still");
  pad = new Float64Array(3), r = railRun(5, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 4);
  assert.ok(S[11] >= 1, "never ollie: slams");
});

// Hill Bomb slots: 3 x, 4 vx, 5 camera (how far down), 7 score, 8 slams, 9 gates, 13 next fence, 14 on the grass.
test("hill bomb: carving the line (the gates, a fork's branch, the path) shoots every gate clean; then it rolls to a stop", () => {
  let pad = new Float64Array(3), r = hillBomb(5, pad, false), S = r.S;
  pad[1] = 1;
  let grass = 0;
  run(r, 10.5, () => ((pad[0] = S[3] + S[4] * 0.25 < r.ghost() ? 1 : 0), (grass += S[14])));
  assert.equal(S[0], 3, "the run ends");
  assert.ok(S[9] >= 3 && S[8] === 0, `gates ${S[9]}, slams ${S[8]}`);
  assert.ok(S[7] > 60 && grass < 60, `points ${S[7]}, steps on the grass ${grass}`);
  assert.ok(settled(r), "rolls to a stop, still");
  // Never steering (always carving left): off the path, slowed by the grass, into the fences.
  pad = new Float64Array(3), r = hillBomb(5, pad, false), S = r.S;
  pad[1] = 1;
  grass = 0;
  run(r, 10, () => (grass += S[14]));
  assert.ok(S[8] >= 1 && grass > 200 && S[9] === 0, `slams ${S[8]}, grass ${grass}, gates ${S[9]}`);
});

test("skate-sesh: zero allocation in the sessions' steps (all three, riding flat out)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  for (const make of [pumpPipe, railRun, hillBomb]) {
    const pad = new Float64Array(3), r = make(11, pad, false), S = r.S;
    const steps = (n) => { for (let i = 0; i < n; i++) { if (S[0] !== 2) (pad[1] = 1), (S[11] = 9), (S[12] = 9), (S[14] = 9), (S[16] = 9); if ((i & 15) === 0) pad[1] = 1; pad[0] = (i >> 5) & 1; r.step(1 / 60); } };
    steps(20000);
    gc();
    const n = await minorGCs(() => steps(200000));
    assert.ok(n <= 1, `${make.name}: young-generation GCs over 200k steps: ${n}`);
  }
});
