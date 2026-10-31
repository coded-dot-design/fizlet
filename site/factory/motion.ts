/**
 * The FILET factory's motion: every number the scene moves, in typed arrays, and the step that
 * moves them. No DOM here: scene.ts reads layout in its event handlers, sets these arrays, and
 * writes the DOM in render. The step allocates nothing (tests/factory-alloc.test.mjs).
 */
import type { Engine } from "../../src/kernel/index";
import { emitter, SPARK, type Effects } from "../../src/fx";

// Tile motion kinds.
export const IDLE = 0, MOVE = 1, NOPE = 2, SWALLOW = 3;
// The run: swallow, shake, blast (seconds); a re-roll skips the swallow.
export const SWALLOW_T = 0.7;
export const POP = 0.55;
const ARRIVE = 1.1, BLAST_T = 2.1, AGAIN_BLAST = 1.0;

const smooth = (p: number) => p * p * (3 - 2 * p);

/** The arrays and the step for `n` bricks. */
export function motion(fx: Effects, n: number) {
  const N = n, em = emitter(fx, { spark: SPARK });
  // Per tile: kind, clock, duration, delay, start offset (x, y, deg), arc, swallow target (x, y).
  const kind = new Uint8Array(N), T = new Float32Array(N), D = new Float32Array(N), W = new Float32Array(N);
  const X = new Float32Array(N), Y = new Float32Array(N), R = new Float32Array(N), A = new Float32Array(N);
  const TX = new Float32Array(N), TY = new Float32Array(N);
  // Per tile out: x, y, deg, scale, opacity; and whether render owes it a write (1) or a reset (2).
  const ox = new Float32Array(N), oy = new Float32Array(N), or = new Float32Array(N), os = new Float32Array(N), oo = new Float32Array(N);
  const owe = new Uint8Array(N);
  // Scene state: [0] run clock (-1 idle), [1] run is a re-roll, [2] blast fired, [3] belt offset,
  // [4] belt speed, [5..6] machine centre (stage px), [7] shake, [8] flash, [9] pop clock (-1 idle),
  // [10] canvas w, [11] canvas h, [12] dpr, [13] resized, [14] drew last frame, [15] light theme,
  // [16] done owed, [17..18] mouth (stage px), [19] spark clock.
  // [20] arrival clock (-1 done): the stack stands a beat before it is knocked over; [21] ready owed.
  const s = new Float64Array(22);
  s[0] = -1; s[9] = -1; s[20] = 0;

  function step(e: Engine, dt: number) {
    let busy = 0;
    // Tiles.
    for (let i = 0; i < N; i++) {
      const k = kind[i]!;
      if (k === IDLE) continue;
      busy = 1;
      T[i]! += dt;
      const p = Math.min(1, Math.max(0, (T[i]! - W[i]!) / D[i]!));
      if (k === MOVE) {
        const q = smooth(p), u = 1 - q;
        ox[i] = X[i]! * u; oy[i] = Y[i]! * u - A[i]! * Math.sin(Math.PI * p); or[i] = R[i]! * u; os[i] = 1; oo[i] = 1;
      } else if (k === NOPE) {
        ox[i] = 0; oy[i] = 0; or[i] = 10 * Math.sin(p * 18) * (1 - p); os[i] = 1; oo[i] = 1;
      } else {
        const q = p * p;
        ox[i] = TX[i]! * q; oy[i] = TY[i]! * q; or[i] = 0; os[i] = 1 - 0.7 * q; oo[i] = 1 - q;
      }
      owe[i] = 1;
      if (p >= 1) {
        kind[i] = IDLE;
        // A swallowed brick stays shrunk and clear (it is in the machine) until it next moves.
        if (k !== SWALLOW) owe[i] = 2;
      }
    }
    // The run.
    if (s[0]! >= 0) {
      busy = 1;
      s[0]! += dt;
      const t = s[0]!, blast = s[1] ? AGAIN_BLAST : BLAST_T, start = s[1] ? 0 : SWALLOW_T * 0.7;
      const k = t < start ? 0 : t < blast ? (t - start) / (blast - start) : 0;
      s[7] = k * k * 16;
      if (t > start && t < blast) {
        s[19]! += dt;
        if (s[19]! > 0.05) {
          s[19] = 0;
          // Whole pixels: a small integer goes into a call unboxed (a fresh double is a heap number).
          em.emit(em.ids.spark, (s[5]! + (e.random() - 0.5) * 120) | 0, (s[6]! - 40 + (e.random() - 0.5) * 60) | 0, (6 + k * 14) | 0, 0, 3);
          if (e.random() < 0.3) e.events.emit("hit", 0, 0, 0, 0, 0.4);
        }
      }
      if (t >= blast && !s[2]) {
        s[2] = 1; s[8] = 1; s[16] = 1;
        fx.blast(s[5]! | 0, s[6]! | 0, 2, 0);
        em.emit(em.ids.spark, s[5]! | 0, s[6]! | 0, 60, 0, 5, 4);
        fx.kick(18);
        e.events.emit("boom");
      }
      if (t > blast + 0.2) s[0] = -1;
    }
    if (s[8]! > 0) { busy = 1; s[8] = Math.max(0, s[8]! - dt * 3); }
    if (s[9]! >= 0) { busy = 1; s[9]! += dt; if (s[9]! > POP + 0.1) { s[9] = -1; e.events.emit("win"); } }
    // The belt runs while bricks ride it.
    if (s[4]! > 0) { busy = 1; s[3] = (s[3]! + s[4]! * dt) % 22; s[4] = Math.max(0, s[4]! - 300 * dt); }
    fx.step(dt);
    // Arrival: the stack stands a beat, then the scene tells the controller to knock it over.
    if (s[20]! >= 0) {
      busy = 1;
      s[20]! += dt;
      if (s[20]! > ARRIVE) { s[20] = -1; s[21] = 1; }
    }
    if (busy || fx.live > 0 || s[13]) e.busy();
  }
  return { kind, T, D, W, X, Y, R, A, TX, TY, ox, oy, or, os, oo, owe, s, em, step };
}
