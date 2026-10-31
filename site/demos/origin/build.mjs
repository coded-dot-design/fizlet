// Build the origin hero into site-dist/demos/origin/. Run by scripts/site.mjs (`npm run site`).
// main.js (fizlet/slot: the loader) and scene.js (the live chunk: kernel + timeline + fx + sound +
// input + sprite + the scene) are two files; the scene loads only once the slot asks. The brick
// sizes on the "show bricks" labels are measured here (scripts/sizes.mjs), put in at build time.
// Every number on the page is measured here, at build time.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { page, crumbs, esc, icon, social, jsonLd } from "../../layout.mjs";
import { measure } from "../../../scripts/sizes.mjs";

const OUT = "site-dist/demos/origin", DIR = "site/demos/origin";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync(OUT, { recursive: true });

// Each brick's own gzip bytes, as `npm run size` measures them.
const NAMES = { "fizlet (kernel)": "kernel", "fizlet/timeline": "timeline", "fizlet/fx": "fx", "fizlet/sound": "sound", "fizlet/input": "input", "fizlet/sprite": "sprite", "fizlet/slot": "slot" };
export const bricks = {};
for (const { name, gzip } of await measure()) if (NAMES[name]) bricks[NAMES[name]] = gzip;

const opts = { bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning" };
await build({ ...opts, entryPoints: { main: `${DIR}/main.ts` }, outdir: OUT, external: ["./scene.js"] });
await build({ ...opts, entryPoints: { scene: `${DIR}/scene.ts` }, outdir: OUT, define: { __ORIGIN_BRICKS__: JSON.stringify(bricks) } });
copyFileSync(`${DIR}/coffee.png`, `${OUT}/coffee.png`);
const gz = (f) => gzipSync(readFileSync(f)).length;
export const sizes = { loader: gz(`${OUT}/main.js`), chunk: gz(`${OUT}/scene.js`), cup: readFileSync(`${OUT}/coffee.png`).length };

// The poster: the same art, mid-morning, awake, code on the screens, rendered here (no JS). It is
// the placeholder while the scene loads and the still frame for reduced motion.
const tmp = await build({ stdin: { contents: 'export * from "./art.ts"; export * from "./copy.ts";', resolveDir: DIR, loader: "ts" }, bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const { art, CSS, why, ORIGIN_WHY, ORIGIN_TITLE } = await import("data:text/javascript;base64," + Buffer.from(tmp.outputFiles[0].text).toString("base64"));
export const POSTER_CSS = CSS;
export const poster = (cup = "coffee.png") => `<div class="ae-slot__placeholder og og-poster" aria-hidden="true" style="--sky:rgb(158,214,224);--night:0;--sun:.38;--beam:1;--glow:1">` +
  art({ aw: 1, ph: 1, lid: 1, hd: 1 }, "code", cup, bricks, "ogp-").replace(' tabindex="0" role="button" aria-label="Close the laptop"', "").replace(/ role="group" aria-label="[^"]*"/, ' aria-hidden="true"').replace("<image href", '<image href').replace('viewBox="0 0 84 84"', 'viewBox="924 0 84 84"') + why(esc(ORIGIN_WHY), esc(ORIGIN_WHY), "WHY") + `</div>`;
sizes.poster = gzipSync(poster()).length;

const fmt = (n) => n.toLocaleString("en-US");
const BRICK_ROWS = [["kernel", "fizlet (kernel)", "One loop at 30 fps; settles when nothing moves; the ledger gives the page back"], ["timeline", "fizlet/timeline", "The day and night cycle (sky, shade, sun, lamp); the wake, sleep and sip sequences"], ["fx", "fizlet/fx", "♪ notes, coffee steam, sparks of code (or swatch chips), the Zzz"], ["sound", "fizlet/sound", "The beat, key clicks, the sip; silent until your first tap or key"], ["input", "fizlet/input", "Taps on the laptop, cup, phone and headphones; the lid key"], ["sprite", "fizlet/sprite", "The pixel coder dancing on the phone"], ["slot", "fizlet/slot", "Loads the scene near the viewport, on an idle main thread (main.js)"]];
const caption = [`Live chunk <b>${fmt(sizes.chunk)} B</b> gzip (six bricks + the scene)`, `loader <b>${fmt(sizes.loader)} B</b> (fizlet/slot)`, `poster <b>${fmt(sizes.poster)} B</b> inline`, `2015 coffee sheet <b>${fmt(sizes.cup)} B</b> PNG`].join(" · ");

const STYLE = `<style>
${CSS}
.og-page { padding: 56px 0 72px; }
.og-title { font-size: clamp(40px, 6vw, 84px); line-height: .95; letter-spacing: -.05em; margin: 10px 0 18px; }
.og-title button { font: inherit; letter-spacing: inherit; color: var(--k-attack); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-decoration-thickness: .06em; text-underline-offset: .12em; }
.og-board { position: relative; padding: 14px; margin-top: 28px; }
.og-page figure.ae-slot { position: relative; margin: 0; width: 100%; aspect-ratio: 16 / 10; border-radius: 10px; overflow: hidden; background: #65b9ad; }
@media (max-width: 600px) { .og-page figure.ae-slot { aspect-ratio: 4 / 5; } }
.og-cap { margin: 14px 0 0; font: 12px/1.7 var(--mono); color: var(--muted); }
.og-cap b { color: var(--ink); }
.og-bricks { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 14px; }
.og-bricks th, .og-bricks td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
.og-bricks td:nth-child(2) { font-family: var(--mono); white-space: nowrap; }
.og-wrap { overflow-x: auto; }
</style>`;

const body = `${STYLE}
<section class="og-page" aria-labelledby="og-title">
  <div class="wrap">
    ${crumbs("../../", [["heroes/", "Heroes"]], "Origin")}
    <p class="eyebrow"><span class="index">OG</span> THE ORIGIN · A HERO SCENE</p>
    <h1 id="og-title" class="og-title"><button type="button" data-og-word aria-label="Switch the screens to design work">Code</button>. Sleep. Drink. Repeat.</h1>
    <p class="lead">A designer's and developer's day as a loop. Night: head down on the desk. The sun comes up, the headphones go on, the coffee goes down, and the laptop and phone run all day. Night falls, the lid closes, repeat. Tap the word to switch the screens between code and design work. Close the laptop and he sleeps; open it and the day starts.</p>
    <p class="lead og-why-lead"><b>Why Fizlet.</b> ${esc(ORIGIN_WHY)}</p>
    <p class="lead">The headphones, the coffee and the laptop are the props from my 2015 portfolio, back as living things. The cup is the 2015 sprite sheet itself. By <a href="https://coded.design/">Chris Cooley ↗</a>.</p>
    <div class="panel lit og-board">
      <figure class="ae-slot ae-slot--16x10" data-slot-target="origin#hero" aria-label="Code. Sleep. Drink. Repeat. A desk seen from above through one day: he sleeps, wakes with the sun, puts the headphones on, drinks his coffee, codes all day, and sleeps again">${poster()}</figure>
      <p class="og-cap">${caption}. Measured on this build.</p>
    </div>
    <div class="og-wrap"><table class="og-bricks"><caption class="eyebrow" style="text-align:left;padding:0 0 8px">Every moving part is a brick (gzip, each brick alone, as <code>npm run size</code> measures it)</caption>
      <thead><tr><th scope="col">Brick</th><th scope="col">Bytes</th><th scope="col">What it moves</th></tr></thead>
      <tbody>${BRICK_ROWS.map(([k, n, what]) => `<tr><th scope="row">${esc(n)}</th><td>${fmt(bricks[k])} B</td><td>${esc(what)}</td></tr>`).join("")}</tbody></table></div>
  </div>
</section>`;

writeFileSync(`${OUT}/index.html`, page({
  title: `Origin: ${ORIGIN_TITLE.code} · Fizlet`,
  description: `A day as a loop: sleep, sunrise, headphones, coffee, code, night. The 2015 props alive in ${fmt(sizes.chunk)} B gzip. By Chris Cooley.`,
  base: "../../", version, path: "demos/origin/", body, scripts: ["site.js", "demos/origin/main.js"],
}));
writeFileSync(`${OUT}/sizes.json`, JSON.stringify({ ...sizes, bricks }));
console.log(`Built ${OUT}/: live chunk ${sizes.chunk} B gzip, loader ${sizes.loader} B, poster ${sizes.poster} B, bricks ${JSON.stringify(bricks)}`);
void icon, void social, void jsonLd;
