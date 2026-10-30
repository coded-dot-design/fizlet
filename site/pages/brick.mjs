// One page per brick, generated from the source: the summary is the module's leading comment, the
// API is its declarations (scripts/api.mjs), the sizes are measured on this build (scripts/sizes.mjs).
import { esc, icon, REPO, SITE } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);
const num = (n) => n.toLocaleString("en-US");

/** `code` spans in doc text, everything else escaped. */
export const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

const DEMO_NOTES = {
  settle: "Click the board: the puck glides there. Half a second after it stops, the engine settles: no frames at all until the next click.",
  fx: "Click the board for the hero blast. The particles are pooled; once the last one is gone the engine settles.",
  grid: "A seeded board (the same seed lays the same rocks). Click a cell for the A* path from the green corner.",
  sprite: "One sprite written as rows of characters, drawn at three scales in three palettes (side A, side B, hit flash), then the same pixels as an SVG image.",
  sound: "Every built-in cue. No audio files: a tiny oscillator synth, silent until your first press.",
};

/** The size cards for one brick, from the measured sizes. */
function sizeCards(brick, sizes) {
  return brick.sizes.map((name) => {
    const s = sizes.find((x) => x.name === name);
    if (!s) throw new Error(`brick ${brick.id}: no size entry "${name}" in scripts/sizes.mjs`);
    return `<div class="panel bp-size"><span class="bui-label"><b>${esc(name)}</b> · GZIP</span><b class="bp-bytes" data-size="${esc(name)}">${num(s.gzip)} B</b><small>${kb(s.gzip)} KB of a ${kb(s.budget)} KB budget</small><span class="meter" aria-hidden="true"><i style="--v:${(s.gzip / s.budget).toFixed(3)}"></i></span></div>`;
  }).join("");
}

function apiList(mods) {
  const toc = [], body = [], h = mods.length > 1 ? "h4" : "h3";
  for (const m of mods) {
    if (mods.length > 1) body.push(`<h3 class="bp-mod" id="mod-${m.name.replace(/\W+/g, "-")}"><code>${esc(m.name)}</code></h3>${m.summary ? `<p>${prose(m.summary)}</p>` : ""}`);
    for (const d of m.decls) {
      const id = `api-${m.name.replace(/\W+/g, "-")}-${d.name}`;
      toc.push(`<li><a href="#${id}"><code>${esc(d.names.join(", "))}</code></a><small>${d.kind}</small></li>`);
      body.push(`<article class="bp-decl" id="${id}">
        <${h}><code>${esc(d.names.join(", "))}</code> <small>${d.kind}</small></${h}>
        ${d.doc ? `<p>${prose(d.doc)}</p>` : ""}
        <pre class="code"><code>${esc(d.code)}</code></pre>
      </article>`);
    }
  }
  return { toc: toc.join(""), body: body.join("\n      ") };
}

/** The page body for one brick. `mods`: [{ name, src, summary, decls }] from scripts/api.mjs. */
export function brickPage({ brick, mods, sizes, version, prev, next, demoSize }) {
  const lead = mods[0];
  const { toc, body } = apiList(mods);
  const imports = mods.map((m) => {
    const names = m.decls.filter((d) => !["type", "interface"].includes(d.kind)).flatMap((d) => d.names);
    return { m, names };
  });
  const esm = imports.filter((x) => x.names.length).map(({ m, names }) => `import { ${names.slice(0, 4).join(", ")}${names.length > 4 ? ", …" : ""} } from "${SITE}dist/${m.src.replace(/^src\//, "").replace(/\.ts$/, ".js")}";`).join("\n");
  const npm = imports.filter((x) => x.names.length).map(({ m, names }) => `import { ${names.slice(0, 4).join(", ")}${names.length > 4 ? ", …" : ""} } from "${m.name}";`).join("\n");
  const demo = brick.demo ? `
    <figure class="panel lit bp-demo" data-brick-demo="${brick.demo}" data-demo-host>
      ${demoSize ? sizeBadge(demoSize.bytes, demoSize.live, `this demo, with ${brick.name}`) : ""}
      <div class="bp-stage" data-stage></div>
      <figcaption><span class="bui-label"><b>LIVE</b> · <span data-status>${brick.demo === "grid" || brick.demo === "sprite" ? "NO LOOP" : "LOADING"}</span></span><span>${esc(DEMO_NOTES[brick.demo])}</span></figcaption>
    </figure>` : "";
  const nav = (b, dir) => (b ? `<a class="bp-step ${dir}" href="${b.id}.html"><small>${dir === "prev" ? "← PREVIOUS" : "NEXT →"}</small><code>${esc(b.name)}</code></a>` : "<span></span>");
  return `
<section class="section bp" aria-labelledby="bp-title">
  <div class="wrap">
    <nav class="bp-crumbs" aria-label="Breadcrumb"><a href="../">Fizlet</a> / <a href="./">Bricks</a> / <span aria-current="page">${esc(brick.name)}</span></nav>
    <div class="split bp-top" style="--tone: var(--k-${brick.role})">
      <div>
        <p class="eyebrow"><span class="index">${esc(brick.tag)}</span> V${esc(version)}</p>
        <h1 id="bp-title" class="bp-title"><code>${esc(brick.name)}</code></h1>
        <p class="lead">${prose(lead.summary)}</p>
        <div class="split-keys"><a class="bui-key bui-arcade bui-sys" href="#api">${icon("code", 16)}API</a><a class="bui-key bui-arcade bui-cmd" href="${REPO}/blob/main/${lead.src}">${icon("github", 16)}Source ↗</a></div>
      </div>
      <div class="bp-sizes">${sizeCards(brick, sizes)}<p class="bp-note">Measured on this build: minified and gzipped with everything it imports, the way <code>npm run size</code> checks the budget in CI.</p></div>
    </div>
    ${demo}
    <div class="bp-use">
      <div class="panel code-card"><div class="code-head"><span class="bui-label"><b>MODULES</b> · hosted on this site</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div><pre class="code"><code>${esc(esm)}</code></pre></div>
      <div class="panel code-card bp-npm"><div class="code-head"><span class="bui-label"><b>NPM</b> · <span class="soon-tag">COMING SOON</span></span></div><pre class="code"><code>${esc(`npm install fizlet   # not published yet\n${npm}`)}</code></pre></div>
    </div>
    ${brick.snippet ? `<div class="panel code-card bp-snippet"><div class="code-head"><span class="bui-label"><b>IN SHORT</b></span></div><pre class="code"><code>${esc(brick.snippet)}</code></pre></div>` : ""}
    <div class="bp-api" id="api">
      <h2>API</h2>
      <p class="bp-note">Every export, with its doc comment, read from the published type declarations of v${esc(version)}.</p>
      <nav class="panel bp-toc" aria-label="Exports"><ul>${toc}</ul></nav>
      ${body}
    </div>
    <nav class="bp-steps" aria-label="More bricks">${nav(prev, "prev")}${nav(next, "next")}</nav>
  </div>
</section>`;
}

/** bricks/index.html: every brick, with its measured size. */
export function bricksIndex({ bricks, sizes, version }) {
  const cards = bricks.map((b) => {
    const s = sizes.find((x) => x.name === b.sizes[0]);
    return `<li class="panel brick" style="--tone: var(--k-${b.role})">
        <div class="brick-top"><span class="brick-tag">${esc(b.tag)}</span><span class="brick-size"><b>${kb(s.gzip)} KB</b><small> / ${kb(s.budget)} KB gzip</small></span></div>
        <h2><a href="${b.id}.html"><code>${esc(b.name)}</code></a></h2>
        <p>${prose(b.summary)}</p>
      </li>`;
  }).join("\n      ");
  return `
<section class="section" aria-labelledby="bi-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${bricks.length}</span> BRICKS · V${esc(version)}</p>
      <h1 id="bi-title">Kernel and<br><em>bricks.</em></h1>
      <p class="lead">One small kernel and a box of bricks, each its own import with its own size budget. Each page is generated from the source: the API from the type declarations, the size measured on this build.</p>
    </div>
    <ul class="bricks">
      ${cards}
    </ul>
  </div>
</section>`;
}
