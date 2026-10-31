// "your.page / under attack": the domvirus.com home hero, as a gallery micro. The scene is
// dom-virus's own (site/vendor/dom-virus/under-attack.ts, vendored at a pinned commit by
// scripts/vendor-dom-virus.mjs, its imports pointed at these bricks): the kernel plays the intro and
// the 8 s loop over the poster's own SVG, rests after three loops nobody touched (settle: 0 frames),
// and the first tap turns it into the mini-game. Every page write goes through the engine's ledger,
// so destroy() gives the card back byte for byte (Recall).
// This file only hosts it: the slot's stage lets taps through to the card, the first tap is moved
// into the card's coordinates, and the card's pause key drives `data-motion` (on domvirus.com the
// site's client does that), recorded so Recall restores it.
import { mount as hero } from "../../vendor/dom-virus/under-attack";
import { Ledger } from "../../../src/kernel/ledger";
import type { SlotScene, SlotTap } from "../../../src/slot";

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) {
  const card = slot.querySelector<HTMLElement>(".hero-crossover")!, promo = card.querySelector<HTMLElement>(".promo-stage")!;
  const key = card.querySelector<HTMLElement>("[data-motion-toggle]");
  const ledger = new Ledger(), ctl = new AbortController();
  stage.style.pointerEvents = "none";
  // One layout read, at mount: a tap that came before the scene was up, in the card's own box.
  let tap = first;
  if (tap) {
    const a = slot.getBoundingClientRect(), b = promo.getBoundingClientRect();
    tap = { ...tap, x: tap.x - (b.left - a.left), y: tap.y - (b.top - a.top) };
  }
  key?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const paused = key.getAttribute("aria-pressed") === "true";
    ledger.attr(key, "aria-pressed", paused ? "false" : "true");
    ledger.attr(card, "data-motion", paused ? "true" : "false");
  }, { signal: ctl.signal });
  const scene = hero(promo, tap);
  return {
    /** The scene's engine (tests): dom-virus's diagnostic handle on the card. */
    engine: (card as HTMLElement & { heroScene?: { engine: unknown } }).heroScene!.engine as import("../../../src/kernel/engine").Engine,
    destroy() {
      ctl.abort();
      scene.destroy();
      ledger.restore();
    },
  } satisfies SlotScene & Record<string, unknown>;
}
