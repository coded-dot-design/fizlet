// Recipe: two players. Two lockstep peers on one page, each with its own engine, its own controls
// and its own screen, joined by an in-memory link with latency and jitter. Only inputs cross it,
// 12 bytes a message; both screens show the same game because both sims run the same frames.
// For two devices, swap memory() for join("wss://<your room server>/room/0?players=2").
// Kernel, input and presence. Runs as is with duel.html.
import { createEngine } from "fizlet";
import { controls } from "fizlet/input";
import { presence, memory, hash32 } from "fizlet/presence";
import { hud } from "fizlet/hud";

const W = 320, H = 120;
const root = document.getElementById("duel");
const screens = root.querySelectorAll("canvas");
const link = memory({ peers: 2, latency: 3, jitter: 2 }); // ticks of delay, ± jitter
const KEYS = [{ left: ["KeyA"], right: ["KeyD"] }, { left: ["KeyJ"], right: ["KeyL"] }];
const peers = [];

for (let slot = 0; slot < 2; slot++) {
  const canvas = screens[slot], ctx = canvas.getContext("2d");
  const e = createEngine({ root, seed: 42 }); // same seed on every peer
  const pad = controls(e, { target: canvas, keys: KEYS[slot] });
  // The whole game state: [x0, x1, score0, score1, coin x]. Same frames in, same bytes out.
  const s = new Float64Array([W * 0.25, W * 0.75, 0, 0, W / 2]), bytes = new Uint8Array(s.buffer);
  let side = 0; // which half of this screen a finger holds: -1, 0 or 1 (read in read, used in input)
  e.add({ read() { side = pad.pointer.down ? (pad.pointer.x < canvas.clientWidth / 2 ? -1 : 1) : 0; } });
  const net = presence(e, {
    transport: link.ends[slot], slot, players: 2, delay: 2,
    input: () => (pad.down("left") || side < 0 ? 1 : 0) | (pad.down("right") || side > 0 ? 2 : 0),
    step(e, inputs) { // the sim: inputs and e.random only
      for (let p = 0; p < 2; p++) {
        const bits = inputs[p];
        s[p] = Math.max(8, Math.min(W - 8, s[p] + ((bits & 2 ? 1 : 0) - (bits & 1 ? 1 : 0)) * 3));
        if (Math.abs(s[p] - s[4]) < 10) { s[2 + p] += 1; s[4] = 10 + e.random() * (W - 20); }
      }
    },
    hash: () => hash32(bytes), // compared every 30 frames: net.desync
  });
  e.add({
    render() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(s[4] - 5, 55, 10, 10);
      for (let p = 0; p < 2; p++) {
        ctx.fillStyle = p === 0 ? "#39ffb0" : "#ff5c8f";
        ctx.fillRect(s[p] - 8, p === slot ? 80 : 30, 16, 16); // you are the lower one
        ctx.font = "bold 14px monospace";
        ctx.fillText(`P${p + 1} ${s[2 + p]}`, p === 0 ? 8 : W - 52, 18);
      }
    },
  });
  peers.push({ e, net });
}
// The link moves once a frame; the readouts come from peer 1.
peers[0].e.add({ read: () => link.tick() });
const [one] = peers;
hud(one.e, root)
  .num("[data-frame]", () => one.net.frame)
  .num("[data-sync]", () => one.net.desync, (f) => (f < 0 ? "in sync" : `desync at frame ${f}`));
for (const p of peers) p.e.start();
