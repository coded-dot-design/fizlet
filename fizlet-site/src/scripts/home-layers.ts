// The home hero's layers figure: its chunk (demos/layers/entry.ts) loads once the figure nears the
// viewport, or on the first press, focus or wheel over it. Reduced motion: only once that is lifted.
const f = document.querySelector<HTMLElement>("figure.lyr");
if (f) {
  const m = matchMedia("(prefers-reduced-motion: reduce)");
  let done = 0;
  const go = () => {
    if (done++) return;
    io.disconnect();
    import("./demos/layers/entry");
  };
  const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && go(), { rootMargin: "200px" });
  const arm = () => {
    io.observe(f);
    f.addEventListener("pointerdown", go, { once: true });
    f.addEventListener("focus", go, { once: true });
  };
  f.addEventListener("wheel", (e) => void (m.matches || e.ctrlKey || (e.preventDefault(), go())), { passive: false });
  m.matches ? m.addEventListener("change", arm, { once: true }) : arm();
}
