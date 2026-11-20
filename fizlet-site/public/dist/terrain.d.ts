import type { Diorama } from "./diorama.js";
/** Options for `terrain()`: the grid and its first heights. */
export interface TerrainOptions {
    /** Cells along x (vertices: cols + 1). */
    cols: number;
    /** Cells along z (vertices: rows + 1). */
    rows: number;
    /** A cell's side in world units (default 1). */
    cell?: number;
    /** World x of the first vertex (default: the grid centred on 0). */
    x0?: number;
    /** World z of the first vertex (default: centred). */
    z0?: number;
    /** Vertex heights, row by row along x ((cols + 1) × (rows + 1)); default all `base`. */
    heights?: ArrayLike<number>;
    /** The starting height (default 0). */
    base?: number;
    /** How each cell splits into two triangles: "fixed" (default) along (i, j)–(i + 1, j + 1) in every
     *  cell; "adaptive" along the diagonal with the smaller height difference (it follows a crest or a
     *  gully, so a sharp ridge reads as a straight fold, not stair-steps). The queries use the same split. */
    split?: "fixed" | "adaptive";
}
/** Options for `noise()`: seeded value noise in octaves, added to the heights. */
export interface NoiseOptions {
    /** The seed (an integer; the same seed, the same hills). */
    seed: number;
    /** Height of the tallest hill (default 1): the noise adds 0..amp. */
    amp?: number;
    /** World units between noise lattice points of the first octave (default 8). */
    scale?: number;
    /** Octaves (default 3), each half the size and `gain` the height of the last. */
    octaves?: number;
    /** Each octave's height over the last (default 0.5). */
    gain?: number;
    /** 0..1: sharp crests (dunes) instead of round hills (default 0). */
    ridge?: number;
    /** The wind's direction [x, z] (default [1, 0]): crests run across it. */
    wind?: ArrayLike<number>;
    /** How much longer the features are across the wind than along it (default 1; dunes ~3). */
    stretch?: number;
}
/** Options shared by the line stamps: width and a soft edge. */
export interface StampOptions {
    /** Full height across this width (default 2). */
    width?: number;
    /** Height of the stamp (default 1; negative digs). */
    height?: number;
    /** Fade out over this much past the width on each side (default 1). */
    edge?: number;
}
/** A heightfield: heights, the queries and the stamps. */
export type Terrain = ReturnType<typeof terrain>;
/** A heightfield of `cols` × `rows` cells: `h` holds the vertex heights; stamp it, query it, draw it. */
export declare function terrain(o: TerrainOptions): {
    /** Cells along x. */
    cols: number;
    /** Cells along z. */
    rows: number;
    /** A cell's side, world units. */
    cell: number;
    /** World x of vertex column 0 (`terrainWindow` moves it). */
    x0: number;
    /** World z of vertex row 0 (`terrainWindow` moves it). */
    z0: number;
    /** Vertex heights, (cols + 1) per row; write them freely, then bump `version`. */
    h: Float64Array<ArrayBuffer>;
    /** A painted kind per triangle (0: none), two per cell (the one with corner (i + 1, j) first; in an
     *  adaptive cell split along 10–01, the one with (i + 1, j + 1) first):
     *  `ribbon` paints the track; `terrainView` colours it; `sample` returns it. */
    kind: Uint8Array<ArrayBuffer>;
    /** The cells' split ("fixed" or "adaptive"): `terrainView` draws the same one by default. */
    split: string;
    /** Bumped by every stamp: a view re-reads its bounds when it changes. */
    version: number;
    /** The surface height under (x, z) (the drawn triangle's; outside the grid, its edge). */
    height: (x: number, z: number) => number;
    /** The face's unit normal under (x, z): out = [nx, ny, nz]; returns out. */
    normal<O extends {
        [i: number]: number;
    }>(x: number, z: number, out: O): O;
    /** Height and normal at once (what a wheel needs): out = [h, nx, ny, nz]; returns the face's kind. */
    sample(x: number, z: number, out: {
        [i: number]: number;
    }): number;
    /** The kind painted on the face under (x, z) (0: none). */
    kindAt: (x: number, z: number) => number;
    /** Vertex height at column i, row j. */
    at: (i: number, j: number) => number;
    /** Set every vertex: h = fn(x, z, h). */
    shape: (fn: (x: number, z: number, h: number) => number) => /*elided*/ any;
    /** Add seeded value noise (`NoiseOptions`): round hills, or ridged dunes with `ridge`, `wind`, `stretch`. */
    noise(n: NoiseOptions): /*elided*/ any;
    /** A round bump (or a dip, height < 0) of radius r at (x, z): smooth to its rim. */
    bump(x: number, z: number, r: number, height: number): /*elided*/ any;
    /** A jump ramp from `from` [x, z] rising to `height` at `to`, then falling back to the ground over
     *  `back` (default one cell: a sharp lip that throws a vehicle into the air). */
    ramp(from: ArrayLike<number>, to: ArrayLike<number>, so?: StampOptions & {
        back?: number;
    }): /*elided*/ any;
    /** `count` rolling humps (whoops) from `from` to `to`. */
    whoops(from: ArrayLike<number>, to: ArrayLike<number>, so?: StampOptions & {
        count?: number;
    }): /*elided*/ any;
    /** A banked turn along `points` [x0, z0, x1, z1, …]: a bowl across its width, rising toward
     *  `side` (1, the default: the right of the direction of travel, the outside of a left turn; −1
     *  the left). Past each end the bank keeps its cross-section and runs out to the ground over
     *  `edge` (no lump on the centre line beyond the ends). */
    berm(points: ArrayLike<number>, so?: StampOptions & {
        side?: number;
    }): /*elided*/ any;
    /** Carve a flat track along `points`: its cross-section level (at the height the ground had under
     *  each point, or `y`), blended into the ground over `edge`; paints `kind` on the faces whose centre is inside its width. */
    ribbon(points: ArrayLike<number>, so?: {
        width?: number;
        edge?: number;
        y?: number;
        kind?: number;
    }): /*elided*/ any;
};
/** Options for `terrainWindow()`: the window's grid, how far it slides, and the ground it shows. */
export interface TerrainWindowOptions {
    /** Cells along x (vertices: cols + 1). */
    cols: number;
    /** Cells along z (default `cols`). */
    rows?: number;
    /** A cell's side in world units (default 1). */
    cell?: number;
    /** Cells per slide (default 8): `follow` moves the window in whole steps. */
    step?: number;
    /** The cells' split, as `terrain()`'s (the queries and `terrainView` use it). */
    split?: "fixed" | "adaptive";
    /** Write the ground into the window: heights `t.h[j * (t.cols + 1) + i]` for every vertex i0..i1,
     *  j0..j1 (window indices, inclusive), and kinds (0: none) for every cell inside that range, if the
     *  game paints any. Vertex (i, j) is at lattice point (t.origin[0] + i, t.origin[1] + j), world
     *  ((t.origin[0] + i) × cell, (t.origin[1] + j) × cell). It must be a pure function of the place: a
     *  range can repeat one vertex row or column the window already holds. Only integers cross this call. */
    fill(i0: number, j0: number, i1: number, j1: number, t: TerrainWindow): void;
}
/** A terrain whose origin follows a point: what `terrainWindow` returns. */
export type TerrainWindow = Terrain & {
    /** The first vertex on the world lattice [i, j] (x0 = i × cell, z0 = j × cell). */
    origin: Int32Array;
    /** Moves so far (the first fill included); vertices `fill` was asked for so far. */
    stats: {
        slides: number;
        filled: number;
    };
    /** Put the first vertex at lattice point (i, j): keep the overlap, fill the rest. True if it moved. */
    moveTo(i: number, j: number): boolean;
    /** Keep (x, z) in the middle step: slide by whole steps when it leaves it. True if it slid. */
    follow(x: number, z: number): boolean;
};
/** An endless ground: a `terrain` of cols × rows cells that slides over the world lattice and asks
 *  `fill` only for the rows and columns it gains. The same queries (the same face rule) and the same
 *  `terrainView`; `version` bumps once per slide. The window decides no height (they come from `fill`),
 *  so where it sits is not game state. Nothing is filled until the first `follow` or `moveTo`. */
export declare function terrainWindow(o: TerrainWindowOptions): TerrainWindow;
/** Options for `terrainView`: colours, light, chunks and level of detail, how it sorts, shadows. */
export interface TerrainViewOptions {
    /** Colour by height: [[top, "#rrggbb"], …] low to high; a face takes the first band its mean
     *  height is under (the last above all). Default one sand colour. */
    bands?: ArrayLike<readonly [number, string]>;
    /** Faces steeper than this (1 − normal y, 0..1) take `steepColor` (default 0.35; 1: never). */
    steep?: number;
    /** The steep faces' colour (default: the first band's, darker). */
    steepColor?: string;
    /** Colours of painted kinds: kinds[0] is kind 1 (the ribbon's track). */
    kinds?: ArrayLike<string>;
    /** Towards the light (default diorama's [0.5, 1, 0.4]). */
    light?: ArrayLike<number>;
    /** Ambient light, 0..1 (default 0.56). */
    ambient?: number;
    /** Cells per chunk side, a power of two (default 8): the unit of culling and detail. */
    chunk?: number;
    /** Camera distances past which a chunk's drawn cell doubles: [30, 60] draws 1×, 2×, then 4×. */
    lod?: ArrayLike<number>;
    /** "ground" (default): every face before every object (a cluster fixed at `fixed`), exact among
     *  themselves; "depth": a cluster per chunk ranked by its far edge, so hills hide what is behind. */
    sort?: "ground" | "depth";
    /** The cluster name (default "terrain"; depth mode adds ":<chunk>"). */
    cluster?: string;
    /** Ground mode: its fixed rank (default 0). */
    fixed?: number;
    /** Its layer (default 0). */
    layer?: number;
    /** The cells' split as drawn (default the terrain's `split`); "adaptive" picks each drawn cell's
     *  diagonal along its smaller height difference, at every level of detail. */
    split?: "fixed" | "adaptive";
    /** Stroke each face in its own colour to close anti-aliasing seams (default true). */
    seams?: boolean;
    /** Blob shadows on the slope, set with `shadow(i, …)` (default 8). */
    shadows?: number;
    /** Shadow colour (default `#000000`). */
    shadowColor?: string;
    /** Faces fade into `color` with their distance in the floor plane from the camera's target (the
     *  player, under a chase camera): untouched before `from`, all `color` past `to` (16 steps between).
     *  Shadows are not hazed. */
    haze?: {
        from: number;
        to: number;
        color: string;
    };
}
/** What `terrainView` returns. */
export type TerrainView = ReturnType<typeof terrainView>;
/** Draw terrain `t` into diorama `d` as flat-shaded faces, painted inside `d.draw()` (decals in the
 *  sort): nothing to call per frame. Faces with a vertex behind the camera are dropped. */
export declare function terrainView(d: Diorama, t: Terrain, o?: TerrainViewOptions): {
    /** The last draw: faces painted, chunks on screen. */
    stats: {
        faces: number;
        chunks: number;
    };
    /** Chunks along x and z. */
    chunks: readonly [number, number];
    /** Chunk strides from the last draw (1: every cell; 2: every other…). */
    stride: Int32Array<ArrayBuffer>;
    /** Set shadow i: a disc of radius r at (x, z) on the ground, alpha a (0 hides it). */
    shadow(i: number, x: number, z: number, r: number, a: number): void;
    /** New colours (a theme change): bands, steep colour, kinds, haze (default the option's). */
    colors: (bands?: ArrayLike<readonly [number, string]>, steepColor?: string, kinds?: ArrayLike<string>, haze?: TerrainViewOptions["haze"] | null) => void;
    /** Project now (draw does it): after a camera change outside a draw, e.g. before `d.pick`. */
    update: () => void;
};
