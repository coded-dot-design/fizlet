// What every hero stage does first (site/heroes/<id>.ts imports it). A stage is one game's own
// landing hero, vendored (site/heroes/vendor/<id>/), in its own document: the heroes page mounts it
// in an iframe while its card is in the centre and on screen, and removes it otherwise.
//   - Inert: no link or form in a hero ever navigates (the showcase never leaves the page). Taps,
//     drags and keys still reach the scene; only the navigation is dropped.
//   - The host's look: the theme and the Board UI shadow direction (--shadow-x / --shadow-y, the
//     vendored CSS reads them) follow the page that holds the stage, live.
//   - Rest: `rest()` calls `sleep` after REST seconds with no input in the stage and `wake` on the
//     next input, for scenes that would otherwise run for ever.
const doc = document, html = doc.documentElement;

doc.addEventListener("click", (ev) => (ev.target as Element | null)?.closest?.("a[href], area[href]") && ev.preventDefault(), true);
doc.addEventListener("submit", (ev) => ev.preventDefault(), true);
doc.addEventListener("auxclick", (ev) => (ev.target as Element | null)?.closest?.("a[href]") && ev.preventDefault(), true);

let host: HTMLElement | null = null;
try {
  host = window.parent !== window ? window.parent.document.documentElement : null;
} catch {
  host = null;
}
function sync() {
  if (!host) return;
  if (host.dataset.theme) html.dataset.theme = host.dataset.theme;
  const cs = getComputedStyle(host);
  for (const p of ["--shadow-x", "--shadow-y", "--shadow-color"]) {
    const v = cs.getPropertyValue(p).trim();
    v ? html.style.setProperty(p, v) : html.style.removeProperty(p);
  }
}
sync();
if (host) new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });

/** Seconds with no input before a never-ending scene rests (the Battlefield arena's own REST). `?rest=<s>` sets it (tests). */
export const REST = Number(new URLSearchParams(location.search).get("rest")) || 30;
const INPUT = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/** Call `sleep` once REST seconds pass with no input; `wake` on the next input. Returns a stop function. */
export function rest(sleep: () => void, wake: () => void) {
  let timer = 0, asleep = false;
  const arm = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => ((asleep = true), sleep()), REST * 1000);
  };
  const input = () => {
    if (asleep) (asleep = false), wake();
    arm();
  };
  for (const t of INPUT) doc.addEventListener(t, input, { passive: true, capture: true });
  arm();
  return () => {
    clearTimeout(timer);
    for (const t of INPUT) doc.removeEventListener(t, input, { capture: true });
  };
}

/** The test handle: `window.heroStage` (recall gives the hero back; `resting` says it is still). */
export interface StageHandle {
  recall(): void;
  readonly resting: boolean;
}
export const expose = (h: StageHandle) => ((window as unknown as { heroStage: StageHandle }).heroStage = h);
