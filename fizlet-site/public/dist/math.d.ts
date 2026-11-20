/**
 * @fzlt/core/math: trig that gives the same bits on every engine, for anything that steps a sim.
 * `sin`, `cos`, `atan`, `atan2` and `hypot` from + − × ÷, `Math.sqrt`, `Math.abs`, `Math.trunc` and
 * `%` (all exact, so the same everywhere) and bit reads only. The builtins may differ between engines
 * in the last bit (WebKit calls the system's libm), and one bit in a heading is a different game
 * online: a desync. These are fdlibm 5.3's algorithms (k_sin.c, k_cos.c, s_sin.c, s_cos.c, the
 * medium path of e_rem_pio2.c, s_atan.c, e_atan2.c), the ones V8 ports for its Math.sin, cos, atan
 * and atan2: in Node they return what the builtins return, bit for bit (tests/math.test.mjs), so a
 * sim tested headless keeps its numbers; in Chromium and WebKit they return the same bits as in Node
 * (tests/math-engines.mjs), while those browsers' own builtins differ from them (measured on
 * Chromium 153 and WebKit 26: about 3% of sin and cos results and 18% of atan2's). `hypot` is V8's
 * two-argument Math.hypot, written out (moved here from `@fzlt/core/steer`, which re-exports it).
 *
 * One limit: past |x| = 2^20·π/2 (about 1.6 million radians) fdlibm's exact reduction needs a big
 * table; here such an x is first taken mod 2π (`%` is exact), so every engine still agrees, but V8's
 * builtin may differ there. No game needs an angle that large.
 *
 * Rendering may keep the builtins (a pixel off is fine). Allocation-free wherever they are called
 * from: a double returned from a call the JIT does not inline is boxed (a heap number each call), and
 * so are its double arguments, and fdlibm's bodies are past V8's inlining limit: so the bodies take
 * their arguments from one shared buffer and leave their result in another, and each export is a
 * tiny wrapper (write, call, read) that always inlines. Shared buffers for the bit reads and the
 * reduced argument too; every export tree-shakes on its own.
 */
/** sin(x), the same bits on every engine (Math.sin's on V8). */
export declare const sin: (x: number) => number;
/** cos(x), the same bits on every engine (Math.cos's on V8). */
export declare const cos: (x: number) => number;
/** atan(x), the same bits on every engine (Math.atan's on V8). */
export declare const atan: (x: number) => number;
/** atan2(y, x), the same bits on every engine (Math.atan2's on V8). */
export declare const atan2: (y: number, x: number) => number;
/**
 * Math.hypot of two numbers, without the builtin call: V8 boxes Math.hypot's arguments, a heap
 * number per call in a hot loop. Same steps as V8's own (Infinity wins over NaN, scale by the
 * larger, sum, sqrt), so it returns the same bits (tested against Math.hypot).
 */
export declare const hypot: (dx: number, dy: number) => number;
