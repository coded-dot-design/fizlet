// "Patch slash": a Midnight Harvest Fair flyer, and the patch is throwing its crop at it. Pumpkins,
// jack-o'-lanterns, crookneck gourds, ghost-white pumpkins and the odd black bomb pumpkin toss up
// from the field. Swipe (or drag, or tap one) to slice: the halves fly apart showing their flesh,
// seeds spray, and gobs of pulp splat onto the flyer's real letters and stick there, dripping, until
// they slide off. Whatever you miss falls back on the page: BONK, the letters it lands on jump.
// Slice a black one and it blows the nearest word apart: its letters fly, bounce off the field and
// find their way home. Two or more in one swipe is a combo. Tap empty sky to call another volley.
// Bricks: the kernel (fixed step; settle: no frames once the field is quiet and every letter is
// home; its ledger for every page write, so Recall gives the page back byte for byte) and
// fizlet/slot. Step allocates nothing (typed arrays); a letter is written only while it moves.
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";

const { abs, atan2, cos, hypot, max, min, sin, sqrt, PI } = Math;
const TAU = PI * 2;
const OBJ = 28, PARTS = 260, SPLATS = 70, POPS = 8, TRAIL = 10;
// Crop kinds (whole); the bomb is last.
const PUMPKIN = 0, JACK = 1, GOURD = 2, GHOST = 3, BOMB = 4;
// Object states.
const OFF = 0, WHOLE = 1, HALF = 2;
// Particle kinds.
const SEED = 0, GOB = 1, FIRE = 2, DUST = 3;
// Letter modes.
const REST = 0, SPRING = 1, BLOWN = 2, HOME = 3;
// Popup words: "x2 COMBO!" … "x9 COMBO!", then the rest.
const WORDS = [...Array.from({ length: 8 }, (_, i) => `x${i + 2} COMBO!`), "BOOM!", "BONK!", "SPLAT!", "SLICE!"];
const W_BOOM = 8, W_BONK = 9, W_SPLAT = 10, W_SLICE = 11;
// Popup fills: combos, then BOOM, BONK, SPLAT, SLICE.
const POPC = ["#ffd23f", "#b6ff3b", "#ffffff", "#ffb347", "#fff2c2"];
// Per kind: rind, rind shade, highlight, flesh, pulp, stem; the bomb's glow is its "flesh".
const COL = [
  ["#ff8a1f", "#c9520a", "#ffc27a", "#ffc46a", "#ffd76a", "#4f7d2b"],
  ["#ff7a12", "#b9470a", "#ffb862", "#ffbe5e", "#ffe08a", "#4f7d2b"],
  ["#ffd43a", "#3f8a2e", "#fff2a0", "#fff1b0", "#f3f7a8", "#3f6b22"],
  ["#f2ece0", "#c4b8a6", "#ffffff", "#ffd59c", "#ffe3b8", "#6b7d3b"],
  ["#2a1838", "#130a1e", "#5a3d73", "#b6ff3b", "#b6ff3b", "#3a2a1a"],
];
const INK = "#1a0b06", SEEDC = "#fff0c4", HOT = "#ffe27a";
// Scene slots.
const SW = 0, SH = 1, SC = 2, MEAS = 3, DPR = 4, TIME = 5, STOP = 6, SHAKE = 7, FLASH = 8, PLAY = 9, VOLLEY = 10;
const DOWN = 11, COMBO = 12, SLICED = 13, BEST = 14, HUD = 15, DEMO = 16, DEMO_T = 17, PX = 18, PY = 19, MOVED = 20, AUTO = 21;
const DX0 = 22, DY0 = 23, DX1 = 24, DY1 = 25, SPLATTED = 26, BOOMS = 27;

export type SlashScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  readonly state: { sliced: number; best: number; booms: number; live: number; moved: number; splats: number; letters: number };
  /** For tests: the i-th whole piece of crop in the air (kind and where, CSS px in the stage). */
  crop(i: number): { kind: number; x: number; y: number; r: number } | null;
  /** For tests and the poster: throw one, now. */
  toss(kind: number, x: number, apex: number): void;
};

export function slash(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SlashScene {
  const engine = createEngine({ root: stage, settle: 0.6, seed: 31 });
  const L = engine.ledger, R = engine.random;
  const wrap = slot.querySelector<HTMLElement>(".pp")!, hud = slot.querySelector<HTMLElement>(".pp-hud")!;
  const hudText = hud.firstChild as Text;
  stage.style.touchAction = "none";
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none";
  stage.append(canvas);
  const c = canvas.getContext("2d")!;

  // The page: every letter (and chip) is a unit; its word is its <b>.
  const els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const words = [...wrap.querySelectorAll("b")], WD = new Uint8Array(n);
  els.forEach((el, i) => (WD[i] = words.indexOf(el.parentElement as HTMLElement)));
  const HX = new Float32Array(n), HY = new Float32Array(n), HW = new Float32Array(n), HH = new Float32Array(n);
  const OX = new Float32Array(n), OY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n);
  const RO = new Float32Array(n), VR = new Float32Array(n), MT = new Float32Array(n), HIT = new Float32Array(n);
  const MODE = new Uint8Array(n), INK_ON = new Uint8Array(n);
  // Crop: kind, state, where, how fast, angle, spin, radius; a half's cut angle (local) and side.
  const K = new Uint8Array(OBJ), ST = new Uint8Array(OBJ), X = new Float32Array(OBJ), Y = new Float32Array(OBJ);
  const OVX = new Float32Array(OBJ), OVY = new Float32Array(OBJ), A = new Float32Array(OBJ), SPIN = new Float32Array(OBJ);
  const RAD = new Float32Array(OBJ), CUT = new Float32Array(OBJ), SIDE = new Int8Array(OBJ), BONKED = new Uint8Array(OBJ);
  // Particles; splats (a gob stuck to letter SL at (SX, SY) from its centre, radius, life, drip).
  const PXa = new Float32Array(PARTS), PYa = new Float32Array(PARTS), PVX = new Float32Array(PARTS), PVY = new Float32Array(PARTS);
  const PL = new Float32Array(PARTS), PS = new Float32Array(PARTS), PK = new Uint8Array(PARTS), PC = new Uint8Array(PARTS);
  const SL = new Int16Array(SPLATS), SX = new Float32Array(SPLATS), SY = new Float32Array(SPLATS), SR = new Float32Array(SPLATS);
  const SLF = new Float32Array(SPLATS), SD = new Float32Array(SPLATS), SCOL = new Uint8Array(SPLATS);
  // Popups (word, where, age, size) and the blade's trail (where, age).
  const QW = new Uint8Array(POPS), QX = new Float32Array(POPS), QY = new Float32Array(POPS), QT = new Float32Array(POPS).fill(9), QZ = new Float32Array(POPS);
  const BX = new Float32Array(TRAIL), BY = new Float32Array(TRAIL), BA = new Float32Array(TRAIL).fill(9);
  // Blast rings.
  const RX = new Float32Array(4), RY = new Float32Array(4), RA = new Float32Array(4).fill(9);
  const cnt = new Uint16Array(3); // particles alive, splats alive, popups made
  const G = new Float64Array(32);
  G[MEAS] = 1;
  const inbox = new Float64Array(4); // [0] kind (1 down, 2 move, 3 up), [1] x, [2] y — the latest only
  const taps = new Float64Array(3); // a pending tap: [0] 1, [1] x, [2] y

  const ro = new ResizeObserver(() => ((G[MEAS] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  // Input: one rect read per event (outside any frame); moves are applied as blade segments in step.
  const MOVES = 32, MX = new Float32Array(MOVES), MY = new Float32Array(MOVES);
  let mq = 0;
  const xy = (ev: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top] as const;
  };
  const sig = { signal: engine.signal };
  stage.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const [x, y] = xy(ev);
    stage.setPointerCapture?.(ev.pointerId);
    (inbox[0] = 1), (inbox[1] = x), (inbox[2] = y);
    mq = 0;
    engine.wake();
  }, sig);
  stage.addEventListener("pointermove", (ev) => {
    if (!ev.isPrimary || !G[DOWN] && inbox[0] !== 1) return;
    const [x, y] = xy(ev);
    if (mq < MOVES) (MX[mq] = x), (MY[mq] = y), mq++;
    else (MX[MOVES - 1] = x), (MY[MOVES - 1] = y);
    engine.wake();
  }, sig);
  const up = (ev: PointerEvent) => ev.isPrimary && ((inbox[3] = 1), engine.wake());
  stage.addEventListener("pointerup", up, sig);
  stage.addEventListener("pointercancel", up, sig);

  function part(k: number, x: number, y: number, vx: number, vy: number, life: number, size: number, col: number) {
    let i = 0;
    while (i < PARTS && PL[i]! > 0) i++;
    if (i === PARTS) return;
    (PK[i] = k), (PXa[i] = x), (PYa[i] = y), (PVX[i] = vx), (PVY[i] = vy), (PL[i] = life), (PS[i] = size), (PC[i] = col);
  }
  function pop(w: number, x: number, y: number, z: number) {
    const o = (cnt[2] = cnt[2]! + 1) % POPS;
    (QW[o] = w), (QX[o] = x), (QY[o] = y), (QT[o] = 0), (QZ[o] = z);
  }
  function obj(k: number, st: number, x: number, y: number, vx: number, vy: number, r: number) {
    for (let i = 0; i < OBJ; i++)
      if (!ST[i]) {
        (K[i] = k), (ST[i] = st), (X[i] = x), (Y[i] = y), (OVX[i] = vx), (OVY[i] = vy), (RAD[i] = r), (A[i] = 0), (SPIN[i] = 0), (BONKED[i] = 0);
        return i;
      }
    return -1;
  }
  /** Throw one of `k` from below the field at x, to peak at `apex` (fraction of the height from the top). */
  function toss(k: number, x: number, apex: number) {
    const s = G[SC]!, h = G[SH]!, g = 760 * s, r = (k === GOURD ? 24 : k === BOMB ? 21 : 26 + R() * 6) * s;
    const i = obj(k, WHOLE, x, h + r, (G[SW]! / 2 - x) * (0.25 + R() * 0.3), -sqrt(2 * g * (h + r - apex * h)), r);
    if (i >= 0) (SPIN[i] = (R() - 0.5) * 3), (A[i] = (R() - 0.5) * 0.6);
  }
  function volley() {
    const w = G[SW]!, many = 2 + ((R() * 2.6) | 0);
    for (let k = 0; k < many; k++) {
      const roll = R(), kind = roll < 0.3 ? PUMPKIN : roll < 0.5 ? JACK : roll < 0.68 ? GOURD : roll < 0.84 ? GHOST : BOMB;
      toss(kind, w * (0.14 + R() * 0.72), 0.12 + R() * 0.3);
    }
  }
  /** Knock letter i (a hop, a twist) unless it is flying already. */
  function knock(i: number, vx: number, vy: number, vr: number) {
    if (MODE[i] === BLOWN || MODE[i] === HOME) return;
    MODE[i] = SPRING;
    (VX[i] = VX[i]! + vx), (VY[i] = VY[i]! + vy), (VR[i] = VR[i]! + vr), (HIT[i] = 0.18);
  }
  function blast(x: number, y: number) {
    const s = G[SC]!;
    G[STOP] = 0.14;
    G[SHAKE] = 0.45;
    G[FLASH] = 1;
    G[COMBO] = 0;
    G[BOOMS] = G[BOOMS]! + 1;
    pop(W_BOOM, x, y - 20 * s, 1.6);
    const k = cnt[2]! & 3;
    (RX[k] = x), (RY[k] = y), (RA[k] = 0);
    for (let k = 0; k < 34; k++) {
      const a = R() * TAU, v = (80 + R() * 340) * s;
      part(FIRE, x, y, cos(a) * v, sin(a) * v - 60 * s, 0.35 + R() * 0.4, (5 + R() * 7) * s, k % 3);
    }
    // The nearest word goes up; everything else in reach is knocked away from the blast.
    let best = -1, bd = 1e9;
    for (let i = 0; i < n; i++) {
      const d = hypot(HX[i]! + OX[i]! - x, HY[i]! + OY[i]! - y);
      if (d < bd) (bd = d), (best = WD[i]!);
    }
    const reach = 220 * s;
    for (let i = 0; i < n; i++) {
      const dx = HX[i]! + OX[i]! - x, dy = HY[i]! + OY[i]! - y, d = max(8 * s, hypot(dx, dy));
      if (WD[i] === best && bd < reach * 1.4) {
        MODE[i] = BLOWN;
        MT[i] = 1.5 + R() * 0.4;
        const v = (420 + R() * 260) * s;
        (VX[i] = (dx / d) * v + (R() - 0.5) * 160 * s), (VY[i] = (dy / d) * v * 0.6 - (260 + R() * 220) * s), (VR[i] = (R() - 0.5) * 1400), (HIT[i] = 0.4);
      } else if (d < reach) {
        const k = (1 - d / reach) * 520 * s;
        knock(i, (dx / d) * k, (dy / d) * k, (R() - 0.5) * 300);
      }
    }
    // The blast shoves the crop still in the air.
    for (let o = 0; o < OBJ; o++) {
      if (!ST[o]) continue;
      const dx = X[o]! - x, dy = Y[o]! - y, d = max(10 * s, hypot(dx, dy));
      if (d > reach) continue;
      const k = ((1 - d / reach) * 600 * s) / d;
      (OVX[o] = OVX[o]! + dx * k), (OVY[o] = OVY[o]! + dy * k - 80 * s), (SPIN[o] = SPIN[o]! + (R() - 0.5) * 10);
    }
  }
  /** Cut crop i along the direction (dx, dy). */
  function cut(i: number, dx: number, dy: number) {
    const k = K[i]!, x = X[i]!, y = Y[i]!, r = RAD[i]!, s = G[SC]!;
    ST[i] = OFF;
    const a = atan2(dy, dx), nx = -sin(a), ny = cos(a);
    for (let side = -1; side <= 1; side += 2) {
      const h = obj(k, HALF, x + nx * side * 3 * s, y + ny * side * 3 * s, OVX[i]! * 0.6 + nx * side * 130 * s + dx * 0.05, min(OVY[i]!, 0) * 0.4 + ny * side * 90 * s - 60 * s, r);
      if (h < 0) continue;
      (A[h] = A[i]!), (CUT[h] = a - A[i]!), (SIDE[h] = side), (SPIN[h] = side * (3 + R() * 4) + SPIN[i]!);
      // A bomb's shell is thrown hard.
      if (k === BOMB) (OVX[h] = OVX[h]! * 2.6), (OVY[h] = OVY[h]! * 2 - 200 * s), (SPIN[h] = SPIN[h]! * 2.5);
    }
    if (k === BOMB) return blast(x, y);
    for (let q = 0; q < 16; q++) {
      const t = (R() - 0.5) * 1.6 * r, side = q & 1 ? 1 : -1, v = (60 + R() * 200) * s;
      part(SEED, x + cos(a) * t, y + sin(a) * t, nx * side * v + (R() - 0.5) * 80 * s, ny * side * v - (80 + R() * 120) * s, 1 + R() * 0.6, (1.6 + R()) * s, k);
    }
    // Pulp: heavy gobs, thrown hard, that stick where they land.
    for (let q = 0; q < 9; q++) {
      const b = R() * TAU, v = (180 + R() * 320) * s;
      part(GOB, x, y, cos(b) * v + OVX[i]! * 0.3, sin(b) * v * 0.8 - 160 * s, 1.4, (3.2 + R() * 3.4) * s, k);
    }
    G[SLICED] = G[SLICED]! + 1;
    G[SPLATTED] = 0;
    G[COMBO] = G[COMBO]! + 1;
    if (G[COMBO]! > G[BEST]!) G[BEST] = G[COMBO]!;
    G[HUD] = 1;
    G[STOP] = max(G[STOP]!, 0.045);
    G[SHAKE] = max(G[SHAKE]!, 0.08);
    if (G[COMBO]! >= 2) pop(min(7, G[COMBO]! - 2), x, y - r - 10 * s, 1 + G[COMBO]! * 0.12);
    else pop(W_SLICE, x, y - r - 8 * s, 0.8);
  }
  /** The blade moves from (x0, y0) to (x1, y1): every whole piece it crosses is cut. */
  function blade(x0: number, y0: number, x1: number, y1: number) {
    const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
    for (let k = TRAIL - 1; k > 0; k--) (BX[k] = BX[k - 1]!), (BY[k] = BY[k - 1]!), (BA[k] = BA[k - 1]!);
    (BX[0] = x1), (BY[0] = y1), (BA[0] = 0);
    if (l < 1) return;
    for (let i = 0; i < OBJ; i++) {
      if (ST[i] !== WHOLE) continue;
      const t = max(0, min(1, ((X[i]! - x0) * dx + (Y[i]! - y0) * dy) / l)), ex = x0 + dx * t - X[i]!, ey = y0 + dy * t - Y[i]!;
      if (ex * ex + ey * ey < RAD[i]! * RAD[i]! * 0.95) cut(i, dx, dy);
    }
  }
  function letterAt(x: number, y: number, pad: number) {
    for (let i = 0; i < n; i++) {
      const lx = HX[i]! + OX[i]!, ly = HY[i]! + OY[i]!;
      if (abs(x - lx) < HW[i]! / 2 + pad && abs(y - ly) < HH[i]! / 2 + pad) return i;
    }
    return -1;
  }
  function stick(p: number, l: number) {
    let i = 0;
    while (i < SPLATS && SLF[i]! > 0) i++;
    if (i === SPLATS) return;
    (SL[i] = l), (SX[i] = PXa[p]! - HX[l]! - OX[l]!), (SY[i] = PYa[p]! - HY[l]! - OY[l]!), (SR[i] = PS[p]! * 1.6), (SLF[i] = 4.5 + R() * 1.5), (SD[i] = 0), (SCOL[i] = PC[p]!);
  }

  engine.add({
    read() {
      if (!G[MEAS]) return;
      G[MEAS] = 0;
      const r = stage.getBoundingClientRect(), dpr = min(2, devicePixelRatio || 1);
      (G[SW] = r.width), (G[SH] = r.height), (G[SC] = r.width / 640), (G[DPR] = dpr);
      canvas.width = Math.ceil(r.width * dpr);
      canvas.height = Math.ceil(r.height * dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      // Home boxes: the centre (a transform turns about it, so it stays put) less our own offset.
      for (let i = 0; i < n; i++) {
        const b = els[i]!.getBoundingClientRect();
        (HX[i] = b.left + b.width / 2 - r.left - OX[i]!), (HY[i] = b.top + b.height / 2 - r.top - OY[i]!), (HW[i] = els[i]!.offsetWidth), (HH[i] = els[i]!.offsetHeight * 0.8);
      }
    },
    step(e, dt) {
      const s = G[SC]!, w = G[SW]!, h = G[SH]!, g = 760 * s, floor = h - 6 * s;
      G[TIME] = G[TIME]! + dt;
      let busy = false;
      // Input: down starts a swipe (and its combo count), moves cut, up with no move is a tap.
      if (inbox[0] === 1) {
        inbox[0] = 0;
        (G[DOWN] = 1), (G[MOVED] = 0), (G[COMBO] = 0), (G[PX] = inbox[1]!), (G[PY] = inbox[2]!), (G[PLAY] = 4), (G[AUTO] = 0);
        (BX[0] = G[PX]!), (BY[0] = G[PY]!), (BA[0] = 0);
      }
      for (let k = 0; k < mq; k++) {
        const x = MX[k]!, y = MY[k]!;
        if (hypot(x - G[PX]!, y - G[PY]!) < 2) continue;
        G[MOVED] = G[MOVED]! + hypot(x - G[PX]!, y - G[PY]!);
        blade(G[PX]!, G[PY]!, x, y);
        (G[PX] = x), (G[PY] = y), (G[PLAY] = 4);
      }
      mq = 0;
      if (inbox[3]) {
        inbox[3] = 0;
        if (G[DOWN] && G[MOVED]! < 8 * s) (taps[0] = 1), (taps[1] = G[PX]!), (taps[2] = G[PY]!);
        G[DOWN] = 0;
      }
      // A tap: chop the piece under it (generous), or call a volley from the field below.
      if (taps[0]) {
        taps[0] = 0;
        const x = taps[1]!, y = taps[2]!;
        let hit = -1, hd = 1e9;
        for (let i = 0; i < OBJ; i++) {
          if (ST[i] !== WHOLE) continue;
          const d = hypot(X[i]! - x, Y[i]! - y);
          if (d < RAD[i]! + 16 * s && d < hd) (hd = d), (hit = i);
        }
        if (hit >= 0) {
          G[COMBO] = 0;
          const a = -1.2 + R() * 0.5;
          blade(x - cos(a) * 40 * s, y - sin(a) * 40 * s, x + cos(a) * 40 * s, y + sin(a) * 40 * s);
          if (ST[hit] === WHOLE) cut(hit, cos(a), sin(a)); // the stroke itself may have cut it already
        } else {
          toss(PUMPKIN + ((R() * 4) | 0), max(w * 0.12, min(w * 0.88, x)), 0.1 + R() * 0.2);
          G[VOLLEY] = 0.9;
        }
        G[PLAY] = 4;
      }
      // The story with no one here: one volley, and a ghost blade shows what a swipe does.
      if (G[DEMO] === 1 && G[TIME]! >= G[DEMO_T]!) {
        G[DEMO] = 2;
        toss(PUMPKIN, w * 0.3, 0.2);
        toss(JACK, w * 0.56, 0.16);
        toss(GOURD, w * 0.8, 0.26);
        // Hold awake until the ghost blade has swung (the crop keeps it busy after that).
        G[DEMO_T] = G[TIME]! + 0.62;
        e.busy(0.8);
      }
      if (G[DEMO] === 2 && G[TIME]! >= G[DEMO_T]!) {
        // From just left of the pumpkin to past the jack, over a few frames.
        let a = -1, b = -1;
        for (let i = 0; i < OBJ; i++) if (ST[i] === WHOLE) a < 0 ? (a = i) : b < 0 && (b = i);
        if (a >= 0 && b >= 0) {
          const dx = X[b]! - X[a]!, dy = Y[b]! - Y[a]!, d = hypot(dx, dy) || 1;
          (G[DX0] = X[a]! - (dx / d) * 70 * s), (G[DY0] = Y[a]! - (dy / d) * 70 * s + 14 * s), (G[DX1] = X[b]! + (dx / d) * 70 * s), (G[DY1] = Y[b]! + (dy / d) * 70 * s - 14 * s);
          (G[PX] = G[DX0]!), (G[PY] = G[DY0]!), (G[COMBO] = 0), (G[DEMO] = 3), (G[DEMO_T] = 0), (BA[0] = 9);
        } else G[DEMO] = 4;
      }
      if (G[DEMO] === 3) {
        busy = true;
        G[DEMO_T] = min(1, G[DEMO_T]! + dt / 0.14);
        const t = G[DEMO_T]!, x = G[DX0]! + (G[DX1]! - G[DX0]!) * t, y = G[DY0]! + (G[DY1]! - G[DY0]!) * t;
        blade(G[PX]!, G[PY]!, x, y);
        (G[PX] = x), (G[PY] = y);
        if (t >= 1) G[DEMO] = 4;
      }
      // Hit-stop: a cut freezes the world for a beat (the blade and the popups still move).
      const live = G[STOP]! > 0 ? 0 : dt;
      if (G[STOP]! > 0) (G[STOP] = G[STOP]! - dt), (busy = true);
      // Playing: a volley every so often while someone is swiping, and for a moment after.
      if (G[PLAY]! > 0) {
        G[PLAY] = G[PLAY]! - dt;
        busy = true;
        if ((G[VOLLEY] = G[VOLLEY]! - dt) <= 0 && G[PLAY]! > 1) (G[VOLLEY] = 1.15 + R() * 0.4), volley();
      }
      // Crop: falls, spins; on the way down it lands on the flyer's letters (BONK) and bounces.
      for (let i = 0; i < OBJ; i++) {
        if (!ST[i]) continue;
        busy = true;
        OVY[i] = OVY[i]! + g * live;
        (X[i] = X[i]! + OVX[i]! * live), (Y[i] = Y[i]! + OVY[i]! * live), (A[i] = A[i]! + SPIN[i]! * live);
        const r = RAD[i]! * (ST[i] === HALF ? 0.6 : 0.85);
        // Only a real fall lands (a slow one slips behind the text), at most three bounces each.
        if (OVY[i]! > 150 * s && live && BONKED[i]! < 3) {
          // Every letter under it takes the hit; then it bounces once off the highest.
          const hit = OVY[i]!, half = ST[i] === HALF;
          let top = 1e9, tx = 0;
          for (let l = 0; l < n; l++) {
            const lx = HX[l]! + OX[l]!, ly = HY[l]! + OY[l]!, ex = max(abs(X[i]! - lx) - HW[l]! / 2, 0), ey = max(abs(Y[i]! - ly) - HH[l]! / 2, 0);
            if (ex * ex + ey * ey > r * r || Y[i]! > ly) continue;
            knock(l, (lx - X[i]!) * 1.5, hit * (half ? 0.22 : 0.4), (lx - X[i]! > 0 ? 1 : -1) * 150);
            if (ly - HH[l]! / 2 < top) (top = ly - HH[l]! / 2), (tx = lx);
          }
          if (top < 1e9) {
            BONKED[i] = BONKED[i]! + 1;
            OVY[i] = -hit * (half ? 0.3 : 0.5);
            OVX[i] = OVX[i]! + (X[i]! - tx) * 3;
            SPIN[i] = SPIN[i]! + (X[i]! - tx > 0 ? 2 : -2);
            Y[i] = min(Y[i]!, top - r * 0.7);
            if (!half && BONKED[i] === 1) pop(W_BONK, X[i]!, Y[i]! - r, 0.75), (G[SHAKE] = max(G[SHAKE]!, 0.1));
            for (let q = 0; q < 4; q++) part(DUST, X[i]!, top, (R() - 0.5) * 160 * s, -R() * 70 * s, 0.35, (2 + R() * 2) * s, 0);
          }
        }
        if (Y[i]! > h + RAD[i]! * 1.5 || X[i]! < -RAD[i]! * 3 || X[i]! > w + RAD[i]! * 3) ST[i] = OFF;
      }
      // Particles: seeds tumble, gobs stick to the first letter they meet, fire and smoke rise.
      cnt[0] = cnt[1] = 0;
      for (let i = 0; i < PARTS; i++) {
        if (PL[i]! <= 0) continue;
        PL[i] = PL[i]! - dt;
        let dead = PL[i]! <= 0 || PYa[i]! > h + 20;
        if (!dead && live) {
          const k = PK[i]!;
          const grav = k === FIRE ? -120 * s : k === DUST ? 300 * s : g;
          const drag = k === FIRE ? 0.04 : 0.7;
          const f = Math.pow(drag, dt);
          (PVX[i] = PVX[i]! * f), (PVY[i] = PVY[i]! * f + grav * dt);
          (PXa[i] = PXa[i]! + PVX[i]! * dt), (PYa[i] = PYa[i]! + PVY[i]! * dt);
          if (k === GOB) {
            const l = letterAt(PXa[i]!, PYa[i]!, PS[i]! * 0.3);
            if (l >= 0) {
              stick(i, l);
              knock(l, PVX[i]! * 0.08, PVY[i]! * 0.12 + 40 * s, PVX[i]! > 0 ? 90 : -90);
              if (!G[SPLATTED]) (G[SPLATTED] = 1), pop(W_SPLAT, PXa[i]!, PYa[i]! - 14 * s, 0.7);
              dead = true;
            }
          } else if (k === SEED && PYa[i]! > floor && PVY[i]! > 0) (PYa[i] = floor), (PVY[i] = -PVY[i]! * 0.35), (PVX[i] = PVX[i]! * 0.6);
        }
        if (dead) PL[i] = 0;
        else cnt[0]++;
      }
      // Splats drip down their letter, then slide off.
      for (let i = 0; i < SPLATS; i++) {
        if (SLF[i]! <= 0) continue;
        SLF[i] = SLF[i]! - dt;
        SD[i] = min(SR[i]! * 2.6, SD[i]! + dt * 7 * s);
        cnt[1]++;
      }
      // Letters: a knocked one springs home; a blown one flies, bounces off the field, then flies home.
      let moving = 0;
      for (let i = 0; i < n; i++) {
        const m = MODE[i]!;
        if (HIT[i]! > 0) HIT[i] = HIT[i]! - dt;
        if (m === REST) continue;
        moving++;
        if (m === SPRING) {
          const k = 260, d = 14;
          (VX[i] = VX[i]! + (-k * OX[i]! - d * VX[i]!) * live), (VY[i] = VY[i]! + (-k * OY[i]! - d * VY[i]!) * live), (VR[i] = VR[i]! + (-k * RO[i]! - d * VR[i]!) * live);
          (OX[i] = OX[i]! + VX[i]! * live), (OY[i] = OY[i]! + VY[i]! * live), (RO[i] = RO[i]! + VR[i]! * live);
          if (abs(OX[i]!) + abs(OY[i]!) < 0.3 && abs(VX[i]!) + abs(VY[i]!) < 4 && abs(RO[i]!) < 0.5 && abs(VR[i]!) < 6) MODE[i] = REST;
        } else if (m === BLOWN) {
          VY[i] = VY[i]! + g * live;
          (OX[i] = OX[i]! + VX[i]! * live), (OY[i] = OY[i]! + VY[i]! * live), (RO[i] = RO[i]! + VR[i]! * live);
          const y = HY[i]! + OY[i]! + HH[i]! / 2, x = HX[i]! + OX[i]!;
          if (y > floor && VY[i]! > 0) {
            OY[i] = floor - HY[i]! - HH[i]! / 2;
            if (VY[i]! > 120 * s) for (let q = 0; q < 3; q++) part(DUST, x, floor, (R() - 0.5) * 140 * s, -R() * 60 * s, 0.4, (2 + R() * 2) * s, 0);
            (VY[i] = -VY[i]! * 0.42), (VX[i] = VX[i]! * 0.7), (VR[i] = VR[i]! * 0.6);
          }
          if (x < HW[i]! / 2 && VX[i]! < 0) VX[i] = -VX[i]! * 0.6;
          if (x > w - HW[i]! / 2 && VX[i]! > 0) VX[i] = -VX[i]! * 0.6;
          if ((MT[i] = MT[i]! - live) <= 0) (MODE[i] = HOME), (MT[i] = 0);
        } else {
          // Home on a smooth pull; a little overshoot spring takes over at the end.
          const k = 1 - Math.pow(0.0009, live);
          (OX[i] = OX[i]! * (1 - k)), (OY[i] = OY[i]! * (1 - k)), (RO[i] = RO[i]! * (1 - k));
          RO[i] = RO[i]! % 360;
          if (abs(OX[i]!) + abs(OY[i]!) < 3 * s) (MODE[i] = SPRING), (VX[i] = 0), (VY[i] = 120 * s), (VR[i] = 0);
        }
      }
      for (let k = 0; k < TRAIL; k++) if (BA[k]! < 0.18) (BA[k] = BA[k]! + dt), (busy = true);
      for (let k = 0; k < POPS; k++) if (QT[k]! < 1) (QT[k] = QT[k]! + dt * 1.3), (busy = true);
      for (let k = 0; k < 4; k++) if (RA[k]! < 1) (RA[k] = RA[k]! + dt * 2.6), (busy = true);
      if (G[SHAKE]! > 0) G[SHAKE] = G[SHAKE]! - dt;
      if (G[FLASH]! > 0) G[FLASH] = G[FLASH]! - dt * 6;
      if (busy || moving || cnt[0] || cnt[1] || G[SHAKE]! > 0 || G[HUD] || G[DOWN]) e.busy();
    },
    render() {
      const s = G[SC]!, dpr = G[DPR]!, t = G[TIME]!;
      const sh = G[SHAKE]! > 0 ? G[SHAKE]! * 22 * s : 0, jx = sh ? (R() - 0.5) * sh : 0, jy = sh ? (R() - 0.5) * sh : 0;
      // The page: letters that moved get a transform (and a flash of pulp colour when hit).
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        if (MODE[i] === REST) {
          if (INK_ON[i]) L.unstyle(el, "color"), L.unstyle(el, "transform"), (INK_ON[i] = 0);
          continue;
        }
        INK_ON[i] = 1;
        L.style(el, "transform", `translate(${(OX[i]! * 2 | 0) / 2}px,${(OY[i]! * 2 | 0) / 2}px) rotate(${RO[i]! | 0}deg)`);
        L.style(el, "color", HIT[i]! > 0 ? HOT : "");
      }
      L.style(wrap, "translate", sh ? `${jx | 0}px ${jy | 0}px` : "");
      if (G[HUD]) (G[HUD] = 0), L.text(hudText, `SLICED ${G[SLICED]} · BEST x${G[BEST]}`);
      c.setTransform(dpr, 0, 0, dpr, jx * dpr, jy * dpr);
      c.clearRect(-40, -40, G[SW]! + 80, G[SH]! + 80);
      // Splats on the letters (drawn where the letter is now), with their drips.
      for (let i = 0; i < SPLATS; i++) {
        if (SLF[i]! <= 0) continue;
        const l = SL[i]!, x = HX[l]! + OX[l]! + SX[i]!, y = HY[l]! + OY[l]! + SY[i]!, r = SR[i]!;
        c.globalAlpha = min(1, SLF[i]!) * 0.92;
        c.fillStyle = COL[SCOL[i]!]![4]!;
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.arc(x + r * 0.9, y - r * 0.4, r * 0.45, 0, TAU);
        c.arc(x - r * 0.8, y + r * 0.3, r * 0.4, 0, TAU);
        c.fill();
        c.fillRect(x - r * 0.25, y, r * 0.5, SD[i]!);
        c.beginPath();
        c.arc(x, y + SD[i]!, r * 0.32, 0, TAU);
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = max(1, r * 0.18);
        c.beginPath();
        c.arc(x, y, r, 0.3, 2.6);
        c.stroke();
        c.fillStyle = SEEDC;
        c.fillRect(x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.25);
      }
      c.globalAlpha = 1;
      // Crop.
      for (let i = 0; i < OBJ; i++) if (ST[i]) piece(i, t);
      // Particles.
      for (let i = 0; i < PARTS; i++) {
        if (PL[i]! <= 0) continue;
        const k = PK[i]!, x = PXa[i]!, y = PYa[i]!, z = PS[i]!;
        if (k === SEED) {
          c.fillStyle = PC[i] === BOMB ? COL[BOMB]![3]! : SEEDC;
          c.beginPath();
          c.ellipse(x, y, z * 1.3, z * 0.75, PVX[i]! * 0.01 + i, 0, TAU);
          c.fill();
        } else if (k === GOB) {
          c.fillStyle = COL[PC[i]!]![4]!;
          c.beginPath();
          c.arc(x, y, z, 0, TAU);
          c.fill();
        } else if (k === FIRE) {
          const u = PL[i]! / 0.75;
          c.globalAlpha = min(1, u * 1.6);
          c.fillStyle = u > 0.6 ? "#fff6c2" : u > 0.35 ? (PC[i] ? "#ffb21f" : "#ffd23f") : "#ff4f1f";
          c.beginPath();
          c.arc(x, y, z * (0.5 + u * 0.6), 0, TAU);
          c.fill();
        } else {
          const u = min(1, PL[i]!);
          c.globalAlpha = u;
          c.fillStyle = "#c9a27a";
          c.beginPath();
          c.arc(x, y, z, 0, TAU);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      // Blast rings.
      for (let k = 0; k < 4; k++) {
        const a = RA[k]!;
        if (a < 0 || a >= 1) continue;
        c.globalAlpha = 1 - a;
        c.strokeStyle = k & 1 ? "#ffd23f" : "#b6ff3b";
        c.lineWidth = (10 - a * 8) * s;
        c.beginPath();
        c.arc(RX[k]!, RY[k]!, (20 + a * 190) * s, 0, TAU);
        c.stroke();
      }
      c.globalAlpha = 1;
      // The blade: a hot white edge in an orange glow, thinning behind.
      c.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        c.strokeStyle = pass ? "#fffbe8" : "rgba(255,138,31,.55)";
        for (let k = 1; k < TRAIL; k++) {
          if (BA[k]! >= 0.18 || BA[k - 1]! >= 0.18) continue;
          c.lineWidth = (pass ? 5 : 12) * s * (1 - k / TRAIL) + 0.5;
          c.beginPath();
          c.moveTo(BX[k - 1]!, BY[k - 1]!);
          c.lineTo(BX[k]!, BY[k]!);
          c.stroke();
        }
      }
      // Popups: they punch in, hang, float and fade.
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      for (let k = 0; k < POPS; k++) {
        const q = QT[k]!;
        if (q >= 1) continue;
        const z = QZ[k]! * (q < 0.12 ? 0.6 + q * 5 : 1.2 - min(0.2, (q - 0.12) * 0.6)), w = QW[k]!;
        c.globalAlpha = q > 0.7 ? (1 - q) / 0.3 : 1;
        c.font = `900 ${(22 * s * z) | 0}px system-ui,sans-serif`;
        c.lineWidth = 6 * s * z;
        c.strokeStyle = INK;
        const y = QY[k]! - q * 30 * s;
        c.strokeText(WORDS[w]!, QX[k]!, y);
        c.fillStyle = POPC[max(0, w - 7)]!;
        c.fillText(WORDS[w]!, QX[k]!, y);
      }
      c.globalAlpha = 1;
      if (G[FLASH]! > 0) {
        c.globalAlpha = G[FLASH]! * 0.55;
        c.fillStyle = "#fffbe8";
        c.fillRect(-40, -40, G[SW]! + 80, G[SH]! + 80);
        c.globalAlpha = 1;
      }
    },
  });

  function ell(x: number, y: number, rx: number, ry: number) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
    c.fill();
    c.stroke();
  }
  /** A body of kind k, radius r, in its own frame (upright). */
  function body(k: number, r: number, t: number) {
    const col = COL[k]!;
    c.strokeStyle = k === BOMB ? "#7dff3b" : INK;
    c.lineWidth = max(1.5, r * 0.09);
    // Stem (and the bomb's fuse) first: the body covers its foot.
    c.fillStyle = col[5]!;
    c.beginPath();
    c.moveTo(-r * 0.12, -r * 0.7);
    c.lineTo(-r * 0.08, -r * 1.12);
    c.lineTo(r * 0.2, -r * 1.06);
    c.lineTo(r * 0.12, -r * 0.7);
    c.closePath();
    c.fill();
    c.stroke();
    if (k === GOURD) {
      // A crookneck: a fat bulb with a curling neck, two green stripes.
      c.fillStyle = col[0]!;
      ell(r * 0.05, -r * 0.45, r * 0.34, r * 0.55);
      ell(0, r * 0.25, r * 0.66, r * 0.62);
      c.strokeStyle = col[1]!;
      c.lineWidth = r * 0.1;
      c.beginPath();
      c.moveTo(-r * 0.25, -r * 0.1);
      c.quadraticCurveTo(-r * 0.4, r * 0.4, -r * 0.15, r * 0.8);
      c.moveTo(r * 0.25, -r * 0.1);
      c.quadraticCurveTo(r * 0.4, r * 0.4, r * 0.15, r * 0.8);
      c.stroke();
      return;
    }
    // A pumpkin: two shaded side ribs, then the front ribs, then a shine.
    c.fillStyle = col[1]!;
    ell(-r * 0.45, 0, r * 0.55, r * 0.78);
    ell(r * 0.45, 0, r * 0.55, r * 0.78);
    c.fillStyle = col[0]!;
    ell(-r * 0.22, 0, r * 0.5, r * 0.82);
    ell(r * 0.22, 0, r * 0.5, r * 0.82);
    ell(0, 0, r * 0.36, r * 0.84);
    c.fillStyle = col[2]!;
    c.beginPath();
    c.ellipse(-r * 0.36, -r * 0.36, r * 0.09, r * 0.2, 0.3, 0, TAU);
    c.fill();
    if (k === JACK || k === BOMB) {
      // Carved: triangle eyes, a toothy grin (the bomb: a skull's sockets and a stitched mouth).
      const glow = k === BOMB ? col[3]! : "#ffd23f", f = k === BOMB ? 0.6 + 0.4 * sin(t * 24) : 1;
      c.globalAlpha = f;
      c.fillStyle = glow;
      c.beginPath();
      if (k === JACK) {
        c.moveTo(-r * 0.42, -r * 0.08), c.lineTo(-r * 0.24, -r * 0.4), c.lineTo(-r * 0.08, -r * 0.08);
        c.moveTo(r * 0.42, -r * 0.08), c.lineTo(r * 0.24, -r * 0.4), c.lineTo(r * 0.08, -r * 0.08);
        c.moveTo(-r * 0.5, r * 0.14);
        c.quadraticCurveTo(0, r * 0.75, r * 0.5, r * 0.14);
        c.lineTo(r * 0.25, r * 0.3), c.lineTo(r * 0.1, r * 0.18), c.lineTo(-r * 0.08, r * 0.32), c.lineTo(-r * 0.25, r * 0.2);
      } else {
        c.ellipse(-r * 0.24, -r * 0.16, r * 0.16, r * 0.2, 0, 0, TAU);
        c.moveTo(r * 0.4, -r * 0.16);
        c.ellipse(r * 0.24, -r * 0.16, r * 0.16, r * 0.2, 0, 0, TAU);
        c.moveTo(-r * 0.04, r * 0.04), c.lineTo(r * 0.04, r * 0.04), c.lineTo(0, r * 0.16);
        c.rect(-r * 0.3, r * 0.3, r * 0.6, r * 0.1);
      }
      c.fill();
      c.globalAlpha = 1;
      if (k === BOMB) {
        // The fuse: a curl from the stem, and its spark.
        c.strokeStyle = "#d9c7a0";
        c.lineWidth = r * 0.08;
        c.beginPath();
        c.moveTo(r * 0.05, -r * 1.05);
        c.quadraticCurveTo(r * 0.5, -r * 1.5, r * 0.6, -r * 1.15);
        c.stroke();
        const sp = r * (0.18 + 0.1 * sin(t * 40));
        c.fillStyle = "#fff6c2";
        c.beginPath();
        for (let q = 0; q < 8; q++) {
          const a = (q * TAU) / 8 + t * 9, z = q & 1 ? sp * 0.4 : sp;
          c.lineTo(r * 0.6 + cos(a) * z, -r * 1.15 + sin(a) * z);
        }
        c.fill();
      }
    }
  }
  function piece(i: number, t: number) {
    const k = K[i]!, r = RAD[i]!;
    c.save();
    c.translate(X[i]!, Y[i]!);
    c.rotate(A[i]!);
    if (ST[i] === WHOLE) {
      if (k === BOMB) {
        // A warning glow round the bomb.
        c.globalAlpha = 0.25 + 0.15 * sin(t * 12);
        c.fillStyle = COL[BOMB]![3]!;
        c.beginPath();
        c.arc(0, 0, r * 1.25, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
      }
      body(k, r, t);
    } else {
      // A half: the body clipped to its side of the cut, then the cut face, flesh and seeds.
      const ca = CUT[i]!, side = SIDE[i]!;
      c.rotate(ca);
      c.save();
      c.beginPath();
      c.rect(-r * 2, side > 0 ? 0 : -r * 2, r * 4, r * 2);
      c.clip();
      c.rotate(-ca);
      body(k, r, t);
      c.restore();
      const col = COL[k]!;
      c.fillStyle = col[3]!;
      c.strokeStyle = INK;
      c.lineWidth = max(1.5, r * 0.08);
      c.beginPath();
      c.ellipse(0, 0, r * 0.88, r * 0.26, 0, 0, TAU);
      c.fill();
      c.stroke();
      c.fillStyle = col[4]!;
      c.beginPath();
      c.ellipse(0, 0, r * 0.55, r * 0.14, 0, 0, TAU);
      c.fill();
      c.fillStyle = SEEDC;
      for (let q = -2; q <= 2; q++) c.fillRect(q * r * 0.2 - r * 0.04, -r * 0.04, r * 0.09, r * 0.07);
    }
    c.restore();
  }

  G[DEMO] = first ? 4 : 1;
  G[DEMO_T] = 0.35;
  engine.busy(0.4);
  engine.start();
  if (first) (taps[0] = 1), (taps[1] = first.x), (taps[2] = first.y);
  return {
    engine,
    get state() {
      let live = 0, moved = 0;
      for (let i = 0; i < OBJ; i++) live += ST[i] === WHOLE ? 1 : 0;
      for (let i = 0; i < n; i++) moved += MODE[i] ? 1 : 0;
      return { sliced: G[SLICED]!, best: G[BEST]!, booms: G[BOOMS]!, live, moved, splats: cnt[1]!, letters: n };
    },
    crop(i: number) {
      for (let o = 0; o < OBJ; o++) if (ST[o] === WHOLE && i-- === 0) return { kind: K[o]!, x: X[o]!, y: Y[o]!, r: RAD[o]! };
      return null;
    },
    toss(kind: number, x: number, apex: number) {
      toss(kind, x * G[SW]!, apex);
      (G[PLAY] = max(G[PLAY]!, 1)), engine.wake();
    },
    destroy: () => engine.destroy(),
  };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => slash(stage, slot, first);
/** The poster: the ghost blade has just cut the pumpkin and the jack, pulp on the heading. */
export const posterAt = 1.4;
