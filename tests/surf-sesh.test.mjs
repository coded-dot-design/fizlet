// The surf-sesh minis (site/gallery/pieces/surf/), headless: their rides are plain numbers, so the
// games in them are checked here. Shoot the Pier: weaving through the gaps between the rows of pilings
// threads every run to the beach, and a piling wipes you out. Lip Line: holding climbs the face and snaps at the lip, riding
// low outruns the breaking wall, and the wall, the pilings and the gull wipe you out; Tube Time: holding pumps toward the light,
// letting go drags you into the foam, and ten seconds in the glow gets you spat out. Both settle,
// and their steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { lipLine, ROUND: LIP_ROUND } = await import("../site/gallery/pieces/surf/lip-line.ts");
const { tubeTime, SPIT, WORKED } = await import("../site/gallery/pieces/surf/tube-time.ts");
const { paddleOut } = await import("../site/gallery/pieces/surf/paddle-out.ts");
const { pierRun, NR, RG, HIT, BY_PILING } = await import("../site/gallery/pieces/surf/pier.ts");

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

// Shoot the Pier slots: 0 mode, 2 scroll, 3 x, 5 score, 8 threaded, 9 wipeouts, 10 wipeout clock,
// 14 needles, 16 the next row, 19 what did it. Its pad: [0] held, [1] presses, [3] pointer x, [5] pointer over, [6] steer keys.
const steerPad = () => new Float64Array(7);
const steer = (r, pad) => ((pad[0] = 1), (pad[5] = 1), (pad[3] = r.ghost()));

test("shoot the pier: the attract run weaves the first rows of pilings, then goes back to the start, still", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const pad = steerPad(), r = pierRun(seed, pad, true);
    let wiped = 0, threads = 0;
    run(r, 6, () => ((wiped += r.ev[1]), (threads += r.ev[0] + r.ev[4])));
    assert.equal(wiped, 0, `seed ${seed}: the ghost never wipes out`);
    assert.ok(threads >= 6, `seed ${seed}: ${threads} rows threaded`);
    assert.equal(r.S[0], 1, "idle");
    assert.ok(settled(r), "idle: no more frames");
  }
});

test("shoot the pier: every run is threadable: steering for the gaps clears all the rows, then the shorebreak, the beach and the banner", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const pad = steerPad(), r = pierRun(seed, pad, false), S = r.S;
    pad[1] = 1;
    run(r, 1 / 60);
    assert.equal(S[0], 2, "a press starts the ride");
    run(r, 16, () => steer(r, pad));
    assert.equal(S[0], 3, `seed ${seed}: on the beach, the banner`);
    assert.deepEqual([S[8], S[9]], [NR, 0], `seed ${seed}: threaded ${S[8]} of ${NR}, no wipeouts`);
    assert.ok(S[14] >= 3, `seed ${seed}: the needle threaded ${S[14]} times`);
    assert.ok(settled(r), "the banner, then still");
  }
});

test("shoot the pier: the gaps tighten toward the far end, and the next gap is always in reach", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = pierRun(seed, steerPad(), false);
    assert.ok(r.SP[0] > r.SP[NR - 1] + 5, "the far rows stand closer");
    for (let i = 0; i < NR; i++) {
      assert.ok(r.SP[i] - 2 * HIT >= 5, `seed ${seed} row ${i}: a gap the board fits`);
      // Half a spacing at most to the nearest gap; at full speed a row comes every 20 / 66 s, at 80 px/s across.
      assert.ok(r.SP[i] / 2 <= 80 * (RG / 66) - 4, `seed ${seed} row ${i}: in reach`);
    }
  }
});

test("shoot the pier: touching a piling wipes you out (so close) and you're back up past it", () => {
  const causes = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    // Let go of everything (hold the middle): pilings, sooner or later.
    const pad = steerPad(), r = pierRun(seed, pad, false), S = r.S;
    pad[1] = 1;
    run(r, 16, () => { if (r.ev[1]) causes.add(S[19]); });
    assert.equal(S[0], 3, "every ride still reaches the beach");
    assert.ok(S[9] >= 1, `seed ${seed}: straight down the middle hits a piling`);
  }
  assert.deepEqual([...causes], [BY_PILING], "the pilings");
  // Aim at a piling: a wipeout on that row, then up again past it, in a gap.
  const pad = steerPad(), r = pierRun(5, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 2, () => steer(r, pad));
  let k = -1;
  run(r, 2, () => { if (k < 0 && !S[10]) { pad[0] = 1; pad[5] = 1; pad[3] = r.gapAt(S[16], S[3]) + r.SP[S[16]] / 2; } if (r.ev[1]) (k = S[16]), (pad[0] = 0), (pad[5] = 0); });
  assert.ok(k >= 0, "aiming at a piling: wipeout");
  for (let i = 0; i < 120 && S[10] > 0; i++) r.step(1 / 60);
  assert.ok(S[10] === 0 && S[16] > k, "after the foam, back up past that row");
  assert.ok(Math.abs(S[3] - r.gapAt(S[16], S[3])) < 1, "in line with the next gap");
});

test("shoot the pier: ← and → lean, a held pointer pulls you across, let go holds the line", () => {
  const pad = steerPad(), r = pierRun(4, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 0.1);
  const x0 = S[3];
  pad[6] = -1;
  run(r, 0.3);
  assert.ok(S[3] < x0 - 10, `← leans left: ${x0} → ${S[3]}`);
  pad[6] = 1;
  run(r, 0.6);
  assert.ok(S[3] > x0 + 10, "→ leans right");
  pad[6] = 0;
  const x1 = S[3];
  run(r, 0.3);
  assert.equal(S[3], x1, "let go: the line holds");
  pad[0] = 1;
  pad[5] = 1;
  pad[3] = 30;
  run(r, 1.5);
  assert.ok(Math.abs(S[3] - 30) < 1, "the pointer pulls you to it");
});

test("shoot the pier: zero allocation in the ride's step", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const pad = steerPad(), r = pierRun(11, pad, false);
  const steps = (n) => { for (let i = 0; i < n; i++) { if (r.S[0] !== 2) (pad[1] = 1), (r.S[12] = 9); pad[0] = 1; pad[5] = 1; pad[3] = (i >> 6) & 1 ? r.ghost() : 20 + (i & 127); r.step(1 / 60); } };
  steps(20000);
  gc();
  const n = await minorGCs(() => steps(200000));
  assert.ok(n <= 1, `young-generation GCs over 200k steps: ${n}`);
});
