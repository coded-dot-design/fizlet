// sound card: the brick stairs. Tap above the stairs to drop a ball; it bounces down, and every
// brick it lands on plays that brick's cue (click, fire, hit, power, ready, win, boom) and rings.
// The collision only emits an event; @fzlt/core/sound reads the event ring after the frame and plays
// the cue on a tiny oscillator synth: no audio files, silent until your first press.
import type { SlotMount } from "../../src/slot";
import { sound, type Cue } from "../../src/sound";
import { mountCard, ground, brick, ink, W, H, FLOOR } from "./frame";

const CUES: Cue[] = ["click", "fire", "hit", "power", "ready", "win", "boom"];
const STEPS = CUES.length, SW = 40, SH = 14, X0 = 16, DX = 41, Y0 = 62, DY = 15, BALLS = 4, R = 5, G = 760;
const TYPES = CUES.map((_, i) => `stair${i}`);

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const cues: Record<string, Cue> = {};
  CUES.forEach((c, i) => (cues[TYPES[i]!] = c));
  const sfx = sound(card.e, { cues });
  const ring = new Float64Array(STEPS), hits = new Int32Array(STEPS + 1); // per step; total
  const qx = new Float64Array(BALLS), qy = new Float64Array(BALLS), qvx = new Float64Array(BALLS), qvy = new Float64Array(BALLS);
  const ql = new Uint8Array(BALLS), drew = new Uint8Array(1);
  const top = (i: number) => Y0 + i * DY, left = (i: number) => X0 + i * DX;
  card.e.add({
    step(e, dt) {
      let busy = 0;
      for (let b = 0; b < BALLS; b++) {
        if (!ql[b]) continue;
        busy = 1;
        qvy[b] = qvy[b]! + G * dt;
        const py = qy[b]!;
        qx[b] = qx[b]! + qvx[b]! * dt;
        qy[b] = qy[b]! + qvy[b]! * dt;
        if (qx[b]! < R) (qx[b] = R), (qvx[b] = -qvx[b]!);
        for (let i = 0; i < STEPS; i++) {
          const x0 = left(i), y0 = top(i);
          if (qx[b]! < x0 - R + 2 || qx[b]! > x0 + SW + R - 2) continue;
          // Landing: the ball crossed the brick's top this step, coming down.
          if (qvy[b]! > 0 && py + R <= y0 + 1 && qy[b]! + R >= y0) {
            qy[b] = y0 - R;
            qvy[b] = -Math.max(190, qvy[b]! * 0.62);
            if (qvx[b]! < 46) qvx[b] = 46 + (i & 1) * 10;
            ring[i] = 1;
            hits[i] = hits[i]! + 1;
            hits[STEPS] = hits[STEPS]! + 1;
            e.events.emit(TYPES[i]!, 1);
          }
        }
        if (qx[b]! > W + R || qy[b]! > H + R) ql[b] = 0;
        if (qy[b]! + R >= FLOOR && qvy[b]! > 0) (qy[b] = FLOOR - R), (qvy[b] = -qvy[b]! * 0.5), (qvx[b] = qvx[b]! * 0.8), qvy[b]! > -60 && (ql[b] = 0);
      }
      for (let i = 0; i < STEPS; i++) if (ring[i]! > 0) (ring[i] = Math.max(0, ring[i]! - dt * 2.2)), (busy = 1);
      if (busy) e.busy();
    },
    render() {
      let moving = card.dirty[0]!;
      for (let b = 0; b < BALLS; b++) moving |= ql[b]!;
      for (let i = 0; i < STEPS; i++) if (ring[i]! > 0) moving = 1;
      if (!moving && !drew[0]) return;
      drew[0] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ground(card);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < STEPS; i++) {
        const x = left(i), y = top(i), r = ring[i]!;
        if (r > 0) {
          ctx.strokeStyle = card.tone;
          ctx.globalAlpha = r;
          ctx.lineWidth = 2;
          ctx.strokeRect(x - (1 - r) * 14, y - (1 - r) * 14, SW + (1 - r) * 28, SH + (1 - r) * 28);
          ctx.globalAlpha = 1;
        }
        brick(card, x, y - r * 3, SW, SH, r > 0.5 ? "#ffffff" : card.tone, CUES[i]!.toUpperCase(), 0, 2 + r * 3);
      }
      ctx.fillStyle = ink(theme);
      for (let b = 0; b < BALLS; b++) {
        if (!ql[b]) continue;
        ctx.beginPath();
        ctx.arc(qx[b]!, qy[b]!, R, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
  const label = `${card.tag} ${card.kb}`;
  card.e.add({ render() { brick(card, W - 84, 24, 76, 14, card.tone, label, 0, 2); } });
  return {
    tap(x, y) {
      for (let b = 0; b < BALLS; b++) {
        if (ql[b]) continue;
        qx[b] = Math.max(R, Math.min(W - R, x));
        qy[b] = Math.min(y, Y0 - 20);
        qvx[b] = 30;
        qvy[b] = 0;
        ql[b] = 1;
        return;
      }
    },
    read: () => (hits[STEPS] ? `${hits[STEPS]} NOTES · ${sfx.on ? "SYNTH ON" : "MUTED"} · 0 FILES` : `CUES ${STEPS} · 0 AUDIO FILES`),
  };
});
export default mount;
