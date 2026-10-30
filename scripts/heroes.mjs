// The heroes (fizlet.com/heroes/): the games' own landing heroes, from site/heroes/heroes.json (the
// allow-list: only these render on /heroes/; a gallery entry never does, whatever its kind). Each is
// vendored from its game repo at a pinned commit (scripts/heroes-vendor.mjs, site/heroes/vendor/<id>/)
// and built here into site-dist/heroes/<id>/: stage.html (the hero's own markup and CSS, alone in
// its own document), stage.js (site/heroes/<id>.ts: the scene, on this build of Fizlet) and the
// posters. Every size is measured here: `live` is stage.js and its static imports, gzipped (the
// badge); `doc` is the stage document (markup and CSS), gzipped.
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { liveBytes } from "./live-bytes.mjs";

const DIR = "site/heroes";
/** Fizlet's hero budget, for scenes made for fizlet.com (the games' own heroes are measured against it, not held to it). */
export const HERO_BUDGET = 9728;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The heroes, checked: config, vendored files present and unchanged since the vendor script wrote them. */
export function heroes() {
  const { heroes: list } = JSON.parse(readFileSync(`${DIR}/heroes.json`, "utf8"));
  const ids = new Set();
  for (const h of list) {
    for (const k of ["id", "title", "line", "about", "game", "repo", "commit", "origin", "section"]) if (!h[k]) throw new Error(`site/heroes/heroes.json: ${h.id ?? "?"} has no ${k}`);
    if (ids.has(h.id)) throw new Error(`site/heroes/heroes.json: ${h.id} twice`);
    ids.add(h.id);
    if (!/^[0-9a-f]{40}$/.test(h.commit)) throw new Error(`${h.id}: commit is a full sha (pinned), not ${h.commit}`);
    if (!existsSync(`${DIR}/${h.id}.ts`)) throw new Error(`${h.id}: no stage script ${DIR}/${h.id}.ts`);
    const o = JSON.parse(readFileSync(`${DIR}/vendor/${h.id}/ORIGIN.json`, "utf8"));
    if (o.commit !== h.commit || o.repo !== `https://github.com/${h.repo}`) throw new Error(`${h.id}: vendored from ${o.repo}@${o.commit}, pinned to ${h.repo}@${h.commit}: run node scripts/heroes-vendor.mjs ${h.id}`);
    for (const [f, sum] of Object.entries(o.files)) {
      const got = createHash("sha256").update(readFileSync(`${DIR}/vendor/${h.id}/${f}`)).digest("hex");
      if (got !== sum) throw new Error(`site/heroes/vendor/${h.id}/${f} was edited by hand (sha256 differs from ORIGIN.json): run node scripts/heroes-vendor.mjs ${h.id}`);
    }
  }
  return list;
}

/** The stage document: the hero's own section and CSS, alone; fizlet.com's head (noindex: it is a part of /heroes/). */
export function stageHtml(h, { site, path, css, section, htmlClass, extraCss }) {
  const title = `${h.title}: its own hero, on Fizlet`;
  const description = `${h.title}'s own landing hero (${h.line}), vendored from ${h.repo} at ${h.commit.slice(0, 7)} and running on Fizlet: the stage the heroes page mounts.`;
  return `<!doctype html>
<html lang="en" class="${esc(htmlClass)}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${site}${path}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${site}${path}"><meta property="og:image" content="${site}og.png"><meta property="og:site_name" content="Fizlet">
<script>try{var t=localStorage.getItem("dom-virus:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;var p=parent!==window&&parent.document.documentElement.dataset.theme;if(p)document.documentElement.dataset.theme=p}catch(e){}</script>
<style>${css}</style>
<style>html{touch-action:manipulation}html,body{margin:0;min-height:100%;overflow-x:hidden}main.fz-stage{display:block;min-height:100vh}main.fz-stage>section{min-height:100vh;min-width:0;margin:0}${extraCss}</style>
</head>
<body>
<main class="fz-stage">
${section}</main>
<script type="module" src="stage.js"></script>
</body>
</html>
`;
}

/** Build every hero into `out`/heroes/<id>/; returns them with their measured sizes. */
export async function buildHeroes(out, { site }) {
  const list = heroes();
  for (const h of list) {
    const dir = join(out, "heroes", h.id), v = `${DIR}/vendor/${h.id}`;
    mkdirSync(dir, { recursive: true });
    // The vendored game build (Blitz) stays its own file, byte for byte, next to the stage script.
    const external = { name: "vendored-build", setup(b) { b.onResolve({ filter: /\/vendor\/[^/]+\/[^/]+\.mjs$/ }, (a) => ({ path: "./" + a.path.split("/").pop(), external: true })); } };
    await build({ entryPoints: { stage: `${DIR}/${h.id}.ts` }, outdir: dir, bundle: true, splitting: true, chunkNames: "[name]-[hash]", minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning", plugins: [external] });
    for (const f of Object.keys(h.copy)) if (f.endsWith(".mjs")) copyFileSync(`${v}/${f}`, join(dir, f));
    for (const f of ["poster-dark.jpg", "poster-light.jpg"]) copyFileSync(`${v}/${f}`, join(dir, f));
    const path = `heroes/${h.id}/stage.html`;
    const html = stageHtml(h, {
      site, path,
      css: readFileSync(`${v}/section.css`, "utf8").trim(),
      section: readFileSync(`${v}/section.html`, "utf8"),
      htmlClass: JSON.parse(readFileSync(`${v}/html.json`, "utf8")).class,
      extraCss: existsSync(`${DIR}/${h.id}.css`) ? readFileSync(`${DIR}/${h.id}.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim() : "",
    });
    writeFileSync(join(dir, "stage.html"), html);
    h.path = path;
    h.live = liveBytes(join(dir, "stage.js"));
    h.doc = gzipSync(html).length;
    h.short = h.commit.slice(0, 7);
  }
  return list;
}
