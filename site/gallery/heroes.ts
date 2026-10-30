// The heroes page: a scroll-snap row of large cards. The card in the centre plays (an
// IntersectionObserver on a band in the middle of the row); every other card is its poster. Prev /
// next keys and the arrow keys move a card at a time. Each card's Play key pauses or plays it (and
// is the only way to play under reduced motion: posters until asked). Full screen: the Fullscreen
// API, or an overlay where it is missing; Esc closes and focus goes back to the key that opened it.
// A hero is a game's own landing hero in its own document (site/heroes/: the stage, data-stage on
// the card): playing it mounts the stage in an iframe over the poster; stopping it removes the
// iframe (the scene, its engine and its listeners go with it). The iframe is sandboxed without
// top navigation, and the stage itself drops every link and form (site/heroes/stage.ts): nothing
// in a hero ever leaves this page.

const track = document.querySelector<HTMLElement>("[data-hero-track]");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");

if (track) {
  const cards = [...track.querySelectorAll<HTMLElement>("[data-hero]")];
  const prev = document.querySelector<HTMLButtonElement>("[data-hero-prev]");
  const next = document.querySelector<HTMLButtonElement>("[data-hero-next]");
  const live = new Map<HTMLElement, { stage: HTMLElement; hid: HTMLElement[] }>();
  const loading = new Map<HTMLElement, number>();
  const pending = new Map<HTMLElement, HTMLIFrameElement>(); // stages still loading
  const stopped = new Set<HTMLElement>(); // paused by hand: the centre does not restart them
  const asked = new Set<HTMLElement>(); // played by hand (the only way under reduced motion)
  let centre: HTMLElement | null = null, run = 0, opener: HTMLElement | null = null, full: HTMLElement | null = null;

  const fig = (card: HTMLElement) => card.querySelector<HTMLElement>("figure[data-hero-fig]")!;
  const key = (card: HTMLElement) => card.querySelector<HTMLButtonElement>("[data-hero-play]")!;
  const mark = (card: HTMLElement) => {
    const on = live.has(card) || loading.has(card);
    key(card).setAttribute("aria-pressed", String(on));
    key(card).lastChild!.nodeValue = on ? "Pause" : "Play";
    on ? (card.dataset.playing = "1") : delete card.dataset.playing;
  };

  function play(card: HTMLElement) {
    if (live.has(card) || loading.has(card)) return;
    const id = ++run;
    loading.set(card, id);
    mark(card);
    const f = fig(card);
    const stage = document.createElement("iframe");
    stage.src = new URL(card.dataset.stage!, location.href).href;
    stage.title = card.dataset.stageTitle!;
    stage.setAttribute("data-fizlet-slot", card.dataset.hero!);
    stage.setAttribute("sandbox", "allow-scripts allow-same-origin");
    stage.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;contain:strict;opacity:0";
    // The poster stays until the stage has painted: no blank frame between them.
    stage.addEventListener("load", () => {
      if (loading.get(card) !== id) return;
      loading.delete(card);
      pending.delete(card);
      stage.style.opacity = "";
      const hid = [...f.querySelectorAll<HTMLElement>(":scope > .ae-slot__placeholder, :scope > .ae-slot__fallback")].filter((c) => c.style.display !== "none");
      for (const c of hid) c.style.display = "none";
      live.set(card, { stage, hid });
      mark(card);
    }, { once: true });
    f.append(stage);
    pending.set(card, stage);
  }
  function stop(card: HTMLElement) {
    loading.delete(card);
    pending.get(card)?.remove();
    pending.delete(card);
    const l = live.get(card);
    if (l) {
      live.delete(card);
      l.stage.remove();
      for (const c of l.hid) c.style.display = "";
    }
    mark(card);
  }
  /** Play what should play: the full-screen card; else the cards played by hand and the centre card
   *  (motion allowed, not paused by hand). Everything else is its poster. */
  const wanted = (c: HTMLElement) => (full ? c === full : asked.has(c) || (c === centre && !reduce.matches && !stopped.has(c)));
  function settle() {
    for (const c of cards) wanted(c) ? play(c) : stop(c);
  }
  /** A size change (full screen in or out): the scene reads its stage size at mount, so mount it again. */
  const remount = (card: HTMLElement) => (stop(card), requestAnimationFrame(() => settle()));

  // The centre band: a card crossing the middle 30% of the row is the one that plays.
  const io = new IntersectionObserver((list) => {
    for (const e of list) e.target.toggleAttribute("data-centre", e.isIntersecting);
    const now = cards.find((c) => c.hasAttribute("data-centre")) ?? null;
    if (now === centre) return;
    centre?.removeAttribute("aria-current");
    centre = now;
    centre?.setAttribute("aria-current", "true");
    if (prev) prev.disabled = centre === cards[0];
    if (next) next.disabled = centre === cards[cards.length - 1];
    settle();
  }, { root: track, rootMargin: "0px -35% 0px -35%" });
  for (const c of cards) io.observe(c);
  // Off screen (the whole row scrolled away): nothing plays.
  new IntersectionObserver(([e]) => {
    if (e!.isIntersecting) settle();
    else for (const c of cards) if (c !== full) stop(c);
  }).observe(track);

  const go = (step: number) => {
    const i = Math.max(0, Math.min(cards.length - 1, (centre ? cards.indexOf(centre) : 0) + step));
    cards[i]!.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
  };
  prev?.addEventListener("click", () => go(-1));
  next?.addEventListener("click", () => go(1));
  track.addEventListener("keydown", (ev) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -cards.length, End: cards.length }[ev.key];
    if (!step || (ev.target as HTMLElement).closest("button, a")) return;
    ev.preventDefault();
    go(step);
  });

  for (const card of cards) {
    key(card).addEventListener("click", () => {
      const on = live.has(card) || loading.has(card);
      if (on) (stopped.add(card), asked.delete(card), stop(card));
      else (stopped.delete(card), asked.add(card), play(card));
    });
    const openKey = card.querySelector<HTMLButtonElement>("[data-hero-open]")!;
    openKey.addEventListener("click", () => open(card, openKey));
    fig(card).addEventListener("click", () => open(card, openKey));
    card.querySelector("[data-hero-close]")!.addEventListener("click", () => close());
  }
  reduce.addEventListener("change", settle);

  // ---------- Full screen ----------
  function open(card: HTMLElement, from: HTMLElement) {
    if (full) return;
    full = card;
    opener = from;
    const box = card.querySelector<HTMLElement>("[data-hero-stage]")!;
    const closeKey = box.querySelector<HTMLButtonElement>("[data-hero-close]")!;
    closeKey.hidden = false;
    const overlay = () => {
      box.classList.add("hero-full");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      document.documentElement.classList.add("hero-lock");
      closeKey.focus();
      remount(card);
    };
    if (document.fullscreenEnabled && box.requestFullscreen)
      box.requestFullscreen().then(() => (closeKey.focus(), remount(card)), overlay);
    else overlay();
  }
  function close() {
    if (!full) return;
    const card = full, box = card.querySelector<HTMLElement>("[data-hero-stage]")!;
    full = null;
    const back = opener;
    opener = null;
    box.classList.remove("hero-full");
    box.removeAttribute("role");
    box.removeAttribute("aria-modal");
    document.documentElement.classList.remove("hero-lock");
    box.querySelector<HTMLElement>("[data-hero-close]")!.hidden = true;
    // Focus goes back once the browser has left full screen (focus inside its exit does not stick).
    const refocus = () => requestAnimationFrame(() => back?.focus({ preventScroll: true }));
    document.fullscreenElement ? document.exitFullscreen().then(refocus, refocus) : refocus();
    remount(card);
  }
  // The browser leaves full screen on its own Esc: close with it.
  document.addEventListener("fullscreenchange", () => !document.fullscreenElement && close());
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && full) (ev.preventDefault(), close());
    // The overlay is modal: Tab stays on its close key.
    if (ev.key === "Tab" && full && !document.fullscreenElement) (ev.preventDefault(), full.querySelector<HTMLElement>("[data-hero-close]")!.focus());
  });
}
