// Tiny Swarm Protocol: a ten-second taste of Swarm Protocol (domvirus.com/games/swarm-protocol/).
// The page is the board: bugs crawl in from the edges of a little web page and eat its letters into
// binary (a real text change, through the ledger); every three letters a bug grows a tier (red,
// violet, indigo; one more squash to kill), and grown hunters leave the letters for the buttons,
// latch on and drain their colour. Squash them: tap or click a bug, or move the crosshair with the
// arrow keys and press Space. Twelve seconds; every button still standing at the bell is saved.
// Then Recall puts back every letter and the buttons' colour, and the scene sleeps until a tap.
// Bricks: the kernel (fixed step, settle, the ledger for every page write) and @fzlt/core/sound (a
// tiny synth, silent until a gesture; a mute key appears after the first one). The simulation is
// plain numbers (`swarm`, no DOM): its step allocates nothing (tests/tiny-swarm-protocol.test.mjs).
import { createEngine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

/** Art units: the stage is W across, H down (16:9). */
export const W = 160, H = 90;
export const ROUND = 12, PER_TIER = 3;
export const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
const ML = 48, MBUG = 12, MP = 160, MW = 8, MBT = 3;
// State slots.
export const MODE = 0, T = 1, LEFT = 2, CX = 3, CY = 4, KX = 5, KY = 6, SCORE = 7, SPAWN = 8, EATEN = 9, SQUASHED = 10, END = 11, BACK = 12, SAVED = 13, COMBO = 14, CTIME = 15, SWAT = 16, SHAKE = 17, CURSOR = 18;
/** Sound events counted by the step (the mount plays and clears them). */
export const E_SQUASH = 0, E_CHEW = 1, E_TIER = 2, E_DRAIN = 3, E_WIN = 4, E_END = 5, E_MISS = 6;
/** Bug states. */
const WALK = 1, CHEW = 2, LATCH = 3;
/** Pop-up words. */
export const WORDS = ["SQUASH!", "+100", "TIER 2", "TIER 3", "BUTTON DOWN", "SAVED!", "INTERFACE DOWN", "RECALL", "x2", "x3", "x4", "x5"];
const TIER_HP = [0, 1, 2, 3];

/** The simulation: letters (food), buttons (prey), bugs, sparks; plain numbers, seeded. */
export function swarm(seed = 1) {
  let r = seed >>> 0 || 1;
  const R = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const S = new Float64Array(24);
  const EV = new Uint8Array(8);
  // Letters: box (art units), eaten, its bit, claimed by a bug, flash.
  const LX = new Float32Array(ML), LY = new Float32Array(ML), LW = new Float32Array(ML), LH = new Float32Array(ML);
  const LS = new Uint8Array(ML), LB = new Uint8Array(ML), LC = new Int8Array(ML).fill(-1), LF = new Float32Array(ML);
  // Buttons: box, health (1 full, 0 drained), flash.
  const TX = new Float32Array(MBT), TY = new Float32Array(MBT), TW = new Float32Array(MBT), TH = new Float32Array(MBT), TP = new Float32Array(MBT).fill(1), TF = new Float32Array(MBT);
  // Bugs: state (0 none), position, heading, tier, hp, letters eaten, target, timer, flash, gait.
  const BS = new Uint8Array(MBUG), BX = new Float32Array(MBUG), BY = new Float32Array(MBUG), BA = new Float32Array(MBUG), BT = new Uint8Array(MBUG), BH = new Uint8Array(MBUG);
  const BE = new Uint8Array(MBUG), BG = new Int8Array(MBUG), BK = new Float32Array(MBUG), BF = new Float32Array(MBUG), BP = new Float32Array(MBUG);
  // Sparks (binary bits and splats): life, position, velocity, colour.
  const PL = new Float32Array(MP), PX = new Float32Array(MP), PY = new Float32Array(MP), PU = new Float32Array(MP), PV = new Float32Array(MP), PC = new Uint8Array(MP);
  // Splats left on the page: position, age.
  const SPX = new Float32Array(8), SPY = new Float32Array(8), SPA = new Float32Array(8).fill(9);
  const WL = new Float32Array(MW), WX = new Float32Array(MW), WY = new Float32Array(MW), WK = new Uint8Array(MW), WC = new Uint8Array(MW);
  const n = { letters: 0, buttons: 0 };
  let pw = 0, ww = 0, sw = 0;
  (S[CX] = W / 2), (S[CY] = 60), (S[CURSOR] = 0);

  function spark(x: number, y: number, k: number, speed: number, c: number, up = 0) {
    for (let i = 0; i < k; i++) {
      const a = R() * 6.2832, v = speed * (0.35 + R() * 0.65);
      pw = (pw + 1) % MP;
      (PL[pw] = 0.35 + R() * 0.4), (PX[pw] = x), (PY[pw] = y), (PU[pw] = Math.cos(a) * v), (PV[pw] = Math.sin(a) * v - up), (PC[pw] = c);
    }
  }
  function say(k: number, x: number, y: number, c: number) {
    ww = (ww + 1) % MW;
    (WL[ww] = 0.9), (WX[ww] = x), (WY[ww] = y), (WK[ww] = k), (WC[ww] = c);
  }
  /** A bug arrives at an edge (or at x, y). */
  function bug(x: number, y: number) {
    for (let b = 0; b < MBUG; b++) {
      if (BS[b]) continue;
      (BS[b] = WALK), (BX[b] = x), (BY[b] = y), (BA[b] = Math.atan2(45 - y, W / 2 - x)), (BT[b] = 1), (BH[b] = 1), (BE[b] = 0), (BG[b] = -1), (BK[b] = 0), (BF[b] = 0), (BP[b] = R() * 6);
      return b;
    }
    return -1;
  }
  function edgeBug() {
    const s = (R() * 3) | 0;
    if (s === 0) bug(-6, 20 + R() * 50);
    else if (s === 1) bug(W + 6, 20 + R() * 50);
    else bug(20 + R() * 120, H + 6);
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[SCORE] = 0), (S[SPAWN] = 0.9), (S[EATEN] = 0), (S[SQUASHED] = 0), (S[END] = 0), (S[BACK] = 0), (S[COMBO] = 0), (S[CTIME] = 0);
    for (let i = 0; i < n.letters; i++) (LS[i] = 0), (LC[i] = -1);
    for (let t = 0; t < n.buttons; t++) TP[t] = 1;
    // The intro's bug stays; two more come in.
    let keep = 0;
    for (let b = 0; b < MBUG; b++) if (BS[b]) (BS[b] = keep++ ? 0 : WALK), (BG[b] = -1);
    edgeBug(), edgeBug();
  }
  function finish() {
    (S[MODE] = DONE), (S[END] = 0), (S[BACK] = 0);
    let saved = 0;
    for (let t = 0; t < n.buttons; t++) saved += TP[t]! > 0 ? 1 : 0;
    S[SAVED] = saved;
    say(saved ? 5 : 6, W / 2, 40, saved ? 0 : 1);
    EV[saved ? E_WIN : E_END]!++;
    // The swarm scatters off the page.
    for (let b = 0; b < MBUG; b++) if (BS[b]) (BS[b] = WALK), (BG[b] = -2), (BA[b] = BX[b]! < W / 2 ? Math.PI : 0);
  }
  /** A squash at (x, y): the nearest bug in reach takes a hit. */
  function swat(x: number, y: number) {
    (S[CX] = x), (S[CY] = y), (S[SWAT] = 1);
    if (S[MODE] !== PLAY) go();
    if (S[MODE] === PLAY) swat2(x, y);
  }
  function swat2(x: number, y: number) {
    let best = -1, bd = 1e9;
    for (let b = 0; b < MBUG; b++) {
      if (!BS[b] || BG[b] === -2) continue;
      const dx = BX[b]! - x, dy = BY[b]! - y, d = dx * dx + dy * dy, rr = 8 + BT[b]! * 1.5;
      if (d < rr * rr && d < bd) (bd = d), (best = b);
    }
    if (best < 0) return void EV[E_MISS]!++;
    const b = best;
    BF[b] = 0.15;
    if ((BH[b] = BH[b]! - 1) > 0) return void (spark(BX[b]!, BY[b]!, 4, 30, 2), EV[E_SQUASH]!++);
    // Squashed: a splat stays a moment, the letter it held is free, combo.
    if (BG[b]! >= 0 && BS[b] === CHEW) LC[BG[b]!] = -1;
    BS[b] = 0;
    S[SQUASHED] = S[SQUASHED]! + 1;
    S[COMBO] = S[CTIME]! > 0 ? Math.min(5, S[COMBO]! + 1) : 1;
    S[CTIME] = 1.1;
    S[SCORE] = S[SCORE]! + 100 * BT[b]! * S[COMBO]!;
    EV[E_SQUASH]!++;
    sw = (sw + 1) % 8;
    (SPX[sw] = BX[b]!), (SPY[sw] = BY[b]!), (SPA[sw] = 0);
    spark(BX[b]!, BY[b]!, 12 + BT[b]! * 4, 55, 1);
    say(S[COMBO]! > 1 ? 6 + S[COMBO]! : 0, BX[b]!, BY[b]! - 7, S[COMBO]! > 1 ? 2 : 3);
    S[SHAKE] = 0.4;
  }
  /** Where bug b goes next: hunters take the nearest live button, the rest the nearest letter. */
  function aim(b: number) {
    let best = -1, bd = 1e9;
    if (BT[b]! >= 2) {
      for (let t = 0; t < n.buttons; t++) {
        if (TP[t]! <= 0) continue;
        const dx = TX[t]! + TW[t]! / 2 - BX[b]!, dy = TY[t]! - BY[b]!, d = dx * dx + dy * dy;
        if (d < bd) (bd = d), (best = t);
      }
      if (best >= 0) return void (BG[b] = 100 + best);
    }
    for (let i = 0; i < n.letters; i++) {
      if (LS[i] || LC[i]! >= 0) continue;
      const dx = LX[i]! + LW[i]! / 2 - BX[b]!, dy = LY[i]! + LH[i]! / 2 - BY[b]!, d = dx * dx + dy * dy;
      if (d < bd) (bd = d), (best = i);
    }
    BG[b] = best;
    if (best >= 0) LC[best] = b;
  }

  /** One fixed step of `dt` seconds. Returns true while anything moves (the engine stays awake). */
  function step(dt: number) {
    S[T] = S[T]! + dt;
    const mode = S[MODE]!;
    let live = 0;
    // The crosshair on the keys.
    if (S[KX] || S[KY]) (S[CX] = Math.max(2, Math.min(W - 2, S[CX]! + S[KX]! * 80 * dt))), (S[CY] = Math.max(2, Math.min(H - 2, S[CY]! + S[KY]! * 80 * dt))), live++;
    if (S[SWAT]! > 0) (S[SWAT] = Math.max(0, S[SWAT]! - dt * 5)), live++;
    if (S[CTIME]! > 0) (S[CTIME] = Math.max(0, S[CTIME]! - dt)), live++;
    if (mode === INTRO) {
      // One bug creeps in from the left and stops by the headline, sniffing.
      if (S[T]! > 0.3 && !BS[0] && S[T]! < 0.4) (bug(-6, 34), (BG[0] = -3));
      if (S[T]! > 2.8) S[MODE] = IDLE;
      live++;
    } else if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      S[SPAWN] = S[SPAWN]! - dt;
      if (S[SPAWN]! <= 0 && S[LEFT]! > 1) (S[SPAWN] = 0.95 - (1 - S[LEFT]! / ROUND) * 0.4), edgeBug(), R() < 0.3 && edgeBug();
      let up = 0;
      for (let t = 0; t < n.buttons; t++) up += TP[t]! > 0 ? 1 : 0;
      if (S[LEFT] === 0 || !up) finish();
      live++;
    } else if (mode === DONE) {
      // A beat, then Recall: the letters come back one by one, the buttons' colour returns.
      S[END] = S[END]! + dt;
      live++;
      if (S[END]! > 1.4) {
        if (!S[BACK]) {
          say(7, W / 2, 30, 0);
          for (let t = 0; t < n.buttons; t++) (TP[t] = 1), (TF[t] = 0.3);
        }
        S[BACK] = S[BACK]! + dt;
        let left = -1;
        for (let i = 0; i < n.letters && left < 0; i++) if (LS[i]) left = i;
        if (left >= 0 && S[BACK]! >= 0.04) (S[BACK] = 1e-9), (LS[left] = 0), (LF[left] = 0.3), spark(LX[left]! + LW[left]! / 2, LY[left]! + LH[left]! / 2, 2, 20, 0);
        else if (left < 0 && S[END]! > 2.4) S[MODE] = IDLE;
      }
    }
    // The bugs.
    for (let b = 0; b < MBUG; b++) {
      if (!BS[b]) continue;
      BF[b] = Math.max(0, BF[b]! - dt);
      const g = BG[b]!;
      if (g === -3) {
        // The intro's bug: walks to its spot by the headline, then sniffs (still).
        const dx = 18 - BX[b]!;
        if (dx > 0.2) (BX[b] = BX[b]! + Math.min(dx, 16 * dt)), (BP[b] = BP[b]! + dt * 14), (BA[b] = 0), live++;
        if (mode === PLAY) BG[b] = -1;
        continue;
      }
      live++;
      if (g === -2) {
        // Scattering: off the page and gone.
        (BX[b] = BX[b]! + Math.cos(BA[b]!) * 60 * dt), (BP[b] = BP[b]! + dt * 30);
        if (BX[b]! < -10 || BX[b]! > W + 10) BS[b] = 0;
        continue;
      }
      if (BS[b] === WALK && (g < 0 || (g < 100 && LS[g]) || (g >= 100 && TP[g - 100]! <= 0))) {
        if (g >= 0 && g < 100 && LC[g] === b) LC[g] = -1;
        aim(b);
      }
      const t = BG[b]!;
      if (t < 0) continue;
      const hx = t >= 100 ? TX[t - 100]! + TW[t - 100]! * (0.2 + (b % 4) * 0.2) : LX[t]! + LW[t]! / 2;
      const hy = t >= 100 ? TY[t - 100]! + 1 : LY[t]! + LH[t]! * 0.55;
      const dx = hx - BX[b]!, dy = hy - BY[b]!, d = Math.sqrt(dx * dx + dy * dy);
      if (BS[b] === WALK) {
        // Turn toward the target, walk (hunters faster).
        const want = Math.atan2(dy, dx);
        let da = want - BA[b]!;
        da -= Math.round(da / 6.2832) * 6.2832;
        BA[b] = BA[b]! + Math.max(-7 * dt, Math.min(7 * dt, da));
        const v = (BT[b]! >= 2 ? 30 : 22) + S[T]! * 0.8;
        (BX[b] = BX[b]! + Math.cos(BA[b]!) * v * dt), (BY[b] = BY[b]! + Math.sin(BA[b]!) * v * dt);
        BP[b] = BP[b]! + dt * v * 0.9;
        if (d < 2.5) (BS[b] = t >= 100 ? LATCH : CHEW), (BK[b] = 0);
      } else if (BS[b] === CHEW) {
        BK[b] = BK[b]! + dt;
        if (BK[b]! >= 0.3) {
          // A letter eaten: binary, bits fly into the bug; every third, a tier.
          (LS[t] = 1), (LB[t] = R() < 0.5 ? 1 : 0), (LF[t] = 0.25), (LC[t] = -1);
          S[EATEN] = S[EATEN]! + 1;
          EV[E_CHEW]!++;
          spark(hx, hy, 3, 18, 0, 20);
          BS[b] = WALK;
          BG[b] = -1;
          if (++BE[b]! % PER_TIER === 0 && BT[b]! < 3) (BT[b] = BT[b]! + 1), (BH[b] = TIER_HP[BT[b]!]!), EV[E_TIER]!++, say(BT[b]!, BX[b]!, BY[b]! - 7, 1 + BT[b]!);
        }
      } else {
        // Latched on a button: drain its colour.
        const k = t - 100;
        BP[b] = BP[b]! + dt * 4;
        TP[k] = Math.max(0, TP[k]! - dt * (0.16 + BT[b]! * 0.06));
        TF[k] = 0.06;
        if (TP[k]! <= 0) (BS[b] = WALK), (BG[b] = -1), (S[SHAKE] = 0.8), EV[E_DRAIN]!++, say(4, TX[k]! + TW[k]! / 2, TY[k]! - 5, 1), spark(TX[k]! + TW[k]! / 2, TY[k]! + TH[k]! / 2, 20, 60, 1);
      }
    }
    for (let i = 0; i < n.letters; i++) if (LF[i]! > 0) (LF[i] = Math.max(0, LF[i]! - dt)), live++;
    for (let t = 0; t < MBT; t++) if (TF[t]! > 0) (TF[t] = Math.max(0, TF[t]! - dt)), live++;
    for (let k = 0; k < 8; k++) if (SPA[k]! < 1.2) (SPA[k] = SPA[k]! + dt), live++;
    for (let p = 0; p < MP; p++) {
      if (PL[p]! <= 0) continue;
      live++;
      PL[p] = PL[p]! - dt;
      (PX[p] = PX[p]! + PU[p]! * dt), (PY[p] = PY[p]! + PV[p]! * dt);
      PV[p] = PV[p]! + 80 * dt;
    }
    for (let w = 0; w < MW; w++) if (WL[w]! > 0) (WL[w] = WL[w]! - dt), (WY[w] = WY[w]! - 9 * dt), live++;
    if (S[SHAKE]! > 0) (S[SHAKE] = Math.max(0, S[SHAKE]! - dt * 2.5)), live++;
    return live > 0;
  }
  /** A tap or key on the idle scene starts a round. */
  function go() {
    if (S[MODE] !== PLAY && !(S[MODE] === DONE && S[END]! < 2.4)) start();
  }
  return { S, EV, LX, LY, LW, LH, LS, LB, LF, TX, TY, TW, TH, TP, TF, BS, BX, BY, BA, BT, BH, BF, BP, BG, PL, PX, PY, PC, SPX, SPY, SPA, WL, WX, WY, WK, WC, n, step, go, start, swat };
}

export type SwarmScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof swarm> };

/** Tier colours (from Swarm Protocol: red, violet, indigo); splat, bits, gold, paper. */
const TIER = ["", "#ff6b6b", "#d984ff", "#8573ee"];
const COL = ["#39ffb0", "#ff2e88", "#ffc21a", "#f6f3ff"];
const HP: string[] = [];
for (let i = 0; i <= 20; i++) HP.push("" + i / 20);

export function tinySwarmProtocol(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SwarmScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const L = engine.ledger, sim = swarm((Math.random() * 2147483647) | 0), S = sim.S;
  const snd = sound(engine, { cues: {}, volume: 0.1 });
  const skin = slot.querySelector<HTMLElement>(".tsp")!;
  const els = [...skin.querySelectorAll<HTMLElement>(".tsp-h i")].slice(0, 48);
  const chars = els.map((e) => e.textContent!), texts = els.map((e) => e.firstChild as Text);
  const btns = [...skin.querySelectorAll<HTMLElement>(".tsp-b")].slice(0, 3);
  const shown = new Uint8Array(els.length), shownHp = new Int8Array(3).fill(20);
  sim.n.letters = els.length;
  sim.n.buttons = btns.length;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  // [0] measure (1 all, 2 the letters), [1] px per art unit, [2] gesture seen, [3] a mouse is over
  const V = new Float64Array(4);
  V[0] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect());

  // Keyboard: the stage takes focus (a labelled application); arrows move the crosshair, Space squashes.
  L.attr(stage, "tabindex", "0");
  L.attr(stage, "role", "application");
  L.attr(stage, "aria-label", "Tiny Swarm Protocol: press Space to play and to squash, arrow keys move the crosshair");
  L.style(stage, "touch-action", "manipulation");
  L.style(stage, "outline-offset", "-3px");
  L.style(stage, "cursor", "crosshair");
  // The mute key: shown after the first gesture (sound can only start then), 44 px.
  const key = L.add(document.createElement("button"));
  key.type = "button";
  key.className = "tsp-snd";
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
  const at = (e: PointerEvent, out: Float64Array) => {
    const b = stage.getBoundingClientRect(), k = W / (b.width || 1);
    (out[0] = (e.clientX - b.left) * k), (out[1] = (e.clientY - b.top) * k);
  };
  const P = new Float64Array(2);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    gesture();
    at(e, P);
    S[CURSOR] = 0;
    sim.swat(P[0]!, P[1]!);
    engine.wake();
  }, { signal: engine.signal });
  stage.addEventListener("pointermove", (e) => {
    if (!e.isPrimary || e.pointerType !== "mouse") return;
    at(e, P);
    (S[CX] = P[0]!), (S[CY] = P[1]!), (S[CURSOR] = 0);
    engine.wake();
  }, { signal: engine.signal });
  const KEYS: Record<string, number> = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 };
  const held = new Uint8Array(4);
  const keys = () => ((S[KX] = held[1]! - held[0]!), (S[KY] = held[3]! - held[2]!));
  stage.addEventListener("keydown", (e) => {
    if (e.target === key) return;
    const k = KEYS[e.key];
    if (k !== undefined) (held[k] = 1), keys(), (S[CURSOR] = 1);
    else if (e.key === " " || e.key === "Enter") {
      if (!e.repeat) (S[CURSOR] = 1), sim.swat(S[CX]!, S[CY]!);
    } else return;
    gesture();
    e.preventDefault();
    engine.wake();
  }, { signal: engine.signal });
  stage.addEventListener("keyup", (e) => {
    const k = KEYS[e.key];
    if (k !== undefined) (held[k] = 0), keys();
  }, { signal: engine.signal });
  stage.addEventListener("blur", () => (held.fill(0), keys()), { signal: engine.signal });

  engine.add({
    read() {
      // A resize measures all (1); a letter that changed glyph re-measures the lines (2).
      if (!V[0]) return;
      const b = stage.getBoundingClientRect(), k = W / (b.width || 1), dpr = Math.min(2, devicePixelRatio || 1);
      if (V[0] === 1) {
        canvas.width = Math.max(1, Math.round(b.width * dpr));
        canvas.height = Math.max(1, Math.round(b.height * dpr));
        V[1] = (b.width * dpr) / W;
        for (let t = 0; t < btns.length; t++) {
          const r = btns[t]!.getBoundingClientRect();
          (sim.TX[t] = (r.left - b.left) * k), (sim.TY[t] = (r.top - b.top) * k), (sim.TW[t] = r.width * k), (sim.TH[t] = r.height * k);
        }
      }
      V[0] = 0;
      for (let i = 0; i < els.length; i++) {
        const r = els[i]!.getBoundingClientRect();
        (sim.LX[i] = (r.left - b.left) * k), (sim.LY[i] = (r.top - b.top) * k), (sim.LW[i] = r.width * k), (sim.LH[i] = r.height * k);
      }
    },
    step(e, dt) {
      if (sim.step(dt) || S[MODE] === PLAY) e.busy();
    },
    render() {
      // The page: letters to binary and back, the buttons' colour.
      for (let i = 0; i < els.length; i++) {
        const s = sim.LS[i]! ? 1 + sim.LB[i]! : 0;
        if (s === shown[i]) continue;
        shown[i] = s;
        L.text(texts[i]!, s ? (s === 2 ? "1" : "0") : chars[i]!);
        L.cls(els[i]!, "b", s > 0);
        V[0] ||= 2;
      }
      for (let t = 0; t < btns.length; t++) {
        const hp = Math.max(0, Math.ceil(sim.TP[t]! * 20));
        if (hp === shownHp[t]) continue;
        shownHp[t] = hp;
        if (hp === 20) L.unstyle(btns[t]!, "--hp"), L.cls(btns[t]!, "x", false);
        else L.style(btns[t]!, "--hp", HP[hp]!), L.cls(btns[t]!, "x", hp === 0);
      }
      const ev = sim.EV;
      if (ev[0]) snd.play("hit");
      if (ev[1]) snd.play("click");
      if (ev[2]) snd.play("power");
      if (ev[3]) snd.play("boom");
      if (ev[4]) snd.play("win");
      if (ev[5]) snd.play("end");
      ev.fill(0);
      draw();
    },
  });

  function draw() {
    const u = V[1]!, sh = S[SHAKE]!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(u, 0, 0, u, sh ? Math.sin(S[T]! * 70) * sh * u : 0, 0);
    const mode = S[MODE]!;
    g.lineCap = "round";
    g.lineJoin = "round";
    // Splats.
    for (let k = 0; k < 8; k++) {
      if (sim.SPA[k]! >= 1.2) continue;
      g.globalAlpha = (1 - sim.SPA[k]! / 1.2) * 0.8;
      g.fillStyle = COL[0]!;
      const x = sim.SPX[k]!, y = sim.SPY[k]!, s = 3 + sim.SPA[k]! * 2;
      g.beginPath();
      for (let j = 0; j < 7; j++) {
        const a = j * 0.8976, rr = s * (j & 1 ? 0.55 : 1);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
    }
    g.globalAlpha = 1;
    // Bugs: a dark shell, the tier's colour, six walking legs, antennae.
    for (let b = 0; b < sim.BS.length; b++) {
      if (!sim.BS[b]) continue;
      const t = sim.BT[b]!, s = 0.9 + t * 0.22, gait = Math.sin(sim.BP[b]!) * 0.45;
      g.save();
      g.translate(sim.BX[b]!, sim.BY[b]!);
      g.rotate(sim.BA[b]! + Math.PI / 2);
      g.scale(s, s);
      g.strokeStyle = sim.BF[b]! > 0 ? "#ffffff" : TIER[t]!;
      g.lineWidth = 0.7;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const y = -1.2 + k * 1.6, w = (k & 1 ? -gait : gait) * 1.4;
        g.moveTo(-1.6, y), g.lineTo(-3.3, y - 0.8 + w);
        g.moveTo(1.6, y), g.lineTo(3.3, y - 0.8 - w);
      }
      g.moveTo(-0.6, -2.6), g.lineTo(-1.6, -4.2 + gait * 0.4);
      g.moveTo(0.6, -2.6), g.lineTo(1.6, -4.2 - gait * 0.4);
      g.stroke();
      g.fillStyle = "#101010";
      g.beginPath();
      g.ellipse(0, 0.3, 2, 2.6, 0, 0, 6.2832);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(0, -2.4, 1.1, 0, 6.2832);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(0, -1.8), g.lineTo(0, 2.8);
      g.stroke();
      g.restore();
      // Tier pips, and the chew ring on a letter.
      if (t > 1) for (let k = 0; k < t; k++) (g.fillStyle = TIER[t]!), g.fillRect(sim.BX[b]! - t * 1.2 + k * 2.4, sim.BY[b]! + 5.5, 1.4, 1.4);
    }
    // Sparks: binary bits (green), splat (pink), hits (gold).
    for (let p = 0; p < sim.PL.length; p++) {
      if (sim.PL[p]! <= 0) continue;
      g.fillStyle = COL[sim.PC[p]!]!;
      g.globalAlpha = Math.min(1, sim.PL[p]! * 3);
      g.fillRect(sim.PX[p]! - 0.5, sim.PY[p]! - 0.5, 1, 1);
    }
    g.globalAlpha = 1;
    // Words.
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 1;
    g.strokeStyle = "#07060f";
    for (let w = 0; w < sim.WL.length; w++) {
      if (sim.WL[w]! <= 0) continue;
      const big = sim.WK[w] === 4 || sim.WK[w] === 5 || sim.WK[w] === 6 || sim.WK[w] === 7;
      g.font = big ? "900 7px ui-monospace,monospace" : "800 4px ui-monospace,monospace";
      g.globalAlpha = Math.min(1, sim.WL[w]! * 3);
      g.fillStyle = COL[sim.WC[w]!]!;
      g.strokeText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
      g.fillText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
    }
    g.globalAlpha = 1;
    // The crosshair (keys, or a mouse over the stage) and the swat ring.
    const cx = S[CX]!, cy = S[CY]!, sw = S[SWAT]!;
    if (S[CURSOR] || sw > 0) {
      g.strokeStyle = "#101010";
      g.lineWidth = 1.6;
      ring(cx, cy);
      g.strokeStyle = "#06c4ff";
      g.lineWidth = 0.6;
      ring(cx, cy);
      if (sw > 0) {
        g.globalAlpha = sw;
        g.strokeStyle = COL[2]!;
        g.beginPath();
        g.arc(cx, cy, 3 + (1 - sw) * 8, 0, 6.2832);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    // HUD: the clock bar, score, letters eaten.
    const play = mode === PLAY;
    g.fillStyle = "rgba(127,127,160,.35)";
    g.fillRect(4, 87, W - 8, 1);
    g.fillStyle = S[LEFT]! < 3 && play ? COL[1]! : COL[0]!;
    g.fillRect(4, 87, (W - 8) * (play ? S[LEFT]! / ROUND : mode === DONE ? 0 : 1), 1);
    g.font = "800 3.4px ui-monospace,monospace";
    g.textAlign = "left";
    g.fillStyle = COL[0]!;
    g.fillText(EATEN_TXT[Math.min(48, S[EATEN]!)]!, 4, 83.5);
    g.textAlign = "right";
    g.fillStyle = COL[2]!;
    g.fillText(SCORES[Math.min(SCORES.length - 1, (S[SCORE]! / 50) | 0)]!, W - 4, 83.5);
    if (mode === IDLE || (mode === INTRO && S[T]! > 1.4)) {
      g.textAlign = "center";
      g.font = "900 4.6px ui-monospace,monospace";
      g.fillStyle = COL[2]!;
      g.strokeText("TAP THE BUGS · SPACE TO PLAY", W / 2, 77);
      g.fillText("TAP THE BUGS · SPACE TO PLAY", W / 2, 77);
    }
  }
  function ring(x: number, y: number) {
    g.beginPath();
    g.arc(x, y, 3, 0, 6.2832);
    g.moveTo(x, y - 6), g.lineTo(x, y - 4.5);
    g.moveTo(x, y + 4.5), g.lineTo(x, y + 6);
    g.moveTo(x - 6, y), g.lineTo(x - 4.5, y);
    g.moveTo(x + 4.5, y), g.lineTo(x + 6, y);
    g.stroke();
  }
  // HUD strings, made once: the HUD never builds a string per frame.
  const SCORES: string[] = [], EATEN_TXT: string[] = [];
  for (let s = 0; s < 1000; s++) SCORES.push(String(s * 50).padStart(6, "0"));
  for (let s = 0; s <= 48; s++) EATEN_TXT.push(`BYTES EATEN ${s}`);

  engine.start();
  if (first) {
    const k = W / (stage.clientWidth || 1);
    (V[2] = 1), (key.hidden = false);
    sim.swat(first.x * k, first.y * k);
  }
  return { engine, sim, accessible: true, destroy: () => engine.destroy() };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => tinySwarmProtocol(stage, slot, first);
/** The poster: a bug has crept in by the headline; the hint is up. */
export const posterAt = 2.4;
