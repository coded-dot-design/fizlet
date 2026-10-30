/**
 * The layers the story shows, bottom to top, with Battlefield Blitz's measured bytes.
 * Source: fizlet-engine games/dom-battlefield-blitz/layers/manifest.json ("layers split",
 * Blitz at c8c8ca4). `gz` is the layer's own game code, minified then gzip. Effects is all
 * brick (no game code of its own), so it shows the bytes the fx brick puts in the bundle (min).
 */
export const SOURCE = "Battlefield Blitz c8c8ca4, layers manifest";

export interface Layer {
  id: string;
  name: string;
  /** Bytes shown on the label. */
  bytes: number;
  /** What `bytes` counts. */
  unit: "B gz" | "B min";
}

/** Bottom to top. Bricks: grid, sprite, steer (planned), collide, rules (planned), fx, input, hud. */
export const LAYERS: Layer[] = [
  { id: "grid", name: "Board: grid", bytes: 630, unit: "B gz" },
  { id: "characters", name: "Characters", bytes: 5674, unit: "B gz" },
  { id: "movement", name: "Movement", bytes: 3495, unit: "B gz" },
  { id: "collision", name: "Collision", bytes: 127, unit: "B gz" },
  { id: "rules", name: "Rules", bytes: 6052, unit: "B gz" },
  { id: "fx", name: "Effects", bytes: 2899, unit: "B min" },
  { id: "input", name: "Input intents", bytes: 2627, unit: "B gz" },
  { id: "hud", name: "HUD", bytes: 228, unit: "B gz" },
];

/** The layer that faults and gets fixed each cycle. */
export const FAULT = 3;

export const label = (l: Layer) => `${l.name} · ${l.bytes.toLocaleString("en-GB")} ${l.unit}`;

// Board: 9 × 13 cells of 24 px (a phone in portrait).
export const COLS = 9, ROWS = 13, CELL = 24, BW = COLS * CELL, BH = ROWS * CELL;

/** Walls (#) and cover (+) of the arena, row by row. */
export const MAP = [
  ".........",
  ".#.....#.",
  ".#..+..#.",
  ".........",
  "..##.##..",
  "....+....",
  ".+.###.+.",
  "....+....",
  "..##.##..",
  ".........",
  ".#..+..#.",
  ".#.....#.",
  ".........",
];

/** The exploded pose: tilt (deg), turn (deg), gap between layers (px, before scaling). */
export const TILT = 56, TURN = -36, GAP = 46;

/** The slot's text alternative: the whole sequence in words. */
export const ARIA =
  "A stylised mobile tank game plays for a few seconds. The board turns and fans out into its eight stacked layers, " +
  "each labelled with its measured size: board grid, characters, movement, collision, rules, effects, input and HUD. " +
  "The collision layer turns red with a fault, a scan passes over it and patches it, it flashes green, " +
  "and the stack folds back into the game. It loops.";

/** Width the labels take beside the exploded stack (screen px): the longest label, "Input intents ·
 *  2,627 B gz" (26 mono characters at 11px ≈ 172px), plus padding, border and the 10px margin. */
export const LABEL_W = 204;
/** Label pitch (screen px): one label is 21px tall (11px text, 3px padding, 2px border, each side);
 *  the exploded gap between layers widens so labels never sit closer than this. 28, not 22: the
 *  perspective draws the far (lower) layers a few % smaller, so their pitch shrinks a little too. */
export const PITCH = 28;
/** Room the controls keep (screen px): one column on the left (the slider above the play key), in
 *  every orientation. */
export const RESERVE = 56;
/** sin(TILT): how much of the layer gap shows as vertical spacing on screen. */
export const SIN_TILT = Math.sin((TILT * Math.PI) / 180);

/**
 * Fit a W × H stage: `sp` the game-pose scale; `se`, `ex` the exploded pose's scale and
 * x offset (screen px; the stack is centred vertically). An orthographic estimate of the stack's corners: pure maths, no DOM reads.
 */
export function bounds(n = 8) {
  const D = Math.PI / 180;
  const st = Math.sin(TURN * D), ct = Math.cos(TURN * D), sa = Math.sin(TILT * D), ca = Math.cos(TILT * D);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * GAP;
    for (let k = 0; k < 4; k++) {
      const x = (k & 1 ? 1 : -1) * BW / 2, y = (k & 2 ? 1 : -1) * BH / 2;
      const px = x * ct - y * st, py = (x * st + y * ct) * ca - z * sa;
      x0 = Math.min(x0, px), x1 = Math.max(x1, px), y0 = Math.min(y0, py), y1 = Math.max(y1, py);
    }
  }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
/** bounds() and bounds(1) (one board, no gap), precomputed for the live chunk: the stack is
 *  symmetric (centre 0, 0). build.mjs fails if these drift from the formula. */
export const BOUNDS = { w: 358.14, h: 479.09, hb: 212.14 };
/**
 * The exploded gap (layer px) at scale `se`: GAP, or wider so the labels keep PITCH on screen.
 */
export const gap = (se: number) => Math.max(GAP, PITCH / (SIN_TILT * se));
/** `lw`: the labels' width beside the stack (screen px), measured by the scene; LABEL_W by default. */
export function fit(W: number, H: number, lw = LABEL_W) {
  const sp = Math.min((W - 24) / (BW + 16), (H - 24) / (BH + 20));
  // Height: the stack at GAP, and the board plus 7 label pitches when the gap has to widen.
  // 44: a 14px margin each side, plus 8px each side for the perspective (near layers draw a few %
  // larger and drift out from the centre, most on narrow slots, where the gap widens for labels).
  const se = Math.min((W - 44 - lw) / BOUNDS.w, (H - 24) / BOUNDS.h, (H - 24 - 7 * PITCH) / BOUNDS.hb);
  return { sp, se, ex: -lw / 2, g: gap(se) };
}
