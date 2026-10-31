// Look out below!: PLUM (toon.ts) wants a nice walk past the morning paper. Click and an anvil
// drops where you clicked: its shadow grows first (lead him: it takes a beat to fall), it whistles
// down in a smear and knocks aside any letter in its way. Land it on PLUM and he goes flat as an
// accordion, stars round his head; the anvil is hauled back up, he pops up with a boing, glares at
// you and swears in symbols. Miss and it craters the sidewalk, or the paper itself: the letters it
// lands on squash and splay, and spring back when it's hauled away. Double-click to drop a piano
// instead (wider, PLONK, keys everywhere). Fool him once: after the first bonk he watches the sky
// while he stands, sees a shadow and zips off, so catch him on the move.
// Bricks: the kernel (fixed step, settle: it sleeps once he stands still and the page is whole; its
// ledger for every page write, so Recall gives the page back byte for byte) and fzlt/sprite (the
// toon and the props, baked once). The toon is shared with "Short fuse" (toon.ts).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, F, HAT_Y, PLUM, ANVIL, PIANO, TOON, grawlix, print, shout, stars, take, textW } from "./toon";

export type AnvilScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly bonks: number; readonly dodges: number; readonly plum: number };

const { abs, max, min, round, sign, sqrt } = Math;
const W = 160, H = 90, FLOOR = 79, CAP = 6, GRAV = 520, TOP = -20, WALK = 24;
// The props: half width and height (art px).
const HW = [6, 10], PH = [7, 17];
// PLUM's modes.
const enum M { STAND, WALKING, TAKE, LOOK, ZIP, FLAT, POP, GLARE }
// A drop's states.
const enum D { FREE, FALL, SIT, HAUL }
// State slots.
const enum K { MODE, T, PX, FACE, TX, BONKS, DODGES, WARY, AUTO, RES, DIRTY, SHAKE, WORD, WT, WX, WY, RUNFROM, LASTX, LASTT, LASTD, CLOCK, QX, QY, QN }
const WORDS = ["BONK!", "PLONK!", "THUD", "CRUNCH", "BOING"];
// Values for the page, made once (art px → cqw: the stage is a size container).
const YS = Array.from({ length: 61 }, (_, i) => `${(i - 30) * 0.625}cqw`);
const RS = Array.from({ length: 81 }, (_, i) => `${i - 40}deg`);
const QS = Array.from({ length: 21 }, (_, i) => `${i / 20}`);
const DIG = Array.from({ length: 100 }, (_, i) => String(i));
const f32 = (k: number) => new Float32Array(k);
/** One step of a damped spring pulling X[i] to T[i]; how far it still is from rest there. */
function spring(X: Float32Array, V: Float32Array, T: Float32Array, i: number, k: number, c: number, dt: number) {
  V[i] = V[i]! + (k * (T[i]! - X[i]!) - c * V[i]!) * dt;
  X[i] = X[i]! + V[i]! * dt;
  return abs(X[i]! - T[i]!) + abs(V[i]!);
}

export function lookOutBelow(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): AnvilScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 77 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites({ ...PLUM, anvil: ANVIL(), piano: PIANO() }, { palettes: TOON });
  const S = new Float64Array(24);
  S[K.PX] = first ? 60 : -10;
  S[K.FACE] = 1;
  S[K.TX] = 58;
  S[K.MODE] = first ? M.STAND : M.WALKING;
  S[K.WT] = 9;
  S[K.RES] = S[K.DIRTY] = 1;
  S[K.AUTO] = first ? 0 : 0.9;
  S[K.LASTT] = -9;

  // The page: every letter and word; its box (art px) and its spring (drop, tilt, squash).
  const wrap = slot.querySelector<HTMLElement>(".lb")!, els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const EX = f32(n), EY = f32(n), EW = f32(n), EH = f32(n);
  const OY = f32(n), VY = f32(n), RO = f32(n), VR = f32(n), Q = f32(n).fill(1), VQ = f32(n);
  const TY = f32(n), TR = f32(n), TQ = f32(n).fill(1);
  const HELD = new Int8Array(n).fill(-1), BAT = new Int8Array(n).fill(-1), LY = new Int16Array(n), LR = new Int16Array(n), LQ = new Int16Array(n).fill(20);
  // The drops: where, how fast, what, on what (an element, or -1 the floor), how long in this state.
  const DX = f32(CAP), DY = f32(CAP), DV = f32(CAP), DT = f32(CAP), DSY = f32(CAP);
  const DS = new Uint8Array(CAP), DK = new Uint8Array(CAP), DE = new Int16Array(CAP), DB = new Uint8Array(CAP);
  // Craters in the sidewalk: x, size, age. Dust: a few puffs.
  const CX = f32(4), CR = f32(4), CA = f32(4).fill(9);
  const PUX = f32(16), PUY = f32(16), PUV = f32(16), PUA = f32(16).fill(9), PUK = new Uint8Array(16);
  let cn = 0, pn = 0;

  const ro = new ResizeObserver(() => ((S[K.RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (w: number, x: number, y: number) => {
    const hw = textW(WORDS[w]!, 3) / 2 + 2;
    S[K.WORD] = w;
    S[K.WT] = 0;
    S[K.WX] = max(hw, min(W - hw, x));
    S[K.WY] = max(3, min(FLOOR - 26, y));
  };
  const puff = (x: number, y: number, v: number, k: number) => {
    const p = pn++ & 15;
    PUX[p] = x;
    PUY[p] = y;
    PUV[p] = v;
    PUA[p] = 0;
    PUK[p] = k;
  };

  /** A tap at (x, y) in art px: a drop there (or, on the one just dropped, a piano instead). */
  function tap(x: number, y: number) {
    S[K.QX] = x;
    S[K.QY] = y;
    S[K.QN] = 1;
    engine.wake();
  }
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** The element under (x, y), or -1. */
  function under(x: number, y: number) {
    for (let i = 0; i < n; i++) if (x > EX[i]! - 1 && x < EX[i]! + EW[i]! + 1 && y > EY[i]! - 2 && y < EY[i]! + EH[i]! + 1) return i;
    return -1;
  }

  /** Drop something at x, onto element e (or the sidewalk). */
  function drop(x: number, e: number, kind: number) {
    let d = -1;
    for (let k = 0; k < CAP; k++) if (DS[k] === D.FREE) (d = k), (k = CAP);
    if (d < 0) return;
    DS[d] = D.FALL;
    DK[d] = kind;
    DX[d] = max(HW[kind]!, min(W - HW[kind]!, x));
    DY[d] = TOP - (kind ? 8 : 0);
    DV[d] = 0;
    DT[d] = 0;
    DE[d] = e;
    DB[d] = 0;
    S[K.LASTD] = d;
    S[K.LASTX] = x;
    S[K.LASTT] = S[K.CLOCK]!;
    // He looks up: once bitten, a shadow at his feet sends him running.
    if (e < 0 && S[K.WARY] && (S[K.MODE] === M.STAND || S[K.MODE] === M.LOOK) && abs(DX[d]! - S[K.PX]!) < HW[kind]! + 10) to(M.TAKE), (S[K.TX] = DX[d]!), (S[K.RUNFROM] = d + 1);
  }

  /** Where a drop comes to rest: the sidewalk, the element it was dropped on, or PLUM flat. */
  function surface(d: number) {
    const x = DX[d]!, hw = HW[DK[d]!]!;
    let s = DE[d]! >= 0 ? EY[DE[d]!]! + 3 : FLOOR;
    if (DE[d]! < 0 && S[K.MODE] === M.FLAT && abs(x - S[K.PX]!) < hw + 5) s = FLOOR - 4;
    return s;
  }

  /** The letters a landing reaches: the one under it squashes, its neighbours splay; held till it goes. */
  function crater(d: number) {
    const x = DX[d]!, r = DK[d] ? 16 : 9, e = DE[d]!, row = EY[e]!;
    for (let i = 0; i < n; i++) {
      if (abs(EY[i]! - row) > 3) continue;
      const cx = EX[i]! + EW[i]! / 2, dd = abs(cx - x) - EW[i]! / 2;
      if (i === e || dd < 0) (TY[i] = DK[d] ? 4 : 3), (TQ[i] = DK[d] ? 0.4 : 0.55), (TR[i] = 0), (HELD[i] = d), (VY[i] = 90);
      else if (dd < r) (TR[i] = sign(cx - x) * round(28 - dd * 1.4)), (TY[i] = 2), (HELD[i] = d), (VR[i] = sign(cx - x) * 160), (VY[i] = -60);
    }
  }
  /** The drop is gone: its letters spring home (boing). */
  function release(d: number) {
    for (let i = 0; i < n; i++) if (HELD[i] === d) (HELD[i] = -1), (TY[i] = 0), (TR[i] = 0), (TQ[i] = 1), (VY[i] = -70), (VQ[i] = 3);
  }

  function land(d: number, s: number) {
    const k = DK[d]!, x = DX[d]!, e = DE[d]!;
    DS[d] = D.SIT;
    DT[d] = 0;
    DY[d] = s;
    S[K.SHAKE] = k ? 0.22 : 0.12;
    for (let j = 0; j < (k ? 8 : 5); j++) puff(x + (j - (k ? 3.5 : 2)) * (k ? 4 : 3), s, (j & 1 ? -1 : 1) * (8 + rnd() * 12), 0);
    if (k) for (let j = 0; j < 6; j++) puff(x + (rnd() - 0.5) * 16, s - 8, (rnd() - 0.5) * 70, 1); // piano keys fly
    if (e >= 0) return crater(d), say(k ? 1 : 3, x, s - 22);
    if (DB[d]) return say(k ? 1 : 0, x, s - 26);
    {
      // The sidewalk takes it: a crater, and the anvil sinks in a little.
      const c = cn++ & 3;
      CX[c] = x;
      CR[c] = HW[k]! + 3;
      CA[c] = 0;
      DY[d] = FLOOR + 1;
      say(k ? 1 : 2, x, FLOOR - 26);
      // A near miss: he jumps out of his skin, then looks at you (or he dodged it and counts).
      const dx = abs(x - S[K.PX]!), m = S[K.MODE]!;
      if (S[K.RUNFROM] === d + 1) (S[K.DODGES] = S[K.DODGES]! + 1), (S[K.RUNFROM] = 0);
      else if (m === M.ZIP) return;
      else if (dx < HW[k]! + 14 && m !== M.FLAT && m !== M.POP && m !== M.GLARE) to(M.TAKE), (S[K.TX] = -1);
    }
  }

  engine.add({
    read() {
      if (!S[K.RES]) return;
      S[K.RES] = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        EX[i] = x * k;
        EY[i] = y * k;
        EW[i] = el.offsetWidth * k;
        EH[i] = el.offsetHeight * k;
      }
      S[K.DIRTY] = 1;
    },
    step(e, dt) {
      let busy = false;
      S[K.CLOCK] = S[K.CLOCK]! + dt;
      // The intro: an anvil, just in front of his nose.
      if (S[K.AUTO]! > 0) {
        busy = true;
        if ((S[K.AUTO] = S[K.AUTO]! - dt) <= 0) drop(38, -1, 0);
      }
      // A tap: a drop; a second tap on the one still high up turns it into a piano.
      if (S[K.QN]) {
        S[K.QN] = 0;
        const x = S[K.QX]!, y = S[K.QY]!, d = S[K.LASTD]!;
        if (S[K.CLOCK]! - S[K.LASTT]! < 0.32 && abs(x - S[K.LASTX]!) < 12 && DS[d] === D.FALL && !DK[d] && DY[d]! < 30) (DK[d] = 1), (S[K.LASTT] = -9);
        else drop(x, y < FLOOR - 4 ? under(x, y) : -1, 0);
      }
      const m = S[K.MODE]!, t = (S[K.T] = S[K.T]! + dt);
      // PLUM.
      if (m === M.WALKING) {
        const dx = S[K.TX]! - S[K.PX]!;
        S[K.FACE] = dx < 0 ? -1 : 1;
        S[K.PX] = S[K.PX]! + S[K.FACE]! * min(abs(dx), WALK * dt);
        if (abs(dx) < 0.5) to(M.STAND);
      } else if (m === M.TAKE && t > (S[K.TX]! >= 0 ? 0.14 : 0.36)) {
        // Wary and it's coming for him: wind up and run. Otherwise: a look at you.
        if (S[K.TX]! >= 0) to(M.ZIP), puff(S[K.PX]!, FLOOR, -S[K.FACE]! * 20, 0), (S[K.FACE] = S[K.PX]! < S[K.TX]! ? (S[K.PX]! > 30 ? -1 : 1) : S[K.PX]! < 130 ? 1 : -1);
        else to(M.LOOK);
      } else if (m === M.ZIP) {
        // Legs whirl in place a beat, then he's gone, and skids to a stop (a puff) to look back.
        if (t > 0.13 && t < 0.4) S[K.PX] = max(8, min(152, S[K.PX]! + S[K.FACE]! * 150 * dt));
        if (t >= 0.4 && t - dt < 0.4) puff(S[K.PX]!, FLOOR, S[K.FACE]! * 14, 0);
        if (t > 0.65) to(M.LOOK), (S[K.FACE] = -S[K.FACE]!), (S[K.TX] = -1);
      } else if (m === M.LOOK && t > 0.9) walkOn();
      else if (m === M.FLAT) {
        // Under it until the last thing on him is hauled away.
        let held = false;
        for (let k = 0; k < CAP; k++) if ((DS[k] === D.SIT || DS[k] === D.HAUL) && DE[k]! < 0 && abs(DX[k]! - S[K.PX]!) < HW[DK[k]!]! + 5 && DY[k]! > FLOOR - 30) held = true;
        if (!held && t > 0.6) to(M.POP), say(4, S[K.PX]!, FLOOR - 46);
      } else if (m === M.POP && t > 0.5) to(M.GLARE);
      else if (m === M.GLARE && t > 1.3) walkOn();
      if (S[K.MODE] !== M.STAND || S[K.T]! < 0.9) busy = true;

      // The drops.
      for (let d = 0; d < CAP; d++) {
        const s = DS[d]!;
        if (s === D.FREE) continue;
        busy = true;
        DT[d] = DT[d]! + dt;
        if (s === D.FALL) {
          const k = DK[d]!, x = DX[d]!, hw = HW[k]!, y0 = DY[d]!;
          DV[d] = DV[d]! + GRAV * dt;
          DY[d] = y0 + DV[d]! * dt;
          // Letters in the way get knocked aside.
          for (let i = 0; i < n; i++)
            if (i !== DE[d] && BAT[i] !== d && HELD[i]! < 0 && DY[d]! > EY[i]! + 1 && y0 - PH[k]! < EY[i]! + EH[i]! && x + hw > EX[i]! && x - hw < EX[i]! + EW[i]! && (DE[d]! < 0 || EY[i]! < EY[DE[d]!]! - 2))
              (BAT[i] = d), (VY[i] = -90 - rnd() * 40), (VR[i] = (EX[i]! + EW[i]! / 2 < x ? -1 : 1) * (220 + rnd() * 160));
          // PLUM in the way: BONK.
          if (DE[d]! < 0 && !DB[d] && DY[d]! > FLOOR - 15 && abs(x - S[K.PX]!) < hw + 5 && S[K.MODE] !== M.ZIP && S[K.MODE] !== M.FLAT) {
            DB[d] = 1;
            S[K.BONKS] = S[K.BONKS]! + 1;
            S[K.WARY] = 1;
            S[K.RUNFROM] = 0;
            to(M.FLAT);
          }
          const sf = surface(d);
          if (DY[d]! >= sf) land(d, sf);
        } else if (s === D.SIT && DT[d]! > (DK[d] ? 1.3 : 1.05)) {
          // Hauled back up on a rope.
          DS[d] = D.HAUL;
          DT[d] = 0;
          DSY[d] = DY[d]!;
          release(d);
        } else if (s === D.HAUL) {
          const u = DT[d]!;
          DY[d] = DSY[d]! - (u < 0.18 ? u * 8 : 1.4 + (u - 0.18) * (u - 0.18) * 520);
          if (DY[d]! < -30) (DS[d] = D.FREE), release(d);
        }
      }
      for (let i = 0; i < n; i++) if (BAT[i]! >= 0 && DS[BAT[i]!] === D.FREE) BAT[i] = -1;

      // The page: springs back to where it belongs (or where a crater holds it).
      for (let i = 0; i < n; i++) {
        if (OY[i] === TY[i] && RO[i] === TR[i] && Q[i] === TQ[i] && !VY[i] && !VR[i] && !VQ[i]) continue;
        const a = spring(OY, VY, TY, i, 260, 11, dt), b = spring(RO, VR, TR, i, 200, 10, dt), c = spring(Q, VQ, TQ, i, 400, 14, dt);
        if (a < 0.2 && b < 0.3 && c < 0.01)
          (OY[i] = TY[i]!), (RO[i] = TR[i]!), (Q[i] = TQ[i]!), (VY[i] = VR[i] = VQ[i] = 0);
        busy = true;
      }
      for (let c = 0; c < 4; c++) if (CA[c]! < 3) (CA[c] = CA[c]! + dt), (busy = true);
      for (let p = 0; p < 16; p++) if (PUA[p]! < 0.8) (PUA[p] = PUA[p]! + dt), (busy = true);
      if (S[K.SHAKE]! > 0) (S[K.SHAKE] = S[K.SHAKE]! - dt), (busy = true);
      if (S[K.WT]! < 1.1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, y = max(-30, min(30, round(OY[i]!))), r = max(-40, min(40, round(RO[i]!))), q = max(0, min(20, round(Q[i]! * 20)));
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", YS[y + 30]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", RS[r + 40]!) : L.unstyle(el, "--r");
        if (q !== LQ[i]) (LQ[i] = q), q !== 20 ? L.style(el, "--q", QS[q]!) : L.unstyle(el, "--q");
      }
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw();
    },
  });

  /** After a look or a glare: off he goes, somewhere a fair way from here. */
  function walkOn() {
    const x = S[K.PX]!;
    S[K.TX] = x < 80 ? 84 + rnd() * 56 : 18 + rnd() * 56;
    to(M.WALKING);
  }

  function draw() {
    const sk = S[K.SHAKE]! > 0 ? (round(S[K.SHAKE]! * 40) & 1 ? 1 : -1) : 0;
    g.setTransform(1, 0, 0, 1, 0, sk);
    g.clearRect(0, -2, W, H + 4);
    // The sidewalk: a kerb, slabs, and the craters in it.
    g.fillStyle = C.muted;
    g.fillRect(0, FLOOR, W, H - FLOOR + 2);
    g.fillStyle = C.rim;
    g.fillRect(0, FLOOR, W, 1);
    g.fillStyle = C.cmd;
    for (let x = 7; x < W; x += 20) g.fillRect(x, FLOOR + 1, 1, 2);
    g.fillStyle = C.base;
    g.fillRect(0, FLOOR + 3, W, H - FLOOR);
    for (let c = 0; c < 4; c++) {
      const a = CA[c]!;
      if (a >= 3) continue;
      const x = round(CX[c]!), r = round(CR[c]! * (a > 2 ? 3 - a : 1));
      if (r < 1) continue;
      g.fillStyle = C.rim;
      g.fillRect(x - r, FLOOR, r * 2, 2);
      g.fillRect(x - r + 2, FLOOR + 2, r * 2 - 4, 1);
    }
    // The score, printed on the kerb (bottom left: the gallery says TAP TO PLAY bottom right).
    hud("BONKS", S[K.BONKS]!, 3);
    hud("DODGES", S[K.DODGES]!, 40);
    // Shadows for what's falling: a dot that grows into the thing's own size.
    for (let d = 0; d < CAP; d++) {
      if (DS[d] !== D.FALL) continue;
      const hw = HW[DK[d]!]!, sf = surface(d), u = max(0, min(1, (DY[d]! - TOP) / (sf - TOP))), w = max(1, round(hw * (0.25 + u * 0.75)));
      g.fillStyle = C.rim;
      g.globalAlpha = 0.35 + u * 0.4;
      g.fillRect(round(DX[d]!) - w, round(sf) - 1, w * 2, 1);
      g.fillRect(round(DX[d]!) - w + 1, round(sf), w * 2 - 2, 1);
      g.globalAlpha = 1;
    }
    // PLUM: a pose for the mode, his hat above.
    const m = S[K.MODE]!, t = S[K.T]!, x = round(S[K.PX]!), lf = S[K.FACE]! < 0 ? F.left : 0;
    let f = F.stand + lf, y = FLOOR, hy = 0;
    if (m === M.WALKING) (f = (t * 7.5) & 1 ? F.walkA + lf : F.walkB + lf), (y = FLOOR - ((t * 7.5) & 1 ? 0 : 1));
    else if (m === M.TAKE) (f = F.take + lf), (y = FLOOR - max(0, round(min(t, 0.32 - t) * 30))), (hy = -4);
    else if (m === M.ZIP) (f = t < 0.4 ? F.whirl + lf : F.stand + lf), (y = FLOOR - (t < 0.13 ? 1 : 0));
    else if (m === M.LOOK) f = F.look;
    else if (m === M.GLARE) f = F.glare;
    else if (m === M.FLAT) f = F.flat;
    g.fillStyle = C.base;
    g.fillRect(x - 6, FLOOR, 12, 1);
    if (m === M.ZIP && t < 0.4) {
      // Speed lines and a dust trail behind him.
      g.fillStyle = C.rim;
      for (let j = 0; j < 4; j++) g.fillRect(x - S[K.FACE]! * (10 + j * 3) - (S[K.FACE]! < 0 ? 0 : 8), FLOOR - 4 - j * 3, t > 0.13 ? 10 : 4, 1);
    }
    if (m === M.POP) {
      // The boing: up tall and thin, down wide, settle (squash and stretch on the baked tile).
      const u = t / 0.5, s = 1 + Math.sin(u * 9) * 0.35 * (1 - u), w = round(15 / s), h = round(18 * s), tile = art.tile("plum", F.look, 1, 0);
      g.drawImage(tile, x - (w >> 1), FLOOR - h + 1, w, h);
      art.draw(g, "hat", 0, x, FLOOR - h + 4 - round(sqrt(1 - u) * 6), 0, 1);
    } else {
      art.draw(g, "plum", f, x, y, 0, 1);
      if (m !== M.FLAT || t > 0.05) art.draw(g, "hat", 0, x + (m === M.FLAT ? (S[K.FACE]! < 0 ? 2 : -2) : 0), y + HAT_Y(f) + hy, 0, 1);
    }
    if (m === M.FLAT) stars(g, x, FLOOR - 10, t);
    if (m === M.TAKE) take(g, x, y - 24, C.rim);
    if (m === M.GLARE && t > 0.3) grawlix(g, x + (x > 130 ? -14 : 14), FLOOR - 26, t - 0.3);
    // The drops: falling (with a smear while fast), sitting, hauled up on a rope.
    for (let d = 0; d < CAP; d++) {
      const s = DS[d]!;
      if (s === D.FREE) continue;
      const k = DK[d]!, dx = round(DX[d]!), dy = round(DY[d]!), id = k ? "piano" : "anvil";
      if (s === D.FALL && DV[d]! > 120) {
        g.fillStyle = C.line;
        const len = min(18, round(DV[d]! / 18));
        g.fillRect(dx - HW[k]! + 1, dy - PH[k]! - len, 1, len), g.fillRect(dx, dy - PH[k]! - len - 3, 1, len), g.fillRect(dx + HW[k]! - 2, dy - PH[k]! - len + 2, 1, len - 2);
        // The smear: the tile drawn long.
        const tile = art.tile(id, 0, 1, 0), tw = tile.width, th = tile.height;
        g.drawImage(tile, dx - (tw >> 1), dy - th - 3, tw, th + 3);
      } else art.draw(g, id, 0, dx, dy + (s === D.SIT && DT[d]! < 0.1 ? 1 : 0), 0, 1);
      if (s === D.HAUL) {
        g.fillStyle = C.rim;
        g.fillRect(dx, 0, 1, max(0, dy - PH[k]! - 1));
        g.fillRect(dx - 2, dy - PH[k]! - 2, 5, 1);
      }
    }
    // Dust puffs and piano keys.
    for (let p = 0; p < 16; p++) {
      const a = PUA[p]!;
      if (a >= 0.8) continue;
      const k = PUK[p]!, px = round(PUX[p]! + PUV[p]! * a * (1 - a * 0.5)), py = round(PUY[p]! - 1 - (k === 1 ? 50 * a - 90 * a * a : 7 * a));
      if (k === 1) (g.fillStyle = C.rim), g.fillRect(px - 1, py - 1, 4, 3), (g.fillStyle = (p & 1) ? C.ink : C.rim), g.fillRect(px, py, 2, 1);
      else {
        // A round puff of dust, rimmed, swelling as it drifts.
        const r = 1 + round(a * 1.6);
        g.fillStyle = C.rim;
        g.fillRect(px - r, py - r - 1, r * 2, r * 2 + 2), g.fillRect(px - r - 1, py - r, r * 2 + 2, r * 2);
        g.fillStyle = C.ink;
        g.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
    // The word of the moment: slams in, hangs, goes.
    const wt = S[K.WT]!;
    if (wt < 0.8) shout(g, WORDS[S[K.WORD]!]!, S[K.WX]!, S[K.WY]! - (wt < 0.05 ? 2 : 0), wt < 0.05 ? 3 : 2, C.hurt, C.attack);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** A label and its count in the 3 × 5 font on the dark kerb. */
  function hud(label: string, v: number, x: number) {
    print(g, label, x, FLOOR + 5, C.muted);
    print(g, DIG[min(99, v)]!, x + label.length * 4 + 2, FLOOR + 5, C.ink);
  }

  engine.start();
  return {
    engine,
    tap,
    get bonks() {
      return S[K.BONKS]!;
    },
    get dodges() {
      return S[K.DODGES]!;
    },
    get plum() {
      return S[K.PX]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the intro anvil whistling down at PLUM's nose, its shadow on the sidewalk (scripts/gallery-posters.mjs). */
export const posterAt = 1.2;

/** For `slot(fig, () => import("./anvil-drops-where-you-click").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => lookOutBelow(stage, slot, first);
