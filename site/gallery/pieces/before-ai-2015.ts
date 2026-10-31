// Before AI: 2015, one sprite a gallery entry. Chris Cooley drew three micro animations frame by
// frame in 2015 and played them with CSS sprites (the Wayback capture:
// https://web.archive.org/web/20150423171151/http://chriscooley.me/projects/css-animations).
// These are the "better" Fizlet rebuilds from demos/before-ai-2015/ (better.ts: the behaviour;
// better.css: the boxes, sheets and buttons), imported, not copied: headphones whose notes rise
// while the music plays, a cup that fills, steams and turns back mid-move, a laptop that opens,
// types and scrolls three times, then rests. Hand-ported, not made by fe anim.
// The sheets are the demo's own files (demos/before-ai-2015/app-assets/), found from this chunk's
// URL (gallery/<id>.js), so the gallery's pages at any depth load the same files.
// Everything here goes through the strip's engine ledger: destroy() gives the stage back.
import type { SlotMount } from "../../../src/slot";
import { coffee as cupOf, headphones as beatsOf, laptop as lidOf } from "../../demos/before-ai-2015/better";
import type { Strip } from "../../demos/before-ai-2015/strip";
import BETTER from "../../demos/before-ai-2015/better.css" with { type: "text" };
import RESET from "../../demos/before-ai-2015/kit-reset.css" with { type: "text" };

const ASSETS = new URL("../demos/before-ai-2015/app-assets/", import.meta.url).href;
/** The stage: the 2015 section teal the sprites were drawn on; the box is centred and scaled to fit. */
const STAGE = `.g15{position:absolute;inset:0;display:grid;place-items:center;background:#65b9ad;overflow:hidden}
.g15 .bt-stage{position:relative;flex:none;transform-origin:50% 50%;scale:var(--k,1)}
.g15 .bt-stage>div{position:absolute;left:0;bottom:0;float:none;margin:0}`;

interface Piece { w: number; h: number; max: number; html: string; box: string; start: (el: HTMLElement) => Strip }

const mountOf = (p: Piece): SlotMount => (stage) => {
  const host = document.createElement("div");
  host.className = "g15 fz-better";
  host.innerHTML = `<style>${BETTER.replaceAll("url(app-assets/", `url(${ASSETS}`)}${RESET}${STAGE}</style><div class="bt-stage" style="width:${p.w}px;height:${p.h}px">${p.html}</div>`;
  stage.append(host);
  const box = host.querySelector<HTMLElement>(".bt-stage")!, el = host.querySelector<HTMLElement>(p.box)!, button = el.querySelector("button")!;
  // Fit the box to the slot: one read now and one per resize (never in a frame).
  const fit = () => box.style.setProperty("--k", "" + Math.min(p.max, stage.clientWidth / p.w, (stage.clientHeight - 16) / p.h));
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  const s = p.start(el);
  s.engine.ledger.add(host);
  return {
    engine: s.engine,
    accessible: true,
    /** Press its button again (the measure's replay). */
    play: () => button.click(),
    destroy() {
      ro.disconnect();
      s.destroy();
    },
  };
};

// One chunk per entry: each export is pure, so a bundle keeps only its own sprite (and fizlet/fx
// only where particles rise). h: the sprite plus the room its particles rise into.
/** Headphones plug in; press play and ♪ notes rise out of the earcups (2015, rebuilt). */
export const headphones = /* @__PURE__ */ mountOf({ w: 300, h: 440, max: 1.25, box: ".fz-beats", start: beatsOf, html: '<div class="fz-beats"><button type="button" aria-pressed="false" aria-label="Play the music"><svg class="fz-i-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z"/></svg><svg class="fz-i-pause" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg></button></div>' });
/** The cup fills, steams while full, and turns back from the frame it is on (2015, rebuilt). */
export const coffee = /* @__PURE__ */ mountOf({ w: 84, h: 154, max: 2, box: ".fz-coffee", start: cupOf, html: '<div class="fz-coffee"><button type="button" aria-label="Fill the cup"></button></div>' });
/** The laptop opens, types, scrolls three times, then rests (2015, rebuilt). */
export const laptop = /* @__PURE__ */ mountOf({ w: 210, h: 210, max: 1.6, box: ".fz-comp", start: lidOf, html: '<div class="fz-comp"><button type="button" aria-label="Open the laptop"></button></div>' });
