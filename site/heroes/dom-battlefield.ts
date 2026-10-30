// DOM Battlefield's landing hero on fizlet.com: the game's own arena scene (vendored, running on
// this build of Fizlet), mounted through fizlet/slot exactly as the game's page mounts it. It rests
// on its own (REST seconds after the last input it stops firing and the engine settles to no frames).
import { expose } from "./stage";
import { slot } from "../../src/slot";
import { mountArena } from "./vendor/dom-battlefield/scene";

const hero = document.querySelector<HTMLElement>("[data-arena]")!;
const arena = slot(hero, () => mountArena, { idle: 0 });
type Arena = { engine: { running: boolean; paused: boolean; stats(): { paused: string[] } } };
expose({
  recall: () => arena.destroy(),
  get resting() {
    const a = (window as unknown as { arena?: Arena }).arena;
    return !!a && a.engine.stats().paused.includes("settled");
  },
});
