// Build the layers story: `node site/demos/layers/build.mjs [outDir]` (default site-dist/demos/layers).
// The page (examples/layers/page.mjs) carries the slot figure, its poster and a tiny loader inline;
// layers.js (fizlet/slot + the scene, one file) loads only once the slot is near.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { esc, social, jsonLd } from "../../layout.mjs";

const OUT = process.argv[2] ?? "site-dist/demos/layers";
const HERE = "site/demos/layers";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: { layers: `${HERE}/entry.ts` }, outdir: OUT, bundle: true, minify: true,
  format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});
// The standalone page has no site script: the site's scroll-lock note (site/scroll-hint.ts) comes as
// its own small chunk, loaded with the scene.
await build({
  stdin: { contents: 'import { scrollHint } from "./site/scroll-hint.ts"; scrollHint(document);', resolveDir: process.cwd(), loader: "ts" },
  outfile: join(OUT, "hint.js"), bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});
// The poster is rendered at build time (TS through esbuild, run here in Node).
const tmp = await build({ entryPoints: [`${HERE}/poster.ts`], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const { poster, loader, POSTER_CSS, bounds, BOUNDS, LAYERS } = await import("data:text/javascript;base64," + Buffer.from(tmp.outputFiles[0].text).toString("base64"));
// The live chunk uses precomputed bounds; they must match the formula.
const b = bounds();
const hb = bounds(1).h;
if (Math.abs(b.w - BOUNDS.w) > 0.01 || Math.abs(b.h - BOUNDS.h) > 0.01 || Math.abs(hb - BOUNDS.hb) > 0.01 || Math.abs(b.cx) > 0.01 || Math.abs(b.cy) > 0.01)
  throw new Error(`data.ts BOUNDS is stale: bounds() gives ${JSON.stringify({ ...b, hb })}`);
// The scene carries only the layer ids; they must match LAYERS.
const ids = (readFileSync(`${HERE}/scene.ts`, "utf8").match(/const IDS = "([^"]+)"/) ?? [])[1];
if (ids !== LAYERS.map((l) => l.id).join(" ")) throw new Error(`scene.ts IDS (${ids}) does not match data.ts LAYERS`);
const { page } = await import("../../../examples/layers/page.mjs");

let measured = null;
try { measured = JSON.parse(readFileSync(`${HERE}/measured.json`, "utf8")); } catch {}
copyFileSync("src/ui/board-ui.css", join(OUT, "board-ui.css"));

const gz = (b) => gzipSync(b).length;
const sizes = { loader: gz(loader()), live: gz(readFileSync(join(OUT, "layers.js"))) };
// Inline on the page: the figure, its CSS and the loader.
sizes.poster = gz(`<style>${POSTER_CSS}</style>${poster()}${loader()}`);
writeFileSync(join(OUT, "sizes.json"), JSON.stringify(sizes));
// The size badge (site/size-badge.mjs) and its rules, read from site/site.css (one source).
const badgeCss = (readFileSync("site/site.css", "utf8").match(/\.size-badge \{[\s\S]*?\n\}\n\.size-badge b \{[\s\S]*?\n\}/) ?? [""])[0];
if (!badgeCss) throw new Error("site/site.css: the .size-badge rules moved; update build.mjs");
// The scroll-lock note's rules, from the same file.
const hintCss = (readFileSync("site/site.css", "utf8").match(/\/\* -+ Scroll-lock hint[\s\S]*?(?=\/\* Consent banner)/) ?? [""])[0];
if (!hintCss.includes(".scroll-hint[data-open]")) throw new Error("site/site.css: the .scroll-hint rules moved; update build.mjs");
// The site's search and sharing tags on the example host page (the example itself stays plain).
const head = { title: "Layers: a game is a stack, each layer one brick · Fizlet", path: "demos/layers/",
  description: "A game is a stack of layers. Battlefield Blitz fans out into its bricks, one faults, gets patched, and folds back." };
writeFileSync(join(OUT, "index.html"), page({ figure: poster(), css: POSTER_CSS + badgeCss + ":root{--frame-warn:var(--k-fire-ink)}" + hintCss, loader: loader("./layers.js", "./hint.js"), measured, sizes })
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(head.title)}</title>`).replace(/(<meta name="description"[^>]*>)/, `$1\n${social(head)}\n${jsonLd()}`));
console.log(`Built ${OUT}: live chunk ${sizes.live} B, inline poster + loader ${sizes.poster} B (loader ${sizes.loader} B) gzip`);
