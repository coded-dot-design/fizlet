// fx card: will the crate blow up? A crate stands on the floor. Tap near it and a small blast knocks
// it about (it takes damage, its face cracks); tap the crate itself, or wear it down to nothing, and
// the hero blast takes it apart: flash, rings, debris, scorch that stays. A new crate drops in. Every
// particle comes from one fixed pool; the readout shows the pool in use and that nothing is allocated.
import type { SlotMount } from "../../src/slot";
import { effects } from "../../src/fx";
import { hypot } from "../../src/steer";
import { mountCard, ground, brick, W, FLOOR } from "./frame";

const CW = 58, CH = 40, G = 1200, CAP = 260;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const fx = effects({ cap: CAP, words: ["BOOM", "POW", "CRACK"] });
  // Crate: x, y, vx, vy, tilt, spin, squash, hp, respawn timer, alive.
  const k = new Float64Array([W / 2 - CW / 2, FLOOR - CH, 0, 0, 0, 0, 0, 3, 0, 1]);
  const drew = new Uint32Array(2); // drew a moving frame, frame count (shake side)
  const boom = () => {
    fx.blast(k[0]! + CW / 2, k[1]! + CH / 2, 1.1);
    fx.word(k[0]! + CW / 2, k[1]! - 8, 0, 3, 18);
    fx.kick(9);
    k[9] = 0;
    k[8] = 1.3;
  };
  card.e.add({
    step(e, dt) {
      fx.step(dt);
      if (fx.live > 0 || fx.shake > 0.05) e.busy();
      if (!k[9]) {
        k[8] = k[8]! - dt;
        if (k[8]! <= 0) k.set([W / 2 - CW / 2, -CH - 10, 0, 0, 0, 0, 0, 3, 0, 1]);
        e.busy();
        return;
      }
      if (k[6]! > 0.01) (k[6] = k[6]! * (1 - 9 * dt)), e.busy();
      else k[6] = 0;
      const air = k[1]! + CH < FLOOR - 0.01 || k[3]! < 0 || k[2]! !== 0;
      if (!air) return;
      e.busy();
      k[3] = k[3]! + G * dt;
      k[0] = k[0]! + k[2]! * dt;
      k[1] = k[1]! + k[3]! * dt;
      k[4] = k[4]! + k[5]! * dt;
      if (k[0]! < 2) (k[0] = 2), (k[2] = -k[2]! * 0.6);
      if (k[0]! > W - CW - 2) (k[0] = W - CW - 2), (k[2] = -k[2]! * 0.6);
      if (k[1]! + CH >= FLOOR && k[3]! >= 0) {
        k[1] = FLOOR - CH;
        if (k[3]! > 180) (k[6] = Math.min(1, k[3]! / 800)), (k[3] = -k[3]! * 0.3), fx.kick(k[6]! * 4);
        else k[3] = 0;
        k[2] = k[2]! * 0.55;
        if (k[2]! > -8 && k[2]! < 8) k[2] = 0;
        k[5] = 0;
        k[4] = 0;
      }
    },
    render() {
      const moving = fx.live > 0 || fx.shake > 0.05 || k[9] === 0 || k[3] !== 0 || k[2] !== 0 || k[6]! > 0 || card.dirty[0] === 1 ? 1 : 0;
      if (!moving && !drew[0]) return;
      drew[0] = moving;
      card.dirty[0] = 0;
      const { ctx } = card, light = card.theme[0] === 1, s = fx.shake;
      ground(card);
      ctx.save();
      if (s > 0) ctx.translate(((drew[1] = drew[1]! + 1) & 1 ? 0.5 : -0.5) * s, 0);
      fx.drawGround(ctx, light);
      if (k[9]) {
        ctx.save();
        ctx.translate(k[0]! + CW / 2, k[1]! + CH / 2);
        ctx.rotate(k[4]!);
        brick(card, -CW / 2, -CH / 2, CW, CH, card.tone, card.kb, k[6]!);
        // Cracks: one more for every hit the crate has taken.
        ctx.strokeStyle = "#07060f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (k[7]! < 3) ctx.moveTo(-CW / 2 + 6, -CH / 2 + 4), ctx.lineTo(-6, -2), ctx.lineTo(-12, 8);
        if (k[7]! < 2) ctx.moveTo(CW / 2 - 4, CH / 2 - 6), ctx.lineTo(8, 2), ctx.lineTo(16, -10);
        ctx.stroke();
        ctx.restore();
      }
      fx.draw(ctx, light);
      ctx.restore();
    },
  });
  return {
    tap(px, py) {
      const cx = k[0]! + CW / 2, cy = k[1]! + CH / 2;
      if (k[9] && px >= k[0]! - 4 && px <= k[0]! + CW + 4 && py >= k[1]! - 4 && py <= k[1]! + CH + 4) return boom();
      fx.blast(px, py, 0.42, 4);
      fx.kick(3);
      if (!k[9]) return;
      const d = hypot(cx - px, cy - py);
      if (d > 110) return;
      const f = 1 - d / 110, dir = cx >= px ? 1 : -1;
      k[2] = dir * (180 + 260 * f);
      k[3] = -260 - 380 * f;
      k[5] = dir * (5 + 8 * f);
      k[7] = k[7]! - 1;
      fx.word(cx, k[1]! - 6, k[7]! > 0 ? 1 : 2, 2, 13);
      if (k[7]! <= 0) boom();
    },
    read: () => `POOL ${fx.live} / ${CAP} · 0 NEW`,
  };
});
export default mount;
