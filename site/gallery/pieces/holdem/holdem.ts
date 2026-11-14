// "Hold'em": Texas hold'em with play chips at a felt card table in the corner of a room (the card
// table series: Flip Match's table, lamp and mug), you against three bots (Mags, Otto and Juno), each
// with 1,000 chips and blinds of 10 and 20. Two cards each fly from the deck, the dealer button moves
// round, the flop, turn and river land in the middle; FOLD, CHECK or CALL, RAISE (the arrows size it)
// or ALL IN. The bots think a beat and say what they do. Chips slide in front of each seat and into
// the pot at the end of a street; at the showdown the bots' cards turn up, every hand is named and the
// winning five are outlined, and the pot slides to the winner. Play chips only: nothing to buy or win.
// Keys: F fold, C check or call, R raise, A all in, the arrows size the raise, Enter the next hand, N
// a new table, M mutes. Light: a bright afternoon; dark: a lamp-lit night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/cards
// (the deck, the seeded shuffle, the deal, flips and moves in arcs), @fzlt/core/diorama (the 3D),
// @fzlt/core/slot, @fzlt/core/sound. The rules, hand ranking and the bots are ./model.ts, pure and
// seeded (tests/holdem.test.mjs); the table, the deck's art and the chips are ../felt/ (the series'
// shared parts); this file is the scene and the controls (tests/holdem.mjs).
import { dioramaCards, type DioramaCards, type PileLayout } from "../../../../src/cards";
import type { DioramaObject } from "../../../../src/diorama";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { cardTable, differ, num, FONT, type Table } from "../felt/table";
import { paintBack, paintFace } from "../felt/deck52";
import { stack, type Stack } from "../felt/chips";
import {
  BB, BOARD, CALL, DECK, DID_ALLIN, DID_BLIND, DID_CALL, DID_CHECK, DID_FOLD, DID_RAISE, FOLD, HOLE, MUCK, OVER, PAID, PRE, RAISE, SB, SEATS, SHOWDOWN,
  act, botAct, canRaise, deal, maxRaiseTo, minRaiseTo, name, newGame, restart, toCall, type Game,
} from "./model";

const K_MUTE = 0, K_FOLD = 1, K_CALL = 2, K_RAISE = 3, K_ALLIN = 4, K_NEXT = 5;
const T_BOT = 1, T_COLLECT = 2, T_PAYOUT = 3, T_HOME = 4, T_FIRST = 5;
const NAMES = ["You", "Mags", "Otto", "Juno"], DID = ["", "FOLD", "CHECK", "CALL", "RAISE", "ALL IN", "BLIND"], INK = "#1f2433";

export type HoldemScene = SlotScene & {
  engine: Table["engine"];
  readonly g: Game;
  readonly state: { phase: number; toAct: number; raiseTo: number; busy: boolean; card: boolean };
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): HoldemScene {
  const g: Game = newGame(1);
  let seed = 1, dc!: DioramaCards, potS!: Stack, puck!: DioramaObject, raiseTo = 0, moving = false, payTo = -1, potShown = 0;
  const seatS: Stack[] = [], betS: Stack[] = [];
  const OB = new Int32Array(SEATS), tmp = new Float64Array(3);
  const lay: PileLayout[] = [];
  for (let p = 0; p <= MUCK; p++) lay.push({ type: p === DECK || p === MUCK ? "stack" : "row", x: 0, z: 0 });
  // Per seat (you, left, top, right): cards [x, z], chips behind, chips in, the button's place; the board, pot, deck, muck.
  const W = {
    seat: [0, 2.55, -4.5, -0.25, 0, -2.65, 4.5, -0.25], chips: [1.75, 2.6, -4.55, -1.75, -1.65, -2.65, 4.55, -1.75], bet: [-1.2, 1.6, -3.25, -0.25, 0, -1.6, 3.25, -0.25],
    puck: [-1.25, 2.85, -3.45, -1.05, 1.25, -2.7, 3.45, -1.05], board: -0.45, bgap: 1.12, pot: 1.1, deck: [2.6, -2.6], muck: [3.65, -2.5], gap: 0.55, cw: 1,
  };
  const TALL = {
    seat: [0, 3.3, -2.3, -2.0, 0, -4.0, 2.3, -2.0], chips: [1.5, 3.35, -2.35, -3.15, 1.45, -4.0, 2.35, -3.15], bet: [-1.25, 2.2, -2.3, -0.95, 0, -2.95, 2.3, -0.95],
    puck: [-1.15, 3.6, -1.4, -2.65, -1.2, -4.1, 1.4, -2.65], board: 0, bgap: 0.92, pot: 1.3, deck: [-2.55, -4.35], muck: [-2.55, -4.35], gap: 0.46, cw: 0.82,
  };
  let L = W;

  const T = cardTable(stage, {
    label: "Hold'em with play chips: fold, check or call, raise or go all in with the keys under the table (F fold, C check or call, R raise, A all in, the arrows size the raise, Enter the next hand, N a new table, M mutes)",
    hud: `<div class="ct-head"><p class="ct-top"><b class="ct-chip ct-turn">Your move</b><b class="ct-chip">Pot <span>0</span></b><b class="ct-chip">Blinds <span>10/20</span></b><b class="ct-chip">Hand <span>1</span></b></p><p class="ct-hint"></p></div><div class="ct-card" role="dialog" aria-label="Table over" hidden><b>Out of chips</b><p></p><button type="button" class="bui-key ct-again">NEW TABLE</button></div>`,
    keys: [
      { label: "♪", aria: "Mute (M)", id: K_MUTE },
      { label: "FOLD", aria: "Fold (F)", id: K_FOLD },
      { label: "CHECK", aria: "Check or call (C)", id: K_CALL, c: "ct-go" },
      { label: "RAISE", aria: "Raise (R; the arrows size it)", id: K_RAISE },
      { label: "ALL IN", aria: "All in (A)", id: K_ALLIN },
      { label: "NEXT HAND", aria: "Next hand (Enter)", id: K_NEXT, c: "ct-go" },
    ],
    onKey(id, down) {
      if (!down) return;
      if (id === K_MUTE) T.toggleMute();
      else if (id === K_NEXT) nextHand();
      else you(id);
    },
    cues: { deal: "deal", card: "flick", chip: "chip", fold: "fold", win: "win", lose: "lose" },
    notes: {
      flick: [[1500, 900, 0.035, 0, "triangle", 0.12]],
      deal: [[900, 500, 0.03, 0, "triangle", 0.06], [900, 500, 0.03, 0.12, "triangle", 0.06], [900, 500, 0.03, 0.24, "triangle", 0.06], [900, 500, 0.03, 0.36, "triangle", 0.06]],
      chip: [[2400, 2200, 0.025, 0, "square", 0.05], [2900, 2700, 0.025, 0.05, "square", 0.04]],
      fold: [[500, 380, 0.05, 0, "triangle", 0.08]],
      win: [[660, 660, 0.08, 0, "triangle", 0.16], [880, 990, 0.14, 0.08, "triangle", 0.16]],
      lose: [[300, 220, 0.14, 0, "triangle", 0.12]],
    },
    felt: (tall) => (tall ? [6.8, 10.2, 0.15] : [11.4, 7.8, 0]),
    build(tall) {
      L = tall ? TALL : W;
      place();
      dc = dioramaCards(T.dio, g.k, { on: "felt", size: [L.cw, L.cw * 1.4], thick: 0.014, piles: lay, face: paintFace, back: paintBack, color: "#f6efe0", dur: 0.42, stagger: 0.09, arc: 0.9, motion: !T.RM });
      seatS.length = betS.length = 0;
      for (let s = 0; s < SEATS; s++) {
        seatS.push(stack(T, "seat" + s, L.chips[s * 2]!, L.chips[s * 2 + 1]!, 12));
        betS.push(stack(T, "bet" + s, L.bet[s * 2]!, L.bet[s * 2 + 1]!, 8));
      }
      potS = stack(T, "potchips", 0, L.pot, 14);
      // The dealer button: a white puck.
      T.dio.cluster("puck", { at: puckAt });
      puck = T.put({ id: "puck", shape: "cyl", sides: 18, size: [0.5, 0.1, 0.5], on: "felt", pos: [0, 0, 0], color: "#f7f3ea", cluster: "puck", shadow: 0.3 });
      chips(false);
      dc.show(T.engine.time);
    },
    view(tall, pts) {
      const ex = tall ? 3.15 : 5.3, z0 = tall ? -4.75 : -3.4, z1 = tall ? 4.75 : 3.85;
      pts.push(-ex, 0.1, z0, ex, 0.1, z0, -ex, 0.1, z1, ex, 0.1, z1);
      return tall ? [-6, 60] : [-12, 54];
    },
    feltArt,
    overlay,
    timer,
    pose(t) {
      let b = dc.show(t);
      for (let s = 0; s < SEATS; s++) (b = betS[s]!.show(t) || b), (b = seatS[s]!.show(t) || b);
      b = potS.show(t) || b;
      if (b !== moving) (moving = b), (T.dirty = true);
      return b;
    },
    write: hudWrite,
  });
  const head = T.head, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const endCard = T.hudEl.querySelector(".ct-card") as HTMLElement, again = endCard.querySelector("button") as HTMLButtonElement;
  const [, foldK, callK, raiseK, allK, nextK] = T.keys;
  const sig = { signal: T.engine.signal }, puckAt = new Float64Array(3);

  function place() {
    for (let s = 0; s < SEATS; s++) Object.assign(lay[HOLE + s]!, { x: L.seat[s * 2], z: L.seat[s * 2 + 1], gap: L.gap });
    Object.assign(lay[BOARD]!, { x: 0, z: L.board, gap: L.bgap });
    Object.assign(lay[DECK]!, { x: L.deck[0], z: L.deck[1], a: 0.15 });
    Object.assign(lay[MUCK]!, { x: L.muck[0], z: L.muck[1], a: -0.3 });
  }
  /** The button's puck by its seat. */
  function puckTo() {
    const b = g.button, x = L.puck[b * 2]!, z = L.puck[b * 2 + 1]!;
    puck.pos[0] = x;
    puck.pos[2] = z;
    (puckAt[0] = x), (puckAt[1] = 1.6), (puckAt[2] = z + T.fz);
  }
  /** The chips on the table as the game has them (`street`: a street just ended, its chips slide in). */
  function chips(street: boolean) {
    for (let s = 0; s < SEATS; s++) seatS[s]!.set(g.stack[s]!);
    if (street) {
      const t = T.engine.time;
      for (let s = 0; s < SEATS; s++) if (OB[s]) betS[s]!.set(OB[s]!), betS[s]!.slide(0, L.pot, t, 0.45);
      T.later(0.5, T_COLLECT);
    } else {
      for (let s = 0; s < SEATS; s++) betS[s]!.set(g.bet[s]!), betS[s]!.place(L.bet[s * 2]!, L.bet[s * 2 + 1]!);
      potS.set(potShown);
      potS.place(0, L.pot);
    }
    puckTo();
  }

  // ---- the felt: the seats' places, the board's, the pot's ring ----
  function feltArt(ctx: CanvasRenderingContext2D) {
    const P = T.P, w = L.cw / 2 + 0.06, h = L.cw * 0.7 + 0.06;
    ctx.strokeStyle = P.chalk;
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) T.quad(ctx, i * L.bgap - w, L.board - h, i * L.bgap + w, L.board + h), ctx.stroke();
    T.ring(ctx, 0, L.pot, 0.62, 0.92);
    ctx.stroke();
    T.text(ctx, "POT", 0, L.pot + 0.82, 15, P.print);
  }

  // ---- the overlay: each seat's name, chips and last move; the hands named at the showdown ----
  function badge(ctx: CanvasRenderingContext2D, s: string, x: number, z: number, fill: string) {
    T.screen(x, 0.05, z, tmp);
    ctx.font = `900 ${T.tall ? 11 : 13}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(s).width + 14, h = T.tall ? 21 : 24, bx = Math.max(4, Math.min(T.dio.width - w - 4, tmp[0]! - w / 2)), by = tmp[1]! - h / 2;
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
    ctx.fillStyle = INK;
    ctx.fillText(s, bx + w / 2, tmp[1]! + 1);
  }
  const shown = () => g.phase === PAID || g.phase === OVER;
  function overlay(ctx: CanvasRenderingContext2D) {
    // The button's D on its puck.
    T.screen(puck.pos[0]!, 0.12, puck.pos[2]!, tmp);
    ctx.fillStyle = INK;
    ctx.font = `900 ${T.tall ? 10 : 12}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("D", tmp[0]!, tmp[1]! + 1);
    if (moving) return;
    const end = shown();
    for (let s = 0; s < SEATS; s++) {
      if (g.out[s]) continue;
      const x = L.seat[s * 2]!, z = L.seat[s * 2 + 1]! + L.cw * 0.7 + (T.tall ? 0.3 : 0.34);
      const sd = end && g.score[s]! >= 0 && !g.folded[s];
      const word = sd ? name(g.score[s]!) : shown() && g.won[s] ? `takes ${num(g.won[s]!)}` : DID[g.last[s]!]!;
      const label = (s ? NAMES[s] + " " : "") + num(g.stack[s]!) + (word ? " · " + word : "");
      badge(ctx, label, x, z, g.won[s] && shown() ? "#ffd36b" : g.toAct === s ? "#c9f5e2" : g.folded[s] ? "#d6d2e0" : "#f4efe4");
    }
    // The winning five, outlined.
    if (end && payTo >= 0 && g.score[payTo]! >= 0) {
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      for (let i = 0; i < 5; i++) {
        const c = g.best[payTo * 5 + i]!, p = g.k.pile[c]!, Lp = lay[p]!, n = g.k.count(p), x = Lp.x! + (g.k.pos[c]! - (n - 1) / 2) * (Lp.gap ?? 1), z = Lp.z!;
        T.quad(ctx, x - L.cw / 2, z - L.cw * 0.7, x + L.cw / 2, z + L.cw * 0.7, 0.05);
        ctx.stroke();
      }
    }
  }

  // ---- the game ----
  function after(prevPhase: number, prevHand: number) {
    const street = g.phase !== prevPhase || g.hand !== prevHand;
    // Folded hands go to the muck, face down.
    for (let s = 0; s < SEATS; s++) if (g.folded[s] && !g.out[s]) while (g.k.count(HOLE + s)) g.k.move(g.k.top(HOLE + s), MUCK, -1, 0);
    if (g.phase === SHOWDOWN || shown()) {
      // Every hand still in turns up.
      for (let s = 1; s < SEATS; s++) if (!g.folded[s] && g.score[s]! >= 0) for (let i = 0; i < 2; i++) g.k.flip(g.k.at(HOLE + s, i), 1);
    }
    let won = 0;
    payTo = -1;
    if (shown()) for (let s = 0; s < SEATS; s++) if (g.won[s]! > won) (won = g.won[s]!), (payTo = s);
    if (street) {
      chips(true);
      T.engine.events.emit("chip");
    } else chips(false);
    if (shown()) {
      T.later(1.1, T_PAYOUT);
      T.say(sayEnd());
    } else if (street) T.say(`${["Before the flop", "The flop", "The turn", "The river"][g.phase]}. Pot ${g.pot}`);
    if (street) raiseTo = 0;
    clampRaise();
    if (g.toAct > 0) T.later(street ? 1.3 : 0.75, T_BOT);
    T.hudDirty = true;
    T.wake();
  }
  function snapshot() {
    for (let s = 0; s < SEATS; s++) OB[s] = g.bet[s]!;
  }
  function you(id: number) {
    if (g.toAct !== 0) return;
    const ph = g.phase, hd = g.hand;
    snapshot();
    let r = 0;
    if (id === K_FOLD) r = act(g, FOLD);
    else if (id === K_CALL) r = act(g, CALL);
    else if (id === K_RAISE) r = canRaise(g, 0) ? act(g, RAISE, raiseTo) : 0;
    else if (id === K_ALLIN) r = act(g, canRaise(g, 0) ? RAISE : CALL, maxRaiseTo(g, 0));
    if (!r) return;
    T.engine.events.emit(id === K_FOLD ? "fold" : "chip");
    after(ph, hd);
  }
  function timer(w: number) {
    if (w === T_BOT) {
      const s = g.toAct;
      if (s <= 0) return;
      const ph = g.phase, hd = g.hand;
      snapshot();
      botAct(g);
      const did = g.last[s]!;
      T.toast(did === DID_RAISE ? `RAISE ${g.bet[s] || g.price}` : did === DID_CALL ? `CALL` : DID[did]!, L.seat[s * 2]!, L.seat[s * 2 + 1]!, did === DID_FOLD ? "#d6d2e0" : did === DID_RAISE || did === DID_ALLIN ? "#ffb38a" : "#c9f5e2");
      T.engine.events.emit(did === DID_FOLD ? "fold" : did === DID_CHECK ? "card" : "chip");
      after(ph, hd);
    } else if (w === T_COLLECT) {
      // The street's chips are in the pot.
      for (let s = 0; s < SEATS; s++) betS[s]!.set(g.bet[s]!), betS[s]!.place(L.bet[s * 2]!, L.bet[s * 2 + 1]!);
      potShown = shown() ? sumWon() : g.pot;
      potS.set(potShown);
    } else if (w === T_PAYOUT) {
      if (payTo >= 0) potS.slide(L.chips[payTo * 2]!, L.chips[payTo * 2 + 1]!, T.engine.time, 0.55);
      if (payTo === 0) for (let k = 0; k < 3; k++) T.burst(L.seat[0]!, L.seat[1]!, 12, 1.8 + k * 0.4);
      T.engine.events.emit(payTo === 0 ? "win" : "lose");
      T.later(0.6, T_HOME);
    } else if (w === T_HOME) {
      potShown = 0;
      potS.set(0);
      potS.place(0, L.pot);
      if (g.phase === OVER) endTable();
    } else if (w === T_FIRST) newTable();
    T.hudDirty = true;
  }
  const sumWon = () => g.won[0]! + g.won[1]! + g.won[2]! + g.won[3]!;
  function sayEnd() {
    let s = "";
    for (let t = 0; t < SEATS; t++) if (g.won[t]) s += `${NAMES[t]} ${t ? "takes" : "take"} ${g.won[t]}${g.score[t]! >= 0 ? " with " + name(g.score[t]!).toLowerCase() : ""}. `;
    return s + `Your chips: ${g.stack[0]}`;
  }
  function clampRaise() {
    if (g.toAct !== 0) return;
    raiseTo = Math.max(minRaiseTo(g, 0), Math.min(raiseTo, maxRaiseTo(g, 0)));
  }
  function sizeRaise(d: number) {
    if (g.toAct !== 0) return;
    raiseTo = Math.max(minRaiseTo(g, 0), Math.min(maxRaiseTo(g, 0), raiseTo + d * BB));
    T.hudDirty = true;
    T.wake();
  }
  function nextHand() {
    if (g.phase !== PAID || T.pending(T_PAYOUT) || T.pending(T_COLLECT)) return;
    T.cancel(T_HOME);
    potShown = 0;
    payTo = -1;
    deal(g);
    raiseTo = 0;
    clampRaise();
    chips(false);
    T.engine.events.emit("deal");
    if (g.toAct > 0) T.later(1.6, T_BOT);
    T.hudDirty = true;
    T.wake();
  }
  function endTable() {
    const won = !g.out[0];
    (endCard.children[0] as HTMLElement).textContent = won ? "You took the table" : "Out of chips";
    (endCard.children[1] as HTMLElement).textContent = won ? `Every chip at the table is yours after ${g.hand} hands.` : `Out after ${g.hand} hands. A new table starts everyone on 1,000.`;
    endCard.hidden = false;
    T.say(endCard.children[1]!.textContent!);
    again.focus({ preventScroll: true });
  }
  function newTable() {
    T.cancel();
    endCard.hidden = true;
    restart(g, seed);
    potShown = 0;
    raiseTo = 0;
    payTo = -1;
    OB.fill(0);
    chips(false);
    clampRaise();
    T.engine.events.emit("deal");
    if (g.toAct > 0) T.later(1.6, T_BOT);
    T.hudDirty = true;
    T.wake();
  }

  // ---- the HUD and the keys ----
  const set = differ();
  function hudWrite() {
    const mine = g.toAct === 0 && endCard.hidden, ph = g.phase, call = mine ? toCall(g, 0) : 0;
    const t = !endCard.hidden ? (g.out[0] ? "Out of chips" : "Table won") : shown() ? (payTo >= 0 ? `${NAMES[payTo]} ${payTo ? "takes" : "take"} ${num(g.won[payTo]!)}` : "Split") : mine ? "Your move" : g.toAct > 0 ? `${NAMES[g.toAct]} to act` : "Dealing";
    if (set(0, t)) turnEl.textContent = t;
    const pot = g.pot + g.bet[0]! + g.bet[1]! + g.bet[2]! + g.bet[3]!;
    if (set(1, shown() ? sumWon() : pot)) nums[0]!.textContent = num(shown() ? sumWon() : pot);
    if (set(2, g.hand)) nums[2]!.textContent = "" + g.hand;
    if (set(3, "" + mine + shown())) {
      foldK!.hidden = callK!.hidden = raiseK!.hidden = allK!.hidden = shown();
      nextK!.hidden = !shown();
      foldK!.disabled = callK!.disabled = allK!.disabled = !mine;
    }
    const cr = mine && canRaise(g, 0);
    if (set(4, "" + call + cr + raiseTo + mine)) {
      callK!.textContent = call ? `CALL ${num(call)}` : "CHECK";
      raiseK!.textContent = cr ? `RAISE ${num(raiseTo)}` : "RAISE";
      raiseK!.disabled = !cr;
    }
    if (set(5, g.phase === OVER)) nextK!.disabled = g.phase === OVER;
    const h = shown() ? (g.phase === OVER ? "Table over" : "Every hand named; the best five outlined. NEXT HAND") : mine ? (call ? `${num(call)} to call · raise to ${num(raiseTo)} (↑ ↓ to size it)` : `Check, or raise to ${num(raiseTo)} (↑ ↓ to size it)`) : ph === PRE ? `Blinds ${SB} and ${BB}` : "The bots are thinking";
    if (set(6, h)) hintEl.textContent = h;
  }

  // ---- input: the keys; tap the table for the next hand ----
  T.play.addEventListener("pointerup", () => {
    if (g.phase === PAID) nextHand();
  }, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar, .ct-card");
    if (k === "m") return void (e.preventDefault(), T.toggleMute());
    if (k === "n") return void (e.preventDefault(), (seed = (seed + 1) >>> 0), newTable());
    if (!endCard.hidden) return;
    const id = k === "f" ? K_FOLD : k === "c" ? K_CALL : k === "r" ? K_RAISE : k === "a" ? K_ALLIN : -1;
    if (id >= 0) return void (e.preventDefault(), you(id));
    if (e.key === "ArrowUp" || e.key === "ArrowRight") return void (e.preventDefault(), sizeRaise(1));
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") return void (e.preventDefault(), sizeRaise(-1));
    if (e.key === "Enter" && !onKey) e.preventDefault(), nextHand();
  }, sig);
  again.addEventListener("click", () => ((seed = (seed + 1) >>> 0), newTable(), T.play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): the turn is out, chips in front of the seats, your move.
  function poster() {
    T.V[2] = 0.6;
    T.V[0] = 1;
    T.cancel();
    restart(g, 20261121);
    for (let n = 0; n < 40 && g.phase < 2; n++) g.toAct === 0 ? act(g, CALL) : botAct(g);
    for (let n = 0; n < 8 && g.toAct > 0; n++) botAct(g);
    potShown = g.pot;
    clampRaise();
    T.rebuild();
    T.hudDirty = T.dirty = true;
  }

  T.start();
  T.later(0.3, T_FIRST);
  return {
    engine: T.engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      return { phase: g.phase, toAct: g.toAct, raiseTo, busy: T.pending() || moving, card: !endCard.hidden };
    },
    poster,
    destroy: () => T.engine.destroy(),
  };
}

/** The poster: the turn is out, chips in front of the seats, your move. */
export const posterAt = 0.4;
