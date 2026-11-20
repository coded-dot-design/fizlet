/**
 * @fzlt/core/board-page: the host page as the board. Its text glyphs become terrain and food, its
 * buttons become targets. Geometry is measured only in the read phase, on a budget (Range reads
 * capped per refresh; 12.5 Hz while the page moves, 2 Hz once it is still), kept in typed arrays
 * and indexed with a collide Grid, so `near` / `hit` in a step never read layout or allocate.
 * `consume` writes a literal 0/1 into the page's own Text node through the ledger (no wrappers,
 * no clones); from a step it is queued and written in render. Recall gives every glyph back, and
 * a newer edit by the host page wins. Coordinates are viewport CSS px (getBoundingClientRect).
 * Glyph indices hold for a frame: a rescan (read phase, after the page changed) renumbers them.
 * Targets only (`text: false`) with `still: Infinity`: a scene that reads page elements (headings,
 * buttons) re-measures only when the page moves or changes, so its still frames read nothing.
 */
import { type Engine, type System } from "./kernel/engine.js";
/** Options for `boardPage()`: which part of the page is the board, which elements are text and
 *  targets, and the measuring budget. */
export interface BoardPageOptions {
    /** The part of the page that is the board (default document.body). The board lives in its document
     *  and window (an iframe's page works too). */
    root?: Element;
    /** Text containers (default headings, p, li, blockquote, [data-fizlet-text]); 160 at most. false: no glyphs, targets only. */
    text?: string | false;
    /** Targets (default button, [role=button], a.button, a.btn, [data-fizlet-target]). */
    targets?: string;
    /** More to leave alone, on top of fields, editable, code, live regions, dialogs, [data-fizlet-ignore]. */
    exclude?: string;
    /** Glyphs indexed at most (default 8000). */
    maxGlyphs?: number;
    /** Targets at most (default 32). */
    maxTargets?: number;
    /** Letters only (default false: letters and digits are glyphs). */
    letters?: boolean;
    /** Range reads per refresh at most (default 900); the rest are measured on the next refresh. */
    reads?: number;
    /** Seconds between re-measures while the page is still (default 0.5; Infinity: only after a scroll, resize or change). */
    still?: number;
    /** Hex colour for consumed glyphs (a CSS Custom Highlight, where supported). Off by default. */
    color?: string;
}
/** One target on the board (a button or link): its element and its viewport rect, measured in read. */
export interface BoardTarget {
    readonly el: Element;
    /** Viewport rect, measured in read; w = h = 0 while hidden or off screen. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** The game's to use: starts at 100 and survives a rescan. */
    hp: number;
}
/** The host page as the board for engine `e`: its glyphs become terrain and food, its buttons
 *  targets. Measured only in the read phase, on a budget; `near()` and `hit()` in a step never read
 *  layout or allocate. `consume()` changes a glyph through the ledger. */
export declare function boardPage(e: Engine, o?: BoardPageOptions): {
    glyphs: {
        /** Glyphs indexed, spent ones included (w = 0 while not on screen). */
        readonly count: number;
        x: Float32Array<ArrayBuffer>;
        y: Float32Array<ArrayBuffer>;
        w: Float32Array<ArrayBuffer>;
        h: Float32Array<ArrayBuffer>;
        /** 1 once consumed. */
        spent: Uint8Array<ArrayBuffer>;
    };
    /** Page targets (rects measured in read). */
    targets: readonly BoardTarget[];
    /** Unspent on-screen glyphs touching the circle, into `out`. Returns how many. */
    near(px: number, py: number, pr: number, out: Int32Array): number;
    /** `near` for hot paths: the circle is p[i], p[i + 1] (centre) and p[i + 2] (radius), so no
     *  number is passed (a number passed to a call V8 doesn't inline boxes: one allocation). */
    nearAt: (p: Float64Array, i: number, out: Int32Array) => number;
    /** First unspent glyph the segment touches (2 px pad), or -1; how far along it (0..1) is `t`. */
    hit(x0: number, y0: number, x1: number, y1: number): number;
    /** `hit` for hot paths: the segment is p[i .. i + 3] (x0, y0, x1, y1); how far along it the
     *  glyph is goes in p[i + 4] (and `t`). No number is passed, so nothing boxes. */
    hitAt(p: Float64Array, i: number): number;
    readonly t: number;
    /** Rescans so far: glyph indices from before a rescan mean nothing after it. */
    readonly scans: number;
    /** Range reads made by the last refresh (never more than `reads`). */
    readonly reads: number;
    /**
     * Consume glyph i: a 0/1 ("binary": the board's random draw; "0" / "1": the game's) or a no-break
     * space ("erase") in the page's own text, through the ledger; from a step it is written in
     * render. False if spent or not ours anymore.
     */
    consume(i: number, as?: "binary" | "erase" | "0" | "1"): boolean;
    /** Glyph i as it was before the game changed it (the letter a bite ate). Not for a step: a string. */
    char: (i: number) => string;
    /** The element that holds glyph i's text (for a game's own read-phase checks, e.g. what covers it). */
    parent: (i: number) => HTMLElement | null;
    /** Rescan and re-measure now; from a step, at the next read. */
    refresh(): void;
    system: System;
};
/** The board `boardPage()` returns. */
export type BoardPage = ReturnType<typeof boardPage>;
