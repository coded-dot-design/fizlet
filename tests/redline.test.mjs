// Redline's sprint (site/gallery/pieces/redline.ts), headless: riding the edge of the red beats the
// ghost; flat out blows the engine (stall) and loses; too timid loses too; a puddle cools the engine;
// the demo stops after its first splash; a step allocates nothing (GC harness).
import test from "node:test";
import assert from "node:assert/strict";
import { sprint, WAIT, RACE, DONE, PUDDLES } from "../site/gallery/pieces/redline.ts";
import { minorGCs } from "./gc.mjs";

const race = (pol) => {
  const ev = [], s = sprint((t) => ev.push(t));
  s.go(false);
  for (let i = 0; i < 60 * 15 && s.S[0] === RACE; i++) (s.S[5] = pol(s.S)), s.step(1 / 60);
  return { ev, S: s.S, s };
};

test("redline: the edge of the red wins; flat out blows and loses; timid loses", () => {
  const edge = race((S) => (S[4] < (S[5] ? 0.92 : 0.7) ? 1 : 0));
  assert.deepEqual([edge.S[10], edge.S[13]], [1, 0], "edge: a win, no blows");
  assert.ok(edge.ev.includes("win") && edge.ev.filter((e) => e === "splash").length === PUDDLES.length);
  const mash = race(() => 1);
  assert.ok(mash.S[13] >= 1 && mash.S[10] === 0 && mash.ev.includes("blow"), "flat out: blown, ghosted");
  const timid = race((S) => (S[4] < (S[5] ? 0.5 : 0.2) ? 1 : 0));
  assert.equal(timid.S[10], 0, "timid: ghosted");
  for (let i = 0; i < 200; i++) edge.s.step(1 / 60);
  assert.equal(edge.S[0], WAIT, "back on the line");
  assert.equal(edge.s.step(1 / 60), false, "still");
});

test("redline: a puddle cools the engine", () => {
  const s = sprint(() => {});
  s.go(false);
  let before = -1;
  for (let i = 0; i < 600 && s.S[2] < PUDDLES[0]; i++) (s.S[5] = s.S[4] < 0.9 ? 1 : 0), (before = s.S[4]), s.step(1 / 60);
  assert.ok(s.S[4] < before - 0.2, `cooled from ${before.toFixed(2)} to ${s.S[4].toFixed(2)}`);
});

test("redline: the demo rides to its first splash, then waits on the line", () => {
  const ev = [], s = sprint((t) => ev.push(t));
  s.go(true);
  for (let i = 0; i < 600; i++) s.step(1 / 60);
  assert.deepEqual(ev.slice(-2), ["splash", "turn"]);
  assert.equal(s.S[0], WAIT);
});

test("redline: a step allocates nothing", async () => {
  const s = sprint(() => {});
  const work = () => { for (let k = 0; k < 30; k++) { if (s.S[0] === WAIT) s.go(false); for (let i = 0; i < 600; i++) ((s.S[5] = i & 32 ? 1 : 0), s.step(1 / 60)); } };
  work();
  assert.equal(await minorGCs(work), 0);
  assert.ok([WAIT, RACE, DONE].includes(s.S[0]));
});
