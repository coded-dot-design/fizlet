/** The shapes: `box` (`mask` drops faces), `wedge` (a ramp, tall at −x), `cyl` (`sides`, `top`
 *  scale: 0 is a cone), `prism` (an `outline` of [x, z] points, `taper` scales its bottom) and `group`
 *  (no faces: a parent to move, tilt and tag a set of parts). */
export type DioramaShape = "box" | "wedge" | "cyl" | "prism" | "group";
/** One object to `add`. Sizes and positions are world units; y is up; the origin is the bottom centre. */
export interface DioramaObjectDef {
    /** A name for `get`, `on` and an `on` parent. */
    id?: string;
    /** The shape (default `box`). */
    shape?: DioramaShape;
    /** [width (x), height (y), depth (z)] (default [1, 1, 1]). */
    size?: ArrayLike<number>;
    /** Position: world, or from the parent's top centre when `on` is set. */
    pos?: ArrayLike<number>;
    /** Rotation in radians, [x, y, z], applied y, then x, then z. */
    rot?: ArrayLike<number>;
    /** `#rrggbb` (default `#cccccc`). */
    color?: string;
    /** 0..1, multiplied down through the children (default 1). */
    alpha?: number;
    /** A colour that replaces this object's and its children's (a hit flash, a selection). */
    tint?: string | null;
    /** Not drawn (its children still are: an invisible parent). */
    hidden?: boolean;
    /** Off with its whole subtree: none of them draw, cast a shadow or pick, and their matrices are not
     *  computed (`M` keeps its last value until it is on again). Let go of a pooled composite with it. */
    off?: boolean;
    /** The id of the object it rests on. */
    on?: string | null;
    /** Blob shadow strength on the parent's top, 0..1 (0: none); drawn on the parent's layer + 0.5. */
    shadow?: number;
    /** Order inside its cluster, 0..655 in steps of 0.01 (default: its parent's + 1, so what rests on
     *  something draws after it and its shadow, which sits at the parent's + 0.5; at the root, 4). */
    layer?: number;
    /** Faces whose centre is under the plane y draw on `layer` (a hull under the water line). */
    below?: {
        y: number;
        layer: number;
    } | null;
    /** Layers it and its children drop by while it is on the far side of its parent: its place across
     *  the parent (`pos` x, z, turned with the parent) points away from the eye, along the ray from the
     *  eye to the parent (right anywhere on screen, not only in the middle). A wheel set above
     *  the body with `behind` past it draws over the body on the near side and under it on the far
     *  side, at any heading and view (default 0: off). */
    behind?: number;
    /** Its cluster's name; default: its parent's, or its own (anchored on itself) at the root. */
    cluster?: string;
    /** Full brightness: the light does not shade it (a lamp). */
    emissive?: boolean;
    /** `false`: `pick` passes through it. */
    pick?: boolean;
    /** Anything; `root()` climbs to the nearest tagged ancestor. */
    tag?: unknown;
    /** box: the faces kept, a bit mask (1 top, 2 bottom, 4 +x, 8 −x, 16 +z, 32 −z; default 63). */
    mask?: number;
    /** cyl: sides (default 10). */
    sides?: number;
    /** cyl: the top's scale (default 1; under 0.02, a cone). */
    top?: number;
    /** prism: the outline, [x, z] points. */
    outline?: ArrayLike<ArrayLike<number>>;
    /** prism: the bottom's scale (default 1). */
    taper?: number;
}
/** A live object: change `pos`, `rot`, `color`, `alpha`, `tint`, `hidden`, `off`, `shadow`, `layer`, `behind`
 *  between draws. `M` is its world matrix from the last draw it was on in (3 × 3 rotation row by row, then x, y, z). */
export interface DioramaObject {
    /** Its name, or null. */
    readonly id: string | null;
    /** Its shape. */
    readonly shape: DioramaShape;
    /** [w, h, d]. */
    readonly size: Float64Array;
    /** Position (see `DioramaObjectDef.pos`). */
    pos: Float64Array;
    /** Rotation, radians. */
    rot: Float64Array;
    /** `#rrggbb`. */
    color: string;
    /** 0..1. */
    alpha: number;
    /** Colour override for it and its children, or null. */
    tint: string | null;
    /** Not drawn (its children still are). */
    hidden: boolean;
    /** Off with its whole subtree: not drawn, no shadows, not picked, matrices not computed. */
    off: boolean;
    /** Blob shadow strength. */
    shadow: number;
    /** Order inside its cluster. */
    layer: number;
    /** The cut plane. */
    below: {
        y: number;
        layer: number;
    } | null;
    /** Layers it drops by on the far side of its parent. */
    behind: number;
    /** Unshaded. */
    emissive: boolean;
    /** Pickable. */
    pick: boolean;
    /** Anything. */
    tag: unknown;
    /** The parent's id (change it with `on()`). */
    readonly on: string | null;
    /** The parent object. */
    readonly parent: DioramaObject | null;
    /** The world matrix from the last draw. */
    readonly M: Float64Array;
}
/** The orbit camera: it looks at (tx, ty, tz) from `dist` away, turned by `yaw` and raised by `pitch`
 *  (radians); `fov` is the vertical field of view; (ox, oy) shift the picture in CSS px. */
export interface DioramaCamera {
    /** Turn around the target (radians). */
    yaw: number;
    /** Look down from the horizon (radians; π/2 is straight down). */
    pitch: number;
    /** Distance to the target. */
    dist: number;
    /** Target x. */
    tx: number;
    /** Target y. */
    ty: number;
    /** Target z. */
    tz: number;
    /** Screen shift x, CSS px. */
    ox: number;
    /** Screen shift y, CSS px. */
    oy: number;
    /** Vertical field of view (radians). */
    fov: number;
}
/** A screen rectangle in CSS px: `fit` keeps every point inside it. */
export interface SafeRect {
    /** Left. */
    x0: number;
    /** Top. */
    y0: number;
    /** Right. */
    x1: number;
    /** Bottom. */
    y1: number;
}
/** `clamp` limits, each [min, max]. */
export interface CameraLimits {
    /** Yaw range. */
    yaw?: ArrayLike<number>;
    /** Pitch range. */
    pitch?: ArrayLike<number>;
    /** Distance range. */
    dist?: ArrayLike<number>;
}
/** Options for `points`: capacity, where they sort, their colour or their own painter. */
export interface PointsOptions {
    /** How many (fixed). */
    cap: number;
    /** The cluster they sort in (default: after every cluster, by depth among themselves). */
    cluster?: string;
    /** Their layer inside it (default 5). */
    layer?: number;
    /** `"depth"`: each point sorts among the clusters by its own depth, as if it were an unfixed
     *  cluster anchored on itself (debris behind a figure draws before it, in front after it);
     *  `cluster` is then ignored. Default: the pool sorts in one cluster. */
    rank?: "depth";
    /** Fill colour of the default disc (default `#ffffff`; `color[i]` overrides one). */
    color?: string;
    /** Paint point i yourself: its screen centre and radius are `sx[i]`, `sy[i]`, `sr[i]` (CSS px). */
    paint?: (ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) => void;
}
/** A fixed pool of points drawn in the depth sort: write `x`, `y`, `z` (world), `r` (world radius),
 *  `a` (alpha, 0 skips it) for 0 ≤ i < `n`, then draw. `sx`, `sy`, `sr` are their screen values. */
export interface DioramaPoints {
    /** Live count: points 0..n−1 draw. */
    n: number;
    /** World x. */
    readonly x: Float64Array;
    /** World y. */
    readonly y: Float64Array;
    /** World z. */
    readonly z: Float64Array;
    /** World radius. */
    readonly r: Float64Array;
    /** Alpha (starts at 1). */
    readonly a: Float64Array;
    /** Per-point fill, or undefined for the pool's colour. */
    readonly color: (string | undefined)[];
    /** Screen x from the last draw. */
    readonly sx: Float64Array;
    /** Screen y from the last draw. */
    readonly sy: Float64Array;
    /** Screen radius from the last draw. */
    readonly sr: Float64Array;
    /** The cluster they sort in, or null. */
    cluster: string | null;
    /** Their layer. */
    layer: number;
    /** `"depth"`: each point ranks among the clusters by its depth; null: in `cluster`. */
    rank: "depth" | null;
    /** The default disc colour. */
    colorAll: string;
    /** A custom painter, or null. */
    paint: PointsOptions["paint"] | null;
}
/** Options for `diorama`: light, background, overlay, edges and capacities. */
export interface DioramaOptions {
    /** The light's direction (towards the light; default [0.5, 1, 0.4]). */
    light?: ArrayLike<number>;
    /** Ambient light, 0..1 (default 0.56). */
    ambient?: number;
    /** Clear colour each draw (a string, or a function read each draw); none: transparent. */
    background?: string | (() => string);
    /** Shadow colour (default `#000000`); a getter is read each draw. */
    shadowColor?: string;
    /** Edge lines (default true). */
    edge?: boolean;
    /** Paint over the finished frame (HUD, cursors): `overlay(ctx, d)`. */
    overlay?: (ctx: CanvasRenderingContext2D, d: Diorama) => void;
    /** The most pixel density drawn (default 2). */
    maxDpr?: number;
    /** Vertex capacity (default 16384; `add` throws past it). */
    maxVerts?: number;
    /** Faces, shadows, points and decals per frame (default 8192; past it they are dropped and counted). */
    maxFaces?: number;
    /** Blob shadows per frame (default 512). */
    maxShadows?: number;
}
/** A diorama on `canvas`: `add` objects, aim `cam` (or `fit` it), then `draw()`. It never touches
 *  the DOM beyond the canvas's backing store (`resize`), and allocates nothing per draw. */
export declare function diorama(canvas: HTMLCanvasElement, o?: DioramaOptions): {
    /** The canvas's 2D context. */
    ctx: CanvasRenderingContext2D;
    /** The camera `draw`, `project`, `ground` and `pick` use: change it freely between draws. */
    cam: DioramaCamera;
    /** The last draw: faces, shadows, points, verts, objects on (matrices computed; `off` subtrees left out), and entries dropped (over maxFaces). */
    stats: {
        faces: number;
        shadows: number;
        points: number;
        verts: number;
        objects: number;
        dropped: number;
    };
    /** Add an object (`DioramaObjectDef`); returns its live handle. Throws past `maxVerts`. */
    add: (d: DioramaObjectDef) => DioramaObject;
    /** The object named `id`. */
    get: (id: string) => DioramaObject | undefined;
    /** Rest `ob` on `parentId` (null: on nothing); its `pos` is from then on from the new parent's top. */
    on(ob: DioramaObject, parentId: string | null): void;
    /** Remove every object, cluster, decal and point pool (meshes stay cached). */
    clear: () => void;
    /** Name a cluster: `{ fixed: n }` draws before every unfixed one, in n order (a room, a table);
     *  `{ at: [x, y, z] }` ranks it far to near by that point. Redefining one keeps its objects. */
    cluster: (name: string, c: {
        fixed?: number;
        at?: ArrayLike<number>;
    }) => void;
    /** Paint `fn(ctx)` in the sort: in `cluster` at `layer`, behind that layer's faces, or by the
     *  depth of `at` (read each draw) among them. */
    decal(cl: string, layer: number, fn: (ctx: CanvasRenderingContext2D) => void, at?: ArrayLike<number> | null): void;
    /** A fixed pool of points (sparks, shells, smoke) drawn in the depth sort (`DioramaPoints`). */
    points(p: PointsOptions): DioramaPoints;
    /** Set the light's direction (towards it) and the ambient level. */
    setLight: (v: ArrayLike<number>, a?: number) => void;
    /** Size the backing store: CSS width and height and the density (no arguments: the canvas's
     *  client size and devicePixelRatio, capped at `maxDpr`; a layout read, so call it after a resize). */
    resize: (w?: number, h?: number, r?: number) => void;
    /** Frame `points` ([x, y, z, …], world) inside the safe rect: sets c.dist, then c.ox and c.oy so
     *  the points' screen box is centred in it. Uses c's yaw, pitch, target and fov; returns c. */
    fit: (c: DioramaCamera, pts: ArrayLike<number>, s: SafeRect) => DioramaCamera;
    /** Hold `c` (default `cam`) inside the limits; returns c. */
    clamp: (l: CameraLimits, c?: DioramaCamera) => DioramaCamera;
    /** Draw the frame: matrices, sort, paint, then `overlay`. */
    draw: () => void;
    /** The front-most pickable object under (x, y) (CSS px), as of the last draw, or null. */
    pick: (x: number, y: number) => DioramaObject | null;
    /** Where the ray under (x, y) meets the plane y = planeY: out = [x, y, z]; false if it never does. */
    ground: (x: number, y: number, py: number, out: {
        [i: number]: number;
    }) => boolean;
    /** World (x, y, z) to screen: out = [x, y, depth]; false when behind the camera. */
    project(x: number, y: number, z: number, out: {
        [i: number]: number;
    }): boolean;
    /** The camera's world position (the eye): out = [x, y, z]; returns out. */
    eye<T extends {
        [i: number]: number;
    }>(out: T): T;
    /** Screen px per world unit at depth 1 (a size s at depth z is s × focal() / z px). */
    focal: () => number;
    /** Call fn on every object (recolour on a theme change, find parts). */
    recolor(fn: (ob: DioramaObject) => void): void;
    /** The nearest ancestor with a `tag` (or the top of the chain): what a pick on a part belongs to. */
    root(ob: DioramaObject | null): DioramaObject | null;
    /** CSS width, as last sized. */
    readonly width: number;
    /** CSS height, as last sized. */
    readonly height: number;
    /** Device pixels per CSS px. */
    readonly dpr: number;
};
/** What `diorama` returns. */
export type Diorama = ReturnType<typeof diorama>;
/** Options for `occlude`: the objects that may stand in the way and how they fade. */
export interface OccludeOptions {
    /** Root objects (no `on`) whose boxes (`size` from `pos`, turned by `rot[1]`) can hide the targets. */
    objects: DioramaObject[];
    /** The alpha of an object in the way (default 0.16). */
    ghost?: number;
    /** Seconds a full fade takes (default 0.15). */
    t?: number;
    /** Reduced motion: snap instead of fading (also a live field on the result). */
    reduced?: boolean;
    /** A box met within this distance of a target is touching it, not in the way (default 0). */
    near?: number;
}
/** Fade what stands between the eye and the targets (a chase camera in a town): each `step(dt, pts)`
 *  casts rays from `d.eye()` to every target point (`pts`: [x, y, z, …], world; `n` of them, default
 *  all) against each object's box; one in the way eases its `alpha` toward `ghost`, one the eye is
 *  inside toward 0, the rest back to 1. Returns true while anything is still fading (keep the engine
 *  awake). Writes `alpha` only (render side, never the sim). Boxes off the bounds of the eye and the
 *  targets are skipped; `tested` counts the boxes ray-tested in the last step. No allocation per step. */
export declare function occlude(d: Diorama, o: OccludeOptions): {
    reduced: boolean;
    tested: number;
    step(dt: number, pts: ArrayLike<number>, n?: number): boolean;
};
