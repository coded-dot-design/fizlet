// The hero of the heroes pieces (#23 the cape whoosh, #26 the landing): one pixel superhero, as data
// for @fzlt/core/sprite, and the red cape as cloth (a short verlet chain drawn as stamped pixel squares).
// Same hero, same cape in both pieces: night patrol over the skyline, then the landing on the page.
// Flat Fizlet tokens with an ink rim. A step on the cape never allocates; drawing is one pass of
// fillRects at whole art pixels, so it stays crisp on a pixel canvas scaled up with CSS.
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
  red: "#ff2b4e",
  base: "#3f296a",
};

// v suit, b suit shade, l suit light, y gold (bolt, belt), w eye lenses, r red (gloves, boots),
// o red light (cuffs). The cowl covers the whole face: two white lenses, slanted in.
const colors = { v: C.cmd, b: C.base, l: C.muted, y: C.hurt, w: C.ink, r: C.red, o: C.aim };

/** Front, hands on hips (the stand). 17 × 27. */
const STAND = [
  "......vvvvv......",
  ".....lvvvvvb.....",
  ".....vwwvwwb.....",
  ".....vvwvwvb.....",
  ".....vvvvvvb.....",
  "......vvvvb......",
  "...lvvvvvvvvbb...",
  "..lvvvvvvvyvvbb..",
  ".lvvb.vvvyvvb.bb.",
  ".vvb..vvyyyvb..bb",
  ".vvb..vvvyvvb..bb",
  "..vvb.vvyvvvb.bb.",
  "...orrvvvvvbrro..",
  "....rryyyyyyrr...",
  ".....vvvvvvvb....",
  ".....vvvb.vvb....",
  ".....vvvb.vvb....",
  ".....vvb...vvb...",
  "....vvvb...vvb...",
  "....vvb....vvbb..",
  "....vvb.....vvb..",
  "....oooo...oooo..",
  "....rrrr...rrrr..",
  "....rrrr...rrrr..",
  "...rrrrr...rrrrr.",
  "...rrrrr...rrrrr.",
];

/** Front, one fist up (the victory hover at the end of the whoosh). 17 × 33. */
const FIST = [
  "............rr...",
  "...........rrrr..",
  "...........rrrr..",
  "............oo...",
  "............vb...",
  "............vb...",
  "...........vvb...",
  "......vvvvvvb....",
  ".....lvvvvvvb....",
  ".....vwwvwwb.....",
  ".....vvwvwvb.....",
  ".....vvvvvvb.....",
  "......vvvvb......",
  "...lvvvvvvvvb....",
  "..lvvvvvvvyvvb...",
  ".lvvb.vvvyvvb....",
  ".vvb..vvyyyvb....",
  ".vvb..vvvyvvb....",
  "..vvb.vvyvvvb....",
  "...orrvvvvvb.....",
  "....rryyyyyy.....",
  ".....vvvvvvvb....",
  ".....vvvb.vvb....",
  ".....vvvb.vvb....",
  "......vvb.vvb....",
  "......vvb.vvb....",
  "......vvb.vvb....",
  "......vvb.vvb....",
  "......ooo.ooo....",
  "......rrr.rrr....",
  "......rrr.rrr....",
  ".....rrrr.rrrr...",
  ".................",
];

/** Flying right, fist forward. 32 × 10. */
const FLY = [
  "...................vvvvv........",
  "..................lvvvvvb.......",
  "..................vvvvwwb.......",
  "..........lllvvvvvvvvvwbb.......",
  "rr.....lvvvvvvvvyvvvvvbbvvvvoorr",
  "rrroovvvvvvvvvvyyyvvvvvvvvvvoorr",
  "rrroovvvvvvvvyyyvvvbbbbbbbbb.rr.",
  "rr...bbbbbbbbybbbbbb............",
  "...............bbbbbb...........",
  "................................",
];

/** Falling feet first, arms up, knees bent a little (the drop). 17 × 30. */
const DROP = [
  ".rr...........rr.",
  "rrrr.........rrrr",
  ".oo...........oo.",
  ".vb...........vb.",
  ".vvb.........vvb.",
  "..vvb.......vvb..",
  "...vvbvvvvvvvb...",
  "....vlvvvvvvb....",
  ".....vwwvwwb.....",
  ".....vvwvwvb.....",
  ".....vvvvvvb.....",
  "....lvvvvvvvb....",
  "....vvvvvyvvb....",
  "....vvvvyvvvb....",
  "....vvvyyyvvb....",
  "....vvvvyvvvb....",
  "....vvvyvvvvb....",
  "....vvvvvvvvb....",
  "....yyyyyyyyy....",
  "....vvvvvvvvb....",
  "....vvvb.vvvb....",
  ".....vvb..vvb....",
  ".....vvb..vvb....",
  "....vvb....vvb...",
  "....vvb....vvb...",
  "....ooo....ooo...",
  "....rrr....rrr...",
  "....rrr....rrr...",
  "....rrr....rrr...",
  ".................",
];

/** The three-point landing, head bowed: left fist in the ground, left knee down, right arm out back. 27 × 18. */
const LAND = [
  "...........................",
  "........................rr.",
  ".......................rrrr",
  "..........vvvvv........orr.",
  ".........lvvvvvb......vvb..",
  ".........vvvvvvb.....vvb...",
  ".........vwwvwwb....vvb....",
  ".........vvwvwvb...vvb.....",
  "......lvvvvvvvvvvvvvb......",
  ".....lvvvvvvyvvvvvbb.......",
  ".....vvb.vvvyyvvvvb........",
  "....vvb..vvyyyvvvb.........",
  "....vvb..vvvyvvvbvvvvb.....",
  "...vvb...yyyyyyyyvvvvvb....",
  "...oob..vvvvvvb....vvvb....",
  "..rrrr..vvvb.......vvvb....",
  "..rrrr..vvvvb......oooob...",
  "..rrrr.rrrrrrr.....rrrrrr..",
];

/** Rising, knees still bent. 17 × 24. */
const RISE = [
  "......vvvvv......",
  ".....lvvvvvb.....",
  ".....vwwvwwb.....",
  ".....vvwvwvb.....",
  ".....vvvvvvb.....",
  "......vvvvb......",
  "...lvvvvvvvvbb...",
  "..lvvvvvvvyvvbb..",
  ".lvvb.vvvyvvb.bb.",
  ".vvb..vvyyyvb..bb",
  "..vvb.vvvyvvb.bb.",
  "...orrvvyvvvbrro.",
  "....rryyyyyyrr...",
  "....vvvvvvvvvb...",
  "...vvvb...vvvb...",
  "..vvvb.....vvvb..",
  "..vvb.......vvb..",
  "..vvb.......vvb..",
  "..oooo.....oooo..",
  "..rrrr.....rrrr..",
  ".rrrrr.....rrrrr.",
];

export const HERO = {
  stand: { frames: STAND, colors, outline: C.rim, ax: 8, ay: 26 } satisfies SpriteDef,
  fist: { frames: FIST, colors, outline: C.rim, ax: 8, ay: 32 } satisfies SpriteDef,
  fly: { frames: FLY, colors, outline: C.rim, ax: 16, ay: 5 } satisfies SpriteDef,
  /** Flying left: the same pixels, mirrored. */
  flyL: { frames: FLY.map((r) => [...r].reverse().join("")), colors, outline: C.rim, ax: 16, ay: 5 } satisfies SpriteDef,
  drop: { frames: DROP, colors, outline: C.rim, ax: 8, ay: 29 } satisfies SpriteDef,
  land: { frames: LAND, colors, outline: C.rim, ax: 12, ay: 18 } satisfies SpriteDef,
  rise: { frames: RISE, colors, outline: C.rim, ax: 8, ay: 21 } satisfies SpriteDef,
};
export type Pose = keyof typeof HERO;
/** Where the cape ties on, per pose, from the sprite's pivot (art px; up is negative). */
export const NECK: Record<Pose, readonly [number, number]> = {
  stand: [0, -20],
  fist: [0, -19],
  fly: [2, -2],
  flyL: [-2, -2],
  drop: [0, -18],
  land: [0, -10],
  rise: [0, -15],
};

/**
 * The cape: N points, verlet, pinned at the neck. Typed arrays only: stepping it never allocates.
 * Gravity pulls it down, `wind` pushes it, a ripple runs down it while it moves, drag calms it.
 */
export function cape(n = 11, seg = 1.9) {
  const X = new Float64Array(n), Y = new Float64Array(n), PX = new Float64Array(n), PY = new Float64Array(n);
  const s = new Float64Array(7); // time, wind x, wind y, ripple, gravity, last motion, floor
  s[4] = 150;
  s[6] = Infinity;
  const c = {
    n,
    X,
    Y,
    /** Wind (art px/s², blowing the cloth) and the ripple's strength (0: none). */
    wind(x: number, y: number, ripple: number) {
      s[1] = x;
      s[2] = y;
      s[3] = ripple;
    },
    /** The ground (art px): the cloth lies on it, never through it (Infinity: none). */
    floor(y: number) {
      s[6] = y;
    },
    /** Put the whole cape at (x, y), hanging straight down, at rest. */
    reset(x: number, y: number) {
      for (let i = 0; i < n; i++) (X[i] = PX[i] = x), (Y[i] = PY[i] = y + i * seg);
    },
    /** One step with the neck at (x, y). Returns how far the cloth moved (art px; ~0 once it hangs still). */
    step(x: number, y: number, dt: number) {
      const t = (s[0] = s[0]! + dt), g = s[4]!, rp = s[3]!;
      let moved = 0;
      X[0] = PX[0] = x;
      Y[0] = PY[0] = y;
      for (let i = 1; i < n; i++) {
        const vx = (X[i]! - PX[i]!) * 0.94, vy = (Y[i]! - PY[i]!) * 0.94;
        // The ripple: a wave down the cloth, square to it, stronger towards the hem.
        const dx = X[i]! - X[i - 1]!, dy = Y[i]! - Y[i - 1]!, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const wv = Math.sin(t * 14 - i * 0.9) * rp * (i / (n - 1));
        PX[i] = X[i]!;
        PY[i] = Y[i]!;
        X[i] = X[i]! + vx + (s[1]! - (dy / d) * wv) * dt * dt;
        Y[i] = Y[i]! + vy + (g + s[2]! + (dx / d) * wv) * dt * dt;
        moved += Math.abs(vx) + Math.abs(vy);
      }
      // Keep the links their length (a few passes, the neck pinned).
      for (let it = 0; it < 4; it++)
        for (let i = 1; i < n; i++) {
          const dx = X[i]! - X[i - 1]!, dy = Y[i]! - Y[i - 1]!, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - seg) / d;
          if (i === 1) (X[i] = X[i]! - dx * f), (Y[i] = Y[i]! - dy * f);
          else (X[i] = X[i]! - dx * f * 0.5), (Y[i] = Y[i]! - dy * f * 0.5), (X[i - 1] = X[i - 1]! + dx * f * 0.5), (Y[i - 1] = Y[i - 1]! + dy * f * 0.5);
        }
      const fl = s[6]!;
      for (let i = 1; i < n; i++) if (Y[i]! > fl) (Y[i] = fl), (PX[i] = PX[i]! + (X[i]! - PX[i]!) * 0.5), (PY[i] = fl);
      return (s[5] = moved);
    },
    get moving() {
      return s[5]!;
    },
  };
  return c;
}
export type Cape = ReturnType<typeof cape>;

/**
 * Draw the cape as pixel cloth: along the chain, square stamps that widen to the hem (rim first, one
 * art pixel out, then red, then a fold of light red down the middle where the ripple bends it).
 * `w0`, `w1`: width at the neck and at the hem, in art px. Whole pixels only. `dark`: all rim (a
 * silhouette, against the moon). `upto`: draw only the first points (a shorter cape, standing).
 */
export function drawCape(ctx: CanvasRenderingContext2D, c: Cape, w0: number, w1: number, dark = false, upto = c.n) {
  const { X, Y } = c, n = Math.min(c.n, upto);
  for (let pass = 0; pass < 3; pass++) {
    ctx.fillStyle = pass === 0 || dark ? C.rim : pass === 1 ? C.red : C.aim;
    for (let i = 0; i < n - 1; i++) {
      const ax = X[i]!, ay = Y[i]!, bx = X[i + 1]!, by = Y[i + 1]!, steps = Math.max(1, Math.ceil(Math.abs(bx - ax) + Math.abs(by - ay)));
      for (let q = 0; q < steps; q++) {
        const u = q / steps, k = (i + u) / (n - 1), w = Math.round(w0 + (w1 - w0) * k);
        const x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
        if (pass === 2) {
          // The fold: a light line down the lower part of the cloth, a quarter of the way across.
          if (k < 0.3) continue;
          const dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy) || 1;
          ctx.fillRect(Math.round(x - (dy / d) * w * 0.22), Math.round(y + (dx / d) * w * 0.22), 1, 1);
          continue;
        }
        const s = pass === 0 ? w + 2 : w;
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      }
    }
  }
}

// The cat (the landing's bystander): a small dark cat with green eyes. Frames: sitting, startled
// (fur up, tail up, eyes wide). 11 × 9, pivot at its feet.
const catColors = { k: C.base, g: C.go, w: C.ink, p: C.aim, l: C.line };
export const CAT: SpriteDef = {
  frames: [
    [
      "k.....k....",
      "kk...kk....",
      "kkkkkkk....",
      "kgkkkgk....",
      "kkkpkkk..k.",
      ".kkkkk...k.",
      ".kkkkkk.kk.",
      ".kkkkkkkk..",
      ".kl.kl.....",
    ],
    [
      "k.k.k.k..k.",
      "kk.k.kk..k.",
      "kkkkkkk..k.",
      "kwkkkwk..k.",
      "kkkpkkk..k.",
      "kkkkkkk.kk.",
      "kkkkkkkkk..",
      ".kkkkkkk...",
      ".kl.kl.....",
    ],
  ],
  colors: catColors,
  outline: C.rim,
  ax: 4,
  ay: 9,
};
