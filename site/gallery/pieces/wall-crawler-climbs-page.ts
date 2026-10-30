// #047 "The wall-crawler climbs the page": golden hour on a building site. The tower in the middle
// is the page itself: its headline, its line of copy, two buttons and two cards are the stage's real
// elements, stacked into a skyscraper of pixel brick. Gecko (an original hero: mint suit, gold
// goggle eyes, a tail) shoots a line up to the crane's jib, swings, bowls into the window cleaner's
// cradle (HEY!), slaps into the tower, climbs it hand over hand around the ledges and stands on the
// roof, where the pigeon on the antenna decides his head is a better perch. Tap anywhere: the line
// shoots there and sticks if it finds a surface (the tower, the crane, the water tank next door);
// Gecko jumps, swings on it and lets go at the top of the arc. Whatever he hits takes the hit: the
// letters there jump (only those), the cradle swings and its bucket slops, a pigeon in his way bursts
// into feathers. Tap too far and the line falls short with Gecko already in the air: he hangs there a
// beat, and drops. From the roof, that ends in a SPLAT on the street.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back) and fizlet/slot.
// The scene is palette indices in one small buffer (./pixel-stage.ts); the page's letters move only
// through custom properties written by the ledger in render.
import { createEngine } from "../../../src/kernel/index";
import type { SlotTap } from "../../../src/slot";
import { art, blit, dot, fill, line, pixelCanvas, pixels, type Art, type Pixels } from "./pixel-stage";
import { outline, say, sayW, type Font } from "./pixel-words";

/** The art: 160 × 90 (16:9), scaled crisp to the card. */
export const GW = 160, GH = 90;
// 0 is a hole (the page's real block shows through); then the Fizlet brand tokens.
export const PALETTE = ["", "#07060f", "#3b3170", "#3f296a", "#9a63ff", "#aea4d6", "#f6f3ff", "#ff2e88", "#ff7389", "#19f0ff", "#39ffb0", "#ffc21a"] as const;
const enum X { K = 1, L, B, V, M, I, P, A, C, G, Y }
const MAP = { k: X.K, l: X.L, b: X.B, v: X.V, m: X.M, i: X.I, p: X.P, a: X.A, c: X.C, g: X.G, y: X.Y };
const FONT: Font = {
  H: "1000110001111111000110001", A: "0111010001111111000110001",
  S: "0111110000011100000111110", P: "1111010001111101000010000", L: "1000010000100001000011111", T: "1111100100001000010000100",
  E: "1111110000111101000011111", Y: "1000101010001000010000100", "!": "0010000100001000000000100", C: "0111110000100001000001111",
  O: "0111010001100011000101110", "?": "0111010001001100000000100",
};

/** The page's real blocks, in art px [x, y, w, h]: the stage places its elements on these spots. */
export const BLOCKS = [[44, 23, 58, 11], [52, 38, 42, 7], [41, 49, 22, 7], [77, 49, 23, 7], [52, 60, 20, 12], [74, 60, 20, 12]] as const;
const STREET = 82, TOP = 22, CORE0 = 50, CORE1 = 96, MAXL = 72, GRAV = 300;
// The window cleaner's cradle hangs from a davit off the roof: pivot, rope length.
const GPX = 111, GPY = 24, GLEN = 27;
// The pigeon's perches: the tip of the roof's antenna, the crane's jib.
const PERCH = [[89, 11], [150, 3]] as const;

// The tower's outline, row by row: the brick core plus every block (its rim) that sticks out of it.
const PL = new Int16Array(GH).fill(999), PR = new Int16Array(GH);
for (let y = TOP; y < STREET; y++) {
  PL[y] = CORE0;
  PR[y] = CORE1;
  for (const [x, by, w, h] of BLOCKS) if (y >= by - 1 && y < by + h + 1) (PL[y] = Math.min(PL[y]!, x - 1)), (PR[y] = Math.max(PR[y]!, x + w + 1));
}

/** What is solid at (x, y): 0 air, 1 the street, 2 the tower, 3 next door, 4 the crane. */
export function solid(x: number, y: number) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (y >= STREET) return 1;
  if (y < 0 || x < 0 || x >= GW) return 0;
  if (y >= TOP && x >= PL[y]! && x < PR[y]!) return 2;
  if ((x < 28 && y >= 44) || (x >= 6 && x < 22 && y >= 30 && y < 39)) return 3;
  if ((x >= 138 && x < 143 && y >= 12) || (x >= 108 && x < 158 && y >= 3 && y < 6) || (x >= 135 && x < 146 && y >= 6 && y < 12)) return 4;
  return 0;
}

// ---------- Sprites (facing right; outlined in rim at load) ----------
const spr = (rows: string[]) => outline(art(rows, MAP), X.K);
// Gecko: gold goggle eyes on top of the head, a purple mask, mint suit, purple gloves and boots, a tail.
const STAND = spr(["...yy..yy.", "..yyky.yky", "..gggggggg", "..gvvvvvvg", "..gggggggp", "...gggggg.", "..ggggggg.", "..g.gcg.g.", "..g.ggg.g.", "g.v.vvv.v.", "g...g.g...", "gg..g.g...", "...vv.vv.."]);
const CLIMB = [
  spr(["......vv", ".yy...g.", "yyky.gg.", "gggggg..", "gvvvvg..", "ggggggv.", ".gggg.v.", ".gcgg...", ".gggg...", "g.vvv...", "g.g.gg..", "gg.g..gv", "...vv..."]),
  spr([".......", ".yy...v", "yyky.gg", "gggggg.", "gvvvvg.", "gggggg.", ".ggggggv", ".gcgg...", ".gggg...", "g.vvv...", "g.g.ggv.", "gg.g....", "...vv..."]),
];
const SWING = spr([".......v", "..yy.yyg", ".yyky.kg", ".ggggggg", ".gvvvvvg", ".ggggggp", "..ggggg.", ".vggcgg.", "..gggg..", "g.vvvv..", "gg.gggg.", "....vvgv", ".....vv."]);
const FLY = spr([".........yy.yy..", "........yyky.yky", "g.......gggggggg", ".gggggggggvvvvvg", "vvggcggggggggggp", "...gggg.vv......"]);
const SPLAT = spr(["...yy..yy...", "..yky..yky..", "vgggvvvvgggv", "ggggggggggg."]);
// The pigeon: sitting, wings up, wings down.
const BIRD = [
  spr(["....ll.", "....lgy", "mmmmgg.", ".mmmmm.", "..a.a.."]),
  spr(["mm.....", ".mm.ll.", "..mmlgy", ".mmmmg.", "......."]),
  spr([".......", "....ll.", "mmmmlgy", "mmmmmg.", "mm....."]),
];
// The window cleaner (faces the tower: left): wiping, wiping, a fist up (HEY!).
const MAN = [
  spr(["..pp.", ".pppp", "..aa.", "m.cc.", "mcccc", "..cc.", "..cc.", "..c.c", "..l.l"]),
  spr(["..pp.", ".pppp", "m.aa.", "mccc.", "..ccc", "..cc.", "..cc.", "..c.c", "..l.l"]),
  spr(["..pp..a", ".pppp.c", "..aa..c", ".ccccc.", "..cc...", "..cc...", "..cc...", "..c.c..", "..l.l.."]),
];

/** Sky, skyline, the tower (holes where the real blocks sit), the house next door, the crane, the street. */
function world(p: Pixels) {
  const bands = [X.B, X.V, X.P, X.A];
  for (let y = 0; y < GH; y++) {
    const b = Math.min(3, Math.floor(y / 16)), edge = y % 16 > 13;
    for (let x = 0; x < GW; x++) dot(p, x, y, edge && (x + y) & 1 ? bands[Math.min(3, b + 1)]! : bands[b]!);
  }
  // The sun going down behind the skyline, and long streaks of cloud across it.
  for (let y = -12; y <= 12; y++) fill(p, 124 - Math.round(Math.sqrt(144 - y * y)), 68 + y, 2 * Math.round(Math.sqrt(144 - y * y)) + 1, 1, X.Y);
  for (const [x, y, w] of [[96, 60, 40], [108, 64, 30], [12, 30, 26], [30, 26, 18], [110, 22, 24]]) fill(p, x!, y!, w!, 1, X.I), fill(p, x! + 4, y! + 1, w! - 8, 1, X.A);
  // The skyline, far off: blocks of dark purple with a few lit windows.
  for (let x = 0, i = 0; x < GW; i++) {
    const w = 6 + ((i * 7) % 9), h = 10 + ((i * 13) % 17);
    fill(p, x, STREET - h, w, h, X.L);
    for (let wy = STREET - h + 3; wy < STREET - 2; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3) if ((wx * 3 + wy) % 7 === 0) dot(p, wx, wy, X.Y);
    x += w + 1 + (i % 3);
  }
  // Next door: brick, windows (some lit), a roof edge; the water tank on legs.
  fill(p, 0, 44, 28, STREET - 44, X.B);
  fill(p, 0, 44, 28, 1, X.M);
  for (let y = 48; y < 78; y += 6) for (let x = 3; x < 26; x += 6) fill(p, x, y, 3, 3, (x + y) % 4 ? X.K : X.Y);
  fill(p, 6, 30, 16, 9, X.L), fill(p, 6, 32, 16, 1, X.M), fill(p, 6, 36, 16, 1, X.M), fill(p, 5, 29, 18, 1, X.K), fill(p, 8, 27, 12, 2, X.K);
  for (const x of [7, 13, 20]) fill(p, x, 39, 1, 5, X.K);
  line(p, 7, 39, 20, 43, X.K), line(p, 20, 39, 7, 43, X.K);
  // The crane: a yellow lattice mast, the cab, the jib and its counterweight, the hook.
  fill(p, 138, 12, 5, STREET - 12, X.K);
  for (let y = 12; y < STREET; y += 4) line(p, 139, y, 141, y + 3, X.Y), dot(p, 139, y, X.Y), dot(p, 141, y, X.Y);
  fill(p, 108, 3, 50, 3, X.K);
  for (let x = 108; x < 158; x += 3) dot(p, x, 4, X.Y), dot(p, x + 1, 3, X.Y), dot(p, x + 1, 5, X.Y);
  fill(p, 135, 6, 11, 6, X.K), fill(p, 136, 7, 9, 4, X.Y), fill(p, 137, 7, 4, 2, X.C);
  fill(p, 148, 6, 9, 4, X.L), line(p, 140, 0, 109, 3, X.K), line(p, 140, 0, 157, 3, X.K), fill(p, 139, 0, 3, 3, X.K);
  fill(p, 129, 6, 1, 22, X.K), fill(p, 127, 28, 4, 2, X.M), dot(p, 127, 30, X.M), dot(p, 128, 31, X.M), dot(p, 129, 30, X.M);
  // The tower: dark brick, the brick lines, lit windows between the floors, an antenna, a door.
  for (let y = TOP; y < STREET; y++) fill(p, PL[y]!, y, PR[y]! - PL[y]!, 1, X.K);
  for (let y = TOP + 2; y < STREET; y += 3) for (let x = CORE0 + ((y >> 1) & 2); x < CORE1; x += 4) dot(p, x, y, X.L);
  for (const y of [36, 47, 58]) for (let x = CORE0 + 3; x < CORE1 - 2; x += 5) fill(p, x, y, 2, 1, (x * y) % 3 ? X.Y : X.L);
  fill(p, 88, 12, 2, 10, X.K), dot(p, 88, 11, X.P), dot(p, 89, 11, X.P);
  fill(p, 67, 75, 12, 7, X.L), fill(p, 68, 76, 10, 6, X.P), fill(p, 72, 76, 1, 6, X.K), fill(p, 66, 74, 14, 1, X.M);
  // The blocks: a rim, a hard shadow, the hole the real element shows through.
  for (const [x, y, w, h] of BLOCKS) fill(p, x - 1, y - 1, w + 3, h + 3, X.K), fill(p, x + 1, y + h, w + 1, 2, X.L), fill(p, x - 1, y - 1, w + 2, h + 2, X.K), fill(p, x, y, w, h, 0);
  // The street: kerb, road, the line down the middle.
  fill(p, 0, STREET, GW, 2, X.M);
  fill(p, 0, STREET + 2, GW, GH - STREET - 2, X.K);
  for (let x = 2; x < GW; x += 10) fill(p, x, 87, 5, 1, X.Y);
}

export interface Hooks {
  /** Something hit the page at (x, y) art px with `power` (~0.3–2), moving `dir` (−1 left, 1 right). */
  knock(x: number, y: number, power: number, dir: number): void;
}

// Hero modes: standing on something, clinging to a wall (climbing), in the air, flat on the street.
const enum H { STANDS, CLING, AIR, FLAT }
// The line: none, flying out, stuck, falling short.
const enum N { NONE, SHOOT, HOOK, SHORT }
// The pigeon: perched, flying, on Gecko's head, knocked out of the air.
const enum Q { SIT, FLAP, HEAD, TUMBLE }
const BITS = 64;

/** The story's state slots (one typed array: nothing boxes in a step). */
const enum Z {
  HX = 0, HY = 1, VX = 2, VY = 3, MODE = 4, T = 5, FACE = 6, AX = 7, AY = 8, RL = 9, LN = 10, LX = 11, LY = 12, LVX = 13, LVY = 14, LT = 15, SIDE = 16, DAZED = 17, GA = 18, GV = 19, HEY = 20, WIPE = 21, QM = 22, QX = 23, QY = 24, QVX = 25, QT = 26, QTX = 27, QTY = 28, QP = 29, WAIT = 30, WD = 31, WX = 32, WY = 33, WT = 34, ASK = 35, CLIMBED = 36, QF = 37, SURF = 38, HANG = 39,
}

/** The story on plain numbers (no DOM): the live mount and the poster both run it. */
export function climber(p: Pixels, seed: number, hooks: Hooks = { knock() {} }) {
  const bg = new Uint8Array(GW * GH), px = p.px;
  world(p);
  bg.set(px);
  const rs = new Uint32Array([seed >>> 0 || 1]);
  const rnd = () => ((rs[0] = Math.imul(rs[0]!, 1664525) + 1013904223), rs[0]! / 4294967296);
  const s = new Float64Array(48);
  s[Z.HX] = 128, s[Z.HY] = STREET, s[Z.FACE] = 1, s[Z.WAIT] = -1, s[Z.WT] = 9, s[Z.QX] = PERCH[0][0], s[Z.QY] = PERCH[0][1], s[Z.QP] = 0, s[Z.ASK] = 0;
  // Bits: water drops, feathers, dust. Position, velocity, life; colour; feathers sway.
  const BX = new Float32Array(BITS), Yb = new Float32Array(BITS), BVX = new Float32Array(BITS), BVY = new Float32Array(BITS), LIFE = new Float32Array(BITS), COL = new Uint8Array(BITS);
  const nb = new Uint32Array(1);
  const WORDS = ["SLAP!", "SPLAT", "HEY!", "COO?", "?"];

  function bit(x: number, y: number, vx: number, vy: number, life: number, c: number) {
    const i = nb[0]!;
    if (i >= BITS) return;
    nb[0] = i + 1;
    BX[i] = x, Yb[i] = y, BVX[i] = vx, BVY[i] = vy, LIFE[i] = life, COL[i] = c;
  }
  /** Pop a word (the newest wins the one slot). */
  function word(w: number, x: number, y: number) {
    s[Z.WD] = w, s[Z.WX] = Math.max(2, Math.min(GW - 3 - sayW(WORDS[w]!), x - sayW(WORDS[w]!) / 2)), s[Z.WY] = Math.max(2, y), s[Z.WT] = 0;
  }
  /** The cradle's platform centre. */
  const cradleX = () => GPX + Math.sin(s[Z.GA]!) * GLEN, cradleY = () => GPY + Math.cos(s[Z.GA]!) * GLEN;

  /** Where a line aimed at (x, y) sticks: that point if it is solid, else the nearest solid one close by; -1: nothing. */
  function stick(x: number, y: number) {
    for (let r = 0; r <= 6; r += 2)
      for (let a = 0; a < 8; a++) {
        const ax = x + Math.round(Math.cos(a * 0.785) * r), ay = y + Math.round(Math.sin(a * 0.785) * r), k = solid(ax, ay);
        if (k > 1 || (k === 1 && ay < STREET + 2)) return ((s[Z.AX] = ax), (s[Z.AY] = ay), k);
        if (!r) break;
      }
    return -1;
  }

  /** A tap at (x, y), art px: the line goes there. Gecko jumps when it finds something to stick to. */
  function tap(x: number, y: number) {
    s[Z.WAIT] = -1;
    if (s[Z.MODE] === H.FLAT) return void ((s[Z.ASK] = 1), (s[Z.QTX] = x), (s[Z.QTY] = y));
    const hx = s[Z.HX]!, hy = s[Z.HY]! - 9, k = stick(x, y);
    s[Z.LX] = hx, s[Z.LY] = hy, s[Z.LT] = 0;
    if (k < 0) {
      // Nothing there: the line flops out and falls; standing, Gecko shrugs.
      const d = Math.hypot(x - hx, y - hy) || 1;
      s[Z.LN] = N.SHORT, s[Z.LVX] = ((x - hx) / d) * 150, s[Z.LVY] = ((y - hy) / d) * 150;
      if (s[Z.MODE] !== H.AIR) word(4, hx, hy - 12);
      return;
    }
    s[Z.LN] = N.SHOOT;
    s[Z.FACE] = s[Z.AX]! >= hx ? 1 : -1;
    const was = s[Z.MODE]!;
    if (was !== H.AIR) {
      // Committed: Gecko jumps the moment the line goes (and finds out later if it was long enough).
      // Off a wall he kicks away from it first.
      s[Z.MODE] = H.AIR, s[Z.T] = 0, s[Z.VX] = was === H.CLING ? -s[Z.SIDE]! * 50 : s[Z.FACE]! * Math.min(110, Math.abs(s[Z.AX]! - hx) * 1.2), s[Z.VY] = -88, s[Z.HY] = s[Z.HY]! - 1;
      for (let i = 0; i < 4; i++) bit(hx, s[Z.HY]!, (rnd() - 0.5) * 40, -10 - rnd() * 10, 0.4, X.M);
    }
    if (s[Z.QM] === Q.HEAD) fly(1);
  }

  /** The pigeon takes off for a perch (0 the antenna, 1 the jib) or Gecko's head (2). */
  function fly(to: number) {
    s[Z.QM] = Q.FLAP, s[Z.QT] = 0, s[Z.QP] = to;
    if (to < 2) (s[Z.QTX] = PERCH[to]![0]), (s[Z.QTY] = PERCH[to]![1]);
  }

  /** Gecko hits a wall on `side` at speed v: the tower's letters there jump; hard, SLAP!; then he clings. */
  function slap(side: number, v: number) {
    const x = s[Z.HX]! + side * 4, y = s[Z.HY]! - 6;
    s[Z.SURF] = solid(x, y);
    if (s[Z.SURF] === 2 && v > 8) hooks.knock(x, y, Math.max(0.4, Math.min(2, v / 110)), side);
    if (v > 120) word(0, x, y - 14);
    for (let i = 0; i < 3 + v / 40; i++) bit(x, y + rnd() * 6 - 3, -side * (10 + rnd() * 30), (rnd() - 0.5) * 30, 0.3 + rnd() * 0.3, X.M);
    s[Z.MODE] = H.CLING, s[Z.SIDE] = side, s[Z.FACE] = side, s[Z.T] = 0, s[Z.VX] = s[Z.VY] = 0, s[Z.LN] = N.NONE, s[Z.CLIMBED] = 0;
  }

  function step(dt: number) {
    if (s[Z.WAIT]! > 0 && (s[Z.WAIT] = s[Z.WAIT]! - dt) <= 0) tap(108, 4);
    const t = (s[Z.T] = s[Z.T]! + dt), m = s[Z.MODE]!;
    // The line: out at 240 px/s; stuck if it reaches the spot within its length, else it falls short.
    const ln = s[Z.LN]!, hx = s[Z.HX]!, hy = s[Z.HY]! - 9;
    s[Z.LT] = s[Z.LT]! + dt;
    if (ln === N.SHOOT) {
      const dx = s[Z.AX]! - s[Z.LX]!, dy = s[Z.AY]! - s[Z.LY]!, d = Math.hypot(dx, dy), go = 240 * dt;
      if (d <= go) {
        s[Z.LX] = s[Z.AX]!, s[Z.LY] = s[Z.AY]!;
        s[Z.LN] = N.HOOK, s[Z.LT] = 0, s[Z.RL] = Math.max(10, Math.hypot(s[Z.AX]! - hx, s[Z.AY]! - hy));
      } else (s[Z.LX] = s[Z.LX]! + (dx / d) * go), (s[Z.LY] = s[Z.LY]! + (dy / d) * go);
      if (s[Z.LN] === N.SHOOT && Math.hypot(s[Z.LX]! - hx, s[Z.LY]! - hy) > MAXL) {
        // Too short: it was never going to reach. It falls, and Gecko is in the air already: he hangs
        // there a beat, looks, and drops like a stone.
        s[Z.LN] = N.SHORT, s[Z.LT] = 0, s[Z.LVX] = (dx / d) * 60, s[Z.LVY] = (dy / d) * 60;
        if (s[Z.MODE] === H.AIR) (s[Z.HANG] = 0.35), (s[Z.VX] = s[Z.VY] = 0);
        word(4, hx, hy - 12);
      }
    } else if (ln === N.SHORT) {
      s[Z.LVY] = s[Z.LVY]! + GRAV * dt;
      s[Z.LX] = s[Z.LX]! + s[Z.LVX]! * dt, s[Z.LY] = s[Z.LY]! + s[Z.LVY]! * dt;
      if (s[Z.LT]! > 0.55) s[Z.LN] = N.NONE;
    }
    if (m === H.AIR && s[Z.HANG]! > 0) s[Z.HANG] = s[Z.HANG]! - dt;
    else if (m === H.AIR) {
      s[Z.VY] = s[Z.VY]! + GRAV * dt;
      s[Z.VX] = s[Z.VX]! * (1 - 0.15 * dt);
      s[Z.HX] = s[Z.HX]! + s[Z.VX]! * dt;
      s[Z.HY] = s[Z.HY]! + s[Z.VY]! * dt;
      if (s[Z.LN] === N.HOOK) {
        // The swing: the line holds his hands at most RL from the anchor; he reels in as he swings.
        const dx = s[Z.HX]! - s[Z.AX]!, dy = s[Z.HY]! - 9 - s[Z.AY]!, d = Math.hypot(dx, dy) || 1;
        if (d > s[Z.RL]!) {
          const k = s[Z.RL]! / d, vr = (s[Z.VX]! * dx + s[Z.VY]! * dy) / d;
          s[Z.HX] = s[Z.AX]! + dx * k, s[Z.HY] = s[Z.AY]! + dy * k + 9;
          if (vr > 0) (s[Z.VX] = s[Z.VX]! - (vr * dx) / d), (s[Z.VY] = s[Z.VY]! - (vr * dy) / d);
        }
        s[Z.RL] = Math.max(10, s[Z.RL]! - 24 * dt);
        // Let go at the top of the arc, past the anchor and still rising; or hang on and climb up.
        const lt = s[Z.LT]!;
        if (lt > 0.3 && s[Z.VY]! < 0 && dx * s[Z.VX]! > 0 && Math.abs(dx) > s[Z.RL]! * 0.5) (s[Z.LN] = N.NONE), (s[Z.VY] = s[Z.VY]! - 30);
        else if (lt > 2.4) {
          const side = s[Z.HX]! < s[Z.AX]! ? 1 : -1;
          s[Z.HX] = s[Z.AX]! - side * 4, s[Z.HY] = s[Z.AY]! + 11;
          while (!solid(s[Z.HX]! + side * 4, s[Z.HY]! - 6) && Math.abs(s[Z.HX]! - s[Z.AX]!) < 30) s[Z.HX] = s[Z.HX]! + side;
          slap(side, 0);
        }
      }
      if (Math.abs(s[Z.VX]!) > 5) s[Z.FACE] = s[Z.VX]! > 0 ? 1 : -1;
      // Edges of the card: bounce back in.
      if (s[Z.HX]! < 4 || s[Z.HX]! > GW - 4) (s[Z.HX] = Math.max(4, Math.min(GW - 4, s[Z.HX]!))), (s[Z.VX] = -s[Z.VX]! * 0.5);
      // Collisions: head, walls, then feet.
      const x = s[Z.HX]!, y = s[Z.HY]!;
      if (s[Z.VY]! < 0 && solid(x, y - 11)) (s[Z.VY] = 30), (s[Z.HY] = y + 1);
      for (let side = -1; side <= 1; side += 2)
        // A wall: solid beside him at chest and at knee (a jib overhead is not a wall).
        if (s[Z.MODE] === H.AIR && solid(x + side * 3, y - 7) > 1 && solid(x + side * 3, y - 3) > 1) {
          while (solid(s[Z.HX]! + side * 3, s[Z.HY]! - 6) > 1) s[Z.HX] = s[Z.HX]! - side;
          slap(side, Math.hypot(s[Z.VX]!, s[Z.VY]!));
        }
      if (s[Z.MODE] === H.AIR && s[Z.VY]! >= 0 && solid(s[Z.HX]!, s[Z.HY]!)) {
        const v = s[Z.VY]!, k = solid(s[Z.HX]!, s[Z.HY]!);
        let fy = Math.floor(s[Z.HY]!);
        while (solid(s[Z.HX]!, fy - 1) && fy > 0) fy--;
        s[Z.HY] = fy, s[Z.LN] = s[Z.LN] === N.HOOK ? N.NONE : s[Z.LN]!, s[Z.T] = 0, s[Z.VX] = s[Z.VY] = 0;
        if (k === 1 && v > 135) {
          s[Z.MODE] = H.FLAT;
          word(1, s[Z.HX]!, fy - 16);
          for (let i = 0; i < 10; i++) bit(s[Z.HX]!, fy - 1, (rnd() - 0.5) * 90, -rnd() * 50, 0.5, X.M);
        } else {
          s[Z.MODE] = H.STANDS;
          if (k === 2 && v > 60) hooks.knock(s[Z.HX]!, fy + 3, Math.min(1.5, v / 160), 0);
          if (v > 100) for (let i = 0; i < 5; i++) bit(s[Z.HX]!, fy - 1, (rnd() - 0.5) * 60, -rnd() * 20, 0.35, X.M);
        }
      }
      // The cradle: in the way, it takes the hit and swings; its man shouts; the bucket slops.
      const cx = cradleX(), cy = cradleY();
      if (s[Z.MODE] === H.AIR && Math.abs(s[Z.HX]! - cx) < 8 && s[Z.HY]! - 5 > cy - 10 && s[Z.HY]! - 5 < cy + 3) {
        s[Z.GV] = s[Z.GV]! + s[Z.VX]! * 0.02;
        s[Z.VX] = -s[Z.VX]! * 0.4 + (s[Z.HX]! < cx ? -25 : 25);
        if (s[Z.HEY]! <= 0) word(2, cx, cy - 22);
        s[Z.HEY] = 1.2;
        for (let i = 0; i < 6; i++) bit(cx + 4, cy - 2, (rnd() - 0.3) * 50, -20 - rnd() * 40, 2, X.C);
      }
    } else if (m === H.CLING) {
      // Hand over hand up the wall, following its outline round every ledge; over the top, he stands.
      const side = s[Z.SIDE]!, y = Math.floor((s[Z.HY] = s[Z.HY]! - 20 * dt) - 9);
      let wx = -1;
      if (s[Z.SURF] === 2) wx = y >= TOP ? (side > 0 ? PL[y]! : PR[y]! - 1) : -1;
      else for (let i = 0; i < 9 && wx < 0; i++) if (solid(s[Z.HX]! + side * i, y) > 1) wx = s[Z.HX]! + side * i;
      s[Z.CLIMBED] = s[Z.CLIMBED]! + 20 * dt;
      if (wx < 0) {
        s[Z.HX] = s[Z.HX]! + side * 6;
        let fy = Math.floor(s[Z.HY]!) - 9;
        while (!solid(s[Z.HX]!, fy) && fy < STREET) fy++;
        (s[Z.HY] = fy), (s[Z.MODE] = H.STANDS), (s[Z.T] = 0);
      } else s[Z.HX] = s[Z.HX]! + (wx - side * 4 - s[Z.HX]!) * Math.min(1, dt * 14);
    } else if (m === H.FLAT && t > 1.1) {
      (s[Z.MODE] = H.STANDS), (s[Z.DAZED] = 1.8), (s[Z.T] = 0);
      if (s[Z.ASK]) (s[Z.ASK] = 0), tap(s[Z.QTX]!, s[Z.QTY]!);
    }
    if (s[Z.DAZED]! > 0) s[Z.DAZED] = s[Z.DAZED]! - dt;
    // The cradle swings back to hanging (it knocks against the tower, not through it).
    s[Z.GV] = s[Z.GV]! + (-14 * s[Z.GA]! - 2.4 * s[Z.GV]!) * dt;
    s[Z.GA] = s[Z.GA]! + s[Z.GV]! * dt;
    if (s[Z.GA]! < -0.1) (s[Z.GA] = -0.1), (s[Z.GV] = Math.abs(s[Z.GV]!) * 0.3);
    if (Math.abs(s[Z.GA]!) + Math.abs(s[Z.GV]!) < 0.004) s[Z.GA] = s[Z.GV] = 0;
    if (s[Z.HEY]! > 0) s[Z.HEY] = s[Z.HEY]! - dt;
    s[Z.WIPE] = s[Z.WIPE]! + dt;
    // The pigeon.
    const qm = s[Z.QM]!, qt = (s[Z.QT] = s[Z.QT]! + dt), near = Math.hypot(s[Z.HX]! - s[Z.QX]!, s[Z.HY]! - 6 - s[Z.QY]!);
    if (qm === Q.SIT && near < 20 && (s[Z.MODE] !== H.STANDS || s[Z.T]! < 0.2)) fly(s[Z.QP] === 1 ? 0 : s[Z.MODE] === H.STANDS ? 2 : 1);
    else if (qm === Q.HEAD && s[Z.MODE] !== H.STANDS) fly(1);
    else if (qm === Q.FLAP) {
      if (s[Z.QP] === 2) {
        if (s[Z.MODE] !== H.STANDS) fly(1);
        (s[Z.QTX] = s[Z.HX]! - 1), (s[Z.QTY] = s[Z.HY]! - 12);
      }
      // A loop first (it takes the long way round), then straight to the spot.
      const lx = qt < 0.9 ? s[Z.QTX]! + Math.cos(qt * 7) * 18 : s[Z.QTX]!, ly = qt < 0.9 ? s[Z.QTY]! - 14 + Math.sin(qt * 7) * 8 : s[Z.QTY]!;
      const dx = lx - s[Z.QX]!, dy = ly - s[Z.QY]!, d = Math.hypot(dx, dy) || 1, sp = Math.min(d, 80 * dt);
      s[Z.QVX] = dx / d;
      s[Z.QX] = s[Z.QX]! + (dx / d) * sp, s[Z.QY] = s[Z.QY]! + (dy / d) * sp + Math.sin(qt * 18) * 0.15;
      if (qt > 0.9 && d < 1) (s[Z.QM] = s[Z.QP] === 2 ? Q.HEAD : Q.SIT), s[Z.QM] === Q.HEAD && word(3, s[Z.QX]!, s[Z.QY]! - 12);
      // Flying into Gecko mid-swing: feathers everywhere.
      if (s[Z.MODE] === H.AIR && qt > 0.4 && near < 6 && Math.hypot(s[Z.VX]!, s[Z.VY]!) > 60) {
        s[Z.QM] = Q.TUMBLE, s[Z.QT] = 0, s[Z.QF] = 0;
        for (let i = 0; i < 9; i++) bit(s[Z.QX]!, s[Z.QY]!, (rnd() - 0.5) * 70, -rnd() * 50, 1.6 + rnd(), i & 1 ? X.I : X.M);
        word(3, s[Z.QX]!, s[Z.QY]! - 12);
      }
    } else if (qm === Q.TUMBLE) {
      s[Z.QF] = s[Z.QF]! + 120 * dt;
      s[Z.QY] = s[Z.QY]! + s[Z.QF]! * dt;
      if (qt > 0.6 || s[Z.QY]! > STREET - 6) fly(1);
    } else if (qm === Q.HEAD) (s[Z.QX] = s[Z.HX]! - 1), (s[Z.QY] = s[Z.HY]! - 12);
    // Bits: drops fall and splash; feathers drift and sway; dust settles.
    let n = nb[0]!;
    for (let i = n - 1; i >= 0; i--) {
      if ((LIFE[i] = LIFE[i]! - dt) <= 0 || Yb[i]! > GH) {
        n--;
        BX[i] = BX[n]!, Yb[i] = Yb[n]!, BVX[i] = BVX[n]!, BVY[i] = BVY[n]!, LIFE[i] = LIFE[n]!, COL[i] = COL[n]!;
        continue;
      }
      const f = COL[i] === X.I || (COL[i] === X.M && LIFE[i]! > 1);
      BVY[i] = f ? 12 : BVY[i]! + GRAV * dt * (COL[i] === X.M ? 0.5 : 1);
      if (f) BVX[i] = Math.sin(LIFE[i]! * 6) * 14;
      else BVX[i] = BVX[i]! * (1 - 3 * dt);
      BX[i] = BX[i]! + BVX[i]! * dt;
      Yb[i] = Yb[i]! + BVY[i]! * dt;
      if (solid(BX[i]!, Yb[i]!)) {
        if (COL[i] === X.C && BVY[i]! > 40) for (let k = 0; k < 2; k++) bit(BX[i]!, Yb[i]! - 1, (rnd() - 0.5) * 40, -20 - rnd() * 20, 0.3, X.C);
        BVY[i] = 0, Yb[i] = Yb[i]! - 1, LIFE[i] = Math.min(LIFE[i]!, 0.25);
      }
    }
    nb[0] = n;
    if (s[Z.WT]! < 9) s[Z.WT] = s[Z.WT]! + dt;
  }

  function busy() {
    return s[Z.MODE] !== H.STANDS || s[Z.LN] !== N.NONE || s[Z.DAZED]! > 0 || s[Z.WAIT]! > 0 || nb[0]! > 0 || s[Z.WT]! < 1 || s[Z.HEY]! > 0 || s[Z.GA] !== 0 || (s[Z.QM] !== Q.SIT && s[Z.QM] !== Q.HEAD);
  }

  /** A sprite with its feet on row y, centred on x. */
  const put = (a: Art, x: number, y: number, flip: boolean) => blit(p, a, Math.round(x) - (a.w >> 1), Math.round(y) - a.h, flip);

  function paint() {
    px.set(bg);
    // The cradle: its ropes from the davit, the platform, its man, his bucket.
    const cx = Math.round(cradleX()), cy = Math.round(cradleY());
    fill(p, 101, GPY - 1, 12, 2, X.K), dot(p, 112, GPY + 1, X.M);
    line(p, GPX - 1, GPY, cx - 5, cy - 9, X.M), line(p, GPX + 1, GPY, cx + 5, cy - 9, X.M);
    blit(p, MAN[s[Z.HEY]! > 0 ? 2 : (s[Z.WIPE]! * 3) & 1]!, cx - 4, cy - 9);
    fill(p, cx - 6, cy - 4, 1, 4, X.M), fill(p, cx + 5, cy - 4, 1, 4, X.M), fill(p, cx - 6, cy - 4, 12, 1, X.M);
    fill(p, cx - 7, cy, 14, 2, X.K), fill(p, cx - 6, cy, 12, 1, X.Y);
    fill(p, cx + 2, cy - 3, 3, 3, X.C), fill(p, cx + 2, cy - 3, 3, 1, X.I);
    // The line: out, stuck (taut), or falling short (sagging).
    const ln = s[Z.LN]!, m = s[Z.MODE]!, hx = Math.round(s[Z.HX]!), hy = Math.round(s[Z.HY]!);
    const handX = m === H.CLING ? hx + s[Z.SIDE]! * 2 : hx + s[Z.FACE]! * 2, handY = hy - 10;
    if (ln === N.SHORT) {
      const mx = (handX + s[Z.LX]!) / 2, my = (handY + s[Z.LY]!) / 2 + 6 + s[Z.LT]! * 30;
      line(p, handX, handY, mx, my, X.C), line(p, mx, my, s[Z.LX]!, s[Z.LY]!, X.C);
    } else if (ln) line(p, handX, handY, s[Z.LX]!, s[Z.LY]!, X.C);
    if (ln) fill(p, s[Z.LX]! - 1, s[Z.LY]! - 1, 2, 2, X.P);
    // Gecko.
    const f = s[Z.FACE]! < 0;
    if (m === H.FLAT) put(SPLAT, hx, hy, f);
    else if (m === H.CLING) {
      const a = CLIMB[(s[Z.CLIMBED]! / 3) & 1]!;
      put(a, hx, hy, s[Z.SIDE]! < 0);
    } else if (m === H.AIR && ln === N.HOOK) put(SWING, hx, hy, f);
    else if (m === H.AIR && Math.abs(s[Z.VX]!) > 60) put(FLY, hx, hy - 2, f);
    else if (m === H.AIR) put(SWING, hx, hy, f);
    else put(STAND, hx, hy, f);
    if (s[Z.DAZED]! > 0) for (let k = 0; k < 3; k++) {
      const a = s[Z.DAZED]! * 7 + k * 2.1;
      dot(p, hx + Math.cos(a) * 5, hy - 13 + Math.sin(a) * 1.5, k ? X.Y : X.I);
    }
    // The pigeon.
    const qm = s[Z.QM]!, qf = qm === Q.SIT || qm === Q.HEAD ? 0 : qm === Q.TUMBLE ? 2 : 1 + ((s[Z.QT]! * 12) & 1);
    put(BIRD[qf]!, s[Z.QX]!, s[Z.QY]!, qm === Q.FLAP ? s[Z.QVX]! < 0 : qm === Q.TUMBLE ? ((s[Z.QT]! * 10) & 1) > 0 : s[Z.QX]! > 80);
    for (let i = 0; i < nb[0]!; i++) dot(p, BX[i]!, Yb[i]!, COL[i]!);
    // The word: it slams in (a pixel big and up), holds, then goes.
    const wt = s[Z.WT]!;
    if (wt < 0.8) say(p, FONT, WORDS[s[Z.WD]!]!, s[Z.WX]! - (wt < 0.06 ? 1 : 0), s[Z.WY]! - (wt < 0.06 ? 2 : 0), s[Z.WD] === 1 ? X.Y : s[Z.WD] === 2 || s[Z.WD] === 4 ? X.I : X.C, s[Z.WD] === 0 ? X.P : X.V, X.K);
  }

  return { step, paint, busy, tap, state: s, solid };
}

export type ClimberScene = { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; state: Float64Array; destroy(): void };

// Letter springs: shift x and y (quarter art px), turn (deg). Strings made once: a frame picks one.
const NUM: string[] = Array.from({ length: 401 }, (_, i) => String(i - 200));
const CH = ["--x", "--y", "--r"] as const;

/** The slot mount: the scene on a pixel canvas over the stage; its letters jump only where hit. */
export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): ClimberScene {
  const engine = createEngine({ root: stage, settle: 0.6 }), Lg = engine.ledger;
  const els = [...slot.querySelectorAll<HTMLElement>(".wc47-l")], n = els.length;
  const LX = new Float32Array(n), LY = new Float32Array(n), LW = new Float32Array(n);
  const Pq = new Float32Array(n * 3), Vq = new Float32Array(n * 3), HIT = new Float32Array(n), WAS = new Int16Array(n * 3), ON = new Uint8Array(n);
  const st = new Uint8Array([1, 1]); // resized, dirty
  const ro = new ResizeObserver(() => ((st[0] = 1), engine.wake()));
  ro.observe(slot);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const hooks: Hooks = {
    knock(x, y, power, dir) {
      for (let i = 0; i < n; i++) {
        const dx = LX[i]! - x, dy = LY[i]! - y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 6 + LW[i]! / 2 || Math.abs(dy) > 7) continue;
        const f = power * (1 - Math.min(1, d / 12) * 0.6), side = dir || (dx >= 0 ? 1 : -1);
        Vq[i * 3] = Vq[i * 3]! + side * 110 * f;
        Vq[i * 3 + 1] = Vq[i * 3 + 1]! - (dir ? 50 : -90) * f;
        Vq[i * 3 + 2] = Vq[i * 3 + 2]! + side * (200 + 200 * f) * f;
        HIT[i] = 0.25;
        ON[i] = 1;
      }
    },
  };
  const p = pixels(GW, GH), w = climber(p, (Math.random() * 4294967296) >>> 0, hooks), view = pixelCanvas(Lg, stage, p, PALETTE);
  const tap = (x: number, y: number) => (w.tap(x, y), engine.wake());
  const fromPage = (x: number, y: number, bw: number, bh: number) => tap((x / bw) * GW, (y / bh) * GH);
  if (first) {
    const r = stage.getBoundingClientRect(); // once, at mount: outside any frame
    fromPage(first.x, first.y, r.width || 1, r.height || 1);
  } else w.state[30] = 0.6; // it swings in by itself a moment after it loads
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    fromPage(e.clientX - r.left, e.clientY - r.top, r.width || 1, r.height || 1);
  }, { signal: engine.signal });
  engine.add({
    read() {
      if (!st[0]) return;
      st[0] = 0;
      const k = GW / (slot.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        let ox = 0, oy = 0, e: HTMLElement | null = els[i]!;
        while (e && e !== slot) (ox += e.offsetLeft), (oy += e.offsetTop), (e = e.offsetParent as HTMLElement | null);
        LW[i] = els[i]!.offsetWidth * k;
        LX[i] = ox * k + LW[i]! / 2;
        LY[i] = (oy + els[i]!.offsetHeight / 2) * k;
      }
    },
    step(e, dt) {
      w.step(dt);
      let live = false;
      for (let i = 0; i < n; i++) {
        if (ON[i] !== 1) continue;
        let moving = HIT[i]! > 0;
        if (moving) HIT[i] = HIT[i]! - dt;
        for (let c = 0; c < 3; c++) {
          const j = i * 3 + c;
          Vq[j] = Vq[j]! + (-170 * Pq[j]! - 11 * Vq[j]!) * dt;
          Pq[j] = Math.max(-200, Math.min(200, Pq[j]! + Vq[j]! * dt));
          if (Math.abs(Pq[j]!) > 0.5 || Math.abs(Vq[j]!) > 4) moving = true;
        }
        if (moving) live = true;
        else (ON[i] = 2), Pq.fill(0, i * 3, i * 3 + 3), Vq.fill(0, i * 3, i * 3 + 3);
      }
      if (w.busy() || live) (e.busy(), (st[1] = 1));
    },
    render() {
      for (let i = 0; i < n; i++) {
        if (!ON[i]) continue;
        const el = els[i]!;
        if (ON[i] === 2) {
          for (let c = 0; c < 3; c++) Lg.unstyle(el, CH[c]!), (WAS[i * 3 + c] = 0);
          Lg.attr(el, "data-hit", null);
          ON[i] = 0;
          continue;
        }
        for (let c = 0; c < 3; c++) {
          const q = Math.round(Pq[i * 3 + c]!);
          if (q !== WAS[i * 3 + c]) (WAS[i * 3 + c] = q), Lg.style(el, CH[c]!, NUM[q + 200]!);
        }
        Lg.attr(el, "data-hit", HIT[i]! > 0 ? "" : null);
      }
      if (!st[1]) return;
      st[1] = 0;
      w.paint();
      view.show();
    },
  });
  engine.start();
  return { engine, tap, state: w.state, destroy: () => engine.destroy() };
}

/** The poster: the same scene, run headless to Gecko mid-swing towards the tower, as one still. */
export function poster() {
  const p = pixels(GW, GH), w = climber(p, 5);
  w.tap(108, 4);
  for (let i = 0; i < 60 * 3 && !(w.state[Z.LN] === N.HOOK && w.state[Z.LT]! > 0.3); i++) w.step(1 / 60);
  w.paint();
  return p;
}
