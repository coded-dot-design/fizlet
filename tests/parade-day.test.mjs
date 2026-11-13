// Parade Day's float (site/gallery/pieces/parade/model.ts), headless: every seed's course is
// floatable (the autopilot leans the team past every post and into every gust and reaches the
// grandstand with no bumps: the Perfect float), with no hands on the lines the gusts and the arms
// bump it three times and it deflates short of the finish, a bump pushes the balloon away from the
// post and swings its banner, the same seed plays the same parade, the score adds up, and a whole
// run on a reused float allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/parade/model.ts");
const { RUN, DONE, DEFLATE, LEN, EV_BUMP } = M;
const DT = 1 / 60;

function run(seed, pilot, cap = 60 * 40) {
  const I = new Float64Array(2), f = M.float(seed, I);
  I[1] = 1;
  f.step(DT);
  let bumps = 0, maxGust = 0;
  for (let i = 0; i < cap && f.S[0] !== DONE; i++) {
    if (pilot) M.autopilot(f, I);
    else I[0] = 0;
    f.step(DT);
    if (f.ev[EV_BUMP]) bumps++;
    maxGust = Math.max(maxGust, Math.abs(f.S[9]));
  }
  return { f, bumps, maxGust };
}

test("parade day: the autopilot floats every seed to the grandstand with no bumps (the Perfect float)", () => {
  for (let s = 1; s <= 300; s++) {
    const { f, bumps, maxGust } = run(s, true);
    assert.equal(f.S[0], DONE, `seed ${s}: it finished`);
    assert.equal(bumps, 0, `seed ${s}: no bumps`);
    assert.ok(f.finished(), `seed ${s}: at the finish line`);
    assert.equal(f.metres(), LEN * 10);
    assert.equal(f.score(), LEN * 10 + M.FINISH_PTS + M.PERFECT_PTS, `seed ${s}: distance + finish + perfect float`);
    assert.ok(maxGust > 3, `seed ${s}: the gusts blew`);
  }
});

test("parade day: with no hands on the lines it bumps three times and deflates short of the finish", () => {
  let deflated = 0;
  for (let s = 1; s <= 100; s++) {
    const { f, bumps } = run(s, false);
    if (bumps >= 3) {
      deflated++;
      assert.equal(f.S[0], DONE, `seed ${s}: flat, the run over`);
      assert.equal(f.finished(), false, `seed ${s}: not a finish`);
      assert.ok(f.metres() < LEN * 10, `seed ${s}: short of the grandstand`);
      assert.equal(f.score(), Math.max(0, f.metres() - 3 * M.BUMP_PTS), `seed ${s}: distance minus the bumps`);
    }
  }
  assert.ok(deflated > 80, `most hands-off parades deflate (${deflated} of 100)`);
});

test("parade day: a bump pushes the balloon away from the post, squashes it and swings the banner", () => {
  const I = new Float64Array(2), f = M.float(5, I);
  I[1] = 1;
  f.step(DT);
  let i = 0;
  while (!f.ev[EV_BUMP] && i++ < 3000) (I[0] = f.PS[0] > 0 ? 1 : -1), f.step(DT);
  assert.ok(f.ev[EV_BUMP], "leaning into the first arm bumps it");
  assert.equal(f.S[6], 1, "one bump");
  assert.ok(f.S[7] > 0, "squashing");
  assert.ok(f.PH.some((h) => h >= 0), "a banner swings");
  assert.ok(Math.sign(f.S[5]) === -f.PS[f.S[12]], "pushed away from the post");
  assert.equal(f.S[0], RUN);
});

test("parade day: the same seed plays the same parade; a press starts it", () => {
  const a = run(42, true).f, b = run(42, true).f;
  assert.deepEqual(Array.from(a.PR), Array.from(b.PR));
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
  const I = new Float64Array(2), f = M.float(1, I);
  for (let i = 0; i < 30; i++) f.step(DT);
  assert.equal(f.S[0], M.IDLE, "waits at the start line");
  assert.equal(f.S[2], 0);
  I[1] = 1;
  f.step(DT);
  assert.equal(f.S[0], RUN);
  assert.ok(DEFLATE > RUN);
});

test("parade day: a whole run allocates nothing", async () => {
  const I = new Float64Array(2), f = M.float(9, I);
  const play = () => {
    f.reset();
    f.S[0] = RUN;
    for (let i = 0; i < 60 * 25; i++) M.autopilot(f, I), f.step(DT);
  };
  play();
  assert.equal(await minorGCs(() => { for (let k = 0; k < 20; k++) play(); }), 0);
});
