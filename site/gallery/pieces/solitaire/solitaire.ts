// "Solitaire": Klondike at a felt card table in the corner of a room (the card table series: Flip
// Match's table, lamp and mug). Twenty-eight cards are dealt in arcs into seven columns; the rest wait
// in the stock. Tap a card and it goes where it can (its foundation first, else a column), or drag it
// there; tap the stock to draw 1 or 3. Cards that are safe to send up go by themselves, a card left
// face down turns over, UNDO takes any change back, and when the last king lands the deck flies off
// the foundations into a spiral round the table. Keys: the arrows pick a pile, Enter plays it, Space
// draws, U undoes, T switches draw 1 / draw 3, N deals again, M mutes. Light: a bright afternoon;
// dark: a lamp-lit night.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back), @fzlt/core/cards
// (the deck, the seeded shuffle, the deal, flips and moves in arcs, picking), @fzlt/core/diorama (the
// 3D), @fzlt/core/slot, @fzlt/core/sound. The rules are ./model.ts, pure and seeded
// (tests/solitaire.test.mjs). The cards on the table are a second deck that mirrors the game's: each
// tableau place is its own pile, so a column fans down the felt (cards' layouts have no cascade yet).
// The table and the deck's art are ../felt/ (the series' shared parts); this file is the scene and the
// controls (tests/solitaire.mjs).
import { deck, dioramaCards, type DioramaCards, type PileLayout } from "../../../../src/cards";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { cardTable, differ, mmss, FONT, type Table } from "../felt/table";
import { paintBack, paintFace, cardName, suitPath, SUIT_GLYPHS } from "../felt/deck52";
import { FOUND, NO, PILES, STOCK, WASTE, WON, canPlace, draw, finish, isFound, isTab, movable, newGame, newRound, pick, safe, solved, tab, target, undo, move, won, type Game } from "./model";

const K_MUTE = 0, K_DRAW = 1, K_UNDO = 2, K_NEW = 3;
const T_AUTO = 1, T_WIN = 2, T_END = 3, T_FIRST = 4;
// The table's piles: the stock, three waste places (the top three fan out), the foundations, then
// twenty places a column and fifty-two for the finish.
const VSTOCK = 0, VW = 1, VF = 4, VT = 8, ROWS = 20, VWIN = VT + 7 * ROWS, VPILES = VWIN + 52;
const INK = "#1f2433";

export type SolitaireScene = SlotScene & {
  engine: Table["engine"];
  readonly g: Game;
  readonly state: { moves: number; busy: boolean; card: boolean; cursor: number; won: boolean };
  /** Pile p's top card's centre (or the empty place's) on screen (CSS px from the stage's top left). */
  pileScreen(p: number): [number, number];
  /** Card c's centre on screen. */
  cardScreen(c: number): [number, number];
  goes(c: number): number;
  refresh(): void;
  poster(): void;
  destroy(): void;
};

export function mount(stage: HTMLElement, _slot: HTMLElement, _first: SlotTap | null): SolitaireScene {
  const g: Game = newGame(1, 1);
  // The table's own deck: the same 52 cards, laid out place by place.
  const vk = deck({ size: 52, piles: VPILES });
  const lay: PileLayout[] = [];
  for (let p = 0; p < VPILES; p++) lay.push({ type: "stack", x: 0, z: 0 });
  let dc!: DioramaCards, seed = 1, t0 = -1, tEnd = 0, cursor = 6, kbd = false, winning = false;
  // Felt geometry, per stage shape: the column pitch, the top row's z, the columns' first z, how far down they may reach.
  let CW = 0.9, CH = 1.26;
  const G = { pitch: 1.2, top: -2.95, z0: -1.25, zEnd: 1.9, up: 0.36, down: 0.16, fan: 0.28 };

  const T = cardTable(stage, {
    label: "Solitaire: tap a card to send it where it goes, or drag it; tap the stock to draw. Or the arrow keys pick a pile, Enter plays it, Space draws, U undoes, T switches draw 1 and 3, N deals again, M mutes",
    hud: `<div class="ct-head"><p class="ct-top"><b class="ct-chip ct-turn">Klondike · draw 1</b><b class="ct-chip">Moves <span>0</span></b><b class="ct-chip">Time <span>0:00</span></b></p><p class="ct-hint"></p></div><div class="ct-card" role="dialog" aria-label="Solved" hidden><b>Solved!</b><p></p><button type="button" class="bui-key ct-again">DEAL AGAIN</button></div>`,
    keys: [
      { label: "♪", aria: "Mute (M)", id: K_MUTE },
      { label: "DRAW 1", aria: "Draw 1 or 3 (T)", id: K_DRAW },
      { label: "UNDO", aria: "Undo (U)", id: K_UNDO },
      { label: "NEW DEAL", aria: "New deal (N)", id: K_NEW },
    ],
    onKey(id, down) {
      if (!down) return;
      if (id === K_MUTE) T.toggleMute();
      else if (id === K_DRAW) toggleDraw();
      else if (id === K_UNDO) doUndo();
      else deal(seed + 1);
    },
    cues: { deal: "deal", card: "flick", up: "up", nope: "nope", draw: "draw", win: "win", undo: "undo" },
    notes: {
      flick: [[1500, 900, 0.035, 0, "triangle", 0.12]],
      draw: [[1200, 800, 0.03, 0, "triangle", 0.08]],
      deal: [[900, 500, 0.03, 0, "triangle", 0.06], [900, 500, 0.03, 0.12, "triangle", 0.06], [900, 500, 0.03, 0.24, "triangle", 0.06]],
      up: [[880, 1320, 0.08, 0, "triangle", 0.14]],
      undo: [[700, 450, 0.06, 0, "triangle", 0.1]],
      nope: [[240, 200, 0.09, 0, "triangle", 0.1]],
    },
    felt: (tall) => (tall ? [7.4, 9.0, 0.1] : [11.2, 7.8, 0]),
    build(tall) {
      Object.assign(G, tall ? { pitch: 1.0, top: -3.6, z0: -1.95, zEnd: 2.6, up: 0.4, down: 0.17, fan: 0.22 } : { pitch: 1.36, top: -2.95, z0: -1.05, zEnd: 2.3, up: 0.42, down: 0.18, fan: 0.32 });
      (CW = tall ? 0.9 : 1.04), (CH = CW * 1.4);
      place();
      dc = dioramaCards(T.dio, vk, { on: "felt", size: [CW, CH], thick: 0.012, piles: lay, face: paintFace, back: paintBack, color: "#f6efe0", dur: 0.36, stagger: 0.045, arc: 0.7, motion: !T.RM, shadow: 0.16 });
      dc.show(T.engine.time);
    },
    view(tall, pts) {
      const ex = 3 * G.pitch + CW / 2 + 0.1, z0 = G.top - 0.7, z1 = G.zEnd + 0.75;
      pts.push(-ex, 0.1, z0, ex, 0.1, z0, -ex, 0.1, z1, ex, 0.1, z1);
      return tall ? [-6, 62] : [-10, 58];
    },
    feltArt,
    overlay,
    timer,
    pose: (t) => dc.show(t),
    write: hudWrite,
  });
  const head = T.head, top = head.children[0] as HTMLElement, hintEl = head.children[1] as HTMLElement, turnEl = top.children[0] as HTMLElement, nums = top.querySelectorAll("span");
  const endCard = T.hudEl.querySelector(".ct-card") as HTMLElement, again = endCard.querySelector("button") as HTMLButtonElement;
  const drawK = T.keys[1]!, undoK = T.keys[2]!;
  const sig = { signal: T.engine.signal }, tmp = new Float64Array(3), F2 = new Float64Array(2);

  const colX = (j: number) => (j - 3) * G.pitch;
  /** The places on the felt that don't depend on the game: stock, waste, foundations, the win spiral. */
  function place() {
    Object.assign(lay[VSTOCK]!, { x: colX(0), z: G.top });
    for (let i = 0; i < 3; i++) Object.assign(lay[VW + i]!, { x: colX(1) + i * G.fan, z: G.top, a: 0 });
    for (let s = 0; s < 4; s++) Object.assign(lay[VF + s]!, { x: colX(3 + s), z: G.top });
    for (let j = 0; j < 7; j++) for (let i = 0; i < ROWS; i++) Object.assign(lay[VT + j * ROWS + i]!, { x: colX(j), z: G.z0 + i * G.up });
    for (let i = 0; i < 52; i++) {
      const a = i * 0.47 + 0.3, r = 0.55 + i * 0.062;
      Object.assign(lay[VWIN + i]!, { x: Math.cos(a) * r * (T.tall ? 0.78 : 1.45), z: (G.top + G.zEnd) / 2 + Math.sin(a) * r * (T.tall ? 0.95 : 0.9), a: -a - Math.PI / 2 });
    }
    spread();
  }
  /** Each column's places, from its cards: face-down ones close, face-up ones apart, closer when a column runs long. */
  function spread() {
    let moved = false;
    for (let j = 0; j < 7; j++) {
      const p = tab(j), n = g.k.count(p);
      let downs = 0, ups = 0;
      for (let i = 0; i < n - 1; i++) g.k.up[g.k.at(p, i)] ? ups++ : downs++;
      const need = downs * G.down + ups * G.up, room = G.zEnd - G.z0, s = need > room ? room / need : 1;
      let z = G.z0;
      for (let i = 0; i < ROWS; i++) {
        const L = lay[VT + j * ROWS + i]!;
        if (Math.abs(L.z! - z) > 1e-6) (L.z = z), (moved = true);
        const c = i < n ? g.k.at(p, i) : -1;
        z += (c >= 0 && !g.k.up[c] ? G.down : G.up) * s;
      }
    }
    return moved;
  }
  /** The table's place for the card at index i of game pile p (n cards). */
  function vpile(p: number, i: number, n: number) {
    if (p === STOCK) return VSTOCK;
    if (p === WASTE) return Math.max(VW, VW + 2 - (n - 1 - i));
    if (isFound(p)) return VF + p - FOUND;
    return VT + (p - tab(0)) * ROWS + i;
  }
  const WANT = new Int16Array(52), ORDER = new Int16Array(52);
  /** Mirror the game onto the table's deck: the cards that changed place move, in the order the game moved them. */
  function sync() {
    const k = g.k;
    for (let p = 0; p < PILES; p++) for (let i = 0, n = k.count(p); i < n; i++) WANT[k.at(p, i)] = vpile(p, i, n);
    let m = 0;
    for (let c = 0; c < 52; c++) if (vk.pile[c] !== WANT[c]) ORDER[m++] = c;
    // Oldest change first (insertion sort on the game's clock).
    for (let a = 1; a < m; a++) {
      const c = ORDER[a]!;
      let b = a - 1;
      while (b >= 0 && k.stamp[ORDER[b]!]! > k.stamp[c]!) (ORDER[b + 1] = ORDER[b]!), b--;
      ORDER[b + 1] = c;
    }
    for (let a = 0; a < m; a++) vk.move(ORDER[a]!, WANT[ORDER[a]!]!, -1, k.up[ORDER[a]!]!);
    for (let c = 0; c < 52; c++) if (vk.up[c] !== k.up[c]) vk.flip(c, k.up[c]!);
    if (spread()) dc.relayout();
    T.hudDirty = true;
    T.wake();
  }

  // ---- the felt: chalk places, the foundations' suits, the stock's turn-over mark ----
  function feltArt(ctx: CanvasRenderingContext2D) {
    const P = T.P, w = CW / 2 + 0.05, h = CH / 2 + 0.05;
    ctx.strokeStyle = P.chalk;
    ctx.lineWidth = 1.5;
    const box = (x: number, z: number) => (T.quad(ctx, x - w, z - h, x + w, z + h), ctx.stroke());
    box(colX(0), G.top);
    box(colX(1), G.top);
    for (let j = 0; j < 7; j++) box(colX(j), G.z0);
    for (let s = 0; s < 4; s++) {
      box(colX(3 + s), G.top);
      T.plane(ctx, colX(3 + s), G.top);
      ctx.fillStyle = P.chalk;
      suitPath(ctx, s, 0, 0, 22);
      ctx.fill();
      T.flat(ctx);
    }
    if (!g.k.count(STOCK) && g.k.count(WASTE)) {
      // Turn the waste over: a chalk circle arrow.
      T.plane(ctx, colX(0), G.top);
      ctx.strokeStyle = P.print;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 22, -2.6, 1.9);
      ctx.stroke();
      ctx.fillStyle = P.print;
      ctx.beginPath();
      ctx.moveTo(-22 * 0.86 - 9, -22 * 0.52), ctx.lineTo(-22 * 0.86 + 9, -22 * 0.52 - 2), ctx.lineTo(-22 * 0.86 + 1, -22 * 0.52 + 12);
      ctx.fill();
      T.flat(ctx);
    }
  }

  // ---- the overlay: the keyboard's pile, the card you drag and where it would land ----
  function spotBox(ctx: CanvasRenderingContext2D, p: number, pad: number) {
    const w = CW / 2 + pad, h = CH / 2 + pad;
    if (isTab(p)) {
      const j = p - tab(0), n = Math.max(1, g.k.count(p)), z1 = lay[VT + j * ROWS + n - 1]!.z!;
      T.quad(ctx, colX(j) - w, G.z0 - h, colX(j) + w, z1 + h, 0.05);
    } else {
      const x = p === STOCK ? colX(0) : p === WASTE ? lay[VW + Math.min(2, Math.max(0, g.k.count(WASTE) - 1))]!.x! : colX(3 + p - FOUND);
      T.quad(ctx, x - w, G.top - h, x + w, G.top + h, 0.05);
    }
  }
  function overlay(ctx: CanvasRenderingContext2D) {
    ctx.lineJoin = "round";
    if (kbd && endCard.hidden && !winning) {
      spotBox(ctx, cursor, 0.12);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    if (drag >= 0 && dragging) {
      if (drop >= 0) {
        spotBox(ctx, drop, 0.1);
        ctx.strokeStyle = "#3df5b0";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      // The run you hold, lifted over the felt under your finger, with its shadow.
      const p = g.k.pile[drag]!, from = g.k.pos[drag]!, n = g.k.count(p);
      for (let pass = 0; pass < 2; pass++)
        for (let i = from; i < n; i++) {
          const c = g.k.at(p, i), x = DX[0]! - GRAB[0]!, z = DX[1]! - GRAB[1]! + (i - from) * G.up;
          T.plane(ctx, pass ? x : x + 0.12, pass ? z : z + 0.1, pass ? 0.6 : 0.004);
          ctx.transform(CW, 0, 0, CW, 0, 0);
          ctx.translate(-50, -70);
          ctx.beginPath();
          ctx.roundRect(0, 0, 100, 140, 8);
          if (!pass) {
            ctx.fillStyle = "rgba(0,0,0,0.28)";
            ctx.fill();
          } else {
            ctx.save();
            ctx.clip();
            paintFace(ctx, c);
            ctx.restore();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          T.flat(ctx);
        }
    }
  }

  // ---- the game ----
  function deal(s: number) {
    seed = s >>> 0;
    T.reseed(seed * 31 + 7);
    T.cancel();
    endCard.hidden = true;
    winning = false;
    newRound(g, seed);
    t0 = -1;
    tEnd = 0;
    cancelDrag();
    sync();
    T.engine.events.emit("deal");
    T.engine.busy(2.6);
    T.later(2.2, T_AUTO);
  }
  function played(r: number) {
    if (t0 < 0) t0 = T.engine.time;
    sync();
    if (r === WON) return void T.later(0.5, T_WIN);
    T.cancel(T_AUTO);
    T.later(0.38, T_AUTO);
  }
  /** Send card c where it goes (a tap, Enter). */
  function send(c: number) {
    const to = c < 0 ? -1 : target(g, c);
    if (to < 0) return nope(c);
    const r = move(g, c, to);
    T.engine.events.emit(isFound(to) ? "up" : "card");
    if (isFound(to)) sparkAt(to);
    played(r);
  }
  function nope(c: number) {
    T.engine.events.emit("nope");
    if (c >= 0) {
      dc.pose(c, tmp);
      T.toast("NO MOVE", tmp[0]!, tmp[2]!, "#f0a39a");
    }
  }
  function sparkAt(p: number) {
    T.burst(colX(3 + p - FOUND), G.top, 8, 1.4);
  }
  function stockTap() {
    const r = draw(g);
    if (r === NO) return nope(-1);
    T.engine.events.emit("draw");
    played(r);
  }
  function doUndo() {
    if (winning || !endCard.hidden) return;
    T.cancel(T_AUTO);
    if (undo(g) === NO) return nope(-1);
    T.engine.events.emit("undo");
    sync();
  }
  function toggleDraw() {
    g.draw = g.draw === 1 ? 3 : 1;
    T.hudDirty = true;
    T.wake();
  }
  function timer(w: number) {
    if (w === T_AUTO) {
      if (winning || won(g)) return;
      // Safe cards go up by themselves; a solved game plays itself out.
      const c = safe(g) >= 0 ? safe(g) : solved(g) ? finish(g) : -1;
      if (c < 0) return;
      const to = FOUND + ((c / 13) | 0), r = move(g, c, to);
      T.engine.events.emit("up");
      sparkAt(to);
      sync();
      if (r === WON) T.later(0.5, T_WIN);
      else T.later(solved(g) ? 0.14 : 0.26, T_AUTO);
    } else if (w === T_WIN) {
      // The finish: kings first, the deck flies off the foundations into a spiral round the table.
      winning = true;
      tEnd = T.engine.time;
      let i = 0;
      for (let r = 12; r >= 0; r--) for (let s = 0; s < 4; s++) vk.move(s * 13 + r, VWIN + i++, -1, 1);
      T.engine.events.emit("win");
      for (let k = 0; k < 6; k++) T.burst(0, (G.top + G.zEnd) / 2, 14, 2.4 + k * 0.3);
      T.engine.busy(3.4);
      T.later(2.9, T_END);
    } else if (w === T_END) {
      (endCard.children[1] as HTMLElement).textContent = `${g.moves} moves · ${mmss(tEnd - t0)} · draw ${g.draw}`;
      endCard.hidden = false;
      T.say(`Solved in ${g.moves} moves`);
      again.focus({ preventScroll: true });
    } else if (w === T_FIRST) deal(seed);
    T.hudDirty = true;
  }

  // ---- the HUD ----
  const set = differ();
  function hudWrite() {
    const t = !endCard.hidden || winning ? "Solved!" : `Klondike · draw ${g.draw}`;
    if (set(0, t)) turnEl.textContent = t;
    if (set(1, g.moves)) nums[0]!.textContent = "" + g.moves;
    const tm = mmss(t0 < 0 ? 0 : (tEnd || T.engine.time) - t0);
    if (set(2, tm)) nums[1]!.textContent = tm;
    if (set(3, g.draw)) drawK.textContent = "DRAW " + g.draw;
    if (set(4, g.hn > 0 && !winning)) undoK.disabled = !(g.hn > 0 && !winning);
    const h = winning ? "Every card home" : g.moves ? (solved(g) ? "All face up: it plays itself out" : "Kings to empty columns; safe cards go up by themselves") : "Tap a card to send it, or drag it; tap the stock to draw";
    if (set(5, h)) hintEl.textContent = h;
    if (kbd) {
      const c = g.k.top(cursor);
      T.say(cursor === STOCK ? `Stock, ${g.k.count(STOCK)} cards` : c >= 0 ? `${pileName(cursor)}: ${g.k.up[c] ? cardName(c) : "face down"}` : `${pileName(cursor)}: empty`);
    }
  }
  const pileName = (p: number) => (p === WASTE ? "Waste" : isFound(p) ? `Foundation ${SUIT_GLYPHS[p - FOUND]}` : `Column ${p - tab(0) + 1}`);

  // ---- input: tap or drag a card; the arrows and Enter ----
  let drag = -1, dragging = false, drop = -1, downX = 0, downY = 0;
  const DX = new Float64Array(2), GRAB = new Float64Array(2);
  function cancelDrag() {
    drag = -1;
    dragging = false;
    drop = -1;
  }
  /** The game pile under felt point (x, z), or −1. */
  function spotAt(x: number, z: number) {
    const j = Math.round(x / G.pitch + 3);
    if (j < 0 || j > 6 || Math.abs(x - colX(j)) > G.pitch / 2) return -1;
    if (Math.abs(z - G.top) < CH / 2 + 0.2) return j === 0 ? STOCK : j === 1 || j === 2 ? WASTE : FOUND + j - 3;
    return z > G.z0 - CH / 2 - 0.1 ? tab(j) : -1;
  }
  T.play.addEventListener("pointerdown", (e) => {
    if (winning || !endCard.hidden) return;
    const c = dc.pick(e.offsetX, e.offsetY);
    kbd = false;
    cancelDrag();
    if (c >= 0 && g.k.pile[c] !== STOCK && movable(g, c)) {
      drag = c;
      (downX = e.offsetX), (downY = e.offsetY);
      T.toFelt(e.offsetX, e.offsetY, F2, 0.6);
      (GRAB[0] = F2[0]! - lay[vk.pile[c]!]!.x!), (GRAB[1] = F2[1]! - lay[vk.pile[c]!]!.z!);
      T.play.setPointerCapture(e.pointerId);
    }
  }, sig);
  T.play.addEventListener("pointermove", (e) => {
    if (drag < 0) return;
    if (!dragging && Math.hypot(e.offsetX - downX, e.offsetY - downY) < 8) return;
    dragging = true;
    if (T.toFelt(e.offsetX, e.offsetY, DX, 0.6)) {
      const p = spotAt(DX[0]! - GRAB[0]!, DX[1]! - GRAB[1]!);
      drop = p >= 0 && canPlace(g, drag, p) ? p : -1;
    }
    T.wake();
  }, sig);
  T.play.addEventListener("pointerup", (e) => {
    if (winning || !endCard.hidden) return;
    if (dragging) {
      const c = drag, p = drop;
      cancelDrag();
      if (p >= 0) {
        const r = move(g, c, p);
        T.engine.events.emit(isFound(p) ? "up" : "card");
        if (isFound(p)) sparkAt(p);
        played(r);
      } else T.engine.events.emit("nope"), T.wake();
      return;
    }
    cancelDrag();
    const c = dc.pick(e.offsetX, e.offsetY);
    if (c >= 0 && g.k.pile[c] === STOCK) return stockTap();
    if (c >= 0 && movable(g, c)) return send(c);
    if (c < 0 && T.toFelt(e.offsetX, e.offsetY, F2) && spotAt(F2[0]!, F2[1]!) === STOCK) return stockTap();
    if (c >= 0) nope(c);
    T.wake();
  }, sig);
  T.play.addEventListener("pointercancel", () => (cancelDrag(), T.wake()), sig);
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), onKey = (e.target as Element).closest?.(".gk-bar, .ct-card");
    if (k === "m") return void (e.preventDefault(), T.toggleMute());
    if (k === "n") return void (e.preventDefault(), deal(seed + 1));
    if (!endCard.hidden || winning) return;
    if (k === "u" || k === "z") return void (e.preventDefault(), doUndo());
    if (k === "t") return void (e.preventDefault(), toggleDraw());
    if (k === " " && !onKey) return void (e.preventDefault(), stockTap());
    const top = cursor < 6, dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, dz = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (dx || dz) {
      e.preventDefault();
      kbd = true;
      // Top row: stock, waste, the four foundations (over columns 1, 2, 4..7); bottom: the columns.
      const col = top ? (cursor <= WASTE ? cursor : cursor - FOUND + 3) : cursor - tab(0);
      const nc = Math.max(0, Math.min(6, col + dx)), row = dz ? (dz < 0 ? 0 : 1) : top ? 0 : 1;
      cursor = row ? tab(nc) : nc === 2 ? (dx < 0 ? WASTE : FOUND) : nc < 2 ? nc : FOUND + nc - 3;
      T.hudDirty = true;
      return void T.wake();
    }
    if (e.key === "Enter" && !onKey) {
      e.preventDefault();
      if (!kbd) return void ((kbd = true), (T.hudDirty = true), T.wake());
      if (cursor === STOCK) return stockTap();
      send(pick(g, cursor));
    }
  }, sig);
  again.addEventListener("click", () => (deal(seed + 1), T.play.focus({ preventScroll: true })), sig);

  // The poster (scripts/gallery-posters.mjs): a game under way, a few cards home.
  function poster() {
    T.V[2] = 0.6;
    T.V[0] = 1;
    T.cancel();
    newRound(g, 20261117);
    for (let n = 0; n < 40; n++) {
      const s = safe(g);
      if (s >= 0) {
        move(g, s, FOUND + ((s / 13) | 0));
        continue;
      }
      let did = false;
      for (let p = WASTE; p < PILES && !did; p++) {
        const c = isFound(p) ? -1 : pick(g, p);
        if (c >= 0 && (isFound(target(g, c)) || p === WASTE || g.k.pos[c]! > 0)) (did = move(g, c, target(g, c)) !== NO);
      }
      if (!did) draw(g);
    }
    vk.reset();
    sync();
    T.rebuild();
    t0 = T.engine.time - 95;
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
      return { moves: g.moves, busy: T.pending(T_AUTO) || T.pending(T_WIN) || T.pending(T_END), card: !endCard.hidden, cursor, won: won(g) };
    },
    pileScreen(p: number) {
      const n = g.k.count(p), x = p === STOCK ? colX(0) : p === WASTE ? lay[VW + 2]!.x! : isFound(p) ? colX(3 + p - FOUND) : colX(p - tab(0));
      const z = isTab(p) ? lay[VT + (p - tab(0)) * ROWS + Math.max(0, n - 1)]!.z! : G.top;
      T.screen(x, 0.03, z, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    cardScreen(c: number) {
      const L = lay[vk.pile[c]!]!;
      T.screen(L.x!, 0.03, L.z! + CH * 0.3, tmp);
      return [tmp[0]!, tmp[1]!];
    },
    /** Where card c goes on a tap (−1: nowhere). */
    goes: (c: number) => target(g, c),
    /** After a test lays out a position on the game: mirror it and let safe cards go up. */
    refresh() {
      sync();
      T.later(0.3, T_AUTO);
    },
    poster,
    destroy: () => T.engine.destroy(),
  };
}

/** The poster: a game under way, a few cards home. */
export const posterAt = 0.4;
