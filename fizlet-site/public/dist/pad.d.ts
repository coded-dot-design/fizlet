/**
 * @fzlt/core/pad: swappable on-screen controls for touch (and mouse). One move control (an analog
 * stick, a d-pad or move keys) under one thumb and round arcade action keys under the other, all
 * driving `controls` intents through `press()` / `steer()`: game code reads `down`, `hit` and
 * `axis` and never knows which scheme is on screen. Swap with `setScheme()` at any time.
 *
 * Visuals are the Board UI kit's (`.bui-pad`, `.bui-stick`, `.bui-dpad`, `.bui-arcade` + roles):
 * mount the pad inside a `.bui` root. Listeners are delegated on the pad's one element (bound to
 * the engine's signal), so a scheme swap adds none; the element goes through the ledger.
 */
import type { Engine } from "./kernel/engine.js";
import type { Controls } from "./input.js";
/** The move control on screen: an analog stick, a one-finger d-pad, or a key per move intent. */
export type Scheme = "stick" | "dpad" | "buttons";
/** A Board UI kit key role: it sets an action key's colour. */
export type PadRole = "fire" | "aim" | "attack" | "advance" | "fallin" | "sys" | "cmd" | "go" | "flag";
/** One round action key: the intent it drives, its caption and accessible name, its role colour. */
export interface PadAction {
    /** The `controls` intent this key drives. */
    intent: string;
    /** Short caption on the key (e.g. "FIRE"); empty for icon-only. */
    label: string;
    /** Accessible name (default: label), e.g. "Hold to fire the cannon (Space)". */
    name?: string;
    /** Inline SVG markup (trusted game code). */
    icon?: string;
    /** Shortcut chip for fine pointers, e.g. "SPACE". */
    key?: string;
    /** Kit role colour (default: "fire" for the first action, "sys" for the rest). */
    role?: PadRole;
    /** Held while the finger is down (default: a tap = one press, one `hit`). */
    hold?: boolean;
    /** Each tap flips the intent: `down(intent)` is the switch; `press(intent, on)` from code flips the key too. */
    toggle?: boolean;
}
/** Options for `pad()`: the move scheme, the action keys, which thumb gets them and where the pad goes. */
export interface PadOptions {
    /** "stick" (analog, drives the stick axes), "dpad" (one finger, 8-way) or "buttons" (a key per move intent). */
    scheme?: Scheme;
    /** Action keys; the first is the big primary key. */
    actions?: PadAction[];
    /** Which thumb gets the action keys (default "right"); the move control takes the other. */
    side?: "left" | "right";
    /** Where the pad goes (default: the engine root). Must be inside a `.bui` root for the kit look. */
    host?: HTMLElement;
    /** Move intents [up, down, left, right] for the d-pad and move keys; "" leaves one out. */
    move?: string[];
}
/** Stick vector from a drag offset in radii: clamped to the unit circle, dead zone rescaled so a
 *  light push still creeps (Battlefield's feel). Writes out[0], out[1]; never allocates
 *  (the exact `hypot` from @fzlt/core/steer: `Math.hypot` boxes its arguments, K5). */
export declare function stickAt(dx: number, dy: number, out: Float64Array): void;
/** D-pad direction mask (up 1, down 2, left 4, right 8; diagonals combine) from a drag offset in radii. */
export declare function dpadAt(dx: number, dy: number): number;
/** On-screen controls for touch (and mouse) that drive the intents of `c` (a `controls()` controller):
 *  a move control and action keys, in the Board UI kit's look. Swap the move control with
 *  `setScheme()`; `destroy()` (or the engine's) removes the pad. */
export declare function pad(e: Engine, c: Controls, o?: PadOptions): {
    /** The pad's root element (`.bui-pad`). */
    el: HTMLDivElement;
    readonly scheme: Scheme;
    setScheme: (s: Scheme) => void;
    /** Let go of every finger, remove the listeners and the pad (engine.destroy() does this too). */
    destroy(): void;
};
/** The pad `pad()` returns. */
export type Pad = ReturnType<typeof pad>;
