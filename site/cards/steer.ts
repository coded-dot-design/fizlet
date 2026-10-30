// steer card: a stack of small bricks that are alive. Bring the pointer near and the bricks flee
// it, scattering out of the tower; tap and every brick in reach bolts. Leave them be and each one
// turns, arrives and drops back into its own slot, and the tower stands again. Seek, flee and
// arrive on typed arrays; the bricks shove each other apart so none ever overlaps.
import type { SlotMount } from "../../src/slot";
import { steer, hypot } from "../../src/steer";
import { mountCard, ground, brick, W, FLOOR } from "./frame";

const ROWS = [5, 4, 3, 2], N = 14, BW = 24, BH = 12, FEAR = 64, SHOCK = 150;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const m = steer({ cap: N, speed: 230, turn: 14, near: 3, slow: 60, far: 170, random: card.e.random, area: [8, 8, W - 16, FLOOR - 16] });
  const hx = new Float64Array(N), hy = new Float64Array(N), fear = new Float64Array(N);
  // pointer x, y (x < 0: away), drew a moving frame, bricks off their slot, seconds the pointer
  // still scares (a parked pointer stops scaring, so the tower comes home and the engine sleeps)
  const p = new Float64Array([-1, -1, 0, 0, 0]), label = `${card.tag} ${card.kb}`;
  for (let r = 0, i = 0; r < ROWS.length; r++)
    for (let k = 0; k < ROWS[r]!; k++, i++) {
      hx[i] = W / 2 - (ROWS[r]! * (BW + 2)) / 2 + k * (BW + 2) + BW / 2 + 1;
      hy[i] = FLOOR - BH / 2 - r * (BH + 2);
      m.place(i, hx[i]!, hy[i]!, -Math.PI / 2);
    }
  card.e.add({
    step(e, dt) {
      let off = 0;
      if (p[4]! > 0) p[4] = p[4]! - dt;
      for (let i = 0; i < N; i++) {
        const near = p[4]! > 0 && p[0]! >= 0 && hypot(m.x[i]! - p[0]!, m.y[i]! - p[1]!) < FEAR;
        if (near) fear[i] = 0.35;
        if (fear[i]! > 0) {
          fear[i] = fear[i]! - dt;
          m.flee(i, p[0]! >= 0 ? p[0]! : m.x[i]!, p[0]! >= 0 ? p[1]! : FLOOR, dt, 1.6);
        } else {
          const d = hypot(hx[i]! - m.x[i]!, hy[i]! - m.y[i]!);
          // Arrive from afar; the last few pixels ease straight into the slot (a turning mover
          // can circle a goal it is right next to) and snap, so the tower stands still exactly.
          if (d > 28) m.arrive(i, hx[i]!, hy[i]!, dt);
          else if (d > 0.4) (m.x[i] = m.x[i]! + (hx[i]! - m.x[i]!) * Math.min(1, 12 * dt)), (m.y[i] = m.y[i]! + (hy[i]! - m.y[i]!) * Math.min(1, 12 * dt));
          else (m.x[i] = hx[i]!), (m.y[i] = hy[i]!), (m.a[i] = -Math.PI / 2);
        }
        // Keep inside the card, and shove apart any two bricks that overlap (box against box).
        m.x[i] = Math.max(BW / 2, Math.min(W - BW / 2, m.x[i]!));
        m.y[i] = Math.max(BH / 2, Math.min(FLOOR - BH / 2, m.y[i]!));
        if (fear[i]! > 0)
          for (let j = 0; j < N; j++) {
            if (j === i) continue;
            const ox = BW + 1 - Math.abs(m.x[j]! - m.x[i]!), oy = BH + 1 - Math.abs(m.y[j]! - m.y[i]!);
            if (ox <= 0 || oy <= 0) continue;
            if (ox < oy) m.x[i] = m.x[i]! + (m.x[i]! < m.x[j]! ? -ox : ox) * 0.5;
            else m.y[i] = m.y[i]! + (m.y[i]! < m.y[j]! ? -oy : oy) * 0.5;
          }
        if (m.x[i] !== hx[i] || m.y[i] !== hy[i]) off++;
      }
      p[3] = off;
      if (off) e.busy();
    },
    render() {
      const moving = p[3]! > 0 || card.dirty[0] === 1 ? 1 : 0;
      if (!moving && !p[2]) return;
      p[2] = moving;
      card.dirty[0] = 0;
      ground(card);
      for (let i = 0; i < N; i++) {
        const lift = fear[i]! > 0 ? 5 : 2;
        brick(card, m.x[i]! - BW / 2, m.y[i]! - BH / 2 - (lift - 2), BW, BH, card.tone, "", 0, lift);
      }
      brick(card, 8, FLOOR - 16, 78, 14, card.tone, label, 0, 2);
    },
  });
  return {
    tap(px, py) {
      for (let i = 0; i < N; i++) if (hypot(m.x[i]! - px, m.y[i]! - py) < SHOCK) fear[i] = 0.5 + card.e.random() * 0.3;
      p[0] = px;
      p[1] = py;
      p[4] = 0.4;
    },
    hover(px, py) {
      p[0] = px;
      p[1] = py;
      p[4] = px < 0 ? 0 : 0.4;
    },
    read: () => (p[3] ? `${p[3]} OF ${N} FLED · ARRIVE` : `${N} MOVERS · HOME`),
  };
});
export default mount;
