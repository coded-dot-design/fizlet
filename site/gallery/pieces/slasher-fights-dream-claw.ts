// HUSH vs SNOOZE, a Halloween double feature on one camp notice board. HUSH, the silent camp slasher
// (a zipped-mouth mask, a teal staff windbreaker, a cleaver), fights SNOOZE, the dream stalker (a
// nightcap, moon pyjamas, an oven mitt with blades for fingers). Every play rolls a new fight from
// the engine's seeded random (seeded once from Math.random at mount): who moves, which move (HUSH:
// a chop, a thrown cleaver, a lights-flicker and suddenly he's behind you; SNOOZE: a swipe, a
// fake-out, a dream-warp behind HUSH), who dodges, and so who wins. Misses don't vanish: a swing cuts
// the board's real letters where it passes (each splits along the slash), a thrown cleaver or a
// thrown-in pan glances off them. Click: the lamp cuts the lights (HUSH loves the dark), the alarm
// clock wakes the dreamer (SNOOZE fades and takes double), anywhere else throws something in (a pan:
// BONK; a pillow: HUSH naps, SNOOZE gets comfy). A KO, a comic victory beat, a sequel tease; then the
// letters heal (it was all a dream) and it sleeps. Click again for the rematch: a different fight.
// Bricks: the kernel (fixed step, settle, seeded random; its ledger for every page write, so Recall
// gives the page back byte for byte) and fizlet/sprite (both fighters and their props, baked once).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { bubble, C, print, shout, textW } from "./pixel-type";
import { facing, pageBoxes, sparkPool } from "./fight-page";

export type HushScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  /** A click on the board, in art pixels (160 × 90). */
  tap(x: number, y: number): void;
  /** -1 while fighting, 0 HUSH, 1 SNOOZE. */
  readonly winner: number;
  /** Every move so far, one letter each (c chop, t throw, b behind you, s swipe, f fake, w warp). */
  readonly log: string;
  readonly hp: number[];
  /** True once the fight, the tease and the healing are done. */
  readonly over: boolean;
  /** Per letter: 1 once anything has reached it. */
  readonly hits: Uint8Array;
  readonly dark: boolean;
  /** The alarm clock is ringing (SNOOZE half awake). */
  readonly ringing: boolean;
};

const { abs, max, min, round, sign, sin } = Math;
const W = 160, FL = 82, HP0 = 4;
// Body rows; each frame lays one arm over the columns from AT (cleaver or claw).
const dress = (body: string[], at: number, arm: string[]) => body.map((r, i) => (arm[i] ? r.padEnd(at, ".").slice(0, at) + arm[i] : r));
// HUSH (faces right): m mask, v vents, e eyes, z zip, q zip teeth, j windbreaker, k its shade, s the
// STAFF stripe, p trousers, b boots, h glove, w grip, c blade, d its edge.
const HB = [
  "", "", "", "",
  "....mmmmmm",
  "...mmmmmmmm",
  "...mvmmemme",
  "...mmvmmmmm",
  "...mvmzqzqz",
  "....mmmmmm",
  ".....jjjj",
  "...jjjjjjjj",
  "..jjjjjjjjjj",
  ".kjssssssjjj",
  ".kjjjjjjjjjj",
  ".kjjjjjjjjjj",
  "..jjjjjjjjjj",
  "..kkkkkkkkkk",
  "...pppppppp",
  "...pppppppp",
  "...ppp..ppp",
  "...ppp..ppp",
  "...ppp..ppp",
  "..bbbb..bbbb",
];
const HUSH_ARMS = [
  // 0 cleaver down at his side
  ["", "", "", "", "", "", "", "", "", "", "", "", "jj", "jjj", "jjj", ".jh", ".hw", ".cccc", ".cccc", ".dddd"],
  // 1 raised overhead
  ["....cccc", "....cccc", "....dddd", ".....w", "....hh", "...hj", "..jj", "..jj", "..jj", "..jj", "..jj", "..jj", "jjj"],
  // 2 the chop, out front
  ["", "", "", "", "", "", "", "", "", "", "", "", "jjjjjhw", "jjj..cccc", "jj...cccc", ".....dddd"],
];
// SNOOZE (faces right): n nightcap, o its bobble and the moons, f face, l lids, e eyes, t grin,
// y pyjamas, a the mitt, c blades, s slippers.
const SB = [
  "", "", "",
  "onn",
  ".nnnn",
  "..nnnnnn",
  "...nnnnnn",
  "...ffffff",
  "...fllfll",
  "...fefffe",
  "...ffffff",
  "...fttttf",
  "....ffff",
  "....yyyy",
  "...yyyyyy",
  "...yoyyyy",
  "...yyyyoy",
  "...yyyyyy",
  "...yoyyyy",
  "...yyyyyy",
  "...yy.yy",
  "...yy.yy",
  "...yy.yy",
  "..sss.sss",
];
const SNOOZE_ARMS = [
  // 0 claws up at the chest
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "y", "yy", ".yaa.c", ".yaacc", "..aac.c", "...c"],
  // 1 raised, blades up
  ["..c.c", "..c.c.c", "..c.c.c", "..aaa", "..aa", "..ya", "..y", "..y", "..y", "..y", "..y", "..y", "", "y", "y"],
  // 2 the swipe, low and long
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "y", "yy", ".yyyaa.ccccc", "....aaccccc", "....aa.cccc", ".......ccc"],
];
const frames = (body: string[], at: number, arms: string[][], w: number, cx: number) => facing(arms.map((a) => dress(body, at, a)), w, cx);
const CAST = {
  hush: { frames: frames(HB, 10, HUSH_ARMS, 20, 7), colors: { m: C.ink, v: C.line, e: C.attack, z: C.rim, q: C.hurt, j: C.sys, k: C.base, s: C.ink, p: C.base, b: C.line, h: C.muted, w: C.cmd, c: C.ink, d: C.muted }, outline: C.rim, ax: 12, ay: 24 },
  snooze: { frames: frames(SB, 6, SNOOZE_ARMS, 18, 6), colors: { n: C.cmd, o: C.hurt, f: C.aim, l: C.base, e: C.hurt, t: C.ink, y: C.muted, a: C.attack, c: C.sys, s: C.attack }, outline: C.rim, ax: 11, ay: 24 },
  // Thrown things: the cleaver, a frying pan, a pillow.
  cleaver: { frames: [["cccc..", "cccchw", "dddd.."]], colors: { c: C.ink, d: C.muted, h: C.cmd, w: C.cmd }, outline: C.rim },
  pan: { frames: [[".kkk...", "kkkkk..", "kkkkkhh", "kkkkk..", ".kkk..."]], colors: { k: C.muted, h: C.hurt }, outline: C.rim },
  pillow: { frames: [["wwwwww", "wwwwww", "wwwwww", "wwwwww"]], colors: { w: C.ink }, outline: C.muted },
};
const PAL: Record<string, string>[] = [{}, { "*": C.ink }, { "*": C.base }];
const WORDS = ["FIGHT!", "CHOP!", "SLASH!", "WHIFF", "PSYCH!", "BONK!", "FWUMP", "BRRRING!", "ZZZ", "KO!", "COMFY", "NIGHTY NIGHT", "..."];
// Fighter slots (two each): x, y up, vx, vy, hp, move, phase, timer, facing, flash, daze; then the scene.
const FX = 0, FY = 2, VX = 4, VY = 6, HP = 8, MV = 10, PH = 12, T = 14, D = 16, FLS = 18, DZ = 20;
const GAP = 22, WIN = 23, END = 24, DARK = 25, RING = 26, FORCE = 27, FAKED = 28, WORD = 29, WT = 30, WX = 31, WY = 32, SL = 33, SLX = 34, SLD = 35, SLK = 36, HEAL = 37, OVER = 38, Q = 39, QX = 40, QY = 41, DIRTY = 42, NAP = 43;
// Phases and moves.
const IDLE = 0, DASH = 1, WIND = 2, STRIKE = 3, OUT = 4, BACK = 5, HURT = 6, DOWN = 7;
const CHOP = 1, THROW = 2, BEHIND = 3, SWIPE = 4, FAKE = 5, WARP = 6;
const MOVE_LOG = ".ctbsfw";
// Thrown things: kind (0 none, 1 cleaver, 2 pan, 3 pillow), x, y, vx, vy, spin, life.
const NP = 4;

export function hushVsSnooze(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): HushScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 || 1 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = 90;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites(CAST, { palettes: PAL });
  const wrap = slot.querySelector<HTMLElement>(".hs")!;
  const page = pageBoxes(engine, wrap, [...wrap.querySelectorAll<HTMLElement>(".hs-t i[data-c]")], W);
  const HIT = new Uint8Array(page.n);
  const fx = sparkPool(rnd, 64, [C.ink, C.sys, C.hurt, C.attack, C.muted, C.ink]);
  const S = new Float64Array(44);
  const PK = new Uint8Array(NP), PX = new Float32Array(NP), PY = new Float32Array(NP), PVX = new Float32Array(NP), PVY = new Float32Array(NP), PS = new Float32Array(NP), PT = new Float32Array(NP);
  let log = "";

  /** A new bout: both on their marks, full pips, FIGHT!. Nothing random is drawn until the first move. */
  function bout() {
    for (let f = 0; f < 2; f++) {
      S[FX + f] = f ? 118 : 42;
      S[FY + f] = S[VX + f] = S[VY + f] = S[MV + f] = S[PH + f] = S[FLS + f] = S[DZ + f] = 0;
      S[HP + f] = HP0;
      S[D + f] = f ? -1 : 1;
    }
    S[GAP] = 0.9;
    S[WIN] = S[END] = -1;
    S[OVER] = S[DARK] = S[RING] = S[FORCE] = S[NAP] = S[SL] = 0;
    PK.fill(0);
    for (let i = 0; i < page.n; i++) page.CUT[i] = 0;
    say(0, 80, 18);
  }
  function say(w: number, x: number, y: number) {
    const h = textW(WORDS[w]!, 2) / 2 + 2;
    S[WORD] = w;
    S[WT] = 0;
    S[WX] = max(h, min(W - h, x));
    S[WY] = min(15, y); // in the sky over the fight, never on the fighters
  }
  const head = (f: number) => FL - S[FY + f]! - 22;

  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * 90);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * 90);
  }, { signal: engine.signal });

  /** A click: the lamp, the alarm clock, a rematch, or something thrown in where you clicked. */
  function clicked(x: number, y: number) {
    if (S[WIN]! >= 0) return S[END]! > 0.9 ? bout() : undefined;
    if (x > 140 && y < 52) {
      // The lamp: lights out, and HUSH is the one who moves in the dark.
      S[DARK] = 1.5;
      S[FORCE] = 1;
      return;
    }
    if (x < 20 && y > FL - 18) {
      // The alarm clock: the dreamer half wakes. He drops what he was doing and fades.
      S[RING] = 2.4;
      if (S[PH + 1]! < HURT) (S[PH + 1] = IDLE), (S[MV + 1] = 0);
      S[FORCE] = 1;
      return say(7, 40, 30);
    }
    for (let i = 0; i < NP; i++) if (!PK[i]) {
      PK[i] = rnd() < 0.55 ? 2 : 3;
      PX[i] = max(6, min(W - 6, x));
      PY[i] = min(y, FL - 34);
      PVX[i] = (rnd() - 0.5) * 40;
      PVY[i] = -30;
      PS[i] = 0;
      PT[i] = 2.5;
      return;
    }
  }

  /** The director: when both are free, someone moves. */
  function choose() {
    let a = S[FORCE]! ? (S[RING]! > 0 || S[DARK]! > 0 ? 0 : 1) : rnd() < 0.5 ? 0 : 1;
    if (S[DZ + a]! > 0) a = 1 - a; // a napping fighter can't
    S[FORCE] = 0;
    const d = 1 - a, far = abs(S[FX + a]! - S[FX + d]!) > 34, r = rnd();
    const m = a ? (S[RING]! > 0 ? 0 : r < 0.45 ? SWIPE : r < 0.72 ? FAKE : WARP) : S[DARK]! > 0 ? BEHIND : far && r < 0.45 ? THROW : r < 0.82 ? CHOP : BEHIND;
    if (!m) return;
    log += MOVE_LOG[m];
    S[MV + a] = m;
    S[FAKED] = 0;
    if (m === BEHIND || m === WARP) {
      S[PH + a] = OUT;
      S[T + a] = m === WARP ? 0.45 : 0.8;
      if (m === BEHIND) S[DARK] = max(S[DARK]!, 0.8);
    } else if (m === THROW) (S[PH + a] = WIND), (S[T + a] = 0.35);
    else S[PH + a] = DASH;
  }

  /** The swing lands (or doesn't): cuts the letters it passes, then the dodge roll. */
  function strike(a: number) {
    const d = 1 - a, dir = S[D + a]!, x = S[FX + a]!, reach = a ? 24 : 21, y0 = head(a) - (a ? 2 : 6);
    S[SL] = 0.22;
    S[SLX] = x + dir * 4;
    S[SLD] = dir;
    S[SLK] = a;
    const x0 = dir > 0 ? x : x - reach;
    if (page.sweep(x0, y0, x0 + reach, FL - 8, dir * 220, -60, a ? (dir > 0 ? 2 : 1) : dir > 0 ? 1 : 2)) mark(x0, y0, reach);
    if (abs(S[FX + d]! - x) > reach + 3 || S[PH + d] === DOWN) return say(3, x + dir * 12, head(a) - 8);
    const sure = S[FAKED]! || S[DZ + d]! > 0 || (d && S[RING]! > 0) || (!d && S[DARK]! > 0);
    if (!sure && rnd() < 0.32) {
      // Dodged: a hop back.
      S[VY + d] = 120;
      S[VX + d] = dir * 80;
      return say(3, S[FX + d]!, head(d) - 6);
    }
    hurt(d, 1 + (d && S[RING]! > 0 ? 1 : 0), dir, a ? 2 : 1);
  }
  /** Marks every box a hit reached (for the test: nothing moves that wasn't reached). */
  function mark(x0: number, y0: number, w: number) {
    for (let i = 0; i < page.n; i++) if (page.X[i]! < x0 + w && page.X[i]! + page.BW[i]! > x0 && page.Y[i]! + page.BH[i]! > y0) HIT[i] = 1;
  }
  function hurt(d: number, dmg: number, dir: number, w: number) {
    S[HP + d] = max(0, S[HP + d]! - dmg);
    S[PH + d] = HURT;
    S[MV + d] = 0;
    S[T + d] = 0.4;
    S[VX + d] = dir * 110;
    S[FLS + d] = 0.3;
    S[DZ + d] = 0;
    fx.burst(S[FX + d]!, head(d) + 8, 16, d ? 1 : 2, 110);
    say(w, S[FX + d]!, head(d) - 8);
    if (!S[HP + d]) {
      // KO.
      S[PH + d] = DOWN;
      S[VY + d] = 70;
      S[VX + d] = 0;
      S[FX + d] = max(46, min(W - 46, S[FX + d]!));
      S[WIN] = 1 - d;
      S[END] = 0;
      S[DARK] = S[RING] = 0;
      say(9, S[FX + d]!, head(d) - 10);
    }
  }

  function stepFighters(dt: number) {
    for (let a = 0; a < 2; a++) {
      const d = 1 - a, ph = S[PH + a]!, dx = S[FX + d]! - S[FX + a]!;
      if (ph < STRIKE || ph === BACK) S[D + a] = sign(dx) || S[D + a]!;
      if (S[FLS + a]! > 0) S[FLS + a] = S[FLS + a]! - dt;
      if (S[DZ + a]! > 0 && (S[DZ + a] = S[DZ + a]! - dt) <= 0) S[DZ + a] = 0;
      // Body: knockback slides, hops fall, walls hold.
      S[FX + a] = max(10, min(W - 10, S[FX + a]! + S[VX + a]! * dt));
      S[VX + a] = S[VX + a]! * (1 - min(1, dt * 6));
      S[VY + a] = S[VY + a]! - 360 * dt;
      S[FY + a] = max(0, S[FY + a]! + S[VY + a]! * dt);
      if (!S[FY + a]) S[VY + a] = 0;
      const t = (S[T + a] = S[T + a]! - dt);
      if (ph === DASH) {
        const reach = a ? 20 : 17, gx = max(10, min(W - 10, S[FX + d]! - sign(dx) * reach)), sp = a ? 95 : 70;
        if (abs(gx - S[FX + a]!) < 2 || t < -2) (S[PH + a] = WIND), (S[T + a] = a ? 0.28 : 0.36);
        else S[FX + a] = S[FX + a]! + sign(gx - S[FX + a]!) * min(abs(gx - S[FX + a]!), sp * dt);
      } else if (ph === WIND && t <= 0) {
        if (S[MV + a] === FAKE && !S[FAKED]) {
          // PSYCH: the claws stop short, HUSH flinches, and the real one comes now.
          S[FAKED] = 1;
          S[T + a] = 0.3;
          S[FLS + d] = 0.12;
          S[VX + d] = sign(-dx) * -40;
          say(4, S[FX + a]!, head(a) - 8);
        } else if (S[MV + a] === THROW) {
          for (let i = 0; i < NP; i++) if (!PK[i]) {
            const tx = S[FX + d]! - S[FX + a]!, up = 40 + rnd() * 90;
            PK[i] = 1;
            PX[i] = S[FX + a]! + S[D + a]! * 6;
            PY[i] = head(a) + 2;
            PVY[i] = -up;
            PVX[i] = tx / ((2 * up) / 260 + 0.05);
            PS[i] = 0;
            PT[i] = 2.2;
            break;
          }
          (S[PH + a] = BACK), (S[T + a] = 0.5);
        } else (S[PH + a] = STRIKE), (S[T + a] = 0.25), strike(a);
      } else if (ph === OUT && t <= 0) {
        // Gone, then right behind the other one.
        const side = -S[D + d]!, nx = S[FX + d]! + side * 15;
        S[FX + a] = nx < 12 || nx > W - 12 ? S[FX + d]! - side * 15 : nx;
        (S[PH + a] = WIND), (S[T + a] = 0.22);
        fx.burst(S[FX + a]!, head(a) + 10, 10, a ? 1 : 4, 60);
      } else if ((ph === STRIKE || ph === BACK || ph === HURT) && t <= 0) (S[PH + a] = IDLE), (S[MV + a] = 0);
    }
  }

  function stepThrown(dt: number) {
    for (let i = 0; i < NP; i++) {
      const k = PK[i]!;
      if (!k) continue;
      if ((PT[i] = PT[i]! - dt) <= 0) {
        PK[i] = 0;
        continue;
      }
      const stuck = k === 1 && PVX[i] === 0 && PVY[i] === 0;
      if (stuck) continue;
      PVY[i] = PVY[i]! + 260 * dt;
      PS[i] = PS[i]! + dt * (k === 3 ? 6 : 18);
      const x = (PX[i] = PX[i]! + PVX[i]! * dt), y = (PY[i] = PY[i]! + PVY[i]! * dt);
      if (x < 4 || x > W - 4) (PVX[i] = -PVX[i]! * 0.6), (PX[i] = max(4, min(W - 4, x)));
      // The board's letters: a glance off, and the cleaver cuts what it touches.
      const b = page.at(x, y, 2);
      if (b >= 0 && page.hit(b, PVX[i]!, PVY[i]!, k === 1 ? (PVX[i]! > 0 ? 1 : 2) : 0)) {
        HIT[b] = 1;
        PVY[i] = -abs(PVY[i]!) * 0.5 - 20;
        PVX[i] = PVX[i]! * 0.8;
        fx.burst(x, y, 6, k === 3 ? 0 : 2, 60);
      }
      // A fighter in the way.
      for (let f = 0; f < 2; f++) {
        if (k === 1 && f === 0) continue; // HUSH's own cleaver
        if (S[PH + f] === DOWN || abs(x - S[FX + f]!) > 6 || y < head(f) - 2 || y > FL - S[FY + f]!) continue;
        PK[i] = 0;
        if (k === 3) {
          // The pillow: HUSH naps; SNOOZE gets comfy.
          fx.burst(x, y, 14, 0, 70, 0.8);
          if (f) (S[HP + 1] = min(HP0, S[HP + 1]! + 1)), say(10, x, head(f) - 8);
          else (S[DZ] = 1.6), (S[PH] = IDLE), (S[MV] = 0), say(6, x, head(f) - 8);
        } else if (k === 1 && rnd() < 0.3) {
          // Ducked.
          S[VY + f] = 110;
          PK[i] = 1;
          say(3, x, head(f) - 8);
        } else hurt(f, 1 + (f && S[RING]! > 0 ? 1 : 0), sign(PVX[i]!) || 1, k === 2 ? 5 : 1);
        break;
      }
      if (PK[i] && y > FL - 2) {
        PY[i] = FL - 2;
        if (k === 1) (PVX[i] = PVY[i] = 0), (PT[i] = min(PT[i]!, 0.7)); // sticks in the ground
        else (PVY[i] = -PVY[i]! * 0.35), (PVX[i] = PVX[i]! * 0.6), (PT[i] = min(PT[i]!, 0.9));
      }
    }
  }

  /** Something thrown still in the air (only = 1: a cleaver on its way; 0: anything at all). */
  const flying = (only: number) => {
    for (let i = 0; i < NP; i++) if (PK[i] && (!only || (PK[i] === only && PVX[i] !== 0))) return true;
    return false;
  };

  engine.add({
    read() {
      page.read();
    },
    step(e, dt) {
      if (S[Q]) (S[Q] = 0), clicked(S[QX]!, S[QY]!);
      const live = S[WIN]! < 0;
      if (live) {
        stepFighters(dt);
        if (S[GAP]! > 0) S[GAP] = S[GAP]! - dt;
        else if (!S[PH]! && !S[PH + 1]! && !flying(1)) {
          choose();
          S[GAP] = 0.2 + rnd() * 0.35;
        }
      } else if (S[OVER]! < 1) {
        // The end: KO, the winner's beat, the sequel tease, then the letters heal one by one.
        stepFighters(dt);
        const t = (S[END] = S[END]! + dt);
        if (t > 3.6 && (S[HEAL] = S[HEAL]! - dt) <= 0) {
          S[HEAL] = 0.07;
          const i = page.CUT.indexOf(1) < 0 ? page.CUT.indexOf(2) : page.CUT.indexOf(1);
          if (i >= 0) (page.CUT[i] = 0), fx.burst(page.X[i]! + page.BW[i]! / 2, page.Y[i]! + page.BH[i]! / 2, 5, 1, 40);
          else if (t > 5.2) (S[OVER] = 1), (S[DIRTY] = 1);
        }
      }
      stepThrown(dt);
      if (S[DARK]! > 0) S[DARK] = max(0, S[DARK]! - dt);
      if (S[RING]! > 0) S[RING] = max(0, S[RING]! - dt);
      if (S[SL]! > 0) S[SL] = S[SL]! - dt;
      if (S[WT]! < 1.1) S[WT] = S[WT]! + dt;
      const moving = page.step(dt);
      const bits = fx.step(dt, FL);
      if (S[DIRTY] || live || S[OVER]! < 1 || moving || bits || flying(0) || S[WT]! < 1.1) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      page.render();
      const dark = isDark();
      L.attr(wrap, "data-dark", dark ? "" : null);
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw(dark);
    },
  });
  /** Lights out flickers: dark, a blink of light, dark again. */
  const isDark = () => S[DARK]! > 0 && !(S[DARK]! > 0.55 && S[DARK]! < 0.65) && !(S[DARK]! < 0.12 && S[DARK]! > 0.06);

  function draw(dark: boolean) {
    g.clearRect(0, 0, W, 90);
    const t = engine.stats().time;
    // The lamp's light (off in the dark) and the alarm clock (it shakes when it rings).
    if (!dark) {
      g.fillStyle = "rgba(255,194,26,.13)";
      g.beginPath();
      g.moveTo(150, 30);
      g.lineTo(128, FL);
      g.lineTo(160, FL);
      g.lineTo(160, 30);
      g.fill();
    }
    g.fillStyle = dark ? C.line : C.hurt;
    g.fillRect(147, 26, 6, 4);
    const rx = S[RING]! > 0 ? round(sin(t * 60)) : 0;
    g.fillStyle = C.rim;
    g.fillRect(5 + rx, FL - 10, 11, 10);
    g.fillStyle = C.attack;
    g.fillRect(6 + rx, FL - 9, 9, 8);
    g.fillStyle = C.ink;
    g.fillRect(7 + rx, FL - 8, 7, 6);
    g.fillStyle = C.rim;
    g.fillRect(10 + rx, FL - 7, 1, 3);
    g.fillRect(10 + rx, FL - 5, 3, 1);
    g.fillStyle = C.hurt;
    g.fillRect(5 + rx, FL - 12, 3, 2);
    g.fillRect(13 + rx, FL - 12, 3, 2);
    // The fighters (the loser lies down), then their pips.
    for (let f = 0; f < 2; f++) {
      const down = S[PH + f] === DOWN, ph = S[PH + f]!, mv = S[MV + f]!;
      const fr = ph === WIND ? (S[FAKED] && f ? 0 : 1) : ph === STRIKE || (ph === BACK && mv === THROW) ? 2 : S[WIN] === f && S[END]! > 0.9 ? (f ? 2 : 1) : 0;
      const x = S[FX + f]!, y = FL - S[FY + f]!, frame = fr + (S[D + f]! < 0 ? 3 : 0);
      if (ph === OUT) {
        // Gone: SNOOZE dissolves into Z's; HUSH just isn't there when the light comes back.
        if (f) for (let k = 0; k < 4; k++) print(g, "Z", round(x - 6 + sin(t * 9 + k * 1.6) * 8), round(y - 10 - k * 4 - S[T + f]! * 12), k & 1 ? C.cmd : C.sys);
        continue;
      }
      if (f && S[RING]! > 0 && ((t * 12) | 0) % 3 === 0) continue; // fading out of the dream
      const pal = dark ? 2 : S[FLS + f]! > 0.15 ? 1 : 0;
      art.draw(g, f ? "snooze" : "hush", frame, x, down ? FL - (f ? 4 : 6) : y, down ? (S[D + f]! > 0 ? -1.5708 : 1.5708) : S[DZ + f]! > 0 ? 0.12 : 0, 1, pal);
      if (dark && !down) eyes(f, x, y);
      if (S[DZ + f]! > 0) print(g, "ZZZ".slice(0, 1 + (((t * 3) | 0) % 3)), x + 4, y - 30, C.sys);
      for (let k = 0; k < HP0; k++) (g.fillStyle = k < S[HP + f]! ? (f ? C.attack : C.sys) : C.line), g.fillRect((f ? 40 : 19) + k * 4, 85, 3, 2);
    }
    // The slash: a cleaver arc, or three claw lines.
    if (S[SL]! > 0) {
      const d = S[SLD]!, x = S[SLX]!, k = S[SLK]!;
      g.fillStyle = k ? C.sys : C.ink;
      for (let l = 0; l < (k ? 3 : 1); l++) for (let s = 0; s < 14; s++) g.fillRect(round(x + d * (s + l * 3)), round(FL - 30 + s * 1.4 + l * 2 - (k ? 0 : sin(s / 4) * 3)), 1, 1);
    }
    for (let i = 0; i < NP; i++) if (PK[i]) art.draw(g, PK[i] === 1 ? "cleaver" : PK[i] === 2 ? "pan" : "pillow", 0, PX[i]!, PY[i]!, PK[i] === 1 && !PVX[i] ? 0.8 : PS[i]!, 1);
    fx.draw(g);
    if (S[WT]! < 1.05) shout(g, WORDS[S[WORD]!]!, S[WX]!, S[WY]!, S[WT]! < 0.05 ? 3 : 2, S[WORD] === 4 ? C.sys : C.hurt, C.attack);
    // The end card: who won, then the sequel tease (the loser's eyes open).
    const e = S[END]!, w = S[WIN]!;
    if (w >= 0 && e > 0.9) {
      if (e > 1.05 && e < 2.6) shout(g, w ? "SNOOZE WINS" : "HUSH WINS", 80, 12, 2, C.ink, w ? C.cmd : C.sys);
      if (e > 1.2 && e < 2.6) bubble(g, w ? WORDS[11]! : WORDS[12]!, S[FX + w]!, head(w) - 10);
      if (e > 2.6) {
        shout(g, w ? "HUSH II" : "SNOOZE II", 80, 11, 2, C.attack, C.cmd);
        shout(g, w ? "HUSH HARDER" : "THE SNOOZE BUTTON", 80, 29, 1, C.hurt, C.rim);
        if (((e * 2) | 0) % 4) eyes(1 - w, S[FX + 1 - w]!, FL);
      }
    }
  }
  /** Glowing eyes (the dark, and the sequel tease). */
  function eyes(f: number, x: number, y: number) {
    const dir = S[D + f]!, down = S[PH + f] === DOWN, ey = f ? -15 : -18;
    g.fillStyle = f ? C.hurt : C.attack;
    for (let k = 0; k < 2; k++) {
      const ex = f ? (k ? 2 : -2) : k * 3 * dir;
      // Lying down: the face turned a quarter (back of the head on the ground).
      if (down) g.fillRect(round(x + (dir > 0 ? ey : -ey)), FL - (f ? 4 : 6) + (dir > 0 ? -ex : ex), 1, 1);
      else g.fillRect(round(x + ex), y + ey, 1, 1);
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
    get dark() {
      return isDark();
    },
    get ringing() {
      return S[RING]! > 0;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the bell, both on their marks, FIGHT!
 *  (nothing random is drawn yet, so every seed gives this same still). */
export const posterAt = 0.5;

/** For `slot(fig, () => import("./slasher-fights-dream-claw").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => hushVsSnooze(stage, slot, first);
