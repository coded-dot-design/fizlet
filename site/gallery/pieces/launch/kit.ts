// Shared by the launch-day pieces (npm i @fzlt/core, Recall Party): one smooth canvas over the stage's
// real text in art units (160 × 90, scaled to the stage at the device's pixel ratio), colours read
// from the stage's --ld-* custom properties (dark: a night launch; light: the morning of it), the
// keys (the stage takes focus; M mutes) and a 44 px mute button, and @fzlt/core/sound: silent until the
// player's first gesture. Everything it adds to the page goes through the engine's ledger, so
// Recall (destroy) gives the page back byte for byte. Nothing here allocates in a frame.
import type { Engine } from "../../../../src/kernel/index";
import { sound, type Cue } from "../../../../src/sound";

export const W = 160, H = 90, TAU = 6.2832;
/** Colour slots (the stage's --ld-* properties). */
export const INK = 0, PAPER = 1, PINK = 2, CYAN = 3, GOLD = 4, GREEN = 5, PURPLE = 6, ORANGE = 7, PANEL = 8, LINE = 9, MUTED = 10;
const VARS = ["--ld-ink", "--ld-paper", "--ld-pink", "--ld-cyan", "--ld-gold", "--ld-green", "--ld-purple", "--ld-orange", "--ld-panel", "--ld-line", "--ld-muted"];
/** Canvas fonts by art-unit size (made once): bold sans and mono. */
export const SANS = Array.from({ length: 41 }, (_, i) => `900 ${i / 4}px system-ui, sans-serif`);
export const MONO = Array.from({ length: 41 }, (_, i) => `700 ${i / 4}px ui-monospace, monospace`);
/** A font size in art units → the made-once font (quarter-unit steps, up to 10). */
export const font = (list: string[], size: number) => list[Math.max(1, Math.min(40, Math.round(size * 4)))]!;

export type Kit = ReturnType<typeof kit>;

/**
 * The stage kit on `stage` (the slot's stage): its canvas, colours from `skin` (the piece's own
 * markup), sound with the cues `cues` (event type → cue), `onKey(key)` for the keys the piece plays
 * with (the stage takes focus), and a mute button in the corner.
 */
export function kit(engine: Engine, stage: HTMLElement, skin: HTMLElement, label: string, cues: Record<string, Cue>, onKey: (key: string) => boolean) {
  const L = engine.ledger;
  const canvas = L.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  // [0] dirty, [1] px per art unit × dpr, [2] css px per art unit.
  const V = new Float64Array(3);
  V[0] = 1;
  const col = ["#07060f", "#f6f3ff", "#ff2e88", "#19f0ff", "#ffc21a", "#39ffb0", "#9a63ff", "#ff8a1f", "#120f26", "#3b3170", "#aea4d6"];
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((V[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });

  // Sound: @fzlt/core/sound plays the cues from the engine's events; it stays silent until a trusted
  // gesture. M (or the button) mutes.
  const snd = sound(engine, { cues, volume: 0.1 });
  const mute = L.add(document.createElement("button"));
  mute.type = "button";
  mute.className = "ld-mute";
  mute.style.cssText = "position:absolute;right:0;top:0;width:44px;height:44px;margin:0;padding:0;border:0;background:none;color:inherit;font:700 18px/44px system-ui,sans-serif;cursor:pointer;touch-action:manipulation";
  const paintMute = () => {
    mute.textContent = snd.on ? "♪" : "×";
    mute.setAttribute("aria-label", snd.on ? "Mute (M)" : "Sound on (M)");
    mute.setAttribute("aria-pressed", snd.on ? "false" : "true");
  };
  paintMute();
  const toggle = () => ((snd.on = !snd.on), paintMute());
  mute.addEventListener("pointerdown", (e) => e.stopPropagation(), { signal: engine.signal });
  mute.addEventListener("click", (e) => (e.stopPropagation(), toggle()), { signal: engine.signal });
  stage.append(mute);
  // The stage takes the keyboard: focusable, named, its keys handled here.
  L.attr(stage, "tabindex", "0");
  L.attr(stage, "aria-label", label);
  L.style(stage, "touch-action", "manipulation");
  stage.addEventListener("keydown", (e) => {
    if (e.target === mute || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "m" || e.key === "M") return (toggle(), e.preventDefault());
    if (onKey(e.key)) (e.preventDefault(), engine.wake());
  }, { signal: engine.signal });

  const circ = (x: number, y: number, r: number) => (g.beginPath(), g.arc(x, y, r, 0, TAU), g.fill());
  return {
    canvas,
    g,
    col,
    snd,
    circ,
    /** In a read hook: size the canvas after a resize, read the colours. */
    read() {
      if (!V[0]) return false;
      V[0] = 0;
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      (V[1] = (canvas.width / W)), (V[2] = r.width / W);
      const cs = getComputedStyle(skin);
      for (let i = 0; i < VARS.length; i++) {
        const v = cs.getPropertyValue(VARS[i]!).trim();
        if (v) col[i] = v;
      }
      mute.style.color = col[MUTED]!;
      return true;
    },
    /** Start a frame: clear, art units. */
    begin() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(V[1]!, 0, 0, V[1]!, 0, 0);
    },
    /** Where pointer event `e` is, in art units, into out[o], out[o + 1]. */
    at(e: { clientX: number; clientY: number }, out: Float64Array, o: number) {
      const r = stage.getBoundingClientRect(), k = W / (r.width || 1);
      out[o] = (e.clientX - r.left) * k;
      out[o + 1] = (e.clientY - r.top) * k;
    },
    /** A rounded box (the current fill). */
    box(x: number, y: number, w: number, h: number, r: number) {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      g.fill();
    },
    /** Text centred at (x, y), `size` art units. */
    text(s: string, x: number, y: number, size: number, mono = false) {
      g.font = font(mono ? MONO : SANS, size);
      g.fillText(s, x, y);
    },
  };
}

/** The measured numbers the site fills into a stage (scripts/launch-facts.mjs), read once at mount.
 *  An unfilled stage (the poster run) has none: the pieces then draw no numbers. */
export function facts<T>(skin: HTMLElement): T | null {
  try {
    const f = JSON.parse(skin.dataset.facts || "null");
    return f && typeof f === "object" ? (f as T) : null;
  } catch {
    return null;
  }
}

/** n with thousands commas (made at mount, not in frames). */
export const commas = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
