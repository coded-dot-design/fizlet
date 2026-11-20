import type { Engine } from "./kernel/engine.js";
import { type Transport } from "./presence.js";
/** Options for `rollback()`: the link, the seat, the sim (its input, step and bytes) and the window. */
export interface RollbackOptions {
    transport: Transport;
    /** This screen's seat, 0..players-1 (the room says which). */
    slot: number;
    /** Seats in the room, at most 8. */
    players: number;
    /** This screen's input bits for `frame` (called once per frame, in order, `delay` frames ahead). */
    input(frame: number): number;
    /** Run one frame from `inputs[0..players-1]`. `live`: the first time this frame runs (false: again,
     *  after a correction); `sure`: every input is real and every frame before it final (it never runs
     *  again). Return false to wait instead (nothing changed). Only the state in `bytes` may change. */
    step(inputs: Uint32Array, frame: number, live: boolean, sure: boolean): boolean | void;
    /** The sim's whole state (typed-array byte views, the seeded random's state too): saved and restored
     *  byte for byte, and hashed on final frames. */
    bytes: Uint8Array[];
    /** A final frame, in order, once, with its real inputs (a replay log, scores, sounds that must not repeat). */
    confirm?(inputs: Uint32Array, frame: number): void;
    /** Around a correction: before the state goes back (true) and after the frames ran again (false). */
    rewind?(before: boolean): void;
    /** The input bits a seat that left plays from the frame after its last one (default 0). */
    gone?: number;
    /** Frames run past the last final frame, at most, 2..100 (default 64: 1.07 s at 60 Hz). */
    window?: number;
    /** Frames between hash checks (default 30). */
    hashEvery?: number;
    /** A fixed input delay, 1..3 frames; omitted, it adapts 1..3 to the measured latency. */
    delay?: number;
}
/** Rollback multiplayer on engine `e`: runs every frame at once on guessed remote inputs and runs frames
 *  again when a real input differs; final frames are hashed and compared. Read `frame`, `final`,
 *  `desync`, `delay`; `destroy()` stops it. */
export declare function rollback(e: Engine, o: RollbackOptions): {
    /** Frames run so far on this screen (some on guesses). */
    readonly frame: number;
    /** Frames final so far (every input real): the same frames on every screen, maybe at different times. */
    readonly final: number;
    /** Engine steps the sim waited: the window was full (someone went quiet) or a step asked to. */
    readonly stalls: number;
    /** Engine steps this screen waited a frame for the others to catch up (time sync). */
    readonly waits: number;
    /** Frames run again after corrections, in all. */
    readonly resims: number;
    /** The deepest correction (frames run again at once). */
    readonly deepest: number;
    /** Corrections so far. */
    readonly corrections: number;
    /** The slowest correction so far (ms, the frames run again). */
    readonly resimMs: number;
    /** All the time spent running frames again (ms). */
    readonly resimTotal: number;
    /** Engine steps so far. */
    readonly steps: number;
    /** The input delay now (frames, 1..3). */
    readonly delay: number;
    /** How far this screen runs ahead of the others (frames, the mean over the seats still playing). */
    readonly lead: number;
    /** The first frame whose state hash differed from a seat's, or −1. */
    readonly desync: number;
    /** Seats the room said left, as bits (this one too when its own link is gone for good). */
    readonly lost: number;
    /** Seats reconnecting, as bits. */
    readonly away: number;
    /** Other seats that left (they play `gone`), as bits. */
    readonly left: number;
    /** The frame seat s's `gone` starts, or −1 (it has not left). */
    leftAt: (s: number) => number;
    /** Messages ignored: late, repeated, out of the ring or of an unknown kind. */
    readonly dropped: number;
    /** Stop running new frames at `frame` (−1: run on); inputs and corrections still land (tests, a
     *  match's end). */
    hold: number;
    /** Stop: the system leaves the engine, the link closes. */
    destroy: () => void;
};
/** What `rollback()` returns. */
export type Rollback = ReturnType<typeof rollback>;
