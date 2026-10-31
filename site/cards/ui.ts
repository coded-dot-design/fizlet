// ui card: brick hopscotch on real Board UI keys. Four arcade keys from the kit (sys, fire, go, cmd)
// stand in a row. Tap a key and it fires a brick in its own colour that hops along the row; tap
// above the keys to drop one. Every key a brick lands on takes the kit's pressed face (the face
// drops onto its base) and kicks the brick on to the next key. Press all four in one run and the
// kit's sticker slams down. The keys are the kit's DOM, measured only when the card resizes; the
// hops land on their faces in the step from those numbers.
import type { SlotMount } from "../../src/slot";
import { press, slam } from "../../src/ui/board-ui";
import { mountCard, kit, brick, faint, W, H, FLOOR } from "./frame";

const K = 4, B = 6, BW = 18, BH = 12, G = 900, T = 0.5, ROLES = ["sys", "fire", "go", "cmd"], STICK = 1.3;
const CSS = `.bc-ui-keys{position:absolute;left:0;right:0;bottom:28%;display:flex;justify-content:center;pointer-events:none;gap:calc(18 * var(--u))}
.bc-ui-keys .bui-arcade{justify-content:center;min-width:calc(56 * var(--u));pointer-events:auto}
.bc-ui .bui-sticker{top:34%;pointer-events:none}`;

const mount: SlotMount = (stage, slot, first) => mountCard(stage, slot, first, (card) => {
  const root = kit(card, 260);
  root.classList.add("bc-ui");
  root.innerHTML = `<style>${CSS}</style><div class="bc-ui-keys">${ROLES.map((r) => `<button type="button" class="bui-arcade bui-${r}" tabindex="-1">${r.toUpperCase()}</button>`).join("")}</div><div class="bui-sticker" style="display:none"><b>COMBO 4</b></div>`;
  const keys = [...root.querySelectorAll<HTMLElement>(".bui-arcade")], sticker = root.querySelector<HTMLElement>(".bui-sticker")!;
  // Keys in drawing units (left, top, width), and each key's face colour, measured outside the loop.
  const kx = new Float64Array(K), ky = new Float64Array(K), kw = new Float64Array(K), kf = new Float64Array(K), kd = new Uint8Array(K);
  const tones: string[] = ROLES.map(() => card.tone);
  const measure = () => {
    const u = W / Math.max(1, card.stage.clientWidth);
    for (let k = 0; k < K; k++) {
      const el = keys[k]!;
      kx[k] = (el.offsetLeft + el.parentElement!.offsetLeft) * u;
      ky[k] = (el.offsetTop + el.parentElement!.offsetTop) * u;
      kw[k] = el.offsetWidth * u;
      tones[k] = getComputedStyle(el).backgroundColor || card.tone;
    }
    card.dirty[0] = 1;
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(card.stage);
  card.e.signal.addEventListener("abort", () => ro.disconnect());

  // Bricks: x (left), y (top), vx, vy, direction (+1 / -1), keys pressed this run, colour (key + 1, 0 the card's).
  const bx = new Float64Array(B), by = new Float64Array(B), bvx = new Float64Array(B), bvy = new Float64Array(B), bd = new Int8Array(B), bc = new Uint8Array(B), bk = new Uint8Array(B);
  const on = new Uint8Array(B);
  // presses, best run, sticker time, drew a moving frame, sticker asked, sticker shown
  const s = new Float64Array([0, 0, 0, 0, 0, 0]);
  // The hop from where a brick is to the face of key `to` (or off the end of the row), in T seconds.
  const hop = (i: number, to: number) => {
    const x = to >= 0 && to < K ? kx[to]! + kw[to]! / 2 - BW / 2 : bx[i]! + bd[i]! * 70;
    bvx[i] = (x - bx[i]!) / T;
    bvy[i] = (-G * T) / 2;
  };
  const free = () => on.indexOf(0);
  keys.forEach((el, k) =>
    press(el, () => {
      const i = free();
      if (i < 0) return;
      on[i] = 1;
      bx[i] = kx[k]! + kw[k]! / 2 - BW / 2;
      by[i] = ky[k]! - BH;
      bd[i] = k < K / 2 ? 1 : -1;
      bc[i] = 1;
      bk[i] = k + 1;
      hop(i, k + bd[i]!);
      card.e.running ? card.e.busy() : card.e.wake();
    }, card.e.signal),
  );

  card.e.add({
    step(e, dt) {
      let busy = 0;
      for (let k = 0; k < K; k++) if (kf[k]! > 0) (kf[k] = Math.max(0, kf[k]! - dt)), (busy = 1);
      if (s[2]! > 0) (s[2] = Math.max(0, s[2]! - dt)), (busy = 1);
      for (let i = 0; i < B; i++) {
        if (!on[i]) continue;
        busy = 1;
        const was = by[i]!;
        bvy[i] = bvy[i]! + G * dt;
        bx[i] = bx[i]! + bvx[i]! * dt;
        by[i] = by[i]! + bvy[i]! * dt;
        if (bvy[i]! > 0)
          for (let k = 0; k < K; k++) {
            // Landing: the brick's bottom crosses the key's top this step, over its face.
            if (was + BH > ky[k]! + 1 || by[i]! + BH < ky[k]! || bx[i]! + BW < kx[k]! + 2 || bx[i]! > kx[k]! + kw[k]! - 2) continue;
            by[i] = ky[k]! - BH;
            kf[k] = 0.16;
            s[0] = s[0]! + 1;
            bc[i] = bc[i]! + 1;
            if (bc[i]! > s[1]!) s[1] = bc[i]!;
            if (bc[i] === K) (s[4] = 1), (s[2] = STICK);
            hop(i, k + bd[i]!);
            break;
          }
        if (by[i]! + BH >= FLOOR || bx[i]! < -BW || bx[i]! > W) on[i] = 0;
      }
      if (busy) e.busy();
    },
    render() {
      // The kit's pressed face on every key a brick is on (a class, flipped only when it changes).
      for (let k = 0; k < K; k++) {
        const d = kf[k]! > 0 ? 1 : 0;
        if (d !== kd[k]) (kd[k] = d), keys[k]!.classList.toggle("down", d === 1);
      }
      // The sticker: shown and slammed (the kit restarts its animation) once per four-key run.
      if (s[4]) (s[4] = 0), (s[5] = 1), (sticker.style.display = ""), slam(sticker);
      else if (s[5] && s[2] === 0) (s[5] = 0), (sticker.style.display = "none");
      let moving = card.dirty[0]! ? 1 : 0;
      for (let i = 0; i < B; i++) moving |= on[i]!;
      if (!moving && !s[3]) return;
      s[3] = moving;
      card.dirty[0] = 0;
      const { ctx, theme } = card;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = faint(theme);
      ctx.fillRect(0, FLOOR, W, 2);
      for (let i = 0; i < B; i++) if (on[i]) brick(card, bx[i]!, by[i]!, BW, BH, bk[i] ? tones[bk[i]! - 1]! : card.tone, "", 0, 2);
      brick(card, 8, FLOOR + 4, 92, 12, card.tone, `${card.tag} ${card.kb}`, 0, 1);
    },
  });
  return {
    tap(x, y) {
      // Above the row: drop a brick there; it hops on away from the middle.
      const i = free();
      if (i < 0) return;
      on[i] = 1;
      bx[i] = Math.max(0, Math.min(W - BW, x - BW / 2));
      by[i] = Math.min(y, ky[0]! - BH - 30) - BH / 2;
      bvx[i] = 0;
      bvy[i] = 0;
      bd[i] = x < W / 2 ? 1 : -1;
      bc[i] = 0;
      bk[i] = 0;
    },
    read: () => `BEST RUN ${s[1]}/${K}`,
  };
});
export default mount;
