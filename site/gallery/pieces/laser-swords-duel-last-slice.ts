// THE LAST SLICE: a laser-sword duel at the Starport 9 Halloween bake sale, over the last pumpkin pie.
// NANA NOVA (a bun, round glasses, a mint cardigan, a gold blade) against DUKE DUSK (a violet
// pompadour, a monocle, a pink cape, a violet blade). Every play rolls a new duel from the engine's
// seeded random (seeded once from Math.random at mount): who moves, which move, who parries, so who
// wins. The page's own price cards are the ground: the duelists leap from block to block (each one
// dips when it takes a landing), a palm shove flings the other into a card or the wall, blades lock
// in a shower of sparks, and a miss scorches the headline's letters where the blade passes. A
// pumpkin drone drifts in now and then and fires; a parried bolt ricochets off the real cards and
// letters (and sometimes into the other duelist). Click a duelist: a surge (a longer blade, double
// hits, the next move); click anywhere else: a drone there. A KO, the winner eats the pie, a sequel
// tease; the letters mend and it sleeps. Click again for a rematch: a different duel.
// Bricks: the kernel (fixed step, settle, seeded random; its ledger for every page write, so Recall
// gives the page back byte for byte) and @fzlt/core/sprite (both duelists, the pie and the drone).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { bubble, C, shout, textW } from "./pixel-type";
import { facing, pageBoxes, sparkPool } from "./fight-page";

export type SliceScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  /** A click on the stage, in art pixels (160 × 90). */
  tap(x: number, y: number): void;
  /** -1 while dueling, 0 NANA, 1 DUKE. */
  readonly winner: number;
  /** Every move so far, one letter each (s strike, h shove, l leap, d drone, k clash, r ricochet). */
  readonly log: string;
  readonly hp: number[];
  /** True once the duel, the pie, the tease and the mending are done. */
  readonly over: boolean;
  /** Per page box (letters, then the three cards): 1 once anything has reached it. */
  readonly hits: Uint8Array;
  /** Surge seconds left: [NANA, DUKE]. */
  readonly surge: number[];
  /** A drone is out. */
  readonly drone: boolean;
};

const { abs, cos, max, min, round, sign, sin } = Math;
const W = 160, FL = 82, HP0 = 4, G = 420;
// NANA (faces right): h hair, f skin, g glasses, t mouth, c cardigan, b buttons, s skirt, l stockings, k shoes.
const NANA = [
  "...hhh",
  "..hhhhh",
  ".hhhffff",
  ".hhfgfgf",
  ".hhffffff",
  "..hfftff",
  "...ffff",
  "..ccccccc",
  ".cccbccccf",
  ".ccccccc",
  ".cccbccc",
  ".ccccccc",
  ".sssssss",
  ".sssssss",
  "..ll.ll",
  "..ll.ll",
  ".kkk.kkk",
];
// DUKE (faces right): p pompadour, f skin, o monocle, m moustache, w collar, r cape, u suit, y belt, k boots.
const DUKE = [
  "....pppp",
  "...pppppppp",
  "..ppppppppp",
  "...pfffff",
  "...ffofffo",
  "...ffffff",
  "...fmmmmf",
  "....ffff",
  "..rwwwwwwf",
  ".rruuuuuu",
  ".rruuuuuuu",
  ".rruuuuuu",
  ".rruyyyyu",
  ".rruuuuuu",
  "rrruuuuuu",
  "rrr.uu.uu",
  "rrr.uu.uu",
  "rr..uu.uu",
  "....uu.uu",
  "...kkk.kkk",
];
const CAST = {
  nana: { frames: facing([NANA], 11, 4), colors: { h: C.muted, f: C.aim, g: C.sys, t: C.attack, c: C.go, b: C.ink, s: C.cmd, l: C.muted, k: C.line }, outline: C.rim, ax: 6, ay: 17 },
  duke: { frames: facing([DUKE], 13, 6), colors: { p: C.cmd, f: C.muted, o: C.hurt, m: C.line, w: C.ink, r: C.attack, u: C.base, y: C.hurt, k: C.line }, outline: C.rim, ax: 6, ay: 20 },
  pie: { frames: [["..ffff..", ".ffffff.", "cccccccc", ".cccccc."]], colors: { f: C.aim, c: C.hurt }, outline: C.rim },
  drone: { frames: [["mmm.mmm", "...k...", ".ooooo.", "ooeoeoo", "ooooooo", "oeeeeeo", ".ooooo."]], colors: { m: C.muted, k: C.line, o: C.hurt, e: C.rim }, outline: C.rim },
};
const PAL: Record<string, string>[] = [{}, { "*": C.ink }];
const BLADE = [C.hurt, C.cmd];
const WORDS = ["DUEL!", "KSSH!", "VWOM", "ZAP!", "TSING!", "SHOO!", "BEGONE!", "SLAM!", "SURGE!", "NOM", "KO!"];
// Duelist slots (two each): x, feet y, vx, vy, hp, phase, timer, facing, flash, surge, move.
const FX = 0, FY = 2, VX = 4, VY = 6, HP = 8, PH = 10, T = 12, D = 14, FLS = 16, SG = 18, MV = 20;
const GAP = 22, WIN = 23, END = 24, FORCE = 25, WORD = 26, WT = 27, WX = 28, HEAL = 29, OVER = 30, Q = 31, QX = 32, QY = 33, DIRTY = 34;
const DRT = 35, DRX = 36, DRY = 37, DRN = 38, DRC = 39, PIE = 40, WAVE = 41, WVX = 42, WVD = 43;
const IDLE = 0, WALK = 1, JUMP = 2, WIND = 3, STRIKE = 4, CLASH = 5, SHOVE = 6, HURT = 7, DOWN = 8;
// Each phase's blade angle (radians from straight ahead; negative is up).
const ANGLE = [-1, -0.6, -1.7, -2.4, 0.35, -0.75, -1.4, -2.1, 0];
const NB = 8;

export function lastSlice(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SliceScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 || 1 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = 90;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites(CAST, { palettes: PAL });
  const wrap = slot.querySelector<HTMLElement>(".ld")!;
  const letters = [...wrap.querySelectorAll<HTMLElement>(".ld-t i[data-c]")], NL = letters.length;
  const page = pageBoxes(engine, wrap, [...letters, ...wrap.querySelectorAll<HTMLElement>(".ld-c")], W);
  const HIT = new Uint8Array(page.n);
  const fx = sparkPool(rnd, 72, [C.ink, C.hurt, C.attack, C.cmd, C.sys, C.go]);
  const S = new Float64Array(44);
  const BX = new Float32Array(NB), BY = new Float32Array(NB), BVX = new Float32Array(NB), BVY = new Float32Array(NB), BT = new Float32Array(NB), BK = new Uint8Array(NB);
  let log = "";

  function bout() {
    for (let f = 0; f < 2; f++) {
      S[FX + f] = f ? 124 : 36;
      S[FY + f] = FL;
      S[VX + f] = S[VY + f] = S[PH + f] = S[FLS + f] = S[SG + f] = S[MV + f] = 0;
      S[HP + f] = HP0;
      S[D + f] = f ? -1 : 1;
    }
    S[GAP] = 0.9;
    S[WIN] = S[END] = -1;
    S[OVER] = S[FORCE] = S[DRT] = S[PIE] = S[WAVE] = 0;
    BT.fill(0);
    for (let i = 0; i < page.n; i++) page.CUT[i] = 0;
    say(0, 80);
  }
  function say(w: number, x: number) {
    const h = textW(WORDS[w]!, 2) / 2 + 2;
    S[WORD] = w;
    S[WT] = 0;
    S[WX] = max(h, min(W - h, x));
  }
  /** The card tops (art px): index NL + 0..2. */
  const top = (c: number) => page.Y[NL + c]!;
  const hand = (f: number) => S[FY + f]! - (f ? 11 : 9);

  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * 90);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * 90);
  }, { signal: engine.signal });

  /** A click: on a duelist, a surge; anywhere else, a drone; after the KO, a rematch. */
  function clicked(x: number, y: number) {
    if (S[WIN]! >= 0) return S[END]! > 1 ? bout() : undefined;
    for (let f = 0; f < 2; f++)
      if (abs(x - S[FX + f]!) < 9 && y > S[FY + f]! - 26 && y < S[FY + f]! + 3) {
        S[SG + f] = 5;
        S[FORCE] = f + 1;
        fx.burst(S[FX + f]!, hand(f), 18, f ? 3 : 1, 90);
        return say(8, S[FX + f]!);
      }
    drone(x, min(y, 44));
  }
  function drone(x: number, y: number) {
    S[DRT] = 3;
    S[DRX] = max(8, min(W - 8, x));
    S[DRY] = max(8, y);
    S[DRN] = 3;
    S[DRC] = 0.5;
    log += "d";
  }

  /** Where f can land: the floor, or a card whose top is under x (the highest one f's feet clear). */
  function landing(f: number, y0: number, y1: number) {
    const x = S[FX + f]!;
    for (let c = 0; c < 3; c++) {
      const t = top(c), i = NL + c;
      if (x > page.X[i]! + 1 && x < page.X[i]! + page.BW[i]! - 1 && y0 <= t + 0.5 && y1 >= t) return c;
    }
    return y1 >= FL ? 3 : -1;
  }
  /** A ballistic leap onto (tx, ty); onto a card, it lands inside the card's span. */
  function leap(f: number, tx: number, ty: number) {
    const t = 0.55;
    for (let c = 0; c < 3; c++) if (abs(ty - top(c)) < 1) tx = max(page.X[NL + c]! + 4, min(page.X[NL + c]! + page.BW[NL + c]! - 4, tx));
    S[VX + f] = (tx - S[FX + f]!) / t;
    S[VY + f] = (ty - S[FY + f]! - 0.5 * G * t * t) / t;
    S[PH + f] = JUMP;
    log += "l";
  }

  /** The director: when both are free, someone moves. */
  function choose() {
    const a = S[FORCE]! ? S[FORCE]! - 1 : rnd() < 0.5 ? 0 : 1, d = 1 - a, r = rnd();
    S[FORCE] = 0;
    const dx = S[FX + d]! - S[FX + a]!, high = abs(S[FY + d]! - S[FY + a]!) > 4;
    S[MV + a] = 0;
    if (high && r < 0.8) {
      // Up (or down) onto the other's block, beside them: a leap, then the strike from the air.
      S[MV + a] = 1;
      return leap(a, S[FX + d]! - (sign(dx) || 1) * 14, S[FY + d]!);
    }
    if (r < 0.12 && !S[DRT]) return drone(20 + rnd() * 120, 10);
    if (r < 0.32) {
      // Somewhere else: a card or the floor, a hop across the page's own blocks.
      const c = (rnd() * 4) | 0, i = NL + c;
      return c > 2 ? leap(a, 20 + rnd() * 120, FL) : leap(a, page.X[i]! + page.BW[i]! * (0.25 + rnd() * 0.5), top(c));
    }
    if (r < 0.55 && abs(dx) < 70 && !high) {
      log += "h";
      S[PH + a] = SHOVE;
      S[T + a] = 0.35;
      return;
    }
    log += "s";
    S[PH + a] = WALK;
  }

  /** The swing: scorch what it passes, then a parry (blades lock), a dodge or a hit. */
  function strike(a: number) {
    const d = 1 - a, dir = S[D + a]!, x = S[FX + a]!, y = S[FY + a]!, len = S[SG + a]! > 0 ? 18 : 13;
    const x0 = dir > 0 ? x : x - len - 4;
    if (page.sweep(x0, y - 24, x0 + len + 4, y - 2, dir * 200, -80, dir > 0 ? 1 : 2)) mark(x0, y - 24, len + 4, y - 2);
    if (abs(S[FX + d]! - x) > len + 5 || abs(S[FY + d]! - y) > 8 || S[PH + d]! >= HURT) return say(2, x + dir * 10);
    const ready = S[PH + d]! < WIND;
    if (ready && rnd() < (S[SG + a]! > 0 ? 0.15 : 0.34)) {
      // Locked: the blades grind, sparks fly, then both are thrown apart.
      log += "k";
      S[PH + a] = S[PH + d] = CLASH;
      S[T + a] = S[T + d] = 0.55;
      return say(1, (x + S[FX + d]!) / 2);
    }
    hurt(d, S[SG + a]! > 0 ? 2 : 1, dir, 3);
  }
  function mark(x0: number, y0: number, w: number, y1: number) {
    for (let i = 0; i < page.n; i++) if (page.X[i]! < x0 + w && page.X[i]! + page.BW[i]! > x0 && page.Y[i]! < y1 && page.Y[i]! + page.BH[i]! > y0) HIT[i] = 1;
  }
  function hurt(d: number, dmg: number, dir: number, w: number) {
    S[HP + d] = max(0, S[HP + d]! - dmg);
    S[PH + d] = HURT;
    S[T + d] = 0.45;
    S[VX + d] = dir * 120;
    S[VY + d] = -80;
    S[FLS + d] = 0.3;
    fx.burst(S[FX + d]!, S[FY + d]! - 12, 18, d ? 3 : 1, 120);
    say(w, S[FX + d]!);
    if (!S[HP + d]) {
      S[PH + d] = DOWN;
      S[WIN] = 1 - d;
      S[END] = 0;
      S[DRT] = 0;
      say(10, S[FX + d]!);
    }
  }

  function stepDuelists(dt: number) {
    for (let a = 0; a < 2; a++) {
      const d = 1 - a, ph = S[PH + a]!, dx = S[FX + d]! - S[FX + a]!;
      if (ph < STRIKE || ph === SHOVE) S[D + a] = sign(dx) || S[D + a]!;
      if (S[FLS + a]! > 0) S[FLS + a] = S[FLS + a]! - dt;
      if (S[SG + a]! > 0) S[SG + a] = max(0, S[SG + a]! - dt);
      // Body: in the air until a card top or the floor catches the feet; walls throw back.
      const y0 = S[FY + a]!;
      S[VY + a] = S[VY + a]! + G * dt;
      let x = S[FX + a]! + S[VX + a]! * dt;
      if (x < 8 || x > W - 8) {
        if (ph === HURT && abs(S[VX + a]!) > 150 && S[FLS + a]! <= 0) hurt(a, 1, -sign(S[VX + a]!), 7);
        else S[VX + a] = -S[VX + a]! * 0.4;
        x = max(8, min(W - 8, x));
      }
      S[FX + a] = x;
      const y1 = y0 + S[VY + a]! * dt, c = S[VY + a]! >= 0 ? landing(a, y0, y1) : -1;
      if (c >= 0) {
        const t = c > 2 ? FL : top(c);
        if (S[VY + a]! > 60 && c < 3) page.hit(NL + c, 0, S[VY + a]! * 0.8), (HIT[NL + c] = 1);
        S[FY + a] = t;
        S[VY + a] = 0;
        S[VX + a] = S[VX + a]! * (1 - min(1, dt * 10));
        if (ph === JUMP) S[MV + a] && abs(dx) < 22 ? ((S[PH + a] = WIND), (S[T + a] = 0.18)) : (S[PH + a] = IDLE);
      } else S[FY + a] = y1;
      // A thrown body against a card's side: the card takes it, the body bounces.
      if (ph === HURT && abs(S[VX + a]!) > 100 && S[FLS + a]! <= 0)
        for (let k = 0; k < 3; k++) {
          const i = NL + k;
          if (x > page.X[i]! && x < page.X[i]! + page.BW[i]! && S[FY + a]! - 8 > page.Y[i]! && S[FY + a]! - 8 < page.Y[i]! + page.BH[i]!) {
            page.hit(i, S[VX + a]!, -40);
            HIT[i] = 1;
            hurt(a, 1, -sign(S[VX + a]!), 7);
            break;
          }
        }
      const t = (S[T + a] = S[T + a]! - dt);
      if (ph === WALK) {
        const gx = max(8, min(W - 8, S[FX + d]! - sign(dx) * 15));
        if (abs(S[FY + d]! - S[FY + a]!) > 4) (S[MV + a] = 1), leap(a, gx, S[FY + d]!);
        else if (abs(gx - x) < 2 || t < -2) (S[PH + a] = WIND), (S[T + a] = 0.3);
        else S[FX + a] = x + sign(gx - x) * min(abs(gx - x), 80 * dt);
      } else if (ph === WIND && t <= 0) (S[PH + a] = STRIKE), (S[T + a] = 0.22), strike(a);
      else if (ph === SHOVE && t <= 0) {
        // The palm: a wave rolls out; whoever's in it is flung.
        S[WAVE] = 0.35;
        S[WVX] = x;
        S[WVD] = S[D + a]!;
        say(a ? 6 : 5, x + S[D + a]! * 12);
        if (abs(dx) < 70 && abs(S[FY + d]! - S[FY + a]!) < 22 && S[PH + d]! < HURT) {
          S[PH + d] = HURT;
          S[T + d] = 0.7;
          S[VX + d] = S[D + a]! * 260;
          S[VY + d] = -130;
        }
        (S[PH + a] = STRIKE), (S[T + a] = 0.3);
      } else if (ph === CLASH) {
        if (rnd() < 0.5) fx.burst((x + S[FX + d]!) / 2, hand(a) - 6, 2, a ? 3 : 1, 70);
        if (t <= 0) (S[PH + a] = IDLE), (S[VX + a] = -S[D + a]! * 130), (S[VY + a] = -110), (S[FY + a] = S[FY + a]! - 1);
      } else if ((ph === STRIKE || ph === HURT) && t <= 0 && !S[VY + a]) S[PH + a] = IDLE;
    }
  }

  /** The drone fires; bolts fly, glance off the page's boxes, and are parried or land. */
  function stepBolts(dt: number) {
    if (S[DRT]! > 0) {
      S[DRT] = S[DRT]! - dt;
      S[DRY] = S[DRY]! + sin(S[DRT]! * 5) * dt * 6;
      if (S[DRN]! > 0 && (S[DRC] = S[DRC]! - dt) <= 0) {
        const f = (S[DRN]! & 1) as number, tx = S[FX + f]! - S[DRX]!, ty = S[FY + f]! - 12 - S[DRY]!, k = 120 / (abs(tx) + abs(ty) || 1);
        fire(S[DRX]!, S[DRY]! + 3, tx * k, ty * k);
        S[DRN] = S[DRN]! - 1;
        S[DRC] = 0.4;
      }
    }
    for (let i = 0; i < NB; i++) {
      if (BT[i]! <= 0) continue;
      BT[i] = BT[i]! - dt;
      const x = (BX[i] = BX[i]! + BVX[i]! * dt), y = (BY[i] = BY[i]! + BVY[i]! * dt);
      if (x < 2 || x > W - 2) BVX[i] = -BVX[i]!;
      if (y < 2 || y > FL) BVY[i] = -BVY[i]!;
      const b = page.at(x, y, 0);
      if (b >= 0) {
        // Off a real box: back out along the shallow side.
        const px = min(x - page.X[b]!, page.X[b]! + page.BW[b]! - x), py = min(y - page.Y[b]!, page.Y[b]! + page.BH[b]! - y);
        px < py ? (BVX[i] = -BVX[i]!) : (BVY[i] = -BVY[i]!);
        BX[i] = x + BVX[i]! * dt * 2;
        BY[i] = y + BVY[i]! * dt * 2;
        page.hit(b, BVX[i]! * 2, BVY[i]! * 2);
        HIT[b] = 1;
        if ((BK[i] = BK[i]! + 1) > 5) BT[i] = 0;
        fx.burst(x, y, 4, 2, 50);
        log += "r";
      }
      for (let f = 0; f < 2; f++) {
        if (S[PH + f]! >= DOWN || abs(x - S[FX + f]!) > 4 || y < S[FY + f]! - 20 || y > S[FY + f]!) continue;
        if (S[PH + f]! < HURT && rnd() < (S[SG + f]! > 0 ? 0.95 : 0.6)) {
          // Parried: back the way it came, faster, often at the other one.
          const o = 1 - f, aim = rnd() < 0.5, sp = 150;
          if (aim) {
            const tx = S[FX + o]! - x, ty = S[FY + o]! - 12 - y, k = sp / (abs(tx) + abs(ty) || 1);
            (BVX[i] = tx * k), (BVY[i] = ty * k);
          } else (BVX[i] = S[D + f]! * sp * (0.6 + rnd() * 0.4)), (BVY[i] = -sp * rnd());
          BX[i] = S[FX + f]! + S[D + f]! * 6;
          BK[i] = BK[i]! + 2; // a bolt takes a few bounces and a parry or two, then it's spent
          fx.burst(x, y, 8, f ? 3 : 1, 80);
          say(4, x);
        } else (BT[i] = 0), hurt(f, 1, sign(BVX[i]!) || 1, 3);
        break;
      }
    }
  }
  function fire(x: number, y: number, vx: number, vy: number) {
    for (let i = 0; i < NB; i++) if (BT[i]! <= 0) return (BX[i] = x), (BY[i] = y), (BVX[i] = vx), (BVY[i] = vy), (BT[i] = 2.4), (BK[i] = 0);
  }
  const bolts = () => {
    for (let i = 0; i < NB; i++) if (BT[i]! > 0) return true;
    return false;
  };

  engine.add({
    read() {
      page.read();
    },
    step(e, dt) {
      if (S[Q]) (S[Q] = 0), clicked(S[QX]!, S[QY]!);
      const live = S[WIN]! < 0;
      stepDuelists(dt);
      stepBolts(dt);
      if (live) {
        if (S[GAP]! > 0) S[GAP] = S[GAP]! - dt;
        else if (!S[PH]! && !S[PH + 1]! && !S[VY]! && !S[VY + 1]!) {
          choose();
          S[GAP] = 0.2 + rnd() * 0.4;
        }
      } else if (S[OVER]! < 1) {
        // The end: KO, the pie flies to the winner, the sequel tease, then the letters mend.
        const t = (S[END] = S[END]! + dt);
        if (t > 1 && S[PIE]! < 1) {
          S[PIE] = min(1, S[PIE]! + dt * 1.6);
          if (S[PIE]! >= 1) fx.burst(S[FX + S[WIN]!]!, S[FY + S[WIN]!]! - 14, 14, 1, 70);
        }
        if (t > 3.8 && (S[HEAL] = S[HEAL]! - dt) <= 0) {
          S[HEAL] = 0.07;
          let i = 0;
          while (i < page.n && !page.CUT[i]) i++;
          if (i < page.n) (page.CUT[i] = 0), fx.burst(page.X[i]! + page.BW[i]! / 2, page.Y[i]! + page.BH[i]! / 2, 5, 1, 40);
          else if (t > 5.4) (S[OVER] = 1), (S[DIRTY] = 1);
        }
      }
      if (S[WAVE]! > 0) S[WAVE] = S[WAVE]! - dt;
      if (S[WT]! < 1.1) S[WT] = S[WT]! + dt;
      const moving = page.step(dt), bits = fx.step(dt, FL);
      if (S[DIRTY] || live || S[OVER]! < 1 || moving || bits || bolts() || S[WT]! < 1.1 || S[VY]! || S[VY + 1]!) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      page.render();
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    g.clearRect(0, 0, W, 90);
    const time = engine.stats().time, w = S[WIN]!, e = S[END]!;
    // The prize, on the middle card (then on its way to the winner).
    const i1 = NL + 1, px0 = page.X[i1]! + page.BW[i1]! / 2, py0 = top(1) - 3, p = S[PIE]!;
    if (p < 1) art.draw(g, "pie", 0, w < 0 ? px0 : px0 + (S[FX + w]! - px0) * p, w < 0 ? py0 : py0 + (S[FY + w]! - 22 - py0) * p - sin(p * 3.14) * 20, 0, 1);
    // The palm wave.
    if (S[WAVE]! > 0) {
      const r = (0.35 - S[WAVE]!) * 150;
      g.fillStyle = C.sys;
      for (let k = -4; k <= 4; k++) g.fillRect(round(S[WVX]! + S[WVD]! * (8 + r - abs(k) * 0.8)), round(hand(0) + k * 2.5 - 2), 1, 2);
    }
    for (let f = 0; f < 2; f++) {
      const ph = S[PH + f]!, down = ph === DOWN, x = S[FX + f]!, y = S[FY + f]!, dir = S[D + f]!;
      const lean = ph === STRIKE ? 0.15 : ph === HURT ? -0.3 : ph === CLASH ? 0.08 : 0;
      art.draw(g, f ? "duke" : "nana", dir < 0 ? 1 : 0, x, down ? FL - 4 : y, down ? (dir > 0 ? -1.5708 : 1.5708) : lean * dir, 1, S[FLS + f]! > 0.15 ? 1 : 0);
      // The blade: a hot core in its colour, longer in a surge; out (a stub) when down, except in the tease.
      const hx = x + dir * 4, hy = down ? FL - 6 : hand(f), on = !down || (e > 2.8 && ((e * 5) | 0) % 3 > 0);
      const len = down ? 4 + (on ? 6 : 0) : S[SG + f]! > 0 ? 18 : 13, a = down ? -1.5708 : ANGLE[ph]! + (ph < WIND ? sin(time * 3 + f * 2) * 0.12 : 0);
      if (on || !down)
        for (let s = 2; s < len; s++) {
          const bx = round(hx + cos(a) * s * dir), by = round(hy + sin(a) * s);
          g.fillStyle = BLADE[f]!;
          g.fillRect(bx - 1, by - 1, 3, 3);
          g.fillStyle = C.ink;
          g.fillRect(bx, by, 1, 1);
        }
      g.fillStyle = C.line;
      g.fillRect(round(hx) - 1, round(hy), 3, 2);
      if (S[SG + f]! > 0 && ((time * 10) | 0) & 1) (g.fillStyle = BLADE[f]!), g.fillRect(round(x) - 1, round(y) - (f ? 25 : 21), 2, 2);
      for (let k = 0; k < HP0; k++) (g.fillStyle = k < S[HP + f]! ? BLADE[f]! : C.line), g.fillRect((f ? 40 : 19) + k * 4, 85, 3, 2);
    }
    if (S[DRT]! > 0) art.draw(g, "drone", 0, S[DRX]!, S[DRY]!, sin(time * 4) * 0.15, 1);
    for (let i = 0; i < NB; i++) {
      if (BT[i]! <= 0) continue;
      const k = 3 / (abs(BVX[i]!) + abs(BVY[i]!) || 1);
      g.fillStyle = C.attack;
      for (let s = 0; s < 4; s++) g.fillRect(round(BX[i]! - BVX[i]! * k * s), round(BY[i]! - BVY[i]! * k * s), 1, 1);
      g.fillStyle = C.ink;
      g.fillRect(round(BX[i]!), round(BY[i]!), 1, 1);
    }
    fx.draw(g);
    if (S[WT]! < 1.05) shout(g, WORDS[S[WORD]!]!, S[WX]!, 26, S[WT]! < 0.05 ? 3 : 2, S[WORD] === 8 ? C.sys : C.hurt, C.attack);
    // The end card: who won (and ate the pie), then the sequel tease (the loser's blade sputters on).
    if (w >= 0 && e > 1.05) {
      if (e < 2.8) shout(g, w ? "DUKE WINS" : "NANA WINS", 80, 26, 2, C.ink, BLADE[w]!);
      else {
        shout(g, w ? "NANA II" : "DUKE II", 80, 26, 2, C.attack, C.cmd);
        shout(g, w ? "SECOND HELPINGS" : "JUST DESSERTS", 80, 54, 1, C.hurt, C.rim);
      }
      if (S[PIE]! >= 1 && e < 2.8) bubble(g, WORDS[9]!, S[FX + w]!, S[FY + w]! - (w ? 30 : 27));
    }
  }

  bout();
  engine.start();
  return {
    engine,
    tap,
    get winner() {
      return S[WIN]!;
    },
    get log() {
      return log;
    },
    get hp() {
      return [S[HP]!, S[HP + 1]!];
    },
    get over() {
      return S[OVER]! > 0;
    },
    hits: HIT,
    get surge() {
      return [S[SG]!, S[SG + 1]!];
    },
    get drone() {
      return S[DRT]! > 0;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): both duelists on their marks, blades
 *  lit, DUEL! (nothing random is drawn yet, so every seed gives this same still). */
export const posterAt = 0.5;

/** For `slot(fig, () => import("./laser-swords-duel-last-slice").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => lastSlice(stage, slot, first);
