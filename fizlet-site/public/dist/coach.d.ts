/**
 * @fzlt/core/coach: the hints and tutorial layer the board games share, in three small parts:
 * - `flag`: a once-only switch kept in localStorage ("tips off", "seen the tour"). Every read and
 *   write is wrapped in try/catch, so a page with storage blocked (private mode, sandboxed iframe,
 *   quota) just reads "not set" and plays on;
 * - `tour`: DOM-free tutorial steps. It counts time on the current step, moves on when the game says
 *   the step is done (`coach:step` on the event ring), then cycles tips every `every` seconds.
 *   `show()` says which card to draw only when it changed, so the DOM is written once per card;
 * - `card`: the Board UI kit card that shows it (count, title, text, an End button) and rings the
 *   control it is about. Its look is DOM Battlefield's coach card, inline on the kit tokens.
 * Defaults are DOM Battlefield Blitz's practice coach (10 steps, then a tip every 6 s), so a port
 * keeps its pace. `tour` steps without allocating; call it from a step like the rest of the game.
 */
import type { Engine } from "./kernel/engine.js";
/** A localStorage switch: `on` when `key` holds `value` (default "1"). Never throws. */
export declare function flag(key: string, value?: string): {
    readonly on: boolean;
    /** Set it (the player turned tips off, finished the tour…). */
    mark(): void;
    clear(): void;
};
/** Options for `tour()`: how many tutorial steps, then how many tips and how often. */
export interface TourOptions {
    /** Tutorial steps (default 10). */
    steps?: number;
    /** Tips shown in turn after the last step (default 7), one every `every` seconds (default 6). */
    tips?: number;
    every?: number;
}
/** DOM-free tutorial steps on engine `e`: it counts time on the current step, moves on when the game
 *  says the step is done (`coach:step` on the event ring), then cycles tips every `every` seconds. */
export declare function tour(e: Engine, o?: TourOptions): {
    /** Seconds on this step (after the last: since it ended). A typed array: read time[0]. */
    time: Float64Array<ArrayBuffer>;
    /** The step the player is on; `steps` once the tutorial is over. */
    readonly step: number;
    readonly done: boolean;
    steps: number;
    /** Count dt on this step. Call once a step, before you test whether it is done. */
    tick(dt: number): void;
    /** The current step is done: on to the next (time back to 0, `coach:step` on the ring). False after the last. */
    pass(): boolean;
    /** The card to draw, only when it changed since the last call: a step (0…steps − 1), a tip
     *  (steps + 0…tips − 1), or -1 for no change. */
    show(): number;
    /** Back to step 0 (a new practice run). */
    reset(): void;
};
/** The tutorial `tour()` returns. */
export type Tour = ReturnType<typeof tour>;
/** Options for `card()`: the End button's label and action, and an abort signal. */
export interface CardOptions {
    /** The End button's label (default "END PRACTICE") and what it does (hidden if none). */
    end?: string;
    onEnd?(): void;
    signal?: AbortSignal;
}
/** The coach card, added to `host` (hidden until `show`). */
export declare function card(host: HTMLElement, o?: CardOptions): {
    el: HTMLDivElement;
    /** Show a card (writes only what changed); `target` gets the dashed ring. */
    show(c: string, t: string, body: string, target?: HTMLElement | null): void;
    hide(): void;
    remove(): void;
};
