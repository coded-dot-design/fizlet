/**
 * The slot's markup, poster and inline loader: plain HTML + CSS, plus one small inline script. Used
 * at build time (build.mjs) and by hosts (scripts/site.mjs).
 *
 * The poster is the same stack as the scene, posed by one CSS variable on the figure, `--e`
 * (0 assembled, 1 exploded), so it needs no JS to draw. Default 0 (the board in game mode); with
 * reduced motion 1: the still exploded view with every label (the scene never loads).
 * No controls: the scene follows the page's scroll (scene.ts), and the figure takes focus so the
 * arrow keys can step through it.
 */
import { SCENE_CSS } from "./css";
import { LAYERS, FAULT, ARIA, LABEL_W, PITCH, SIN_TILT, BOUNDS, bounds, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN, GAP } from "./data";

const B = bounds(), r3 = (v: number) => Math.max(0.05, Math.round(v * 1000) / 1000);
// Scale steps by the slot's size (container queries).
let steps = "";
for (let v = 250; v <= 1500; v += 50)
  steps += `@container (min-width:${v}px){.lyr__s{--wp:${r3((v - 24) / (BW + 16))};--we:${r3((v - 28 - LABEL_W) / B.w)}}}` +
    `@container (min-height:${v}px){.lyr__s{--hp:${r3((v - 24) / (BH + 20))};--he:${r3((v - 24) / B.h)};--hg:${r3((v - 24 - 7 * PITCH) / BOUNDS.hb)}}}`;

const N = LAYERS.length;
const e = "var(--e)";

export { bounds, BOUNDS, LAYERS } from "./data";

// overflow:clip, not hidden (the figure, and the slot stage that sets hidden inline): Chrome latches a
// wheel over an overflow:hidden box with 3D content onto it, and the page under it stops scrolling.
export const POSTER_CSS = SCENE_CSS + `
.lyr{--e:0;position:relative;margin:0;width:100%;aspect-ratio:4/5;max-height:640px;container-type:size;background:var(--rim);border:2px solid var(--line);border-radius:14px;overflow:clip;contain:layout paint;content-visibility:auto;container-name:lyr}
.lyr [data-fizlet-slot]{overflow:clip!important}
.lyr:focus-visible{outline:3px solid var(--k-sys-ink);outline-offset:3px}
.lyr__d{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lyr__p{position:absolute;inset:0;perspective:2200px;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink)}
.lyr__s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;--wp:.6;--hp:.6;--we:.2;--he:.2;--hg:.2;--sp:min(var(--wp),var(--hp));--se:min(var(--we),var(--he),var(--hg));` +
  `transform:translate(calc(${-LABEL_W / 2 - B.cx}px * ${e}),0) scale(calc(var(--sp) + (var(--se) - var(--sp)) * ${e})) rotateX(calc(${TILT}deg * ${e})) rotateZ(calc(${TURN}deg * ${e}))}
${steps}
.lyr__l{position:absolute;inset:0;transform-style:preserve-3d;border-radius:6px}
${LAYERS.map((_, i) => `.lyr__l:nth-child(${i + 1}){transform:translateZ(calc(${i - (N - 1) / 2} * max(${GAP}px, ${PITCH}px / (${SIN_TILT.toFixed(4)} * var(--se))) * ${e}))}`).join("")}
.lyr__l+.lyr__l{border:2px solid color-mix(in srgb,var(--line) calc(${e} * 100%),transparent);background:color-mix(in srgb,var(--surface) calc(${e} * 42%),transparent)}.lyr__l.lyr__f{border-color:color-mix(in srgb,var(--k-go) calc(${e} * 100%),transparent)}
.lyr__l>i{position:absolute;width:${CELL}px;height:${CELL}px;background:var(--k-cmd-base)}
.lyr__l>i.c{background:var(--hurt);width:${CELL - 8}px;height:${CELL - 8}px;margin:4px}
.lyr__g{background-color:var(--surface);background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:${CELL}px ${CELL}px;outline:6px solid var(--rim)}
.lyr__t{position:absolute;left:100%;top:100%;white-space:nowrap;background:var(--card);border:2px solid var(--line);transform-origin:0 0;font-size:calc(11px / var(--se));border-width:calc(2px / var(--se));padding:calc(3px / var(--se)) calc(7px / var(--se));margin:calc(-2px / var(--se)) 0 0 calc(10px / var(--se));border-radius:calc(5px / var(--se));` +
  `transform:rotateZ(calc(${-TURN}deg * ${e})) rotateX(calc(${-TILT}deg * ${e}));opacity:clamp(0,(${e} - .99) * 100,1)}
.lyr__t u{text-decoration:none;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.lyr{--e:1}}`;

/** The slot figure: `<figure class="ae-slot ae-slot--4x5 lyr bui" data-slot-target="…" tabindex="0">` with its poster. */
export function poster(target = "index#layers") {
  let cells = "";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r]![c];
      if (ch !== ".") cells += `<i${ch === "+" ? ' class="c"' : ""} style="left:${c * CELL}px;top:${r * CELL}px"></i>`;
    }
  const layers = LAYERS.map((l, i) =>
    `<div class="lyr__l${i ? "" : " lyr__g"}${i === FAULT ? " lyr__f" : ""}">${i ? "" : cells}<span class="lyr__t">${l.name} <u>· ${l.bytes.toLocaleString("en-GB")} ${l.unit}</u></span></div>`).join("");
  return `<figure class="ae-slot ae-slot--4x5 lyr bui" data-slot-target="${target}" tabindex="0" aria-label="The layers story" aria-describedby="lyr-d" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End">` +
    `<p class="lyr__d" id="lyr-d">${ARIA}</p>` +
    `<div class="ae-slot__placeholder lyr__p" aria-hidden="true"><div class="lyr__s">${layers}</div></div>` +
    `</figure>`;
}

/**
 * The inline loader: it imports the live chunk (`src`, resolved against the page) once the slot
 * comes within 200px, is tapped or takes focus, and never while reduced motion is on (it waits for
 * the setting to change).
 */
export const loader = (src = "./layers.js") =>
  `<script type="module">{const f=document.querySelector("figure.lyr");if(f){const m=matchMedia("(prefers-reduced-motion: reduce)");` +
  `let d=0;const go=()=>{if(d++)return;o.disconnect();import(${JSON.stringify(src)})},o=new IntersectionObserver(e=>e.some(x=>x.isIntersecting)&&go(),{rootMargin:"200px"}),` +
  `arm=()=>{o.observe(f);f.addEventListener("pointerdown",go,{once:true});f.addEventListener("focus",go,{once:true})};m.matches?m.addEventListener("change",arm,{once:true}):arm()}}</script>`;
