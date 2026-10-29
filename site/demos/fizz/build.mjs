// Build the fizz demo into site-dist/demos/fizz/ (and its host-page example into
// site-dist/examples/fizz/). Run after scripts/site.mjs (`npm run site` does both).
// Every number on the page is measured: the bytes here, at build time; frame time and page cost by
// site/demos/fizz/measure.mjs, read from measured.json (left off the page when it is missing).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { page, esc, icon } from "../../layout.mjs";

const OUT = "site-dist/demos/fizz", DIR = "site/demos/fizz";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync(OUT, { recursive: true });
mkdirSync("site-dist/examples/fizz", { recursive: true });

// The loader (slot) and the live chunk (the scene), split so the scene loads only when the slot asks.
const res = await build({
  entryPoints: { main: `${DIR}/main.ts`, scene: `${DIR}/scene.ts` },
  outdir: OUT, bundle: true, splitting: true, minify: true, format: "esm", target: "es2022",
  chunkNames: "chunk-[hash]", legalComments: "none", metafile: true, logLevel: "warning",
});
/** Gzip bytes of an output file plus every chunk it imports statically. */
const outputs = res.metafile.outputs;
function bytes(file, seen = new Set()) {
  if (seen.has(file)) return 0;
  seen.add(file);
  let n = gzipSync(readFileSync(file)).length;
  for (const i of outputs[file].imports) if (i.kind === "import-statement") n += bytes(i.path, seen);
  return n;
}
export const sizes = { loader: bytes(`${OUT}/main.js`), chunk: bytes(`${OUT}/scene.js`) };

// The poster: the same can pixels as an SVG (fizlet/sprite svg()), open, with the drip and the fizz
// frozen mid-spray. It is the placeholder while the scene loads and the still frame for reduced motion.
const art = await build({ stdin: { contents: 'export { CAN, C } from "./can.ts"; export { sprites } from "../../../src/sprite.ts";', resolveDir: DIR, loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "silent" });
const { CAN, C, sprites } = await import("data:text/javascript;base64," + Buffer.from(art.outputFiles[0].text).toString("base64"));
const can = sprites({ can: CAN }).svg("can", 1).replace(/^<svg[^>]*>/, '<svg x="-11" y="14" width="22" height="42">');
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
let fizzPx = "";
for (let i = 0; i < 26; i++) {
  const y = 20 - rnd() * 19, spread = (21 - y) * 0.55, x = 1.5 + (rnd() - 0.5) * spread * 2;
  fizzPx += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${i % 5 ? 1 : 2}" height="${i % 5 ? 1 : 2}" fill="${i % 3 ? C.ink : C.sys}"/>`;
}
const poster = `<svg class="ae-slot__placeholder fz-poster" viewBox="-50 0 100 64" aria-hidden="true" shape-rendering="crispEdges">` +
  `<rect x="-11" y="55" width="22" height="2" fill="${C.base}"/>${can}` +
  `<rect x="6" y="25" width="1" height="26" fill="${C.aim}"/><rect x="6" y="55" width="3" height="1" fill="${C.ink}"/><rect x="7" y="55" width="1" height="1" fill="${C.sys}"/>` +
  `<rect x="-7" y="25" width="1" height="13" fill="${C.aim}"/><rect x="-7" y="37" width="1" height="2" fill="${C.ink}"/>${fizzPx}</svg>`;
sizes.poster = gzipSync(poster).length;

const m = existsSync(`${DIR}/measured.json`) ? JSON.parse(readFileSync(`${DIR}/measured.json`, "utf8")) : null;
const fmt = (n) => n.toLocaleString("en-GB");
const caption = [
  `Live chunk <b>${fmt(sizes.chunk)} B</b> gzip (kernel + fx + sprite + the can)`,
  `loader <b>${fmt(sizes.loader)} B</b> (fizlet/slot)`,
  `poster <b>${fmt(sizes.poster)} B</b>`,
  ...(m ? [
    `script per frame at 4× CPU throttle <b>${m.throttle4x.avgMs} ms</b> avg, <b>${m.throttle4x.maxMs} ms</b> max`,
    `settled: <b>${m.settled.framesPerSecond}</b> frames a second`,
  ] : []),
].join(" · ");

const CSS = `<style>
.fz-frame { overflow: clip; }
.fz { padding: 56px 0 72px; }
.fz-top { display: grid; gap: 28px; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); align-items: center; }
@media (max-width: 860px) { .fz-top { grid-template-columns: minmax(0, 1fr); } }
.fz-title { font-size: clamp(44px, 6.4vw, 88px); line-height: .92; letter-spacing: -.05em; margin: 10px 0 18px; }
.fz-title em { font-style: normal; color: var(--k-attack); }
.fz-board { position: relative; padding: 14px; }
.fz figure.ae-slot { position: relative; margin: 0; width: 100%; aspect-ratio: 16 / 10; border-radius: 10px; overflow: hidden; cursor: pointer;
  background-color: #0b0918; background-image: linear-gradient(color-mix(in srgb, var(--line) 35%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--line) 35%, transparent) 1px, transparent 1px); background-size: 22px 22px; }
@media (max-width: 600px) { .fz figure.ae-slot { aspect-ratio: 1 / 1; } }
.fz .fz-poster { position: absolute; inset: 0; width: 100%; height: 100%; }
.fz-keys { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 16px; }
.fz-cap { margin: 14px 0 0; font: 12px/1.7 var(--mono); color: var(--muted); }
.fz-cap b { color: var(--ink); }
.fz-how { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); margin-top: 40px; }
.fz-how .panel { padding: 20px; }
.fz-how h3 { margin: 0 0 6px; font-size: 18px; }
.fz-how p { margin: 0; color: var(--muted); }
</style>`;

const body = `${CSS}
<div class="fz-frame"><div data-fizz-zoom>
<section class="fz" aria-labelledby="fz-title">
  <div class="wrap">
    <div class="fz-top">
      <div>
        <p class="eyebrow"><span class="index">FZ</span> THE NAME · A PROOF PIECE</p>
        <h1 id="fz-title" class="fz-title">Crack a can.<br><em>The page leans in.</em></h1>
        <p class="lead">The soda-ad shot: the tab pops, it fizzes, and the camera pushes in on the bubbles and the drip. There is no camera here. The page itself zooms, and Recall gives it back.</p>
        <p class="lead">By <a href="https://coded.design/">Chris Cooley</a>.</p>
      </div>
      <div class="panel lit fz-board">
        <figure class="ae-slot" data-slot-target="fizz#hero" role="img" aria-label="An arcade soda can pops open, fizz sprays from the top and a drip runs down the side">${poster}</figure>
        <div class="fz-keys">
          <button class="bui-key bui-arcade bui-attack" type="button" data-fizz-pop>${icon("bolt", 16)}Pop</button>
          <button class="bui-key bui-arcade bui-cmd" type="button" data-fizz-recall>${icon("recall", 16)}Recall</button>
          <span class="bui-label" data-fizz-status aria-live="polite">LIVE · TAP THE CAN</span>
        </div>
        <p class="fz-cap">${caption}.${m ? ` Measured in Chromium ${esc(m.browser)}, ${esc(m.date)}.` : ""}</p>
      </div>
    </div>
    <div class="fz-how">
      <div class="panel"><h3>Kernel</h3><p><code>settle</code> and <code>fps: 30</code>. It runs while something moves, then sleeps: no frames at all until a tap.</p></div>
      <div class="panel"><h3>fizlet/fx</h3><p>The spray, the bubbles, the splat and the pop words. One fixed pool of particles; a full pool refuses more.</p></div>
      <div class="panel"><h3>fizlet/sprite</h3><p>The can is 20 × 40 pixels of data, baked once. The poster is the same pixels as an SVG.</p></div>
      <div class="panel"><h3>fizlet/slot</h3><p>Loads near the viewport, on an idle main thread. Reduced motion keeps the still frame; the scene never loads.</p></div>
    </div>
  </div>
</section>
</div></div>`;

writeFileSync(`${OUT}/index.html`, page({
  title: "Fizz · Fizlet",
  description: `An arcade soda can pops, fizzes and drips while the page zooms in. ${sizes.chunk} B gzip live chunk, by Chris Cooley.`,
  base: "../../", version, path: "demos/fizz/", body, scripts: ["site.js", "demos/fizz/main.js"],
}));
// The example host page, with the real poster.
writeFileSync("site-dist/examples/fizz/index.html", readFileSync("examples/fizz/index.html", "utf8").replace(/<svg class="ae-slot__placeholder"[^\n]*<\/svg>/, poster));
writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes));
console.log(`Built ${OUT}/: live chunk ${sizes.chunk} B gzip, loader ${sizes.loader} B, poster ${sizes.poster} B`);
