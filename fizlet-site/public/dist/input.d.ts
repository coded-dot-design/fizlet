/**
 * @fzlt/core/input: one controller for keys, pointer and a touch stick, mapped to named intents.
 * Listeners only record; the engine's read phase latches edges and measures the target, so a step
 * sees a stable snapshot. Keys typed into the host page's fields (or inside [data-fizlet-ignore])
 * never count. Keys, the pointer, `press()` and `steer()` wake a settled engine. Held state is
 * dropped on window blur, when the engine pauses, on dispose() and on destroy: nothing stays stuck.
 *
 * `hit` (an intent or the pointer): a press is seen by exactly one fixed step, the first step after
 * it, even when that comes frames later (0-step frames while catching up) and never again in the
 * same frame's later steps. Outside a step (read, render), `hit` is true for the one frame whose
 * read latched it. Presses between two steps count once.
 */
import type { Engine, System } from "./kernel/engine.js";
/** Options for `controls()`: the intents and their keys, the pointer target and the touch stick. */
export interface ControlsOptions {
    /** intent → key codes, e.g. { fire: ["Space"], up: ["KeyW", "ArrowUp"] } (KeyboardEvent.code). */
    keys?: Record<string, string[]>;
    /** Where the pointer is measured and the stick lives (default: the engine root, else window). */
    target?: HTMLElement;
    /** Touch: a drag that starts on the left half (or anywhere: "any") drives a virtual stick. */
    stick?: "left" | "any" | false;
    /** Stick radius in CSS px (default 60). */
    radius?: number;
}
/** An intent by name, or by the number `id(name)` gave. */
export type Intent = string | number;
/** One controller for keys, pointer and a touch stick on engine `e`, mapped to named intents:
 *  `down(intent)`, `hit(intent)` (one step per press), `pointer` and `stick`. It registers its
 *  own read-phase system; `dispose()` removes it. */
export declare function controls(e: Engine, o?: ControlsOptions): {
    /** An intent's number, for a hot path: `const FIRE = c.id("fire")`, then `c.hit(FIRE)` in a step.
     *  A name that is not an intent throws here, at setup (a typo is never a silent `false`). */
    id(intent: string): number;
    /** Held right now (any of its keys, or press()). */
    down: (intent: Intent) => boolean;
    /** Pressed: true in the first step after the press; outside steps, for the frame it latched. */
    hit: (intent: Intent) => boolean;
    /** -1..1 from two intents (keys), plus the stick when it's active. */
    axis(neg: Intent, pos: Intent, stickAxis?: 0 | 1): number;
    pointer: {
        readonly x: number;
        readonly y: number;
        readonly down: boolean;
        readonly hit: boolean;
    };
    stick: {
        readonly x: number;
        readonly y: number;
        readonly active: boolean;
    };
    /** Press an intent from code (on-screen keys): `press("strike")`. */
    press(intent: string, down?: boolean): void;
    /** Drive the stick from code (an on-screen stick, @fzlt/core/pad): x, y in -1..1; `on = false` lets go. */
    steer(x: number, y: number, on?: boolean): void;
    dispose: () => void;
    system: System;
};
/** The controller `controls()` returns. */
export type Controls = ReturnType<typeof controls>;
/** Options for `gamepad()`: which buttons press which intents, the dead zone, which pad. */
export interface GamepadOptions {
    /** intent → standard-layout button indices, e.g. { fire: [0], jump: [1, 7] } (0 is A / cross). */
    map?: Record<string, number[]>;
    /** Dead zone, 0..1, for the left stick and analog buttons (default 0.15). */
    dead?: number;
    /** Read only the pad at this `navigator.getGamepads()` index (local multiplayer: a controller per
     *  seat); default: every pad, merged. */
    index?: number;
}
/** Gamepads into a `controls()` controller: mapped buttons `press` their intents (down from half
 *  a pull), the left stick `steer`s the controller's stick, both past the dead zone. It polls in
 *  the controller's read phase, before the edges latch, and only while a pad is connected: a page
 *  without one never calls `getGamepads()` per frame. Pads have no events for buttons, so a
 *  settled engine is not polled: a pad connecting wakes it, and a game that settles between rounds
 *  wakes it from its own start key. Zero allocation per read. `stop()` removes it (listeners,
 *  polling, held intents and the stick). */
export declare function gamepad(c: Controls, o?: GamepadOptions): {
    /** A pad is connected (the one at `index`, when given). */
    readonly connected: boolean;
    /** Pads connected (the one at `index` counts as at most 1). */
    readonly count: number;
    /** An intent's analog value, 0..1 past the dead zone (a trigger's pull), as of the last read. */
    value: (intent: string) => number;
    /** Stop reading pads: listeners off, polling off, its held intents and the stick let go. */
    stop(): void;
};
