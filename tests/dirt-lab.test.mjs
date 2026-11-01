// Dirt Lab's sim (site/gallery/pieces/dirt-lab.ts), headless: plain numbers, no DOM. The default
// track is rideable by the demo rider; a crooked landing and a gap with no ramp are crashes; the
// hash codec refuses anything but eight known letters; and a step allocates nothing (GC harness).
import test from "node:test";
import assert from "node:assert/strict";
import { lab, encodeTrack, decodeTrack, BUILD, RACE, CRASH, DONE } from "../site/gallery/pieces/dirt-lab.ts";
import { minorGCs } from "./gc.mjs";

const ride = (s, sec, each) => { for (let i = 0; i < sec * 60; i++) (each?.(), s.step(1 / 60)); };

test("dirt-lab: the demo rider rides the default track to the flag, then the builder", () => {
  const ev = [], s = lab((t) => ev.push(t));
  s.race(true);
  ride(s, 6);
  assert.deepEqual(ev, ["go", "launch", "land", "launch", "finish"]);
  ride(s, 3);
  assert.equal(s.S[0], BUILD);
});

test("dirt-lab: no lean off a ramp lands nose up (a crash); a gap with no ramp is a crash", () => {
  const s = lab(() => {});
  s.S[10] = 1;
  s.race();
  ride(s, 4, () => (s.S[10] = 1));
  assert.equal(s.S[26], 1, "nose up off the ramp: over the bars");
  ride(s, 3);
  for (let i = 0; i < 8; i++) s.place(i, 0);
  s.place(2, 3);
  s.race();
  ride(s, 4, () => (s.S[10] = 1));
  assert.equal(s.S[26], 2, "into the pit");
  assert.ok([CRASH, BUILD].includes(s.S[0]));
});

test("dirt-lab: the hash codec: eight known letters round-trip; anything else is refused whole", () => {
  const t = new Uint8Array([3, 2, 1, 0, 0, 1, 2, 3]), out = new Uint8Array(8);
  assert.equal(encodeTrack(t), "gbr--rbg");
  assert.equal(decodeTrack("#t=gbr--rbg", out), true);
  assert.deepEqual([...out], [...t]);
  for (const h of ["", "#", "#t=", "#t=gbr", "#t=gbr--rbgg", "#t=gbr--rbX", "#t=" + "-".repeat(70), "#t=%20%20%20%20%20%20%20%20", "#q=gbr--rbg", null, 42]) {
    const o = new Uint8Array(8).fill(7);
    assert.equal(decodeTrack(h, o), false, String(h).slice(0, 20));
    assert.ok(o.every((v) => v === 7), "refused: nothing written");
  }
});

test("dirt-lab: a step allocates nothing (racing, flying, crashing)", async () => {
  const s = lab(() => {});
  const work = () => {
    for (let k = 0; k < 40; k++) {
      if (s.S[0] === BUILD) s.race(k & 1 ? true : false);
      for (let i = 0; i < 600; i++) (s.S[10] = 1), (s.S[11] = i & 64 ? 1 : -1), s.step(1 / 60);
    }
  };
  work();
  assert.equal(await minorGCs(work), 0);
  assert.ok([BUILD, RACE, CRASH, DONE].includes(s.S[0]));
});
