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
  brick: string;
  /** Bytes shown on the label. */
  bytes: number;
  /** What `bytes` counts. */
  unit: "B gz" | "B min";
}

export const LAYERS: Layer[] = [
  { id: "grid", name: "Board: grid", brick: "fizlet/grid", bytes: 630, unit: "B gz" },
  { id: "characters", name: "Characters", brick: "fizlet/sprite", bytes: 5674, unit: "B gz" },
  { id: "movement", name: "Movement", brick: "fizlet/steer", bytes: 3495, unit: "B gz" },
  { id: "collision", name: "Collision", brick: "fizlet/collide", bytes: 127, unit: "B gz" },
  { id: "rules", name: "Rules", brick: "fizlet/rules", bytes: 6052, unit: "B gz" },
  { id: "fx", name: "Effects", brick: "fizlet/fx", bytes: 2899, unit: "B min" },
  { id: "input", name: "Input intents", brick: "fizlet/input", bytes: 2627, unit: "B gz" },
  { id: "hud", name: "HUD", brick: "fizlet/hud", bytes: 228, unit: "B gz" },
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

/** Width the labels take beside the exploded stack (screen px). */
export const LABEL_W = 176;

/**
 * Fit a W × H stage: `sp` the game-pose scale; `se`, `ex`, `ey` the exploded pose's scale and
 * offset (screen px). An orthographic estimate of the stack's corners: pure maths, no DOM reads.
 */
export function bounds() {
  const D = Math.PI / 180, n = 8;
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
export function fit(W: number, H: number) {
  const b = bounds();
  const sp = Math.min((W - 24) / (BW + 16), (H - 24) / (BH + 20));
  const se = Math.min((W - 28 - LABEL_W) / b.w, (H - 24) / b.h);
  return { sp, se, ex: -LABEL_W / 2 - b.cx * se, ey: -b.cy * se };
}
