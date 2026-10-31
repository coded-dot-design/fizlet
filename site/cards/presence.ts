// presence card: two seats, one world. The left board is you, the right is a peer 100 ms away (an
// in-memory link with latency). Tap either board to drop a brick in that column: the input goes to
// both seats, and neither world moves until it has every seat's input for the frame (lockstep waits,
// never guesses), so the brick lands on both boards on the same frame, the link's delay later. Stack a
// column nine high and it clears. The readout hashes both worlds: the same, byte for byte.
import type { SlotMount } from "../../src/slot";
import { presence, memory, hash32 } from "../../src/presence";
import { mountCard, ground, brick, ink, faint, W, FLOOR } from "./frame";

const COLS = 6, CW = 22, BH = 11, MAXH = 9, SPEED = 4.2, LATENCY = 6, HALF = W / 2;
const X0 = (HALF - COLS * CW) / 2, TOP = 44;
const SEAT = ["#39ffb0", "#ff8a1f"];

/** One seat's copy of the world: per column a stack (count, then colours), and a falling brick. */
function world() {
  const bytes = new Uint8Array(COLS * (MAXH + 1)); // count, then MAXH seat colours, per column
  const fall = new Float64Array(COLS).fill(-1), who = new Uint8Array(COLS), flash = new Float64Array(COLS);
  return { bytes, fall, who, flash };
}
type World = ReturnType<typeof world>;

/** The lockstep simulation for one frame: the same inputs give the same world on every seat. */
function simulate(w: World, inputs: Uint32Array) {
  for (let s = 0; s < inputs.length; s++) {
    const v = inputs[s]!;
    if (v > 0 && v <= COLS && w.fall[v - 1]! < 0) (w.fall[v - 1] = 0), (w.who[v - 1] = s);
  }
  let moving = 0;
  for (let c = 0; c < COLS; c++) {
    if (w.flash[c]! > 0) (w.flash[c] = w.flash[c]! - 1), (moving = 1);
    if (w.fall[c]! < 0) continue;
    moving = 1;
    const n = w.bytes[c * (MAXH + 1)]!, land = FLOOR - TOP - BH * (n + 1);
    w.fall[c] = w.fall[c]! + SPEED;
    if (w.fall[c]! >= land) {
      w.fall[c] = -1;
      if (n + 1 >= MAXH) (w.bytes[c * (MAXH + 1)] = 0), (w.flash[c] = 18);
      else (w.bytes[c * (MAXH + 1) + 1 + n] = w.who[c]!), (w.bytes[c * (MAXH + 1)] = n + 1);
    }
  }
  return moving;
}

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const link = memory({ peers: 2, latency: LATENCY });
  const A = world(), B = world();
  // pending input per seat, busy time, drew, moving A, moving B
  const s = new Float64Array([0, 0, 0, 0, 0, 0]);
  card.e.add({ step() { link.tick(); } });
  const seat = (i: number, w: World) => presence(card.e, {
    transport: link.ends[i]!, slot: i, players: 2, delay: 2,
    input() {
      const v = s[i]!;
      s[i] = 0;
      return v;
    },
    step(_e, inputs) {
      s[4 + i] = simulate(w, inputs);
    },
    hash: () => hash32(w.bytes),
  });
  const pa = seat(0, A), pb = seat(1, B);
  const label = `${card.tag} ${card.kb}`;
  card.e.add({
    step(e, dt) {
      if (s[2]! > 0) s[2] = s[2]! - dt;
      // Not the link: inputs flow every frame, so it is never empty. A tap keeps it awake long enough
      // for its input to cross the link; a falling brick keeps it awake until it lands on both boards.
      if (s[2]! > 0 || s[4] || s[5] || s[0] || s[1]) e.busy();
    },
    render() {
      const moving = card.dirty[0]! || (s[2]! > 0 || s[4] || s[5] ? 1 : 0);
      if (!moving && !s[3]) return;
      s[3] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      ctx.fillStyle = faint(theme);
      ctx.fillRect(HALF - 1, TOP - 18, 2, FLOOR - TOP + 18);
      for (let b = 0; b < 2; b++) {
        const w = b ? B : A, ox = b * HALF + X0;
        ctx.fillStyle = ink(theme);
        ctx.font = "800 9px ui-monospace, Menlo, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(b ? "PEER · SEAT 1 · +100 MS" : "YOU · SEAT 0", b * HALF + 10, TOP - 10);
        for (let c = 0; c < COLS; c++) {
          const n = w.bytes[c * (MAXH + 1)]!, x = ox + c * CW;
          if (w.flash[c]! > 0) {
            ctx.fillStyle = SEAT[0]!;
            ctx.globalAlpha = w.flash[c]! / 18;
            ctx.fillRect(x, TOP, CW - 2, FLOOR - TOP);
            ctx.globalAlpha = 1;
          }
          for (let k = 0; k < n; k++) brick(card, x, FLOOR - BH * (k + 1), CW - 2, BH - 1, SEAT[w.bytes[c * (MAXH + 1) + 1 + k]!]!, "", 0, 1);
          if (w.fall[c]! >= 0) brick(card, x, TOP + w.fall[c]!, CW - 2, BH - 1, SEAT[w.who[c]!]!, "", 0, 1);
        }
      }
      brick(card, HALF - 42, FLOOR + 5, 84, 13, card.tone, label, 0, 2);
    },
  });
  return {
    tap(x, y) {
      if (y < TOP - 20) return;
      const b = x >= HALF ? 1 : 0, c = Math.floor((x - b * HALF - X0) / CW);
      if (c < 0 || c >= COLS) return;
      s[b] = c + 1;
      s[2] = 0.8;
    },
    read: () => {
      const ha = hash32(A.bytes), hb = hash32(B.bytes), lag = Math.abs(pa.frame - pb.frame);
      const hex = (h: number) => (h >>> 0).toString(16).padStart(8, "0").slice(0, 4);
      return ha === hb && !lag ? `HASH ${hex(ha)} = ${hex(hb)} · WAITED ${pa.stalls}` : `HASH ${hex(ha)} ≠ ${hex(hb)} · ${lag ? `LAG ${lag} FRAMES` : "IN FLIGHT"}`;
    },
  };
});
export default mount;
