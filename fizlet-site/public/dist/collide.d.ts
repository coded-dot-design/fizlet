/**
 * @fzlt/core/collide: a fixed-capacity spatial hash (no allocation per insert or query) and the shape
 * tests games need: circle–circle, circle–rect, swept segment–circle.
 */
type Nums = Float64Array | Float32Array;
/**
 * Spatial hash over a w×h world. Insert ids each step (after clear), then query a circle.
 * Three separate capacities, each saturating visibly (counters, never silent):
 * - entities `cap`: ids 0..cap-1; any other id (or a non-finite x, y, r) is refused, `rejected`;
 * - index `nodes` (default cap × 4): one node per cell a body covers; past it, `dropped`;
 * - query results: the caller's `out` buffer; ids that don't fit set `missed` (this query) and
 *   count in `truncated` (queries cut short). Size `out` so `missed` stays 0: collision results
 *   must not drop, so a game should treat any of these counters rising as a bug.
 */
export declare class Grid {
    cell: number;
    cols: number;
    rows: number;
    /** Entity capacity: valid ids are 0..cap-1. */
    readonly cap: number;
    /** Index capacity: cell entries per step (a body covering 4 cells takes 4). */
    readonly nodes: number;
    private h;
    private readonly n;
    private readonly d;
    private readonly s;
    private u;
    private k;
    /** Index entries refused because the node store was full (raise `nodes`). Cumulative. */
    dropped: number;
    /** Inserts and queries refused: id outside 0..cap-1, or a non-finite (or negative r) circle. Cumulative. */
    rejected: number;
    /** Queries whose result did not fit in `out`. Cumulative. */
    truncated: number;
    /** Ids the last query found but could not write to `out` (0 = complete). */
    missed: number;
    constructor(cell: number, cap: number, w: number, h: number, nodes?: number);
    /** World size changed (resize is not a hot path). */
    resize(w: number, h: number): void;
    clear(): void;
    /** The circle being inserted or queried. The work below takes only integers, so a call that
     *  V8 doesn't inline never boxes a number (numbers stay in this typed array). */
    private readonly a;
    /** Add id (0..cap-1) covering the circle (x, y, r). */
    insert(id: number, x: number, y: number, r: number): void;
    private p;
    /**
     * Hot-path forms: read body i's x, y, r from typed arrays (arrays and integers never box, even
     * when a big step function stops V8 inlining these calls). `pad` widens the search radius.
     */
    add(x: Nums, y: Nums, r: Nums, i: number): void;
    near(x: Nums, y: Nums, r: Nums, i: number, out: Int32Array, pad?: number): number;
    /**
     * Ids whose cells touch the circle, each once, into `out`. Returns the count written. If more
     * were found than `out` holds, `missed` says how many (and `truncated` counts the query).
     */
    query(x: number, y: number, r: number, out: Int32Array): number;
    private q;
}
/** Two circles overlap. */
export declare const circles: (ax: number, ay: number, ar: number, bx: number, by: number, br: number) => boolean;
/**
 * Bodies i and j overlap, reading x, y, r from typed arrays. Prefer this in big step functions:
 * it passes arrays and integers, so V8 never boxes numbers even when the call isn't inlined
 * (number arguments to a non-inlined function allocate).
 */
export declare function overlap(x: Nums, y: Nums, r: Nums, i: number, j: number): boolean;
/** A circle overlaps a rect (x, y, w, h). */
export declare function circleRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean;
/** A point is inside a rect. */
export declare const inRect: (px: number, py: number, x: number, y: number, w: number, h: number) => boolean;
/**
 * Swept hit: where along the segment (x0, y0) → (x1, y1) it first touches the circle, as 0..1,
 * or -1 for a miss. Use it for fast shots so they never tunnel through a target.
 */
export declare function segCircle(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, r: number): number;
export {};
