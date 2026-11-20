/** Something that takes events: an engine's ring (`engine.events`). */
export interface TrackEvents {
    emit(type: string, a?: number, b?: number): unknown;
}
/** How an open path ends when a move would go past the last space. */
export type TrackFinish = "stop" | "exact" | "bounce";
/** Options for `track()`: the path, its spaces, jumps, sharing, the end rule and the hop's look. */
export interface TrackOptions {
    /** The path's points, [x0, z0, x1, z1, …], in board units. */
    points: ArrayLike<number>;
    /** A loop: the last space leads to the first (default false: an open path, start to finish). */
    closed?: boolean;
    /** Lay this many spaces at even distances along the path (default: one space per point). */
    spaces?: number;
    /** A smooth curve through the points (Catmull-Rom) instead of straight lines; needs `spaces`. */
    smooth?: boolean;
    /** Jumps as [from, to] space pairs: a ladder up, a chute down, a shortcut. */
    jumps?: ArrayLike<ArrayLike<number>>;
    /** Tokens side by side on a space before the next ones stack on top (one number, or one per space; default 4). */
    cap?: number | ArrayLike<number>;
    /** How far apart tokens that share a space stand from its centre (default 0.3). */
    spacing?: number;
    /** The height of one stacked level (default 0.3). */
    level?: number;
    /** The most tokens (default 8). */
    tokens?: number;
    /** An open path's end: "stop" at the last space (default), "exact" (a move past it does not move)
     *  or "bounce" (count back from it). */
    finish?: TrackFinish;
    /** The space a token passes on a loop to "pass go" (default 0). */
    start?: number;
    /** The arc's height over a step (default 0.6). */
    hop?: number;
    /** Seconds per step (default 0.22). */
    hopTime?: number;
    /** Board units per second along a jump (default 6; at least 1.5 steps long). */
    jumpSpeed?: number;
    /** The most hops in one move (default 64). */
    maxHops?: number;
    /** An event ring for `track:pass`, `track:jump`, `track:finish`, `track:land`. */
    events?: TrackEvents;
}
/** Hop kinds and flags (`hops.kind`, `hops.flag`). */
export declare const HOP: {
    /** A step to the next (or previous) space. */
    readonly step: 0;
    /** A jump from a space to its target. */
    readonly jump: 1;
    /** Flag: this hop enters the start space going forward on a loop (pass go). */
    readonly pass: 1;
    /** Flag: a step backward after the end (bounce). */
    readonly back: 2;
    /** Flag: the move ends on the last space of an open path. */
    readonly finish: 4;
    /** Flag: the last hop of the move. */
    readonly land: 8;
};
/** A board path on `o.points`: `place` tokens, `move` them, then `sample` the hops over time. */
export declare function track(o: TrackOptions): {
    /** Spaces. */
    n: number;
    closed: boolean;
    /** Space centres. */
    x: Float64Array<ArrayBuffer>;
    z: Float64Array<ArrayBuffer>;
    /** Each space's heading: diorama's rot[1] that turns +x along the path. */
    a: Float64Array<ArrayBuffer>;
    /** Each space's jump target, or −1. */
    jump: Int32Array<ArrayBuffer>;
    /** Each token's space, or −1 off the board. */
    at: Int32Array<ArrayBuffer>;
    /** The last move's hops (`HOP` kinds and flags; `A`, `B`: each hop's ends, [x, y, z] × n). */
    hops: {
        /** Hops in the last move. */
        n: number;
        kind: Uint8Array<ArrayBuffer>;
        flag: Uint8Array<ArrayBuffer>;
        from: Int32Array<ArrayBuffer>;
        to: Int32Array<ArrayBuffer>;
        t0: Float64Array<ArrayBuffer>;
        t1: Float64Array<ArrayBuffer>;
        A: Float64Array<ArrayBuffer>;
        B: Float64Array<ArrayBuffer>;
    };
    /** The token the last move moved, or −1. */
    readonly token: number;
    /** Seconds the last move takes. */
    duration: number;
    /** Put token k on space s (−1 takes it off), with no hops. */
    place(k: number, s: number): void;
    /** Tokens on space s. */
    count(s: number): number;
    /** Move token k by `steps` (negative: back) and any jumps where it lands. Fills `hops` and
     *  returns its count (0: it did not move, e.g. an exact finish it overshot). */
    move(k: number, steps: number): number;
    slot: (k: number, out: {
        [i: number]: number;
    }, s?: number) => {
        [i: number]: number;
    };
    spot: (s: number, r: number, m: number, out: {
        [i: number]: number;
    }) => {
        [i: number]: number;
    };
    /** Where the moving token is at t seconds into the last move: out = [x, y, z] (y over the board's
     *  top). False once the move is over (out is then its landing place). */
    sample(t: number, out: {
        [i: number]: number;
    }): boolean;
    /** Write `sample(t)` into a diorama object's `pos` (plus `y0` up); true while it moves. */
    apply(ob: {
        pos: {
            [i: number]: number;
        };
    }, t: number, y0?: number): boolean;
};
/** What `track` returns. */
export type Track = ReturnType<typeof track>;
