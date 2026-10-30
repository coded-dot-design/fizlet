// Build the website (https://fizlet.com/, site/layout.mjs SITE) into site-dist/: static HTML from
// the template modules in site/, the Board UI kit CSS, the live demo bundled from src/ with
// esbuild, a one-file script-tag build (fizlet.js) and the ESM dist/ for the quick start.
// No framework, no dependencies beyond the repo's dev tools. Run `npm run build` first (npm run site).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { measure } from "./sizes.mjs";
import { page, mark, SITE, ROOT, REPO, PERSON, ORG, WEBSITE } from "../site/layout.mjs";
import { home } from "../site/pages/index.mjs";
import { quickStartPage } from "../site/pages/quick-start.mjs";
import { notFound } from "../site/pages/not-found.mjs";
import { brickPage, bricksIndex } from "../site/pages/brick.mjs";
import { galleryPage } from "../site/pages/gallery.mjs";
import { notePage, notesIndex, noteLd } from "../site/pages/notes.mjs";
import { notes as loadNotes, notePath } from "./notes.mjs";
import { playFigure } from "../site/pages/index.mjs";
import { buildGallery } from "./gallery.mjs";
import { buildMake, snippetFor, TABLE as MAKE_TABLE } from "./make.mjs";
import { makePage, DEFAULT_PROMPT } from "../site/pages/make.mjs";
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
mkdirSync(`${OUT}/make`, { recursive: true });
const NOTES = loadNotes();
for (const n of NOTES) mkdirSync(`${OUT}/${notePath(n)}`, { recursive: true });

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
const fizzFigure = readFileSync(`${OUT}/demos/fizz/index.html`, "utf8").match(/<figure class="ae-slot ae-slot--16x10" data-slot-target="fizz#hero"[\s\S]*?<\/figure>/)?.[0];
if (!fizzFigure) throw new Error("demos/fizz/index.html: no fizz figure to embed");
const fizz = { figure: fizzFigure, sizes: fizzSizes };

// The gallery: one bundle per entry, each measured here (its size badge). The story demos keep
// their own posters as their figures; the blast demo waits in a <template> until its slot mounts.
const gallery = await buildGallery(OUT);
// Make one (/make/): the templates, its script, the default prompt's snippet (the page works before
// any script runs) and a snippet for every gallery entry made from a prompt ("Get the snippet").
const make = await buildMake(OUT, { version, entries: gallery.entries });
const defaultSnippet = await snippetFor(DEFAULT_PROMPT, { version, templates: make.templates });
writeFileSync(`${OUT}/make/default.snippet.txt`, defaultSnippet.text);
const figures = {
  layers: L.poster("gallery#layers"),
  fizz: fizzFigure.replace('data-slot-target="fizz#hero"', 'data-slot-target="gallery#fizz"').replace('<figure class="ae-slot ae-slot--16x10"', '<figure class="ae-slot ae-slot--16x10 gal-fig"'),
  howitworks: `<figure class="ae-slot ae-slot--4x5 gal-fig gal-tall" data-slot-target="gallery#howitworks" role="img" aria-label="The blast demo: a small page you can knock around; Recall puts it back."><span class="ae-slot__placeholder gal-still" aria-hidden="true">“Hello, page.” Every letter is a real element.</span><template>${playFigure()}</template></figure>`,
};

const sizes = await measure();
const kernel = sizes[0];
// Every brick's API, from its source comment and its built declarations.
const bricks = BRICKS.map((b) => {
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  return { ...b, mods, summary: mods[0].summary.match(/^.*?\.(?=\s|$)/)?.[0] ?? mods[0].summary };
});
// JSON-LD: the engine's source code (home), each brick as a part of it. Facts from the page only.
const CODE = `${SITE}#code`;
const homeDescription = `A micro game engine for the DOM: one shared loop, bounded everything, and the page always comes back. Kernel ${(kernel.gzip / 1024).toFixed(1)} KB gzip, no dependencies.`;
const code = { "@type": "SoftwareSourceCode", "@id": CODE, name: "Fizlet", description: homeDescription, url: SITE, codeRepository: REPO,
  license: `${REPO}/blob/main/LICENSE`, softwareVersion: version, author: { "@id": PERSON["@id"] }, publisher: { "@id": ORG["@id"] } };
// A brick's description, from its source comment (the lead on its page) and its measured size,
// sized for a search snippet (70–155): whole sentences while they fit (before any list). The first
// sentence, or the next one while the text is under 70, may be cut at its last clause break
// (": ", " (", ", ") that fits, and the text ends there.
const clip = (sentence, room) => {
  if (sentence.length <= room) return sentence;
  for (const brk of [": ", " (", ", "]) {
    const at = sentence.lastIndexOf(brk, room - 1);
    if (at > 0) return sentence.slice(0, at) + ".";
  }
  return null;
};
const brickDescription = (b, max = 155) => {
  const tail = ` API and measured size (${sizes.find((s) => s.name === b.sizes[0]).gzip} B gzip).`;
  const lead = b.mods[0].summary.replace(/`/g, "").replace(/\s+/g, " ").split(/ (?:\w+ )?- /)[0].trim().replace(/:$/, ".");
  let text = `${b.name}:`;
  for (const [i, sentence] of lead.split(/(?<=\.)\s+/).entries()) {
    const room = max - tail.length - text.length - 1;
    const part = i === 0 || (text + tail).length < 70 ? clip(sentence, room) : sentence.length <= room ? sentence : null;
    if (!part) break;
    text += ` ${part}`;
    if (part !== sentence) break;
  }
  return text + tail;
};
const pages = [
  ["index.html", page({
    title: "Fizlet · Tiny physics for your page",
    description: homeDescription,
    base: "./", version, path: "", ld: [code], body: home({ version, sizes, bundle, bricks, layers, fizz }), scripts: ["site.js", "demo.js", "demos/fizz/main.js"],
  })],
  ["examples/quick-start.html", page({
    title: "Quick start: ten lines to a blast · Fizlet",
    description: "Ten lines to a blast: the Fizlet quick start, running as is. Click the board; scroll it away and the engine pauses, switch tabs and it stops.",
    base: "../", version, path: "examples/quick-start.html", body: quickStartPage({ site: SITE }), scripts: ["site.js"],
  })],
  ["bricks/index.html", page({
    title: "Kernel and bricks: every module and its size · Fizlet",
    description: `Every Fizlet module with its API and its measured size: the kernel is ${(kernel.gzip / 1024).toFixed(1)} KB gzip, each brick its own import.`,
    base: "../", version, path: "bricks/", body: bricksIndex({ bricks, sizes, version }), scripts: ["site.js"],
  })],
  ["gallery/index.html", page({
    title: "Gallery: one prompt, one animation · Fizlet",
    description: `Every Fizlet animation, newest first: the prompt it was made from, the live demo and its size measured on this build (${gallery.entries.length} so far, by Chris Cooley).`,
    base: "../", version, path: "gallery/", body: `<style>${layers.css}</style>` + galleryPage({ entries: gallery.entries, loader: gallery.loader, figures, snippets: make.snippets, base: "../" }), scripts: ["site.js", "gallery/gallery.js"],
  })],
  ["make/index.html", page({
    title: "Make one: a prompt in, a snippet out · Fizlet",
    description: `Type a prompt, get a drop-in Fizlet animation: one file, only the bricks it uses, its size measured in your browser. No server, no tracking.`,
    base: "../", version, path: "make/", body: makePage({ made: defaultSnippet, script: make.script, recipes: Object.keys(MAKE_TABLE.recipes), base: "../" }), scripts: ["site.js", "make/make.js"],
  })],
  ["notes/index.html", page({
    title: "Notes: what the games taught the engine · Fizlet",
    description: `Field notes from building games on Fizlet, newest first: ports, lessons and the numbers behind them, each one measured (${NOTES.length} so far, by Chris Cooley).`,
    base: "../", version, path: "notes/", body: notesIndex({ notes: NOTES, base: "../" }), scripts: ["site.js"],
  })],
  ...NOTES.map((n) => [`${notePath(n)}index.html`, page({
    title: n.seo.title, description: n.seo.description,
    base: "../../", version, path: notePath(n), ld: noteLd(n, { site: SITE, person: PERSON["@id"], website: WEBSITE["@id"] }),
    body: notePage({ note: n, base: "../../", kernel: kernel.gzip }), scripts: ["site.js"],
  })]),
  ...bricks.map((b, i) => [brickPath(b), page({
    title: `${b.name}: API and measured size · Fizlet`,
    description: brickDescription(b),
    base: "../", version, path: brickPath(b),
    ld: [{ "@type": "SoftwareSourceCode", "@id": `${SITE}${brickPath(b)}#code`, name: b.name, description: b.summary, url: SITE + brickPath(b),
      codeRepository: REPO, isPartOf: { "@id": CODE }, author: { "@id": PERSON["@id"] } }],
    body: brickPage({ brick: b, mods: b.mods, sizes, version, prev: bricks[i - 1], next: bricks[i + 1] }),
    scripts: b.demo ? ["site.js", "brick-demo.js"] : ["site.js"],
  })]),
  ["404.html", page({
    title: "Not found: this square is off the board · Fizlet",
    description: "This square is off the board: the page you asked for is not on the Fizlet site.",
    base: ROOT, version, path: "404.html", noindex: true, body: notFound(ROOT), scripts: ["site.js"],
  })],
];
for (const [file, html] of pages) writeFileSync(`${OUT}/${file}`, html);
// Discovery files, from one source: every built page that is indexable (not the 404, not noindex),
// at its canonical URL. Same policy as astro-base-engine `abe site-files --target production`:
// robots.txt admits crawlers (AI crawlers named), sitemap.xml and llms.txt list exactly those pages.
const indexable = readdirSync(OUT, { recursive: true }).map((f) => f.replace(/\\/g, "/"))
  .filter((f) => f.endsWith(".html") && f !== "404.html" && !f.startsWith("dist/"))
  .map((f) => ({ f, html: readFileSync(`${OUT}/${f}`, "utf8"), url: SITE + f.replace(/(^|\/)index\.html$/, "$1") }))
  .sort((a, b) => (a.url < b.url ? -1 : 1))
  .filter((p) => !/<meta name="robots" content="[^"]*noindex/i.test(p.html));
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const meta = (html, re) => unesc(html.match(re)?.[1] ?? "");
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${p.url}</loc></url>`).join("\n")}\n</urlset>\n`);
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot", "meta-externalagent", "Amazonbot", "DuckAssistBot", "MistralAI-User", "cohere-ai"];
const origin = SITE.replace(/\/$/, "");
writeFileSync(`${OUT}/robots.txt`, `# Fizlet — crawl policy: open to reputable crawlers, AI crawlers named explicitly.\n# LLM content map: ${origin}/llms.txt\n\n` +
  [...AI_CRAWLERS, "*"].map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n") + `\n\nSitemap: ${origin}/sitemap.xml\n`);
const group = (p) => (p.f.startsWith("bricks/") && p.f !== "bricks/index.html" ? "Bricks" : p.f.startsWith("notes/") && p.f !== "notes/index.html" ? "Notes" : /^(demos\/|examples\/fizz\/)/.test(p.f) ? "Demos and examples" : "Pages");
const llms = ["# Fizlet", "", `> ${JSON.parse(readFileSync("package.json", "utf8")).description}`, ""];
for (const g of ["Pages", "Notes", "Bricks", "Demos and examples"]) {
  llms.push(`## ${g}`, "");
  for (const p of indexable.filter((x) => group(x) === g))
    llms.push(`- [${meta(p.html, /<title>([^<]*)<\/title>/)}](${p.url}): ${meta(p.html, /<meta name="description" content="([^"]*)"/)}`);
  llms.push("");
}
writeFileSync(`${OUT}/llms.txt`, llms.join("\n").trimEnd() + "\n");
console.log(`Built ${OUT}/: ${pages.length} pages, fizlet.js ${bundle} B gzip, kernel ${kernel.gzip} B gzip`);
