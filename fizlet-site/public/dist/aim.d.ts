/**
 * @fzlt/core/aim: where bots and turrets point and when they may fire. Bound once to body arrays (a
 * @fzlt/core/actor's or a steer's `x`, `y`, heading `a`, velocity `vx`, `vy`) and, for line of sight, a
 * @fzlt/core/grid board; then everything takes rows:
 * - `lead(i, j, speed)`: where i must shoot a shot of `speed` px/s to meet j, moving at (vx, vy):
 *   the intercept of a straight shot and a straight mover, the earliest one ahead;
 * - `cone(i, j, half, range)`: j inside i's heading ± `half` radians and within `range`;
 * - `sees(i, j)`: no `mask` cell strictly between them on the board (Bresenham, symmetric), or
 *   the game's own `clear(i, j)`;
 * - `pick(i, list, n, half, range)`: the nearest `foe` of i among list[0..n) in its cone and in
 *   sight (an actor table's `list` and `n` as they are).
 * Results land in `out[0..3]` ([x, y, t, d]: aim point, seconds to impact or the off-heading angle, and
 * distance), so no call returns a double: doubles returned or passed across a call V8 doesn't
 * inline are boxed. Distances are @fzlt/core/steer's exact `hypot` (Math.hypot's bits, no heap
 * number). DOM-free, stateless between calls, zero allocation.
 */
import type { Board } from "./grid.js";
/** Options for `aim()`: the body arrays, an optional board and sight mask, and who counts as a foe. */
export interface AimOptions {
    x: Float64Array;
    y: Float64Array;
    /** Headings in radians (for `cone`); without them every cone is a circle. */
    a?: Float64Array;
    /** Velocities in px/s (for `lead`); without them targets stand still. */
    vx?: Float64Array;
    vy?: Float64Array;
    /** Line of sight on this board (world px; its `cell` size); without one everything is in sight. */
    board?: Board;
    /** Cell flags that block sight (default 1: grid's BLOCKED; BLOCKED | COVER lets cover block). */
    mask?: number;
    /** Your own line of sight, used instead of `board` (a game whose tiles have their own rule). */
    clear?(i: number, j: number): boolean;
    /** May i shoot at j? (default: any j but i). With actors: `(i, j) => A.side[j] !== A.side[i]`. */
    foe?(i: number, j: number): boolean;
}
/** Aiming bound to body arrays: `lead`, `cone`, `sees` and `pick`, results in `out`, zero allocation. */
export declare function aim(o: AimOptions): {
    out: Float64Array<ArrayBuffer>;
    /** out = [aim x, aim y, seconds to impact, distance to the aim point]. False when the shot can
     *  never catch j (out is then j where it stands, t = -1). */
    lead(i: number, j: number, speed: number): boolean;
    /** j within `range` px and inside i's heading ± `half` rad. out = [j's x, y, angle off heading
     *  (signed, -π..π: turn by it), distance]. */
    cone(i: number, j: number, half: number, range: number): boolean;
    sees: (i: number, j: number) => boolean;
    /** The nearest foe of i among rows list[0..n) inside its cone and range and in sight; -1 if none.
     *  Skip dead rows with `foe` (e.g. `A.alive[j] && …`). Sight is checked last, and only for a row
     *  closer than the best so far, so a long list costs a sight check per closer candidate, not per row. out is the pick's. */
    pick(i: number, list: Int32Array, n: number, half: number, range: number): number;
};
/** The aimer `aim()` returns. */
export type Aim = ReturnType<typeof aim>;
