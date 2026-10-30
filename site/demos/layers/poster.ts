/**
 * The slot's markup, poster, controls and inline script: plain HTML + CSS, plus one small inline
 * script. Used at build time (build.mjs) and by hosts (scripts/site.mjs).
 *
 * The poster is the same stack as the scene, posed by one CSS variable on the figure, `--e`
 * (0 assembled, 1 exploded), so it needs no JS to draw. Default 0 (the board in game mode); with
 * reduced motion 1 (the still exploded view with every label). The controls (a play/pause key and
 * a 3D slider that scrubs the explode/assemble timeline) are real HTML from the first paint.
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
// Scale steps by the slot's size (container queries), per orientation: landscape keeps a RESERVE
// column on each side (play key left, slider right); portrait keeps a RESERVE row at the bottom.
let steps = "";
for (const [o, dw, dh] of [["landscape", 2 * R, 0], ["portrait", 0, R]] as const)
  for (let v = 250; v <= 1500; v += 50)
    steps += `@container (orientation:${o}) and (min-width:${v}px){.lyr__s{--wp:${r3((v - 24 - dw) / (BW + 16))};--we:${r3((v - 28 - LABEL_W - dw) / B.w)}}}` +
      `@container (orientation:${o}) and (min-height:${v}px){.lyr__s{--hp:${r3((v - 24 - dh) / (BH + 20))};--he:${r3((v - 24 - dh) / B.h)};--hg:${r3((v - 24 - dh - 7 * PITCH) / BOUNDS.hb)}}}`;

const N = LAYERS.length;
const e = "var(--e)";

export { bounds, BOUNDS, LAYERS } from "./data";

export const POSTER_CSS = SCENE_CSS + `
.lyr{--e:0;position:relative;margin:0;width:100%;aspect-ratio:4/5;max-height:640px;container-type:size;background:var(--rim);border:2px solid var(--line);border-radius:14px;overflow:hidden;contain:layout paint;content-visibility:auto;container-name:lyr}
.lyr__d{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lyr__p{position:absolute;inset:0;perspective:2200px;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink)}
.lyr__s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;--oy:0px;--wp:.6;--hp:.6;--we:.2;--he:.2;--hg:.2;--sp:min(var(--wp),var(--hp));--se:min(var(--we),var(--he),var(--hg));` +
  `transform:translate(calc(${-LABEL_W / 2 - B.cx}px * ${e}),var(--oy)) scale(calc(var(--sp) + (var(--se) - var(--sp)) * ${e})) rotateX(calc(${TILT}deg * ${e})) rotateZ(calc(${TURN}deg * ${e}))}
@container (orientation:portrait){.lyr__s{--oy:${-R / 2}px}}
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
.lyr__ui{position:absolute;inset:10px;z-index:1;pointer-events:none}
.lyr__ui>*{position:absolute;pointer-events:auto}
.lyr .lyr__play{left:0;bottom:0;width:44px;padding:0;justify-content:center}
.lyr__play svg{fill:currentColor;stroke:none}.lyr__play[aria-label=Play] .p,.lyr__play[aria-label=Pause] .q{display:none}
.lyr__sl{right:0;top:0;bottom:6px;width:44px;touch-action:none;outline:none;cursor:pointer;container-type:size}
.lyr__sl::before{content:"";position:absolute;inset:0 16px;border-radius:6px;background:var(--surface);border:2px solid var(--line);box-shadow:inset 0 3px 0 var(--rim)}
.lyr__r{position:absolute;inset:6px 0;display:flex;flex-direction:column-reverse;align-items:center;justify-content:center;gap:2px;transform-style:preserve-3d}
.lyr__r i{width:16px;height:16px;flex:none;margin:-5px 0;border:2px solid var(--line);border-radius:3px;background:var(--card);transform:perspective(90px) rotateX(${TILT}deg) rotateZ(${TURN}deg)}
.lyr__r i:nth-child(4){border-color:var(--k-go)}
${Array.from({ length: N }, (_, i) => `.lyr__r i:nth-child(${i + 1}){--k:${i - (N - 1) / 2}}`).join("")}
.lyr__r i{translate:0 calc(var(--k) * ${e} * -.09 * (100cqh - 12px))}
.lyr .lyr__k{position:absolute;left:4px;width:36px;min-height:0;height:26px;padding:0;bottom:0;translate:0 calc(${e} * (26px - 100cqh));justify-content:center;gap:3px;pointer-events:none}
.lyr__k b{width:3px;height:12px;background:var(--rim);border-radius:1px}
.lyr__sl:focus-visible .lyr__k{box-shadow:0 var(--py) 0 var(--edge),0 0 0 3px var(--bg),0 0 0 6px var(--k-sys-ink)}
@container lyr (orientation:portrait){.lyr__sl{left:56px;top:auto;bottom:6px;width:auto;height:44px}.lyr__sl::before{inset:16px 0}.lyr__r{inset:0 6px;flex-direction:row}.lyr__r i{margin:0 -5px;translate:calc(var(--k) * ${e} * .09 * (100cqw - 12px)) 0}.lyr .lyr__k{left:0;translate:calc(${e} * (100cqw - 36px)) 0;bottom:9px}}
@media (prefers-reduced-motion:reduce){.lyr{--e:1}.lyr .lyr__play{display:none}@container lyr (orientation:portrait){.lyr__sl{left:0}}}`;

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
    `<button type="button" class="bui-key bui-arcade bui-go lyr__play" aria-label="Pause">${icon("M5 4h4v12H5zM11 4h4v12h-4z", "p")}${icon("m6 4 10 6-10 6Z", "q")}</button>` +
    `<div class="lyr__sl" role="slider" tabindex="0" aria-label="Explode the layers" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">` +
    `<span class="lyr__r" aria-hidden="true">${"<i></i>".repeat(N)}</span><span class="bui-key bui-arcade bui-cmd lyr__k" aria-hidden="true"><b></b><b></b><b></b></span></div>` +
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
  `at=e=>{const r=s.getBoundingClientRect(),w=r.width>r.height;s.ariaOrientation=w?"horizontal":"vertical";put(Math.max(0,w?(e.clientX-r.left-18)/(r.width-36)*100:(r.bottom-13-e.clientY)/(r.height-26)*100))};` +
  // Phones (the site's rule: coarse pointer or ≤ 600px) start on the poster pose with the Play key
  // showing: the story plays on a tap, never on its own (its frames cost a phone's main thread).
  `if(matchMedia("(pointer:coarse),(max-width:600px)").matches)b.ariaLabel="Play";` +
  `if(m.matches)s.ariaValueNow=100;s.ariaOrientation=s.offsetWidth>s.offsetHeight?"horizontal":"vertical";` +
  `s.addEventListener("keydown",e=>{const k=K[e.key];if(k)e.preventDefault(),put(Math.max(0,(performance.now()-t<200?c:+s.ariaValueNow)+k))});` +
  `s.addEventListener("pointerdown",e=>{s.setPointerCapture(e.pointerId);at(e)});` +
  `s.addEventListener("pointermove",e=>s.hasPointerCapture(e.pointerId)&&at(e));` +
  `b.addEventListener("click",()=>put(-1));` +
  // The loader.
  `let d=0;const go=()=>{if(d++)return;o.disconnect();import(${JSON.stringify(src)})},o=new IntersectionObserver(e=>e.some(x=>x.isIntersecting)&&go(),{rootMargin:"200px"}),` +
  `arm=()=>{o.observe(f);f.addEventListener("pointerdown",go,{once:true})};m.matches?m.addEventListener("change",arm,{once:true}):arm()}}</script>`;
