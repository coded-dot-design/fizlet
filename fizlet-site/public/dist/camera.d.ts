/**
 * @fzlt/core/camera: the page is the camera. Pan and zoom a DOM stage (any element) with one
 * `transform` written through the engine's ledger, so Recall gives it back exactly. Moves ease and
 * settle (the engine sleeps when they end); with reduced motion they jump. `contain` (default on)
 * keeps the stage covering its own box, so no edge shows and the page never scrolls sideways.
 *
 * Coordinates: world = the stage's own untransformed CSS px (0,0 is its top-left corner); screen =
 * the same box after the camera (what the visitor sees, in the stage's untransformed layout box).
 */
import type { Engine } from "./kernel/engine.js";
/** Options for `camera()`: easing rate, zoom limits, containment and reduced-motion handling. */
export interface CameraOptions {
    /** Easing rate per second (default 7; higher is snappier). A move settles in about 6 / ease s. */
    ease?: number;
    /** Zoom limits (default 1 and 4). */
    min?: number;
    max?: number;
    /** Keep the stage covering its own box and clip its parent (default true). */
    contain?: boolean;
    /** Ease moves (default: yes, unless the visitor prefers reduced motion; then every move jumps). */
    motion?: boolean;
}
/** A camera on stage `el`: pan and zoom it with one `transform` written through the engine's ledger
 *  (so Recall gives it back). Moves ease and settle; `to()`, `pan()` and `home()` drive it. */
export declare function camera(engine: Engine, el: HTMLElement | SVGElement, o?: CameraOptions): {
    /** Show world point (x, y) at screen point (px, py) (default: the same point, a zoom about it). */
    to(x: number, y: number, zoom?: number, px?: number, py?: number): void;
    /** Stage size in px (untransformed), as last measured. */
    readonly width: number;
    readonly height: number;
    /** Drag by a screen delta (px): follows at once, no easing. */
    pan(dx: number, dy: number): void;
    /** Back to the page as it is (zoom 1, no offset), eased. */
    home(): void;
    /** Screen (stage box px) to world, into `out` (no allocation). */
    toWorld<T extends {
        [i: number]: number;
    }>(x: number, y: number, out: T): T;
    readonly zoom: number;
    /** Still easing toward the target. */
    readonly moving: boolean;
    read(): void;
    step(e: Engine, dt: number): void;
    render(): void;
};
/** The camera `camera()` returns. */
export type Camera = ReturnType<typeof camera>;
/** Zoom about world point (x, y): it stays where it is on screen. The same as `cam.to(x, y, zoom)`. */
export declare function zoomAt(cam: Camera, x: number, y: number, zoom: number): void;
/** Centre world point (x, y) on the stage at `zoom`. */
export declare function flyTo(cam: Camera, x: number, y: number, zoom?: number): void;
/** World to screen (stage box px), into `out`: the inverse of `cam.toWorld`. */
export declare function toScreen<T extends {
    [i: number]: number;
}>(cam: Camera, x: number, y: number, out: T): T;
/** Fit a world box (x, y, w, h) in the stage, with `pad` (fraction, default 0.1) around it. */
export declare function fit(cam: Camera, x: number, y: number, w: number, h: number, pad?: number): void;
