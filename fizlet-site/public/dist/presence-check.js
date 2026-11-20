import {
  hash32,
  memory,
  presence
} from "./chunks/chunk-6LL5KX2D.js";
import {
  createEngine
} from "./chunks/chunk-5VOOXBKR.js";
import "./chunks/chunk-RXTVZ32U.js";
import "./chunks/chunk-26IPXWAE.js";
import "./chunks/chunk-RA74YNEB.js";

// src/presence-check.ts
function syncCheck(setup, o = {}) {
  const P = o.players ?? 2, N = o.frames ?? 600, lat = o.latency ?? 0, jit = o.jitter ?? 0;
  const hub = memory({ peers: P, latency: lat, jitter: jit, seed: o.seed ?? 1 });
  const hashes = new Uint32Array(P * N), off = { hidden: false, offscreen: false, editable: false };
  const runs = [];
  for (let s = 0; s < P; s++) {
    const e = createEngine({ seed: o.seed ?? 1, pause: off }), g = setup(e, s, P);
    const net = presence(e, {
      transport: hub.ends[s],
      slot: s,
      players: P,
      delay: o.delay ?? 2,
      input: g.input,
      step(e2, inputs, f) {
        g.step(e2, inputs, f);
        if (f < N) hashes[s * N + f] = hash32(g.state);
      }
    });
    runs.push({ e, net });
  }
  for (let t = 0, max = N * (4 + lat + jit) + 100; t < max && runs.some((r) => r.net.frame < N); t++) {
    hub.tick();
    for (const r of runs) if (r.net.frame < N) r.e.advance(r.e.dt);
  }
  const frames = Math.min(N, ...runs.map((r) => r.net.frame));
  let diverged = -1;
  for (let f = 0; f < frames && diverged < 0; f++) for (let s = 1; s < P; s++) if (hashes[s * N + f] !== hashes[f]) diverged = f;
  const stalls = runs.reduce((a, r) => a + r.net.stalls, 0);
  for (const r of runs) r.e.destroy();
  return { ok: diverged < 0 && frames === N, frames, diverged, stalls };
}
export {
  syncCheck
};
