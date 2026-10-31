// The surf-sesh minis (site/gallery/pieces/surf/), headless: their rides are plain numbers, so the
// games in them are checked here. Lip Line: holding climbs the face, meeting the curl at the lip
// snaps (and chains), the lip anywhere else chops; Tube Time: holding pumps toward the light,
// letting go drags you into the foam, and ten seconds in the glow gets you spat out. Both settle,
// and their steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { lipLine, ROUND: LIP_ROUND } = await import("../site/gallery/pieces/surf/lip-line.ts");
const { tubeTime, SPIT, WORKED } = await import("../site/gallery/pieces/surf/tube-time.ts");
const { paddleOut } = await import("../site/gallery/pieces/surf/paddle-out.ts");

const run = (r, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), r.step(1 / 60)); };
const settled = (r) => { for (let i = 0; i < 600; i++) if (!r.step(1 / 60)) return true; return false; };

test("lip line: the attract run snaps the first curl, then the scene goes still", () => {
  const pad = new Float64Array(3), r = lipLine(7, pad, true);
  let snapped = 0;
  run(r, 3.5, () => (snapped ||= r.ev[0]));
  assert.equal(snapped, 1, "the ghost meets the curl");
  assert.ok(settled(r), "idle: no more frames");
});

test("lip line: timed holds snap and chain; holding through the lip without the curl chops; the bell ends the ride", () => {
  const pad = new Float64Array(3), r = lipLine(3, pad, false), S = r.S;
  pad[1] = 1;
  run(r, 1 / 60);
  assert.equal(S[0], 2, "a press starts the ride");
  // Hold flat out from the start: the lip with no curl under it is a chop.
  pad[0] = 1;
  run(r, 1);
  assert.equal(S[13], 1, "holding into the lip chops");
  // Then the rider holds while the curl closes in, lets go once past it.
  run(r, LIP_ROUND, () => (pad[0] = S[7] - 60 < 33 && S[7] - 60 > -6 && S[3] < 0.98 ? 1 : 0));
  assert.ok(S[12] >= 3, `snaps: ${S[12]}`);
  assert.ok(S[11] >= 2, `a chain: ${S[11]}`);
  assert.equal(S[0], 3, "the bell");
  assert.ok(settled(r), "the card, then still");
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
    const steps = (n) => { for (let i = 0; i < n; i++) { if (r.S[0] !== 2) pad[1] = 1, r.S[10] = 9, r.S[11] = 9, r.S[16] = 9; pad[0] = (i >> 5) & 1; r.step(1 / 60); } };
    steps(20000);
    gc();
    const n = await minorGCs(() => steps(200000));
    assert.ok(n <= 1, `${make.name}: young-generation GCs over 200k steps: ${n}`);
  }
});
