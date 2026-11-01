// Docs code (shown on /guides/micro-game/): the whole game, typechecked against the source.
// ---
import { createEngine } from "@fzlt/core";
import { controls } from "@fzlt/core/input";
import { effects } from "@fzlt/core/fx";
import { hud } from "@fzlt/core/hud";
import { circles } from "@fzlt/core/collide";

const W = 640, H = 360, N = 12, R = 14;
const board = document.querySelector<HTMLElement>("#game")!;
const canvas = board.querySelector("canvas")!; // <canvas width="640" height="360">
const ctx = canvas.getContext("2d")!;

const e = createEngine({ root: board, seed: 7 });
const input = controls(e, { target: canvas });
const fx = effects({ cap: 240 });

// State in typed arrays, made once: nothing is allocated while it plays.
const x = new Float64Array(N), y = new Float64Array(N);
const vx = new Float64Array(N), vy = new Float64Array(N);
const stat = new Float64Array(2); // [score, seconds left]
function place(i: number) {
  x[i] = R + e.random() * (W - 2 * R);
  y[i] = R + e.random() * (H - 2 * R);
  const a = e.random() * Math.PI * 2;
  vx[i] = Math.cos(a) * 60;
  vy[i] = Math.sin(a) * 60;
}
for (let i = 0; i < N; i++) place(i);
stat[1] = 30;

let scale = 1; // canvas px per CSS px
e.add({
  read() { scale = W / canvas.clientWidth; }, // the only phase that measures
  step(e, dt) {                                // fixed 60 Hz: no DOM at all
    fx.step(dt);
    if (stat[1] <= 0) return;
    stat[1] = Math.max(0, stat[1] - dt);
    for (let i = 0; i < N; i++) {
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (x[i] < R || x[i] > W - R) vx[i] = -vx[i];
      if (y[i] < R || y[i] > H - R) vy[i] = -vy[i];
    }
    if (!input.pointer.hit) return;            // true in one step per click
    const px = input.pointer.x * scale, py = input.pointer.y * scale;
    for (let i = 0; i < N; i++) {
      if (!circles(px, py, 6, x[i], y[i], R)) continue;
      e.events.emit("pop", i, 0, x[i], y[i]);  // the ring, read in render
      stat[0] += 1;
      place(i);
    }
  },
  render() {
    for (let k = 0; k < e.events.size; k++) {
      const ev = e.events.at(k);
      if (ev && ev.type === "pop") fx.blast(ev.x, ev.y, 0.5);
    }
    ctx.clearRect(0, 0, W, H);
    fx.drawGround(ctx);
    ctx.fillStyle = "#39ffb0";
    for (let i = 0; i < N; i++) ctx.fillRect(x[i] - R / 2, y[i] - R / 2, R, R);
    fx.draw(ctx);
  },
});
hud(e, board).num("[data-score]", [stat, 0]).num("[data-clock]", [stat, 1], "clock");
e.start();

// Escape: Recall. The listener goes with the engine's signal.
addEventListener("keydown", (ev) => { if (ev.key === "Escape") e.destroy(); }, { signal: e.signal });
