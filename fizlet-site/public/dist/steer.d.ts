import { hypot } from "./math.js";
/** Options for `steer()`: how many movers, their pace, turn rate and arrival bands, the wander area
 *  and timing, the wall check and the random source. */
export interface SteerOptions {
    /** Movers, a positive integer (fixed: the arrays never grow). */
    cap: number;
    /** Pixels per second at full pace (default 150) and a multiplier for the board's scale (default 1). */
    speed?: number;
    scale?: number;
    /** Most the heading turns, radians per second (default 7). */
    turn?: number;
    /** Seek, wander and patrol stop inside this many pixels of the goal (default 16). */
    stop?: number;
    /** Arrive: stop inside `near` (14), slow down inside `slow` (140): pace `fast` (1.05) then `calm` (0.8). */
    near?: number;
    slow?: number;
    fast?: number;
    calm?: number;
    /** Flee stops once this far away (default 240). */
    far?: number;
    /** Wander: a new goal every `every` (2) + random × `jitter` (2) seconds, inside `area` [left, top, width, height]. */
    every?: number;
    jitter?: number;
    area?: readonly [number, number, number, number];
    /** Is (at[0], at[1]) a wall for mover i? Checked per axis, so movers slide along walls. The spot
     *  comes in a typed array, not as two numbers: doubles passed to a callback are boxed. */
    blocked?(i: number, at: Float64Array): boolean;
    /** 0..1 (default Math.random; pass engine.random to replay). */
    random?(): number;
}
/** Turn `from` toward `to` by at most `max` radians, the short way round. */
export declare const turn: (from: number, to: number, max: number) => number;
export { hypot };
/** Steering for `o.cap` movers on typed arrays: `seek`, `flee`, `arrive`, `wander` and `patrol`, each
 *  with a turn-limited heading and a per-axis wall check. DOM-free and allocation-free: call them
 *  from a step, one mover at a time. */
export declare function steer(o: SteerOptions): {
    x: Float64Array<ArrayBuffer>;
    y: Float64Array<ArrayBuffer>;
    a: Float64Array<ArrayBuffer>;
    /** The goal: wander's current one (and seconds until it picks the next), or one the game writes for `arriveGoal`. */
    gx: Float64Array<ArrayBuffer>;
    gy: Float64Array<ArrayBuffer>;
    think: Float64Array<ArrayBuffer>;
    /** Patrol: the waypoint each mover is heading for. */
    leg: Uint32Array<ArrayBuffer>;
    cap: number;
    /** Put mover i at (px, py) facing `heading`; wander picks a goal at once, patrol starts at 0. */
    place(i: number, px: number, py: number, heading?: number): void;
    /** Pixels each mover went on its last call (0 when it stood). */
    moved: Float64Array<ArrayBuffer>;
    /** Drive mover i along (ax, ay) (a stick, length ≤ 1) for dt seconds. */
    drive(i: number, ax: number, ay: number, dt: number): void;
    /** Toward (tx, ty) at `pace` (dt is scaled by it, so the turn slows too), until inside `stop`. */
    seek(i: number, tx: number, ty: number, dt: number, pace?: number): void;
    flee(i: number, fx: number, fy: number, dt: number, pace?: number): undefined;
    arrive(i: number, tx: number, ty: number, dt: number): void;
    /**
     * `arrive` toward (gx[i], gy[i]): write the goal there, then call it. For a goal computed every
     * frame (a slot behind a leader): passed as two numbers, V8 boxes each one whenever it doesn't
     * inline the call (3 young GCs per 20k steps in Blitz's platoons); a typed array never boxes.
     */
    arriveGoal(i: number, dt: number): void;
    wander(i: number, dt: number, pace?: number): void;
    /** Waypoints as [x0, y0, x1, y1, …] (a typed array is best); the next one once inside `stop`.
     *  No waypoint (fewer than two numbers): it stands still. */
    patrol(i: number, points: ArrayLike<number>, dt: number, pace?: number): undefined;
};
/** The movers `steer()` returns. */
export type Steer = ReturnType<typeof steer>;
