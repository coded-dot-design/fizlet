// Build the website (https://fizlet.com/, site/layout.mjs SITE) into site-dist/: static HTML from
// the template modules in site/, the Board UI kit CSS, the live demo bundled from src/ with
// esbuild, a one-file script-tag build (fizlet.js) and the ESM dist/ for the quick start.
// No framework, no dependencies beyond the repo's dev tools. Run `npm run build` first (npm run site).
import { build, transform } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fillStage, launchFacts } from "./launch-facts.mjs";
import { measure } from "./sizes.mjs";
import { llmsFull } from "./llms-full.mjs";
import { page, mark, esc, fillSiteMap, SITE, ROOT, REPO, PERSON, ORG, WEBSITE, ANALYTICS } from "../site/layout.mjs";
import { home } from "../site/pages/index.mjs";
import { quickStartPage } from "../site/pages/quick-start.mjs";
import { notFound } from "../site/pages/not-found.mjs";
import { brickPage, bricksIndex } from "../site/pages/brick.mjs";
import { archivePage, galleryPage } from "../site/pages/gallery.mjs";
import { notePage, notesIndex, noteLd } from "../site/pages/notes.mjs";
import { notes as loadNotes, notePath } from "./notes.mjs";
import { playFigure } from "../site/pages/index.mjs";
import { buildGallery, personPath } from "./gallery.mjs";
import { buildMake, snippetFor, TABLE as MAKE_TABLE } from "./make.mjs";
import { makePage, DEFAULT_PROMPT } from "../site/pages/make.mjs";
import { AGENT_NOTE, CONTEST, PERSONA_NOTE, canWin, contributors, contestNow, contestWeeks, statsOf } from "./people.mjs";
import { peopleIndex, personPage } from "../site/pages/people.mjs";
import { contestPage } from "../site/pages/contest.mjs";
import { privacyPage, cookiesPage, analyticsNames } from "../site/pages/legal.mjs";
import { BRICKS, PLANNED, STATUS, brickPath } from "../site/bricks.mjs";
import { brickGraph } from "../site/brick-graph.mjs";
import { api } from "./api.mjs";
import { ogImage } from "./og.mjs";
import { liveBytes } from "./live-bytes.mjs";
import { docs as loadDocs, docPath, fill } from "./docs.mjs";
import { docPage, docLd, sectionIndex } from "../site/pages/docs.mjs";
import { releases as loadReleases, releasePath, parse as parseRelease, releaseDescription } from "./releases.mjs";
import { newsIndex, releasePage, releaseLd } from "../site/pages/news.mjs";
import { brickCard, CARDS } from "../site/brick-cards.mjs";
import { buildFactory } from "../site/factory/build.mjs";
import { elements, periodicHero } from "../site/periodic.mjs";
import { symChip } from "../site/brick-ui.mjs";
import { brickStickers, stickerSheet, STICKER_CSS } from "./brick-stickers.mjs";

const OUT = "site-dist";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!existsSync("dist/index.js")) throw new Error("dist/ is missing: run `npm run build` first (or `npm run site`)");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/examples`, { recursive: true });
mkdirSync(`${OUT}/bricks`, { recursive: true });
mkdirSync(`${OUT}/gallery`, { recursive: true });
mkdirSync(`${OUT}/make`, { recursive: true });
for (const d of ["privacy", "cookies"]) mkdirSync(`${OUT}/${d}`, { recursive: true });
const NOTES = loadNotes();
for (const n of NOTES) mkdirSync(`${OUT}/${notePath(n)}`, { recursive: true });
const RELEASES = loadReleases();
for (const r of RELEASES) mkdirSync(`${OUT}/${releasePath(r)}`, { recursive: true });

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
  entryPoints: { demo: "site/demo.ts", site: "site/site.ts", "home-motion": "site/home-motion.ts", "brick-graph": "site/brick-graph.ts", periodic: "site/periodic.ts" },
  outdir: OUT, bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});

// The brick pages' demos: one small loader, and one chunk per demo (a page loads only its own).
const demos = await build({
  entryPoints: { "brick-demo": "site/brick-demo.ts" }, metafile: true,
  outdir: OUT, bundle: true, splitting: true, chunkNames: "chunks/[name]-[hash]", minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});
// Each demo's own chunk (what its page loads for it), for its size badge: { settle: { live, bytes } }.
const demoSizes = {};
for (const [file, o] of Object.entries(demos.metafile.outputs)) {
  const id = o.entryPoint?.match(/^site\/demos\/(\w+)\.ts$/)?.[1];
  if (id) demoSizes[id] = { live: file.slice(OUT.length + 1), bytes: liveBytes(file) };
}
for (const b of BRICKS) if (b.demo && !demoSizes[b.demo]) throw new Error(`brick ${b.id}: no built chunk for demo "${b.demo}"`);
// The brick cards: one loader, one chunk per card (site/cards/), each measured for its badge.
const cardBuild = await build({
  entryPoints: { "brick-cards": "site/brick-cards.ts" }, metafile: true,
  outdir: OUT, bundle: true, splitting: true, chunkNames: "chunks/[name]-[hash]", minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
});
const cardSizes = {};
for (const [file, o] of Object.entries(cardBuild.metafile.outputs)) {
  const id = o.entryPoint?.match(/^site\/cards\/([\w-]+)\.ts$/)?.[1];
  if (id) cardSizes[id] = { live: file.slice(OUT.length + 1), bytes: liveBytes(file) };
}
for (const id of Object.keys(CARDS)) if (!cardSizes[id]) throw new Error(`brick card ${id}: no built chunk`);
// The home page's blast demo and the quick start (the one-file build).
const blast = { live: "demo.js", bytes: liveBytes(`${OUT}/demo.js`) };
const quick = { live: "fizlet.js", bytes: liveBytes(`${OUT}/fizlet.js`) };

cpSync("dist", `${OUT}/dist`, { recursive: true });
// The two stylesheets every page loads, minified (the sources stay readable; esbuild is already the
// build's tool): board-ui.css 8,301 → 4,884 B gzip, site.css 11,530 → 9,091 B (2026-10-30 sources).
const minCss = async (from, to) => writeFileSync(to, (await transform(readFileSync(from, "utf8"), { loader: "css", minify: true })).code);
await minCss("src/ui/board-ui.css", `${OUT}/board-ui.css`);
await minCss("site/site.css", `${OUT}/site.css`);
// The pages' inline <style> blocks (the gallery stages' own CSS, the layers and labs sheets), minified
// the same way once every page is written (below, with the footer's site map): the sources keep
// their comments. Gallery page 1: 57,361 → 55,896 B gzip (2026-10-31).
const minInlineCss = async (html) => {
  const parts = html.split(/(<style>[\s\S]*?<\/style>)/);
  for (let i = 1; i < parts.length; i += 2) parts[i] = `<style>${(await transform(parts[i].slice(7, -8), { loader: "css", minify: true })).code.trimEnd()}</style>`;
  return parts.join("");
};
writeFileSync(`${OUT}/icon.svg`, mark(64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#39ffb0;background:#07060f" '));
writeFileSync(`${OUT}/og.png`, ogImage());
writeFileSync(`${OUT}/.nojekyll`, "");

// The two story demos, each built by its own script: layers (the home hero) and fizz (the name).
// Their markup and sizes come from those builds; the home page embeds them.
await import("../site/demos/layers/build.mjs");
const posterMod = await build({ entryPoints: ["site/demos/layers/poster.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const L = await import("data:text/javascript;base64," + Buffer.from(posterMod.outputFiles[0].text).toString("base64"));
const layers = { figure: L.poster(), css: L.POSTER_CSS, loader: L.loader("./demos/layers/layers.js"), sizes: JSON.parse(readFileSync(`${OUT}/demos/layers/sizes.json`, "utf8")), live: "demos/layers/layers.js" };
const { sizes: fizzSizes } = await import("../site/demos/fizz/build.mjs");
const fizzFigure = readFileSync(`${OUT}/demos/fizz/index.html`, "utf8").match(/<figure class="ae-slot ae-slot--16x10" data-slot-target="fizz#hero"[\s\S]*?<\/figure>/)?.[0];
if (!fizzFigure) throw new Error("demos/fizz/index.html: no fizz figure to embed");
const fizz = { figure: fizzFigure, sizes: fizzSizes, live: "demos/fizz/scene.js" };
// The origin hero (Code. Sleep. Drink. Repeat.): its own page; its home page section is a separate change.
await import("../site/demos/origin/build.mjs");
// The interactive companion to the note "Before AI: 2015": the 2015 sprites beside two Fizlet rebuilds.
await import("../site/demos/before-ai-2015/build.mjs");
// The Origin section (site/origin/): its loader and the scene the slot loads, measured by its build.
const { origin: originHero } = await import("../site/origin/build.mjs");

// The "how it works" labs (site/labs/, the scenes DOM VIRUS's Under the hood vendors): their
// still posters are the gallery figures (each in its own accent), their sheet goes on the page.
const labsMod = await build({ entryPoints: ["site/labs/index.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const LABS = await import("data:text/javascript;base64," + Buffer.from(labsMod.outputFiles[0].text).toString("base64"));
const labFigure = (id, accent, html) =>
  `<figure class="ae-slot gal-lab fzl-host fzl-${accent}" data-slot-target="gallery#lab-${id}" role="img" aria-label="${html.match(/aria-label="([^"]*)"/)[1]}">${html}<span class="ae-slot__placeholder gal-lab-cap" aria-hidden="true">A still poster: the lab runs once it nears the screen.</span></figure>`;
const labs = {
  css: readFileSync("site/labs/labs.css", "utf8"),
  figures: {
    "lab-pool": labFigure("pool", "lime", LABS.poolFigure(true)),
    "lab-recall": labFigure("recall", "violet", LABS.recallFigure(true)),
    "lab-duel": labFigure("duel", "amber", LABS.duelFigure(true)),
    "lab-board": labFigure("board", "cyan", LABS.boardFigure(true)),
    "lab-pipeline": labFigure("pipeline", "amber", LABS.pipelineFigure(true)),
  },
};

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
  ...labs.figures,
};

// The gallery's pages sit at gallery/ and gallery/page/<n>/ (base: the path back to the root);
// every entry's URL is on the page that holds it (the contest and profile pages link there).
const GB = (p) => "../".repeat(p.path.split("/").length - 1);
const urlOf = (id) => gallery.index.find((r) => r.id === id).url;
if (gallery.pending.length) console.log(`Gallery: ${gallery.pending.length} pending (not approved, not built): ${gallery.pending.join(", ")}`);
for (const p of gallery.pages) mkdirSync(`${OUT}/${p.path}`, { recursive: true });
mkdirSync(`${OUT}/gallery/archive`, { recursive: true });
mkdirSync(`${OUT}/heroes`, { recursive: true });
// People and the weekly contest: each contributor's entries and bytes come from the gallery just
// built; contest weeks are checked against it (a week's entries are its dailies, never archived
// ones; a winner within the size cap). The archive goes in so an old "contest" stamp there fails too.
const PEOPLE = contributors();
// The archive goes in too, so an archived entry stamped for a day fails the build (it can't enter).
const WEEKS = contestWeeks([...gallery.entries, ...gallery.archive.entries], PEOPLE);
const winners = new Set(WEEKS.map((w) => w.winner).filter(Boolean));
// Contest entries over the size cap: their gallery cards say "too big to win" too.
const tooBig = new Set(WEEKS.flatMap((w) => w.entries.filter((e) => !canWin(e)).map((e) => e.id)));
const people = PEOPLE.map((p) => ({ person: p, stats: statsOf(p, gallery.entries) }));
// "Today" for the contest page: the build's UTC date (FIZLET_TODAY pins it for a preview or a test).
const TODAY = process.env.FIZLET_TODAY ?? new Date().toISOString().slice(0, 10);
const now = contestNow(WEEKS, TODAY);
for (const p of PEOPLE) mkdirSync(`${OUT}/${personPath(p.id)}`, { recursive: true });
mkdirSync(`${OUT}/contest`, { recursive: true });

const sizes = await measure();
const kernel = sizes[0];
// Recipes (/docs/authoring/): each one bundled as it would ship (fizlet's imports resolved to src/),
// its live bytes measured for its badge; the page runs it and shows it with the hosted imports.
const fizletImports = { name: "fizlet", setup(b) { b.onResolve({ filter: /^@fzlt\/core(\/|$)/ }, (a) => ({ path: `${process.cwd()}/src/${a.path === "@fzlt/core" ? "index" : a.path.slice("@fzlt/core/".length)}.ts` })); } };
const RECIPES = {};
for (const f of readdirSync("site/recipes").filter((x) => x.endsWith(".js"))) {
  const id = f.slice(0, -3);
  await build({ entryPoints: { [id]: `site/recipes/${f}` }, outdir: `${OUT}/recipes`, bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning", plugins: [fizletImports] });
  const src = readFileSync(`site/recipes/${f}`, "utf8");
  RECIPES[id] = {
    html: readFileSync(`site/recipes/${id}.html`, "utf8").trim(), live: `recipes/${id}.js`, bytes: liveBytes(`${OUT}/recipes/${id}.js`),
    imports: [...src.matchAll(/from "(@fzlt\/core(?:\/[\w-]+)?)"/g)].map((m) => m[1]),
    code: src.replace(/from "@fzlt\/core(?:\/([\w-]+))?"/g, (_, sub) => `from "${SITE}dist/${sub ?? "index"}.js"`).trim(),
  };
}
// Docs and guides: their numbers filled in from this build.
const DOCS = loadDocs().map((d) => fill(d, { sizes, version }));
for (const d of DOCS) mkdirSync(`${OUT}/${docPath(d)}`, { recursive: true });
for (const s of ["docs", "guides"]) mkdirSync(`${OUT}/${s}`, { recursive: true });
mkdirSync(`${OUT}/guides/multiplayer-rooms`, { recursive: true }); // moved: redirects to build-your-own-room-server
// Big things, small packages (gallery): its figure and its punchline carry the kernel's gzip size,
// measured just above (never typed). The posters are painted here by the scene's own world.
const spMod = await build({ entryPoints: ["site/gallery/pieces/small-packages/poster.ts"], bundle: true, format: "esm", platform: "node", write: false, logLevel: "warning" });
const SP = await import("data:text/javascript;base64," + Buffer.from(spMod.outputFiles[0].text).toString("base64"));
for (const e of gallery.entries.filter((x) => x.module === "pieces/small-packages/scene.ts")) figures[e.figure] = SP.figure(e, sizes.find((s) => s.name === "@fzlt/core (kernel)").gzip);
// Launch-day pieces (gallery): their stages carry {{…}} slots for numbers measured on this build
// (brick and bundle gzip sizes, the packed tarball, the dependency count): scripts/launch-facts.mjs.
for (const e of gallery.entries.filter((x) => x.stageHtml?.includes("{{"))) e.stageHtml = fillStage(e.stageHtml, await launchFacts());
// Every brick's API, from its source comment and its built declarations; its card, when it has one.
// A brick with no "In short" snippet gets its typechecked example (site/brick-examples/<id>.ts).
const exampleOf = (id) => existsSync(`site/brick-examples/${id}.ts`) ? readFileSync(`site/brick-examples/${id}.ts`, "utf8").split("// ---\n")[1]?.trim() : undefined;
const bricks = BRICKS.map((b) => {
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  const card = (where) => (CARDS[b.id] ? brickCard({ brick: b, bytes: sizes.find((s) => s.name === b.sizes[0]).gzip, card: cardSizes[b.id], where }) : "");
  return { ...b, mods, card, example: b.snippet ? undefined : exampleOf(b.id), summary: mods[0].summary.match(/^.*?\.(?=\s|$)/)?.[0] ?? mods[0].summary };
});
// The FILET factory (site/factory/), a small animation section on /bricks/ between the sticker sheet
// and the bricks index (never the page's last section: scrolled to the end, its foot would sit under
// the sticky header, still intersecting, and play there): its bricks' sizes from this build.
const factory = await buildFactory({ out: OUT, base: "../", bricks: BRICKS, sizes, version });
// The periodic table, the hero of /bricks/ (site/periodic.mjs): every brick and planned brick, sizes
// from this build; its script's gzip bytes measured here. One sticker per brick, written as SVG
// downloads and shown on the page from the same files (scripts/brick-stickers.mjs).
const ELEMENTS = elements({ bricks, planned: PLANNED, sizes });
const periodic = periodicHero({ els: ELEMENTS, version, js: { live: "periodic.js", bytes: liveBytes(`${OUT}/periodic.js`) } });
const STICKERS = brickStickers(ELEMENTS);
mkdirSync(`${OUT}/bricks/stickers`, { recursive: true });
for (const s of STICKERS) writeFileSync(`${OUT}/bricks/stickers/${s.file}`, s.svg);
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
    base: "./", version, path: "", ld: [code], body: home({ version, sizes, bundle, bricks, layers, fizz, blast, origin: originHero }), scripts: ["site.js", "home-motion.js", "demo.js", "demos/fizz/main.js", "origin/main.js"],
  })],
  // Privacy and Cookies (pending legal review; site/pages/legal.mjs).
  ["privacy/index.html", page({
    title: "Privacy policy: analytics only with consent · Fizlet",
    description: `What fizlet.com collects, why and for how long: ${analyticsNames(ANALYTICS) ? `consent-based ${analyticsNames(ANALYTICS)}` : "no analytics"}, hosting logs, and how to opt out. No ads, no selling data.`,
    base: "../", version, path: "privacy/", body: privacyPage({ base: "../", analytics: ANALYTICS }), scripts: ["site.js"],
  })],
  ["cookies/index.html", page({
    title: "Cookies and storage: none until you say yes · Fizlet",
    description: "Every cookie and storage key fizlet.com may use, what each holds, how long it lasts, and how to change your choice or clear them.",
    base: "../", version, path: "cookies/", body: cookiesPage({ base: "../", analytics: ANALYTICS }), scripts: ["site.js"],
  })],
  ["examples/quick-start.html", page({
    title: "Quick start: ten lines to a blast · Fizlet",
    description: "Ten lines to a blast: the Fizlet quick start, running as is. Click the board; scroll it away and the engine pauses, switch tabs and it stops.",
    base: "../", version, path: "examples/quick-start.html", body: quickStartPage({ site: SITE, quick }), scripts: ["site.js"],
  })],
  ["bricks/index.html", page({
    title: "Kernel and bricks: every module and its size · Fizlet",
    description: `Every Fizlet module with its API and its measured size: the kernel is ${(kernel.gzip / 1024).toFixed(1)} KB gzip, each brick its own import.`,
    base: "../", version, path: "bricks/", body: `<style>${periodic.css}${STICKER_CSS}${factory.css}</style>${periodic.html}${stickerSheet(STICKERS, { esc })}${factory.html}` + bricksIndex({ bricks, sizes, version, planned: PLANNED, graph: { ...brickGraph(BRICKS, PLANNED, STATUS), live: "brick-graph.js", bytes: liveBytes(`${OUT}/brick-graph.js`) } }), scripts: ["site.js", "periodic.js", "brick-cards.js", "brick-graph.js"],
  })],
  // The gallery: PAGE_SIZE entries a page (gallery/, gallery/page/2/, …), in theme sections.
  ...gallery.pages.map((p) => [`${p.path}index.html`, page({
    title: p.n === 1 ? "Daily: tiny examples, made every day · Fizlet" : `Daily, page ${p.n}: tiny examples, made every day · Fizlet`,
    description: p.n === 1
      ? `Tiny Fizlet examples, made every day to test the engine, now a contest: ${gallery.entries.length} so far, each live with its size measured on this build.`
      : `Fizlet Daily page ${p.n} of ${gallery.pages.length}: older tiny examples by theme, each with its brief, its live demo and its size measured on this build.`,
    base: GB(p), version, path: p.path,
    body: `<style>${layers.css}${labs.css}</style>` + galleryPage({ page: p, pages: gallery.pages, all: gallery.entries, themes: gallery.themes, people: gallery.people, loader: gallery.loader, figures, snippets: make.snippets, base: GB(p), winners, tooBig, archived: gallery.archive.entries.length, contributors: PEOPLE, week: now?.week, today: TODAY }),
    scripts: ["site.js", "gallery/gallery.js", "gallery/browse.js"],
  })]),
  ["gallery/archive/index.html", page({
    title: "Gallery archive: earlier runs, kept to revisit · Fizlet",
    description: `Earlier Fizlet factory animations taken off the gallery (${gallery.archive.entries.length}), kept to revisit, each with its size measured on this build.`,
    base: "../../", version, path: "gallery/archive/", noindex: true, nofollow: true,
    body: `<style>${layers.css}</style>` + archivePage({ entries: gallery.archive.entries, themes: gallery.archive.themes, people: gallery.people, loader: gallery.loader, figures, base: "../../" }),
    scripts: ["site.js", "gallery/gallery.js"],
  })],
  // /heroes/ is archived: it redirects to Daily (the gallery), where every hero is an entry.
  ["heroes/index.html", page({
    title: "Heroes moved to Daily · Fizlet",
    description: "The Fizlet heroes page has moved: every hero animation is an entry on Daily, the gallery, with its size measured on this build.",
    base: "../", version, path: "heroes/", redirect: "gallery/",
    body: `<section class="section"><div class="wrap"><div class="section-head"><h1>Heroes moved to <em>Daily</em>.</h1><p class="lead">Every hero is an entry on <a href="../gallery/">Daily, the gallery</a>. Taking you there now.</p></div></div></section>`,
    scripts: ["site.js"],
  })],
  // /guides/multiplayer-rooms/ moved (2026-10-31: multiplayer is in-house; the room server left this
  // repo): it redirects to the guide that replaced it.
  ["guides/multiplayer-rooms/index.html", page({
    title: "Multiplayer rooms moved: build your own room server · Fizlet",
    description: "The Fizlet multiplayer rooms guide has moved: Build your own room server specs the wire protocol @fzlt/core/presence speaks, so you can run one like ours.",
    base: "../../", version, path: "guides/multiplayer-rooms/", redirect: "guides/build-your-own-room-server/",
    body: `<section class="section"><div class="wrap"><nav class="bp-crumbs" aria-label="Breadcrumb"><a href="../../">Fizlet</a> / <a href="../">Guides</a> / <span aria-current="page">Multiplayer rooms (moved)</span></nav><div class="section-head"><h1>This guide moved to <em>Build your own room server</em>.</h1><p class="lead">Our room server is in-house now. <a href="../build-your-own-room-server/">Build your own room server</a> has the wire protocol presence speaks. Taking you there now.</p></div></div></section>`,
    scripts: ["site.js"],
  })],
  ["make/index.html", page({
    title: "Make one: a prompt in, a snippet out · Fizlet",
    description: `Type a prompt, get a drop-in Fizlet animation: one file, only the bricks it uses, its size measured in your browser. No server, no tracking.`,
    base: "../", version, path: "make/", body: makePage({ made: defaultSnippet, script: make.script, recipes: Object.keys(MAKE_TABLE.recipes), base: "../" }), scripts: ["site.js", "make/make.js"],
  })],
  ["people/index.html", page({
    title: "People: the maker, AI agents and studio crew · Fizlet",
    description: `Who makes Fizlet animations: Chris Cooley, ${PEOPLE.filter((p) => p.kind === "persona").length} studio crew (Fizlet characters, not real people) and the team's AI agents, with their entries and bytes.`,
    base: "../", version, path: "people/", body: peopleIndex({ rows: people, base: "../" }), scripts: ["site.js"],
  })],
  ...people.map(({ person: p, stats }) => [`${personPath(p.id)}index.html`, page({
    title: `${p.name}: ${{ owner: "maker of Fizlet", persona: "studio crew", agent: "an AI agent on the team" }[p.kind]} · Fizlet`,
    description: p.description,
    base: "../../", version, path: personPath(p.id),
    ld: [{ "@type": "ProfilePage", "@id": `${SITE}${personPath(p.id)}#page`, url: SITE + personPath(p.id), name: p.name,
      ...(p.kind === "owner" ? { mainEntity: { "@id": PERSON["@id"] } } : { about: { "@type": "Thing", name: p.name, description: `${p.kind === "agent" ? AGENT_NOTE : PERSONA_NOTE}. ${p.bio}` } }) }],
    body: personPage({ person: p, stats, base: "../../", urlOf, wins: winners, people: PEOPLE }), scripts: ["site.js"],
  })]),
  ["contest/index.html", page({
    title: "Daily contest: top picks, weekly winners · Fizlet",
    description: `The Fizlet Daily contest: up to ${CONTEST.perDay} entries a day, the top ${CONTEST.picks[0]} to ${CONTEST.picks[1]} picked, a weekly and a monthly winner; over ${CONTEST.maxLive.toLocaleString("en-US")} B live can't win.`,
    base: "../", version, path: "contest/", body: contestPage({ now, weeks: WEEKS, people: PEOPLE, base: "../", urlOf }), scripts: ["site.js"],
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
  ["docs/index.html", page({
    title: "Docs: the contract, the loop, Recall, budgets · Fizlet",
    description: `How the Fizlet DOM game engine works: getting started, the nine-rule contract, the loop, Recall, size budgets and determinism, with numbers from v${version}.`,
    base: "../", version, path: "docs/", ld: [{ "@type": "CollectionPage", "@id": `${SITE}docs/#page`, url: `${SITE}docs/`, name: "Fizlet docs", isPartOf: { "@id": WEBSITE["@id"] }, about: { "@id": CODE } }],
    body: sectionIndex({ section: "docs", all: DOCS, base: "../", head: { eyebrow: "DOCS · READ IN ORDER", title: "How it works.", accent: "Each claim tested.", lead: "Fizlet is a micro game and animation engine for the DOM. Start with the five-minute setup, then the ideas everything else rests on: the contract, the loop, Recall, the budgets and determinism. Every brick's API is in [Bricks](/bricks/)." } }),
    scripts: ["site.js"],
  })],
  ["guides/index.html", page({
    title: "Guides: build with Fizlet, step by step · Fizlet",
    description: "Step-by-step Fizlet guides: build a micro game, fill an Astro slot with a scene, port a game onto the kernel and build your own lockstep room server.",
    base: "../", version, path: "guides/", ld: [{ "@type": "CollectionPage", "@id": `${SITE}guides/#page`, url: `${SITE}guides/`, name: "Fizlet guides", isPartOf: { "@id": WEBSITE["@id"] }, about: { "@id": CODE } }],
    body: sectionIndex({ section: "guides", all: DOCS, base: "../", head: { eyebrow: "GUIDES · ONE JOB EACH", title: "Build something.", accent: "Ship it small.", lead: "Each guide does one job end to end with real code: the APIs on the [brick pages](/bricks/), the ideas in the [docs](/docs/)." } }),
    scripts: ["site.js"],
  })],
  ...DOCS.map((d) => [`${docPath(d)}index.html`, page({
    title: d.seo.title, description: d.seo.description,
    base: "../../", version, path: docPath(d), ld: docLd(d, { site: SITE, person: PERSON["@id"], website: WEBSITE["@id"], code: CODE }),
    body: docPage({ doc: d, all: DOCS, base: "../../", sizes, bricks, recipes: RECIPES }),
    scripts: ["site.js", ...d.blocks.filter((b) => b.type === "recipe").map((b) => RECIPES[b.id].live)],
  })]),
  ["news/index.html", page({
    title: "News: every Fizlet release, newest first · Fizlet",
    description: `Release notes for all ${RELEASES.length} Fizlet versions, newest first, from the changelog: new bricks, fixes and the sizes measured when each shipped.`,
    base: "../", version, path: "news/", body: newsIndex({ releases: RELEASES, announcements: NOTES.filter((n) => n.type === "news"), base: "../" }), scripts: ["site.js"],
  })],
  ...RELEASES.map((r, i) => {
    const description = releaseDescription(r, parseRelease(r.md));
    return [`${releasePath(r)}index.html`, page({
      title: `Fizlet ${r.version} release notes · Fizlet`, description,
      base: "../../", version, path: releasePath(r), ld: releaseLd(r, { site: SITE, person: PERSON["@id"], website: WEBSITE["@id"], code: CODE, description }),
      body: releasePage({ release: r, prev: RELEASES[i - 1], next: RELEASES[i + 1], base: "../../", latest: version }), scripts: ["site.js"],
    })];
  }),
  ...bricks.map((b, i) => [brickPath(b), page({
    title: `${b.name}: API and measured size · Fizlet`,
    description: brickDescription(b),
    base: "../", version, path: brickPath(b),
    ld: [{ "@type": "SoftwareSourceCode", "@id": `${SITE}${brickPath(b)}#code`, name: b.name, description: b.summary, url: SITE + brickPath(b),
      codeRepository: REPO, isPartOf: { "@id": CODE }, author: { "@id": PERSON["@id"] } }],
    body: brickPage({ brick: b, mods: b.mods, sizes, version, prev: bricks[i - 1], next: bricks[i + 1], demoSize: b.demo && demoSizes[b.demo] }),
    scripts: ["site.js", ...(b.demo ? ["brick-demo.js"] : []), ...(CARDS[b.id] ? ["brick-cards.js"] : [])],
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
const unescTitle = (html) => unesc(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").split(/:| · /)[0];
// The footer's site map, from the same list (site/layout.mjs siteMap): every page's footer marker
// is filled once all pages exist, so a new page is in every footer on the next build. Order: the
// order pages are built in above (docs in reading order, releases newest first), then the rest.
// Labels: the short name a section's data gives a page, else its title up to the first ":" or " · ".
const routeOf = (f) => f.replace(/(^|\/)index\.html$/, "$1");
const LABEL = new Map([
  ...DOCS.map((d) => [docPath(d), d.nav]), ...NOTES.map((n) => [notePath(n), n.title]), ...RELEASES.map((r) => [releasePath(r), r.version]),
  ...bricks.map((b) => [brickPath(b), b.id]), ...gallery.pages.slice(1).map((p) => [p.path, `Page ${p.n}`]), ...PEOPLE.map((p) => [personPath(p.id), p.name]),
  ["", "Home"], ["examples/quick-start.html", "Quick start"], ["privacy/", "Privacy"], ["cookies/", "Cookies"], ["demos/layers/", "The layers story"], ["demos/fizz/", "The fizz proof piece"], ["demos/before-ai-2015/", "Before AI: 2015, live"], ["demos/origin/", "The origin hero"], ["examples/fizz/", "The fizz hero example"],
]);
const built = pages.map(([f]) => routeOf(f));
const order = (r) => (built.includes(r) ? built.indexOf(r) : built.length);
// A brick's page is a symbol chip in the footer (its name on hover and focus, and as its accessible name).
const CHIP = new Map(bricks.map((b) => [brickPath(b), (href, attrs) => symChip(b, href, b.id, attrs)]));
const routes = indexable.map((p) => ({ path: routeOf(p.f), label: LABEL.get(routeOf(p.f)) ?? unescTitle(p.html), chip: CHIP.get(routeOf(p.f)) }))
  .sort((a, b) => order(a.path) - order(b.path));
for (const f of readdirSync(OUT, { recursive: true }).map((x) => x.replace(/\\/g, "/")).filter((x) => x.endsWith(".html") && !x.startsWith("dist/"))) {
  const html = readFileSync(`${OUT}/${f}`, "utf8"), filled = await minInlineCss(fillSiteMap(html, routes));
  if (filled !== html) writeFileSync(`${OUT}/${f}`, filled);
}
const meta = (html, re) => unesc(html.match(re)?.[1] ?? "");
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${p.url}</loc></url>`).join("\n")}\n</urlset>\n`);
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot", "meta-externalagent", "Amazonbot", "DuckAssistBot", "MistralAI-User", "cohere-ai"];
const origin = SITE.replace(/\/$/, "");
writeFileSync(`${OUT}/robots.txt`, `# Fizlet — crawl policy: open to reputable crawlers, AI crawlers named explicitly.\n# LLM content map: ${origin}/llms.txt\n\n` +
  [...AI_CRAWLERS, "*"].map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n") + `\n\nSitemap: ${origin}/sitemap.xml\n`);
const sub = (dir) => (p) => p.f.startsWith(dir) && p.f !== `${dir}index.html`;
const GROUPS = [["Docs", sub("docs/")], ["Guides", sub("guides/")], ["Bricks", sub("bricks/")], ["Notes", sub("notes/")], ["Release notes", sub("news/")], ["Demos and examples", (p) => /^(demos\/|examples\/fizz\/)/.test(p.f)]];
const group = (p) => GROUPS.find(([, is]) => is(p))?.[0] ?? "Pages";
const llms = ["# Fizlet", "", `> ${JSON.parse(readFileSync("package.json", "utf8")).description}`, ""];
for (const g of ["Pages", ...GROUPS.map(([g]) => g)]) {
  llms.push(`## ${g}`, "");
  for (const p of indexable.filter((x) => group(x) === g))
    llms.push(`- [${meta(p.html, /<title>([^<]*)<\/title>/)}](${p.url}): ${meta(p.html, /<meta name="description" content="([^"]*)"/)}`);
  llms.push("");
}
// llms-full.txt: the whole API in plain text, from the declarations the brick pages use; llms.txt
// points to it in its opening text (its link lists are the indexable pages only).
writeFileSync(`${OUT}/llms-full.txt`, llmsFull({ bricks, sizes, version, site: SITE, description: JSON.parse(readFileSync("package.json", "utf8")).description }));
llms.splice(llms.findIndex((l) => l.startsWith("## ")), 0, `The whole API, every export of every brick with its signature, doc comment and status, in plain text: [llms-full.txt](${SITE}llms-full.txt)`, "");
writeFileSync(`${OUT}/llms.txt`, llms.join("\n").trimEnd() + "\n");
console.log(`Built ${OUT}/: ${pages.length} pages, fizlet.js ${bundle} B gzip, kernel ${kernel.gzip} B gzip`);
