/**
 * @fzlt/core/dice: seeded dice for tabletop games. `roll(seed, n, sides)` gives the values; `dice()`
 * also builds a short tumble for each d6 (positions and orientations over time) that lands on the
 * value the seed picked, so every player who rolls the same seed sees the same roll.
 * - The values come from integer maths only (a 32-bit hash generator): the same seed gives the same
 *   values in every browser. The tumble is made to end on them (it is not a physics run that might
 *   land on an edge), so the face that lands up is the value by construction. The tumble is the
 *   look and never feeds a result: it keeps the builtin `Math.sin`, `cos`, `acos` and `**`, whose
 *   last bit may differ between engines (a path may differ in its last bits; the values never do), so
 *   an online sim reads `value`, never `path`.
 * - The path is data: `path` holds `frames` samples per die of [x, y, z, qx, qy, qz, qw] (y up, the
 *   centre's height over the floor, a unit quaternion), and `pose(i, t, out)` reads it at any time.
 * - `dioramaDice` builds the dice into an `@fzlt/core/diorama` scene (a chamfered body, pips painted
 *   on the faces that look at the camera) and shows them at a time; `popDome` puts them under a
 *   clear dome that you press: they jump, tumble and land.
 * No allocation per `roll`, `pose` or `show` in the steady state (typed arrays, fixed capacity).
 * Distances on the floor use steer's exact `hypot` (the builtin boxes its arguments).
 */
import type { Diorama, DioramaObject } from "./diorama.js";
/** Options for `dice()`: how many, their size and the tumble's length and sample rate. */
export interface DiceOptions {
    /** Dice rolled at once (default 1; `n` can change up to `cap` between rolls). */
    count?: number;
    /** The most dice (default `count`). */
    cap?: number;
    /** Edge length in world units (default 1). */
    size?: number;
    /** Seconds from the throw to rest (default 1.4). */
    duration?: number;
    /** Samples per second in `path` (default 60). */
    rate?: number;
}
/** How `roll` throws: from where to where, how high, how far apart; or a pop from rest. */
export interface ThrowOptions {
    /** Where the throw starts, [x, z] on the floor (default [−4 × size, 0] from `to`). */
    from?: ArrayLike<number>;
    /** Where the dice land, [x, z] (default [0, 0]). */
    to?: ArrayLike<number>;
    /** How high the dice start over where they rest (a throw), or how high they jump (a pop); default 2.5 × size. */
    height?: number;
    /** Space between the dice across the throw (default 1.7 × size). */
    spread?: number;
    /** Each landing spot moves up to this far, seeded (default 0.35 × size). */
    jitter?: number;
    /** Full forward rolls on the way (default: by the distance; at least 1). */
    turns?: number;
    /** A pop: each die jumps from where it rests (the last roll's landing), straight up. */
    pop?: boolean;
}
/** Roll `n` dice of `sides` faces from `seed` (any integer): `out[i]` gets 1..sides; returns the
 *  total. Integer maths only, so every browser gets the same values. `dice().roll` with the same
 *  seed lands on these values (d6). */
export declare function roll(seed: number, n?: number, sides?: number, out?: {
    [i: number]: number;
}): number;
/** The quaternion [x, y, z, w] at q[qi] as a diorama `rot` (radians, applied y, then x, then z). */
export declare function euler(q: ArrayLike<number>, out: {
    [i: number]: number;
}, qi?: number): {
    [i: number]: number;
};
/** Which value is up for the orientation at q[qi]: the face whose normal points most up. */
export declare function faceUp(q: ArrayLike<number>, qi?: number): number;
/** A set of d6 with tumble paths: `roll(seed, throw)` fills `value` and `path`; `pose(i, t, out)`
 *  reads die i at t seconds. Between rolls the dice rest where they landed. */
export declare function dice(o?: DiceOptions): {
    /** Dice in the next roll (1..cap). */
    n: number;
    cap: number;
    size: number;
    duration: number;
    rate: number;
    /** Samples per die in `path`. */
    frames: number;
    /** Die i, frame f at (i × frames + f) × 7: x, y, z, qx, qy, qz, qw. */
    path: Float64Array<ArrayBuffer>;
    /** The value each die shows (1..6). */
    value: Int32Array<ArrayBuffer>;
    /** The sum of the last roll. */
    total: number;
    /** Roll `n` dice from `seed`: values as `roll(seed, n, 6)`, and their tumbles. Returns the total. */
    roll(seed: number, t?: ThrowOptions): number;
    /** Die i at t seconds since the roll: out = [x, y, z, qx, qy, qz, qw]. False once it rests. */
    pose(i: number, t: number, out: {
        [i: number]: number;
    }): boolean;
};
/** What `dice` returns. */
export type Dice = ReturnType<typeof dice>;
/** Options for `dioramaDice`: what they rest on, the cluster to sort in, colours and shadow. */
export interface DioramaDiceOptions {
    /** The id of the object they rest on (the floor, a tray): `path` is from its top centre. */
    on: string;
    /** Their ids are `${id}0`, `${id}1`, … (default "die"). */
    id?: string;
    /** The cluster they sort in (default the parent's own, "@" + on). */
    cluster?: string;
    /** Body colour (default `#f6f1e7`). */
    color?: string;
    /** Pip colour (default `#1d1b22`). */
    pip?: string;
    /** Blob shadow strength (default 0.3). */
    shadow?: number;
}
/** Build `dc`'s dice into diorama `d`: per die a group (moved and turned by `show`) holding a
 *  chamfered body, and its pips painted in the depth sort on each face that looks at the camera.
 *  `show(t)` poses every die at t seconds since the roll (dice past `dc.n` are hidden); true while
 *  any still moves. Call it before `d.draw()`. */
export declare function dioramaDice(d: Diorama, dc: Dice, o: DioramaDiceOptions): {
    /** Each die's group (its pos and rot are set by `show`). */
    groups: DioramaObject[];
    /** Each die's body (recolour it). */
    bodies: DioramaObject[];
    /** Pose every die at t seconds since the roll; true while any still moves. */
    show(t: number): boolean;
};
/** Options for `popDome`: where it stands, how big, its colours. */
export interface PopDomeOptions {
    /** The id of the object it stands on. */
    on: string;
    /** Its ids start with this (default "dome"): the plinth is `${id}`, the dice `${id}-die0`, … */
    id?: string;
    /** Where on the parent's top, [x, z] (default [0, 0]). */
    at?: ArrayLike<number>;
    /** The dome's radius (default 2.6 × the dice's size × √cap). */
    radius?: number;
    /** The plinth's colour (default `#d8473b`). */
    color?: string;
    /** The glass tint (default `#cfe8ff`). */
    glass?: string;
    /** The cluster it sorts in (default "@" + on). */
    cluster?: string;
    /** Options for the dice inside. */
    dice?: Partial<DioramaDiceOptions>;
}
/** `dc`'s dice under a clear dome on a plinth: `press(seed)` pops them (the dome dips, the dice jump,
 *  tumble and land on the values `roll(seed, n, 6)` gives) and returns the total; `show(t)` poses the
 *  dome and dice at t seconds since the press, true while it moves. */
export declare function popDome(d: Diorama, dc: Dice, o: PopDomeOptions): {
    /** The plinth (move it, recolour it). */
    plinth: DioramaObject;
    /** The dice view inside. */
    view: {
        /** Each die's group (its pos and rot are set by `show`). */
        groups: DioramaObject[];
        /** Each die's body (recolour it). */
        bodies: DioramaObject[];
        /** Pose every die at t seconds since the roll; true while any still moves. */
        show(t: number): boolean;
    };
    /** Pop the dice from `seed`; returns the total. Then `show(t)` from t = 0. */
    press(seed: number): number;
    /** Pose the dome and dice at t seconds since the press (the dice leave at 0.07 s); true while moving. */
    show(t: number): boolean;
};
