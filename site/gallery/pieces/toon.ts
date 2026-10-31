// PLUM, the toon of the classic cartoon gags (#anvil "Look out below!" and #fuse "Short fuse"): a
// round grape of a fellow in a bowler hat, white gloves and yellow shoes, who only wants a quiet
// walk. Original art as data for fizlet/sprite, shared by both pieces: walk cycle, the take, the
// look to camera, the glare, the accordion squash, the wind-up whirl; the hat is its own sprite so
// it can fly off. Soot is a palette (the body goes black, the eyes stay white). Also the props
// (anvil, piano, dynamite) and the little gag marks every toon needs (stars, a grawlix, speed
// lines). Flat Fizlet tokens, whole pixels only.
import type { SpriteDef } from "../../../src/sprite";
import { C, print } from "./pixel-type";

export { C, print, shout, textW } from "./pixel-type";

/** A frame mirrored (facing left). */
const flip = (rows: string[]) => rows.map((r) => [...r.padEnd(13, ".")].reverse().join(""));

// s body, d its shade, n nose (palette roles: soot turns them black), w eye whites, k pupils,
// brows, mouth and legs, g gloves, y shoes, o the whistle.
const colors = { s: "skin", d: "shade", n: "nose", w: C.ink, k: C.rim, g: C.ink, y: C.hurt, o: C.rim };

const head = [
  "...sssssss...",
  "..sssswwswws.",
  "..ssssswkswk.",
  "..ssssssssnnn",
  "..sssssssnnnn",
];
const body = [
  ".gssssssssssg",
  ".ggsssssssgg.",
  "..dssssssssd.",
  "...ddssssdd..",
];
const legs = {
  stand: ["....k...k....", "....k...k....", "...yyy..yyy.."],
  a: ["...k.....k...", "..k.......k..", "yyy.......yyy"],
  b: ["......k......", ".....kk......", "...yyyyyy...."],
  whirl: ["..kk.k.k.kk..", ".k..kkkkk..k.", "..yy.kkk.yy.."],
};
const R = {
  stand: [...head, "..ssssssssns.", "..sssssssos..", ...body, ...legs.stand],
  walkA: [...head, "..ssssssssns.", "..sssssssos..", ...body, ...legs.a],
  walkB: [...head, "..ssssssssns.", "..sssssssos..", ...body, ...legs.b],
  // The take: eyes up and out of their sockets, mouth wide.
  take: [
    "..sssswwwwww.",
    "..ssssswkwwk.",
    "..sssswwwwww.",
    "..ssssssssnnn",
    "..sssssssnnnn",
    "..sssssskkkn.",
    "..sssssskwks.",
    ...body,
    ...legs.stand,
  ],
  whirl: [...head, "..ssssssssns.", "..ssssssskk..", ...body, ...legs.whirl],
};
// To camera: neutral (the look; in soot, the sooty face), the glare (brows down), the blink.
const front = (eyes: string[], mouth: string) => [
  "...sssssss...",
  ...eyes,
  "..ssssnnssss.",
  "..sssnnnnsss.",
  mouth,
  "..sssssssss..",
  "gssssssssssg.",
  "gg.sssssss.gg",
  "..dssssssd...",
  "...ddsssdd...",
  "....k...k....",
  "....k...k....",
  "..yyy...yyy..",
];
const LOOK = front(["..swwssswws..", "..swkssswks..", "..sssssssss.."], "..ssskkksss..");
const GLARE = front(["..skkssskks..", "..swwkskwws..", "..swksssksw.."], "..sskkkkkss..");
const BLINK = front(["..sssssssss..", "..skksssskk..", "..sssssssss.."], "..sssskssss..");
// Squashed flat as an accordion: pleats, crossed eyes, the shoes sticking out.
const FLAT = [
  "..sswkswksn..",
  ".dsdsdsdsdsd.",
  ".sdsdsdsdsds.",
  "yyy.......yyy",
];
const pad = (f: string[]) => [...Array(16 - f.length).fill(""), ...f];
const RIGHT = [R.stand, R.walkA, R.walkB, R.take, R.whirl];

/** Plum's frames (13 × 16, feet at the bottom middle). */
export const enum F {
  stand = 0, walkA = 1, walkB = 2, take = 3, whirl = 4, // facing right; + left for facing left
  look = 10, glare = 11, blink = 12, flat = 13,
  left = 5,
}

export const PLUM = {
  plum: { frames: [...RIGHT, ...RIGHT.map(flip), LOOK, GLARE, BLINK, FLAT].map(pad), colors, outline: C.rim, ax: 6, ay: 16 } satisfies SpriteDef,
  // The bowler: brim, crown and a pink band. Its pivot is the brim's middle.
  hat: { frames: [["..kkkkk..", "..kkkkk..", "..bbbbb..", "kkkkkkkkk"]], colors: { k: C.rim, b: C.attack }, outline: C.line, ax: 4, ay: 4 } satisfies SpriteDef,
};
/** Where the hat's brim sits above the feet, per frame (the take lifts it). */
export const HAT_Y = (f: number) => (f === F.flat ? -4 : f === F.take || f === F.take + F.left ? -19 : -15);

/** Palettes: 0 grape, 1 hit flash, 2 soot. */
export const TOON: Record<string, string>[] = [
  { skin: C.cmd, shade: C.base, nose: C.aim },
  { "*": C.ink },
  { skin: C.rim, shade: C.line, nose: C.line },
];

/** Five-point stars spinning round a head; `n` of them. */
export function stars(g: CanvasRenderingContext2D, x: number, y: number, t: number, n = 3, r = 8) {
  g.fillStyle = C.hurt;
  for (let s = 0; s < n; s++) {
    const a = t * 7 + (s * 6.283) / n, sx = Math.round(x + Math.cos(a) * r), sy = Math.round(y + Math.sin(a) * 2);
    g.fillRect(sx - 1, sy, 3, 1);
    g.fillRect(sx, sy - 1, 1, 3);
  }
}

/** The take: surprise lines off the hat and a bang, over a head at (x, y), in `c` (dark or light pages). */
export function take(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
  g.fillStyle = c;
  g.fillRect(x - 7, y + 1, 1, 2), g.fillRect(x - 8, y - 1, 1, 1), g.fillRect(x + 7, y + 1, 1, 2), g.fillRect(x + 8, y - 1, 1, 1);
  g.fillStyle = C.attack;
  g.fillRect(x - 1, y - 4, 2, 5), g.fillRect(x - 1, y + 2, 2, 2);
}

/** A grawlix over a head: a swear in symbols in a little white balloon, flickering. */
export function grawlix(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  x = Math.round(x);
  y = Math.round(y - (t * 6 > 2 ? 2 : t * 6));
  const k = Math.floor(t * 8) & 1;
  g.fillStyle = C.rim;
  g.fillRect(x - 10, y - 4, 21, 9);
  g.fillRect(x - 2, y + 5, 2, 2);
  g.fillStyle = C.ink;
  g.fillRect(x - 9, y - 3, 19, 7);
  print(g, "%", x - 8, y - 2, k ? C.attack : C.cmd);
  print(g, "!", x - 3, y - 2 - k, C.red);
  print(g, "%", x + 1, y - 2, k ? C.cmd : C.attack);
  print(g, "!", x + 6, y - 2 + k, C.red);
}

/** The anvil (12 × 7), the upright piano (20 × 17), the dynamite bundle (11 × 11): pivots at the bottom
 *  middle. Functions, so a piece ships only the props it draws. */
export const ANVIL = (): SpriteDef => ({
  frames: [["kkkkkkkkkkkk", ".llllllllkkk", "..lllllll...", "...lllll....", "...lllll....", "..mmmmmmm...", ".mmmmmmmmm.."]],
  colors: { k: C.muted, l: C.line, m: C.base }, outline: C.rim, ax: 6, ay: 7,
});
export const PIANO = (): SpriteDef => ({
  frames: [[
    "mmmmmmmmmmmmmmmmmmmm",
    "mllllllllllllllllllm",
    "mlwwwwwwwwwwwwwwwwlm",
    "mlwkkkkkkkkkkkkkkwlm",
    "mlwkkkkkkkkkkkkkkwlm",
    "mlwwwwwwwwwwwwwwwwlm",
    "mllllllllllllllllllm",
    "mmmmmmmmmmmmmmmmmmmm",
    "wkwkwwkwkwkwwkwkwwkw",
    "wkwkwwkwkwkwwkwkwwkw",
    "wwwwwwwwwwwwwwwwwwww",
    "mmmmmmmmmmmmmmmmmmmm",
    "mllllllllllllllllllm",
    "mllllllllllllllllllm",
    "mllllllllllllllllllm",
    "mmmmmmmmmmmmmmmmmmmm",
    ".m................m.",
  ]],
  colors: { m: C.base, l: C.cmd, w: C.ink, k: C.rim }, outline: C.rim, ax: 10, ay: 17,
});
export const DYNA = (): SpriteDef => ({
  frames: [["....kk.....", ".....k.....", "tttdtttdttt", "rrrdrrrdrrr", "rrrdrrrdrrr", "yyyyyyyyyyy", "rrrdrrrdrrr", "rrrdrrrdrrr", "rrrdrrrdrrr", "yyyyyyyyyyy", "rrrdrrrdrrr"]],
  colors: { r: C.red, d: C.attack, y: C.hurt, t: C.muted, k: C.rim }, outline: C.rim, ax: 5, ay: 11,
});
