// Bag Beat's bag (site/gallery/pieces/bag-beat.ts), headless: punches on the beat keep it going and
// speed it up, early ones clunk and break the streak, no punch lets it dangle; the round ends at the
// bell and it goes still; a step allocates nothing (GC harness).
import test from "node:test";
import assert from "node:assert/strict";
import { bag, WAIT, PLAY, DONE } from "../site/gallery/pieces/bag-beat.ts";
import { minorGCs } from "./gc.mjs";

const run = (b, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) (each?.(), b.step(1 / 60)); };

test("bag-beat: on the beat the streak grows and the bag speeds up; the bell ends it; then still", () => {
  const ev = [], b = bag((t) => ev.push(t));
  b.punch();
  assert.equal(b.S[0], PLAY);
  const per = b.S[3];
  run(b, 11, () => b.S[4] && b.S[2] > 0.99 && b.punch());
  assert.ok(b.S[6] >= 10, `best streak ${b.S[6]}`);
  assert.ok(b.S[3] < per * 0.8, "faster");
  assert.ok(ev.includes("perfect") && ev.includes("slap") && ev.includes("ding"));
  assert.equal(ev.filter((e) => e === "clunk").length, 0);
  run(b, 4);
  assert.equal(b.S[0], WAIT);
  assert.equal(b.step(1 / 60), false, "still");
});

test("bag-beat: early is a clunk (streak gone), no punch lets it dangle", () => {
  const ev = [], b = bag((t) => ev.push(t));
  b.punch();
  run(b, 1.3, () => b.S[2] > 0.99 && b.punch());
  assert.ok(b.S[5] >= 1, "a streak");
  run(b, 0.25);
  b.punch(); // mid-swing: far from the window
  assert.equal(ev.at(-1), "clunk");
  assert.equal(b.S[5], 0);
  run(b, 2);
  assert.ok(ev.includes("miss"), "it came back with no punch and dangles");
  assert.equal(b.S[4], 0);
});

test("bag-beat: the demo keeps the beat six times, then it's your turn", () => {
  const ev = [], b = bag((t) => ev.push(t));
  b.demo();
  run(b, 6);
  assert.ok(ev.includes("turn"));
  assert.ok([DONE, WAIT].includes(b.S[0]));
  assert.equal(ev.filter((e) => e === "clunk").length, 0);
});

test("bag-beat: a step allocates nothing", async () => {
  const b = bag(() => {});
  const work = () => { for (let k = 0; k < 20; k++) { if (b.S[0] === WAIT) b.punch(); for (let i = 0; i < 700; i++) ((b.S[4] && b.S[2] > 0.99) || (i & 127) === 3 ? b.punch() : 0, b.step(1 / 60)); } };
  work();
  assert.equal(await minorGCs(work), 0);
});
