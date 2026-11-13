// "Gin Rummy": you against a bot at a felt card table in the corner of a room (the card table series:
// Flip Match's table, lamp and mug). Ten cards each; your hand lies along your edge of the table,
// sorted with its melds first, each meld underlined in its own colour on the felt and the deadwood
// counted. Draw from the stock or take the discard, then tap a card to pick it and tap again (or
// DISCARD) to throw it; with 10 or less left KNOCK (with none, GIN). The bot plays its turn a card at
// a time. At the knock both hands are laid down in melds, the other side's loose cards go onto the
// knocker's melds, and the points are counted; first to 100. Keys: S the stock, T take the discard,
// the arrows pick a card, Enter throws it, K knocks, N a new game, M mutes. Light: a bright afternoon;
// dark: a lamp-lit night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/cards
// (the deck, the seeded shuffle, the deal, flips and moves in arcs, picking), @fzlt/core/diorama (the
// 3D), @fzlt/core/slot, @fzlt/core/sound. The rules and the bot are ./model.ts, pure and seeded
// (tests/gin-rummy.test.mjs). The cards on the table are a second deck that mirrors the game's, so a
// hand can be sorted and a showdown laid out meld by meld without touching the game. The table and the
// deck's art are ../felt/ (the series' shared parts); this file is the scene and the controls
// (tests/gin-rummy.mjs).
import { deck, dioramaCards, type DioramaCards, type PileLayout } from "../../../../src/cards";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { cardTable, differ, FONT, type Table } from "../felt/table";
import { paintBack, paintFace, cardName, short } from "../felt/deck52";
import {
  BOT, DEAD, DISCARD, DRAW, GAME_OVER, GIN, HAND_OVER, KNOCK, STOCK, THROW, UNDERCUT, YOU, arrange, botChoice, botWantsDiscard, canDiscard, canKnock, deadwoodWithout, discard, draw, knock, meldCount, newHand, restart, newGame, type Game,
} from "./model";

const K_MUTE = 0, K_STOCK = 1, K_TAKE = 2, K_THROW = 3, K_KNOCK = 4, K_NEXT = 5;
const T_BOTDRAW = 1, T_BOTTHROW = 2, T_SHOW = 3, T_FIRST = 4, T_END = 5;
// The table's piles: the stock, the discards, the two hands, and at a showdown each side's four melds and loose cards.
const VSTOCK = 0, VDISC = 1, VYOU = 2, VBOT = 3, VYM = 4, VYD = 8, VBM = 9, VBD = 13, VPILES = 14;
const MELD_COLORS = ["#ffd36b", "#5fe0b4", "#8cc4ff", "#ff9ec4"], INK = "#1f2433";

export type GinScene = SlotScene & {
  engine: Table["engine"];
  readonly g: Game;
  readonly state: { phase: number; turn: number; picked: number; busy: boolean; card: boolean; showing: boolean };
  /** Card c's centre on screen (CSS px from the stage's top left). */
  cardScreen(c: number): [number, number];
  refresh(): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): GinScene {
  const g: Game = newGame(1);
  const vk = deck({ size: 52, piles: VPILES });
  const lay: PileLayout[] = [];
  for (let p = 0; p < VPILES; p++) lay.push({ type: p <= VDISC ? "stack" : "row", x: 0, z: 0 });
  let dc!: DioramaCards, seed = 1, picked = -1, showing = false, moving = false;
  const G = { you: 2.45, bot: -2.55, mid: -0.05, gap: 0.66, bgap: 0.42, mgap: 0.5, ggap: 0.45, cw: 1, pile: 1.15 };
  const MELD = new Int8Array(52);

  const T = cardTable(stage, {
    label: "Gin Rummy: tap the stock or the discard to draw, tap a card twice to throw it, knock with 10 or less. Keys: S the stock, T take the discard, the arrows pick a card, Enter throws it, K knocks, N a new game, M mutes",
    hud: `<div class="ct-head"><p class="ct-top"><b class="ct-chip ct-turn">Your turn: draw</b><b class="ct-chip">You <span>0</span></b><b class="ct-chip">Bot <span>0</span></b><b class="ct-chip">Deadwood <span>0</span></b></p><p class="ct-hint"></p></div><div class="ct-card" role="dialog" aria-label="Game over" hidden><b>You win!</b><p></p><button type="button" class="bui-key ct-again">NEW GAME</button></div>`,
    keys: [
      { label: "♪", aria: "Mute (M)", id: K_MUTE },
      { label: "STOCK", aria: "Draw from the stock (S)", id: K_STOCK, c: "ct-go" },
      { label: "TAKE", aria: "Take the discard (T)", id: K_TAKE },
      { label: "DISCARD", aria: "Throw the picked card (Enter)", id: K_THROW, c: "ct-go" },
      { label: "KNOCK", aria: "Knock with the picked card (K)", id: K_KNOCK },
      { label: "NEXT HAND", aria: "Next hand (Enter)", id: K_NEXT, c: "ct-go" },
    ],
    onKey(id, down) {
      if (!down) return;
      if (id === K_MUTE) T.toggleMute();
      else if (id === K_STOCK) youDraw(false);
      else if (id === K_TAKE) youDraw(true);
      else if (id === K_THROW) youThrow(picked, false);
      else if (id === K_KNOCK) youThrow(picked, true);
      else nextHand();
    },
    cues: { deal: "deal", card: "flick", pick: "pick", knock: "knock", gin: "win", lose: "lose", nope: "nope" },
    notes: {
      flick: [[1500, 900, 0.035, 0, "triangle", 0.12]],
      pick: [[1900, 1700, 0.025, 0, "triangle", 0.07]],
      deal: [[900, 500, 0.03, 0, "triangle", 0.06], [900, 500, 0.03, 0.12, "triangle", 0.06], [900, 500, 0.03, 0.24, "triangle", 0.06], [900, 500, 0.03, 0.36, "triangle", 0.06]],
      knock: [[180, 140, 0.06, 0, "square", 0.12], [180, 140, 0.06, 0.12, "square", 0.12]],
      lose: [[300, 220, 0.14, 0, "triangle", 0.12]],
      nope: [[240, 200, 0.09, 0, "triangle", 0.1]],
    },
    felt: (tall) => (tall ? [6.8, 10.2, 0.15] : [11.4, 7.8, 0]),
    build(tall) {
      Object.assign(G, tall ? { you: 2.35, bot: -3.1, mid: -0.75, gap: 0.5, bgap: 0.36, mgap: 0.32, ggap: 0.22, cw: 0.84, pile: 0.95 } : { you: 2.45, bot: -2.55, mid: -0.05, gap: 0.66, bgap: 0.42, mgap: 0.5, ggap: 0.45, cw: 1, pile: 1.15 });
      place();
      dc = dioramaCards(T.dio, vk, { on: "felt", size: [G.cw, G.cw * 1.4], thick: 0.014, piles: lay, face: paintFace, back: paintBack, color: "#f6efe0", dur: 0.4, stagger: 0.06, arc: 0.8, motion: !T.RM });
      dc.show(T.engine.time);
    },
    view(tall, pts) {
      const ex = tall ? 3.25 : 4.9, z0 = G.bot - 0.9, z1 = G.you + (tall ? 1.35 : 1.1);
      pts.push(-ex, 0.1, z0, ex, 0.1, z0, -ex, 0.1, z1, ex, 0.1, z1);
      return tall ? [-6, 58] : [-12, 52];
    },
    feltArt,
    overlay,
    timer,
    pose(t) {
      const b = dc.show(t);
      if (b !== moving) (moving = b), (T.dirty = true);
      return b;
    },
    write: hudWrite,
  });
  const head = T.head, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const endCard = T.hudEl.querySelector(".ct-card") as HTMLElement, again = endCard.querySelector("button") as HTMLButtonElement;
  const [, stockK, takeK, throwK, knockK, nextK] = T.keys;
  const sig = { signal: T.engine.signal }, tmp = new Float64Array(3), F2 = new Float64Array(2);

  function place() {
    Object.assign(lay[VSTOCK]!, { x: -G.pile, z: G.mid, a: -0.06 });
    Object.assign(lay[VDISC]!, { x: G.pile, z: G.mid, a: 0.05 });
    Object.assign(lay[VYOU]!, { x: 0, z: G.you, gap: G.gap });
    Object.assign(lay[VBOT]!, { x: 0, z: G.bot, gap: G.bgap });
  }

  // ---- mirroring the game onto the table ----
  const WANT = new Int16Array(52), ORD = new Int16Array(52), SEQ = new Int16Array(52 * VPILES), LEN = new Int16Array(VPILES), GW = new Float64Array(VPILES);
  const meldOwner = (m: number) => (m < 4 ? g.knocker : g.knocker ^ 1);
  /** Each view pile's cards in order (SEQ), from the game. */
  function plan() {
    LEN.fill(0);
    const k = g.k, push = (p: number, c: number) => ((SEQ[p * 52 + LEN[p]!] = c), (LEN[p] = LEN[p]! + 1), (WANT[c] = p));
    for (let i = 0, n = k.count(STOCK); i < n; i++) push(VSTOCK, k.at(STOCK, i));
    for (let i = 0, n = k.count(DISCARD); i < n; i++) push(VDISC, k.at(DISCARD, i));
    if (showing) {
      // The showdown: melds (with what was laid off on them) and loose cards, each side on its edge, each group sorted.
      for (let r = 0; r < 13; r++)
        for (let s = 0; s < 4; s++) {
          const c = s * 13 + r, p = k.pile[c]!;
          if (p !== YOU && p !== BOT) continue;
          const who = p === YOU ? 0 : 1, m = g.meld[c]!, lo = g.layoff[c]!;
          if (lo >= 0) push((g.knocker ? VBM : VYM) + lo, c);
          else if (m >= 0) push((meldOwner(m) ? VBM : VYM) + (m & 3), c);
          else push(who ? VBD : VYD, c);
        }
      return;
    }
    // Your hand: its melds first (sets by suit, runs by rank), then the loose cards by rank.
    arrange(k, YOU, -1, MELD);
    const nm = meldCount();
    for (let m = 0; m <= nm; m++)
      for (let r = 0; r < 13; r++)
        for (let s = 0; s < 4; s++) {
          const c = s * 13 + r;
          if (k.pile[c] === YOU && (m < nm ? MELD[c] === m : MELD[c]! < 0)) push(VYOU, c);
        }
    for (let i = 0, n = k.count(BOT); i < n; i++) push(VBOT, k.at(BOT, i));
  }
  /** The showdown's groups along each edge, side by side, centred. */
  function groups() {
    for (let side = 0; side < 2; side++) {
      const base = side ? VBM : VYM, loose = side ? VBD : VYD;
      let w = 0, n = 0;
      for (let p = base; p < base + 4; p++) if (LEN[p]) (GW[p] = G.cw + (LEN[p]! - 1) * G.mgap), (w += GW[p]!), n++;
      if (LEN[loose]) (GW[loose] = G.cw + (LEN[loose]! - 1) * G.mgap), (w += GW[loose]!), n++;
      w += Math.max(0, n - 1) * G.ggap;
      let x = -w / 2;
      for (let p = base; p <= base + 4; p++) {
        const q = p === base + 4 ? loose : p;
        if (!LEN[q]) continue;
        Object.assign(lay[q]!, { x: x + GW[q]! / 2, z: side ? G.bot : G.you, gap: G.mgap });
        x += GW[q]! + G.ggap;
      }
    }
  }
  function sync() {
    plan();
    if (showing) groups();
    const k = g.k;
    // Cards that change pile, oldest change first; then each pile put in order.
    let m = 0;
    for (let c = 0; c < 52; c++) if (vk.pile[c] !== WANT[c]) ORD[m++] = c;
    for (let a = 1; a < m; a++) {
      const c = ORD[a]!;
      let b = a - 1;
      while (b >= 0 && k.stamp[ORD[b]!]! > k.stamp[c]!) (ORD[b + 1] = ORD[b]!), b--;
      ORD[b + 1] = c;
    }
    const face = (c: number) => (showing && WANT[c] !== VSTOCK ? (c === k.top(DISCARD) && g.end !== DEAD ? 0 : 1) : k.up[c]!);
    for (let a = 0; a < m; a++) vk.move(ORD[a]!, WANT[ORD[a]!]!, -1, face(ORD[a]!));
    for (let p = 0; p < VPILES; p++)
      for (let i = 0; i < LEN[p]!; i++) {
        const c = SEQ[p * 52 + i]!;
        if (vk.at(p, i) !== c) vk.move(c, p, i, face(c));
      }
    for (let c = 0; c < 52; c++) if (vk.up[c] !== face(c)) vk.flip(c, face(c));
    dc.relayout();
    T.hudDirty = true;
    T.wake();
  }

  // ---- the felt: the stock and discard places, the melds underlined in your hand ----
  function feltArt(ctx: CanvasRenderingContext2D) {
    const P = T.P, w = G.cw / 2 + 0.05, h = G.cw * 0.7 + 0.05;
    ctx.strokeStyle = P.chalk;
    ctx.lineWidth = 1.5;
    for (const x of [-G.pile, G.pile]) T.quad(ctx, x - w, G.mid - h, x + w, G.mid + h), ctx.stroke();
    T.text(ctx, "STOCK", -G.pile, G.mid + h + 0.22, 16, P.print);
    T.text(ctx, "DISCARD", G.pile, G.mid + h + 0.22, 16, P.print);
    T.text(ctx, "KNOCK AT 10 OR LESS · GIN 25 · GAME TO 100", 0, G.mid + h + 0.62, T.tall ? 15 : 17, P.print);
    // Each meld in your hand: a band of its colour under its cards.
    const n = LEN[VYOU]!;
    if (showing || !n) return;
    const z = G.you + G.cw * 0.7 + 0.18;
    for (let i = 0; i < n; ) {
      const m = MELD[SEQ[VYOU * 52 + i]!]!;
      let j = i;
      while (j + 1 < n && MELD[SEQ[VYOU * 52 + j + 1]!] === m) j++;
      if (m >= 0) {
        const x0 = (i - (n - 1) / 2) * G.gap - G.cw / 2 + 0.06, x1 = (j - (n - 1) / 2) * G.gap + G.cw / 2 - 0.06;
        T.quad(ctx, x0, z - 0.07, x1, z + 0.07);
        ctx.fillStyle = MELD_COLORS[m & 3]!;
        ctx.fill();
      }
      i = j + 1;
    }
  }

  // ---- the overlay: the card you picked, the deadwood and the result at a showdown ----
  function badge(ctx: CanvasRenderingContext2D, s: string, x: number, z: number, fill: string) {
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
    ctx.fillStyle = INK;
    ctx.fillText(s, tmp[0]!, tmp[1]! + 1);
  }
  function overlay(ctx: CanvasRenderingContext2D) {
    if (moving) return;
    if (picked >= 0 && vk.pile[picked] === VYOU) {
      const n = vk.count(VYOU), x = (vk.pos[picked]! - (n - 1) / 2) * G.gap, h = G.cw * 0.7;
      T.quad(ctx, x - G.cw / 2 - 0.05, G.you - h - 0.05, x + G.cw / 2 + 0.05, G.you + h + 0.05, 0.04);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    if (showing) {
      const zb = G.bot + G.cw * 0.7 + 0.42, zy = G.you - G.cw * 0.7 - 0.42;
      badge(ctx, `Deadwood ${g.dead[1]}`, 0, zb, "#f4efe4");
      badge(ctx, `Deadwood ${g.dead[0]}`, 0, zy, "#f4efe4");
    }
  }

  // ---- the game ----
  const youTurn = () => g.turn === 0 && !showing && endCard.hidden;
  function youDraw(fromDiscard: boolean) {
    if (!youTurn() || g.phase !== DRAW) return;
    if (!draw(g, fromDiscard)) return void T.engine.events.emit("nope");
    T.engine.events.emit("card");
    // Pick the card the bot would throw: a hint, yours to change.
    picked = botChoice(g);
    sync();
  }
  function youThrow(c: number, knocking: boolean) {
    if (!youTurn() || g.phase !== THROW || c < 0) return;
    if (knocking ? !canKnock(g, c) : !canDiscard(g, c)) return void T.engine.events.emit("nope");
    picked = -1;
    if (knocking) {
      knock(g, c);
      T.engine.events.emit("knock");
      return void ((showing = false), sync(), T.later(0.6, T_SHOW));
    }
    discard(g, c);
    T.engine.events.emit("card");
    sync();
    if ((g.phase as number) === HAND_OVER) T.later(0.5, T_SHOW);
    else T.later(0.8, T_BOTDRAW);
  }
  function pick(c: number) {
    if (!youTurn() || g.phase !== THROW) return;
    if (c === picked) return youThrow(c, false);
    picked = c;
    T.engine.events.emit("pick");
    T.hudDirty = true;
    T.wake();
  }
  function timer(w: number) {
    if (w === T_BOTDRAW) {
      if (g.turn !== 1 || g.phase !== DRAW) return;
      const take = botWantsDiscard(g);
      draw(g, take);
      T.engine.events.emit("card");
      if (take) T.toast("TAKES IT", G.pile, G.bot + 0.4, "#c9d6f2");
      sync();
      T.later(0.9, T_BOTTHROW);
    } else if (w === T_BOTTHROW) {
      const c = botChoice(g), d = deadwoodWithout(g, c);
      if (d === 0 || d <= 7 || (d <= 10 && g.k.count(STOCK) < 16)) {
        knock(g, c);
        T.engine.events.emit("knock");
        sync();
        T.later(0.6, T_SHOW);
      } else {
        discard(g, c);
        T.engine.events.emit("card");
        sync();
        if (g.phase === HAND_OVER) T.later(0.5, T_SHOW);
      }
    } else if (w === T_SHOW) show();
    else if (w === T_FIRST) newDeal();
    else if (w === T_END) endGame();
    T.hudDirty = true;
  }
  /** Lay both hands down and count. */
  function show() {
    showing = true;
    sync();
    const you = g.scorer === 0, word = g.end === GIN ? "GIN!" : g.end === UNDERCUT ? "UNDERCUT!" : g.end === KNOCK ? "KNOCK" : "DEAD HAND";
    T.toast(g.scorer < 0 ? word : `${word} ${you ? "+" : "BOT +"}${g.points}`, 0, G.mid, you ? "#ffd36b" : g.scorer < 0 ? "#c9d6f2" : "#f0a39a");
    if (you) for (let k = 0; k < 4; k++) T.burst(0, G.you - 0.6, 12, 1.8 + k * 0.3);
    T.engine.events.emit(you ? "gin" : g.scorer < 0 ? "nope" : "lose");
    T.say(sayHand());
    if (g.phase === GAME_OVER) T.later(1.8, T_END);
  }
  function endGame() {
    const you = g.score[0]! > g.score[1]!;
    (endCard.children[0] as HTMLElement).textContent = you ? "You win!" : "The bot wins";
    (endCard.children[1] as HTMLElement).textContent = `${g.score[0]} – ${g.score[1]} after ${g.hands} hand${g.hands === 1 ? "" : "s"}`;
    endCard.hidden = false;
    again.focus({ preventScroll: true });
  }
  function sayHand() {
    const who = g.knocker === 0 ? "You" : "The bot";
    if (g.scorer < 0) return "A dead hand: the stock ran out";
    return `${who} ${g.end === GIN ? "went gin" : "knocked"} with ${g.dead[g.knocker]}. ${g.end === UNDERCUT ? "Undercut! " : ""}${g.scorer === 0 ? "You score" : "The bot scores"} ${g.points}. You ${g.score[0]}, the bot ${g.score[1]}`;
  }
  function nextHand() {
    if (!showing || g.phase === GAME_OVER) return;
    showing = false;
    picked = -1;
    newHand(g);
    sync();
    T.engine.events.emit("deal");
    if (g.turn === 1) T.later(2.4, T_BOTDRAW);
  }
  function newDeal() {
    showing = false;
    picked = -1;
    endCard.hidden = true;
    restart(g, seed);
    sync();
    T.engine.events.emit("deal");
    T.engine.busy(2.4);
  }

  // ---- the HUD ----
  const set = differ();
  function hudWrite() {
    const ph = g.phase, mine = youTurn();
    const t = showing ? (g.scorer < 0 ? "Dead hand" : g.scorer === 0 ? `You score ${g.points}` : `Bot scores ${g.points}`) : mine ? (ph === DRAW ? "Your turn: draw" : "Your turn: throw") : "Bot's turn";
    if (set(0, t)) turnEl.textContent = t;
    if (set(1, g.score[0])) nums[0]!.textContent = "" + g.score[0];
    if (set(2, g.score[1])) nums[1]!.textContent = "" + g.score[1];
    const dw = showing ? g.dead[0]! : ph === THROW && mine && picked >= 0 ? deadwoodWithout(g, picked) : arrange(g.k, YOU);
    if (set(3, dw)) nums[2]!.textContent = "" + dw;
    const drawing = mine && ph === DRAW, throwing = mine && ph === THROW;
    if (set(4, "" + drawing + throwing + showing)) {
      stockK!.hidden = takeK!.hidden = !(drawing || (!throwing && !showing));
      throwK!.hidden = knockK!.hidden = !throwing;
      nextK!.hidden = !showing;
      stockK!.disabled = takeK!.disabled = !drawing;
    }
    const kn = throwing && picked >= 0 && canKnock(g, picked), gin = kn && deadwoodWithout(g, picked) === 0;
    if (set(5, "" + kn + gin + (picked >= 0) + (g.phase === GAME_OVER))) {
      knockK!.disabled = !kn;
      knockK!.textContent = gin ? "GIN" : "KNOCK";
      throwK!.disabled = !(throwing && picked >= 0 && canDiscard(g, picked));
      nextK!.disabled = g.phase === GAME_OVER;
    }
    const up = g.k.top(DISCARD);
    if (set(6, up)) takeK!.textContent = up >= 0 ? "TAKE " + short(up) : "TAKE";
    const h = showing ? (g.phase === GAME_OVER ? "Game over" : "Melds down, loose cards laid off: NEXT HAND") : drawing ? "Draw: the stock, or take the discard" : throwing ? (picked >= 0 ? `Throw the ${short(picked)}: ${deadwoodWithout(g, picked)} deadwood left${kn ? " — you can knock" : ""}` : "Pick a card to throw") : "The bot is thinking";
    if (set(7, h)) hintEl.textContent = h;
    if (throwing && picked >= 0) T.say(`Picked the ${cardName(picked)}`);
  }

  // ---- input: tap the stock, the discard or a card; the keys ----
  T.play.addEventListener("pointerup", (e) => {
    const c = dc.pick(e.offsetX, e.offsetY);
    if (showing) return void (g.phase !== GAME_OVER && nextHand());
    if (c >= 0 && vk.pile[c] === VYOU) return pick(c);
    let p = c >= 0 ? vk.pile[c]! : -1;
    if (p < 0 && T.toFelt(e.offsetX, e.offsetY, F2)) p = Math.abs(F2[1]! - G.mid) < G.cw ? (Math.abs(F2[0]! + G.pile) < G.cw * 0.6 ? VSTOCK : Math.abs(F2[0]! - G.pile) < G.cw * 0.6 ? VDISC : -1) : -1;
    if (p === VSTOCK) youDraw(false);
    else if (p === VDISC) youDraw(true);
    T.wake();
  }, sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar, .ct-card");
    if (k === "m") return void (e.preventDefault(), T.toggleMute());
    if (k === "n") return void (e.preventDefault(), (seed = (seed + 1) >>> 0), newDeal());
    if (!endCard.hidden) return;
    if (k === "s") return void (e.preventDefault(), youDraw(false));
    if (k === "t") return void (e.preventDefault(), youDraw(true));
    if (k === "k") return void (e.preventDefault(), youThrow(picked, true));
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && g.phase === THROW && youTurn()) {
      e.preventDefault();
      const n = vk.count(VYOU), i = picked >= 0 ? vk.pos[picked]! : 0, j = Math.max(0, Math.min(n - 1, i + (e.key === "ArrowLeft" ? -1 : 1)));
      picked = vk.at(VYOU, j);
      T.engine.events.emit("pick");
      T.hudDirty = true;
      return void T.wake();
    }
    if (e.key === "Enter" && !onKey) {
      e.preventDefault();
      if (showing) nextHand();
      else youThrow(picked, false);
    }
  }, sig);
  again.addEventListener("click", () => ((seed = (seed + 1) >>> 0), newDeal(), T.play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): your turn, a card picked, two melds underlined in your hand.
  function poster() {
    T.V[2] = 0.6;
    T.V[0] = 1;
    T.cancel();
    restart(g, 20261119);
    draw(g, false);
    picked = botChoice(g);
    showing = false;
    vk.reset();
    sync();
    T.rebuild();
    T.hudDirty = T.dirty = true;
  }

  T.start();
  sync();
  T.later(0.3, T_FIRST);
  return {
    engine: T.engine,
    accessible: true,
    get g() {
      return g;
    },
    get state() {
      return { phase: g.phase, turn: g.turn, picked, busy: T.pending() || moving, card: !endCard.hidden, showing };
    },
    cardScreen(c: number) {
      const p = vk.pile[c]!, L = lay[p]!, n = vk.count(p), x = L.type === "row" ? L.x! + (vk.pos[c]! - (n - 1) / 2) * (L.gap ?? 1) : L.x!;
      T.screen(x, 0.03, L.z!, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    /** After a test changes the game: mirror it. */
    refresh: () => sync(),
    poster,
    destroy: () => T.engine.destroy(),
  };
}

/** The poster: your turn, a card picked, your melds underlined. */
export const posterAt = 0.4;
