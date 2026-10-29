// Kernel demo: settle. A puck glides to where you click; the system calls busy() while it moves,
// and half a second after it stops the engine sleeps: no requestAnimationFrame, the frame count stops.
import { createEngine } from "../../src/index";
import { stage, ink, line, status } from "./common";

export default function settle(host: HTMLElement) {
  const W = 640, H = 240;
  const { ctx, at, c } = stage(host, W, H, "Click to move the puck; the engine sleeps when it stops");
  const e = createEngine({ root: c, settle: 0.5, pause: { reducedMotion: true } });
  // x, y, target x, target y, last drawn x, last drawn y
  const s = new Float64Array([W / 2, H / 2, W / 2, H / 2, -1, -1]), p = new Float64Array(2);
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = line();
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.fillStyle = "#39ffb0";
    ctx.beginPath();
    ctx.arc(s[0]!, s[1]!, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink();
    ctx.strokeRect(s[2]! - 4, s[3]! - 4, 8, 8);
  };
  e.add({
    step(e, dt) {
      const dx = s[2]! - s[0]!, dy = s[3]! - s[1]!;
      if (dx * dx + dy * dy < 0.25) return;
      s[0]! += dx * Math.min(1, 6 * dt);
      s[1]! += dy * Math.min(1, 6 * dt);
      e.busy();
    },
    render() {
      if (s[0] === s[4] && s[1] === s[5]) return;
      s[4] = s[0]!;
      s[5] = s[1]!;
      draw();
    },
  });
  const put = status(host, e);
  c.addEventListener("pointerdown", (ev) => {
    at(ev, p);
    s[2] = p[0]!;
    s[3] = p[1]!;
    if (e.running || e.stats().paused.includes("settled")) e.wake();
    else (s[0] = s[2]), (s[1] = s[3]), draw(); // reduced motion: jump, no animation
    put();
  }, { signal: e.signal });
  draw();
  e.start();
}
