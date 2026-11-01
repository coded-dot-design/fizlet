// A 2015 CSS sprite strip on the Fizlet kernel clock. A clip is the @keyframes as data, segment by
// segment, with the same meaning CSS gave them: from frame `a` to frame `b` in `n` jumps
// (steps(n), jump-end) over `d` seconds after `w` seconds of delay (the strip shows `a` while it
// waits, `b` once it ends). Segments from `loop` on repeat forever, or `reps` times then rest
// on `rest` (default: the last segment's `b`).
// One engine per sprite: it settles when nothing plays, pauses off screen and in a hidden tab, and
// destroy() gives the element's style back (the ledger).
import { createEngine, type Engine } from "../../../src/kernel/index";

export interface Seg { a: number; b: number; n: number; d: number; w?: number }
export interface Clip { segs: Seg[]; loop?: number; reps?: number; rest?: number }

export function strip(el: HTMLElement, frameW: number, frame0 = 0, o: { fps?: number } = {}) {
  const engine: Engine = createEngine({ root: el, settle: 0.5, ...(o.fps && { fps: o.fps }) });
  const s = new Float64Array(4); // [0] local time, [1] segment, [2] frame now, [3] plays of the loop
  let clip: Clip | null = null, on = false, shown = -1;
  s[2] = frame0;
  const at = (g: Seg, t: number) => (t < (g.w ?? 0) ? g.a : g.a + (Math.floor(((t - (g.w ?? 0)) / g.d) * g.n) / g.n) * (g.b - g.a));
  engine.add({
    step(e, dt) {
      if (!on || !clip) return;
      e.busy();
      let g = clip.segs[s[1]!]!;
      s[0]! += dt;
      while (s[0]! >= (g.w ?? 0) + g.d) {
        s[0]! -= (g.w ?? 0) + g.d;
        s[1]!++;
        if (s[1]! >= clip.segs.length) {
          const loop = clip.loop ?? -1;
          if (loop < 0 || (clip.reps && ++s[3]! >= clip.reps)) {
            on = false;
            s[2] = clip.rest ?? g.b;
            return;
          }
          s[1] = loop;
        }
        g = clip.segs[s[1]!]!;
      }
      s[2] = Math.round(at(g, s[0]!));
    },
    render(e) {
      const f = s[2]!;
      if (f !== shown) (shown = f), e.ledger.style(el, "background-position", -f * frameW + "px 0");
    },
  });
  engine.start();
  return {
    engine,
    /** Play a clip from its start. */
    play(c: Clip) {
      clip = c;
      s[0] = s[1] = s[3] = 0;
      on = true;
      engine.wake();
    },
    /** Hold the frame (a pause button) or carry on. */
    hold(h: boolean) {
      on = !h && !!clip;
      engine.wake();
    },
    /** Land on a frame at once (reduced motion: the still poster). */
    show(f: number) {
      on = false;
      s[2] = f;
      engine.wake();
    },
    get frame() { return s[2]!; },
    get playing() { return on; },
    get segment() { return s[1]!; },
    destroy: () => engine.destroy(),
  };
}
export type Strip = ReturnType<typeof strip>;
