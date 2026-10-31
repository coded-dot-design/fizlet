// The FILET factory hero's step (site/factory/motion.ts): zero allocation through everything it moves:
// bricks hopping to the belt, refused bricks wobbling, bricks swallowed by the machine, the run (shake,
// sparks, blast), the cartridge pop, the belt and the arrival beat, with fzlt/fx stepping under it.
// Young-GC count (tests/gc.mjs, best of 3 windows), with a self-check: the same steps plus one small
// object each must show up, so a harness that cannot see allocation fails here too.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/kernel/index.ts");
const { effects } = await import("../src/fx.ts");
const { motion, MOVE, NOPE, SWALLOW } = await import("../site/factory/motion.ts");

test("factory: the step allocates nothing (moves, wobbles, swallows, the run, the blast, the pop)", async (t) => {
  if (typeof gc !== "function") return t.skip("needs node --expose-gc");
  const e = createEngine(), fx = effects({ cap: 320 }), N = 12, m = motion(fx, N);
  let sink = null, leak = false;
  // Every 150 steps (2.5 s, a whole run) re-arm everything, as the scene's event handlers do.
  const arm = (j) => {
    for (let i = 0; i < N; i++) {
      const k = (i + j) % 3;
      m.kind[i] = k === 0 ? MOVE : k === 1 ? NOPE : SWALLOW;
      m.T[i] = 0; m.W[i] = 0.02 * i; m.D[i] = 0.4 + 0.05 * i;
      m.X[i] = 40 - i * 7; m.Y[i] = i * 5 - 30; m.R[i] = 20 - i * 3; m.A[i] = 60; m.TX[i] = 120; m.TY[i] = -20;
    }
    const s = m.s;
    s[0] = 0; s[1] = j & 1; s[2] = 0; s[19] = 0; s[4] = 420; s[5] = 300; s[6] = 200; s[9] = 0; s[20] = 0;
  };
  const steps = (n) => {
    for (let i = 0; i < n; i++) {
      if (i % 150 === 0) arm(i / 150);
      m.step(e, 1 / 60);
      e.events.clear();
      if (leak) sink = { i }; // the self-check: a step that allocates
    }
  };
  steps(20000);
  gc();
  const minor = await minorGCs(() => steps(1000000));
  leak = true;
  steps(20000);
  const control = await minorGCs(() => steps(1000000));
  console.log(`# factory young GCs over 1M steps: ${minor}; self-check, an allocating step: ${control}`);
  assert.ok(sink, "the self-check ran");
  assert.ok(control >= 5, `the harness sees allocation (self-check: ${control} young GCs)`);
  assert.ok(minor <= 1, `young-generation GCs over 1M factory steps: ${minor}`);
});
