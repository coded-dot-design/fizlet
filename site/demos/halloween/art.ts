// Halloween heroes: the pixel art, as data for @fzlt/core/sprite (rows of characters + a colour map),
// in flat Fizlet tokens with an ink rim. Original art: bats, a jack-o'-lantern, a ghost, a
// cauldron, wrapped candy. Each is its own const, so a scene ships only the art it draws.
import type { SpriteDef } from "../../../src/sprite";

/** One colour table for the canvas, the particles and the pixel font (Board UI tokens, dark). */
export const PAL = [
  "#9a63ff", // 0 cmd: bats, the brew's glow
  "#ff2e88", // 1 attack
  "#f6f3ff", // 2 ink
  "#ff8a1f", // 3 advance: pumpkins
  "#ffc21a", // 4 hurt: candle light, the moon
  "#39ffb0", // 5 go: goo, the brew
  "#a8ff3e", // 6 fallin
  "#19f0ff", // 7 sys
  "#ff2b4e", // 8 fire
  "#aea4d6", // 9 muted
  "#3b3170", // 10 line
  "#3f296a", // 11 base
  "#07060f", // 12 rim
];
export const RIM = "#07060f";

const pumpkinRows = [
  "......gg......",
  ".......g......",
  "..oooorroooo..",
  ".oooorooroooo.",
  "ooyyyooooyyyoo",
  "oooyyorroyyooo",
  "ooooooyyoooooo",
  "ooyoyyyyyyoyoo",
  "oooyyyyyyyyooo",
  ".oooyoyyoyooo.",
  "..oooooooooo..",
  "....rrrrrr....",
];
// Halves: the left seven columns and the right seven (the slice), each with its cut face showing.
const half = (left: boolean) => pumpkinRows.map((r, y) => left
  ? r.slice(0, 7).replace(/.$/, y > 1 && y < 11 ? "y" : r[6]!) + "......."
  : "......." + r.slice(7).replace(/^./, y > 1 && y < 11 ? "y" : r[7]!));
const smashed = [
  "..............", "..............", "..............", "..............", "..............", "..............",
  "......g.......",
  "...o...gy..o..",
  ".o..yooro.y..o",
  "ooyyoorroooyoo",
  "oooyyoooyyyooo",
  ".rrrrrrrrrrrr.",
];
/** A jack-o'-lantern, 14 × 12: frames 0 whole, 1 left half, 2 right half, 3 smashed flat. */
export const PUMPKIN: SpriteDef = /* @__PURE__ */ (() => ({
  frames: [pumpkinRows, half(true), half(false), smashed],
  colors: { o: PAL[3]!, r: PAL[8]!, y: PAL[4]!, g: PAL[5]! },
  outline: RIM,
}))();

/** A bat, 13 × 7: frames 0 wings up, 1 wings down. */
export const BAT: SpriteDef = /* @__PURE__ */ (() => ({
  frames: [
    ["d...........d", "dd...p.p...dd", "ddd..ppp..ddd", "ddddpepepdddd", ".dddpppppddd.", "..d..ppp..d..", ".....p.p....."],
    [".............", ".....p.p.....", ".....ppp.....", "..ddpepepdd..", ".dddpppppddd.", "dddd.ppp.dddd", "dd...p.p...dd"],
  ],
  colors: { d: PAL[0]!, p: PAL[11]!, e: PAL[4]! },
  outline: RIM,
}))();

const ghostTop = ["....wwww....", "..wwwwwwww..", ".wwwwwwwwww.", ".wwkkwwkkww.", "wwwkkwwkkwww", "wpwwwwwwwwpw", "wwwwwkkwwwww", "wwwwwkkwwwww", "wwwwwwwwwwww", "wwwwwwwwwwww"];
/** A ghost, 12 × 12: frames 0 and 1 wave its tail. */
export const GHOST: SpriteDef = /* @__PURE__ */ (() => ({
  frames: [[...ghostTop, "ww.www.www.w", "w...w...w..."], [...ghostTop, "w.www.www.ww", "...w...w...w"]],
  colors: { w: PAL[2]!, k: RIM, p: PAL[1]! },
  outline: RIM,
}))();

/** BOO!, 13 × 5, in sys cyan: the haunt's one word (a sprite, so it needs no font). */
export const BOO: SpriteDef = /* @__PURE__ */ (() => ({
  frames: ["cc..ccc.ccc.c", "c.c.c.c.c.c.c", "cc..c.c.c.c.c", "c.c.c.c.c.c..", "cc..ccc.ccc.c"],
  colors: { c: PAL[7]! },
  outline: RIM,
}))();

/** A cauldron, 20 × 13, its brew showing at the rim. */
export const CAULDRON: SpriteDef = /* @__PURE__ */ (() => ({
  frames: [[
    ".mmmmmmmmmmmmmmmmmm.",
    "mggbgggggggggbgggggm",
    ".mmmmmmmmmmmmmmmmmm.",
    ".dhhddddddddddddddd.",
    "dhhddddddddddddddddd",
    "dhdddddddddddddddddd",
    "dhdddddddddddddddddd",
    "dhdddddddddddddddddd",
    "dddddddddddddddddddd",
    ".dddddddddddddddddd.",
    "..dddddddddddddddd..",
    "..dd............dd..",
    ".ddd............ddd.",
  ]],
  colors: { m: PAL[9]!, g: PAL[5]!, b: PAL[6]!, d: PAL[10]!, h: PAL[0]! },
  outline: RIM,
}))();

/** Wrapped candy, 11 × 5 (twisted ends, the sweet in a palette role): one def, four flavours. */
export const CANDY: SpriteDef = /* @__PURE__ */ (() => ({
  frames: ["ww.ccccc.ww", "wwwcchccwww", "wwcccccccww", "wwwcccccwww", "ww.ccccc.ww"],
  colors: { c: "candy", w: PAL[9]!, h: PAL[2]! },
  outline: RIM,
}))();
export const CANDY_PALETTES = /* @__PURE__ */ (() => [{ candy: PAL[1]! }, { candy: PAL[7]! }, { candy: PAL[6]! }, { candy: PAL[4]! }])();
