// One page per brick, generated from the source: the summary is the module's leading comment, the
// API is its declarations (scripts/api.mjs), the sizes are measured on this build (scripts/sizes.mjs).
import { crumbs, esc, icon, REPO, SITE } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { STATUS, BETA_LINE, exportStatus } from "../bricks.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);
const num = (n) => n.toLocaleString("en-US");

/** `code` spans in doc text, everything else escaped. */
export const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

/** A brick's status flag as a Board UI status pill (flat: a readout, not a key). */
export const statusPill = (status) => `<span class="status-pill" data-flag="${status}" title="${esc(STATUS[status].line)}">${STATUS[status].label}</span>`;

/** The status panel on a brick page: the flag, what it means, and the evidence behind it. */
function statusPanel(brick) {
  const s = STATUS[brick.status];
  const list = (xs) => xs.map((x) => `<li>${prose(x)}</li>`).join("");
  return `<div class="panel bp-status" data-flag="${brick.status}">
      <div class="code-head"><span class="bui-label"><b>STATUS</b> · <a href="./#status">what the flags mean</a></span>${statusPill(brick.status)}</div>
      <p>${esc(s.line)}${brick.why ? ` ${esc(brick.why)}` : ""}</p>
      <dl>
        <div><dt>SINCE</dt><dd>v${esc(brick.since)}</dd></div>
        <div><dt>SHIPPED IN</dt><dd>${brick.used.length ? `<ul>${list(brick.used)}</ul>` : "no released game or page yet"}</dd></div>
        <div><dt>TESTS</dt><dd><ul>${brick.tests.map((t) => `<li><a href="${REPO}/blob/main/tests/${t}"><code>${esc(t)}</code> ↗</a></li>`).join("")}</ul></dd></div>
      </dl>
    </div>`;
}

const DEMO_NOTES = {
  settle: "Click the board: the puck glides there. Half a second after it stops, the engine settles: no frames at all until the next click.",
  fx: "Click the board for the hero blast. The particles are pooled; once the last one is gone the engine settles.",
  grid: "A seeded board (the same seed lays the same rocks). Click a cell for the A* path from the green corner.",
  sprite: "One sprite written as rows of characters, drawn at three scales in three palettes (side A, side B, hit flash), then the same pixels as an SVG image.",
  sound: "Every built-in cue. No audio files: a tiny oscillator synth, silent until your first press.",
  timeline: "DOM choreography on the kernel clock: the cartridge seats, the screen opens, the lines stagger in. When it ends, the engine settles. Replay runs it again; with reduced motion it lands on the end at once.",
};

/** The size cards for one brick, from the measured sizes. */
function sizeCards(brick, sizes) {
  return brick.sizes.map((name) => {
    const s = sizes.find((x) => x.name === name);
    if (!s) throw new Error(`brick ${brick.id}: no size entry "${name}" in scripts/sizes.mjs`);
    return `<div class="panel bp-size"><span class="bui-label"><b>${esc(name)}</b> · GZIP</span><b class="bp-bytes" data-size="${esc(name)}">${num(s.gzip)} B</b><small>${kb(s.gzip)} KB of a ${kb(s.budget)} KB budget</small><span class="meter" aria-hidden="true"><i style="--v:${(s.gzip / s.budget).toFixed(3)}"></i></span></div>`;
  }).join("");
}

/** An export's anchor on its brick page. */
export const apiId = (mod, name) => `api-${mod.replace(/\W+/g, "-")}-${name}`;

/**
 * One export: its name, kind and status flag, its doc comment, then (for a function or class) each
 * signature with its parameters and return type, or (for a const) its type; the declaration as
 * published closes it (folded for a function or class, whose signature already says the most).
 * Type names the same module exports link to their entries.
 */
function declEntry(brick, m, d, h) {
  const own = new Set(m.decls.flatMap((x) => x.names));
  const types = (t) => esc(t).replace(/\b[A-Z]\w*\b/g, (w) => (own.has(w) ? `<a href="#${apiId(m.name, w)}">${w}</a>` : w));
  const status = exportStatus(brick, d);
  const tags = d.tags.filter((t) => t.name !== "returns").map((t) => `<p class="bp-tag"><b>@${esc(t.name)}</b> ${prose(t.text)}</p>`).join("");
  const sigs = d.sigs.map((s) => `<pre class="code bp-sig"><code>${esc(s.text)}</code></pre>
        <dl class="bp-params">${s.params.map((p) => `<div><dt><code>${p.rest ? "..." : ""}${esc(p.name)}${p.optional ? "?" : ""}</code></dt><dd><code>${types(p.type)}</code>${p.optional ? " <small>optional</small>" : ""}${p.doc ? ` ${prose(p.doc)}` : ""}</dd></div>`).join("")}<div><dt>Returns</dt><dd><code>${types(s.returns)}</code></dd></div></dl>`).join("\n        ");
  const type = d.type ? `<dl class="bp-params"><div><dt>Type</dt><dd><code>${types(d.type)}</code></dd></div></dl>` : "";
  const code = `<pre class="code"><code>${esc(d.code)}</code></pre>`;
  return `<article class="bp-decl" id="${apiId(m.name, d.name)}">
        <${h}><code>${esc(d.names.join(", "))}</code> <small>${d.kind}</small> ${statusPill(status)}</${h}>
        <p>${prose(d.doc)}</p>${tags}
        ${sigs}${type}
        ${d.sigs.length ? `<details class="bp-full"><summary>Declaration</summary>${code}</details>` : code}
      </article>`;
}

function apiList(brick, mods) {
  const toc = [], body = [], h = mods.length > 1 ? "h4" : "h3";
  for (const m of mods) {
    if (mods.length > 1) body.push(`<h3 class="bp-mod" id="mod-${m.name.replace(/\W+/g, "-")}"><code>${esc(m.name)}</code></h3>${m.summary ? `<p>${prose(m.summary)}</p>` : ""}`);
    for (const d of m.decls) {
      toc.push(`<li><a href="#${apiId(m.name, d.name)}"><code>${esc(d.names.join(", "))}</code></a><small>${d.kind}</small></li>`);
      body.push(declEntry(brick, m, d, h));
    }
  }
  return { toc: toc.join(""), body: body.join("\n      ") };
}

/** The page body for one brick. `mods`: [{ name, src, summary, decls }] from scripts/api.mjs. */
export function brickPage({ brick, mods, sizes, version, prev, next, demoSize }) {
  const lead = mods[0];
  const { toc, body } = apiList(brick, mods);
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
    ${crumbs("../", [["bricks/", "Bricks"]], brick.name)}
    <div class="split bp-top" style="--tone: var(--k-${brick.role})">
      <div>
        <p class="eyebrow"><span class="index">${esc(brick.tag)}</span> V${esc(version)} ${statusPill(brick.status)}</p>
        <h1 id="bp-title" class="bp-title"><code>${esc(brick.name)}</code></h1>
        <p class="lead">${prose(lead.summary)}</p>
        <div class="split-keys"><a class="bui-key bui-arcade bui-sys" href="#api">${icon("code", 16)}API</a><a class="bui-key bui-arcade bui-cmd" href="${REPO}/blob/main/${lead.src}">${icon("github", 16)}Source ↗</a></div>
      </div>
      <div class="bp-sizes">${sizeCards(brick, sizes)}<p class="bp-note">Measured on this build: minified and gzipped with everything it imports, the way <code>npm run size</code> checks the budget in CI.</p></div>
    </div>
    ${demo}
    ${statusPanel(brick)}
    <div class="bp-use">
      <div class="panel code-card"><div class="code-head"><span class="bui-label"><b>MODULES</b> · hosted on this site</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div><pre class="code"><code>${esc(esm)}</code></pre></div>
      <div class="panel code-card bp-npm"><div class="code-head"><span class="bui-label"><b>NPM</b> · <span class="soon-tag">COMING SOON</span></span></div><pre class="code"><code>${esc(`npm install fizlet   # not published yet\n${npm}`)}</code></pre></div>
    </div>
    ${brick.snippet ? `<div class="panel code-card bp-snippet"><div class="code-head"><span class="bui-label"><b>IN SHORT</b></span></div><pre class="code"><code>${esc(brick.snippet)}</code></pre></div>` : ""}
    <div class="bp-api" id="api">
      <h2>API</h2>
      <p class="bp-note">Every export with its signature, parameters, return type, doc comment and status flag, generated at build time from the published type declarations of v${esc(version)} by the TypeScript compiler. For AI agents: <a href="../llms-full.txt">the whole API as plain text</a>.</p>
      <nav class="panel bp-toc" aria-label="Exports"><ul>${toc}</ul></nav>
      ${body}
    </div>
    <nav class="bp-steps" aria-label="More bricks">${nav(prev, "prev")}${nav(next, "next")}</nav>
  </div>
</section>`;
}

/** The flags and what earns each (bricks/index.html#status). */
function statusLegend(bricks) {
  return Object.entries(STATUS).map(([k, s]) => {
    const n = bricks.filter((b) => b.status === k).length;
    return `<li class="panel status-card" data-flag="${k}"><div class="brick-top">${statusPill(k)}<small>${n ? `${n} ${n === 1 ? "brick" : "bricks"}` : k === "roadmap" ? "planned below" : "none today"}</small></div>
        <p>${esc(s.line)}</p>
        <ul>${s.criteria.map((c) => `<li>${prose(c)}</li>`).join("")}</ul>
      </li>`;
  }).join("\n      ");
}

/** bricks/index.html: every brick, with its measured size and its status. */
export function bricksIndex({ bricks, sizes, version, planned = [] }) {
  const cards = bricks.map((b) => {
    const s = sizes.find((x) => x.name === b.sizes[0]);
    return `<li class="panel brick" style="--tone: var(--k-${b.role})">
        <div class="brick-top"><span class="brick-tag">${esc(b.tag)}</span>${statusPill(b.status)}<span class="brick-size"><b>${kb(s.gzip)} KB</b><small> / ${kb(s.budget)} KB gzip</small></span></div>
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
    <div class="section-head" id="status">
      <h2>Status flags</h2>
      <p class="lead">${esc(BETA_LINE)} Each brick's page shows its flag and the evidence: the release it shipped in, the games and pages that ship it, and its tests.</p>
    </div>
    <ul class="status-cards">
      ${statusLegend(bricks)}
    </ul>
    <div class="section-head" id="planned">
      <h2>On the roadmap</h2>
      <p class="lead">Planned, not shipped: nothing here is in the package yet. Each size is a target, not a measurement.</p>
    </div>
    <ul class="bricks planned">
      ${planned.map((p) => `<li class="panel brick" data-flag="roadmap">
        <div class="brick-top"><span class="brick-tag">${esc(p.phase)}</span>${statusPill("roadmap")}<span class="brick-size"><small>target ≤ ${kb(p.target)} KB gzip</small></span></div>
        <h3><code>${esc(p.name)}</code></h3>
        <p>${esc(p.purpose)}</p>
        <p class="needs"><small>NEEDS</small> ${p.needs.map((n) => `<code>${esc(n)}</code>`).join(" ")}</p>
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}
