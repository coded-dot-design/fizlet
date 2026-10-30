// The usage example on bricks/presence.html (see pad.ts).
import { createEngine } from "../../src/index";
import { controls } from "../../src/input";
import { presence, join, hash32 } from "../../src/presence";
declare const ROOM_URL: string, sim: (inputs: Uint32Array) => void, bytes: Uint8Array;
// ---
const { transport, slot, players, seed } = await join(ROOM_URL);
const e = createEngine({ seed }), keys = controls(e);
const net = presence(e, { transport, slot, players, delay: 2,
  input: () => (keys.down("left") ? 1 : 0) | (keys.down("right") ? 2 : 0),
  step: (_e, inputs) => sim(inputs),   // same inputs + same seed = same state
  hash: () => hash32(bytes) });        // net.desync stays -1 while in sync
e.start();
