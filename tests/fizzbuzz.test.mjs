// FizzBuzz (site/gallery/pieces/fizzbuzz.ts), headless: the rule is the real FizzBuzz (checked
// against the classic loop for 1–100, with no off-by-one), the counter starts at 1, a call is judged
// against the number that ticks next, both FIZZ and BUZZ make FIZZBUZZ, a skip breaks the streak,
// it stops after six quiet ticks and at 100, the attract count ends on 15 and goes still, and the
// step allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { fizzbuzz, said, call, fizzGame, NUMBER, IDLE, DEMO, RUN, DONE, LAST, QUIET } = await import("../site/gallery/pieces/fizzbuzz.ts");

const S_MODE = 0, S_N = 1, S_STREAK = 5, S_BEST = 6, S_RES = 8;
/** Step until the counter shows n + 1 (a tick); returns the tick's events. */
const toNext = (g) => {
  const n = g.S[S_N];
  for (let i = 0; i < 600; i++) {
    g.step(1 / 60);
    if (g.S[S_N] !== n) return [...g.ev];
  }
  throw new Error("no tick");
};

test("fizzbuzz: the rule matches the classic loop, 1 to 100", () => {
  const classic = [];
  for (let i = 1; i <= 100; i++) classic.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));
  const ours = [];
  for (let i = 1; i <= 100; i++) ours.push(said(i).replace(/^FIZZBUZZ$/, "FizzBuzz").replace(/^FIZZ$/, "Fizz").replace(/^BUZZ$/, "Buzz"));
  assert.deepEqual(ours, classic);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9, 10, 15, 30, 45, 99, 100].map(fizzbuzz), [0, 0, 1, 0, 2, 1, 1, 2, 3, 3, 3, 1, 2]);
  assert.deepEqual([1, 3, 5, 15].map(call), [NUMBER, 1, 2, 3]);
});

test("fizzbuzz: the count starts at 1 and every tick is the next number; the can fizzes on threes, the bee on fives", () => {
  const g = fizzGame();
  g.faster();
  assert.equal(g.S[S_MODE], RUN);
  assert.equal(g.S[S_N], 0, "nothing shown before the first tick");
  for (let n = 1; n <= 30; n++) {
    g.guess(call(n)); // keep it counting (and right)
    const ev = toNext(g);
    assert.equal(g.S[S_N], n, `tick ${n}`);
    assert.equal(ev[1], n % 3 === 0 ? 1 : 0, `${n}: fizz`);
    assert.equal(ev[2], n % 5 === 0 ? 1 : 0, `${n}: buzz`);
  }
  assert.equal(g.S[S_STREAK], 30, "thirty right calls in a row");
});

test("fizzbuzz: a call is judged on the next number (no off-by-one); FIZZ + BUZZ is FIZZBUZZ; wrong or skipped breaks the streak", () => {
  const g = fizzGame();
  g.guess(NUMBER); // starts the count, calls 1
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES], g.S[S_STREAK]], [1, 1, 1], "1: the number, right");
  g.guess(NUMBER);
  toNext(g);
  g.guess(1);
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES], g.S[S_STREAK]], [3, 1, 3], "3: FIZZ, right");
  g.guess(1); // 4 is the number: FIZZ is wrong
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES], g.S[S_STREAK], g.S[S_BEST]], [4, 2, 0, 3], "4: FIZZ is wrong; best stays 3");
  for (let n = 5; n < 15; n++) (g.guess(call(n)), toNext(g));
  g.guess(1);
  g.guess(2);
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES], g.S[S_STREAK]], [15, 1, 11], "15: FIZZ + BUZZ, right");
  g.guess(1);
  g.guess(1); // a toggle: FIZZ off again, no call
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES], g.S[S_STREAK]], [16, 3, 0], "16: no call, the streak breaks");
  g.guess(2);
  g.guess(NUMBER); // the number replaces BUZZ
  toNext(g);
  assert.deepEqual([g.S[S_N], g.S[S_RES]], [17, 1], "17: the number, right");
});

test("fizzbuzz: tapping counts faster; six quiet ticks stop it; 100 ends it; then it goes still", () => {
  const g = fizzGame();
  g.faster();
  const slow = g.S[3];
  g.faster();
  g.faster();
  assert.ok(g.S[3] < slow * 0.7, "faster");
  for (let i = 0; i < QUIET; i++) toNext(g);
  assert.equal(g.S[S_MODE], DONE, "stopped after six quiet ticks");
  assert.equal(g.S[S_N], QUIET);
  let busy = 0;
  for (let i = 0; i < 900; i++) if (g.step(1 / 60)) busy = i;
  assert.ok(busy < 400, `still once it stops (last busy step ${busy})`);
  g.faster();
  assert.equal(g.S[S_MODE], RUN, "a tap counts again, from the top");
  assert.equal(g.S[S_N], 0);
  for (let n = 1; n <= LAST; n++) (g.guess(call(n)), toNext(g));
  assert.equal(g.S[S_N], LAST);
  assert.equal(g.S[S_MODE], DONE, "done at 100");
  assert.equal(g.S[S_BEST], LAST);
});

test("fizzbuzz: the attract count runs 1 to 15 (the fizzy bee), then waits, still", () => {
  const g = fizzGame();
  g.start(true);
  assert.equal(g.S[S_MODE], DEMO);
  let fizzy = 0, last = 0;
  for (let i = 0; i < 60 * 12; i++) {
    if (g.step(1 / 60)) last = i;
    fizzy += g.ev[6];
  }
  assert.equal(g.S[S_N], 15);
  assert.equal(g.S[S_MODE], IDLE);
  assert.equal(fizzy, 1, "the bee dives into the fizz");
  assert.ok(last < 60 * 8, `still after the bee has gone (last busy step ${last})`);
});

test("fizzbuzz: zero allocation in the step", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const g = fizzGame();
  const steps = (n) => { for (let i = 0; i < n; i++) { if (g.S[S_MODE] !== RUN) g.faster(); if ((i & 7) === 0) g.guess(1 + (i & 3)); if ((i & 255) === 0) g.faster(); g.step(1 / 60); } };
  steps(20000);
  gc();
  const n = await minorGCs(() => steps(200000));
  assert.ok(n <= 1, `young-generation GCs over 200k steps: ${n}`);
});
