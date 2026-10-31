// Toast Tell's bout (site/gallery/pieces/toast-tell.ts), headless: plain numbers, no DOM. The tell
// says which punch is coming (toast up: hook, duck it; red eyes: jab, slip it); the right dodge
// opens him for a counter, the wrong one (or none) is a hit; three counters is his count and KO,
// three hits is yours; a punch outside the window is blocked; a step allocates nothing (GC harness).
import test from "node:test";
import assert from "node:assert/strict";
import { bout, WAIT, FIGHT, KO, DOWN, TELL, OPEN, SLIP, DUCK, PUNCH, HOOK } from "../site/gallery/pieces/toast-tell.ts";
import { minorGCs } from "./gc.mjs";

const run = (b, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), b.step(1 / 60)); };
/** A boxer who reads the tell: the right dodge mid-tell, a punch when he's open. */
const reader = (b) => () => {
  const S = b.S;
  if (S[2] === TELL && S[3] > 0.3) b.act(S[4] === HOOK ? DUCK : SLIP);
  if (S[2] === OPEN && S[3] > 0.1) b.act(PUNCH);
};

test("toast-tell: reading every tell is three counters, his count, KO, then it waits", () => {
  const ev = [], b = bout((t) => ev.push(t));
  assert.equal(b.act(PUNCH), true, "a move starts the bout");
  assert.equal(b.S[0], FIGHT);
  run(b, 12, reader(b));
  assert.equal(ev.filter((e) => e === "counter").length, 3);
  assert.equal(ev.filter((e) => e === "hit").length, 0);
  assert.ok(ev.includes("pop") && ev.includes("tell"), "both tells shown (toast pop, red eyes)");
  assert.ok(ev.includes("ko"));
  assert.deepEqual(ev.filter((e) => e === "count").length, 3, "a count of three");
  run(b, 5);
  assert.equal(b.S[0], WAIT);
  assert.equal(b.step(1 / 60), false, "waiting: nothing moves");
});

test("toast-tell: the wrong dodge is a hit; three of them and you're down for the count", () => {
  const ev = [], b = bout((t) => ev.push(t));
  b.act(PUNCH);
  // Always dodge the wrong way.
  run(b, 12, () => b.S[2] === TELL && b.S[3] > 0.3 && b.act(b.S[4] === HOOK ? SLIP : DUCK));
  assert.equal(ev.filter((e) => e === "hit").length, 3);
  assert.ok(ev.includes("down"));
  assert.equal(ev.filter((e) => e === "counter").length, 0);
});

test("toast-tell: a punch when he isn't open is blocked; mashing a dodge early misses the window", () => {
  const ev = [], b = bout((t) => ev.push(t));
  b.act(PUNCH);
  run(b, 0.3);
  b.act(PUNCH);
  run(b, 0.3);
  assert.ok(ev.includes("block"));
  // Duck as soon as the tell starts: the dodge is over before the hook lands.
  run(b, 6, () => b.S[2] === TELL && b.S[3] < 0.05 && b.act(b.S[4] === HOOK ? DUCK : SLIP));
  assert.ok(ev.filter((e) => e === "hit").length >= 1, "too early is a hit");
});

test("toast-tell: the demo boxer counters once, then it's your turn (and it waits)", () => {
  const ev = [], b = bout((t) => ev.push(t));
  b.start(true);
  run(b, 5);
  assert.equal(ev.filter((e) => e === "counter").length, 1);
  assert.ok(ev.includes("turn"));
  assert.equal(b.S[0], WAIT);
});

test("toast-tell: a step allocates nothing", async () => {
  const b = bout(() => {}), r = reader(b);
  const work = () => { for (let k = 0; k < 30; k++) { if (b.S[0] === WAIT) b.act(PUNCH); for (let i = 0; i < 600; i++) ((i & 7) === 0 && r(), (i & 63) === 5 && b.act(SLIP), b.step(1 / 60)); } };
  work();
  assert.equal(await minorGCs(work), 0);
  assert.ok([WAIT, FIGHT, KO, DOWN].includes(b.S[0]));
});
