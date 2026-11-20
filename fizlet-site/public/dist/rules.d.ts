/**
 * @fzlt/core/rules: the rules every arcade game repeats, as three small systems on the kernel:
 * - `waves`: a wave clock, prepare → assault → rebuild, with a spawn budget per wave;
 * - `drops`: pickups that fall, wait to be collected and expire;
 * - `score`: points, a combo that decays, and levels from XP thresholds.
 * Each is DOM-free, steps without allocating (state lives in typed arrays) and says what happened
 * on the event ring (`wave:start`, `wave:clear`, `drop:spawn`, `drop:land`, `drop:collect`, `drop:expire`,
 * `score`, `combo:end`, `level`), so the HUD, sound, fx and coach layers react without reaching
 * into the game. Defaults are the DOM VIRUS core's (WaveDirector, SupplyDrops) and Null Invaders'
 * numbers, so a port keeps its feel. The game still decides where and what to spawn. Call
 * `collect`, `add` and `miss` from a step, like the rest of the game: their events go on that
 * frame's ring.
 */
import type { Engine, System } from "./kernel/engine.js";
/** Where the wave clock is: prepare (before a wave), assault (spawning) or rebuild (between waves). */
export type WavePhase = "prepare" | "assault" | "rebuild";
/** Options for `waves()`: how many are alive now, the cap, the phase lengths and each wave's size,
 *  limit and spawn gap. */
export interface WaveOptions {
    /** Alive now. A wave clears when it has spawned everything and this reaches 0. */
    alive(): number;
    /** Most alive at once, whatever the wave (default 32). */
    cap?: number;
    /** Seconds before wave 1 (default 4) and between waves (default 8). */
    prepare?: number;
    rebuild?: number;
    /** Enemies in wave n (default min(40, 5 + 5n)). */
    size?(wave: number): number;
    /** Most alive at once in wave n, before `cap` (default 8 + 4n). */
    limit?(wave: number): number;
    /** Seconds between two spawns in wave n (default max(0.7, 2.1 − 0.12n)). */
    gap?(wave: number): number;
}
/** A wave clock on engine `e`, prepare → assault → rebuild, with a spawn budget per wave. It says when
 *  to spawn; the game decides where and what. Events: `wave:start`, `wave:clear`. */
export declare function waves(e: Engine, o: WaveOptions): {
    system: System;
    readonly wave: number;
    readonly phase: WavePhase;
    /** Enemies this wave still has to spawn. */
    readonly left: number;
    /** Seconds until the next wave starts (prepare, rebuild). */
    readonly countdown: number;
    /** Most alive at once in this wave. */
    readonly limit: number;
    /** Spawn one now? Assault, enemies left, the gap has passed and the board is under the limit. */
    ready(): boolean;
    /** One spawned: count it and wait the gap. */
    spawned(): void;
    reset: () => undefined;
};
/** Options for `drops()`: the pickup kinds, the cap, the timer for timed drops, their life and fall. */
export interface DropOptions<K extends string> {
    kinds: readonly K[];
    /** Most on the board at once (default 6). */
    cap?: number;
    /** Seconds between timed drops; 0 or left out: only `spawn()` drops. */
    every?: number;
    /** Where the next timed drop lands: write x, y into `out`. Return false to skip this one. */
    place?(out: Float64Array): boolean | void;
    /** Kind of the n-th timed drop, as an index into `kinds` (default: in turn). */
    pick?(n: number): number;
    /** Seconds a drop lasts (default 14), how far it falls (default 60 px) and how fast (default 90 px/s). */
    life?: number;
    fall?: number;
    speed?: number;
}
/** Pickups on engine `e` that fall, wait to be collected and expire, from typed arrays. Call
 *  `collect()` from a step. Events: `drop:spawn`, `drop:land`, `drop:collect`, `drop:expire`. */
export declare function drops<K extends string>(e: Engine, o: DropOptions<K>): {
    system: System;
    /** Positions and kinds of the drops on the board, for drawing: index 0 to `count` − 1. */
    x: Float64Array<ArrayBuffer>;
    y: Float64Array<ArrayBuffer>;
    kind: Uint8Array<ArrayBuffer>;
    /** Seconds since each drop spawned (fall shadow, blink: `life` − age is the time left). */
    age: Float64Array<ArrayBuffer>;
    /** Where each drop lands: (x[i], landY[i]). Moves with `scroll`. */
    landY: Float64Array<ArrayBuffer>;
    /** Seconds a drop lasts, as configured. */
    life: number;
    readonly count: number;
    /** Has drop i landed (only landed drops can be collected)? */
    landed: (i: number) => boolean;
    spawn: (px: number, py: number, k?: number) => boolean;
    /** The kind of the first landed drop within r of (px, py), removed; or null. */
    collect(px: number, py: number, r: number): K | null;
    /** The page scrolled: move every drop with it. */
    scroll(dx: number, dy: number): void;
    reset(): void;
};
/** Options for `score()`: the combo window and steps (or no combo) and the XP for each level. */
export interface ScoreOptions {
    /** A streak lasts `window` seconds after each hit (default 3); the multiplier is
     *  min(max, 1 + floor(streak / step)) (defaults 3 and 5). false: no combo. */
    combo?: {
        window?: number;
        step?: number;
        max?: number;
    } | false;
    /** XP to reach each level after level 0, rising (e.g. [8, 24, 50] gives levels 0 to 3). */
    levels?: readonly number[];
}
/** Points, a combo that decays and levels from XP thresholds, on engine `e`. Call `add()` and `miss()`
 *  from a step. Events: `score`, `combo:end`, `level`. */
export declare function score(e: Engine, o?: ScoreOptions): {
    system: System;
    readonly points: number;
    readonly streak: number;
    readonly xp: number;
    readonly level: number;
    /** The multiplier the next hit gets. */
    readonly combo: number;
    /** XP still needed for the next level, or -1 at the top. */
    readonly next: number;
    /** A hit: `points` × the combo, plus `xp`. Returns the points awarded. Event `score` (a: points, b: multiplier, at x, y). */
    add(points: number, xp?: number, px?: number, py?: number): number;
    /** A miss: the streak ends now. */
    miss(): void;
    reset(): void;
};
