// Build the Origin section's scripts into site-dist/origin/ and measure them (gzip):
// - main.js, the loader (toggle, Sound key, fizlet/slot): a deferred module, never in the way of
//   first paint;
// - the scene, loaded by the slot only once the figure nears the viewport. With the origin scene in
//   the tree (site/demos/origin/, fizlet#218) the loader imports its chunk, demos/origin/scene.js,
//   the same file its own page loads (scripts/site.mjs builds it first). Without it, the placeholder
//   (site/origin/scene.ts) is built as origin/scene.js: the fallback.
// - the poster that ships inline in the HTML (the scene's own, or the placeholder's) and its CSS.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { poster as placeholderPoster } from "./poster.mjs";

const OUT = "site-dist/origin", DIR = "site/origin";
export const REAL = existsSync("site/demos/origin/scene.ts");
mkdirSync(OUT, { recursive: true });
const opts = { bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning" };
await build({ ...opts, entryPoints: { main: `${DIR}/main.ts` }, outdir: OUT, external: ["./scene.js", "../demos/origin/scene.js"], define: { ORIGIN_REAL: String(REAL) } });
const gz = (f) => gzipSync(readFileSync(f)).length;

let figure, css = "", live;
if (REAL) {
  const real = await import("../demos/origin/build.mjs");
  figure = real.poster("demos/origin/coffee.png");
  css = real.POSTER_CSS;
  live = "demos/origin/scene.js";
} else {
  await build({ ...opts, entryPoints: { scene: `${DIR}/scene.ts` }, outdir: OUT });
  figure = placeholderPoster();
  live = "origin/scene.js";
}
export const origin = {
  real: REAL,
  figure,
  css,
  live,
  sizes: { loader: gz(`${OUT}/main.js`), scene: gz(`site-dist/${live}`), poster: gzipSync(figure).length, css: css ? gzipSync(css).length : 0 },
};
