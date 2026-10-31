// KRUNCH, the rage giant of #49 SMASH and #50 the hammer: one pixel brute as data for fzlt/sprite,
// shared by both pieces (he smashes the page in one and meets the storm god in the next). A flat-top
// demolition giant in cyan work overalls whose skin goes from calm stone to hot pink to red as his
// rage climbs (palettes), with a separate head so one body pose can wear any face. The 3 × 5 pixel
// font and the tokens live in pixel-type.ts (re-exported here). Flat Fizlet tokens, whole pixels
// only, so it stays crisp on a pixel canvas scaled up with CSS.
import type { SpriteDef } from "../../../src/sprite";
import { C } from "./pixel-type";

export { C, print, shout, textW } from "./pixel-type";

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
