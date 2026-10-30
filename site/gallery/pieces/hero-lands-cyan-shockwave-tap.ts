// #26 "A hero lands with a cyan shockwave where you tap": a landing-page toy. The page says LANDING
// PAGE, "Built to take a hit.", two buttons, and a cat asleep on SIGN UP. Tap anywhere: the hero
// leaps out of the top (a crouch first), his shadow grows where you tapped, and he drops into a
// three-point landing. The ground cracks (a pixel crater that fades), a cyan shockwave rolls out
// across the page, and every letter, word and button it reaches is knocked up and away and falls
// back into place: only what the wave touches moves. Land on a button and it squashes. Land again
// quickly and it hits harder (the wave gets thicker, the page jumps higher). Sometimes he lands
// far too hard and gets stuck to the waist. The cat: the wave makes it jump; land close (or hard)
// and it is flung across the page onto his head, where it stays until he leaps again.
// Bricks: the kernel (fixed step, settle, its seeded random), fizlet/sprite (the hero and the cat,
// baked once), fizlet/fx (dust and chips, kinds as data). The letters, words and buttons are the
// stage's own elements (site/gallery/stages/hero-lands-cyan-shockwave-tap.html), moved only through
// custom properties written by the engine's ledger in render, so Recall gives the page back exactly.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, CAT, HERO, NECK, cape, drawCape } from "./hero";
import { drawWord, word } from "./comic";

export type LandingScene = SlotScene & { engine: ReturnType<typeof createEngine>; land(x: number, y: number): void };

const sq = "square" as const;
const INK = 0, MUTED = 1, LINE = 2, SYS = 3;
const FLAT = 0.6; // the ground is seen from above and in front: rings and craters are this flat
// Hero modes: waiting, leaping out, dropping, landed, stuck (too hard), rising, standing.
const WAITING = 0, LEAP = 1, DROP = 2, LANDED = 3, STUCK = 4, RISE = 5, STAND = 6;
// Cat modes: on its button, hopping, flung at the hero, on his head, hopping home.
const PERCH = 0, HOP = 1, FLUNG = 2, HEAD = 3, HOME = 4;
const CRATERS = 3, CRACKS = 10, SEGS = 7;
// Custom property values, made once: a frame only picks one.
const PXS: string[] = Array.from({ length: 801 }, (_, i) => `${i - 400}px`);
const DEG: string[] = Array.from({ length: 181 }, (_, i) => `${i - 90}deg`);
const SY: string[] = Array.from({ length: 11 }, (_, i) => `${0.5 + i * 0.05}`);
const MRAOW = word("MRAOW!");

// State slots.
const W = 0, H = 1, P = 2, RES = 3, DIRTY = 4, WAIT = 5, HM = 6, HT = 7, HX = 8, HY = 9, HVY = 10, TX = 11, TY = 12, QUEUE = 13;
const POWER = 14, SINCE = 15, RR = 16, RX = 17, RY = 18, RMAX = 19, RP = 20, WAVE = 21, CM = 22, CX = 23, CY = 24, CVX = 25, CVY = 26;
const CT = 27, CROT = 28, CST = 29, CW = 30, CWX = 31, CWAVE = 32, NEXT = 33, GY = 34, FLASH = 35;

export function landing(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): LandingScene {
  const engine = createEngine({ root: stage, settle: 0.6, seed: (Math.random() * 2147483647) | 0 || 1 });
  const L = engine.ledger;
  const S = new Float64Array(40);
  S[WAIT] = first ? 0 : 0.6;
  S[RES] = S[DIRTY] = 1;
  S[P] = 3;
  S[RR] = -1;
  S[CW] = -1;
  S[SINCE] = 99;
  if (first) (S[TX] = first.x), (S[TY] = first.y), (S[QUEUE] = 2); // css px until the first read
  const art = sprites({ ...HERO, cat: CAT });
  const fx = effects({ cap: 360, colors: [C.ink, C.muted, C.line, C.sys], scorch: 0, gravity: 260 });
  const { ids: { dust, chip }, emit } = emitter(fx, {
    dust: { shape: sq, drag: 3.2, gravity: -0.1, angle: 0, spread: 6.2832, speed: [30, 110], size: [1, 3], life: [0.35, 0.8] },
    chip: { shape: sq, drag: 0.6, gravity: 1, angle: -1.5708, spread: 1.7, speed: [60, 160], size: [1, 2], life: [0.4, 0.9] },
  });
  const cloth = cape(11, 1.9);

  // The page: every letter, word and button (base box in art px, offset, spin, squash, flash).
  const wrap = slot.querySelector(".hl26"), els = [...slot.querySelectorAll<HTMLElement>(".hl26-k")];
  const n = els.length;
  const EX = new Float64Array(n), EY = new Float64Array(n), EW = new Float64Array(n), EH = new Float64Array(n), MASS = new Float64Array(n);
  const OX = new Float64Array(n), OY = new Float64Array(n), VX = new Float64Array(n), VY = new Float64Array(n), RO = new Float64Array(n), RV = new Float64Array(n);
  const SQ = new Float64Array(n), FL = new Float64Array(n), HIT = new Float64Array(n);
  const LX = new Int16Array(n), LY = new Int16Array(n), LRo = new Int16Array(n), LSq = new Int16Array(n).fill(10), LF = new Uint8Array(n);
  let perch = 0;
  for (let i = 0; i < n; i++) {
    const c = els[i]!.classList;
    MASS[i] = c.contains("hl26-btn") ? 0.55 : els[i]!.parentElement!.classList.contains("hl26-p") ? 0.8 : 1;
    if (c.contains("hl26-go")) perch = i;
  }
  // Craters: centre, size, life left (s), and their cracks as points (x, y), retracting as it fades.
  const KX = new Float64Array(CRATERS), KY = new Float64Array(CRATERS), KS = new Float64Array(CRATERS), KL = new Float64Array(CRATERS), KN = new Int16Array(CRATERS);
  const CK = new Float32Array(CRATERS * CRACKS * SEGS * 2);

  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;image-rendering:pixelated;pointer-events:none";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const ro = new ResizeObserver(() => ((S[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  /** A tap at (x, y) CSS px in the stage: he lands there. */
  const land = (x: number, y: number) => {
    S[TX] = x / S[P]!;
    S[TY] = y / S[P]!;
    S[QUEUE] = 1;
    if (S[HM] === WAITING) S[WAIT] = 0;
    engine.wake();
  };
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    land(e.clientX - r.left, e.clientY - r.top);
  }, { signal: engine.signal });

  /** The ground point (art px) a tap asks for: inside the card, below the nav bar. */
  const clampX = (x: number) => Math.max(12, Math.min(S[W]! - 12, x));
  const clampY = (y: number) => Math.max(S[H]! * 0.3, Math.min(S[H]! - 4, y));
  /** The cat's seat on its button (feet), following the button as it moves. */
  const perchX = () => EX[perch]! + EW[perch]! * 0.22 + OX[perch]!;
  const perchY = () => EY[perch]! + OY[perch]!;
  /** The top of the standing hero's head. */
  const headY = () => S[HY]! - 27;

  /** Send the cat on a ballistic hop to (x, y) taking `t` s. */
  function hop(mode: number, x: number, y: number, t: number) {
    const g = 520;
    S[CM] = mode;
    S[CT] = t;
    S[CVX] = (x - S[CX]!) / t;
    S[CVY] = (y - S[CY]!) / t - 0.5 * g * t;
    S[CST] = 0.8;
  }

  /** Start the next landing: from the ground (a crouch and a leap out of the top) or from above. */
  function begin() {
    S[QUEUE] = 0;
    S[NEXT] = 1;
    const m = S[HM]!;
    if (m === WAITING) return drop();
    if (m === LEAP || m === DROP) return; // already on the way: the drop takes the new target
    S[HM] = LEAP;
    S[HT] = 0;
    S[HVY] = 0;
    if (S[CM] === HEAD) hop(HOME, perchX(), perchY(), 0.7);
  }
  function drop() {
    S[HM] = DROP;
    S[HT] = 0;
    S[HX] = clampX(S[TX]!);
    S[GY] = clampY(S[TY]!);
    S[HY] = -36;
    S[HVY] = 80;
    cloth.floor(Infinity);
    cloth.reset(S[HX]!, S[HY]! - 18);
  }
  /** The landing: power (quick landings hit harder; now and then far too hard), crater, ring. */
  function impact() {
    const x = S[HX]!, y = S[GY]!;
    S[HY] = y;
    S[POWER] = S[SINCE]! < 2.5 ? Math.min(3, S[POWER]! + 1) : 1;
    S[SINCE] = 0;
    const big = S[POWER] === 3 || engine.random() < 0.14, p = big ? 3 : S[POWER]!;
    S[HM] = big ? STUCK : LANDED;
    S[HT] = 0;
    S[FLASH] = 0.1;
    cloth.floor(y);
    // The ring: centre, power, radius to the farthest corner (in flat-ground distance).
    S[RX] = x;
    S[RY] = y;
    S[RR] = 2;
    S[RP] = p;
    S[WAVE] = S[WAVE]! + 1;
    const fx0 = Math.max(x, S[W]! - x), fy0 = Math.max(y, S[H]! - y) / FLAT;
    S[RMAX] = Math.sqrt(fx0 * fx0 + fy0 * fy0) + 8;
    // A crater, its cracks jagged outwards (the oldest crater makes room).
    let k = 0;
    for (let i = 1; i < CRATERS; i++) if (KL[i]! < KL[k]!) k = i;
    const s = big ? 2 : 0.8 + 0.2 * p, nk = big ? CRACKS : 6 + 2 * (p - 1);
    KX[k] = x;
    KY[k] = y;
    KS[k] = s;
    KL[k] = big ? 9 : 6;
    KN[k] = nk;
    for (let c = 0; c < nk; c++) {
      let a = (c / nk) * 6.2832 + (engine.random() - 0.5) * 0.5, px = x + Math.cos(a) * 8 * s, py = y + Math.sin(a) * 8 * s * FLAT * 0.8;
      for (let j = 0; j < SEGS; j++) {
        const o = ((k * CRACKS + c) * SEGS + j) * 2;
        CK[o] = px;
        CK[o + 1] = py;
        a += (engine.random() - 0.5) * 1.1;
        const len = (2 + engine.random() * 3) * s;
        px += Math.cos(a) * len;
        py += Math.sin(a) * len * FLAT;
      }
    }
    emit(dust, x, y, 18 + 10 * p, MUTED, 2, 1 + 0.3 * p);
    emit(chip, x, y - 1, 10 + 6 * p, INK, 3, 1);
    // A landing right on something squashes it.
    for (let i = 0; i < n; i++)
      if (x > EX[i]! + OX[i]! - 3 && x < EX[i]! + EW[i]! + OX[i]! + 3 && y > EY[i]! + OY[i]! - 2 && y < EY[i]! + EH[i]! + OY[i]! + 4) (SQ[i] = 0.35), (HIT[i] = S[WAVE]!), (FL[i] = 0.4);
  }
  /** The wave reaches element i at flat distance d (dx: which side of the landing it is on). */
  function knock(i: number, d: number, dx: number) {
    const p = S[RP]!, k = Math.max(0.25, 1 - d / S[RMAX]!) * MASS[i]!, side = dx >= 0 ? 1 : -1;
    // Up, but never out of the card: the jump tops out below the nav bar.
    VY[i] = Math.max(VY[i]! - (150 + 70 * p) * k, -Math.sqrt(1400 * Math.max(3, EY[i]! + OY[i]! - S[H]! * 0.11)));
    VX[i] = VX[i]! + side * (25 + 20 * p) * k;
    RV[i] = RV[i]! + side * (160 + 120 * p) * k * (0.6 + engine.random() * 0.8);
    FL[i] = 0.3;
  }

  /** The hero, his cape, in the pose for his mode (feet at HY). */
  function hero() {
    const m = S[HM]!, x = S[HX]!, y = S[HY]!, t = S[HT]!;
    if (m === WAITING) return;
    if (m === STUCK) {
      // Sunk to the waist: only what is above the crater's lip shows.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, S[W]!, Math.round(y));
      ctx.clip();
      drawCape(ctx, cloth, 3, 8, false, 6);
      art.draw(ctx, "stand", 0, x, y + 14 + (t > 0.85 ? -Math.round((t - 0.85) * 40) : 0), 0, 1);
      ctx.restore();
      return;
    }
    const pose = m === LEAP ? (t < 0.1 ? "rise" : "fist") : m === DROP ? "drop" : m === LANDED ? "land" : m === RISE ? "rise" : "stand";
    drawCape(ctx, cloth, 3, m === DROP ? 6 : 8, false, m === DROP ? 9 : m === LANDED ? 8 : pose === "stand" || pose === "rise" ? 8 : 11);
    art.draw(ctx, pose, 0, x, y + (m === LANDED && t < 0.05 ? 1 : 0), 0, 1);
  }

  engine.add({
    read() {
      if (!S[RES]) return;
      S[RES] = 0;
      const q = stage.getBoundingClientRect(), p = Math.max(1, Math.round(q.width / 180)), old = S[P]!;
      S[P] = p;
      canvas.style.width = (S[W] = canvas.width = Math.ceil(q.width / p)) * p + "px";
      canvas.style.height = (S[H] = canvas.height = Math.ceil(q.height / p)) * p + "px";
      if (S[QUEUE] === 2) (S[TX] = S[TX]! / p), (S[TY] = S[TY]! / p), (S[QUEUE] = 1);
      for (let i = 0; i < n; i++) {
        // The layout box (offset*: our transforms never move these numbers), up to the stage's box.
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: Element | null = el; a instanceof HTMLElement && a !== wrap; a = a.offsetParent) (x += a.offsetLeft), (y += a.offsetTop);
        EX[i] = x / p;
        EY[i] = y / p;
        EW[i] = el.offsetWidth / p;
        EH[i] = el.offsetHeight / p;
      }
      if (old !== p && S[HM] !== WAITING) {
        const k = old / p;
        S[HX] = S[HX]! * k;
        S[HY] = S[HY]! * k;
        S[GY] = S[GY]! * k;
      }
      if (S[CM] === PERCH) (S[CX] = perchX()), (S[CY] = perchY());
      S[DIRTY] = 1;
    },
    step(e, dt) {
      let busy = false;
      S[SINCE] = S[SINCE]! + dt;
      if (S[HM] === WAITING && (S[WAIT] = S[WAIT]! - dt) < 0) {
        if (!S[QUEUE]) (S[TX] = S[W]! * 0.5), (S[TY] = S[H]! * 0.88);
        begin();
      } else if (S[QUEUE] === 1 && S[HM] !== WAITING && (S[HM] !== LANDED || S[HT]! > 0.25) && (S[HM] !== STUCK || S[HT]! > 1.1)) begin();
      const m = S[HM]!, t = (S[HT] = S[HT]! + dt);
      // The wait before the first landing counts as busy, or the settle timer (also 0.6 s) can put
      // the engine to sleep before he ever drops.
      if ((m !== WAITING || S[WAIT]! >= 0) && m !== STAND) busy = true;
      if (m === LEAP) {
        // A crouch, then up and out of the top; then the drop at the target.
        if (t > 0.1) {
          S[HVY] = S[HVY]! - 2600 * dt;
          S[HY] = S[HY]! + Math.max(-520, S[HVY]!) * dt;
          cloth.floor(Infinity);
        }
        if (S[HY]! < -50) drop();
      } else if (m === DROP) {
        if (S[NEXT]) (S[NEXT] = 0), (S[HX] = clampX(S[TX]!)), (S[GY] = clampY(S[TY]!));
        S[HVY] = S[HVY]! + 1300 * dt;
        S[HY] = S[HY]! + S[HVY]! * dt;
        if (S[HY]! >= S[GY]!) impact();
      } else if (m === LANDED && t > 0.75) (S[HM] = RISE), (S[HT] = 0);
      else if (m === STUCK && t > 1.25) (S[HM] = RISE), (S[HT] = 0), emit(chip, S[HX]!, S[HY]!, 12, INK, 3, 1);
      else if (m === RISE && t > 0.22) (S[HM] = STAND), (S[HT] = 0);
      if (S[FLASH]! > 0) (S[FLASH] = S[FLASH]! - dt), (busy = true);
      // The ring rolls out; whatever it reaches (and has not been hit by this wave) is knocked.
      if (S[RR]! >= 0) {
        const r0 = S[RR]!, r = (S[RR] = r0 + (170 + 40 * S[RP]!) * dt), cx = S[RX]!, cy = S[RY]!;
        for (let i = 0; i < n; i++) {
          if (HIT[i] === S[WAVE]) continue;
          const x0 = EX[i]! + OX[i]!, y0 = EY[i]! + OY[i]!, nx = Math.max(x0, Math.min(x0 + EW[i]!, cx)), ny = Math.max(y0, Math.min(y0 + EH[i]!, cy));
          const dx = nx - cx, dy = (ny - cy) / FLAT, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= r) (HIT[i] = S[WAVE]!), knock(i, d, x0 + EW[i]! / 2 - cx);
        }
        // The cat.
        if (S[CM] === PERCH && S[CWAVE] !== S[WAVE]) {
          const dx = S[CX]! - cx, dy = (S[CY]! - cy) / FLAT, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= r) {
            S[CWAVE] = S[WAVE]!;
            if (S[RP]! >= 2 || d < 45) hop(FLUNG, S[HX]!, headY(), 1.05), (S[CW] = 0), (S[CWX] = S[CX]!);
            else hop(HOP, perchX(), perchY(), 0.45);
          }
        }
        if (r > S[RMAX]!) S[RR] = -1;
        busy = true;
      }
      // The page: each knocked element falls back onto its line, springs home and stops spinning.
      for (let i = 0; i < n; i++) {
        if (OY[i]! < 0 || VY[i]! !== 0) {
          VY[i] = VY[i]! + 700 * dt;
          OY[i] = OY[i]! + VY[i]! * dt;
          if (OY[i]! >= 0) (OY[i] = 0), (VY[i] = Math.abs(VY[i]!) > 40 ? -VY[i]! * 0.32 : 0);
        }
        VX[i] = VX[i]! + (-30 * OX[i]! - 5 * VX[i]!) * dt;
        OX[i] = OX[i]! + VX[i]! * dt;
        RV[i] = RV[i]! + (-60 * RO[i]! - 6 * RV[i]!) * dt;
        RO[i] = RO[i]! + RV[i]! * dt;
        if (SQ[i]! > 0) SQ[i] = Math.max(0, SQ[i]! - dt);
        if (FL[i]! > 0) FL[i] = Math.max(0, FL[i]! - dt);
        if (OY[i] === 0 && VY[i] === 0 && Math.abs(OX[i]!) + Math.abs(VX[i]!) < 0.05 && Math.abs(RO[i]!) + Math.abs(RV[i]!) < 0.2) OX[i] = VX[i] = RO[i] = RV[i] = 0;
        else busy = true;
        if (SQ[i]! > 0 || FL[i]! > 0) busy = true;
      }
      // The cat: ballistic hops; flung onto his head; home again when he leaps.
      const cm = S[CM]!;
      if (cm === HOP || cm === FLUNG || cm === HOME) {
        S[CVY] = S[CVY]! + 520 * dt;
        S[CX] = S[CX]! + S[CVX]! * dt;
        S[CY] = S[CY]! + S[CVY]! * dt;
        if (cm === FLUNG) S[CROT] = S[CROT]! + 14 * dt;
        if ((S[CT] = S[CT]! - dt) <= 0) {
          S[CROT] = 0;
          if (cm === FLUNG && (S[HM] === STAND || S[HM] === RISE || S[HM] === LANDED)) S[CM] = HEAD;
          else if (cm === FLUNG) hop(HOME, perchX(), perchY(), 0.6);
          else S[CM] = PERCH;
          emit(dust, S[CX]!, S[CY]!, 5, MUTED, 1, 0.5);
        }
        busy = true;
      }
      if (S[CM] === PERCH) (S[CX] = perchX()), (S[CY] = perchY());
      else if (S[CM] === HEAD) (S[CX] = S[HX]! - 1), (S[CY] = headY() + (S[HM] === RISE ? 5 : S[HM] === LANDED ? 14 : 0));
      if (S[CST]! > 0) (S[CST] = S[CST]! - dt), (busy = true);
      if (S[CW]! >= 0) ((S[CW] = S[CW]! + dt) > 1.1 && (S[CW] = -1), (busy = true));
      // Craters fade: cracks retract from their tips, then the crater goes.
      for (let k = 0; k < CRATERS; k++) if (KL[k]! > 0) (KL[k] = KL[k]! - dt), (busy = true);
      // The cape: tied at the neck of the pose, lying on the ground once he's down.
      const hm = S[HM]!, neck = hm === STAND ? NECK.stand : hm === RISE ? NECK.rise : hm === LANDED ? NECK.land : hm === DROP ? NECK.drop : hm === STUCK ? NECK.stand : NECK.fist;
      if (hm !== WAITING) {
        cloth.wind(0, hm === DROP ? -900 : 0, hm === DROP ? 1800 : hm === LEAP ? 900 : 0);
        const mv = cloth.step(S[HX]! + neck[0], S[HY]! + neck[1] + (hm === STUCK ? 14 : 0), dt);
        if (mv > 0.02) busy = true;
      }
      fx.step(dt);
      if (fx.live) busy = true;
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      // The page: only what changed, through the ledger; home again, the properties go.
      const p = S[P]!;
      for (let i = 0; i < n; i++) {
        const el = els[i]!, x = Math.max(-400, Math.min(400, Math.round(OX[i]! * p))), y = Math.max(-400, Math.min(400, Math.round(OY[i]! * p)));
        const r = Math.max(-90, Math.min(90, Math.round(RO[i]!))), s = SQ[i]! > 0 ? Math.round(10 - Math.sin((SQ[i]! / 0.35) * Math.PI) * 9) : 10, f = FL[i]! > 0 ? 1 : 0;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--x", PXS[x + 400]!) : L.unstyle(el, "--x");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", PXS[y + 400]!) : L.unstyle(el, "--y");
        if (r !== LRo[i]) (LRo[i] = r), r ? L.style(el, "--r", DEG[r + 90]!) : L.unstyle(el, "--r");
        if (s !== LSq[i]) (LSq[i] = s), s !== 10 ? L.style(el, "--sy", SY[s]!) : L.unstyle(el, "--sy");
        if (f !== LF[i]) (LF[i] = f), L.attr(el, "data-hit", f ? "" : null);
      }
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      const w = S[W]!, h = S[H]!;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      // Craters and cracks (oldest first), under everything.
      for (let k = 0; k < CRATERS; k++) {
        const life = KL[k]!;
        if (life <= 0) continue;
        const s = KS[k]!, cx = Math.round(KX[k]!), cy = Math.round(KY[k]!), keep = Math.ceil(SEGS * Math.min(1, life / 4));
        ctx.fillStyle = C.line;
        for (let c = 0; c < KN[k]!; c++)
          for (let j = 0; j + 1 < keep; j++) {
            const o = ((k * CRACKS + c) * SEGS + j) * 2, ax = CK[o]!, ay = CK[o + 1]!, bx = CK[o + 2]!, by = CK[o + 3]!, st = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
            for (let q = 0; q <= st; q++) ctx.fillRect(Math.round(ax + ((bx - ax) * q) / (st || 1)), Math.round(ay + ((by - ay) * q) / (st || 1)), 1, 1);
          }
        if (life > 1.5 || ((life * 10) | 0) % 2) {
          // The crater: a dark flat bowl, a lit lip at the front.
          const rx = Math.round(8 * s), ry = Math.max(2, Math.round(8 * s * FLAT * 0.55));
          for (let y = -ry; y <= ry; y++) {
            const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
            ctx.fillStyle = C.rim;
            ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
            if (y > -ry + 1 && half > 2) (ctx.fillStyle = y < 0 ? C.base : C.line), ctx.fillRect(cx - half + 1, cy + y, half * 2 - 1, 1);
          }
          ctx.fillStyle = C.muted;
          ctx.fillRect(cx - rx + 2, cy + ry + 1, rx * 2 - 3, 1);
        }
      }
      // The shadow where he will land, growing as he falls.
      if (S[HM] === DROP || (S[HM] === LEAP && S[HT]! > 0.1)) {
        const k = S[HM] === DROP ? Math.max(0.15, Math.min(1, 1 - (S[GY]! - S[HY]!) / (S[GY]! + 36))) : 0.15;
        const rx = Math.round(3 + 8 * k), x = Math.round(S[HM] === DROP ? S[HX]! : clampX(S[TX]!)), y = Math.round(S[HM] === DROP ? S[GY]! : clampY(S[TY]!));
        ctx.fillStyle = C.muted;
        ctx.fillRect(x - rx, y - 1, rx * 2 + 1, 3);
        ctx.fillStyle = C.line;
        ctx.fillRect(x - rx + 2, y, rx * 2 - 3, 1);
      }
      // The shockwave: a flat ring of cyan pixels with a rim and a bright inside; it breaks up
      // (every other pixel) as it reaches the edges.
      if (S[RR]! >= 0) {
        const r = S[RR]!, cx = S[RX]!, cy = S[RY]!, pw = S[RP]!, steps = Math.ceil(r * 6.2832 * 0.8) + 8, thin = r > S[RMAX]! * 0.65;
        for (let pass = 0; pass < 3; pass++) {
          ctx.fillStyle = pass === 0 ? C.rim : pass === 1 ? C.sys : C.ink;
          const rr = pass === 0 ? r + 1 : pass === 1 ? r : r - 1 - pw;
          for (let q = 0; q < steps; q++) {
            if (thin && q & 1) continue;
            const a = (q / steps) * 6.2832, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr * FLAT);
            if (pass === 1) ctx.fillRect(x, y - (pw > 1 ? 1 : 0), 1, pw > 1 ? 2 + (pw > 2 ? 1 : 0) : 1);
            else ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // The flash of the landing: a white ring hugging him for a moment.
      if (S[FLASH]! > 0) {
        ctx.fillStyle = C.ink;
        const x = Math.round(S[HX]!), y = Math.round(S[HY]!);
        ctx.fillRect(x - 14, y - 1, 28, 2);
        ctx.fillRect(x - 10, y - 3, 20, 1);
      }
      hero();
      // The cat: sitting, startled, flung (spinning), on his head.
      const cf = S[CST]! > 0 || S[CM] === FLUNG ? 1 : 0;
      art.draw(ctx, "cat", cf, S[CX]!, S[CY]! - (S[CROT] ? 4 : 0), S[CROT]!, 1);
      if (S[CST]! > 0.3 && S[CM] !== FLUNG) {
        const x = Math.round(S[CX]! + 1), y = Math.round(S[CY]! - 15);
        ctx.fillStyle = C.rim;
        ctx.fillRect(x - 1, y - 1, 3, 7);
        ctx.fillStyle = C.hurt;
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x, y + 4, 1, 1);
      }
      if (S[CW]! >= 0) {
        const pop = S[CW]! < 0.06 ? 2 : S[CW]! < 0.12 ? 1 : 0;
        drawWord(ctx, MRAOW, Math.max(2, Math.min(w - MRAOW.w - 6, S[CWX]! - MRAOW.w / 2)), Math.max(4, S[CY]! - 24), MRAOW.n, pop, C.go, C.cmd, C.rim, C.ink);
      }
      fx.draw(ctx);
    },
  });
  engine.start();
  return { engine, land, destroy: () => engine.destroy() };
}

/** For `slot(target, () => import("./hero-lands-cyan-shockwave-tap").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => landing(stage, slot, first);
