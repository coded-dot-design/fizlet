/**
 * @fzlt/core/hud: change-only HUD bindings that never allocate in the steady state. A binding reads a
 * number (or a flag) every render, compares it as a number after rounding to what the readout
 * shows, and formats and writes only when that changed. Feeds and banners react to the event ring
 * (`engine.events`), never to polling. Every write goes through `engine.ledger`, so `destroy()`
 * gives the page back. Render phase only: no layout reads, nothing in the step. No visuals of its
 * own: it binds to the game's markup (Board UI or anything else).
 */
import type { Engine, System } from "./kernel/engine.js";
/** How a number shows: `int` 12 · `clock` 3:05 (seconds) · `rank` #2 · `pct` 75% (0..1 in), or your own. */
export type Fmt = "int" | "clock" | "rank" | "pct" | ((v: number) => string);
type Target = HTMLElement | string;
/**
 * Where a number comes from: a getter, or a slot in a typed array (`[state, 3]`). A getter V8
 * doesn't inline boxes a fractional double on every call (16 bytes); a slot never does, so it is
 * the safe choice for running fractions (clock, hp, heat). Whole numbers and booleans never box.
 */
export type Src = (() => number) | readonly [ArrayLike<number>, number];
/** Change-only HUD bindings on `engine`, finding readouts in `root` (default `document`): `num`,
 *  `meter`, `flag`, `feed` and `banner`. Values are read every render and written only when what
 *  shows changes; every write goes through the ledger. */
export declare function hud(engine: Engine, root?: ParentNode): {
    /** A number readout: written only when its shown value changes. */
    num: (t: Target, get: Src, fmt?: Fmt) => /*elided*/ any;
    /** A bar: `width` in whole percent (0..1 in), `aria-valuenow` on a progressbar, class `low` at or under `low`. */
    meter: (t: Target, get: Src, low?: number) => /*elided*/ any;
    /** A class that follows a condition. */
    flag: (t: Target, cls: string, get: () => boolean) => /*elided*/ any;
    /** A list of the last `rows` events of a type, newest first (`play` runs on the newest row). */
    feed: (list: Target, rows: number, on: string, line: (a: number, b: number) => string, play?: (row: HTMLElement) => void) => /*elided*/ any;
    /** Title and sub from an event; `play` (re)starts the game's own animation. */
    banner: (t: Target, on: string, text: (a: number, b: number) => readonly [string, string?], play?: (el: HTMLElement) => void) => /*elided*/ any;
    /** The render system (already added to the engine; `engine.remove(system)` unbinds everything). */
    system: System;
};
/** The HUD `hud()` returns. */
export type Hud = ReturnType<typeof hud>;
export {};
