// Shuffle Shot's game (site/gallery/pieces/shuffle/model.ts) on @fzlt/core/flick, headless: a straight
// shot stops where friction says, a soft one short of the foul line, a hard one off the end into the
// gutter, and one just right hangs over the edge for 4; the count (only the furthest side scores, for
// each puck past the other's best); turns alternate and the scorer throws first next round; first to
// 15 wins; the same seed and shots give the same table bit for bit; the bot always finishes its
// games; the game's own code allocates nothing, and whole games stay inside flick's own bar of at most
// one young GC per 20,000 steps (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/shuffle/model.ts");
const { seeded } = await import("../src/kernel/random.ts");
const { AIM, ROLL, TALLY, OVER, EDGE, FOUL, PER, X0, R } = M;

/** One straight shot at `level` from a fresh game; returns puck 0's x and whether it is on the board. */
function straight(g, level, angle = 0) {
  M.resetGame(g, 1);
  assert.ok(M.shoot(g, angle, level));
  g.w.run();
  return [g.w.x[0], M.live(g, 0)];
}

test("shuffle shot: zones: 4 hanging over the edge, then 3, 2, 1, and nothing short of the foul line", () => {
  assert.equal(M.zone(EDGE - R / 2), 4);
  assert.equal(M.zone(EDGE - R - 0.01), 3);
  assert.equal(M.zone(EDGE - 1.5 * M.ZONE), 2);
  assert.equal(M.zone(FOUL + 0.01), 1);
  assert.equal(M.zone(FOUL - 0.01), 0);
});

test("shuffle shot: a shot slides down the lane and stops where friction says, or drops off the end", () => {
  const g = M.newGame(1);
  const [soft, on1] = straight(g, 100);
  assert.ok(on1 && soft < FOUL && soft > X0, `a soft shot stops short of the foul line: ${soft}`);
  assert.equal(M.zone(soft), 0);
  // reach = v² ÷ 2μg from the line (flick's friction is exact on a flat).
  const v = (160 / M.STEPS) * M.VMAX, want = X0 + (v * v) / (2 * M.MU * M.G);
  const [x3, on3] = straight(g, 160);
  assert.ok(on3 && Math.abs(x3 - want) < 0.05, `level 160 stops at ${x3}, friction says ${want}`);
  assert.equal(M.zone(x3), 3);
  const [hang, onh] = straight(g, 163);
  assert.ok(onh && M.zone(hang) === 4, `level 163 hangs over the edge: ${hang}`);
  const [over, ono] = straight(g, 200);
  assert.equal(ono, false, `full power goes off the end: ${over}`);
  assert.equal(g.w.off[0], 1, "flagged off (in the gutter)");
});

test("shuffle shot: turns alternate, a round is 8 shots, then the count", () => {
  const g = M.newGame(1);
  assert.equal(M.shooter(g), 0);
  assert.equal(M.shoot(g, 0, 120), true);
  assert.equal(g.phase, ROLL);
  assert.equal(M.shoot(g, 0, 120), false, "no shot while pucks move");
  g.w.run();
  assert.equal(M.rested(g), AIM);
  assert.equal(M.shooter(g), 1, "the bot's turn");
  assert.equal(M.puckOf(g), PER, "its first puck");
  for (let k = 1; k < 2 * PER; k++) M.shoot(g, k * 40 - 160, 110), g.w.run(), M.rested(g);
  assert.equal(g.phase, TALLY);
  assert.equal(g.k, 2 * PER);
});

test("shuffle shot: the count: only the furthest side scores, for each puck past the other's best", () => {
  const g = M.newGame(1);
  // Place the pucks by hand: yours at 7.9 (4), 7.2 (3), 5.0 (1) and one short; the bot's best at 6.0.
  const at = [[7.9, 0.4], [7.2, -0.6], [5.0, 0], [2, 0], [6.0, -0.3], [5.6, 0.7], [-1, 0], [3, 0.5]];
  at.forEach(([x, z], i) => (g.w.place(i, x, z), (g.out[i] = 1)));
  g.w.run();
  g.k = 8;
  g.phase = ROLL;
  assert.equal(M.rested(g), TALLY);
  assert.equal(g.rs, 0, "you have the furthest puck");
  assert.equal(g.rp, 7, "4 + 3; the 1 at 5.0 is behind the bot's 6.0");
  assert.deepEqual(Array.from(g.pts), [4, 3, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(g.score), [7, 0]);
  assert.equal(M.nextRound(g), AIM);
  assert.equal(g.first, 0, "the scorer throws first");
  assert.equal(g.round, 2);
  assert.equal(g.out.indexOf(1), -1, "every puck back in its rack");
  // Nobody past the foul line: no score.
  g.k = 8;
  g.phase = TALLY;
  M.tally(g);
  assert.equal(g.rs, -1);
  // First to 15 (with the lead) ends it.
  g.score[0] = 16;
  g.score[1] = 9;
  assert.equal(M.nextRound(g), OVER);
  assert.equal(g.winner, 0);
});

/** A whole bot-vs-bot game on `g` (reused); returns the physics steps it took. */
function botGame(g, seed, rnd, out) {
  M.resetGame(g, seed);
  let shots = 0, steps = 0;
  while (g.phase !== OVER && shots < 400) {
    if (g.phase === AIM) M.botAim(g, rnd, out), M.shoot(g, out[0], out[1]), (steps += g.w.run()), M.rested(g), shots++;
    if (g.phase === TALLY) M.nextRound(g);
  }
  return steps;
}

test("shuffle shot: the bot always finishes, and the same seed and shots play the same table", () => {
  const g = M.newGame(1), out = new Int32Array(2);
  for (let s = 1; s <= 40; s++) {
    botGame(g, s, seeded(s), out);
    assert.equal(g.phase, OVER, `seed ${s}: over`);
    assert.ok(g.score[g.winner] >= M.WIN && g.score[g.winner] > g.score[1 - g.winner]);
  }
  const a = M.newGame(1), b = M.newGame(1);
  botGame(a, 9, seeded(4), out);
  botGame(b, 9, seeded(4), out);
  assert.deepEqual([Array.from(a.score), Array.from(a.w.x), Array.from(a.w.z)], [Array.from(b.score), Array.from(b.w.x), Array.from(b.w.z)]);
});

test("shuffle shot: the game's own code (aim, count, rounds, parking) allocates nothing", async () => {
  const g = M.newGame(1), rnd = seeded(3), out = new Int32Array(2);
  const at = [[7.9, 0.4], [7.2, -0.6], [5.0, 0], [2, 0], [6.0, -0.3], [5.6, 0.7], [-1, 0], [3, 0.5]];
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < 8; i++) g.w.place(i, at[i][0], at[i][1]), (g.out[i] = 1);
      g.w.run();
      (g.k = 8), (g.phase = ROLL), (g.score[0] = g.score[1] = 0);
      M.rested(g);
      M.botAim(g, rnd, out);
      M.nextRound(g);
    }
  };
  work(500);
  globalThis.gc?.();
  const n = await minorGCs(() => work(20000));
  assert.ok(n <= 1, `young-generation GCs over 20,000 rounds: ${n}`);
});

test("shuffle shot: whole games stay inside flick's allocation bar (at most one young GC per 20,000 steps)", async () => {
  const g = M.newGame(1), rnd = seeded(3), out = new Int32Array(2), steps = new Float64Array(1);
  const work = (n) => {
    for (let k = 0; k < n; k++) steps[0] += botGame(g, k + 1, rnd, out);
  };
  work(10);
  steps[0] = 0;
  globalThis.gc?.();
  const n = await minorGCs(() => work(20), 1);
  assert.ok(n <= 1 + steps[0] / 20000, `young-generation GCs: ${n} over ${steps[0]} steps`);
});
