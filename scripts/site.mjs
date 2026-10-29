// Build the website (https://coded-dot-design.github.io/fizlet/) into site-dist/: static HTML from
// the template modules in site/, the Board UI kit CSS, the live demo bundled from src/ with
// esbuild, a one-file script-tag build (fizlet.js) and the ESM dist/ for the quick start.
// No framework, no dependencies beyond the repo's dev tools. Run `npm run build` first (npm run site).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { measure } from "./sizes.mjs";
import { page, mark, SITE } from "../site/layout.mjs";
import { home } from "../site/pages/index.mjs";
import { quickStartPage } from "../site/pages/quick-start.mjs";
import { notFound } from "../site/pages/not-found.mjs";
import { brickPage, bricksIndex } from "../site/pages/brick.mjs";
import { galleryPage } from "../site/pages/gallery.mjs";
import { playFigure } from "../site/pages/index.mjs";
import { buildGallery } from "./gallery.mjs";
import { BRICKS, brickPath } from "../site/bricks.mjs";
import { api } from "./api.mjs";
import { ogImage } from "./og.mjs";

const OUT = "site-dist";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!existsSync("dist/index.js")) throw new Error("dist/ is missing: run `npm run build` first (or `npm run site`)");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/examples`, { recursive: true });
mkdirSync(`${OUT}/bricks`, { recursive: true });
mkdirSync(`${OUT}/gallery`, { recursive: true });

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

// The brick pages' demos: one small loader, and one chunk per demo (a page loads only its own).
await build({
  entryPoints: { "brick-demo": "site/brick-demo.ts" },
  outdir: OUT, bundle: true, splitting: true, chunkNames: "chunks/[name]-[hash]", minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});

cpSync("dist", `${OUT}/dist`, { recursive: true });
cpSync("src/ui/board-ui.css", `${OUT}/board-ui.css`);
cpSync("site/site.css", `${OUT}/site.css`);
writeFileSync(`${OUT}/icon.svg`, mark(64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#39ffb0;background:#07060f" '));
writeFileSync(`${OUT}/og.png`, ogImage());
writeFileSync(`${OUT}/.nojekyll`, "");

// The two story demos, each built by its own script: layers (the home hero) and fizz (the name).
// Their markup and sizes come from those builds; the home page embeds them.
await import("../site/demos/layers/build.mjs");
const posterMod = await build({ entryPoints: ["site/demos/layers/poster.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const L = await import("data:text/javascript;base64," + Buffer.from(posterMod.outputFiles[0].text).toString("base64"));
const layers = { figure: L.poster(), css: L.POSTER_CSS, loader: L.loader("./demos/layers/layers.js"), sizes: JSON.parse(readFileSync(`${OUT}/demos/layers/sizes.json`, "utf8")) };
const { sizes: fizzSizes } = await import("../site/demos/fizz/build.mjs");
const fizzFigure = readFileSync(`${OUT}/demos/fizz/index.html`, "utf8").match(/<figure class="ae-slot" data-slot-target="fizz#hero"[\s\S]*?<\/figure>/)?.[0];
if (!fizzFigure) throw new Error("demos/fizz/index.html: no fizz figure to embed");
const fizz = { figure: fizzFigure, sizes: fizzSizes };

// The gallery: one bundle per entry, each measured here (its size badge). The story demos keep
// their own posters as their figures; the blast demo waits in a <template> until its slot mounts.
const gallery = await buildGallery(OUT);
const figures = {
  layers: L.poster("gallery#layers"),
  fizz: fizzFigure.replace('data-slot-target="fizz#hero"', 'data-slot-target="gallery#fizz"').replace('<figure class="ae-slot"', '<figure class="ae-slot gal-fig"'),
  howitworks: `<figure class="ae-slot gal-fig gal-tall" data-slot-target="gallery#howitworks" role="img" aria-label="The blast demo: a small page you can knock around; Recall puts it back."><span class="ae-slot__placeholder gal-still" aria-hidden="true">“Hello, page.” Every letter is a real element.</span><template>${playFigure()}</template></figure>`,
};

const sizes = await measure();
const kernel = sizes[0];
// Every brick's API, from its source comment and its built declarations.
const bricks = BRICKS.map((b) => {
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  return { ...b, mods, summary: mods[0].summary.match(/^.*?\.(?=\s|$)/)?.[0] ?? mods[0].summary };
});
const pages = [
  ["index.html", page({
    title: "Fizlet · Tiny physics for your page",
    description: `A micro game engine for the DOM: one shared loop, bounded everything, and the page always comes back. Kernel ${(kernel.gzip / 1024).toFixed(1)} KB gzip, no dependencies.`,
    base: "./", version, path: "", body: home({ version, sizes, bundle, bricks, layers, fizz }), scripts: ["site.js", "demo.js", "demos/fizz/main.js"],
  })],
  ["examples/quick-start.html", page({
    title: "Quick start · Fizlet",
    description: "Ten lines to a blast: the Fizlet quick start, running.",
    base: "../", version, path: "examples/quick-start.html", body: quickStartPage({ site: SITE }), scripts: ["site.js"],
  })],
  ["bricks/index.html", page({
    title: "Kernel and bricks · Fizlet",
    description: `Every Fizlet module with its API and its measured size: the kernel is ${(kernel.gzip / 1024).toFixed(1)} KB gzip, each brick its own import.`,
    base: "../", version, path: "bricks/", body: bricksIndex({ bricks, sizes, version }), scripts: ["site.js"],
  })],
  ["gallery/index.html", page({
    title: "Gallery · Fizlet",
    description: `Every Fizlet animation, newest first: the prompt it was made from, the live demo and its size measured on this build (${gallery.entries.length} so far, by Chris Cooley).`,
    base: "../", version, path: "gallery/", body: `<style>${layers.css}</style>` + galleryPage({ entries: gallery.entries, loader: gallery.loader, figures, base: "../" }), scripts: ["site.js", "gallery/gallery.js"],
  })],
  ...bricks.map((b, i) => [brickPath(b), page({
    title: `${b.name} · Fizlet`,
    description: `${b.name}: ${b.summary} API and measured size (${sizes.find((s) => s.name === b.sizes[0]).gzip} B gzip).`.slice(0, 300),
    base: "../", version, path: brickPath(b),
    body: brickPage({ brick: b, mods: b.mods, sizes, version, prev: bricks[i - 1], next: bricks[i + 1] }),
    scripts: b.demo ? ["site.js", "brick-demo.js"] : ["site.js"],
  })]),
  ["404.html", page({
    title: "Not found · Fizlet",
    description: "This square is off the board: the page you asked for is not on the Fizlet site.",
    base: "/fizlet/", version, path: "404.html", body: notFound("/fizlet/"), scripts: ["site.js"],
  })],
];
for (const [file, html] of pages) writeFileSync(`${OUT}/${file}`, html);
// Search engines: every page but the 404, at its canonical URL.
// Every page but the 404, the demos' own pages included, at its canonical URL.
const urls = readdirSync(OUT, { recursive: true }).map((f) => f.replace(/\\/g, "/")).filter((f) => f.endsWith(".html") && f !== "404.html" && !f.startsWith("dist/")).sort().map((f) => SITE + f.replace(/(^|\/)index\.html$/, "$1"));
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${OUT}/: ${pages.length} pages, fizlet.js ${bundle} B gzip, kernel ${kernel.gzip} B gzip`);
