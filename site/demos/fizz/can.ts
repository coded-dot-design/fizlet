// The can, as pixel data for fzlt/sprite, in flat Fizlet tokens with an ink rim. Side view: 20 × 40
// sprite pixels; frames 0 sealed, 1 open, 2 crunched and sealed, 3 crunched and open. Top view
// (looking into the can): 22 × 22; frames 0 sealed, 1 open. Shared by the live scene (baked once
// onto the canvas) and the build (the same pixels as an SVG for the still poster).
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

// Rows 0–3: headroom for the raised tab. Lid 4–8, neck 9–10, body 11–35, base 36–39.
const lid = [
  "....................",
  "....................",
  "....................",
  "....................",
  "....dmmmmmmmmmmd....",
  "..dmmttttttttttmmd..",
  ".dmttttttttttttttmd.",
  ".dmmttttttttttttmmd.",
  "..ddmmmmmmmmmmmmdd..",
  "..shhpppppppppppss..",
  ".shhppppppppppppps..",
];
const body = (band: string) => `shhpp${band}pss`;
const plain = body("pppppppppppp"), stripe = body("gggggggggggg"), blank = body("cccccccccccc");
// FIZ in a 3 × 5 pixel font on the cyan band.
const word = ["kkk.k.kkk", "k...k...k", "kk..k..k.", "k...k.k..", "k...k.kkk"].map((r) =>
  body(("." + r + "..").replace(/\./g, "c")),
);
const rows = [
  ...lid,
  plain, plain, plain,
  stripe,
  blank,
  ...word,
  blank,
  stripe,
  plain, plain, plain, plain, plain, plain, plain, plain, plain, plain, plain, plain,
  ".shhppppppppppppps..",
  "..dmmmmmmmmmmmmmmd..",
  "...dmmmmmmmmmmmmd...",
  "....dddddddddddd....",
];
const put = (r: string[], y: number, x: number, s: string) => (r[y] = r[y]!.slice(0, x) + s + r[y]!.slice(x + s.length));
const sealed = rows.slice(), open = rows.slice();
// Sealed: the tab lies flat on the lid.
put(sealed, 5, 7, "dddd");
put(sealed, 6, 7, "dttd");
put(sealed, 7, 8, "dd");
// Open: the tab stands up behind the opening, the opening is dark.
put(open, 1, 7, "ddd");
put(open, 2, 7, "dtd");
put(open, 3, 7, "dtd");
put(open, 4, 7, "ddd");
put(open, 6, 9, "kkkk");
put(open, 7, 10, "kk");

// Crunched: the middle of the body caves in (the sides step in, creases across the front).
const dent = (r: string[]) => {
  const d = r.slice();
  for (let y = 25; y < 31; y++) put(d, y, 0, y > 25 && y < 30 ? ".s" : "s"), put(d, y, 18, y > 25 && y < 30 ? "s." : "s");
  put(d, 26, 5, "sss");
  put(d, 27, 8, "ssss");
  put(d, 28, 12, "ss");
  put(d, 29, 6, "ss");
  return d;
};

// Top view: the pink shoulder (shaded on the lower right), the rim, the groove, the lid; the tab
// lies flat, then stands up and leaves the opening dark.
const top = (open: boolean) =>
  Array.from({ length: 22 }, (_, y) => {
    let r = "";
    for (let x = 0; x < 22; x++) {
      const d = Math.hypot(x - 10.5, y - 10.5);
      r += d > 11 ? "." : d > 9.6 ? (x + y > 24 ? "s" : "p") : d > 9 ? "d" : d > 7.8 ? "m" : d > 7.2 ? "d" :
        open && y > 2 && y < 8 && Math.abs(x - 10.5) < (y > 3 && y < 7 ? 3 : 2) ? "k" :
        !open && y > 3 && y < 13 && x > 8 && x < 13 ? (x > 9 && x < 12 && y > 4 && y < 12 ? "m" : "d") :
        open && y > 8 && y < 12 && x > 7 && x < 14 ? (y === 10 && x > 8 && x < 13 ? "m" : "d") : "t";
    }
    return r;
  });

export const W = 20, H = 40, T = 22;
/** The opening, in sprite pixels from the top left. */
export const MOUTH = { x: 11, y: 6 };

export const CAN: SpriteDef = {
  frames: [sealed, open, dent(sealed), dent(open)],
  colors: { k: C.rim, d: C.line, m: C.muted, t: C.ink, p: C.attack, h: C.aim, s: C.shade, c: C.sys, g: C.go },
  outline: C.rim,
};

export const TOP: SpriteDef = { frames: [top(false), top(true)], colors: CAN.colors!, outline: C.rim };
/** The opening in the top view, in sprite pixels from the top left. */
export const HOLE = { x: 10.5, y: 5 };
