/**
 * @fzlt/core/beam: lasers on a board. Parts (mirrors, splitters, blockers, targets, emitters) stand on
 * a flat board plane in board coordinates [x, z], free or on a grid; `run()` casts every emitter's
 * ray, reflecting off mirrors at any angle, passing through and splitting at splitters, stopping at
 * blockers, targets and the board's edge, and writes the segments and hits into fixed typed arrays.
 * - A part is a segment (`len`, turned by `a`) or a circle (`r`). Angles are radians from +x toward
 *   +z; on a diorama an object turned to angle a has `rot[1] = −a`. Multiples of π/4 take exact
 *   directions (no `Math.cos` rounding), so a grid puzzle traces the same bits in every browser.
 * - Deterministic: the same parts give the same segments in the same order (depth first, the
 *   transmitted ray before the reflected one). `bounces` caps the turns on one path (`capped` counts
 *   the paths it stopped), `segs` the segments (`dropped` counts the rest).
 * - `dioramaBeam` draws the result on an `@fzlt/core/diorama` board: glowing beams as decals in the
 *   depth sort (split into short pieces so they sort among the parts), a pulse of points along them,
 *   sparks where a beam hits a target or a blocker; a re-routed beam grows out from where it changed.
 * No allocation per `run()` or `show()` in the steady state. 2D lengths use steer's exact `hypot`.
 */
import type { Diorama, DioramaPoints } from "./diorama.js";
/** Part kinds, as stored in `kind`. */
export declare const MIRROR = 1, SPLITTER = 2, BLOCKER = 3, TARGET = 4, EMITTER = 5;
/** A part's kind by name. */
export type BeamKind = "mirror" | "splitter" | "blocker" | "target" | "emitter";
/** One part to `add`: where it stands, its shape and what it does to a beam. */
export interface BeamPart {
    /** What it does: reflect, split (pass and reflect), stop, stop and light, or emit. */
    kind: BeamKind;
    /** Board x (or `col` on the grid). */
    x?: number;
    /** Board z (or `row` on the grid). */
    z?: number;
    /** Grid column: x is the cell's centre (needs `grid`). */
    col?: number;
    /** Grid row: z is the cell's centre. */
    row?: number;
    /** Angle, radians from +x toward +z: a segment's direction, or an emitter's beam (default 0). */
    a?: number;
    /** Segment length (default: the grid cell, or 1). */
    len?: number;
    /** A circle of this radius instead of a segment (a peg, a round target). */
    r?: number;
    /** A mirror reflects on its front only (the side its normal (−sin a, cos a) points to); its back blocks. */
    one?: boolean;
    /** Off: beams pass it, emitters stay dark (default on). */
    off?: boolean;
    /** Anything (the game's object). */
    tag?: unknown;
}
/** Options for `beam()`: capacities, the cap on turns, the board's edge and grid. */
export interface BeamOptions {
    /** The most parts (default 64). */
    cap?: number;
    /** The most segments per run (default 256). */
    segs?: number;
    /** The most hits per run (default 128). */
    hits?: number;
    /** The most turns (mirror or splitter hits) on one path (default 24). */
    bounces?: number;
    /** The board's edge [x0, z0, x1, z1]: beams stop there (default ±10,000). */
    bounds?: ArrayLike<number>;
    /** A grid: cell size and the board point of cell (0, 0)'s corner; `col`/`row` place parts on it. */
    grid?: {
        cell: number;
        x0?: number;
        z0?: number;
    };
}
/** A beam board: `add` parts, `run()` after any change, then read `segs` and `hits`. */
export declare function beam(o?: BeamOptions): {
    /** Parts added. */
    readonly parts: number;
    /** Per part: its kind (MIRROR … EMITTER), centre, angle, direction, half length, radius. */
    kind: Uint8Array<ArrayBuffer>;
    x: Float64Array<ArrayBuffer>;
    z: Float64Array<ArrayBuffer>;
    a: Float64Array<ArrayBuffer>;
    ux: Float64Array<ArrayBuffer>;
    uz: Float64Array<ArrayBuffer>;
    h: Float64Array<ArrayBuffer>;
    r: Float64Array<ArrayBuffer>;
    /** Per part: 1 off, 2 one-sided. */
    flag: Uint8Array<ArrayBuffer>;
    /** Per part: hits in the last run (a target is lit when > 0). */
    lit: Uint16Array<ArrayBuffer>;
    /** Per part: what `add` was given as `tag`. */
    tag: unknown[];
    /** Segments in the last run. */
    n: number;
    /** Segment start and end, board coordinates. */
    x0: Float64Array<ArrayBuffer>;
    z0: Float64Array<ArrayBuffer>;
    x1: Float64Array<ArrayBuffer>;
    z1: Float64Array<ArrayBuffer>;
    /** Segment: distance along its path from the emitter at the start (a re-route grows from here). */
    sl: Float64Array<ArrayBuffer>;
    /** Segment: power (1, halved at each split). */
    sp: Float64Array<ArrayBuffer>;
    /** Segment: turns before it. */
    sg: Uint16Array<ArrayBuffer>;
    /** Segment: the part it ends on, or −1 at the board's edge. */
    se: Int16Array<ArrayBuffer>;
    /** Segment: its emitter (−1 for `cast`). */
    ss: Int16Array<ArrayBuffer>;
    /** Hits in the last run. */
    nh: number;
    /** Hit: the part, the point, the segment that ends there. */
    hp: Int16Array<ArrayBuffer>;
    hx: Float64Array<ArrayBuffer>;
    hz: Float64Array<ArrayBuffer>;
    hs: Int16Array<ArrayBuffer>;
    /** Paths the `bounces` cap stopped in the last run. */
    capped: number;
    /** Segments or splits past capacity in the last run. */
    dropped: number;
    /** Runs so far (a drawing helper redraws when it changes). */
    ver: number;
    /** Add a part; returns its index. */
    add: (p: BeamPart) => number;
    /** Move part i to (px, pz), turned to angle `ang` (radians). Then `run()`. */
    set(i: number, px: number, pz: number, ang?: number): void;
    /** Turn part i by `da` radians (a quarter turn of a grid mirror: π/2). Then `run()`. */
    turn(i: number, da: number): void;
    /** Switch part i on or off. Then `run()`. */
    enable(i: number, on: boolean): void;
    /** The grid cell [col, row] holding board point (px, pz): out = [col, row]. */
    cellAt(px: number, pz: number, out: {
        [i: number]: number;
    }): {
        [i: number]: number;
    };
    /** The part centred in grid cell (col, row), or −1. */
    partAt(col: number, row: number): number;
    /** Targets lit in the last run. */
    litCount(): number;
    /** Clear the last run (segments, hits, lit). */
    reset: () => void;
    /** Append one ray from (px, pz) along (dx, dz) (no emitter part) at `power`; returns the segment count. */
    cast(px: number, pz: number, dx: number, dz: number, power?: number): number;
    /** Clear, then cast every emitter that is on; returns the segment count. */
    run: () => number;
};
/** What `beam` returns. */
export type Beam = ReturnType<typeof beam>;
/** Options for `dioramaBeam`: where the beams sit, their look and their motion. */
export interface DioramaBeamOptions {
    /** The id of the board object the parts stand on: board [x, z] is from its top centre. */
    on: string;
    /** The beams' height over the board (default 0.35). */
    y?: number;
    /** The cluster they sort in (default "@" + on, the board's own). */
    cluster?: string;
    /** Their layer in it (default 5: among parts resting on a root board). */
    layer?: number;
    /** Glow colour (default `#ff3b3b`). */
    color?: string;
    /** Core colour (default `#fff1ea`). */
    core?: string;
    /** Spark colour (default `#ffd36b`). */
    spark?: string;
    /** Beam width, world units (default 0.1). */
    width?: number;
    /** The longest piece a segment is drawn in (default 1): shorter pieces sort better among parts. */
    piece?: number;
    /** The most pieces (default 192). */
    pieces?: number;
    /** How fast a beam grows out, world units per second (default 24). */
    speed?: number;
    /** Pulse points' spacing along the beam (default 1.6; 0: none). */
    pulse?: number;
    /** Pulse speed, world units per second (default 5). */
    pulseSpeed?: number;
    /** The most pulse points (default 96). */
    dots?: number;
    /** The most sparks (default 64). */
    sparks?: number;
    /** Seconds the pulse plays after a change before it fades and `show` lets the engine settle (default 1.4; Infinity: always). */
    hold?: number;
    /** false (reduced motion): beams appear at once, no pulse, no sparks. */
    motion?: boolean;
    /** Called when a target's light turns on (the beam reached it) or off: tint the target. */
    light?: (part: number, on: boolean) => void;
}
/** Draw beam `b` on diorama `d`. `show(t)` (t: a running clock in seconds) before each `d.draw()`;
 *  true while anything moves (a beam growing, sparks, the pulse within `hold` of a change). */
export declare function dioramaBeam(d: Diorama, b: Beam, o: DioramaBeamOptions): {
    /** Per part: 1 once the drawn beam reached it (a target's light). */
    on: Uint8Array<ArrayBuffer>;
    /** Pieces drawn. */
    readonly pieces: number;
    /** Targets lit on screen. */
    readonly lit: number;
    /** The pulse points and sparks pools. */
    dots: DioramaPoints;
    sparks: DioramaPoints;
    /** Pose the beams at t (seconds, a running clock); true while anything still moves. */
    show(t: number): boolean;
};
/** What `dioramaBeam` returns. */
export type DioramaBeam = ReturnType<typeof dioramaBeam>;
