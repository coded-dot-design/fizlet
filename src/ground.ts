/**
 * @fzlt/core/ground: paint on the ground of a `@fzlt/core/diorama` scene, inside a decal or an overlay,
 * through the diorama's own projection. Four games wrote these by hand next to their scenes: a line
 * between two world points, dropped when either end is at the eye (`seg`); a flat disc as an ellipse
 * sized by its depth (`spot`: light pools, reticles); a ring of world points that lies on a slope
 * (`ring`: hazards, a shadow on a dune); a blob shadow that fades and shrinks as its owner lifts
 * (`shadow`); and where the horizon is on screen (`horizon`: a sky's edge, fog bands).
 *
 * Each call adds to the context's current path (the caller begins, strokes and fills, so many lines
 * are one stroke), except `shadow`, which fills its own. `at` holds the last point projected: its
 * depth sizes a line (`width = focal × metres / at[2]`). Zero allocation per call: results go into
 * `at` and a private scratch (measured with one diorama in the process; where several scenes share these
 * call sites V8 may stop inlining `d.project` and box its arguments, as for any call that takes numbers).
 * Cosmetic: builtin trig (the ground is drawn, not simulated).
 */
import type { Diorama } from "./diorama.js";

/** What these painters call on a 2D context (a `CanvasRenderingContext2D` is one). */
export interface GroundContext {
  globalAlpha: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(): void;
}
/** A ground that writes its height at (x, z) into `out[0]`: `@fzlt/core/terrain` is one (the ground
 *  `@fzlt/core/drive` takes; the height comes back in an array, so no number is boxed per point). */
export interface GroundHeights {
  sample(x: number, z: number, out: { [i: number]: number }): unknown;
}

/** The last point projected by `seg` (its second end), `spot`, `ring` (its last vertex) or `shadow`:
 *  [screen x, screen y, depth]. */
export const at = new Float64Array(3);
const A = new Float64Array(3), G = new Float64Array(4), TAU = Math.PI * 2;
/** Nearer than this to the eye, a point is not drawn (a projection that close flies off screen). */
const NEAR = 0.5;

/** A line from world A to world B, added to the current path. False (and nothing added) when either end
 *  is behind the camera or within `near` of it. `at` is B on screen. */
export function seg(d: Diorama, ctx: GroundContext, ax: number, ay: number, az: number, bx: number, by: number, bz: number, near = NEAR): boolean {
  if (!d.project(ax, ay, az, A) || A[2]! < near || !d.project(bx, by, bz, at) || at[2]! < near) return false;
  ctx.moveTo(A[0]!, A[1]!);
  ctx.lineTo(at[0]!, at[1]!);
  return true;
}

/** A flat disc of world radius `r` at (x, y, z) as an ellipse, added to the current path: `r × focal /
 *  depth` px wide and `flat` of that tall (default: the sine of the camera's pitch, what a level disc
 *  shows at the middle of the view; pass your own for a look). False when the centre is behind the
 *  camera or within `near` of it. `at` is the centre on screen. */
export function spot(d: Diorama, ctx: GroundContext, x: number, y: number, z: number, r: number, flat = -1, near = NEAR): boolean {
  if (!d.project(x, y, z, at) || at[2]! < near) return false;
  const rx = (d.focal() * r) / at[2]!, k = flat < 0 ? Math.abs(Math.sin(d.cam.pitch)) : flat;
  ctx.moveTo(at[0]! + rx, at[1]!);
  ctx.ellipse(at[0]!, at[1]!, rx, rx * k, 0, 0, TAU);
  return true;
}

/** A closed ring of `n` world points of radius `r` round (x, z), added to the current path: on the
 *  plane `y` (a number), or on a ground's slope (anything with `sample(x, z, out)`), `lift` above it. Exact
 *  in perspective where `spot` is an ellipse. False (the path may hold part of it: begin a new one)
 *  when any point is behind the camera or within `near` of it. `at` is its last vertex. */
export function ring(d: Diorama, ctx: GroundContext, x: number, z: number, r: number, y: number | GroundHeights = 0, lift = 0, n = 24, near = NEAR): boolean {
  const g = typeof y === "number" ? null : y;
  G[0] = g ? 0 : (y as number);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (g) high(g, px, pz);
    if (!d.project(px, G[0]! + lift, pz, at) || at[2]! < near) return false;
    if (i) ctx.lineTo(at[0]!, at[1]!);
    else ctx.moveTo(at[0]!, at[1]!);
  }
  ctx.closePath();
  return true;
}
/** The ground's height at (x, z) into G[0]. Its own small function, so a game's one kind of ground
 *  inlines here (as in @fzlt/core/drive) and no number is boxed on the way. */
function high(g: GroundHeights, x: number, z: number) {
  g.sample(x, z, G);
}

/** A blob shadow on the ground at (x, y, z) under something `lift` above it, filled now in the
 *  context's fill style: radius `r`, strength `alpha` at rest, fading by `fade` per unit of lift (never
 *  under a quarter of `alpha`) and narrowing by half as much (never under half). The context's alpha
 *  is put back. False when not drawn. */
export function shadow(d: Diorama, ctx: GroundContext, x: number, y: number, z: number, r: number, lift = 0, alpha = 0.33, fade = 0.1, flat = -1): boolean {
  const up = lift > 0 ? lift : 0, a = alpha - up * fade, s = 1 - up * fade * 0.5, was = ctx.globalAlpha;
  ctx.beginPath();
  if (!spot(d, ctx, x, y, z, r * (s < 0.5 ? 0.5 : s), flat)) return false;
  ctx.globalAlpha = was * (a < alpha / 4 ? alpha / 4 : a);
  ctx.fill();
  ctx.globalAlpha = was;
  return true;
}

/** The horizon's screen y (CSS px) for the camera now: where level ground ends, however far. Above the
 *  canvas (negative) when the camera looks down past its field of view. */
export function horizon(d: Diorama): number {
  const c = d.cam;
  return d.height / 2 + c.oy - (d.height / 2 / Math.tan(c.fov / 2)) * Math.tan(c.pitch);
}
