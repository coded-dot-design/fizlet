/** Something that takes events: an engine's ring (`engine.events`). */
export interface FlickEvents {
    emit(type: string, a?: number, b?: number, x?: number, y?: number, v?: number): unknown;
}
/** Options for `flick()`: capacity, the table, gravity and the step. */
export interface FlickOptions {
    /** The most pieces, ramps and walls (default 32). */
    cap?: number;
    /** The table top, [width, depth] centred on the origin (default [10, 6]). */
    table?: ArrayLike<number>;
    /** Where a piece that falls off lands and rests (default −2). */
    floor?: number;
    /** Sliding friction μ on the floor (default 0.8: what falls off stops soon). */
    floorFriction?: number;
    /** Gravity, world units per s² (default 9.8). */
    gravity?: number;
    /** Sub-steps per `step(dt)` (default 4). */
    sub?: number;
    /** Faster than this (units per s) a piece flies off an edge instead of tipping over it (default 0.6). */
    tip?: number;
    /** The highest lip a sliding piece rides up onto a ramp (default 0.08). */
    lip?: number;
    /** Events: `flick:hit` (a, b, x, z, speed), `flick:topple` (a), `flick:fall` (a), `flick:rest`. */
    events?: FlickEvents;
}
/** One piece, ramp or wall for `add`. */
export interface FlickBodyDef {
    /** `disc` (a puck, a coin), `box` (a block, a crate) or `ramp` (fixed, tall at its −x end like
     *  diorama's `wedge`; default `disc`). */
    shape?: "disc" | "box" | "ramp";
    /** [width (x), height (y), depth (z)]; a disc's width is its diameter (default [1, 0.3, 1]). */
    size?: ArrayLike<number>;
    /** [x, z]: on the highest surface under it; [x, y, z]: from that height (it falls if above). */
    pos?: ArrayLike<number>;
    /** Turn about y, radians (diorama's `rot[1]`). */
    yaw?: number;
    /** Mass (default 1). */
    mass?: number;
    /** Sliding friction μ (default 0.25). */
    friction?: number;
    /** Restitution, 0..1, averaged with what it hits (default 0.8). */
    bounce?: number;
    /** Never moves (a wall, a rail, a post); ramps always are. */
    fixed?: boolean;
}
/** A piece's state: `STATE.rest`, `slide`, `air` (falling) or `tip` (tipping over an edge). */
export declare const STATE: {
    readonly rest: 0;
    readonly slide: 1;
    readonly air: 2;
    readonly tip: 3;
};
/** A tabletop world: `add` pieces, `flick` one, `step` it from the engine, `apply` the poses. */
export declare function flick(o?: FlickOptions): {
    /** Pieces added. */
    readonly n: number;
    /** Anything moving, falling or tipping (false: everything rests). */
    readonly busy: boolean;
    /** Bottom centre x, y, z (the table top's frame) and velocity, per piece. */
    x: Float64Array<ArrayBuffer>;
    y: Float64Array<ArrayBuffer>;
    z: Float64Array<ArrayBuffer>;
    vx: Float64Array<ArrayBuffer>;
    vy: Float64Array<ArrayBuffer>;
    vz: Float64Array<ArrayBuffer>;
    /** Spin about y (rad/s), mass and inverse spin inertia (0: a disc, a fixed piece). */
    spin: Float64Array<ArrayBuffer>;
    mass: Float64Array<ArrayBuffer>;
    ii: Float64Array<ArrayBuffer>;
    /** `STATE` per piece; `off`: 1 once it fell off the table; `on`: what it rests on (−1 the
     *  table, −2 the floor, −3 nothing: in the air) or another piece's index. */
    state: Uint8Array<ArrayBuffer>;
    off: Uint8Array<ArrayBuffer>;
    on: Int32Array<ArrayBuffer>;
    /** Add a piece, ramp or wall (`FlickBodyDef`); returns its index. Add what holds a piece first. */
    add(d?: FlickBodyDef): number;
    /** Put piece i at (x, z) upright and still: on the highest surface under it, or from height y. */
    place(i: number, x: number, z: number, y?: number): void | -3;
    /** Flick piece i with impulse (jx, jz) (velocity change: impulse ÷ mass). */
    flick(i: number, jx: number, jz: number): void;
    /** Advance dt seconds (`sub` fixed sub-steps); returns `busy`. Call it from the engine's step. */
    step(dt: number): boolean;
    /** Step at `dt` until everything rests or `max` steps pass; returns the steps taken. */
    run(dt?: number, max?: number): number;
    /** How far a piece sliding at `speed` on a flat goes before friction stops it: v² ÷ 2μg. */
    reach: (i: number, speed: number) => number;
    /** Piece i's pose for a diorama object: out = [x, y, z, rx, ry, rz] (its bottom-centre origin and
     *  `rot`, through a topple too). */
    pose(i: number, out: {
        [k: number]: number;
    }): {
        [k: number]: number;
    };
    /** Write piece i's pose into a diorama object (`pos`, `rot`) resting on the table (or on a parent
     *  whose top is at height `y0` in the table's frame: −2 for a floor at `floor` −2, so its shadow
     *  falls on the floor). */
    apply(i: number, ob: {
        pos: {
            [k: number]: number;
        };
        rot: {
            [k: number]: number;
        };
    }, y0?: number): void;
};
/** What `flick` returns. */
export type Flick = ReturnType<typeof flick>;
/** Options for `sling()`: how far a full pull is, the impulse it gives and how fine the shot is. */
export interface SlingOptions {
    /** Drag length (world units) for full power (default 3). */
    pull?: number;
    /** The impulse at full power (default 12). */
    max?: number;
    /** Power under this (0..1) is no shot: `end()` returns false (default 0.05). */
    min?: number;
    /** Power levels (default 100): `level` is an integer 0..steps. */
    steps?: number;
    /** Directions per turn (default 4096): `angle` is an integer 0..turns − 1. */
    turns?: number;
}
/**
 * A slingshot drag that turns a pointer into an aimed flick: press on a piece (`begin` with its
 * centre and the pointer's point on the table, from diorama's `ground`), pull back (`move`), let go
 * (`end`). The shot points from the pointer to the piece; `power` (0..1) is the pull over `pull`, the
 * meter to draw. The shot is two integers, `angle` and `level`, so a game sends them as they are and
 * the other player's `set(angle, level)` gives the same `jx`, `jz` bit for bit (no Math.sin).
 */
export declare function sling(o?: SlingOptions): {
    /** A drag is on. */
    active: boolean;
    /** The piece's centre the drag pulls from. */
    ax: number;
    az: number;
    /** The shot: direction index (0..turns − 1, from +x toward +z) and power level (0..steps). */
    angle: number;
    level: number;
    /** level ÷ steps. */
    power: number;
    /** The unit direction and the impulse for `flick`. */
    dx: number;
    dz: number;
    jx: number;
    jz: number;
    /** Start a drag on the piece at (x, z), the pointer at (px, pz). */
    begin(x: number, z: number, px: number, pz: number): void;
    /** The pointer moved to (px, pz): the shot points from it to the piece. */
    move(px: number, pz: number): void;
    /** Set the shot from its two integers (a remote player's): the same impulse everywhere. */
    set(angle: number, level: number): void;
    /** Let go: true if it is a shot (power ≥ `min`); then `jx`, `jz`, `angle`, `level` hold it. */
    end(): boolean;
    /** Drop the drag without a shot. */
    cancel(): void;
};
/** What `sling` returns. */
export type Sling = ReturnType<typeof sling>;
