// Solitaire's game: Klondike on @fzlt/core/cards, pure and seeded. No DOM, no clock, no renderer, no
// allocation once a game exists. The piles: the stock (0), the waste (1), the four foundations (2..5,
// one a suit: spades, hearts, clubs, diamonds, built up from the ace) and the seven tableau columns
// (6..12, dealt 1 to 7 cards, the top one face up; built down in alternating colours, a king or a
// run headed by one into an empty column). Draw 1 or 3 from the stock; when it runs out, the waste
// turns over to make it again (no limit). Every change goes on an undo list. `safe` names a card that
// can go up to its foundation without ever being needed below (aces and twos, or a card whose two
// opposite-colour foundations are no more than one behind it): the view plays those by itself.
// Tests: tests/solitaire.test.mjs.
import { deck, type Deck } from "../../../../src/cards";

export const STOCK = 0, WASTE = 1, FOUND = 2, TAB = 6, PILES = 13;
/** What an action did. */
export const NO = 0, OK = 1, WON = 2;
const MOVE = 1, DRAW = 2, TURN = 3, CAP = 4096;

export interface Game {
  k: Deck;
  seed: number;
  /** Cards a draw turns (1 or 3). */
  draw: number;
  /** Moves made (draws and turns included; an undo takes one back), times the waste was turned. */
  moves: number;
  turns: number;
  /** The undo list: [kind, from, to, n | flipped << 8] per entry. */
  hist: Int32Array;
  hn: number;
}

const suit = (c: number) => (c / 13) | 0, rank = (c: number) => c % 13, red = (c: number) => suit(c) & 1;
/** Tableau column j's pile, and foundation s's. */
export const tab = (j: number) => TAB + j;
export const found = (s: number) => FOUND + s;
export const isTab = (p: number) => p >= TAB && p < TAB + 7;
export const isFound = (p: number) => p >= FOUND && p < TAB;

/** A new game dealt from `seed`, drawing `draw` (1 or 3). */
export function newGame(seed: number, draw = 1): Game {
  const g: Game = { k: deck({ size: 52, piles: PILES }), seed: 0, draw, moves: 0, turns: 0, hist: new Int32Array(CAP * 4), hn: 0 };
  return newRound(g, seed);
}
/** Every card back, shuffled from `seed`, dealt: column j gets j + 1 cards, its top one face up. */
export function newRound(g: Game, seed: number) {
  const k = g.k;
  g.seed = seed >>> 0;
  k.reset();
  k.shuffle(STOCK, g.seed);
  for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) k.draw(STOCK, tab(j), 1, j === i ? 1 : 0);
  g.moves = g.turns = g.hn = 0;
  return g;
}
/** Can card c (with the cards on it) go onto pile `to`? */
export function canPlace(g: Game, c: number, to: number) {
  const k = g.k, from = k.pile[c]!;
  if (!movable(g, c) || to === from) return false;
  const t = k.top(to);
  if (isFound(to)) return k.top(from) === c && suit(c) === to - FOUND && rank(c) === k.count(to);
  if (!isTab(to)) return false;
  return t < 0 ? rank(c) === 12 : k.up[t] === 1 && red(t) !== red(c) && rank(t) === rank(c) + 1;
}
/** Card c can be picked up: a face-up tableau card (with what is on it), or the top of the waste or a foundation. */
export function movable(g: Game, c: number) {
  const k = g.k, p = k.pile[c]!;
  if (isTab(p)) return k.up[c] === 1;
  return (p === WASTE || isFound(p)) && k.top(p) === c;
}
function push(g: Game, kind: number, from: number, to: number, n: number) {
  if (g.hn >= CAP) {
    g.hist.copyWithin(0, 4);
    g.hn--;
  }
  const o = g.hn++ * 4, h = g.hist;
  (h[o] = kind), (h[o + 1] = from), (h[o + 2] = to), (h[o + 3] = n);
  g.moves++;
}
/** Move card c and the cards on it onto `to`; a tableau card left face down turns up. */
export function move(g: Game, c: number, to: number) {
  if (!canPlace(g, c, to)) return NO;
  const k = g.k, from = k.pile[c]!, n = k.count(from) - k.pos[c]!;
  for (let i = 0; i < n; i++) k.move(k.at(from, k.count(from) - n + i), to, -1, 1);
  let flipped = 0;
  const t = k.top(from);
  if (isTab(from) && t >= 0 && !k.up[t]) k.flip(t, 1), (flipped = 1);
  push(g, MOVE, from, to, n | (flipped << 8));
  return won(g) ? WON : OK;
}
/** Draw from the stock (1 or 3 to the waste, face up), or turn the waste over when it is empty. */
export function draw(g: Game) {
  const k = g.k;
  if (k.count(STOCK)) {
    const n = Math.min(g.draw, k.count(STOCK));
    k.draw(STOCK, WASTE, n, 1);
    push(g, DRAW, STOCK, WASTE, n);
    return OK;
  }
  if (!k.count(WASTE)) return NO;
  const n = k.count(WASTE);
  k.draw(WASTE, STOCK, n, 0);
  g.turns++;
  push(g, TURN, WASTE, STOCK, n);
  return OK;
}
/** Take the last change back. */
export function undo(g: Game) {
  if (!g.hn) return NO;
  const o = --g.hn * 4, h = g.hist, kind = h[o]!, from = h[o + 1]!, to = h[o + 2]!, n = h[o + 3]! & 255, k = g.k;
  if (kind === MOVE) {
    if (h[o + 3]! >> 8) k.flip(k.top(from), 0);
    for (let i = 0; i < n; i++) k.move(k.at(to, k.count(to) - n + i), from, -1, 1);
  } else if (kind === DRAW) k.draw(WASTE, STOCK, n, 0);
  else k.draw(STOCK, WASTE, n, 1), g.turns--;
  g.moves--;
  return OK;
}
/** All four foundations are full. */
export const won = (g: Game) => g.k.count(FOUND) + g.k.count(FOUND + 1) + g.k.count(FOUND + 2) + g.k.count(FOUND + 3) === 52;
/** The pile card c goes to by itself on a tap: its foundation if it is the top card and fits, else a
 *  column that takes it (one with cards first; an empty one only for a king that is not already at
 *  the bottom of a column), else −1. */
export function target(g: Game, c: number) {
  const k = g.k, from = k.pile[c]!;
  if (!movable(g, c)) return -1;
  const f = found(suit(c));
  if (!isFound(from) && canPlace(g, c, f)) return f;
  let empty = -1;
  for (let j = 0; j < 7; j++) {
    const p = tab(j);
    if (!canPlace(g, c, p)) continue;
    if (k.count(p)) return p;
    if (empty < 0 && !(isTab(from) && k.pos[c] === 0)) empty = p;
  }
  return empty;
}
/** The card a tap or Enter on pile p moves: the top card if it goes to a foundation, else the
 *  deepest face-up card in a column that has somewhere to go, else the top card; −1 if none moves. */
export function pick(g: Game, p: number) {
  const k = g.k, t = k.top(p);
  if (t < 0 || p === STOCK) return -1;
  if (!isTab(p) || isFound(target(g, t))) return target(g, t) >= 0 ? t : -1;
  for (let i = 0, n = k.count(p); i < n; i++) {
    const c = k.at(p, i);
    if (k.up[c] && target(g, c) >= 0) return c;
  }
  return -1;
}
/** A card that can go up to its foundation safely (see the top), or −1. */
export function safe(g: Game) {
  const k = g.k;
  for (let p = WASTE; p < PILES; p++) {
    if (isFound(p)) continue;
    const c = k.top(p);
    if (c < 0 || !k.up[c] || !canPlace(g, c, found(suit(c)))) continue;
    const r = rank(c), o1 = red(c) ? 0 : 1, o2 = o1 + 2;
    if (r <= 1 || (k.count(found(o1)) >= r - 1 && k.count(found(o2)) >= r - 1)) return c;
  }
  return -1;
}
/** Every card is face up and the stock and waste are empty: the rest can play itself. */
export function solved(g: Game) {
  const k = g.k;
  if (k.count(STOCK) || k.count(WASTE)) return false;
  for (let j = 0; j < 7; j++) for (let i = 0, p = tab(j), n = k.count(p); i < n; i++) if (!k.up[k.at(p, i)]) return false;
  return true;
}
/** The next card for a solved game's finish (the lowest card on a column top that fits), or −1. */
export function finish(g: Game) {
  const k = g.k;
  let best = -1;
  for (let j = 0; j < 7; j++) {
    const c = k.top(tab(j));
    if (c >= 0 && canPlace(g, c, found(suit(c))) && (best < 0 || rank(c) < rank(best))) best = c;
  }
  return best;
}
