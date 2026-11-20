import type { Engine } from "./kernel/engine.js";
import type { FizEvent } from "./kernel/ring.js";
import type { BoardPage } from "./board-page.js";
import type { Controls } from "./input.js";
import type { Cue } from "./sound.js";
export { skirmishHud } from "./arcade-skirmish.js";
export type { SkirmishOptions, SkirmishReadout } from "./arcade-skirmish.js";
/** Controls and view, written once per frame in the read phase (a step reads them): mode (0 keys or
 *  stick, 1 pointer), pointer x, y and on, move x, y (-1..1), fire, viewport width and height, and
 *  reduced motion (1/0). The game writes TARGET_HP: the full health of a target, for its paint. */
export declare const MODE = 0, PX = 1, PY = 2, PON = 3, KX = 4, KY = 5, FIRE = 6, VW = 7, VH = 8, CALM = 9, TARGET_HP = 10;
/** One action key: the intent it drives, its keyboard code and its scoreboard text. */
export interface ArcadeAction {
    /** The controls intent: `ctx.input.hit(id)` in a step. */
    id: string;
    /** KeyboardEvent.code, e.g. "KeyB". */
    key: string;
    /** Scoreboard key text, e.g. "B · Cover". */
    label: string;
}
/** Where a run is: idle, running, paused, won, game over or destroyed. */
export type ArcadeStatus = "idle" | "running" | "paused" | "won" | "gameover" | "destroyed";
/** Options for `arcade()`: the board and its selectors, theme, seed, reduced motion, sound and
 *  controls, and the `onState` / `onEvent` / `onError` hooks. */
export interface ArcadeOptions<S> {
    /** The board: a selector or an element (default document.body). */
    root?: string | Element;
    textSelector?: string;
    targetSelector?: string;
    excludeSelector?: string;
    /** "system" (default) follows the visitor's colour scheme. */
    theme?: "dark" | "light" | "system";
    seed?: number;
    reducedMotion?: boolean;
    /** Start with sound on (default true; it waits for a gesture to unlock). */
    sound?: boolean;
    /** "keyboard": the mouse never steers. */
    controls?: "mouse" | "keyboard";
    onState?: (state: ArcadeSnapshot<S>) => void;
    onEvent?: (event: {
        type: string;
        game: string;
        [key: string]: unknown;
    }) => void;
    onError?: (error: unknown) => void;
}
/** What the controller reports about a run: its status, time and frame cost, plus the game's own state. */
export type ArcadeSnapshot<S> = Partial<S> & {
    id: string;
    status: ArcadeStatus;
    elapsed: number;
    frameMs: number;
    maxFrameMs: number;
    notice: string;
    /** Letters indexed, on screen and spent, and the range reads the last measurement made. */
    board?: {
        indexed: number;
        visible: number;
        spent: number;
        measurements: number;
    };
    /** Sparks alive (at most 100). */
    particles?: number;
};
/** The controller `arcade()` returns: start, pause, resume, stop and destroy a run, and read its snapshot. */
export interface ArcadeController<S> {
    start(): ArcadeSnapshot<S>;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): void;
    getSnapshot(): ArcadeSnapshot<S>;
}
/** What `create` gets: the run's engine and board, the controls, and the shell's presentation. */
export interface ArcadeContext {
    engine: Engine;
    board: BoardPage;
    input: Controls;
    /** MODE … TARGET_HP (see the constants). */
    ctl: Float64Array;
    reduced(): boolean;
    /** A popup at (x, y): `+value` when `text` is null (stacked with nearby ones), else the text.
     *  Tone 0 score, 1 accent (upgrade), 2 hurt. Call it from render (react). */
    popup(x: number, y: number, value: number, text: string | null, tone?: 0 | 1 | 2): void;
    /** n sparks from (x, y) in colour `c` (an index into `colors`); none under reduced motion. */
    spark(x: number, y: number, n: number, c: number): void;
    /** A line in the comms toast. */
    say(text: string, ms?: number): void;
    /** onEvent for the hub (a plain object: call it from render, not a step). */
    emit(type: string, data?: Record<string, unknown>): void;
    /** In-page art: a shadow root in an overlay inside `el` (an absolutely positioned host that
     *  follows the page's layout, scrolling and transforms natively). A static `el` becomes
     *  relative. Through the ledger: Recall removes it and puts the style back. Call from create
     *  or reset (it reads computed style), never from a step. Null for replaced elements. */
    attach(el: Element): ShadowRoot | null;
}
/** One run of your game, as the shell drives it: reset, draw, the HUD and meter, page scroll,
 *  reactions to events, stats, and whether the run is over. */
export interface ArcadeGame<S> {
    /** A fresh run (the viewport is in ctl[VW], ctl[VH]). */
    reset(): void;
    /** 0 playing, 1 lost, 2 won: read every render; the run ends the frame it turns non-zero. */
    over(): number;
    /** The page scrolled by (dx, dy): move page-space things (read phase). */
    scroll?(dx: number, dy: number): void;
    /** Each event on the ring this frame (render): popups, sparks, the toast, onEvent. */
    react?(ev: FizEvent): void;
    /** Draw on the canvas (render), after the target beacons, before sparks and popups. */
    draw(ctx: CanvasRenderingContext2D, dt: number): void;
    /** The readout values, in `readouts` order, then the meter's change key (render, change-only). */
    hud(out: Float64Array): void;
    /** The meter's left text, right text and fill 0..1, when its change key moved. */
    meter?(): readonly [string, string, number];
    /** The snapshot's game fields (not a hot path). */
    stats(): S;
}
/** Your game for `arcade()`: its id, title, accent, hint, CSS, actions, readouts, sound cues and
 *  `create()`, which makes a run. */
export interface ArcadeDef<S> {
    id: string;
    title: string;
    /** The game's accent (hex): title, meter, popups, target paint at full health. */
    color: string;
    hint: string;
    touchHint?: string;
    /** The Board UI kit CSS text (the game bakes in the sections it uses). */
    css: string;
    /** Hold Space / the pointer to fire; a Fire key on the touch pad and an Auto fire key. */
    fire?: boolean;
    actions?: ArcadeAction[];
    /** Touch move control (default "stick"; "dpad" for grid games). */
    pad?: "stick" | "dpad";
    /** Keys (or the stick) only: the mouse never steers. */
    keyboard?: boolean;
    /** The card's readouts: label, tone, how the value shows, and whether it hides when the board is
     *  folded. A preset with its own readouts (skirmish) leaves this out. */
    readouts?: [label: string, tone?: "team" | "enemy" | undefined, fmt?: ((v: number) => string) | undefined, fold?: boolean | undefined][];
    meter?: {
        label: string;
    };
    /** Spark colours, by index. */
    colors: string[];
    /** Event type → sound cue. */
    cues: Record<string, Cue>;
    /** Paint targets with their health (default true). */
    paint?: boolean;
    /** The scoreboard and controls: a HUD preset (default `arcadeHud()`, today's card). */
    hud?: ArcadeHud;
    create(ctx: ArcadeContext): ArcadeGame<S>;
}
/** A HUD preset: its CSS (after the game's kit CSS) and a mount, once per run. */
export interface ArcadeHud {
    css: string;
    /** Extra controls intents the HUD drives (e.g. aim toggles): intent → key codes. */
    keys?: Record<string, string[]>;
    mount(run: HudRun): HudView;
}
/** What the shell gives a HUD when a run starts. */
export interface HudRun {
    /** The kit root (`.bui`), the canvas already in it. */
    ui: HTMLElement;
    def: ArcadeDef<any>;
    engine: Engine;
    input: Controls;
    /** A coarse pointer: build the touch pad. */
    coarse: boolean;
    /** The game, once `create` returned: read it in `write`, never in `mount`. */
    game: ArcadeGame<any>;
    /** Sound (a scoreboard key flips `on`). */
    sfx: {
        on: boolean;
    };
    /** Aborts at Recall: the overlay's life. */
    signal: AbortSignal;
    status(): ArcadeStatus;
    /** Moves the run, for a HUD that owns its flow (`ask`), once its phase changed: pause, resume,
     *  the end (won, lost), a rematch (restart) or Recall (exit). */
    go(to: ArcadeFlow | "restart" | "exit"): void;
}
/** A change in a run's flow the HUD is told about: paused, resumed, won or lost. */
export type ArcadeFlow = "pause" | "resume" | "won" | "lost";
/** A mounted HUD. Keys are `button[data-a]` (sound, pause, exit, restart, gate, auto, fold, or the
 *  HUD's own) and `button[data-act]` (an action): the shell runs them, then calls `key`. */
export interface HudView {
    /** The comms toast. */
    msg: HTMLElement;
    /** Every render and once at start: change-only writes, nothing allocated in the steady state. */
    write(): void;
    /** The status changed: the pause key, overlays. */
    sync(): void;
    /** A scoreboard key ran: repaint its face (`auto`: auto fire is on). */
    key(a: string, b: HTMLElement, auto: boolean): void;
    /** At start, in place of starting the engine: a countdown that calls `go` when it is done. */
    begin?(go: () => void): void;
    /** Before the engine goes at the end of a run (its ledger takes back what went through it). */
    hold?(): void;
    /** The run ended and the page is back: show the result. */
    end(won: boolean, notice: string, stats: Record<string, unknown>): void;
    /** The HUD owns the phase (skirmish: `@fzlt/core/match`): the shell's pause, resume and end are asked of
     *  it, and it answers with `HudRun.go` (one owner; the shell keeps the keys and delegates). */
    ask?(to: ArcadeFlow): void;
}
/** Options for the default HUD: which header keys and which nav keys, in order. */
export interface ArcadeHudOptions {
    /** Header keys, in order (default all four). */
    header?: ("sound" | "pause" | "fold" | "exit")[];
    /** The nav row after the action keys (default all three; `auto` needs `fire`). */
    nav?: ("next" | "restart" | "auto")[];
}
/**
 * The `arcade` preset, the default: one card with the title, sound / pause / fold / exit keys,
 * the readouts, one meter, the nav row (actions, Next gate, Restart, Auto fire) and the toast;
 * phones get the pad and the card folded at the top. `arcadeHud()` renders exactly what leaving
 * `hud` out renders. Values: `hud(out)` fills the readouts in order, then the meter's change key.
 */
export declare function arcadeHud(o?: ArcadeHudOptions): ArcadeHud;
/** The shell every page arcade game repeats: one engine per run over the host page (its words are
 *  terrain, its buttons targets), a Board UI overlay with a canvas and scoreboard, input, sound and
 *  the run's flow. `def` is only the game's rules and art. */
export declare function arcade<S>(def: ArcadeDef<S>, options?: ArcadeOptions<S>): ArcadeController<S>;
