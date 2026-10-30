// #30 Haunted Page: No.13 Hollow Lane, a cozy little listing page that says "nothing moves here".
// Something lives in it: a shy poltergeist, see-through until you catch it. It rearranges the page's
// furniture by telekinesis, one piece at a time: the heading's words lift, pass over each other and
// drop back swapped ("Quiet & Cozy"), the portrait floats off its nail and lands crooked, the
// buttons trade places. Every piece it moves is the page's own element; each drops with a thud
// (a squash, dust, and the neighbours it lands by hop). Then it hides behind the portrait and peeks.
// Click any piece of the page and it comes to move that one too (click it again and it moves it
// back). Click the ghost itself and it's caught: it goes solid, blushes, EEP!, drops whatever it was
// holding right where it was, and flees behind the portrait; then, sorry, it puts everything back
// at once and waves goodbye. Click the empty wall and the lights flicker; it giggles from its hiding
// place. Left alone it always tidies up before it goes, so the page settles exactly as it was.
// Bricks: the kernel (fixed step, settle: it sleeps once the ghost has gone and the page is home;
// every page write goes through its ledger, so Recall gives the page back byte for byte) and
// fizlet/sprite (the ghost, baked once). The ghost is drawn on a canvas inside the page, behind its
// elements (it really hides behind the portrait); sparkles, dust and words on one in front.
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, bits, offscreen, print, sfx, sfxW, textW } from "./pix";

export type HauntScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly mode: number; readonly spotted: number; readonly moved: number; readonly ghost: readonly number[] };

const { abs, max, min, round, sin, PI } = Math;

// ---------- The ghost, as pixel data (18 × 17): a round wisp with a curl of a tail ----------
// w body, m shade, k eyes and mouth, p blush. Frames: pose × 2 tail phases; poses: 0 drift, 1 cast
// (arms up), 2 caught (hands over its eyes, blushing), 3 giggle.
const BODY = ["....mwwwwm....", "..mwwwwwwwwm..", ".mwwwwwwwwwwm.", ".wwwwwwwwwwwwm", "mwwwwwwwwwwwwm", "mwwwwwwwwwwwwm", "mwwwwwwwwwwwwm", "mwwwwwwwwwwwwm", ".wwwwwwwwwwwm.", ".mwwwwwwwwwwm.", "..mwwwwwwwwm..", "...mwwwwwwm..."];
const TAILS = [
  ["....mwwwwm....", ".....mwwwm....", "......mwwm....", ".......mwm....", "........mm...."],
  ["....mwwwwm....", "....mwwwm.....", "....mwwm......", "....mwm.......", "....mm........"],
];
function put(rows: string[], x: number, y: number, part: readonly string[]) {
  part.forEach((p, j) => {
    const r = rows[y + j]!;
    rows[y + j] = r.slice(0, x) + [...p].map((ch, i) => (ch === "." ? r[x + i] : ch)).join("") + r.slice(x + p.length);
  });
}
function frame(pose: number, tail: number) {
  const rows = [...BODY, ...TAILS[tail]!].map((r) => ".." + r + "..");
  const eyes = pose === 3 ? [".kk.", "k..k"] : ["kk", "kk", "kk"];
  if (pose !== 2) put(rows, pose === 3 ? 4 : 5, pose === 3 ? 5 : 4, eyes), put(rows, pose === 3 ? 10 : 11, pose === 3 ? 5 : 4, eyes);
  put(rows, 8, 8, pose === 3 ? ["kk", "kk"] : ["kk"]);
  if (pose >= 2) put(rows, 3, 7, ["pp"]), put(rows, 13, 7, ["pp"]);
  if (pose === 0 || pose === 3) put(rows, 0, 7, [".m", "m."]), put(rows, 16, 7, ["m.", ".m"]);
  if (pose === 1) put(rows, 0, 2, ["m.", "m.", ".m", ".m"]), put(rows, 16, 2, [".m", ".m", "m.", "m."]);
  if (pose === 2) put(rows, 3, 4, ["mmmm", "mmmm"]), put(rows, 11, 4, ["mmmm", "mmmm"]);
  return rows;
}
const GHOST = { frames: [0, 1, 2, 3].flatMap((p) => [frame(p, 0), frame(p, 1)]), colors: { w: C.ink, m: C.muted, k: C.rim, p: C.aim }, ax: 9, ay: 7 };

// ---------- The page's furniture ----------
// The stage's elements in order: 0 No.13, 1 HOME, 2 ROOMS, 3 GUESTBOOK, 4 Cozy, 5 &, 6 Quiet,
// 7 the line under it, 8 BOOK A ROOM, 9 MORE INFO, 10 the portrait. A piece with a partner swaps
// places with it; the others turn (by TILT degrees; SPIN: with a full turn on the way).
const PAIR = [-1, 3, -1, 1, 6, -1, 4, -1, 9, 8, -1];
const TILT = [180, 0, 9, 0, 0, 180, 0, -5, 0, 0, 11];
const SPIN = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const PIC = 10, HEAVY = 10, MAXN = 12;
// What it moves by itself, in order: the heading, the portrait, the buttons.
const SCRIPT = [4, PIC, 8];

// Ghost modes.
const OFF = 0, SNEAK = 1, CAST = 2, HIDE = 3, CAUGHT = 4, FLEE = 5, TIDY = 6, BYE = 7;
// Page values, made once (art px → cqw: the stage is a size container; quarter-pixel steps).
const CQ = 100 / W, POS = Array.from({ length: 1281 }, (_, i) => `${((i - 640) / 4) * CQ}cqw`);
const ROT = Array.from({ length: 1441 }, (_, i) => `${i - 720}deg`);
const SQ = Array.from({ length: 11 }, (_, i) => `${1 + i * 0.03},${1 - i * 0.045}`);
const SH = Array.from({ length: 5 }, (_, i) => `${(i - 2) * CQ}cqw`);
const SAY = ["EEP!", "HEE HEE", "SORRY!", "THUD", "BYE"];
const SPOTS = Array.from({ length: 100 }, (_, i) => "SPOTTED " + i);

export function haunt(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): HauntScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 30 });
  const L = engine.ledger, rnd = engine.random;
  const wrap = slot.querySelector<HTMLElement>(".hp30")!, els = [...wrap.querySelectorAll<HTMLElement>("i")].slice(0, MAXN), n = els.length;
  // The ghost's canvas sits inside the page, under its elements: it hides behind them.
  const back = L.add(document.createElement("canvas"));
  back.width = W;
  back.height = H;
  back.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  wrap.prepend(back);
  const gb = back.getContext("2d")!;
  const g = artCanvas(engine, stage);
  const art = sprites({ ghost: GHOST });
  const fx = bits(160, [C.ink, C.muted, C.cmd, C.line]);
  // EEP!, lettered once.
  const eep = offscreen(sfxW(SAY[0]!) + 5, 14);
  sfx(eep, SAY[0]!, 1, 2, C.ink, C.attack, C.rim, [0, -1, 1, 0]);

  // Per piece: home box (art px), pose (offset from home, turn), fall speed, where it rests now,
  // where a lift started and where it is going, its lift clock, delay, length and arc, its mode
  // (0 at rest, 1 lifted, 2 falling), squash; and what render last wrote.
  const HX = new Float32Array(n), HY = new Float32Array(n), HW = new Float32Array(n), HH = new Float32Array(n);
  const PX = new Float32Array(n), PY = new Float32Array(n), PR = new Float32Array(n), VY = new Float32Array(n);
  const RX = new Float32Array(n), RR = new Float32Array(n), SX = new Float32Array(n), SR = new Float32Array(n);
  const TX = new Float32Array(n), TR = new Float32Array(n), U = new Float32Array(n), DL = new Float32Array(n), D = new Float32Array(n), ARC = new Float32Array(n);
  const M = new Uint8Array(n), Q = new Float32Array(n);
  const LX = new Int16Array(n), LY = new Int16Array(n), LR = new Int16Array(n), LQ = new Int8Array(n), LG = new Int8Array(n);
  // The ghost: x, y, target x, y, alpha, target alpha, mode, mode clock, giggle, flicker, shake,
  // word, word clock, word x, y, the trick's piece, spotted, time, resized, autoplay left, moves.
  const G = new Float64Array(24);
  const GX = 0, GY = 1, GTX = 2, GTY = 3, GA = 4, GTA = 5, MODE = 6, GT = 7, GIG = 8, FLK = 9, SHK = 10, WD = 11, WT = 12, WX = 13, WY = 14, TRICK = 15, SPOT = 16, TIME = 17, RES = 18, MOVES = 19, DIRTY = 20;
  const queue = new Int8Array(8);
  let qn = 0;
  G[GX] = W + 14;
  G[GY] = 26;
  G[WT] = 9;
  G[RES] = G[DIRTY] = 1;
  G[TRICK] = -1;
  G[MODE] = SNEAK;

  const ro = new ResizeObserver(() => ((G[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const say = (w: number, x: number, y: number) => ((G[WD] = w), (G[WT] = 0), (G[WX] = max(4, min(W - 6 - (w ? textW(SAY[w]!) : sfxW(SAY[w]!)), x))), (G[WY] = max(4, min(H - 22, y))));
  const to = (m: number) => ((G[MODE] = m), (G[GT] = 0));
  const arranged = (i: number) => RX[i] !== 0 || RR[i] !== 0;
  const cx = (i: number) => HX[i]! + PX[i]! + HW[i]! / 2;
  const enqueue = (i: number) => {
    const j = PAIR[i]!;
    for (let k = 0; k < qn; k++) if (queue[k] === i || (j >= 0 && queue[k] === j)) return;
    if (G[TRICK] === i || (j >= 0 && G[TRICK] === j) || qn >= queue.length) return;
    queue[qn++] = i;
  };
  for (const i of SCRIPT) enqueue(i);

  /** Lift piece i from where it rests to (x, turn r), after `delay` s, over `len` s, arcing `arc` px. */
  function lift(i: number, x: number, r: number, delay: number, len: number, arc: number) {
    M[i] = 1;
    SX[i] = PX[i]!;
    SR[i] = PR[i]!;
    TX[i] = x;
    TR[i] = r;
    U[i] = -delay;
    D[i] = len;
    ARC[i] = arc;
    G[MOVES] = G[MOVES]! + 1;
  }
  /** The trick for piece i: swap with its partner, or turn; done again, it puts it back. */
  function trick(i: number) {
    const j = PAIR[i]!;
    G[TRICK] = i;
    if (j >= 0) {
      const a = HX[i]! < HX[j]! ? i : j, b = a === i ? j : i;
      const back = arranged(a) || arranged(b);
      lift(a, back ? 0 : HX[b]! + HW[b]! - HX[a]! - HW[a]!, 0, 0, 1, 10);
      lift(b, back ? 0 : HX[a]! - HX[b]!, 0, 0.08, 1, 3);
      // A piece between them (the &, ROOMS) shuffles over to the middle of the new gap.
      if (b - a === 2 && !M[a + 1]) {
        const m = a + 1, mid = (HX[a]! + 2 * HW[b]! + HX[b]! - HW[a]!) / 2 - HX[m]! - HW[m]! / 2;
        lift(m, back ? 0 : mid, RR[m]!, 0.2, 0.7, 2);
      }
    } else {
      const r = RR[i] ? 0 : TILT[i]!;
      lift(i, RX[i]!, r + (SPIN[i] ? (r >= RR[i]! ? 360 : -360) : 0), 0, i === PIC ? 1.1 : 0.9, i === PIC ? 2 : 5);
    }
  }
  /** Where the ghost hovers for the trick on i (over it and its partner). */
  function over(i: number) {
    const j = PAIR[i]!;
    G[GTX] = j >= 0 ? (cx(i) + cx(j)) / 2 : cx(i);
    G[GTY] = max(9, min(H - 24, (j >= 0 ? min(HY[i]!, HY[j]!) : HY[i]!) - 11));
  }
  const peek = () => ((G[GTX] = HX[PIC]! + HW[PIC]! - 5), (G[GTY] = HY[PIC]! + 3));
  /** What the ghost does next, once a mode is done. */
  function next() {
    const m = G[MODE]!;
    G[TRICK] = -1;
    if (m !== CAUGHT && m !== FLEE && qn) {
      if (m === OFF) peek(), (G[GX] = G[GTX]!), (G[GY] = G[GTY]!);
      return to(SNEAK);
    }
    if (m === CAST || m === SNEAK) return to(HIDE);
    if (m === HIDE || m === FLEE) {
      for (let i = 0; i < n; i++) if (arranged(i)) return to(TIDY), tidy();
      return to(BYE), say(4, G[GX]! - 6, G[GY]! - 16);
    }
    if (m === TIDY) return to(BYE), say(4, G[GX]! - 6, G[GY]! - 16);
    to(OFF);
  }
  function tidy() {
    let k = 0;
    say(2, 66, 6);
    G[GTX] = 80;
    G[GTY] = 12;
    for (let i = 0; i < n; i++) if (arranged(i)) lift(i, 0, SPIN[i] && RR[i] ? RR[i]! + 180 : 0, k++ * 0.12, 0.8, 6);
  }

  /** A tap at art pixel (x, y). */
  function tapAt(x: number, y: number) {
    const m = G[MODE]!;
    // The ghost first: caught in the act (or peeking).
    if (m !== OFF && m !== CAUGHT && m !== FLEE && G[GA]! > 0.15 && abs(x - G[GX]!) < 10 && abs(y - G[GY]! - 1) < 10) {
      to(CAUGHT);
      G[SPOT] = G[SPOT]! + 1;
      qn = 0;
      say(0, G[GX]! - 15, G[GY]! - 24);
      // It drops whatever it holds, right where it is: it falls from there.
      for (let i = 0; i < n; i++) if (M[i] === 1) (M[i] = 2), (VY[i] = 0), (TX[i] = RX[i] = round(PX[i]! * 4) / 4), (TR[i] = RR[i] = round(PR[i]!));
      return;
    }
    let hit = -1;
    for (let i = 0; i < n; i++) if (M[i] !== 1 && x > HX[i]! + PX[i]! - 2 && x < HX[i]! + PX[i]! + HW[i]! + 2 && y > HY[i]! + PY[i]! - 2 && y < HY[i]! + PY[i]! + HH[i]! + 2) hit = i;
    if (hit >= 0 && m !== CAUGHT && m !== FLEE) {
      enqueue(hit);
      if (m === OFF || m === HIDE || m === BYE) next();
      return;
    }
    // The empty wall: the lights flicker; it giggles from wherever it hides (or pops up to look).
    G[FLK] = 0.4;
    if (m === OFF) peek(), (G[GX] = G[GTX]!), (G[GY] = G[GTY]! + 6), to(HIDE);
    if (G[MODE] === HIDE) (G[GIG] = 0.8), (G[GT] = min(G[GT]!, 0.6)), say(1, G[GX]! + 8, G[GY]! - 16);
  }
  const tap = (x: number, y: number) => {
    // Input reaches the step through one slot (no allocation): the last tap wins.
    G[21] = x;
    G[22] = y;
    G[23] = 1;
    engine.wake();
  };
  if (first) tap((first.x / (stage.clientWidth || 1)) * W, (first.y / (stage.clientHeight || 1)) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Piece i lands: a squash, dust, a thud for the heavy one, and the pieces it lands by hop. */
  function thud(i: number, v: number) {
    Q[i] = min(1, v / 240);
    const x = HX[i]! + PX[i]!, y = HY[i]! + PY[i]! + HH[i]!, heavy = i === HEAVY;
    for (let k = 0, m = min(10, 3 + (HW[i]! / 6) | 0); k < m; k++) fx.spawn(x + rnd() * HW[i]!, y, (rnd() - 0.5) * 50, -8 - rnd() * 16, 0.3 + rnd() * 0.2, 1, 1);
    if (v < 110) return;
    if (heavy) (G[SHK] = 0.16), say(3, x + HW[i]! / 2 - 7, y + 2);
    for (let j = 0; j < n; j++) {
      if (j === i || M[j] || abs(cx(j) - (x + HW[i]! / 2)) > (HW[i]! + HW[j]!) / 2 + (heavy ? 30 : 10) || abs(HY[j]! + HH[j]! - y) > (heavy ? 40 : 6)) continue;
      M[j] = 2;
      VY[j] = -55 - (heavy ? 30 : 0);
      TX[j] = RX[j]!;
      TR[j] = RR[j]!;
    }
  }

  engine.add({
    read() {
      if (!G[RES]) return;
      G[RES] = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0;
        for (let a: HTMLElement | null = els[i]!; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        HX[i] = x * k;
        HY[i] = y * k;
        HW[i] = els[i]!.offsetWidth * k;
        HH[i] = els[i]!.offsetHeight * k;
      }
      // A resize mid-swap re-measures the homes; a swapped pair keeps its swap at the new widths.
      for (let i = 0; i < n; i++) {
        const j = PAIR[i]!;
        if (j < 0 || M[i] || !RX[i]) continue;
        const a = HX[i]! < HX[j]! ? i : j, b = a === i ? j : i;
        RX[a] = PX[a] = HX[b]! + HW[b]! - HX[a]! - HW[a]!;
        RX[b] = PX[b] = HX[a]! - HX[b]!;
      }
    },
    step(e, dt) {
      const t = (G[TIME] = G[TIME]! + dt);
      let busy = false;
      if (G[23]) (G[23] = 0), tapAt(G[21]!, G[22]!);
      const m = G[MODE]!, gt = (G[GT] = G[GT]! + dt);
      // The ghost: where it heads and how see-through it is, by mode.
      if (m !== OFF) {
        busy = true;
        let k = 3;
        if (m === SNEAK) {
          over(queue[0]!);
          G[GTA] = 0.45;
          if ((abs(G[GX]! - G[GTX]!) < 2.5 && abs(G[GY]! - G[GTY]!) < 2.5) || gt > 1.6) {
            const i = queue[0]!;
            for (let q = 1; q < qn; q++) queue[q - 1] = queue[q]!;
            qn--;
            to(CAST);
            trick(i);
          }
        } else if (m === CAST) {
          over(G[TRICK]!);
          G[GTA] = 0.6;
          let lifting = 0;
          for (let i = 0; i < n; i++) if (M[i] === 1) lifting++;
          if (!lifting && gt > 0.4) next();
        } else if (m === HIDE) {
          peek();
          G[GTA] = 0.9;
          if (gt > (G[SPOT]! ? 1.4 : 2.4)) next();
        } else if (m === CAUGHT) {
          G[GTX] = G[GX]!;
          G[GTY] = G[GY]!;
          G[GA] = G[GTA] = 1;
          if (gt > 0.75) to(FLEE);
        } else if (m === FLEE) {
          peek();
          k = 9;
          G[GTA] = 0.9;
          if (gt > 1.1) next();
        } else if (m === TIDY) {
          G[GTA] = 0.7;
          let lifting = 0;
          for (let i = 0; i < n; i++) if (M[i] === 1) lifting++;
          if (!lifting && gt > 0.5) next();
        } else if (m === BYE) {
          G[GTY] = G[GY]! - 4;
          G[GTA] = 0;
          if (gt > 0.9) (G[GA] = 0), next();
        }
        const f = min(1, dt * k);
        G[GX] = G[GX]! + (G[GTX]! - G[GX]!) * f;
        G[GY] = G[GY]! + (G[GTY]! - G[GY]!) * f;
        G[GA] = G[GA]! + max(-dt * 1.4, min(dt * 2, G[GTA]! - G[GA]!));
      }
      // The furniture: lifted pieces follow their path; dropped ones fall, bounce and rest.
      for (let i = 0; i < n; i++) {
        if (M[i] === 1) {
          busy = true;
          const u = (U[i] = U[i]! + dt);
          if (u < 0) continue;
          const lf = i === PIC ? 4 : 6;
          if (u < 0.3) {
            // It rises off the page with a shiver.
            const k = u / 0.3;
            PY[i] = -lf * k * k * (3 - 2 * k);
            PX[i] = SX[i]! + (u < 0.18 ? sin(u * 90) * 0.5 : 0);
            PR[i] = SR[i]! + sin(u * 50) * 2;
          } else {
            const k = min(1, (u - 0.3) / (D[i]! - 0.3)), s = k * k * (3 - 2 * k);
            PX[i] = SX[i]! + (TX[i]! - SX[i]!) * s;
            PY[i] = -lf - ARC[i]! * sin(PI * k);
            PR[i] = SR[i]! + (TR[i]! - SR[i]!) * s + sin(u * 8) * 3 * (1 - k);
            if (k >= 1) (M[i] = 2), (VY[i] = 0), (RX[i] = TX[i]!), (RR[i] = TR[i]!);
            // Sparkles off the lifted piece.
            if (((t * 20) | 0) !== (((t - dt) * 20) | 0)) fx.spawn(HX[i]! + PX[i]! + rnd() * HW[i]!, HY[i]! + PY[i]! + HH[i]!, (rnd() - 0.5) * 8, -14 - rnd() * 10, 0.5, 1, rnd() < 0.5 ? 0 : 2);
          }
        } else if (M[i] === 2) {
          busy = true;
          VY[i] = VY[i]! + 700 * dt;
          PY[i] = PY[i]! + VY[i]! * dt;
          PX[i] = PX[i]! + (TX[i]! - PX[i]!) * min(1, dt * 14);
          PR[i] = PR[i]! + (TR[i]! - PR[i]!) * min(1, dt * 12);
          if (PY[i]! >= 0 && VY[i]! > 0) {
            PY[i] = 0;
            if (VY[i]! > 45) thud(i, VY[i]!), (VY[i] = -VY[i]! * 0.28);
            else {
              // At rest: exactly where it now lives (a turn kept within half a turn either way).
              M[i] = 0;
              VY[i] = 0;
              PX[i] = RX[i] = TX[i]!;
              let r = TR[i]! % 360;
              if (r > 180) r -= 360;
              if (r <= -180) r += 360;
              PR[i] = RR[i] = TR[i] = r;
            }
          }
        }
        if (Q[i]! > 0) (Q[i] = max(0, Q[i]! - dt * 5)), (busy = true);
      }
      fx.step(dt, 30, H);
      if (fx.live) busy = true;
      if (G[GIG]! > 0) (G[GIG] = G[GIG]! - dt), (busy = true);
      if (G[FLK]! > 0) (G[FLK] = G[FLK]! - dt), (busy = true);
      if (G[SHK]! > 0) (G[SHK] = G[SHK]! - dt), (busy = true);
      if (G[WT]! < 1.2) (G[WT] = G[WT]! + dt), (busy = true);
      if (busy) e.busy(), (G[DIRTY] = 1);
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        const x = max(-640, min(640, round(PX[i]! * 4))), y = max(-640, min(640, round(PY[i]! * 4))), r = max(-720, min(720, round(PR[i]!)));
        const q = round(Q[i]! * 10), lit = M[i] === 1 ? 1 : 0;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--x", POS[x + 640]!) : L.unstyle(el, "--x");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", POS[y + 640]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", ROT[r + 720]!) : L.unstyle(el, "--r");
        if (q !== LQ[i]) (LQ[i] = q), q ? L.style(el, "--q", SQ[q]!) : L.unstyle(el, "--q");
        if (lit !== LG[i]) (LG[i] = lit), L.attr(el, "data-hit", lit ? "" : null);
      }
      const sk = G[SHK]! > 0 ? ((G[TIME]! * 40) & 1 ? 1 : -1) : 0;
      if (sk) L.style(wrap, "--sx", SH[sk + 2]!), L.style(wrap, "--sy", SH[2 - sk]!);
      else L.unstyle(wrap, "--sx"), L.unstyle(wrap, "--sy");
      if (!G[DIRTY]) return;
      G[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    const t = G[TIME]!, m = G[MODE]!, a = G[GA]!;
    gb.clearRect(0, 0, W, H);
    g.clearRect(0, 0, W, H);
    if (m !== OFF && a > 0.01) {
      // The ghost: see-through and shimmering while it sneaks; solid once caught. A trail when it flees.
      const pose = m === CAUGHT ? 2 : m === CAST || m === TIDY || (m === BYE && (t * 6) & 1) ? 1 : m === HIDE && G[GIG]! > 0 ? 3 : 0;
      const fr = pose * 2 + ((t * 5) & 1), x = round(G[GX]! + (m === CAUGHT ? sin(t * 70) : 0)), y = round(G[GY]! + sin(t * 3) * 1.5);
      if (m === FLEE) for (let k = 1; k < 4; k++) (gb.globalAlpha = 0.12 * (4 - k)), art.draw(gb, "ghost", fr, x + (G[GX]! - G[GTX]!) * k * 0.4, y + (G[GY]! - G[GTY]!) * k * 0.4);
      gb.globalAlpha = m === CAUGHT ? 1 : a * (0.85 + 0.15 * sin(t * 17));
      art.draw(gb, "ghost", fr, x, y);
      gb.globalAlpha = 1;
      // Telekinesis: a dotted thread from each raised hand to every piece it holds.
      if (m === CAST || m === TIDY) {
        g.fillStyle = C.cmd;
        for (let i = 0; i < n; i++) {
          if (M[i] !== 1 || U[i]! < 0) continue;
          const hx = x + (cx(i) < x ? -8 : 8), hy = y - 5, ex = cx(i), ey = HY[i]! + PY[i]!;
          for (let s = (t * 24) % 3; s < 18; s += 3) {
            const k = s / 18;
            g.fillRect(round(hx + (ex - hx) * k), round(hy + (ey - hy) * k + sin(k * PI) * -4), 1, 1);
          }
        }
      }
    }
    fx.draw(g);
    // The lights flicker (the room goes dark for a frame or two).
    if (G[FLK]! > 0 && ((G[FLK]! * 22) | 0) & 1) (g.globalAlpha = 0.55), (g.fillStyle = C.rim), g.fillRect(0, 0, W, H), (g.globalAlpha = 1);
    // The word of the moment: EEP! in comic letters; the rest whispered.
    const wt = G[WT]!;
    if (wt < 1.1) {
      const w = G[WD]!, s = SAY[w]!;
      if (w === 0) g.drawImage(eep.canvas, round(G[WX]!) - 1, round(G[WY]! - (wt < 0.06 ? 2 : 0)) - 2);
      else if (wt < 1 || (wt * 20) & 1) print(g, s, round(G[WX]!), round(G[WY]! - wt * 3), w === 3 ? C.muted : C.ink);
    }
    if (G[SPOT]!) print(g, SPOTS[min(99, G[SPOT]!)]!, 4, H - 8, C.muted);
  }

  engine.start();
  return {
    engine,
    tap,
    get mode() {
      return G[MODE]!;
    },
    get spotted() {
      return G[SPOT]!;
    },
    get moved() {
      return G[MOVES]!;
    },
    /** The ghost's place in art px (x, y) and how visible it is (0–1). */
    get ghost() {
      return [G[GX]!, G[GY]!, G[GA]!];
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the ghost drifting in towards the heading (scripts/gallery-posters.mjs draws it). */
export const posterAt = 0.9;

/** For `slot(fig, () => import("./haunted-page").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => haunt(stage, slot, first);
