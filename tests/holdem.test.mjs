// Hold'em's game (site/gallery/pieces/holdem/model.ts) on @fzlt/core/cards, headless: hand ranking
// (every category in order, kickers, the wheel, the best five of seven, names), the deal (blinds,
// two cards each, seeded; heads-up the button posts the small blind), the betting (check around,
// the least raise, a short all-in that does not reopen raising, folding to one), side pots with
// three stacks all in, splits, chips kept over hundreds of hands among four bots, and whole games
// on a reused table allocating nothing (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/holdem/model.ts");
const { DECK, BOARD, HOLE, PRE, FLOP, TURN, RIVER, PAID, OVER, FOLD, CALL, RAISE, OK, NO } = M;
/** A card from "As", "Td", "9h": rank then suit (s h c d). */
const C = (t) => "shcd".indexOf(t[1]) * 13 + "A23456789TJQK".indexOf(t[0]);
const R = (...t) => M.rank5(...t.map(C));
const chips = (g) => g.stack.reduce((a, b) => a + b, 0) + g.bet.reduce((a, b) => a + b, 0) + g.pot;

test("hold'em: ranking: every category in order, kickers, the wheel", () => {
  const order = [
    R("2s", "5h", "9c", "Jd", "Kh"), R("2s", "2h", "9c", "Jd", "Kh"), R("2s", "2h", "9c", "9d", "Kh"), R("2s", "2h", "2c", "Jd", "Kh"),
    R("As", "2h", "3c", "4d", "5h"), R("6s", "7h", "8c", "9d", "Th"), R("2h", "5h", "9h", "Jh", "Kh"), R("2s", "2h", "2c", "Kd", "Kh"),
    R("2s", "2h", "2c", "2d", "Kh"), R("As", "2s", "3s", "4s", "5s"), R("Ts", "Js", "Qs", "Ks", "As"),
  ];
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `category ${i} beats ${i - 1}`);
  assert.ok(R("As", "Ah", "Kc", "4d", "3h") > R("As", "Ah", "Qc", "Jd", "Th"), "kicker: K beats Q J T");
  assert.ok(R("Ks", "Kh", "7c", "7d", "2h") > R("Ks", "Kh", "6c", "6d", "Ah"), "two pair: the second pair before the kicker");
  assert.equal(R("As", "2h", "3c", "4d", "5h"), R("Ad", "2c", "3h", "4s", "5c"), "suits never matter outside a flush");
  assert.ok(R("2s", "3h", "4c", "5d", "6h") > R("As", "2h", "3c", "4d", "5h"), "the wheel is the lowest straight");
  assert.equal(M.name(R("Ks", "Kh", "7c", "7d", "2h")), "Two pair, kings and sevens");
  assert.equal(M.name(R("Ts", "Js", "Qs", "Ks", "As")), "Royal flush");
  assert.equal(M.name(R("2s", "2h", "2c", "Kd", "Kh")), "Full house, twos full of kings");
  assert.equal(M.name(R("As", "2h", "3c", "4d", "5h")), "Straight, five high");
});

/** Deal a hand and then set the hole cards and the deck's next cards (burns included). */
function rig(g, holes, rest) {
  for (let s = 0; s < 4; s++) if (holes[s]) for (let i = 0; i < 2; i++) {
    const c = C(holes[s][i]);
    // Swap: the card wherever it is goes to the hole, the hole's card goes where it was.
    const cur = g.k.at(HOLE + s, i), p = g.k.pile[c], at = g.k.pos[c];
    g.k.move(c, HOLE + s, i, s === 0 ? 1 : 0);
    g.k.move(cur, p, at, 0);
    if (g.k.at(HOLE + s, i + 1) === cur) g.k.move(cur, p, at, 0);
  }
  for (let i = rest.length - 1; i >= 0; i--) g.k.move(C(rest[i]), DECK, -1, 0);
}

test("hold'em: the deal: blinds, two cards each, the first to act; seeded", () => {
  const g = M.newGame(7);
  const sb = M.next(g, g.button), bb = M.next(g, sb);
  assert.deepEqual([g.phase, g.bet[sb], g.bet[bb], g.price, g.toAct], [PRE, 10, 20, 20, M.next(g, bb)]);
  for (let s = 0; s < 4; s++) assert.equal(g.k.count(HOLE + s), 2);
  assert.equal(g.k.count(DECK), 44);
  assert.equal(chips(g), 4000);
  const h = M.newGame(7);
  assert.deepEqual([h.k.at(HOLE, 0), h.k.at(HOLE, 1), h.button], [g.k.at(HOLE, 0), g.k.at(HOLE, 1), g.button], "the same seed, the same table");
});

test("hold'em: betting: check around to the river, the least raise, folding to one", () => {
  const g = M.newGame(3);
  // Everyone calls, the big blind checks: the flop.
  while (g.phase === PRE) M.act(g, CALL);
  assert.deepEqual([g.phase, g.pot, g.k.count(BOARD), g.k.count(6)], [FLOP, 80, 3, 1], "the flop, a card burned");
  assert.equal(g.toAct, M.next(g, g.button, true), "first after the button acts");
  const s = g.toAct;
  assert.equal(M.minRaiseTo(g, s), 20, "the least raise is the big blind");
  assert.equal(M.act(g, RAISE, 10), OK);
  assert.equal(g.bet[s], 20, "a raise below the least is lifted to it");
  const t = g.toAct;
  M.act(g, RAISE, 60);
  assert.equal(g.minRaise, 40, "the last raise sets the least next one");
  assert.equal(M.minRaiseTo(g, g.toAct), 100);
  // The rest fold to the raiser: it takes the pot.
  while (g.phase === FLOP) M.act(g, FOLD);
  assert.equal(g.phase, PAID);
  assert.equal(g.won[t], 80 + 20 + 60);
  assert.equal(chips(g), 4000);
});

test("hold'em: a short all-in raises the price but does not reopen raising", () => {
  const g = M.newGame(11);
  const a = g.toAct;
  M.act(g, RAISE, 100); // a raises to 100
  const b = g.toAct;
  g.stack[b] = 130; // b has 130: all in for 130 is a raise of 30 (short)
  M.act(g, RAISE, 500);
  assert.equal(g.bet[b], 130);
  assert.deepEqual([g.price, g.minRaise, g.allin[b]], [130, 80, 1]);
  while (g.toAct !== a) M.act(g, FOLD);
  assert.equal(M.canRaise(g, a), false, "a already acted and nobody fully raised: call or fold only");
  assert.equal(M.act(g, RAISE, 400), NO);
  assert.equal(M.act(g, CALL), OK);
});

test("hold'em: side pots: three stacks all in; the best hand in each pot takes it", () => {
  const g = M.newGame(5);
  // Stacks before the hand: you 100, seat 1 300, seat 2 600, seat 3 1000.
  g.phase = PAID;
  g.stack.set([100, 300, 600, 1000]);
  g.button = 3;
  M.deal(g);
  // You: aces (best); seat 1: kings; seat 2: queens; seat 3: 7 2. Board: 2c 5d 9h Jc 3s (+ burns).
  rig(g, [["As", "Ah"], ["Ks", "Kh"], ["Qs", "Qh"], ["7s", "2d"]], ["4c", "2c", "5d", "9h", "4d", "Jc", "4h", "3s"]);
  const total = chips(g);
  for (let i = 0; i < 12 && g.phase === PRE; i++) M.act(g, g.toAct === 3 ? CALL : RAISE, 10000);
  while (g.phase !== PAID && g.phase !== OVER) M.act(g, CALL);
  assert.equal(chips(g), total, "chips kept");
  // Main pot 400 (100 × 4) to you; side 1: 200 × 3 = 600 to kings; side 2: 300 × 2 = 600 to queens.
  assert.deepEqual([g.won[0], g.won[1], g.won[2], g.won[3]], [400, 600, 600, 0]);
  assert.equal(g.pots, 3);
  assert.equal(M.name(g.score[0]), "Pair of aces");
  const five = Array.from(g.best.slice(0, 5));
  assert.ok(five.includes(C("As")) && five.includes(C("Ah")) && five.includes(C("Jc")), "the best five shown");
});

test("hold'em: a split pot shares the chips", () => {
  const g = M.newGame(9);
  rig(g, [["2s", "3h"], ["2d", "3c"], ["7s", "8d"], ["7h", "8c"]], ["Kc", "Ac", "Kd", "Qh", "Kh", "Jd", "Ks", "Th"]);
  while (g.phase !== PAID) M.act(g, CALL);
  // The board makes broadway for all four: everyone splits 80.
  assert.deepEqual(Array.from(g.won), [20, 20, 20, 20]);
});

test("hold'em: heads-up: the button posts the small blind and acts first before the flop", () => {
  const g = M.newGame(4);
  g.phase = PAID;
  g.out.set([0, 1, 0, 1]);
  g.stack.set([1000, 0, 1000, 0]);
  M.deal(g);
  assert.equal(g.bet[g.button], 10);
  assert.equal(g.toAct, g.button);
  assert.equal(g.k.count(HOLE + 1), 0, "the seats out get no cards");
});

test("hold'em: hundreds of hands among four bots: chips kept, games end, bots fold, call and raise", () => {
  const did = new Int32Array(8);
  for (let s = 1; s <= 12; s++) {
    const g = M.newGame(s);
    for (let h = 0; h < 400 && g.phase !== OVER; h++) {
      if (g.phase === PAID) M.deal(g);
      while (g.toAct >= 0) {
        M.botAct(g);
        for (let t = 0; t < 4; t++) did[g.last[t]]++;
        assert.equal(chips(g), 4000);
      }
      let n = 0;
      for (let p = 0; p < 7; p++) n += g.k.count(p);
      assert.equal(n, 52);
    }
  }
  assert.ok(did[1] && did[2] && did[3] && did[4], `fold ${did[1]}, check ${did[2]}, call ${did[3]}, raise ${did[4]}, all in ${did[5]}`);
});

test("hold'em: whole games on a reused table allocate nothing", async () => {
  const g = M.newGame(1);
  const work = (n) => {
    for (let i = 0; i < n; i++) {
      M.restart(g, i + 1);
      for (let h = 0; h < 200 && g.phase !== OVER; h++) {
        if (g.phase === PAID) M.deal(g);
        while (g.toAct >= 0) M.botAct(g);
      }
    }
  };
  work(3);
  globalThis.gc?.();
  const n = await minorGCs(() => work(30));
  assert.ok(n <= 1, `young-generation GCs over 30 games: ${n}`);
});
