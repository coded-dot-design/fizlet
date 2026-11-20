import type { ArcadeHud } from "./arcade.js";
/** One readout on the skirmish bar: its label, how the value shows and its tone. */
export interface SkirmishReadout {
    label: string;
    /** How the value shows: `num` (default) 12 · `clock` 3:05 from seconds · `rank` #2 · `pct` 75%
     *  from 0..1 · `bar` a meter from 0..1 (armor, health). */
    kind?: "num" | "clock" | "rank" | "pct" | "bar";
    tone?: "team" | "enemy";
    /** A bar: class `low` at or under this (0..1). */
    low?: number;
}
/** Options for the `skirmish` HUD preset: its readouts, header and nav keys, feed, banner, overlays,
 *  result, aim toggles and key counts. */
export interface SkirmishOptions {
    /** Readouts, in the order `hud(out)` fills them. */
    readouts: SkirmishReadout[];
    /** Header keys, in order (default full screen, sound, pause, exit; `fold` hides the title and the
     *  text keys). Full screen shows only where the page may use it. */
    header?: ("fullscreen" | "sound" | "pause" | "fold" | "exit")[];
    /** Text keys after the actions, as on the card (default none): `next` (Next gate, G), `restart`,
     *  `auto` (Auto fire: needs `fire`). */
    nav?: ("next" | "restart" | "auto")[];
    /** A feed of the last `rows` (default 4) events of type `on`, newest first. */
    feed?: {
        rows?: number;
        on: string;
        line: (a: number, b: number) => string;
    };
    /** A centred banner (title, sub) on each event of type `on`. */
    banner?: {
        on: string;
        text: (a: number, b: number) => readonly [string, string?];
    };
    /** Overlays (default all four; @fzlt/core/match runs the flow either way). `countdown` holds the start
     *  for 3, 2, 1 on the flow's clock; without `pause` or `result` that phase shows no overlay; without
     *  `surrender` the pause card has no SURRENDER key. */
    overlays?: ("pause" | "surrender" | "countdown" | "result")[];
    /** The result card: `stats()` keys to list, and the one whose best is kept on this device. */
    result?: {
        stats: string[];
        best?: string;
    };
    /** Aim toggles: the intents `aim-auto` and `aim-lock` (`ctx.input.down("aim-lock")`). */
    aim?: ("auto" | "lock")[];
    /** Counted keys: action id → the `hud(out)` slot of its count, a badge on its keys. */
    counts?: Record<string, number>;
}
/**
 * The `skirmish` preset (Battlefield Blitz): `hud: skirmishHud({ readouts: [{ label: "Kills",
 * tone: "team" }, { label: "Time", kind: "clock" }, { label: "Armor", kind: "bar", low: 0.3 }] })`.
 * `hud(out)` fills the readouts in order, then any count slots.
 */
export declare function skirmishHud(o: SkirmishOptions): ArcadeHud;
