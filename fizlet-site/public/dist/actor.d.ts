/**
 * @fzlt/core/actor: units, bots, turrets and shots as data. One fixed-capacity table of typed arrays,
 * one row per actor: alive, side, kind, tag bits, health (`hp` of `max`) and a body (`x`, `y`,
 * heading `a`, velocity `vx`, `vy`, radius `r`). Nothing allocates after `actors()`: spawn takes a
 * free row, kill marks it dead, and `sweep()` (once per step, after your loops) gives dead rows
 * back. A game's own fields are its own typed arrays of length `cap`, indexed by row (cooldowns,
 * orders, timers). Iterate the dense list, which keeps spawn order, so a seeded run replays:
 *
 *   for (let k = 0; k < A.n; k++) { const i = A.list[k]!; if (!A.alive[i]) continue; ... }
 *
 * A row is reused once swept, so hold on to an actor across steps by its handle (`ref(i)`), not
 * its row: `get(handle)` is -1 once that actor is gone, even if its row lives again. Share the body
 * with @fzlt/core/steer by passing its arrays (`actors({ cap, x: m.x, y: m.y, a: m.a })`). With
 * `events` (engine.events) it rings `actor:spawn`, `actor:hurt` and `actor:kill` (a: row, b: side,
 * x, y: where, in whole pixels, v: damage, or health on spawn) for sound, effects and the HUD. Whole
 * pixels because small integers never box: a double passed to the ring can cost a heap number.
 */
import type { EventRing } from "./kernel/ring.js";
/** Options for `actors()`: capacity, sides, optional shared body arrays and the event ring. */
export interface ActorOptions {
    /** Rows (fixed: the arrays never grow; spawn returns -1 when full). */
    cap: number;
    /** Sides counted by `count(side)` (default 8, at most 32: `nearest` takes them as bits). */
    sides?: number;
    /** Bring your own body arrays (length ≥ cap), e.g. a steer's, so both move the same numbers. */
    x?: Float64Array;
    y?: Float64Array;
    a?: Float64Array;
    /** engine.events: actor:spawn, actor:hurt, actor:kill. */
    events?: EventRing;
}
/** A fixed-capacity actor table: typed-array rows with spawn, kill, hurt, heal, sweep, handles, side counts, tags and nearest. */
export declare function actors(o: ActorOptions): {
    cap: number;
    x: Float64Array<ArrayBufferLike>;
    y: Float64Array<ArrayBufferLike>;
    a: Float64Array<ArrayBufferLike>;
    vx: Float64Array<ArrayBuffer>;
    vy: Float64Array<ArrayBuffer>;
    r: Float64Array<ArrayBuffer>;
    hp: Float64Array<ArrayBuffer>;
    max: Float64Array<ArrayBuffer>;
    alive: Uint8Array<ArrayBuffer>;
    side: Uint8Array<ArrayBuffer>;
    kind: Uint8Array<ArrayBuffer>;
    tags: Uint32Array<ArrayBuffer>;
    gen: Uint32Array<ArrayBuffer>;
    /** The dense list: rows list[0..n), in spawn order (dead ones stay until `sweep()`). */
    list: Int32Array<ArrayBuffer>;
    readonly n: number;
    /** Actors alive right now. */
    readonly live: number;
    /** A new actor on `side` with `health` (its max too); its body is zeroed. -1 when full. */
    spawn(s: number, health: number, k?: number, t?: number): number;
    /** Dead now (alive = 0, out of `count`); its row comes back at `sweep()`. False if already dead. */
    kill: (i: number) => boolean;
    /** Take `damage`; true when that killed it. */
    hurt(i: number, damage: number): boolean;
    /** Back up by `amount`, never over max. */
    heal(i: number, amount: number): void;
    /** Give dead rows back (keeps the list's order). Once per step, after the loops that kill. */
    sweep(): void;
    /** Live actors on side s. */
    count(s: number): number;
    /** A handle that outlives the row: `get(ref(i))` is i while that actor lives, -1 after. */
    ref(i: number): number;
    get(h: number): number;
    /** Every bit of `bits` set? / set or clear them. */
    has(i: number, bits: number): boolean;
    tag(i: number, bits: number, on?: boolean): void;
    /** The nearest live actor to i (not i) within `range`, on a side in the `sides` bits (1 << side)
     *  and carrying every `need` tag bit; -1 if none. Ties go to the earlier spawn. */
    nearest(i: number, range?: number, sides?: number, need?: number): number;
    /** Everything dead and every row free (a new match). Handles from before stay stale. */
    clear: () => void;
};
/** The table `actors()` returns. */
export type Actors = ReturnType<typeof actors>;
