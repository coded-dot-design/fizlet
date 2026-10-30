// Big things, small packages: the gallery figure, rendered at build time (scripts/site.mjs runs
// this in Node through esbuild). Two stills painted by the same world as the live scene: the dev
// dragging the full stack, and the Fizlet box in his hands with the kernel's gzip size, measured
// by that build (`bytes`). Each is an SVG of flat runs, one class a colour, so the page's theme
// picks the palette. It is the poster before the scene loads; under reduced motion (the scene
// never loads) it is the whole joke, and a tap shrinks it (a checkbox and :has(), no script).
import { CAPTION, CAPTION_SMALL, DARK, DX, FLOOR, K, LIGHT, SAY, SETUP, addBlock, kernelLine, paint, world, W, H, type World } from "./world";

/** The two moments: 0 the full stack, 1 the box in his hands. */
export function still(kind: 0 | 1, bytes: number): World {
  const w = world();
  if (kind === 0) {
    for (let k = 0; k < 7; k++) addBlock(w, k, k & 1 ? 3 : -2, NaN);
    w.S[K.Supply] = 5;
  } else {
    w.S[K.Phase] = 3;
    w.S[K.T] = 9;
    w.S[K.BoxX] = DX + 5.5;
    w.S[K.BoxY] = FLOOR - 18;
    w.label = `${bytes.toLocaleString("en-US")} B GZIP`;
  }
  paint(w);
  return w;
}

/** The picture as SVG: runs of one colour merged down while the next row repeats them. */
export function svg(buf: Uint8Array, cls: string) {
  const open = new Map<string, number[]>(), done: number[][] = [];
  for (let y = 0; y < H; y++) {
    const seen = new Set<string>();
    for (let x = 0; x < W; ) {
      const c = buf[y * W + x]!;
      let e = x + 1;
      while (e < W && buf[y * W + e] === c) e++;
      const k = `${x},${e},${c}`, r = open.get(k);
      if (r && r[1]! + r[3]! === y) r[3]!++;
      else open.set(k, [x, y, e - x, 1, c]);
      seen.add(k);
      x = e;
    }
    for (const [k, r] of open) if (!seen.has(k)) (done.push(r), open.delete(k));
  }
  done.push(...open.values());
  const by = new Map<number, string>();
  for (const [x, y, rw, rh, c] of done) by.set(c!, (by.get(c!) ?? "") + `M${x} ${y}h${rw}v${rh}h-${rw}z`);
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">` +
    [...by].sort((a, b) => a[0] - b[0]).map(([c, d]) => `<path class="k${c}" d="${d}"/>`).join("") + "</svg>";
}

const CSS = (scope: string) => `${scope}{position:absolute;inset:0;display:block;container-type:size;cursor:pointer}
${scope} svg{position:absolute;inset:0;width:100%;height:100%}
${scope} input{position:absolute;opacity:0;pointer-events:none}
${scope} p{${CAPTION};font-size:clamp(10px,2.27cqw,20px)}
${scope} small{${CAPTION_SMALL}}
${scope} .sp-1{display:none}
${scope} p.sp-1{left:auto;right:3%;top:15%}
@media (prefers-reduced-motion: reduce){${scope}:has(:checked) .sp-0{display:none}${scope}:has(:checked) .sp-1{display:block}}
${DARK.map((c, i) => `${scope} .k${i}{fill:${c}}`).join("")}
${LIGHT.map((c, i) => (c === DARK[i] ? "" : `html[data-theme="light"] ${scope} .k${i}{fill:${c}}`)).join("")}`;

/** The gallery figure for entry `e`: `bytes` is the kernel's gzip size, measured by this build. */
export function figure(e: { id: string; title: string; prompt: string; aspect?: string }, bytes: number) {
  if (!(bytes > 0)) throw new Error("small-packages: the kernel's measured gzip size is required");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const end = kernelLine(bytes);
  const label = `${e.title}: ${e.prompt}. ${SETUP} ${SAY[2]![0]} ${end}.`;
  return `<figure class="ae-slot gal-fig gal-tap" data-slot-target="gallery#${esc(e.id)}" data-kernel-gzip="${bytes}" role="img" aria-label="${esc(label)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}">` +
    `<label class="ae-slot__placeholder sp-poster" aria-hidden="true"><style>${CSS(".sp-poster")}</style><input type="checkbox" tabindex="-1">` +
    svg(still(0, bytes).buf, "sp-0") + svg(still(1, bytes).buf, "sp-1") +
    `<p class="sp-0">${esc(SETUP)}<small>Tap to cut it down to size.</small></p>` +
    `<p class="sp-1">${esc(SAY[2]![0]!)}<small>${esc(end)}</small></p></label></figure>`;
}
