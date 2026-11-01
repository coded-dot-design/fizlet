// Tiny Byte Runner: a ten-second taste of Byte Runner (domvirus.com/games/byte-runner/). The page is
// the board: trails of food run along a little web page's gutters, and the round green frog chomps
// along them, but it can leave the trails and eat the page's letters too (a real change, through
// the ledger: the letter is gone till Recall). Three flies chase it: a chaser, an interceptor that
// heads it off, a roamer. Eat a glowing power square and the flies turn blue and edible for four
// seconds. Steer with the arrow keys (or WASD), a swipe, or a tap on the side you want to go.
// Twelve seconds and three lives; eat every crumb and the page is clear. Then Recall puts every
// letter back and the scene sleeps until the next tap. Art: Byte Runner's frog and fly pixels.
// Bricks: the kernel (fixed step, settle, the ledger for every page write) and @fzlt/core/sound (a
// tiny synth, silent until a gesture; a mute key appears after the first one). The simulation is
// plain numbers (`runner`, no DOM): its step allocates nothing (tests/tiny-byte-runner.test.mjs).
import { createEngine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

/** Art units: the stage is W across, H down (16:9). */
export const W = 160, H = 90;
export const ROUND = 12, POWER = 4;
export const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
const ML = 56, MD = 72, MF = 3, MP = 120, MW = 8;
// State slots.
export const MODE = 0, T = 1, LEFT = 2, FX = 3, FY = 4, DIR = 5, WANT = 6, SCORE = 7, LIVES = 8, POW = 9, SAFE = 10, END = 11, BACK = 12, CHOMP = 13, EATEN = 14, CRUMBS = 15, SHAKE = 16, CHAIN = 17;
/** Sound events counted by the step (the mount plays and clears them). */
export const E_DOT = 0, E_LETTER = 1, E_POWER = 2, E_FLY = 3, E_HURT = 4, E_WIN = 5, E_END = 6;
/** Pop-up words. */
export const WORDS = ["+200", "+400", "+800", "POWER!", "PAGE CLEAR!", "TIME!", "RECALL", "GAME OVER", "+5", "OUCH"];
/** Directions: right, down, left, up. */
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
/** The food trails (art units): three rows along the gutters, two columns at the sides. */
const ROWS = [8, 40, 70], COLS = [8, 152];

/** The simulation: crumbs, power squares, letters, the frog, three flies; plain numbers, seeded. */
export function runner(seed = 1) {
  let r = seed >>> 0 || 1;
  const R = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const S = new Float64Array(24);
  const EV = new Uint8Array(8);
  // Crumbs: position, kind (1 crumb, 2 power), eaten.
  const DXs = new Float32Array(MD), DYs = new Float32Array(MD), DK = new Uint8Array(MD), DE = new Uint8Array(MD);
  let nd = 0;
  const crumb = (x: number, y: number, k: number) => {
    for (let i = 0; i < nd; i++) if (Math.abs(DXs[i]! - x) < 4 && Math.abs(DYs[i]! - y) < 4) return;
    if (nd < MD) (DXs[nd] = x), (DYs[nd] = y), (DK[nd] = k), nd++;
  };
  for (const y of ROWS) for (let x = 8; x <= 152; x += 9) crumb(x, y, (x === 8 || x >= 152) && y !== 40 ? 2 : 1);
  for (const x of COLS) for (let y = 8; y <= 70; y += 8) crumb(x, y, 1);
  // Letters: box (art units), eaten, flash.
  const LX = new Float32Array(ML), LY = new Float32Array(ML), LW = new Float32Array(ML), LH = new Float32Array(ML), LS = new Uint8Array(ML), LF = new Float32Array(ML);
  // Flies: position, velocity, kind (0 chaser, 1 interceptor, 2 roamer), state (0 away, 1 flying, 2 eaten), timer.
  const QX = new Float32Array(MF), QY = new Float32Array(MF), QU = new Float32Array(MF), QV = new Float32Array(MF), QS = new Uint8Array(MF), QT = new Float32Array(MF);
  const PL = new Float32Array(MP), PX = new Float32Array(MP), PY = new Float32Array(MP), PU = new Float32Array(MP), PV = new Float32Array(MP), PC = new Uint8Array(MP);
  const WL = new Float32Array(MW), WX = new Float32Array(MW), WY = new Float32Array(MW), WK = new Uint8Array(MW), WC = new Uint8Array(MW);
  const n = { letters: 0, crumbs: nd };
  let pw = 0, ww = 0;
  (S[FX] = -10), (S[FY] = 8), (S[DIR] = 0), (S[WANT] = 0), (S[LIVES] = 3);

  function spark(x: number, y: number, k: number, speed: number, c: number) {
    for (let i = 0; i < k; i++) {
      const a = R() * 6.2832, v = speed * (0.35 + R() * 0.65);
      pw = (pw + 1) % MP;
      (PL[pw] = 0.3 + R() * 0.35), (PX[pw] = x), (PY[pw] = y), (PU[pw] = Math.cos(a) * v), (PV[pw] = Math.sin(a) * v), (PC[pw] = c);
    }
  }
  function say(k: number, x: number, y: number, c: number) {
    ww = (ww + 1) % MW;
    (WL[ww] = 0.9), (WX[ww] = x), (WY[ww] = y), (WK[ww] = k), (WC[ww] = c);
  }
  /** Fly f comes in from a corner. */
  function fly(f: number) {
    const c = (f + ((R() * 2) | 0)) % 4;
    (QS[f] = 1), (QX[f] = c & 1 ? W + 6 : -6), (QY[f] = c & 2 ? H - 14 : 4), (QU[f] = 0), (QV[f] = 0), (QT[f] = R() * 6);
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[LIVES] = 3), (S[POW] = 0), (S[SAFE] = 0), (S[END] = 0), (S[BACK] = 0), (S[EATEN] = 0), (S[CRUMBS] = 0), (S[CHAIN] = 0);
    for (let i = 0; i < nd; i++) DE[i] = 0;
    for (let i = 0; i < n.letters; i++) LS[i] = 0;
    for (let f = 0; f < MF; f++) (QS[f] = 0), (QT[f] = 0.6 + f * 0.9);
    if (S[FX]! < 0) (S[FX] = 8), (S[FY] = 8);
  }
  function finish(word: number) {
    (S[MODE] = DONE), (S[END] = 0), (S[BACK] = 0);
    say(word, W / 2, 30, word === 4 ? 2 : 1);
    EV[word === 4 ? E_WIN : E_END]!++;
    for (let f = 0; f < MF; f++) QS[f] === 1 && spark(QX[f]!, QY[f]!, 8, 40, 3), (QS[f] = 0);
  }

  /** One fixed step of `dt` seconds. Returns true while anything moves (the engine stays awake). */
  function step(dt: number) {
    S[T] = S[T]! + dt;
    const mode = S[MODE]!;
    let live = 0;
    if (mode === INTRO) {
      // The frog hops in along the top trail, eats a few crumbs, and waits.
      if (S[FX]! < 30) (S[FX] = S[FX]! + 30 * dt), (S[CHOMP] = S[CHOMP]! + dt * 10), live++;
      eat();
      if (S[T]! > 2.4) S[MODE] = IDLE;
      live++;
    } else if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      // Turn when asked (a turn onto a trail snaps to it), then run.
      const want = S[WANT]!;
      if (want !== S[DIR]) {
        if (DX[want]) S[DIR] = want;
        else S[DIR] = want;
        snap();
      }
      const d = S[DIR]!, v = 44;
      S[FX] = Math.max(6, Math.min(W - 6, S[FX]! + DX[d]! * v * dt));
      S[FY] = Math.max(5, Math.min(H - 16, S[FY]! + DY[d]! * v * dt));
      S[CHOMP] = S[CHOMP]! + dt * 12;
      eat();
      if (S[POW]! > 0) S[POW] = Math.max(0, S[POW]! - dt);
      if (S[SAFE]! > 0) S[SAFE] = Math.max(0, S[SAFE]! - dt);
      // The flies: in on their timers, then after the frog (or away from it while it glows).
      for (let f = 0; f < MF; f++) {
        if (QS[f] !== 1) {
          QT[f] = QT[f]! - dt;
          if (QT[f]! <= 0) fly(f);
          continue;
        }
        QT[f] = QT[f]! + dt;
        let tx = S[FX]!, ty = S[FY]!;
        if (f === 1) (tx += DX[d]! * 22), (ty += DY[d]! * 22);
        else if (f === 2) (tx = W / 2 + Math.cos(QT[f]! * 0.9) * 60), (ty = 40 + Math.sin(QT[f]! * 1.3) * 26);
        let ax = tx - QX[f]!, ay = ty - QY[f]!;
        const k = 1 / (Math.sqrt(ax * ax + ay * ay) + 0.001), flee = S[POW]! > 0 ? -1 : 1;
        (ax *= k * flee), (ay *= k * flee);
        const sp = (S[POW]! > 0 ? 20 : 24 + (1 - S[LEFT]! / ROUND) * 8) * (f === 2 ? 0.85 : 1);
        QU[f] = QU[f]! + (ax * sp - QU[f]!) * Math.min(1, dt * 3);
        QV[f] = QV[f]! + (ay * sp - QV[f]!) * Math.min(1, dt * 3);
        QX[f] = Math.max(-4, Math.min(W + 4, QX[f]! + QU[f]! * dt + Math.sin(QT[f]! * 9 + f) * 6 * dt));
        QY[f] = Math.max(2, Math.min(H - 12, QY[f]! + QV[f]! * dt + Math.cos(QT[f]! * 11 + f) * 6 * dt));
        const dx = QX[f]! - S[FX]!, dy = QY[f]! - S[FY]!;
        if (dx * dx + dy * dy > 36) continue;
        if (S[POW]! > 0) {
          // Eaten: 200, 400, 800 in a chain.
          const c = Math.min(2, S[CHAIN]!);
          S[SCORE] = S[SCORE]! + (200 << c);
          S[CHAIN] = S[CHAIN]! + 1;
          say(c, QX[f]!, QY[f]! - 6, 0);
          spark(QX[f]!, QY[f]!, 12, 50, 0);
          EV[E_FLY]!++;
          (QS[f] = 2), (QT[f] = 2.2);
        } else if (S[SAFE]! <= 0) {
          S[LIVES] = S[LIVES]! - 1;
          (S[SAFE] = 1.6), (S[SHAKE] = 0.8);
          EV[E_HURT]!++;
          say(9, S[FX]!, S[FY]! - 7, 1);
          spark(S[FX]!, S[FY]!, 14, 55, 1);
          // The flies are knocked back to the edges.
          for (let g = 0; g < MF; g++) if (QS[g] === 1) QX[g] = QX[g]! < W / 2 ? -6 : W + 6;
          if (S[LIVES]! <= 0) finish(7);
        }
      }
      for (let f = 0; f < MF; f++) if (QS[f] === 2) (QT[f] = QT[f]! - dt), QT[f]! <= 0 && fly(f);
      if (S[MODE] === PLAY && S[CRUMBS]! >= nd) (S[SCORE] = S[SCORE]! + Math.round(S[LEFT]! * 100)), finish(4);
      else if (S[MODE] === PLAY && S[LEFT] === 0) finish(5);
      live++;
    } else if (mode === DONE) {
      // A beat, then Recall: the letters come back one by one.
      S[END] = S[END]! + dt;
      live++;
      if (S[END]! > 1.3) {
        if (!S[BACK]) say(6, W / 2, 40, 0);
        S[BACK] = S[BACK]! + dt;
        let left = -1;
        for (let i = 0; i < n.letters && left < 0; i++) if (LS[i]) left = i;
        if (left >= 0 && S[BACK]! >= 0.04) (S[BACK] = 1e-9), (LS[left] = 0), (LF[left] = 0.3), spark(LX[left]! + LW[left]! / 2, LY[left]! + LH[left]! / 2, 2, 20, 2);
        else if (left < 0 && S[END]! > 2.3) S[MODE] = IDLE;
      }
    }
    for (let i = 0; i < n.letters; i++) if (LF[i]! > 0) (LF[i] = Math.max(0, LF[i]! - dt)), live++;
    for (let p = 0; p < MP; p++) {
      if (PL[p]! <= 0) continue;
      live++;
      PL[p] = PL[p]! - dt;
      (PX[p] = PX[p]! + PU[p]! * dt), (PY[p] = PY[p]! + PV[p]! * dt);
    }
    for (let w = 0; w < MW; w++) if (WL[w]! > 0) (WL[w] = WL[w]! - dt), (WY[w] = WY[w]! - 9 * dt), live++;
    if (S[SHAKE]! > 0) (S[SHAKE] = Math.max(0, S[SHAKE]! - dt * 2.5)), live++;
    return live > 0;
  }
  /** A turn near a trail snaps onto it, so the frog follows the bites. */
  function snap() {
    const d = S[DIR]!;
    if (DX[d]) {
      for (let i = 0; i < 3; i++) if (Math.abs(S[FY]! - ROWS[i]!) < 4) S[FY] = ROWS[i]!;
    } else for (let i = 0; i < 2; i++) if (Math.abs(S[FX]! - COLS[i]!) < 4) S[FX] = COLS[i]!;
  }
  /** What the frog's mouth reaches: crumbs, power squares, letters. */
  function eat() {
    const x = S[FX]!, y = S[FY]!;
    for (let i = 0; i < nd; i++) {
      if (DE[i] || Math.abs(DXs[i]! - x) > 4 || Math.abs(DYs[i]! - y) > 4) continue;
      DE[i] = 1;
      S[CRUMBS] = S[CRUMBS]! + 1;
      if (DK[i] === 2) {
        S[SCORE] = S[SCORE]! + 50;
        (S[POW] = POWER), (S[CHAIN] = 0);
        EV[E_POWER]!++;
        say(3, x, y - 7, 2);
        spark(x, y, 10, 40, 2);
      } else (S[SCORE] = S[SCORE]! + 10), EV[E_DOT]!++;
    }
    if (S[MODE] !== PLAY) return;
    for (let i = 0; i < n.letters; i++) {
      if (LS[i] || x < LX[i]! - 2 || x > LX[i]! + LW[i]! + 2 || y < LY[i]! - 2 || y > LY[i]! + LH[i]! + 2) continue;
      (LS[i] = 1), (LF[i] = 0.2);
      S[SCORE] = S[SCORE]! + 5;
      S[EATEN] = S[EATEN]! + 1;
      EV[E_LETTER]!++;
      spark(LX[i]! + LW[i]! / 2, LY[i]! + LH[i]! / 2, 4, 30, 3);
    }
  }
  /** A tap, a key, a swipe: start a round (once Recall is done), and turn. */
  function turn(d: number) {
    if (S[MODE] !== PLAY && !(S[MODE] === DONE && S[END]! < 2.3)) start(), (S[DIR] = d);
    S[WANT] = d;
  }
  return { S, EV, DX: DXs, DY: DYs, DK, DE, LX, LY, LW, LH, LS, LF, QX, QY, QS, PL, PX, PY, PC, WL, WX, WY, WK, WC, n, step, turn, start };
}

export type RunnerScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof runner> };

// Byte Runner's pixels (src/art.ts there): the frog's eye stalks; the fly's body, eyes, wings, feet.
const FROG_EYES = ["M7 0h5v2h2v5H7V2H6V1h1ZM16 0h5v2h2v5h-7Z", "M9 1h5v2h-2v3h2v1H9V6H8V2h1ZM18 1h5v2h-2v3h2v1h-5V6h-1V2h1Z", "M12 2h2v4h-2ZM21 2h2v4h-2Z"];
const FLY = ["M2 0h2v2h2v2h1v5H5V7H3V5H1V2h1ZM21 1h2v2h1v2h1v4h-3V6h-2V3h1Z", "M0 7h3v1h2v2h2v3H4v-1H2v-1H0ZM23 7h2v1h2v3h-2v1h-3v1h-2v-3h1V9h2Z", "M9 18h3v3H9Zm7 0h3v3h-3Z", "M9 5h8v1h3v2h2v9h-1v2h-3v1h-2v-2h-3v2h-3v-2H7v-2H6v-5h1V8h2Z", "M10 8h4v6h-4V13H9V9h1ZM17 8h4v1h1v5h-5Z", "M12 9h2v4h-2ZM20 9h2v4h-2Z"];
const FROG = "#3ecb74", FROG_POW = "#8de45c", CREAM = "#fff5d7", PUPIL = "#152820", WING = "#d9f0f3", FEET = "#273148", BLUE = "#628dce";
const FLIES = ["#8573ee", "#f4457a", "#06c4ff"];
/** Sparks and words: frog green, pink, gold, paper. */
const COL = ["#3ecb74", "#ff2e88", "#ffc21a", "#f6f3ff"];

export function tinyByteRunner(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RunnerScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const L = engine.ledger, sim = runner((Math.random() * 2147483647) | 0), S = sim.S;
  const snd = sound(engine, { cues: {}, volume: 0.1 });
  const skin = slot.querySelector<HTMLElement>(".tbr")!;
  const els = [...skin.querySelectorAll<HTMLElement>(".tbr-h i")].slice(0, 56);
  const shown = new Uint8Array(els.length);
  sim.n.letters = els.length;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const eyes = FROG_EYES.map((d) => new Path2D(d)), flyP = FLY.map((d) => new Path2D(d));
  // [0] measure, [1] px per art unit, [2] gesture seen, [3] crumb colour (0 dark, 1 light)
  const V = new Float64Array(4);
  V[0] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  // The site's theme switch: the crumbs' colour is read again.
  const mo = new MutationObserver(() => ((V[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()));

  L.attr(stage, "tabindex", "0");
  L.attr(stage, "role", "application");
  L.attr(stage, "aria-label", "Tiny Byte Runner: arrow keys steer the frog and start a round; eat the crumbs and the letters, dodge the flies");
  // Touch: the page scrolls over the stage until a round starts; in a round, swipes steer.
  L.style(stage, "touch-action", "manipulation");
  let touch = 0;
  L.style(stage, "outline-offset", "-3px");
  const key = L.add(document.createElement("button"));
  key.type = "button";
  key.className = "tbr-snd";
  key.textContent = "♪";
  key.setAttribute("aria-label", "Sound");
  key.setAttribute("aria-pressed", "true");
  key.hidden = true;
  stage.append(key);
  key.addEventListener("click", (e) => {
    e.stopPropagation();
    snd.on = !snd.on;
    key.setAttribute("aria-pressed", "" + snd.on);
  }, { signal: engine.signal });
  key.addEventListener("pointerdown", (e) => e.stopPropagation(), { signal: engine.signal });
  const gesture = () => {
    if (!V[2]) (V[2] = 1), (key.hidden = false);
  };
  // A tap turns toward its side of the frog; a swipe turns its way.
  const P = new Float64Array(3);
  const art = (e: PointerEvent, i: number) => {
    const b = stage.getBoundingClientRect(), k = W / (b.width || 1);
    (P[i] = (e.clientX - b.left) * k), (P[i + 1] = (e.clientY - b.top) * k);
  };
  const toward = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
  const D = new Float64Array(3);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    gesture();
    art(e, 0);
    (D[0] = P[0]!), (D[1] = P[1]!), (D[2] = 1);
    sim.turn(toward(P[0]! - S[FX]!, P[1]! - S[FY]!));
    engine.wake();
  }, { signal: engine.signal });
  stage.addEventListener("pointermove", (e) => {
    if (!e.isPrimary || !D[2]) return;
    art(e, 0);
    const dx = P[0]! - D[0]!, dy = P[1]! - D[1]!;
    if (dx * dx + dy * dy < 36) return;
    (D[0] = P[0]!), (D[1] = P[1]!);
    sim.turn(toward(dx, dy));
    engine.wake();
  }, { signal: engine.signal });
  const up = () => (D[2] = 0);
  stage.addEventListener("pointerup", up, { signal: engine.signal });
  stage.addEventListener("pointercancel", up, { signal: engine.signal });
  const KEYS: Record<string, number> = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
  stage.addEventListener("keydown", (e) => {
    if (e.target === key) return;
    const k = KEYS[e.key] ?? (e.key === " " || e.key === "Enter" ? S[DIR]! : undefined);
    if (k === undefined) return;
    gesture();
    sim.turn(k);
    e.preventDefault();
    engine.wake();
  }, { signal: engine.signal });

  engine.add({
    read() {
      if (!V[0]) return;
      V[0] = 0;
      const b = stage.getBoundingClientRect(), k = W / (b.width || 1), dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(b.width * dpr));
      canvas.height = Math.max(1, Math.round(b.height * dpr));
      V[1] = (b.width * dpr) / W;
      V[3] = getComputedStyle(skin).colorScheme === "light" ? 1 : 0;
      for (let i = 0; i < els.length; i++) {
        const r = els[i]!.getBoundingClientRect();
        (sim.LX[i] = (r.left - b.left) * k), (sim.LY[i] = (r.top - b.top) * k), (sim.LW[i] = r.width * k), (sim.LH[i] = r.height * k);
      }
    },
    step(e, dt) {
      if (sim.step(dt) || S[MODE] === PLAY) e.busy();
    },
    render() {
      const play = S[MODE] === PLAY ? 1 : 0;
      if (play !== touch) (touch = play), L.style(stage, "touch-action", play ? "none" : "manipulation");
      // The page: an eaten letter is gone (its class), and back at Recall.
      for (let i = 0; i < els.length; i++) {
        const s = sim.LS[i]!;
        if (s === shown[i]) continue;
        shown[i] = s;
        L.cls(els[i]!, "e", s > 0);
      }
      const ev = sim.EV;
      if (ev[1]) snd.play("click");
      else if (ev[0]) snd.play("fire", 0.4);
      if (ev[2]) snd.play("power");
      if (ev[3]) snd.play("boom");
      if (ev[4]) snd.play("hurt");
      if (ev[5]) snd.play("win");
      if (ev[6]) snd.play("end");
      ev.fill(0);
      draw();
    },
  });

  function draw() {
    const u = V[1]!, sh = S[SHAKE]!, t = S[T]!, mode = S[MODE]!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(u, 0, 0, u, sh ? Math.sin(t * 70) * sh * u : 0, 0);
    // The crumbs along the trails; the power squares glow.
    for (let i = 0; i < sim.n.crumbs; i++) {
      if (sim.DE[i]) continue;
      if (sim.DK[i] === 2) {
        const p = 2.2 + Math.sin(t * 6) * 0.4;
        g.fillStyle = COL[2]!;
        g.globalAlpha = 0.35;
        g.fillRect(sim.DX[i]! - p - 1, sim.DY[i]! - p - 1, p * 2 + 2, p * 2 + 2);
        g.globalAlpha = 1;
        g.fillRect(sim.DX[i]! - p, sim.DY[i]! - p, p * 2, p * 2);
      } else {
        g.fillStyle = V[3] ? "#3f296a" : "#aea4d6";
        g.fillRect(sim.DX[i]! - 0.8, sim.DY[i]! - 0.8, 1.6, 1.6);
      }
    }
    // The flies: wings beat; blue and blinking while the frog glows.
    const pow = S[POW]!;
    for (let f = 0; f < 3; f++) {
      if (sim.QS[f] !== 1) continue;
      g.save();
      g.translate(sim.QX[f]! - 3.8, sim.QY[f]! - 3.3);
      g.scale(0.27, 0.27);
      g.fillStyle = WING;
      g.fill(flyP[(t * 14 + f) & 1]!);
      g.fillStyle = FEET;
      g.fill(flyP[2]!);
      g.fillStyle = pow > 0 && (pow > 1.2 || (t * 8) & 1) ? BLUE : FLIES[f]!;
      g.fill(flyP[3]!);
      g.fillStyle = CREAM;
      g.fill(flyP[4]!);
      g.fillStyle = PUPIL;
      g.fill(flyP[5]!);
      g.restore();
    }
    // The frog: a round body whose mouth chomps toward where it runs, eye stalks on top.
    const safe = S[SAFE]! > 0 && (t * 12) & 1;
    if (!safe && (mode !== DONE || S[LIVES]! > 0)) {
      const x = S[FX]!, y = S[FY]!, d = S[DIR]!, m = Math.abs(Math.sin(S[CHOMP]!)) * 0.75 + 0.05, a = d * 1.5708;
      g.fillStyle = pow > 0 ? FROG_POW : FROG;
      g.beginPath();
      g.moveTo(x, y + 0.4);
      g.arc(x, y + 0.4, 4, a + m, a + 6.2832 - m);
      g.fill();
      g.save();
      g.translate(x - 3.6, y - 4.6);
      g.scale(0.27, 0.27);
      g.fill(eyes[0]!);
      g.fillStyle = CREAM;
      g.fill(eyes[1]!);
      g.fillStyle = PUPIL;
      g.fill(eyes[2]!);
      g.restore();
    }
    for (let p = 0; p < sim.PL.length; p++) {
      if (sim.PL[p]! <= 0) continue;
      g.fillStyle = COL[sim.PC[p]!]!;
      g.globalAlpha = Math.min(1, sim.PL[p]! * 3);
      g.fillRect(sim.PX[p]! - 0.5, sim.PY[p]! - 0.5, 1, 1);
    }
    g.globalAlpha = 1;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 1;
    g.strokeStyle = "#07060f";
    for (let w = 0; w < sim.WL.length; w++) {
      if (sim.WL[w]! <= 0) continue;
      const big = sim.WK[w]! >= 4 && sim.WK[w]! <= 7;
      g.font = big ? "900 7px ui-monospace,monospace" : "800 4px ui-monospace,monospace";
      g.globalAlpha = Math.min(1, sim.WL[w]! * 3);
      g.fillStyle = COL[sim.WC[w]!]!;
      g.strokeText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
      g.fillText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
    }
    g.globalAlpha = 1;
    // HUD: the clock bar, the power bar, score, lives.
    const play = mode === PLAY;
    g.fillStyle = "rgba(127,127,160,.35)";
    g.fillRect(4, 87, W - 8, 1);
    g.fillStyle = S[LEFT]! < 3 && play ? COL[1]! : COL[0]!;
    g.fillRect(4, 87, (W - 8) * (play ? S[LEFT]! / ROUND : mode === DONE ? 0 : 1), 1);
    if (pow > 0) (g.fillStyle = BLUE), g.fillRect(4, 85.5, (W - 8) * (pow / POWER), 0.8);
    g.font = "800 3.4px ui-monospace,monospace";
    g.textAlign = "left";
    g.fillStyle = COL[0]!;
    for (let l = 0; l < 3; l++) {
      g.globalAlpha = l < S[LIVES]! ? 1 : 0.3;
      g.beginPath();
      g.arc(6 + l * 4.5, 81.5, 1.6, 0.5, 5.8);
      g.lineTo(6 + l * 4.5, 81.5);
      g.fill();
    }
    g.globalAlpha = 1;
    g.textAlign = "right";
    g.fillStyle = COL[2]!;
    g.fillText(SCORES[Math.min(SCORES.length - 1, (S[SCORE]! / 5) | 0)]!, W - 4, 82);
    if (mode === IDLE || (mode === INTRO && t > 1.2)) {
      g.textAlign = "center";
      g.font = "900 4.6px ui-monospace,monospace";
      g.fillStyle = COL[2]!;
      g.strokeText("ARROWS, SWIPE OR TAP TO RUN", W / 2, 80);
      g.fillText("ARROWS, SWIPE OR TAP TO RUN", W / 2, 80);
    }
  }
  const SCORES: string[] = [];
  for (let s = 0; s < 2000; s++) SCORES.push(String(s * 5).padStart(6, "0"));

  engine.start();
  if (first) {
    const k = W / (stage.clientWidth || 1);
    (V[2] = 1), (key.hidden = false);
    sim.turn(toward(first.x * k - S[FX]!, first.y * k - S[FY]!));
  }
  return { engine, sim, accessible: true, destroy: () => engine.destroy() };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => tinyByteRunner(stage, slot, first);
/** The poster: the frog has hopped in along the top trail; the hint is up. */
export const posterAt = 2;
