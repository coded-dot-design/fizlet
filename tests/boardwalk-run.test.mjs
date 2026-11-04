// Boardwalk Run (site/gallery/pieces/skate/boardwalk-run.ts), headless: the run is plain numbers, so
// the game in it is checked here. The ghost (the attract run's driver) skates the whole course to the
// FINISH post with no bails: so every barrel, ball, gap, ramp and rail is clearable at cruise. Then a
// player's slams: a barrel to the shins, a gap rolled into (back up past it), a flip landed
// mid-rotation, a bouncing ball met standing up. A grind off one rail onto the next chains (RAIL TO
// RAIL); ducking the bouncing ball scores. The attract run settles. Steps allocate nothing
// (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/skate/boardwalk-run.ts");
const { boardwalk, COURSE, END, BARREL, GAP, RAIL, BALL } = M;
// Slots of S: 0 mode, 2 x, 3 height, 4 vy, 5 speed, 6 state, 7 flip time, 13 time, 14 bails, 15 duck.
const PLAY = 2, DONE = 3, ROLL = 0, AIR = 1, GRIND = 2, FALL = 4;
const at = (kind, n = 0) => { for (let i = 0, k = 0; i < COURSE.length; i += 4) if (COURSE[i] === kind && k++ === n) return COURSE.slice(i, i + 4); };
const settled = (r) => { for (let i = 0; i < 1500; i++) if (!r.step(1 / 60)) return true; return false; };
/** A run under the player's inputs from world x; `each(S, r, I)` sets them before every step. */
function play(sec, each, x = 0, auto = 0) {
  const I = new Float64Array(6), r = boardwalk(1, I, false), S = r.S;
  I[1] = 1;
  r.step(1 / 60);
  assert.equal(S[0], PLAY, "a press starts the run");
  S[2] = x;
  I[5] = auto;
  for (let i = 0; i < Math.round(sec * 60) && S[0] === PLAY; i++) (each(S, r, I), r.step(1 / 60));
  return { r, S, I };
}

test("boardwalk run: the ghost skates the whole course to the FINISH post, clean", () => {
  let grinds = 0, clears = 0, chain = 0;
  const { r, S } = play(60, (S, r) => ((grinds += r.ev[3]), (clears += r.ev[8]), r.cb.text().includes("RAIL TO RAIL") && (chain = 1)), 0, 1);
  assert.equal(S[0], DONE, "it reaches the post");
  assert.ok(S[2] >= END, `x ${S[2]}`);
  assert.equal(S[14], 0, "no bails");
  assert.ok(grinds >= 3 && chain, `grinds ${grinds}, chained ${chain}`);
  assert.ok(clears >= 8, `clears ${clears}`);
  assert.ok(S[13] > 20 && S[13] < 45, `time ${S[13].toFixed(1)} s`);
  assert.ok(r.cb.score > 3000 && r.cb.best > 0, `score ${r.cb.score}, best ${r.cb.best}`);
  assert.ok(settled(r), "after the card: still");
});

test("boardwalk run: a barrel to the shins slams, a gap rolled into drops you in the sand", () => {
  const [, b0] = at(BARREL);
  const hit = play(2, () => {}, b0 - 30);
  assert.ok(hit.S[14] >= 1, "rolled into the barrels: a bail");
  const [, g0, g1] = at(GAP, 2);
  let fell = 0;
  const gap = play(4, (S) => (fell ||= S[6] === FALL), g0 - 20);
  assert.ok(fell && gap.S[14] >= 1, "rolled into the gap: a fall");
  assert.ok(gap.S[2] > g1, `back up past the gap: ${gap.S[2].toFixed(1)}`);
});

test("boardwalk run: ollie a barrel and flip: banked on landing; flip late and it bails", () => {
  const [, b0] = at(BARREL);
  let popped = 0, flipped = 0, banked = 0;
  const { r } = play(2, (S, r, I) => {
    if (S[6] === ROLL && !popped && S[2] > b0 - 11) (I[1] = 1), (popped = 1);
    if (S[6] === AIR && !flipped && S[3] > 4 && S[4] > 40) (I[2] = 1), (flipped = 1);
    banked += r.ev[6];
  }, b0 - 40);
  assert.ok(banked >= 1 && r.cb.score >= (100 + 120) * 2, `kickflip + barrel hop banked: ${r.cb.score}`);
  assert.equal(r.S[14], 0);
  let late = 0;
  const b = play(2, (S, r, I) => {
    if (S[6] === ROLL && !late && S[2] > b0 - 11) I[1] = 1;
    if (S[6] === AIR && !late && S[4] < -60) (I[2] = 1), (late = 1);
  }, b0 - 40);
  assert.ok(b.S[14] >= 1 && b.r.cb.score === 0, "landed mid-flip: a bail, nothing banked");
});

test("boardwalk run: land on the guardrail to grind; ollie off onto the next one chains", () => {
  const [, a0, a1, h] = at(RAIL, 1), [, , b1] = at(RAIL, 2);
  // Just above the first of the pair, falling.
  const I = new Float64Array(6), q = boardwalk(1, I, false), Q = q.S;
  I[1] = 1;
  q.step(1 / 60);
  (Q[2] = a0 + 4), (Q[6] = AIR), (Q[3] = h + 1), (Q[4] = -20);
  let rail = 0, chain = 0;
  for (let i = 0; i < 240 && Q[2] < b1 + 30; i++) {
    if (Q[6] === GRIND && Q[2] > a1 - 6) I[1] = 1;
    q.step(1 / 60);
    rail += Q[6] === GRIND ? 1 : 0;
    if (q.cb.text().includes("RAIL TO RAIL")) chain = 1;
  }
  assert.ok(rail > 60, `ground the rails ${rail} steps`);
  assert.ok(chain, "ollied onto the next rail: RAIL TO RAIL");
  assert.equal(Q[14], 0, "clean");
  assert.ok(q.cb.score > 200, `banked ${q.cb.score}`);
});

test("boardwalk run: the bouncing ball hits a rider standing up; ducking under it scores", () => {
  const [, bx] = at(BALL, 1);
  const stand = [];
  for (let k = 0; k < 6; k++) stand.push(play(4, () => {}, bx - 150 - k * 9).S[14]);
  assert.ok(stand.some((b) => b > 0), "standing, some passes get hit");
  const g = play(5, () => {}, bx - 150, 1);
  assert.equal(g.S[14], 0, "the ghost's duck clears it");
  assert.ok(g.r.cb.score >= 90, `DUCK banked: ${g.r.cb.score}`);
});

test("boardwalk run: the attract run launches off the sand and settles; steps allocate nothing", async () => {
  const I = new Float64Array(6), r = boardwalk(3, I, true);
  let pops = 0;
  for (let i = 0; i < 60 * 7; i++) r.step(1 / 60), (pops += r.ev[1]);
  assert.ok(pops >= 2, `pops ${pops}`);
  assert.ok(settled(r), "idle: stopped, no more frames");
  const J = new Float64Array(6), q = boardwalk(5, J, false);
  J[1] = 1;
  q.step(1 / 60);
  J[5] = 1;
  for (let i = 0; i < 300; i++) q.step(1 / 60);
  const gcs = await minorGCs(() => {
    for (let k = 0; k < 4; k++) {
      J[1] = 1;
      for (let i = 0; i < 2400; i++) q.step(1 / 60), q.S[0] === 3 && q.S[12] > 1.3 && (J[1] = 1);
    }
  });
  assert.equal(gcs, 0, "no young-generation GCs over the steps");
});
