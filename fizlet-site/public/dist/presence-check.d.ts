import { type Engine } from "./kernel/engine.js";
/** Your sim as `syncCheck()` runs it: its input for the next frame, one step from every player's
 *  inputs, and a byte view of its whole state. */
export interface SyncGame {
    /** This player's input bits for the next scheduled frame (only this client knows them). */
    input(): number;
    /** One sim frame from every player's inputs. Use `e.random`, never Math.random or the clock. */
    step(e: Engine, inputs: Uint32Array, frame: number): void;
    /** A byte view of the whole sim state (typed arrays; make the view once). */
    state: Uint8Array;
}
/** Options for `syncCheck()`: players, frames, seed, input delay and the simulated link. */
export interface SyncOptions {
    players?: number;
    frames?: number;
    seed?: number;
    delay?: number;
    latency?: number;
    jitter?: number;
}
/** What `syncCheck()` found: whether every client agreed, how far they got and the first frame that
 *  differed. */
export interface SyncResult {
    /** Every client reached `frames` with the same state hash on every frame. */
    ok: boolean;
    /** Frames every client completed (≤ frames). */
    frames: number;
    /** First frame whose state differed between clients, or -1. */
    diverged: number;
    /** Engine steps spent waiting for inputs, summed over clients. */
    stalls: number;
}
/** Check a sim is deterministic: run `players` copies as lockstep clients over the in-memory link,
 *  hash the state every frame and report the first frame that differs (`diverged`, -1 if none). */
export declare function syncCheck(setup: (e: Engine, slot: number, players: number) => SyncGame, o?: SyncOptions): SyncResult;
