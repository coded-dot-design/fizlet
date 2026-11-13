// Gin Rummy's game (site/gallery/pieces/gin/model.ts) on @fzlt/core/cards, headless: the deal (ten
// each, one up, seeded; the dealer changes each hand), the best melds (sets, runs with the ace low, a
// card wanted by a set and a run goes where it saves the most), drawing and discarding (not the card
// just taken), knocking (10 or less) and gin, layoffs on the knocker's melds (none on gin), the
// scores (the difference, an undercut 25 + it, gin 25 + the deadwood), a dead hand at two cards,
// whole games to 100 between two bots, and whole games on a reused game allocating nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/gin/model.ts");
const { STOCK, DISCARD, YOU, BOT, DRAW, THROW, HAND_OVER, GAME_OVER, KNOCK, GIN, UNDERCUT, DEAD, NO, OK } = M;
const C = (r, s) => s * 13 + r; // r: 0 ace .. 12 king; s: 0 ♠ 1 ♥ 2 ♣ 3 ♦
/** Give `who` exactly these cards (the rest back in the stock), the discard's top `up`. */
const set = (g, pile, cards) => {
  while (g.k.count(pile)) g.k.move(g.k.top(pile), STOCK, 0, 0);
  for (const c of cards) g.k.move(c, pile, -1, pile === YOU ? 1 : 0);
};
const dead = (g, pile) => M.arrange(g.k, pile);

test("gin rummy: the deal: ten each, one up, seeded; you play first", () => {
  const g = M.newGame(3);
  assert.deepEqual([g.k.count(YOU), g.k.count(BOT), g.k.count(DISCARD), g.k.count(STOCK)], [10, 10, 1, 31]);
  assert.deepEqual([g.turn, g.dealer, g.phase], [0, 1, DRAW]);
  const a = Array.from({ length: 10 }, (_, i) => g.k.at(YOU, i));
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => M.newGame(3).k.at(YOU, i)), a, "the same seed, the same hand");
  assert.ok(Array.from({ length: 10 }, (_, i) => g.k.at(BOT, i)).every((c) => g.k.up[c] === 0), "the bot's cards face down");
});

test("gin rummy: melds: sets, runs (ace low), the best use of a shared card", () => {
  const g = M.newGame(1);
  // A♠ 2♠ 3♠ (run), 7♠ 7♥ 7♦ (set), K♣ Q♣ (deadwood 20), 9♥ (9), 4♦ (4): deadwood 33.
  set(g, YOU, [C(0, 0), C(1, 0), C(2, 0), C(6, 0), C(6, 1), C(6, 3), C(12, 2), C(11, 2), C(8, 1), C(3, 3)]);
  assert.equal(dead(g, YOU), 33);
  // 7♠ is wanted by the set and by the run 5♠ 6♠ 7♠ 8♠: the best keeps both melds (7♥ 7♦ 7♣ the set).
  set(g, YOU, [C(4, 0), C(5, 0), C(6, 0), C(7, 0), C(6, 1), C(6, 3), C(6, 2), C(12, 2), C(0, 1), C(1, 2)]);
  assert.equal(dead(g, YOU), 13, "K + A + 2 left");
  assert.equal(M.meldCount(), 2);
  // Q K A is not a run (the ace is low only).
  set(g, YOU, [C(11, 0), C(12, 0), C(0, 0)]);
  assert.equal(dead(g, YOU), 21);
  // Four of a kind is one meld; gin is zero.
  set(g, YOU, [C(3, 0), C(3, 1), C(3, 2), C(3, 3), C(8, 1), C(9, 1), C(10, 1), C(0, 2), C(1, 2), C(2, 2)]);
  assert.equal(dead(g, YOU), 0);
  const out = new Int8Array(52);
  M.arrange(g.k, YOU, -1, out);
  assert.equal(new Set([C(3, 0), C(3, 1), C(3, 2), C(3, 3)].map((c) => out[c])).size, 1, "the four together");
});

test("gin rummy: a turn: draw, then discard (not the card just taken); knock only at 10 or less", () => {
  const g = M.newGame(5);
  assert.equal(M.discard(g, g.k.at(YOU, 0)), NO, "draw first");
  const up = g.k.top(DISCARD);
  assert.equal(M.draw(g, true), OK);
  assert.deepEqual([g.k.pile[up], g.phase, g.took], [YOU, THROW, up]);
  assert.equal(M.discard(g, up), NO, "not the card just taken");
  assert.equal(M.draw(g, false), NO, "one draw a turn");
  const c = g.k.at(YOU, 0);
  if (M.deadwoodWithout(g, c) > 10) assert.equal(M.knock(g, c), NO, "too much deadwood to knock");
  assert.equal(M.discard(g, c), OK);
  assert.deepEqual([g.turn, g.phase, g.k.top(DISCARD), g.k.up[c]], [1, DRAW, c, 1]);
  assert.equal(M.botTurn(g) >= OK, true);
});

test("gin rummy: knock, layoffs and the scores; gin; an undercut", () => {
  let g;
  // A clean knock: rigged so the draw is a K♦ and the knock leaves 2.
  g = M.newGame(1);
  set(g, BOT, [C(3, 0), C(8, 3), C(8, 1), C(11, 1), C(12, 1), C(4, 2), C(5, 2), C(6, 2), C(0, 3), C(1, 3)]);
  set(g, YOU, [C(0, 0), C(1, 0), C(2, 0), C(3, 1), C(3, 2), C(3, 3), C(8, 2), C(9, 2), C(10, 2), C(1, 1)]);
  g.k.move(C(12, 3), STOCK, -1, 0);
  M.draw(g, false);
  assert.equal(M.canKnock(g, C(12, 3)), true);
  assert.equal(M.knock(g, C(12, 3)), OK);
  // Bot: melds 5♣6♣7♣; 4♠ lays off; left 9♦ 9♥ Q♥ K♥ A♦ 2♦ = 9 + 9 + 10 + 10 + 1 + 2 = 41.
  assert.deepEqual([g.end, g.scorer, g.dead[0], g.dead[1], g.points, g.score[0]], [KNOCK, 0, 2, 41, 39, 39]);
  assert.equal(g.k.up[C(12, 3)], 0, "the knock card face down");
  assert.ok([g.meld[C(0, 0)], g.meld[C(3, 1)]].includes(g.layoff[C(3, 0)]), "4♠ laid off (on the run or the set of fours)");
  assert.ok(g.meld[C(4, 2)] >= 4, "the bot's own run is its meld");
  assert.equal(g.phase, HAND_OVER);
  // Gin: 25 + the bot's deadwood (no layoffs).
  g = M.newGame(1);
  set(g, BOT, [C(3, 0), C(8, 3), C(8, 1), C(11, 1), C(12, 1), C(4, 2), C(5, 2), C(6, 2), C(0, 3), C(1, 3)]);
  set(g, YOU, [C(0, 0), C(1, 0), C(2, 0), C(3, 1), C(3, 2), C(3, 3), C(8, 2), C(9, 2), C(10, 2), C(12, 3)]);
  g.k.move(C(11, 2), STOCK, -1, 0);
  M.draw(g, false);
  assert.equal(M.knock(g, C(12, 3)), OK);
  assert.deepEqual([g.end, g.dead[1], g.points], [GIN, 45, 70], "4♠ stays: no layoffs on gin");
  // An undercut: you knock with 9, the bot has 5.
  g = M.newGame(1);
  set(g, BOT, [C(0, 1), C(1, 1), C(2, 1), C(5, 3), C(6, 3), C(7, 3), C(9, 0), C(9, 1), C(9, 3), C(4, 2)]);
  set(g, YOU, [C(0, 0), C(1, 0), C(2, 0), C(3, 1), C(3, 2), C(3, 3), C(8, 2), C(9, 2), C(10, 2), C(12, 3)]);
  g.k.move(C(8, 0), STOCK, -1, 0);
  M.draw(g, false);
  assert.equal(M.knock(g, C(12, 3)), OK);
  assert.deepEqual([g.end, g.scorer, g.dead[0], g.dead[1], g.points], [UNDERCUT, 1, 9, 5, 29]);
});

test("gin rummy: a stock down to two is a dead hand", () => {
  const g = M.newGame(2);
  while (g.k.count(STOCK) > 3) g.k.move(g.k.top(STOCK), DISCARD, 0, 1);
  M.draw(g, false);
  M.discard(g, g.k.at(YOU, 0));
  assert.deepEqual([g.phase, g.end, g.points, g.score[0] + g.score[1]], [HAND_OVER, DEAD, 0, 0]);
  M.newHand(g);
  assert.deepEqual([g.dealer, g.turn], [0, 1], "the dealer changes; the bot plays first");
});

/** Two bots, a whole game to 100. */
function game(g) {
  for (let t = 0; t < 4000 && g.phase !== GAME_OVER; t++) {
    if (g.phase === HAND_OVER) M.newHand(g);
    else M.botTurn(g);
  }
}

test("gin rummy: whole games to 100 between two bots: every card somewhere, scores add up", () => {
  let gins = 0, knocks = 0, unders = 0, deads = 0, hands = 0;
  for (let s = 1; s <= 30; s++) {
    const g = M.newGame(s);
    let total = 0;
    for (let t = 0; t < 4000 && g.phase !== GAME_OVER; t++) {
      if (g.phase === HAND_OVER) {
        hands++;
        total += g.points;
        g.end === GIN ? gins++ : g.end === KNOCK ? knocks++ : g.end === UNDERCUT ? unders++ : deads++;
        M.newHand(g);
      } else M.botTurn(g);
      let n = 0;
      for (let p = 0; p < 4; p++) n += g.k.count(p);
      assert.equal(n, 52);
    }
    total += g.points;
    assert.equal(g.phase, GAME_OVER, `game ${s} ends`);
    assert.equal(g.score[0] + g.score[1], total, "the scores are the hands' points");
    assert.ok(Math.max(g.score[0], g.score[1]) >= 100);
  }
  assert.ok(knocks > gins && gins > 0 && unders > 0, `hands ${hands}: knocks ${knocks}, gins ${gins}, undercuts ${unders}, dead ${deads}`);
});

test("gin rummy: whole games on a reused game allocate nothing", async () => {
  const g = M.newGame(1);
  const work = (n) => {
    for (let i = 0; i < n; i++) M.restart(g, i + 1), game(g);
  };
  work(3);
  globalThis.gc?.();
  const n = await minorGCs(() => work(40));
  assert.ok(n <= 1, `young-generation GCs over 40 games: ${n}`);
});
