// The Origin section's loader (the home page): the title toggle, the Sound key and its gate, and the
// slot that loads the scene (scene.js) only once the figure nears the viewport and the main thread is
// idle. Reduced motion: the scene never loads; the poster is the still frame. No sound before a
// gesture: the AudioContext is made on the press that turns sound on (or, when the viewer turned it
// on last visit, on their first press in the section), never on load.
import { slot, type SlotTap } from "../../src/slot";
import { MODE_EVENT, type OriginMode, type OriginMount, type SoundGate } from "./contract";

const KEY = "fizlet:origin-sound";
const sec = document.querySelector<HTMLElement>("[data-origin]");
const fig = sec?.querySelector<HTMLElement>("figure.ae-slot[data-slot-target='home#origin']");
if (sec && fig) start(sec, fig);

function start(sec: HTMLElement, fig: HTMLElement) {
  // ---------- The title toggle: Code or Design ----------
  const modeKey = sec.querySelector<HTMLButtonElement>("[data-origin-mode]");
  const word = sec.querySelector<HTMLElement>("[data-origin-word]");
  const setMode = (m: OriginMode) => {
    fig.dataset.mode = sec.dataset.mode = m;
    modeKey?.setAttribute("aria-checked", String(m === "design"));
    if (word) word.textContent = m === "design" ? "Design." : "Code.";
    fig.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: m }));
  };
  modeKey?.addEventListener("click", () => setMode(fig.dataset.mode === "design" ? "code" : "design"));

  // ---------- The sound gate ----------
  let want = false, ctx: AudioContext | null = null;
  try {
    want = localStorage.getItem(KEY) === "on";
  } catch {}
  const subs = new Set<(on: boolean) => void>();
  const soundKey = sec.querySelector<HTMLButtonElement>("[data-origin-sound]");
  const gate: SoundGate = {
    get on() {
      return want && !!ctx && ctx.state !== "closed";
    },
    ctx: () => (gate.on ? ctx : null),
    listen(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
  const tell = () => {
    soundKey?.setAttribute("aria-pressed", String(want));
    for (const fn of subs) fn(gate.on);
  };
  // Only ever inside a trusted gesture.
  const unlock = () => {
    if (!want) return;
    try {
      ctx ??= new AudioContext();
      void ctx.resume().catch(() => {});
    } catch {}
  };
  soundKey?.addEventListener("click", (ev) => {
    if (!ev.isTrusted) return;
    want = !want;
    try {
      localStorage.setItem(KEY, want ? "on" : "off");
    } catch {}
    if (want) unlock();
    else void ctx?.suspend().catch(() => {});
    tell();
  });
  // Turned on last visit: the first press in the section is the gesture that opens the context.
  for (const t of ["pointerdown", "keydown"])
    sec.addEventListener(t, (ev) => {
      if (ev.isTrusted && want && !ctx) (unlock(), tell());
    }, { capture: true });
  tell();

  // ---------- The scene, through fizlet/slot ----------
  const load = () => import("./scene.js").then((m: { mount: OriginMount }) => (stage: HTMLElement, el: HTMLElement, first: SlotTap | null) =>
    m.mount(el, { reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, sound: gate, stage, first }));
  const hero = slot(fig, load);
  (window as unknown as { fizletOrigin: object }).fizletOrigin = { slot: hero, sound: gate, setMode };
}
