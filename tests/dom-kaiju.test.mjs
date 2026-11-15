// DOM Kaiju's block and round (site/gallery/pieces/kaiju/block.ts) and its monsters' parts
// (monster.ts), headless: the block's numbers; the round waits for the first input; a jump at a side
// wall grabs it (and W at a wall climbs it, up onto the roof, a wall jump off); a punch from the wall
// makes a hole in the window next to it (then the next one in; up and down too); a live part shocks
// (health, it lets go and drops); a person at a window next to the hand is eaten (health back), a hot
// pot burns; enough holes and the building shakes, pancakes floor by floor (the roof coming down
// smoothly) and everyone on it drops off; the helicopter and the tank go down to punches; out of health
// the monster shrinks and runs off the table, and with no player left the round ends; a rival takes a
// snack, a hero punch knocks a rival off a wall, player two takes a rival from the AI; the autopilot
// flattens the whole block; the same seed and inputs give the same round; the customiser's parts and
// names; and the round allocates nothing per step (a sampled heap profile).
import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

const K = await import("../site/gallery/pieces/kaiju/block.ts");
const Mo = await import("../site/gallery/pieces/kaiju/monster.ts");
const { READY, RUN, DONE, WALK, AIR, CLIMB, ROOF, KO, BLD, NB, C0, NC, NEED, HOLE, SHAKE, RUBBLE, LIVE, LIVE_CELL, HAND, IN, OUT, P2, AI, CRAB } = K;

function play(run, n, input) {
  const I = new Float64Array(10), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    I.fill(0);
    if (input === "auto") run.autopilot(I, 0);
    else if (input) input(I, i);
    run.step(1 / 60, I[0], I[1], I[2], I[3], I[4], I[5], I[6], I[7], I[8], I[9]);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 2], run.ev[k * 2 + 1]]);
    run.clear();
  }
  return ev;
}
/** A round with no army, nobody at the windows and (by default) no rivals: the rules alone. */
const quiet = (rivals = 0) => {
  const run = K.blockRun(20261115, rivals);
  run.S[0] = RUN; run.HE[8] = 1e9; run.TK[4] = 1e9;
  run.SO.fill(0); run.occ.fill(0);
  return run;
};
const cellOf = (b, fl, col) => C0[b] + fl * BLD[b * 4 + 1] + col;
/** Put monster M on building b's side s with its hand at floor fl. */
const hangAt = (run, M, b, s, fl) => {
  M[5] = CLIMB; M[12] = b; M[22] = s; M[0] = run.wallX(b, s); M[2] = K.ZW; M[6] = -s; M[1] = fl + 0.5 - HAND;
};

test("dom kaiju: the block: five buildings with gaps to hang in, a cell per window, live parts on the edges", () => {
  assert.equal(NB, 5);
  assert.equal(K.TOTAL_FLOORS, 30);
  for (let b = 0; b < NB; b++) {
    assert.ok(NEED[b] >= 4 && NEED[b] < BLD[b * 4 + 1] * BLD[b * 4 + 2] / 2, `building ${b}: ${NEED[b]} holes`);
    if (b) assert.ok(BLD[b * 4] - BLD[(b - 1) * 4] - BLD[(b - 1) * 4 + 1] >= 2.4, "a gap wide enough to hang in");
  }
  for (let k = 0; k < LIVE.length; k += 4) {
    const col = LIVE[k + 2];
    assert.ok(col === 0 || col === BLD[LIVE[k] * 4 + 1] - 1, "live parts sit on an edge column");
  }
  assert.equal(LIVE_CELL.reduce((a, v) => a + v, 0), LIVE.length / 4);
  assert.equal(NC, C0[NB]);
});

test("dom kaiju: the round waits for the first input", () => {
  const run = K.blockRun();
  run.step(1 / 60, 0, 0, 0, 0, 0);
  assert.equal(run.S[0], READY);
  assert.equal(run.S[1], 0, "the clock waits");
  run.step(1 / 60, 1, 0, 0, 0, 0);
  assert.equal(run.S[0], RUN);
  assert.equal(run.ev[0], K.E_START);
});

test("dom kaiju: a jump at a side wall grabs it; W at a wall climbs; up onto the roof; a wall jump off", () => {
  const run = quiet(), M = run.M;
  // Run at building 1's left wall and jump: the jump grabs it.
  M[0] = run.wallX(1, -1) - 2.2;
  const ev = play(run, 60, (I, i) => { I[0] = 1; I[3] = i === 10 ? 1 : 0; });
  assert.equal(M[5], CLIMB, "hanging on the wall");
  assert.deepEqual([M[12], M[22]], [1, -1], "building 1, its left side");
  assert.equal(M[0], run.wallX(1, -1));
  assert.ok(ev.some((e) => e[0] === K.E_CLIMB));
  // Up the side to the roof.
  play(run, 60 * 4, (I) => (I[1] = 1));
  assert.equal(M[5], ROOF, "up at the top steps onto the roof");
  // W at a wall from the street climbs it.
  const r = quiet(), N = r.M;
  N[0] = r.wallX(2, 1) + 0.3; N[6] = -1;
  play(r, 3, (I) => (I[1] = 1));
  assert.deepEqual([N[5], N[12], N[22]], [CLIMB, 2, 1], "W at building 2's right wall");
  // A wall jump pushes off the wall (and catches the one across the gap).
  play(r, 30, (I) => (I[1] = 1));
  play(r, 40, (I, i) => (I[3] = i === 0 ? 1 : 0));
  assert.deepEqual([N[5], N[12], N[22]], [CLIMB, 3, -1], "across the gap: building 3's left wall");
});

test("dom kaiju: hanging on a side, a punch makes a hole in the window next to it, then the next one in; up and down too", () => {
  const run = quiet(), M = run.M;
  hangAt(run, M, 3, -1, 3);
  play(run, 1, (I) => (I[2] = 1));
  assert.equal(run.cell[cellOf(3, 3, 0)], HOLE, "the window at the wall, on the hand's floor");
  play(run, 20);
  play(run, 1, (I) => (I[2] = 1));
  assert.equal(run.cell[cellOf(3, 3, 1)], HOLE, "then the next one in");
  play(run, 20);
  play(run, 1, (I) => ((I[2] = 1), (I[1] = 1)));
  assert.equal(run.cell[cellOf(3, 4, 0)], HOLE, "up: the floor above");
  play(run, 20);
  M[1] = 3 + 0.5 - HAND;
  play(run, 1, (I) => ((I[2] = 1), (I[1] = -1)));
  assert.equal(run.cell[cellOf(3, 2, 0)], HOLE, "down: the floor below");
  assert.equal(run.S[3], 4);
  assert.equal(M[5], CLIMB, "still hanging on");
  // From the street, a punch never holes a building (it is smashed from its sides).
  const s = quiet(), N = s.M;
  N[0] = BLD[1 * 4] + 2; N[6] = 1;
  const ev = play(s, 1, (I) => (I[2] = 1));
  assert.ok(ev.some((e) => e[0] === K.E_WHIFF) && s.S[3] === 0);
});

test("dom kaiju: a live part shocks: a little health, it lets go and drops; a grab on one too", () => {
  const run = quiet(), M = run.M;
  // Building 0 has a power box on floor 2 at its right edge.
  assert.equal(LIVE_CELL[cellOf(0, 2, 3)], 1);
  hangAt(run, M, 0, 1, 2);
  const ev = play(run, 1, (I) => (I[2] = 1));
  assert.ok(ev.some((e) => e[0] === K.E_SHOCK && e[1] === cellOf(0, 2, 3)), "zap");
  assert.equal(M[7], K.MAX_HP - K.SHOCK_HP, "a little health");
  assert.equal(M[5], AIR, "it lets go");
  assert.ok(M[23] > 0, "it flickers");
  assert.notEqual(run.cell[cellOf(0, 2, 3)], HOLE, "the live part stays");
  play(run, 120);
  assert.equal(M[5], WALK, "and drops to the street");
  const g = quiet(), N = g.M;
  hangAt(g, N, 0, 1, 2);
  const ev2 = play(g, 1, (I) => (I[4] = 1));
  assert.ok(ev2.some((e) => e[0] === K.E_SHOCK), "a grab on a live part shocks too");
  // A roof antenna bites.
  const a = quiet(), A = a.M, b = 1;
  A[5] = ROOF; A[12] = b; A[1] = a.top(b); A[2] = K.ZR; A[0] = K.ANT[b] - 1.6; A[6] = 1;
  const ev3 = play(a, 1, (I) => (I[2] = 1));
  assert.ok(ev3.some((e) => e[0] === K.E_SHOCK && e[1] === -1 - b), "the antenna");
});

test("dom kaiju: eat from a window: GRAB pulls out the person next to the hand (health back); a hot pot burns", () => {
  const run = quiet(), M = run.M;
  hangAt(run, M, 3, -1, 3);
  M[7] = 40;
  const i = cellOf(3, 3, 0);
  run.occ[i] = 1;
  const ev = play(run, 1, (I) => (I[4] = 1));
  assert.ok(ev.some((e) => e[0] === K.E_NOM && e[1] === i), "nom");
  assert.equal(M[7], 56, "health back");
  assert.equal(run.occ[i], 0, "eaten");
  assert.equal(M[26], 1, "a snack on its count");
  assert.equal(M[25], 100, "and points");
  play(run, 30);
  run.occ[cellOf(3, 3, 1)] = 3;
  const ev2 = play(run, 1, (I) => (I[4] = 1));
  assert.ok(ev2.some((e) => e[0] === K.E_BURN), "a hot pot burns");
  assert.ok(M[7] < 56, "it hurts");
  assert.equal(run.occ[cellOf(3, 3, 1)], 3, "and stays");
});

test("dom kaiju: enough holes and it shakes, pancakes floor by floor (the roof smoothly), and drops whoever hangs on it", () => {
  const run = quiet(), M = run.M, B = run.B, b = 3, f = BLD[b * 4 + 2];
  hangAt(run, M, b, -1, 2);
  for (let k = 0; k < 40 && B[b * 6] === 0; k++) {
    const fl = k % 3 === 0 ? 2 : k % 3 === 1 ? 3 : 1;
    M[1] = Math.max(0.05, Math.min(run.top(b) - K.CLIMB_TOP, fl + 0.5 - HAND));
    play(run, 16, (I, i) => (I[2] = i === 0 ? 1 : 0));
    if (M[5] !== CLIMB) hangAt(run, M, b, -1, 2);
  }
  assert.ok(B[b * 6] >= SHAKE, `it shakes after ${B[b * 6 + 1]} holes`);
  let prev = run.top(b), jumps = 0;
  play(run, 60 * 5, () => { const t = run.top(b); if (prev - t > 0.25) jumps++; prev = t; });
  assert.equal(B[b * 6], RUBBLE, "rubble");
  assert.equal(jumps, 0, "the roof comes down smoothly");
  assert.equal(run.S[8], f, "every floor counted");
  assert.ok(M[5] !== CLIMB || M[12] !== b, "it dropped off (it may catch the wall across the gap)");
});

test("dom kaiju: the helicopter goes down to a punch; the tank blows up; pebbles and shells hurt", () => {
  const run = quiet(), M = run.M, HE = run.HE;
  M[0] = -14;
  HE[0] = 1; HE[1] = M[0] + 1.9; HE[2] = 1.7; HE[3] = 2.6;
  const ev = play(run, 60 * 3, (I, i) => ((I[0] = 0.3), (I[2] = i === 0 ? 1 : 0)));
  assert.ok(ev.some((e) => e[0] === K.E_HELI) && ev.some((e) => e[0] === K.E_HELI_CRASH), "swatted, and it crashes");
  const t = quiet(), N = t.M;
  t.TK[0] = 1; t.TK[1] = N[0] + 2.4; t.TK[2] = -1; t.TK[3] = 1e9; t.TK[7] = 4;
  const ev2 = play(t, 2, (I, i) => ((I[0] = 0.3), (I[2] = i === 0 ? 1 : 0)));
  assert.ok(ev2.some((e) => e[0] === K.E_TANK), "the tank blows");
  assert.equal(t.TK[0], 2, "a wreck");
  const h = K.blockRun(5, 0);
  h.S[0] = RUN;
  const ev3 = play(h, 60 * 30, () => {});
  assert.ok(ev3.some((e) => e[0] === K.E_HURT), "hurt");
});

test("dom kaiju: out of health, the monster shrinks and runs off the table; with no player left the round ends", () => {
  const run = K.blockRun(5, 0), M = run.M;
  run.S[0] = RUN;
  M[7] = 4;
  const ev = play(run, 60 * 60, () => {});
  assert.ok(ev.some((e) => e[0] === K.E_KO && e[1] === 0), "knocked out");
  assert.equal(M[29], 1, "shrunk");
  assert.ok(ev.some((e) => e[0] === K.E_OUT && e[1] === 0), "ran off the table");
  assert.equal(M[24], OUT);
  assert.ok(Math.abs(M[0]) > K.SX + 2, "off the end");
  assert.equal(run.S[0], DONE);
  assert.deepEqual(ev.find((e) => e[0] === K.E_END), [K.E_END, 0], "the round ends, not won");
  // A player with health left carries on: player two out, player one still in.
  const two = K.blockRun(5, 1);
  two.join(true);
  two.S[0] = RUN;
  play(two, 120, () => {});
  two.MV[CRAB][7] = 1;
  two.setCur(CRAB);
  play(two, 60 * 20, (I) => { two.MV[0][7] = 100; });
  assert.equal(two.MV[CRAB][24], OUT, "player two ran off");
  assert.equal(two.S[0], RUN, "player one plays on");
});

test("dom kaiju: a rival takes a snack from a window", () => {
  const run = quiet(1), C = run.MV[CRAB];
  play(run, 120, () => {}); // it comes in
  assert.equal(C[24], IN);
  hangAt(run, C, 3, -1, 3);
  run.occ[cellOf(3, 3, 0)] = 1;
  const hp = (C[7] = 60);
  const ev = play(run, 90, () => {});
  assert.ok(ev.some((e) => e[0] === K.E_NOM && e[1] === cellOf(3, 3, 0)), "the rival eats it");
  assert.equal(run.S[15], CRAB, "the crab did");
  assert.equal(C[26], 1);
  assert.ok(C[7] > hp);
  assert.equal(run.M[26], 0, "not the hero");
});

test("dom kaiju: a hero punch knocks a rival off a wall (and the rival punches back)", () => {
  const run = quiet(1), M = run.M, C = run.MV[CRAB];
  play(run, 120, () => {});
  // The gap between buildings 2 and 3: the crab on 3's left wall, the hero on 2's right wall, facing it.
  hangAt(run, C, 3, -1, 3);
  hangAt(run, M, 2, 1, 3);
  M[6] = 1;
  const ev = play(run, 1, (I) => ((I[0] = 0.3), (I[2] = 1)));
  assert.ok(ev.some((e) => e[0] === K.E_BONK && e[1] === CRAB), "bonk");
  assert.equal(C[5], AIR, "off the wall");
  assert.ok(C[7] < 100, "it hurts");
  // The AI bonks back when it is in reach.
  const r = quiet(1), H = r.M, R = r.MV[CRAB];
  play(r, 120, () => {});
  hangAt(r, H, 2, 1, 3);
  hangAt(r, R, 3, -1, 3);
  const ev2 = play(r, 60, () => {});
  assert.ok(ev2.some((e) => e[0] === K.E_BONK && e[1] === 0), "the rival punches the hero");
  assert.notEqual(H[5], CLIMB, "off the wall");
});

test("dom kaiju: player two takes a rival from the AI (and gives it back)", () => {
  const run = quiet(1), C = run.MV[CRAB];
  play(run, 120, () => {});
  assert.equal(C[28], AI);
  run.join(true);
  assert.equal(C[28], P2);
  // Player two's inputs drive it; with none, it stands still (the AI would walk).
  C[5] = WALK; C[0] = 6; C[1] = 0;
  play(run, 60, () => {});
  assert.equal(C[0], 6, "no input, no move");
  play(run, 30, (I) => (I[5] = 1));
  assert.ok(C[0] > 7, "player two walks it");
  play(run, 1, (I) => (I[8] = 1));
  assert.equal(C[4] > 0 && C[5] === AIR, true, "and jumps it");
  run.join(false);
  assert.equal(C[28], AI, "back to the AI");
  // A reset keeps player two in.
  run.join(true);
  run.reset();
  assert.equal(run.MV[CRAB][28], P2);
});

test("dom kaiju: the autopilot flattens the whole block, swats a helicopter, busts the tank and snacks", () => {
  for (const [seed, rivals] of [[1, 0], [20261115, 0], [3, 2]]) {
    const run = K.blockRun(seed, rivals), ev = play(run, 60 * 90, "auto");
    assert.equal(run.S[0], DONE, `seed ${seed}: over`);
    assert.equal(run.S[4], NB, `seed ${seed}: every building flat`);
    assert.ok(run.S[1] < 60, `seed ${seed}: ${run.S[1].toFixed(1)} s`);
    assert.ok(run.S[6] >= 1, `seed ${seed}: a snack`);
    assert.ok(run.S[11] >= 1, `seed ${seed}: a tank busted`);
    if (!rivals) assert.ok(run.S[5] >= 1, `seed ${seed}: a helicopter swatted`);
    assert.ok(run.M[7] > 0, `seed ${seed}: the hero still standing`);
    assert.deepEqual(ev.find((e) => e[0] === K.E_END), [K.E_END, 1]);
    if (rivals) assert.ok(run.MV[1][25] > 0 && run.M[25] > 0, "the rival scores too");
    assert.equal(run.S[2], run.MV.reduce((a, m) => a + m[25], 0), "the shared score is the players' scores");
  }
});

test("dom kaiju: the same seed and inputs give the same round", () => {
  const go = (seed) => {
    const run = K.blockRun(seed, 2);
    play(run, 60 * 20, (I, i) => {
      run.autopilot(I, 0);
      if (i % 97 === 0) I[3] = 1;
    });
    return [...run.S, ...run.MV.flatMap((m) => [...m]), ...run.B, ...run.cell, ...run.SO, ...run.PB.slice(0, 64), ...run.HE, ...run.TK];
  };
  assert.deepEqual(go(7), go(7));
  assert.notDeepEqual(go(7), go(8));
  const run = K.blockRun(5), a = [...run.cell, ...run.occ];
  play(run, 600, "auto");
  run.reset(5);
  assert.deepEqual([...run.cell, ...run.occ], a);
});

test("dom kaiju: the customiser: the ape's fur, trim, patterns, faces and gear; original names", () => {
  assert.equal(Mo.FURS.length, 6);
  assert.equal(Mo.TRIMS.length, 6);
  assert.equal(Mo.PATTERNS.length, 3);
  assert.equal(Mo.FACES.length, 3);
  assert.equal(Mo.GEAR.length, 4);
  const names = new Set();
  for (let f = 0; f < 6; f++) for (let h = 0; h < 3; h++) names.add(Mo.heroName(f, h));
  assert.equal(names.size, 18, "every pair has its own name");
  assert.equal(Mo.heroName(1, 0), "EMBER BROWLER");
  assert.deepEqual(Mo.RIVALS, ["SHARDCLAW", "GLOOPMAW"]);
  assert.equal(Mo.shade("#808080", 0.5), "#404040");
});

test("dom kaiju: the round allocates nothing per step", async () => {
  const run = K.blockRun(20261115, 2), I = new Float64Array(5);
  const go = (n) => {
    for (let i = 0; i < n; i++) {
      if (run.S[0] === DONE) run.reset();
      run.autopilot(I, 0);
      run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
      run.clear();
    }
  };
  go(60 * 600); // (warm: the JIT's one-offs come early)
  const s = new Session();
  s.connect();
  await s.post("HeapProfiler.startSampling", { samplingInterval: 64 });
  go(60 * 180);
  const { profile } = await s.post("HeapProfiler.stopSampling");
  s.disconnect();
  const mine = [];
  let bytes = 0;
  const walk = (n) => {
    if (n.selfSize && n.callFrame.url.includes("/pieces/kaiju/")) (bytes += n.selfSize), mine.push(`${n.callFrame.functionName || "(anonymous)"}: ${n.selfSize} B`);
    for (const c of n.children) walk(c);
  };
  walk(profile.head);
  assert.ok(bytes < 40000, `no allocation per step: ${bytes} B in 180 s (${mine.join(", ")})`);
});
void [KO];
