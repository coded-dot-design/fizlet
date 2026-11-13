// Flip Match's game (site/gallery/pieces/flip/model.ts) on @fzlt/core/cards, headless: the deal puts
// one card face down in each of the sixteen cells, eight pairs, from a seeded shuffle (the same seed,
// the same table; another seed, another); a flip is refused on an empty cell, a card already up or
// while two are up; a pair goes to your pile face up, a miss turns back down; a perfect memory clears
// the table in 8 moves, a forgetful player in more; and whole games on a reused game allocate nothing
// (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/flip/model.ts");
const { NO, ONE, PAIR, MISS, PILE, CARDS } = M;
const table = (g) => Array.from({ length: CARDS }, (_, i) => M.cardAt(g, i));

test("flip match: the deal: a card a cell, face down, eight pairs, seeded", () => {
  const g = M.newGame(7), t = table(g);
  assert.equal(new Set(t).size, 16, "every card once");
  assert.ok(t.every((c) => c >= 0 && g.k.up[c] === 0), "face down");
  for (let i = 0; i < CARDS; i++) assert.equal(g.k.count(i + 1), 1, `cell ${i} holds one card`);
  assert.equal(g.k.count(0), 0, "the deck is dealt out");
  const faces = t.map(M.face).sort();
  assert.deepEqual(faces, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  assert.deepEqual(table(M.newGame(7)), t, "the same seed, the same table");
  assert.notDeepEqual(table(M.newGame(8)), t, "another seed, another table");
  // A new round on the same game: gathered from wherever they are and dealt again.
  M.flip(g, 0);
  M.newRound(g, 7);
  assert.deepEqual(table(g), t);
  assert.equal(g.a, -1);
});

test("flip match: flips, refusals, a miss turns back, a pair goes to your pile", () => {
  const g = M.newGame(3), t = table(g);
  const i = 0, j = t.findIndex((c, k) => k > 0 && M.face(c) === M.face(t[0])), x = t.findIndex((c, k) => k > 0 && M.face(c) !== M.face(t[0]));
  assert.equal(M.flip(g, i), ONE);
  assert.equal(M.flip(g, i), NO, "already up");
  assert.equal(M.flip(g, x), MISS);
  assert.equal(g.moves, 1);
  assert.equal(M.flip(g, j), NO, "two are up: settle first");
  assert.equal(M.settle(g), MISS);
  assert.equal(g.k.up[t[i]] + g.k.up[t[x]], 0, "both back down");
  assert.equal(M.flip(g, i), ONE);
  assert.equal(M.flip(g, j), PAIR);
  assert.equal(M.settle(g), PAIR);
  assert.deepEqual([g.k.pile[t[i]], g.k.pile[t[j]], g.k.up[t[i]], g.k.up[t[j]]], [PILE, PILE, 1, 1], "to your pile, face up");
  assert.equal(M.cardAt(g, i), -1, "the cell is empty");
  assert.equal(M.flip(g, i), NO, "nothing to turn there");
  assert.deepEqual([g.moves, g.found, g.misses], [2, 1, 1]);
  assert.equal(M.settle(g), NO, "nothing up");
});

/** A player who remembers every card it saw (or, `forget`, none: it turns two at random): returns
 *  the moves to clear the table. */
function play(g, forget) {
  const known = new Int8Array(16).fill(-1);
  let r = g.seed;
  const rnd = (n) => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0), Math.floor((r / 4294967296) * n));
  const any = (not) => {
    for (;;) {
      const i = rnd(16);
      if (i !== not && M.cardAt(g, i) >= 0 && (forget || known[i] < 0 || M.done(g))) return i;
    }
  };
  while (!M.done(g) && g.moves < 1000) {
    let a = -1, b = -1;
    if (!forget)
      for (let i = 0; i < 16 && a < 0; i++)
        for (let j = i + 1; j < 16; j++)
          if (known[i] >= 0 && known[i] === known[j] && M.cardAt(g, i) >= 0) {
            (a = i), (b = j);
            break;
          }
    if (a < 0) {
      a = any(-1);
      M.flip(g, a);
      known[a] = M.face(M.cardAt(g, a));
      if (!forget) for (let j = 0; j < 16 && b < 0; j++) if (j !== a && known[j] === known[a] && M.cardAt(g, j) >= 0) b = j;
      if (b < 0) b = any(a);
      M.flip(g, b);
      known[b] = M.face(M.cardAt(g, b));
    } else M.flip(g, a), M.flip(g, b);
    M.settle(g);
  }
  return g.moves;
}

test("flip match: a good memory clears the table in few moves, no memory in many", () => {
  let good = 0, none = 0;
  for (let s = 1; s <= 50; s++) {
    good += play(M.newGame(s), false);
    const g = M.newGame(s);
    none += play(g, true);
    assert.equal(g.found, 8);
    assert.equal(g.k.count(PILE), 16, "every card in your pile");
  }
  assert.ok(good / 50 >= 8 && good / 50 < 14, `a good memory: ${good / 50} moves a game`);
  assert.ok(none / 50 > good / 50 + 3, `no memory: ${none / 50} moves a game`);
});

test("flip match: whole games (deal, flips, misses, pairs) allocate nothing", async () => {
  const g = M.newGame(1);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      M.newRound(g, k + 1);
      // Sweep: turn cells two at a time, settle, until done (misses and pairs both).
      for (let r = 0; !M.done(g) && r < 400; r++) {
        let a = -1, b = -1;
        for (let i = (r * 5) % 16, n2 = 0; n2 < 16 && b < 0; i = (i + 1) % 16, n2++) if (M.cardAt(g, i) >= 0) a < 0 ? (a = i) : (b = i);
        M.flip(g, a);
        if (b >= 0) M.flip(g, b);
        M.settle(g);
      }
    }
  };
  work(200);
  globalThis.gc?.();
  const n = await minorGCs(() => work(5000));
  assert.ok(n <= 1, `young-generation GCs over 5,000 games: ${n}`);
});
