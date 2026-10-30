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
import { archivePage, galleryPage } from "../site/pages/gallery.mjs";
import { heroesPage } from "../site/pages/heroes.mjs";
import { notePage, notesIndex, noteLd } from "../site/pages/notes.mjs";
import { notes as loadNotes, notePath } from "./notes.mjs";
import { playFigure } from "../site/pages/index.mjs";
import { buildGallery, personPath } from "./gallery.mjs";
import { PERSONA_NOTE, contributors, contestDays, contestToday, statsOf } from "./people.mjs";
import { peopleIndex, personPage } from "../site/pages/people.mjs";
import { contestPage } from "../site/pages/contest.mjs";
import { BRICKS, brickPath } from "../site/bricks.mjs";
import { api } from "./api.mjs";
import { ogImage } from "./og.mjs";
import { liveBytes } from "./live-bytes.mjs";
import { docs as loadDocs, docPath, fill } from "./docs.mjs";
import { docPage, docLd, sectionIndex } from "../site/pages/docs.mjs";
import { releases as loadReleases, releasePath, parse as parseRelease, releaseDescription } from "./releases.mjs";
import { newsIndex, releasePage, releaseLd } from "../site/pages/news.mjs";

const OUT = "site-dist";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!existsSync("dist/index.js")) throw new Error("dist/ is missing: run `npm run build` first (or `npm run site`)");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/examples`, { recursive: true });
mkdirSync(`${OUT}/bricks`, { recursive: true });
mkdirSync(`${OUT}/gallery`, { recursive: true });
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
  entryPoints: { demo: "site/demo.ts", site: "site/site.ts" },
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
// The home page's blast demo and the quick start (the one-file build).
const blast = { live: "demo.js", bytes: liveBytes(`${OUT}/demo.js`) };
const quick = { live: "fizlet.js", bytes: liveBytes(`${OUT}/fizlet.js`) };

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
const layers = { figure: L.poster(), css: L.POSTER_CSS, loader: L.loader("./demos/layers/layers.js"), sizes: JSON.parse(readFileSync(`${OUT}/demos/layers/sizes.json`, "utf8")), live: "demos/layers/layers.js" };
const { sizes: fizzSizes } = await import("../site/demos/fizz/build.mjs");
const fizzFigure = readFileSync(`${OUT}/demos/fizz/index.html`, "utf8").match(/<figure class="ae-slot ae-slot--16x10" data-slot-target="fizz#hero"[\s\S]*?<\/figure>/)?.[0];
if (!fizzFigure) throw new Error("demos/fizz/index.html: no fizz figure to embed");
const fizz = { figure: fizzFigure, sizes: fizzSizes, live: "demos/fizz/scene.js" };

// The gallery: one bundle per entry, each measured here (its size badge). The story demos keep
// their own posters as their figures; the blast demo waits in a <template> until its slot mounts.
const gallery = await buildGallery(OUT);
const figures = {
  layers: L.poster("gallery#layers"),
  fizz: fizzFigure.replace('data-slot-target="fizz#hero"', 'data-slot-target="gallery#fizz"').replace('<figure class="ae-slot ae-slot--16x10"', '<figure class="ae-slot ae-slot--16x10 gal-fig"'),
  howitworks: `<figure class="ae-slot ae-slot--4x5 gal-fig gal-tall" data-slot-target="gallery#howitworks" role="img" aria-label="The blast demo: a small page you can knock around; Recall puts it back."><span class="ae-slot__placeholder gal-still" aria-hidden="true">“Hello, page.” Every letter is a real element.</span><template>${playFigure()}</template></figure>`,
};

// The gallery's pages sit at gallery/ and gallery/page/<n>/ (base: the path back to the root);
// every entry's URL is on the page that holds it (the heroes and profile pages link there).
const GB = (p) => "../".repeat(p.path.split("/").length - 1);
const urlOf = (id) => gallery.index.find((r) => r.id === id).url;
const heroes = gallery.entries.filter((e) => e.kind === "hero");
for (const p of gallery.pages) mkdirSync(`${OUT}/${p.path}`, { recursive: true });
mkdirSync(`${OUT}/gallery/archive`, { recursive: true });
mkdirSync(`${OUT}/heroes`, { recursive: true });
// People and the daily contest: each contributor's entries and bytes come from the gallery just
// built; contest days are checked against it (prompt length, one entry per person per day, winner).
const PEOPLE = contributors();
const DAYS = contestDays(gallery.entries, PEOPLE);
const winners = new Set(DAYS.map((d) => d.winner).filter(Boolean));
const people = PEOPLE.map((p) => ({ person: p, stats: statsOf(p, gallery.entries) }));
// "Today" for the contest page: the build's UTC date (FIZLET_TODAY pins it for a preview or a test).
const today = contestToday(DAYS, process.env.FIZLET_TODAY);
for (const p of PEOPLE) mkdirSync(`${OUT}/${personPath(p.id)}`, { recursive: true });
mkdirSync(`${OUT}/contest`, { recursive: true });

const sizes = await measure();
const kernel = sizes[0];
// Docs and guides: their numbers filled in from this build.
const DOCS = loadDocs().map((d) => fill(d, { sizes, version }));
for (const d of DOCS) mkdirSync(`${OUT}/${docPath(d)}`, { recursive: true });
for (const s of ["docs", "guides"]) mkdirSync(`${OUT}/${s}`, { recursive: true });
// Every brick's API, from its source comment and its built declarations.
// A brick with no "In short" snippet gets its typechecked example (site/brick-examples/<id>.ts).
const exampleOf = (id) => existsSync(`site/brick-examples/${id}.ts`) ? readFileSync(`site/brick-examples/${id}.ts`, "utf8").split("// ---\n")[1]?.trim() : undefined;
const bricks = BRICKS.map((b) => {
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  return { ...b, mods, example: b.snippet ? undefined : exampleOf(b.id), summary: mods[0].summary.match(/^.*?\.(?=\s|$)/)?.[0] ?? mods[0].summary };
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
    base: "./", version, path: "", ld: [code], body: home({ version, sizes, bundle, bricks, layers, fizz, blast }), scripts: ["site.js", "demo.js", "demos/fizz/main.js"],
  })],
  ["examples/quick-start.html", page({
    title: "Quick start: ten lines to a blast · Fizlet",
    description: "Ten lines to a blast: the Fizlet quick start, running as is. Click the board; scroll it away and the engine pauses, switch tabs and it stops.",
    base: "../", version, path: "examples/quick-start.html", body: quickStartPage({ site: SITE, quick }), scripts: ["site.js"],
  })],
  ["bricks/index.html", page({
    title: "Kernel and bricks: every module and its size · Fizlet",
    description: `Every Fizlet module with its API and its measured size: the kernel is ${(kernel.gzip / 1024).toFixed(1)} KB gzip, each brick its own import.`,
    base: "../", version, path: "bricks/", body: bricksIndex({ bricks, sizes, version }), scripts: ["site.js"],
  })],
  // The gallery: PAGE_SIZE entries a page (gallery/, gallery/page/2/, …), in theme sections.
  ...gallery.pages.map((p) => [`${p.path}index.html`, page({
    title: p.n === 1 ? "Gallery: one prompt, one animation · Fizlet" : `Gallery, page ${p.n}: one prompt, one animation · Fizlet`,
    description: p.n === 1
      ? `Every Fizlet animation, newest first: the prompt it was made from, the live demo and its size measured on this build (${gallery.entries.length} so far, by theme).`
      : `Fizlet gallery page ${p.n} of ${gallery.pages.length}: older animations by theme, each with its prompt, its live demo and its size measured on this build.`,
    base: GB(p), version, path: p.path,
    body: `<style>${layers.css}</style>` + galleryPage({ page: p, pages: gallery.pages, all: gallery.entries, themes: gallery.themes, people: gallery.people, loader: gallery.loader, figures, base: GB(p), winners, archived: gallery.archive.entries.length }),
    scripts: ["site.js", "gallery/gallery.js", "gallery/browse.js"],
  })]),
  ["gallery/archive/index.html", page({
    title: "Gallery archive: earlier runs, kept to revisit · Fizlet",
    description: `Earlier Fizlet factory animations taken off the gallery (${gallery.archive.entries.length}), kept to revisit, each with its size measured on this build.`,
    base: "../../", version, path: "gallery/archive/", noindex: true,
    body: `<style>${layers.css}</style>` + archivePage({ entries: gallery.archive.entries, themes: gallery.archive.themes, people: gallery.people, loader: gallery.loader, figures, base: "../../" }),
    scripts: ["site.js", "gallery/gallery.js"],
  })],
  ["heroes/index.html", page({
    title: "Heroes: the big animations, one at a time · Fizlet",
    description: `The Fizlet hero animations, large: the one in the centre plays, the rest wait as posters. ${heroes.length} so far, each with its size measured on this build.`,
    base: "../", version, path: "heroes/",
    body: `<style>${layers.css}</style>` + heroesPage({ heroes, themes: gallery.themes, people: gallery.people, loader: gallery.loader, figures, base: "../", urlOf }),
    scripts: ["site.js", "gallery/heroes.js"],
  })],
  ["people/index.html", page({
    title: "People: the maker and the house personas · Fizlet",
    description: `Who makes Fizlet animations: Chris Cooley, and ${PEOPLE.length - 1} house personas (Fizlet characters, not real people), with their entries and bytes.`,
    base: "../", version, path: "people/", body: peopleIndex({ rows: people, base: "../" }), scripts: ["site.js"],
  })],
  ...people.map(({ person: p, stats }) => [`${personPath(p.id)}index.html`, page({
    title: `${p.name}: ${p.kind === "owner" ? "maker of Fizlet" : "a house persona"} · Fizlet`,
    description: p.description,
    base: "../../", version, path: personPath(p.id),
    ld: [{ "@type": "ProfilePage", "@id": `${SITE}${personPath(p.id)}#page`, url: SITE + personPath(p.id), name: p.name,
      ...(p.kind === "owner" ? { mainEntity: { "@id": PERSON["@id"] } } : { about: { "@type": "Thing", name: p.name, description: `${PERSONA_NOTE}. ${p.bio}` } }) }],
    body: personPage({ person: p, stats, base: "../../", urlOf, wins: winners }), scripts: ["site.js"],
  })]),
  ["contest/index.html", page({
    title: "Daily contest: 60 characters, one animation · Fizlet",
    description: "The Fizlet daily contest: a theme a day, a prompt of 60 characters or fewer, one entry each, one winner featured in the gallery.",
    base: "../", version, path: "contest/", body: contestPage({ today, days: DAYS, people: PEOPLE, base: "../", urlOf }), scripts: ["site.js"],
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
    description: "Step-by-step Fizlet guides: build a micro game, fill an Astro slot with a scene, port a game onto the kernel and run lockstep multiplayer rooms.",
    base: "../", version, path: "guides/", ld: [{ "@type": "CollectionPage", "@id": `${SITE}guides/#page`, url: `${SITE}guides/`, name: "Fizlet guides", isPartOf: { "@id": WEBSITE["@id"] }, about: { "@id": CODE } }],
    body: sectionIndex({ section: "guides", all: DOCS, base: "../", head: { eyebrow: "GUIDES · ONE JOB EACH", title: "Build something.", accent: "Ship it small.", lead: "Each guide does one job end to end with real code: the APIs on the [brick pages](/bricks/), the ideas in the [docs](/docs/)." } }),
    scripts: ["site.js"],
  })],
  ...DOCS.map((d) => [`${docPath(d)}index.html`, page({
    title: d.seo.title, description: d.seo.description,
    base: "../../", version, path: docPath(d), ld: docLd(d, { site: SITE, person: PERSON["@id"], website: WEBSITE["@id"], code: CODE }),
    body: docPage({ doc: d, all: DOCS, base: "../../", sizes, bricks }), scripts: ["site.js"],
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
writeFileSync(`${OUT}/llms.txt`, llms.join("\n").trimEnd() + "\n");
console.log(`Built ${OUT}/: ${pages.length} pages, fizlet.js ${bundle} B gzip, kernel ${kernel.gzip} B gzip`);
