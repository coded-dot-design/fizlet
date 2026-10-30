// Kernel card: the loop sleeps. Tap the floor and a brick drops onto the stack, lands, squashes and
// settles; tap a brick in the stack and it is knocked out, the ones above fall into its place. The
// readout shows the engine awake while anything moves and ASLEEP, 0 fps, half a second after it stops.
import type { SlotMount } from "../../src/slot";
import { mountCard, ground, brick, W, FLOOR } from "./frame";

const CAP = 9, BW = 52, BH = 18, G = 1100;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  // Per brick: x, y, vx, vy, squash, spin; state 0 free, 1 in play, 2 knocked out.
  const x = new Float64Array(CAP), y = new Float64Array(CAP), vx = new Float64Array(CAP), vy = new Float64Array(CAP);
  const sq = new Float64Array(CAP), st = new Uint8Array(CAP), n = new Int32Array(3); // live, refused, drew a moving frame
  const put = (i: number, px: number, py: number) => ((x[i] = px), (y[i] = py), (vx[i] = 0), (vy[i] = 0), (sq[i] = 0), (st[i] = 1));
  put(0, W / 2 - BW / 2, FLOOR - BH);
  put(1, W / 2 - BW / 2 + 10, FLOOR - BH * 2);
  put(2, W / 2 - BW / 2 - 6, FLOOR - BH * 3);
  card.e.add({
    step(e, dt) {
      let live = 0;
      for (let i = 0; i < CAP; i++) {
        if (!st[i]) continue;
        live++;
        if (sq[i]! > 0.01) sq[i] = sq[i]! * (1 - 9 * dt), e.busy();
        else sq[i] = 0;
        if (st[i] === 2) {
          vy[i] = vy[i]! + G * dt;
          x[i] = x[i]! + vx[i]! * dt;
          y[i] = y[i]! + vy[i]! * dt;
          if (y[i]! > 260) st[i] = 0;
          e.busy();
          continue;
        }
        // Support: the floor, or the top of the nearest brick under this one that it overlaps.
        let top = FLOOR;
        for (let j = 0; j < CAP; j++) {
          if (j === i || st[j] !== 1 || y[j]! < y[i]! + BH - 0.5) continue;
          if (x[j]! < x[i]! + BW - 4 && x[j]! + BW > x[i]! + 4 && y[j]! < top) top = y[j]!;
        }
        if (y[i]! + BH < top - 0.01 || vy[i]! < 0) {
          vy[i] = vy[i]! + G * dt;
          y[i] = y[i]! + vy[i]! * dt;
          e.busy();
        }
        if (y[i]! + BH >= top && vy[i]! >= 0) {
          y[i] = top - BH;
          if (vy[i]! > 160) sq[i] = Math.min(1, vy[i]! / 700), vy[i] = -vy[i]! * 0.22, e.busy();
          else vy[i] = 0;
        }
      }
      n[0] = live;
    },
    render() {
      let moving = card.dirty[0]!;
      for (let i = 0; i < CAP; i++) if (st[i] && (vy[i] !== 0 || sq[i]! > 0 || st[i] === 2)) moving = 1;
      if (!moving && !n[2]) return; // still, and the still frame is already drawn
      n[2] = moving;
      card.dirty[0] = 0;
      ground(card);
      for (let i = 0; i < CAP; i++) if (st[i]) brick(card, x[i]!, y[i]!, BW, BH, card.tone, i === 0 ? card.kb : card.tag, sq[i]!);
    },
  });
  return {
    tap(px, py) {
      for (let i = CAP - 1; i >= 0; i--)
        if (st[i] === 1 && px >= x[i]! && px <= x[i]! + BW && py >= y[i]! - 4 && py <= y[i]! + BH + 4) {
          st[i] = 2;
          vy[i] = -420;
          vx[i] = px < x[i]! + BW / 2 ? 220 : -220;
          return;
        }
      for (let i = 0; i < CAP; i++) if (!st[i]) return put(i, Math.max(4, Math.min(W - BW - 4, px - BW / 2)), -BH - 4);
      n[1] = n[1]! + 1;
    },
    read: () => `BRICKS ${n[0]} / ${CAP}${n[1] ? ` · ${n[1]} REFUSED` : ""}`,
  };
});
export default mount;
