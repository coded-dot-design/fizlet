// The docs-coverage scanner (scripts/docs-coverage.mjs): which declarations of a .d.ts count as
// documented. CI runs the scanner itself on dist/ (npm run docs:coverage -- --check).
import test from "node:test";
import assert from "node:assert/strict";
import { scanDts } from "../scripts/docs-coverage.mjs";

const scan = (t) => Object.fromEntries(scanDts(t).map((d) => [d.name, d.documented]));

test("exports and their members count as documented only with a /** */ right before them", () => {
  const got = scan(`import type { X } from "./x.js";
/** Options. */
export interface Opts {
    /** Seconds; default 1. */
    a?: number;
    b: string;
    nested: {
        deep: number;
    };
}
export type Plain = number;
/**
 * Makes one.
 * @returns the thing
 */
export declare function make(o?: Opts): {
    /** Live count. */
    readonly n: number;
    stop(): void;
};
export declare function over(a: number): void;
/** Second overload documented. */
export declare function over(a: string): void;
export declare class K {
    private q;
    constructor(n: number);
    /** Cells. */
    cells: number;
}
`);
  assert.deepEqual(got, {
    Opts: true, "Opts.a": true, "Opts.b": false, "Opts.nested": false,
    Plain: false, make: true, "make.n": true, "make.stop": false, over: true, K: false, "K.cells": true,
  });
});
