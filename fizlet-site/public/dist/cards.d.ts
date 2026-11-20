/**
 * @fzlt/core/cards: a deck of cards for tabletop games. Cards are numbers 0..size−1 (the game says
 * what each one is); every card is in exactly one pile, at one place in it, face up or down.
 * `shuffle(pile, seed)`, `draw`, `deal` to hands, `move`, `flip`, `gather` piles back.
 * - The shuffle is a Fisher-Yates over a 32-bit integer generator with rejection sampling (no
 *   modulo bias), so the same seed gives the same order in every browser: both online players see
 *   the same deck.
 * - Each change stamps the card with the deck's clock, so a drawing helper animates the moves in
 *   the order they were made.
 * - `dioramaCards` builds the deck into an `@fzlt/core/diorama` scene: each card a thin card-shaped
 *   prism with its face or back painted on the side that looks at the camera (by your callbacks:
 *   the game paints its own art), laid out per pile as a stack, a row on the table, or a hand fanned
 *   toward the camera; moves fly in arcs, flips turn over, staggered in move order. `pick` names
 *   the card under a point.
 * No allocation per deck operation, `show()` or draw in the steady state.
 */
import type { Diorama, DioramaObject } from "./diorama.js";
/** Options for `deck()`: how many cards and the piles. */
export interface DeckOptions {
    /** Cards (default 52). */
    size?: number;
    /** The piles: a count, or their names for `id` (default ["draw"]). Pile 0 holds the deck at first. */
    piles?: number | string[];
}
/** A deck of `size` cards in piles. Read `pile`, `pos`, `up` per card and `count`/`at` per pile. */
export declare function deck(o?: DeckOptions): {
    /** Cards. */
    size: number;
    /** Piles. */
    piles: number;
    /** Per card: its pile. */
    pile: Uint8Array<ArrayBuffer>;
    /** Per card: its index in the pile (0 is the bottom). */
    pos: Uint16Array<ArrayBuffer>;
    /** Per card: 1 face up. */
    up: Uint8Array<ArrayBuffer>;
    /** Per card: the clock when it last moved or flipped. */
    stamp: Uint32Array<ArrayBuffer>;
    /** Moves and flips so far (each one stamps its card with the next tick). */
    clock: number;
    /** Changes so far (a shuffle counts one): a drawing helper re-lays the piles when it changes. */
    ver: number;
    /** A pile's index by name (−1 if none). */
    id: (name: string) => number;
    /** Cards in pile p. */
    count: (p: number) => number;
    /** The card at index i of pile p (0 the bottom; −1 the top, −2 under it, …), or −1. */
    at(p: number, i: number): number;
    /** The top card of pile p, or −1. */
    top: (p: number) => number;
    /** Every card back in pile 0, in order 0..size−1, face down (or up: `face` 1). */
    reset: (face?: number) => void;
    /** Move card c to pile `to` at index `at` (default: on top), face up (1), down (0) or as it is (−1). */
    move: (c: number, to: number, at?: number, face?: number) => number;
    /** Move the top `n` cards of `from` to `to`, one by one (the top first), face as given; returns
     *  the last card moved, or −1 if `from` ran out first. */
    draw(from: number, to: number, n?: number, face?: number): number;
    /** Deal `each` cards from `from` to each pile in `to`, round by round, face as given; returns the
     *  cards dealt (fewer if `from` ran out). */
    deal(from: number, to: ArrayLike<number>, each?: number, face?: number): number;
    /** Move every card of `from` onto `to` (keeping their order), face as given. */
    gather(from: number, to: number, face?: number): void;
    /** Turn card c over (or set it: 1 up, 0 down). */
    flip(c: number, face?: number): void;
    /** Shuffle pile p from `seed` (any 32-bit integer): the same seed, the same order, everywhere. */
    shuffle(p: number, seed: number): void;
};
/** What `deck` returns. */
export type Deck = ReturnType<typeof deck>;
/** How one pile lies on the table: a `stack`, a `row`, or a `fan` (a hand held up to the camera). */
export interface PileLayout {
    /** `stack` (default): squared up, one on another; `row`: side by side; `fan`: a hand. */
    type?: "stack" | "row" | "fan";
    /** Centre on the board, x. */
    x?: number;
    /** Centre on the board, z. */
    z?: number;
    /** Turn (diorama `rot[1]`, radians); a fan's default is the camera's yaw, so it faces the camera. */
    a?: number;
    /** row: centre to centre (default 1.15 × the card's width). */
    gap?: number;
    /** fan: how far the hand leans up toward the camera (radians, default 0.9). */
    tilt?: number;
    /** fan: the angle between cards (radians, default 0.13; the whole fan stays within 1.3). */
    spread?: number;
    /** fan: the fan's radius (default 2.2 × the card's height). */
    radius?: number;
    /** fan: how high its centre is held (default: just clear of the table). */
    lift?: number;
}
/** Options for `dioramaCards`: the table, sizes, art callbacks, layouts and timing. */
export interface DioramaCardsOptions {
    /** The id of the object the cards lie on (the table): layouts are from its top centre. */
    on: string;
    /** Card width and height, world units (default [1, 1.4]). */
    size?: ArrayLike<number>;
    /** Thickness (default 0.012). */
    thick?: number;
    /** One layout per pile (missing: a stack at the centre). */
    piles?: PileLayout[];
    /** Paint card c's face into the box (0, 0)–(art[0], art[1]), its top edge at y = 0. */
    face: (ctx: CanvasRenderingContext2D, card: number) => void;
    /** Paint its back (default: a plain back in `back`). */
    back?: ((ctx: CanvasRenderingContext2D, card: number) => void) | null;
    /** The art box (default [100, 140]). */
    art?: ArrayLike<number>;
    /** The card's edge colour (default `#f4efe4`). */
    color?: string;
    /** The default back's colour (default `#2d4f8f`). */
    backColor?: string;
    /** Seconds per move (default 0.42); a flip in place takes 0.8 of it. */
    dur?: number;
    /** Seconds between moves made at once (a deal) (default 0.09). */
    stagger?: number;
    /** How high a moving card arcs (default 0.9). */
    arc?: number;
    /** Blob shadow strength (default 0.22). */
    shadow?: number;
    /** Ids start with this: card c is `${id}${c}` (its group, tagged { card: c }) and `${id}${c}b` (default "card"). */
    id?: string;
    /** false (reduced motion): cards jump to where they go. */
    motion?: boolean;
}
/** Build deck `k` into diorama `d`. `show(t)` (t: a running clock in seconds) before each `d.draw()`;
 *  true while any card still moves. */
export declare function dioramaCards(d: Diorama, k: Deck, o: DioramaCardsOptions): {
    /** Each card's group (moved by `show`; tagged { card }). */
    groups: DioramaObject[];
    /** Each card's body (recolour its edge). */
    bodies: DioramaObject[];
    /** Pose every card at t (seconds, a running clock); true while any card still moves. */
    show(t: number): boolean;
    /** The card under (x, y) (CSS px) as of the last draw, or −1. */
    pick(x: number, y: number): number;
    /** Lay every pile out again now (after turning the camera: fans face it). */
    relayout(): void;
    /** Card c's pose now: [x, y, z, tilt, yaw, fan, flip] in `out`. */
    pose(c: number, out: {
        [i: number]: number;
    }): {
        [i: number]: number;
    };
};
/** What `dioramaCards` returns. */
export type DioramaCards = ReturnType<typeof dioramaCards>;
