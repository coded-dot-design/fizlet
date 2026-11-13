// Flip Match's game: a memory game on @fzlt/core/cards, pure and seeded. No DOM, no clock, no
// renderer, no allocation once a game exists (`newRound` reuses it). Sixteen cards, eight pairs (card
// c shows face c >> 1); pile 0 is the deck, piles 1..16 the grid's cells, pile 17 your pile. The
// deck is shuffled from the seed (cards' Fisher-Yates: the same seed, the same table everywhere)
// and dealt one card a cell, face down. Turn two over: a pair goes to your pile, face up; two that
// differ turn back down when `settle` is called. Tests: tests/flip-match.test.mjs.
import { deck, type Deck } from "../../../../src/cards";

/** Cards, pairs, the grid (columns × rows), and the piles: deck, the cells, yours. */
export const CARDS = 16, PAIRS = 8, COLS = 4, ROWS = 4, DECK = 0, PILE = 17;
/** What a flip did: refused, first card up, a pair, a miss (both stay up until `settle`). */
export const NO = 0, ONE = 1, PAIR = 2, MISS = 3;

export interface Game {
  k: Deck;
  seed: number;
  /** The cards turned up this go (−1: none), moves (pairs of flips), pairs found, misses. */
  a: number;
  b: number;
  moves: number;
  found: number;
  misses: number;
  /** Per card: 1 once it has been seen face up (for a bot or a hint; the tests' perfect player). */
  seen: Uint8Array;
}

/** The cells' piles, 1..16, as one array for `deal`. */
const CELLS = Uint8Array.from({ length: CARDS }, (_, i) => i + 1);

/** A new game, dealt from `seed`. */
export function newGame(seed: number): Game {
  const g: Game = { k: deck({ size: CARDS, piles: CARDS + 2 }), seed: 0, a: -1, b: -1, moves: 0, found: 0, misses: 0, seen: new Uint8Array(CARDS) };
  return newRound(g, seed);
}
/** Every card back to the deck in order, shuffled from `seed` and dealt (in place; no allocation). */
export function newRound(g: Game, seed: number) {
  const k = g.k;
  g.seed = seed >>> 0;
  k.reset();
  k.shuffle(DECK, g.seed);
  k.deal(DECK, CELLS, 1, 0);
  g.a = g.b = -1;
  g.moves = g.found = g.misses = 0;
  g.seen.fill(0);
  return g;
}
/** The card in cell i (0..15), or −1 once its pair is taken. */
export const cardAt = (g: Game, i: number) => g.k.top(i + 1);
/** The face card c shows (0..7). */
export const face = (c: number) => c >> 1;
/** All pairs found. */
export const done = (g: Game) => g.found === PAIRS;

/** Turn over the card in cell i. NO: empty cell, already up, or two are up (call `settle`). */
export function flip(g: Game, i: number) {
  const c = cardAt(g, i);
  if (c < 0 || g.b >= 0 || g.k.up[c]) return NO;
  g.k.flip(c, 1);
  g.seen[c] = 1;
  if (g.a < 0) return (g.a = c), ONE;
  g.b = c;
  g.moves++;
  if (face(g.a) !== face(c)) return g.misses++, MISS;
  return PAIR;
}
/** Finish the go: a pair goes to your pile (face up), a miss turns back down. Returns what it was. */
export function settle(g: Game) {
  if (g.b < 0) return NO;
  const pair = face(g.a) === face(g.b);
  if (pair) g.k.move(g.a, PILE, -1, 1), g.k.move(g.b, PILE, -1, 1), g.found++;
  else g.k.flip(g.a, 0), g.k.flip(g.b, 0);
  g.a = g.b = -1;
  return pair ? PAIR : MISS;
}
/** The cell (0..15) card c lies in, or −1. */
export const cellOf = (g: Game, c: number) => (g.k.pile[c]! >= 1 && g.k.pile[c]! <= CARDS ? g.k.pile[c]! - 1 : -1);
