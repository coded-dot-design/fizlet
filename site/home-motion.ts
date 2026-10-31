/**
 * The home page's rhythm, run by Fizlet itself (kernel + fzlt/timeline, nothing else):
 *   - reveals: each section below the fold waits faded and a little low, and plays in (a short
 *     timeline: the divider draws, the head and the panels stagger up) as it comes on screen;
 *   - parallax: the hero grid and each numbered section's big ghost number drift with the scroll,
 *     each a paused timeline scrubbed by `seek()` from where its section sits in the viewport.
 * The contract it keeps: one engine on the shared clock that settles (no frames once the scroll
 * stops); read measures (only after a resize), step samples typed arrays (no DOM, no allocation),
 * render writes change-only through the ledger. A section the scroll jumps past still plays in. Only opacity, scale and translate move: no
 * layout shift. Without JS, or with reduced motion, nothing is hidden and nothing moves (a switch
 * to reduced motion mid-visit destroys the engine: Recall gives every section back as it was).
 */
import { createEngine } from "../src/index";
import { timeline, type Timeline } from "../src/timeline";

const main = document.getElementById("main");
const still = matchMedia("(prefers-reduced-motion: reduce)");
if (main && !still.matches && typeof IntersectionObserver === "function") run(main);

function run(main: HTMLElement) {
  // No off-screen pause: at the foot of the page the footer can fill the viewport, and pausing then
  // froze reveals mid-play. Settle already stops every frame once the reveals end and the scroll stops.
  const e = createEngine({ root: main, settle: 0.4, pause: { offscreen: false } });
  // Lists of panels stagger card by card; anything else in a section's .wrap moves as one part.
  const LIVE = "[data-demo], [data-demo-host], figure.ae-slot";
  const LISTS = ".rules, .bricks, .spec-grid, .roadmap, .games, .pipeline, .start-code";

  // ---------- Reveals: 0 not yet seen, 1 waiting (hidden off screen), 2 shown ----------
  const sections = [...main.querySelectorAll<HTMLElement>("section[data-reveal]")];
  const state = new Uint8Array(sections.length);
  const reveals: Timeline[] = sections.map((sec) => {
    const parts: HTMLElement[] = [];
    for (const wrap of sec.querySelectorAll<HTMLElement>(":scope > .wrap"))
      for (const el of wrap.children as HTMLCollectionOf<HTMLElement>)
        if (el.matches(".split")) parts.push(...(el.children as HTMLCollectionOf<HTMLElement>));
        else if (el.matches(LISTS)) parts.push(...(el.children as HTMLCollectionOf<HTMLElement>));
        else if (el.matches(".section-head")) parts.push(...(el.children as HTMLCollectionOf<HTMLElement>));
        else parts.push(el);
    // A live scene never moves under a reveal: its engine owns that box (and repainting it every
    // frame would cost the scene its frames). Only the words and still panels around it reveal.
    for (let i = parts.length; i--; ) if (parts[i]!.matches(LIVE) || parts[i]!.querySelector(LIVE)) parts.splice(i, 1);
    // The whole cascade stays under about a second, however many cards a list holds.
    const stagger = Math.min(0.07, 0.6 / Math.max(1, parts.length));
    const tl = timeline(e);
    // The divider draws across and the ghost number fades up (each its own element: a custom
    // property on the section would restyle its whole subtree every frame).
    const rule = sec.querySelector<HTMLElement>(":scope > .sec-rule"), num = sec.querySelector<HTMLElement>(":scope > .sec-num");
    if (rule) tl.to(rule, { scale: ["0 1", "1 1"] }, { at: 0, dur: 0.7, ease: "inOut" });
    if (num) tl.to(num, { opacity: [0, 0.55] }, { at: 0, dur: 0.9 });
    return tl
      .to(parts, { opacity: [0, 1], translate: ["0px 28px", "0px 0px"] }, { at: 0.1, dur: 0.55, stagger });
  });
  // First sight decides: on screen now stays as it is (never hidden after it painted); off screen
  // waits at the start (seek(0) writes the first keyframes). Coming on screen plays it in.
  const io = new IntersectionObserver(
    (list) => {
      for (const en of list) {
        const i = sections.indexOf(en.target as HTMLElement), seen = state[i]!;
        if (seen === 2) continue;
        const near = en.isIntersecting && (en.intersectionRatio >= 0.12 || en.boundingClientRect.top < (en.rootBounds?.height ?? innerHeight) * 0.85);
        if (seen === 0 && en.isIntersecting) (state[i] = 2), io.unobserve(en.target);
        else if (seen === 0) (state[i] = 1), reveals[i]!.seek(0);
        else if (near) (state[i] = 2), reveals[i]!.play(), io.unobserve(en.target);
      }
    },
    { threshold: [0, 0.06, 0.12, 0.25] },
  );
  for (const s of sections) io.observe(s);
  e.signal.addEventListener("abort", () => io.disconnect(), { once: true });

  // ---------- Parallax: a paused timeline per layer, scrubbed by the scroll ----------
  const layers: { el: HTMLElement; host: HTMLElement; tl: Timeline }[] = [];
  const field = main.querySelector<HTMLElement>(".hero-field");
  if (field) layers.push({ el: field, host: field.parentElement!, tl: timeline(e).to(field, { translate: ["0px 0px", "0px 160px"] }, { dur: 1, ease: "linear" }) });
  for (const num of main.querySelectorAll<HTMLElement>(".sec-num"))
    layers.push({ el: num, host: num.parentElement!, tl: timeline(e).to(num, { translate: ["0px 70px", "0px -70px"] }, { dur: 1, ease: "linear" }) });
  // Cached geometry (page offsets), measured in read after a resize; the last progress sent.
  const top = new Float64Array(layers.length), h = new Float64Array(layers.length), sent = new Float64Array(layers.length).fill(-1);
  const g = new Float64Array(3); // scrollY, viewport height, geometry stale (1)
  const secTop = new Float64Array(sections.length); // each section's page offset, with the layers'
  g[2] = 1;
  e.add({
    read() {
      if (g[2]) {
        const y = scrollY;
        for (let i = 0; i < layers.length; i++) {
          const r = layers[i]!.host.getBoundingClientRect();
          top[i] = r.top + y;
          h[i] = r.height;
        }
        for (let i = 0; i < sections.length; i++) secTop[i] = sections[i]!.getBoundingClientRect().top + y;
        g[1] = innerHeight;
        g[2] = 0;
      }
      g[0] = scrollY;
      // The observer only reports threshold crossings, so a jump (End, an anchor, a fling, or a slow
      // frame that lands several scrolls at once) can carry a waiting section from below the fold to
      // above it with no callback, and it would wait hidden for good. Anything still waiting whose top
      // has passed the reveal line plays in here instead.
      for (let i = 0; i < sections.length; i++)
        if (state[i] === 1 && secTop[i]! - g[0]! < g[1]! * 0.85) (state[i] = 2), reveals[i]!.play(), io.unobserve(sections[i]!);
      // Progress through the viewport: 0 as the host's top enters at the bottom, 1 as its bottom
      // leaves at the top (the hero starts at 0 at the top of the page). seek() only on a change.
      for (let i = 0; i < layers.length; i++) {
        const span = i === 0 && field ? h[i]! : h[i]! + g[1]!;
        const from = i === 0 && field ? top[i]! : top[i]! - g[1]!;
        const p = Math.round(Math.min(1, Math.max(0, (g[0]! - from) / span)) * 1000) / 1000;
        if (p !== sent[i]) (sent[i] = p), layers[i]!.tl.seek(p);
      }
    },
  });
  const on = { passive: true, signal: e.signal };
  addEventListener("scroll", () => e.wake(), on);
  addEventListener("resize", () => ((g[2] = 1), e.wake()), on);
  still.addEventListener("change", () => still.matches && e.destroy(), { signal: e.signal });
  e.start();
}
