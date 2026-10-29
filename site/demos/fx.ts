// fx demo: click for the hero blast. Pooled particles; the engine settles when the last one is gone.
import { createEngine } from "../../src/index";
import { effects } from "../../src/fx";
import { stage, light, status } from "./common";

export default function fxDemo(host: HTMLElement) {
  const W = 640, H = 280;
  const { ctx, at, c } = stage(host, W, H, "Click to blast");
  const e = createEngine({ root: c, settle: 0.5, pause: { reducedMotion: true } });
  const fx = effects({ cap: 240 }), p = new Float64Array(2), st = new Uint8Array(2); // light, drawn
  e.add({
    read() {
      st[0] = light() ? 1 : 0;
    },
    step(e, dt) {
      fx.step(dt);
      if (fx.live > 0) e.busy();
    },
    render() {
      if (!fx.live && !st[1]) return;
      ctx.clearRect(0, 0, W, H);
      fx.drawGround(ctx, st[0] === 1);
      fx.draw(ctx, st[0] === 1);
      st[1] = fx.live > 0 ? 1 : 0;
    },
  });
  const put = status(host, e);
  c.addEventListener("pointerdown", (ev) => {
    at(ev, p);
    fx.blast(p[0]!, p[1]!, 1);
    st[1] = 1;
    if (e.running || e.stats().paused.includes("settled")) e.wake();
    else for (let i = 0; i < 12; i++) e.advance(1 / 60); // reduced motion: one still frame
    put();
  }, { signal: e.signal });
  e.start();
}
