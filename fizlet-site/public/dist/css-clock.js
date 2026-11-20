import {
  timeline
} from "./chunks/chunk-U366ZQ55.js";
import {
  createEngine
} from "./chunks/chunk-5VOOXBKR.js";
import "./chunks/chunk-RXTVZ32U.js";
import "./chunks/chunk-26IPXWAE.js";
import "./chunks/chunk-RA74YNEB.js";

// src/css-clock.ts
function cssClock(root, o = {}) {
  const span = o.span ?? 6, T = span * (o.loops ?? 3), { fps, signal, motion } = o;
  const engine = createEngine({ root, settle: 0.5, ...fps && { fps }, ...signal && { signal } });
  const tl = timeline(engine, motion == null ? {} : { motion }).to(root, { [o.prop ?? "--fz-t"]: ["0s", -T + "s"] }, { dur: T, ease: "linear" });
  let held = false;
  const play = () => {
    if (held) return;
    if (!tl.playing) tl.seek(0).play();
  };
  const on = { signal: engine.signal };
  root.addEventListener("pointerenter", play, on);
  root.addEventListener("focusin", play, on);
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((l) => l[l.length - 1].isIntersecting && play());
    io.observe(root);
    engine.signal.addEventListener("abort", () => io.disconnect(), { once: true });
  }
  engine.start();
  play();
  return {
    engine,
    tl,
    /** Play from the start (unless held). */
    play,
    /** Hold or release (a pause button): held, it keeps its frame and asks for nothing. */
    hold(on2) {
      held = on2;
      if (on2) tl.pause();
      else tl.play();
    },
    /** Stop for good and give the page back (Recall). */
    destroy: () => engine.destroy()
  };
}
export {
  cssClock
};
