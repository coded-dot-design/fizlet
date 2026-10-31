// Tiny Null Invaders: a ten-second taste of Null Invaders (domvirus.com/games/null-invaders/). The
// page is the board: an interceptor at the foot of a little web page fires up through its headline,
// and every letter a shot hits turns into binary (a real text change, through the ledger), so the
// headline is a shield you chew through; binary is spent and lets shots pass. Up top, two buttons
// are factories: hit them and they drain (cyan, gold, pink) while they release aliens that sway
// down at you. Letters, aliens and factory hits are XP, and XP upgrades the gun mid-round: Pulse,
// Twin, Trident, then four-shot Overdrive. Twelve seconds; destroy both factories and clear the
// sky and the page is clear. At the end Recall puts back every letter, one by one, and the scene
// sleeps until the next tap. Steer: drag or tap (the gun fires on its own), or ← → on the keys.
// Bricks: the kernel (fixed step, settle, the ledger for every page write) and @fzlt/core/sound (a
// tiny synth, silent until a gesture; a mute key appears after the first one). The simulation is
// plain numbers (`invaders`, no DOM): its step allocates nothing (tests/tiny-null-invaders.test.mjs).
import { createEngine } from "../../../src/kernel/index";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

/** Art units: the stage is W across, H down (16:9). */
export const W = 160, H = 90;
export const ROUND = 12, SHIP_Y = 80;
export const INTRO = 0, IDLE = 1, PLAY = 2, DONE = 3;
/** Guns: XP to unlock, seconds between volleys. */
export const GUNS = ["PULSE", "TWIN", "TRIDENT", "OVERDRIVE"], UNLOCK = [0, 8, 24, 50];
const CADENCE = [0.16, 0.14, 0.12, 0.095];
const ML = 48, MA = 10, MB = 48, MP = 160, MW = 8, MF = 2;
// State slots.
export const MODE = 0, T = 1, LEFT = 2, SX = 3, TX = 4, KEY = 5, CD = 6, XP = 7, GUN = 8, SCORE = 9, LIVES = 10, SPAWN = 11, SHAKE = 12, HURT = 13, END = 14, BACK = 15, KILLS = 16, CLEAR = 17, PEEK = 18, ACT = 19;
/** Sound events counted by the step (the mount plays and clears them). */
export const E_FIRE = 0, E_HIT = 1, E_BOOM = 2, E_POWER = 3, E_WIN = 4, E_HURT = 5, E_END = 6;
/** Pop-up words. */
export const WORDS = ["+1", "+4", "TWIN!", "TRIDENT!", "OVERDRIVE!", "FACTORY DOWN", "PAGE CLEAR!", "TIME!", "RECALL", "PAGE LOST", "+2"];

/** The simulation: letters, two factories, aliens, shots, sparks; plain numbers, seeded. */
export function invaders(seed = 1) {
  let r = seed >>> 0 || 1;
  const R = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const S = new Float64Array(24);
  const EV = new Uint8Array(8);
  // Letters: box (art units), state (0 letter, 1 binary), its bit, flash.
  const LX = new Float32Array(ML), LY = new Float32Array(ML), LW = new Float32Array(ML), LH = new Float32Array(ML);
  const LS = new Uint8Array(ML), LB = new Uint8Array(ML), LF = new Float32Array(ML);
  // Factories: box, hp, flash.
  const FX = new Float32Array(MF), FY = new Float32Array(MF), FW = new Float32Array(MF), FH = new Float32Array(MF), FP = new Float32Array(MF), FF = new Float32Array(MF);
  // Aliens: alive, kind (0 drone, 1 crab, 2 squid), position, home x, age, hp, flash.
  const AA = new Uint8Array(MA), AK = new Uint8Array(MA), AX = new Float32Array(MA), AY = new Float32Array(MA), AH = new Float32Array(MA), AT = new Float32Array(MA), AP = new Float32Array(MA), AF = new Float32Array(MA);
  // Shots: alive, position, sideways speed.
  const BA = new Uint8Array(MB), BX = new Float32Array(MB), BY = new Float32Array(MB), BV = new Float32Array(MB);
  // Sparks: life left, position, velocity, colour.
  const PL = new Float32Array(MP), PX = new Float32Array(MP), PY = new Float32Array(MP), PU = new Float32Array(MP), PV = new Float32Array(MP), PC = new Uint8Array(MP);
  // Words: life, position, which word, colour.
  const WL = new Float32Array(MW), WX = new Float32Array(MW), WY = new Float32Array(MW), WK = new Uint8Array(MW), WC = new Uint8Array(MW);
  const n = { letters: 0, factories: 0 };
  let pw = 0, ww = 0;
  (S[SX] = -14), (S[TX] = W / 2), (S[LIVES] = 3);

  function spark(x: number, y: number, k: number, speed: number, c: number) {
    for (let i = 0; i < k; i++) {
      const a = R() * 6.2832, v = speed * (0.35 + R() * 0.65);
      pw = (pw + 1) % MP;
      (PL[pw] = 0.35 + R() * 0.35), (PX[pw] = x), (PY[pw] = y), (PU[pw] = Math.cos(a) * v), (PV[pw] = Math.sin(a) * v), (PC[pw] = c);
    }
  }
  function say(k: number, x: number, y: number, c: number) {
    ww = (ww + 1) % MW;
    (WL[ww] = 0.9), (WX[ww] = x), (WY[ww] = y), (WK[ww] = k), (WC[ww] = c);
  }
  function xp(k: number, x: number, y: number) {
    S[XP] = S[XP]! + k;
    const g = S[GUN]!;
    if (g < 3 && S[XP]! >= UNLOCK[g + 1]!) (S[GUN] = g + 1), say(1 + g + 1, x, y - 6, 3), EV[E_POWER]!++;
  }
  function alien(f: number) {
    for (let a = 0; a < MA; a++) {
      if (AA[a]) continue;
      const k = (R() * 3) | 0;
      (AA[a] = 1), (AK[a] = k), (AX[a] = FX[f]! + FW[f]! / 2), (AY[a] = FY[f]! + FH[f]!), (AH[a] = AX[a]!), (AT[a] = R() * 3), (AP[a] = k === 2 ? 2 : 1), (AF[a] = 0);
      return;
    }
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[XP] = 0), (S[GUN] = 0), (S[SCORE] = 0), (S[LIVES] = 3), (S[SPAWN] = 0.5), (S[KILLS] = 0), (S[CLEAR] = 0), (S[CD] = 0), (S[END] = 0), (S[BACK] = 0);
    for (let f = 0; f < n.factories; f++) (FP[f] = 8), (FF[f] = 0);
    for (let i = 0; i < n.letters; i++) (LS[i] = 0), (LF[i] = 0);
    for (let a = 0; a < MA; a++) AA[a] = 0;
    alien(0), alien(1);
  }
  function finish(word: number) {
    (S[MODE] = DONE), (S[END] = 0), (S[BACK] = 0);
    say(word, W / 2, 46, word === 9 ? 1 : 3);
    EV[word === 6 ? E_WIN : E_END]!++;
    for (let a = 0; a < MA; a++) if (AA[a]) (AA[a] = 0), spark(AX[a]!, AY[a]!, 6, 40, 2);
    for (let b = 0; b < MB; b++) BA[b] = 0;
  }
  function hurt() {
    S[LIVES] = S[LIVES]! - 1;
    (S[HURT] = 1), (S[SHAKE] = 1);
    EV[E_HURT]!++;
    spark(S[SX]!, SHIP_Y, 14, 60, 1);
    if (S[LIVES]! <= 0) finish(9);
  }

  /** One fixed step of `dt` seconds. Returns true while anything moves (the engine stays awake). */
  function step(dt: number) {
    S[T] = S[T]! + dt;
    const mode = S[MODE]!;
    let live = 0;
    // The ship eases to its target (a drag, a tap) or flies on the keys.
    if (S[KEY]) S[TX] = Math.max(8, Math.min(W - 8, S[SX]! + S[KEY]! * 40));
    const d = S[TX]! - S[SX]!;
    if (Math.abs(d) > 0.05) (S[SX] = S[SX]! + Math.sign(d) * Math.min(Math.abs(d), Math.max(30, Math.abs(d) * 9) * dt)), live++;
    if (mode === INTRO) {
      // The interceptor glides in; an alien peeks out of the left factory and ducks back.
      S[PEEK] = Math.max(0, Math.sin(Math.min(1, Math.max(0, (S[T]! - 0.5) / 1.8)) * Math.PI));
      if (S[T]! > 2.6) (S[MODE] = IDLE), (S[PEEK] = 0);
      live++;
    } else if (mode === PLAY) {
      S[LEFT] = Math.max(0, S[LEFT]! - dt);
      // The gun fires on its own: Pulse, Twin, Trident, Overdrive.
      S[CD] = S[CD]! - dt;
      if (S[CD]! <= 0) {
        const g = S[GUN]!;
        S[CD] = CADENCE[g]!;
        EV[E_FIRE]!++;
        if (g === 0) shot(S[SX]!, 0);
        else if (g === 1) shot(S[SX]! - 2.5, 0), shot(S[SX]! + 2.5, 0);
        else if (g === 2) shot(S[SX]!, 0), shot(S[SX]! - 1.5, -38), shot(S[SX]! + 1.5, 38);
        else shot(S[SX]! - 2.5, -14), shot(S[SX]! + 2.5, 14), shot(S[SX]! - 3, -52), shot(S[SX]! + 3, 52);
      }
      // The factories release aliens while they stand.
      S[SPAWN] = S[SPAWN]! - dt;
      if (S[SPAWN]! <= 0) {
        S[SPAWN] = 0.75 + R() * 0.5;
        const f = R() < 0.5 ? 0 : 1, g = FP[f]! > 0 ? f : 1 - f;
        if (FP[g]! > 0) alien(g);
      }
      if (S[LEFT] === 0) finish(7);
      live++;
    } else if (mode === DONE) {
      // A beat, then Recall: the letters come back one by one, the factories refill.
      S[END] = S[END]! + dt;
      live++;
      if (S[END]! > 1.2) {
        if (!S[BACK]) {
          say(8, W / 2, 30, 0);
          for (let f = 0; f < n.factories; f++) FP[f] = 8;
        }
        S[BACK] = S[BACK]! + dt;
        let left = -1;
        for (let i = 0; i < n.letters && left < 0; i++) if (LS[i]) left = i;
        if (left >= 0 && S[BACK]! >= 0.04) (S[BACK] = 1e-9), (LS[left] = 0), (LF[left] = 0.3), spark(LX[left]! + LW[left]! / 2, LY[left]! + LH[left]! / 2, 2, 20, 0);
        else if (left < 0 && S[END]! > 2.2) (S[MODE] = IDLE), (S[GUN] = 0), (S[XP] = 0);
      }
    }
    // Shots: letters turn to binary, factories drain, aliens pop.
    for (let b = 0; b < MB; b++) {
      if (!BA[b]) continue;
      live++;
      BY[b] = BY[b]! - 150 * dt;
      BX[b] = BX[b]! + BV[b]! * dt;
      const x = BX[b]!, y = BY[b]!;
      if (y < -4 || x < -4 || x > W + 4) {
        BA[b] = 0;
        continue;
      }
      let hit = false;
      for (let a = 0; a < MA && !hit; a++) {
        if (!AA[a] || Math.abs(x - AX[a]!) > 5 || Math.abs(y - AY[a]!) > 5) continue;
        hit = true;
        AF[a] = 0.12;
        if ((AP[a] = AP[a]! - 1) > 0) continue;
        AA[a] = 0;
        S[KILLS] = S[KILLS]! + 1;
        S[SCORE] = S[SCORE]! + 100;
        EV[E_BOOM]!++;
        spark(AX[a]!, AY[a]!, 12, 55, 1 + AK[a]!);
        say(1, AX[a]!, AY[a]! - 5, 1);
        xp(4, AX[a]!, AY[a]!);
      }
      for (let f = 0; f < n.factories && !hit; f++) {
        if (FP[f]! <= 0 || x < FX[f]! || x > FX[f]! + FW[f]! || y < FY[f]! || y > FY[f]! + FH[f]!) continue;
        hit = true;
        FP[f] = FP[f]! - 1;
        FF[f] = 0.1;
        S[SCORE] = S[SCORE]! + 25;
        spark(x, FY[f]! + FH[f]!, 4, 35, 3);
        if (FP[f]! > 0) EV[E_HIT]!++, xp(2, x, y);
        else {
          S[SCORE] = S[SCORE]! + 250;
          EV[E_BOOM]!++;
          (S[SHAKE] = 0.7), spark(FX[f]! + FW[f]! / 2, FY[f]! + FH[f]! / 2, 30, 80, 2);
          say(5, FX[f]! + FW[f]! / 2, FY[f]! + FH[f]! + 7, 2);
          xp(10, x, y);
        }
      }
      for (let i = 0; i < n.letters && !hit; i++) {
        if (LS[i] || x < LX[i]! || x > LX[i]! + LW[i]! || y < LY[i]! || y > LY[i]! + LH[i]!) continue;
        hit = true;
        (LS[i] = 1), (LB[i] = R() < 0.5 ? 1 : 0), (LF[i] = 0.25);
        S[SCORE] = S[SCORE]! + 10;
        EV[E_HIT]!++;
        spark(x, LY[i]! + LH[i]!, 5, 40, 0);
        xp(1, x, y);
      }
      if (hit) BA[b] = 0;
    }
    // Aliens sway down at the ship.
    let up = 0;
    for (let a = 0; a < MA; a++) {
      if (!AA[a]) continue;
      live++, up++;
      AT[a] = AT[a]! + dt;
      AF[a] = Math.max(0, AF[a]! - dt);
      const dive = AY[a]! > 50 ? 0.9 : 0.25;
      AH[a] = AH[a]! + (S[SX]! - AH[a]!) * dive * dt;
      AX[a] = AH[a]! + Math.sin(AT[a]! * 3.1) * 12;
      AY[a] = AY[a]! + (11 + S[T]! * 0.9) * dt;
      if (mode === PLAY && Math.abs(AX[a]! - S[SX]!) < 7 && Math.abs(AY[a]! - SHIP_Y) < 6) (AA[a] = 0), spark(AX[a]!, AY[a]!, 10, 50, 1), hurt();
      else if (AY[a]! > H + 6) AA[a] = 0;
    }
    if (mode === PLAY && !S[CLEAR] && !up && FP[0]! <= 0 && FP[1]! <= 0) {
      // Both factories down and the sky clear: the page is clear (a bonus for the time left).
      S[CLEAR] = 1;
      S[SCORE] = S[SCORE]! + Math.round(S[LEFT]! * 50);
      finish(6);
    }
    for (let i = 0; i < n.letters; i++) if (LF[i]! > 0) (LF[i] = Math.max(0, LF[i]! - dt)), live++;
    for (let f = 0; f < MF; f++) if (FF[f]! > 0) (FF[f] = Math.max(0, FF[f]! - dt)), live++;
    for (let p = 0; p < MP; p++) {
      if (PL[p]! <= 0) continue;
      live++;
      PL[p] = PL[p]! - dt;
      (PX[p] = PX[p]! + PU[p]! * dt), (PY[p] = PY[p]! + PV[p]! * dt);
      PV[p] = PV[p]! + 90 * dt;
    }
    for (let w = 0; w < MW; w++) if (WL[w]! > 0) (WL[w] = WL[w]! - dt), (WY[w] = WY[w]! - 9 * dt), live++;
    if (S[SHAKE]! > 0) (S[SHAKE] = Math.max(0, S[SHAKE]! - dt * 2.5)), live++;
    if (S[HURT]! > 0) (S[HURT] = Math.max(0, S[HURT]! - dt * 2)), live++;
    return live > 0;
  }
  function shot(x: number, v: number) {
    for (let b = 0; b < MB; b++) {
      if (BA[b]) continue;
      (BA[b] = 1), (BX[b] = x), (BY[b] = SHIP_Y - 5), (BV[b] = v);
      return;
    }
  }
  /** A tap, a key: start a round (from the intro, idle or once Recall is done). */
  function go() {
    if (S[MODE] !== PLAY && !(S[MODE] === DONE && S[END]! < 2.2)) start();
  }
  return { S, EV, LX, LY, LW, LH, LS, LB, LF, FX, FY, FW, FH, FP, FF, AA, AK, AX, AY, AF, BA, BX, BY, PL, PX, PY, PC, WL, WX, WY, WK, WC, n, step, go, start };
}

export type InvadersScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof invaders> };

// Pixel art from Null Invaders (an interceptor; drone, crab and squid aliens), baked once.
const SHIP = ["....3....", "...121...", "...121...", "..12221..", ".1224221.", "122222221", "121222121", "11.111.11"];
const ALIENS = [
  ["..1.....1..", "...1...1...", "..1222221..", ".122222221.", "12232223221", "12212221221", "..1222221..", ".12.111.21."],
  ["..11...11..", ".1221.1221.", "12222222221", "12332223321", "12222222221", ".122222221.", "11211111211", "12.1...1.21"],
  ["....111....", "...12221...", "..1222221..", ".122222221.", "12332223321", "12212221221", "..1222221..", ".121.1.121."],
];
const PAL = [["", "#092331", "#06c4ff", "#efffff", "#cdde00"], ["", "#261634", "#8573ee", "#fff1ff"], ["", "#321623", "#f4457a", "#fff6d6"], ["", "#32200f", "#cdde00", "#fff7d1"]];
/** Spark and word colours: cyan, pink, gold, paper. */
const COL = ["#19f0ff", "#ff2e88", "#ffc21a", "#f6f3ff"];
const HP = ["0", ".125", ".25", ".375", ".5", ".625", ".75", ".875", "1"];

function bake(rows: string[], pal: string[], flash: boolean) {
  const c = document.createElement("canvas");
  (c.width = rows[0]!.length), (c.height = rows.length);
  const g = c.getContext("2d")!;
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y]!.length; x++) {
      const k = +rows[y]![x]! || 0;
      if (!k) continue;
      g.fillStyle = flash ? "#ffffff" : pal[k]!;
      g.fillRect(x, y, 1, 1);
    }
  return c;
}

export function tinyNullInvaders(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): InvadersScene {
  const engine = createEngine({ root: stage, settle: 0.5 });
  const L = engine.ledger, sim = invaders((Math.random() * 2147483647) | 0), S = sim.S;
  const snd = sound(engine, { cues: {}, volume: 0.1 });
  const skin = slot.querySelector<HTMLElement>(".tni")!;
  const els = [...skin.querySelectorAll<HTMLElement>(".tni-h i")].slice(0, 48);
  const chars = els.map((e) => e.textContent!), texts = els.map((e) => e.firstChild as Text);
  const facts = [...skin.querySelectorAll<HTMLElement>(".tni-f")].slice(0, 2);
  const shown = new Uint8Array(els.length), shownHp = new Int8Array(2).fill(-1);
  sim.n.letters = els.length;
  sim.n.factories = facts.length;
  for (let f = 0; f < facts.length; f++) sim.FP[f] = 8;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const ship = bake(SHIP, PAL[0]!, false), hurtShip = bake(SHIP, PAL[0]!, true);
  const aliens = ALIENS.map((a, k) => bake(a, PAL[k + 1]!, false)), flashed = ALIENS.map((a) => bake(a, PAL[0]!, true));
  // [0] measure, [1] px per art unit, [2] dpr, [3] gesture seen
  const V = new Float64Array(4);
  V[0] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect());

  // Keyboard: the stage takes focus (a labelled application); ← → steer, Space or Enter plays.
  L.attr(stage, "tabindex", "0");
  L.attr(stage, "role", "application");
  L.attr(stage, "aria-label", "Tiny Null Invaders: press Space to play, arrow keys to steer; the gun fires on its own");
  L.style(stage, "touch-action", "pan-y");
  L.style(stage, "outline-offset", "-3px");
  // The mute key: shown after the first gesture (sound can only start then), 44 px.
  const key = L.add(document.createElement("button"));
  key.type = "button";
  key.className = "tni-snd";
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
    if (!V[3]) (V[3] = 1), (key.hidden = false);
  };
  const toArt = (clientX: number) => {
    const b = stage.getBoundingClientRect();
    return ((clientX - b.left) / (b.width || 1)) * W;
  };
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    gesture();
    S[TX] = Math.max(8, Math.min(W - 8, toArt(e.clientX)));
    sim.go();
    engine.wake();
  }, { signal: engine.signal });
  stage.addEventListener("pointermove", (e) => {
    if (!e.isPrimary || (e.pointerType !== "mouse" && !e.buttons) || S[MODE] !== PLAY) return;
    S[TX] = Math.max(8, Math.min(W - 8, toArt(e.clientX)));
    engine.wake();
  }, { signal: engine.signal });
  const dir = (k: string) => (k === "ArrowLeft" || k === "a" || k === "A" ? -1 : k === "ArrowRight" || k === "d" || k === "D" ? 1 : 0);
  stage.addEventListener("keydown", (e) => {
    if (e.target === key) return;
    const d = dir(e.key);
    if (d) S[KEY] = d;
    else if (e.key !== " " && e.key !== "Enter") return;
    else sim.go();
    gesture();
    e.preventDefault();
    engine.wake();
  }, { signal: engine.signal });
  stage.addEventListener("keyup", (e) => {
    if (dir(e.key) === S[KEY]) S[KEY] = 0;
  }, { signal: engine.signal });
  stage.addEventListener("blur", () => (S[KEY] = 0), { signal: engine.signal });

  engine.add({
    read() {
      // A resize measures all (1); a letter that changed glyph re-measures the lines (2): binary is
      // narrower than the letter it replaced, and the line closes up around it.
      if (!V[0]) return;
      const b = stage.getBoundingClientRect(), k = W / (b.width || 1), dpr = Math.min(2, devicePixelRatio || 1);
      if (V[0] === 1) {
        canvas.width = Math.max(1, Math.round(b.width * dpr));
        canvas.height = Math.max(1, Math.round(b.height * dpr));
        (V[1] = (b.width * dpr) / W), (V[2] = dpr);
      }
      V[0] = 0;
      for (let i = 0; i < els.length; i++) {
        const r = els[i]!.getBoundingClientRect();
        (sim.LX[i] = (r.left - b.left) * k), (sim.LY[i] = (r.top - b.top) * k), (sim.LW[i] = r.width * k), (sim.LH[i] = r.height * k);
      }
      for (let f = 0; f < facts.length; f++) {
        const r = facts[f]!.getBoundingClientRect();
        (sim.FX[f] = (r.left - b.left) * k), (sim.FY[f] = (r.top - b.top) * k), (sim.FW[f] = r.width * k), (sim.FH[f] = r.height * k);
      }
    },
    step(e, dt) {
      if (sim.step(dt) || S[MODE] === PLAY) e.busy();
    },
    render() {
      // The page: letters to binary and back, the factories' charge.
      for (let i = 0; i < els.length; i++) {
        const s = sim.LS[i]! ? 1 + sim.LB[i]! : 0;
        if (s === shown[i]) continue;
        shown[i] = s;
        L.text(texts[i]!, s ? (s === 2 ? "1" : "0") : chars[i]!);
        L.cls(els[i]!, "b", s > 0);
        V[0] ||= 2;
      }
      for (let f = 0; f < facts.length; f++) {
        const hp = Math.max(0, Math.round(sim.FP[f]!));
        if (hp === shownHp[f]) continue;
        if (shownHp[f] === -1 && hp === 8) {
          shownHp[f] = hp;
          continue;
        }
        shownHp[f] = hp;
        if (hp === 8) L.unstyle(facts[f]!, "--hp"), L.cls(facts[f]!, "x", false);
        else L.style(facts[f]!, "--hp", HP[hp]!), L.cls(facts[f]!, "x", hp === 0);
      }
      // Sound.
      const ev = sim.EV;
      if (ev[0]) snd.play("fire", 0.5);
      if (ev[1]) snd.play("click");
      if (ev[2]) snd.play("boom");
      if (ev[3]) snd.play("power");
      if (ev[4]) snd.play("win");
      if (ev[5]) snd.play("hurt");
      if (ev[6]) snd.play("end");
      ev.fill(0);
      draw();
    },
  });

  function draw() {
    const u = V[1]!, sh = S[SHAKE]!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(u, 0, 0, u, sh ? Math.sin(S[T]! * 70) * sh * u * 1.2 : 0, 0);
    g.imageSmoothingEnabled = false;
    const mode = S[MODE]!;
    // Shots.
    g.fillStyle = S[GUN]! >= 3 ? COL[1]! : COL[0]!;
    for (let b = 0; b < sim.BA.length; b++) if (sim.BA[b]) g.fillRect(sim.BX[b]! - 0.5, sim.BY[b]! - 2, 1, 4);
    // Aliens (and one peeking out of the left factory in the intro).
    for (let a = 0; a < sim.AA.length; a++) {
      if (!sim.AA[a]) continue;
      const k = sim.AK[a]!, frame = (S[T]! * 4 + a) & 1;
      g.drawImage(sim.AF[a]! > 0 ? flashed[k]! : aliens[k]!, sim.AX[a]! - 5.5, sim.AY[a]! - 4 + frame * 0.5);
    }
    if (mode === INTRO && S[PEEK]! > 0) {
      g.save();
      g.beginPath();
      g.rect(0, sim.FY[0]! + sim.FH[0]!, W, H);
      g.clip();
      g.drawImage(aliens[2]!, sim.FX[0]! + sim.FW[0]! / 2 - 5.5, sim.FY[0]! + sim.FH[0]! - 8 + S[PEEK]! * 10);
      g.restore();
    }
    // The ship and its thrust.
    const x = S[SX]!, hurt = S[HURT]! > 0 && ((S[T]! * 20) & 1);
    if (mode !== DONE || S[LIVES]! > 0) {
      g.fillStyle = (S[T]! * 16) & 1 ? COL[2]! : COL[1]!;
      g.fillRect(x - 1.5, SHIP_Y + 4, 1, 1.5 + ((S[T]! * 23) & 1));
      g.fillRect(x + 0.5, SHIP_Y + 4, 1, 1.5 + ((S[T]! * 19) & 1));
      g.drawImage(hurt ? hurtShip : ship, x - 4.5, SHIP_Y - 4);
    }
    // Sparks.
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
    g.font = "800 4px ui-monospace,monospace";
    g.lineWidth = 1;
    g.strokeStyle = "#07060f";
    for (let w = 0; w < sim.WL.length; w++) {
      if (sim.WL[w]! <= 0) continue;
      const big = sim.WK[w]! >= 5 && sim.WK[w]! !== 10;
      g.font = big ? "900 7px ui-monospace,monospace" : "800 4px ui-monospace,monospace";
      g.globalAlpha = Math.min(1, sim.WL[w]! * 3);
      g.fillStyle = COL[sim.WC[w]!]!;
      g.strokeText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
      g.fillText(WORDS[sim.WK[w]!]!, sim.WX[w]!, sim.WY[w]!);
    }
    g.globalAlpha = 1;
    // HUD: the clock bar, score, gun and XP, lives.
    const play = mode === PLAY;
    g.fillStyle = "rgba(127,127,160,.35)";
    g.fillRect(4, 87, W - 8, 1);
    g.fillStyle = S[LEFT]! < 3 && play ? COL[1]! : COL[0]!;
    g.fillRect(4, 87, (W - 8) * (play ? S[LEFT]! / ROUND : mode === DONE ? 0 : 1), 1);
    g.font = "800 3.4px ui-monospace,monospace";
    g.textAlign = "left";
    g.fillStyle = COL[2]!;
    g.fillText(GUNS[S[GUN]!]!, 4, 83.5);
    const gun = S[GUN]!, need = gun < 3 ? UNLOCK[gun + 1]! - UNLOCK[gun]! : 1, have = gun < 3 ? S[XP]! - UNLOCK[gun]! : 1;
    g.fillStyle = "rgba(127,127,160,.35)";
    g.fillRect(4, 80, 22, 1);
    g.fillStyle = COL[2]!;
    g.fillRect(4, 80, 22 * Math.min(1, have / need), 1);
    g.textAlign = "right";
    g.fillStyle = COL[0]!;
    g.fillText(SCORES[Math.min(SCORES.length - 1, (S[SCORE]! / 5) | 0)]!, W - 4, 83.5);
    for (let l = 0; l < 3; l++) {
      g.fillStyle = l < S[LIVES]! ? COL[1]! : "rgba(127,127,160,.35)";
      g.fillRect(W - 6 - l * 3, 79.5, 2, 2);
    }
    if (mode === IDLE || (mode === INTRO && S[T]! > 1.2)) {
      g.textAlign = "center";
      g.font = "900 4.6px ui-monospace,monospace";
      g.fillStyle = COL[2]!;
      g.globalAlpha = 0.65 + Math.sin(S[T]! * 5) * 0.35 * (mode === INTRO ? 1 : 0);
      g.strokeText("TAP OR ← → TO PLAY", W / 2, 70);
      g.fillText("TAP OR ← → TO PLAY", W / 2, 70);
      g.globalAlpha = 1;
    }
  }
  // Score strings, made once (multiples of 5 up to 9,995): the HUD never builds a string per frame.
  const SCORES: string[] = [];
  for (let s = 0; s < 2000; s++) SCORES.push(String(s * 5).padStart(6, "0"));

  engine.start();
  if (first) {
    S[TX] = Math.max(8, Math.min(W - 8, (first.x / (stage.clientWidth || 1)) * W));
    V[3] = 1;
    key.hidden = false;
    sim.go();
  }
  return { engine, sim, accessible: true, destroy: () => engine.destroy() };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => tinyNullInvaders(stage, slot, first);
/** The poster: the interceptor in, an alien peeking out of the factory, the hint up. */
export const posterAt = 1.6;
