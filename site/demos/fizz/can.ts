// The can, as pixel data for fizlet/sprite, in flat Fizlet tokens with an ink rim, drawn by code
// (no hand-typed rows): a glossy cylinder, light from the upper left. Side view: 40 × 80 sprite
// pixels; frames 0–2 the tab flat, lifting and up (the opening dark), 3–5 the same crunched. Top
// view (looking into the can): 44 × 44; frames 0–2 the tab flat, lifting and up. Shared by the live
// scene (baked once onto the canvas) and the build (the same pixels as an SVG for the still poster).
import type { SpriteDef } from "../../../src/sprite";

/** Brand tokens (fizlet-engine brands/fizlet/style-guide.md). */
export const C = {
  rim: "#07060f",
  ink: "#f6f3ff",
  muted: "#aea4d6",
  line: "#3b3170",
  attack: "#ff2e88",
  aim: "#ff7389",
  shade: "#771845",
  sys: "#19f0ff",
  go: "#39ffb0",
  base: "#3f296a",
};

export const W = 40, H = 80, T = 44;
/** The opening in the side view and in the top view, in sprite pixels from the top left. */
export const MOUTH = { x: 24, y: 11 };
export const HOLE = { x: 22, y: 11 };

// FIZ in a 5 × 7 pixel font.
const FIZ = ["11111.1.11111", "1.....1.....1", "1.....1....1.", "1111..1...1..", "1.....1..1...", "1.....1.1....", "1.....1.11111"];

/** Cylinder shading across the body: gloss on the left, the token pink, shade on the right. */
const tone = (x: number, l: number, r: number, band: boolean) => {
  const u = (x - l) / (r - l);
  if (u < 0.05 || u > 0.94) return band ? "g" : "s";
  if (u > 0.13 && u < 0.18) return "t"; // the specular line
  if (u < 0.26) return band ? "c" : "h";
  return u > 0.74 ? (band ? "g" : "s") : band ? "c" : "p";
};

function side(tab: number, crunched: boolean) {
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill("."));
  const set = (x: number, y: number, c: string) => x >= 0 && x < W && y >= 0 && y < H && (g[y]![x] = c);
  for (let y = 0; y < H; y++) {
    // The silhouette: lid rim 8–15, neck 16–19, shoulder 20–23, body, the base taper 72–79.
    let l = y < 8 ? 99 : y < 16 ? 4 : y < 20 ? 5 + (y - 16 > 1 ? 1 : 0) : y < 24 ? 5 - (y - 19) : y < 72 ? 1 : y < 76 ? 1 + (y - 71) : 6 + (y - 76);
    if (crunched && y > 50 && y < 62) l += y > 52 && y < 60 ? 2 : 1;
    const r = W - 1 - l;
    for (let x = l; x <= r; x++) {
      const metal = y < 20 || y >= 74, u = (x - l) / Math.max(1, r - l);
      let c = metal ? (u < 0.2 ? "t" : u > 0.75 ? "d" : "m") : tone(x, l, r, y >= 33 && y <= 52);
      if (!metal && (y === 33 || y === 52)) c = "d";
      if (y === 16 || y === 74) c = "d"; // the seams
      set(x, y, c);
    }
  }
  // The lid seen just from above: a flat ellipse of light metal inside the rim.
  for (let y = 9; y < 15; y++)
    for (let x = 6; x < 34; x++) {
      const e = ((x - 19.5) / 13.5) ** 2 + ((y - 11.5) / 2.6) ** 2;
      if (e < 1) set(x, y, e > 0.72 ? "d" : x < 14 ? "t" : "m");
    }
  // The tab: flat on the lid, lifting, then upright behind the dark opening.
  if (tab === 0) for (const [x, y, c] of [[17, 10, "d"], [18, 10, "d"], [19, 10, "d"], [20, 10, "d"], [17, 11, "d"], [18, 11, "t"], [19, 11, "t"], [20, 11, "d"], [18, 12, "d"], [19, 12, "d"]] as const) set(x, y, c);
  else {
    const top = tab === 1 ? 6 : 1;
    for (let y = top; y < 12; y++) for (let x = 16; x < 21; x++) set(x, y, x === 16 || x === 20 || y === top ? "d" : x === 17 ? "t" : "m");
    if (tab === 2) for (let y = 10; y < 13; y++) for (let x = 21; x < 28; x++) if (((x - 24) / 3.5) ** 2 + ((y - 11) / 1.6) ** 2 < 1) set(x, y, "k");
  }
  // The label: FIZ in ink-dark on the cyan band, set a little left of centre (the can turns).
  FIZ.forEach((row, i) => [...row].forEach((b, j) => b === "1" && set(12 + j, 39 + i, "k")));
  // Crunched: creases across the front.
  if (crunched) for (const [x, y, n] of [[8, 54, 6], [16, 56, 8], [26, 55, 5], [11, 58, 5], [21, 59, 6]]) for (let i = 0; i < n!; i++) set(x! + i, y!, "s");
  return g.map((r) => r.join(""));
}

function top(tab: number) {
  const g: string[] = [];
  for (let y = 0; y < T; y++) {
    let r = "";
    for (let x = 0; x < T; x++) {
      const d = Math.hypot(x - 21.5, y - 21.5), a = x + y;
      // Shoulder (lit upper left, shaded lower right), rim, lid with a groove; the opening and tab.
      r += d > 22 ? "." : d > 19.4 ? (a < 30 ? "h" : a > 56 ? "s" : "p") : d > 18.4 ? "d" : d > 16 ? (a < 34 ? "t" : "m") : d > 15 ? "d"
        : tab === 2 && ((x - 22) / 5) ** 2 + ((y - 11) / 3.2) ** 2 < 1 ? "k"
        : tab === 0 && x > 18 && x < 25 && y > 8 && y < 26 ? (x > 19 && x < 24 && y > 9 && y < 25 && !(y > 18 && y < 22 && x > 20 && x < 23) ? "t" : "d")
        : tab === 1 && x > 18 && x < 25 && y > 13 && y < 26 ? (x > 19 && x < 24 && y > 14 && y < 25 ? "t" : "d")
        : tab === 2 && x > 18 && x < 25 && y > 19 && y < 25 ? (y > 20 && y < 24 && x > 19 && x < 24 ? "t" : "d")
        : a < 30 ? "t" : "m";
    }
    g.push(r);
  }
  return g;
}

const colors = { k: C.rim, d: C.line, m: C.muted, t: C.ink, p: C.attack, h: C.aim, s: C.shade, c: C.sys, g: C.go };
export const CAN: SpriteDef = { frames: [0, 1, 2, 0, 1, 2].map((t, i) => side(t, i > 2)), colors, outline: C.rim };
export const TOP: SpriteDef = { frames: [0, 1, 2].map(top), colors, outline: C.rim };
