// Pip, the keeper of Fizlet: a pixel narwhal, an AI agent persona (not a person). Drawn from Pip's
// 32 × 32 contributor avatar (the bubbles around it left out: here they're real), in the Board UI
// tokens the avatar maps to (scripts/people.mjs AVATAR_PALETTE): k rim, c sys body, l fallin belly,
// p cmd spots, w / y the striped tusk, m the attack-pink cheek. The tusk has a dark edge so it
// reads on a light page too. Facing right, and its mirror.
const BODY = [
  "..............................kw",
  ".............................ky.",
  "............................kw..",
  "............................ky..",
  "...........................kw...",
  "..........................ky....",
  "..........................kw....",
  ".k...........kkkkk.......ky.....",
  "kck......kkkkccccckkkk..kw......",
  ".kck...kkccccpcccccccckkky......",
  ".kcck.kcccpcccccpccpccccw.......",
  "..kcckccccccccccccccccccck......",
  "...kccccccccpccccccccckwcck.....",
  "..kccccccccccccccccccckkccck....",
  "..kcccccccccccccccccccccccck....",
  "..kccccccccccccccccccccccmck....",
  "..kccccccccccccccccccckcccck....",
  "...kcccllllllllllllllllkkklk....",
  "..kcccclllllllllllllllllllk.....",
  ".kcckkcllllllllllllllllllk......",
  ".kck..klllllllplllllllllk.......",
  "kck....kkllllplpllllllkk........",
  ".k.......kkkklppplkkkk..........",
  ".............kkkkk..............",
];
/** Happy: the eye shut in a ^, the cheek full. */
const HAPPY = BODY.map((r, i) => (i === 12 ? r.slice(0, 21) + "ckkc" + r.slice(25) : i === 13 ? r.slice(0, 21) + "kcck" + r.slice(25) : i === 15 ? r.slice(0, 24) + "mm" + r.slice(26) : r));
const flip = (f: string[]) => f.map((r) => [...r].reverse().join(""));

/** Board UI tokens, by letter (scripts/people.mjs AVATAR_PALETTE). */
export const COLORS: Record<string, string> = { k: "#07060f", c: "#19f0ff", l: "#a8ff3e", p: "#9a63ff", w: "#f6f3ff", y: "#ffc21a", m: "#ff2e88" };
/** Frames: calm, happy; facing right, then the same two facing left. Pivot: the middle of the body,
 *  15 px from the left (16 facing left) and 15 from the top. */
export const FRAMES = [BODY, HAPPY, flip(BODY), flip(HAPPY)];
/** From the pivot (facing right; mirror x when facing left): the tusk's tip, the blowhole, the body box. */
export const TIP_X = 16, TIP_Y = -15, HOLE_X = -1, HOLE_Y = -9, BOX_W = 13, BOX_H = 8;
