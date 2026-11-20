/**
 * @fzlt/core/debug: development-only checks. `guardLayout(engine)` counts every layout read (rects,
 * offset/client/scroll sizes, computed style) made while the engine is in its STEP phase, the
 * contract's "no layout reads in the tick". `touchLog()` puts an on-screen log of pointer and touch
 * events on a real phone. Never ship this in a production build.
 */
import { type Engine } from "./kernel/engine.js";
/** Count layout reads made during a step; the number shows as `engine.violations`. */
export declare function guardLayout(engine: Engine): () => boolean;
/** Options for `touchLog()`. */
export interface TouchLogOptions {
    /** Lines kept on screen, newest last (default 14). */
    lines?: number;
    /** Also log pointermove and touchmove (default false: they flood the log). */
    moves?: boolean;
    /** Where the overlay goes (default document.body). */
    host?: HTMLElement;
}
/** An on-screen log of the last pointer and touch events on the page (type, pointer type and id or
 *  the touch count, x, y, and the element hit; each line starts with ms since start, inside open shadow roots too), for finding why a
 *  control doesn't answer on a real phone. A fixed box that never takes a touch itself; listeners
 *  are passive and capture on window, so nothing is cancelled or stopped. Nothing is saved or sent.
 *  Dev only: wire it to your own query flag. `stop()` removes the box and every listener. */
export declare function touchLog(o?: TouchLogOptions): {
    /** The overlay (a fixed `<pre>`). */
    el: HTMLPreElement;
    /** The lines on screen, oldest first. */
    lines: readonly string[];
    /** Remove the box and every listener. */
    stop(): void;
};
