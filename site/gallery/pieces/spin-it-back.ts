// "Spin it back": two comic panels. Left, the page: PAGE ONE, the headline NOTHING BROKE., a
// line of copy, a clock and an UNDO key, all real elements. Right, space: a pixel globe turning, and
// Captain Undo (an original caped flier: cyan suit, pink cape, an undo arrow on the chest) hovering by
// it. Meteors fall on the page: wherever one lands the page cracks and the letters it reaches fly
// off and pile up at the bottom (only those). Then Captain Undo circles the globe, faster and faster,
// until the world stops and spins backwards: the page rewinds. Every letter flies back up the way it
// fell, the meteors climb back into the sky, the cracks close, and the clock runs backwards to the
// minute before it all happened. That is Recall, played as a story: the engine's ledger gives the page
// back exactly. Tap the page: a meteor lands there. Tap space (or UNDO): another lap, faster. Spin it
// back too far and the clock runs past the minute, past the years, all the way to 65M BC: the dinosaurs
// come back. One more tap and their meteor arrives.
// Bricks: the kernel (fixed step, settle, the ledger) and fizlet/slot. The scene is palette indices
// in one small buffer (./pixel-stage.ts); the page's letters and clock change only through the ledger.
import { createEngine } from "../../../src/kernel/index";
import type { SlotTap } from "../../../src/slot";
import { art, blit, dot, fill, line, pixelCanvas, pixels, type Art, type Pixels } from "./pixel-stage";
import { outline, say, sayW, type Font } from "./pixel-words";

export const GW = 160, GH = 90;
// 0 is a hole (the real page shows through); then the Fizlet brand tokens.
export const PALETTE = ["", "#07060f", "#3b3170", "#3f296a", "#9a63ff", "#aea4d6", "#f6f3ff", "#ff2e88", "#ff7389", "#19f0ff", "#39ffb0", "#ffc21a"] as const;
const enum X { K = 1, L, B, V, M, I, P, A, C, G, Y }
const MAP = { k: X.K, l: X.L, b: X.B, v: X.V, m: X.M, i: X.I, p: X.P, a: X.A, c: X.C, g: X.G, y: X.Y };
const FONT: Font = {
  R: "1111010001111101001010001", E: "1111110000111101000011111", W: "1000110001101011101110001", I: "1111100100001000010011111",
  N: "1000111001101011001110001", D: "1111010001100011000111110", A: "0111010001111111000110001", "!": "0010000100001000000000100",
  B: "1111010001111101000111110", O: "0111010001100011000101110", K: "1000110010111001001010001", "?": "0111010001001100000000100",
};

/** The page panel (the real page fills it), the clock's box and the UNDO key, in art px [x, y, w, h]. */
export const PAGE = [4, 4, 72, 82] as const, CLOCK = [8, 61, 34, 19] as const, UNDO = [48, 66, 24, 10] as const;
// The globe and the flier's orbit (a tilted ellipse round it).
const GX = 119, GY = 50, R = 21, RX = 31, RY = 8, TW = 64, TH = 32;
/** Where Captain Undo waits, and the clock's minute when the story starts (11:58). */
const HOVX = 99, HOVY = 21, START = 718;
const FR = 720; // frames the page's past can hold (decimated when full)
const CRACKS = 8, RAYS = 7, SEGS = 4;
export const YEARS = ["2026", "1999", "1969", "1889", "1492", "1066", "1 AD", "65M BC"];
const YEAR = 0.3; // seconds of spinning back per year shown

const spr = (rows: string[]) => outline(art(rows, MAP), X.K);
/** Twice the size (each pixel 2 × 2), outlined after: the dinosaur is the punchline. */
const big = (rows: string[]) => outline(art(rows.flatMap((r) => [r.replace(/./g, "$&$&"), r.replace(/./g, "$&$&")]), MAP), X.K);
const FLY = spr(["...........cc.", "pp........cccc", "ppppcccccccik.", ".pppcccccicccyy", "..pyyccc......", "....yy........"]);
const HOVER = spr(["....c....", "...ccc...", "..ccccc..", "..ckkkc..", "..ccccc..", ".pcccccp.", "pcyyyyycp", "pccciccp.", "pcccccccp", "ppyyyyypp", "ppcc.ccpp", "pccc.cccp", ".yy...yy."]);
const THUMB = spr(["....c....", "...cccy..", "..ccccc..", "..ckkkc..", "..ccccc..", ".pccccc..", "pcccccy.p", "pccciccp.", "pcccccccp", "ppyyyyypp", "ppcc.ccpp", "pccc.cccp", ".yy...yy."]);
const DINO = [
  big(["..........gggggg..", ".........ggkgggggg", ".........ggggggggg", ".........gggggiiii", ".........gggg.....", "g......ggggggg....", "gg....gggggggg.g..", ".gg.ggggggggggg...", "..gggggbbbbggg....", "...gggggbbbgg.....", ".....gg...gg......", ".....gg....gg.....", "....ggg....ggg...."]),
  big(["..........gggggg..", ".........ggkgggggg", ".........ggggggggg", ".........gggggiiii", ".........gggg.....", "g......ggggggg....", "gg....gggggggg.g..", ".gg.ggggggggggg...", "..gggggbbbbggg....", "...gggggbbbgg.....", "......gggg........", "......gg.gg.......", ".....ggg.ggg......"]),
  big([".........gggggg...", "........ggkggggg..", "........gggggggg..", "........gggiiiii..", "........ggg.......", "........gggiiiii..", "g......gggggggggg.", "gg....gggggggg.g..", ".gg.ggggggggggg...", "..gggggbbbbggg....", "...gggggbbbgg.....", ".....gg...gg......", ".....gg....gg.....", "....ggg....ggg...."]),
];
const ROCK = spr([".yy.", "yppy", "pppa", ".pa."]);

// The globe: its map (0 sea, 1 land, 2 ice) and, per pixel of the disc, where it looks on the map and how lit it is.
const TEX = new Uint8Array(TW * TH);
for (let v = 0; v < TH; v++)
  for (let u = 0; u < TW; u++) {
    const lat = ((v + 0.5) / TH - 0.5) * Math.PI, lon = (u / TW) * 6.2832;
    let land = 0;
    for (const [bl, bt, r] of [[0.6, 0.5, 0.55], [1.1, -0.3, 0.4], [2.6, 0.7, 0.5], [3.1, 0.1, 0.35], [4.2, -0.5, 0.6], [5.3, 0.4, 0.45], [4.9, 0.9, 0.3]])
      if (Math.sin(lat) * Math.sin(bt!) + Math.cos(lat) * Math.cos(bt!) * Math.cos(lon - bl!) > Math.cos(r! + Math.sin(u * 1.3 + v * 2.1) * 0.08)) land = 1;
    TEX[v * TW + u] = Math.abs(lat) > 1.25 ? 2 : land;
  }
const DISC: number[] = [];
for (let dy = -R; dy <= R; dy++)
  for (let dx = -R; dx <= R; dx++) {
    const nx = dx / R, ny = dy / R, q = 1 - nx * nx - ny * ny;
    if (q < 0) continue;
    const nz = Math.sqrt(q), lit = -0.55 * nx - 0.45 * ny + 0.7 * nz;
    DISC.push((GY + dy) * GW + GX + dx, Math.min(TH - 1, Math.floor((Math.asin(ny) / Math.PI + 0.5) * TH)) * TW, Math.round((Math.atan2(nx, nz) / 6.2832) * TW) + TW, lit > 0.45 ? 0 : lit > 0.05 ? 1 : (dx + dy) & 1 && lit > -0.1 ? 1 : 2, q < 0.12 ? 1 : 0);
  }
// Colours: [sea, land, ice] × [lit, shade, night].
const GLOBE = [X.V, X.B, X.L, X.G, X.G, X.B, X.I, X.M, X.L];

/** The page panel, the space panel (stars, a band of far nebula), the gutters. */
function world(p: Pixels) {
  fill(p, 0, 0, GW, GH, X.K);
  fill(p, 80, 3, 77, 84, X.L);
  fill(p, 81, 4, 75, 82, X.K);
  for (let y = 4; y < 86; y++) for (let x = 81; x < 156; x++) {
    const n = Math.sin(x * 0.11 + y * 0.07) + Math.sin(y * 0.19 - x * 0.05);
    if (n > 1.1 && (x + y) & 1) dot(p, x, y, X.B);
    else if ((x * 73 + y * 151) % 97 === 0) dot(p, x, y, (x + y) % 3 ? X.M : X.I);
  }
  fill(p, PAGE[0] - 1, PAGE[1] - 1, PAGE[2] + 2, PAGE[3] + 2, X.L);
  fill(p, PAGE[0], PAGE[1], PAGE[2], PAGE[3], 0);
}

export interface Page {
  /** The letters: home centre and size in art px (the mount measures them; tests make some up). */
  x: Float32Array;
  y: Float32Array;
  w: Float32Array;
  h: Float32Array;
}

// Captain Undo: hovering, joining the orbit, in orbit, leaving it. The dinosaur: none, walking in, roaring, standing, flung.
const enum H { HOVERING, JOIN, ORBIT, LEAVE }
const enum D { GONE, WALK, ROAR, STAY, FLUNG }
const BITS = 96;

/** The story's state slots (one typed array: nothing boxes in a step). */
const enum Z {
  MODE = 0, T = 1, TH0 = 2, W = 3, SPIN = 4, ROT = 5, CLK = 6, CLK0 = 7, NF = 8, F = 9, STRIDE = 10, STEPS = 11, DEEP = 12, DM = 13, DX = 14, DY = 15, DT = 16, DVX = 17, DVY = 18, WD = 19, WX = 20, WY = 21, WT = 22, AUTO = 23, FLASH = 24, CL1 = 25, PROUD = 26, HX = 27, HY = 28, NC = 29, N1 = 30,
}

/** The story on plain numbers (no DOM): the live mount, the poster and the tests all run it. */
export function rewinder(p: Pixels, seed: number, page: Page) {
  const bg = new Uint8Array(GW * GH), px = p.px, n = page.x.length;
  world(p);
  bg.set(px);
  const rs = new Uint32Array([seed >>> 0 || 1]);
  const rnd = () => ((rs[0] = Math.imul(rs[0]!, 1664525) + 1013904223), rs[0]! / 4294967296);
  const s = new Float64Array(40);
  s[Z.CLK] = s[Z.CLK0] = START, s[Z.STRIDE] = 1, s[Z.F] = -1, s[Z.WT] = 9, s[Z.HX] = HOVX, s[Z.HY] = HOVY, s[Z.AUTO] = -1, s[Z.DX] = -20;
  // The letters: offset (art px), velocity, turn; 1 while loose.
  const OX = new Float32Array(n), OY = new Float32Array(n), VX = new Float32Array(n), VY = new Float32Array(n), RO = new Float32Array(n), VR = new Float32Array(n), LOOSE = new Uint8Array(n);
  // Meteors in flight (two at most): from, to, time; -1: none.
  const MX0 = new Float32Array(2), MY0 = new Float32Array(2), MX1 = new Float32Array(2), MY1 = new Float32Array(2), MT = new Float32Array(2).fill(-1);
  const MX = new Float32Array(2), MY = new Float32Array(2);
  // The page's past: one frame per step while anything moves on it (letters × 3, meteors × 2 × 2).
  const SZ = n * 3 + 4, PAST = new Int16Array(FR * SZ);
  // Cracks: centre, the frame they happened on, and their rays as points.
  const CX = new Float32Array(CRACKS), CY = new Float32Array(CRACKS), CB = new Float32Array(CRACKS), CK = new Float32Array(CRACKS * RAYS * SEGS * 2);
  // Bits: dust, chips, sparks.
  const BX = new Float32Array(BITS), BY = new Float32Array(BITS), BVX = new Float32Array(BITS), BVY = new Float32Array(BITS), BL = new Float32Array(BITS), BC = new Uint8Array(BITS);
  const nb = new Uint32Array(1);
  const WORDS = ["REWIND", "RAWR!", "BONK!", "?"];

  const inPage = (x: number, y: number) => x >= PAGE[0] && x < PAGE[0] + PAGE[2] && y >= PAGE[1] && y < PAGE[1] + PAGE[3];
  const inUndo = (x: number, y: number) => x >= UNDO[0] && x < UNDO[0] + UNDO[2] && y >= UNDO[1] && y < UNDO[1] + UNDO[3];
  /** The floor under x: the clock's top over the clock, else the bottom of the page. */
  const floor = (x: number) => (x >= CLOCK[0] && x < CLOCK[0] + CLOCK[2] ? CLOCK[1] : PAGE[1] + PAGE[3] - 1);
  const rewinding = () => s[Z.F]! >= 0;
  /** The globe's turn (rad/s): forward, slowing as he speeds up, backwards once he is fast enough. */
  const globe = () => 0.7 - 0.12 * s[Z.W]!;

  function bit(x: number, y: number, vx: number, vy: number, life: number, c: number) {
    const i = nb[0]!;
    if (i >= BITS) return;
    nb[0] = i + 1;
    BX[i] = x, BY[i] = y, BVX[i] = vx, BVY[i] = vy, BL[i] = life, BC[i] = c;
  }
  function word(w: number, x: number, y: number) {
    s[Z.WD] = w, s[Z.WX] = Math.max(2, Math.min(GW - 3 - sayW(WORDS[w]!), x - sayW(WORDS[w]!) / 2)), s[Z.WY] = Math.max(2, y), s[Z.WT] = 0;
  }

  /** A meteor for (x, y) on the page: from high over the globe. */
  function meteor(x: number, y: number) {
    const k = MT[0]! < 0 ? 0 : MT[1]! < 0 ? 1 : -1;
    if (k < 0 || s[Z.NC]! >= CRACKS) return lap();
    MX0[k] = 146 + rnd() * 10, MY0[k] = -6, MX1[k] = x, MY1[k] = y, MT[k] = 0, MX[k] = MX0[k]!, MY[k] = MY0[k]!;
  }
  /** One more lap: he joins the orbit, or goes faster. */
  function lap() {
    s[Z.SPIN] = Math.min(9, Math.max(s[Z.SPIN]!, 2) + 1.2);
    if (s[Z.MODE] === H.HOVERING || s[Z.MODE] === H.LEAVE) (s[Z.MODE] = H.JOIN), (s[Z.T] = 0), (s[Z.TH0] = Math.atan2((s[Z.HY]! - GY) / RY, (s[Z.HX]! - GX) / RX));
  }
  /** A tap at (x, y) art px: on the page a meteor; in space or on UNDO a lap. With the dinosaur there, its meteor. */
  function tap(x: number, y: number) {
    s[Z.AUTO] = -1;
    if (s[Z.DM] && s[Z.DM] !== D.FLUNG) return meteor(Math.max(54, s[Z.DX]! - 12), s[Z.DY]! - 18);
    if (s[Z.DM]) return;
    if (inPage(x, y) && !inUndo(x, y) && !rewinding()) meteor(x, y);
    else lap();
  }

  /** The meteor hits: a crack, the letters it reaches thrown, dust; the dinosaur, if it is there, flung. */
  function impact(x: number, y: number) {
    s[Z.FLASH] = 0.08;
    const c = s[Z.NC]!;
    s[Z.NC] = c + 1;
    CX[c] = x, CY[c] = y, CB[c] = s[Z.NF]!;
    for (let r = 0; r < RAYS; r++) {
      let a = (r / RAYS) * 6.2832 + rnd() * 0.6, qx = x, qy = y;
      for (let j = 0; j < SEGS; j++) {
        const o = ((c * RAYS + r) * SEGS + j) * 2;
        a += (rnd() - 0.5) * 1.2;
        qx += Math.cos(a) * (2 + rnd() * 3);
        qy += Math.sin(a) * (2 + rnd() * 3);
        CK[o] = Math.max(PAGE[0], Math.min(PAGE[0] + PAGE[2] - 1, qx));
        CK[o + 1] = Math.max(PAGE[1], Math.min(PAGE[1] + PAGE[3] - 1, qy));
      }
    }
    for (let i = 0; i < n; i++) {
      const dx = page.x[i]! + OX[i]! - x, dy = page.y[i]! + OY[i]! - y, d = Math.hypot(dx, dy) || 1, f = 1.25 - d / 13;
      if (f <= 0) continue;
      LOOSE[i] = 1;
      VX[i] = VX[i]! + (dx / d) * 70 * f + (rnd() - 0.5) * 30;
      VY[i] = VY[i]! - 70 - 90 * f;
      VR[i] = VR[i]! + (rnd() - 0.5) * 900;
    }
    for (let k = 0; k < 14; k++) bit(x, y, (rnd() - 0.5) * 120, -30 - rnd() * 90, 0.4 + rnd() * 0.5, k & 1 ? X.M : k & 2 ? X.Y : X.P);
    if (s[Z.DM] && s[Z.DM] !== D.FLUNG) {
      // The dinosaur's meteor: it goes (tumbling off, out into space), and the clock is back in the present.
      s[Z.DM] = D.FLUNG, s[Z.DT] = 0, s[Z.DVX] = 70, s[Z.DVY] = -170, s[Z.DEEP] = 0;
      word(2, x, y - 16);
    }
  }

  /** Save this frame of the page (letters, meteors), halving the past when it is full. */
  function record() {
    if (++s[Z.STEPS]! % s[Z.STRIDE]!) return;
    let f = s[Z.NF]!;
    if (!f) s[Z.CLK0] = s[Z.CLK]!;
    if (f >= FR) {
      for (let k = 1; k < FR / 2; k++) PAST.copyWithin(k * SZ, 2 * k * SZ, 2 * k * SZ + SZ);
      for (let c = 0; c < s[Z.NC]!; c++) CB[c] = Math.floor(CB[c]! / 2);
      f = FR / 2;
      s[Z.STRIDE] = s[Z.STRIDE]! * 2;
    }
    const o = f * SZ;
    for (let i = 0; i < n; i++) (PAST[o + i * 3] = Math.round(OX[i]! * 8)), (PAST[o + i * 3 + 1] = Math.round(OY[i]! * 8)), (PAST[o + i * 3 + 2] = Math.round(RO[i]!));
    for (let k = 0; k < 2; k++) (PAST[o + n * 3 + k * 2] = MT[k]! < 0 ? -32768 : Math.round(MX[k]! * 8)), (PAST[o + n * 3 + k * 2 + 1] = Math.round(MY[k]! * 8));
    s[Z.NF] = f + 1;
  }
  /** Show frame f of the past: the letters and meteors where they were. */
  function replay(f: number) {
    const o = f * SZ;
    for (let i = 0; i < n; i++) (OX[i] = PAST[o + i * 3]! / 8), (OY[i] = PAST[o + i * 3 + 1]! / 8), (RO[i] = PAST[o + i * 3 + 2]!), (VX[i] = VY[i] = VR[i] = 0);
    for (let k = 0; k < 2; k++) {
      const x = PAST[o + n * 3 + k * 2]!;
      MT[k] = x === -32768 ? -1 : 0.5;
      MX[k] = x / 8, MY[k] = PAST[o + n * 3 + k * 2 + 1]! / 8;
    }
  }

  function step(dt: number) {
    if (s[Z.AUTO]! > 0) {
      // On its own: two meteors, then the rewind.
      const a = (s[Z.AUTO] = s[Z.AUTO]! + dt);
      if (a - dt < 0.5 && a >= 0.5) meteor(25, 21);
      if (a - dt < 1.1 && a >= 1.1) meteor(56, 37);
      if (a - dt < 2.4 && a >= 2.4) (lap(), (s[Z.SPIN] = 3.4), (s[Z.AUTO] = -2));
    }
    const t = (s[Z.T] = s[Z.T]! + dt), mode = s[Z.MODE]!;
    // Speed: up to what the laps ask for; the laps wear off once the page's past is all undone.
    const want = mode === H.JOIN || mode === H.ORBIT ? 2.5 + 1.6 * s[Z.SPIN]! : 0;
    s[Z.W] = s[Z.W]! + Math.max(-7 * dt, Math.min(8 * dt, want - s[Z.W]!));
    if (!rewinding() && !s[Z.NF]) s[Z.SPIN] = Math.max(0, s[Z.SPIN]! - (s[Z.DEEP]! > 0 ? 1.4 : 2.4) * dt);
    s[Z.TH0] = s[Z.TH0]! + s[Z.W]! * dt;
    const g = globe();
    s[Z.ROT] = s[Z.ROT]! - g * dt * (TW / 6.2832);
    if (mode === H.JOIN && t > 0.35) (s[Z.MODE] = H.ORBIT), (s[Z.T] = 0);
    if (mode === H.ORBIT && s[Z.SPIN]! <= 0 && s[Z.W]! < 3.2) (s[Z.MODE] = H.LEAVE), (s[Z.T] = 0);
    if (mode === H.LEAVE && t > 0.45) (s[Z.MODE] = H.HOVERING), (s[Z.T] = 0), (s[Z.W] = 0), (s[Z.PROUD] = s[Z.DEEP]! > 0.3 || s[Z.DM] ? -1.2 : 1.2);
    // Where he is: on the orbit, or easing between it and his spot.
    const th = s[Z.TH0]!, ox = GX + Math.cos(th) * RX, oy = GY + Math.sin(th) * RY - Math.cos(th) * 5;
    const k = mode === H.JOIN ? Math.min(1, t / 0.35) : mode === H.LEAVE ? 1 - Math.min(1, t / 0.45) : mode === H.ORBIT ? 1 : 0;
    const e = k * k * (3 - 2 * k);
    s[Z.HX] = HOVX + (ox - HOVX) * e, s[Z.HY] = HOVY + (oy - HOVY) * e;
    if (s[Z.PROUD]! > 0) s[Z.PROUD] = Math.max(0, s[Z.PROUD]! - dt);
    else if (s[Z.PROUD]! < 0) s[Z.PROUD] = Math.min(0, s[Z.PROUD]! + dt);
    // The world spins backwards: the page's past plays in reverse, the clock runs back with it.
    if (g < -0.02 && s[Z.NF]! > 0) {
      if (!rewinding()) (s[Z.F] = s[Z.NF]! - 1), (s[Z.N1] = s[Z.NF]!), (s[Z.CL1] = s[Z.CLK]!), word(0, 118, 6);
      s[Z.F] = Math.max(0, s[Z.F]! - (40 - g * 420) * dt);
      const f = Math.floor(s[Z.F]!);
      replay(f);
      s[Z.CLK] = s[Z.CLK0]! + (s[Z.CL1]! - s[Z.CLK0]!) * (f / Math.max(1, s[Z.N1]! - 1));
      if (s[Z.F] === 0) {
        // All of it undone: home, whole, the minute before.
        for (let i = 0; i < n; i++) OX[i] = OY[i] = RO[i] = VX[i] = VY[i] = VR[i] = LOOSE[i] = 0;
        MT.fill(-1);
        s[Z.NF] = 0, s[Z.NC] = 0, s[Z.F] = -1, s[Z.STRIDE] = 1, s[Z.CLK] = s[Z.CLK0]!;
        // On its own it stops at the minute; only your extra laps go on into the years.
        if (s[Z.AUTO] === -2) (s[Z.SPIN] = 0), (s[Z.AUTO] = -1);
      } else s[Z.NF] = f + 1;
    } else if (s[Z.F]! >= 0) s[Z.F] = -1;
    // Past the minute: the years go by backwards (and come forward again when the world does).
    if (!rewinding() && !s[Z.NF]) {
      if (g < -0.02) s[Z.DEEP] = s[Z.DEEP]! - g * 3 * dt;
      else if (s[Z.DM] === D.GONE || s[Z.DM] === D.FLUNG) s[Z.DEEP] = Math.max(0, s[Z.DEEP]! - 4 * dt);
    }
    if (s[Z.DEEP]! >= YEAR * (YEARS.length - 0.5) && s[Z.DM] === D.GONE) (s[Z.DM] = D.WALK), (s[Z.DT] = 0), (s[Z.DX] = 104), (s[Z.DY] = PAGE[1] + PAGE[3] - 1), (s[Z.SPIN] = 0);
    if (!rewinding() && !s[Z.DEEP]) s[Z.CLK] = s[Z.CLK]! + dt;
    // The dinosaur: walks in along the bottom of the page, roars, stays; its meteor flings it away.
    const dm = s[Z.DM]!, dtt = (s[Z.DT] = s[Z.DT]! + dt);
    if (dm === D.WALK) {
      s[Z.DX] = s[Z.DX]! - 30 * dt;
      if (s[Z.DX]! <= 60) (s[Z.DM] = D.ROAR), (s[Z.DT] = 0), word(1, 46, 38);
    } else if (dm === D.ROAR && dtt > 0.9) s[Z.DM] = D.STAY;
    else if (dm === D.FLUNG) {
      s[Z.DVY] = s[Z.DVY]! + 300 * dt;
      s[Z.DX] = s[Z.DX]! + s[Z.DVX]! * dt, s[Z.DY] = s[Z.DY]! + s[Z.DVY]! * dt;
      if (s[Z.DY]! > GH + 40) s[Z.DM] = D.GONE;
    }
    // Meteors: in on a straight line, faster as they come.
    for (let m = 0; m < 2; m++) {
      if (MT[m]! < 0 || rewinding()) continue;
      const u = (MT[m] = MT[m]! + dt / 0.55) ** 2;
      MX[m] = MX0[m]! + (MX1[m]! - MX0[m]!) * Math.min(1, u), MY[m] = MY0[m]! + (MY1[m]! - MY0[m]!) * Math.min(1, u);
      if (u >= 1) (MT[m] = -1), impact(MX1[m]!, MY1[m]!);
    }
    // Loose letters: thrown, they fall, bounce and lie where they land, a little turned.
    let moving = MT[0]! >= 0 || MT[1]! >= 0;
    if (!rewinding())
      for (let i = 0; i < n; i++) {
        if (LOOSE[i] !== 1) continue;
        VY[i] = VY[i]! + 280 * dt;
        OX[i] = OX[i]! + VX[i]! * dt, OY[i] = OY[i]! + VY[i]! * dt, RO[i] = RO[i]! + VR[i]! * dt;
        const x = page.x[i]! + OX[i]!, hw = page.w[i]! / 2, bot = page.y[i]! + page.h[i]! / 2 + OY[i]!, fl = floor(x);
        if (x - hw < PAGE[0] + 1 || x + hw > PAGE[0] + PAGE[2] - 1) (OX[i] = Math.max(PAGE[0] + 1 + hw, Math.min(PAGE[0] + PAGE[2] - 1 - hw, x)) - page.x[i]!), (VX[i] = -VX[i]! * 0.5);
        if (bot > fl && VY[i]! > 0 && bot - VY[i]! * dt <= fl + 1) {
          OY[i] = OY[i]! - (bot - fl);
          VY[i] = VY[i]! < 40 ? 0 : -VY[i]! * 0.35;
          VX[i] = VX[i]! * 0.55, VR[i] = VR[i]! * 0.4;
          if (!VY[i] && Math.abs(VX[i]!) < 6) (LOOSE[i] = 2), (VX[i] = VR[i] = 0);
        }
        if (OY[i]! > 200) LOOSE[i] = 2;
        moving = true;
      }
    if (moving && !rewinding()) record();
    // Bits.
    let q = nb[0]!;
    for (let i = q - 1; i >= 0; i--) {
      if ((BL[i] = BL[i]! - dt) <= 0) {
        q--;
        BX[i] = BX[q]!, BY[i] = BY[q]!, BVX[i] = BVX[q]!, BVY[i] = BVY[q]!, BL[i] = BL[q]!, BC[i] = BC[q]!;
        continue;
      }
      BVY[i] = BVY[i]! + 260 * dt;
      BX[i] = BX[i]! + BVX[i]! * dt, BY[i] = BY[i]! + BVY[i]! * dt;
    }
    nb[0] = q;
    if (s[Z.FLASH]! > 0) s[Z.FLASH] = s[Z.FLASH]! - dt;
    if (s[Z.WT]! < 9) s[Z.WT] = s[Z.WT]! + dt;
  }

  function busy() {
    if (s[Z.MODE] !== H.HOVERING || s[Z.W]! > 0 || s[Z.SPIN]! > 0 || s[Z.AUTO]! > 0 || rewinding() || nb[0] || s[Z.WT]! < 1.2 || s[Z.PROUD] || s[Z.FLASH]! > 0) return true;
    if (MT[0]! >= 0 || MT[1]! >= 0 || (s[Z.DEEP]! > 0 && !s[Z.DM]) || s[Z.DM] === D.WALK || s[Z.DM] === D.ROAR || s[Z.DM] === D.FLUNG) return true;
    for (let i = 0; i < n; i++) if (LOOSE[i] === 1) return true;
    return false;
  }

  /** What the clock says: a minute of the day (0–1439), or a year (1440 + its index). */
  function clock() {
    if (s[Z.DM] && s[Z.DM] !== D.FLUNG) return 1440 + YEARS.length - 1;
    const d = s[Z.DEEP]!;
    if (d >= YEAR) return 1440 + Math.min(YEARS.length - 1, Math.floor(d / YEAR) - 1);
    return ((Math.floor(s[Z.CLK]!) % 1440) + 1440) % 1440;
  }

  /** The orbit's trail, from `a` back to `b` radians, only its far (behind) or near (in front) half. */
  function trail(front: boolean) {
    const w = s[Z.W]!, len = Math.min(6.2832, Math.max(0, (w - 4) * 0.55)), th = s[Z.TH0]!;
    if (len <= 0 || s[Z.MODE] === H.HOVERING) return;
    for (let q = 0; q < 160; q++) {
      const a = th - (q / 160) * len, sn = Math.sin(a);
      if (sn > 0 !== front) continue;
      const x = GX + Math.cos(a) * RX, y = GY + sn * RY - Math.cos(a) * 5, f = q / 160;
      dot(p, x, y, f < 0.25 ? X.I : f < 0.6 ? X.P : X.A);
      if (w > 11 && f < 0.7) dot(p, x, y + 1, X.A);
    }
  }
  const put = (a: Art, x: number, y: number, flip = false) => blit(p, a, Math.round(x) - (a.w >> 1), Math.round(y) - a.h, flip);
  function flier() {
    const m = s[Z.MODE]!;
    if (m === H.HOVERING) return put(s[Z.PROUD]! > 0 ? THUMB : HOVER, s[Z.HX]!, s[Z.HY]! + 8);
    // Flying: the way he is going (left along the front, right along the back).
    put(FLY, s[Z.HX]!, s[Z.HY]! + 4, Math.sin(s[Z.TH0]!) > 0);
  }

  function paint() {
    px.set(bg);
    // Space: the flier behind the globe, the globe (its map turning), the flier in front.
    const behind = s[Z.MODE] !== H.HOVERING && Math.sin(s[Z.TH0]!) <= 0;
    trail(false);
    if (behind) flier();
    const rot = Math.floor(s[Z.ROT]!);
    for (let i = 0; i < DISC.length; i += 5) {
      const u = (((DISC[i + 2]! + rot) % TW) + TW) % TW, kind = TEX[DISC[i + 1]! + u]!, sh = DISC[i + 3]!;
      px[DISC[i]!] = DISC[i + 4] && !sh ? X.C : GLOBE[kind * 3 + sh]!;
    }
    trail(true);
    if (!behind) flier();
    if (s[Z.PROUD]! < 0) say(p, FONT, "?", s[Z.HX]! + 5, s[Z.HY]! - 14, X.I, X.V, X.K);
    // On the page: cracks (closing as the past rewinds past them), the dinosaur, the meteors.
    const f = rewinding() ? s[Z.F]! : 1e9;
    for (let c = 0; c < s[Z.NC]!; c++) {
      const age = f - CB[c]!;
      if (age < 0) continue;
      const keep = Math.min(SEGS, 1 + Math.floor(age / 2));
      for (let r = 0; r < RAYS; r++) {
        let ax = CX[c]!, ay = CY[c]!;
        for (let j = 0; j < keep; j++) {
          const o = ((c * RAYS + r) * SEGS + j) * 2;
          line(p, ax, ay, CK[o]!, CK[o + 1]!, X.K);
          ax = CK[o]!, ay = CK[o + 1]!;
        }
      }
      fill(p, CX[c]! - 1, CY[c]! - 1, 3, 3, X.K), dot(p, CX[c]!, CY[c]!, X.L);
    }
    const dm = s[Z.DM]!;
    if (dm) put(DINO[dm === D.ROAR ? 2 : dm === D.WALK ? (s[Z.DT]! * 4) & 1 : 0]!, s[Z.DX]!, s[Z.DY]!, dm !== D.FLUNG || ((s[Z.DT]! * 8) & 1) > 0);
    for (let m = 0; m < 2; m++) {
      if (MT[m]! < 0) continue;
      const x = MX[m]!, y = MY[m]!, dx = MX1[m]! - MX0[m]!, dy = MY1[m]! - MY0[m]!, d = Math.hypot(dx, dy) || 1;
      line(p, x - (dx / d) * 12, y - (dy / d) * 12, x - (dx / d) * 6, y - (dy / d) * 6, X.A, X.B);
      line(p, x - (dx / d) * 6, y - (dy / d) * 6, x, y, X.Y, X.P);
      put(ROCK, x, y + 3);
    }
    for (let i = 0; i < nb[0]!; i++) dot(p, BX[i]!, BY[i]!, BC[i]!);
    if (s[Z.FLASH]! > 0) for (let i = 0; i < px.length; i++) if (px[i] === X.K) px[i] = X.L;
    // Rewinding: ◀◀ in the corner of space, blinking.
    if (rewinding() && (s[Z.STEPS]! >> 3) & 1) for (let j = 0; j < 7; j++) for (let k = 0; k < 2; k++) fill(p, 86 + k * 6 + Math.abs(j - 3), 6 + j, 4 - Math.abs(j - 3), 1, X.P);
    const wt = s[Z.WT]!;
    if (wt < 1.1) say(p, FONT, WORDS[s[Z.WD]!]!, s[Z.WX]!, s[Z.WY]! - (wt < 0.06 ? 2 : 0), s[Z.WD] === 1 ? X.G : s[Z.WD] === 2 ? X.Y : X.I, s[Z.WD] === 1 ? X.B : X.P, X.K);
  }

  return { step, paint, busy, tap, clock, state: s, ox: OX, oy: OY, ro: RO, loose: LOOSE };
}

export type RewindScene = { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; state: Float64Array; destroy(): void };

// Strings made once: a frame picks one. Offsets in eighth art px, turns in degrees, the clock's faces.
const NUM: string[] = Array.from({ length: 1601 }, (_, i) => String(i - 800));
const FACES: string[] = Array.from({ length: 1440 }, (_, m) => `${String(((Math.floor(m / 60) + 11) % 12) + 1).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`).concat(YEARS);
const CH = ["--x", "--y", "--r"] as const;

/** The slot mount: the story on a pixel canvas over the stage; the page's letters and clock move through the ledger. */
export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RewindScene {
  const engine = createEngine({ root: stage, settle: 0.6 }), Lg = engine.ledger;
  const els = [...slot.querySelectorAll<HTMLElement>(".sb48-l")], n = els.length, face = slot.querySelector(".sb48-time")!.firstChild as Text;
  const pg: Page = { x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n), h: new Float32Array(n) };
  const WAS = new Int16Array(n * 3), st = new Int16Array([1, 1, -1]); // resized, dirty, clock shown
  const ro = new ResizeObserver(() => ((st[0] = 1), engine.wake()));
  ro.observe(slot);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const p = pixels(GW, GH), w = rewinder(p, (Math.random() * 4294967296) >>> 0, pg), view = pixelCanvas(Lg, stage, p, PALETTE);
  const tap = (x: number, y: number) => (w.tap(x, y), engine.wake());
  const fromPage = (x: number, y: number, bw: number, bh: number) => tap((x / bw) * GW, (y / bh) * GH);
  if (first) {
    const r = stage.getBoundingClientRect(); // once, at mount: outside any frame
    fromPage(first.x, first.y, r.width || 1, r.height || 1);
  } else w.state[23] = 0.01; // the story plays once by itself
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
        pg.w[i] = els[i]!.offsetWidth * k;
        pg.h[i] = els[i]!.offsetHeight * k;
        pg.x[i] = ox * k + pg.w[i]! / 2;
        pg.y[i] = oy * k + pg.h[i]! / 2;
      }
    },
    step(e, dt) {
      w.step(dt);
      if (w.busy()) (e.busy(), (st[1] = 1));
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, v0 = Math.round(w.ox[i]! * 8), v1 = Math.round(w.oy[i]! * 8), v2 = Math.round(w.ro[i]!) % 360;
        for (let c = 0; c < 3; c++) {
          const q = Math.max(-800, Math.min(800, c === 0 ? v0 : c === 1 ? v1 : v2));
          if (q === WAS[i * 3 + c]) continue;
          WAS[i * 3 + c] = q;
          q ? Lg.style(el, CH[c]!, NUM[q + 800]!) : Lg.unstyle(el, CH[c]!);
        }
      }
      const c = w.clock();
      if (c !== st[2]) (st[2] = c), Lg.text(face, FACES[c]!);
      if (!st[1]) return;
      st[1] = 0;
      w.paint();
      view.show();
    },
  });
  engine.start();
  return { engine, tap, state: w.state, destroy: () => engine.destroy() };
}

/** The poster: the same story run headless to mid-rewind: the ring round the globe, the page cracked. */
export function poster() {
  const p = pixels(GW, GH), w = rewinder(p, 4, { x: new Float32Array(0), y: new Float32Array(0), w: new Float32Array(0), h: new Float32Array(0) });
  w.tap(30, 24), w.tap(58, 40);
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  for (let k = 0; k < 4; k++) w.tap(120, 20);
  for (let i = 0; i < 60 * 4 && !(w.state[Z.F]! >= 0 && w.state[Z.F]! < w.state[Z.N1]! * 0.9); i++) w.step(1 / 60);
  w.paint();
  return p;
}
