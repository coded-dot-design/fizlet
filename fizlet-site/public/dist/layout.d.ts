/**
 * @fzlt/core/layout: force-directed layout on typed arrays, with a Barnes-Hut pass, for diagrams and
 * graphs that settle. Nodes repel (a quadtree, rebuilt each step, sums far groups as one mass:
 * O(n log n)), links pull like springs toward their length, and a weak pull holds the graph
 * around (`cx`, `cy`). One tick per fixed step, so a run replays exactly.
 * - Settle: `alpha` cools from 1 toward 0 over `ticks` steps; when it is spent, or nothing moved
 *   more than `still` px in a step, the layout rests and stops calling `busy()`: the engine sleeps.
 *   `heat()`, `pin()` and `link()` warm it up and wake the engine.
 * - Reduced motion: the whole run happens in one step, so the graph lands where it settles.
 * - Zero allocation per step; fixed capacity (`cap` nodes, `links` links: add and link return -1 when full).
 * - DOM-free: draw it anywhere (@fzlt/core/view-canvas), frame it with @fzlt/core/camera (`bounds`).
 * Distances use steer's exact `hypot` (Math.hypot boxes its arguments).
 */
import type { Engine } from "./kernel/engine.js";
/** Options for `layout`: capacity, forces, cooling and motion. */
export interface LayoutOptions {
    /** Nodes (fixed: the arrays never grow). */
    cap: number;
    /** Links (default 2 × cap). */
    links?: number;
    /** Repulsion between nodes, px² per tick (default 30). */
    charge?: number;
    /** A link's rest length in px (default 40; `link` takes its own). */
    distance?: number;
    /** Pull toward the centre, per tick (default 0.04). */
    gravity?: number;
    /** The centre gravity pulls toward, x (default 0). */
    cx?: number;
    /** The centre gravity pulls toward, y (default 0). */
    cy?: number;
    /** Barnes-Hut accuracy: a cell of size s at distance d counts as one mass when s / d < theta (default 0.9). */
    theta?: number;
    /** Velocity kept per tick (default 0.6). */
    keep?: number;
    /** Steps a full run cools over (default 300: five seconds at 60 Hz). */
    ticks?: number;
    /** At rest once no node moves more than this many px in a step (default 0.02). */
    still?: number;
    /** Animate (default: yes, unless the visitor prefers reduced motion; then each run lands at once). */
    motion?: boolean;
}
/** A force-directed layout on typed arrays (`x`, `y`): Barnes-Hut repulsion, links, centre gravity.
 *  It cools over `ticks` steps, then rests and stops calling `busy()` so the engine settles. DOM-free. */
export declare function layout(engine: Engine, o: LayoutOptions): {
    x: Float64Array<ArrayBuffer>;
    y: Float64Array<ArrayBuffer>;
    vx: Float64Array<ArrayBuffer>;
    vy: Float64Array<ArrayBuffer>;
    /** Nodes and links added so far. */
    readonly size: number;
    readonly links: number;
    /** How warm the run is: 1 just heated, 0 at rest. */
    readonly alpha: number;
    /** At rest: no ticks, no busy(); the engine can settle. */
    readonly resting: boolean;
    /** Add a node at (x, y) (default: a sunflower spiral round the centre); its index, or -1 when full. */
    add(ax?: number, ay?: number): number;
    /** Link nodes a and b at rest length `len` (default `distance`); its index, or -1 when full. */
    link(a: number, b: number, len?: number): number;
    /** Hold node i at (x, y) (a drag): the rest flows round it. */
    pin(i: number, ax: number, ay: number): void;
    /** Let node i go. */
    free(i: number): void;
    /** Warm the run up to at least `alpha` (default 1) and wake the engine. */
    heat(alpha?: number): void;
    /** The node nearest (ax, ay) within `r` px, or -1. */
    nearest(ax: number, ay: number, r?: number): number;
    /** The box round every node, [left, top, right, bottom], into `out` (no allocation). */
    bounds<T extends {
        [i: number]: number;
    }>(out: T): T;
    step(e: Engine): void;
};
/** What `layout` returns: `x`, `y`, `add`, `link`, `pin`, `free`, `heat`, `nearest`, `bounds`. */
export type Layout = ReturnType<typeof layout>;
