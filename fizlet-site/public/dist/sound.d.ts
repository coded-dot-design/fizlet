/**
 * @fzlt/core/sound: the sound adapter. After each frame it reads the engine's event ring and plays the
 * mapped cues, so collisions and game events make sound without knowing about audio. The default
 * voice is a tiny synth (oscillators, no assets); pass `play` to use your own sounds.
 * Silent until the first trusted gesture, while paused, and when switched off.
 */
import type { Engine } from "./kernel/engine.js";
/** A built-in sound cue the synth can play. */
export type Cue = "fire" | "hit" | "boom" | "hurt" | "power" | "ready" | "win" | "end" | "click";
/** A cue name: a built-in Cue, or one of your own `notes`. */
export type CueName = Cue | (string & {});
/** One synth voice: pitch from → to (Hz) over `sec`, after `delay`, its wave and volume. */
export type Note = [from: number, to: number, sec: number, delay: number, wave: OscillatorType, vol: number];
/** Options for `sound()`: which event types play which cue, on or off, volume, or your own player. */
export interface SoundOptions {
    /** event type → cue, e.g. { shot: "fire", wreck: "boom" }. */
    cues: Record<string, CueName>;
    /** Your own cues for the built-in synth: name → voices (a name here wins over a built-in). */
    notes?: Record<string, Note[]>;
    /** Start switched on (default true). */
    on?: boolean;
    /** Master volume 0..1 (default 0.12). */
    volume?: number;
    /** Your own player instead of the synth. */
    play?: (cue: CueName, intensity: number) => void;
}
/** The sound adapter for engine `e`: after each frame it plays the cue mapped to each event in the
 *  ring. Silent until the first trusted gesture and while paused; set `on` to mute, `dispose()` to
 *  remove it. */
export declare function sound(e: Engine, o: SoundOptions): {
    play: (cue: CueName, intensity?: number, at?: number) => void;
    dispose: () => void;
    on: boolean;
    /** The audio clock in seconds (it stands still while suspended or muted), -1 before the first gesture. */
    readonly time: number;
};
/** The sound adapter `sound()` returns. */
export type Sound = ReturnType<typeof sound>;
