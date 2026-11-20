/**
 * Board UI kit: the tiny behaviour half of board-ui.css. No dependencies, no globals, every
 * listener bound to the caller's AbortSignal. Spec: board-ui/BOARD-UI.md.
 */
/** The only per-game input: a palette. Any key left out keeps the kit default. */
export type Palette = Partial<{
    bg: string;
    surface: string;
    raised: string;
    card: string;
    ink: string;
    muted: string;
    line: string;
    rim: string;
    sys: string;
    cmd: string;
    fire: string;
    aim: string;
    attack: string;
    advance: string;
    fallin: string;
    flag: string;
    go: string;
    teamA: string;
    teamB: string;
    hurt: string;
    critical: string;
    /** Text / thin-line twins for the light theme (defaults to the face colour). */
    sysInk: string;
    cmdInk: string;
    fireInk: string;
}>;
/**
 * Mount a board inside a shadow root on `host`, isolated both ways: the kit can't touch the page
 * and the page's CSS (a global `button {}` rule, a reset) can't touch the board. Pass the kit CSS
 * text (e.g. `import css from "board-ui/board-ui.css?raw"`). Returns the `.bui` root to build in.
 * Stylesheet ownership: the kit owns one constructed sheet per CSS text (keyed by the text), so
 * games composed independently with different CSS each get their own, and boards with the same
 * text share one. Treat it as read-only; it is appended to the shadow root's adoptedStyleSheets,
 * never replacing sheets you adopted there yourself.
 */
export declare function mount(host: HTMLElement, css: string, opts?: {
    theme?: "dark" | "light";
    side?: 0 | 1;
    palette?: Palette;
}): HTMLDivElement;
/** Paint a board: sets the palette's CSS variables on the .bui root. Invalid colours are ignored
 *  (an embed config can never inject CSS). Returns a function that restores the old values. */
export declare function applyPalette(root: HTMLElement, palette: Palette): () => void;
/** Readouts (BOARD-UI.md section 18): a `.bui-readouts` group of `[label, tone?]` items, appended to
 *  `parent`. Returns the value elements in order, for @fzlt/core/hud (or your own change-only writes).
 *  Text is set with textContent. The caller owns the group: add it through the engine's ledger. */
export declare function readouts(parent: HTMLElement, items: [label: string, tone?: "team" | "enemy"][], onMap?: boolean): {
    group: HTMLDivElement;
    values: HTMLElement[];
};
/**
 * A press that fires once per touch, mouse or keyboard activation, and never loses to a second
 * finger already on the stick. Touch fires on touchstart (no 300ms wait); the click that may
 * follow an uncancellable touch is skipped. Run your state change and repaint synchronously in
 * fn: a frame between release and the new pressed state makes the key bounce.
 */
export declare function press(el: HTMLElement, fn: () => void, signal: AbortSignal): void;
/**
 * The press cue for page keys (`.bui-key`, links and buttons) under `root`. Mouse and touch press
 * through CSS `:active`; this adds the rest: keyboard Enter (and Space on a button) shows the
 * pressed face (`.down`) until the key is released or loses focus, and one passive touchstart
 * listener lets iOS Safari apply `:active` at all. Activation stays native (click, navigation).
 */
export declare function pressCue(root: HTMLElement | Document, signal?: AbortSignal): void;
/** localStorage key of the Settings "Performance overlay" switch (off by default). */
export declare const PERF_KEY = "dom-virus:perf";
/**
 * A Settings switch: a key that is `aria-pressed` (the kit's locked state) while on, remembered
 * in localStorage under `key` as "1" / "0". Storage that throws (private mode, blocked cookies,
 * a sandboxed frame) is ignored: the switch still works, it just forgets. `change` runs once
 * with the stored value and on every flip; `set(on)` flips it from code (a keyboard shortcut).
 * Example: `setting(btn, PERF_KEY, (on) => overlay.show(on), signal)` with `@fzlt/core/perf`.
 */
export declare function setting(button: HTMLElement, key: string, change: (on: boolean) => void, signal: AbortSignal, fallback?: boolean): {
    readonly on: boolean;
    set: (next: boolean, save?: boolean) => void;
};
/** Restart an overlay sticker's slam and press (on every entry, and on return to a hidden tab). */
export declare function slam(sticker: HTMLElement | null): void;
/** Show the comms toast for a while (it never stacks: a new line replaces the old). */
export declare function toast(el: HTMLElement, text: string, ms?: number): void;
/**
 * The launch burst: the key presses into its base and flips to its inverse, then shatters into
 * spinning chunks with a flash, a round shock ring and square debris that falls away (the hub
 * hero's explosion). The action runs synchronously in the click (mobile full screen keeps its
 * user activation); the burst lives on <body>, so the layout the action causes can't move it.
 * Never cancel a burst from the action itself (see BOARD-UI.md, "reset cancels the burst").
 */
export declare function launch(button: HTMLElement, action: () => void, opts?: {
    reduced?: boolean;
    tones?: string[];
    done?: () => void;
}): void;
