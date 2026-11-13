// Hold'em's game: Texas hold'em for four seats (you and three bots) with play chips, on
// @fzlt/core/cards, pure and seeded. No DOM, no clock, no renderer, no allocation once a game exists.
// Every seat starts with 1,000 chips; blinds 10 and 20; the button moves one seat a hand (heads-up,
// the button posts the small blind). Two cards each, then the flop, the turn and the river (a card
// burned before each), a round of check, call, raise or fold before each and after the river. A raise
// is at least the last raise (the big blind at first); a short all-in does not reopen the raising.
// Side pots are built from what each seat put in; at the showdown each pot goes to the best hand of
// five from seven among the seats in it (a split shares it, the odd chip to the first seat after the
// button). A seat with no chips sits out; the game ends when you are out or alone.
// `rank5`/`best` score hands (a category and five kickers in one integer); `name` says them. The
// bots read their hand (a starting-hand score before the flop, the made hand and the draws after)
// against the price, with a seeded dash of bluff. Tests: tests/holdem.test.mjs.
import { deck, type Deck } from "../../../../src/cards";

export const SEATS = 4, START = 1000, SB = 10, BB = 20;
export const DECK = 0, BOARD = 1, HOLE = 2, MUCK = 6;
/** Streets, then the showdown, the hand over (paid), the game over. */
export const PRE = 0, FLOP = 1, TURN = 2, RIVER = 3, SHOWDOWN = 4, PAID = 5, OVER = 6;
export const FOLD = 0, CALL = 1, RAISE = 2;
/** The last thing each seat did this street (for the view). */
export const NONE = 0, DID_FOLD = 1, DID_CHECK = 2, DID_CALL = 3, DID_RAISE = 4, DID_ALLIN = 5, DID_BLIND = 6;
export const NO = 0, OK = 1;
/** Hand categories. */
export const HIGH = 0, PAIR = 1, TWO_PAIR = 2, TRIPS = 3, STRAIGHT = 4, FLUSH = 5, FULL = 6, QUADS = 7, STRAIGHT_FLUSH = 8;

export interface Game {
  k: Deck;
  seed: number;
  rng: Int32Array;
  hand: number;
  button: number;
  phase: number;
  /** Whose turn (−1: nobody's). */
  toAct: number;
  /** The street's price to stay in, the least raise, and whether the last all-in reopened raising. */
  price: number;
  minRaise: number;
  /** Per seat: chips behind, this street's chips in, this hand's chips in, folded, all in, out of the game, acted this street, last action. */
  stack: Int32Array;
  bet: Int32Array;
  total: Int32Array;
  folded: Uint8Array;
  allin: Uint8Array;
  out: Uint8Array;
  acted: Uint8Array;
  last: Uint8Array;
  /** Chips in the middle (streets gone by). */
  pot: number;
  /** At the showdown: each seat's hand score (−1 folded), its best five cards, what it won. */
  score: Int32Array;
  best: Int16Array;
  won: Int32Array;
  /** Side pots at the showdown (main first): how many. */
  pots: number;
}

// ---- hand ranking ----
const RV = (c: number) => (c % 13 === 0 ? 14 : (c % 13) + 1), SU = (c: number) => (c / 13) | 0;
const CNT = new Uint8Array(15), ORD = new Int8Array(5), C5 = new Int16Array(5), C7 = new Int16Array(7);
/** The score of five cards: category × 16^5 + five kickers (aces 14), higher is better. */
export function rank5(a: number, b: number, c: number, d: number, e: number) {
  C5[0] = a; C5[1] = b; C5[2] = c; C5[3] = d; C5[4] = e;
  CNT.fill(0);
  let flush = true, hi = 0, lo = 15;
  for (let i = 0; i < 5; i++) {
    const r = RV(C5[i]!);
    CNT[r]!++;
    if (SU(C5[i]!) !== SU(C5[0]!)) flush = false;
    if (r > hi) hi = r;
    if (r < lo) lo = r;
  }
  // Groups by count, then rank, into ORD.
  let n = 0, maxc = 0, pairs = 0;
  for (let want = 4; want >= 1; want--)
    for (let r = 14; r >= 2; r--)
      if (CNT[r] === want) {
        ORD[n++] = r;
        if (want > maxc) maxc = want;
        if (want === 2) pairs++;
      }
  let straight = 0;
  if (n === 5) {
    if (hi - lo === 4) straight = hi;
    else if (hi === 14 && CNT[2] && CNT[3] && CNT[4] && CNT[5]) straight = 5;
  }
  let cat: number;
  if (straight && flush) cat = STRAIGHT_FLUSH;
  else if (maxc === 4) cat = QUADS;
  else if (maxc === 3 && pairs) cat = FULL;
  else if (flush) cat = FLUSH;
  else if (straight) cat = STRAIGHT;
  else if (maxc === 3) cat = TRIPS;
  else if (pairs === 2) cat = TWO_PAIR;
  else if (pairs) cat = PAIR;
  else cat = HIGH;
  if (straight) return cat * 1048576 + straight * 65536;
  let s = cat * 1048576;
  for (let i = 0, m = 65536; i < 5; i++, m >>= 4) s += (i < n ? ORD[i]! : 0) * m;
  return s;
}
/** The best five of seven (cards in C7 via `load`); writes the five into `out` at `at` if given. */
function best7(out: Int16Array | null, at: number) {
  let top = -1, bm = 0;
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++) {
      // Leave out a and b.
      let i = 0;
      for (let j = 0; j < 7; j++) if (j !== a && j !== b) C5[i++] = C7[j]!;
      const s = rank5(C5[0]!, C5[1]!, C5[2]!, C5[3]!, C5[4]!);
      if (s > top) (top = s), (bm = (1 << a) | (1 << b));
    }
  if (out) for (let j = 0, i = 0; j < 7; j++) if (!(bm & (1 << j))) out[at + i++] = C7[j]!;
  return top;
}
/** Seat s's best hand with the board so far (5, 6 or 7 cards); −1 with fewer than five. */
export function best(g: Game, s: number, out: Int16Array | null = null, at = 0) {
  const k = g.k, nb = k.count(BOARD), n = nb + 2;
  if (n < 5) return -1;
  C7[0] = k.at(HOLE + s, 0);
  C7[1] = k.at(HOLE + s, 1);
  for (let i = 0; i < nb; i++) C7[2 + i] = k.at(BOARD, i);
  if (n === 7) return best7(out, at);
  // 5 or 6 cards: pad by repeating none; try every five.
  let top = -1;
  for (let skip = 0; skip < n; skip++) {
    if (n === 5 && skip > 0) break;
    let i = 0;
    for (let j = 0; j < n; j++) if (n === 5 || j !== skip) C5[i++] = C7[j]!;
    const s2 = rank5(C5[0]!, C5[1]!, C5[2]!, C5[3]!, C5[4]!);
    if (s2 > top) {
      top = s2;
      if (out) for (let q = 0; q < 5; q++) out[at + q] = C5[q]!;
    }
  }
  return top;
}
export const category = (score: number) => (score / 1048576) | 0;
const RN = ["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const RP = ["", "", "twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines", "tens", "jacks", "queens", "kings", "aces"];
/** "Two pair, kings and sevens". */
export function name(score: number) {
  const c = category(score), k = (i: number) => (score >> (16 - 4 * i)) & 15;
  switch (c) {
    case STRAIGHT_FLUSH: return k(0) === 14 ? "Royal flush" : `Straight flush, ${RN[k(0)]} high`;
    case QUADS: return `Four ${RP[k(0)]}`;
    case FULL: return `Full house, ${RP[k(0)]} full of ${RP[k(1)]}`;
    case FLUSH: return `Flush, ${RN[k(0)]} high`;
    case STRAIGHT: return `Straight, ${RN[k(0)]} high`;
    case TRIPS: return `Three ${RP[k(0)]}`;
    case TWO_PAIR: return `Two pair, ${RP[k(0)]} and ${RP[k(1)]}`;
    case PAIR: return `Pair of ${RP[k(0)]}`;
    default: return `High card, ${RN[k(0)]}`;
  }
}

// ---- the table ----
export function newGame(seed: number): Game {
  const g: Game = {
    k: deck({ size: 52, piles: 7 }), seed: 0, rng: new Int32Array(1), hand: 0, button: 0, phase: PAID, toAct: -1, price: 0, minRaise: BB,
    stack: new Int32Array(SEATS), bet: new Int32Array(SEATS), total: new Int32Array(SEATS), folded: new Uint8Array(SEATS), allin: new Uint8Array(SEATS),
    out: new Uint8Array(SEATS), acted: new Uint8Array(SEATS), last: new Uint8Array(SEATS), pot: 0, score: new Int32Array(SEATS), best: new Int16Array(SEATS * 5), won: new Int32Array(SEATS), pots: 0,
  };
  return restart(g, seed);
}
/** A fresh table (in place): 1,000 each, the button from the seed, the first hand dealt. */
export function restart(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.rng[0] = g.seed ^ 0x5bd1e995;
  g.hand = 0;
  g.stack.fill(START);
  g.out.fill(0);
  g.button = rand(g, SEATS) - 1;
  g.phase = PAID;
  deal(g);
  return g;
}
/** A seeded integer in [0, n). */
export function rand(g: Game, n: number) {
  let t = (g.rng[0] = (g.rng[0]! + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) % n) | 0;
}
/** The next seat after s still in the game (and, `inHand`, still in this hand and able to act). */
export function next(g: Game, s: number, inHand = false) {
  for (let i = 1; i <= SEATS; i++) {
    const t = (s + i) % SEATS;
    if (g.out[t]) continue;
    if (inHand && (g.folded[t] || g.allin[t])) continue;
    return t;
  }
  return -1;
}
export const seatsIn = (g: Game) => SEATS - (g.out[0]! + g.out[1]! + g.out[2]! + g.out[3]!);
/** You are out, or alone. */
export const finished = (g: Game) => g.out[0] === 1 || seatsIn(g) < 2;
function put(g: Game, s: number, n: number) {
  n = Math.min(n, g.stack[s]!);
  g.stack[s] = g.stack[s]! - n;
  g.bet[s] = g.bet[s]! + n;
  g.total[s] = g.total[s]! + n;
  if (!g.stack[s]) g.allin[s] = 1;
}
/** Deal the next hand: the button moves on, the blinds go in, two cards each. */
export function deal(g: Game) {
  if (g.phase !== PAID || finished(g)) return NO;
  const k = g.k;
  k.reset();
  k.shuffle(DECK, (g.seed ^ Math.imul(g.hand + 1, 0x9e3779b1)) | 0);
  g.hand++;
  g.button = next(g, g.button);
  for (let s = 0; s < SEATS; s++) (g.bet[s] = g.total[s] = g.acted[s] = g.allin[s] = g.last[s] = 0), (g.folded[s] = g.out[s]!), (g.score[s] = -1), (g.won[s] = 0);
  g.pot = g.pots = 0;
  const heads = seatsIn(g) === 2, sb = heads ? g.button : next(g, g.button), bb = next(g, sb);
  for (let r = 0; r < 2; r++) for (let i = 1; i <= SEATS; i++) {
    const s = (g.button + i) % SEATS;
    if (!g.out[s]) k.draw(DECK, HOLE + s, 1, s === 0 ? 1 : 0);
  }
  put(g, sb, SB);
  put(g, bb, BB);
  g.last[sb] = g.last[bb] = DID_BLIND;
  g.price = BB;
  g.minRaise = BB;
  g.phase = PRE;
  g.toAct = next(g, bb, true);
  if (g.toAct < 0 || streetDone(g)) endStreet(g);
  return OK;
}
/** What seat s must add to call. */
export const toCall = (g: Game, s: number) => Math.min(g.price - g.bet[s]!, g.stack[s]!);
/** The least a raise can go to, and the most (all in). */
export const minRaiseTo = (g: Game, s: number) => Math.min(g.price + g.minRaise, g.bet[s]! + g.stack[s]!);
export const maxRaiseTo = (g: Game, s: number) => g.bet[s]! + g.stack[s]!;
/** Seat s may raise (it has more than a call, and raising is open to it). */
export const canRaise = (g: Game, s: number) => g.toAct === s && g.stack[s]! > g.price - g.bet[s]! && !g.acted[s];
/** The seat to act folds, checks or calls, or raises to `to` chips this street. */
export function act(g: Game, kind: number, to = 0) {
  const s = g.toAct;
  if (s < 0 || g.phase > RIVER) return NO;
  if (kind === FOLD) (g.folded[s] = 1), (g.last[s] = DID_FOLD);
  else if (kind === CALL) {
    const c = toCall(g, s);
    put(g, s, c);
    g.last[s] = g.allin[s] ? DID_ALLIN : c ? DID_CALL : DID_CHECK;
  } else {
    if (!canRaise(g, s)) return NO;
    to = Math.max(minRaiseTo(g, s), Math.min(to, maxRaiseTo(g, s)));
    const by = to - g.price;
    put(g, s, to - g.bet[s]!);
    // A full raise reopens the betting for everyone; a short all-in only raises the price.
    if (by >= g.minRaise) {
      g.minRaise = by;
      for (let t = 0; t < SEATS; t++) g.acted[t] = 0;
    }
    g.price = Math.max(g.price, g.bet[s]!);
    g.last[s] = g.allin[s] ? DID_ALLIN : DID_RAISE;
  }
  g.acted[s] = 1;
  return advance(g), OK;
}
function live(g: Game) {
  let n = 0;
  for (let s = 0; s < SEATS; s++) if (!g.folded[s]) n++;
  return n;
}
function streetDone(g: Game) {
  for (let s = 0; s < SEATS; s++) if (!g.folded[s] && !g.allin[s] && (!g.acted[s] || g.bet[s]! < g.price)) return false;
  return true;
}
function advance(g: Game) {
  if (live(g) === 1) return endStreet(g);
  if (streetDone(g)) return endStreet(g);
  g.toAct = next(g, g.toAct, true);
  // Only one seat can still act and it has matched the price: nothing left to decide.
  if (g.toAct < 0) endStreet(g);
}
/** The street's chips go in the middle; the next street is dealt, or the showdown comes. */
function endStreet(g: Game) {
  const k = g.k;
  for (let s = 0; s < SEATS; s++) (g.pot += g.bet[s]!), (g.bet[s] = 0), (g.acted[s] = 0);
  g.price = 0;
  g.minRaise = BB;
  if (live(g) === 1) return award(g);
  let actors = 0;
  for (let s = 0; s < SEATS; s++) if (!g.folded[s] && !g.allin[s]) actors++;
  g.phase++;
  if (g.phase > RIVER) return showdown(g);
  k.draw(DECK, MUCK, 1, 0);
  k.draw(DECK, BOARD, g.phase === FLOP ? 3 : 1, 1);
  for (let s = 0; s < SEATS; s++) if (g.last[s] !== DID_FOLD && g.last[s] !== DID_ALLIN) g.last[s] = NONE;
  g.toAct = next(g, g.button, true);
  // Everyone (or all but one) is all in: deal the rest out.
  if (actors < 2) return endStreet(g);
}
/** Everything to the one seat left. */
function award(g: Game) {
  for (let s = 0; s < SEATS; s++) if (!g.folded[s]) (g.won[s] = g.pot), (g.stack[s] = g.stack[s]! + g.pot);
  g.pots = 1;
  finish(g);
}
function showdown(g: Game) {
  g.phase = SHOWDOWN;
  for (let s = 0; s < SEATS; s++) g.score[s] = g.folded[s] ? -1 : best(g, s, g.best, s * 5);
  // Side pots: each level of what was put in, shared by the seats still in that put in that much.
  let paid = 0, lastWin = -1;
  for (;;) {
    let level = 0x7fffffff;
    for (let s = 0; s < SEATS; s++) if (!g.folded[s] && g.total[s]! > paid && g.total[s]! < level) level = g.total[s]!;
    if (level === 0x7fffffff) break;
    let chips = 0, top = -1, n = 0;
    for (let s = 0; s < SEATS; s++) chips += Math.max(0, Math.min(g.total[s]!, level) - paid);
    for (let s = 0; s < SEATS; s++) if (!g.folded[s] && g.total[s]! >= level && g.score[s]! > top) top = g.score[s]!;
    for (let s = 0; s < SEATS; s++) if (!g.folded[s] && g.total[s]! >= level && g.score[s] === top) n++;
    const each = Math.floor(chips / n);
    let odd = chips - each * n;
    for (let i = 1; i <= SEATS; i++) {
      const s = (g.button + i) % SEATS;
      if (g.folded[s] || g.total[s]! < level || g.score[s] !== top) continue;
      const w = each + (odd > 0 ? 1 : 0);
      odd--;
      g.won[s] = g.won[s]! + w;
      g.stack[s] = g.stack[s]! + w;
      if (w && lastWin < 0) lastWin = s;
    }
    if (n) lastWin = -1;
    for (let i = 1; i <= SEATS && lastWin < 0; i++) {
      const s = (g.button + i) % SEATS;
      if (!g.folded[s] && g.total[s]! >= level && g.score[s] === top) lastWin = s;
    }
    g.pots++;
    paid = level;
  }
  // A folded seat's chips past every live seat's reach go with the last pot.
  let left = 0;
  for (let s = 0; s < SEATS; s++) if (g.folded[s] && g.total[s]! > paid) left += g.total[s]! - paid;
  if (left && lastWin >= 0) (g.stack[lastWin] = g.stack[lastWin]! + left), (g.won[lastWin] = g.won[lastWin]! + left);
  finish(g);
}
function finish(g: Game) {
  g.toAct = -1;
  g.pot = 0;
  for (let s = 0; s < SEATS; s++) if (!g.stack[s]) g.out[s] = 1;
  g.phase = finished(g) ? OVER : PAID;
}

// ---- the bots ----
/** Before the flop: a starting-hand score, 0 (seven-two) to 1 (aces). */
export function preflop(a: number, b: number) {
  let hi = RV(a), lo = RV(b);
  if (lo > hi) (hi = RV(b)), (lo = RV(a));
  let v = hi === lo ? 0.5 + (hi - 2) * 0.04 : (hi - 2) * 0.025 + (lo - 2) * 0.012;
  if (SU(a) === SU(b)) v += 0.06;
  const gap = hi - lo;
  if (gap === 1) v += 0.05;
  else if (gap === 2) v += 0.025;
  return Math.min(1, v + (hi >= 13 ? 0.06 : 0));
}
/** After it: the made hand (counting only what the hole cards add) and draws, 0 to 1. */
export function strength(g: Game, s: number) {
  const k = g.k, a = k.at(HOLE + s, 0), b = k.at(HOLE + s, 1);
  if (k.count(BOARD) < 3) return preflop(a, b);
  const sc = best(g, s), cat = category(sc);
  // The board's own hand: a pair on the board is everyone's pair.
  let boardCat = 0;
  if (k.count(BOARD) === 5) boardCat = category(rank5(k.at(BOARD, 0), k.at(BOARD, 1), k.at(BOARD, 2), k.at(BOARD, 3), k.at(BOARD, 4)));
  const made = cat > boardCat ? cat : 0, kick = ((sc >> 16) & 15) / 14;
  let v = MADE[made]! + kick * 0.08;
  if (!made) v = 0.08 + Math.max(RV(a), RV(b)) / 70;
  // Draws, while cards are to come: four to a flush, four in a row.
  if (k.count(BOARD) < 5) {
    CNT.fill(0);
    let suitMax = 0;
    for (let q = 0; q < 4; q++) {
      let n = (SU(a) === q ? 1 : 0) + (SU(b) === q ? 1 : 0);
      for (let i = 0; i < k.count(BOARD); i++) if (SU(k.at(BOARD, i)) === q) n++;
      if (n > suitMax) suitMax = n;
    }
    CNT[RV(a)] = CNT[RV(b)] = 1;
    for (let i = 0; i < k.count(BOARD); i++) CNT[RV(k.at(BOARD, i))] = 1;
    let run = 0, longest = 0;
    for (let r = 2; r <= 14; r++) (run = CNT[r] ? run + 1 : 0), run > longest && (longest = run);
    if (suitMax === 4 || longest === 4) v = Math.max(v, 0.46);
  }
  return Math.min(1, v);
}
const MADE = [0.12, 0.42, 0.62, 0.74, 0.8, 0.84, 0.92, 0.97, 1];
/** Each bot's style: how loose it plays and how often it pushes. */
const LOOSE = [0, 0.05, -0.04, 0.1], PUSH = [0, 0.12, 0.06, 0.2];
/** The seat to act decides (a bot): returns what it did through `act`. */
export function botAct(g: Game) {
  const s = g.toAct;
  if (s < 0) return NO;
  const v = strength(g, s) + LOOSE[s]!, call = toCall(g, s), pot = g.pot + g.bet[0]! + g.bet[1]! + g.bet[2]! + g.bet[3]!;
  const odds = call / Math.max(1, pot + call), dice = rand(g, 100) / 100;
  if (canRaise(g, s) && (v > 0.72 || (v > 0.55 && dice < PUSH[s]!) || (call === 0 && dice < PUSH[s]! * 0.4))) {
    const size = Math.max(minRaiseTo(g, s), g.price + Math.round((pot * (0.5 + dice * 0.5)) / 10) * 10);
    return act(g, RAISE, v > 0.95 ? maxRaiseTo(g, s) : size);
  }
  if (call === 0) return act(g, CALL);
  if (v > odds + 0.12 || (call <= BB && v > 0.2)) return act(g, CALL);
  return act(g, FOLD);
}
