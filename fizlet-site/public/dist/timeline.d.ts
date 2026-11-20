/**
 * @fzlt/core/timeline: scripted DOM choreography on the kernel clock. Keyframe tracks animate CSS
 * properties (transform, translate, scale, rotate, opacity, clip-path, filter, custom properties:
 * any value whose numbers change and whose words stay) or plain numbers, with easings, delays,
 * staggers, sequencing and overlap, labels, repeats and yoyo. Time moves in the fixed step (no
 * allocation, no DOM); writes happen in render through the ledger, change-only, so Recall restores
 * every property touched. Done or paused, it asks for no frames: the engine settles. With reduced
 * motion, play() lands on the end state in one step (or build a gentler variant on `tl.reduced`).
 */
import type { Engine } from "./kernel/engine.js";
/** An easing: progress 0..1 in, eased progress out (it may overshoot). */
export type Ease = (p: number) => number;
/** The named easings: cubic in, out and in-out; back overshoots a little and settles. Also by name:
 *  "steps(n)" (n equal jumps: a ticking counter, a typed-out line). */
export declare const EASES: Record<string, Ease>;
/** A number, a CSS value ("translate(0px,8px)", "inset(0 50% 0 0)") or keyframes, evenly spaced.
 *  Keyframes share one shape: the same words, only the numbers change. A single value starts where
 *  the property's last track ended (or is set at once if it has none). */
export type Value = number | string | readonly (number | string)[];
/** Options for one track: where it starts (`at`), its duration, delay, easing and stagger. */
export interface TrackOptions {
    /** Seconds (default 0.4). */
    dur?: number;
    /** Seconds after `at`; negative overlaps the track before (default 0). */
    delay?: number;
    /** A name in EASES, "steps(n)" or a function (default "out"). */
    ease?: string | Ease;
    /** Seconds between one target's start and the next. */
    stagger?: number;
    /** Where it starts: seconds, "<" (with the track before) or a label (default: the end so far). */
    at?: number | string;
}
/** Options for `timeline()`: repeats, yoyo, speed and reduced-motion handling. */
export interface TimelineOptions {
    /** Extra plays after the first (default 0; Infinity loops). */
    repeat?: number;
    /** Every other play runs backwards. */
    yoyo?: boolean;
    /** Speed (default 1). */
    rate?: number;
    /** Animate (default: yes, unless the visitor prefers reduced motion; then play() jumps). */
    motion?: boolean;
    /** `a` on this timeline's events (default 0). */
    id?: number;
}
/**
 * A timeline on `engine` (paused until `play()`). Events on the ring, `a` = id: "timeline:start",
 * "timeline:end", and each label's own name (b = its index) as the playhead passes it.
 */
export declare function timeline(engine: Engine, o?: TimelineOptions): {
    /** Add tracks: each property of `values` on each target (an element, a list of them, or any
     *  object or typed array for plain numbers: `tl.to(arr, { 0: [0, 1] })`). Chainable. */
    to(targets: object | ArrayLike<object>, values: Record<string, Value>, t?: TrackOptions): /*elided*/ any;
    /** Name a moment (default: the end so far) for `at`; its name goes on the ring as it passes. */
    label(name: string, t?: number | string): /*elided*/ any;
    /** Play forward (from the start if it is at the end). */
    play: () => /*elided*/ any;
    /** Play backward (from the end if it is at the start). */
    reverse: () => /*elided*/ any;
    /** Stop where it is. The engine calls this as its System pause hook (off screen, hidden tab,
     *  stop()): then it only suspends, and plays on when the engine resumes unless you paused it. */
    pause(by?: unknown): /*elided*/ any;
    /** Move the playhead to `t` seconds; it keeps playing or stays paused. */
    seek(t: number): /*elided*/ any;
    /** Land on the end in the next step ("timeline:end" fires). */
    finish: () => /*elided*/ any;
    /** Pause and give every property back as it was before the timeline wrote it: styles through
     *  the ledger (a newer host edit wins), plain numbers to their value when the track was added. */
    revert(): /*elided*/ any;
    /** Resolves the next time the timeline ends, or when its engine is destroyed (at once if it was). */
    done: () => Promise<void>;
    /** The playhead in seconds (over every play). */
    readonly time: number;
    /** Every play together, in seconds (Infinity when it loops forever). */
    readonly duration: number;
    readonly playing: boolean;
    /** The visitor prefers reduced motion (or `motion: false`): build the gentler variant on it. */
    readonly reduced: boolean;
    step(e: Engine, dt: number): void;
    render(): void;
};
/** The timeline `timeline()` returns: add tracks with `to()`, then play it. */
export type Timeline = ReturnType<typeof timeline>;
