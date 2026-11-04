// Perfect Fit (site/gallery/pieces/perfect-fit.ts), headless: the stack is plain numbers. Under a
// steady hand (a lean that answers the tilt and its speed) it stands and grows to the top; with no hand
// it topples within a few drops, every piece comes loose and lands on the floor, and the stamp waits
// for a press to start over. A drop that misses the top bounces off. The best height stays across
// runs. Steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { perfectFit, MAX, PLAY, CRASH, IDLE } = await import("../site/gallery/pieces/perfect-fit.ts");
// Slots of S: 0 mode, 2 tilt, 3 tilt speed, 5 height, 8 drop x, 15 dropping, 16 best, 17 crash time, 18 load offset, 19 load height.
const hand = (S, I) => {
  const v = -(2.2 * S[2] + 0.9 * S[3] + (0.6 * S[18]) / (S[19] + 6));
  I[0] = v * 3 > 1 ? 1 : v * 3 < -1 ? -1 : v * 3;
};
function start(seed) {
  const I = new Float64Array(2), r = perfectFit(seed, I);
  assert.equal(r.S[0], IDLE);
  assert.equal(r.S[5], 4, "a few on the stack before the first press");
  I[1] = 1;
  r.step(1 / 60);
  assert.equal(r.S[0], PLAY, "a press starts it");
  assert.equal(r.S[5], 0, "with empty hands");
  return { I, r, S: r.S };
}

test("perfect fit: a steady hand keeps it up all the way to the top", () => {
  for (const seed of [1, 2, 3]) {
    const { I, r, S } = start(seed);
    let lands = 0;
    for (let i = 0; i < 90 * 60 && S[5] < MAX; i++) hand(S, I), r.step(1 / 60), (lands += r.ev[1]);
    assert.equal(S[0], PLAY, `seed ${seed}: still standing`);
    assert.equal(S[5], MAX, `seed ${seed}: height ${S[5]}`);
    assert.equal(lands, MAX);
    assert.equal(S[16], MAX, "best follows");
  }
});

test("perfect fit: no hand and it topples, comes apart, lands, and waits for a press", () => {
  const { I, r, S } = start(4);
  let i = 0;
  for (; i < 30 * 60 && S[0] === PLAY; i++) r.step(1 / 60);
  assert.equal(S[0], CRASH, "it fell");
  assert.ok(i < 15 * 60, `within ${(i / 60).toFixed(1)} s`);
  const best = S[16];
  assert.ok(best >= 1, `best ${best}`);
  let n = 0;
  while (r.step(1 / 60) && n < 1200) n++;
  assert.ok(n < 1200, "every loose piece comes to rest and it goes still");
  for (let k = 0; k < r.DON.length; k++) if (r.DON[k]) assert.ok(r.DY[k] > 0 && r.DY[k] < 40, `piece ${k} rests on the floor pile: y ${r.DY[k].toFixed(1)}`);
  I[1] = 1;
  r.step(1 / 60);
  assert.equal(S[0], PLAY, "a press starts over");
  assert.equal(S[5], 0);
  assert.equal(S[16], best, "the best stays");
});

test("perfect fit: a drop wide of the top bounces off", () => {
  const { I, r, S } = start(5);
  let missed = 0;
  for (let i = 0; i < 20 * 60 && !missed; i++) {
    hand(S, I);
    if (S[15] && S[9] > 60) S[8] = 30; // nudge the falling one far wide
    r.step(1 / 60);
    missed += r.ev[2];
  }
  assert.ok(missed, "a miss");
  assert.equal(S[5], 0, "nothing landed");
  assert.ok(r.DON.some(Boolean), "it tumbles off as a loose piece");
});

test("perfect fit: steps allocate nothing", async () => {
  const { I, r, S } = start(6);
  for (let i = 0; i < 300; i++) hand(S, I), r.step(1 / 60);
  const gcs = await minorGCs(() => {
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < 1500; i++) {
        if (k & 1) I[0] = 0;
        else hand(S, I);
        r.step(1 / 60);
        if (S[0] === CRASH && S[17] > 1.2) I[1] = 1;
      }
    }
  });
  assert.equal(gcs, 0, "no young-generation GCs over the steps");
});
