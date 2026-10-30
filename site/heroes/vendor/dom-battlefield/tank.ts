/**
 * The hero's Sherman as fizlet/sprite data: the Sherman Bytes tank (src/sherman-sprites.ts, the
 * game's own art) split into a hull with two tread frames and a turret with seven recoil frames, so
 * the turret turns on its own. The rects are the shared drawing's own, one for one (the hero's
 * browser test draws both and compares the pixels). The poster (ArenaPoster.astro) draws the same
 * rects as SVG.
 */
import type { SpriteDef } from "../../../../src/sprite";

/** [x, y, w, h, paint]: a paint is a hex or the role `team`. */
export type Rect = readonly [number, number, number, number, string];

/** The hull, 32 × 32, centred on its middle; `frame` (0 or 1) moves the tread links by a pixel. */
export function hull(frame: number): Rect[] {
  const r: Rect[] = [[3, 5, 26, 7, "#151020"], [3, 21, 26, 7, "#151020"]];
  for (let i = 0; i < 6; i++) r.push([4 + i * 4 + frame, 6, 2, 5, "#8573ee"], [4 + i * 4 + frame, 22, 2, 5, "#8573ee"]);
  r.push([5, 11, 22, 11, "team"], [9, 9, 13, 15, "team"], [25, 13, 4, 7, "team"], [7, 12, 4, 9, "#241a35"], [13, 13, 4, 7, "#241a35"], [20, 14, 2, 5, "#06c4ff"], [18, 16, 6, 1, "#06c4ff"]);
  return r;
}
/** The turret about its pivot (0, 0), gun pointing right, pushed back `recoil` px (muzzle flash past 1). */
export function turret(recoil: number): Rect[] {
  const r: Rect[] = [[-7, -6, 14, 12, "team"], [-5, -8, 10, 16, "team"], [4 - recoil, -2, 19, 4, "team"], [-4, -4, 5, 8, "#241a35"], [20 - recoil, -2, 3, 4, "#241a35"]];
  if (recoil > 1) r.push([26 - recoil, -3, 5, 6, "#cdde00"]);
  return r;
}
/** Turret frames: recoil 0..6 px. */
export const RECOIL = 7;
/** Turret sprite box: x -7..29, y -8..8 (the gun and the muzzle flash at full recoil fit). */
const TX = 7, TY = 8;

const fill = (c: CanvasRenderingContext2D, rects: Rect[], color: (p: string) => string, dx = 0, dy = 0) => {
  for (const [x, y, w, h, p] of rects) (c.fillStyle = color(p)), c.fillRect(x + dx, y + dy, w, h);
};

export const TANK = {
  hull: { w: 32, h: 32, n: 2, paint: (c, f, color) => fill(c, hull(f), color) },
  turret: { w: 36, h: 16, n: RECOIL, ax: TX, ay: TY, paint: (c, f, color) => fill(c, turret(f), color, TX, TY) },
} satisfies Record<string, SpriteDef>;
