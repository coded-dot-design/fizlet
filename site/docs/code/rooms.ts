// Docs code (shown on /guides/multiplayer-rooms/): one client in a lockstep room.
import { createEngine } from "fzlt";
import { controls } from "fzlt/input";
import { presence, join, hash32 } from "fzlt/presence";
declare const ROOM: string, sim: (inputs: Uint32Array, frame: number) => void, state: Float64Array;
// ---
// wss://<your worker>/room/0?players=2&invite=<code>
const { transport, slot, players, seed } = await join(ROOM);
const e = createEngine({ seed }), keys = controls(e);
const bytes = new Uint8Array(state.buffer);            // the sim's state, as bytes
const net = presence(e, {
  transport, slot, players, delay: 2,                   // 2 frames: 33 ms at 60 Hz
  input: () => (keys.down("left") ? 1 : 0) | (keys.down("right") ? 2 : 0) | (keys.down("fire") ? 4 : 0),
  step: (_e, inputs, frame) => sim(inputs, frame),      // every peer, the same frames
  hash: () => hash32(bytes),                            // compared every 30 frames
});
e.start();
// net.frame, net.stalls (waits), net.desync (-1 while in sync), net.lost (seats gone)
