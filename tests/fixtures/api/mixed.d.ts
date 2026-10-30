/**
 * A module's leading comment: its summary, not the doc of the first export below it.
 */
export interface FirstOptions {
    size?: number;
}
/** Documented: a function with a parameter tag.
 *  @param n how many
 *  @deprecated Use `two()`. */
export declare function one(n: number, o?: FirstOptions): number;
export declare function bare(...xs: string[]): void;
/** Documented: two names, one statement. */
export declare const A = 1, B = 2;
