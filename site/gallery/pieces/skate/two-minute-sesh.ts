// "Two-Minute Sesh" (skate-sesh, hero): a side-on park run against the clock (45 s, the name is the
// park's). Quarter pipes at both ends, a kicker over the pit, a funbox, a rail. ← → push, OLLIE
// jumps; in the air FLIP and GRAB do tricks (← / → with them picks which); land on the rail to grind
// and hold GRAB as you land to manual: both keep a balance meter you steer with ← →. Tricks chain into
// a combo (points × tricks); landing banks it, a slam loses it. Banked points fill the special meter:
// full, the board glows and FLIP + GRAB together throws the FIZZ FLIP. Named gaps pop as callouts;
// F-I-Z-L-E-T floats around the park, and all six is a bonus. Then the score card and its best combo.
// Bricks: the kernel (fixed step; settle; its ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/slot, @fzlt/core/sound, @fzlt/core/input (intents) and
// @fzlt/core/pad (the touch keys). The scoring is combo.ts (a brick candidate). The run is `sesh()`,
// plain numbers, no DOM (tests/skate-sesh.test.mjs: zero allocation).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import { controls } from "../../../../src/input";
import { pad } from "../../../../src/pad";
import { sound } from "../../../../src/sound";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { combo } from "./combo";
import { DEMO, DONE, FONT, H, IDLE, PLAY, TAU, W, spray } from "./kit";

export const ROUND = 45;
/** Tricks and gaps, by combo id, and their base points. */
export const NAMES = ["KICKFLIP", "HEELFLIP", "TRE FLIP", "INDY", "MELON", "STALEFISH", "50-50", "5-0", "NOSEGRIND", "MANUAL", "FIZZ FLIP", "PIT GAP", "FUNBOX GAP", "BOX TO RAIL", "RAIL TO RAMP", "AIR 180"];
const PTS = [100, 100, 200, 120, 120, 180, 80, 120, 120, 60, 900, 250, 200, 300, 300, 50];
const FLIP_T = [0.34, 0.34, 0.5];
export const KICK = 0, GRAB = 3, GRIND = 6, MANUAL = 9, FIZZ = 10, PIT_GAP = 11, BOX_GAP = 12, BOX_RAIL = 13, RAIL_RAMP = 14, AIR180 = 15;
/** Callouts: the gaps (by combo id − 11), then these. */
const CALLS = ["PIT GAP", "FUNBOX GAP", "BOX TO RAIL", "RAIL TO RAMP", "BAIL!", "FIZLET! +2000", "FIZZ FLIP!", "TIME!", "F", "I", "Z", "L", "E", "T", "SPECIAL READY"];
const C_BAIL = 4, C_FIZLET = 5, C_FIZZ = 6, C_TIME = 7, C_LETTER = 8, C_SPECIAL = 14;

// The park, in art units (160 × 90; up is +h above the floor at GY). Quarter pipes of radius QR,
// cut at 80° (the lip, LX / RX), decks QH high; a kicker K0..K1 into the pit P0..P1; the funbox
// F0..F3 (kickers, top FH); the rail R0..R1 at RH.
export const GY = 80;
const QR = 22, CL = 25, CR = 135, LX = CL - QR * 0.9848, RX = CR + QR * 0.9848, QH = QR * (1 - 0.1736);
const K0 = 27, K1 = 35, KH = 6, P0 = 35, P1 = 47, PD = 8, F0 = 60, F1 = 70, F2 = 84, F3 = 94, FH = 8;
export const R0 = 101, R1 = 124, RH = 11;
/** The letters: x, height. */
export const LETTERS = [7, 34, 41, 22, 77, 25, 112, 24, 153, 34, 54, 17];
const GRAV = 300, POP = 90, PUSH = 100, VMAX = 62, RAMP = 0.3;
/** Rider states. */
export const ROLL = 0, AIR = 1, RAIL = 2, MAN = 3, SLAM = 4;
// State slots.
const MODE = 0, T = 1, LEFT = 2, X = 3, Y = 4, VX = 5, VY = 6, SP = 7, ST = 8, FACE = 9, FLIPT = 10, FLIPD = 11, FLIPK = 12, GRABK = 13, BAL = 14, BALV = 15, BALT = 16, TX = 17, TK = 18, SLAMT = 19, LET = 20, CARD = 21, TURN = 22, CALL = 23, CALLT = 24, GAPS = 25, QAIR = 26, ENDING = 27, LEAN = 28, TRICKS = 29, BAILS = 30, WAS = 31, AIRT = 32, PEAK = 33, GPREV = 34, ACC = 35, DT = 36, AX = 37;
/** Inputs (`I`): [0] ← → axis, [1] ollie presses, [2] flip presses, [3] grab held. */
export type Inputs = Float64Array;
/** Events this step: start, ollie, land, grind, bail, trick, letter, gap, end, bank. */
export const EV_START = 0, EV_POP = 1, EV_LAND = 2, EV_GRIND = 3, EV_BAIL = 4, EV_TRICK = 5, EV_LETTER = 6, EV_GAP = 7, EV_END = 8, EV_BANK = 9;
const DUST = 0, SPARK = 1, GOLD = 2;

/** The floor under x: its height (pit: −PD) into G[0], its slope into G[1]. Returns nothing: a
 *  double returned from a call that is not inlined is a new heap number. */
export function ground(G: Float64Array) {
  const x = G[2]!;
  // Straight into G: a local that starts as 0 and takes a fraction is a heap number in some tiers.
  G[1] = 0;
  if (x < LX) G[0] = QH;
  else if (x < CL) {
    const d = CL - x, q = Math.sqrt(QR * QR - d * d);
    (G[0] = QR - q), (G[1] = -d / q);
  } else if (x > RX) G[0] = QH;
  else if (x > CR) {
    const d = x - CR, q = Math.sqrt(QR * QR - d * d);
    (G[0] = QR - q), (G[1] = d / q);
  } else if (x >= K0 && x < K1) (G[1] = KH / (K1 - K0)), (G[0] = (x - K0) * G[1]!);
  else if (x >= P0 && x < P1) G[0] = -PD;
  else if (x >= F0 && x < F1) (G[1] = FH / (F1 - F0)), (G[0] = (x - F0) * G[1]!);
  else if (x >= F1 && x < F2) G[0] = FH;
  else if (x >= F2 && x < F3) (G[1] = -FH / (F3 - F2)), (G[0] = FH + (x - F2) * G[1]!);
  else G[0] = 0;
}
const inPit = (x: number) => x >= P0 && x < P1;

export function sesh(seed: number, I: Inputs, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(40), ev = new Uint8Array(10), G = new Float64Array(3);
  const cb = combo(NAMES);
  const sp = spray(160, R);
  // The ghost's inputs (the attract run).
  const D = new Float64Array(4);
  S[MODE] = demo ? DEMO : IDLE;
  S[CALLT] = 9;
  const place = (x: number) => ((S[X] = x), (((G[2] = x), ground(G)), (S[Y] = G[0]!)), (S[SP] = 0), (S[ST] = ROLL), (S[FACE] = 1), (S[TURN] = 1));
  place(demo ? 12 : 53);
  function call(w: number) {
    (S[CALL] = w), (S[CALLT] = 0);
  }
  function trick(id: number) {
    const p = cb.add(id, PTS[id]!);
    S[TRICKS] = S[TRICKS]! + 1;
    ev[EV_TRICK] = 1;
    sp.burst(S[X]!, GY - S[Y]! - 8, 4 + (p >> 6), 40, -1.57, 2.4, 1.1, GOLD);
  }
  function bail() {
    if (cb.full) S[WAS] = 1;
    const lost = cb.bail();
    (S[ST] = SLAM), (S[SLAMT] = 0), (S[FLIPT] = 0), (S[GRABK] = 0), (S[BAILS] = S[BAILS]! + 1);
    call(C_BAIL);
    ev[EV_BAIL] = 1;
    sp.burst(S[X]!, (((G[2] = S[X]!), ground(G)), GY - (S[Y]! > G[0]! ? S[Y]! : G[0]!)), 12 + Math.min(20, lost >> 6), 46, -1.57, 2.6, 1.4, DUST);
  }
  function bank() {
    if (!cb.active) return;
    const was = cb.full, v = cb.bank();
    if (v) ev[EV_BANK] = 1;
    if (cb.full && !was) call(C_SPECIAL);
  }
  /** Takeoff: where from (0 floor, 1 funbox, 2 rail, 3 quarter pipe). */
  /** Takeoff with S[VX], S[VY] already set (numbers in slots, never as arguments: a double passed to a
   *  call that is not inlined is a new heap number). */
  function launch(from: number) {
    (S[ST] = AIR), (S[TX] = S[X]!), (S[TK] = from), (S[QAIR] = from === 3 ? 1 : 0), (S[AIRT] = 0), (S[PEAK] = S[Y]!);
  }
  /** Points by the second (grind, manual, grab), handed to the combo a whole point at a time. */
  function pts(rate: number) {
    S[ACC] = S[ACC]! + rate * S[DT]!;
    while (S[ACC]! >= 1) (S[ACC] = S[ACC]! - 1), cb.tick(1);
  }
  function gap(id: number) {
    S[GAPS] = S[GAPS]! + 1;
    trick(id);
    call(id - PIT_GAP);
    ev[EV_GAP] = 1;
  }
  function start() {
    (S[MODE] = PLAY), (S[T] = 0), (S[LEFT] = ROUND), (S[LET] = 0), (S[GAPS] = 0), (S[TRICKS] = 0), (S[BAILS] = 0), (S[ENDING] = 0), (S[WAS] = 0);
    cb.reset();
    if (S[ST] === SLAM || S[ST] === AIR) place(53);
    ev[EV_START] = 1;
  }
  /** The ghost: drops in, grabs over the pit, ollies the funbox, kickflips off the right lip, then grinds the rail back. */
  function ghost() {
    const x = S[X]!, st = S[ST]!, tk = S[TK]!, f = S[FACE]!;
    (D[0] = st === RAIL || st === MAN ? -Math.sign(S[BAL]! + S[BALV]! * 0.4) : st === ROLL && S[T]! < 5 ? f : 0), (D[1] = D[2] = 0);
    if ((st === ROLL && ((f > 0 && ((x > 28 && x < 30) || (x > 63 && x < 65))) || (f < 0 && x > 134 && x < 136)))) D[1] = 1;
    if (st === AIR && S[FLIPT]! <= 0 && S[AIRT]! > 0.04 && S[AIRT]! < 0.08 && tk === 3) D[2] = 1;
    D[3] = st === AIR && tk < 2 && S[AIRT]! > 0.04 && S[VY]! > -50 ? 1 : 0;
    return D;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    S[CALLT] = S[CALLT]! + dt;
    let mode = S[MODE]!;
    const ups = I[1]!;
    I[1] = 0;
    const flips = I[2]!;
    I[2] = 0;
    if (ups > 0 && (mode === IDLE || mode === DEMO || (mode === DONE && S[CARD]! > 1))) return start(), true;
    const inp = mode === DEMO ? ghost() : mode === PLAY ? I : D.fill(0);
    const ax = inp[0]!;
    (S[DT] = dt), (S[AX] = ax);
    const up = mode === DEMO ? inp[1]! : mode === PLAY ? ups : 0, flip = mode === DEMO ? inp[2]! : mode === PLAY ? flips : 0, grab = inp[3]! > 0;
    const st = S[ST]!;
    let x = S[X]!, y = S[Y]!;
    if (st === ROLL || st === MAN) {
      ((G[2] = x), ground(G));
      const sl = G[1]!, c = 1 / Math.sqrt(1 + sl * sl);
      let s = S[SP]!;
      s -= GRAV * RAMP * sl * c * dt;
      if (st === ROLL && ax && Math.abs(sl) < 0.3 && s * ax < VMAX) (s += ax * PUSH * dt), (S[LEAN] = ax);
      s -= s * (mode === PLAY || (mode === DEMO && S[T]! < 5) ? (st === MAN ? 0.5 : 0.18) : 1.6) * dt;
      if (Math.abs(s) > VMAX * 1.2) s *= 1 - 2 * dt;
      if (Math.abs(s) < 0.6 && Math.abs(sl) < 0.01 && !ax) s = 0;
      if (Math.abs(s) > 4) S[FACE] = Math.sign(s);
      S[SP] = s;
      let nx = x + s * c * dt;
      nx = nx < 1 ? 1 : nx > 159 ? 159 : nx; // clamps by hand: Math.min/max box doubles in a step
      ((G[2] = nx), ground(G));
      const h1 = G[0]!, sl1 = G[1]!, dir = Math.sign(s);
      if (st === ROLL && grab && !S[GPREV] && Math.abs(sl) < 0.05 && Math.abs(s) > 10) (S[ST] = MAN), (S[BAL] = 0), (S[BALV] = (R() - 0.5) * 0.6), (S[BALT] = 0), trick(MANUAL);
      if (up > 0) {
        // Ollie: the board's way along the floor, and up.
        const vx = s * c;
        x = nx;
        ((S[VX] = vx), (S[VY] = vx * sl * 0.4 + POP), launch(x >= F0 && x < F3 ? 1 : 0));
        if (st === MAN) S[TK] = 0;
        y = h1;
        ev[EV_POP] = 1;
        sp.burst(x, GY - y, 4, 20, -2.6, 0.8, 1, DUST);
      } else if (inPit(nx)) ((S[VX] = s * c), (S[VY] = s * c * sl), launch(0)), (x = nx);
      else if ((x >= LX && nx < LX) || (x <= RX && nx > RX)) {
        // Over the coping: straight up, drifting back over the ramp, and turning in the air.
        x = nx < LX ? LX + 0.2 : RX - 0.2;
        ((S[VX] = -dir * 7), (S[VY] = Math.abs(s) + 70), launch(3));
        sp.burst(x, GY - y, 6, 40, -1.57, 1, 0.9, SPARK);
      } else if (Math.atan(sl * dir) - Math.atan(sl1 * dir) > 0.3 && Math.abs(s) > 40) ((S[VX] = s * c), (S[VY] = s * c * sl + 8), launch(x >= F0 - 4 && x < F3 ? 1 : 0)), (x = nx);
      else (x = nx), (y = h1);
      if (S[ST] === MAN) {
        pts(40);
        if (!grab || Math.abs(sl1) > 0.05) (S[ST] = ROLL), bank();
        else if (balance()) bail();
      }
    } else if (st === AIR) {
      S[AIRT] = S[AIRT]! + dt;
      S[VY] = S[VY]! - GRAV * dt;
      const y0 = y;
      x += S[VX]! * dt;
      y += S[VY]! * dt;
      if (y > S[PEAK]!) S[PEAK] = y;
      if (x < 1 || x > 159) (x = x < 1 ? 1 : 159), (S[VX] = 0);
      if (S[QAIR] && S[VY]! < 0 && S[TURN] === S[FACE]) (S[FACE] = -S[FACE]!), S[MODE] === PLAY || S[MODE] === DEMO ? trick(AIR180) : 0;
      // Tricks: the special, a flip (one at a time) or a grab (held), by direction.
      const dirIn = ax * S[FACE]!, pick = dirIn === 0 ? 0 : dirIn < 0 ? 1 : 2;
      if (S[FLIPT]! > 0) {
        S[FLIPT] = S[FLIPT]! - dt;
        if (S[FLIPT]! <= 0) (S[FLIPT] = 0), trick(S[FLIPK]! | 0), S[FLIPK] === FIZZ && call(C_FIZZ);
      } else if (flip > 0 && cb.full && grab) (S[FLIPK] = FIZZ), (S[FLIPT] = S[FLIPD] = 0.7), (S[GRABK] = 0), sp.burst(x, GY - y - 6, 16, 60, 0, TAU, 1.2, GOLD);
      else if (flip > 0 && S[GRABK]! <= 0) (S[FLIPK] = KICK + pick), (S[FLIPT] = S[FLIPD] = FLIP_T[pick]!);
      else if (grab && !S[GRABK]) (S[GRABK] = GRAB + pick + 1), trick(GRAB + pick);
      if (S[GRABK]! > 0) grab ? pts(60) : (S[GRABK] = -S[GRABK]!); // let go: no more ticks, no second grab this air
      ((G[2] = x), ground(G));
      const h = G[0]!, sl = G[1]!;
      if (S[VY]! < 0 && y0 >= RH && y <= RH && x >= R0 && x <= R1) {
        // On the rail: grind (← / → as you land picks which).
        if (S[FLIPT]! > 0) (y = RH), bail();
        else {
          (S[ST] = RAIL), (y = RH), (S[SP] = S[VX]! < -20 || S[VX]! > 20 ? S[VX]! : S[VX]! < 0 ? -20 : 20), (S[BAL] = (R() - 0.5) * 0.3), (S[BALV] = (R() - 0.5) * 0.8), (S[BALT] = 0), (S[GRABK] = 0);
          trick(GRIND + pick);
          if (S[TK] === 1) gap(BOX_RAIL);
          ev[EV_GRIND] = 1;
        }
      } else if (y <= h && S[VY]! < 0) {
        y = h;
        const c = 1 / Math.sqrt(1 + sl * sl);
        // Into the pit, mid-flip, or short of a ledge (the floor more than a step above the feet): a slam.
        if (inPit(x) || S[FLIPT]! > 0 || h - y0 > 3) bail();
        else {
          // The fall turns into speed along the floor, never back the way you came (but a quarter pipe sends you down it).
          let s = (S[VX]! + S[VY]! * sl) * c;
          if (s * S[VX]! < 0 && x > CL && x < CR) s = S[VX]! * c * 0.6;
          (S[ST] = ROLL), (S[SP] = s);
          if (Math.abs(s) > 4) S[FACE] = Math.sign(s);
          S[TURN] = S[FACE]!;
          const from = S[TX]!, tk = S[TK]!;
          if (tk !== 3 && ((from < P0 && x >= P1) || (from >= P1 - 2 && from < F0 && x < P0))) gap(PIT_GAP);
          if (tk === 1 && ((from < F1 && x >= F2) || (from >= F2 && x < F1))) gap(BOX_GAP);
          if (tk === 2 && x > CR && S[PEAK]! > RH + 6) gap(RAIL_RAMP);
          if (grab && cb.active && Math.abs(sl) < 0.05) (S[ST] = MAN), (S[BAL] = 0), (S[BALV] = (R() - 0.5) * 0.6), (S[BALT] = 0), trick(MANUAL);
          else bank();
          S[GRABK] = 0;
          ev[EV_LAND] = 1;
          sp.burst(x, GY - y, 4, 22, -1.57, 2.6, 1, DUST);
        }
      }
    } else if (st === RAIL) {
      let s = S[SP]!;
      if (Math.abs(s) > 20) s -= s * 0.12 * dt;
      x += s * dt;
      S[SP] = s;
      pts(50);
      if (R() < 0.6) sp.burst(x - Math.sign(s) * 4, GY - RH, 1, 40, s > 0 ? -2.6 : -0.5, 0.8, 0.8, SPARK);
      if (up > 0) ((S[VX] = s), (S[VY] = POP * 0.92), launch(2)), (ev[EV_POP] = 1);
      else if (x < R0 || x > R1) ((S[VX] = s), (S[VY] = 4), launch(2));
      else if (balance()) bail(), (S[VX] = s);
    } else if (st === SLAM) {
      S[SLAMT] = S[SLAMT]! + dt;
      ((G[2] = x), ground(G));
      if (y > G[0]! || inPit(x)) (S[VY] = S[VY]! - GRAV * dt), (y = y + S[VY]! * dt), y < G[0]! && (y = G[0]!);
      if (S[SLAMT]! > 1) {
        // Back on your feet: out of the pit on the side you were heading for.
        if (inPit(x)) x = S[VX]! >= 0 ? P1 + 4 : K0 - 6;
        (S[SP] = 0), (S[ST] = ROLL), ((G[2] = x), ground(G)), (y = G[0]!), (S[VY] = 0), (S[TURN] = S[FACE]!);
      }
    }
    (S[X] = x), (S[Y] = y), (S[GPREV] = grab ? 1 : 0);
    // The letters.
    if (mode === PLAY)
      for (let i = 0; i < 6; i++) {
        const dx = LETTERS[i * 2]! - x, dy = LETTERS[i * 2 + 1]! - (y + 7);
        if (!((S[LET]! >> i) & 1) && dx * dx + dy * dy < 49) {
          S[LET] = S[LET]! | (1 << i);
          ev[EV_LETTER] = 1;
          call(C_LETTER + i);
          sp.burst(LETTERS[i * 2]!, GY - LETTERS[i * 2 + 1]!, 10, 50, 0, TAU, 1.1, GOLD);
          if (S[LET] === 63) cb.bonus(2000), call(C_FIZLET);
        }
      }
    // The clock: at zero the trick in hand finishes (a grind or manual banks), then the card.
    if (mode === PLAY) {
      S[LEFT] = S[LEFT]! > dt ? S[LEFT]! - dt : 0;
      if (S[LEFT] === 0 && !S[ENDING]) (S[ENDING] = 1), call(C_TIME);
      if (S[ENDING]) {
        if (S[ST] === MAN) (S[ST] = ROLL), bank();
        if (S[ST] === RAIL) ((S[VX] = S[SP]!), (S[VY] = 4), launch(2));
        if (S[ST] === ROLL) (S[MODE] = DONE), (S[CARD] = 0), (ev[EV_END] = 1);
      }
    } else if (mode === DEMO && S[T]! > 6 && S[ST] === ROLL) (S[MODE] = IDLE), place(53);
    else if (mode === DONE) S[CARD] = S[CARD]! + dt;
    mode = S[MODE]!;
    const moving = sp.step(dt, 140);
    return mode === PLAY || mode === DEMO || S[SP] !== 0 || S[ST] !== ROLL || moving > 0 || S[CALLT]! < 1.4 || (mode === DONE && S[CARD]! < 1.2);
  }
  /** The balance meter (grind, manual): it tips further the longer you hold it; ← → steer it back. True when it goes. */
  function balance() {
    const dt = S[DT]!, ax = S[AX]!;
    S[BALT] = S[BALT]! + dt;
    const k = 2 + S[BALT]! * 0.6;
    S[BALV] = S[BALV]! + (S[BAL]! * k * 3 + (R() - 0.5) * k * 2 + ax * 5) * dt;
    S[BAL] = S[BAL]! + S[BALV]! * dt;
    return Math.abs(S[BAL]!) >= 1;
  }
  return { S, ev, cb, sp, step, G };
}
export type Sesh = ReturnType<typeof sesh>;

export type SeshScene = SlotScene & { engine: ReturnType<typeof createEngine>; run: Sesh; poster(): void; readonly state: { mode: number; st: number; score: number; left: number; x: number; letters: number; best: number; mult: number; special: number } };

// Colour slots, read from the stage's skin (--ss-*): light and dark.
const SKY = 0, SKY2 = 1, WALL = 2, WOOD = 3, WOOD2 = 4, FLOOR = 5, INK = 6, PAPER = 7, METAL = 8, HOOD = 9, CAP = 10, SKIN = 11, PANTS = 12, DECK = 13, GOLDC = 14, GO = 15, HOT = 16, SHADE = 17;
const VARS = ["sky", "sky2", "wall", "wood", "wood2", "floor", "ink", "paper", "metal", "hood", "cap", "skin", "pants", "deck", "gold", "go", "hot", "shade"];
const CLOCK = Array.from({ length: ROUND + 1 }, (_, i) => `0:${i < 10 ? "0" : ""}${i}`);
const fmt = (n: number) => n.toLocaleString("en-US");

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SeshScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger, sig = { signal: engine.signal };
  const skin = slot.querySelector<HTMLElement>("[data-ss]") ?? stage;
  const col = ["#0c0a1c", "#2a1c4a", "#1d1738", "#c8894a", "#9a5f34", "#3b3170", "#07060f", "#f6f3ff", "#aea4d6", "#ff2e88", "#19f0ff", "#ffd2a8", "#3b3170", "#9a63ff", "#ffc21a", "#39ffb0", "#ff8a1f", "rgba(7,6,15,.35)"];
  // The canvas (art units), the play key over it (press = OLLIE, and the keyboard's focus), the HUD
  // stickers, the score card and the pad. All through the ledger.
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  const g = canvas.getContext("2d")!;
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "ss-play";
  play.setAttribute("aria-label", "Two-Minute Sesh: ← → push, Space ollies, J flips, K grabs and manuals (M mutes)");
  const hud = L.add(document.createElement("div"));
  hud.className = "ss-hud";
  hud.innerHTML = `<b class="ss-chip ss-score"><small>SCORE</small><span>0</span></b><b class="ss-chip ss-clock"><span>${CLOCK[ROUND]}</span></b><b class="ss-chip ss-let">${"FIZLET".replace(/./g, "<i>$&</i>")}</b><button type="button" class="ss-chip ss-mute" aria-label="Sound (M)" aria-pressed="true">♪</button><b class="ss-chip ss-spec"><small>SPECIAL</small><i><i></i></i></b><p class="ss-combo" hidden><span></span> <b></b> <em></em></p><div class="ss-card" role="status" hidden></div>`;
  const [scoreEl, clockEl, letEl, mute, specEl, comboEl, card] = hud.children as unknown as HTMLElement[];
  const scoreTx = scoreEl!.lastChild as HTMLElement, clockTx = clockEl!.firstChild as HTMLElement, bar = specEl!.lastChild!.firstChild as HTMLElement;
  const [cStr, cMult, cVal] = comboEl!.children as unknown as HTMLElement[];
  stage.append(canvas, play, hud);
  const snd = sound(engine, { cues: { start: "ready", pop: "click", land: "power", grind: "fire", bail: "hurt", trick: "click", letter: "power", gap: "win", end: "end", bank: "power" }, volume: 0.1 });
  const c = controls(engine, { keys: { left: [], right: [], jump: [], flip: [], grab: [] }, target: play });
  const JUMP = c.id("jump"), FLIPI = c.id("flip"), GRABI = c.id("grab");
  const keys = pad(engine, c, {
    scheme: "buttons",
    move: ["", "", "left", "right"],
    actions: [
      { intent: "jump", label: "OLLIE", name: "Ollie (Space)", key: "SPACE", role: "go" },
      { intent: "flip", label: "FLIP", name: "Flip trick (J)", key: "J", role: "attack" },
      { intent: "grab", label: "GRAB", name: "Grab, or manual on the ground (K)", key: "K", role: "advance", hold: true },
    ],
    host: stage,
  });
  keys.el.classList.add("ss-pad");
  // The keyboard, only while the piece has focus: arrows / A D push, Space W ↑ Enter ollie, J X flip, K C grab.
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump", Enter: "jump", KeyJ: "flip", KeyX: "flip", KeyK: "grab", KeyC: "grab" };
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

  const I: Inputs = new Float64Array(4);
  const run = sesh((engine.random() * 2147483647) | 0, I, !first);
  const S = run.S, G = run.G, cb = run.cb;
  if (first) I[1] = 1;
  // [0] measure, [1] px per unit, [2] poster resolution, [3] keys hint (no pad on screen), [4] the
  // view's width in art units (160 wide; 100 on a tall stage, which follows the rider), [5] its top,
  // [6] px per unit of the 160-wide screen layer (callouts, captions), [7] that layer's height.
  const V = new Float64Array(8);
  V[0] = 1;
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  // The park's floor line, sampled once (art units).
  const floor = new Path2D();
  floor.moveTo(0, H);
  for (let x = 0; x <= W; x += 0.5) floor.lineTo(x, GY - (inPit(x) ? 0 : (((G[2] = x), ground(G)), G[0]!)));
  floor.lineTo(W, H);
  // The riding surfaces only (the ramps' plywood tops), and the static backdrop: a crowd behind a
  // fence, and a string of pennants in four colours. Made once.
  const top = new Path2D(), crowd = new Path2D(), flags = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  for (let x = 0, on = 0; x <= W; x += 0.5) {
    (G[2] = x), ground(G);
    const up = G[0]! > 0.01 || (G[1] !== 0 && !inPit(x));
    up ? (on ? top.lineTo(x, GY - G[0]!) : top.moveTo(x, GY - G[0]!)) : 0;
    on = up ? 1 : 0;
  }
  for (let k = 0; k < 54; k++) {
    const x = k * 3 + (k % 2) * 1.2, y = 40.6 + ((k * 7) % 3) * 0.7;
    crowd.moveTo(x + 1.3, y), crowd.arc(x, y, 1.3, 0, TAU), crowd.rect(x - 1.6, y + 1.1, 3.2, 3);
  }
  for (let k = 0; k < 27; k++) {
    const x = k * 6 + 1, y = 25 + Math.sin((k / 26) * 3.14) * 5;
    flags[k % 4]!.moveTo(x, y), flags[k % 4]!.lineTo(x + 4, y + 0.4), flags[k % 4]!.lineTo(x + 1.8, y + 4);
  }
  let sky: CanvasGradient | string = col[SKY]!;
  // HUD shadow values (what the stickers show now), so the DOM is written only on a change.
  const was = new Float64Array(10).fill(-1);
  const DEBRIS = [col[METAL]!, col[GOLDC]!, col[CAP]!];
  // The combo line's flash after a bank or a bail: [0] time left, [1] 1 bank / 2 bail, [2] banked.
  const flash = new Float64Array(3);

  engine.add({
    read() {
      if (!V[0]) return;
      V[0] = 0;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1) * (V[2] || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      // Wide: the whole park. Tall: a 100-unit window that follows the rider, the floor at the bottom.
      V[4] = canvas.height / canvas.width > 0.62 ? 100 : W;
      V[1] = canvas.width / V[4]!;
      V[5] = H - canvas.height / V[1]!;
      V[6] = canvas.width / W;
      V[7] = canvas.height / V[6]!;
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) col[i] = cs.getPropertyValue("--ss-" + VARS[i]).trim() || col[i]!;
      (DEBRIS[0] = col[METAL]!), (DEBRIS[1] = col[GOLDC]!), (DEBRIS[2] = col[CAP]!);
      V[3] = keys.el.offsetParent ? 0 : 1;
      const s = g.createLinearGradient(0, 0, 0, GY);
      s.addColorStop(0, col[SKY]!), s.addColorStop(1, col[SKY2]!);
      sky = s;
    },
    step(e, dt) {
      I[0] = c.axis("left", "right");
      if (c.hit(JUMP)) I[1] = I[1]! + 1;
      if (c.hit(FLIPI)) I[2] = I[2]! + 1;
      I[3] = c.down(GRABI) ? 1 : 0;
      if (run.step(dt)) e.busy();
      const ev = run.ev;
      flash[0] = Math.max(0, flash[0]! - dt);
      if (ev[EV_BAIL]) (flash[0] = 1.2), (flash[1] = 2);
      else if (ev[EV_BANK]) (flash[0] = 1.2), (flash[1] = 1), (flash[2] = cb.S[5]!);
      if (flash[0]) e.busy();
      if (ev[EV_START]) e.events.emit("start");
      if (ev[EV_POP]) e.events.emit("pop");
      if (ev[EV_GRIND]) e.events.emit("grind");
      if (ev[EV_BAIL]) e.events.emit("bail");
      else if (ev[EV_GAP]) e.events.emit("gap");
      else if (ev[EV_LETTER]) e.events.emit("letter");
      else if (ev[EV_BANK]) e.events.emit("bank");
      else if (ev[EV_TRICK]) e.events.emit("trick");
      else if (ev[EV_LAND]) e.events.emit("land");
      if (ev[EV_END]) e.events.emit("end");
    },
    render() {
      const k = V[1]!, vw = V[4]!, cx = vw < W ? Math.min(W - vw, Math.max(0, S[X]! - vw / 2)) : 0;
      g.setTransform(k, 0, 0, k, -cx * k, -V[5]! * k);
      const mode = S[MODE]!, t = S[T]!;
      // Sky, two floodlights, pennants, the crowd behind a fence, the back wall's plywood panels.
      g.fillStyle = sky;
      g.fillRect(0, -60, W, H + 60);
      for (let j = 0; j < 2; j++) {
        const lx = 34 + j * 92;
        g.fillStyle = col[INK]!;
        g.fillRect(lx - 0.6, 14, 1.2, 30);
        g.fillStyle = col[PAPER]!;
        g.fillRect(lx - 4, 11, 8, 3.4);
        g.globalAlpha = 0.12;
        g.beginPath();
        g.moveTo(lx - 4, 14), g.lineTo(lx - 22, GY), g.lineTo(lx + 22, GY), g.lineTo(lx + 4, 14);
        g.fill();
        g.globalAlpha = 1;
      }
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.3;
      g.beginPath();
      for (let j = 0; j < 27; j++) j ? g.lineTo(j * 6 + 1, 25 + Math.sin((j / 26) * 3.14) * 5) : g.moveTo(1, 25);
      g.stroke();
      for (let j = 0; j < 4; j++) (g.fillStyle = col[j === 0 ? CAP : j === 1 ? HOOD : j === 2 ? GOLDC : GO]!), g.fill(flags[j]!);
      g.fillStyle = col[SHADE]!;
      g.fill(crowd);
      g.fillRect(0, 38, W, 0.6);
      for (let j = 0; j < 20; j++) g.fillRect(j * 8, 38, 0.5, 6);
      g.fillStyle = col[WALL]!;
      g.fillRect(0, 44, W, GY - 44);
      g.fillStyle = col[SHADE]!;
      for (let j = 0; j < 8; j++) g.fillRect(j * 20 + 9.6, 44, 0.8, GY - 44);
      g.fillRect(0, 44, W, 1.2);
      // The park: a hard shadow, plywood side panels and their framing, the concrete floor, the
      // riding surfaces (a lighter plywood edge), one bold outline.
      g.save();
      g.translate(1.4, 1.4);
      g.fillStyle = col[SHADE]!;
      g.fill(floor);
      g.restore();
      g.fillStyle = col[WOOD2]!;
      g.fill(floor);
      g.save();
      g.clip(floor);
      g.fillStyle = col[SHADE]!;
      for (let j = 0; j < 32; j++) g.fillRect(j * 5 + 2, GY - 30, 0.5, 30);
      g.fillRect(0, GY - QH * 0.5, W, 0.5);
      g.restore();
      g.fillStyle = col[FLOOR]!;
      g.fillRect(0, GY, W, H - GY);
      g.fillStyle = col[INK]!;
      g.fillRect(0, GY - 0.4, W, 0.8);
      g.lineJoin = g.lineCap = "round";
      g.strokeStyle = col[WOOD]!;
      g.lineWidth = 2.6;
      g.stroke(top);
      g.strokeStyle = col[INK]!;
      g.lineWidth = 0.9;
      g.stroke(top);
      g.stroke(floor);
      // Decks with a railing, metal coping on every lip, the funbox's ledge edge.
      for (let j = 0; j < 2; j++) {
        const x0 = j ? RX : -1, x1 = j ? W + 1 : LX, rx = j ? W - 1.6 : 1;
        g.fillStyle = col[WOOD]!;
        g.fillRect(x0, GY - QH - 1.3, x1 - x0, 1.6);
        g.strokeRect(x0, GY - QH - 1.3, x1 - x0, 1.6);
        g.fillStyle = col[METAL]!;
        g.fillRect(rx - 0.4, GY - QH - 9, 0.8, 8);
        g.fillRect(j ? RX + 1 : 0, GY - QH - 9, 3, 0.8);
      }
      g.fillStyle = col[METAL]!;
      g.fillRect(F1, GY - FH - 0.7, F2 - F1, 0.9);
      g.lineWidth = 0.5;
      for (let j = 0; j < 5; j++) {
        const x = j === 0 ? LX : j === 1 ? RX : j === 2 ? K1 : j === 3 ? F1 : F2, h = j < 2 ? QH : j === 2 ? KH : FH;
        g.beginPath();
        g.arc(x, GY - h, j < 2 ? 1.5 : 1, 0, TAU);
        g.fill();
        g.stroke();
      }
      // The pit: a dark drop between hazard-striped lips (and down the kicker's face).
      g.fillStyle = col[INK]!;
      g.fillRect(P0, GY - 0.4, P1 - P0, H - GY + 0.4);
      g.fillStyle = col[SHADE]!;
      g.fillRect(P0, GY, 1.6, H - GY), g.fillRect(P1 - 1.6, GY, 1.6, H - GY);
      for (let j = 0; j < 3; j++) {
        const x = j === 0 ? P0 - 3.5 : j === 1 ? P1 : P0 - 1.4, y = j === 2 ? GY - KH : GY - 0.4, w = j === 2 ? 1.4 : 3.5, h = j === 2 ? KH : 1.6;
        g.fillStyle = col[GOLDC]!;
        g.fillRect(x, y, w, h);
        g.save();
        g.beginPath();
        g.rect(x, y, w, h);
        g.clip();
        g.fillStyle = col[INK]!;
        for (let q = -2; q < 8; q++) g.fillRect(x + q * 1.4, y - 1, 0.7, h + 2);
        g.restore();
      }
      // The grind rail: a round bar on two posts with base plates.
      g.fillStyle = col[INK]!;
      g.fillRect(R0 + 3, GY - RH, 0.9, RH), g.fillRect(R1 - 3.9, GY - RH, 0.9, RH);
      g.fillRect(R0 + 2, GY - 0.9, 3, 0.9), g.fillRect(R1 - 5, GY - 0.9, 3, 0.9);
      g.fillStyle = col[HOT]!;
      g.beginPath();
      g.roundRect(R0, GY - RH - 1.5, R1 - R0, 1.7, 0.85);
      g.fill();
      g.lineWidth = 0.5;
      g.stroke();
      g.fillStyle = col[PAPER]!;
      g.globalAlpha = 0.5;
      g.fillRect(R0 + 1, GY - RH - 1.2, R1 - R0 - 2, 0.3);
      g.globalAlpha = 1;
      // The letters (still between runs; they bob while a run is on).
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = FONT[6]!;
      for (let i = 0; i < 6; i++) {
        if (mode === PLAY && (S[LET]! >> i) & 1) continue;
        const lx = LETTERS[i * 2]!, ly = GY - LETTERS[i * 2 + 1]! + (mode === PLAY ? Math.sin(t * 3 + i) * 1.2 : 0);
        g.fillStyle = col[SHADE]!;
        g.beginPath();
        g.arc(lx + 0.8, ly + 0.8, 3.6, 0, TAU);
        g.fill();
        g.fillStyle = col[GOLDC]!;
        g.beginPath();
        g.arc(lx, ly, 3.6, 0, TAU);
        g.fill();
        g.lineWidth = 0.8;
        g.stroke();
        g.fillStyle = col[INK]!;
        g.fillText("FIZLET"[i]!, lx, ly + 0.3);
      }
      rider();
      // Debris.
      const p = run.sp;
      for (let i = 0; i < p.n; i++) {
        const l = p.L[i]!;
        if (l <= 0) continue;
        g.globalAlpha = Math.min(1, (l / p.M[i]!) * 1.6);
        g.fillStyle = DEBRIS[p.K[i]!]!;
        const s = p.S[i]!;
        g.fillRect(p.X[i]! - s / 2, p.Y[i]! - s / 2, s, s);
      }
      g.globalAlpha = 1;
      // The balance meter over the rider (grind, manual).
      if (S[ST] === RAIL || S[ST] === MAN) {
        const bx = S[X]!, by = GY - S[Y]! - 25, b = S[BAL]!;
        g.fillStyle = col[INK]!;
        g.fillRect(bx - 10, by - 1.2, 20, 2.4);
        g.fillStyle = Math.abs(b) > 0.7 ? col[HOT]! : col[GO]!;
        g.fillRect(bx - 1 + b * 9, by - 2.2, 2, 4.4);
        g.strokeRect(bx - 1 + b * 9, by - 2.2, 2, 4.4);
      }
      // The callout and captions: on the screen layer (the 160-wide view), wherever the camera is.
      g.setTransform(V[6]!, 0, 0, V[6]!, 0, 0);
      const ct = S[CALLT]!, hh = V[7]!;
      if (ct < 1.3) {
        const w = CALLS[S[CALL]!]!, big = S[CALL]! >= C_LETTER && S[CALL]! < C_SPECIAL, sc = ct < 0.1 ? 1.8 - ct * 8 : 1;
        g.save();
        g.globalAlpha = ct > 1 ? (1.3 - ct) / 0.3 : 1;
        g.translate(80, hh * (vw < W ? 0.42 : 0.33) - ct * 3);
        g.rotate(-0.06);
        g.scale(sc, sc);
        g.font = FONT[big ? 14 : 8]!;
        const tw = g.measureText(w).width + 8, th = big ? 16 : 11;
        g.fillStyle = col[INK]!;
        g.beginPath();
        g.roundRect(-tw / 2 + 1.4, -th / 2 + 1.4, tw, th, 3);
        g.fill();
        g.fillStyle = S[CALL] === C_BAIL ? col[HOT]! : S[CALL]! < 4 ? col[GO]! : col[GOLDC]!;
        g.beginPath();
        g.roundRect(-tw / 2, -th / 2, tw, th, 3);
        g.fill();
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = col[INK]!;
        g.fillText(w, 0, 0.6);
        g.restore();
      }
      if (mode === IDLE || (mode === DEMO && t > 6)) {
        caption("TWO-MINUTE SESH", hh * 0.42 - 4, 12, col[PAPER]!);
        caption(V[3] ? "← → PUSH · SPACE OLLIE · J FLIP · K GRAB" : "TAP OLLIE TO START", hh * 0.42 + 7, 5, col[GOLDC]!);
      }
      // The HUD stickers: written only when what they show changes.
      const sc = cb.score | 0;
      if (sc !== was[0]) (was[0] = sc), (scoreTx.textContent = fmt(sc));
      const cl = Math.ceil(mode === PLAY ? S[LEFT]! : mode === DONE ? 0 : ROUND);
      if (cl !== was[1]) (was[1] = cl), (clockTx.textContent = CLOCK[cl]!), clockEl!.classList.toggle("ss-hot", cl <= 10 && mode === PLAY);
      const lt = mode === DEMO ? 0 : S[LET]!;
      if (lt !== was[2]) {
        was[2] = lt;
        for (let i = 0; i < 6; i++) letEl!.children[i]!.classList.toggle("on", ((lt >> i) & 1) === 1);
      }
      const f = Math.round(cb.special * 40) / 40;
      if (f !== was[3]) (was[3] = f), (bar.style.transform = `scaleX(${f})`), specEl!.classList.toggle("ss-full", f >= 1);
      // The combo line: the tricks, × multiplier, points; then +banked (green) or BAIL (red) for a beat.
      const show = cb.active ? 1 : flash[0]! > 0 ? 1 + flash[1]! : 0, v = show === 1 ? cb.value : show === 2 ? flash[2]! : 0;
      if (cb.ver !== was[4] || show !== was[5]) {
        (was[4] = cb.ver), (was[5] = show), (was[7] = -1);
        comboEl!.hidden = !show;
        comboEl!.className = "ss-combo" + (show === 2 ? " ss-bank" : show === 3 ? " ss-bail" : "");
        cStr!.textContent = show === 1 ? cb.text() : show === 2 ? "BANKED" : "BAIL";
        cMult!.textContent = show === 1 ? "×" + cb.mult : "";
      }
      if (v !== was[7]) (was[7] = v), (cVal!.textContent = show === 3 ? "" : (show === 2 ? "+" : "") + fmt(v));
      // The score card.
      const cd = mode === DONE && S[CARD]! > 0.6 ? 1 : 0;
      if (cd !== was[8]) {
        was[8] = cd;
        card!.hidden = !cd;
        if (cd) {
          const best = cb.best, n = (S[LET]! & 1) + ((S[LET]! >> 1) & 1) + ((S[LET]! >> 2) & 1) + ((S[LET]! >> 3) & 1) + ((S[LET]! >> 4) & 1) + ((S[LET]! >> 5) & 1);
          card!.innerHTML = `<small>RUN OVER</small><b>${fmt(cb.score)}</b><p>BEST COMBO <strong>${fmt(best)}</strong></p><p class="ss-best">${best ? cb.text(true) : "Land a trick to bank a combo"}</p><p>${n}/6 LETTERS · ${S[GAPS]} GAP${S[GAPS] === 1 ? "" : "S"} · ${S[BAILS]} BAIL${S[BAILS] === 1 ? "" : "S"}</p><p class="ss-again">OLLIE TO GO AGAIN</p>`;
        }
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
    g.lineWidth = 1;
  }
  /** The rider: a big-hooded skater in a beanie, on a board that flips, grabs and grinds. */
  function rider() {
    const st = S[ST]!, x = S[X]!, y = GY - S[Y]!, face = S[FACE]!, fl = S[FLIPT]!, k = S[FLIPK]!;
    const a = fl > 0 ? (1 - fl / S[FLIPD]!) * TAU * (k === FIZZ ? 2 : 1) : 0, grab = S[GRABK]! > 0 && st === AIR, low = st === RAIL || st === MAN || grab ? 2.2 : st === AIR ? 1 : 0;
    (G[2] = Math.min(159, Math.max(1, x))), ground(G);
    g.save();
    g.translate(x, y);
    if (st === ROLL || st === MAN) g.rotate(Math.atan(G[1]!) * 0.9);
    if (st === SLAM) g.rotate(Math.min(1.6, S[SLAMT]! * 6) * -face);
    if (k === FIZZ && fl > 0) g.rotate(a / 2);
    // The 180 at the top of a quarter-pipe air: the rider turns through side-on.
    g.scale(S[QAIR] && st === AIR ? face * Math.max(0.15, Math.min(1, Math.abs(S[VY]!) / 40)) : face, 1);
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    g.lineCap = g.lineJoin = "round";
    // The board (it flies off on a slam).
    const bx = st === SLAM ? 4 + S[SLAMT]! * 18 : 0, by = st === SLAM ? -3 - Math.sin(Math.min(3, S[SLAMT]! * 6)) * 5 : grab ? -4.2 : fl > 0 ? -5 : -2.2;
    const th = Math.cos(a), wd = k === 2 && fl > 0 ? Math.cos(a) : 1;
    if (cb.full && (S[MODE] === PLAY || S[MODE] === DEMO)) (g.shadowColor = col[GOLDC]!), (g.shadowBlur = 6 * V[1]!);
    g.fillStyle = th >= 0 ? col[DECK]! : col[GOLDC]!;
    g.beginPath();
    g.roundRect(bx - 7 * wd, by - 0.8 * Math.abs(th) - 0.3, 14 * wd, 1.6 * Math.abs(th) + 0.6, 0.8);
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    if (Math.abs(th) > 0.5) {
      g.fillStyle = col[INK]!;
      for (let w = -1; w <= 1; w += 2) {
        g.beginPath();
        g.arc(bx + w * 4.4 * wd, by + 1.6 * th, 1.1, 0, TAU);
        g.fill();
      }
    }
    // Legs (baggy), the hoodie, arms, head and beanie.
    const hip = -9 + low, sh = -15.5 + low * 1.3, ft = st === SLAM ? -2 : by - 1;
    g.lineWidth = 2.6;
    g.strokeStyle = col[PANTS]!;
    g.beginPath();
    g.moveTo(-3.4, ft), g.lineTo(-1.2, hip), g.lineTo(0.8, hip), g.lineTo(3.4, ft);
    g.stroke();
    g.fillStyle = col[HOOD]!;
    g.strokeStyle = col[INK]!;
    g.lineWidth = 0.8;
    g.beginPath();
    g.roundRect(-3.2, sh, 6.4, hip - sh + 1.4, 1.6);
    g.fill();
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = col[HOOD]!;
    g.beginPath();
    if (grab) g.moveTo(1.5, sh + 2), g.lineTo(3.5, by - 0.6);
    else g.moveTo(1.5, sh + 2), g.lineTo(5.5, sh + (st === AIR ? -1 : 4 + S[LEAN]! * face));
    g.moveTo(-1.5, sh + 2), g.lineTo(-5.6, sh + (st === RAIL || st === MAN ? 0 : 5));
    g.stroke();
    g.lineWidth = 0.8;
    g.strokeStyle = col[INK]!;
    g.fillStyle = col[SKIN]!;
    g.beginPath();
    g.arc(0.6, sh - 2.6, 2.7, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = col[CAP]!;
    g.beginPath();
    g.arc(0.6, sh - 3.1, 2.8, 3.3, 6.12);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(0.2, sh - 6.4, 1, 0, TAU);
    g.fill();
    g.fillStyle = col[INK]!;
    g.fillRect(2, sh - 2.8, 0.8, 0.9);
    g.restore();
  }

  engine.start();
  return {
    engine,
    accessible: true,
    run,
    get state() {
      return { mode: S[MODE]!, st: S[ST]!, score: cb.score, left: S[LEFT]!, x: S[X]!, letters: S[LET]!, best: cb.best, mult: cb.mult, special: cb.special };
    },
    poster: () => ((V[2] = 0.6), (V[0] = 1)),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, mid-grind (scripts/gallery-posters.mjs). */
export const posterAt = 5.2;
