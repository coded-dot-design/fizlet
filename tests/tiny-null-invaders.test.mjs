// Tiny Null Invaders' simulation (site/gallery/pieces/tiny-null-invaders.ts), headless: plain numbers,
// no DOM. Shots turn letters into binary (spent: shots pass), factories drain and fall, XP upgrades
// the gun, the round ends and Recall brings every letter back, then it goes still; and its step
// allocates nothing (young-generation GCs counted, tests/gc.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { invaders, MODE, GUN, XP, SX, TX, IDLE, PLAY, DONE } from "../site/gallery/pieces/tiny-null-invaders.ts";
import { minorGCs } from "./gc.mjs";

/** A little page: two factories up top, a headline of 20 letters across the middle. */
function board(seed) {
  const s = invaders(seed);
  s.n.factories = 2;
  for (let f = 0; f < 2; f++) (s.FX[f] = 22 + f * 76), (s.FY[f] = 11), (s.FW[f] = 30), (s.FH[f] = 7), (s.FP[f] = 8);
  s.n.letters = 20;
  for (let i = 0; i < 20; i++) (s.LX[i] = 30 + (i % 10) * 10), (s.LY[i] = 28 + ((i / 10) | 0) * 13), (s.LW[i] = 8), (s.LH[i] = 11);
  return s;
}
const run = (s, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (s.step(1 / 60), each?.(i)); };

test("a round: letters go binary, a factory falls, the gun upgrades; the end brings every letter back and it goes still", () => {
  const s = board(7);
  run(s, 3);
  assert.equal(s.S[MODE], IDLE, "the intro ends idle");
  s.go();
  assert.equal(s.S[MODE], PLAY);
  s.S[TX] = 37;
  run(s, 1.2);
  const bin = s.LS.reduce((a, b) => a + b, 0);
  assert.ok(bin >= 2, `letters above the ship went binary (${bin})`);
  run(s, 4, () => (s.S[TX] = 37));
  assert.ok(s.FP[0] <= 0, "the left factory fell");
  assert.ok(s.S[GUN] >= 2, `XP upgraded the gun (xp ${s.S[XP]}, gun ${s.S[GUN]})`);
  let done = false;
  run(s, 10, () => (done ||= s.S[MODE] === DONE));
  assert.ok(done, "the round ended");
  run(s, 4);
  assert.equal(s.S[MODE], IDLE, "Recall finished: idle again");
  assert.equal(s.LS.reduce((a, b) => a + b, 0), 0, "every letter is back");
  assert.deepEqual([s.FP[0], s.FP[1]], [8, 8], "the factories refilled");
  let moving = false;
  run(s, 2, () => (moving ||= s.step(0)));
  assert.equal(moving, false, "still: nothing left moving (the engine settles)");
});

test("a binary letter is spent: shots pass through it", () => {
  const s = board(3);
  run(s, 3);
  s.go();
  s.S[SX] = s.S[TX] = 34;
  for (let i = 0; i < 20; i++) if (i % 10 === 0) s.LS[i] = 1;
  run(s, 1);
  assert.ok(s.FP[0] < 8, "shots went through the spent column and hit the factory above");
});

test("zero allocation: the step allocates nothing mid-round", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const s = board(11);
  run(s, 3);
  s.go();
  run(s, 1);
  const gcs = await minorGCs(() => {
    for (let i = 0; i < 20000; i++) {
      if (s.S[MODE] !== PLAY) s.go();
      s.S[TX] = 20 + (i % 240) / 2;
      s.step(1 / 60);
    }
  });
  assert.equal(gcs, 0, "no young-generation GC over 20,000 steps");
});
