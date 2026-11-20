/**
 * @fzlt/core/view-canvas: one overlay canvas per root, sized for the screen's pixel density and redrawn
 * only where something changed. The canvas covers the root's padding box (`pointer-events: none`,
 * so the root keeps its input), its backing store is the CSS size × devicePixelRatio (capped by
 * `maxDpr`), and drawing is in CSS px.
 * - Dirty redraw: `dirty([x, y, w, h])` grows one box (no arguments: the whole canvas); in the render
 *   phase that box, snapped out to whole device pixels, is cleared, clipped and handed to `draw`.
 *   Nothing dirty, nothing drawn: a still view costs no canvas work at all.
 * - Settle: it never keeps the engine awake; `dirty()` wakes a settled engine for one redraw.
 * - Layout reads only in the read phase, and only after a resize or a zoom (a ResizeObserver).
 * - Recall: the canvas goes and the root's style comes back exactly (the engine's ledger).
 * It has no motion of its own: reduced motion belongs to whatever moves the drawing.
 */
import type { Engine } from "./kernel/engine.js";
/** Options for `viewCanvas`: the `draw` callback, the density cap and an accessible name. */
export interface ViewCanvasOptions {
    /** Paint. The canvas is already cleared and clipped to `box` ([x, y, w, h], CSS px): draw the
     *  scene (anything outside the box is clipped away, so drawing it all is fine). */
    draw(ctx: CanvasRenderingContext2D, box: Float64Array): void;
    /** The most pixel density drawn (default 2: sharp on a phone, a quarter of the pixels at 4×). */
    maxDpr?: number;
    /** An accessible name: the canvas becomes role="img" (default: aria-hidden, decoration). */
    label?: string;
}
/** One overlay canvas on `root`, sized for the pixel density (capped by `maxDpr`) and redrawn only
 *  inside the dirty box: `dirty([x, y, w, h])` (CSS px), or `dirty()` for all of it. Never keeps the
 *  engine awake; Recall removes the canvas and gives the root's style back. */
export declare function viewCanvas(engine: Engine, root: HTMLElement, o: ViewCanvasOptions): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    /** The canvas size in CSS px, as last measured. */
    readonly width: number;
    readonly height: number;
    /** The device pixels per CSS px it draws at. */
    readonly dpr: number;
    /** Redraw box [x, y, w, h] (CSS px) on the next render; no box, the whole canvas. The box comes
     *  in an array, not as four numbers: doubles passed to a call are boxed. Wakes a settled engine. */
    dirty(b?: {
        readonly [i: number]: number;
    }): void;
    read(): void;
    render(): void;
};
/** What `viewCanvas` returns: `canvas`, `ctx`, `width`, `height`, `dpr` and `dirty(box?)`. */
export type ViewCanvas = ReturnType<typeof viewCanvas>;
