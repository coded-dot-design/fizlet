/**
 * @fzlt/core/water: animated water for `@fzlt/core/diorama` scenes (a bay, a pond, a wave pool),
 * lifted from the Salvo Bay prototype. `water(d, { rect | outline, level, … })` builds the water's
 * body (depth bands as prisms) and paints its surface in the diorama's depth sort: wave crests that
 * roll across, a drifting sheen, foam lapping along the edges you pick, bow waves and wakes behind
 * the objects you `wake`, and pooled effects: `splash` (a column of water, spray, a crown of drops,
 * rings and ripples that travel out), `ripple`, `bubbles` and `whirl` (something going down).
 * - The surface is a function: `height(x, z, t)` is the same for the same (x, z, t) on every run (sines
 *   of the wave, plus the optional `swell`: a travelling, peeling crest a surfer can ride, its
 *   `slope` and its `crest` position). Effects are seeded (`seed`), so a replay splashes the same.
 * - It has its own clock: `step(dt)` moves it and returns `busy`. The idle roll runs `idle` seconds
 *   after the last effect or `stir()`, then rests, so the engine can settle; `still` (reduced motion,
 *   on by default when the page asks for it) freezes the surface and keeps every effect short.
 * - Everything is clipped to the outline and drawn from fixed pools (particles, rings, whirls, bubble
 *   emitters, wake trails): no allocation per `step` or draw in the steady state; past a pool's
 *   capacity an effect is dropped, never grown. Wakes read the object's world matrix from the last
 *   draw. DOM-free (one `matchMedia` read for the `still` default); 2D lengths use steer's exact `hypot`.
 */
import type { Diorama, DioramaObject, DioramaPoints } from "./diorama.js";
/** The wave: crests every `len` world units rolling along `dir` at `speed` units/s, `amp` high. */
export interface WaveOptions {
    /** Height of the wave (default 0.03). */
    amp?: number;
    /** Crest to crest (default 2). */
    len?: number;
    /** Units per second along `dir` (default 0.3). */
    speed?: number;
    /** Where the crests roll, [x, z] (default [0, 1]: toward a camera on +z). */
    dir?: ArrayLike<number>;
    /** The crests' alpha (default 0.13). */
    alpha?: number;
}
/** Foam along the outline's edges (bit i: edge i, from point i to i + 1, for the first 31; a rect's
 *  are 1 far (−z), 2 right (+x), 4 near (+z), 8 left (−x)). */
export interface FoamOptions {
    /** The edges with foam (default every edge). */
    edges?: number;
    /** Alpha (default 0.62). */
    alpha?: number;
    /** The ragged band's width in world units (default 0.15). */
    width?: number;
}
/** A swell for a wave pool: one crest that travels across along `dir` and breaks (peels) along it. */
export interface SwellOptions {
    /** Height (default 0.6). */
    amp?: number;
    /** Width of its back; the face in front is half as wide (default 1.5). */
    width?: number;
    /** Units per second along `dir` (default 2). */
    speed?: number;
    /** Travel direction, [x, z] (default the wave's). */
    dir?: ArrayLike<number>;
    /** Seconds between sets (default: the time to cross, plus 2). */
    period?: number;
    /** The break runs along the crest (from its low end) at this many units/s (default 0: no break). */
    peel?: number;
    /** Alpha of its light and shade (default 0.5). */
    alpha?: number;
}
/** A depth band under the surface band, from the bottom up. */
export interface WaterBand {
    /** Thickness. */
    h: number;
    /** `#rrggbb`. */
    color: string;
    /** 0..1 (default 1). */
    alpha?: number;
}
/** Options for `water`. Give `rect` or `outline`. */
export interface WaterOptions {
    /** [x0, z0, x1, z1], world. */
    rect?: ArrayLike<number>;
    /** [x, z] points round the water (any simple polygon), world. */
    outline?: ArrayLike<ArrayLike<number>>;
    /** The surface's height, y (default 0). */
    level?: number;
    /** The surface band's colour (default `#a8def0`). */
    color?: string;
    /** Its alpha (default 0.84). */
    alpha?: number;
    /** Its thickness (default 0.25). */
    depth?: number;
    /** Depth bands under it, bottom first. */
    bands?: ArrayLike<WaterBand>;
    /** false: no body, only the surface (you built the water's faces yourself). */
    body?: boolean;
    /** The moving light: crests, foam, sheen, drops and bubbles (default `#ffffff`). */
    light?: string;
    /** The wave (false: a flat surface, no crests). */
    wave?: WaveOptions | false;
    /** Foam along the edges (false: none). */
    foam?: FoamOptions | false;
    /** The sheen's alpha (default 0.09; false: none). */
    sheen?: number | false;
    /** A swell (wave pool). */
    swell?: SwellOptions | false;
    /** The diorama cluster it draws in (default its own, anchored at its centre). */
    cluster?: string;
    /** The surface band's layer (default 3): depth bands at layer − 2, the surface paint at + 0.6,
     *  particles at + 1 (the layer of what floats on it). */
    layer?: number;
    /** Particles (default 320); whirls and bubble emitters are 8 each. */
    cap?: number;
    /** Rings and ripples (default 24). */
    rings?: number;
    /** Seconds the surface keeps rolling after the last effect or `stir()` (default 6; Infinity: always). */
    idle?: number;
    /** Reduced motion: a still surface, short effects (default: the page's prefers-reduced-motion). */
    still?: boolean;
    /** Effects' seed (default 1). */
    seed?: number;
    /** Time offset of the roll, so two pools don't move in step (default 0). */
    phase?: number;
}
/** Options for `wake`: where the bow is and how much wave it makes at rest. */
export interface WakeOptions {
    /** Centre to bow along the heading (default half the object's x size). */
    size?: number;
    /** Half its beam (default half its z size). */
    width?: number;
    /** The bow wave's strength at rest, 0..1 (default 0.6; 0: only when it moves). */
    rest?: number;
}
/** A wake on one object: its speed and heading (from its world matrix over the last steps) and the
 *  trail behind it, newest first: `trail` holds [x, z, hx, hz, age] per sample, `n` of them. */
export interface WaterWake {
    /** The object it follows. */
    readonly ob: DioramaObject;
    /** Centre to bow. */
    size: number;
    /** Half the beam. */
    width: number;
    /** The bow wave at rest, 0..1. */
    rest: number;
    /** Units per second, smoothed. */
    speed: number;
    /** Heading [hx, hz] (the direction of travel, or the object's +x at rest). */
    hx: number;
    /** Heading z. */
    hz: number;
    /** [x, z, hx, hz, age] per sample, newest first (and 4 slots of its own state after them). */
    readonly trail: Float64Array;
    /** Live samples. */
    n: number;
}
/** Water on diorama `d`. Call `step(dt)` from a fixed step (it returns `busy`); the diorama's own
 *  `draw()` paints it. */
export declare function water(d: Diorama, o: WaterOptions): {
    /** The surface band and depth bands (diorama objects), bottom first. */
    bodies: DioramaObject[];
    /** The particle pool in the diorama's sort. */
    points: DioramaPoints;
    /** The surface's height, y. */
    level: number;
    /** Reduced motion: the surface holds still and effects stay short. */
    still: boolean;
    /** True while anything moves (set by `step`). */
    busy: boolean;
    /** The surface's clock (seconds it has rolled). */
    readonly time: number;
    /** Live particles after the last step. */
    readonly live: number;
    step: (dt: number) => boolean;
    /** Keep the surface rolling `sec` more seconds (default `idle`). */
    stir: (sec?: number) => void;
    height: (x: number, z: number, t?: number) => number;
    /** The surface's slope at (x, z): out = [dh/dx, dh/dz]. */
    slope<T extends {
        [i: number]: number;
    }>(x: number, z: number, out: T, t?: number): T;
    /** The swell now: out = [crest along its dir (x·dx + z·dz), the break point across it (from its
     *  low end), its height]; false when there is no swell or the crest is off the water. */
    crest(out: {
        [i: number]: number;
    }, t?: number): boolean;
    /** A miss: a column of water that rises and falls back, spray and a crown of drops at its foot,
     *  a ring and ripples running out (size scales it). */
    splash(x: number, z: number, size?: number): undefined;
    /** A ring and a ripple running out from (x, z). */
    ripple(x: number, z: number, size?: number): void;
    /** Bubbles breaking on the surface round (x, z) for `sec` seconds, `spread` across. */
    bubbles(x: number, z: number, sec?: number, spread?: number): undefined;
    /** A whirlpool at (x, z), `size` across its arms, for `sec` seconds, and its rings. */
    whirl(x: number, z: number, size?: number, sec?: number): undefined;
    /** Bow waves and a trail behind `ob` (its position from its world matrix, as of the last draw). */
    wake(ob: DioramaObject, w?: WakeOptions): WaterWake;
    /** Stop a wake. */
    unwake(k: WaterWake): void;
    /** End every effect now (the surface keeps its clock). */
    clear(): void;
};
/** What `water` returns. */
export type Water = ReturnType<typeof water>;
