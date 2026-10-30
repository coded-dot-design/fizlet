// The Halloween ghost pieces' shared world (Smoosh, Wrangle, Overflow): SMUDGE, a grape-jelly
// slime ghost (and his cousins, in other flavours); the Spook Sweep crew, a two-person janitorial
// outfit that "mops the paranormal" with backpack scrub-stream wands; their mop-bucket trap and
// its lid; the wobbling streams; and a shout for sound effects. All of it is pixel data for
// fizlet/sprite, whole pixels on the 160 × 90 art grid (pix.ts), crisp at any size.
// Original parody archetypes: no names, logos, costumes or props from any film.
import type { SpriteDef } from "../../../../src/sprite";
import { print, textW } from "../pix";

/** The goo, both themes (canvas): body, highlight, shade. */
export const GOO = { g: "#9a63ff", l: "#d2b8ff", d: "#6a3fd6" };
export const RIM = "#07060f";

// ---------- SMUDGE: g goo, l shine, d shade (palette roles: flavours), w eye white, k pupil, m mouth, p blush ----------
const BODY = [
  "......gggg......",
  "....gggggggg....",
  "...gllggggggg...",
  "..glgggggggggg..",
  ".glggggggggggdd.",
  ".gggwwwggwwwggd.",
  "ggggwkkggwkkgggd",
  "ggggwkkggwkkgggd",
  "ggpggggggggggpgd",
  "ggggggmmmmgggggd",
  "gggggggmmggggggd",
  "gggggggggggggggd",
  "dgggggggggggggdd",
  "ggdggggdggggdggd",
  "g.ggd.gg.gggg.gd",
  "g..g...g...g..g.",
  "...g.......g....",
];
const swap = (rows: string[], at: number, ...put: string[]) => rows.map((r, i) => (i >= at && i < at + put.length ? put[i - at]! : r));
/** Frames: 0 grin, 1 happy (eyes shut, a burp), 2 mouth wide (slurp, smoosh), 3 look left. */
const FRAMES = [
  BODY,
  /* @__PURE__ */ swap(BODY, 5, ".gggkgggggkgggd.", "gggkgkgggkgkgggd", "gggggggggggggggd", "ggpggggggggggpgd", "gggggmmmmmmggggd", "ggggggmmmmgggggd"),
  /* @__PURE__ */ swap(BODY, 9, "gggggmmmmmmggggd", "ggggmmmmmmmmgggd", "gggggmmmmmmggggd"),
  /* @__PURE__ */ swap(BODY, 6, "ggggkkwggkkwgggd", "ggggkkwggkkwgggd"),
];

/** Ghost flavours: palette roles goo, hi, lo. 0 grape (SMUDGE), 1 bubblegum, 2 lemon, 3 ice; 4 a flash; 5 his print on the glass. */
export const FLAVOURS: Record<string, string>[] = [
  { goo: GOO.g, hi: GOO.l, lo: GOO.d },
  { goo: "#ff5fa8", hi: "#ffc0dc", lo: "#c2186b" },
  { goo: "#ffc21a", hi: "#fff0b0", lo: "#c47f00" },
  { goo: "#19f0ff", hi: "#c6fcff", lo: "#0a8fa3" },
  { "*": "#f6f3ff" },
  { "*": GOO.l },
];

const GHOST_COLORS = { g: "goo", l: "hi", d: "lo", w: "#f6f3ff", k: RIM, m: "#2a0f45", p: "#ff7389" };
export const GHOST: SpriteDef = { frames: FRAMES, colors: GHOST_COLORS, outline: RIM };
/** A goo palm pressed on the glass. */
export const PALM: SpriteDef = { frames: [".l.l.l.", ".l.l.l.", "lllllll", "lllllll", ".lllll.", "..lll.."], colors: { l: "hi" }, outline: "lo" };

// ---------- The Spook Sweep crew, facing right: c cap, s skin, k eye, j coveralls, y hi-vis, t tank, h hazard, w wand, n nozzle, b boots ----------
const CREW_AIM = [
  ".....cccc....",
  "....cccccc...",
  "....ccccccccc",
  "....sssss....",
  "....ssssk....",
  "....sssss....",
  "..ttjjjjj....",
  ".thtjjjjjj...",
  ".tttjjyjswwwn",
  ".thtjjjjj....",
  ".tttyyyyy....",
  ".thtjjjjj....",
  "..t.jjjjj....",
  "....jj.jj....",
  "....jj.jj....",
  "....jj.jj....",
  "...bbb.bbb...",
];
const CREW_UP = /* @__PURE__ */ swap(CREW_AIM, 0,
  ".....cccc..n.",
  "....cccccc.w.",
  "....cccccccw.",
  "....sssss.sw.",
  "....sssks.s..",
  "....sssss.j..",
  "..ttjjjjjjj..",
  ".thtjjjjjj...",
  ".tttjjyjj....",
);
const CREW_STRAIN = /* @__PURE__ */ swap(CREW_AIM, 3, "....sssss....", "....skssk....", "....smmms....");
export const CREW: SpriteDef = {
  frames: [CREW_AIM, CREW_UP, CREW_STRAIN],
  colors: { c: "cap", s: "skin", k: RIM, m: "#2a0f45", j: "suit", y: "#ffc21a", t: "#3b3170", h: "#ffc21a", w: "#aea4d6", n: "#19f0ff", b: "#1d1838" },
  outline: RIM,
  ax: 6,
  ay: 17,
};
/** The two of them: DOT (teal suit) and ROOK, the rookie (pink suit). */
export const CREWS: Record<string, string>[] = [
  { cap: "#19f0ff", skin: "#c98a5a", suit: "#0fa3b5" },
  { cap: "#ff2e88", skin: "#f2c39b", suit: "#d1206f" },
  { "*": "#f6f3ff" },
];
/** Where the wand's tip is, from the sprite's feet (aim frame). */
export const NOZZLE_X = 6, NOZZLE_Y = -9;

// ---------- The mop-bucket trap: b steel, y hazard, c window glow, k rim, m mouth, w wheels ----------
export const BUCKET: SpriteDef = {
  frames: [[
    ".mmmmmmmmmmmmmm.",
    "kbbbbbbbbbbbbbbk",
    ".bbbbbbbbbbbbbb.",
    ".byybbyybbyybbb.",
    ".bbbbbbbbbbbbbb.",
    ".bbbccccccccbbb.",
    ".bbbccccccccbbb.",
    ".bbbbbbbbbbbbbb.",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    ".ww..........ww.",
  ]],
  colors: { b: "#3b3170", y: "#ffc21a", c: "glow", k: "#1d1838", m: "#120f26", w: "#aea4d6" },
  outline: RIM,
  ax: 8,
  ay: 11,
};
/** The lid, hinged at its left end (draw it turned about the hinge). */
export const LID: SpriteDef = { frames: [["......yyy.......", "kkkkkkkkkkkkkkkk", "bbbbbbbbbbbbbbbb"]], colors: { y: "#ffc21a", k: "#aea4d6", b: "#3b3170" }, outline: RIM, ax: 0, ay: 3 };
/** Bucket glow: 0 calm cyan, 1 warning amber, 2 red alert. */
export const GLOWS: Record<string, string>[] = [{ glow: "#19f0ff" }, { glow: "#ffc21a" }, { glow: "#ff2b4e" }, { "*": "#f6f3ff" }];

// ---------- The scrub stream: three strands from the wand to a point, wobbling ----------
const STRANDS = ["#ff2e88", "#19f0ff", "#f6f3ff"];
/**
 * A stream from (x0, y0) to (x1, y1), `u` of the way out (0..1), wobbling with time `t` and
 * amplitude `amp` (art px). Whole pixels, no allocation.
 */
export function stream(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, u: number, t: number, amp: number) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, n = Math.ceil(d * u);
  for (let s = 0; s < 3; s++) {
    g.fillStyle = STRANDS[s]!;
    const a = s === 2 ? amp * 0.25 : s ? -amp * 0.7 : amp, ph = s * 2.1;
    for (let i = 0; i <= n; i++) {
      const q = i / d, w = Math.sin(q * 3.1416) * a * Math.sin(i * 0.45 - t * 30 + ph);
      g.fillRect(Math.round(x0 + dx * q + nx * w), Math.round(y0 + dy * q + ny * w), 1, 1);
    }
  }
}

/** A shout: the 3 × 5 font at k px per font pixel, centred on x, with a rim and a drop. */
export function shout(g: CanvasRenderingContext2D, s: string, x: number, y: number, k: number, face: string, drop: string) {
  x = Math.round(x - textW(s, k) / 2);
  y = Math.round(y);
  for (let o = 0; o < 9; o++) if (o !== 4) print(g, s, x + (o % 3) - 1, y + ((o / 3) | 0) - 1, RIM, k);
  print(g, s, x + 1, y + 1 + (k > 2 ? 1 : 0), RIM, k);
  print(g, s, x + 1, y + 1, drop, k);
  print(g, s, x, y, face, k);
}
