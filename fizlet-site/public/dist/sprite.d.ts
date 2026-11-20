/**
 * @fzlt/core/sprite: the character layer's drawing primitive. Pixel-art sprites written as data (rows of
 * characters + a colour map whose values can be palette roles), baked once per (sprite, frame,
 * scale, palette) into a bounded cache, then blitted with one drawImage. `spriteSVG()` / `spriteURL()`
 * give the same pixels as an SVG for characters that live in the page instead of on a canvas; they
 * stand alone, so a page that only places SVG characters never ships the canvas half.
 */
/** A colour for a character: a hex, or a role name (`team`, `enemy`, `hazard`…) a palette fills. */
export type Paint = string;
/** One sprite as data: its frames as rows of characters, the colour or role of each character, its
 *  pivot and an optional outline. */
export interface SpriteDef {
    /** Rows of characters, one per pixel (one frame), or a list of those (an animation). */
    frames?: string[] | string[][];
    /** Character → colour or role. Any character not listed is empty (use `.` by convention). */
    colors?: Record<string, Paint>;
    /** Pivot in sprite pixels (default: the centre). Draw places it at (x, y) and rotates about it. */
    ax?: number;
    ay?: number;
    /** A 1px rim around the silhouette (colour or role): readable on light and dark pages. */
    outline?: Paint;
    /** Vector sprite instead of pixels: its size, frame count and a painter, baked like the rest. */
    w?: number;
    h?: number;
    n?: number;
    paint?: (c: CanvasRenderingContext2D, frame: number, color: (p: Paint) => string) => void;
}
/** Options for `sprites()`: the palettes and the size of the baked-tile cache. */
export interface SpriteOptions {
    /**
     * Palettes: role → hex. Index 0 is the default and fills roles the others leave out. The key `*`
     * paints every pixel one colour (a hit flash). Push more at runtime (max 32); `clear()` after
     * changing one in place.
     */
    palettes?: Record<string, string>[];
    /** Max baked tiles kept (default 256). The oldest is dropped when a new one is baked. */
    cap?: number;
    /** Tile factory (default: OffscreenCanvas, else a detached canvas). */
    canvas?: (w: number, h: number) => OffscreenCanvas | HTMLCanvasElement;
}
type Tile = OffscreenCanvas | HTMLCanvasElement;
type Palettes = Record<string, string>[];
/** One sprite as an SVG string (crisp at any size), for characters placed in the page. Frames wrap. */
export declare function spriteSVG(d: SpriteDef, frame?: number, palettes?: Palettes, palette?: number): string;
/** `spriteSVG()` as a data URL, for an `<img src>` or a CSS background. */
export declare const spriteURL: (d: SpriteDef, frame?: number, palettes?: Palettes, palette?: number) => string;
/** Frames ≤ 64, palettes ≤ 32 and baked scales 1–8 per sprite: the cache key is one small integer. */
export declare function sprites<K extends string>(defs: Record<K, SpriteDef>, o?: SpriteOptions): {
    ids: Record<K, number>;
    /** Width and height of each sprite in sprite pixels (outline not included), by id. */
    w: Float64Array<ArrayBuffer>;
    h: Float64Array<ArrayBuffer>;
    palettes: Record<string, string>[];
    tile: (id: number | K, frame?: number, scale?: number, palette?: number) => Tile;
    /**
     * Draw sprite `id` (number from `ids`, or its name) with its pivot at (x, y), turned by `angle`
     * radians, `scale` pixels per sprite pixel. Bakes on the first call; after that, no allocation.
     * An id that names no sprite throws a RangeError (as `tile` does).
     */
    draw(ctx: CanvasRenderingContext2D, id: number | K, frame: number, x: number, y: number, angle?: number, scale?: number, palette?: number): void;
    /** Baked tiles kept now. */
    readonly size: number;
    /** Tiles baked so far (cache misses). Flat in a steady scene. */
    readonly baked: number;
    /** Drop every baked tile (after changing a palette in place). */
    clear(): void;
};
/** The sprite set `sprites()` returns: `draw()` blits a baked frame. */
export type Sprites = ReturnType<typeof sprites>;
export {};
