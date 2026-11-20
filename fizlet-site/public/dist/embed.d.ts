/**
 * @fzlt/core/embed: drop a game onto any page with one small config.
 *   palette   - hex colours for the Board UI roles (anything else is ignored: no CSS injection)
 *   easterEgg - false: open now. true / {...}: stay dormant (tiny listeners only) until a trigger
 *               (key sequence, gesture on a selector, click on a selector), then lazy-load the game.
 *   toggle    - a floating key to reopen / close once unlocked. Escape closes and restores the page.
 * Lifted from Swarm Protocol's loader: keys typed in fields never count, only a position and a
 * timestamp are kept for the sequence (never the typed text), and destroy() removes everything.
 */
import { type Palette } from "./ui/board-ui.js";
type Scope = "desktop" | "mobile" | "all";
/** What wakes a dormant embed: a key sequence (`"konami"` or your own keys), a gesture or a click on
 *  a selector, each limited to desktop, mobile or all; `toggle` adds the on-page toggle key. */
export interface EasterEgg {
    sequence?: "konami" | string[] | false;
    gesture?: {
        on: string;
        type: "hold-tap" | "double-tap" | "long-press";
    } | false;
    click?: string | false;
    scope?: {
        sequence?: Scope;
        gesture?: Scope;
        click?: Scope;
    };
    toggle?: boolean;
}
/** The one config an embed takes: its name, the toggle label, the Board UI palette and the easter egg. */
export interface EmbedConfig {
    /** Short id: data-<name>-trigger / data-<name>-ignore, the toggle label. */
    name: string;
    /** Label on the toggle key (default: name). */
    label?: string;
    palette?: Palette;
    easterEgg?: boolean | EasterEgg;
    /** With no easter egg: open right away (default) or wait closed behind the toggle key. */
    open?: boolean;
}
/** A mounted game: `destroy()` removes it and gives the page back. */
export interface Mounted {
    destroy(): void;
}
/** Your game's mount function: draws the game into `host` and returns it as `Mounted`. */
export type Mount = (host: HTMLElement, config: EmbedConfig) => Mounted;
/** Drop a game onto the page: `load` is called (and awaited) only when the game opens, at once or when
 *  the easter egg fires. Returns the controls: `open()`, `close()`, `unlock()`, `opened`, `unlocked`
 *  and `destroy()`. */
export declare function embed(load: () => Promise<Mount> | Mount, cfg: EmbedConfig): {
    open: () => Promise<unknown>;
    close: () => void;
    unlock: () => void;
    readonly opened: boolean;
    readonly unlocked: boolean;
    /** Remove every listener, the toggle and the game (the game restores the page). */
    destroy(): void;
};
export {};
