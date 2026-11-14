// Darts' game (site/gallery/pieces/darts/model.ts), headless: the board scores like a real one (the
// beds in order, singles, doubles, trebles, 25 and the bull, nothing off the wire ring); a throw lands
// where the reticle was at the ideal power, low when soft, high when hard, sideways when crooked, and a
// dart on a wire bounces out; 501 rules (a bust puts the visit back, the last dart must be a double or
// the bull); the checkout table (every route adds up and ends on a double; the fewest darts; the bogey
// numbers have none); the bot always finishes, the same seed and throws play the same game bit for bit,
// and the game's code allocates nothing (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/darts/model.ts");
const { seeded } = await import("../src/kernel/random.ts");
const { AIM, VISIT, OVER, IDEAL, DROP, CROOK, START } = M;
const out = [0, 0, 0];

test("darts: the board: beds in order, singles, doubles, trebles, 25, the bull and off the board", () => {
  assert.equal(M.score(0, 0, out), 50);
  assert.deepEqual(out, [25, 2, 50]);
  assert.equal(M.score(0, -12, out), 25);
  assert.equal(M.score(0, 103, out), 60, "T20 straight up");
  assert.equal(M.score(0, 166, out), 40, "D20");
  assert.equal(M.score(0, 140, out), 20, "the fat single 20");
  assert.equal(M.score(0, -103, out), 9, "T3 straight down");
  assert.equal(M.score(140, 0, out), 6, "6 on the right");
  assert.equal(M.score(-103, 0, out), 33, "T11 on the left");
  assert.equal(M.score(0, 171, out), 0, "past the double: off the scoring area");
  assert.equal(out[1], 0);
  // Every bed's centre line, clockwise from the top, scores its own number.
  const order = [];
  for (let k = 0; k < 20; k++) {
    const a = (k * 18 * Math.PI) / 180;
    M.score(Math.sin(a) * 130, Math.cos(a) * 130, out);
    order.push(out[0]);
  }
  assert.deepEqual(order, Array.from(M.ORDER));
  // Just either side of the wire between 20 and 1 (9° clockwise from the top).
  const w = (9 * Math.PI) / 180;
  M.score(Math.sin(w - 0.01) * 130, Math.cos(w - 0.01) * 130, out);
  assert.equal(out[0], 20);
  M.score(Math.sin(w + 0.01) * 130, Math.cos(w + 0.01) * 130, out);
  assert.equal(out[0], 1);
  // The aim points of beds are inside them.
  for (const c of [M.code(20, 3), M.code(16, 2), M.code(25, 2), M.code(25, 1), M.code(7, 1), M.code(11, 3)]) {
    const p = M.bedAt(c, [0, 0]);
    M.score(p[0], p[1], out);
    assert.equal(M.code(out[0], out[1]), c, M.bedName(c));
  }
});

test("darts: a throw lands at the reticle at the ideal power, low when soft, high when hard, sideways when crooked", () => {
  const p = [0, 0];
  assert.deepEqual(M.land(0, 1030, IDEAL, 0, p), [0, 103]);
  M.land(0, 1030, IDEAL - 10, 0, p);
  assert.equal(p[1], 103 - 10 * DROP, "soft: low");
  M.land(0, 1030, IDEAL + 10, 0, p);
  assert.equal(p[1], 103 + 10 * DROP, "hard: high");
  M.land(0, 1030, IDEAL, 25, p);
  assert.equal(p[0], 25 * CROOK, "crooked: sideways");
  // On a wire it bounces out and scores nothing (the treble's inner wire, straight up).
  const g = M.newGame(1);
  assert.ok(M.throwDart(g, 0, 990, IDEAL, 0));
  assert.equal(g.out[0], 1, "bounced out");
  assert.equal(g.pts[0], 0);
  assert.equal(g.rem[0], START);
  assert.ok(M.wireGap(0, 103) > 3, "the middle of the treble is far from any wire");
});

test("darts: 501: three darts a visit, a bust puts it back, the last dart must be a double or the bull", () => {
  const g = M.newGame(1), T20 = [0, 1030], D20 = [0, 1660], BULL = [0, 0];
  for (let k = 0; k < 3; k++) M.throwDart(g, T20[0], T20[1], IDEAL, 0);
  assert.equal(g.phase, VISIT);
  assert.equal(g.rem[0], 321, "180");
  assert.equal(M.throwDart(g, 0, 0, IDEAL, 0), false, "no fourth dart");
  assert.equal(M.endVisit(g), AIM);
  assert.equal(g.turn, 1, "the bot's visit");
  assert.deepEqual(Array.from(g.log.slice(0, 8)), [0, 0, 0, 0, 0, 0, 0, 180]);
  // A bust: the bot on 50 hits T20; the visit goes back to 50.
  g.rem[1] = g.from[1] = 50;
  M.throwDart(g, T20[0], T20[1], IDEAL, 0);
  assert.equal(g.bust, 1);
  assert.equal(g.rem[1], 50);
  assert.equal(g.phase, VISIT);
  M.endVisit(g);
  assert.equal(g.log[15], -1, "a bust is logged as −1");
  // 1 left is a bust too; 0 on a single is a bust; 0 on the bull wins.
  M.resetGame(g, 1);
  g.rem[0] = g.from[0] = 41;
  M.throwDart(g, 0, 1400, IDEAL, 0);
  assert.equal(g.rem[0], 21);
  M.throwDart(g, 0, 1400, IDEAL, 0);
  assert.equal(g.bust, 1, "1 left: bust");
  assert.equal(g.rem[0], 41);
  M.resetGame(g, 1);
  g.rem[0] = g.from[0] = 20;
  M.throwDart(g, 0, 1400, IDEAL, 0);
  assert.equal(g.bust, 1, "0 on a single: bust");
  M.resetGame(g, 1);
  g.rem[0] = g.from[0] = 90;
  M.throwDart(g, D20[0], D20[1], IDEAL, 0);
  assert.equal(g.rem[0], 50);
  M.throwDart(g, BULL[0], BULL[1], IDEAL, 0);
  assert.equal(g.winner, 0, "the bull is a double: game shot");
  assert.equal(M.endVisit(g), OVER);
});

test("darts: checkouts: every route adds up and ends on a double, fewest darts first, none for the bogeys", () => {
  const val = (c) => (c >> 2) * (c & 3), r = [0, 0, 0];
  assert.equal(M.checkout(170, 3, r), 3);
  assert.deepEqual(r.map(M.bedName), ["T20", "T20", "BULL"]);
  assert.equal(M.checkout(100, 3, r), 2);
  assert.deepEqual(r.slice(0, 2).map(M.bedName), ["T20", "D20"]);
  assert.equal(M.checkout(32, 3, r), 1);
  assert.equal(M.bedName(r[0]), "D16");
  for (const b of [169, 168, 166, 165, 163, 162, 159]) assert.equal(M.checkout(b, 3, r), 0, `${b} has no checkout`);
  assert.equal(M.checkout(1, 3, r), 0);
  assert.equal(M.checkout(171, 3, r), 0);
  assert.equal(M.checkout(100, 1, r), 0, "100 needs two darts");
  for (let rem = 2; rem <= 170; rem++)
    for (let d = 1; d <= 3; d++) {
      const n = M.checkout(rem, d, r);
      if (!n) continue;
      assert.ok(n <= d);
      assert.equal(r.slice(0, n).reduce((a, c) => a + val(c), 0), rem, `${rem}: adds up`);
      assert.equal(r[n - 1] & 3, 2, `${rem}: ends on a double`);
      if (n > 1) assert.equal(M.checkout(rem, n - 1, [0, 0, 0]), 0, `${rem}: no shorter route`);
    }
});

/** A whole bot-vs-bot game on `g` (reused); returns the darts thrown. */
function botGame(g, seed, rnd, o) {
  M.resetGame(g, seed);
  let n = 0;
  while (g.phase !== OVER && n < 2000) {
    if (g.phase === AIM) M.botAim(g, rnd, o), M.throwDart(g, o[0], o[1], o[2], o[3]), n++;
    if (g.phase === VISIT) M.endVisit(g);
  }
  return n;
}

test("darts: the bot always finishes, and the same seed and throws play the same game bit for bit", () => {
  const g = M.newGame(1), o = new Float64Array(4);
  let darts = 0;
  for (let s = 1; s <= 40; s++) {
    darts += botGame(g, s, seeded(s), o);
    assert.equal(g.phase, OVER, `seed ${s}: over`);
    assert.equal(g.rem[g.winner], 0);
    assert.ok(g.rem[1 - g.winner] > 0);
  }
  assert.ok(darts / 40 < 140, `a bot game takes ${darts / 40} darts on average`);
  const a = M.newGame(1), b = M.newGame(1);
  botGame(a, 9, seeded(4), o);
  botGame(b, 9, seeded(4), o);
  assert.deepEqual([Array.from(a.rem), Array.from(a.log), Array.from(a.dx), Array.from(a.dy), Array.from(a.thrown)], [Array.from(b.rem), Array.from(b.log), Array.from(b.dx), Array.from(b.dy), Array.from(b.thrown)]);
});

test("darts: the game's own code (throws, scoring, visits, checkouts, the bot) allocates nothing", async () => {
  const g = M.newGame(1), rnd = seeded(3), o = new Float64Array(4), r = new Int16Array(3);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      botGame(g, k + 1, rnd, o);
      for (let s = 2; s <= 170; s += 7) M.checkout(s, 3, r);
    }
  };
  work(20);
  const n = await minorGCs(() => work(400));
  assert.ok(n <= 1, `young-generation GCs over 400 games: ${n}`);
});
