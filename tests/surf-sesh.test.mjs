// The surf-sesh minis (site/gallery/pieces/surf/), headless: their rides are plain numbers, so the
// games in them are checked here. Shoot the Pier: steering through each bay's window threads it and
// keeps you ahead of the wall, and the beams, the gull, the fish and the wall each wipe you out. Lip Line: holding climbs the face and snaps at the lip, riding
// low outruns the breaking wall, and the wall, the pilings and the gull wipe you out; Tube Time: holding pumps toward the light,
// letting go drags you into the foam, and ten seconds in the glow gets you spat out. Both settle,
// and their steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { lipLine, ROUND: LIP_ROUND } = await import("../site/gallery/pieces/surf/lip-line.ts");
const { tubeTime, SPIT, WORKED } = await import("../site/gallery/pieces/surf/tube-time.ts");
const { paddleOut } = await import("../site/gallery/pieces/surf/paddle-out.ts");
const { pierRun, NB, BY_WALL, BY_BEAM, BY_GULL, BY_FISH } = await import("../site/gallery/pieces/surf/pier.ts");

const run = (r, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), r.step(1 / 60)); };
const settled = (r) => { for (let i = 0; i < 600; i++) if (!r.step(1 / 60)) return true; return false; };

// Lip Line slots: 3 y, 4 vy, 5 rider x, 6 wall x, 7 score, 9 best chain, 10 snaps, 11 wipeouts, 12 wipeout clock,
// 17 gull/hopper x, 23 what did it, 24 hopper (not gull), 26 airs landed.
const line = (r) => (r.S[3] + r.S[4] * 0.2 < r.ghost() ? 1 : 0);

test("lip line: the attract run snaps at the lip and dodges the pier, then the scene goes still", () => {
  let snaps = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const pad = new Float64Array(3), r = lipLine(seed, pad, true);
    let wiped = 0;
    run(r, 4.6, () => ((snaps += r.ev[0]), (wiped += r.ev[1])));
    assert.equal(wiped, 0, `seed ${seed}: the ghost never wipes out`);
    assert.ok(settled(r), "idle: no more frames");
  }
  assert.ok(snaps >= 4, `snaps over six attract runs: ${snaps}`);
});

test("lip line: riding the line (under the pier, over the gull, snaps and airs when clear) outruns the wall", () => {
  const pad = new Float64Array(3), r = lipLine(3, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 1 / 60);
  assert.equal(S[0], 2, "a press starts the ride");
  run(r, LIP_ROUND + 2, () => (pad[0] = line(r)));
  assert.equal(S[0], 3, "the bell");
  assert.ok(S[10] >= 2 && S[9] >= 2, `snaps ${S[10]}, best chain ${S[9]}`);
  assert.ok(S[26] >= 1, `airs off the lip, landed: ${S[26]}`);
  assert.ok(S[11] <= 1, `wipeouts: ${S[11]}`);
  assert.ok(settled(r), "the card, then still");
});

test("lip line: the wall, the pilings and the gull each wipe you out, and the foam resets the ride", () => {
  const causes = new Set();
  let hopper = 0;
  for (let seed = 1; seed <= 8; seed++) {
    // Never hold (low: the gull), always hold (high: the pilings), high but ducking every pier (slow: the wall).
    for (const hold of [() => 0, () => 1, (r) => (r.ghost() === 0 ? line(r) : 1)]) {
      const pad = new Float64Array(3), r = lipLine(seed, pad, false), S = r.S;
      pad[1] = 1;
      run(r, LIP_ROUND, () => { pad[0] = hold(r); if (r.ev[1]) causes.add(S[23]); if (S[24] === 1 && S[17] > 0) hopper = 1; });
    }
  }
  assert.deepEqual([...causes].sort(), [1, 2, 3], "wall, pier, and the gull or the hopper");
  assert.equal(hopper, 1, "the hopper comes bouncing along the flat water");
  const pad = new Float64Array(3), r = lipLine(2, pad, false), S = r.S;
  pad[1] = 1;
  pad[0] = 1;
  let at = -1;
  run(r, 8, () => (at < 0 && r.ev[1] ? (at = S[11]) : 0));
  assert.ok(at >= 1, "holding at the lip all ride: the wall catches you");
  pad[0] = 0;
  run(r, 1.6);
  assert.ok(S[12] === 0 && S[6] < S[5], "after the foam, the next ride: the wall is behind you again");
});

test("tube time: chasing the glow lasts the ride and gets spat out; letting go feeds you to the foam", () => {
  let pad = new Float64Array(3), r = tubeTime(5, pad, false), S = r.S;
  pad[1] = 1;
  run(r, ROUND_T(), () => (pad[0] = S[3] + S[4] * 0.4 < S[5] ? 1 : 0));
  assert.equal(S[9], SPIT, "ten seconds in the barrel: spat out");
  assert.ok(S[6] > 100, `points in the pocket: ${S[6]}`);
  assert.ok(settled(r), "still after the card");
  pad = new Float64Array(3), r = tubeTime(5, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 5);
  assert.equal(S[9], WORKED, "no pumping: the foam gets you");
});
const ROUND_T = () => 10.5;

test("paddle out: diving under each wall reaches the lineup; staying up gets washed; a dive held too long runs out of air", () => {
  const ahead = (r) => { for (let k = 0; k < 3; k++) if (r.WX[k] - 56 < 9 && r.WX[k] + r.WW[k] - 56 > -4) return 1; return 0; };
  let pad = new Float64Array(3), r = paddleOut(3, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 10.5, () => (pad[0] = ahead(r)));
  assert.equal(S[14], 1, "out at the lineup");
  assert.ok(S[7] >= 4 && S[9] === 0, `dives ${S[7]}, washes ${S[9]}`);
  assert.ok(settled(r), "the card, then still");
  pad = new Float64Array(3), r = paddleOut(3, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 10.5);
  assert.ok(S[9] >= 3 && S[14] === 0, `never diving: washed ${S[9]} times, not out`);
  pad = new Float64Array(3), r = paddleOut(3, pad, false), S = r.S;
  pad[1] = 1;
  pad[0] = 1;
  run(r, 1.6);
  assert.ok(S[16] === 1 && S[4] < 0.5, "held too long: out of air, the board comes up (until you let go)");
});

test("surf-sesh: zero allocation in the rides' steps (all three, riding flat out)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  for (const make of [lipLine, tubeTime, paddleOut]) {
    const pad = new Float64Array(3), r = make(11, pad, false);
    // Keep it riding: restart whenever a ride ends, hold on and off.
    const steps = (n) => { for (let i = 0; i < n; i++) { if (r.S[0] !== 2) pad[1] = 1, r.S[10] = 9, r.S[11] = 9, r.S[15] = 9, r.S[16] = 9; pad[0] = (i >> 5) & 1; r.step(1 / 60); } };
    steps(20000);
    gc();
    const n = await minorGCs(() => steps(200000));
    assert.ok(n <= 1, `${make.name}: young-generation GCs over 200k steps: ${n}`);
  }
});

// Shoot the Pier slots: 0 mode, 2 scroll, 3 y, 5 rider x, 7 wall x, 8 score, 11 threaded, 12 wipeouts,
// 13 wipeout clock, 23 what did it, 24 shots, 25 the finish. Its pad: [0] held, [1] presses, [3] pointer y, [4] ↓.
const steerPad = () => { const p = new Float64Array(5); p[3] = -1; return p; };
const steer = (r, pad) => ((pad[0] = 1), (pad[3] = r.ghost() - 4));

test("shoot the pier: the attract run threads the first stretch of pier, then it goes back to the start, still", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const pad = steerPad(), r = pierRun(seed, pad, true);
    let wiped = 0, threads = 0;
    run(r, 6, () => ((wiped += r.ev[1]), (threads += r.ev[0] + r.ev[4])));
    assert.equal(wiped, 0, `seed ${seed}: the ghost never wipes out`);
    assert.equal(threads, 4, `seed ${seed}: four bays threaded`);
    assert.equal(r.S[0], 1, "idle");
    assert.ok(settled(r), "idle: no more frames");
  }
});

test("shoot the pier: steering through every window threads all thirteen bays, beats the wall, and rides in to the beach", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const pad = steerPad(), r = pierRun(seed, pad, false), S = r.S;
    pad[1] = 1;
    run(r, 1 / 60);
    assert.equal(S[0], 2, "a press starts the ride");
    run(r, 16, () => steer(r, pad));
    assert.equal(S[0], 3, `seed ${seed}: at the beach, the banner`);
    assert.equal(S[11], NB, `seed ${seed}: threaded ${S[11]} of ${NB}`);
    assert.equal(S[12], 0, `seed ${seed}: no wipeouts`);
    assert.ok(S[24] >= 10 && S[8] >= 300, `seed ${seed}: shots ${S[24]}, points ${S[8]}`);
    assert.ok(S[7] < S[5] - 20, "the wall left well behind");
    assert.ok(settled(r), "the banner, then still");
  }
});

test("shoot the pier: the windows overlap bay to bay by more than the rider, and stay on the face", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = pierRun(seed, steerPad(), false);
    for (let i = 0; i < NB; i++) {
      assert.ok(r.WT[i] >= 20 && Math.max(r.WT[i] + 7, 30) <= r.WB[i] - 2 && r.WB[i] <= 72, `seed ${seed} bay ${i}: window on the face, below the deck`);
      if (!r.END[i]) assert.ok(Math.min(r.WB[i], r.WB[i + 1]) - Math.max(r.WT[i], r.WT[i + 1]) >= 9, `seed ${seed} bay ${i}: overlap`);
    }
  }
});

test("shoot the pier: a beam, the gull, the fish and the wall each wipe you out; the foam ball resets the ride", () => {
  const causes = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    // Let go (hold the line: the gull, then a beam), the flat (the fish, or the wall), ghost but low near the critters.
    for (const how of [() => 0, () => 84, (r) => (r.S[16] > 0 ? r.S[17] + 2 : r.ghost() - 4)]) {
      const pad = steerPad(), r = pierRun(seed, pad, false), S = r.S;
      pad[1] = 1;
      run(r, 16, () => { const y = how(r); pad[0] = y ? 1 : 0; pad[3] = y || -1; if (r.ev[1]) causes.add(S[23]); });
      assert.equal(S[0], 3, "every ride reaches the beach");
    }
  }
  assert.deepEqual([...causes].sort(), [BY_WALL, BY_BEAM, BY_GULL, BY_FISH].sort(), "wall, beam, gull and fish");
  const pad = steerPad(), r = pierRun(2, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 4, () => ((pad[0] = 1), (pad[3] = 10)));
  assert.ok(S[12] >= 1, "riding up into the deck: a beam");
  pad[0] = 0;
  run(r, 1.7);
  assert.ok(S[13] === 0 && S[7] < S[5] - 20, "after the foam, the next ride: the wall is behind you again");
});

test("shoot the pier: Space climbs, ↓ drops, let go holds the line", () => {
  const pad = steerPad(), r = pierRun(4, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 0.1);
  const y0 = S[3];
  pad[0] = 1;
  run(r, 0.3);
  assert.ok(S[3] < y0 - 10, `Space climbs: ${y0} → ${S[3]}`);
  pad[0] = 0;
  const line = S[4];
  run(r, 0.5);
  const y1 = S[3];
  assert.ok(S[4] === line && Math.abs(y1 - line) < 1, "let go: the line holds");
  pad[4] = 1;
  run(r, 0.3);
  assert.ok(S[3] > y1 + 10, "↓ drops");
});

test("shoot the pier: zero allocation in the ride's step", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const pad = steerPad(), r = pierRun(11, pad, false);
  const steps = (n) => { for (let i = 0; i < n; i++) { if (r.S[0] !== 2) (pad[1] = 1), (r.S[15] = 9); pad[0] = 1; pad[3] = (i >> 6) & 1 ? r.ghost() - 4 : 20 + (i & 63); r.step(1 / 60); } };
  steps(20000);
  gc();
  const n = await minorGCs(() => steps(200000));
  assert.ok(n <= 1, `young-generation GCs over 200k steps: ${n}`);
});
