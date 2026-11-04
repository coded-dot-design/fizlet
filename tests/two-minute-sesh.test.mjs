// Two-Minute Sesh (site/gallery/pieces/skate/two-minute-sesh.ts) and its trick scorer (combo.ts),
// headless: the run is plain numbers, so the game in it is checked here. The scorer: tricks add,
// repeats score less, the multiplier is the trick count, a landing banks, a bail loses it, banked
// points fill the special meter. The run: the attract run hits a gap and a grind and settles; a
// player clears the pit off the kicker (PIT GAP), banks a flip, bails a flip landed mid-rotation,
// grinds the rail on a held balance (and falls off an unheld one), manuals by holding GRAB through a
// landing, spells F-I-Z-L-E-T for the bonus, throws the special once the meter is full, and the clock
// ends the run on the score card, then still. Steps allocate nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { combo } = await import("../site/gallery/pieces/skate/combo.ts");
const M = await import("../site/gallery/pieces/skate/two-minute-sesh.ts");
const { sesh, NAMES, ROUND, LETTERS, R0, RH, GY } = M;
// Slots of S: 0 mode, 2 clock, 3 x, 4 height, 5 vx, 6 vy, 7 speed, 8 state, 9 facing, 10 flip time,
// 14 balance, 15 balance speed, 20 letters, 21 card, 25 gaps, 30 bails.
const PLAY = 2, DONE = 3, ROLL = 0, AIR = 1, RAIL = 2, MAN = 3, SLAM = 4;
const settled = (r) => { for (let i = 0; i < 1500; i++) if (!r.step(1 / 60)) return true; return false; };

test("combo: tricks add up, repeats score less, landing banks into the meter, a bail loses it", () => {
  const c = combo(["A", "B", "C"], 4, 1000);
  assert.equal(c.active, false);
  assert.equal(c.add(0, 100), 100);
  assert.equal(c.add(1, 200), 200);
  assert.equal(c.add(0, 100), 50, "a repeat in the same combo scores half");
  c.tick(10);
  assert.equal(c.mult, 3);
  assert.equal(c.value, 360 * 3);
  assert.equal(c.text(), "A + B + A");
  assert.equal(c.bank(), 1080);
  assert.equal(c.score, 1080);
  assert.equal(c.best, 1080);
  assert.equal(c.full, true, "1,080 banked fills a 1,000 meter");
  assert.equal(c.active, false);
  c.tick(500);
  assert.equal(c.value, 0, "ticks need a trick in hand");
  c.add(2, 300);
  assert.equal(c.add(0, 100), 100, "repeats count per combo");
  assert.equal(c.bail(), 800);
  assert.equal(c.score, 1080, "a bail never touches the score");
  assert.equal(c.special, 0.5, "a full meter drops to half on a bail");
  assert.equal(c.text(true), "A + B + A", "the best combo's string stays");
  for (let i = 0; i < 6; i++) c.add(i % 3, 10);
  assert.equal(c.text(), "… C + A + B + C", "a long combo shows its last `cap` tricks");
  c.bonus(2000);
  assert.equal(c.score, 3080);
  c.reset();
  assert.deepEqual([c.score, c.best, c.special, c.value], [0, 0, 0, 0]);
});

test("two-minute sesh: the attract run clears a gap and grinds, then stops on the flat", () => {
  const I = new Float64Array(4), r = sesh(7, I, true);
  let gaps = 0, grinds = 0;
  for (let i = 0; i < 60 * 7; i++) r.step(1 / 60), (gaps += r.ev[7]), (grinds += r.ev[3]);
  assert.ok(gaps >= 2 && grinds >= 1, `gaps ${gaps}, grinds ${grinds}`);
  assert.ok(settled(r), "idle: stopped, no more frames");
});

/** A run under the player's inputs; `each(S, r)` sets them before every step. */
function play(seed, sec, each, x = 12) {
  const I = new Float64Array(4), r = sesh(seed, I, false), S = r.S;
  I[1] = 1;
  r.step(1 / 60);
  (S[3] = x), (S[4] = 0), (S[7] = 0);
  assert.equal(S[0], PLAY, "a press starts the run");
  for (let i = 0; i < Math.round(sec * 60) && S[0] === PLAY; i++) (each(S, r, I), r.step(1 / 60));
  return { r, S, I };
}

test("two-minute sesh: ollie the kicker over the pit, kickflip and bank; a late flip bails", () => {
  let popped = 0, flipped = 0, banked = 0;
  const { r, S } = play(3, 4, (S, r, I) => {
    I[0] = S[8] === ROLL ? 1 : 0;
    if (S[8] === ROLL && !popped && S[3] > 26) (I[1] = 1), (popped = 1);
    if (S[8] === AIR && popped && !flipped && S[6] > 40) (I[2] = 1), (flipped = 1);
    banked += r.ev[9];
  });
  assert.ok(S[25] >= 1, `PIT GAP: gaps ${S[25]}`);
  assert.ok(banked >= 1 && r.cb.score >= (100 + 250) * 2, `kickflip + pit gap banked: ${r.cb.score}`);
  // Flip right before the floor: it lands mid-rotation and the combo is lost.
  let late = 0, before = 0;
  const b = play(3, 3, (S, r, I) => {
    I[0] = S[8] === ROLL ? 1 : 0;
    if (S[8] === ROLL && !late && S[3] > 26) I[1] = 1;
    if (S[8] === AIR && !late && S[6] < -40) (I[2] = 1), (late = 1), (before = r.cb.score);
  });
  assert.ok(b.S[30] >= 1, `a late flip bails: ${b.S[30]}`);
  assert.equal(b.r.cb.score, before, "the bail banks nothing");
});

test("two-minute sesh: grind the rail on a held balance; let it go and you fall off", () => {
  // Put the rider just above the rail, falling: a grind. Hold it with ← →, or don't.
  const grind = (hold) => {
    const I = new Float64Array(4), r = sesh(11, I, false), S = r.S;
    I[1] = 1;
    r.step(1 / 60);
    (S[8] = AIR), (S[3] = R0 + 2), (S[4] = RH + 1), (S[5] = 8), (S[6] = -30);
    let on = 0, i = 0;
    for (; i < 60 * 1.5; i++) {
      I[0] = hold && S[8] === RAIL ? -Math.sign(S[14] + S[15] * 0.4) : 0;
      r.step(1 / 60);
      if (S[8] === RAIL) on++;
      if (S[8] === SLAM) break;
    }
    return { on: on / 60, bailed: S[8] === SLAM, r };
  };
  const held = grind(true), loose = grind(false);
  assert.ok(held.on > 1 && !held.bailed, `held: ${held.on.toFixed(2)} s on the rail, to its end`);
  assert.ok(held.r.cb.text(true) === "50-50" && held.r.cb.score > 80, `banked off the end: ${held.r.cb.text(true)} ${held.r.cb.score}`);
  assert.ok(loose.bailed && loose.on < held.on, `unheld: off after ${loose.on.toFixed(2)} s`);
});

test("two-minute sesh: GRAB held through a landing manuals; letting go banks it", () => {
  let popped = 0, man = 0;
  const { r, S } = play(5, 3, (S, r, I) => {
    I[0] = S[8] === ROLL ? 1 : S[8] === MAN ? -Math.sign(S[14] + S[15] * 0.4) : 0;
    if (S[8] === ROLL && !popped && S[3] > 50) (I[1] = 1), (popped = 1);
    I[3] = popped && (S[8] === AIR || (S[8] === MAN && (man += 1 / 60) < 0.6)) ? 1 : 0;
  }, 50);
  assert.ok(man >= 0.5, `manualled ${man.toFixed(2)} s`);
  assert.ok(r.cb.best > 0 && /MANUAL/.test(r.cb.text(true)), `banked: ${r.cb.text(true)}`);
  assert.ok(S[8] !== SLAM);
});

test("two-minute sesh: spell F-I-Z-L-E-T for the bonus; a full meter throws the FIZZ FLIP", () => {
  const I = new Float64Array(4), r = sesh(2, I, false), S = r.S;
  I[1] = 1;
  r.step(1 / 60);
  let letters = 0;
  for (let k = 0; k < 6; k++) {
    // Float the rider through each letter.
    (S[8] = AIR), (S[3] = LETTERS[k * 2]), (S[4] = LETTERS[k * 2 + 1] - 7), (S[5] = 0), (S[6] = 0.1);
    r.step(1 / 60);
    letters += r.ev[6];
  }
  assert.equal(letters, 6);
  assert.equal(S[20], 63);
  assert.ok(r.cb.score >= 2000, `bonus: ${r.cb.score}`);
  // The special: full meter, FLIP with GRAB held in the air.
  r.cb.S[2] = 1;
  (S[8] = AIR), (S[3] = 80), (S[4] = 30), (S[5] = 0), (S[6] = 80), (S[13] = 0), (S[10] = 0);
  (I[2] = 1), (I[3] = 1);
  for (let i = 0; i < 50; i++) r.step(1 / 60), (I[3] = 1);
  assert.ok(r.cb.text().includes("FIZZ FLIP"), r.cb.text());
});

test(`two-minute sesh: the clock ends the run at ${ROUND} s on the score card, then it settles`, () => {
  const { r, S } = play(9, ROUND + 2, (S, r, I) => (I[0] = 1));
  assert.equal(S[0], DONE);
  assert.equal(S[2], 0);
  assert.ok(settled(r), "the card, then still");
  // And it never left the park, never fell below the floor.
  assert.ok(S[3] >= 1 && S[3] <= 159 && GY - S[4] <= 90);
  assert.ok(NAMES.length === 16);
});

test("two-minute sesh: steps allocate nothing", async () => {
  const I = new Float64Array(4), r = sesh(4, I, false), S = r.S;
  const steps = (n) => {
    for (let i = 0; i < n; i++) {
      if (S[0] !== PLAY) I[1] = 1;
      I[0] = (i >> 6) & 1 ? 1 : -1;
      if ((i & 31) === 0) I[1] = 1;
      if ((i & 63) === 7) I[2] = 1;
      I[3] = (i >> 4) & 1;
      r.step(1 / 60);
    }
  };
  steps(20000);
  globalThis.gc?.();
  const n = await minorGCs(() => steps(200000));
  assert.ok(n <= 1, `young-generation GCs over 200k steps: ${n}`);
});
