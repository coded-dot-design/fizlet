// "Boardwalk Run" (skate-sesh, hero): a side-scroll along a seaside boardwalk at sunset, the ocean
// behind the guardrail. Skate right to the FINISH post by the beach shack: jump the stacked barrels,
// hop the low beach ball and duck the bouncing one, launch off the sand ramps and the wooden kicker,
// clear the gaps in the planks, and grind the guardrail sections (ollie from one to the next and the
// grinds chain). In the air FLIP flips and GRAB grabs (← / → pick which); tricks, clears and grinds
// chain into a combo (points × tricks): a clean landing banks it, a slam loses it. The distance on the
// bottom bar ticks down to 00 and the clock counts up; at the post, the score card.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/slot, @fzlt/core/sound, @fzlt/core/input (intents) and
// @fzlt/core/pad (the touch keys). The scoring is combo.ts (Two-Minute Sesh's, imported as is). The
// run is `boardwalk()`, plain numbers, no DOM (tests/boardwalk-run.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { combo } from "./combo";
import { DEMO, DONE, FONT, H, IDLE, PLAY, TAU, W, spray, words } from "./kit";

/** Combo names (combo.ts ids). */
export const NAMES = ["KICKFLIP", "HEELFLIP", "VARIAL", "NOSE GRAB", "TAIL GRAB", "SUNSET GRAB", "BARREL HOP", "BALL HOP", "DUCK", "GAP", "SAND LAUNCH", "KICKER", "RAIL GRIND", "RAIL TO RAIL"];
const PTS = [100, 100, 150, 80, 80, 60, 120, 150, 90, 150, 60, 90, 80, 200];
export const FLIP = 0, GRABN = 3, HOP = 6, BALLHOP = 7, DUCKN = 8, GAPN = 9, SANDN = 10, KICKN = 11, GRINDN = 12, CHAIN = 13;
const POPS = ["BARREL HOP!", "BALL HOP!", "DUCK!", "GAP!", "SAND LAUNCH!", "KICKER!", "GRIND!", "RAIL TO RAIL!", "BAIL!", "SANDED!", "FINISH!", "+"];
/** Obstacle kinds. */
export const BARREL = 1, BALL = 2, SAND = 3, KICK = 4, GAP = 5, RAIL = 6;
/** The course, one row each: kind, x0, x1, height (a ball: its bounce; 0 rolls low). World units. */
export const COURSE = [
  BARREL, 150, 157, 9,
  SAND, 230, 256, 7,
  GAP, 264, 282, 0,
  RAIL, 350, 420, 8,
  BALL, 520, 528, 0,
  BARREL, 590, 597, 9,
  KICK, 650, 664, 9,
  GAP, 668, 694, 0,
  RAIL, 770, 830, 8,
  RAIL, 846, 906, 8,
  BALL, 1000, 1008, 22,
  SAND, 1080, 1106, 7,
  BARREL, 1118, 1124, 15,
  GAP, 1170, 1188, 0,
  BARREL, 1240, 1247, 9,
  BALL, 1350, 1358, 0,
];
const NO = COURSE.length / 4;
/** The FINISH post (world x); the run starts at 0. */
export const END = 1400;
/** Deck line (screen y), the rider's screen x, rider half width. */
export const DY = 72, RX = 44;
const HW = 3, GRAV = 320, POP = 105, CRUISE = 46, FAST = 66, SLOW = 26, BALLV = 24, BALLR = 4;
/** Rider states. */
export const ROLL = 0, AIR = 1, GRIND = 2, SLAM = 3, FALL = 4;
// State slots.
const MODE = 0, T = 1, X = 2, Y = 3, VY = 4, SP = 5, ST = 6, FLIPT = 7, FLIPK = 8, GRABT = 9, GRABK = 10, SLAMT = 11, CARD = 12, TIME = 13, BAILS = 14, DUCK = 15, CHAINF = 16, ACC = 17, DT = 18, AIRT = 19, LIP = 20, LAND = 21, RAILN = 22, BALLS = 23, RESP = 24;
/** Events this step. */
export const EV_START = 0, EV_POP = 1, EV_LAND = 2, EV_GRIND = 3, EV_BAIL = 4, EV_TRICK = 5, EV_BANK = 6, EV_END = 7, EV_CLEAR = 8;
const SANDP = 0, SPARK = 1, GOLD = 2, SPLASH = 3;
/** Inputs: [0] axis (← −1, → +1), [1] ollie presses, [2] flip presses, [3] grab held, [4] duck held. */
export type Inputs = Float64Array;

/** A ball's bottom height above the deck at run time `t` (a bouncing one skips in big arcs). */
export const ballY = (h: number, t: number) => (h ? h * Math.abs(Math.sin(t * 2.4)) : 0);

export function boardwalk(seed: number, I: Inputs, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(28), ev = new Uint8Array(9);
  const OK = new Uint8Array(NO), BX = new Float64Array(NO);
  const cb = combo(NAMES);
  const sp = spray(140, R);
  const pops = words(POPS);
  const D = new Float64Array(5);
  S[MODE] = demo ? DEMO : IDLE;
  function reset() {
    OK.fill(0);
    for (let i = 0; i < NO; i++) BX[i] = COURSE[i * 4 + 1]!;
    (S[X] = 0), (S[Y] = 0), (S[VY] = 0), (S[SP] = 0), (S[ST] = ROLL), (S[FLIPT] = 0), (S[GRABT] = 0), (S[TIME] = 0), (S[BAILS] = 0), (S[CARD] = 0), (S[CHAINF] = 0), (S[RAILN] = -1), (S[BALLS] = 0);
    cb.reset();
  }
  reset();
  /** Surface height under world x: a ramp's wedge, 0 on the deck, −99 over a gap. */
  function surf(x: number) {
    for (let i = 0; i < NO; i++) {
      const k = COURSE[i * 4]!, a = COURSE[i * 4 + 1]!, b = COURSE[i * 4 + 2]!;
      if (x < a || x > b) continue;
      if (k === SAND || k === KICK) return (COURSE[i * 4 + 3]! * (x - a)) / (b - a);
      if (k === GAP && x > a + 2 && x < b - 2) return -99;
    }
    return 0;
  }
  function trick(id: number) {
    cb.add(id, PTS[id]!);
    ev[EV_TRICK] = 1;
    sp.burst(RX, DY - S[Y]! - 10, 5, 36, -1.57, 2.2, 1.1, GOLD);
  }
  function say(w: number) {
    pops.say(w, RX + 18, DY - S[Y]! - 24, w === 8 || w === 9 ? 1 : w === 10 ? 2 : 0);
  }
  function bail(fall: number) {
    cb.bail();
    (S[ST] = fall ? FALL : SLAM), (S[SLAMT] = 0), (S[FLIPT] = 0), (S[GRABT] = 0), (S[BAILS] = S[BAILS]! + 1), (S[CHAINF] = 0);
    say(fall ? 9 : 8);
    ev[EV_BAIL] = 1;
    sp.burst(RX, DY - (S[Y]! > 0 ? S[Y]! : 0), 16, 50, -1.57, 2.6, 1.3, fall ? SPLASH : SANDP);
  }
  function bank() {
    if (cb.active && cb.bank()) ev[EV_BANK] = 1;
    S[CHAINF] = 0;
  }
  function start() {
    reset();
    (S[MODE] = PLAY), (S[T] = 0), (S[SP] = CRUISE);
    ev[EV_START] = 1;
  }
  /** The ghost (the attract run and the tests): reads the course ahead and times every move. */
  function ghost() {
    D.fill(0);
    const x = S[X]!, st = S[ST]!, v = S[SP]!;
    if (st === GRIND) {
      // Off the end of a rail with another one close ahead: ollie across.
      const i = S[RAILN]!, b = COURSE[i * 4 + 2]!;
      if (i + 1 < NO && COURSE[(i + 1) * 4] === RAIL && COURSE[(i + 1) * 4 + 1]! - b < 30 && x > b - 6) D[1] = 1;
      return D;
    }
    if (st === AIR) {
      if (S[AIRT]! > 0.06 && S[AIRT]! < 0.1 && S[VY]! > 20) D[2] = 1;
      D[3] = S[VY]! > 10 && S[Y]! > 6 && S[FLIPT]! <= 0 ? 1 : 0;
      return D;
    }
    if (st !== ROLL) return D;
    for (let i = 0; i < NO; i++) {
      if (OK[i]) continue;
      const k = COURSE[i * 4]!, a = k === BALL ? BX[i]! : COURSE[i * 4 + 1]!, h = COURSE[i * 4 + 3]!, d = a - x;
      if (d < -20) continue;
      if (k === SAND || k === KICK) break;
      if (k === BARREL) (D[1] = d > 9 && d < 12 ? 1 : 0), (D[1] && h > 10 && (D[1] = 0));
      else if (k === GAP) D[1] = d < 7 && d > 0 ? 1 : 0;
      else if (k === RAIL) D[1] = d > 10 && d < 13 ? 1 : 0;
      else if (k === BALL && d > -12 && d < 70) {
        const vr = v + BALLV, t = S[T]!;
        if (h) {
          // Duck under a high bounce if it is up as it passes; else check back next step.
          const t0 = (d - 8) / vr, t1 = (d + 10) / vr;
          let ok = 1;
          for (let s = 0; s <= 4; s++) if (ballY(h, t + t0 + ((t1 - t0) * s) / 4) < 9) ok = 0;
          D[4] = d < 26 ? 1 : 0;
          if (!ok && d >= 26) D[0] = -1;
        } else D[1] = d > vr * 0.28 && d < vr * 0.32 ? 1 : 0;
      }
      break;
    }
    return D;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    S[DT] = dt;
    const mode = S[MODE]!;
    const ups = I[1]!, flips = I[2]!;
    (I[1] = 0), (I[2] = 0);
    if (ups > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 1))) return start(), true;
    const auto = mode === DEMO || (mode === PLAY && I[5]! > 0);
    const inp = auto ? ghost() : mode === PLAY ? I : D.fill(0);
    const ax = inp[0]!, up = auto ? inp[1]! : mode === PLAY ? ups : 0, flip = auto ? inp[2]! : mode === PLAY ? flips : 0, grab = inp[3]! > 0, duck = inp[4]! > 0;
    const live = mode === PLAY || mode === DEMO;
    if (mode === PLAY) S[TIME] = S[TIME]! + dt;
    if (mode === DONE) S[CARD] = S[CARD]! + dt;
    if (mode === DEMO && S[T]! > 7.5 && S[ST] === ROLL) S[MODE] = IDLE;
    const st = S[ST]!;
    // Speed: cruise, → pushes, ← drags; off the run it rolls to a stop.
    let v = S[SP]!;
    if (st === ROLL || st === GRIND) {
      const want = !live ? 0 : st === GRIND ? v : ax > 0 ? FAST : ax < 0 ? SLOW : CRUISE;
      v += (want - v) * (want > v ? 0.9 : live ? 1.6 : 2.2) * dt;
      if (!live && v < 0.5) v = 0;
    }
    if (mode === DONE && st === AIR) v -= v * dt;
    S[SP] = v;
    const x0 = S[X]!;
    let x = x0 + v * dt;
    S[X] = x;
    // Balls roll toward the rider once they are near.
    for (let i = 0; i < NO; i++) if (COURSE[i * 4] === BALL && BX[i]! - x < 150 && live) BX[i] = BX[i]! - BALLV * dt;
    if (st === ROLL) {
      S[DUCK] = duck ? 1 : 0;
      const h = surf(x);
      if (h < -1) return bail(1), true;
      const was = S[Y]!;
      S[Y] = h > 0 ? h : 0;
      // Off a ramp's lip: launch (an ollie on the lip goes higher).
      if (was > 3 && S[Y]! === 0 && S[LIP]! > 0) {
        (S[ST] = AIR), (S[VY] = S[LIP]! + (up ? 30 : 0)), (S[AIRT] = 0), (S[Y] = was);
        trick(S[LIP]! > 110 ? KICKN : SANDN), say(S[LIP]! > 110 ? 5 : 4);
        ev[EV_POP] = 1;
      } else if (up && live) (S[ST] = AIR), (S[VY] = POP + (S[Y]! > 0 ? 10 : 0)), (S[AIRT] = 0), (S[DUCK] = 0), (ev[EV_POP] = 1);
      S[LIP] = 0;
      for (let i = 0; i < NO; i++) {
        const k = COURSE[i * 4]!;
        if ((k === SAND || k === KICK) && x >= COURSE[i * 4 + 1]! && x <= COURSE[i * 4 + 2]!) S[LIP] = k === KICK ? 120 : 100;
      }
    } else if (st === AIR) {
      S[AIRT] = S[AIRT]! + dt;
      S[VY] = S[VY]! - GRAV * dt;
      const y0 = S[Y]!;
      let y = y0 + S[VY]! * dt;
      S[Y] = y;
      // Tricks: a flip (← heelflip, → varial, else kickflip) spins the board; GRAB held grabs it.
      if (flip && S[FLIPT]! <= 0 && S[GRABT]! <= 0 && y > 3) (S[FLIPT] = 0.36), (S[FLIPK] = FLIP + (ax < 0 ? 1 : ax > 0 ? 2 : 0));
      if (S[FLIPT]! > 0 && (S[FLIPT] = S[FLIPT]! - dt) <= 0) (S[FLIPT] = 0), trick(S[FLIPK]!);
      if (grab && S[FLIPT]! <= 0 && y > 3) {
        if (S[GRABT]! <= 0) S[GRABK] = GRABN + (ax < 0 ? 0 : ax > 0 ? 1 : 2);
        const g0 = S[GRABT]!;
        S[GRABT] = g0 + dt;
        if (g0 < 0.15 && S[GRABT]! >= 0.15) trick(S[GRABK]!);
        if (S[GRABT]! > 0.15 && cb.active) (S[ACC] = S[ACC]! + 60 * dt), S[ACC]! >= 1 && (cb.tick(1), (S[ACC] = S[ACC]! - 1));
      } else S[GRABT] = 0;
      // A guardrail under you on the way down: grind it.
      if (S[VY]! < 0) {
        for (let i = 0; i < NO; i++) {
          if (COURSE[i * 4] !== RAIL) continue;
          const a = COURSE[i * 4 + 1]!, b = COURSE[i * 4 + 2]!, h = COURSE[i * 4 + 3]!;
          if (x >= a && x <= b && y0 >= h && y < h) {
            if (S[FLIPT]! > 0) return bail(0), true;
            (S[ST] = GRIND), (S[Y] = h), (S[RAILN] = i), (S[GRABT] = 0);
            trick(S[CHAINF]! ? CHAIN : GRINDN), say(S[CHAINF]! ? 7 : 6);
            ev[EV_GRIND] = 1;
            OK[i] = 1;
            return true;
          }
        }
      }
      const h = surf(x);
      if (S[VY]! < 0 && y <= (h > 0 ? h : 0) && h > -1) {
        if (S[FLIPT]! > 0) return bail(0), true;
        (S[ST] = ROLL), (S[Y] = h > 0 ? h : 0), (S[GRABT] = 0);
        ev[EV_LAND] = 1;
        sp.burst(RX, DY - S[Y]!, 5, 26, -1.57, 2.8, 0.9, SANDP);
        bank();
      } else if (y < -2) return bail(1), true;
    } else if (st === GRIND) {
      const i = S[RAILN]!, b = COURSE[i * 4 + 2]!;
      S[ACC] = S[ACC]! + 50 * dt;
      if (S[ACC]! >= 1) cb.tick(1), (S[ACC] = S[ACC]! - 1);
      if ((S[T]! * 30) % 1 < 0.5) sp.burst(RX - 4, DY - S[Y]!, 1, 30, -2.4, 1, 0.8, SPARK);
      if (up && live) (S[ST] = AIR), (S[VY] = POP), (S[AIRT] = 0), (S[CHAINF] = 1), (ev[EV_POP] = 1);
      else if (x > b) (S[ST] = AIR), (S[VY] = 0), (S[AIRT] = 0), (S[CHAINF] = 1);
    } else {
      // A slam (tumble, then up again) or a fall into the sand under a gap (back up past it).
      S[SLAMT] = S[SLAMT]! + dt;
      S[SP] = st === FALL ? 0 : v - v * 3 * dt;
      if (st === FALL) S[Y] = S[Y]! > -16 ? S[Y]! - 60 * dt : -16;
      if (S[SLAMT]! > 1) {
        if (st === FALL) {
          let to = x;
          for (let i = 0; i < NO; i++) if (COURSE[i * 4] === GAP && x > COURSE[i * 4 + 1]! - 4 && x < COURSE[i * 4 + 2]! + 4) to = COURSE[i * 4 + 2]! + 4;
          S[X] = to;
        }
        (S[ST] = ROLL), (S[Y] = 0), (S[SP] = live ? CRUISE * 0.5 : 0);
      }
    }
    // Hits and clears against what the rider passes (stacks of barrels, the balls; rails from the side).
    const y = S[Y]!, top = y + (S[ST] === ROLL && S[DUCK] ? 8 : 17), sx = S[X]!;
    if (S[ST]! < SLAM) {
      for (let i = 0; i < NO; i++) {
        if (OK[i]) continue;
        const k = COURSE[i * 4]!, h = COURSE[i * 4 + 3]!;
        if (k === BARREL || k === RAIL) {
          const a = COURSE[i * 4 + 1]!, b = COURSE[i * 4 + 2]!;
          if (k === RAIL ? sx + HW > a && sx - HW < a + 1.5 && y < h - 1 : sx + HW > a && sx - HW < b && y < h) {
            OK[i] = 2;
            return bail(0), true;
          }
          if (sx - HW > b && k === BARREL) (OK[i] = 1), trick(HOP), say(0), (ev[EV_CLEAR] = 1);
          if (sx - HW > b && k === RAIL) OK[i] = 1;
        } else if (k === BALL) {
          const bx = BX[i]!, by = ballY(h, S[T]!);
          if (sx + HW > bx - BALLR && sx - HW < bx + BALLR && top > by && y < by + BALLR * 2) {
            OK[i] = 2;
            return bail(0), true;
          }
          if (sx - HW > bx + BALLR) (OK[i] = 1), S[ST] === ROLL ? (cb.add(DUCKN, PTS[DUCKN]!), bank(), say(2)) : (trick(BALLHOP), say(1)), (ev[EV_CLEAR] = 1);
        } else if (k === GAP && sx > (COURSE[i * 4 + 1]! + COURSE[i * 4 + 2]!) / 2 && S[ST] === AIR) (OK[i] = 1), trick(GAPN), say(3), (ev[EV_CLEAR] = 1);
        else if (k !== BALL && sx > COURSE[i * 4 + 2]!) OK[i] = 1;
      }
    }
    // The FINISH post.
    if (mode === PLAY && sx >= END) {
      if (S[ST] === ROLL) bank();
      (S[MODE] = DONE), (S[CARD] = 0);
      say(10);
      ev[EV_END] = 1;
      sp.burst(RX, DY - 30, 30, 60, -1.57, 3, 1.4, GOLD);
    }
    const busy = sp.step(dt, 120) + pops.step(dt);
    return live || S[SP]! > 0 || busy > 0 || S[ST] !== ROLL || (mode === DONE && S[CARD]! < 1.2);
  }
  return { S, I, ev, cb, sp, pops, step, OK, BX, surf };
}
export type Boardwalk = ReturnType<typeof boardwalk>;

export type BoardwalkScene = SlotScene & { engine: ReturnType<typeof createEngine>; run: Boardwalk; poster(): void; readonly state: { mode: number; st: number; x: number; score: number; time: number; bails: number; best: number } };

// Colour slots, read from the stage's skin (--bw-*): light (a pastel sunset) and dark (dusk).
const SKY = 0, SKY2 = 1, SKY3 = 2, SUN = 3, SEA = 4, SEA2 = 5, DECK = 6, DECK2 = 7, FACE = 8, SANDC = 9, RAILC = 10, INK = 11, PAPER = 12, TANK = 13, SHORTS = 14, SKIN = 15, HAIR = 16, VISOR = 17, BOARD = 18, BARRELC = 19, BALL1 = 20, BALL2 = 21, SHADE = 22, GOLDC = 23, GO = 24, HOT = 25, SHACK = 26, CLOUD = 27;
const VARS = ["sky", "sky2", "sky3", "sun", "sea", "sea2", "deck", "deck2", "face", "sand", "rail", "ink", "paper", "tank", "shorts", "skin", "hair", "visor", "board", "barrel", "ball1", "ball2", "shade", "gold", "go", "hot", "shack", "cloud"];
const DIST = Array.from({ length: 100 }, (_, i) => (i < 10 ? "0" : "") + i);
const fmt = (n: number) => n.toLocaleString("en-US");
const clock = (s: number) => {
  const t = Math.floor(s * 10), m = Math.floor(t / 600), r = t % 600;
  return `${m}:${r < 100 ? "0" : ""}${(r / 10) | 0}.${r % 10}`;
};

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): BoardwalkScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const skin = slot.querySelector<HTMLElement>("[data-bw]") ?? stage;
  const col = ["#2a1c4a", "#9a63ff", "#ff7389", "#ffc21a", "#1d3a6e", "#19f0ff", "#c8894a", "#9a5f34", "#5a3420", "#e8c890", "#f6f3ff", "#07060f", "#f6f3ff", "#ff2e88", "#19f0ff", "#ffd2a8", "#ffc21a", "#39ffb0", "#9a63ff", "#ff8a1f", "#ff2e88", "#f6f3ff", "rgba(7,6,15,.4)", "#ffc21a", "#39ffb0", "#ff8a1f", "#9fe8ff", "rgba(246,243,255,.5)"];
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "bw-play";
  play.setAttribute("aria-label", "Boardwalk Run: Space ollies, ↓ ducks, → pushes, ← slows, J flips, K grabs (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "bw-hud";
  hud.innerHTML = `<button type="button" class="bw-chip bw-mute" aria-label="Sound (M)" aria-pressed="true">♪</button><p class="bw-combo" hidden><span></span> <b></b> <em></em></p><div class="bw-bar"><b class="bw-chip"><small>DIST</small><span>99</span></b><b class="bw-chip"><small>TIME</small><span>0:00.0</span></b><b class="bw-chip"><small>SCORE</small><span>0</span></b></div><div class="bw-card" role="status" hidden></div>`;
  const [mute, comboEl, barEl, card] = hud.children as unknown as HTMLElement[];
  const [distTx, timeTx, scoreTx] = Array.from(barEl!.children, (c) => c.lastChild as HTMLElement);
  const [cStr, cMult, cVal] = comboEl!.children as unknown as HTMLElement[];
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", pop: "click", land: "power", grind: "fire", bail: "hurt", trick: "click", bank: "power", clear: "power", end: "win" }, volume: 0.1 });
  const c = controls(engine, { keys: { left: [], right: [], jump: [], flip: [], grab: [], duck: [] }, target: play });
  const JUMP = c.id("jump"), FLIPI = c.id("flip"), GRABI = c.id("grab"), DUCKI = c.id("duck");
  const keys = pad(engine, c, {
    scheme: "buttons",
    move: ["", "duck", "left", "right"],
    actions: [
      { intent: "jump", label: "OLLIE", name: "Ollie (Space)", key: "SPACE", role: "go" },
      { intent: "flip", label: "FLIP", name: "Flip trick (J)", key: "J", role: "attack" },
      { intent: "grab", label: "GRAB", name: "Grab (K)", key: "K", role: "advance", hold: true },
    ],
    host: stage,
  });
  keys.el.classList.add("bw-pad");
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowDown: "duck", KeyS: "duck", Space: "jump", ArrowUp: "jump", KeyW: "jump", Enter: "jump", KeyJ: "flip", KeyX: "flip", KeyK: "grab", KeyC: "grab" };
  const toggle = () => {
    snd.on = !snd.on;
    mute!.textContent = snd.on ? "♪" : "×";
    mute!.setAttribute("aria-pressed", "" + snd.on);
  };
  stage.addEventListener("keydown", (e) => {
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    const k = MAP[e.code];
    if (!k || e.metaKey || e.ctrlKey || e.altKey || (e.target as Element).closest?.(".bui-pad")) return;
    e.preventDefault();
    if (!e.repeat) c.press(k);
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const k = MAP[e.code];
    if (k) c.press(k, false);
  }, sig);
  play.addEventListener("pointerdown", (e) => (e.preventDefault(), play.focus({ preventScroll: true }), c.press("jump"), c.press("jump", false)), sig);
  mute!.addEventListener("click", toggle, sig);

  const I: Inputs = new Float64Array(6);
  const run = boardwalk((engine.random() * 2147483647) | 0, I, !first);
  const S = run.S, cb = run.cb;
  if (first) I[1] = 1;
  // [0] measure, [1] px per unit, [2] poster resolution, [3] keys hint (no pad on screen).
  const V = new Float64Array(4);
  V[0] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  let sky: CanvasGradient | string = col[SKY]!, sea: CanvasGradient | string = col[SEA]!;
  const was = new Float64Array(10).fill(-1);
  const DEB = [col[SANDC]!, col[GOLDC]!, col[GOLDC]!, col[SEA2]!];
  const POPC = [col[GO]!, col[HOT]!, col[GOLDC]!];
  const flash = new Float64Array(3);

  engine.add({
    read() {
      if (!V[0]) return;
      V[0] = 0;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      V[1] = canvas.width / W;
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue("--bw-" + VARS[i]).trim() || col[i]!;
      (DEB[0] = col[SANDC]!), (DEB[1] = DEB[2] = col[GOLDC]!), (DEB[3] = col[SEA2]!);
      (POPC[0] = col[GO]!), (POPC[1] = col[HOT]!), (POPC[2] = col[GOLDC]!);
      V[3] = keys.el.offsetParent ? 0 : 1;
      const s = g.createLinearGradient(0, 0, 0, 46);
      s.addColorStop(0, col[SKY]!), s.addColorStop(0.55, col[SKY2]!), s.addColorStop(1, col[SKY3]!);
      sky = s;
      const o = g.createLinearGradient(0, 46, 0, 64);
      o.addColorStop(0, col[SEA2]!), o.addColorStop(0.25, col[SEA]!);
      sea = o;
    },
    step(e, dt) {
      I[0] = c.axis("left", "right");
      if (c.hit(JUMP)) I[1] = I[1]! + 1;
      if (c.hit(FLIPI)) I[2] = I[2]! + 1;
      I[3] = c.down(GRABI) ? 1 : 0;
      I[4] = c.down(DUCKI) ? 1 : 0;
      if (run.step(dt)) e.busy();
      const ev = run.ev;
      flash[0] = Math.max(0, flash[0]! - dt);
      if (ev[EV_BAIL]) (flash[0] = 1.2), (flash[1] = 2);
      else if (ev[EV_BANK]) (flash[0] = 1.2), (flash[1] = 1), (flash[2] = cb.S[5]!);
      if (flash[0]) e.busy();
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_BAIL]) e.events.emit("bail");
      else if (ev[EV_GRIND]) e.events.emit("grind");
      else if (ev[EV_CLEAR]) e.events.emit("clear");
      else if (ev[EV_BANK]) e.events.emit("bank");
      else if (ev[EV_TRICK]) e.events.emit("trick");
      else if (ev[EV_POP]) e.events.emit("pop");
      else if (ev[EV_LAND]) e.events.emit("land");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      g.setTransform(V[1]!, 0, 0, V[1]!, 0, 0);
      const mode = S[MODE]!, cam = S[X]! - RX;
      g.lineJoin = g.lineCap = "round";
      // Sky, the setting sun (striped where the haze cuts it), clouds; the sea with glints.
      g.fillStyle = sky;
      g.fillRect(0, 0, W, 47);
      g.fillStyle = col[SUN]!;
      g.beginPath();
      g.arc(116, 46, 15, Math.PI, 0);
      g.fill();
      g.fillStyle = col[SKY3]!;
      for (let k = 0; k < 4; k++) g.fillRect(100, 36 + k * 2.6, 32, 0.5 + k * 0.35);
      g.fillStyle = col[CLOUD]!;
      for (let k = 0; k < 4; k++) {
        const cx = ((((k * 53 - cam * 0.04) % 200) + 200) % 200) - 20, cy = 10 + ((k * 7) % 17);
        g.beginPath();
        g.roundRect(cx, cy, 22 + (k % 2) * 10, 3.2, 1.6);
        g.roundRect(cx + 5, cy - 2.4, 11, 3, 1.5);
        g.fill();
      }
      g.fillStyle = sea;
      g.fillRect(0, 46, W, 18);
      g.fillStyle = col[SEA2]!;
      for (let k = 0; k < 14; k++) {
        const gx = ((((k * 37 - cam * 0.15) % 180) + 180) % 180) - 10, gy = 49 + ((k * 5) % 13);
        g.fillRect(gx, gy, 3 + (k % 3) * 2, 0.6);
      }
      g.fillStyle = col[SUN]!;
      g.globalAlpha = 0.5;
      for (let k = 0; k < 5; k++) g.fillRect(116 - 12 + k * 2.5, 48 + k * 2.4, 24 - k * 5, 0.8);
      g.globalAlpha = 1;
      // The back guardrail along the deck's far edge (posts every 16, two rails).
      g.fillStyle = col[DECK]!;
      g.fillRect(0, 63, W, DY - 63);
      g.fillStyle = col[DECK2]!;
      for (let k = -1; k < 12; k++) {
        const px = k * 16 - (cam % 16);
        g.fillRect(px, 63, 0.5, DY - 63);
      }
      g.fillStyle = col[RAILC]!;
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.6;
      for (let k = -1; k < 12; k++) {
        const px = k * 16 - (cam % 16);
        g.fillRect(px, 54, 1.2, 9.5);
      }
      g.fillRect(0, 54, W, 1.4);
      g.fillRect(0, 58.5, W, 0.9);
      g.fillStyle = col[SHADE]!;
      g.fillRect(0, 55.4, W, 0.4);
      // The deck's front face and the beach under it (pilings scroll with the deck).
      g.fillStyle = col[FACE]!;
      g.fillRect(0, DY, W, 6);
      g.fillStyle = col[SANDC]!;
      g.fillRect(0, DY + 6, W, H - DY - 6);
      g.fillStyle = col[FACE]!;
      for (let k = -1; k < 8; k++) g.fillRect(k * 24 - (cam % 24) + 6, DY + 6, 3, H - DY - 6);
      g.fillStyle = col[SHADE]!;
      g.fillRect(0, DY + 6, W, 1.6);
      g.fillStyle = col[INK]!;
      g.fillRect(0, DY - 0.4, W, 0.8);
      // The course (what is on screen).
      for (let i = 0; i < NO; i++) {
        const k = COURSE[i * 4]!, a = (k === BALL ? run.BX[i]! : COURSE[i * 4 + 1]!) - cam, b = k === BALL ? a + 8 : COURSE[i * 4 + 2]! - cam, h = COURSE[i * 4 + 3]!;
        if (b < -10 || a > W + 10) continue;
        if (k === GAP) {
          g.fillStyle = col[SANDC]!;
          g.fillRect(a, 63, b - a, DY + 6 - 63);
          g.fillStyle = col[SHADE]!;
          g.fillRect(a, 63, b - a, 3);
          g.fillRect(a, DY, 1.2, 6);
          g.fillStyle = col[DECK2]!;
          g.beginPath();
          g.moveTo(a, 63), g.lineTo(a + 1.6, 66), g.lineTo(a, 69), g.lineTo(a + 2, DY), g.lineTo(a, DY + 6), g.lineTo(a - 0.1, 63);
          g.moveTo(b, 63), g.lineTo(b - 2, 65.5), g.lineTo(b, 68), g.lineTo(b - 1.4, DY + 2), g.lineTo(b, DY + 6), g.lineTo(b + 0.1, 63);
          g.fill();
          g.fillStyle = col[INK]!;
          g.fillRect(a - 0.6, DY - 0.4, 0.6, 6.4), g.fillRect(b, DY - 0.4, 0.6, 6.4);
        } else if (k === SAND || k === KICK) {
          g.fillStyle = col[SHADE]!;
          g.beginPath();
          g.moveTo(a + 1, DY), g.lineTo(b + 1, DY - h + 1), g.lineTo(b + 1, DY);
          g.fill();
          g.fillStyle = k === SAND ? col[SANDC]! : col[DECK]!;
          g.beginPath();
          if (k === SAND) g.moveTo(a - 3, DY), g.quadraticCurveTo(a + 4, DY, b, DY - h), g.lineTo(b + 3, DY);
          else g.moveTo(a, DY), g.lineTo(b, DY - h), g.lineTo(b, DY);
          g.closePath();
          g.fill();
          g.lineWidth = 0.8;
          g.stroke();
          if (k === KICK) {
            g.fillStyle = col[DECK2]!;
            for (let p = 1; p < 4; p++) g.fillRect(a + ((b - a) * p) / 4, DY - (h * p) / 4, 0.5, (h * p) / 4);
            g.fillStyle = col[INK]!;
            g.fillRect(b - 0.4, DY - h - 0.4, 1, h + 0.4);
          } else {
            g.fillStyle = col[SHADE]!;
            for (let p = 0; p < 6; p++) g.fillRect(a + 4 + p * 3.6, DY - 1.4 - ((p * 7) % 3) - (h * p) / 8, 0.7, 0.7);
          }
        } else if (k === RAIL) {
          // A guardrail section across the walk: posts, a top bar, a hard shadow.
          g.fillStyle = col[SHADE]!;
          g.fillRect(a + 1, DY - h + 1, b - a, 1.6);
          for (let p = a; p <= b; p += (b - a) / Math.round((b - a) / 14)) {
            g.fillStyle = col[RAILC]!;
            g.fillRect(p - 0.7, DY - h, 1.4, h);
            g.strokeRect(p - 0.7, DY - h, 1.4, h);
          }
          g.fillStyle = col[RAILC]!;
          g.fillRect(a - 1, DY - h - 1.4, b - a + 2, 2);
          g.lineWidth = 0.7;
          g.strokeRect(a - 1, DY - h - 1.4, b - a + 2, 2);
          g.fillStyle = col[RAILC]!;
          g.fillRect(a, DY - h * 0.45, b - a, 0.9);
        } else if (k === BARREL) {
          // A stack of barrels: two side by side under one (or a tall stack of three).
          const rows = h > 10 ? 3 : 2;
          for (let r = 0; r < rows; r++) {
            const bh = h / rows, by = DY - bh * (r + 1);
            g.fillStyle = col[SHADE]!;
            g.fillRect(a + 1, by + 1, b - a, bh);
            g.fillStyle = r % 2 ? col[HOT]! : col[BARRELC]!;
            g.beginPath();
            g.roundRect(a, by, b - a, bh, 1);
            g.fill();
            g.lineWidth = 0.7;
            g.stroke();
            g.fillStyle = col[INK]!;
            g.fillRect(a, by + bh * 0.28, b - a, 0.5);
            g.fillRect(a, by + bh * 0.68, b - a, 0.5);
          }
        } else {
          // A beach ball: rolling low (spins), or skipping high in big arcs.
          const by = DY - ballY(h, S[T]!) - BALLR, rot = (run.BX[i]! * -0.25) % TAU;
          g.fillStyle = col[SHADE]!;
          g.beginPath();
          g.ellipse(a + 0.5, DY - 0.3, BALLR * (1 - ballY(h, S[T]!) / 40), 0.8, 0, 0, TAU);
          g.fill();
          for (let s = 0; s < 4; s++) {
            g.fillStyle = s % 2 ? col[BALL2]! : s ? col[SUN]! : col[BALL1]!;
            g.beginPath();
            g.moveTo(a, by);
            g.arc(a, by, BALLR, rot + (s * TAU) / 4, rot + ((s + 1) * TAU) / 4);
            g.fill();
          }
          g.lineWidth = 0.7;
          g.beginPath();
          g.arc(a, by, BALLR, 0, TAU);
          g.stroke();
          g.fillStyle = col[PAPER]!;
          g.beginPath();
          g.arc(a, by, 1, 0, TAU);
          g.fill();
        }
      }
      // The FINISH post and the beach shack beside it.
      const fx = END - cam;
      if (fx < W + 80) {
        const hx = fx + 22;
        g.fillStyle = col[SHADE]!;
        g.fillRect(hx + 2, 24, 56, DY - 24);
        g.fillStyle = col[SHACK]!;
        g.fillRect(hx, 22, 56, DY - 22);
        g.lineWidth = 0.8;
        g.strokeRect(hx, 22, 56, DY - 22);
        g.fillStyle = col[PAPER]!;
        g.fillRect(hx - 2, 16, 60, 6);
        g.strokeRect(hx - 2, 16, 60, 6);
        g.fillStyle = col[HOT]!;
        for (let k = 0; k < 10; k++) g.fillRect(hx - 2 + k * 6, 16, 3, 6);
        g.fillStyle = col[INK]!;
        g.fillRect(hx - 2, 22, 60, 0.8);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
          g.fillStyle = col[SUN]!;
          g.fillRect(hx + 6 + k * 17, 28 + r * 18, 10, 9);
          g.strokeRect(hx + 6 + k * 17, 28 + r * 18, 10, 9);
        }
        g.fillStyle = col[DECK2]!;
        g.fillRect(hx + 24, DY - 12, 8, 12);
        g.font = FONT[4]!;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = col[PAPER]!;
        g.fillRect(hx + 10, 8, 36, 7);
        g.strokeRect(hx + 10, 8, 36, 7);
        g.fillStyle = col[INK]!;
        g.fillText("SHORE SHACK", hx + 28, 11.7);
        // The post: tall, striped, with a banner.
        g.fillStyle = col[SHADE]!;
        g.fillRect(fx + 1, 12, 2.4, DY - 12);
        g.fillStyle = col[PAPER]!;
        g.fillRect(fx - 1.2, 10, 2.4, DY - 10);
        g.fillStyle = col[HOT]!;
        for (let k = 0; k < 7; k++) g.fillRect(fx - 1.2, 12 + k * 8, 2.4, 4);
        g.strokeRect(fx - 1.2, 10, 2.4, DY - 10);
        g.fillStyle = col[GO]!;
        g.beginPath();
        g.moveTo(fx + 1.2, 10), g.lineTo(fx + 21, 10), g.lineTo(fx + 18, 15), g.lineTo(fx + 21, 20), g.lineTo(fx + 1.2, 20);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = col[INK]!;
        g.font = FONT[4]!;
        g.fillText("FINISH", fx + 10, 15.2);
      }
      rider();
      // Sand, sparks, splashes.
      const p = run.sp;
      for (let i = 0; i < p.n; i++) {
        const l = p.L[i]!;
        if (l <= 0) continue;
        g.globalAlpha = Math.min(1, (l / p.M[i]!) * 1.6);
        g.fillStyle = DEB[p.K[i]!]!;
        const s = p.S[i]!;
        g.fillRect(p.X[i]! - s / 2, p.Y[i]! - s / 2, s, s);
      }
      g.globalAlpha = 1;
      // Pop words over the rider.
      const w = run.pops;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = FONT[5]!;
      for (let i = 0; i < w.N; i++) {
        const t = w.T[i]!;
        if (t >= 1.1) continue;
        const sc = t < 0.1 ? 1.6 - t * 6 : 1;
        g.save();
        g.globalAlpha = t > 0.8 ? (1.1 - t) / 0.3 : 1;
        g.translate(w.X[i]!, w.Y[i]! - t * 7);
        g.rotate(-0.07);
        g.scale(sc, sc);
        g.lineWidth = 1.8;
        g.strokeStyle = col[INK]!;
        g.strokeText(w.list[w.I[i]!]!, 0, 0);
        g.fillStyle = POPC[w.K[i]!]!;
        g.fillText(w.list[w.I[i]!]!, 0, 0);
        g.restore();
      }
      g.globalAlpha = 1;
      if (mode === IDLE || (mode === DEMO && S[T]! > 6)) {
        caption("BOARDWALK RUN", 22, 12, col[PAPER]!);
        caption(V[3] ? "SPACE OLLIE · ↓ DUCK · J FLIP · K GRAB" : "TAP OLLIE TO DROP IN", 33, 5, col[GOLDC]!);
      }
      // The bottom bar and the combo line: written only when what they show changes.
      const d = Math.max(0, Math.min(99, Math.ceil(((END - S[X]!) / END) * 99)));
      const dd = mode === PLAY || mode === DONE ? d : 99;
      if (dd !== was[0]) (was[0] = dd), (distTx!.textContent = DIST[dd]!);
      const tt = Math.floor(S[TIME]! * 10);
      if (tt !== was[1]) (was[1] = tt), (timeTx!.textContent = clock(S[TIME]!));
      const sc = cb.score | 0;
      if (sc !== was[2]) (was[2] = sc), (scoreTx!.textContent = fmt(sc));
      const show = cb.active ? 1 : flash[0]! > 0 ? 1 + flash[1]! : 0, v = show === 1 ? cb.value : show === 2 ? flash[2]! : 0;
      if (cb.ver !== was[4] || show !== was[5]) {
        (was[4] = cb.ver), (was[5] = show), (was[7] = -1);
        comboEl!.hidden = !show;
        comboEl!.className = "bw-combo" + (show === 2 ? " bw-bank" : show === 3 ? " bw-bail" : "");
        cStr!.textContent = show === 1 ? cb.text() : show === 2 ? "BANKED" : "BAIL";
        cMult!.textContent = show === 1 ? "×" + cb.mult : "";
      }
      if (v !== was[7]) (was[7] = v), (cVal!.textContent = show === 3 ? "" : (show === 2 ? "+" : "") + fmt(v));
      const cd = mode === DONE && S[CARD]! > 0.8 ? 1 : 0;
      if (cd !== was[8]) {
        was[8] = cd;
        card!.hidden = !cd;
        if (cd) card!.innerHTML = `<small>FINISH</small><b>${fmt(cb.score)}</b><p>TIME <strong>${clock(S[TIME]!)}</strong> · ${S[BAILS]} BAIL${S[BAILS] === 1 ? "" : "S"}</p><p>BEST COMBO <strong>${fmt(cb.best)}</strong></p><p class="bw-best">${cb.best ? cb.text(true) : "Land a trick to bank a combo"}</p><p class="bw-again">OLLIE TO RUN IT AGAIN</p>`;
      }
    },
  });
  function caption(s: string, y: number, size: number, fill: string) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = FONT[size]!;
    g.lineWidth = size / 3;
    g.strokeStyle = col[INK]!;
    g.strokeText(s, W / 2, y);
    g.fillStyle = fill;
    g.fillText(s, W / 2, y);
  }
  /** The rider: a skater in a sun visor and a tank top, ponytail flying, on a board that flips and grabs. */
  function rider() {
    const st = S[ST]!, y = DY - S[Y]!, fl = S[FLIPT]!, k = S[FLIPK]!, grab = S[GRABT]! > 0;
    const crouch = st === ROLL && S[DUCK] ? 1 : grab ? 0.8 : st === GRIND ? 0.4 : st === AIR ? 0.3 : 0;
    g.save();
    g.translate(RX, y);
    if (st === ROLL) {
      const sl = run.surf(S[X]!) > 0 ? -0.3 : 0;
      g.rotate(sl);
    }
    if (st === SLAM) g.rotate(Math.min(1.5, S[SLAMT]! * 5));
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    // Shadow on the deck.
    if (st !== FALL) {
      g.fillStyle = col[SHADE]!;
      g.beginPath();
      g.ellipse(0, S[Y]! - (st === GRIND ? S[Y]! - COURSE[S[RAILN]! * 4 + 3]! : 0) + 0.4 - (st === AIR ? 0 : 0), 6 - Math.min(4, S[Y]! / 6), 0.8, 0, 0, TAU);
      g.fill();
    }
    // The board: flips (kickflip / heelflip turn it over; the varial spins it flat), lifts with a grab.
    const a = fl > 0 ? (1 - fl / 0.36) * TAU : 0, th = k === 2 ? 1 : Math.cos(a), wd = k === 2 && fl > 0 ? Math.cos(a) : 1;
    const bx = st === SLAM ? 5 + S[SLAMT]! * 16 : 0, by = st === SLAM ? -2 - Math.sin(Math.min(3, S[SLAMT]! * 6)) * 4 : grab ? -4 : fl > 0 ? -4.5 : -2;
    g.fillStyle = th >= 0 ? col[BOARD]! : col[GOLDC]!;
    g.beginPath();
    g.roundRect(bx - 6.5 * wd, by - 0.8 * Math.abs(th) - 0.3, 13 * wd, 1.6 * Math.abs(th) + 0.6, 0.8);
    g.fill();
    g.stroke();
    if (Math.abs(th) > 0.5) {
      g.fillStyle = col[INK]!;
      g.beginPath();
      g.arc(bx - 4 * wd, by + 1.5 * th, 1, 0, TAU);
      g.arc(bx + 4 * wd, by + 1.5 * th, 1, 0, TAU);
      g.fill();
    }
    // Legs (shorts over skin), the tank top, arms out for balance, head, visor, ponytail.
    const hip = -8 + crouch * 3.4, sh = -15 + crouch * 5.6, ft = st === SLAM ? -1 : by - 1;
    g.lineWidth = 1.5;
    g.strokeStyle = col[SKIN]!;
    g.beginPath();
    g.moveTo(-3.2, ft), g.lineTo(-1.8 - crouch * 1.6, hip + 2.4), g.moveTo(3.2, ft), g.lineTo(2 + crouch * 1.6, hip + 2.4);
    g.stroke();
    g.fillStyle = col[SHORTS]!;
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.7;
    g.beginPath();
    g.roundRect(-3.2 - crouch, hip - 0.6, 6.4 + crouch * 2, 3.6, 1);
    g.fill();
    g.stroke();
    g.fillStyle = col[TANK]!;
    g.beginPath();
    g.roundRect(-2.6, sh, 5.2, hip - sh, 1.4);
    g.fill();
    g.stroke();
    g.lineWidth = 1.2;
    g.strokeStyle = col[SKIN]!;
    g.beginPath();
    if (grab) g.moveTo(1.4, sh + 1.6), g.lineTo(S[GRABK] === 3 ? 5 : S[GRABK] === 4 ? -4.6 : 1.5, by - 0.8);
    else g.moveTo(1.4, sh + 1.6), g.lineTo(5.6, sh + (st === AIR ? -2 : 3));
    g.moveTo(-1.4, sh + 1.6), g.lineTo(-5.8, sh + (st === GRIND ? -1 : st === AIR ? -3 : 4));
    g.stroke();
    g.lineWidth = 0.7;
    g.strokeStyle = col[INK]!;
    // Ponytail: streams back with speed and air.
    g.fillStyle = col[HAIR]!;
    const wave = Math.sin(S[T]! * 14) * 0.8, back = 3 + Math.min(3, S[SP]! / 20);
    g.beginPath();
    g.moveTo(-1.5, sh - 4.2), g.quadraticCurveTo(-back - 1, sh - 4 + wave, -back - 2.4, sh - 1.4 + wave), g.lineTo(-1.6, sh - 2.4);
    g.fill();
    g.stroke();
    g.fillStyle = col[SKIN]!;
    g.beginPath();
    g.arc(0.4, sh - 3, 2.6, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = col[HAIR]!;
    g.beginPath();
    g.arc(0.4, sh - 3.3, 2.65, 3.4, 5.6);
    g.fill();
    // The visor: band and a long bill.
    g.fillStyle = col[VISOR]!;
    g.fillRect(-2, sh - 5, 4.6, 1.1);
    g.beginPath();
    g.moveTo(2.4, sh - 5), g.lineTo(5.8, sh - 4.1), g.lineTo(2.4, sh - 3.9);
    g.fill();
    g.stroke();
    g.fillStyle = col[INK]!;
    g.fillRect(1.9, sh - 3, 0.7, 0.8);
    g.restore();
  }

  engine.start();
  return {
    engine,
    accessible: true,
    run,
    get state() {
      return { mode: S[MODE]!, st: S[ST]!, x: S[X]!, score: cb.score, time: S[TIME]!, bails: S[BAILS]!, best: cb.best };
    },
    poster: () => ((V[2] = 0.6), (V[0] = 1)),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, mid-launch off the first sand ramp. */
export const posterAt = 5.6;
