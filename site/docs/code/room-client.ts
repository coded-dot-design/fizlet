// Docs code (shown on /guides/build-your-own-room-server/): a client of a room server you run.
import { createEngine } from "@fzlt/core";
import { controls } from "@fzlt/core/input";
import { presence, join, hash32 } from "@fzlt/core/presence";
declare const SERVER: string, code: string, sim: (inputs: Uint32Array, frame: number) => void, state: Float64Array;
// ---
// wss://<your server>/room/0?players=2. The access code rides in the subprotocols, never the URL.
const { transport, slot, players, seed } = await join(`${SERVER}/room/0?players=2`, undefined, ["fizlet-rooms", `invite.${code}`]);
const e = createEngine({ seed }), keys = controls(e);  // WELCOME: your seat, the count, one seed
const bytes = new Uint8Array(state.buffer);            // the sim's state, as bytes
const net = presence(e, {
  transport, slot, players, delay: 2,                   // INPUT for frame f + 2, once a frame
  input: () => (keys.down("left") ? 1 : 0) | (keys.down("right") ? 2 : 0) | (keys.down("fire") ? 4 : 0),
  step: (_e, inputs, frame) => sim(inputs, frame),      // runs once every seat's INPUT is in
  hash: () => hash32(bytes),                            // HASH every 30 frames
});
e.start();
// net.stalls (waits), net.desync (-1 while in sync), net.lost (seats the room said LEAVE)
