// Scroll-lock hint: a demo frame that keeps drags and taps for its piece also keeps the page's
// scroll (the kit's `overscroll-behavior: none` on a clipping slot, `touch-action: none` on a
// game host). That stays as it is; this only says why, at the moment someone tries. A wheel or a
// vertical swipe over a frame that ends with no scroll anywhere on the page (measured, never
// guessed: a frame that lets the page scroll never shows it) opens a small note on the frame's
// edge and puts the frame in a warning state (`data-scroll-warn`, `--frame-warn` in site.css).
// It closes after 3 s or when the mouse leaves the frame; once per frame every 20 s; announced
// once per page through a polite live region. Site layer only: no brick or kernel bytes.

/** Frames that can hold input: slots, game hosts, touch-locked surfaces and the site's demo surfaces. */
export const FRAMES = ".ae-slot,[data-fizlet-slot],[data-fizlet-host],[data-touch-lock],.demo-board,.bd-canvas,.bd-tl,.lab-stage";
export const SHOW_MS = 3000;
export const QUIET_MS = 20000;
/** Scroll intent needed before it counts: wheel pixels in one burst, or finger travel. */
const WHEEL_PX = 40, SWIPE_PX = 24, WAIT_MS = 160;
const LEAD = "Scrolling is paused over this demo so your drags and taps go to the animation.";
export const COPY = { mouse: `${LEAD} Move off it to scroll the page.`, touch: `${LEAD} Swipe outside the frame to scroll.` };

export function scrollHint(doc: Document = document): () => void {
  const win = doc.defaultView!;
  const ac = new AbortController();
  const on = { capture: true, passive: true, signal: ac.signal };
  const last = new WeakMap<Element, number>();
  let scrolled = 0; // when anything on the page last scrolled
  let note: HTMLElement | null = null, frame: Element | null = null, timer = 0, said = false;
  let live: HTMLElement | null = null;
  // Wheel burst / swipe state.
  let wFrame: Element | null = null, wSum = 0, wAt = 0, wStart = 0;
  let tFrame: Element | null = null, tx = 0, ty = 0, tStart = 0, tDone = false;

  /** The outermost frame under the target (a slot's inner stage belongs to its figure). */
  const frameOf = (t: EventTarget | null) => {
    let f: Element | null = null;
    for (let e = t instanceof Element ? t.closest(FRAMES) : null; e; e = e.parentElement?.closest(FRAMES) ?? null) f = e;
    return f && !doc.fullscreenElement && !f.closest(".hero-full") ? f : null;
  };
  /** The page could have moved that way (not already at the top or the bottom). */
  const room = (dy: number) => {
    const max = doc.documentElement.scrollHeight - win.innerHeight;
    return dy > 0 ? win.scrollY < max - 1 : win.scrollY > 1;
  };

  const close = () => {
    win.clearTimeout(timer);
    frame?.removeAttribute("data-scroll-warn");
    note?.removeAttribute("data-open");
    const n = note;
    if (n) win.setTimeout(() => n.isConnected && !n.hasAttribute("data-open") && n.remove(), 300);
    note = frame = null;
  };

  const show = (f: Element, touch: boolean) => {
    const now = win.performance.now();
    if (now - (last.get(f) ?? -QUIET_MS) < QUIET_MS || f === frame) return;
    close();
    last.set(f, now);
    const r = f.getBoundingClientRect();
    const text = touch ? COPY.touch : COPY.mouse;
    const n = doc.createElement("div");
    n.className = "scroll-hint";
    n.setAttribute("aria-hidden", "true"); // the live region says it, once
    n.innerHTML = "<p></p>";
    n.firstElementChild!.textContent = text;
    // Under the frame's bottom edge, or above its top edge when the bottom is near the screen's.
    const up = r.bottom > win.innerHeight - 96;
    if (up) n.dataset.edge = "top";
    n.style.cssText = `left:${r.left + win.scrollX + 12}px;width:${Math.max(0, r.width - 24)}px;${up ? `top:${r.top + win.scrollY}px;transform:translateY(-100%)` : `top:${r.bottom + win.scrollY}px`}`;
    doc.body.append(n);
    void n.offsetWidth; // start closed, then slide out
    n.dataset.open = "";
    f.setAttribute("data-scroll-warn", "");
    note = n;
    frame = f;
    timer = win.setTimeout(close, SHOW_MS);
    if (!said && live) (said = true), (live.textContent = text);
  };

  /** After the scroll would have started: nothing moved since the attempt began → the frame held it. */
  const check = (f: Element, since: number, dy: number, touch: boolean) =>
    win.setTimeout(() => scrolled < since && room(dy) && show(f, touch), WAIT_MS);

  doc.addEventListener("scroll", () => (scrolled = win.performance.now()), on);
  doc.addEventListener(
    "wheel",
    (ev) => {
      if (ev.ctrlKey) return; // a trackpad pinch
      const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? win.innerHeight : 1);
      if (Math.abs(dy) <= Math.abs(ev.deltaX)) return;
      const f = frameOf(ev.target), now = win.performance.now();
      if (!f) return void (wFrame = null);
      if (f !== wFrame || now - wAt > 300 || Math.sign(dy) !== Math.sign(wSum)) (wFrame = f), (wSum = 0), (wStart = now);
      wAt = now;
      const was = Math.abs(wSum);
      wSum += dy;
      if (was <= WHEEL_PX && Math.abs(wSum) > WHEEL_PX) check(f, wStart, dy, false);
    },
    on,
  );
  doc.addEventListener(
    "touchstart",
    (ev) => {
      const t = ev.touches[0];
      tFrame = ev.touches.length === 1 && t ? frameOf(ev.target) : null;
      if (tFrame && t) (tx = t.clientX), (ty = t.clientY), (tStart = win.performance.now()), (tDone = false);
    },
    on,
  );
  doc.addEventListener(
    "touchmove",
    (ev) => {
      const t = ev.touches[0];
      if (!tFrame || tDone || !t || ev.touches.length > 1) return;
      const dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) <= Math.abs(dx)) return;
      tDone = true;
      check(tFrame, tStart, -dy, true); // finger up scrolls the page down
    },
    on,
  );
  doc.addEventListener(
    "pointerout",
    (ev) => {
      if (frame && ev.pointerType !== "touch" && !(ev.relatedTarget instanceof Node && frame.contains(ev.relatedTarget)) && frame.contains(ev.target as Node)) close();
    },
    on,
  );

  // The page's polite live region: reuse one if the page has it, else one visually hidden span.
  live = doc.querySelector<HTMLElement>("[data-live-polite]");
  if (!live && doc.body) {
    live = doc.createElement("span");
    live.className = "sr";
    live.setAttribute("aria-live", "polite");
    live.dataset.livePolite = "";
    doc.body.append(live);
  }

  return () => {
    close();
    ac.abort();
  };
}
