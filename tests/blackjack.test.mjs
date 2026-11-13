// Blackjack's game (site/gallery/pieces/blackjack/model.ts) on @fzlt/core/cards, headless: hand
// totals (soft and hard aces), the deal (seeded: the same seed, the same shoe), naturals (3 to 2, the
// dealer's check under an ace or a ten, natural against natural pushes), hit, stand, bust, double,
// split (split aces take one card each; ace-ten after a split is 21, not blackjack), the dealer
// standing on all 17s, every chip accounted for over thousands of rounds played by basic strategy
// (and the house keeping a small edge), and whole sessions on a reused game allocating nothing
// (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/blackjack/model.ts");
const { SHOE, DEALER, HAND, HAND2, DISCARD, BET, PLAY, DEALER_TURN, DONE, WIN, LOSE, PUSH, NATURAL, BUST, NO, OK, END } = M;
/** Card of rank r (0 ace .. 12 king) in suit s. */
const C = (r, s = 0) => s * 13 + r;
/** Put these cards on top of the shoe so they come out in this order. */
const rig = (g, cards) => {
  for (let i = cards.length - 1; i >= 0; i--) g.k.move(cards[i], SHOE, -1, 0);
};
/** A game whose next round deals you a, b and the dealer up, hole, then the rest. */
const table = (you, dealer, rest = [], seed = 1) => {
  const g = M.newGame(seed);
  rig(g, [you[0], dealer[0], you[1], dealer[1], ...rest]);
  return g;
};
const cards = (g, p) => Array.from({ length: g.k.count(p) }, (_, i) => g.k.at(p, i));
const dealOut = (g) => {
  while (g.phase === DEALER_TURN) M.dealerStep(g);
};

test("blackjack: totals: aces soft then hard, faces ten", () => {
  const g = M.newGame(1), k = g.k;
  const hand = (...rs) => {
    while (k.count(HAND)) k.move(k.top(HAND), DISCARD);
    rs.forEach((r, i) => k.move(C(r, i % 4), HAND, -1, 1));
    return [M.total(k, HAND), M.soft(k, HAND)];
  };
  assert.deepEqual(hand(0, 12), [21, true], "ace king");
  assert.deepEqual(hand(0, 0, 8), [21, true], "ace ace nine");
  assert.deepEqual(hand(0, 5, 9), [17, false], "ace six ten: hard 17");
  assert.deepEqual(hand(0, 5), [17, true], "ace six: soft 17");
  assert.deepEqual(hand(0, 0, 0, 0), [14, true], "four aces");
  assert.deepEqual(hand(9, 10, 11), [30, false], "ten jack queen");
  assert.equal(M.value(C(12)), 10);
  assert.equal(M.value(C(0)), 1);
});

test("blackjack: the deal: seeded, two each, the hole card down, the bet off your chips", () => {
  const a = M.newGame(42), b = M.newGame(42), c = M.newGame(43);
  assert.deepEqual(cards(a, SHOE), cards(b, SHOE), "the same seed, the same shoe");
  assert.notDeepEqual(cards(a, SHOE), cards(c, SHOE), "another seed, another shoe");
  rig(a, [C(1), C(4), C(2), C(6)]); // no naturals
  assert.equal(M.deal(a), OK);
  assert.equal(a.phase, PLAY);
  assert.deepEqual(cards(a, HAND), [C(1), C(2)]);
  assert.deepEqual(cards(a, DEALER), [C(4), C(6)]);
  assert.deepEqual([a.k.up[C(4)], a.k.up[C(6)]], [1, 0], "up card up, hole card down");
  assert.equal(a.bank, 1000 - 20);
  assert.equal(a.k.count(SHOE), 48);
  assert.equal(M.deal(a), NO, "not while you play");
  assert.equal(M.setBet(a, 3), NO, "no bet change mid-round");
});

test("blackjack: naturals: 3 to 2, the dealer checks under an ace, natural against natural pushes", () => {
  let g = table([C(0), C(12)], [C(5), C(8)]);
  assert.equal(M.deal(g), END);
  assert.deepEqual([g.phase, g.result[0], g.bank], [DONE, NATURAL, 1000 + 30], "blackjack pays 3 to 2 on 20");
  g = table([C(9), C(8)], [C(0), C(11)]);
  assert.equal(M.deal(g), END, "the dealer's natural under an ace ends the round");
  assert.deepEqual([g.result[0], g.bank, g.k.up[C(11)]], [LOSE, 980, 1]);
  g = table([C(0), C(10)], [C(9), C(0, 1)]);
  assert.equal(M.deal(g), END);
  assert.deepEqual([g.result[0], g.bank], [PUSH, 1000], "natural against natural");
  g = table([C(9), C(8)], [C(9), C(7)]);
  assert.equal(M.deal(g), OK, "a ten up and no natural under it: play on");
});

test("blackjack: hit, bust, stand; the dealer stands on all 17s, soft 17 too", () => {
  let g = table([C(9), C(5)], [C(9, 1), C(6, 1)], [C(8, 2)]);
  M.deal(g);
  assert.equal(M.hit(g), OK);
  assert.deepEqual([M.total(g.k, HAND), g.result[0], g.phase], [25, BUST, DEALER_TURN], "16 + 9 busts");
  dealOut(g);
  assert.deepEqual([g.phase, g.result[0], g.bank, g.k.count(DEALER)], [DONE, BUST, 980, 2], "nothing to play to: the dealer takes no card");
  // Soft 17: the dealer stands.
  g = table([C(9), C(7)], [C(0), C(5)]);
  M.deal(g);
  M.stand(g);
  dealOut(g);
  assert.deepEqual([M.total(g.k, DEALER), g.k.count(DEALER), g.result[0]], [17, 2, WIN], "18 beats a soft 17 the dealer stands on");
  // 16 hits; the dealer busts.
  g = table([C(9), C(7)], [C(9, 1), C(5, 1)], [C(9, 2)]);
  M.deal(g);
  M.stand(g);
  dealOut(g);
  assert.deepEqual([M.total(g.k, DEALER), g.result[0], g.bank], [26, WIN, 1020]);
  // A push.
  g = table([C(9), C(7)], [C(9, 1), C(3, 1)], [C(3, 2)]);
  M.deal(g);
  M.stand(g);
  dealOut(g);
  assert.deepEqual([M.total(g.k, DEALER), g.result[0], g.bank], [18, PUSH, 1000]);
  // A hit to 21 stands by itself.
  g = table([C(4), C(5)], [C(9), C(7)], [C(9, 1)]);
  M.deal(g);
  M.hit(g);
  assert.equal(g.phase, DEALER_TURN, "21 plays itself");
});

test("blackjack: double: twice the bet, one card, then the dealer", () => {
  const g = table([C(4), C(5)], [C(9), C(5, 1)], [C(9, 1), C(8, 1)]);
  M.deal(g);
  assert.equal(M.canDouble(g), true);
  assert.equal(M.double(g), OK);
  assert.deepEqual([g.bet[0], g.bank, g.k.count(HAND), g.phase], [40, 960, 3, DEALER_TURN]);
  dealOut(g);
  assert.deepEqual([M.total(g.k, HAND), M.total(g.k, DEALER), g.result[0], g.bank, M.net(g)], [21, 25, WIN, 1040, 40], "11 + a ten: 21 against 16 + 9");
  assert.equal(M.double(g), NO, "not after the round");
});

test("blackjack: split: two hands, a bet each; split aces take one card; ace-ten after a split is 21", () => {
  let g = table([C(7), C(7, 1)], [C(9), C(6)], [C(2), C(9, 2), C(9, 3)]);
  M.deal(g);
  assert.equal(M.canSplit(g), true);
  assert.equal(M.split(g), OK);
  assert.deepEqual([g.hands, g.bet[0], g.bet[1], g.bank], [2, 20, 20, 960]);
  assert.deepEqual([cards(g, HAND), cards(g, HAND2)], [[C(7), C(2)], [C(7, 1), C(9, 2)]], "each took a card");
  assert.equal(g.active, 0);
  assert.equal(M.canSplit(g), false, "once");
  M.double(g); // 8 + 3 + 10 = 21: doubles after a split
  assert.deepEqual([g.active, g.bet[0], M.total(g.k, HAND)], [1, 40, 21]);
  M.stand(g); // 8 + 10 = 18
  dealOut(g); // dealer 16 + nothing left rigged: draws from the shuffle
  const d = M.total(g.k, DEALER);
  assert.equal(g.phase, DONE);
  assert.ok(d >= 17);
  // Split aces.
  g = table([C(0), C(0, 1)], [C(9), C(7)], [C(12), C(4)]);
  M.deal(g);
  M.split(g);
  assert.deepEqual([g.aces, g.phase, M.total(g.k, HAND), M.total(g.k, HAND2)], [true, DEALER_TURN, 21, 16], "one card each, then the dealer");
  assert.equal(M.hit(g), NO);
  dealOut(g);
  assert.deepEqual([g.result[0], g.result[1], g.paid[0]], [WIN, LOSE, 40], "ace-king after a split pays 1 to 1, not 3 to 2");
  // Not enough chips to split.
  g = table([C(7), C(7, 1)], [C(9), C(6)]);
  M.setBet(g, 3);
  g.bank = 150;
  M.deal(g);
  assert.equal(M.canSplit(g), false, "50 chips left: no split of a 100 bet");
});

test("blackjack: rounds: collect, reshuffle when the shoe runs low, chips run out", () => {
  const g = M.newGame(5);
  for (let r = 0; r < 40; r++) {
    M.deal(g);
    while (g.phase === PLAY) M.stand(g);
    dealOut(g);
    let n = 0;
    for (let p = 0; p <= DISCARD; p++) n += g.k.count(p);
    assert.equal(n, 52, "every card somewhere");
  }
  assert.ok(g.shuffles > 3, `reshuffled: ${g.shuffles}`);
  M.collect(g);
  assert.deepEqual([g.phase, g.k.count(DEALER), g.k.count(HAND)], [BET, 0, 0]);
  g.bank = 5;
  assert.equal(M.broke(g), true);
  assert.equal(M.deal(g), NO);
  M.reset(g, 5);
  assert.deepEqual([g.bank, g.k.count(SHOE)], [1000, 52]);
});

/** Basic strategy (a short form): split aces and eights, double 10 and 11 against less, hit to 17
 *  against a 7 or more and to 12 against the rest, soft hands to 18. */
function playBasic(g) {
  const up = M.value(g.k.at(DEALER, 0)), u = up === 1 ? 11 : up;
  if (M.canSplit(g)) {
    const v = M.value(g.k.at(HAND, 0));
    if (v === 1 || v === 8) M.split(g);
  }
  while (g.phase === PLAY) {
    const p = M.pileOf(g.active), t = M.total(g.k, p), s = M.soft(g.k, p);
    if (M.canDouble(g) && (t === 11 || (t === 10 && u < 10)) && !s) M.double(g);
    else if (s ? t < 18 : t < (u >= 7 ? 17 : 12)) M.hit(g);
    else M.stand(g);
  }
  dealOut(g);
}

test("blackjack: thousands of rounds by basic strategy: every chip accounted for, a small house edge", () => {
  let wagered = 0, won = 0, naturals = 0, splits = 0, doubles = 0;
  for (let s = 1; s <= 20; s++) {
    const g = M.newGame(s);
    for (let r = 0; r < 500; r++) {
      M.setBet(g, 1);
      if (!M.canDeal(g)) M.reset(g, s * 1000 + r), M.setBet(g, 1);
      const before = g.bank;
      M.deal(g);
      playBasic(g);
      assert.equal(g.phase, DONE);
      for (let h = 0; h < g.hands; h++) wagered += g.bet[h];
      won += M.net(g);
      assert.equal(g.bank, before + M.net(g), "chips: before + net");
      if (g.result[0] === NATURAL) naturals++;
      if (g.hands === 2) splits++;
      if (g.doubled[0]) doubles++;
    }
  }
  const edge = won / wagered;
  assert.ok(edge > -0.06 && edge < 0.03, `the edge: ${(edge * 100).toFixed(2)}% of ${wagered} wagered`);
  assert.ok(naturals > 300 && naturals < 600, `naturals in 10,000 rounds: ${naturals}`);
  assert.ok(splits > 50 && doubles > 500, `splits ${splits}, doubles ${doubles}`);
});

test("blackjack: whole sessions on a reused game allocate nothing", async () => {
  const g = M.newGame(1);
  const work = (n) => {
    for (let r = 0; r < n; r++) {
      if (!M.canDeal(g)) M.reset(g, r);
      M.deal(g);
      playBasic(g);
    }
  };
  work(500);
  globalThis.gc?.();
  const n = await minorGCs(() => work(20000));
  assert.ok(n <= 1, `young-generation GCs over 20,000 rounds: ${n}`);
});
