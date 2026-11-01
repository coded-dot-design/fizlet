// Docs code (shown on /docs/determinism/): a sim that replays from a seed, checked as lockstep peers.
import type { Engine } from "@fzlt/core";
import { syncCheck } from "@fzlt/core/presence/check";
// ---
// The sim: typed arrays, e.random, inputs as bits. No Math.random, no clock, no DOM.
function sim(e: Engine, players: number) {
  const pos = new Float64Array(players * 2);
  for (let i = 0; i < pos.length; i++) pos[i] = e.random() * 100;
  return {
    state: new Uint8Array(pos.buffer), // a byte view, made once
    step(e: Engine, inputs: Uint32Array) {
      for (let p = 0; p < players; p++) {
        const bits = inputs[p] ?? 0;
        pos[p * 2] = (pos[p * 2] ?? 0) + ((bits & 2 ? 1 : 0) - (bits & 1 ? 1 : 0)) * 2;
        if (bits & 4) pos[p * 2 + 1] = (pos[p * 2 + 1] ?? 0) + e.random() * 8;
      }
    },
  };
}

// In any test (Node or a browser): two peers, 600 frames, a late and jittery link.
const r = syncCheck((e, slot, players) => {
  const s = sim(e, players);
  return { ...s, input: () => (e.steps * 7 + slot) & 7 }; // scripted presses
}, { players: 2, frames: 600, latency: 3, jitter: 2 });
if (!r.ok) throw new Error(`peers diverged at frame ${r.diverged}`); // -1 when none did
