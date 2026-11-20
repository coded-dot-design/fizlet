/** Shapes a kind can draw as (a streak trails its velocity: sparks, drips). */
export declare const SHAPES: readonly ["square", "disc", "ring", "frame", "word", "smoke", "streak"];
/** A particle kind, as data. Ranges are [min, max]; speed and size scale with emit's `scale`. */
export interface Kind {
    shape: (typeof SHAPES)[number];
    /** Velocity lost per second, as a fraction (1.4 is the blast's smoke and flashes). */
    drag: number;
    /** Share of the pool's gravity (0: none; negative floats up, like a bubble). */
    gravity: number;
    /** Emit direction in radians (-π/2 is up) and the spread around it (2π: all round). */
    angle: number;
    spread: number;
    speed: readonly [number, number];
    size: readonly [number, number];
    life: readonly [number, number];
}
/** Built-in particle kind: small squares that drift up and fade. */
export declare const BUBBLE: Kind;
/** Built-in particle kind: fast streaks thrown in every direction, falling a little. */
export declare const SPARK: Kind;
/** Built-in particle kind: streaks that fall straight down. */
export declare const DRIP: Kind;
/** Built-in particle kind: square debris thrown in every direction, falling under full gravity. */
export declare const DEBRIS_KIND: Kind;
/** All four by name: `emitter(fx, KINDS)`, or pick some (`emitter(fx, { bubble: BUBBLE })`). */
export declare const KINDS: {
    bubble: Kind;
    spark: Kind;
    drip: Kind;
    debris: Kind;
};
/** Options for `effects()`: the particle cap, the colour and word tables, scorch marks and gravity. */
export interface FxOptions {
    /** Max live particles (default 420). New ones are refused (and counted in `dropped`) when full. */
    cap?: number;
    /** Colour table, at most 256; particles store an index (default: the Battlefield blast palette). */
    colors?: string[];
    /** Word table for pop words (index into it), at most 256. */
    words?: string[];
    /** Max scorch marks kept on the ground (default 36; 0 turns them off). */
    scorch?: number;
    /** Gravity in px/s² down (default 0); each kind takes its own share of it. */
    gravity?: number;
}
/**
 * Overload policy: particles are decorative, so a full pool refuses new ones and counts them in
 * `dropped`; a blast stops its per-particle work as soon as the pool is full. Invalid input
 * (non-finite numbers, a life that would never end) is refused and counted the same way.
 */
export declare function effects(o?: FxOptions): {
    colors: string[];
    words: string[];
    spawn: (k: number, x: number, y: number, vx: number, vy: number, size: number, life: number, c: number, rot?: number, spin?: number, w?: number) => boolean;
    readonly live: number;
    readonly shake: number;
    /** Particles refused so far: pool full, or invalid input. Decorative, so they may drop; counted. */
    readonly dropped: number;
    /** Set gravity in px/s² down (each kind takes its own share; read it back from your own state). */
    gravity: number;
    /** The pool itself, for emitter() and other helpers in this file. Not public API. */
    raw: {
        f: Float32Array<ArrayBuffer>[];
        kind: Uint8Array<ArrayBuffer>;
        col: Uint8Array<ArrayBuffer>;
        word: Uint8Array<ArrayBuffer>;
        st: Float64Array<ArrayBuffer>;
        K: Float32Array<ArrayBuffer>;
        cap: number;
        rnd: (a: number, b: number) => number;
    };
    /** Add screen shake (decays on its own; read `shake` when drawing). */
    kick(amount: number): void;
    /** Pop word (index into `words`), drifting up. */
    word(x: number, y: number, w: number, c: number, size?: number): void;
    /** The hero explosion: flash, fireball, shock ring, spinning square ring, debris, smoke, scorch. */
    blast(x: number, y: number, power?: number, tint?: number): undefined;
    /** Advance every particle (call once per frame or per step). */
    step(dt: number): void;
    /** Scorch marks under everything; call before drawing the actors. */
    drawGround(ctx: CanvasRenderingContext2D, light?: boolean): void;
    /** Every live particle, on top of the actors. */
    draw(ctx: CanvasRenderingContext2D, light?: boolean): void;
    clear(): void;
};
/** The particle pool `effects()` returns. */
export type Effects = ReturnType<typeof effects>;
/**
 * Named particle kinds on a pool: `const { ids, emit } = emitter(fx, KINDS)`, then
 * `emit(ids.bubble, x, y, 12)`. Its own export, so a page that never sprays kinds never ships it.
 * At most 26 kinds per pool (ids 6-31); a second emitter on the same pool adds after the first.
 */
export declare function emitter<N extends string>(fx: Effects, kinds: Record<N, Kind>): {
    ids: Record<N, number>;
    /**
     * `n` particles of kind `k` from (x, y), as that kind's data says: direction, spread, speed, size
     * and life (speed and size times `scale`). Colours are picked from `c`...`c + cn - 1`, and a word
     * kind's words from `w`...`w + wn - 1` (indexes into the pool's `words`). Bounded: it stops at
     * capacity and counts the rest in `dropped`. Writes the arrays directly: nothing boxes.
     */
    emit(k: number, x: number, y: number, n: number, c?: number, cn?: number, scale?: number, w?: number, wn?: number): undefined;
};
