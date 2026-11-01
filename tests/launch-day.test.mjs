// The launch-day pieces' games (site/gallery/pieces/launch/), headless: they run on plain numbers,
// so the rules and the zero-allocation step are checked here (node --expose-gc). npm i @fzlt/core: the
// bricks an order needs snap in, one it doesn't bounces out, a full order ships and the next comes
// in, and the belt coasts to a stop. Recall Party: confetti knocks letters loose onto the floor,
// Recall brings every one home exactly, and the party settles. The numbers they show are measured
// (scripts/launch-facts.mjs): the stage slots fill from them, and an unknown slot fails.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../src/kernel/random.ts";
import { npmSim, MODE, ORDER, SHIPPED, HAVE, NOPES, IDLE, PLAY, STREAK, LAST } from "../site/gallery/pieces/launch/npm-sim.ts";
import { recallSim, LOOSE, MODE as RMODE, IDLE as RIDLE, RECALL, CHECK } from "../site/gallery/pieces/launch/recall-sim.ts";
import { fillStage, ORDERS, BRICKS } from "../scripts/launch-facts.mjs";
import { minorGCs } from "./gc.mjs";

const LABELS = BRICKS.map((b) => b[0]);
const orders = ORDERS.map(([, l]) => l.map((x) => LABELS.indexOf(x)));
const noop = () => {};
const run = (s, sec) => { let busy = false; for (let i = 0; i < sec * 60; i++) busy = s.step(1 / 60); return busy; };

test("npm i @fzlt/core: needed bricks snap in, others bounce, a full order ships, the belt stops", () => {
  const ev = [];
  const s = npmSim(LABELS.length, orders, seeded(7), (t) => ev.push(t));
  run(s, 1.6); // the intro's demo takes the kernel
  assert.equal(s.S[HAVE] & 1, 1, "the demo drops the kernel in");
  // Feed the order: put each brick it needs over the chute and press the key.
  const feed = (k) => {
    for (let i = 0; i < 6; i++) s.belt[i] = -1;
    s.belt[0] = k;
    s.S[4] = ((95 - 13 + 26) % 192 + 192) % 192; // slot 0 over the chute
    assert.ok(s.key(), `brick ${LABELS[k]} drops`);
    run(s, 0.5);
  };
  feed(LABELS.indexOf("camera"));
  assert.equal(s.S[NOPES], 1, "a brick the order doesn't need bounces out");
  for (const k of orders[0].slice(1)) feed(k);
  assert.ok(ev.includes("ship"), "a full order ships");
  run(s, 2.2);
  assert.deepEqual([s.S[SHIPPED], s.S[ORDER], s.S[HAVE], s.S[MODE]], [1, 1, 0, PLAY], "the next order comes in empty");
  assert.deepEqual([s.S[STREAK], s.S[LAST]], [0, 0], "a bounce in the order: no streak; the bundle shown is the order that shipped");
  for (const k of orders[1].slice(0)) feed(k);
  run(s, 2.2);
  assert.equal(s.S[STREAK], 1, "a clean order starts a streak");
  assert.equal(run(s, 12), false, "with no input the belt coasts to a stop and nothing moves");
  assert.equal(s.S[MODE], IDLE);
});

test("npm i @fzlt/core: zero allocation in its steps (belt, flying bricks, words, sparks)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const s = npmSim(LABELS.length, orders, seeded(3), noop);
  const steps = (n) => { for (let i = 0; i < n; i++) { if (i % 20 === 0) s.tap(20 + (i % 120), 27); s.step(1 / 60); } };
  steps(20000);
  gc();
  const minor = await minorGCs(() => steps(200000));
  assert.ok(minor <= 1, `young-generation GCs over 200k steps: ${minor}`);
});

const letters = (s) => { for (let i = 0; i < s.n; i++) s.place(i, 30 + i * 9, 20 + (i > 6 ? 14 : 0), 8, 12); };

test("Recall Party: confetti knocks letters onto the floor; Recall brings every one home exactly", () => {
  const s = recallSim(13, seeded(5), noop);
  letters(s);
  run(s, 6); // the intro: a pop, then its own Recall
  assert.equal(s.S[RMODE], RIDLE, "the intro ends idle");
  for (let k = 0; k < 4; k++) (s.tap(60 + k * 10, 22), run(s, 0.5));
  run(s, 6);
  assert.ok(s.S[LOOSE] >= 3, `letters knocked loose and resting (${s.S[LOOSE]})`);
  for (let i = 0; i < s.n; i++) if (s.LS[i]) assert.ok(Math.abs(s.HY[i] + s.DY[i] + 6 - 88) < 0.01, "a loose letter rests on the floor");
  assert.ok(s.tap(130, 65), "the Recall button");
  assert.equal(s.S[RMODE], RECALL);
  run(s, 2);
  assert.equal(s.S[CHECK], 1, "home: the scene asks the page to measure");
  for (let i = 0; i < s.n; i++) assert.deepEqual([s.LS[i], s.DX[i], s.DY[i], s.R[i]], [0, 0, 0, 0], `letter ${i} home exactly`);
  assert.equal(run(s, 3), false, "settled");
});

test("Recall Party: zero allocation in its steps (confetti, letters, Recall)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const s = recallSim(13, seeded(9), noop);
  letters(s);
  const steps = (n) => { for (let i = 0; i < n; i++) { if (i % 90 === 0) s.tap(40 + (i % 80), 20); if (i % 600 === 300) s.recall(); s.step(1 / 60); } };
  steps(20000);
  gc();
  const minor = await minorGCs(() => steps(200000));
  assert.ok(minor <= 1, `young-generation GCs over 200k steps: ${minor}`);
});

test("launch facts: stage slots fill from the measured numbers; an unknown slot fails", () => {
  const f = { deps: 0, kernel: 3413, pack: { size: 198210, unpacked: 568339, files: 85 }, bricks: [["kernel", 3413]], orders: [["a toy", ["kernel"], 3413]] };
  const html = fillStage('<div data-facts="{{facts}}"><p>{{deps}} · {{kernel}} B · {{pack.size}} B · {{pack.files}}</p></div>', f);
  assert.equal(html, `<div data-facts="${JSON.stringify(f).replace(/"/g, "&quot;")}"><p>0 · 3,413 B · 198,210 B · 85</p></div>`);
  assert.throws(() => fillStage("{{nope}}", f), /unknown stage slot/);
});
