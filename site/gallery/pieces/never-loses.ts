// "Never Loses" (dev-humor): tic-tac-toe against a smug bot. It really does play perfectly (minimax
// with alpha-beta over the nine cells, in place on one preallocated board), so the best you get is a
// draw. Beside the board, its "source": every move adds another `if` one step further right, until
// the ladder runs off the panel; PLAY AGAIN? nests deeper still. Lose and your X's fall off the
// board. Keys: 1–9 play a cell; arrows move between cells, Enter or Space plays; touch taps.
// Bricks: the kernel (settle; its ledger for every page write, so Recall gives the page back byte for
// byte), @fzlt/core/slot, @fzlt/core/sound. The game is `best()` / `winner()`, plain numbers
// (tests/never-loses.test.mjs: it never loses, from any line; no allocation).
import { createEngine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

const LINES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 3, 6, 1, 4, 7, 2, 5, 8, 0, 4, 8, 2, 4, 6];
const ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];
/** 1 you (X), 2 the bot (O): who has three in a row (0 nobody); its line goes in `at[0]`. */
export function winner(b: Int8Array, at?: Int8Array) {
  for (let i = 0; i < 24; i += 3) {
    const v = b[LINES[i]!]!;
    if (v && v === b[LINES[i + 1]!] && v === b[LINES[i + 2]!]) return at && (at[0] = i / 3), v;
  }
  return 0;
}
const pick = new Int8Array(1);
function mm(b: Int8Array, turn: number, depth: number, a: number, z: number): number {
  const w = winner(b);
  if (w) return w === 2 ? 10 - depth : depth - 10;
  let any = 0;
  for (let k = 0; k < 9; k++) {
    const i = ORDER[k]!;
    if (b[i]) continue;
    any = 1;
    b[i] = turn;
    const v = mm(b, 3 - turn, depth + 1, a, z);
    b[i] = 0;
    if (turn === 2 ? v > a : v < z) {
      if (turn === 2) (a = v), depth || (pick[0] = i);
      else z = v;
    }
    if (a >= z) break;
  }
  return any ? (turn === 2 ? a : z) : 0;
}
/** The bot's move on `b` (a perfect one: it never loses), or -1 when the board is full. */
export function best(b: Int8Array) {
  pick[0] = -1;
  mm(b, 2, 0, -99, 99);
  return pick[0]!;
}

const QUIPS = ["obviously", "saw it nine moves ago", "bold of you", "cute", "textbook", "as planned", "noted", "you again?", "this is fine", "trust me"];
const SAYS = ["Bold.", "Interesting. Wrong, but interesting.", "I would have done that too. To lose.", "Noted.", "Sure. Why not.", "Hm. No."];
const END = ["A draw. My favourite kind of win.", "Three in a row. As computed.", "Again? I'll add a few more cases."];

export type NeverScene = SlotScene & { engine: ReturnType<typeof createEngine>; readonly state: { board: string; turn: number; over: number; depth: number; wins: number; draws: number } };

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): NeverScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  stage.style.pointerEvents = "none"; // the stage is ours; the board under it takes the taps
  const L = engine.ledger, sig = { signal: engine.signal };
  const q = <T extends Element>(s: string) => slot.querySelector(s) as T;
  const boardEl = q<HTMLElement>(".nl-board"), say = q<HTMLElement>(".nl-say").firstChild as Text, code = q<HTMLElement>(".nl-code"), face = q<HTMLElement>(".nl-face");
  const tally = slot.querySelectorAll(".nl-tally b");
  const snd = sound(engine, { cues: { you: "click", bot: "fire", win: "win", draw: "end", again: "ready" }, volume: 0.1 });
  const B = new Int8Array(9), at = new Int8Array(1);
  // [0] turn (1 you, 2 the bot thinking), [1] think left, [2] over (0 no, 1 draw, 2 the bot won),
  // [3] depth, [4] wins, [5] draws, [6] measure, [7] cell px, [8] says, [9] quips, [10] end delay, [11] focus.
  const S = new Float64Array(12);
  (S[0] = 1), (S[3] = 1), (S[6] = 1);
  // Falling X's (a loss): y, vy, spin, angle per cell.
  const FY = new Float64Array(9), FV = new Float64Array(9), FS = new Float64Array(9), FA = new Float64Array(9), FALL = new Uint8Array(9);
  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < 9; i++) {
    const c = L.add(document.createElement("button"));
    c.type = "button";
    c.className = "nl-cell";
    c.style.cssText = `left:${(i % 3) * 33.33}%;top:${((i / 3) | 0) * 33.33}%`;
    c.tabIndex = i === 4 ? 0 : -1;
    c.setAttribute("aria-label", `Cell ${i + 1}, empty`);
    c.addEventListener("click", () => play(i), sig);
    cells.push(c);
  }
  boardEl.append(...cells);
  let strike: HTMLElement | null = null, card: HTMLElement | null = null;
  const ro = new ResizeObserver(() => ((S[6] = 1), engine.wake()));
  ro.observe(boardEl);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  /** One more line of source, `depth` steps in, typed in; the panel scrolls to keep it in view. */
  function line(html: string, depth = S[3]!) {
    const s = L.add(document.createElement("span"));
    s.className = "nl-new";
    s.innerHTML = "    ".repeat(depth) + html;
    code.append(s);
    S[6] = 1;
  }
  const kw = (w: string) => `<span class="nl-k">${w}</span>`, num = (n: number) => `<span class="nl-n">${n}</span>`, com = (t: string) => ` <span class="nl-c">// ${t}</span>`;
  const mark = (i: number, who: number) => {
    B[i] = who;
    const c = cells[i]!;
    c.innerHTML = `<b>${who === 1 ? "X" : "O"}</b>`;
    c.setAttribute("aria-label", `Cell ${i + 1}, ${who === 1 ? "yours" : "the bot's"}`);
    c.setAttribute("aria-disabled", "true");
    if (who === 2) c.dataset.o = "";
  };
  const tell = (s: string) => L.text(say, s);
  function play(i: number) {
    if (S[2] || S[0] !== 1 || B[i]) return;
    mark(i, 1);
    engine.events.emit("you");
    line(`${kw("if")} (you.took(${num(i + 1)})) {`);
    S[3] = S[3]! + 1;
    S[0] = 2;
    S[1] = 0.55;
    tell("…");
    engine.wake();
  }
  function botMove() {
    const w0 = winner(B), m = w0 ? -1 : best(B);
    if (m >= 0) {
      mark(m, 2);
      engine.events.emit("bot");
      line(`take(${num(m + 1)});${com(QUIPS[S[9]! % QUIPS.length]!)}`);
      S[9] = S[9]! + 1;
    }
    const w = winner(B, at), full = B.indexOf(0) < 0;
    if (w || full) {
      S[2] = w === 2 ? 2 : 1;
      S[w === 2 ? 4 : 5] = S[w === 2 ? 4 : 5]! + 1;
      L.text(tally[w === 2 ? 1 : 2]!.firstChild as Text, "" + S[w === 2 ? 4 : 5]);
      line(`${kw("return")} "${w === 2 ? "win" : "draw"}";${com(w === 2 ? "as computed" : "a draw is a win for me")}`);
      tell(END[w === 2 ? 1 : 0]!);
      engine.events.emit(w === 2 ? "win" : "draw");
      if (w === 2) {
        // The winning line, struck through; your X's fall off the board.
        const a = LINES[at[0]! * 3]!, z = LINES[at[0]! * 3 + 2]!, ax = (a % 3) - 1, ay = ((a / 3) | 0) - 1, zx = (z % 3) - 1, zy = ((z / 3) | 0) - 1;
        strike = L.add(document.createElement("i"));
        strike.className = "nl-strike";
        const d = Math.hypot(zx - ax, zy - ay);
        strike.style.cssText = `left:${50 + ((ax + zx) / 2) * 33.33}%;top:${50 + ((ay + zy) / 2) * 33.33}%;width:${d * 33.33 + 22}%;transform:translate(-50%,-50%) rotate(${Math.atan2(zy - ay, zx - ax)}rad)`;
        boardEl.append(strike);
        for (let k = 0; k < 9; k++) if (B[k] === 1) (FALL[k] = 1), (FY[k] = 0), (FV[k] = -60 - k * 9), (FS[k] = (k % 2 ? 1 : -1) * (2 + k * 0.3)), (FA[k] = 0);
      } else face.animate?.([{ rotate: "0deg" }, { rotate: "-9deg" }, { rotate: "7deg" }, { rotate: "0deg" }], { duration: 600 });
      S[10] = w === 2 ? 1.1 : 0.6;
    } else tell(SAYS[(S[9]! * 7) % SAYS.length]!);
    S[0] = 1;
  }
  function again() {
    for (let i = 0; i < 9; i++) {
      const c = cells[i]!;
      B[i] = 0;
      FALL[i] = 0;
      c.textContent = "";
      c.removeAttribute("aria-disabled");
      delete c.dataset.o;
      c.setAttribute("aria-label", `Cell ${i + 1}, empty`);
    }
    strike?.remove(), card?.remove();
    (strike = null), (card = null);
    S[2] = 0;
    line(`} ${kw("else if")} (you.wantRematch()) {${com("nobody ever learns")}`);
    line(`${kw("if")} (you.stillThinkYouCanWin()) {${com("TODO: refactor (never)")}`, S[3]! + 1);
    S[3] = S[3]! + 2;
    tell(END[2]!);
    engine.events.emit("again");
    cells[4]!.focus({ preventScroll: true });
  }
  function result() {
    card = L.add(document.createElement("div"));
    card.className = "nl-end";
    card.setAttribute("role", "status");
    card.innerHTML = `<b>${S[2] === 2 ? "BOT WINS" : "DRAW"}</b><span>${S[2] === 2 ? "as computed" : "best you can do"}</span><button type="button">PLAY AGAIN?</button>`;
    card.lastElementChild!.addEventListener("click", again, sig);
    boardEl.append(card);
    (card.lastElementChild as HTMLElement).focus({ preventScroll: true });
  }
  // Keys: 1–9 play; arrows move the focus between cells.
  slot.addEventListener("keydown", (e) => {
    const n = +e.key;
    if (n >= 1 && n <= 9 && !e.metaKey && !e.ctrlKey && !e.altKey) return void (e.preventDefault(), play(n - 1));
    const i = cells.indexOf(e.target as HTMLButtonElement), d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -3 : e.key === "ArrowDown" ? 3 : 0;
    if (i < 0 || !d) return;
    e.preventDefault();
    const j = (i + d + 9) % 9;
    cells[i]!.tabIndex = -1;
    cells[j]!.tabIndex = 0;
    cells[j]!.focus();
  }, sig);

  let shift = "";
  engine.add({
    read() {
      if (!S[6]) return;
      S[6] = 0;
      const r = boardEl.getBoundingClientRect();
      S[7] = r.width / 3;
      // Keep the newest line in view: the code scrolls up by what overflows its panel.
      const over = code.scrollHeight - (code.parentElement!.clientHeight - code.offsetTop);
      shift = over > 0 ? `translateY(${-over}px)` : "";
      if (first) {
        // The tap that woke the piece plays the cell under it.
        const f = slot.getBoundingClientRect(), x = first.x + f.left - r.left, y = first.y + f.top - r.top;
        first = null;
        if (x >= 0 && y >= 0 && x < r.width && y < r.height) play(((y / S[7]!) | 0) * 3 + ((x / S[7]!) | 0));
      }
    },
    step(e, dt) {
      if (S[0] === 2) {
        S[1] = S[1]! - dt;
        if (S[1]! <= 0) botMove();
        e.busy();
      }
      if (S[10]! > 0) {
        S[10] = S[10]! - dt;
        if (S[10]! <= 0) (S[10] = 0), result();
        e.busy();
      }
      // Falling X's: gravity, a bounce off the board's bottom edge, then off the stage.
      const cell = S[7]! || 60;
      for (let k = 0; k < 9; k++) {
        if (!FALL[k]) continue;
        FV[k] = FV[k]! + 900 * dt;
        FY[k] = FY[k]! + FV[k]! * dt;
        FA[k] = FA[k]! + FS[k]! * dt;
        const floor = (2 - ((k / 3) | 0)) * cell + cell * 0.2;
        if (FY[k]! > floor && FV[k]! > 0 && FALL[k] === 1) (FY[k] = floor), (FV[k] = -FV[k]! * 0.45), (FALL[k] = 2), (FS[k] = -FS[k]! * 1.6);
        if (FY[k]! < cell * 6) e.busy();
        else FALL[k] = 0;
      }
    },
    render() {
      if (code.style.transform !== shift) L.style(code, "transform", shift);
      for (let k = 0; k < 9; k++) {
        if (!FALL[k]) continue;
        const b = cells[k]!.firstChild as HTMLElement | null;
        if (b) b.style.transform = `translateY(${FY[k]!.toFixed(1)}px) rotate(${FA[k]!.toFixed(2)}rad)`;
      }
    },
  });
  engine.start();
  return {
    engine,
    accessible: true,
    get state() {
      return { board: Array.from(B).join(""), turn: S[0]!, over: S[2]!, depth: S[3]!, wins: S[4]!, draws: S[5]! };
    },
    destroy: () => engine.destroy(),
  };
}
