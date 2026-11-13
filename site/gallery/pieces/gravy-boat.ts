// "Gravy Boat" (thanksgiving, micro): a gravy boat over a row of plates sliding past on the table.
// Hold (pointer, Space or Enter) and it tilts: the stream starts thin and thickens the longer you
// hold; let go and it stops (what is already falling still lands). Fill each plate's mashed-potato
// crater to the gold line as it passes under the spout: dead on is PERFECT, close is GOOD, short is
// MORE GRAVY!. Gravy that misses the crater smears down the mound in a short drip and fades. Over
// the rim it overflows, drips down onto the tablecloth (the stains stay) and costs a star; lose all
// three and the tablecloth is ruined. The plates speed up as you go (to a fair cap); a streak of
// filled plates and the best one. Two plates with no pour and the table waits (it settles).
// Bricks: the kernel (fixed step; settle; its ledger for the canvas and the play key, so Recall
// gives the page back byte for byte), @fzlt/core/slot, @fzlt/core/sound. The game is `gravy()`,
// plain numbers, no DOM (tests/gravy-boat.test.mjs).
import { createEngine } from "../../../src/kernel/index";
import { seeded } from "../../../src/kernel/random";
import { sound } from "../../../src/sound";
import type { SlotScene, SlotTap } from "../../../src/slot";

export const IDLE = 0, PLAY = 1, OVER = 2, WAIT = 3;
/** The world (100 tall, y down from the middle): the table's top, the plates' line, the crater's
 *  half-width, the spout's x and y, gravity, the pour (fill a crater a second), the fill line. */
/** The spout's lip, in the boat's own frame (the boat turns about (SX + 9, SY − 2)). */
export const LIPX = -15, LIPY = -5.4;
export const TABLE = 20, PY = 30, CR = 7.5, SX = -8, SY = -12, G = 420, FMAX = 1.7, LINE = 0.8;
/** Plates: how many in the row, the gap between them, the speed at the start and its cap. */
export const NP = 4, GAP = 48, V0 = 11, VMAX = 16;
/** Drops in flight, stains on the cloth, drips on the mash (gravy that missed the crater runs down
 *  the mound and fades; DLIFE seconds). */
export const NB = 120, NS = 48, ND = 24, DLIFE = 1.1;
export const EV_START = 0, EV_POUR = 1, EV_PERFECT = 2, EV_GOOD = 3, EV_DRY = 4, EV_OVERFLOW = 5, EV_OVER = 6, EV_SPLASH = 7;
// State slots.
const MODE = 0, T = 1, TILT = 2, TV = 3, HOLD = 4, FLOW = 5, SERVED = 6, STREAK = 7, BEST = 8, STARS = 9, SCORE = 10, IDLE_N = 11, POURED = 12, LAST = 13, LASTT = 14;

/** One table. `I[0]`: 1 while held. */
export function gravy(seed: number, I: Float64Array) {
  const R = seeded(seed), S = new Float64Array(16), ev = new Uint8Array(8);
  // Plates: x, the level in the crater (0..1 is to the rim), its wobble and wobble speed, graded,
  // overflowed, poured into.
  const X = new Float64Array(NP), LV = new Float64Array(NP), W = new Float64Array(NP), WV = new Float64Array(NP), GR = new Uint8Array(NP), OV = new Uint8Array(NP), PO = new Uint8Array(NP);
  // Drops: x, y, vx, vy, width, volume (a splash carries none), alive.
  const BX = new Float64Array(NB), BY = new Float64Array(NB), BVX = new Float64Array(NB), BVY = new Float64Array(NB), BW = new Float64Array(NB), BV = new Float64Array(NB), BA = new Uint8Array(NB), BO = new Float64Array(NB);
  // Stains: x, y, size.
  const STX = new Float64Array(NS), STY = new Float64Array(NS), STR = new Float64Array(NS);
  // Drips: the plate, where it hit and where its head is (x from the plate's middle), its age, width, alive.
  const KP = new Uint8Array(ND), K0 = new Float64Array(ND), K1 = new Float64Array(ND), KT = new Float64Array(ND), KW = new Float64Array(ND), KA = new Uint8Array(ND);
  let nb = 0, ns = 0, order = 0;

  function reset() {
    S.fill(0);
    S[STARS] = 3;
    S[LAST] = -1;
    BA.fill(0);
    KA.fill(0);
    ns = 0;
    for (let i = 0; i < NP; i++) (X[i] = 34 + i * GAP), plate(i, X[i]!);
  }
  function plate(i: number, x: number) {
    (X[i] = x), (LV[i] = 0), (W[i] = WV[i] = 0), (GR[i] = OV[i] = PO[i] = 0);
    for (let k = 0; k < ND; k++) if (KP[k] === i) KA[k] = 0;
  }
  /** Gravy on the mash or the plate, off the crater: a drip that runs down the mound and fades. A
   *  stream on the same spot keeps its drip fed (it stays, a little wider) instead of a new one. */
  function drip(i: number, dx: number, w: number) {
    let o = -1;
    for (let k = 0; k < ND; k++) {
      if (!KA[k]) o < 0 && (o = k);
      else if (KP[k] === i && Math.abs(K0[k]! - dx) < 2.5 && K0[k]! * dx >= 0) return void ((KT[k] = Math.min(KT[k]!, 0.2)), (KW[k] = Math.min(2.2, KW[k]! + 0.04)));
    }
    if (o < 0) for (let k = 0, a = -1; k < ND; k++) if (KT[k]! > a) (a = KT[k]!), (o = k);
    (KP[o] = i), (K0[o] = K1[o] = dx), (KT[o] = 0), (KW[o] = Math.min(1.6, 0.7 + w * 0.4)), (KA[o] = 1);
  }
  const speed = () => Math.min(VMAX, V0 + S[SERVED]! * 0.45);
  /** The surface a drop at x meets: the plate's crater it falls in (its index), else −1 (the cloth). */
  function under(x: number) {
    for (let i = 0; i < NP; i++) if (Math.abs(x - X[i]!) < CR) return i;
    return -1;
  }
  const onPlate = (x: number) => {
    for (let i = 0; i < NP; i++) if (Math.abs(x - X[i]!) < 21) return i;
    return -1;
  };
  function drop(x: number, y: number, vx: number, vy: number, w: number, v: number) {
    for (let k = 0; k < NB; k++) {
      const j = (nb + k) % NB;
      if (BA[j]) continue;
      (BX[j] = x), (BY[j] = y), (BVX[j] = vx), (BVY[j] = vy), (BW[j] = w), (BV[j] = v), (BA[j] = 1), (BO[j] = order++);
      nb = (j + 1) % NB;
      return;
    }
  }
  function stain(x: number, y: number, r: number) {
    const k = ns < NS ? ns++ : (R() * NS) | 0;
    (STX[k] = x), (STY[k] = y), (STR[k] = r);
  }
  function grade(i: number) {
    GR[i] = 1;
    const l = LV[i]!;
    if (OV[i]) return;
    if (!PO[i]) {
      // Untouched: after two in a row the table waits.
      S[STREAK] = 0;
      if ((S[IDLE_N] = S[IDLE_N]! + 1) >= 2) (S[MODE] = WAIT), (S[IDLE_N] = 0);
      return ((S[LAST] = EV_DRY), (S[LASTT] = 0), (ev[EV_DRY] = 1));
    }
    S[IDLE_N] = 0;
    const k = Math.abs(l - LINE) < 0.07 ? EV_PERFECT : l > 0.62 ? EV_GOOD : EV_DRY;
    if (k === EV_DRY) S[STREAK] = 0;
    else (S[STREAK] = S[STREAK]! + 1), (S[SCORE] = S[SCORE]! + (k === EV_PERFECT ? 3 : 1));
    if (S[STREAK]! > S[BEST]!) S[BEST] = S[STREAK]!;
    (S[LAST] = k), (S[LASTT] = 0), (ev[k] = 1);
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    S[LASTT] = S[LASTT]! + dt;
    const held = I[0]! > 0, mode = S[MODE]!;
    if (held && (mode === IDLE || mode === WAIT || (mode === OVER && S[LASTT]! > 1))) {
      if (mode !== WAIT) reset();
      S[MODE] = PLAY;
      ev[EV_START] = 1;
    }
    const play = S[MODE] === PLAY, pour = held && play;
    let busy = play;
    // The boat tilts on a spring; the stream thickens with the hold.
    S[HOLD] = pour ? S[HOLD]! + dt : 0;
    S[TV] = S[TV]! + ((pour ? 0.62 : 0) - S[TILT]!) * 140 * dt - S[TV]! * 16 * dt;
    S[TILT] = S[TILT]! + S[TV]! * dt;
    S[FLOW] = pour && S[TILT]! > 0.3 ? FMAX * Math.min(1, Math.max(0, S[HOLD]! - 0.08) / 0.45) ** 1.3 : 0;
    if (Math.abs(S[TV]!) > 0.01 || S[TILT]! > 0.005) busy = true;
    if (S[FLOW]! > 0) {
      ev[EV_POUR] = 1;
      const f = S[FLOW]!;
      // From the spout's lip, where the tilt has it (the boat turns about its body).
      const a = S[TILT]!, c = Math.cos(a), s = Math.sin(a);
      drop(SX + 9 + LIPX * c + LIPY * s, SY - 2 - LIPX * s + LIPY * c, -10 - f * 3, 8, 0.8 + f * 1.6, f * dt);
    }
    // Plates slide left; one that has passed the spout is graded, one off the table comes back round.
    if (play) {
      const v = speed();
      for (let i = 0; i < NP; i++) {
        X[i] = X[i]! - v * dt;
        if (!GR[i] && X[i]! + CR < SX - 6) grade(i);
        if (X[i]! < -120) {
          let mx = -1e9;
          for (let k = 0; k < NP; k++) mx = Math.max(mx, X[k]!);
          plate(i, mx + GAP);
          S[SERVED] = S[SERVED]! + 1;
        }
      }
    }
    // The crater's pool wobbles on a spring after every drop.
    for (let i = 0; i < NP; i++) {
      WV[i] = WV[i]! - W[i]! * 260 * dt - WV[i]! * 6 * dt;
      W[i] = W[i]! + WV[i]! * dt;
      if (Math.abs(W[i]!) + Math.abs(WV[i]!) > 0.002) busy = true;
      else W[i] = WV[i] = 0;
    }
    // Drops fall; in a crater they fill it (over the rim it overflows); else they stain the cloth.
    for (let j = 0; j < NB; j++) {
      if (!BA[j]) continue;
      busy = true;
      BVY[j] = BVY[j]! + G * dt;
      BX[j] = BX[j]! + BVX[j]! * dt;
      BY[j] = BY[j]! + BVY[j]! * dt;
      const p = under(BX[j]!), q = onPlate(BX[j]!), dx = q >= 0 ? (BX[j]! - X[q]!) / 13 : 1;
      // The crater's pool, the mound's dome, the plate, or the cloth.
      const floor = p >= 0 ? surf(p) : q < 0 ? TABLE + 12 : Math.abs(dx) < 1 ? PY - 12.5 * Math.sqrt(1 - dx * dx) : PY - 1;
      if (BY[j]! < floor) continue;
      BA[j] = 0;
      if (p >= 0 && BV[j]! > 0) {
        LV[p] = LV[p]! + BV[j]!;
        PO[p] = 1;
        WV[p] = WV[p]! + BW[j]! * 0.25;
        if (BW[j]! > 1.6 && (order & 7) === 0) (ev[EV_SPLASH] = 1), drop(BX[j]!, floor, (R() - 0.5) * 30, -40 - R() * 30, 0.6, 0);
        if (LV[p]! > 1 && !OV[p]) {
          // Over the rim: it runs down the mound, onto the cloth; a star gone.
          (OV[p] = 1), (S[STARS] = S[STARS]! - 1), (S[STREAK] = 0), (S[LAST] = EV_OVERFLOW), (S[LASTT] = 0), (ev[EV_OVERFLOW] = 1);
          if (S[STARS]! <= 0) (S[MODE] = OVER), (ev[EV_OVER] = 1);
        }
        if (LV[p]! > 1) {
          LV[p] = 1;
          drop(X[p]! + (R() < 0.5 ? -CR : CR), PY - 13, (R() - 0.5) * 8, 0, 0.9, 0);
          stain(X[p]! + (R() - 0.5) * 44, TABLE + 13 + R() * 4, 1.5 + R() * 2);
        }
      } else if (q >= 0 && BV[j]! > 0) drip(q, BX[j]! - X[q]!, BW[j]!);
      else if (q < 0 && BV[j]! > 0) stain(BX[j]!, TABLE + 12 + R() * 4, 1 + BW[j]! * 0.8);
    }
    // Drips run down the mound (faster as it steepens), stop at its foot, fade.
    for (let k = 0; k < ND; k++) {
      if (!KA[k]) continue;
      busy = true;
      if ((KT[k] = KT[k]! + dt) > DLIFE) {
        KA[k] = 0;
        continue;
      }
      const d = Math.abs(K1[k]!);
      if (d < 12.8) K1[k] = K1[k]! + (K1[k]! < 0 ? -1 : 1) * Math.min(12.8 - d, (4 + d * 1.1) * dt);
    }
    if (S[LASTT]! < 1.2) busy = true;
    return busy;
  }
  /** The pool's top in plate p's crater (a cone: it rises with the level). */
  function surf(p: number) {
    return PY - 9 - LV[p]! * 5;
  }
  /** The mash's dome (or the plate, past its foot) at x from the plate's middle. */
  function mound(dx: number) {
    const u = Math.abs(dx) / 13;
    return u < 1 ? PY - 12.5 * Math.sqrt(1 - u * u) : PY - 0.6;
  }
  reset();
  return { S, I, ev, X, LV, W, GR, OV, PO, BX, BY, BW, BV, BA, BO, STX, STY, STR, KP, K0, K1, KT, KW, KA, step, reset, surf, mound, speed, get ns() { return ns; } };
}
export type Gravy = ReturnType<typeof gravy>;

export type GravyScene = SlotScene & { engine: ReturnType<typeof createEngine>; run: Gravy; poster(): void; readonly state: { mode: number; streak: number; best: number; stars: number; served: number } };

// Palettes by role: wall, wall trim, cloth, check, plate, ink, mash, crater, gravy, gravy light, gold, porcelain, band, stain, muted.
const LIGHT = ["#f3e2cf", "#e5cdb2", "#fbf4e6", "#e5484d", "#ffffff", "#1f2433", "#f6e7c1", "#d9bf86", "#7b4325", "#b8754a", "#f2c450", "#fbfaf6", "#5b6bbf", "#8a5a3c", "#8a8fa3"];
const DARK = ["#1d2136", "#262a45", "#e9dfcd", "#a8434a", "#eceae4", "#0c0e18", "#ead9b0", "#c4a874", "#6a3920", "#a8693f", "#f2c450", "#e7e5df", "#4a58a8", "#6f4730", "#8a8fa3"];
const WALL = 0, TRIM = 1, CLOTH = 2, CHECK = 3, PLATE = 4, INK = 5, MASH = 6, CRATER = 7, GRAVY = 8, GLOSS = 9, GOLD = 10, PORC = 11, BAND = 12, STAIN = 13;
const FONTS: string[] = [], FONT = (px: number) => FONTS[px * 10] || (FONTS[px * 10] = `900 ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`);
const F3 = FONT(3), F6 = FONT(6), NUMS = Array.from({ length: 100 }, (_, i) => String(i));
const WORD = ["", "", "PERFECT!", "GOOD", "MORE GRAVY!", "OVERFLOW!"];
const ORD = new Int32Array(NB);

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): GravyScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.setAttribute("aria-label", "Gravy Boat: hold Space or Enter to pour, let go to stop; fill each plate to the gold line (M mutes)");
  play.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:transparent;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;outline-offset:-4px";
  stage.append(canvas, play);
  const snd = sound(engine, { cues: { start: "ready", perfect: "power", good: "click", dry: "end", over: "hurt", gameover: "end" }, volume: 0.1 });
  const I = new Float64Array(1);
  const run = gravy((engine.random() * 2147483647) | 0, I), S = run.S;
  const hold = (on: boolean) => ((I[0] = on ? 1 : 0), engine.wake());
  if (first) hold(true), addEventListener("pointerup", () => hold(false), { ...sig, once: true });
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyM") return void (e.preventDefault(), (snd.on = !snd.on));
    if (e.code === "Space" || e.code === "Enter") e.preventDefault(), e.repeat || hold(true);
  }, sig);
  stage.addEventListener("keyup", (e) => (e.code === "Space" || e.code === "Enter") && hold(false), sig);
  play.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    play.focus({ preventScroll: true });
    play.setPointerCapture?.(e.pointerId);
    hold(true);
  }, sig);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) play.addEventListener(t, () => hold(false), sig);

  // [0] measure, [1] theme, [2] poster resolution, [3] css aspect.
  const V = new Float64Array(4);
  V[0] = V[1] = 1;
  let col = DARK;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[1] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  engine.add({
    read() {
      if (V[1]) (V[1] = 0), (col = document.documentElement.dataset.theme === "light" ? LIGHT : DARK);
      if (!V[0]) return;
      V[0] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[3] = r.width / Math.max(1, r.height);
    },
    step(e, dt) {
      if (run.step(dt)) e.busy();
      const ev = run.ev, em = e.events;
      if (ev[EV_START]) em.emit("start");
      if (ev[EV_PERFECT]) em.emit("perfect");
      else if (ev[EV_GOOD]) em.emit("good");
      if (ev[EV_OVERFLOW]) em.emit("over");
      if (ev[EV_OVER]) em.emit("gameover");
    },
    render() {
      // Wide stages see the table closer (72 tall around y 6); tall ones the whole 100.
      const wide = V[3]! > 1.2, k = canvas.height / (wide ? 72 : 100), vw = canvas.width / k, hw = vw / 2, mode = S[MODE]!;
      g.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2 - (wide ? 6 : 0) * k);
      g.lineJoin = g.lineCap = "round";
      // The wall, a rail, the tablecloth (checked), its edge.
      g.fillStyle = col[WALL]!;
      g.fillRect(-hw - 2, -52, vw + 4, 80);
      g.fillStyle = col[TRIM]!;
      g.fillRect(-hw - 2, -6, vw + 4, 26);
      g.fillStyle = col[INK]!;
      g.fillRect(-hw - 2, -7, vw + 4, 1.2);
      g.fillStyle = col[CLOTH]!;
      g.fillRect(-hw - 2, TABLE, vw + 4, 32);
      g.globalAlpha = 0.16;
      g.fillStyle = col[CHECK]!;
      for (let x = -hw - (hw % 10) - 10; x < hw + 10; x += 10) g.fillRect(x, TABLE, 5, 32);
      for (let y = TABLE + 1; y < 52; y += 6) g.fillRect(-hw - 2, y, vw + 4, 3);
      g.globalAlpha = 1;
      g.fillStyle = col[INK]!;
      g.fillRect(-hw - 2, TABLE - 0.6, vw + 4, 1.2);
      // Stains on the cloth (they stay).
      g.fillStyle = col[STAIN]!;
      g.globalAlpha = 0.75;
      for (let i = 0; i < run.ns; i++) g.beginPath(), g.ellipse(run.STX[i]!, run.STY[i]!, run.STR[i]!, run.STR[i]! * 0.42, 0, 0, 6.3), g.fill();
      g.globalAlpha = 1;
      for (let i = 0; i < NP; i++) if (Math.abs(run.X[i]!) < hw + 26) plate(i);
      drips();
      stream();
      boat(S[TILT]!);
      // Stage space: the stickers, the stars, the words.
      const sk = canvas.height / 100;
      g.setTransform(sk, 0, 0, sk, 0, 0);
      const W2 = V[3]! * 100, cx = W2 / 2, narrow = W2 < 120, ty = 52;
      chip(3, 3, "STREAK", NUMS[Math.min(99, S[STREAK]!)]!, col[GOLD]!);
      chip(3, 12.5, "BEST", NUMS[Math.min(99, S[BEST]!)]!, col[GOLD]!);
      for (let i = 0; i < 3; i++) star(W2 - 7 - i * 7.5, 7.5, i < S[STARS]!);
      if (mode === IDLE || mode === WAIT) {
        if (mode === IDLE) caption("GRAVY BOAT", cx, ty, Math.min(11, W2 / 7), col[PLATE]!);
        caption(mode === IDLE ? "HOLD TO POUR · FILL TO THE GOLD LINE" : "HOLD TO KEEP POURING", cx, ty + (mode === IDLE ? 9 : 0), narrow ? 3.2 : 4, col[GOLD]!);
      } else if (mode === OVER) {
        caption("TABLECLOTH RUINED", cx, ty, Math.min(9, W2 / 12), col[PLATE]!);
        if (S[LASTT]! > 1) caption("HOLD TO TRY AGAIN", cx, ty + 8, 3.6, col[GOLD]!);
      } else if (S[LAST]! >= EV_PERFECT && S[LASTT]! < 1.1) {
        const u = S[LASTT]!, s = u < 0.15 ? 0.7 + u * 3 : 1, w = S[LAST]!;
        g.save();
        g.translate(cx, ty - (u > 0.8 ? (u - 0.8) * 20 : 0));
        g.rotate(-0.05);
        g.scale(s, s);
        g.globalAlpha = u > 0.8 ? (1.1 - u) / 0.3 : 1;
        caption(WORD[w]!, 0, 0, Math.min(9, W2 / 12), w === EV_PERFECT ? col[GOLD]! : w === EV_OVERFLOW ? col[CHECK]! : col[PLATE]!);
        g.restore();
      }
    },
  });
  /** A plate on the table: the plate, the mash mound, its crater with the gold line, the pool. */
  function plate(i: number) {
    const x = run.X[i]!, l = run.LV[i]!, w = run.W[i]!, ov = run.OV[i];
    g.fillStyle = col[INK]!;
    g.globalAlpha = 0.15;
    g.beginPath();
    g.ellipse(x + 1.5, PY + 1.6, 22, 4.6, 0, 0, 6.3);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.fillStyle = col[PLATE]!;
    g.beginPath();
    g.ellipse(x, PY, 21, 4.6, 0, 0, 6.3);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(x, PY - 0.4, 14.5, 2.9, 0, 0, 6.3);
    g.stroke();
    // The mound: a soft dome, a crater on top.
    g.fillStyle = col[MASH]!;
    g.beginPath();
    g.moveTo(x - 13, PY);
    g.bezierCurveTo(x - 13, PY - 9, x - 9, PY - 12.5, x, PY - 12.5);
    g.bezierCurveTo(x + 9, PY - 12.5, x + 13, PY - 9, x + 13, PY);
    g.ellipse(x, PY, 13, 2.6, 0, 0, Math.PI);
    g.fill();
    g.stroke();
    // The spoon's ridges in the mash, down its side.
    g.beginPath();
    g.moveTo(x - 10.5, PY - 6), g.quadraticCurveTo(x - 8, PY - 2.5, x - 8.5, PY);
    g.moveTo(x + 7, PY - 9.6), g.quadraticCurveTo(x + 9.5, PY - 5, x + 8.5, PY - 1.5);
    g.stroke();
    g.fillStyle = col[CRATER]!;
    g.beginPath();
    g.ellipse(x, PY - 12.5, CR, 2.8, 0, 0, 6.3);
    g.fill();
    g.stroke();
    // The gold line inside the crater (inked, so it reads on the mash).
    g.beginPath();
    g.ellipse(x, PY - 12.5, CR * (0.55 + LINE * 0.45), 2.1, 0, Math.PI * 0.05, Math.PI * 0.95);
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = col[GOLD]!;
    g.lineWidth = 0.8;
    g.stroke();
    if (l > 0.01) {
      // The pool: wider as it rises, wobbling; a highlight that rides on it.
      const rx = CR * (0.35 + Math.min(1, l) * 0.6) * (1 + w * 0.1), ry = 1.3 + l * 1.2 - w * 0.4;
      g.fillStyle = col[GRAVY]!;
      g.beginPath();
      g.ellipse(x, PY - 12.3 - l * 0.4, rx, Math.max(0.5, ry), 0, 0, 6.3);
      g.fill();
      g.fillStyle = col[GLOSS]!;
      g.beginPath();
      g.ellipse(x - rx * 0.3, PY - 12.6 - l * 0.4 - ry * 0.2, rx * 0.35, Math.max(0.25, ry * 0.3), 0, 0, 6.3);
      g.fill();
      g.fillStyle = "#ffffff";
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(x - rx * 0.45 + w * 2, PY - 12.6 - l * 0.4 - ry * 0.25, rx * 0.1, Math.max(0.2, ry * 0.18), 0, 0, 6.3);
      g.fill();
      g.globalAlpha = 1;
    }
    if (ov) {
      // Runs down the mound on both sides.
      g.strokeStyle = col[GRAVY]!;
      g.lineWidth = 2.2;
      g.beginPath();
      for (const s of [-1, 1]) g.moveTo(x + s * 5.5, PY - 12.6), g.quadraticCurveTo(x + s * 10.5, PY - 11, x + s * 12, PY - 3), g.lineTo(x + s * 12.5, PY + 1);
      g.stroke();
    }
  }
  /** Drips: a smear from where the gravy hit down the mound to a bead at its head, fading out. */
  function drips() {
    g.strokeStyle = g.fillStyle = col[GRAVY]!;
    for (let k = 0; k < ND; k++) {
      if (!run.KA[k]) continue;
      const x = run.X[run.KP[k]!]!, a = run.K0[k]!, b = run.K1[k]!, w = run.KW[k]!;
      g.globalAlpha = Math.min(1, (DLIFE - run.KT[k]!) / 0.4);
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x + a, run.mound(a));
      for (let t = 1; t <= 4; t++) g.lineTo(x + a + ((b - a) * t) / 4, run.mound(a + ((b - a) * t) / 4));
      g.stroke();
      g.beginPath();
      g.arc(x + b, run.mound(b) + w * 0.2, w * 0.62, 0, 6.3);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  /** The stream: every drop in flight, joined in pour order while they are close; a gloss line. */
  function stream() {
    let n = 0;
    for (let j = 0; j < NB; j++) if (run.BA[j] && run.BV[j]! > 0) ORD[n++] = j;
    // Insertion sort by pour order (n ≤ NB, mostly sorted already).
    for (let a = 1; a < n; a++) {
      const v = ORD[a]!;
      let b = a - 1;
      while (b >= 0 && run.BO[ORD[b]!]! > run.BO[v]!) (ORD[b + 1] = ORD[b]!), b--;
      ORD[b + 1] = v;
    }
    for (let pass = 0; pass < 3; pass++) {
      g.strokeStyle = pass === 0 ? col[INK]! : pass === 1 ? col[GRAVY]! : col[GLOSS]!;
      for (let a = 1; a < n; a++) {
        const p = ORD[a - 1]!, q = ORD[a]!;
        if (run.BO[q]! - run.BO[p]! > 1.5) continue;
        const wd = (run.BW[p]! + run.BW[q]!) / 2;
        g.lineWidth = pass === 0 ? wd + 0.8 : pass === 1 ? wd : wd * 0.28;
        const o = pass === 2 ? -wd * 0.22 : 0;
        g.beginPath();
        g.moveTo(run.BX[p]! + o, run.BY[p]!), g.lineTo(run.BX[q]! + o, run.BY[q]!);
        g.stroke();
      }
    }
    // Splashes and drips: little drops.
    g.fillStyle = col[GRAVY]!;
    for (let j = 0; j < NB; j++) if (run.BA[j] && !run.BV[j]) g.beginPath(), g.arc(run.BX[j]!, run.BY[j]!, run.BW[j]! * 0.6, 0, 6.3), g.fill();
  }
  /** The gravy boat: porcelain with a blue band, a long spout to the left, a loop handle, tilted. */
  function boat(a: number) {
    g.save();
    g.translate(SX + 9, SY - 2);
    g.rotate(-a);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.9;
    // The gravy's surface at the rim, levelling as it tilts.
    g.fillStyle = col[PORC]!;
    g.beginPath();
    g.moveTo(-15, -6);
    g.quadraticCurveTo(-11, -5, -8, -4);
    g.bezierCurveTo(-6, 5, 10, 6, 13, -4);
    g.lineTo(13, -5.5);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = col[BAND]!;
    g.beginPath();
    g.moveTo(-6.6, 0), g.bezierCurveTo(-3, 3.6, 8, 3.6, 11.4, 0), g.lineTo(11, 1.6), g.bezierCurveTo(7, 5, -3, 5, -5.8, 1.8);
    g.closePath();
    g.fill();
    // The gravy inside, just under the rim; a lick of it on the spout while it pours.
    g.fillStyle = col[GRAVY]!;
    g.beginPath();
    g.ellipse(2.4, -4.9, 10, 1.1, 0, 0, 6.3);
    g.fill();
    if (a > 0.3) g.beginPath(), g.moveTo(-8, -4.6), g.quadraticCurveTo(-11, -5.2, LIPX, LIPY), g.lineTo(-8, -3.6), g.fill();
    g.fillStyle = col[PORC]!;
    g.beginPath();
    g.ellipse(2, -5.2, 11.4, 1.6, 0, Math.PI, 6.3);
    g.lineTo(13.4, -5.2);
    g.stroke();
    // The handle and the foot.
    g.beginPath();
    g.moveTo(12.6, -4.6), g.bezierCurveTo(19, -8, 19, 2, 11.5, 1.4);
    g.lineWidth = 2.4;
    g.stroke();
    g.strokeStyle = col[PORC]!;
    g.lineWidth = 1.1;
    g.stroke();
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.9;
    g.fillStyle = col[PORC]!;
    g.beginPath();
    g.ellipse(2.5, 4.6, 4.5, 1.1, 0, 0, 6.3);
    g.fill();
    g.stroke();
    g.restore();
  }
  function star(x: number, y: number, on: boolean) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i & 1 ? 1.5 : 3.4, an = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
    }
    g.closePath();
    g.fillStyle = on ? col[GOLD]! : col[WALL]!;
    g.fill();
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.stroke();
  }
  function caption(s: string, x: number, y: number, size: number, fill: string) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = FONT(Math.round(size * 10) / 10);
    g.lineWidth = size / 3;
    g.strokeStyle = col[INK]!;
    g.strokeText(s, x, y);
    g.fillStyle = fill;
    g.fillText(s, x, y);
  }
  function chip(x: number, y: number, label: string, v: string, c: string) {
    g.font = F3;
    const w = 7 + g.measureText(label).width + 2 + v.length * 4.4;
    g.fillStyle = col[INK]!;
    g.fillRect(x + 0.8, y + 0.8, w, 8);
    g.fillStyle = col[PLATE]!;
    g.fillRect(x, y, w, 8);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.6;
    g.strokeRect(x, y, w, 8);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = col[INK]!;
    g.fillText(label, x + 2.4, y + 4.3);
    g.font = F6;
    g.lineWidth = 1.2;
    g.fillStyle = c;
    g.strokeText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
    g.fillText(v, w + x - 2 - v.length * 4.4 + 1.6, y + 4.4);
  }

  engine.start();
  return {
    engine,
    accessible: true,
    run,
    get state() {
      return { mode: S[MODE]!, streak: S[STREAK]!, best: S[BEST]!, stars: S[STARS]!, served: S[SERVED]! };
    },
    // The poster: mid-pour, a thick stream landing in a crater that's nearly full.
    poster: () => {
      (V[2] = 0.6), (V[0] = 1);
      I[0] = 1;
      run.step(1 / 30);
      for (let i = 0; i < NP; i++) run.X[i] = SX + 1 + i * GAP;
    },
    destroy: () => engine.destroy(),
  };
}
/** The poster (scripts/gallery-posters.mjs): see `poster()`. */
export const posterAt = 1.12;
