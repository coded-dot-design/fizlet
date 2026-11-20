/** A bounded pool. Every item is made up front, so acquiring and releasing never allocates and
 *  the pool never grows: when it's full, `acquire()` returns undefined (refuse new work). */
export declare class Pool<T> {
    readonly cap: number;
    readonly items: T[];
    private readonly f;
    constructor(cap: number, create: () => T);
    get size(): number;
    acquire(): T | undefined;
    /** Swap-remove by index (order is not kept). Iterate backwards when releasing in a loop. */
    releaseAt(i: number): boolean;
    release(item: T): boolean;
    clear(): void;
}
