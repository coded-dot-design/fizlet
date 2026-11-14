// Blackjack's game: you against the dealer, on @fzlt/core/cards, pure and seeded. No DOM, no clock,
// no renderer, no allocation once a game exists. One 52-card deck in a shoe (pile 0), shuffled from
// the seed (cards' Fisher-Yates) and again from the discards when it runs low. The house rules,
// printed on the felt: the dealer stands on all 17s (hits 16 or less, soft or hard), checks for
// blackjack under an ace or a ten, blackjack pays 3 to 2, double down on any first two cards (after a
// split too), split a pair once (split aces take one card each, and ace-ten after a split is 21, not
// blackjack), no insurance. Chips only: you start with 1,000; bets 10, 20, 50 or 100.
// The view paces the dealer with `dealerStep` (one card at a time). Tests: tests/blackjack.test.mjs.
import { deck, type Deck } from "../../../../src/cards";

/** The piles: the shoe, the dealer's hand, your hands (a split makes the second), the discards. */
export const SHOE = 0, DEALER = 1, HAND = 2, HAND2 = 3, DISCARD = 4;
/** Phases: placing a bet, your turn, the dealer's turn, the round is settled. */
export const BET = 0, PLAY = 1, DEALER_TURN = 2, DONE = 3;
/** A hand's result. */
export const NONE = 0, WIN = 1, LOSE = 2, PUSH = 3, NATURAL = 4, BUST = 5;
/** What an action did. */
export const NO = 0, OK = 1, FLIP = 2, DRAW = 3, END = 4;
export const BETS = [10, 20, 50, 100], START = 1000, RESHUFFLE = 20;

export interface Game {
  k: Deck;
  seed: number;
  /** Shuffles so far (each one's seed is mixed from it), rounds dealt. */
  shuffles: number;
  rounds: number;
  phase: number;
  /** Your chips (not counting what is out on the table), and the bet you play each round. */
  bank: number;
  base: number;
  /** Hands this round (1, or 2 after a split), the one you play. */
  hands: number;
  active: number;
  /** Per hand: chips on it, doubled, finished, result, chips back (0 on a loss). */
  bet: Int32Array;
  doubled: Uint8Array;
  done: Uint8Array;
  result: Uint8Array;
  paid: Int32Array;
  /** The round's split was of aces. */
  aces: boolean;
}

/** A card's value: an ace 1 (11 when it helps), 2..9, tens and faces 10. */
export const value = (c: number) => Math.min(10, (c % 13) + 1);
/** The best total of pile p (aces count 11 while that stays 21 or under). */
export function total(k: Deck, p: number) {
  let t = 0, a = 0;
  for (let i = 0, n = k.count(p); i < n; i++) {
    const v = value(k.at(p, i));
    t += v;
    if (v === 1) a++;
  }
  return a && t + 10 <= 21 ? t + 10 : t;
}
/** An ace in pile p counts 11 (the total is soft). */
export function soft(k: Deck, p: number) {
  let t = 0, a = 0;
  for (let i = 0, n = k.count(p); i < n; i++) {
    const v = value(k.at(p, i));
    t += v;
    if (v === 1) a++;
  }
  return a > 0 && t + 10 <= 21;
}
/** Two cards making 21. */
export const natural = (k: Deck, p: number) => k.count(p) === 2 && total(k, p) === 21;
/** The pile of hand h. */
export const pileOf = (h: number) => HAND + h;

/** A new game from `seed`: 1,000 chips, a fresh shuffle, betting 20. */
export function newGame(seed: number): Game {
  const g: Game = {
    k: deck({ size: 52, piles: 5 }), seed: 0, shuffles: 0, rounds: 0, phase: BET, bank: START, base: 20, hands: 1, active: 0,
    bet: new Int32Array(2), doubled: new Uint8Array(2), done: new Uint8Array(2), result: new Uint8Array(2), paid: new Int32Array(2), aces: false,
  };
  return reset(g, seed);
}
/** Start over (in place): chips back to 1,000, every card in the shoe, shuffled from `seed`. */
export function reset(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.shuffles = g.rounds = 0;
  g.bank = START;
  g.base = 20;
  g.phase = BET;
  clearHands(g);
  g.k.reset();
  shuffle(g);
  return g;
}
function clearHands(g: Game) {
  g.hands = 1;
  g.active = 0;
  g.bet.fill(0);
  g.doubled.fill(0);
  g.done.fill(0);
  g.result.fill(NONE);
  g.paid.fill(0);
  g.aces = false;
}
/** The discards back in the shoe, face down, shuffled from the seed and the shuffle count. */
function shuffle(g: Game) {
  g.k.gather(DISCARD, SHOE, 0);
  g.k.shuffle(SHOE, (g.seed ^ Math.imul(g.shuffles + 1, 0x9e3779b1)) | 0);
  g.shuffles++;
}
/** Pick the bet (BETS[i]) between rounds. */
export function setBet(g: Game, i: number) {
  if (g.phase === PLAY || g.phase === DEALER_TURN || i < 0 || i >= BETS.length) return NO;
  g.base = BETS[i]!;
  return OK;
}
/** The cards of the last round to the discards (face down), ready to bet. */
export function collect(g: Game) {
  if (g.phase === PLAY || g.phase === DEALER_TURN) return NO;
  for (let p = DEALER; p <= HAND2; p++) while (g.k.count(p)) g.k.move(g.k.top(p), DISCARD, -1, 0);
  clearHands(g);
  g.phase = BET;
  return OK;
}
/** Can a round be dealt (enough chips for the bet)? */
export const canDeal = (g: Game) => (g.phase === BET || g.phase === DONE) && g.bank >= g.base;
/** Out of chips for even the smallest bet. */
export const broke = (g: Game) => g.phase !== PLAY && g.phase !== DEALER_TURN && g.bank < BETS[0]!;

/** Deal a round: you, the dealer (face up), you, the dealer's hole card (face down). A natural on
 *  either side settles it at once (the dealer checks under an ace or a ten). */
export function deal(g: Game) {
  if (!canDeal(g)) return NO;
  if (g.phase === DONE) collect(g);
  if (g.k.count(SHOE) < RESHUFFLE) shuffle(g);
  g.rounds++;
  g.bank -= g.base;
  g.bet[0] = g.base;
  const k = g.k;
  k.draw(SHOE, HAND, 1, 1);
  k.draw(SHOE, DEALER, 1, 1);
  k.draw(SHOE, HAND, 1, 1);
  k.draw(SHOE, DEALER, 1, 0);
  g.phase = PLAY;
  const up = value(k.at(DEALER, 0));
  if ((up === 1 || up === 10) && natural(k, DEALER)) return k.flip(k.at(DEALER, 1), 1), settle(g), END;
  if (natural(k, HAND)) return k.flip(k.at(DEALER, 1), 1), settle(g), END;
  return OK;
}
/** The hand you play now can take a card / double / be split. */
export const canHit = (g: Game) => g.phase === PLAY && !g.done[g.active] && !g.aces;
export const canDouble = (g: Game) => canHit(g) && g.k.count(pileOf(g.active)) === 2 && g.bank >= g.bet[g.active]!;
export function canSplit(g: Game) {
  const k = g.k;
  return g.phase === PLAY && g.hands === 1 && k.count(HAND) === 2 && value(k.at(HAND, 0)) === value(k.at(HAND, 1)) && g.bank >= g.bet[0]!;
}
/** The next hand to play, or the dealer's turn. */
function advance(g: Game) {
  while (g.active < g.hands && g.done[g.active]) g.active++;
  if (g.active >= g.hands) (g.active = g.hands - 1), (g.phase = DEALER_TURN);
  // A hand of 21 plays itself (it stands).
  else if (total(g.k, pileOf(g.active)) === 21) (g.done[g.active] = 1), advance(g);
}
/** Take a card: over 21 busts the hand, 21 stands it. */
export function hit(g: Game) {
  if (!canHit(g)) return NO;
  const p = pileOf(g.active);
  g.k.draw(SHOE, p, 1, 1);
  const t = total(g.k, p);
  if (t >= 21) (g.done[g.active] = 1), t > 21 && (g.result[g.active] = BUST), advance(g);
  return OK;
}
export function stand(g: Game) {
  if (g.phase !== PLAY || g.done[g.active]) return NO;
  g.done[g.active] = 1;
  advance(g);
  return OK;
}
/** Double the bet, take one card, stand. */
export function double(g: Game) {
  if (!canDouble(g)) return NO;
  const h = g.active, p = pileOf(h);
  g.bank -= g.bet[h]!;
  g.bet[h] = g.bet[h]! * 2;
  g.doubled[h] = 1;
  g.k.draw(SHOE, p, 1, 1);
  g.done[h] = 1;
  if (total(g.k, p) > 21) g.result[h] = BUST;
  advance(g);
  return OK;
}
/** Split the pair into two hands, the same bet on each; each takes a second card. */
export function split(g: Game) {
  if (!canSplit(g)) return NO;
  const k = g.k;
  g.bank -= g.bet[0]!;
  g.bet[1] = g.bet[0]!;
  g.aces = value(k.at(HAND, 0)) === 1;
  k.move(k.top(HAND), HAND2, -1, 1);
  g.hands = 2;
  k.draw(SHOE, HAND, 1, 1);
  k.draw(SHOE, HAND2, 1, 1);
  if (g.aces) g.done[0] = g.done[1] = 1;
  g.active = 0;
  advance(g);
  return OK;
}
/** Some hand still stands (not bust): the dealer has to play to it. */
function live(g: Game) {
  for (let h = 0; h < g.hands; h++) if (g.result[h] !== BUST) return true;
  return false;
}
/** The dealer's turn, one action at a time: turn the hole card, take a card under 17, then settle. */
export function dealerStep(g: Game) {
  if (g.phase !== DEALER_TURN) return NO;
  const k = g.k, hole = k.at(DEALER, 1);
  if (!k.up[hole]) return k.flip(hole, 1), FLIP;
  if (live(g) && total(k, DEALER) < 17) return k.draw(SHOE, DEALER, 1, 1), DRAW;
  settle(g);
  return END;
}
/** Every hand against the dealer's: a win pays 1 to 1, a natural 3 to 2, a push gives the bet back. */
function settle(g: Game) {
  const k = g.k, d = total(k, DEALER), dn = natural(k, DEALER);
  for (let h = 0; h < g.hands; h++) {
    const p = pileOf(h), t = total(k, p), b = g.bet[h]!, nat = g.hands === 1 && natural(k, p);
    let r: number;
    if (t > 21) r = BUST;
    else if (nat && !dn) r = NATURAL;
    else if (dn && !nat) r = LOSE;
    else if (nat && dn) r = PUSH;
    else if (d > 21 || t > d) r = WIN;
    else if (t === d) r = PUSH;
    else r = LOSE;
    g.result[h] = r;
    g.paid[h] = r === NATURAL ? b + (b * 3) / 2 : r === WIN ? 2 * b : r === PUSH ? b : 0;
    g.bank += g.paid[h]!;
    g.done[h] = 1;
  }
  g.phase = DONE;
}
/** The round's chips won (negative: lost), once settled. */
export function net(g: Game) {
  let n = 0;
  for (let h = 0; h < g.hands; h++) n += g.paid[h]! - g.bet[h]!;
  return n;
}
