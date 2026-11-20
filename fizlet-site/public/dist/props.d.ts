/**
 * @fzlt/core/props: a kit of small low-poly models for `@fzlt/core/diorama` scenes, so a new diorama
 * starts furnished. Each prop is a function `prop(d, opts)` that adds a `group` root (its `size` is the
 * prop's footprint, so its blob shadow fits) and its parts resting on it, at `pos`, turned by `rot`
 * (yaw) and sized by `scale`, in soft pastel colours you can override by key; it returns the root.
 * Move, turn, tilt, tint or hide the root and the whole prop follows; `d.root(d.pick(x, y))` on any
 * part gives the root (its `tag` is the prop's name unless you pass one).
 * - Sets: nature (`pineTree`, `roundTree`, `bush`, `rocks`, `cactus`), town (`house`, `shop`,
 *   `lamppost`, `bench`, `fence`, `trafficCone`, `crates`), coast (`lighthouse`, `dock`, `buoy`) and
 *   display vehicles (`car`, `truck`). Import only the props you use: each is its own function.
 * - Units: about a metre (a house is 2.4 wide); local x is a prop's width, z its depth and +z its
 *   front (doors, windows, a car's side). `fence` and `dock` segments join end to end along x at
 *   `FENCE_STEP` and `DOCK_STEP` × scale.
 * - Variants: `seed` (an integer) picks heights, widths, turns and counts from integer maths, so every
 *   player who builds the same seed gets the same scene. Each jitter is one of eight steps, so the
 *   diorama's mesh cache stays small however many seeds a scene uses.
 * - Sorting: each prop is its own diorama cluster (named by its id) unless you pass `cluster`, and its
 *   parts are layered low to high, so props in a row never interleave. Make what they stand on a
 *   `fixed` cluster (`d.cluster("floor", { fixed: 0 })`), as clusters anchored on a point sort far to near.
 * - Colours: every prop reads `colors[key]` before its own default, and the keys are shared across
 *   props (`wood`, `roof`, `glass`, `metal`, `lamp`, …), so one object re-themes a scene (a night set).
 * Adding a prop allocates only what `d.add` does for its parts (pass an `id`; without one, a name is
 * made from a counter). Nothing runs per frame: props are data in the diorama, drawn by its `draw()`.
 */
import type { Diorama, DioramaObject } from "./diorama.js";
/** Options every prop takes. */
export interface PropOptions {
    /** The root's id (default `"prop" + n`, a counter); its parts are anonymous. */
    id?: string;
    /** The id of the object it stands on (its `pos` is then from that object's top centre). */
    on?: string | null;
    /** Position of its bottom centre, [x, y, z] (default [0, 0, 0]). */
    pos?: ArrayLike<number>;
    /** Turn around y, radians (default 0). */
    rot?: number;
    /** Size multiplier (default 1). */
    scale?: number;
    /** An integer picking the variant (default 0). */
    seed?: number;
    /** Colour overrides by key, `#rrggbb` (each prop lists its keys). */
    colors?: Readonly<Record<string, string | undefined>>;
    /** Its diorama cluster (default: its own, named by its id; null: its parent's). */
    cluster?: string | null;
    /** Blob shadow strength on what it stands on (default 0.16 when `on` is set). */
    shadow?: number;
    /** The root's layer (default: diorama's, its parent's + 1); parts layer above it. */
    layer?: number;
    /** `false`: `pick` passes through every part. */
    pick?: boolean;
    /** The root's tag (default: the prop's name, e.g. `"house"`). */
    tag?: unknown;
}
/** A pine: a trunk and three stacked cones (keys `trunk`, `leaf`, `leaf2`); the seed sets its
 *  height (±20%), girth (±12%) and turn. Footprint 2.1 × 3.5 × 2.1. */
export declare function pineTree(d: Diorama, o?: PropOptions): DioramaObject;
/** A round-crowned tree: a trunk under a two-part crown (keys `trunk`, `leaf`, `leaf2`); the seed
 *  sets its height (±18%), crown width (±12%) and turn. Footprint 2.1 × 3 × 2.1. */
export declare function roundTree(d: Diorama, o?: PropOptions): DioramaObject;
/** A bush: a mound and two smaller ones beside it (keys `leaf`, `leaf2`); the seed sets their sizes
 *  and where the small ones sit. Footprint 2 × 0.8 × 1.4. */
export declare function bush(d: Diorama, o?: PropOptions): DioramaObject;
/** A cluster of three rocks (keys `rock`, `rock2`); the seed sets their sizes and turns.
 *  Footprint 2 × 0.8 × 1.4. */
export declare function rocks(d: Diorama, o?: PropOptions): DioramaObject;
/** A cactus with two arms and, on odd seeds, a flower (keys `cactus`, `cactus2`, `flower`); the seed
 *  sets its height (±15%) and the arms' heights. Footprint 1.4 × 2 × 0.5. */
export declare function cactus(d: Diorama, o?: PropOptions): DioramaObject;
/** A cottage: walls, a gable roof, a door and two windows on its front (+z) and a chimney (keys
 *  `wall`, `roof`, `trim`, `door`, `glass`, `brick`); the seed sets its wall height and the
 *  chimney's side. Footprint 2.6 × 2.7 × 2.2. */
export declare function house(d: Diorama, o?: PropOptions): DioramaObject;
/** A corner shop: a box with a parapet, a shop window and door on its front (+z) under a striped
 *  awning (keys `wall`, `trim`, `awning`, `awning2`, `door`, `glass`); the seed sets its height and
 *  the stripes' count. Footprint 2.8 × 2.1 × 2.8. */
export declare function shop(d: Diorama, o?: PropOptions): DioramaObject;
/** A street lamp: a foot, a post, a glowing lantern (unshaded) and its cap (keys `metal`, `lamp`).
 *  Footprint 0.5 × 2.9 × 0.5. */
export declare function lamppost(d: Diorama, o?: PropOptions): DioramaObject;
/** A park bench facing +z: two side frames, a seat and a back (keys `wood`, `metal`).
 *  Footprint 1.7 × 0.9 × 0.5. */
export declare function bench(d: Diorama, o?: PropOptions): DioramaObject;
/** The length of a `fence` segment at scale 1: segments set this far apart along x join up. */
export declare const FENCE_STEP = 2;
/** A picket fence segment along x: two posts, two rails and three pickets (keys `fence`, `post`).
 *  Footprint 2 × 0.9 × 0.16. */
export declare function fence(d: Diorama, o?: PropOptions): DioramaObject;
/** A traffic cone: a square foot and a striped cone (keys `cone`, `cone2`). Footprint 0.5 × 0.7 × 0.5. */
export declare function trafficCone(d: Diorama, o?: PropOptions): DioramaObject;
/** A stack of one to three crates (keys `wood`, `wood2`); the seed sets the count and their turns.
 *  Footprint 1.2 × 2 × 1.2. */
export declare function crates(d: Diorama, o?: PropOptions): DioramaObject;
/** A lighthouse: a stone foot, a tapering tower in red and white rings, a gallery, a glowing lamp
 *  room (unshaded) and a roof, a door on its front (keys `stone`, `wall`, `stripe`, `metal`, `lamp`,
 *  `roof`, `door`). Footprint 2.2 × 5 × 2.2. */
export declare function lighthouse(d: Diorama, o?: PropOptions): DioramaObject;
/** The length of a `dock` segment at scale 1: segments set this far apart along x join up. */
export declare const DOCK_STEP = 3;
/** A dock segment along x: a deck with plank lines on four posts, and a bollard on even seeds (keys
 *  `deck`, `plank`, `post`, `metal`). Its deck is 0.5 up: stand it in the water. Footprint 3 × 0.9 × 1.4. */
export declare function dock(d: Diorama, o?: PropOptions): DioramaObject;
/** A channel buoy: a red float, a white band, a cone and a small glowing light (unshaded) (keys
 *  `buoy`, `buoy2`, `lamp`). Footprint 0.6 × 1.1 × 0.6. */
export declare function buoy(d: Diorama, o?: PropOptions): DioramaObject;
/** A small car facing +x: a body, a cabin with sloped glass and a roof, headlights and four wheels
 *  (keys `paint`, `glass`, `tire`, `lamp`); without a `paint` override the seed picks one of four
 *  pastels. Footprint 2 × 1.1 × 1.2. */
export declare function car(d: Diorama, o?: PropOptions): DioramaObject;
/** A box truck facing +x: a chassis, a cab with a windscreen, a cargo box and six wheels (keys
 *  `paint` (the cab), `body` (the box), `glass`, `tire`, `lamp`, `metal`); without a `paint` override
 *  the seed picks one of four pastels. Footprint 3.1 × 1.6 × 1.2. */
export declare function truck(d: Diorama, o?: PropOptions): DioramaObject;
/** Every prop by name (importing this pulls in the whole kit; import single props to keep it small). */
export declare const PROPS: {
    pineTree: typeof pineTree;
    roundTree: typeof roundTree;
    bush: typeof bush;
    rocks: typeof rocks;
    cactus: typeof cactus;
    house: typeof house;
    shop: typeof shop;
    lamppost: typeof lamppost;
    bench: typeof bench;
    fence: typeof fence;
    trafficCone: typeof trafficCone;
    crates: typeof crates;
    lighthouse: typeof lighthouse;
    dock: typeof dock;
    buoy: typeof buoy;
    car: typeof car;
    truck: typeof truck;
};
