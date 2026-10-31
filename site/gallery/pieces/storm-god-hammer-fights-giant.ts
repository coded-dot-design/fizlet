// #50 the hammer: BRONT, a bronze storm god, against KRUNCH, the rage giant from #49 SMASH, on a
// storm-lit panel. Click to throw the hammer at what you clicked: it spins, crackles with
// lightning, ricochets off the panel's real letters (knocking each one it hits) and the walls,
// then boomerangs home. Hit the giant and the thunder claps: the whole panel flashes and a bolt
// comes down on him. A ricochet that then lands is a TRICK SHOT (double, and it gets past his
// guard). He fights back: after each hit he tears up a boulder and hurls it; if the hammer is home
// BRONT swats it to bits, if it's still out he takes it. Rounds escalate (more pips, a guard from
// round 2, faster boulders); a KO puts KRUNCH down, three wins the bout, and it starts again.
// Bricks: the kernel (fixed step, settle: it sleeps between throws; its ledger for every page write,
// so Recall gives the page back byte for byte) and fzlt/sprite (both fighters and the hammer,
// baked once). The giant is shared with #49 (krunch.ts).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, HEAD_Y, KRUNCH, RAGE, shout, textW } from "./krunch";

export type HammerScene = SlotScene & { engine: ReturnType<typeof createEngine>; throwAt(x: number, y: number): void; readonly round: number; readonly pips: number[] };

const { abs, cos, hypot, max, min, round, sin } = Math;
const W = 160, H = 90, FL = 80, BX0 = 24, KX0 = 132;
// h hair and beard, e its shade, s bronze skin, d its shade, c storm eyes and belt, r robe, q robe
// shade, g pauldrons, b boots. Frames: 0 hammer up (it is drawn at the hand), 1 the throw.
const god = (arm: string[]) =>
  [
    "......hhhh..........",
    ".....hhhhhh.........",
    "....hhsssshh........",
    "....hscsscsh........",
    "....hssssssh........",
    "....hhhsshhh........",
    "...ghhhhhhhhg.......",
    "..gggheehhhggg......",
    ".ggrrhhhhhhrrgg.....",
    ".ssrrrhhhhrrrrq.....",
    ".ssrrrrhhrrrrrq.....",
    ".ssrrrrrrrrrrrq.....",
    ".ddcccccccccccq.....",
    ".ss.rrrrrrrrrrq.....",
    ".ss.rrrrqrrrrrq.....",
    "....rrrrqrrrrrq.....",
    "...rrrrrqqrrrrqq....",
    "...rrrrq..qrrrrq....",
    "...qqqq.....qqqq....",
    "....ss......ss......",
    "...bbbb....bbbb.....",
    "..bbbbb....bbbbb....",
  ].map((r, i) => (arm[i] ? r.slice(0, 13) + arm[i] : r));
const UP = ["", "......ss", ".....ds.", ".....ds.", "....ds..", "....ds..", "...dss..", "..sss...", "ss......"];
const OUT = ["", "", "", "", "", "", "", "....sssss", "ssssssdss", "dd......."];
const CAST = {
  ...KRUNCH,
  bront: { frames: [god(UP), god(OUT)], colors: { h: C.ink, e: C.muted, s: C.hurt, d: C.aim, c: C.sys, r: C.cmd, q: C.base, g: C.sys, b: C.base }, outline: C.rim, ax: 8, ay: 22 },
  // The hammer: a round storm maul, gold bands, a grip that glows.
  maul: { frames: [["..rrrr..", ".rgrrgr.", ".rgrrgr.", ".rgrrgr.", "..rrrr..", "...cc...", "...cc...", "...cc...", "...gg..."]], colors: { r: C.muted, g: C.hurt, c: C.sys }, outline: C.rim, ax: 4, ay: 5 },
};
// State slots.
const HM = 0, HX = 1, HY = 2, VX = 3, VY = 4, HT = 5, HB = 6, SPIN = 7, KP = 8, KM = 9, KF = 10, KS = 11, KO = 12, GUARD = 13;
const BON = 14, BX = 15, BY = 16, BVX = 17, BVY = 18, CT = 19, GP = 20, GF = 21, THROW = 22, ROUND = 23, END = 24, SHAKE = 25;
const FLASH = 26, WORD = 27, WT = 28, WX = 29, WY = 30, QX = 31, QY = 32, Q = 33, AUTO = 34, DIRTY = 35, RES = 36, WIND = 37;
const WORDS = ["BOOM!", "KRAK!", "TRICK SHOT!", "CLANG!", "CRACK!", "BAM!", "KO!", "BRONT WINS!", "KRUNCH WINS!", "ROUND 2", "ROUND 3"];
const PX = Array.from({ length: 121 }, (_, i) => `${(i - 60) * 0.625}cqw`);
const DG = Array.from({ length: 91 }, (_, i) => `${i - 45}deg`);
const SH = Array.from({ length: 9 }, (_, i) => `${(i - 4) * 0.625}cqw`);
const NB = 48;
const TIMERS = Uint8Array.of(KF, GF, THROW, FLASH, SHAKE);

export function hammer(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): HammerScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 50 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites(CAST, { palettes: RAGE });
  const S = new Float64Array(38);
  S[KP] = S[KM] = 3;
  S[GP] = 3;
  S[ROUND] = 1;
  S[KO] = S[END] = -1;
  S[WT] = 9;
  S[RES] = S[DIRTY] = 1;
  S[AUTO] = first ? 0 : 0.5;

  // The panel's real letters: boxes (art px) and springs (x, y, turn).
  const wrap = slot.querySelector<HTMLElement>(".hm50")!, els = [...wrap.querySelectorAll<HTMLElement>(".hm50-t i")], n = els.length;
  const num = wrap.querySelector(".hm50-n")!.firstChild as Text;
  const EX = new Float32Array(n), EY = new Float32Array(n), EW = new Float32Array(n), EH = new Float32Array(n), CD = new Float32Array(n);
  const P = new Float32Array(n * 3), V = new Float32Array(n * 3), LIT = new Float32Array(n), LW = new Int16Array(n * 3), LL = new Uint8Array(n);
  // Sparks and boulder bits: x, y, vx, vy, life, colour.
  const SX = new Float32Array(NB), SY = new Float32Array(NB), SVX = new Float32Array(NB), SVY = new Float32Array(NB), SL = new Float32Array(NB), SC = new Uint8Array(NB);
  const BITC = [C.sys, C.ink, C.hurt, C.line, C.muted];
  // The crackle: two bolts of four kinks each off the hammer, rolled every step.
  const ZK = new Float32Array(16);
  let sn = 0;

  const ro = new ResizeObserver(() => ((S[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const throwAt = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) throwAt((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    throwAt(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const say = (w: number, x: number, y: number) => {
    const h = textW(WORDS[w]!, 2) / 2 + 2;
    S[WORD] = w;
    S[WT] = 0;
    S[WX] = max(h, min(W - h, x));
    S[WY] = y;
  };
  const burst = (x: number, y: number, k: number, c: number, sp: number) => {
    for (let i = 0; i < k && sn < NB; i++, sn++) {
      const a = rnd() * 6.283, v = sp * (0.4 + rnd());
      SX[sn] = x;
      SY[sn] = y;
      SVX[sn] = cos(a) * v;
      SVY[sn] = sin(a) * v - sp * 0.4;
      SL[sn] = 0.3 + rnd() * 0.4;
      SC[sn] = c + ((rnd() * 2) | 0);
    }
  };
  /** Where the hammer sits in BRONT's raised hand. */
  const handX = () => BX0 + 6, handY = () => FL - 22;
  /** The giant's x, knocked back while it recovers. */
  const kx = () => KX0 + S[KS]!;

  function toss(x: number, y: number) {
    if (S[HM] || S[END]! >= 0) return;
    const dx = x - handX(), dy = y - handY(), d = hypot(dx, dy) || 1;
    S[HM] = 1;
    S[HX] = handX();
    S[HY] = handY();
    S[VX] = (dx / d) * 250;
    S[VY] = (dy / d) * 250;
    S[HT] = S[HB] = 0;
    S[THROW] = 0.3;
  }

  /** The hammer hits KRUNCH: blocked, or a hit with a thunderclap; the last pip is a KO. */
  function strike() {
    const trick = S[HB]! > 0;
    S[HM] = 2;
    if (S[GUARD] && !trick) {
      S[VX] = -abs(S[VX]!);
      burst(S[HX]!, S[HY]!, 8, 1, 80);
      return say(3, kx(), FL - 44);
    }
    S[KP] = max(0, S[KP]! - (trick ? 2 : 1));
    S[KF] = 0.25;
    S[KS] = 9;
    S[FLASH] = 0.34;
    S[SHAKE] = 0.3;
    for (let i = 0; i < n; i++) LIT[i] = 0.2;
    burst(S[HX]!, S[HY]!, 14, 0, 140);
    if (!S[KP]) (S[KO] = 0), (S[KS] = 16), say(6, kx(), FL - 46);
    else (S[CT] = 0.55), say(trick ? 2 : S[ROUND]! & 1, kx(), FL - 44);
  }

  /** A boulder arrives: swatted if the hammer is home, else BRONT takes it. */
  function landed() {
    S[BON] = 0;
    burst(S[BX]!, S[BY]!, 14, 3, 90);
    if (!S[HM]) return (S[THROW] = 0.2), say(4, BX0 + 6, FL - 42);
    S[GP] = S[GP]! - 1;
    S[GF] = 0.3;
    S[SHAKE] = 0.2;
    say(5, BX0, FL - 42);
    if (!S[GP]) (S[END] = 0), say(8, 80, 8);
  }

  engine.add({
    read() {
      if (!S[RES]) return;
      S[RES] = 0;
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
    },
    step(e, dt) {
      let busy = S[AUTO]! > 0 || S[HM]! > 0 || S[BON]! > 0;
      if (S[AUTO]! > 0 && (S[AUTO] = S[AUTO]! - dt) <= 0) toss(kx(), FL - 20);
      if (S[Q]) (S[Q] = 0), toss(S[QX]!, S[QY]!);
      // The hammer: out, it flies straight and ricochets; then it boomerangs home to the hand.
      if (S[HM]) {
        const t = (S[HT] = S[HT]! + dt);
        S[SPIN] = S[SPIN]! + dt * 22;
        if (S[HM] === 1 && (t > 1.3 || S[HB]! > 4)) S[HM] = 2;
        if (S[HM] === 2) {
          const dx = handX() - S[HX]!, dy = handY() - S[HY]!, d = hypot(dx, dy) || 1, sp = 160 + t * 120;
          S[VX] = S[VX]! + ((dx / d) * sp - S[VX]!) * min(1, dt * 5);
          S[VY] = S[VY]! + ((dy / d) * sp - S[VY]!) * min(1, dt * 5);
          if (d < 6) (S[HM] = 0), (S[THROW] = 0.12), burst(handX(), handY(), 5, 0, 40);
        }
        const x = (S[HX] = S[HX]! + S[VX]! * dt), y = (S[HY] = S[HY]! + S[VY]! * dt);
        if (S[HM] === 1) {
          if (x < 4 || x > W - 4) (S[VX] = -S[VX]!), (S[HX] = max(4, min(W - 4, x))), (S[HB] = S[HB]! + 1);
          if (y < 4 || y > FL - 3) (S[VY] = -S[VY]!), (S[HY] = max(4, min(FL - 3, y))), (S[HB] = S[HB]! + 1);
          if (abs(x - kx()) < 13 && y > FL - 32) strike();
        }
        // Letters: on the way out it bounces off them; on the way home it bowls through.
        for (let i = 0; i < n; i++) {
          const ox = x - (EX[i]! + EW[i]! / 2), oy = y - (EY[i]! + EH[i]! / 2), px = EW[i]! / 2 + 3 - abs(ox), py = EH[i]! / 2 + 3 - abs(oy);
          if (px <= 0 || py <= 0 || CD[i]! > 0) continue;
          CD[i] = 0.25;
          LIT[i] = 0.3;
          V[i * 3] = V[i * 3]! + S[VX]! * 0.7;
          V[i * 3 + 1] = V[i * 3 + 1]! + S[VY]! * 0.7 - 40;
          V[i * 3 + 2] = V[i * 3 + 2]! + (ox < 0 ? 1 : -1) * 500;
          burst(x, y, 5, 0, 70);
          if (S[HM] === 1) {
            if (px < py) (S[VX] = ox < 0 ? -abs(S[VX]!) : abs(S[VX]!)), (S[HX] = x + (ox < 0 ? -px : px));
            else (S[VY] = oy < 0 ? -abs(S[VY]!) : abs(S[VY]!)), (S[HY] = y + (oy < 0 ? -py : py));
            (S[HB] = S[HB]! + 1);
          }
        }
        for (let i = 0; i < 16; i++) ZK[i] = (rnd() - 0.5) * 8;
        // He sees it coming (round 2 on): a guard against a straight throw.
        S[GUARD] = S[ROUND]! > 1 && S[HM] === 1 && !S[HB] && S[KO]! < 0 && x > 70 ? 1 : 0;
      }
      // His answer: a wind-up, then a boulder at BRONT (faster each round).
      if (S[CT]! > 0 && (S[CT] = S[CT]! - dt) <= 0) S[WIND] = 0.3;
      if (S[WIND]! > 0 && (S[WIND] = S[WIND]! - dt) <= 0) {
        const t = 1.05 - S[ROUND]! * 0.15;
        S[BON] = t;
        S[BX] = kx() - 4;
        S[BY] = FL - 34;
        S[BVX] = (BX0 + 4 - S[BX]!) / t;
        S[BVY] = (FL - 14 - S[BY]!) / t - 180 * t;
      }
      if (S[BON]! > 0) {
        S[BVY] = S[BVY]! + 360 * dt;
        S[BX] = S[BX]! + S[BVX]! * dt;
        S[BY] = S[BY]! + S[BVY]! * dt;
        if (S[HM] && hypot(S[BX]! - S[HX]!, S[BY]! - S[HY]!) < 7) (S[BON] = 0), burst(S[BX]!, S[BY]!, 16, 3, 100), say(4, S[BX]!, S[BY]! - 16);
        else if (S[BX]! < BX0 + 8) landed();
      }
      // KO: he goes down; then the next round (or, after three, the bout), and it starts again.
      if (S[KO]! >= 0 && (S[KO] = S[KO]! + dt) > 2) {
        S[KO] = -1;
        if (S[ROUND]! >= 3) (S[END] = 0), say(7, 80, 8);
        else (S[ROUND] = S[ROUND]! + 1), (S[KP] = S[KM] = 2 + S[ROUND]!), L.text(num, "" + S[ROUND]!), say(7 + S[ROUND]!, 80, 50);
      }
      if (S[END]! >= 0 && (S[END] = S[END]! + dt) > 2.6) {
        S[END] = -1;
        S[ROUND] = 1;
        S[KP] = S[KM] = S[GP] = 3;
        L.text(num, "1");
      }
      if (S[KO]! >= 0 || S[END]! >= 0 || S[CT]! > 0 || S[WIND]! > 0) busy = true;
      if (S[KO]! < 0) S[KS] = S[KS]! * (1 - min(1, dt * 4));
      if (S[KS]! > 0.3) busy = true;
      for (let j = 0; j < 5; j++) {
        const k = TIMERS[j]!;
        if (S[k]! > 0) (S[k] = S[k]! - dt), (busy = true);
      }
      if (S[WT]! < 1.2) (S[WT] = S[WT]! + dt), (busy = true);
      // Letters spring home.
      for (let i = 0; i < n * 3; i++) {
        V[i] = V[i]! + (-120 * P[i]! - 10 * V[i]!) * dt;
        P[i] = P[i]! + V[i]! * dt;
        if (abs(P[i]!) + abs(V[i]!) < 0.3) P[i] = V[i] = 0;
        else busy = true;
      }
      for (let i = 0; i < n; i++) {
        if (CD[i]! > 0) CD[i] = CD[i]! - dt;
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (busy = true);
      }
      // Sparks and bits.
      for (let i = sn - 1; i >= 0; i--) {
        if ((SL[i] = SL[i]! - dt) <= 0) {
          sn--;
          (SX[i] = SX[sn]!), (SY[i] = SY[sn]!), (SVX[i] = SVX[sn]!), (SVY[i] = SVY[sn]!), (SL[i] = SL[sn]!), (SC[i] = SC[sn]!);
          continue;
        }
        SVY[i] = SVY[i]! + 300 * dt;
        SX[i] = SX[i]! + SVX[i]! * dt;
        SY[i] = min(FL, SY[i]! + SVY[i]! * dt);
        busy = true;
      }
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      for (let i = 0; i < n * 3; i++) {
        const c = i % 3, v = max(c === 2 ? -45 : -60, min(c === 2 ? 45 : 60, round(P[i]! * (c === 2 ? 1 : 0.1))));
        if (v === LW[i]) continue;
        LW[i] = v;
        const el = els[(i / 3) | 0]!, prop = c === 0 ? "--x" : c === 1 ? "--y" : "--r";
        v ? L.style(el, prop, c === 2 ? DG[v + 45]! : PX[v + 60]!) : L.unstyle(el, prop);
      }
      for (let i = 0; i < n; i++) {
        const l = LIT[i]! > 0 ? 1 : 0;
        if (l !== LL[i]) (LL[i] = l), L.attr(els[i]!, "data-hit", l ? "" : null);
      }
      const f = S[FLASH]!;
      L.attr(wrap, "data-flash", f > 0.26 || (f > 0.12 && f < 0.18) ? "" : null); // a lightning flicker: two flashes
      const sk = S[SHAKE]! > 0 ? ((S[SHAKE]! * 30) | 0) % 3 - 1 : 0;
      sk ? L.style(wrap, "--sx", SH[sk * 2 + 4]!) : L.unstyle(wrap, "--sx");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function bolt(x0: number, y0: number, x1: number, y1: number, o: number, c: string) {
    g.fillStyle = c;
    for (let i = 0; i < 4; i++) {
      const a = i / 4, b = (i + 1) / 4, ka = i ? ZK[o + i]! : 0, kb = i < 3 ? ZK[o + i + 1]! : 0;
      for (let q = 0; q <= 8; q++) {
        const u = a + ((b - a) * q) / 8, k = ka + ((kb - ka) * q) / 8;
        g.fillRect(round(x0 + (x1 - x0) * u + k), round(y0 + (y1 - y0) * u - k * 0.5), 1, 1);
      }
    }
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    // The thunderclap: a bolt out of the sky onto KRUNCH.
    if (S[FLASH]! > 0) for (let o = 0; o < 2; o++) bolt(kx() + 6 - o * 9, 0, kx(), FL - 26, o * 8, o ? C.sys : C.ink);
    // KRUNCH: wind-up, guard, hit, down. Red with rage; redder each round.
    const ko = S[KO]! >= 0, x = kx(), body = ko ? 3 : S[WIND]! > 0 || S[GUARD] ? 1 : S[KF]! > 0 ? 2 : 0;
    const pal = S[KF]! > 0.15 ? 4 : S[ROUND]! > 2 ? 3 : 2;
    art.draw(g, "body", body, x, FL, 0, 1, pal);
    art.draw(g, "head", ko || S[KF]! > 0 ? 2 : 4 * +(S[WIND]! > 0), x, FL + HEAD_Y[body]!, 0, 1, pal);
    if (ko) {
      g.fillStyle = C.hurt;
      for (let s = 0; s < 3; s++) {
        const a = S[KO]! * 6 + s * 2.09, sx = round(x + cos(a) * 9), sy = round(FL - 25 + sin(a) * 2);
        g.fillRect(sx - 1, sy, 3, 1);
        g.fillRect(sx, sy - 1, 1, 3);
      }
    }
    if (S[WIND]! > 0) (g.fillStyle = C.line), g.fillRect(round(x) - 5, FL - 36, 10, 6), (g.fillStyle = C.muted), g.fillRect(round(x) - 4, FL - 35, 7, 3);
    // BRONT: hammer up, or the throw; flashes when hit.
    const thr = S[HM] || S[THROW]! > 0 ? 1 : 0;
    art.draw(g, "bront", thr, BX0, FL, 0, 1, S[GF]! > 0.15 ? 4 : 0);
    if (!S[HM]) art.draw(g, "maul", 0, thr ? BX0 + 13 : handX(), thr ? FL - 16 : handY() - 2, thr ? 1.57 : 0, 1);
    // Pips.
    for (let s = 0; s < 2; s++) {
      const m = s ? S[KM]! : 3, h = s ? S[KP]! : S[GP]!, x0 = round((s ? x : BX0) - m * 2);
      g.fillStyle = C.rim;
      g.fillRect(x0 - 1, s ? FL - 41 : FL - 32, m * 4 + 1, 4);
      for (let k = 0; k < m; k++) (g.fillStyle = k < h ? (s ? C.attack : C.sys) : C.line), g.fillRect(x0 + k * 4, s ? FL - 40 : FL - 31, 3, 2);
    }
    // The boulder.
    if (S[BON]! > 0) {
      const bx = round(S[BX]!), by = round(S[BY]!);
      g.fillStyle = C.rim;
      g.fillRect(bx - 4, by - 3, 9, 7);
      g.fillStyle = C.muted;
      g.fillRect(bx - 3, by - 2, 7, 5);
      g.fillStyle = C.line;
      g.fillRect(bx - 1, by, 4, 2);
    }
    // The hammer in flight: a crackle off it, then the spinning maul.
    if (S[HM]) {
      const hx = S[HX]!, hy = S[HY]!;
      bolt(hx, hy, hx - S[VX]! * 0.06, hy - S[VY]! * 0.06, 0, C.sys);
      bolt(hx, hy, hx + ZK[3]! * 2, hy + ZK[5]! * 2, 8, C.ink);
      art.draw(g, "maul", 0, hx, hy, round(S[SPIN]! / 1.5708) * 1.5708, 1);
    }
    for (let i = 0; i < sn; i++) (g.fillStyle = BITC[SC[i]!]!), g.fillRect(round(SX[i]!), round(SY[i]!), 1 + (SC[i]! >> 1), 1 + (SC[i]! >> 1));
    if (S[WT]! < 1.1) shout(g, WORDS[S[WORD]!]!, S[WX]!, S[WY]! - (S[WT]! < 0.05 ? 2 : 0), S[WT]! < 0.05 ? 3 : 2, S[WORD]! > 5 ? C.ink : C.hurt, S[WORD] === 3 ? C.muted : C.attack);
  }

  engine.start();
  return {
    engine,
    throwAt,
    get round() {
      return S[ROUND]!;
    },
    /** Pips left: [BRONT's, KRUNCH's]. */
    get pips() {
      return [S[GP]!, S[KP]!];
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the first hammer crackling across the panel at KRUNCH (scripts/gallery-posters.mjs draws it). */
export const posterAt = 0.78;

/** For `slot(fig, () => import("./storm-god-hammer-fights-giant").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => hammer(stage, slot, first);
