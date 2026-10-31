// Tiny Byte Runner's simulation (site/gallery/pieces/tiny-byte-runner.ts), headless: plain numbers,
// no DOM. The frog eats crumbs on the trails and letters off them; the flies come in and a touch
// costs a life; a power square makes them edible (200, 400, 800); the round ends, Recall brings
// every letter back, then it goes still; and its step allocates nothing (tests/gc.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { runner, MODE, FX, FY, SCORE, LIVES, POW, CRUMBS, EATEN, IDLE, PLAY, DONE } from "../site/gallery/pieces/tiny-byte-runner.ts";
import { minorGCs } from "./gc.mjs";

/** A little page: 20 letters between the top and middle trails. */
function board(seed) {
  const s = runner(seed);
  s.n.letters = 20;
  for (let i = 0; i < 20; i++) (s.LX[i] = 30 + (i % 10) * 10), (s.LY[i] = 14 + ((i / 10) | 0) * 12), (s.LW[i] = 8), (s.LH[i] = 10);
  return s;
}
const run = (s, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (s.step(1 / 60), each?.(i)); };

test("a round: crumbs on the trail, letters off it; the end brings every letter back and it goes still", () => {
  const s = board(4);
  run(s, 2.6);
  assert.equal(s.S[MODE], IDLE, "the intro ends idle");
  const intro = s.S[CRUMBS];
  s.turn(0);
  assert.equal(s.S[MODE], PLAY);
  assert.equal(s.S[CRUMBS], 0, "a round starts with every crumb back");
  run(s, 0.5);
  assert.ok(s.S[CRUMBS] >= 2 && intro >= 1, "crumbs eaten along the top trail");
  s.turn(1);
  run(s, 0.6);
  assert.ok(s.S[EATEN] >= 1, `letters eaten off the trail (${s.S[EATEN]})`);
  let done = false;
  run(s, 13, () => (done ||= s.S[MODE] === DONE));
  assert.ok(done, "the round ended");
  run(s, 5);
  assert.equal(s.S[MODE], IDLE, "Recall finished: idle again");
  assert.equal(s.LS.reduce((a, b) => a + b, 0), 0, "every letter is back");
  let moving = false;
  run(s, 2, () => (moving ||= s.step(0)));
  assert.equal(moving, false, "still: nothing left moving (the engine settles)");
});

test("a fly's touch costs a life; with power the frog eats it instead, in a chain", () => {
  const s = board(8);
  run(s, 2.6);
  s.turn(0);
  run(s, 2.5);
  const f = [...s.QS].findIndex((q) => q === 1);
  assert.ok(f >= 0, "a fly is in");
  (s.S[POW] = 0), (s.QX[f] = s.S[FX]), (s.QY[f] = s.S[FY]);
  s.step(1 / 60);
  assert.equal(s.S[LIVES], 2, "a touch costs a life");
  run(s, 2);
  const g = [...s.QS].findIndex((q) => q === 1), before = s.S[SCORE];
  s.S[POW] = 3;
  (s.QX[g] = s.S[FX]), (s.QY[g] = s.S[FY]);
  s.step(1 / 60);
  assert.equal(s.QS[g], 2, "eaten while the frog glows");
  assert.ok(s.S[SCORE] - before >= 200, "worth 200");
});

test("zero allocation: the step allocates nothing mid-round", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const s = board(11);
  run(s, 2.6);
  s.turn(0);
  run(s, 1);
  const gcs = await minorGCs(() => {
    for (let i = 0; i < 20000; i++) {
      if (s.S[MODE] !== PLAY) s.turn(0);
      if (i % 50 === 0) s.turn((i / 50) % 4);
      s.step(1 / 60);
    }
  });
  assert.equal(gcs, 0, "no young-generation GC over 20,000 steps");
});
