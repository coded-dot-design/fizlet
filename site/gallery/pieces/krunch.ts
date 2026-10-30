// KRUNCH, the rage giant of #49 SMASH and #50 the hammer: one pixel brute as data for fizlet/sprite,
// shared by both pieces (he smashes the page in one and meets the storm god in the next). A flat-top
// demolition giant in cyan work overalls whose skin goes from calm stone to hot pink to red as his
// rage climbs (palettes), with a separate head so one body pose can wear any face. Also a 3 × 5
// pixel font with a shout style (rim, extrude, a lean) for HUDs and sound effects. Flat Fizlet
// tokens, whole pixels only, so it stays crisp on a pixel canvas scaled up with CSS.
import type { SpriteDef } from "../../../src/sprite";

/** Brand tokens (fizlet-engine brands/fizlet/style-guide.md). */
export const C = {
  rim: "#07060f",
  ink: "#f6f3ff",
  muted: "#aea4d6",
  line: "#3b3170",
  attack: "#ff2e88",
  aim: "#ff7389",
  sys: "#19f0ff",
  go: "#39ffb0",
  hurt: "#ffc21a",
  cmd: "#9a63ff",
  base: "#3f296a",
  red: "#ff2b4e",
};

/** A symmetric sprite from its left halves (each row mirrored onto itself). */
const sym = (rows: string[]) => rows.map((r) => r + [...r].reverse().join(""));

// s skin, d skin shade (both palette roles: rage), h hair, j overalls, q seams and pocket, u
// buckles, b boots, w eye whites and teeth, k brows, pupils and mouth, p blush.
const colors = { s: "skin", d: "shade", h: C.rim, j: C.sys, q: C.base, u: C.hurt, b: C.base, w: C.ink, k: C.rim, p: C.aim };

/** The bodies (30 wide), neck at the top middle: 0 stand, 1 fists up, 2 smash down, 3 sit. */
const STAND = sym([
  "............dss",
  "........ddsssss",
  "......dsssssjss",
  "....dssssssjsss",
  "..ddsssssssjsss",
  ".ssssssdsssjsss",
  "sssssssdssjjjjj",
  "sssssssdssjujjj",
  "sssssss.dsjjjjj",
  "ssssss..dsjjjjj",
  "dsssss..djjjjqq",
  "dsssss..djjjjjj",
  "ssssss..jjjjjjj",
  "dssssd..jjjjjjj",
  "sssssss.jjjjjjj",
  "ssssssss.jjjjjq",
  "ssssssss.jjjjq.",
  "dssssssd.jjjjq.",
  ".dddddd..jjjjj.",
  "........jjjjjj.",
  "........qjjjjj.",
  ".......bbbbbbb.",
  "......bbbbbbbb.",
]);
const UP = sym([
  ".........dsssss",
  "........dssssss",
  "........sssssss",
  ".......ssd.....",
  "......sss......",
  ".....sss.......",
  "....ssss.......",
  "...sssss.......",
  "...ssssd.......",
  "...dsssss......",
  "....ssssss..dss",
  "....dsssssddsss",
  ".....dssssssjss",
  ".....ssssssjsss",
  "......sssssjsss",
  "......sdssjjjjj",
  "......sdssjujjj",
  "......sdssjjjjj",
  ".......dsjjjjqq",
  "........jjjjjjj",
  "........jjjjjjq",
  "........jjjjjq.",
  "........jjjjjq.",
  "........jjjjjj.",
  "........qjjjjj.",
  ".......bbbbbbb.",
  "......bbbbbbbb.",
]);
const SMASH = sym([
  "............dss",
  "........ddsssss",
  "......dsssssjss",
  "....dssssssjsss",
  "...sssssssjssss",
  "..ssssssdsjjjjj",
  "..sssssdssjujjj",
  "...sssssdsjjjjj",
  "....sssssdjjjjj",
  ".....sssssdjjjj",
  "......sssssdjjj",
  ".......dsssssss",
  "....j..ssssssss",
  "...jjj.dsssssss",
  "..qjjj..ddddddd",
  ".bbbbb.........",
  "bbbbbb.........",
]);
const SIT = sym([
  "............dss",
  "........ddsssss",
  "......dsssssjss",
  "....dssssssjsss",
  "..ddsssssssjsss",
  ".ssssssdsssjjjj",
  ".ssssssdssjujjj",
  ".ssssss.dsjjjjj",
  ".ssssss.djjjjjj",
  "..ssss..jjjjjjj",
  "jjsssssjjjjjjjj",
  "jjsssssjjjjjjjq",
  "jjdddddjjjjjjq.",
  "bbbbjjjjjjjjjq.",
  "bbbbbqqqqqqqq..",
]);

/** The heads (12 wide): 0 angry, 1 calm (eyes shut), 2 dizzy, 3 aww, 4 roar. */
const top = ["..hhhh", ".hhhhh", ".sssss"];
const HEADS = [
  [...top, "skksss", "ssskks", "sswkss", "sssssd", "skwwww", ".dkkkk", "..dddd"],
  [...top, "ssssss", "skksss", "ssssss", "sskkss", "sssssd", "ssskkk", ".sssss", "..dddd"],
  [...top, "ssssss", "skskss", "ssksss", "skskss", "sssssd", "sssskk", ".ssskw", "..dddd"],
  [...top, "ssssss", "sskkss", "skssks", "ssssss", "spppsd", "sssskk", ".sssss", "..dddd"],
  [...top, "kkksss", "ssskks", "swwkss", "sssssd", "skwwww", "skkkkk", "skwwww", ".ddddd"],
].map(sym);

export const KRUNCH = {
  body: { frames: [STAND, UP, SMASH, SIT].map((f) => [...Array(27 - f.length).fill(""), ...f]), colors, outline: C.rim, ax: 15, ay: 27 } satisfies SpriteDef,
  head: { frames: HEADS, colors, outline: C.rim, ax: 6, ay: 0 } satisfies SpriteDef,
};
/** Per body frame: height (feet to the neck's top) and where the head sits above the feet. */
export const BODY_H = [19, 25, 17, 14];
export const HEAD_Y = [-31, -25, -23, -23];

/** Rage palettes (skin, shade): 0 calm stone … 3 red hot; 4 the hit flash. */
export const RAGE: Record<string, string>[] = [
  { skin: C.muted, shade: C.cmd },
  { skin: C.aim, shade: C.attack },
  { skin: C.attack, shade: C.cmd },
  { skin: C.red, shade: C.base },
  { "*": C.ink },
];

// ---------- A 3 × 5 font: each glyph 15 bits (rows top down, 3 bits each), base 36 ----------
const F: Record<string, number> = {};
"0:odr 1:8t3 2:jhj 3:jgu 4:i4p 5:o0e 6:bfz 7:mmq 8:ohb 9:oge A:8od B:l9q C:bab D:l7y E:o13 F:o10 G:bcb H:i5p I:n13 K:i3x L:eg7 M:iy5 N:l7x O:8kq P:l9g R:l9p S:b66 T:n0y U:i27 V:i22 W:i65 Y:hw2 !:77m %:gbp"
  .split(" ").forEach((g) => (F[g[0]!] = parseInt(g.slice(2), 36)));

/** Width of `s` in the font at `k` px per font pixel. */
export const textW = (s: string, k = 1) => (s.length * 4 - 1) * k;

/** Print `s` (A–Y but J, Q, X; 0–9, ! and %) top left at (x, y) in `color`; each font pixel is k wide, `tall` high. */
export function print(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, k = 1, tall = k) {
  g.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const b = F[s[i]!] ?? 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (b & (1 << (14 - r * 3 - c))) g.fillRect(x + (i * 4 + c) * k, y + r * tall, k, tall);
  }
}

/** A shout: comic lettering centred on x (a rim, a drop in `ext` down and right, the face), tall letters. */
export function shout(g: CanvasRenderingContext2D, s: string, x: number, y: number, k: number, face: string, ext: string) {
  x = Math.round(x - textW(s, k) / 2);
  y = Math.round(y);
  const t = k + (k >> 1);
  for (let o = 0; o < 16; o++) print(g, s, x + (o & 3) - 1, y + (o >> 2) - 1, C.rim, k, t);
  print(g, s, x + 1, y + 1, ext, k, t);
  print(g, s, x, y, face, k, t);
}
