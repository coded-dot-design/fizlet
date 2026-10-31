// The Origin section's loader (the home page): the title toggle, the Sound key, and the slot that
// loads the scene only once the figure nears the viewport and the main thread is idle. The scene is
// the origin scene (demos/origin/scene.js, shared with its own page, so one cached file) or, in a
// build without it, the placeholder (origin/scene.js); the build picks (ORIGIN_REAL).
// Reduced motion: the scene never loads; the poster is the still frame and the toggle still works.
// Sound: off until the viewer presses the Sound key, and then still silent until a gesture (the
// sound brick makes its AudioContext on a trusted press, never on load). The choice is remembered.
import { slot } from "../../src/slot";
import { STATE_EVENT, type OriginMode, type OriginModule, type OriginScene, type OriginState } from "./contract";

declare const ORIGIN_REAL: boolean;
const KEY = "fizlet:origin-sound";
const sec = document.querySelector<HTMLElement>("[data-origin]");
const fig = sec?.querySelector<HTMLElement>("figure.ae-slot[data-slot-target='home#origin']");
if (sec && fig) start(sec, fig);

function start(sec: HTMLElement, fig: HTMLElement) {
  const modeKey = sec.querySelector<HTMLButtonElement>("[data-origin-mode]");
  const soundKey = sec.querySelector<HTMLButtonElement>("[data-origin-sound]");
  const word = sec.querySelector<HTMLElement>("[data-origin-word]");
  let scene: OriginScene | null = null, want = false;
  try {
    want = localStorage.getItem(KEY) === "on";
  } catch {}

  // What the section shows. The figure's data-mode / data-sound are what the scene reads at mount.
  const showMode = (m: OriginMode) => {
    fig.dataset.mode = sec.dataset.mode = m;
    modeKey?.setAttribute("aria-checked", String(m === "design"));
    if (word) word.textContent = m === "design" ? "Design." : "Code.";
  };
  const showSound = (on: boolean) => {
    want = on;
    fig.dataset.sound = on ? "1" : "0";
    soundKey?.setAttribute("aria-pressed", String(on));
  };
  const live = () => (scene && fig.querySelector("[data-fizlet-slot]") ? scene : null);
  // Without the scene (reduced motion, or not loaded yet), the poster swaps its own screens.
  const poster = (m: OriginMode) => {
    for (const g of fig.querySelectorAll<SVGElement>(".ae-slot__placeholder .og-code")) g.style.display = m === "code" ? "" : "none";
    for (const g of fig.querySelectorAll<SVGElement>(".ae-slot__placeholder .og-des")) g.style.display = m === "design" ? "" : "none";
  };
  const setMode = (m: OriginMode) => {
    showMode(m);
    const s = live();
    if (s) s.setMode(m);
    else poster(m);
  };
  showSound(want);

  modeKey?.addEventListener("click", () => setMode(fig.dataset.mode === "design" ? "code" : "design"));
  soundKey?.addEventListener("click", () => {
    showSound(!want);
    try {
      localStorage.setItem(KEY, want ? "on" : "off");
    } catch {}
    live()?.setSound(want);
  });
  // The scene's own keys (mode, sound) stay in step with ours.
  fig.addEventListener(STATE_EVENT, (ev) => {
    const st = (ev as CustomEvent<OriginState>).detail;
    if (st.mode !== fig.dataset.mode) showMode(st.mode);
    if (st.sound !== want) {
      showSound(st.sound);
      try {
        localStorage.setItem(KEY, want ? "on" : "off");
      } catch {}
    }
  });

  const load = () =>
    (ORIGIN_REAL ? import("../demos/origin/scene.js") : import("./scene.js")).then((m: OriginModule) => ((stage: HTMLElement, el: HTMLElement) => (scene = m.mountSlot(stage, el, null) as OriginScene)));
  const hero = slot(fig, load);
  (window as unknown as { fizletOrigin: object }).fizletOrigin = { slot: hero, get scene() { return live(); }, setMode };
}
