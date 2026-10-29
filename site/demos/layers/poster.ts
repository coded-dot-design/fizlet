/**
 * The slot's markup and poster: plain HTML + CSS, no JS. By default it is the board in game mode;
 * with reduced motion it is the still exploded view with every layer labelled (the scene never
 * loads then: fizlet/slot keeps the fallback). Used at build time (build.mjs) and by hosts.
 */
import { SCENE_CSS } from "./css";
import { LAYERS, FAULT, ARIA, LABEL_W, bounds, COLS, ROWS, CELL, BW, BH, MAP, TILT, TURN, GAP } from "./data";

const B = bounds(), r3 = (v: number) => Math.max(0.05, Math.round(v * 1000) / 1000);
// Scale steps by the slot's size (container queries): the poster fits with no script.
let steps = "";
for (let v = 250; v <= 1500; v += 50)
  steps += `@container (min-width:${v}px){.lyr__s{--wp:${r3((v - 24) / (BW + 16))};--we:${r3((v - 28 - LABEL_W) / B.w)}}}@container (min-height:${v}px){.lyr__s{--hp:${r3((v - 24) / (BH + 20))};--he:${r3((v - 24) / B.h)}}}`;

const N = LAYERS.length;

export const POSTER_CSS = SCENE_CSS + `
.lyr{position:relative;margin:0;width:100%;aspect-ratio:4/5;max-height:640px;container-type:size;background:#07060f;border:2px solid #3b3170;border-radius:14px;overflow:hidden;contain:layout paint}
.lyr__p{position:absolute;inset:0;perspective:2200px;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#f6f3ff}
.lyr__s{position:absolute;left:50%;top:50%;width:${BW}px;height:${BH}px;margin:-${BH / 2}px 0 0 -${BW / 2}px;transform-style:preserve-3d;--wp:.6;--hp:.6;--we:.2;--he:.2;--se:min(var(--we),var(--he));transform:scale(min(var(--wp),var(--hp)))}
${steps}
.lyr__l{position:absolute;inset:0;transform-style:preserve-3d;border-radius:6px}
.lyr__l>i{position:absolute;width:${CELL}px;height:${CELL}px;background:#3f296a}
.lyr__l>i.c{background:#ffc21a;width:${CELL - 8}px;height:${CELL - 8}px;margin:4px}
.lyr__g{background-color:#110d22;background-image:linear-gradient(#3b3170 1px,transparent 1px),linear-gradient(90deg,#3b3170 1px,transparent 1px);background-size:${CELL}px ${CELL}px;outline:6px solid #07060f}
.lyr__t{position:absolute;left:100%;top:100%;white-space:nowrap;padding:4px 7px;background:#07060f;border:2px solid #3b3170;border-radius:5px;margin:-2px 0 0 10px;transform-origin:0 0;display:none}
.lyr__t u{text-decoration:none;color:#aea4d6}
@media (min-width:720px){.lyr{aspect-ratio:16/10}}
@media (prefers-reduced-motion:reduce){
.lyr__s{transform:translate(calc(${-LABEL_W / 2}px - ${B.cx.toFixed(2)}px * var(--se)),calc(${(-B.cy).toFixed(2)}px * var(--se))) scale(var(--se)) rotateX(${TILT}deg) rotateZ(${TURN}deg)}
${LAYERS.map((_, i) => `.lyr__l:nth-child(${i + 1}){transform:translateZ(${(i - (N - 1) / 2) * GAP}px)}`).join("")}
.lyr__l+.lyr__l{border:2px solid #3b3170;background:rgba(17,13,34,.42)}.lyr__l.lyr__f{border-color:#39ffb0}
.lyr__t{display:block;font-size:calc(11px / var(--se));border-width:calc(2px / var(--se));transform:rotateZ(${-TURN}deg) rotateX(${-TILT}deg)}
}`;

/** The slot figure: `<figure class="ae-slot lyr" data-slot-target="…">` with its poster inside. */
export function poster(target = "index#layers") {
  let cells = "";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r]![c];
      if (ch !== ".") cells += `<i${ch === "+" ? ' class="c"' : ""} style="left:${c * CELL}px;top:${r * CELL}px"></i>`;
    }
  const layers = LAYERS.map((l, i) =>
    `<div class="lyr__l${i ? "" : " lyr__g"}${i === FAULT ? " lyr__f" : ""}">${i ? "" : cells}<span class="lyr__t">${l.name} <u>· ${l.bytes.toLocaleString("en-GB")} ${l.unit}</u></span></div>`).join("");
  return `<figure class="ae-slot lyr" data-slot-target="${target}" role="img" aria-label="${ARIA}">` +
    `<div class="ae-slot__placeholder lyr__p" aria-hidden="true"><div class="lyr__s">${layers}</div></div></figure>`;
}
