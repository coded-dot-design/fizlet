// Recipe: a shooter. Bugs fall, you fire up at them. Typed-array state, a fixed step, collision,
// pooled blasts and a change-only HUD. Kernel, input, collide, fx and hud. Runs as is with
// shooter.html. Keys count only while a run is live: Start begins one, losing the last life ends it.
import { createEngine } from "fzlt";
import { controls } from "fzlt/input";
import { circles } from "fzlt/collide";
import { effects } from "fzlt/fx";
import { hud } from "fzlt/hud";

const W = 480, H = 320, BUGS = 12, SHOTS = 16;
const root = document.getElementById("shooter");
const canvas = root.querySelector("canvas");
const start = root.querySelector("button");
const ctx = canvas.getContext("2d");

const e = createEngine({ root, seed: 7 });
const pad = controls(e, { target: canvas, keys: { left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"], fire: ["Space"] } });
const fx = effects({ cap: 240 });

// Everything that moves lives in typed arrays made once.
const bx = new Float64Array(BUGS), by = new Float64Array(BUGS), bv = new Float64Array(BUGS), alive = new Uint8Array(BUGS);
const sx = new Float64Array(SHOTS), sy = new Float64Array(SHOTS), live = new Uint8Array(SHOTS);
const g = new Float64Array(5); // [ship x, score, lives, next spawn, cooldown]
let scale = 1;

function reset() {
  alive.fill(0); live.fill(0); fx.clear();
  g.set([W / 2, 0, 3, 0.4, 0]);
}

e.add({
  read() { scale = W / canvas.clientWidth; },
  step(e, dt) {
    // Move: keys, or follow a finger or a held mouse.
    g[0] += pad.axis("left", "right") * 260 * dt;
    if (pad.pointer.down) g[0] += (pad.pointer.x * scale - g[0]) * Math.min(1, 12 * dt);
    g[0] = Math.max(16, Math.min(W - 16, g[0]));
    // Fire: Space, or a tap.
    g[4] -= dt;
    if ((pad.down("fire") || pad.pointer.hit) && g[4] <= 0) {
      const i = live.indexOf(0);
      if (i >= 0) { live[i] = 1; sx[i] = g[0]; sy[i] = H - 34; g[4] = 0.18; e.events.emit("fire"); }
    }
    // Spawn from the seeded random: the same seed, the same wave.
    if ((g[3] -= dt) <= 0) {
      const i = alive.indexOf(0);
      if (i >= 0) { alive[i] = 1; bx[i] = 20 + e.random() * (W - 40); by[i] = -12; bv[i] = 40 + e.random() * 30 + g[1] * 2; }
      g[3] = Math.max(0.35, 1.1 - g[1] * 0.03);
    }
    for (let j = 0; j < SHOTS; j++) if (live[j] && (sy[j] -= 420 * dt) < -8) live[j] = 0;
    for (let i = 0; i < BUGS; i++) {
      if (!alive[i]) continue;
      by[i] += bv[i] * dt;
      if (by[i] > H + 12) { alive[i] = 0; g[2] -= 1; e.events.emit("lost"); continue; }
      for (let j = 0; j < SHOTS; j++) {
        if (!live[j] || !circles(sx[j], sy[j], 3, bx[i], by[i], 12)) continue;
        alive[i] = 0; live[j] = 0; g[1] += 1;
        e.events.emit("hit", i, 0, bx[i], by[i]);
        break;
      }
    }
    fx.step(dt);
  },
  render() {
    for (let k = 0; k < e.events.size; k++) {
      const ev = e.events.at(k);
      if (ev.type === "hit") fx.blast(ev.x, ev.y, 0.5);
      if (ev.type === "lost") fx.kick(6);
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(fx.shake * (Math.random() - 0.5), 0); // decoration only, never the sim
    fx.drawGround(ctx);
    ctx.fillStyle = "#ff5c8f";
    for (let i = 0; i < BUGS; i++) if (alive[i]) ctx.fillRect(bx[i] - 10, by[i] - 8, 20, 16);
    ctx.fillStyle = "#ffd166";
    for (let j = 0; j < SHOTS; j++) if (live[j]) ctx.fillRect(sx[j] - 1.5, sy[j] - 6, 3, 12);
    ctx.fillStyle = "#39ffb0";
    ctx.beginPath(); ctx.moveTo(g[0], H - 30); ctx.lineTo(g[0] - 14, H - 10); ctx.lineTo(g[0] + 14, H - 10); ctx.fill();
    fx.draw(ctx);
    ctx.restore();
    if (g[2] <= 0) { // game over: stop the engine, so the page's keys are the page's again
      e.stop();
      e.ledger.attr(start, "disabled", null); // Start again
    }
  },
});
hud(e, root).num("[data-score]", [g, 1]).num("[data-lives]", () => Math.max(0, g[2]));
start.addEventListener("click", () => {
  reset();
  e.ledger.attr(start, "disabled", "");
  e.start();
}, { signal: e.signal });
reset();
