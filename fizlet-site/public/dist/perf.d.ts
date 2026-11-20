/**
 * @fzlt/core/perf: a live performance overlay for players, off until they switch it on. Frames per
 * second, a rolling frame-time bar chart (one bar per frame, coloured against the budget),
 * dropped frames, the engine's work per frame (read, steps, render), live pooled entities and,
 * where the browser exposes it, the JS heap. It reads the engine's own frames on the shared clock
 * (`engine.timing`, `engine.live`): no clock or requestAnimationFrame of its own, and it never
 * calls `engine.busy()`, so a settling engine still settles and the chart rests with it.
 *
 * Its own cost stays out of what it measures: frame times go into a typed-array ring (nothing is
 * allocated per frame), the numbers are written twice a second through the ledger (change-only,
 * strings cached), the chart is one canvas, and the root is `contain: layout paint style` and
 * `pointer-events: none`. Hidden, it only records (a few typed-array writes a frame).
 * Not the dev-only `@fzlt/core/debug`, which patches Element prototypes: this one ships to players.
 */
import type { Engine } from "./kernel/engine.js";
/** A corner of the host: top left, top right, bottom left or bottom right. */
export type Corner = "tl" | "tr" | "bl" | "br";
/** Options for `perf()`: where the overlay goes, the toggle key and the frame budget. */
export interface PerfOptions {
    /** Where the overlay goes (default the engine root, else `document.body`, where it is fixed). */
    host?: HTMLElement | null;
    /** Corner of the host (default "tr"). */
    corner?: Corner;
    /** `KeyboardEvent.code` that toggles it (default "F9"); null for none. */
    key?: string | null;
    /** Shown from the start (default false: players switch it on in Settings). */
    on?: boolean;
    /** The frame budget in ms (default 1000 / 60): a frame over 1.5 budgets counts as dropped. */
    budget?: number;
    /** Called when it is shown or hidden (the key or `show()`): keep a Settings switch in step. */
    change?: (on: boolean) => void;
}
/** Bars in the chart: one per frame, 2 s at 60 fps. */
export declare const BARS = 120;
/** How often the numbers update (ms of frame time). */
export declare const WINDOW = 500;
/** The last `cap` frame times (ms) in a typed array: `push` never allocates. */
export declare class FrameRing {
    readonly cap: number;
    readonly ms: Float32Array;
    /** The next slot written. */
    head: number;
    size: number;
    constructor(cap: number);
    push(ms: number): void;
    /** Slot of the k-th oldest frame held. */
    slot(k: number): number;
}
/** Frames per second from a frame count and the ms they took (the readout inlines the same sum). */
export declare const fps: (frames: number, ms: number) => number;
/** Frames a long frame swallowed: 0 under 1.5 budgets, else the extra budgets it took (rounded). */
export declare const missed: (ms: number, budget: number) => number;
/** A performance overlay for `engine`, off until shown (F9 by default): fps, a frame-time chart
 *  against the budget, dropped frames, the engine's work per frame, pooled entities and the JS heap.
 *  `show()` toggles it; `destroy()` removes it. */
export declare function perf(engine: Engine, o?: PerfOptions): {
    el: HTMLElement;
    ring: FrameRing;
    /** Show (true), hide (false) or flip (no argument). */
    show: (next?: boolean) => void;
    readonly on: boolean;
    /** Frames recorded (0-length frames after a pause are not frames). */
    readonly frames: number;
    /** Dropped frames so far. */
    readonly dropped: number;
    /** Remove the overlay, its key and its system; the engine keeps running. */
    destroy: () => void;
};
