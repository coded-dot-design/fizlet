// rules card: supply drops in waves. Tap the sky and a wave starts: crates fall into the lanes,
// land and wait a few seconds before they expire. Tap a landed crate to collect it; collect in a
// quick chain and the combo multiplies the points; enough XP and you level up. Let one expire and
// the streak ends. All three rules systems run it: `waves` paces the spawns and says when the wave
// is clear, `drops` owns the crates (fall, land, expire, collect), `score` the points, combo and levels.
// Between waves the wave clock is taken off the engine, so the card sleeps until the next tap.
import type { SlotMount } from "../../src/slot";
import { waves, drops, score } from "../../src/rules";
import { mountCard, ground, brick, ink, faint, FLOOR, W } from "./frame";

const LAND = FLOOR, LANES = 6, LX = 116, LW = 34, POP = 6, STAR = "#ffd84a";

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const e = card.e;
  const d = drops(e, { kinds: ["crate", "star"], cap: 8, life: 3.4, fall: 150, speed: 170 });
  const sc = score(e, { combo: { window: 2.2, step: 2, max: 4 }, levels: [6, 16, 32, 56, 90, 140] });
  const w = waves(e, {
    alive: () => d.count,
    prepare: 0.5,
    rebuild: 0.5,
    size: (n) => Math.min(14, 3 + n * 2),
    limit: (n) => Math.min(6, 2 + n),
    gap: (n) => Math.max(0.22, 0.75 - n * 0.08),
  });
  e.remove(w.system); // asleep until the first tap
  // armed, tap pending, tap x, tap y, (unused), event cursor, wave banner, level flash, drew
  const s = new Float64Array([0, 0, 0, 0, 7, 0, 0, 0, 0]);
  // Score popups: x, y, age (≥ 1: free), points.
  const seed = new Int32Array([7]);
  const px = new Float64Array(POP), py = new Float64Array(POP), pa = new Float64Array(POP).fill(1), pv = new Int32Array(POP);
  e.add({
    read() {
      s[5] = 0;
    },
    step(e, dt) {
      // Spawn while the wave clock says so: a lane at random, every fourth one a star.
      while (w.ready()) {
        seed[0] = Math.imul(seed[0]!, 1103515245) + 12345;
        const lane = (seed[0]! >>> 16) % LANES, k = (w.left & 3) === 1 ? 1 : 0;
        d.spawn(LX + lane * LW, LAND, k);
        w.spawned();
      }
      if (s[1]) {
        s[1] = 0;
        const got = d.collect(s[2]!, s[3]!, 22);
        if (got === "star") sc.add(25, 3, s[2]!, s[3]!);
        else if (got === "crate") sc.add(10, 1, s[2]!, s[3]!);
        else sc.miss(); // a whiff ends the streak
      }
      // A crate that expired breaks the streak (read off this frame's event ring).
      for (let i = s[5]!; i < e.events.size; i++) if (e.events.at(i)!.type === "drop:expire") sc.miss();
      s[5] = e.events.size;
      if (s[6]! > 0) s[6] = Math.max(0, s[6]! - dt);
      if (s[7]! > 0) s[7] = Math.max(0, s[7]! - dt);
      for (let i = 0; i < POP; i++) if (pa[i]! < 1) pa[i] = pa[i]! + dt * 1.2;
      if (s[0] || d.count || sc.streak || s[6]! > 0 || s[7]! > 0) e.busy();
      else for (let i = 0; i < POP; i++) if (pa[i]! < 1) { e.busy(); break; }
    },
    render() {
      // What the step said: popups, the banner, the level flash; a clear wave takes the clock off.
      for (let i = 0; i < e.events.size; i++) {
        const ev = e.events.at(i)!;
        if (ev.type === "score") {
          let j = 0;
          for (let k = 1; k < POP; k++) if (pa[k]! > pa[j]!) j = k;
          px[j] = ev.x; py[j] = ev.y - 20; pa[j] = 0; pv[j] = ev.a;
        } else if (ev.type === "wave:start") s[6] = 1.1;
        else if (ev.type === "level") s[7] = 1.4;
        else if (ev.type === "wave:clear" && s[0]) (s[0] = 0), e.remove(w.system), (s[6] = 1.1);
      }
      let moving = card.dirty[0]! || s[0]! || d.count || s[6]! > 0 || s[7]! > 0 ? 1 : 0;
      for (let i = 0; i < POP; i++) if (pa[i]! < 1) moving = 1;
      if (!moving && !s[8]) return;
      s[8] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      // The lanes, faint, where crates land.
      ctx.fillStyle = faint(theme);
      for (let l = 0; l < LANES; l++) ctx.fillRect(LX + l * LW - 12, LAND + 4, 24, 2);
      for (let i = 0; i < d.count; i++) {
        const x = d.x[i]!, y = d.y[i]!, left = d.life - d.age[i]!;
        if (left < 1 && ((left * 10) | 0) & 1) continue; // blinks in its last second
        if (y < LAND) {
          ctx.fillStyle = faint(theme);
          ctx.fillRect(x - 10, LAND + 1, 20, 2);
        }
        brick(card, x - 12, y - 20, 24, 18, d.kind[i] ? STAR : card.tone, d.kind[i] ? "★" : "", 0, 2);
      }
      // The name brick: on the floor at the left, where no crate falls.
      brick(card, 14, FLOOR - 40, 70, 18, card.tone, card.tag);
      brick(card, 14, FLOOR - 18, 70, 18, card.tone, card.kb);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 10px ui-monospace, Menlo, monospace";
      for (let i = 0; i < POP; i++)
        if (pa[i]! < 1) {
          ctx.globalAlpha = 1 - pa[i]!;
          ctx.fillStyle = pv[i]! > 25 ? STAR : ink(theme);
          ctx.fillText("+" + pv[i], px[i]!, py[i]! - pa[i]! * 26);
        }
      ctx.globalAlpha = 1;
      ctx.font = "800 13px ui-monospace, Menlo, monospace";
      ctx.fillStyle = ink(theme);
      if (s[7]! > 0) ctx.fillText(`LEVEL ${sc.level}`, (LX + W) / 2 - 8, 52);
      else if (s[6]! > 0) ctx.fillText(s[0] ? `WAVE ${w.wave}` : `WAVE ${w.wave} CLEAR`, (LX + W) / 2 - 8, 52);
      else if (!s[0] && !d.count) {
        ctx.font = "800 9px ui-monospace, Menlo, monospace";
        ctx.fillStyle = theme[0] ? "rgba(20,18,31,.5)" : "rgba(233,230,255,.5)";
        ctx.fillText("TAP FOR THE NEXT WAVE", (LX + W) / 2 - 8, 52);
      }
    },
  });
  return {
    tap(x, y) {
      if (!s[0] && !d.count) {
        // Idle: the wave clock goes back on and the next wave starts after its short prepare.
        s[0] = 1;
        e.add(w.system);
        return;
      }
      s[1] = 1; s[2] = x; s[3] = y - 10; // collected in the next step, like the rest of the game
    },
    read: () => `SCORE ${sc.points}${sc.combo > 1 ? ` · ×${sc.combo}` : ""} · LV ${sc.level}`,
  };
});
export default mount;
