/**
 * The FILET factory's live chunk (factory.js): fzlt/slot and the scene together. The hero's inline
 * loader (hero.mjs) imports it once the hero nears the viewport or is tapped, never under reduced
 * motion; the slot then waits for an idle main thread and mounts the scene over the hero (and takes
 * it down again, Recall exact, if reduced motion turns on).
 */
import { slot } from "../../src/slot";
import { mountSlot } from "./scene";

const hero = document.querySelector<HTMLElement>(".fac-hero[data-slot-target]");
if (hero) slot(hero, () => mountSlot);
