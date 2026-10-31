// Before AI: 2015, one sprite a gallery entry. Chris Cooley drew three micro animations frame by
// frame in 2015 and played them with CSS sprites (the Wayback capture:
// https://web.archive.org/web/20150423171151/http://chriscooley.me/projects/css-animations).
// These are the arcade Fizlet rebuilds from demos/before-ai-2015/ (arcade.ts: the behaviour;
// arcade.css: the boxes, sheets and buttons), imported, not copied, each on its own (no column: the
// combo counts, no sound, no HUD, no stage shake): headphones that bounce and burst ♪ ♫ when hit and
// light the phone's equalizer, a cup that pours, splashes, steams and wobbles, a laptop that slams
// open and sprays code as you type. Hand-ported, not made by fe anim.
// The sheets are the demo's own files (demos/before-ai-2015/app-assets/), found from this chunk's
// URL (gallery/<id>.js), so the gallery's pages at any depth load the same files.
// Everything here goes through the strip's engine ledger: destroy() gives the stage back.
import type { SlotMount } from "../../../src/slot";
import { coffee as cupOf, headphones as beatsOf, laptop as lidOf } from "../../demos/before-ai-2015/arcade";
import type { Strip } from "../../demos/before-ai-2015/strip";
import ARCADE from "../../demos/before-ai-2015/arcade.css" with { type: "text" };
import RESET from "../../demos/before-ai-2015/kit-reset.css" with { type: "text" };

const ASSETS = new URL("../demos/before-ai-2015/app-assets/", import.meta.url).href;
/** The stage: the 2015 section teal the sprites were drawn on; the box is centred and scaled to fit. */
const STAGE = `.g15{position:absolute;inset:0;display:grid;place-items:center;background:#65b9ad;overflow:hidden}
.g15 .bt-stage{position:relative;flex:none;transform-origin:50% 50%;scale:var(--k,1)}
.g15 .bt-stage>div{position:absolute;left:0;bottom:0;float:none;margin:0}`;

interface Piece { w: number; h: number; max: number; html: string; box: string; start: (el: HTMLElement) => Strip }

const mountOf = (p: Piece): SlotMount => (stage) => {
  const host = document.createElement("div");
  host.className = "g15 fz-arcade";
  host.innerHTML = `<style>${ARCADE.replaceAll("url(app-assets/", `url(${ASSETS}`)}${RESET}${STAGE}</style><div class="bt-stage" style="width:${p.w}px;height:${p.h}px">${p.html}</div>`;
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

// One chunk per entry: each export is pure, so a bundle keeps only its own sprite (and @fzlt/core/fx
// only where particles rise). h: the sprite plus the room its particles rise into.
/** Hit the headphones: they bounce, ♪ ♫ burst out, the phone's equalizer jumps (2015, rebuilt, arcade). */
export const headphones = /* @__PURE__ */ mountOf({ w: 300, h: 440, max: 1.25, box: ".fz-beats", start: (el) => beatsOf(el), html: '<div class="fz-beats"><button type="button" class="fz-cups" aria-label="Hit the beat"></button><button type="button" class="fz-play" aria-pressed="false" aria-label="Play the music"><svg class="fz-i-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z"/></svg><svg class="fz-i-pause" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg></button></div>' });
/** The cup pours and splashes, steams while full, wobbles when sipped (2015, rebuilt, arcade). */
export const coffee = /* @__PURE__ */ mountOf({ w: 84, h: 174, max: 2, box: ".fz-coffee", start: (el) => cupOf(el), html: '<div class="fz-coffee"><button type="button" aria-label="Fill the cup"></button></div>' });
/** The laptop slams open; every press of the keys sprays code and lights the screen (2015, rebuilt, arcade). */
export const laptop = /* @__PURE__ */ mountOf({ w: 210, h: 320, max: 1.6, box: ".fz-comp", start: (el) => lidOf(el), html: '<div class="fz-comp"><button type="button" class="fz-keys" aria-label="Open the laptop"></button><button type="button" class="fz-lid" aria-label="Close the laptop" hidden></button></div>' });
