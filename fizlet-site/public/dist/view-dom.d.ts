/**
 * @fzlt/core/view-dom: a @fzlt/core/actor table drawn as DOM nodes, one per row, pooled. A row's node is
 * made the first time it shows (`make(i)`, default an empty `<i>`), put in `host` through the
 * ledger, and kept for good: when the actor dies the node hides (`hidden`), and when the row lives
 * again (a new actor) the same node comes back. So the page holds at most `cap` nodes, and
 * `engine.destroy()` (Recall) takes every one away and leaves the host as it was.
 *
 * Each render it writes, change-only through the ledger: `transform` (the body's `x`, `y` times
 * `scale`, to 0.01 px, centred on the node unless `center: false`, turned by the heading `a` unless
 * `turn: false`), `--hp` (hp / max, to 0.01), and `data-side` / `data-kind` when a row shows. The
 * look is the page's CSS (`[data-side="1"] { … }`, `width: calc(var(--hp) * 100%)`); give `hidden`
 * the last word if a rule sets `display`. `paint(i, el)` runs after for a row's own change-only
 * writes (through engine.ledger). A board that holds still writes nothing and calls no `busy()`,
 * so an engine with `settle` sleeps. A death can `linger` (seconds, with `data-dead` set, for a CSS
 * fade) and holds the engine awake that long; with reduced motion the node hides at once. The step
 * only counts lingering deaths down: no DOM, no allocation. A moved row costs one transform string
 * in render; a still one costs nothing.
 */
import type { Engine } from "./kernel/engine.js";
import type { Actors } from "./actor.js";
type El = HTMLElement | SVGElement;
/** Options for `viewDom()`: node factory, scale, turn, centring, linger, motion and paint. */
export interface ViewOptions {
    /** A node for row i, made once, the first time row i shows (default: an empty `<i>`). */
    make?(i: number): El;
    /** Pixels per world unit (default 1): a board whose units live in cells passes its tile size. */
    scale?: number;
    /** Turn by the heading `a` (default true). */
    turn?: boolean;
    /** Centre the node on (x, y) (default true: `translate(-50%, -50%)`). */
    center?: boolean;
    /** Seconds a dead actor's node stays, with `data-dead`, before it hides (default 0). */
    linger?: number;
    /** Animate deaths (default: yes, unless the visitor prefers reduced motion). */
    motion?: boolean;
    /** After the view's writes for a showing row, each render: the game's own (change-only) writes. */
    paint?(i: number, el: El): void;
}
/** An actor table as pooled DOM nodes, written change-only through the ledger; settles when still, `destroy()` removes every node. */
export declare function viewDom(engine: Engine, A: Actors, host: El, o?: ViewOptions): {
    /** Row i's node (undefined until it first shows). */
    node: (i: number) => El | undefined;
    /** Stop drawing (the nodes stay until Recall: engine.destroy()). */
    remove: () => void;
};
/** The view `viewDom()` returns. */
export type ViewDom = ReturnType<typeof viewDom>;
export {};
