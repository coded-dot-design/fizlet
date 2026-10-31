// embed card: an easter egg. The vault is locked and @fzlt/core/embed sits dormant: tiny listeners only,
// nothing mounted. A single tap only rattles it. Double-tap the card (embed's gesture trigger) or
// type B R I C K anywhere on the page (its key sequence; keys typed in a field never count) and
// embed unlocks and mounts the game: the vault bursts and a fountain of coins bounces out to be
// collected with taps. Escape, or a tap on the open vault, closes it (embed's close: the game is
// destroyed and its host removed); once unlocked, a tap on the vault opens it again.
import type { SlotMount } from "../../src/slot";
import { embed } from "../../src/embed";
import { mountCard, ground, brick, ink, FLOOR } from "./frame";

const TOP = 30, N = 14, VX = 136, VW = 48, VH = 34, VY = FLOOR - VH, R = 6, G = 1100, XMAX = 222, GOLD = "#ffd84a";

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e, c = card.c;
  c.dataset.bcVault = "";
  // Coins: x, y, vx, vy, state (0 gone, 1 out, 2 collected: popping), pop 0..1.
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
  const st = new Uint8Array(N), pop = new Float64Array(N);
  // open, rattle, tap pending, tap x, tap y, collected, unlocks, drew, burst
  const s = new Float64Array(9);
  const kick = () => (e.running ? e.busy() : e.wake());
  const egg = embed(
    () => () => {
      // The game embed mounts on unlock: the vault opens and the coins burst out.
      s[0] = 1;
      s[6] = s[6]! + 1;
      s[8] = 1;
      kick();
      return {
        destroy() {
          s[0] = 0;
          st.fill(0);
          kick();
        },
      };
    },
    {
      name: "bc-vault",
      label: "vault",
      easterEgg: { sequence: ["b", "r", "i", "c", "k"], gesture: { on: "[data-bc-vault]", type: "double-tap" }, click: false, toggle: false, scope: { sequence: "all", gesture: "all" } },
    },
  );
  e.signal.addEventListener("abort", () => egg.destroy());
  e.add({
    step(e, dt) {
      let busy = 0;
      if (s[8]) {
        // The burst: a fan of coins out of the vault's top.
        s[8] = 0;
        for (let i = 0; i < N; i++) {
          x[i] = VX + VW / 2;
          y[i] = VY - R;
          vx[i] = -260 + (i * 520) / (N - 1) + ((i * 37) % 11) * 6;
          vy[i] = -380 - ((i * 53) % 7) * 40;
          st[i] = 1;
          pop[i] = 0;
        }
      }
      if (s[2]) {
        s[2] = 0;
        let best = -1, bd = 22 * 22;
        for (let i = 0; i < N; i++) {
          if (st[i] !== 1) continue;
          const dx = x[i]! - s[3]!, dy = y[i]! - s[4]!, d2 = dx * dx + dy * dy;
          if (d2 < bd) (bd = d2), (best = i);
        }
        if (best >= 0) (st[best] = 2), (s[5] = s[5]! + 1);
      }
      if (s[1]! > 0.01) (s[1] = s[1]! * (1 - 7 * dt)), (busy = 1);
      else s[1] = 0;
      for (let i = 0; i < N; i++) {
        if (st[i] === 2) {
          pop[i] = pop[i]! + dt * 3;
          if (pop[i]! >= 1) st[i] = 0;
          busy = 1;
          continue;
        }
        if (st[i] !== 1 || (vx[i] === 0 && vy[i] === 0)) continue;
        busy = 1;
        vy[i] = vy[i]! + G * dt;
        x[i] = x[i]! + vx[i]! * dt;
        y[i] = y[i]! + vy[i]! * dt;
        if (x[i]! < R) (x[i] = R), (vx[i] = -vx[i]! * 0.6);
        if (x[i]! > XMAX) (x[i] = XMAX), (vx[i] = -vx[i]! * 0.6);
        if (y[i]! < TOP) (y[i] = TOP), (vy[i] = -vy[i]! * 0.5); // under the readout
        if (y[i]! >= FLOOR - R) {
          y[i] = FLOOR - R;
          if (vy[i]! > 80) vy[i] = -vy[i]! * 0.45;
          else vy[i] = 0;
          vx[i] = vx[i]! * 0.82;
          if (vx[i]! < 4 && vx[i]! > -4 && vy[i] === 0) vx[i] = 0;
        }
      }
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]! || (s[1]! > 0 ? 1 : 0);
      for (let i = 0; i < N; i++) if (st[i] === 2 || (st[i] === 1 && (vx[i] !== 0 || vy[i] !== 0))) moving = 1;
      if (!moving && !s[7]) return;
      s[7] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      // The vault: locked (it rattles) or open (its lid up).
      const wob = s[1]! > 0 ? Math.sin(s[1]! * 50) * 3 * s[1]! : 0;
      brick(card, VX + wob, VY, VW, VH, s[0] ? GOLD : ink(theme), s[0] ? "" : egg.unlocked ? "TAP" : "LOCKED", s[1]! > 0 ? 0.0001 : 0, 3);
      if (s[0]) brick(card, VX - 4, VY - 26, VW + 8, 8, GOLD, "", 0, 2);
      for (let i = 0; i < N; i++) {
        if (!st[i]) continue;
        const p = pop[i]!;
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = "#07060f";
        ctx.beginPath();
        ctx.arc(x[i]!, y[i]! + 1 - p * 18, R + 1 + p * 4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(x[i]!, y[i]! - p * 18, R - 0.5 + p * 4, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // The name brick: the floor's right end, past the wall no coin crosses.
      brick(card, 236, FLOOR - 40, 72, 18, card.tone, card.tag);
      brick(card, 236, FLOOR - 18, 72, 18, card.tone, card.kb);
    },
  });
  return {
    tap(px, py) {
      const onVault = px >= VX - 6 && px <= VX + VW + 6 && py >= VY - 30 && py <= FLOOR + 4;
      if (s[0]) {
        if (onVault) egg.close();
        else (s[2] = 1), (s[3] = px), (s[4] = py);
      } else if (onVault && egg.unlocked) void egg.open();
      else s[1] = 1; // locked: it only rattles (a second tap soon after is embed's double-tap)
    },
    read: () =>
      s[0] ? `COINS ${s[5]} · ESC CLOSES` : egg.unlocked ? "UNLOCKED · TAP VAULT" : "LOCKED · TYPE BRICK",
  };
});
export default mount;
