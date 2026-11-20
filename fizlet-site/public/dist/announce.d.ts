/**
 * @fzlt/core/announce: game events read out to screen readers through one polite live region,
 * rate-limited. The game says what happened on the event ring (in its steps, as it already does for
 * sound and effects); `words` turns an event into a sentence in render; the region speaks at most
 * once per `gap` seconds.
 *
 *   const a = announce(engine, {
 *     words: (e) => e.type === "score" ? `Score ${e.a}` : e.type === "over" ? "Game over" : null,
 *   });
 *   a.say("lives", "2 lives left"); // or directly, from a HUD or a menu
 *
 * - One region per page, shared by every engine: `[data-fz-announce]`, role status, polite, atomic,
 *   visually hidden. Made on the first word, never before; destroy() removes it if this one made it.
 * - Coalesced by key (an event's `type`): a newer sentence for the same key replaces the waiting one,
 *   so a score that ticks ten times a second is read once, as its latest value. Waiting sentences
 *   are read together, in the order their keys first came, joined with ". ".
 * - The same sentence twice is read twice (a trailing no-break space alternates).
 * - Nothing in step; in render it reads the ring only. One timer while something waits, none after.
 * - Recall: destroy() (or the engine's) removes the system, the timer and the region it made.
 */
import type { Engine } from "./kernel/engine.js";
import type { FizEvent } from "./kernel/ring.js";
/** Options for `announce()`: `words(event)` turns ring events into sentences, `gap` is the least time between writes, `doc` the document. */
export interface AnnounceOptions {
    /** An event in words, or nothing (null, undefined, "" or false) to stay quiet. Runs in render. */
    words?: (e: FizEvent) => string | null | undefined | false | void;
    /** Seconds between two writes to the region (default 1). */
    gap?: number;
    /** The page (default: the engine root's document, else `document`). */
    doc?: Document;
}
/** Game events read out to screen readers through one polite live region per page, coalesced by key and rate-limited; `destroy()` removes the region. */
export declare function announce(engine: Engine, o?: AnnounceOptions): {
    /** Queue a sentence under a key (coalesced with what waits under that key). */
    say: (key: string, text: string) => void;
    /** Read what waits now, ignoring the gap (a result screen that must not wait). */
    flush: () => void;
    /** Remove the system, the timer and the region this one made. */
    destroy: () => void;
};
/** What `announce()` returns: `say`, `flush`, `destroy`. */
export type Announcer = ReturnType<typeof announce>;
