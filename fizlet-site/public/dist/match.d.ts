/**
 * @fzlt/core/match: the match flow every game shares, intro → count → play → paused → end, on the
 * Board UI kit's overlay (grey dim, a sticker that slams, at most two sticker keys). One overlay is
 * built once; each phase only flips attributes, styles and text through the ledger, so destroy()
 * gives the page back exactly. Every transition is an event on the ring (`match:play`, …), so the
 * HUD, sound and coach layers react without knowing about this one. Pass `null` as the root to run
 * the phase machine headless (tests, a server).
 */
import { type Engine, type System } from "./kernel/engine.js";
/** Where a match is: the intro, the countdown, play, paused or the end. */
export type Phase = "intro" | "count" | "play" | "paused" | "end";
/** A sticker: kicker (small, blinking) and word (big). */
export type Sticker = [kicker: string, word: string];
/** The overlay's sticker keys, by what they do. */
export type MatchKey = "start" | "resume" | "surrender" | "again" | "next";
/** Every word on the match overlay: the stickers per phase, the countdown kicker and the key labels. */
export interface MatchLabels extends Record<MatchKey, string> {
    intro: Sticker;
    /** The kicker over the 3-2-1. */
    count: string;
    paused: Sticker;
    won: Sticker;
    lost: Sticker;
    /** Lost by surrender (the white flag). */
    flag: Sticker;
}
/** How a match ended: won or lost, why, and the clock. */
export interface MatchResult {
    won: boolean;
    /** "time" (the clock ran out), "flag" (surrender) or what the game passed to finish(). */
    why: string;
    /** The clock when it ended. */
    clock: number;
}
/** Options for `match()`: the countdown, the match length, labels and key icons, the pause keys. */
export interface MatchOptions {
    /** Countdown beats of one second before play (default 3; 0 skips it). */
    count?: number;
    /** Match length in seconds; 0 or left out = no time limit (the clock counts up). */
    seconds?: number;
    labels?: Partial<MatchLabels>;
    /** SVG markup per key (64 × 64), e.g. the game's skull on KEEP FIGHTING. */
    icons?: Partial<Record<MatchKey, string>>;
    /** Pause / resume keys (KeyboardEvent.code; default Escape and P). [] turns them off. */
    keys?: string[];
    /** A new round starts (start, rematch): reset the game. Runs in the click (user activation). */
    begin?(): void;
    /** The match ended. Return a sticker to replace the default words (e.g. ["INSERT COIN", "RED WINS"]). */
    end?(r: MatchResult): Sticker | void;
    /** The clock ran out: did the player win? (default: no) */
    timeUp?(): boolean;
    /** The kit's launch burst (`launch` from @fzlt/core/ui) for PRESS START and SURRENDER. */
    launch?(key: HTMLElement, action: () => void, o: {
        reduced?: boolean;
    }): void;
    /** Each phase change, once it is painted (in the call that made it, or in the render of the frame
     *  a step made it in): a host that owns more than the overlay (@fzlt/core/arcade's skirmish preset)
     *  follows the phase here. Not called for the first intro. */
    on?(phase: Phase): void;
    /** Phases that show no overlay (the phase machine and its events still run), e.g. ["paused"]. */
    hide?: Phase[];
}
/** The shared match flow on engine `e`, intro → count → play → paused → end, on the Board UI overlay
 *  in `root`. Every transition is an event on the ring (`match:play`, …). Drive it with `start()`,
 *  `pause()`, `finish()`, `restart()`; read `phase` and `clock`. */
export declare function match(e: Engine, root: HTMLElement | null, o?: MatchOptions): {
    readonly phase: Phase;
    /** Seconds left (timed match) or played so far (no limit). Counts only in play. */
    readonly clock: number;
    /** The overlay element (null headless): add your own content, style it by `[data-phase]`. */
    el: HTMLElement | null;
    /** PRESS START: from the intro (or the result), begin a round. */
    start(): void;
    /** Pause (true), resume (false) or toggle (no argument). Only during play. */
    pause(on?: boolean): void;
    /** End the match now (a win, a loss, "flag" for surrender). */
    finish(w: boolean, y?: string): void;
    /** A new round from any phase: begin(), the clock reset, then the countdown. */
    restart(): void;
    /** Back to the start screen (NEW GAME). */
    intro(): void;
    system: System;
};
/** The match flow `match()` returns. */
export type Match = ReturnType<typeof match>;
