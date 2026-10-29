/**
 * The host side: mount the layers story into its slot. Nothing below the slot loads until the
 * slot nears the viewport and the main thread is idle (fizlet/slot); then scene.ts comes in as
 * its own chunk. With reduced motion the scene never loads and the poster's still exploded view stays.
 */
import { slot } from "../../../src/slot";

const target = document.querySelector<HTMLElement>("figure.lyr[data-slot-target]");
if (target) slot(target, () => import("./scene").then((m) => m.mountSlot));
