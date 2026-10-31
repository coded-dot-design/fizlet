// The Origin hero's mount contract: what the home page's loader (main.ts) hands a scene, and what a
// scene hands back. The placeholder (scene.ts) implements it today; the real origin-story scene
// replaces scene.ts and keeps this file as is. The prose version is README.md in this folder.
import type { SlotTap } from "../../src/slot";

/** The page's one sound gate. Silent until the viewer turns sound on with a real gesture (the
 *  section's Sound key); the choice is remembered per browser. A scene never makes an
 *  AudioContext of its own: it asks the gate. */
export interface SoundGate {
  /** True only after a trusted gesture turned sound on in this visit, and while it stays on. */
  readonly on: boolean;
  /** The page's AudioContext once `on`; null before the gesture and while muted. */
  ctx(): AudioContext | null;
  /** Called with the new state on every change. Returns the unsubscribe. */
  listen(fn: (on: boolean) => void): () => void;
}

/** What `mount()` gets besides the figure. */
export interface OriginOptions {
  /** prefers-reduced-motion at mount time. The loader never mounts under it (the poster stays);
   *  a scene mounted another way (a gallery, a test) must draw one still frame and ask for none. */
  reduced: boolean;
  sound: SoundGate;
  /** The box to draw in: a contained child of the figure the loader made (and removes). */
  stage: HTMLElement;
  /** The tap that woke the scene before it was up (px from the figure's top left), as an intent. */
  first: SlotTap | null;
}

/** The mode the title toggle sets, read from `figure.dataset.mode`; every flip also dispatches
 *  `origin:mode` on the figure (detail: the new mode). */
export type OriginMode = "code" | "design";
export const MODE_EVENT = "origin:mode";

/** What a scene returns. `destroy()` must give the page back exactly (Recall): every node,
 *  attribute, style and listener it added, gone; the figure's own attributes untouched. */
export interface OriginScene {
  destroy(): void;
}

/** The one export a scene module has. */
export type OriginMount = (figure: HTMLElement, opts: OriginOptions) => OriginScene;
