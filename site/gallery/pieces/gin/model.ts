// Gin Rummy's game: you against a bot, on @fzlt/core/cards, pure and seeded. No DOM, no clock, no
// renderer, no allocation once a game exists. Ten cards each; the rest is the stock (pile 0), one
// card turned up to start the discards (pile 1). On your turn draw (the stock's top or the discard),
// then discard one (not the card you just took from the discards). Melds: sets (three or four of a
// rank) and runs (three or more in a suit, ace low). Deadwood is what is left: aces 1, faces 10.
// Knock with 10 or less (your knock card goes face down), gin with none. The other side lays its
// deadwood off on the knocker's melds (not on gin). Knocker less: the difference; the other side the
// same or less: an undercut, 25 + the difference to them; gin: 25 + their deadwood. A stock down to
// two cards is a dead hand. First to 100.
// `arrange` finds the best melds (the least deadwood) by a search over every set and run in the hand;
// the bot plays by it. Tests: tests/gin-rummy.test.mjs.
import { deck, type Deck } from "../../../../src/cards";

export const STOCK = 0, DISCARD = 1, YOU = 2, BOT = 3;
/** Phases: draw, discard, the hand is over (scored), the game is over. */
export const DRAW = 0, THROW = 1, HAND_OVER = 2, GAME_OVER = 3;
/** How a hand ended. */
export const KNOCK = 1, GIN = 2, UNDERCUT = 3, DEAD = 4;
export const NO = 0, OK = 1, TARGET = 100;

export interface Game {
  k: Deck;
  seed: number;
  hands: number;
  /** Who dealt (0 you, 1 the bot) and whose turn it is. */
  dealer: number;
  turn: number;
  phase: number;
  /** The card just taken from the discards (it can't go straight back), or −1. */
  took: number;
  score: Int32Array;
  /** The last hand: who knocked, how it ended, who scored, the points, each side's deadwood (after layoffs). */
  knocker: number;
  end: number;
  scorer: number;
  points: number;
  dead: Int32Array;
  /** Per card at the showdown: its meld (0..3 the knocker's, 4..7 the other's; −1 deadwood) and,
   *  for a card laid off, the knocker's meld it went on (else −1). */
  meld: Int8Array;
  layoff: Int8Array;
}

export const value = (c: number) => Math.min(10, (c % 13) + 1);
const rank = (c: number) => c % 13, suit = (c: number) => (c / 13) | 0;
export const hand = (who: number) => (who ? BOT : YOU);

// ---- melds: the search (shared scratch; nothing allocated per call) ----
const H = new Int16Array(12), MM = new Int32Array(96), MV = new Int16Array(96), PICK = new Int16Array(8), BEST = new Int16Array(8);
let hn = 0, mn = 0, bestV = 0, bestN = 0, pickN = 0;
function addMeld(mask: number) {
  if (mn >= MM.length) return;
  let v = 0;
  for (let i = 0; i < hn; i++) if (mask & (1 << i)) v += value(H[i]!);
  MM[mn] = mask;
  MV[mn++] = v;
}
/** Every set and run in H[0..hn). */
function melds() {
  mn = 0;
  // Sets: per rank, the 4 and every 3 of it.
  for (let r = 0; r < 13; r++) {
    let m = 0, n = 0;
    for (let i = 0; i < hn; i++) if (rank(H[i]!) === r) (m |= 1 << i), n++;
    if (n < 3) continue;
    if (n === 4) {
      addMeld(m);
      for (let i = 0; i < hn; i++) if (m & (1 << i)) addMeld(m & ~(1 << i));
    } else addMeld(m);
  }
  // Runs: per suit, every stretch of 3 or more in a row.
  for (let s = 0; s < 4; s++) {
    for (let a = 0; a < 11; a++) {
      let m = 0;
      for (let b = a; b < 13; b++) {
        let at = -1;
        for (let i = 0; i < hn; i++) if (suit(H[i]!) === s && rank(H[i]!) === b) at = i;
        if (at < 0) break;
        m |= 1 << at;
        if (b - a >= 2) addMeld(m);
      }
    }
  }
}
function search(from: number, used: number, v: number) {
  if (v > bestV) {
    bestV = v;
    bestN = pickN;
    for (let i = 0; i < pickN; i++) BEST[i] = PICK[i]!;
  }
  for (let j = from; j < mn; j++) {
    if (MM[j]! & used) continue;
    PICK[pickN++] = j;
    search(j + 1, used | MM[j]!, v + MV[j]!);
    pickN--;
  }
}
/** The best melds of pile p (leaving out card `skip`, adding card `add`): returns the deadwood; `out` (52, if given)
 *  gets each card's meld index (base, base + 1, …) or −1. */
export function arrange(k: Deck, p: number, skip = -1, out: Int8Array | null = null, base = 0, add = -1) {
  hn = 0;
  let total = 0;
  if (add >= 0) (H[hn++] = add), (total += value(add));
  for (let i = 0, n = k.count(p); i < n; i++) {
    const c = k.at(p, i);
    if (c === skip) continue;
    H[hn++] = c;
    total += value(c);
  }
  melds();
  bestV = bestN = pickN = 0;
  search(0, 0, 0);
  if (out) {
    for (let i = 0; i < hn; i++) out[H[i]!] = -1;
    for (let b = 0; b < bestN; b++) for (let i = 0; i < hn; i++) if (MM[BEST[b]!]! & (1 << i)) out[H[i]!] = base + b;
  }
  return total - bestV;
}
/** Melds found by the last `arrange`. */
export const meldCount = () => bestN;

/** A new game from `seed`: the bot deals the first hand, so you play first. */
export function newGame(seed: number): Game {
  const g: Game = {
    k: deck({ size: 52, piles: 4 }), seed: seed >>> 0, hands: 0, dealer: 1, turn: 0, phase: DRAW, took: -1, score: new Int32Array(2),
    knocker: -1, end: 0, scorer: -1, points: 0, dead: new Int32Array(2), meld: new Int8Array(52), layoff: new Int8Array(52),
  };
  return newHand(g);
}
/** Start over at 0 – 0 (in place). */
export function restart(g: Game, seed: number) {
  g.seed = seed >>> 0;
  g.hands = 0;
  g.dealer = 1;
  g.score.fill(0);
  return newHand(g);
}
/** Deal the next hand: ten each from a fresh shuffle, one card up; the dealer changes, the other plays first. */
export function newHand(g: Game) {
  const k = g.k;
  if (g.phase === HAND_OVER || g.phase === GAME_OVER || g.hands) g.dealer ^= 1;
  if (g.phase === GAME_OVER) g.score.fill(0);
  k.reset();
  k.shuffle(STOCK, (g.seed ^ Math.imul(g.hands + 1, 0x9e3779b1)) | 0);
  g.hands++;
  const first = hand(g.dealer ^ 1), second = hand(g.dealer);
  for (let i = 0; i < 10; i++) k.draw(STOCK, first, 1, first === YOU ? 1 : 0), k.draw(STOCK, second, 1, second === YOU ? 1 : 0);
  k.draw(STOCK, DISCARD, 1, 1);
  g.turn = g.dealer ^ 1;
  g.phase = DRAW;
  g.took = -1;
  g.knocker = g.scorer = -1;
  g.end = g.points = 0;
  g.dead.fill(0);
  g.meld.fill(-1);
  g.layoff.fill(-1);
  return g;
}
/** Draw the stock's top card (`fromDiscard`: the discard's top) to the player whose turn it is. */
export function draw(g: Game, fromDiscard: boolean) {
  if (g.phase !== DRAW) return NO;
  const k = g.k, from = fromDiscard ? DISCARD : STOCK, me = hand(g.turn);
  if (!k.count(from)) return NO;
  const c = k.top(from);
  k.move(c, me, -1, me === YOU ? 1 : 0);
  g.took = fromDiscard ? c : -1;
  g.phase = THROW;
  return OK;
}
/** Can the player whose turn it is discard c? */
export const canDiscard = (g: Game, c: number) => g.phase === THROW && g.k.pile[c] === hand(g.turn) && c !== g.took;
/** Discard c face up; the turn passes (a stock of two or less ends the hand dead). */
export function discard(g: Game, c: number) {
  if (!canDiscard(g, c)) return NO;
  g.k.move(c, DISCARD, -1, 1);
  if (g.k.count(STOCK) <= 2) return over(g, -1, DEAD), OK;
  g.turn ^= 1;
  g.phase = DRAW;
  g.took = -1;
  return OK;
}
/** Deadwood if c were discarded now. */
export const deadwoodWithout = (g: Game, c: number) => arrange(g.k, hand(g.turn), c);
/** Can the player knock with c (10 or less left)? */
export const canKnock = (g: Game, c: number) => canDiscard(g, c) && deadwoodWithout(g, c) <= 10;
/** Knock (or go gin) with c: it goes face down on the discards; the hand is laid down and scored. */
export function knock(g: Game, c: number) {
  if (!canKnock(g, c)) return NO;
  g.k.move(c, DISCARD, -1, 0);
  const me = g.turn, kd = arrange(g.k, hand(me), -1, g.meld, 0), km = bestN;
  const od = arrange(g.k, hand(me ^ 1), -1, g.meld, 4);
  g.knocker = me;
  let left = od;
  if (kd > 0) left = layOff(g, hand(me), km, hand(me ^ 1), od);
  g.dead[me] = kd;
  g.dead[me ^ 1] = left;
  if (kd === 0) over(g, me, GIN, 25 + left);
  else if (left <= kd) over(g, me ^ 1, UNDERCUT, 25 + kd - left);
  else over(g, me, KNOCK, left - kd);
  return OK;
}
const LO = new Int8Array(8), HI = new Int8Array(8), SU = new Int8Array(8), SET = new Uint8Array(8), SIZE = new Uint8Array(8);
/** The other side's deadwood goes on the knocker's melds while any fits; returns what is left. */
function layOff(g: Game, kp: number, km: number, op: number, od: number) {
  const k = g.k;
  for (let m = 0; m < km; m++) (LO[m] = 13), (HI[m] = -1), (SIZE[m] = 0), (SET[m] = 1), (SU[m] = -1);
  for (let i = 0, n = k.count(kp); i < n; i++) {
    const c = k.at(kp, i), m = g.meld[c]!;
    if (m < 0) continue;
    if (SIZE[m] && rank(c) !== LO[m]) SET[m] = 0;
    LO[m] = Math.min(LO[m]!, rank(c));
    HI[m] = Math.max(HI[m]!, rank(c));
    SU[m] = suit(c);
    SIZE[m] = SIZE[m]! + 1;
  }
  let left = od;
  for (let again = true; again; ) {
    again = false;
    for (let i = 0, n = k.count(op); i < n; i++) {
      const c = k.at(op, i);
      if (g.meld[c] !== -1 || g.layoff[c] !== -1) continue;
      for (let m = 0; m < km; m++) {
        const fits = SET[m] ? rank(c) === LO[m] && SIZE[m]! < 4 : suit(c) === SU[m] && (rank(c) === LO[m]! - 1 || rank(c) === HI[m]! + 1);
        if (!fits) continue;
        g.layoff[c] = m;
        (LO[m] = Math.min(LO[m]!, rank(c))), (HI[m] = Math.max(HI[m]!, rank(c))), (SIZE[m] = SIZE[m]! + 1);
        left -= value(c);
        again = true;
        break;
      }
    }
  }
  return left;
}
function over(g: Game, scorer: number, end: number, points = 0) {
  g.phase = HAND_OVER;
  g.end = end;
  g.scorer = scorer;
  g.points = points;
  if (scorer >= 0) g.score[scorer] = g.score[scorer]! + points;
  if (g.score[0]! >= TARGET || g.score[1]! >= TARGET) g.phase = GAME_OVER;
}

// ---- the bot ----
/** Take the discard if it ends up in a meld (less deadwood after the best discard than now). */
export function botWantsDiscard(g: Game) {
  const k = g.k, me = hand(g.turn), top = k.top(DISCARD);
  if (top < 0) return false;
  const now = arrange(k, me);
  let best = 999;
  for (let i = 0, n = k.count(me); i < n; i++) best = Math.min(best, arrange(k, me, k.at(me, i), null, 0, top));
  return best < now;
}
/** The card to throw: the least deadwood left, the highest card on a tie. */
export function botChoice(g: Game) {
  const k = g.k, me = hand(g.turn);
  let best = -1, bd = 999;
  for (let i = 0, n = k.count(me); i < n; i++) {
    const c = k.at(me, i);
    if (c === g.took) continue;
    const d = arrange(k, me, c);
    if (d < bd || (d === bd && value(c) > value(best))) (bd = d), (best = c);
  }
  return best;
}
/** The bot's whole turn: draw, then knock (gin always; 10 or less when the stock runs low, 7 or less before) or discard. */
export function botTurn(g: Game) {
  if (g.phase !== DRAW) return NO;
  draw(g, botWantsDiscard(g));
  const c = botChoice(g), d = deadwoodWithout(g, c);
  if (d === 0 || (d <= 7) || (d <= 10 && g.k.count(STOCK) < 16)) return knock(g, c);
  return discard(g, c);
}
