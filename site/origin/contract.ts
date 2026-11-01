// The Origin hero's mount contract, as the home page's loader (main.ts) uses it. It is the API of the
// origin scene (site/demos/origin/scene.ts, fizlet#218), and the placeholder (scene.ts here) keeps
// the same shape, so either one mounts. The prose version is README.md in this folder.
import type { SlotMount, SlotScene } from "../../src/slot";

export type OriginMode = "code" | "design";

/** What the scene reports on every change, in `scene.state` and in the `origin:state` event. */
export interface OriginState {
  mode: OriginMode;
  open: boolean;
  bricks: boolean;
  sound: boolean;
  paused: boolean;
}

/** The scene `mountSlot` returns. `destroy()` gives the page back exactly (Recall). */
export interface OriginScene extends SlotScene {
  setMode(mode: OriginMode): void;
  setSound(on: boolean): void;
  pause(): void;
  play(): void;
  readonly state: OriginState;
}

/** The one export the loader needs: @fzlt/core/slot's mount. It reads the figure's data-mode
 *  ("code" | "design") and data-sound ("0" | "1") when it mounts. */
export type OriginModule = { mountSlot: SlotMount };

/** Bubbles from the scene's root on every change; `detail` is the new state. */
export const STATE_EVENT = "origin:state";
