// Build the layers story: `node site/demos/layers/build.mjs [outDir]` (default site-dist/demos/layers).
// The page (examples/layers/page.mjs) carries the slot figure and its poster inline; entry.js is the
// host script (fizlet/slot only) and the scene comes in as its own chunk once the slot is near.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "site-dist/demos/layers";
const HERE = "site/demos/layers";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: { entry: `${HERE}/entry.ts` }, outdir: OUT, bundle: true, splitting: true, minify: true,
  format: "esm", target: "es2022", legalComments: "none", logLevel: "warning", chunkNames: "[name]-[hash]",
});
// The poster is rendered at build time (TS through esbuild, run here in Node).
const tmp = await build({ entryPoints: [`${HERE}/poster.ts`], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const { poster, POSTER_CSS } = await import("data:text/javascript;base64," + Buffer.from(tmp.outputFiles[0].text).toString("base64"));
const { page } = await import("../../../examples/layers/page.mjs");

let measured = null;
try { measured = JSON.parse(readFileSync(`${HERE}/measured.json`, "utf8")); } catch {}
copyFileSync("src/ui/board-ui.css", join(OUT, "board-ui.css"));
writeFileSync(join(OUT, "index.html"), page({ figure: poster(), css: POSTER_CSS, measured }));

const gz = (b) => gzipSync(b).length;
const files = readdirSync(OUT).filter((f) => f.endsWith(".js"));
// Eager: entry.js and the chunks it imports statically (the slot). Lazy: everything else (the scene).
const entryText = readFileSync(join(OUT, "entry.js"), "utf8");
const eager = new Set(["entry.js", ...[...entryText.matchAll(/from"\.\/([^"]+)"/g)].map((m) => m[1])]);
const sizes = { entry: 0, scene: 0 };
for (const f of files) sizes[eager.has(f) ? "entry" : "scene"] += gz(readFileSync(join(OUT, f)));
sizes.live = sizes.entry + sizes.scene;
sizes.poster = gz(`<style>${POSTER_CSS}</style>${poster()}`);
writeFileSync(join(OUT, "sizes.json"), JSON.stringify(sizes));
console.log(`Built ${OUT}: entry ${sizes.entry} B, scene ${sizes.scene} B, poster ${sizes.poster} B gzip`);
