// Build the Origin section's two scripts into site-dist/origin/: main.js (the loader: toggle, sound
// gate, fizlet/slot; a deferred module, so never in the way of first paint) and scene.js (loaded by
// the slot only once the figure nears the viewport). Measured here, gzip, for the size badge and the
// PR: loader, scene and the poster that ships in the HTML.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync } from "node:fs";
import { poster } from "./poster.mjs";

const OUT = "site-dist/origin", DIR = "site/origin";
mkdirSync(OUT, { recursive: true });
const opts = { bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning" };
await build({ ...opts, entryPoints: { main: `${DIR}/main.ts` }, outdir: OUT, external: ["./scene.js"] });
await build({ ...opts, entryPoints: { scene: `${DIR}/scene.ts` }, outdir: OUT });
const gz = (f) => gzipSync(readFileSync(f)).length;
export const sizes = { loader: gz(`${OUT}/main.js`), scene: gz(`${OUT}/scene.js`), poster: gzipSync(poster()).length };
