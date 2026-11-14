// "Blackjack": you against the dealer at a felt card table in the corner of a room (Flip Match's
// table, lamp and mug: the card table series). Pick a bet, DEAL: two cards each fly from the shoe,
// the dealer's second face down. HIT, STAND, DOUBLE (twice the bet, one card) or SPLIT a pair into two
// hands; the dealer turns the hole card and draws to 17, one card at a time, and the chips move: a win
// is paid from the dealer's tray beside your bet, a loss goes to the tray, and what comes back slides
// home to your stack. The house rules are printed on the felt. Play chips only: 1,000 to start.
// Keys: H hit, S stand, D double, P split, B or the arrows pick the bet, Enter deals, M mutes, N a new
// table. Light: a bright afternoon; dark: a lamp-lit night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/cards
// (the deck, the seeded shuffle, the deal, flips and moves in arcs), @fzlt/core/diorama (the 3D),
// @fzlt/core/slot, @fzlt/core/sound. The rules are ./model.ts, pure and seeded
// (tests/blackjack.test.mjs); the table, the deck's art and the chips are ../felt/ (the series'
// shared parts); this file is the scene and the controls (tests/blackjack.mjs).
import { dioramaCards, type DioramaCards, type PileLayout } from "../../../../src/cards";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { cardTable, differ, num, FONT, type Table } from "../felt/table";
import { paintBack, paintFace, cardName } from "../felt/deck52";
import { CLAY, stack, type Stack } from "../felt/chips";
import {
  BET, BETS, BUST, DEALER, DEALER_TURN, DISCARD, DONE, END, FLIP, HAND, HAND2, NATURAL, PLAY, PUSH, SHOE, WIN,
  broke, canDeal, canDouble, canHit, canSplit, deal, dealerStep, double, hit, natural, net, newGame, pileOf, reset, setBet, soft, split, stand, total, value, type Game,
} from "./model";

const K_MUTE = 0, K_BET = 1, K_DEAL = 2, K_HIT = 3, K_STAND = 4, K_DOUBLE = 5, K_SPLIT = 6;
const T_DEALER = 1, T_PAY = 2, T_SWEEP = 3, T_HOME = 4, T_FIRST = 5;
const INK = "#1f2433";
const RESULT = ["", "WIN", "LOSE", "PUSH", "BLACKJACK", "BUST"];

export type BlackjackScene = SlotScene & {
  engine: Table["engine"];
  readonly g: Game;
  readonly state: { phase: number; bank: number; shown: number; busy: boolean; card: boolean };
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): BlackjackScene {
  const g: Game = newGame(1);
  let seed = 1, dc!: DioramaCards, bankS!: Stack, shown = 1000, moving = false;
  const betS: Stack[] = [], winS: Stack[] = [];
  const lay: PileLayout[] = [];
  for (let p = 0; p <= DISCARD; p++) lay.push({ type: p === SHOE || p === DISCARD ? "stack" : "row", x: 0, z: 0 });
  // Felt places: [x, z] of the shoe, the discards, the dealer's row, your row, the bet circle, your chips, the tray.
  const W = { shoe: [4.3, -2.3], disc: [-4.3, -2.3], dealer: -1.85, hand: 1.05, circle: 2.75, split: 1.75, gap: 0.62, bank: [4.1, 2.7], tray: -3.25, rules: -0.45 };
  const TALL = { shoe: [2.25, -4.0], disc: [-2.25, -4.0], dealer: -2.4, hand: 0.95, circle: 2.75, split: 1.6, gap: 0.5, bank: [2.3, 3.7], tray: -4.0, rules: -0.8 };
  let Lp = W;

  const T = cardTable(stage, {
    label: "Blackjack: pick a bet and deal, then hit, stand, double or split with the keys under the table (H hit, S stand, D double, P split, B the bet, Enter deals, M mutes, N a new table)",
    hud: `<div class="ct-head"><p class="ct-top"><b class="ct-chip ct-turn">Place your bet</b><b class="ct-chip">Chips <span>1,000</span></b><b class="ct-chip">Bet <span>20</span></b></p><p class="ct-hint"></p></div><div class="ct-card" role="dialog" aria-label="Out of chips" hidden><b>Out of chips</b><p>The house wins this one. A new table starts you on 1,000.</p><button type="button" class="bui-key ct-again">NEW TABLE</button></div>`,
    keys: [
      { label: "♪", aria: "Mute (M)", id: K_MUTE },
      { label: "BET 20", aria: "Bet (B): 10, 20, 50 or 100", id: K_BET },
      { label: "DEAL", aria: "Deal (Enter)", id: K_DEAL, c: "ct-go" },
      { label: "HIT", aria: "Hit (H)", id: K_HIT, c: "ct-go" },
      { label: "STAND", aria: "Stand (S)", id: K_STAND },
      { label: "DOUBLE", aria: "Double down (D)", id: K_DOUBLE },
      { label: "SPLIT", aria: "Split (P)", id: K_SPLIT },
    ],
    onKey(id, down) {
      if (!down) return;
      if (id === K_MUTE) T.toggleMute();
      else if (id === K_BET) cycleBet(1);
      else if (id === K_DEAL) doDeal();
      else act(id);
    },
    cues: { deal: "deal", card: "flick", chip: "chip", win: "win", lose: "lose", push: "push", natural: "natural" },
    notes: {
      flick: [[1500, 900, 0.035, 0, "triangle", 0.12]],
      deal: [[900, 500, 0.03, 0, "triangle", 0.06], [900, 500, 0.03, 0.14, "triangle", 0.06], [900, 500, 0.03, 0.28, "triangle", 0.06], [900, 500, 0.03, 0.42, "triangle", 0.06]],
      chip: [[2400, 2200, 0.025, 0, "square", 0.05], [2900, 2700, 0.025, 0.05, "square", 0.04]],
      win: [[660, 660, 0.08, 0, "triangle", 0.16], [880, 990, 0.14, 0.08, "triangle", 0.16]],
      natural: [[660, 660, 0.07, 0, "triangle", 0.16], [880, 880, 0.07, 0.07, "triangle", 0.16], [1320, 1320, 0.2, 0.14, "triangle", 0.16]],
      lose: [[300, 220, 0.14, 0, "triangle", 0.12]],
      push: [[520, 520, 0.08, 0, "triangle", 0.1]],
    },
    felt: (tall) => (tall ? [6.8, 10.2, 0.15] : [11.4, 7.8, 0]),
    build(tall) {
      Lp = tall ? TALL : W;
      place();
      dc = dioramaCards(T.dio, g.k, { on: "felt", size: [1, 1.4], thick: 0.014, piles: lay, face: paintFace, back: paintBack, color: "#f6efe0", dur: 0.42, stagger: 0.16, arc: 0.9, motion: !T.RM });
      betS.length = winS.length = 0;
      for (let h = 0; h < 2; h++) betS.push(stack(T, "bet" + h, 0, Lp.circle, 10)), winS.push(stack(T, "win" + h, 0, Lp.tray + 0.55, 10));
      bankS = stack(T, "bank", Lp.bank[0]!, Lp.bank[1]!, 14);
      // The dealer's chip rack behind the tray: a wooden box, four rolls of chips lying in it.
      T.dio.cluster("rack", { at: [0, 1.6, Lp.tray + T.fz] });
      T.put({ id: "rack", size: [2.6, 0.22, 0.62], on: "felt", pos: [0, 0, Lp.tray], color: "rail", cluster: "rack", shadow: 0.25 });
      for (let i = 0; i < 4; i++) T.put({ shape: "cyl", sides: 12, size: [0.5, 0.5, 0.5], on: "rack", pos: [-0.93 + i * 0.62, -0.02, 0.25], rot: [Math.PI / 2, 0, 0], color: CLAY[i] });
      bankS.set(shown);
      // Mid-round, the chips on the table stay where they are.
      for (let h = 0; h < g.hands; h++) if (g.phase === PLAY || g.phase === DEALER_TURN) betS[h]!.place(circleX(h), Lp.circle), betS[h]!.set(g.bet[h]!);
      dc.show(T.engine.time);
    },
    view(tall, pts) {
      const ex = tall ? 3.2 : 5.2, z0 = tall ? -4.7 : -3.4, z1 = tall ? 4.6 : 3.4;
      pts.push(-ex, 0.1, z0, ex, 0.1, z0, -ex, 0.1, z1, ex, 0.1, z1, 0, 1.2, z0);
      return tall ? [-8, 60] : [-14, 52];
    },
    feltArt,
    overlay,
    timer,
    pose(t) {
      // The totals wait for the cards to land.
      let busy = dc.show(t);
      if (busy !== moving) (moving = busy), (T.dirty = true);
      for (let h = 0; h < 2; h++) busy = betS[h]!.show(t) || busy, (busy = winS[h]!.show(t) || busy);
      return bankS.show(t) || busy;
    },
    write: hudWrite,
  });
  const head = T.head, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const endCard = T.hudEl.querySelector(".ct-card") as HTMLElement, again = endCard.querySelector("button") as HTMLButtonElement;
  const [, betK, dealK, hitK, standK, doubleK, splitK] = T.keys;
  const sig = { signal: T.engine.signal }, tmp = new Float64Array(3);

  const circleX = (h: number) => (g.hands === 2 ? (h ? Lp.split : -Lp.split) : 0);
  function place() {
    Object.assign(lay[SHOE]!, { x: Lp.shoe[0], z: Lp.shoe[1], a: -0.3 });
    Object.assign(lay[DISCARD]!, { x: Lp.disc[0], z: Lp.disc[1], a: 0.22 });
    Object.assign(lay[DEALER]!, { x: 0, z: Lp.dealer, gap: Lp.gap });
    Object.assign(lay[HAND]!, { x: circleX(0), z: Lp.hand, gap: Lp.gap });
    Object.assign(lay[HAND2]!, { x: circleX(1), z: Lp.hand, gap: Lp.gap });
  }

  // ---- the felt: the bet circles, the card places, the house rules ----
  function feltArt(ctx: CanvasRenderingContext2D) {
    const P = T.P;
    ctx.strokeStyle = P.chalk;
    ctx.lineWidth = 2;
    for (let h = 0; h < 2; h++) {
      if (h && g.hands < 2) continue;
      T.ring(ctx, circleX(h), Lp.circle, 0.62, 0.92);
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    T.quad(ctx, Lp.shoe[0]! - 0.62, Lp.shoe[1]! - 0.82, Lp.shoe[0]! + 0.62, Lp.shoe[1]! + 0.82);
    ctx.stroke();
    T.quad(ctx, Lp.disc[0]! - 0.62, Lp.disc[1]! - 0.82, Lp.disc[0]! + 0.62, Lp.disc[1]! + 0.82);
    ctx.stroke();
    const sz = T.tall ? 22 : 26;
    T.text(ctx, "BLACKJACK PAYS 3 TO 2", 0, Lp.rules - 0.22, sz, P.print, 900);
    T.text(ctx, "DEALER STANDS ON ALL 17s · NO INSURANCE", 0, Lp.rules + 0.18, T.tall ? 15 : 17, P.print, 800);
    T.text(ctx, "SHOE", Lp.shoe[0]!, Lp.shoe[1]! + 1.05, 16, P.print);
    T.text(ctx, "DISCARDS", Lp.disc[0]!, Lp.disc[1]! + 1.05, 16, P.print);
  }

  // ---- the overlay: each hand's total, the result, the hand you play ----
  function badge(ctx: CanvasRenderingContext2D, s: string, x: number, z: number, fill: string, color = INK) {
    T.screen(x, 0.05, z, tmp);
    ctx.font = `900 ${T.tall ? 12 : 14}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(s).width + 16, h = T.tall ? 22 : 25, bx = tmp[0]! - w / 2, by = tmp[1]! - h / 2;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(bx + 3, by + 3, w, h, 7);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(s, tmp[0]!, tmp[1]! + 1);
  }
  const label = (p: number) => {
    const t = total(g.k, p);
    return t > 21 ? "BUST " + t : natural(g.k, p) && g.hands === 1 ? "21!" : soft(g.k, p) && t < 21 ? "SOFT " + t : "" + t;
  };
  function overlay(ctx: CanvasRenderingContext2D) {
    if (moving || !g.k.count(HAND)) return;
    const k = g.k, hole = k.count(DEALER) > 1 ? k.at(DEALER, 1) : -1, bz = 0.95;
    const dn = k.count(DEALER);
    if (dn) badge(ctx, hole >= 0 && !k.up[hole] ? "" + (value(k.at(DEALER, 0)) === 1 ? "A" : value(k.at(DEALER, 0))) : label(DEALER), ((dn - 1) * Lp.gap + 1) / 2 + 0.5, Lp.dealer, "#f4efe4");
    for (let h = 0; h < g.hands; h++) {
      const p = pileOf(h), r = g.result[h]!, x = lay[p]!.x!;
      const live = g.phase === PLAY && h === g.active;
      if (g.phase === DONE && r) {
        const n = g.paid[h]! - g.bet[h]!;
        badge(ctx, RESULT[r]! + (n > 0 ? " +" + n : n < 0 ? " −" + -n : ""), x, Lp.hand + bz, r === WIN || r === NATURAL ? "#ffd36b" : r === PUSH ? "#c9d6f2" : "#f0a39a");
      } else badge(ctx, label(p), x, Lp.hand + bz, live && g.hands > 1 ? "#ffd36b" : "#f4efe4");
      if (live && g.hands > 1) {
        // The hand you play: a chalk-yellow box round it.
        const n = k.count(p), w = (n - 1) * Lp.gap + 1;
        T.quad(ctx, x - w / 2 - 0.12, Lp.hand - 0.82, x + w / 2 + 0.12, Lp.hand + 0.82, 0.03);
        ctx.strokeStyle = "#ffd23f";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    }
  }

  // ---- the round ----
  const BET_I = () => BETS.indexOf(g.base);
  function cycleBet(d: number) {
    if (g.phase === PLAY || g.phase === DEALER_TURN) return;
    const i = (BET_I() + d + BETS.length) % BETS.length;
    setBet(g, i);
    T.engine.events.emit("chip");
    T.hudDirty = true;
    T.wake();
  }
  function doDeal() {
    // Chips still moving from the last round: they land now.
    if (T.pending(T_PAY) || T.pending(T_SWEEP) || T.pending(T_HOME)) T.cancel(), home();
    if (!canDeal(g)) return void (broke(g) && showBroke());
    const r = deal(g);
    if (!r) return;
    T.cancel();
    shown = g.bank;
    bankS.set(shown);
    for (let h = 0; h < 2; h++) betS[h]!.set(0), winS[h]!.set(0);
    // The bet leaves your stack for the circle.
    betS[0]!.place(Lp.bank[0]!, Lp.bank[1]!);
    betS[0]!.set(g.bet[0]!);
    betS[0]!.slide(0, Lp.circle, T.engine.time, 0.4);
    place();
    dc.relayout();
    T.engine.events.emit("deal");
    T.engine.busy(2.2);
    if (r === END) T.later(1.4, T_PAY);
    T.hudDirty = true;
    T.wake();
  }
  function act(id: number) {
    if (g.phase !== PLAY) return;
    const h = g.active;
    if (id === K_HIT && canHit(g)) hit(g), T.engine.events.emit("card");
    else if (id === K_STAND) stand(g);
    else if (id === K_DOUBLE && canDouble(g)) {
      double(g);
      betS[h]!.set(g.bet[h]!);
      T.engine.events.emit("chip");
    } else if (id === K_SPLIT && canSplit(g)) {
      split(g);
      place();
      dc.relayout();
      betS[0]!.slide(circleX(0), Lp.circle, T.engine.time, 0.35);
      betS[1]!.place(Lp.bank[0]!, Lp.bank[1]!);
      betS[1]!.set(g.bet[1]!);
      betS[1]!.slide(circleX(1), Lp.circle, T.engine.time, 0.45);
      T.engine.events.emit("chip");
    } else return;
    shown = g.bank;
    bankS.set(shown);
    if ((g.phase as number) === DEALER_TURN) T.later(0.75, T_DEALER);
    T.engine.busy(1);
    T.hudDirty = true;
    T.wake();
  }
  function timer(w: number) {
    if (w === T_DEALER) {
      const r = dealerStep(g);
      if (r === END) T.later(0.5, T_PAY);
      else if (r) T.engine.events.emit("card"), T.later(r === FLIP ? 0.7 : 0.8, T_DEALER);
    } else if (w === T_PAY) pay();
    else if (w === T_SWEEP) sweep();
    else if (w === T_HOME) home();
    else if (w === T_FIRST) doDeal();
    T.hudDirty = true;
  }
  /** Settled: a win's chips come from the tray to sit beside the bet; the words pop. */
  function pay() {
    const t = T.engine.time, n = net(g);
    for (let h = 0; h < g.hands; h++) {
      const r = g.result[h]!, won = g.paid[h]! - g.bet[h]!;
      if (won > 0) winS[h]!.place(0, Lp.tray + 0.55), winS[h]!.set(won), winS[h]!.slide(circleX(h) + 0.78, Lp.circle - 0.05, t, 0.5);
      if (r === WIN || r === NATURAL) T.burst(circleX(h), Lp.circle, 14, 1.8);
    }
    const r0 = g.result[0]!;
    const word = g.hands === 1 ? (r0 === NATURAL ? "BLACKJACK!" : r0 === WIN ? "YOU WIN" : r0 === PUSH ? "PUSH" : r0 === BUST ? "BUST" : "DEALER WINS") : n > 0 ? "YOU WIN" : n < 0 ? "DEALER WINS" : "EVEN";
    T.toast(word, 0, (Lp.dealer + Lp.hand) / 2, n > 0 ? "#ffd36b" : n < 0 ? "#f0a39a" : "#c9d6f2");
    T.engine.events.emit(r0 === NATURAL && g.hands === 1 ? "natural" : n > 0 ? "win" : n < 0 ? "lose" : "push");
    T.say(sayRound());
    T.later(1.2, T_SWEEP);
  }
  /** Then the chips go: what is yours slides home, what is lost to the tray. */
  function sweep() {
    const t = T.engine.time;
    for (let h = 0; h < g.hands; h++) {
      const back = g.paid[h]! > 0;
      betS[h]!.slide(back ? Lp.bank[0]! : 0, back ? Lp.bank[1]! : Lp.tray + 0.55, t, 0.5);
      if (winS[h]!.amount > 0) winS[h]!.slide(Lp.bank[0]!, Lp.bank[1]!, t, 0.55);
    }
    T.engine.events.emit("chip");
    T.later(0.6, T_HOME);
  }
  function home() {
    for (let h = 0; h < 2; h++) betS[h]!.set(0), winS[h]!.set(0);
    shown = g.bank;
    bankS.set(shown);
    if (broke(g)) showBroke();
  }
  function showBroke() {
    endCard.hidden = false;
    T.say("Out of chips. A new table starts you on 1,000");
    again.focus({ preventScroll: true });
    T.hudDirty = true;
    T.wake();
  }
  function newTable() {
    T.cancel();
    endCard.hidden = true;
    seed = (seed + 1) >>> 0;
    // The cards go back to the shoe; then shuffle and deal.
    for (let p = DEALER; p <= DISCARD; p++) g.k.gather(p, SHOE, 0);
    reset(g, seed);
    shown = g.bank;
    bankS.set(shown);
    for (let h = 0; h < 2; h++) betS[h]!.set(0), winS[h]!.set(0);
    place();
    dc.relayout();
    T.later(0.9, T_FIRST);
    T.hudDirty = true;
    T.wake();
    T.play.focus({ preventScroll: true });
  }
  function sayRound() {
    const d = total(g.k, DEALER);
    let s = `Dealer ${d > 21 ? "busts with " + d : d}.`;
    for (let h = 0; h < g.hands; h++) s += ` ${g.hands > 1 ? "Hand " + (h + 1) : "You"}: ${total(g.k, pileOf(h))}, ${RESULT[g.result[h]!]!.toLowerCase()}.`;
    return s + ` Chips: ${g.bank}`;
  }

  // ---- the HUD and the keys ----
  const set = differ();
  function hudWrite() {
    const ph = g.phase, k = g.k;
    const t = !endCard.hidden ? "Out of chips" : ph === PLAY ? (g.hands > 1 ? `Hand ${g.active + 1}: your move` : "Your move") : ph === DEALER_TURN ? "Dealer plays" : ph === DONE ? (net(g) > 0 ? `You win ${net(g)}` : net(g) < 0 ? `Dealer wins ${-net(g)}` : "Push") : "Place your bet";
    if (set(0, t)) turnEl.textContent = t;
    if (set(1, shown)) nums[0]!.textContent = num(shown);
    const b = ph === PLAY || ph === DEALER_TURN || ph === DONE ? g.bet[0]! + (g.hands > 1 ? g.bet[1]! : 0) : g.base;
    if (set(2, b)) nums[1]!.textContent = num(b);
    const betting = ph === BET || ph === DONE;
    if (set(3, betting)) {
      betK!.hidden = dealK!.hidden = !betting;
      hitK!.hidden = standK!.hidden = doubleK!.hidden = splitK!.hidden = betting;
    }
    if (set(4, g.base)) betK!.textContent = "BET " + g.base;
    const busy = ph === DEALER_TURN;
    if (set(5, "" + canHit(g) + canDouble(g) + canSplit(g) + busy + canDeal(g))) {
      hitK!.disabled = !canHit(g);
      standK!.disabled = ph !== PLAY;
      doubleK!.disabled = !canDouble(g);
      splitK!.disabled = !canSplit(g);
      dealK!.disabled = !canDeal(g);
    }
    const p = pileOf(g.active), tot = k.count(p) ? total(k, p) : 0;
    const h = ph === PLAY ? (canSplit(g) ? "A pair: split it into two hands, or play it as one" : canDouble(g) && tot >= 9 && tot <= 11 ? `${tot}: a good time to double down` : `You have ${tot}${soft(k, p) ? " (soft)" : ""}: hit or stand`) : ph === DEALER_TURN ? "The dealer draws to 17" : ph === DONE ? "Pick a bet and deal again" : "Pick a bet, then DEAL";
    if (set(6, h)) hintEl.textContent = h;
    if (ph === PLAY && k.count(p)) say(`${g.hands > 1 ? "Hand " + (g.active + 1) + ": " : ""}${tot}. Dealer shows ${cardName(k.at(DEALER, 0))}`);
  }
  const say = (s: string) => T.say(s);

  // ---- input: tap the table to deal; the keys ----
  T.play.addEventListener("pointerup", () => {
    if (g.phase === BET || g.phase === DONE) doDeal();
    T.wake();
  }, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar, .ct-card");
    if (k === "m") return void (e.preventDefault(), T.toggleMute());
    if (k === "n") return void (e.preventDefault(), newTable());
    if (!endCard.hidden) return;
    const id = k === "h" ? K_HIT : k === "s" ? K_STAND : k === "d" ? K_DOUBLE : k === "p" ? K_SPLIT : -1;
    if (id >= 0) return void (e.preventDefault(), act(id));
    if (k === "b" || e.key === "ArrowRight" || e.key === "ArrowUp") return void (e.preventDefault(), cycleBet(1));
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") return void (e.preventDefault(), cycleBet(-1));
    if ((e.key === "Enter" || e.key === " ") && !onKey) e.preventDefault(), doDeal();
  }, sig);
  again.addEventListener("click", newTable, sig);

  // The poster (scripts/gallery-posters.mjs): a split pair of eights, one hand doubled, the dealer's hole card down.
  function poster() {
    T.V[2] = 0.6;
    T.V[0] = 1;
    T.cancel();
    reset(g, 20261115);
    const C = (r: number, s: number) => s * 13 + r;
    // Your 8♠ 8♥, the dealer's 6♦ (and a 10♣ under it); the split takes 3♣ and K♦, the 3 doubles onto a 9♥ (8 + 3 + 9 = 20).
    for (const c of [C(7, 0), C(5, 3), C(7, 1), C(9, 2), C(2, 2), C(12, 3), C(8, 1)].reverse()) g.k.move(c, SHOE, -1, 0);
    setBet(g, 2);
    deal(g);
    split(g);
    double(g);
    shown = g.bank;
    T.rebuild();
    bankS.set(shown);
    dc.show(T.engine.time);
    T.hudDirty = T.dirty = true;
  }

  T.start();
  bankS.set(shown);
  T.later(0.5, T_FIRST);
  return {
    engine: T.engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      return { phase: g.phase, bank: g.bank, shown, busy: T.pending(), card: !endCard.hidden };
    },
    poster,
    destroy: () => T.engine.destroy(),
  };
}

/** The poster: a split pair of eights, the first hand doubled, the dealer showing a six. */
export const posterAt = 2.2;
