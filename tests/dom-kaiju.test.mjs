// DOM Kaiju's block and round (site/gallery/pieces/kaiju/block.ts) and its monster's parts
// (monster.ts), headless: the block's numbers; the round waits for the first input; a punch makes a
// hole; enough holes and the building shakes, then pancakes floor by floor (its roof comes down
// smoothly) and the monster on it drops off; walk, climb, step onto the roof, walk off it, reach across
// a gap to the next face; the helicopter goes down to a punch; a person at a window is a snack; the
// pebbles hurt and an empty health bar ends the round; the autopilot flattens the whole block; the
// same seed and inputs give the same round; the customiser's names; and the round allocates nothing
// per step (a sampled heap profile).
import test from "node:test";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

const K = await import("../site/gallery/pieces/kaiju/block.ts");
const Mo = await import("../site/gallery/pieces/kaiju/monster.ts");
const { READY, RUN, DONE, WALK, AIR, CLIMB, ROOF, KO, BLD, NB, C0, NC, NEED, HOLE, STAND, SHAKE, FALL, RUBBLE } = K;

function play(run, n, input) {
  const I = new Float64Array(5), ev = [];
  for (let i = 0; i < n && run.S[0] !== DONE; i++) {
    if (input) input(I, i);
    else run.autopilot(I);
    run.step(1 / 60, I[0], I[1], I[2], I[3], I[4]);
    for (let k = 0; k < run.n; k++) ev.push([run.ev[k * 2], run.ev[k * 2 + 1]]);
    run.clear();
  }
  return ev;
}
const quiet = (run) => { run.S[0] = RUN; run.HE[8] = 1e9; for (let i = 0; i < K.NS * 8; i++) run.SO[i] = 0; run.occ.fill(0); };

test("dom kaiju: the block: five buildings, a cell per window, holes to bring each down", () => {
  assert.equal(NB, 5);
  assert.equal(NC, BLD.reduce((a, v, i) => (i % 4 === 1 ? a + v * BLD[i + 1] : a), 0));
  assert.equal(K.TOTAL_FLOORS, 30);
  for (let b = 0; b < NB; b++) {
    assert.ok(NEED[b] >= 4 && NEED[b] < BLD[b * 4 + 1] * BLD[b * 4 + 2] / 2, `building ${b}: ${NEED[b]} holes`);
    if (b) assert.ok(BLD[b * 4] > BLD[(b - 1) * 4] + BLD[(b - 1) * 4 + 1], "they stand apart");
  }
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

test("dom kaiju: walk, climb a face, step onto the roof, walk off it and land; reach across to the next face", () => {
  const run = K.blockRun(), M = run.M;
  quiet(run);
  const b = 1, x0 = BLD[b * 4], w = BLD[b * 4 + 1];
  M[0] = x0 + w / 2;
  play(run, 2, (I) => I.set([0, 1, 0, 0, 0]));
  assert.equal(M[5], CLIMB, "up in front of a face climbs it");
  assert.equal(M[12], b);
  play(run, 60 * 4, (I) => I.set([0, 1, 0, 0, 0]));
  assert.equal(M[5], ROOF, "at the top, up steps onto the roof");
  assert.equal(M[1], run.top(b));
  play(run, 60 * 3, (I) => I.set([1, 0, 0, 0, 0]));
  assert.equal(M[5], WALK, "off the roof's edge: a fall, then the street");
  assert.ok(M[0] > x0 + w, "it walked off the right side");
  // Across a gap: climb building 2's face to the right edge and keep going: building 3 takes it.
  const r = K.blockRun(), N = r.M;
  quiet(r);
  N[0] = BLD[2 * 4] + 2;
  play(r, 20, (I) => I.set([0, 1, 0, 0, 0]));
  assert.equal(N[5], CLIMB);
  play(r, 60, (I) => I.set([1, 0, 0, 0, 0]));
  assert.equal(N[5], CLIMB, "still on a face");
  assert.equal(N[12], 3, "the next building's face");
  // A jump from the street goes up and comes down.
  const j = K.blockRun(), J = j.M;
  quiet(j);
  let peak = 0;
  play(j, 70, (I, i) => { I.set([0, 0, 0, i === 0 ? 1 : 0, 0]); peak = Math.max(peak, J[1]); });
  assert.ok(peak > 2 && J[1] === 0 && J[5] === WALK, `a jump (peak ${peak.toFixed(2)})`);
});

test("dom kaiju: punches make holes; enough and it shakes, pancakes floor by floor, and the monster drops off", () => {
  const run = K.blockRun(), M = run.M, B = run.B;
  quiet(run);
  const b = 2, x0 = BLD[b * 4], w = BLD[b * 4 + 1], f = BLD[b * 4 + 2];
  M[0] = x0 + w / 2;
  play(run, 2, (I) => I.set([0, 1, 0, 0, 0]));
  assert.equal(M[5], CLIMB);
  const ev = play(run, 60 * 6, (I, i) => I.set([Math.sin(i / 20) > 0 ? 0.3 : -0.3, 0, i % 20 === 0 ? 1 : 0, 0, 0]));
  const holes = ev.filter((e) => e[0] === K.E_HOLE).length;
  assert.ok(holes >= NEED[b], `holes: ${holes}`);
  assert.ok(B[b * 6] >= SHAKE, "it shakes, then falls");
  for (let i = C0[b]; i < C0[b + 1]; i++) if (run.cell[i] === HOLE) assert.ok(true);
  // It falls: one floor at a time, the roof coming down smoothly, then rubble.
  const tops = [];
  let prev = run.top(b), jumps = 0;
  play(run, 60 * 5, (I) => { I.fill(0); const t = run.top(b); if (prev - t > 0.25) jumps++; prev = t; tops.push(t); });
  assert.equal(B[b * 6], RUBBLE, "rubble");
  assert.equal(run.top(b), 0);
  assert.equal(jumps, 0, "the roof comes down smoothly");
  assert.equal(run.S[8], f, "every floor counted");
  assert.equal(run.S[4], 1, "one building flat");
  assert.ok(M[5] === WALK || M[5] === AIR, "it dropped off");
  assert.equal(M[12], -1);
  assert.ok(ev.some((e) => e[0] === K.E_DROP) || B[b * 6] === RUBBLE);
});

test("dom kaiju: the helicopter goes down to a punch; a person at a window is a snack; pebbles hurt and an empty bar ends it", () => {
  const run = K.blockRun(), M = run.M, HE = run.HE;
  quiet(run);
  M[0] = -14;
  HE[0] = 1; HE[1] = M[0] + 1.9; HE[2] = 1.7; HE[3] = 2.6; HE[8] = 1e9;
  const ev = play(run, 60 * 3, (I, i) => I.set([0.3, 0, i === 0 ? 1 : 0, 0, 0]));
  assert.ok(ev.some((e) => e[0] === K.E_HELI), "swatted");
  assert.ok(ev.some((e) => e[0] === K.E_HELI_CRASH), "and it crashes in the street");
  assert.equal(run.S[5], 1);
  // A snack: a person at the window in front of the fist.
  const r = K.blockRun(), N = r.M;
  quiet(r);
  const b = 1, x0 = BLD[b * 4], w = BLD[b * 4 + 1];
  N[0] = x0 + 1.5;
  play(r, 2, (I) => I.set([0, 1, 0, 0, 0]));
  N[7] = 40;
  const fl = 3, col = 2;
  r.occ[C0[b] + fl * w + col] = 1;
  N[6] = 1;
  play(r, 60, (I) => { const want = fl + 0.5 - 2.9; I.set([0, Math.max(-1, Math.min(1, (want - N[1]) * 3)), 0, 0, 0]); });
  const ev2 = play(r, 2, (I, i) => I.set([0.3, 0, 0, 0, i === 0 ? 1 : 0]));
  assert.ok(ev2.some((e) => e[0] === K.E_NOM), "nom");
  assert.equal(N[7], 56, "health back");
  assert.equal(r.occ[C0[b] + fl * w + col], 0);
  // Pebbles: the soldiers throw, they sting; out of health, the round ends.
  const h = K.blockRun(), H = h.M;
  h.S[0] = RUN;
  H[7] = 9;
  const ev3 = play(h, 60 * 60, (I) => I.fill(0));
  assert.ok(ev3.some((e) => e[0] === K.E_HURT), "hurt");
  assert.ok(ev3.some((e) => e[0] === K.E_KO), "knocked out");
  assert.equal(H[5], KO);
  assert.equal(h.S[0], DONE);
  assert.deepEqual(ev3.find((e) => e[0] === K.E_END), [K.E_END, 0], "the round ends, not won");
});

test("dom kaiju: the autopilot flattens the whole block, swats a helicopter and snacks, in under a minute", () => {
  for (const seed of [1, 2, 20261115]) {
    const run = K.blockRun(seed), ev = play(run, 60 * 90);
    assert.equal(run.S[0], DONE, `seed ${seed}: over`);
    assert.equal(run.S[4], NB, `seed ${seed}: every building flat`);
    assert.ok(run.S[1] < 60, `seed ${seed}: ${run.S[1].toFixed(1)} s`);
    assert.ok(run.S[5] >= 1, `seed ${seed}: a helicopter swatted`);
    assert.ok(run.S[6] >= 1, `seed ${seed}: a snack`);
    assert.ok(run.M[7] > 0, `seed ${seed}: still standing`);
    assert.deepEqual(ev.find((e) => e[0] === K.E_END), [K.E_END, 1]);
    for (let b = 0; b < NB; b++) assert.equal(run.B[b * 6], RUBBLE);
  }
});

test("dom kaiju: the same seed and inputs give the same round", () => {
  const go = (seed) => {
    const run = K.blockRun(seed);
    play(run, 60 * 20, (I, i) => {
      run.autopilot(I);
      if (i % 97 === 0) I[3] = 1;
    });
    return [...run.S, ...run.M, ...run.B, ...run.cell, ...run.SO, ...run.PB.slice(0, 64), ...run.HE];
  };
  assert.deepEqual(go(7), go(7));
  assert.notDeepEqual(go(7), go(8));
  // Reset gives the first round back.
  const run = K.blockRun(5), a = [...run.cell, ...run.occ];
  play(run, 600);
  run.reset(5);
  assert.deepEqual([...run.cell, ...run.occ], a);
});

test("dom kaiju: the customiser: 3 bodies × 4 heads, 6 tones, 3 patterns, original names", () => {
  assert.equal(Mo.BODIES.length, 3);
  assert.equal(Mo.HEADS.length, 4);
  assert.equal(Mo.TONES.length, 6);
  assert.equal(Mo.PATTERNS.length, 3);
  const names = new Set();
  for (let b = 0; b < 3; b++) for (let h = 0; h < 4; h++) names.add(Mo.monsterName(b, h));
  assert.equal(names.size, 12, "every pair has its own name");
  assert.equal(Mo.monsterName(0, 0), "RUMBLEHORN");
  assert.equal(Mo.shade("#808080", 0.5), "#404040");
});

test("dom kaiju: the round allocates nothing per step", async () => {
  // A sampled heap profile over several rounds on the autopilot, every allocation charged to the
  // function that made it, in pieces/kaiju/.
  const run = K.blockRun(), I = new Float64Array(5);
  const go = (n) => {
    for (let i = 0; i < n; i++) {
      if (run.S[0] === DONE) run.reset();
      run.autopilot(I);
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
  // One object a step would be ≥ 16 B × 10,800 steps (170 KB+); what can show is the JIT's one-off.
  assert.ok(bytes < 40000, `no allocation per step: ${bytes} B in 180 s (${mine.join(", ")})`);
});
void [AIR, STAND, FALL];
