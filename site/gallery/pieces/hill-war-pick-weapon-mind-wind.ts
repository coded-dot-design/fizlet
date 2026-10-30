// Hill war: two critters on two hills at night, BEAN and PEBBLE, take turns lobbing shells across
// a valley with a NO BALL GAMES sign in it. Pick a weapon chip (the page's own buttons): BALL, a
// CLUSTER that splits in five over the target, a BOUNCY that hops three times before it goes off,
// or the MEGA bomb (once a round). Tap where it should land; the wind (new every turn) pushes it
// off, so the next one is aimed upwind. Every blast chunks a crater out of the hill (a heightmap:
// what stood on it drops), throws dirt, fire and smoke, and knocks the sign's words off their
// board. A critter at zero loses; the hills grow back, the words fly home. Left alone it plays one
// duel with a winner drawn at random, then waits for your turn, asleep.
// Bricks: the kernel (fixed step; settle, holding with busy() while anything flies or a turn is
// scheduled; the ledger for every page write, so Recall gives the page back byte for byte).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, shout, print, textW } from "./ink";
import { art, booms, disc } from "./lob";

export type HillScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly hp: number[]; readonly turn: number; readonly mode: number; readonly wind: number; readonly winner: number; readonly dug: number };

const { abs, cos, sin, hypot, max, min, round, sqrt } = Math;
const W = 160, H = 90, G = 120, SH = 10;
// Modes: a turn (waiting for its shot), shells in the air, a win, the hills growing back.
const TURN = 0, FLY = 1, OVER = 2, MEND = 3;
// State slots.
const MODE = 0, T = 1, WHO = 2, WIND = 3, SEL = 4, AUTO = 5, LOSER = 6, TURNS = 7, WIN = 8, DIRTY = 9, FR = 10;
const WORD = 11, WT = 12, WX = 13, WY = 14, MX = 15, MY = 16, MT = 17, DUG = 18;
// Per critter (0 BEAN, 1 PEBBLE), at 20 + team * 8.
const CX = 0, CY = 1, CVX = 2, CVY = 3, HP = 4, HURT = 5, MEGA = 6;
const HX = [24, 136], DIR = [1, -1];
// Weapons: flight time base, crater radius, damage, blast power.
const BALL = 0, CLUSTER = 1, BOUNCY = 2, MEGA_ = 3, BIT = 4;
const FT = [0.9, 0.95, 0.8, 1.4, 0], RAD = [6, 4, 7, 13, 3.5], DMG = [34, 0, 38, 75, 14], POW = [2, 1, 2, 3, 1];
const WORDS = ["BOOM!", "KABOOM!", "MISS", "BEAN WINS!", "PEBBLE WINS!", "OUCH!", "SPLIT!", "BOING"];
const PX = Array.from({ length: 201 }, (_, i) => `${(i - 100) * 0.625}cqw`);
const RS = Array.from({ length: 121 }, (_, i) => `${i - 60}deg`);
// The hills as they grow: two humps and a valley (y of the surface per column).
const HT0 = Float32Array.from({ length: W }, (_, x) => 84 - 34 * max(0, 1 - ((x - 24) / 30) ** 2) - 34 * max(0, 1 - ((x - 136) / 30) ** 2) - 2 * sin(x * 0.4));

const BEAN = ["..ll....", "...l....", ".bbbbbb.", "bbwkbwkb", "bbbbbbbb", "bbbmmbbb", ".bbbbbb.", ".f....f."];
const PEB = ["....a...", "...aa...", ".pppppp.", "ppwkpwkp", "pppppppp", "ppqqqqpp", ".pppppp.", ".f....f."];

export function hills(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): HillScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 4294967295) >>> 0 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const HT = HT0.slice(), BURN = new Float32Array(W);
  const ground = (x: number) => HT[max(0, min(W - 1, round(x)))]!;
  const fx = booms(300, W, H, ground, rnd, C.base);
  const look = [
    [art(BEAN, { l: C.go, b: C.go, w: C.ink, k: C.rim, m: C.attack, f: C.rim }), art(BEAN.map((r, i) => (i === 3 ? "bbkkbkkb" : r)), { l: C.go, b: C.aim, k: C.rim, m: C.attack, f: C.rim })],
    [art(PEB, { a: C.hurt, p: C.muted, w: C.ink, k: C.rim, q: C.cmd, f: C.rim }, 1), art(PEB.map((r, i) => (i === 3 ? "ppkkpkkp" : r)), { a: C.hurt, p: C.aim, k: C.rim, q: C.cmd, f: C.rim }, 1)],
  ];
  const S = new Float64Array(40);
  const M = (t: number) => 20 + t * 8;
  for (let t = 0; t < 2; t++) (S[M(t) + CX] = HX[t]!), (S[M(t) + CY] = ground(HX[t]!)), (S[M(t) + HP] = 100);
  S[DIRTY] = 1;
  S[WT] = S[MT] = 9;
  S[WIN] = -1;
  S[AUTO] = first ? 0 : 1;
  S[LOSER] = rnd() < 0.5 ? 0 : 1;
  S[WHO] = S[LOSER]!;
  S[T] = -0.6;
  S[WIND] = round((rnd() - 0.5) * 40);

  // The page: the weapon chips and the sign's words (boxes in art px, from their own --l/--t/--w/--h).
  const wrap = slot.querySelector<HTMLElement>(".hwar")!, els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const num = (el: HTMLElement, p: string) => parseFloat(el.style.getPropertyValue(p));
  const EX = els.map((e) => num(e, "--l")), EY = els.map((e) => num(e, "--t")), EW = els.map((e) => num(e, "--w")), EH = els.map((e) => num(e, "--h"));
  const OX = new Float32Array(n), OY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), RO = new Float32Array(n), VR = new Float32Array(n);
  const OUT = new Uint8Array(n), LIT = new Float32Array(n), LX = new Int16Array(n), LY = new Int16Array(n), LR = new Int16Array(n), LS = new Int8Array(n).fill(-1);
  // Shells: where, how fast, which weapon, bounces left, age, flight time.
  const BX = new Float32Array(SH), BY = new Float32Array(SH), BVX = new Float32Array(SH), BVY = new Float32Array(SH), BK = new Int8Array(SH).fill(-1), BN = new Uint8Array(SH), BA = new Float32Array(SH), BF = new Float32Array(SH);

  L.style(stage, "touch-action", "manipulation");
  // A tap on a chip picks the weapon; anywhere else, on your turn, it fires there.
  function tap(x: number, y: number) {
    S[AUTO] = 0;
    engine.wake();
    for (let i = 0; i < 4; i++) if (x >= EX[i]! && x <= EX[i]! + EW[i]! && y >= EY[i]! - 1 && y <= EY[i]! + EH[i]! + 1) return void ((i !== MEGA_ || !S[M(0) + MEGA]) && (S[SEL] = i));
    if (S[MODE] === TURN && S[WHO] === 0 && S[T]! > 0) shoot(0, S[SEL]!, x, y), (S[MX] = x), (S[MY] = y), (S[MT] = 0);
  }
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Team t fires weapon k at (x, y): the arc lands there with no wind (the wind is yours to read). */
  function shoot(t: number, k: number, x: number, y: number) {
    const m = M(t), x0 = S[m + CX]! + DIR[t]! * 4, y0 = S[m + CY]! - 8, f = FT[k]! + abs(x - x0) * 0.004;
    if (k === MEGA_) {
      if (S[m + MEGA]) k = BALL;
      S[m + MEGA] = 1;
    }
    BX[0] = x0;
    BY[0] = y0;
    BVX[0] = (x - x0) / f;
    BVY[0] = (y - y0 - 0.5 * G * f * f) / f;
    BK[0] = k;
    BN[0] = k === BOUNCY ? 3 : 0;
    BA[0] = 0;
    BF[0] = f;
    S[MODE] = FLY;
    S[T] = 0;
    if (!t && k === MEGA_) S[SEL] = BALL;
    fx.puff(x0, y0, 3);
  }

  /** The other side's turn: it reads the wind (well or badly) and aims at the critter. */
  function ai(t: number) {
    const o = M(1 - t), win = S[AUTO] && t !== S[LOSER], n = S[TURNS]!;
    const k = win && n > 3 && !S[M(t) + MEGA] ? MEGA_ : rnd() < 0.25 ? CLUSTER : rnd() < 0.3 ? BOUNCY : BALL;
    const f = FT[k]! + abs(S[o + CX]! - S[M(t) + CX]!) * 0.004, a = S[WIND]!, err = S[AUTO] ? (win ? 1 : 12 + rnd() * 6) : 3 + rnd() * 10;
    // Upwind by what the wind will do over the flight (vx·f + ½·a·f²), give or take the error.
    shoot(t, k, S[o + CX]! - 0.5 * a * f * f * (k === BOUNCY ? 0.5 : 1) + (rnd() - 0.5) * 2 * err, S[o + CY]! - 3);
  }

  function say(w: number, x: number, y: number) {
    const hw = textW(WORDS[w]!, 2) / 2 + 2;
    S[WORD] = w;
    S[WT] = 0;
    S[WX] = max(hw, min(W - hw, x));
    S[WY] = max(12, min(70, y));
  }

  /** Weapon k goes off at (x, y): the crater, the blast, the critters and the sign's words. */
  function burst(x: number, y: number, k: number) {
    const r = RAD[k]!;
    fx.blast(x, y, POW[k]!);
    for (let c = max(0, round(x - r)); c <= min(W - 1, round(x + r)); c++) {
      const d = sqrt(max(0, r * r - (c - x) ** 2)), b = min(H - 2, y + d);
      if (b > HT[c]!) (S[DUG] = S[DUG]! + b - HT[c]!), (HT[c] = b), (BURN[c] = 1);
    }
    for (let t = 0; t < 2; t++) {
      const m = M(t), dx = S[m + CX]! - x, dy = S[m + CY]! - 4 - y, d = hypot(dx, dy), reach = r + 6;
      if (d >= reach) continue;
      S[m + CVX] = S[m + CVX]! + (dx / (d + 1)) * POW[k]! * 16;
      S[m + CVY] = -40 * POW[k]!;
      hit(t, DMG[k]! * (1 - (d / reach) * 0.6));
    }
    for (let i = 4; i < n; i++) {
      const cx = EX[i]! + OX[i]! + EW[i]! / 2, cy = EY[i]! + OY[i]! + EH[i]! / 2, dx = cx - x, dy = cy - y, d = hypot(dx, dy) + 1;
      if (d < r * 2.5 + 6) knock(i, (dx / d) * 90, (dy / d) * 60 - 70);
    }
    if (S[WT]! > 0.5 && S[WORD]! < 3) say(k === MEGA_ ? 1 : k === BIT ? 6 : 0, x, y - 14);
  }

  function hit(t: number, d: number) {
    const m = M(t);
    if (S[MODE]! > FLY || S[m + HP]! <= 0) return;
    S[m + HP] = max(0, round(S[m + HP]! - d));
    S[m + HURT] = 0.7;
    if (S[m + HP]! > 0) return say(5, S[m + CX]!, S[m + CY]! - 16);
    S[MODE] = OVER;
    S[T] = 0;
    S[WIN] = 1 - t;
    S[m + CVY] = -130;
    S[m + CVX] = -DIR[t]! * 40;
    say(4 - t, 80, 30);
  }

  /** A word knocked off the sign: it flies, spins and lands in the valley. */
  function knock(i: number, vx: number, vy: number) {
    OUT[i] = 1;
    VX[i] = VX[i]! + vx;
    VY[i] = VY[i]! + vy;
    VR[i] = VR[i]! + (rnd() - 0.5) * 700;
    LIT[i] = 0.3;
  }

  engine.add({
    step(e, dt) {
      const mode = S[MODE]!, t = (S[T] = S[T]! + dt);
      // mv: something still moves (the turn passes once nothing does).
      let mv = false;
      S[FR] = S[FR]! + 1;
      fx.wind = S[WIND]!;
      // A turn: the AI's after a beat; yours waits for your tap (and the engine sleeps).
      if (mode === TURN && t > 0.5 && (S[AUTO] || S[WHO] === 1)) ai(S[WHO]!);
      // Shells: gravity and wind; a cluster splits over the top; a bouncy hops; the rest go off.
      let flying = 0;
      for (let s = 0; s < SH; s++) {
        const k = BK[s]!;
        if (k < 0) continue;
        flying++;
        BA[s] = BA[s]! + dt;
        BVY[s] = BVY[s]! + G * dt;
        BVX[s] = BVX[s]! + S[WIND]! * dt;
        const x = (BX[s] = BX[s]! + BVX[s]! * dt), y = (BY[s] = BY[s]! + BVY[s]! * dt);
        if (k === CLUSTER && BA[s]! > BF[s]! * 0.55) {
          BK[s] = -1;
          for (let j = 0, q = 0; j < SH && q < 5; j++)
            if (BK[j]! < 0) (BX[j] = x), (BY[j] = y), (BVX[j] = BVX[s]! + (q - 2) * 16), (BVY[j] = BVY[s]! - 10 + abs(q - 2) * 6), (BK[j] = BIT), (BA[j] = 0), q++;
          fx.puff(x, y, 3);
          say(6, x, y - 10);
          continue;
        }
        if (x < -12 || x > W + 12 || y > H + 4) {
          BK[s] = -1;
          if (S[WT]! > 0.6) say(2, max(10, min(W - 10, x)), 40);
          continue;
        }
        let boom = y >= ground(x);
        for (let q = 0; q < 2; q++) if (abs(x - S[M(q) + CX]!) < 4 && y > S[M(q) + CY]! - 8 && y < S[M(q) + CY]! + 1 && BA[s]! > 0.15) boom = true, BN[s] = 0;
        for (let i = 4; i < n; i++)
          if (!OUT[i] && x >= EX[i]! && x <= EX[i]! + EW[i]! && y >= EY[i]! && y <= EY[i]! + EH[i]!) knock(i, BVX[s]! * 0.5, -40), (boom = true);
        if (!boom) continue;
        if (BN[s]) {
          // BOING: back up off the ground, a little less each time.
          BN[s] = BN[s]! - 1;
          BY[s] = min(y, ground(x)) - 1;
          BVY[s] = -abs(BVY[s]!) * 0.62;
          BVX[s] = BVX[s]! * 0.8;
          fx.puff(x, BY[s]!, 2);
          if (S[WT]! > 0.4) say(7, x, y - 10);
          continue;
        }
        BK[s] = -1;
        burst(x, min(y, ground(x)), k);
      }
      // Critters: knocked about, they slide and fall onto what is left of the hill (a long drop hurts).
      for (let q = 0; q < 2; q++) {
        const m = M(q), ko = mode === OVER && S[WIN] !== q;
        if (S[m + HURT]! > 0) (S[m + HURT] = S[m + HURT]! - dt), (mv = true);
        if (mode === MEND) {
          const dx = HX[q]! - S[m + CX]!, dy = HT[HX[q]!]! - S[m + CY]!, d = hypot(dx, dy);
          if (d > 0.5) (S[m + CX] = S[m + CX]! + (dx / d) * min(d, 60 * dt)), (S[m + CY] = S[m + CY]! + (dy / d) * min(d, 60 * dt)), (mv = true);
          else (S[m + CX] = HX[q]!), (S[m + CY] = HT[HX[q]!]!), (S[m + CVX] = S[m + CVY] = 0);
          continue;
        }
        const x = S[m + CX]!, top = ko ? H + 30 : ground(x);
        if (ko && S[m + CY]! > H + 20) continue;
        if (S[m + CY]! < top - 0.01 || S[m + CVY]! < 0 || S[m + CVX]) {
          S[m + CVY] = S[m + CVY]! + 260 * dt;
          S[m + CX] = max(6, min(W - 6, x + S[m + CVX]! * dt));
          S[m + CY] = S[m + CY]! + S[m + CVY]! * dt;
          const f = ground(S[m + CX]!);
          if (!ko && S[m + CY]! >= f) {
            if (S[m + CVY]! > 130) hit(q, 10), fx.puff(S[m + CX]!, f, 3);
            S[m + CY] = f;
            S[m + CVY] = 0;
            S[m + CVX] = abs(S[m + CVX]!) < 4 ? 0 : S[m + CVX]! * 0.6;
          }
          mv = true;
        }
      }
      // The sign's words: off the board they fly, spin, land and lie in the valley.
      for (let i = 4; i < n; i++) {
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (mv = true);
        if (mode === MEND) {
          const d = hypot(OX[i]!, OY[i]!) + abs(RO[i]!);
          if (d > 0.4) (OX[i] = OX[i]! * (1 - 6 * dt)), (OY[i] = OY[i]! * (1 - 6 * dt)), (RO[i] = RO[i]! * (1 - 6 * dt)), (mv = true);
          else OX[i] = OY[i] = RO[i] = VX[i] = VY[i] = VR[i] = OUT[i] = 0;
          continue;
        }
        if (!OUT[i] || (!VX[i] && !VY[i] && !VR[i])) continue;
        mv = true;
        VY[i] = VY[i]! + 300 * dt;
        OX[i] = OX[i]! + VX[i]! * dt;
        OY[i] = OY[i]! + VY[i]! * dt;
        RO[i] = RO[i]! + VR[i]! * dt;
        const x = EX[i]! + OX[i]! + EW[i]! / 2, b = EY[i]! + OY[i]! + EH[i]!;
        if (x < 2 || x > W - 2) VX[i] = -VX[i]!, OX[i] = max(2, min(W - 2, x)) - EX[i]! - EW[i]! / 2;
        if (b > ground(x)) {
          OY[i] = ground(x) - EY[i]! - EH[i]!;
          if (VY[i]! > 60) (VY[i] = -VY[i]! * 0.3), (VX[i] = VX[i]! * 0.5), (VR[i] = VR[i]! * 0.5);
          else VX[i] = VY[i] = VR[i] = 0;
        }
      }
      if (flying) mv = true;
      const fxl = fx.step(dt);
      // The hills grow back (and cool) when the round is done.
      if (mode === MEND)
        for (let c = 0; c < W; c++) {
          if (HT[c]! > HT0[c]!) (HT[c] = max(HT0[c]!, HT[c]! - 30 * dt)), (mv = true);
          BURN[c] = 0;
        }
      // Everything down: the next turn, with a new wind; a win: the banner, then the hills grow back.
      if (mode === FLY && !mv && t > 0.6) {
        S[MODE] = TURN;
        S[T] = 0;
        S[WHO] = 1 - S[WHO]!;
        S[WIND] = round((rnd() - 0.5) * 40);
        S[TURNS] = S[TURNS]! + 1;
        if (S[AUTO] && S[TURNS]! > 14) (S[MODE] = MEND), (S[AUTO] = 0);
      }
      if (mode === OVER && t > 2.4) (S[MODE] = MEND), (S[T] = 0), (BK.fill(-1));
      if (mode === MEND && !mv && !fxl && t > 0.5) {
        S[MODE] = TURN;
        S[T] = 0;
        S[WHO] = S[TURNS] = S[DUG] = S[AUTO] = 0;
        S[WIN] = -1;
        for (let q = 0; q < 2; q++) (S[M(q) + HP] = 100), (S[M(q) + MEGA] = 0);
      }
      let busy = mv || fxl || mode !== TURN || S[AUTO]! > 0 || S[WHO] === 1 || t < 0;
      if (S[WT]! < 1.5) (S[WT] = S[WT]! + dt), (busy = true);
      if (S[MT]! < 0.8) (S[MT] = S[MT]! + dt), (busy = true);
      if (busy) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        if (i < 4) {
          // The chips: the one picked, and the MEGA once it is spent.
          const s = (S[SEL] === i ? 1 : 0) + (i === MEGA_ && S[M(0) + MEGA] ? 2 : 0);
          if (s !== LS[i]) (LS[i] = s), L.attr(el, "data-on", s & 1 ? "" : null), L.attr(el, "data-spent", s & 2 ? "" : null);
          continue;
        }
        const x = max(-100, min(100, round(OX[i]!))), y = max(-100, min(100, round(OY[i]!))), r = max(-60, min(60, round(((RO[i]! % 360) + 540) % 360) - 180)), lt = LIT[i]! > 0 ? 1 : 0;
        if (x !== LX[i]) (LX[i] = x), x ? L.style(el, "--x", PX[x + 100]!) : L.unstyle(el, "--x");
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", PX[y + 100]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", RS[r + 60]!) : L.unstyle(el, "--r");
        if (lt !== LS[i]) (LS[i] = lt), L.attr(el, "data-hit", lt ? "" : null);
      }
      const sx = fx.jolt(S[FR]!);
      if (sx) L.style(wrap, "--sx", PX[sx + 100]!), L.style(wrap, "--sy", PX[((S[FR]! >> 1) & 1 ? 1 : -1) * min(2, abs(sx)) + 100]!);
      else L.unstyle(wrap, "--sx"), L.unstyle(wrap, "--sy");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    g.clearRect(0, 0, W, H);
    // The moon and a few stars.
    g.fillStyle = C.line;
    for (let i = 0; i < 14; i++) g.fillRect((i * 53 + 11) % W, 14 + ((i * 29) % 34), 1, 1);
    g.fillStyle = C.ink;
    disc(g, 56, 22, 5);
    g.fillStyle = "#120e26";
    disc(g, 59, 20, 4);
    // The sign's post (its board is the page's).
    g.fillStyle = C.rim;
    g.fillRect(79, 57, 2, 30);
    // The hills: grass, dirt, deep dirt; a crater's edge scorched.
    for (let x = 0; x < W; x++) {
      const y = round(HT[x]!);
      g.fillStyle = C.base;
      g.fillRect(x, y, 1, H - y);
      g.fillStyle = C.line;
      g.fillRect(x, max(y + 4, round(HT0[x]!) + 9), 1, H);
      g.fillStyle = BURN[x] ? C.rim : y > HT0[x]! + 0.5 ? C.cmd : C.go;
      g.fillRect(x, y, 1, 1);
    }
    // The wind: a sock on each hilltop and the meter by the hint.
    const w = S[WIND]!, wn = round(abs(w) / 7);
    print(g, "WIND", 124, 15, C.muted);
    g.fillStyle = w ? C.sys : C.line;
    // An arrow from the middle of the meter, as long as the wind is strong, pointing where it blows.
    const d = w < 0 ? -1 : 1, e = 147 + d * wn * 3;
    g.fillRect(min(147, e), 17, abs(e - 147) + 1, 1);
    if (wn) g.fillRect(e - d, 15, 1, 5), g.fillRect(e - d * 2, 16, 1, 3);
    else g.fillRect(146, 16, 3, 3);
    // The critters (a KO'd one tumbles away), each with its health bar; a marker over the one up.
    for (let q = 0; q < 2; q++) {
      const m = M(q), x = round(S[m + CX]!), y = round(S[m + CY]!), ko = S[MODE] === OVER && S[WIN] !== q, img = look[q]![S[m + HURT]! > 0 || ko ? 1 : 0]!;
      if (ko) g.save(), g.translate(x, y - 5), g.rotate(S[T]! * 8 * DIR[q]!), g.drawImage(img, -5, -5), g.restore();
      else g.drawImage(img, x - 5, y - 9);
      g.fillStyle = C.rim;
      g.fillRect(x - 6, y - 15, 12, 3);
      g.fillStyle = S[m + HP]! > 35 ? C.go : C.red;
      g.fillRect(x - 5, y - 14, round(S[m + HP]! / 10), 1);
      if (S[MODE] === TURN && S[WHO] === q && S[T]! > 0) (g.fillStyle = C.hurt), g.fillRect(x - 1, y - 20, 3, 2), g.fillRect(x, y - 18, 1, 1);
      print(g, q ? "PEBBLE" : "BEAN", q ? W - 26 : 3, 84, q ? C.muted : C.go);
    }
    // Shells: round and dark with a lit edge; the mega a big one with a fizzing fuse.
    for (let s = 0; s < SH; s++) {
      const k = BK[s]!;
      if (k < 0) continue;
      const x = round(BX[s]!), y = round(BY[s]!);
      g.fillStyle = C.rim;
      disc(g, x, y, k === MEGA_ ? 3 : k === BIT ? 0 : 1);
      g.fillStyle = k === BOUNCY ? C.go : k === CLUSTER || k === BIT ? C.attack : C.muted;
      g.fillRect(x - (k === MEGA_ ? 1 : 0), y - (k === MEGA_ ? 1 : 0), 1, 1);
      if (k === MEGA_) (g.fillStyle = S[FR]! & 2 ? C.hurt : C.ink), g.fillRect(x + 2, y - 4, 1, 1);
    }
    // Where you aimed (the wind is why it lands elsewhere).
    if (S[MT]! < 0.8) {
      g.fillStyle = C.hurt;
      const x = round(S[MX]!), y = round(S[MY]!);
      g.fillRect(x - 3, y, 2, 1), g.fillRect(x + 2, y, 2, 1), g.fillRect(x, y - 3, 1, 2), g.fillRect(x, y + 2, 1, 2);
    }
    fx.draw(g, 0);
    const wt = S[WT]!, wd = S[WORD]!, big = wd === 3 || wd === 4;
    if (wt < (big ? 1.5 : 0.8)) shout(g, WORDS[wd]!, S[WX]!, S[WY]! - (wt < 0.05 ? 2 : 0), wt < 0.05 || big || wd === 1 ? 2 : 1, big ? C.ink : C.hurt, wd === 3 ? "#1aa66c" : C.attack);
  }

  engine.start();
  return {
    engine,
    tap,
    get hp() {
      return [S[M(0) + HP]!, S[M(1) + HP]!];
    },
    get turn() {
      return S[WHO]!;
    },
    get mode() {
      return S[MODE]!;
    },
    get wind() {
      return S[WIND]!;
    },
    get winner() {
      return S[WIN]!;
    },
    get dug() {
      return S[DUG]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the first shell over the valley. */
export const posterAt = 1.5;

/** For `slot(fig, () => import("./hill-war-pick-weapon-mind-wind").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => hills(stage, slot, first);
