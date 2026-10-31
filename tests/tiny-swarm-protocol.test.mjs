// Tiny Swarm Protocol's simulation (site/gallery/pieces/tiny-swarm-protocol.ts), headless: plain
// numbers, no DOM. Bugs eat letters into binary and grow tiers; hunters drain buttons; a squash in
// reach kills (a tier-2 bug takes two); the round ends, Recall brings every letter and button back,
// then it goes still; and its step allocates nothing (young-generation GCs counted, tests/gc.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { swarm, MODE, EATEN, SQUASHED, IDLE, PLAY, DONE } from "../site/gallery/pieces/tiny-swarm-protocol.ts";
import { minorGCs } from "./gc.mjs";

/** A little page: 30 letters in three lines, three buttons below. */
function board(seed) {
  const s = swarm(seed);
  s.n.letters = 30;
  for (let i = 0; i < 30; i++) (s.LX[i] = 30 + (i % 10) * 10), (s.LY[i] = 12 + ((i / 10) | 0) * 13), (s.LW[i] = 8), (s.LH[i] = 11);
  s.n.buttons = 3;
  for (let t = 0; t < 3; t++) (s.TX[t] = 26 + t * 40), (s.TY[t] = 58), (s.TW[t] = 28), (s.TH[t] = 8);
  return s;
}
const run = (s, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (s.step(1 / 60), each?.(i)); };

test("a round left alone: bugs eat letters, grow tiers, hunters drain buttons; Recall puts it all back and it goes still", () => {
  const s = board(5);
  run(s, 3.2);
  assert.equal(s.S[MODE], IDLE, "the intro ends idle");
  s.go();
  assert.equal(s.S[MODE], PLAY);
  let tier = 0, drained = false, done = false;
  run(s, 13, () => ((tier = Math.max(tier, ...s.BT)), (drained ||= s.TP.some((p) => p < 1)), (done ||= s.S[MODE] === DONE)));
  assert.ok(s.S[EATEN] >= 6, `letters eaten into binary (${s.S[EATEN]})`);
  assert.ok(tier >= 2, "a bug grew a tier");
  assert.ok(drained, "a hunter drained a button");
  assert.ok(done, "the round ended");
  run(s, 5);
  assert.equal(s.S[MODE], IDLE, "Recall finished: idle again");
  assert.equal(s.LS.reduce((a, b) => a + b, 0), 0, "every letter is back");
  assert.deepEqual([...s.TP], [1, 1, 1], "the buttons' colour is back");
  assert.equal(s.BS.reduce((a, b) => a + b, 0), 0, "the swarm is gone");
  let moving = false;
  run(s, 2, () => (moving ||= s.step(0)));
  assert.equal(moving, false, "still: nothing left moving (the engine settles)");
});

test("a squash in reach kills a bug; a tier-2 bug takes two; a miss kills nothing", () => {
  const s = board(9);
  run(s, 3.2);
  s.go();
  run(s, 0.5);
  const b = s.BS.findIndex((x) => x);
  s.swat(s.BX[b] + 40 > 160 ? s.BX[b] - 40 : s.BX[b] + 40, s.BY[b]);
  s.swat(s.BX[b], s.BY[b]);
  assert.equal(s.S[SQUASHED], 1, "one squashed");
  const c = s.BS.findIndex((x) => x);
  (s.BT[c] = 2), (s.BH[c] = 2);
  s.swat(s.BX[c], s.BY[c]);
  assert.equal(s.S[SQUASHED], 1, "the tier-2 bug survives one");
  s.swat(s.BX[c], s.BY[c]);
  assert.equal(s.S[SQUASHED], 2, "and falls to the second");
});

test("zero allocation: the step allocates nothing mid-round", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const s = board(11);
  run(s, 3.2);
  s.go();
  run(s, 1);
  const gcs = await minorGCs(() => {
    for (let i = 0; i < 20000; i++) {
      if (s.S[MODE] !== PLAY) s.go();
      if (i % 40 === 0) s.swat(20 + (i % 120), 30);
      s.step(1 / 60);
    }
  });
  assert.equal(gcs, 0, "no young-generation GC over 20,000 steps");
});
