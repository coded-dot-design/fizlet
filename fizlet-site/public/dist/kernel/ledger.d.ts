/**
 * The ledger: every change the engine makes to the page goes through here, so `restore()` (Recall)
 * puts the page back exactly. It is also the change-only writer: writing the value already there
 * touches nothing. Rule: a newer edit by the host page always wins (we never overwrite it, and we
 * never restore over it). Merged from the DOM VIRUS core MutationLedger and Swarm's style/attribute
 * ledgers; adds classes and nodes the engine adds to the page.
 */
type El = HTMLElement | SVGElement;
/** Records every change the engine makes to the page (styles, attributes, classes, text, added
 *  nodes) so `restore()` puts it back exactly. Writes that change nothing touch nothing, and an
 *  edit the host page made after ours always wins. Each engine has one: `engine.ledger`. */
export declare class Ledger {
    private readonly t;
    private readonly m;
    private readonly a;
    private z?;
    private e;
    /** Replace a text node's value. False if the host changed it since our last write. */
    text(node: CharacterData, value: string): boolean;
    /** Set one inline style property (e.g. "transform", "--hp"). */
    style(el: El, prop: string, value: string, priority?: string): boolean;
    /** Put one style property back now (as Recall would) and forget it: a later `style` records the
     *  value then in place as the new original. Hands off if the host changed it since our last write. */
    unstyle(el: El, prop: string): boolean;
    /** Set (string) or remove (null) an attribute. */
    attr(el: El, name: string, value: string | null): boolean;
    /** Add or remove one class. */
    cls(el: El, name: string, on: boolean): boolean;
    /** A node the engine put on the page (canvas, overlay, debris): removed on restore. Once closed
     *  (after engine.destroy()) it is removed as soon as the caller's task ends: the caller inserts it
     *  after this returns, so it can't be refused here. */
    add<N extends Node>(node: N): N;
    /** Recall: put back everything we still own, newest first. Host edits win. With `close` (what
     *  `engine.destroy()` passes) every later text, style, attr or cls write is refused (returns false,
     *  touches nothing), so nothing written after Recall outlives it; without it the ledger is reused. */
    restore(close?: boolean): void;
    /** How many things the ledger holds (for stats). */
    get size(): number;
}
export {};
