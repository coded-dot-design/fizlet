// Pricing war: two plans on a pricing page, BASIC and PRO, are two forts built from their own
// blocks (the price, the features, the PICK ME button, the plan's letters on top as battlements),
// and each has a mascot on the roof with a cannon. Tap to fire from BASIC: one tap is a fast shell
// on a flat line, a double tap is a big slow bomb on a high lob. PRO fires back. A shell stops at
// the first thing it meets: a hit block crumbles into chunks of itself (baked once from its own font
// and colours) and what stood on it drops, lands with a thud and may go on; a bomb is the big one
// (flash, shake, rings, fire, smoke, debris) and knocks every letter near it. A mascot hit (or
// dropped from its roof) loses a pip; at none, the other plan wins, and the page puts itself back
// together. Left alone it plays one duel with a winner drawn at random, then a truce, and it sleeps.
// Bricks: the kernel (fixed step; settle, holding with busy() while anything is in the air or
// scheduled; the ledger for every page write, so Recall gives the page back byte for byte).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, shout, print, textW } from "./ink";
import { art, booms, disc } from "./lob";

export type WarScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly hp: number[]; readonly broken: number; readonly mode: number; readonly winner: number; readonly big: number };

const { abs, cos, sin, atan2, hypot, max, min, round } = Math;
const W = 160, H = 90, FLOOR = 80, G = 150, CAP = 1400, SH = 6;
// Modes: the duel, a win (the banner), the page coming home.
const PLAY = 0, OVER = 1, MEND = 2;
// State slots.
const MODE = 0, T = 1, QX = 2, QY = 3, QN = 4, QT = 5, AUTO = 6, AT = 7, NEXT = 8, WIN = 9, REPLY = 10, RT = 11, IDLE = 12;
const DIRTY = 13, BROKE = 14, WORD = 15, WT = 16, WX = 17, WY = 18, RES = 19, SHOTS = 20, FR = 21, LOSER = 22, BIG = 23;
// Per mascot (0 BASIC, 1 PRO), at slot 24 + team * 8.
const CX = 0, CY = 1, CVX = 2, CVY = 3, HP = 4, AIM = 5, KICK = 6, HURT = 7;
const HX = [28, 132], HY = 36, DIR = [1, -1];
const WORDS = ["KABOOM!", "OUCH!", "BONK", "BASIC WINS!", "PRO WINS!", "BAM!"];
const YS = Array.from({ length: 101 }, (_, i) => `${(i - 40) * 0.625}cqw`);
// The mounds: the middle hill (with the NO REFUNDS sign on it), flat elsewhere.
const ground = (x: number) => FLOOR - 7 * max(0, 1 - ((x - 80) / 20) ** 2);

// The mascots: round, helmeted, facing their foe; frame 1 squints (hurt).
const BODY = ["...hhh...", ".hhhhhhh.", "hhhhhhhhh", "bbbbbbbbb", "bbbwkbbwk", "bbbbbbbbb", "bbbbbbmmb", ".bbbbbbb.", ".ff...ff."];
const OW = BODY.map((r, i) => (i === 4 ? "bbbkkbbkk" : r));

export function war(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): WarScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 4294967295) >>> 0 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const fx = booms(260, W, H, ground, rnd);
  const look = [0, 1].map((t) => {
    const c = { h: t ? C.attack : C.sys, b: t ? C.hurt : C.go, w: C.ink, k: C.rim, m: C.attack, f: C.rim };
    return [art(BODY, c, t), art(OW, c, t)];
  });
  const S = new Float64Array(48);
  const M = (t: number) => 24 + t * 8;
  for (let t = 0; t < 2; t++) (S[M(t) + CX] = HX[t]!), (S[M(t) + CY] = HY), (S[M(t) + HP] = 3), (S[M(t) + AIM] = t ? 3.6 : -0.5);
  S[RES] = S[DIRTY] = 1;
  S[WT] = 9;
  S[WIN] = -1;
  S[AUTO] = first ? 0 : 1;
  S[AT] = 0.6;
  S[LOSER] = rnd() < 0.5 ? 0 : 1;
  S[NEXT] = S[LOSER]!;

  // The page: every block; its box (art px, from its own --l/--t/--w/--h), team, baked look, motion.
  const wrap = slot.querySelector<HTMLElement>(".pwar")!, els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const num = (el: HTMLElement, p: string) => parseFloat(el.style.getPropertyValue(p));
  const EX = new Float32Array(n), EY = new Float32Array(n), EW = new Float32Array(n), EH = new Float32Array(n), TEAM = new Int8Array(n);
  const OY = new Float32Array(n), OV = new Float32Array(n), LIT = new Float32Array(n);
  const GONE = new Uint8Array(n), LEFT = new Int16Array(n), LY = new Int16Array(n), LG = new Uint8Array(n), LL = new Uint8Array(n);
  const IMG: HTMLCanvasElement[] = [];
  els.forEach((el, i) => {
    EX[i] = num(el, "--l");
    EY[i] = num(el, "--t");
    EW[i] = num(el, "--w");
    EH[i] = num(el, "--h");
    TEAM[i] = el.classList.contains("a") ? 0 : el.classList.contains("b") ? 1 : -1;
  });
  // Chunks of crumbled blocks: where, how fast, whose, which piece (source x, y, size), the way home.
  const KX = new Float32Array(CAP), KY = new Float32Array(CAP), KVX = new Float32Array(CAP), KVY = new Float32Array(CAP), KU = new Float32Array(CAP);
  const KA = new Float32Array(CAP), KB = new Float32Array(CAP), KD = new Float32Array(CAP), KE = new Int16Array(CAP), KS = new Uint8Array(CAP), KSX = new Uint8Array(CAP), KSY = new Uint8Array(CAP);
  let kn = 0;
  const PILE = new Float32Array(W);
  // Shells: where, how fast, whose, big or not, age.
  const BX = new Float32Array(SH), BY = new Float32Array(SH), BVX = new Float32Array(SH), BVY = new Float32Array(SH), BT = new Int8Array(SH).fill(-1), BB = new Uint8Array(SH), BA = new Float32Array(SH);

  L.style(stage, "touch-action", "manipulation"); // a double tap is a bomb, not a zoom
  const ro = new ResizeObserver(() => ((S[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  // A tap: one waits a beat for a second; two in that beat make a bomb.
  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[QN] = S[QN]! + 1), (S[AUTO] = 0), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Bake block i's look at art scale (its own font and colours): a solid tile, rim and all. */
  function bake(i: number, k: number) {
    const el = els[i]!, cs = getComputedStyle(el), w = max(1, round(EW[i]!)), h = max(1, round(EH[i]!));
    const c = (IMG[i] ??= document.createElement("canvas")), x = c.getContext("2d")!;
    c.width = w;
    c.height = h;
    x.fillStyle = C.rim;
    x.fillRect(0, 0, w, h);
    x.fillStyle = cs.backgroundColor;
    x.fillRect(1, 1, w - 2, h - 2);
    x.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = cs.color;
    x.fillText(el.textContent!, w / 2, h / 2 + 0.5);
  }

  /** Block i breaks: hidden on the page, and in its place chunks of it fly away from (px, py). */
  function crumble(i: number, px: number, py: number, power: number) {
    if (GONE[i] || kn > CAP - 200) return; // room for its chunks, or it stands
    GONE[i] = 1;
    LIT[i] = 0;
    S[BROKE] = S[BROKE]! + 1;
    const c = IMG[i]!, s = 2, oy = OY[i]!;
    for (let y = 0; y < c.height; y += s)
      for (let x = 0; x < c.width; x += s) {
        if (kn >= CAP) continue; // every block is solid: each 2 px square is a chunk
        const k = kn++, cx = EX[i]! + x, cy = EY[i]! + oy + y, dx = cx - px, dy = cy - py, r = hypot(dx, dy) + 2;
        KX[k] = cx;
        KY[k] = cy;
        KVX[k] = (dx / r) * (30 + rnd() * 60 * power) + (rnd() - 0.5) * 30;
        KVY[k] = (dy / r) * (20 + rnd() * 40 * power) - 30 - rnd() * 60 * power;
        KE[k] = i;
        KS[k] = s;
        KSX[k] = x;
        KSY[k] = y;
        KU[k] = -1;
        KD[k] = 0;
        LEFT[i] = LEFT[i]! + 1;
      }
  }

  /** The top of whatever is under span [x0, x1] at or below y (another block, or the ground). */
  function under(x0: number, x1: number, y: number, self: number) {
    let top = self >= 0 && TEAM[self]! < 0 ? EY[self]! + EH[self]! : ground((x0 + x1) / 2);
    for (let j = 0; j < n; j++) {
      if (j === self || GONE[j] || TEAM[j]! < 0 || min(x1, EX[j]! + EW[j]!) - max(x0, EX[j]!) < 0.5) continue;
      const t = EY[j]! + OY[j]!;
      if (t >= y - 1.5 && t < top) top = t;
    }
    return top;
  }

  /** A shell from team t's cannon to (x, y): a flat fast one, or a high slow bomb. */
  function fire(t: number, x: number, y: number, big: number) {
    const m = M(t), s = BT.indexOf(-1);
    if (s < 0 || S[m + HP]! <= 0) return;
    const x0 = S[m + CX]! + DIR[t]! * 5, y0 = S[m + CY]! - 6, f = big ? 0.9 + abs(x - x0) * 0.002 : 0.3 + abs(x - x0) * 0.002;
    BX[s] = x0;
    BY[s] = y0;
    BVX[s] = (x - x0) / f;
    BVY[s] = (y - y0 - 0.5 * G * f * f) / f;
    BT[s] = t;
    BB[s] = big;
    BA[s] = 0;
    S[m + AIM] = atan2(BVY[s]!, BVX[s]!);
    S[m + KICK] = 1;
    fx.puff(x0 + cos(S[m + AIM]!) * 4, y0 + sin(S[m + AIM]!) * 4, big ? 4 : 2);
    S[SHOTS] = S[SHOTS]! + 1;
    if (!t) S[BIG] = big;
  }

  /** Team t aims at the other side: its mascot, or a block of its fort; `err` px off. */
  function ai(t: number, atMascot: boolean, big: number, err: number) {
    const o = 1 - t, m = M(o);
    let x = S[m + CX]!, y = S[m + CY]! - 4;
    if (!atMascot) {
      for (let k = 0; k < 9; k++) {
        const j = (rnd() * n) | 0;
        if (TEAM[j] === o && !GONE[j] && EY[j]! > 50) {
          x = EX[j]! + EW[j]! / 2;
          y = EY[j]! + OY[j]! + EH[j]! / 2;
          break;
        }
      }
    }
    fire(t, x + (rnd() - 0.5) * err * 2, y + (rnd() - 0.5) * err, big);
  }

  function say(w: number, x: number, y: number) {
    const hw = textW(WORDS[w]!, 2) / 2 + 2;
    S[WORD] = w;
    S[WT] = 0;
    S[WX] = max(hw, min(W - hw, x));
    S[WY] = max(10, min(FLOOR - 16, y));
  }

  function hurt(t: number, d: number, word: number, x: number) {
    const m = M(t);
    if (S[m + HP]! <= 0 || S[MODE] !== PLAY) return;
    S[m + HP] = max(0, S[m + HP]! - d);
    S[m + HURT] = 0.6;
    if (S[m + HP]! > 0) return say(word, x, S[m + CY]! - 18);
    // KO: the mascot flies off its roof; the other plan wins.
    S[MODE] = OVER;
    S[T] = 0;
    S[WIN] = 1 - t;
    S[m + CVX] = -DIR[t]! * 50;
    S[m + CVY] = -150;
    say(4 - t, 80, 22);
  }

  /** A shell bursts at (x, y). */
  function burst(x: number, y: number, big: number) {
    const R = big ? 13 : 2.5;
    fx.blast(x, y, big ? 3 : 1);
    for (let i = 0; i < n; i++) {
      if (GONE[i]) continue;
      const ty = EY[i]! + OY[i]!, d = hypot(max(EX[i]! - x, 0, x - EX[i]! - EW[i]!), max(ty - y, 0, y - ty - EH[i]!));
      if (d < R) crumble(i, x, y, big ? 2 : 1);
      else if (d < R * 2.6) (OV[i] = OV[i]! - (big ? 90 : 50) * (1 - d / (R * 2.6))), (LIT[i] = 0.25);
    }
    for (let t = 0; t < 2; t++) {
      const m = M(t), dx = S[m + CX]! - x, dy = S[m + CY]! - 4 - y, d = hypot(dx, dy);
      if (d < R + 5) {
        S[m + CVX] = S[m + CVX]! + (dx / (d + 1)) * (big ? 90 : 40);
        S[m + CVY] = S[m + CVY]! - (big ? 110 : 50);
        hurt(t, big ? 2 : 1, 1, S[m + CX]!);
      }
    }
    if (S[WORD]! < 3 || S[WORD]! > 4) say(big ? 0 : 5, x, y - 14);
  }

  /** Every broken block's chunks start home, left to right, after `wait` s. */
  function mend(wait: number) {
    S[MODE] = MEND;
    S[T] = S[AUTO] = S[REPLY] = 0;
    PILE.fill(0);
    BT.fill(-1);
    for (let k = 0; k < kn; k++) if (KU[k]! < 0 && KU[k] !== -3) KD[k] = wait + EX[KE[k]!]! * 0.005 + rnd() * 0.15;
  }

  engine.add({
    read() {
      if (!S[RES]) return;
      S[RES] = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) bake(i, k);
      S[DIRTY] = 1;
    },
    step(e, dt) {
      let busy = S[AUTO]! > 0 || S[QN]! > 0 || S[REPLY]! > 0;
      const mode = S[MODE]!, t = (S[T] = S[T]! + dt);
      S[FR] = S[FR]! + 1;
      // The tap: a beat to see if a second one comes; one is a fast shell, two a bomb.
      if (S[QN]!) {
        S[QT] = S[QT]! + dt;
        if (mode !== PLAY) (S[QN] = 0), (S[QT] = 0);
        else if (S[QN]! >= 2 || S[QT]! > 0.24) {
          fire(0, S[QX]!, S[QY]!, S[QN]! >= 2 ? 1 : 0);
          S[QN] = S[QT] = S[IDLE] = 0;
          // PRO answers each shot (one answer pending at a time), more often at BASIC's mascot.
          if (!S[REPLY]) (S[REPLY] = 1), (S[RT] = 0.7 + rnd() * 0.6);
        }
      }
      if (S[REPLY]! && mode === PLAY && (S[RT] = S[RT]! - dt) <= 0) (S[REPLY] = 0), ai(1, rnd() < 0.6, rnd() < 0.3 ? 1 : 0, 4 + rnd() * 9);
      // Left alone: one duel. The loser's shells land on the winner's fort; the winner's find the mascot.
      if (S[AUTO]! && mode === PLAY && (S[AT] = S[AT]! - dt) <= 0) {
        const s = S[NEXT]!, win = s !== S[LOSER], k = S[SHOTS]!;
        ai(s, win && k > 1, win ? (k > 4 ? 1 : 0) : k === 2 ? 1 : 0, win ? (k > 4 ? 1 : 3) : 3);
        S[NEXT] = 1 - s;
        S[AT] = 1 + rnd() * 0.5;
        if (k > 16) mend(0.3), (S[AUTO] = 0);
      }
      // Shells: gravity, then the first thing in the way (another fort, a mascot, the ground).
      for (let s = 0; s < SH; s++) {
        const tm = BT[s]!;
        if (tm < 0) continue;
        busy = true;
        BA[s] = BA[s]! + dt;
        BVY[s] = BVY[s]! + G * dt;
        const x = (BX[s] = BX[s]! + BVX[s]! * dt), y = (BY[s] = BY[s]! + BVY[s]! * dt);
        let hit = y >= ground(x) || x < -8 || x > W + 8;
        for (let i = 0; i < n && !hit; i++)
          if (!GONE[i] && (TEAM[i] !== tm || BA[s]! > 0.25) && x >= EX[i]! && x <= EX[i]! + EW[i]! && y >= EY[i]! + OY[i]! && y <= EY[i]! + OY[i]! + EH[i]!) hit = true;
        for (let q = 0; q < 2 && !hit; q++) {
          const m = M(q);
          if ((q !== tm || BA[s]! > 0.4) && abs(x - S[m + CX]!) < 5 && y > S[m + CY]! - 9 && y < S[m + CY]! + 1) hit = true;
        }
        if (hit) (BT[s] = -1), x > -8 && x < W + 8 && burst(x, min(y, ground(x)), BB[s]!);
      }
      // The blocks: gravity onto whatever is under them (a hop falls back; a block whose support
      // broke drops and lands with a thud).
      const home = mode === MEND;
      for (let i = 0; i < n; i++) {
        if (GONE[i]) continue;
        if (home) {
          // Coming home: back up to its own place.
          if (OY[i]! > 0) (OY[i] = max(0, OY[i]! - 60 * dt)), (busy = true);
          else if (OY[i]! < 0 || OV[i]) (OY[i] = min(0, OY[i]! + 60 * dt)), (OV[i] = 0), (busy = true);
        } else {
          const b = EY[i]! + EH[i]! + OY[i]!, top = under(EX[i]!, EX[i]! + EW[i]!, b, i);
          if (b < top - 0.01 || OV[i]! < 0) {
            OV[i] = OV[i]! + 400 * dt;
            OY[i] = OY[i]! + OV[i]! * dt;
            busy = true;
            if (EY[i]! + EH[i]! + OY[i]! >= top) {
              OY[i] = top - EY[i]! - EH[i]!;
              if (OV[i]! > 140) fx.puff(EX[i]! + EW[i]! / 2, top, 2);
              OV[i] = OV[i]! > 70 ? -OV[i]! * 0.2 : 0;
            }
          }
        }
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (busy = true);
      }
      // The mascots: knocked about, they fall onto what is under them (a long drop: BONK).
      for (let q = 0; q < 2; q++) {
        const m = M(q);
        if (S[m + KICK]! > 0) (S[m + KICK] = max(0, S[m + KICK]! - dt * 5)), (busy = true);
        if (S[m + HURT]! > 0) (S[m + HURT] = S[m + HURT]! - dt), (busy = true);
        if (home) {
          // Back up to the roof, pips full.
          const dx = HX[q]! - S[m + CX]!, dy = HY - S[m + CY]!, d = hypot(dx, dy);
          if (d > 0.5) (S[m + CX] = S[m + CX]! + (dx / d) * min(d, 70 * dt)), (S[m + CY] = S[m + CY]! + (dy / d) * min(d, 70 * dt)), (busy = true);
          else (S[m + CX] = HX[q]!), (S[m + CY] = HY), (S[m + CVX] = S[m + CVY] = 0);
          S[m + HP] = 3;
          continue;
        }
        const ko = mode === OVER && S[WIN] !== q;
        const x = S[m + CX]!, y = S[m + CY]!, top = ko ? H + 20 : under(x - 6, x + 6, y, -1);
        if (y < top - 0.01 || S[m + CVY]! < 0 || S[m + CVX]) {
          S[m + CVY] = S[m + CVY]! + 300 * dt;
          S[m + CX] = max(3, min(W - 3, x + S[m + CVX]! * dt));
          S[m + CY] = y + S[m + CVY]! * dt;
          S[m + CVX] = S[m + CVX]! * (1 - 3 * dt);
          if (abs(S[m + CVX]!) < 2) S[m + CVX] = 0;
          if (S[m + CY]! >= top) {
            if (S[m + CVY]! > 150) hurt(q, 1, 2, x), fx.puff(x, top, 3);
            S[m + CY] = top;
            S[m + CVY] = 0;
          }
          busy = true;
        }
      }
      // A win: the banner, then the truce. Left alone in a duel: the truce.
      if (mode === OVER && t > 2.2) mend(0.2);
      if (mode === PLAY && !S[AUTO]) {
        S[IDLE] = S[IDLE]! + dt;
        // Anything out of place (a block broken or dropped, a pip down) calls the truce.
        let hurtAny = S[BROKE]! + 6 - S[M(0) + HP]! - S[M(1) + HP]!;
        for (let i = 0; i < n; i++) hurtAny += OY[i]!;
        if (hurtAny && !busy) {
          busy = true;
          if (S[IDLE]! > 4) mend(0.4);
        }
      }
      // Chunks: fly, bounce, lie in the rubble; going home, an arc back to their place.
      for (let k = kn - 1; k >= 0; k--) {
        const i = KE[k]!;
        if (KU[k] === -3) continue;
        if (KU[k]! >= 0) {
          const u = min(1, (KU[k] = KU[k]! + dt / 0.6)), q = u * u * (3 - 2 * u), hx = EX[i]! + KSX[k]!, hy = EY[i]! + KSY[k]!;
          KX[k] = KA[k]! + (hx - KA[k]!) * q;
          KY[k] = KB[k]! + (hy - KB[k]!) * q - sin(u * 3.1416) * 16;
          if (u >= 1) {
            KU[k] = -3;
            if (!(LEFT[i] = LEFT[i]! - 1)) (GONE[i] = 0), (OY[i] = OV[i] = 0), (LIT[i] = 0.25), (S[BROKE] = S[BROKE]! - 1) || (kn = 0);
          }
        } else {
          if (KU[k] === -1) {
            KVY[k] = KVY[k]! + 400 * dt;
            KX[k] = KX[k]! + KVX[k]! * dt;
            KY[k] = KY[k]! + KVY[k]! * dt;
            if (KX[k]! < 0 || KX[k]! > W - 2) (KVX[k] = -KVX[k]! * 0.5), (KX[k] = max(0, min(W - 2, KX[k]!)));
            let c = round(KX[k]!);
            const f = ground(c) - 2 - PILE[c]!;
            if (KY[k]! > f && KVY[k]! > 0) {
              KY[k] = f;
              if (KVY[k]! > 70) (KVY[k] = -KVY[k]! * 0.3), (KVX[k] = KVX[k]! * 0.6);
              else {
                // At rest: it rolls off a heap to the lower side (rubble spreads, never towers).
                while (PILE[c]! > 3 && c > 1 && c < W - 2 && min(PILE[c - 2]!, PILE[c + 2]!) < PILE[c]! - 1) c += PILE[c - 2]! < PILE[c + 2]! ? -2 : 2;
                KX[k] = c;
                KY[k] = ground(c) - 2 - PILE[c]!;
                KU[k] = -2;
                PILE[c] = PILE[c]! + 1;
              }
            }
            busy = true;
          }
          if (KD[k]! > 0 && (KD[k] = KD[k]! - dt) <= 0) (KU[k] = 0), (KA[k] = KX[k]!), (KB[k] = KY[k]!);
        }
        if (KD[k]! > 0 || KU[k]! >= 0) busy = true;
      }
      if (mode === MEND && !busy && !kn && t > 0.5) (S[MODE] = PLAY), (S[T] = 0), (S[WIN] = -1), (S[IDLE] = 0), (S[SHOTS] = 0);
      if (mode !== PLAY) busy = true;
      if (fx.step(dt)) busy = true;
      if (S[WT]! < 1.4) (S[WT] = S[WT]! + dt), (busy = true);
      if (busy) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, y = max(-40, min(60, round(OY[i]!))), gn = GONE[i]!, lt = LIT[i]! > 0 ? 1 : 0;
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", YS[y + 40]!) : L.unstyle(el, "--y");
        if (gn !== LG[i]) (LG[i] = gn), L.attr(el, "data-gone", gn ? "" : null);
        if (lt !== LL[i]) (LL[i] = lt), L.attr(el, "data-hit", lt ? "" : null);
      }
      const sx = fx.jolt(S[FR]!);
      if (sx) L.style(wrap, "--sx", YS[sx + 40]!), L.style(wrap, "--sy", YS[((S[FR]! >> 1) & 1 ? 1 : -1) * min(2, abs(sx)) + 40]!);
      else L.unstyle(wrap, "--sx"), L.unstyle(wrap, "--sy");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    g.clearRect(0, 0, W, H);
    // The ground: the field, the middle mound, the NO REFUNDS post.
    for (let x = 0; x < W; x++) (g.fillStyle = C.base), g.fillRect(x, round(ground(x)), 1, H), (g.fillStyle = C.go), g.fillRect(x, round(ground(x)), 1, 1);
    g.fillStyle = C.rim;
    g.fillRect(79, 68, 2, 6);
    g.fillRect(0, FLOOR + 3, W, H);
    // The HUD on the ground: each plan and its mascot's pips.
    for (let q = 0; q < 2; q++) {
      print(g, q ? "PRO" : "BASIC", q ? W - 15 : 3, FLOOR + 5, q ? C.aim : C.sys);
      for (let p = 0; p < 3; p++) (g.fillStyle = p < S[M(q) + HP]! ? C.hurt : C.line), g.fillRect(q ? W - 33 + p * 5 : 25 + p * 5, FLOOR + 5, 4, 5);
    }
    // The rubble.
    for (let k = 0; k < kn; k++) if (KU[k] !== -3) g.drawImage(IMG[KE[k]!]!, KSX[k]!, KSY[k]!, KS[k]!, KS[k]!, round(KX[k]!), round(KY[k]!), KS[k]!, KS[k]!);
    // The mascots and their cannons (kicked back on a shot); a KO'd one tumbles away.
    for (let q = 0; q < 2; q++) {
      const m = M(q), x = round(S[m + CX]!), y = round(S[m + CY]!), a = S[m + AIM]!, kb = S[m + KICK]! * 2, ko = S[MODE] === OVER && S[WIN] !== q;
      const bx = x + DIR[q]! * 2 - cos(a) * kb, by = y - 6 - sin(a) * kb;
      g.fillStyle = C.rim;
      for (let s = 0; s < 7; s++) g.fillRect(round(bx + cos(a) * s) - 1, round(by + sin(a) * s) - 1, 3, 3);
      const img = look[q]![S[m + HURT]! > 0 || ko ? 1 : 0]!;
      if (ko) g.save(), g.translate(x, y - 5), g.rotate(S[T]! * 9 * DIR[q]!), g.drawImage(img, -5, -6), g.restore();
      else g.drawImage(img, x - 5, y - 11);
    }
    // Shells: a fast one with a streak; a bomb, round, fuse fizzing.
    for (let s = 0; s < SH; s++) {
      if (BT[s]! < 0) continue;
      const x = BX[s]!, y = BY[s]!;
      if (BB[s]) {
        g.fillStyle = C.rim;
        disc(g, x, y, 2);
        g.fillStyle = C.muted;
        g.fillRect(round(x) - 1, round(y) - 1, 1, 1);
        g.fillStyle = S[FR]! & 2 ? C.hurt : C.ink;
        g.fillRect(round(x) + 1, round(y) - 3, 1, 1);
      } else {
        const v = hypot(BVX[s]!, BVY[s]!) + 1;
        g.fillStyle = C.muted;
        for (let p = 1; p < 4; p++) g.fillRect(round(x - (BVX[s]! / v) * p * 1.5), round(y - (BVY[s]! / v) * p * 1.5), 1, 1);
        g.fillStyle = C.rim;
        g.fillRect(round(x) - 1, round(y) - 1, 2, 2);
      }
    }
    // A tap waiting for its twin: a crosshair; the second makes it the bomb's ring.
    if (S[QN]!) {
      const x = round(S[QX]!), y = round(S[QY]!);
      g.fillStyle = C.attack;
      for (let a = -1; a <= 1; a += 2) g.fillRect(x + a * 3 - (a < 0 ? 1 : 0), y, 2, 1), g.fillRect(x, y + a * 3 - (a < 0 ? 1 : 0), 1, 2);
    }
    fx.draw(g, 0);
    // The word of the moment: slams in big, settles, hangs, goes.
    const wt = S[WT]!, wd = S[WORD]!, big = wd === 3 || wd === 4;
    if (wt < (big ? 1.4 : 0.8)) shout(g, WORDS[wd]!, S[WX]!, S[WY]! - (wt < 0.05 ? 2 : 0), wt < 0.05 || big ? 2 : 1, wd > 2 && wd < 5 ? C.ink : C.hurt, wd === 4 ? C.attack : wd === 3 ? "#1aa6c4" : C.attack);
  }

  engine.start();
  return {
    engine,
    tap,
    get hp() {
      return [S[M(0) + HP]!, S[M(1) + HP]!];
    },
    get broken() {
      return S[BROKE]!;
    },
    get mode() {
      return S[MODE]!;
    },
    get winner() {
      return S[WIN]!;
    },
    get big() {
      return S[BIG]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the first shell in the air. */
export const posterAt = 0.95;

/** For `slot(fig, () => import("./pricing-war-forts-fire-back").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => war(stage, slot, first);
