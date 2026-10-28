// Build the website (https://coded-dot-design.github.io/fizlet/) into site-dist/: static HTML from
// the template modules in site/, the Board UI kit CSS, the live demo bundled from src/ with
// esbuild, a one-file script-tag build (fizlet.js) and the ESM dist/ for the quick start.
// No framework, no dependencies beyond the repo's dev tools. Run `npm run build` first (npm run site).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { measure } from "./sizes.mjs";
import { page, mark, SITE } from "../site/layout.mjs";
import { home } from "../site/pages/index.mjs";
import { quickStartPage } from "../site/pages/quick-start.mjs";
import { notFound } from "../site/pages/not-found.mjs";

const OUT = "site-dist";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!existsSync("dist/index.js")) throw new Error("dist/ is missing: run `npm run build` first (or `npm run site`)");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/examples`, { recursive: true });

// The script-tag build: kernel and every brick except debug (dev only) on window.fizlet.
const all = 'export * from "./src/index.ts"; export * from "./src/input.ts"; export * from "./src/collide.ts"; export * from "./src/fx.ts"; export * from "./src/sound.ts"; export * from "./src/embed.ts"; export * from "./src/ui/board-ui.ts";';
const iife = await build({
  stdin: { contents: all, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, minify: true, format: "iife", globalName: "fizlet", target: "es2022", legalComments: "none", write: false, logLevel: "warning",
  banner: { js: `/*! Fizlet ${version} · MIT · https://github.com/coded-dot-design/fizlet */` },
});
writeFileSync(`${OUT}/fizlet.js`, iife.outputFiles[0].contents);
const bundle = gzipSync(iife.outputFiles[0].contents).length;

// Page scripts: the demo (bundled from src/, as a game would) and the shared site script.
await build({
  entryPoints: { demo: "site/demo.ts", site: "site/site.ts" },
  outdir: OUT, bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});

cpSync("dist", `${OUT}/dist`, { recursive: true });
cpSync("src/ui/board-ui.css", `${OUT}/board-ui.css`);
cpSync("site/site.css", `${OUT}/site.css`);
writeFileSync(`${OUT}/icon.svg`, mark(64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#39ffb0;background:#07060f" '));
writeFileSync(`${OUT}/.nojekyll`, "");

const sizes = await measure();
const kernel = sizes[0];
const pages = [
  ["index.html", page({
    title: "Fizlet · Tiny physics for your page",
    description: `A micro game engine for the DOM: one shared loop, bounded everything, and the page always comes back. Kernel ${(kernel.gzip / 1024).toFixed(1)} KB gzip, no dependencies.`,
    base: "./", version, path: "", body: home({ version, sizes, bundle }), scripts: ["site.js", "demo.js"],
  })],
  ["examples/quick-start.html", page({
    title: "Quick start · Fizlet",
    description: "Ten lines to a blast: the Fizlet quick start, running.",
    base: "../", version, path: "examples/quick-start.html", body: quickStartPage({ site: SITE }), scripts: ["site.js"],
  })],
  ["404.html", page({
    title: "Not found · Fizlet",
    description: "This square is off the board.",
    base: "/fizlet/", version, path: "404.html", body: notFound("/fizlet/"), scripts: ["site.js"],
  })],
];
for (const [file, html] of pages) writeFileSync(`${OUT}/${file}`, html);
console.log(`Built ${OUT}/: ${pages.length} pages, fizlet.js ${bundle} B gzip, kernel ${kernel.gzip} B gzip`);
