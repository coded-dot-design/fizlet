// sprite card: will the bug blow up? A pixel bug (rows of characters, baked once) walks the floor.
// Tap it and it flashes white (the `*` palette), hops back and gets angrier: a second palette, faster
// feet. The fourth hit puffs it up and it bursts into its own pixels, which bounce and fade; a new
// bug drops in. Tap beside it and it startles, hops and turns away.
import type { SlotMount } from "../../src/slot";
import { sprites } from "../../src/sprite";
import { mountCard, ground, brick, W, FLOOR } from "./frame";

const ROWS = [
  [
    "..e....e..",
    "...e..e...",
    "..bbbbbb..",
    ".bwebbweb.",
    ".bbbbbbbb.",
    "bbbbbbbbbb",
    ".bbbbbbbb.",
    ".e.e..e.e.",
  ],
  [
    "...e..e...",
    "...e..e...",
    "..bbbbbb..",
    ".bwebbweb.",
    ".bbbbbbbb.",
    "bbbbbbbbbb",
    ".bbbbbbbb.",
    "e.e....e.e",
  ],
];
const S = 4, BW = 10 * S, BH = 8 * S, BITS = 80, HITS = 4;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const art = sprites({ bug: { colors: { b: "team", e: "#07060f", w: "#ffffff" }, frames: ROWS, outline: "#07060f" } }, {
    palettes: [{ team: card.tone }, { team: "#ff2b4e" }, { "*": "#ffffff" }],
  });
  // Bug: x, y (feet), vx, vy, facing (1 or -1), walk clock, hits, flash, puff, alive, respawn, drew
  const b = new Float64Array([W / 2, FLOOR, 38, 0, 1, 0, 0, 0, 0, 1, 0, 0]);
  // The burst: one bit per pixel of the bug: x, y, vx, vy, life, colour (0 body, 1 rim, 2 white).
  const px = new Float64Array(BITS), py = new Float64Array(BITS), vx = new Float64Array(BITS), vy = new Float64Array(BITS), life = new Float64Array(BITS);
  const col = new Uint8Array(BITS);
  const n = new Int32Array(2); // pops so far, startles
  const label = `${card.tag} ${card.kb}`;
  const burst = () => {
    let k = 0;
    const rows = ROWS[0]!;
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < 10 && k < BITS; c++) {
        const ch = rows[r]![c]!;
        if (ch === ".") continue;
        px[k] = b[0]! + (c - 5) * S * 1.4;
        py[k] = b[1]! - BH * 1.4 + r * S * 1.4;
        vx[k] = (c - 4.5) * 34 + (card.e.random() - 0.5) * 120;
        vy[k] = -200 - card.e.random() * 260 + r * 12;
        life[k] = 1.6 + card.e.random() * 0.8;
        col[k++] = ch === "b" ? 0 : ch === "e" ? 1 : 2;
      }
    b[9] = 0;
    b[10] = 1.6;
    n[0] = n[0]! + 1;
  };
  card.e.add({
    step(e, dt) {
      let busy = 0;
      for (let k = 0; k < BITS; k++) {
        if (life[k]! <= 0) continue;
        busy = 1;
        life[k] = life[k]! - dt;
        vy[k] = vy[k]! + 900 * dt;
        px[k] = px[k]! + vx[k]! * dt;
        py[k] = py[k]! + vy[k]! * dt;
        if (py[k]! > FLOOR - 2) (py[k] = FLOOR - 2), (vy[k] = -vy[k]! * 0.35), (vx[k] = vx[k]! * 0.7);
      }
      if (!b[9]) {
        b[10] = b[10]! - dt;
        if (b[10]! <= 0) b.set([W / 2, -20, 38, 0, 1, 0, 0, 0, 0, 1, 0, b[11]!]);
        if (busy || b[10]! > -0.01) e.busy();
        if (b[10]! > 0) return;
      }
      if (b[7]! > 0) b[7] = Math.max(0, b[7]! - dt);
      if (b[8]! > 0) {
        // Puffing up before the pop.
        b[8] = b[8]! + dt;
        if (b[8]! > 0.35) burst();
        e.busy();
        return;
      }
      // A walk of a few steps after every poke, then it stands (and the engine sleeps).
      const air = b[1]! < FLOOR || b[3]! < 0;
      if (air) (b[3] = b[3]! + 1100 * dt), (b[1] = b[1]! + b[3]! * dt), (busy = 1);
      if (b[1]! >= FLOOR && b[3]! >= 0) (b[1] = FLOOR), (b[3] = 0);
      if (b[2]! > 0) {
        busy = 1;
        b[0] = b[0]! + b[4]! * b[2]! * (1 + b[6]! * 0.6) * dt;
        b[5] = b[5]! + dt * (1 + b[6]!);
        b[2] = Math.max(0, b[2]! - 22 * dt);
        if (b[0]! < BW / 2 + 4) (b[0] = BW / 2 + 4), (b[4] = 1);
        if (b[0]! > W - BW / 2 - 4) (b[0] = W - BW / 2 - 4), (b[4] = -1);
      }
      if (b[7]! > 0) busy = 1;
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]! || (b[9] === 0 || b[2]! > 0 || b[3] !== 0 || b[7]! > 0 || b[8]! > 0 ? 1 : 0);
      for (let k = 0; k < BITS && !moving; k++) if (life[k]! > 0) moving = 1;
      if (!moving && !b[11]) return;
      b[11] = moving;
      card.dirty[0] = 0;
      const { ctx } = card;
      ground(card);
      for (let k = 0; k < BITS; k++) {
        if (life[k]! <= 0) continue;
        ctx.globalAlpha = Math.min(1, life[k]!);
        ctx.fillStyle = col[k] === 0 ? "#ff2b4e" : col[k] === 1 ? "#07060f" : "#ffffff";
        ctx.fillRect(px[k]! - 3, py[k]! - 3, 6, 6);
      }
      ctx.globalAlpha = 1;
      if (b[9]) {
        const puff = b[8]! > 0 ? 1 + b[8]! * 1.2 : 1, pal = b[7]! > 0.05 ? 2 : b[6]! >= 2 ? 1 : 0;
        const wob = b[8]! > 0 ? Math.sin(b[8]! * 80) * 0.08 : 0;
        art.draw(ctx, "bug", ((b[5]! * 8) | 0) & 1, b[0]!, b[1]! - (BH * puff) / 2, wob, S * puff, pal);
      }
      brick(card, W - 84, 24, 76, 14, card.tone, label, 0, 2);
    },
  });
  return {
    tap(x, y) {
      if (!b[9] || b[8]! > 0) return;
      const onBug = Math.abs(x - b[0]!) < BW / 2 + 8 && y > b[1]! - BH - 12 && y < b[1]! + 6;
      b[4] = x < b[0]! ? 1 : -1; // away from the tap
      b[2] = onBug ? 150 : 90;
      b[3] = onBug ? -300 : -200;
      if (b[1]! >= FLOOR) b[1] = FLOOR - 0.5;
      if (!onBug) return void (n[1] = n[1]! + 1);
      b[6] = b[6]! + 1;
      b[7] = 0.12;
      if (b[6]! >= HITS) (b[8] = 0.001), (b[2] = 0), (b[3] = 0);
    },
    read: () => (b[9] ? `HITS ${b[6]} / ${HITS}${b[6]! >= 2 ? " · ANGRY" : ""}` : `POP! · ${n[0]} SO FAR`),
  };
});
export default mount;
