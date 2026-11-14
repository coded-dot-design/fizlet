// Cup Toss's game (site/gallery/pieces/cup-toss/model.ts) on ../bar/toss.ts, headless: a toss aimed
// at any cup of the rack drops in and clears it (and only it); too soft lands short on the table, too
// hard flies over; side-spin curves the ball (left and right mirror each other), a ball on a rim
// rattles; the rack is pulled in at six and at three; twenty balls, a cleared rack ends it; the
// same tosses play the same game bit for bit; the game's code allocates nothing (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/cup-toss/model.ts");
const { AIM, SHOWN, OVER, CUPS, BALLS, TX1 } = M;

/** A game whose toss events go back into it (bounces off the table, rim touches). */
function game(seed = 1) {
  let g;
  g = M.newGame(seed, { emit: (t, a, b) => t === "toss:hit" && M.touched(g, b) });
  return g;
}
const o = [0, 0];

test("cup toss: a toss aimed at any cup drops in and clears that cup alone", () => {
  const g = game();
  for (let c = 0; c < CUPS; c++) {
    M.resetGame(g, 1);
    M.aimAt(g, c, o);
    assert.ok(M.shoot(g, o[0], o[1], 0));
    M.run(g);
    assert.equal(g.phase, SHOWN);
    assert.equal(g.hit, c, `cup ${c}`);
    assert.equal(M.left(g), CUPS - 1);
    assert.equal(g.cup[c], 0);
    assert.equal(g.w.on[g.rim[c]], 0, "its rim is gone from the physics");
  }
});

test("cup toss: too soft lands short, too hard flies over, spin curves it both ways alike", () => {
  const g = game();
  M.aimAt(g, 4, o);
  M.shoot(g, 0, 0, 0);
  M.run(g);
  assert.equal(g.hit, -1);
  assert.equal(g.bounced, 1, "it bounced on the table");
  assert.ok(g.w.x[0] < 1.6, `short: ${g.w.x[0]}`);
  M.resetGame(g, 1);
  M.shoot(g, 0, 100, 0);
  M.run(g);
  assert.equal(g.hit, -1);
  assert.ok(g.w.x[0] > TX1, `over the end: ${g.w.x[0]}`);
  // Spin: the ball's side at the rack mirrors with the spin.
  const zAt = (spin) => {
    M.resetGame(g, 1);
    M.shoot(g, 0, 60, spin);
    while (g.phase === 1 && g.w.x[0] < 1.6) M.step(g, 1 / 60);
    return g.w.z[0];
  };
  const l = zAt(-10), r = zAt(10), n = zAt(0);
  assert.equal(n, 0);
  assert.ok(l > 0.03 && r < -0.03, `curves: ${l}, ${r}`);
  assert.equal(l, -r, "left and right mirror each other");
});

test("cup toss: a ball on a rim rattles (and may still go in or out)", () => {
  const g = game();
  let rims = 0;
  for (let lv = 48; lv <= 66; lv++)
    for (let a = -3; a <= 3; a += 3) {
      M.resetGame(g, 1);
      M.shoot(g, a, lv, 0);
      M.run(g);
      rims += g.rims;
    }
  assert.ok(rims > 5, `rim touches over a sweep of tosses: ${rims}`);
});

test("cup toss: re-racks at six and at three; a cleared rack ends it; so do twenty balls", () => {
  const g = game();
  const sink = () => {
    let c = 0;
    while (!g.cup[c]) c++;
    M.aimAt(g, c, o);
    M.shoot(g, o[0], o[1], 0);
    M.run(g);
    return g.hit === c;
  };
  for (let k = 0; k < 4; k++) {
    assert.ok(sink(), `toss ${k}`);
    assert.equal(M.reracks(g), k === 3, "a re-rack comes with the sixth cup left");
    assert.equal(M.next(g), AIM);
  }
  assert.equal(M.left(g), 6);
  assert.equal(g.racks, 1, "re-racked at six");
  // The six stand in a 3-2-1 from the apex.
  const xs = Array.from(g.cx).filter((_, c) => g.cup[c]).map((x) => Math.round((x - M.APEX) / M.ROW)).sort();
  assert.deepEqual(xs, [0, 1, 1, 2, 2, 2]);
  for (let k = 0; k < 3; k++) assert.ok(sink()), M.next(g);
  assert.equal(g.racks, 2, "re-racked at three");
  for (let k = 0; k < 3; k++) assert.ok(sink()), M.next(g);
  assert.equal(g.phase, OVER);
  assert.equal(M.left(g), 0);
  assert.equal(g.thrown, 10);
  assert.equal(M.stars(g), 3);
  assert.equal(g.best, 10);
  // Twenty misses: over.
  M.resetGame(g, 1);
  for (let k = 0; k < BALLS; k++) M.shoot(g, 0, 0, 0), M.run(g), M.next(g);
  assert.equal(g.phase, OVER);
  assert.equal(M.left(g), CUPS);
  assert.equal(M.stars(g), 0);
});

/** A game of seeded tosses near the rack; returns the steps. */
function play(g, seed) {
  M.resetGame(g, seed);
  let s = seed * 2654435761 >>> 0, n = 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
  while (g.phase !== OVER && n < 5000) {
    if (g.phase === AIM) M.shoot(g, Math.round((r() - 0.5) * 30), 48 + Math.round(r() * 18), Math.round((r() - 0.5) * 8)), (n += M.run(g));
    if (g.phase === SHOWN) M.next(g);
  }
  return n;
}

test("cup toss: the same tosses play the same game bit for bit", () => {
  const a = game(), b = game();
  for (let s = 1; s <= 6; s++) {
    play(a, s);
    play(b, s);
    assert.deepEqual([Array.from(a.cup), a.thrown, a.made, a.best, Array.from(a.cx), Array.from(a.w.x), Array.from(a.w.y), Array.from(a.w.z)], [Array.from(b.cup), b.thrown, b.made, b.best, Array.from(b.cx), Array.from(b.w.x), Array.from(b.w.y), Array.from(b.w.z)], `seed ${s}`);
  }
  assert.ok(a.made > 0, "random tosses near the rack make some");
});

test("cup toss: the game's own code (tosses, flight, cups, re-racks) allocates nothing", async () => {
  const g = game();
  const work = (n) => {
    for (let k = 0; k < n; k++) play(g, k + 1);
  };
  work(3);
  const n = await minorGCs(() => work(30));
  assert.ok(n <= 1, `young-generation GCs over 30 games: ${n}`);
});
