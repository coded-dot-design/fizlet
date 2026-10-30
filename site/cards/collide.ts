// collide card: a wall of bricks and a launcher. Tap to fire a ball at that spot; it ricochets off
// the walls and every brick it touches is knocked loose and falls to the floor, where it stays.
// Clear the wall and it builds itself again. The spatial grid finds what a ball can touch: the
// readout shows how many bricks it checked this frame against what checking every pair would cost.
import type { SlotMount } from "../../src/slot";
import { Grid, circleRect } from "../../src/collide";
import { hypot } from "../../src/steer";
import { mountCard, ground, brick, ink, W, H, FLOOR } from "./frame";

const COLS = 8, ROWS = 4, N = COLS * ROWS, BW = 34, BH = 12, GAP = 4, X0 = (W - COLS * (BW + GAP) + GAP) / 2, Y0 = 30;
const BALLS = 5, R = 5, SPEED = 380, G = 900, LX = W / 2, LY = FLOOR - 4;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const grid = new Grid(40, N, W, H), out = new Int32Array(N);
  // Bricks: x, y, vx, vy, spin, angle; state 1 in the wall, 2 falling, 3 on the floor.
  const bx = new Float64Array(N), by = new Float64Array(N), bvx = new Float64Array(N), bvy = new Float64Array(N), ba = new Float64Array(N), bs = new Uint8Array(N);
  // Balls: x, y, vx, vy, live.
  const qx = new Float64Array(BALLS), qy = new Float64Array(BALLS), qvx = new Float64Array(BALLS), qvy = new Float64Array(BALLS), ql = new Uint8Array(BALLS);
  // checks this frame, hits, wall left, rebuild timer, drew a moving frame, aim x, aim y
  const s = new Float64Array([0, 0, N, 0, 0, LX, Y0]);
  const build = () => {
    for (let i = 0; i < N; i++) {
      bx[i] = X0 + (i % COLS) * (BW + GAP) + (((i / COLS) | 0) & 1 ? 9 : 0) - 4;
      by[i] = Y0 + ((i / COLS) | 0) * (BH + GAP);
      bs[i] = 1;
      ba[i] = 0;
    }
    s[2] = N;
  };
  build();
  card.e.add({
    step(e, dt) {
      let busy = 0, checks = 0;
      grid.clear();
      for (let i = 0; i < N; i++) if (bs[i] === 1) grid.insert(i, bx[i]! + BW / 2, by[i]! + BH / 2, BW / 2 + 1);
      for (let b = 0; b < BALLS; b++) {
        if (!ql[b]) continue;
        busy = 1;
        qx[b] = qx[b]! + qvx[b]! * dt;
        qy[b] = qy[b]! + qvy[b]! * dt;
        if (qx[b]! < R) (qx[b] = R), (qvx[b] = -qvx[b]!);
        if (qx[b]! > W - R) (qx[b] = W - R), (qvx[b] = -qvx[b]!);
        if (qy[b]! < R) (qy[b] = R), (qvy[b] = -qvy[b]!);
        if (qy[b]! > FLOOR - R && qvy[b]! > 0) ql[b] = 0;
        const n = grid.query(qx[b]!, qy[b]!, R, out);
        checks += n;
        for (let k = 0; k < n; k++) {
          const i = out[k]!;
          if (bs[i] !== 1 || !circleRect(qx[b]!, qy[b]!, R, bx[i]!, by[i]!, BW, BH)) continue;
          bs[i] = 2;
          s[2] = s[2]! - 1;
          s[1] = s[1]! + 1;
          bvx[i] = qvx[b]! * 0.35;
          bvy[i] = -120;
          ba[i] = 0;
          // Bounce off the face it came through.
          const cx = bx[i]! + BW / 2, cy = by[i]! + BH / 2;
          if (Math.abs(qx[b]! - cx) / BW > Math.abs(qy[b]! - cy) / BH) qvx[b] = -qvx[b]!;
          else qvy[b] = -qvy[b]!;
          break;
        }
      }
      for (let i = 0; i < N; i++) {
        if (bs[i] !== 2) continue;
        busy = 1;
        bvy[i] = bvy[i]! + G * dt;
        bx[i] = Math.max(0, Math.min(W - BW, bx[i]! + bvx[i]! * dt));
        by[i] = by[i]! + bvy[i]! * dt;
        ba[i] = ba[i]! + bvx[i]! * 0.02 * dt;
        if (by[i]! + BH >= FLOOR) (by[i] = FLOOR - BH), (bs[i] = 3), (ba[i] = 0);
      }
      if (s[2] === 0) {
        s[3] = s[3]! + dt;
        busy = 1;
        if (s[3]! > 1) (s[3] = 0), build();
      }
      s[0] = checks;
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]!;
      for (let b = 0; b < BALLS; b++) moving |= ql[b]!;
      for (let i = 0; i < N; i++) if (bs[i] === 2) moving = 1;
      if (!moving && !s[4]) return;
      s[4] = moving;
      card.dirty[0] = 0;
      const { ctx } = card;
      ground(card);
      for (let i = 0; i < N; i++) {
        if (!bs[i]) continue;
        ctx.globalAlpha = bs[i] === 3 ? 0.55 : 1;
        if (ba[i] !== 0) {
          ctx.save();
          ctx.translate(bx[i]! + BW / 2, by[i]! + BH / 2);
          ctx.rotate(ba[i]!);
          brick(card, -BW / 2, -BH / 2, BW, BH, card.tone, "", 0, 2);
          ctx.restore();
        } else brick(card, bx[i]!, by[i]!, BW, BH, card.tone, i === 3 && bs[i] === 1 ? card.kb : "", 0, 2);
      }
      ctx.globalAlpha = 1;
      // The launcher and its aim line.
      ctx.strokeStyle = ink(card.theme);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(LX, LY);
      ctx.lineTo(s[5]!, s[6]!);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink(card.theme);
      ctx.fillRect(LX - 10, LY - 4, 20, 8);
      for (let b = 0; b < BALLS; b++) {
        if (!ql[b]) continue;
        ctx.beginPath();
        ctx.arc(qx[b]!, qy[b]!, R, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
  return {
    tap(px, py) {
      for (let b = 0; b < BALLS; b++) {
        if (ql[b]) continue;
        const dx = px - LX, dy = Math.min(-20, py - LY), d = hypot(dx, dy);
        qx[b] = LX;
        qy[b] = LY - 8;
        qvx[b] = (dx / d) * SPEED;
        qvy[b] = (dy / d) * SPEED;
        ql[b] = 1;
        s[5] = px;
        s[6] = Math.min(py, LY - 20);
        return;
      }
    },
    read: () => {
      let live = 0;
      for (let b = 0; b < BALLS; b++) live += ql[b]!;
      return live ? `CHECKED ${s[0]} · ALL PAIRS ${live * N}` : `HITS ${s[1]} · WALL ${s[2]} / ${N}`;
    },
  };
});
export default mount;
