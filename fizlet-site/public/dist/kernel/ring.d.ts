/** One event in the ring. Slots are reused; copy what you need before the next frame. */
export interface FizEvent {
    type: string;
    a: number;
    b: number;
    x: number;
    y: number;
    v: number;
}
/** Fixed-capacity event ring, filled during a frame's steps and read in render (sound adapter,
 *  effects, HUD). Harnesses talk through it instead of callbacks. Full = the event is dropped. */
export declare class EventRing {
    readonly cap: number;
    size: number;
    dropped: number;
    private readonly s;
    constructor(cap?: number);
    emit(type: string, a?: number, b?: number, x?: number, y?: number, v?: number): boolean;
    at(i: number): FizEvent | undefined;
    clear(): void;
}
