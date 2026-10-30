/**
 * The slot's markup, poster, controls and inline script: plain HTML + CSS, plus one small inline
 * script. Used at build time (build.mjs) and by hosts (scripts/site.mjs).
 *
 * The poster is the same stack as the scene, posed by one CSS variable on the figure, `--e`
 * (0 assembled, 1 exploded), so it needs no JS to draw. Default 0 (the board in game mode); with
 * reduced motion 1 (the still exploded view with every label). The controls (a vertical 3D slider
 * that scrubs the explode/assemble timeline, above a play/pause key, on the left) are real HTML
 * from the first paint.
 *
 * One writer at a time: before the scene loads (and always under reduced motion, where it never
 * loads), the inline controller moves `--e` and the slider itself. Once the scene is mounted it only
 * forwards input as a `lyr` event (detail: 0–100 to scrub, -1 to toggle play; input is clamped to
 * 0–100 first, so only the play key ever sends -1) and the scene writes
 * the controls through its ledger, so Recall gives them back exactly.
 */
import { SCENE_CSS } from "./css";
import { LAYERS, FAULT, ARIA, LABEL_W, PITCH, SIN_TILT, BOUNDS, RESERVE, bounds, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN, GAP } from "./data";

const B = bounds(), R = RESERVE, r3 = (v: number) => Math.max(0.05, Math.round(v * 1000) / 1000);
// Scale steps by the slot's size (container queries). The controls keep a RESERVE column on the
// left (slider above the play key), in every orientation; the stack centres in the rest.
let steps = "";
for (let v = 250; v <= 1500; v += 50)
  steps += `@container (min-width:${v}px){.lyr__s{--wp:${r3((v - 24 - R) / (BW + 16))};--we:${r3((v - 44 - LABEL_W - R) / B.w)}}}` +
    `@container (min-height:${v}px){.lyr__s{--hp:${r3((v - 24) / (BH + 20))};--he:${r3((v - 24) / B.h)};--hg:${r3((v - 24 - 7 * PITCH) / BOUNDS.hb)}}}`;

const N = LAYERS.length;
const e = "var(--e)";

export { bounds, BOUNDS, LAYERS } from "./data";

// Notes on the CSS below (kept out of the shipped string):
// - overflow:clip (the figure and its poster), not hidden: a hidden box is still a scroll container,
//   and scrollIntoView on a control would scroll the figure's insides (the poster's unexploded labels
//   overflow it). The poster clips its own overflow, so a host's overflow:hidden figure has none.
// - The controls: one column on the left, the slider above the play key. The slider is a recessed kit
//   groove with the stack's eight plates threaded on it (same tilt as the layers); the plates light
//   up from the bottom as it rises, and the thumb is the kit's arcade key, moving up and down.
export const POSTER_CSS = SCENE_CSS + `
.lyr{--e:0;position:relative;margin:0;width:100%;aspect-ratio:4/5;max-height:640px;container-type:size;background:var(--rim);border:2px solid var(--line);border-radius:14px;overflow:clip;contain:layout paint;content-visibility:auto}
.lyr__d{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lyr__p{position:absolute;inset:0;overflow:clip;perspective:4000px;perspective-origin:calc(50% + ${R / 2}px) 50%;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink)}
.lyr__s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;--wp:.6;--hp:.6;--we:.2;--he:.2;--hg:.2;--sp:min(var(--wp),var(--hp));--se:min(var(--we),var(--he),var(--hg));` +
  `transform:translateX(calc(${R / 2}px + ${-LABEL_W / 2 - B.cx}px * ${e})) scale(calc(var(--sp) + (var(--se) - var(--sp)) * sqrt(${e}))) rotateX(calc(${TILT}deg * ${e})) rotateZ(calc(${TURN}deg * ${e}))}
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
.lyr__ui{position:absolute;left:10px;top:10px;bottom:10px;width:44px;z-index:1;pointer-events:none}
.lyr__ui>*{position:absolute;left:0;width:44px;pointer-events:auto}
.lyr .lyr__play{bottom:0;padding:0;justify-content:center}
.lyr__play svg{fill:currentColor;stroke:none}.lyr__play[aria-label=Play] .p,.lyr__play[aria-label=Pause] .q{display:none}
.lyr__sl{top:0;bottom:60px;touch-action:none;outline:none;cursor:ns-resize}
.lyr__sl::before,.lyr__sl::after{content:"";position:absolute;left:15px;right:15px;border-radius:7px}
.lyr__sl::before{top:0;bottom:0;background:var(--surface);border:2px solid var(--line);box-shadow:inset 0 4px 0 var(--rim)}
.lyr__sl::after{left:19px;right:19px;bottom:4px;height:calc(${e} * (100% - 30px) + 11px);background:var(--k-cmd)}
.lyr__r{position:absolute;z-index:1;inset:13px 0 17px;display:flex;flex-direction:column-reverse;justify-content:space-between;align-items:center}
.lyr__r i{width:30px;height:30px;margin:-12px 0;border:2px solid var(--line);border-radius:4px;transform:perspective(160px) rotateX(${TILT}deg) rotateZ(${TURN}deg)}
${LAYERS.map((_, i) => `.lyr__r i:nth-child(${i + 1}){background:color-mix(in srgb,var(--k-sys) calc(clamp(0,(${e} * ${N} - ${i}) * 2,1) * 100%),var(--card))}`).join("")}
.lyr__r i:nth-child(${FAULT + 1}){border-color:var(--k-go)}
.lyr .lyr__k{position:absolute;left:2px;width:40px;min-height:0;height:26px;padding:0;bottom:calc(${e} * (100% - 30px));flex-direction:column;justify-content:center;gap:3px;pointer-events:none;z-index:2}
.lyr__k b{width:16px;height:3px;background:var(--rim);border-radius:1px}
.lyr__sl:focus-visible .lyr__k{box-shadow:0 var(--py) 0 var(--edge),0 0 0 3px var(--bg),0 0 0 6px var(--k-sys-ink)}
@media (prefers-reduced-motion:reduce){.lyr{--e:1}.lyr .lyr__play{display:none}.lyr__sl{bottom:0}}`;

const icon = (d: string, c: string) => `<svg class="${c}" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="${d}"/></svg>`;

/** The slot figure: `<figure class="ae-slot ae-slot--4x5 lyr bui" data-slot-target="…">` with its poster and controls. */
export function poster(target = "index#layers") {
  let cells = "";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r]![c];
      if (ch !== ".") cells += `<i${ch === "+" ? ' class="c"' : ""} style="left:${c * CELL}px;top:${r * CELL}px"></i>`;
    }
  const layers = LAYERS.map((l, i) =>
    `<div class="lyr__l${i ? "" : " lyr__g"}${i === FAULT ? " lyr__f" : ""}">${i ? "" : cells}<span class="lyr__t">${l.name} <u>· ${l.bytes.toLocaleString("en-GB")} ${l.unit}</u></span></div>`).join("");
  return `<figure class="ae-slot ae-slot--4x5 lyr bui" data-slot-target="${target}" aria-label="The layers story" aria-describedby="lyr-d">` +
    `<p class="lyr__d" id="lyr-d">${ARIA}</p>` +
    `<div class="ae-slot__placeholder lyr__p" aria-hidden="true"><div class="lyr__s">${layers}</div></div>` +
    `<div class="lyr__ui">` +
    `<div class="lyr__sl" role="slider" tabindex="0" aria-label="Explode the layers" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">` +
    `<span class="lyr__r" aria-hidden="true">${"<i></i>".repeat(N)}</span><span class="bui-key bui-arcade bui-cmd lyr__k" aria-hidden="true"><b></b><b></b><b></b></span></div>` +
    `<button type="button" class="bui-key bui-arcade bui-go lyr__play" aria-label="Pause">${icon("M5 4h4v12H5zM11 4h4v12h-4z", "p")}${icon("m6 4 10 6-10 6Z", "q")}</button>` +
    `</div></figure>`;
}

/**
 * The inline script: the controls' own controller, and the loader. It imports the live chunk
 * (`src`, resolved against the page) once the slot comes within 200px or is tapped, and never while
 * reduced motion is on (it waits for the setting to change); the slider works either way.
 */
export const loader = (src = "./layers.js") =>
  `<script type="module">{const f=document.querySelector("figure.lyr");if(f){` +
  // The controls: keys and pointer on the slider, click on the play key. Quick key repeats step from
  // the last value sent (a live scene writes aria-valuenow on its next frame).
  `let c=0,t=-1e3;const s=f.querySelector("[role=slider]"),b=f.querySelector(".lyr__play"),m=matchMedia("(prefers-reduced-motion: reduce)"),` +
  `live=()=>f.querySelector("[data-fizlet-slot]"),` +
  `put=v=>{v=v<0?-1:Math.round(Math.min(100,v));if(v>=0)c=v,t=performance.now();if(live())f.dispatchEvent(new CustomEvent("lyr",{detail:v}));` +
  `else if(v<0)b.ariaLabel=b.ariaLabel=="Play"?"Pause":"Play";else f.style.setProperty("--e",v/100),s.ariaValueNow=v},` +
  `K={ArrowUp:5,ArrowRight:5,ArrowDown:-5,ArrowLeft:-5,PageUp:25,PageDown:-25,Home:-100,End:100},` +
  `at=e=>{const r=s.getBoundingClientRect();put(Math.max(0,(r.bottom-15-e.clientY)/(r.height-30)*100))};` +
  `if(m.matches)s.ariaValueNow=100;` +
  `s.addEventListener("keydown",e=>{const k=K[e.key];if(k)e.preventDefault(),put(Math.max(0,(performance.now()-t<200?c:+s.ariaValueNow)+k))});` +
  `s.addEventListener("pointerdown",e=>{s.setPointerCapture(e.pointerId);at(e)});` +
  `s.addEventListener("pointermove",e=>s.hasPointerCapture(e.pointerId)&&at(e));` +
  `b.addEventListener("click",()=>put(-1));` +
  // The loader.
  `let d=0;const go=()=>{if(d++)return;o.disconnect();import(${JSON.stringify(src)})},o=new IntersectionObserver(e=>e.some(x=>x.isIntersecting)&&go(),{rootMargin:"200px"}),` +
  `arm=()=>{o.observe(f);f.addEventListener("pointerdown",go,{once:true})};m.matches?m.addEventListener("change",arm,{once:true}):arm()}}</script>`;
