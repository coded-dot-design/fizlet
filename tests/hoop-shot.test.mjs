// Hoop Shot's game (site/gallery/pieces/hoop-shot/model.ts) on ../bar/toss.ts, headless: a straight
// shot at the right power drops through the hoop (a swish scores 3, off the rim 2), short and long
// ones miss; every ball rolls back down the ramp to the tray and comes to hand; the clock starts with
// the first shot and ends the round; the hoop is still for 15 s, then slides (a triangle wave, sums
// only); baskets in the last 10 s are worth 3; the same shots at the same ticks play the same round
// bit for bit; the game's code allocates nothing (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/hoop-shot/model.ts");
const { READY, ON, OVER, BALLS, ROUND, MOVE_AT, BONUS_AT, SWAY, HZ } = M;

function game(seed = 1) {
  let g;
  g = M.newGame(seed, { emit: (t, a, b) => t === "toss:hit" && M.touched(g, a, b) });
  return g;
}
/** One shot from a fresh game; ticks until that ball is back. Returns [score, rims, ticks]. */
function one(g, aim, level) {
  M.resetGame(g, 1);
  const i = M.inHand(g);
  assert.ok(M.shoot(g, aim, level));
  let n = 0;
  while (g.out[i] && n < 1200) M.tick(g), n++;
  return [g.score, g.rims[i], n];
}

test("hoop shot: the right power drops it through (a swish 3, off the rim 2); short and long miss; it comes back", () => {
  const g = game();
  const sw = one(g, 0, 63);
  assert.deepEqual(sw.slice(0, 2), [3, 0], `a swish: ${sw}`);
  const rim = one(g, 0, 57);
  assert.equal(rim[0], 2, `off the rim: ${rim}`);
  assert.ok(rim[1] > 0);
  for (const lv of [20, 100]) {
    const [s, , n] = one(g, 0, lv);
    assert.equal(s, 0, `level ${lv} misses`);
    assert.ok(n < 900, `level ${lv}: the ball came back in ${n} ticks`);
  }
  assert.equal(M.inHand(g) >= 0, true, "a ball in hand");
});

test("hoop shot: the clock starts with the first shot and ends the round; the hoop slides after 15 s", () => {
  const g = game();
  assert.equal(g.phase, READY);
  for (let k = 0; k < 100; k++) M.tick(g);
  assert.equal(g.tick, 0, "nothing runs before the first shot");
  assert.equal(M.clock(g), 45);
  M.shoot(g, 0, 10);
  assert.equal(g.phase, ON);
  while (g.phase === ON) M.tick(g);
  assert.equal(g.phase, OVER);
  assert.equal(g.tick, ROUND);
  assert.equal(M.shoot(g, 0, 60), false, "no shots after the buzzer");
  // The slide: still, then out to ±SWAY and back, a triangle.
  assert.equal(M.hoopZ(MOVE_AT), 0);
  assert.equal(M.hoopZ(MOVE_AT - 1), 0);
  assert.ok(Math.abs(M.hoopZ(MOVE_AT + 150) - SWAY) < 1e-12);
  assert.ok(Math.abs(M.hoopZ(MOVE_AT + 450) + SWAY) < 1e-12);
  assert.ok(Math.abs(M.hoopZ(MOVE_AT + 600)) < 1e-12);
});

test("hoop shot: a basket in the last 10 s is worth 3 (4 with a swish)", () => {
  const g = game();
  // The hoop crosses the middle at the bonus's first tick: a straight swish timed to meet it there.
  assert.equal(M.hoopZ(BONUS_AT), 0);
  let got = 0;
  for (let d = 24; d <= 40 && !got; d++) {
    M.resetGame(g, 1);
    g.tick = BONUS_AT - d;
    const i = M.inHand(g), s0 = g.score;
    M.shoot(g, 0, 63);
    while (g.out[i] && g.phase === ON) M.tick(g);
    if (g.score > s0) got = g.score - s0, assert.ok(g.tick > BONUS_AT);
  }
  assert.equal(got, 4, "a bonus swish");
});

/** A round of seeded shots: fire whenever a ball is in hand. Returns the ticks. */
function round(g, seed) {
  M.resetGame(g, seed);
  let s = seed >>> 0, n = 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
  while (g.phase !== OVER && n < ROUND + 100) {
    if (M.inHand(g) >= 0 && r() < 0.15) M.shoot(g, Math.round((r() - 0.5) * 40), 50 + Math.round(r() * 20));
    M.tick(g);
    n++;
  }
  return n;
}

test("hoop shot: the same shots at the same ticks play the same round bit for bit; balls never get lost", () => {
  const a = game(), b = game();
  for (let s = 1; s <= 5; s++) {
    round(a, s);
    round(b, s);
    assert.equal(a.phase, OVER);
    assert.deepEqual([a.score, a.made, a.swish, a.shots, Array.from(a.w.x), Array.from(a.w.y), Array.from(a.w.z)], [b.score, b.made, b.swish, b.shots, Array.from(b.w.x), Array.from(b.w.y), Array.from(b.w.z)], `seed ${s}`);
    assert.ok(a.shots > 20, `seed ${s}: ${a.shots} shots in a round (the balls keep coming back)`);
  }
  for (let i = 0; i < BALLS; i++) assert.ok(a.w.x[i] > -0.2 && a.w.x[i] < 2.7 && Math.abs(a.w.z[i]) < 0.5, `ball ${i} is in the cabinet`);
});

test("hoop shot: the game's own code (shots, flight, baskets, the clock, the slide) allocates nothing", async () => {
  const g = game();
  const work = (n) => {
    for (let k = 0; k < n; k++) round(g, k + 1);
  };
  work(1);
  const n = await minorGCs(() => work(6));
  assert.ok(n <= 1, `young-generation GCs over 6 rounds: ${n}`);
});
