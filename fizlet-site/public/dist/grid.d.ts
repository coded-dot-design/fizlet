/**
 * @fzlt/core/grid: the game board. A cols × rows tile grid in typed arrays (terrain id, move cost,
 * flags), A* paths, line of sight, movement range and seeded terrain. Every search reuses buffers
 * made once by `board()`, so no call allocates. Cell ids are `row * cols + col`.
 *
 * Not collision: @fzlt/core/collide's `Grid` re-buckets moving bodies every step; a `Board` holds the
 * ground they move over. Use the same cell size for both and a body's collide bucket is its cell.
 * The size is checked at setup: `cols` and `rows` are positive integers, `cell` a finite number > 0
 * (a RangeError names all three). A search (`path`, `flood`, `los`, `hit`) checks its cell ids: an id
 * that is not an integer on the board throws `fizlet/grid: cell … is not on the board`.
 */
/** Flags: BLOCKED stops movement and sight, COVER stops sight (pass it in a mask), OCCUPIED marks
 *  a unit standing there (paths avoid it unless it is the goal). Bits 8–128 are yours. */
export declare const BLOCKED = 1, COVER = 2, OCCUPIED = 4;
/** Options for `board()`: the cell size in world units and whether moves go 8-way. */
export interface BoardOptions {
    /** World units per cell (default 1: world = grid units). */
    cell?: number;
    /** 8-way moves (never cutting a blocked corner). Default false: 4-way. */
    diagonal?: boolean;
}
/** The board `board()` makes: typed-array terrain, cost and flags per cell, plus the searches (A*
 *  paths, line of sight, movement range) on buffers made once. Make one with `board()`. */
export declare class Board {
    readonly cols: number;
    readonly rows: number;
    readonly cell: number;
    diagonal: boolean;
    /** Per cell: your terrain id (0 = open ground), move cost to enter (1–255, default 1), flags.
     *  Plain typed arrays: write them directly (`flags[i] |= OCCUPIED`, `flags.fill(0)` to reset). */
    readonly terrain: Uint8Array;
    readonly cost: Uint8Array;
    readonly flags: Uint8Array;
    /** Cells the last search expanded; `partial` is true when the last path ran out of budget. */
    expanded: number;
    partial: boolean;
    private readonly g;
    private readonly f;
    private readonly v;
    private readonly q;
    private readonly p;
    private readonly s;
    private k;
    private z;
    private b;
    private x;
    private y;
    constructor(cols: number, rows: number, opts?: BoardOptions);
    /** The cell under a world point, clamped to the board (so always a valid id). */
    at(x: number, y: number): number;
    /** Hot-path form: the cell under body i, reading typed arrays (nothing boxes). */
    cellOf(x: Float64Array | Float32Array, y: Float64Array | Float32Array, i: number): number;
    /** World centre of cell i into out[k], out[k + 1]. */
    center(i: number, out: Float64Array | Float32Array, k?: number): void;
    set(i: number, terrain: number, cost?: number, flags?: number): void;
    /**
     * Seeded terrain: inside the rect (c0, r0)–(c1, r1) (default the whole board), each open cell
     * (terrain 0, no flags) becomes `terrain` with chance `density`. One draw per cell in the rect,
     * whatever is there, so the same seed always lays the same board. Returns cells placed.
     */
    scatter(rand: () => number, density: number, terrain: number, cost?: number, flags?: number, c0?: number, r0?: number, c1?: number, r1?: number): number;
    /** A random cell with none of `mask`, or -1 after `tries` misses (spawns, pickups, crates). */
    pick(rand: () => number, mask?: number, tries?: number): number;
    /**
     * A* from `from` to `to` into `out`: the cells to step through, start excluded, goal last.
     * Returns the step count (0 when from === to, -1 for no path); if it is over out.length only the
     * first out.length steps are written. `budget` caps the cells expanded (0 = no cap) so a frame
     * never stalls: on a cap it writes the path to the closest cell found and sets `partial`.
     * Cells with any `avoid` flag are walls, except that the goal may be OCCUPIED.
     */
    path(from: number, to: number, out: Int32Array, budget?: number, avoid?: number): number;
    /**
     * Movement range: every cell reachable from `from` for at most `max` cost (an orthogonal step
     * into a cost-1 cell costs 1, a diagonal 1.4), nearest first, start included. Returns the count
     * (capped at out.length). `dist(i)` then reads each cell's cost.
     */
    flood(from: number, max: number, out: Int32Array, avoid?: number): number;
    /** Cost from the last search's start to cell i (exact after flood), or -1 if it was not reached. */
    dist(i: number): number;
    /** Line of sight between two cells: no cell strictly between them has a `mask` flag.
     *  Symmetric (a sees b exactly when b sees a). Pass BLOCKED | COVER to let cover block it. */
    los(a: number, b: number, mask?: number): boolean;
    /** The first cell strictly between a and b (walking from a) with a `mask` flag, or -1 if clear.
     *  Bresenham over cells: what a shot hits on its way. */
    hit(a: number, b: number, mask?: number): number;
    private c;
    private r;
    private h;
    private u;
    private w;
    private o;
}
/** A cols × rows board; every buffer a search needs is made here, once. */
export declare const board: (cols: number, rows: number, opts?: BoardOptions) => Board;
