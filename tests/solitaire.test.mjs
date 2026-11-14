// Solitaire's game (site/gallery/pieces/solitaire/model.ts), Klondike on @fzlt/core/cards, headless:
// the deal (seeded; 1 to 7 cards a column, each top face up, 24 in the stock), the rules (foundations
// up by suit from the ace, columns down in alternating colours, kings into empty columns, runs move
// together, a card left face down turns up), draw 1 and draw 3 with the waste turning over, undo
// putting every card back exactly (through thousands of random changes), the safe auto-move, whole
// games played out by a simple player (some won, every card always somewhere), and whole games on a
// reused game allocating nothing (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/solitaire/model.ts");
const { STOCK, WASTE, NO, OK, WON } = M;
const C = (r, s) => s * 13 + r;
const piles = (g) => Array.from({ length: 13 }, (_, p) => Array.from({ length: g.k.count(p) }, (_, i) => g.k.at(p, i) * 2 + g.k.up[g.k.at(p, i)]));
/** Lay out a position by hand: [[pile, card, up], …] (the rest stay in the stock, face down). */
const lay = (g, list) => {
  g.k.reset();
  g.hn = 0;
  for (const [p, c, up] of list) g.k.move(c, p, -1, up);
};

test("solitaire: the deal: 1 to 7 a column, each top face up, 24 in the stock, seeded", () => {
  const g = M.newGame(9);
  for (let j = 0; j < 7; j++) {
    const p = M.tab(j), n = g.k.count(p);
    assert.equal(n, j + 1, `column ${j}`);
    for (let i = 0; i < n; i++) assert.equal(g.k.up[g.k.at(p, i)], i === n - 1 ? 1 : 0);
  }
  assert.deepEqual([g.k.count(STOCK), g.k.count(WASTE)], [24, 0]);
  assert.deepEqual(piles(M.newGame(9)), piles(g), "the same seed, the same deal");
  assert.notDeepEqual(piles(M.newGame(10)), piles(g));
});

test("solitaire: the rules: foundations by suit from the ace, columns down in alternating colours, kings to empty columns, runs together", () => {
  const g = M.newGame(1), T = M.tab, F = M.found;
  // Column 0: 7♠ (down), 9♦ (up), 8♣ (up); column 1: 10♣ up; column 2 empty; waste: A♥ then K♦.
  lay(g, [[T(0), C(6, 0), 0], [T(0), C(8, 3), 1], [T(0), C(7, 2), 1], [T(1), C(9, 2), 1], [WASTE, C(0, 1), 1], [WASTE, C(12, 3), 1]]);
  assert.equal(M.canPlace(g, C(12, 3), T(2)), true, "a king to an empty column");
  assert.equal(M.canPlace(g, C(7, 2), T(1)), false, "8♣ on 10♣: no");
  assert.equal(M.canPlace(g, C(8, 3), T(1)), true, "9♦ (with 8♣ on it) on 10♣");
  assert.equal(M.canPlace(g, C(0, 1), F(1)), false, "the ace is under the king");
  assert.equal(M.canPlace(g, C(6, 0), T(1)), false, "a face-down card does not move");
  assert.equal(M.move(g, C(8, 3), T(1)), OK);
  assert.deepEqual([g.k.count(T(1)), g.k.top(T(1)), g.k.up[C(6, 0)]], [3, C(7, 2), 1], "the run moved; 7♠ turned up");
  assert.equal(M.move(g, C(12, 3), T(2)), OK);
  assert.equal(M.canPlace(g, C(0, 1), F(0)), false, "the hearts ace goes to the hearts foundation only");
  assert.equal(M.move(g, C(0, 1), F(1)), OK);
  assert.equal(M.canPlace(g, C(6, 0), T(1)), false, "7♠ on 8♣: same colour");
  assert.equal(M.move(g, C(6, 0), T(2)), NO, "7♠ on K♦: no");
  assert.equal(M.target(g, C(6, 0)), -1);
  assert.equal(g.moves, 3);
});

test("solitaire: draw 1 and draw 3; the waste turns over when the stock runs out", () => {
  for (const d of [1, 3]) {
    const g = M.newGame(4, d), first = g.k.top(STOCK);
    assert.equal(M.draw(g), OK);
    assert.equal(g.k.count(WASTE), d);
    assert.equal(g.k.at(WASTE, 0), first, "the stock's top card is drawn first");
    while (g.k.count(STOCK)) M.draw(g);
    assert.equal(g.k.count(WASTE), 24);
    assert.equal(M.draw(g), OK, "turn the waste over");
    assert.deepEqual([g.k.count(STOCK), g.k.count(WASTE), g.k.top(STOCK), g.turns], [24, 0, first, 1], "the same order again");
    assert.ok([...Array(24)].every((_, i) => g.k.up[g.k.at(STOCK, i)] === 0), "face down");
  }
  const g = M.newGame(4);
  lay(g, []);
  while (g.k.count(STOCK)) g.k.move(g.k.top(STOCK), M.tab(0), -1, 1);
  assert.equal(M.draw(g), NO, "nothing to draw or turn");
});

test("solitaire: undo puts every card back exactly, through thousands of random changes", () => {
  for (const d of [1, 3]) {
    const g = M.newGame(77, d), seen = [piles(g)];
    let r = 5;
    const rnd = (n) => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0), Math.floor((r / 4294967296) * n));
    for (let step = 0; step < 3000; step++) {
      if (rnd(10) < 4 && g.hn) {
        M.undo(g);
        seen.pop();
        assert.deepEqual(piles(g), seen[seen.length - 1], `undo ${step}`);
        continue;
      }
      let did = false;
      for (let tries = 0; tries < 20 && !did; tries++) {
        const c = rnd(52), t = M.target(g, c);
        if (t >= 0) did = M.move(g, c, t) !== NO;
      }
      if (!did && M.draw(g) === NO) continue;
      seen.push(piles(g));
      assert.equal(g.hn, seen.length - 1);
    }
    while (g.hn) M.undo(g);
    assert.deepEqual(piles(g), seen[0], "back to the deal");
    assert.equal(g.moves, 0);
  }
});

test("solitaire: safe auto-moves: aces and twos, then a card only once both opposite colours are close", () => {
  const g = M.newGame(1), T = M.tab, F = M.found;
  lay(g, [[F(0), C(0, 0), 1], [F(0), C(1, 0), 1], [T(0), C(2, 0), 1], [T(1), C(0, 1), 1]]);
  assert.equal(M.safe(g), C(0, 1), "the hearts ace (3♠ is not safe yet)");
  M.move(g, C(0, 1), F(1));
  assert.equal(M.safe(g), -1, "3♠ waits: the red foundations are at 1 and 0");
  lay(g, [[F(0), C(0, 0), 1], [F(0), C(1, 0), 1], [F(1), C(0, 1), 1], [F(1), C(1, 1), 1], [F(3), C(0, 3), 1], [F(3), C(1, 3), 1], [T(0), C(2, 0), 1]]);
  assert.equal(M.safe(g), C(2, 0), "3♠ goes: both red foundations hold two");
});

/** A simple player: safe auto-moves, then foundations, then moves that turn a card or empty a column,
 *  then draw; it stops after three turns of the waste with nothing new. */
function play(g) {
  let idle = 0, last = -1;
  for (let step = 0; step < 2000; step++) {
    if (M.won(g)) return true;
    const s = M.safe(g);
    if (s >= 0) {
      M.move(g, s, M.found(Math.floor(s / 13)));
      continue;
    }
    let done = false;
    for (let p = 1; p < 13 && !done; p++) {
      if (M.isFound(p)) continue;
      const c = M.pick(g, p);
      if (c < 0) continue;
      const t = M.target(g, c), from = g.k.pile[c], under = g.k.pos[c] ? g.k.at(from, g.k.pos[c] - 1) : -1;
      // Worth it: to a foundation, from the waste, or it turns a card or empties a column.
      if (M.isFound(t) || from === WASTE || (M.isTab(from) && (under < 0 ? g.k.count(t) > 0 : !g.k.up[under]))) M.move(g, c, t), (done = true);
    }
    if (done) continue;
    if (g.turns !== last) (last = g.turns), (idle = 0);
    if (M.draw(g) === NO || (g.k.count(STOCK) === 0 && ++idle > 3)) return false;
  }
  return false;
}

test("solitaire: whole games play out: every card always somewhere, some won (draw 1 more than draw 3)", () => {
  let w1 = 0, w3 = 0;
  for (let s = 1; s <= 200; s++) {
    for (const d of [1, 3]) {
      const g = M.newGame(s, d), w = play(g);
      let n = 0;
      for (let p = 0; p < 13; p++) n += g.k.count(p);
      assert.equal(n, 52);
      if (w) {
        assert.equal(M.won(g), true);
        d === 1 ? w1++ : w3++;
      }
    }
  }
  assert.ok(w1 >= 10 && w1 > w3, `won: draw 1 ${w1}/200, draw 3 ${w3}/200`);
  // A solved game finishes itself.
  const g = M.newGame(1);
  for (let s = 2; !play(g); s++) M.newRound(g, s);
  assert.equal(M.won(g), true);
  assert.equal(M.move(g, g.k.top(M.found(0)), M.found(0)), NO);
});

test("solitaire: a won game: the last card to its foundation says so", () => {
  const g = M.newGame(1), F = M.found;
  lay(g, []);
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) if (!(s === 3 && r === 12)) g.k.move(C(r, s), F(s), -1, 1);
  g.k.move(C(12, 3), M.tab(0), -1, 1);
  assert.equal(M.solved(g), true);
  assert.equal(M.finish(g), C(12, 3));
  assert.equal(M.move(g, C(12, 3), F(3)), WON);
});

test("solitaire: whole games on a reused game allocate nothing", async () => {
  const g = M.newGame(1);
  const work = (n) => {
    for (let i = 0; i < n; i++) {
      M.newRound(g, i + 1);
      play(g);
      while (g.hn > 40) M.undo(g);
    }
  };
  work(20);
  globalThis.gc?.();
  const n = await minorGCs(() => work(200));
  assert.ok(n <= 1, `young-generation GCs over 200 games: ${n}`);
});
