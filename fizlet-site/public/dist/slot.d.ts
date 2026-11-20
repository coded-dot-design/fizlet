/** What a slot's mount function returns: the scene, with `destroy()` to remove it. */
export interface SlotScene {
    /** Remove the scene (its engine's destroy() restores what it changed). */
    destroy(): void;
    /** True when the scene renders real accessible content: the slot's role="img" becomes "figure". */
    accessible?: boolean;
}
/** A tap on the slot before the scene was up: where (px from the slot's top left) and when. */
export interface SlotTap {
    x: number;
    y: number;
    /** `performance.now()` when the finger went down. */
    at: number;
}
/** Build the scene inside `stage` (sized to the slot). `slot` is the figure, read-only. `first` is
 *  the tap that started the load, if one did: act on it as an intent (aim, fire), not as an event. */
export type SlotMount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => SlotScene;
/** Options for `slot()`: how near the viewport the slot must come before loading, and the idle wait. */
export interface SlotOptions {
    /** How close to the viewport the slot must come before the scene loads (default "200px"). */
    margin?: string;
    /** Longest wait (ms) for an idle main thread once the slot is near (default 1000; 0: no wait). */
    idle?: number;
}
/** The slot for "<page>#<slot>" (or null): any `.ae-slot` carrying the target, figure or box. */
export declare const findSlot: (target: string, doc?: Document) => HTMLElement | null;
/** Mount a scene into an Astro page engine slot (`target`: its `data-slot-target` or the element).
 *  `load` runs once the slot nears the viewport and the main thread is idle (or on the first tap);
 *  with reduced motion it never loads. Returns `el`, `mounted` and `destroy()`. */
export declare function slot(target: string | HTMLElement, load: () => Promise<SlotMount> | SlotMount, opts?: SlotOptions): {
    /** The slot figure, or null when no slot matches the target. */
    el: HTMLElement | null;
    readonly mounted: boolean;
    /** Remove the scene, the stage and every listener; the slot is back as the engine drew it. */
    destroy(): void;
};
