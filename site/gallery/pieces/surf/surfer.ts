// The surfer every surf-sesh piece draws (Shoot the Pier first; the older rides next): our own
// grown-up rider in hard pixels. A small head with slicked-back wet hair, bare chest and arms with
// one shade, pink board shorts, long legs in a low stance, a one-pixel rim, eight colours. Poses:
// paddle (prone on the board), pop-up, ride, crouch, lean left or right (an arm thrown out to
// steer), wipeout (tumbling); seen from the side (facing right or left) or front on (riding at you).
// The board is drawn with the rider. Every pose is a pixel map (rows of palette keys), drawn whole
// pixel by whole pixel at an integer scale, so edges stay crisp; drawing allocates nothing.
import { C } from "./kit";

/** Poses. */
export const PADDLE = 0, POPUP = 1, RIDE = 2, CROUCH = 3, LEAN_L = 4, LEAN_R = 5, WIPEOUT = 6;
/** Facing: front on (riding toward the viewer), right, left. */
export const FRONT = 0, RIGHT = 1, LEFT = -1;

/** The palette: rim, wet hair and its shine, skin and its shade, board shorts, the board and its stripe. */
const PAL: Record<string, string> = { k: C.rim, h: "#1d1738", l: C.line, s: "#d99a6c", d: "#a8663f", p: C.attack, b: C.hurt, t: C.ink };

// Front on, feet at the bottom row's middle. 15 wide.
const F_TOP = ["......kkk......", ".....khlhk.....", ".....ksssk.....", "......kdk......", "....kkssskk....", "...ksssdsssk..."];
const F_ARMS = ["..ksskdddkssk..", ".ksk.kdsdk.ksk.", "ksk..kpppk..ksk", "kk..kpppppk..kk"];
// Leaning left: the left arm thrown out level, the right one down by the hip. (Right: mirrored.)
const F_LEAN = ["kkkskdddkssk...", "sssk.kdsdk.ksk.", "kkk..kpppk..ksk", "....kpppppk..kk"];
const F_LEGS = ["....kppkppk....", "...kppk.kppk...", "...ksk...ksk...", "..ksk.....ksk..", "..kk.......kk.."];
// Side on, facing right, feet on the bottom row. 13 wide.
const S_RIDE = ["......kkk....", ".....khhlk...", ".....ksssk...", "......kdkk...", "....kkssssk..", "..kksdssdsskk", ".ksk.ksdsk..k", "kk...kppkk...", "....kpppk....", "...kppkppk...", "..kpk...kpk..", "..ksk....ksk.", ".ksk......ksk", ".kk........kk"];
// Prone on the board, head up, facing right. 16 wide.
const S_PADDLE = ["...........kkk..", ".kkkkkkkkkkhhlk.", "kppppkssssdsssk.", ".kkkkkkkkkkkkk.."];
// The pop-up: hands on the rails, back foot planted, front knee coming through. 14 wide.
const S_POPUP = ["..........kkk.", ".........khhlk", "....kkkkkksssk", "..kpppkssssdk.", ".kppkkdsk..ksk", "kpk...ksk..ksk", "ksk...kk...kk."];

/** One row of pixels; `flip` mirrors it. */
function strip(g: CanvasRenderingContext2D, row: string, x: number, y: number, k: number, flip: boolean) {
  const n = row.length;
  for (let i = 0; i < n; i++) {
    const c = row[flip ? n - 1 - i : i]!;
    if (c === ".") continue;
    g.fillStyle = PAL[c]!;
    g.fillRect(x + i * k, y, k, k);
  }
}

/** The board: front on, a long nose toward you; side on, a flat plank with a rocker and a fin. */
function board(g: CanvasRenderingContext2D, x: number, y: number, facing: number, k: number) {
  g.fillStyle = C.rim;
  if (facing === FRONT) {
    g.fillRect(x - 3 * k, y - 2 * k, 7 * k, 14 * k), g.fillRect(x - 2 * k, y - 3 * k, 5 * k, 16 * k);
    g.fillStyle = C.hurt;
    g.fillRect(x - 2 * k, y - 2 * k, 5 * k, 14 * k), g.fillRect(x - k, y - 2 * k, 3 * k, 15 * k);
    g.fillStyle = C.attack;
    g.fillRect(x, y - 2 * k, k, 14 * k);
    return;
  }
  const f = facing, x0 = x - 9 * k;
  g.fillRect(x0, y, 18 * k, 3 * k), g.fillRect(f > 0 ? x0 + 16 * k : x0, y - k, 2 * k, 2 * k);
  g.fillStyle = C.hurt;
  g.fillRect(x0 + k, y + k, 16 * k, k);
  g.fillStyle = C.rim;
  g.fillRect(f > 0 ? x0 + 3 * k : x0 + 13 * k, y + 3 * k, 2 * k, 2 * k);
}

/** Over the falls: the rider tumbles end over end (quarter turns, crisp), the board flies. */
export function tumble(g: CanvasRenderingContext2D, x: number, y: number, t: number, k = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const q = ((t * 10) | 0) & 3, rows = S_RIDE, h = rows.length, w = rows[0]!.length;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = rows[j]![i]!;
      if (c === ".") continue;
      const u = i - (w >> 1), v = j - (h >> 1), rx = q === 0 ? u : q === 1 ? -v : q === 2 ? -u : v, ry = q === 0 ? v : q === 1 ? u : q === 2 ? -v : -u;
      g.fillStyle = PAL[c]!;
      g.fillRect(x + rx * k, y - 8 * k + ry * k, k, k);
    }
  g.fillStyle = C.hurt;
  const b = ((t * 12) | 0) & 1;
  g.fillRect(x + 8 * k, y - 18 * k + (b ? 0 : 4 * k), b ? 2 * k : 10 * k, b ? 10 * k : 2 * k);
}

/** Front on, riding toward the viewer: RIDE, CROUCH, LEAN_L or LEAN_R. (x, y): the feet on the board. */
export function front(g: CanvasRenderingContext2D, x: number, y: number, pose: number, k = 1) {
  x = Math.round(x);
  y = Math.round(y);
  board(g, x, y, FRONT, k);
  const crouch = pose === CROUCH, lean = pose === LEAN_L ? -1 : pose === LEAN_R ? 1 : 0;
  const rows = (crouch ? 5 : 6) + 4 + (crouch ? 3 : 5);
  let yy = y - (rows - 1) * k;
  for (let j = 0; j < F_TOP.length; j++) if (!(crouch && j === 3)) strip(g, F_TOP[j]!, x - 7 * k + lean * k, yy, k, false), (yy += k);
  for (let j = 0; j < 4; j++, yy += k) strip(g, lean ? F_LEAN[j]! : F_ARMS[j]!, x - 7 * k + (j < 2 ? lean * k : 0), yy, k, lean > 0);
  for (let j = crouch ? 2 : 0; j < F_LEGS.length; j++, yy += k) strip(g, F_LEGS[j]!, x - 7 * k, yy, k, false);
}

/** Side on, facing RIGHT or LEFT: PADDLE, POPUP, RIDE, CROUCH, LEAN_L, LEAN_R. (x, y): the board's middle. */
export function side(g: CanvasRenderingContext2D, x: number, y: number, pose: number, facing: number, t: number, k = 1) {
  x = Math.round(x);
  y = Math.round(y);
  const flip = facing < 0;
  board(g, x, y, facing, k);
  if (pose === PADDLE) {
    for (let j = 0; j < S_PADDLE.length; j++) strip(g, S_PADDLE[j]!, x - 8 * k, y - (S_PADDLE.length - j) * k, k, flip);
    // The stroke: one arm reaching down into the water, then back.
    const a = ((t * 3) | 0) & 1, ax = x + (flip ? -1 : 1) * (a ? 3 : -1) * k;
    g.fillStyle = PAL.k!;
    g.fillRect(ax - k, y + k, 3 * k, (a ? 3 : 2) * k);
    g.fillStyle = PAL.s!;
    g.fillRect(ax, y + k, k, (a ? 3 : 2) * k - k);
    return;
  }
  const rows = pose === POPUP ? S_POPUP : S_RIDE, w = rows[0]!.length;
  // Crouch: the knees fold (the shin row goes); lean: the body tips into the turn a pixel.
  const skip = pose === CROUCH ? 11 : -1, tip = pose === LEAN_L ? -1 : pose === LEAN_R ? 1 : 0;
  let yy = y - (rows.length - (skip >= 0 ? 1 : 0)) * k;
  for (let j = 0; j < rows.length; j++) {
    if (j === skip) continue;
    strip(g, rows[j]!, x - (w >> 1) * k + (j < 7 ? tip * k : 0), yy, k, flip);
    yy += k;
  }
}

/**
 * Draw the surfer, board and all, in any pose and facing (a piece that needs only one view imports
 * `front`, `side` or `tumble` alone and ships less). `t`: the clock in seconds (paddle strokes, the
 * tumble). `k`: pixels per art pixel (an integer keeps it crisp).
 */
export function drawSurfer(g: CanvasRenderingContext2D, x: number, y: number, pose: number, facing: number, t: number, k = 1) {
  if (pose === WIPEOUT) tumble(g, x, y, t, k);
  else if (facing === FRONT) front(g, x, y, pose, k);
  else side(g, x, y, pose, facing, t, k);
}
