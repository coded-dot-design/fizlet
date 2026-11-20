/** Options are checked once, at setup, so a bad number fails here with its name instead of as NaN
 *  mid-game. Kind: 0 any finite number, 1 a finite number > 0, 2 a positive integer (capacities). */
export declare function need(v: unknown, name: string, kind?: number): number;
