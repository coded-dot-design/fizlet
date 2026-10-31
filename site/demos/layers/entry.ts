/**
 * The live chunk, one file (layers.js): fzlt/slot and the scene together. Nothing loads it until
 * the slot nears the viewport: the page's inline loader (poster.ts, `loader()`) imports it then.
 * The slot then waits for an idle main thread and mounts the scene. With reduced motion it never loads.
 */
import { slot } from "../../../src/slot";
import { mountSlot } from "./scene";

const target = document.querySelector<HTMLElement>("figure.lyr[data-slot-target]");
if (target) slot(target, () => mountSlot);
