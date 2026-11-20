/** Options for `cssClock()`: the loop length, how many plays before it rests, the custom property,
 *  the frame cap, reduced motion and an abort signal. */
export interface CssClockOptions {
    /** Seconds in one play: the loop length (the longest animation, or a common multiple). Default 6. */
    span?: number;
    /** Plays before it rests and the engine settles (default 3). */
    loops?: number;
    /** The custom property the animations read (default "--fz-t"). */
    prop?: string;
    /** Frame-rate cap, e.g. 30 for steps() blinks (default: none, 60 Hz). */
    fps?: number;
    /** Animate (default: yes, unless the visitor prefers reduced motion). */
    motion?: boolean;
    /** Aborting it destroys the clock (Recall included). */
    signal?: AbortSignal;
}
/** Run the CSS @keyframes under `root` on the kernel clock: each paused animation reads its time from
 *  one custom property a timeline moves. It settles after `loops` plays and wakes on pointer, focus or
 *  coming back into view; `destroy()` gives the root's style back. */
export declare function cssClock(root: HTMLElement, o?: CssClockOptions): {
    engine: {
        signal: AbortSignal;
        events: import("./kernel/index.js").EventRing;
        ledger: import("./kernel/index.js").Ledger;
        random: import("./kernel/index.js").Random;
        root: Element | null;
        timing: Float64Array<ArrayBuffer>;
        dt: number;
        readonly time: number;
        readonly steps: number;
        readonly phase: number;
        readonly live: number;
        readonly running: boolean;
        readonly paused: string[];
        add<S extends import("./kernel/index.js").System>(s: S): S;
        remove(s: import("./kernel/index.js").System): void;
        pool<T>(name: string, cap: number, create: () => T): import("./kernel/index.js").Pool<T>;
        start(): void;
        busy(sec?: number): void;
        wake(): void;
        stop(): void;
        frame(now: number): void;
        advance(sec: number): void;
        stats(): import("./kernel/index.js").EngineStats;
        destroy(): void;
    };
    tl: {
        to(targets: object | ArrayLike<object>, values: Record<string, import("./timeline.js").Value>, t?: import("./timeline.js").TrackOptions): /*elided*/ any;
        label(name: string, t?: number | string): /*elided*/ any;
        play: () => /*elided*/ any;
        reverse: () => /*elided*/ any;
        pause(by?: unknown): /*elided*/ any;
        seek(t: number): /*elided*/ any;
        finish: () => /*elided*/ any;
        revert(): /*elided*/ any;
        done: () => Promise<void>;
        readonly time: number;
        readonly duration: number;
        readonly playing: boolean;
        readonly reduced: boolean;
        step(e: import("./kernel/index.js").Engine, dt: number): void;
        render(): void;
    };
    /** Play from the start (unless held). */
    play: () => void;
    /** Hold or release (a pause button): held, it keeps its frame and asks for nothing. */
    hold(on: boolean): void;
    /** Stop for good and give the page back (Recall). */
    destroy: () => void;
};
/** The clock `cssClock()` returns. */
export type CssClock = ReturnType<typeof cssClock>;
