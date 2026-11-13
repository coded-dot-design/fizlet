// Wishbone (site/gallery/pieces/wishbone.ts), headless: a press grabs, the needle sweeps and bounces;
// a pull in the sweet spot breaks the bone on their side (you hold the knob: a win, the streak
// grows, dead centre is golden), a pull outside it breaks on yours (the streak resets, best stays);
// waiting past the patience pulls for them; the chips fly, bounce on the table and come to rest
// on it; the spot narrows and the needle quickens with the streak; steps allocate nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const W = await import("../site/gallery/pieces/wishbone.ts");
const { wishbone, IDLE, SWEEP, SNAP, TABLE, NC } = W;
const DT = 1 / 60;
const settle = (r) => { for (let i = 0; i < 600 && r.step(DT); i++); };

test("wishbone: in the spot you hold the knob; dead centre is golden; the chips land on the table", () => {
  const I = new Float64Array(1), r = wishbone(3, I), S = r.S;
  assert.equal(S[0], IDLE);
  I[0] = 1, r.step(DT);
  assert.equal(S[0], SWEEP, "a press grabs");
  for (let i = 0; i < 20; i++) r.step(DT);
  assert.ok(S[2] > 0, "the needle sweeps");
  S[2] = S[5];
  I[0] = 1, r.step(DT);
  assert.equal(S[0], SNAP);
  assert.ok(S[8] < -0.5, "broke far down their arm: the big half is yours");
  assert.deepEqual([S[9], S[10], S[12], S[13]], [1, 1, 1, 1], "win, golden, streak 1, best 1");
  settle(r);
  for (let i = 0; i < NC; i++) assert.ok(!r.CON[i] && Math.abs(r.CY[i] + r.CS[i] * 0.5 - TABLE) < 1e-6, `chip ${i} rests on the table`);
});

test("wishbone: outside the spot it breaks on your side; waiting too long, they pull", () => {
  const I = new Float64Array(1), r = wishbone(5, I), S = r.S;
  I[0] = 1, r.step(DT);
  S[2] = S[5], I[0] = 1, r.step(DT);
  settle(r);
  I[0] = 1, r.step(DT);
  assert.equal(S[0], SWEEP, "a press after the result grabs a new one");
  S[2] = S[5] > 0.5 ? 0 : 1;
  I[0] = 1, r.step(DT);
  assert.ok(S[8] > 0, "broke on your arm");
  assert.deepEqual([S[9], S[12], S[13]], [0, 0, 1], "a loss, the streak resets, best stays");
  settle(r);
  I[0] = 1, r.step(DT);
  let n = 0;
  while (S[0] === SWEEP && n++ < 60 * 30) r.step(DT);
  assert.equal(S[0], SNAP, "they pulled");
  assert.deepEqual([S[9], S[18]], [0, 1], "too slow: a loss");
});

test("wishbone: the spot narrows and the needle quickens with the streak", () => {
  const I = new Float64Array(1), r = wishbone(7, I), S = r.S;
  const widths = [], speeds = [];
  for (let k = 0; k < 6; k++) {
    I[0] = 1, r.step(DT);
    widths.push(S[6]), speeds.push(S[4]);
    S[2] = S[5], I[0] = 1, r.step(DT);
    settle(r);
  }
  for (let k = 1; k < 6; k++) assert.ok(widths[k] < widths[k - 1] && speeds[k] > speeds[k - 1], `round ${k}`);
  assert.equal(S[12], 6);
});

test("wishbone: steps allocate nothing", async () => {
  const I = new Float64Array(1), r = wishbone(9, I), S = r.S;
  const play = () => {
    for (let k = 0; k < 10; k++) {
      I[0] = 1, r.step(DT);
      for (let i = 0; i < 40; i++) r.step(DT);
      I[0] = 1, r.step(DT);
      for (let i = 0; i < 200; i++) r.step(DT);
    }
  };
  play();
  assert.equal(S[13] >= 0, true);
  assert.equal(await minorGCs(play), 0);
});
