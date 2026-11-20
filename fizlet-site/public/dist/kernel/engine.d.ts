import { EventRing } from "./ring.js";
import { Ledger } from "./ledger.js";
import { Pool } from "./pool.js";
import { type Random } from "./random.js";
/** Frame phases. Read geometry only in READ, never in STEP; write the DOM only in RENDER. */
export declare const IDLE = 0, READ = 1, STEP = 2, RENDER = 3;
/** A system: game logic or a harness. Every hook is optional; systems run in the order added. */
export interface System {
    /** Once per frame, before the steps: read cached geometry, sample input. */
    read?(e: Engine): void;
    /** Fixed step (dt = engine.dt): the simulation. No DOM reads or writes, no allocation. */
    step?(e: Engine, dt: number): void;
    /** Once per frame, after the steps: write the DOM (change-only), play sounds from the ring. */
    render?(e: Engine, alpha: number): void;
    /** When a running engine pauses (stop() or an auto-pause rule): drop held input, stop sounds. */
    pause?(e: Engine): void;
}
/** Options for `createEngine()`. Every field is optional. */
export interface EngineOptions {
    /** The element the engine lives in; it pauses while this is off screen. */
    root?: Element | null;
    /** Fixed step in seconds (default 1/60). */
    step?: number;
    /** Most steps per frame before dropping time instead of spiralling (default 4). */
    maxSteps?: number;
    /** Seed for `engine.random` (default 1). */
    seed?: number;
    /** Event ring capacity per frame (default 64). */
    events?: number;
    /** Aborting this destroys the engine (Recall included). */
    signal?: AbortSignal;
    /** A hook threw during a scheduled frame. The engine is already stopped (`start()` resumes it);
     *  other engines and the shared clock keep running. Default: `console.error(error)`. */
    onError?: (error: unknown, engine: Engine) => void;
    /** Settle (page interactions): after this many seconds in which no system called `busy()`, the
     *  engine sleeps (paused: "settled", no frames at all) until `wake()`, input or `start()`. Off by default.
     *  Counted in engine time (steps). Something scheduled for later (an intro delay, a beat, an
     *  autoplay timer) holds it awake with `busy(sec)`. */
    settle?: number;
    /** Frame-rate cap (e.g. 30 for an ambient hero): between frames the engine is off the shared clock
     *  and a timer brings it back, so it asks for ~fps requestAnimationFrame calls a second. */
    fps?: number;
    /** Auto-pause rules (all on by default; reducedMotion is opt-in: most games calm their effects). */
    pause?: {
        hidden?: boolean;
        offscreen?: boolean;
        editable?: boolean;
        reducedMotion?: boolean;
    };
}
/** What `engine.stats()` reports: frame and step counts, frame time, the event ring and pool
 *  fill, the ledger's size and the auto-pause rules holding the engine right now. */
export interface EngineStats {
    frames: number;
    steps: number;
    dropped: number;
    time: number;
    frameMs: {
        avg: number;
        max: number;
    };
    events: {
        size: number;
        cap: number;
        dropped: number;
    };
    pools: Record<string, {
        used: number;
        cap: number;
    }>;
    ledger: number;
    paused: string[];
}
/** The engine `createEngine()` returns: what every system and brick takes. */
export type Engine = ReturnType<typeof createEngine>;
/** Scheduler facts for tests and the debug HUD. */
export declare const scheduler: {
    readonly engines: number;
    readonly requests: number;
};
/** Make an engine: a fixed-step loop on the page's shared clock, with its own pools, event ring,
 *  seeded random and ledger. Add systems with `add()`, then `start()`; `destroy()` (or aborting
 *  `o.signal`) stops it and gives the page back. */
export declare function createEngine(o?: EngineOptions): {
    signal: AbortSignal;
    events: EventRing;
    ledger: Ledger;
    random: Random;
    root: Element | null;
    /**
     * The current (or last) frame, as a typed-array view (reading a slot never boxes a number):
     * `[0]` seconds this frame advances on the shared clock (0 after a pause or a settle), `[1]` ms
     * the last finished frame's hooks took (read, steps, render). Read-only by convention.
     */
    timing: Float64Array<ArrayBuffer>;
    /** Fixed step length in seconds. */
    dt: number;
    readonly time: number;
    /** Fixed steps run so far: an integer, so reading it in a hot path never boxes a number. */
    readonly steps: number;
    readonly phase: number;
    /** Pooled things in use right now, summed over every `engine.pool` (no allocation). */
    readonly live: number;
    readonly running: boolean;
    /** Why it's paused right now (empty when running). */
    readonly paused: string[];
    add<S extends System>(s: S): S;
    /** Safe from inside a hook: the rest of the frame still runs every other system. */
    remove(s: System): void;
    /** A named, bounded pool, listed in stats(). */
    pool<T>(name: string, cap: number, create: () => T): Pool<T>;
    /** Run (again). On a settled engine this is wake() too: the quiet time starts over, so it runs a
     *  full settle window instead of going back to sleep on its first frame. Inert once destroyed. */
    start(): void;
    /**
     * Something moved this frame: keeps a settling engine awake (no-op without `settle`). With
     * `sec`, something is scheduled that far ahead (an intro delay, a pause between beats): the
     * engine stays awake for `sec` of its own time (steps, so a slow frame can't outrun it), and
     * settle counts from then. A later, shorter hold never cuts a longer one; 0 or NaN is busy().
     */
    busy(sec?: number): void;
    /** Wake a settled engine (input does this for you); the quiet time starts again. */
    wake(): void;
    stop(): void;
    /** Called by the scheduler with the rAF timestamp. */
    frame(now: number): void;
    /** Run one frame's worth of time by hand (tests, headless, a server). A hook's error throws here.
     *  `sec` must be a finite number (0 or less runs a frame with no steps); anything else throws a
     *  RangeError before the frame starts, instead of stalling the clock for good (S6 P2-04). */
    advance(sec: number): void;
    stats(): EngineStats;
    /** Stop for good: every listener and observer goes (one signal), the page is restored.
     *  Idempotent; afterwards the engine is inert (start, add and advance do nothing). */
    destroy(): void;
};
