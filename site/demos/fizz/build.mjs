// Build the fizz demo into site-dist/demos/fizz/ (and its host-page example into
// site-dist/examples/fizz/). Run after scripts/site.mjs (`npm run site` does both).
// Every number on the page is measured: the bytes here, at build time; frame time and page cost by
// site/demos/fizz/measure.mjs, read from measured.json (left off the page when it is missing).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { page, esc, icon, social, jsonLd } from "../../layout.mjs";

const OUT = "site-dist/demos/fizz", DIR = "site/demos/fizz";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync(OUT, { recursive: true });
mkdirSync("site-dist/examples/fizz", { recursive: true });

// The loader (slot) and the live chunk (the scene), split so the scene loads only when the slot asks.
// Two files, no shared chunk: a split costs the scene ~260 B gzip in chunk overhead for the ledger
// both share; each file carries its own copy instead.
const opts = { bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", metafile: true, logLevel: "warning" };
const a = await build({ ...opts, entryPoints: { main: `${DIR}/main.ts` }, outdir: OUT, external: ["./scene.js"] });
const b = await build({ ...opts, entryPoints: { scene: `${DIR}/scene.ts` }, outdir: OUT });
const res = { metafile: { outputs: { ...a.metafile.outputs, ...b.metafile.outputs } } };
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

// The poster: the same can pixels as SVGs (fizlet/sprite spriteSVG), both views, crunched and open,
// with the drip and the fizz frozen mid-spray, laid out as the scene lays out a 160 × 100 card. It is
// the placeholder while the scene loads and the still frame for reduced motion.
const art = await build({ stdin: { contents: 'export { CAN, TOP, C } from "./can.ts"; export { spriteSVG } from "../../../src/sprite.ts";', resolveDir: DIR, loader: "ts" }, bundle: true, format: "esm", write: false, logLevel: "silent" });
const { CAN, TOP, C, spriteSVG } = await import("data:text/javascript;base64," + Buffer.from(art.outputFiles[0].text).toString("base64"));
const nest = (svg, x, y, k) => svg.replace(/^<svg[^>]*width="(\d+)" height="(\d+)"[^>]*>/, (_, w, h) => `<svg x="${x}" y="${y}" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}">`);
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const px = (x, y, n, c) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${n}" height="${n}" fill="${c}"/>`;
let fizzPx = "";
for (let i = 0; i < 30; i++) {
  const y = 17 - rnd() * 17, x = 51 + (rnd() - 0.5) * (19 - y) * 1.3;
  fizzPx += px(x, y, i % 4 ? 1.5 : 3, i % 3 ? C.ink : C.sys);
}
for (let i = 0; i < 18; i++) {
  const a = rnd() * Math.PI * 2, r = 4 + rnd() * 14;
  fizzPx += px(115.5 + Math.cos(a) * r, 29 + Math.sin(a) * r, i % 3 ? 1.5 : 2.5, i % 4 ? C.ink : C.sys);
}
const poster = `<svg class="ae-slot__placeholder fz-poster" viewBox="0 0 160 100" aria-hidden="true" shape-rendering="crispEdges">` +
  `<rect x="26" y="86" width="44" height="4" fill="${C.base}"/>` +
  nest(spriteSVG(CAN, 3), 26, 4, 2) + nest(spriteSVG(TOP, 1), 81, 11, 3) +
  `<rect x="62" y="26" width="2" height="52" fill="${C.aim}"/><rect x="62" y="86" width="6" height="2" fill="${C.ink}"/><rect x="64" y="86" width="2" height="2" fill="${C.sys}"/>` +
  `${fizzPx}` +
  `</svg>`;
sizes.poster = gzipSync(poster).length;

const m = existsSync(`${DIR}/measured.json`) ? JSON.parse(readFileSync(`${DIR}/measured.json`, "utf8")) : null;
const fmt = (n) => n.toLocaleString("en-GB");
const caption = [
  `Live chunk <b>${fmt(sizes.chunk)} B</b> gzip (kernel + fx + sprite + the can, both views)`,
  `loader <b>${fmt(sizes.loader)} B</b> (fizlet/slot)`,
  `poster <b>${fmt(sizes.poster)} B</b>`,
  ...(m ? [
    `script per frame at 4× CPU throttle <b>${m.throttle4x.avgMs} ms</b> avg, <b>${m.throttle4x.maxMs} ms</b> max`,
    `settled: <b>${m.settled.framesPerSecond}</b> frames a second`,
  ] : []),
].join(" · ");

const CSS = `<style>
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
.fz-how h2 { margin: 0 0 6px; font-size: 18px; letter-spacing: -0.02em; line-height: 1.2; }
.fz-how p { margin: 0; color: var(--muted); }
</style>`;

const body = `${CSS}
<section class="fz" aria-labelledby="fz-title">
  <div class="wrap">
    <div class="fz-top">
      <div>
        <p class="eyebrow"><span class="index">FZ</span> THE NAME · A PROOF PIECE</p>
        <h1 id="fz-title" class="fz-title">Crack the can.<br><em>Hear the fizz.</em></h1>
        <p class="lead">The soda-ad shot. Tap the can: it crunches, the tab pops, and the fizz sprays clean out of the card. Two views tell it side by side: the can from the side, and straight down into it as it fizzes.</p>
        <p class="lead">By <a href="https://coded.design/">Chris Cooley</a>.</p>
      </div>
      <div class="panel lit fz-board">
        <figure class="ae-slot ae-slot--16x10" data-slot-target="fizz#hero" role="img" aria-label="An arcade soda can, side and top views: it crunches, the tab pops, fizz sprays up out of the card and a drip runs down the side">${poster}<span class="bui-label" aria-hidden="true" style="position:absolute;bottom:8px;left:10px;z-index:2;pointer-events:none">CAM 1 · SIDE</span><span class="bui-label" aria-hidden="true" style="position:absolute;bottom:8px;right:10px;z-index:2;pointer-events:none">CAM 2 · TOP</span></figure>
        <div class="fz-keys">
          <button class="bui-key bui-arcade bui-attack" type="button" data-fizz-pop>${icon("bolt", 16)}Pop</button>
          <button class="bui-key bui-arcade bui-cmd" type="button" data-fizz-recall>${icon("recall", 16)}Recall</button>
          <span class="bui-label" data-fizz-status aria-live="polite">LIVE · TAP THE CAN</span>
        </div>
        <p class="fz-cap">${caption}.${m ? ` Measured in Chromium ${esc(m.browser)}, ${esc(m.date)}.` : ""}</p>
      </div>
    </div>
    <div class="fz-how">
      <div class="panel"><h2>Kernel</h2><p><code>settle</code> and <code>fps: 30</code>. It runs while something moves, then sleeps: no frames at all until a tap.</p></div>
      <div class="panel"><h2>fizlet/fx</h2><p>Two fixed pools. The spray flies on a layer above the card, so nothing crops it; the top view fizzes inside. Geyser, burst, bubbles, rings: kinds as data, sprayed with <code>emit()</code>.</p></div>
      <div class="panel"><h2>fizlet/sprite</h2><p>The can is pixel data: 20 × 40 from the side, 22 × 22 from the top, crunched or not. Baked once; the poster is the same pixels as SVG.</p></div>
      <div class="panel"><h2>fizlet/slot</h2><p>Loads near the viewport, on an idle main thread. Reduced motion keeps the still frame; the scene never loads.</p></div>
    </div>
  </div>
</section>`;

writeFileSync(`${OUT}/index.html`, page({
  title: "Fizz: crack the can, hear the fizz · Fizlet",
  description: `An arcade soda can crunches, pops and sprays fizz out of its card, seen from the side and from the top. ${sizes.chunk} B gzip live chunk, by Chris Cooley.`,
  base: "../../", version, path: "demos/fizz/", body, scripts: ["site.js", "demos/fizz/main.js"],
}));
// The example host page, with the real poster and the site's search and sharing tags.
const example = { title: "Crack the can: the fizz as a Fizlet hero", path: "examples/fizz/",
  description: "The fizz as a hero on any page: tap the pixel soda can, it crunches, pops and sprays out of its card. A Fizlet example by Chris Cooley." };
writeFileSync("site-dist/examples/fizz/index.html", readFileSync("examples/fizz/index.html", "utf8")
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(example.title)}</title>\n<meta name="description" content="${esc(example.description)}">\n${social(example)}\n${jsonLd()}`)
  .replace(/<svg class="ae-slot__placeholder"[^\n]*<\/svg>/, poster));
writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes));
console.log(`Built ${OUT}/: live chunk ${sizes.chunk} B gzip, loader ${sizes.loader} B, poster ${sizes.poster} B`);
