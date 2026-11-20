import { need } from "./need";

/** One event in the ring. Slots are reused; copy what you need before the next frame. */
export interface FizEvent {
  /** Event name, e.g. "actor:hurt" or "timeline:end". */
  type: string;
  /** First number payload (often an id or index); 0 when not given. */
  a: number;
  /** Second number payload; 0 when not given. */
  b: number;
  /** X position payload; 0 when not given. */
  x: number;
  /** Y position payload; 0 when not given. */
  y: number;
  /** Value payload (an amount, a speed); 0 when not given. */
  v: number;
}
/** Fixed-capacity event ring, filled during a frame's steps and read in render (sound adapter,
 *  effects, HUD). Harnesses talk through it instead of callbacks. Full = the event is dropped. */
export class EventRing {
  /** Most events held per frame (default 64, at least 2). */
  readonly cap: number;
  /** Events emitted since the last clear (the engine clears the ring at the start of every frame). */
  size = 0;
  /** Events refused because the ring was full, counted over the ring's lifetime. */
  dropped = 0;
  private readonly s: FizEvent[] = []; // short: esbuild keeps property names
  constructor(cap = 64) {
    this.cap = need(cap, "events capacity", 2);
    for (let i = 0; i < cap; i++) this.s.push({ type: "", a: 0, b: 0, x: 0, y: 0, v: 0 });
  }
  /** Write the next event into a reused slot (never allocates). Returns false, and counts it in
   *  `dropped`, when the ring is full. */
  emit(type: string, a = 0, b = 0, x = 0, y = 0, v = 0): boolean {
    if (this.size === this.cap) return (this.dropped++, false);
    const s = this.s[this.size++]!;
    s.type = type;
    s.a = a;
    s.b = b;
    s.x = x;
    s.y = y;
    s.v = v;
    return true;
  }
  /** The i-th event since the last clear, or undefined past `size`. The slot is reused next frame. */
  at(i: number): FizEvent | undefined {
    return i < this.size ? this.s[i] : undefined;
  }
  /** Empty the ring (`dropped` is kept). The engine calls this at the start of every frame. */
  clear() {
    this.size = 0;
  }
}
