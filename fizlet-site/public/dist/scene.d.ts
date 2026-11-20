/**
 * @fzlt/core/scene: an animation recipe as data. A scene is JSON: a **stage** (a fixed pixel grid
 * fitted to the box, a background, a starfield, shake, the clock), a **cast** (sprites, rects,
 * text and lines, drawn in order, each value a number, a track or a blink on the scene clock), the
 * **cues** (one-shot fx moments: a pop word, a kick, a burst) and the **gags** (a running bit: an
 * fx emitter held open over a window, following a track). One player runs them all, so a gallery
 * entry ships its data, not its own code.
 *
 * Bricks: the kernel (fps cap, settle), @fzlt/core/fx (particles, words, shake), @fzlt/core/sprite (pixel
 * art, baked once), @fzlt/core/timeline's easings, and @fzlt/core/slot (`scene(data)` is a slot mount).
 * The contract: time moves in the step on numbers only (no DOM, no allocation); one canvas, added
 * through the ledger, so `destroy()` gives the page back exactly; after `end` seconds it rests on
 * the last frame and the engine settles (`busy(sec)` holds it awake until then); a tap plays it
 * again. With reduced motion it draws the poster frame (no cues, no gags) and settles.
 */
import { type Engine, type System } from "./kernel/index.js";
import { KINDS, type Kind } from "./fx.js";
import type { SlotMount, SlotScene } from "./slot.js";
/**
 * A value on the scene clock `t` (seconds):
 * - a number or a string (a colour): constant;
 * - a track `[from, to, at, dur, ease?]`: `from` until `at`, then eased to `to` over `dur` seconds
 *   (an EASES name, default "linear"); `dur` 0 jumps once `t` is past `at`, and works on strings;
 * - a blink `{ blink: [a, b], hz, on?: [from, to], then? }`: `a` before `from`; inside the window
 *   `b` on odd ticks of `hz` per second, `a` on even ones; `then` (default `a`) from `to` on.
 */
export type Val = number | string | readonly [number | string, number | string, number, number, string?] | Blink;
/** A blink: `blink[0]` outside its window, `blink[1]` on odd ticks of `hz` inside it, `then` after it (see Val). */
export interface Blink {
    blink: readonly [number | string, number | string];
    hz: number;
    on?: readonly [number, number?];
    then?: number | string;
}
/** Shown while `from <= t < to` (`to` left out: from then on). */
type On = {
    on?: readonly [number, number?];
};
/** A sprite from `art`: centre at (x, y), turned by `rot` radians, `scale` px per art pixel, a palette index. */
export type SpriteItem = On & {
    sprite: string;
    x: Val;
    y: Val;
    rot?: Val;
    scale?: Val;
    pal?: Val;
};
/** A filled rectangle `[x, y, w, h]`. */
export type RectItem = On & {
    rect: readonly [Val, Val, Val, Val];
    fill: Val;
};
/** One line of text; with `stroke` it gets an outline `lw` wide first. */
export type TextItem = On & {
    text: string;
    x: Val;
    y: Val;
    font: string;
    fill: Val;
    align?: CanvasTextAlign;
    stroke?: Val;
    lw?: Val;
};
/** A line `[x0, y0, x1, y1]`. */
export type LineItem = On & {
    line: readonly [Val, Val, Val, Val];
    stroke: Val;
    lw: Val;
    cap?: CanvasLineCap;
};
/** One thing in the cast: a sprite, a rect, a line of text or a line, drawn in order. */
export type Item = SpriteItem | RectItem | TextItem | LineItem;
/**
 * A cue, once, when `t` passes its time (in order; several may share a time):
 * `[t, "word", word, x, y, colour, size]`, `[t, "kick", amount]` or
 * `[t, "emit", kind, x, y, n, colour, colours, scale]` (@fzlt/core/fx's word, kick and emit).
 */
export type Cue = readonly [number, "word" | "kick" | "emit", ...(number | string)[]];
/** A gag: every step while `from < t < to`, emit `n` of `kind` at (x + dx, y + dy); x and y may be tracks. */
export interface Gag {
    emit: string;
    on: readonly [number, number];
    x: Val;
    y: Val;
    dx?: number;
    dy?: number;
    n: number;
    c?: number;
    cn?: number;
    scale?: number;
}
/** A scene as JSON: the stage, the art, the cast, the cues and the gags (format version 1). */
export interface SceneData {
    /** Format version: 1. */
    v: 1;
    stage: {
        /** The grid in scene pixels, fitted to the box and centred. */
        w: number;
        h: number;
        /** Frame-rate cap (default 30). */
        fps?: number;
        /** Background colour (painted past the grid too). */
        bg: string;
        /** Seconds it plays before it rests on the last frame. */
        end: number;
        /** Seconds after `end` before it plays again while visible; 0 (default): once, then it sleeps. */
        loop?: number;
        /** Seconds held still before the clock starts (an intro delay; default 0). */
        delay?: number;
        /** Starfield: `[count, colour, share of the height]`, seeded from the engine. */
        stars?: readonly [number, string, number];
        /** fx shake to scene pixels (default 0: none). */
        shake?: number;
        /** The reduced-motion poster: the time drawn (default `end`). */
        poster?: number;
    };
    /** @fzlt/core/fx options, and its particle kinds by name (a Kind, or a name in fx's KINDS). */
    fx?: {
        cap?: number;
        gravity?: number;
        scorch?: number;
        colors?: string[];
        words?: string[];
        kinds?: Record<string, Kind | keyof typeof KINDS>;
    };
    /** Pixel art by name: rows of characters (@fzlt/core/sprite), coloured by `ink` and `palettes`. */
    art?: Record<string, string[]>;
    ink?: Record<string, string>;
    palettes?: Record<string, string>[];
    /** Drawn in order, under the effects; shaken with them. */
    cast?: Item[];
    /** Drawn last, above the effects, never shaken (captions). */
    over?: Item[];
    cue?: Cue[];
    gag?: Gag[];
}
/** How a scene mounts: whether it animates. */
export interface SceneOptions {
    /** Animate (default: yes, unless the visitor prefers reduced motion; then the poster frame). */
    motion?: boolean;
}
/** The mounted scene: its engine, `play()` from the start, `destroy()` (Recall), and the system
 *  the engine runs (read, step, render). */
export type Scene = SlotScene & System & {
    engine: Engine;
    play(): void;
};
/** Mount scene `d` on `stage` (any positioned box). Returns its engine, `play()` and `destroy()`. */
export declare function mountScene(stage: HTMLElement, d: SceneData, o?: SceneOptions): Scene;
/** Scene data as a slot mount: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export declare const scene: (d: SceneData, o?: SceneOptions) => SlotMount;
export {};
