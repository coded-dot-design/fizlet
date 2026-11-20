/** Seeded random (the DOM VIRUS core LCG, same sequence). Use it for anything that changes the
 *  simulation, so a run can be replayed or synced; `state` reads and restores it for snapshots.
 *  The state lives in a Uint32Array so drawing a number never allocates. */
export interface Random {
    (): number;
    state: number;
}
/** A seeded random number generator: `r()` returns [0, 1). The same seed gives the same sequence;
 *  read or set `r.state` to snapshot and restore it. */
export declare function seeded(seed?: number): Random;
