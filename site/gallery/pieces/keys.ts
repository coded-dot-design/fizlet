// The genre minis' controls (Redline, Dirt Lab, Bag Beat, Toast Tell): small Board UI keys in a slim
// strip on the stage's bottom edge, under the ground line, so they never cover the play. Wide stages
// put the mute key (aria-label "Mute…") at the strip's left end and the play keys at its right; square and tall stages
// put the mute key in the top corner and spread the play keys along the bottom. The layout is CSS,
// once, in site.css ("Gallery: the minis' keys"), per stage class by container query (the stage
// aspect contract, site/gallery/aspect.ts); every key is 44 px or more and the strip is 56 px, which
// the stages' sheets keep the art above.
// A key reports its press on pointerdown (timing matters) and, if `hold`, its release; a keyboard
// press on a focused key (a click with no pointer) reports both. `tap`: the key a press on the
// stage itself stands for, so the whole stage is the big button (GAS, PUNCH). The bar goes through
// the engine's ledger: Recall gives the page back.
import type { Engine } from "../../../src/kernel/index";

/** A key: its label, its accessible name when the label alone is not one, its id, held or pressed, its Board UI classes. */
export type Key = { label: string; aria?: string; id: number; hold?: boolean; c?: string };

export function keys(engine: Engine, stage: HTMLElement, defs: Key[], on: (id: number, down: boolean) => void, tap = -1) {
  const bar = engine.ledger.add(document.createElement("div")), sig = { signal: engine.signal };
  bar.className = "gk-bar";
  stage.append(bar);
  // A press on the key (or on the stage itself, for `tap`); a held one is captured and lets go when
  // the capture ends (the pointer up or cancelled).
  const press = (el: HTMLElement, id: number, hold?: boolean) => {
    el.addEventListener("pointerdown", (e) => {
      if (el !== stage) e.preventDefault();
      else if (e.target !== stage) return;
      if (hold) el.setPointerCapture(e.pointerId);
      on(id, true);
    }, sig);
    if (hold) el.addEventListener("lostpointercapture", (e) => e.target === el && on(id, false), sig);
  };
  const out = defs.map((d) => {
    const b = bar.appendChild(document.createElement("button"));
    b.type = "button";
    b.className = "bui-key gk " + (d.c ?? "");
    b.textContent = d.label;
    d.aria && b.setAttribute("aria-label", d.aria);
    b.dataset.id = "" + d.id;
    press(b, d.id, d.hold);
    b.addEventListener("click", (e) => e.detail || (on(d.id, true), d.hold && on(d.id, false)), sig);
    return b;
  });
  if (tap >= 0) press(stage, tap, defs.some((d) => d.id === tap && d.hold));
  return out;
}
