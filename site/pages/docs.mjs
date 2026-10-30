// Docs (/docs/) and guides (/guides/): the index pages and one page per JSON in site/docs/ (scripts/docs.mjs).
// Pages wear the notes' parts (section head, panels, keys) plus a code card, the size table measured
// on this build and the contract cards from the home page.
import { esc, icon } from "../layout.mjs";
import { block, inline } from "./notes.mjs";
import { CONTRACT } from "./index.mjs";
import { SECTIONS, docPath } from "../../scripts/docs.mjs";

const num = (n) => n.toLocaleString("en-US");

function docBlock(b, { base, sizes, bricks }) {
  switch (b.type) {
    case "code":
      return `<div class="panel code-card doc-code"><div class="code-head"><span class="bui-label"><b>${esc(b.label ?? "CODE")}</b>${b.file ? ` · ${esc(b.file)}` : ""}</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div><pre class="code"><code>${esc(b.code)}</code></pre></div>`;
    case "sizes": {
      const brickOf = (name) => bricks.find((x) => x.sizes.includes(name));
      const rows = sizes.map((s) => {
        const br = brickOf(s.name);
        const name = br ? `<a href="${base}bricks/${br.id}.html"><code>${esc(s.name)}</code></a>` : `<code>${esc(s.name)}</code>`;
        return `<tr><td>${name}</td><td data-size="${esc(s.name)}">${num(s.gzip)} B</td><td>${num(s.budget)} B</td><td>${Math.round((s.gzip / s.budget) * 100)}%</td></tr>`;
      }).join("");
      return `<section class="note-block doc-wide">${b.heading ? `<h2>${inline(b.heading, base)}</h2>` : ""}<div class="panel lit ledger doc-table"><div class="table-scroll"><table><thead><tr><th>Entry</th><th>Gzip</th><th>Budget</th><th>Used</th></tr></thead><tbody>${rows}</tbody></table></div></div>${b.note ? `<p class="body bp-note">${inline(b.note, base)}</p>` : ""}</section>`;
    }
    case "contract":
      return `<section class="note-block doc-wide">${b.heading ? `<h2>${inline(b.heading, base)}</h2>` : ""}<ol class="rules">${CONTRACT.map(([t, body], i) => `<li class="panel rule"><b>${String(i + 1).padStart(2, "0")}</b><h3>${esc(t)}</h3><p>${esc(body)}</p></li>`).join("")}</ol></section>`;
    default:
      return block(b, base);
  }
}

/** JSON-LD for a docs or guide page: a TechArticle about the engine, and its breadcrumb trail. */
export function docLd(d, { site, person, website, code }) {
  const url = site + docPath(d);
  return [
    { "@type": "TechArticle", "@id": `${url}#article`, headline: d.title, description: d.seo.description, url, mainEntityOfPage: url, inLanguage: "en",
      author: { "@id": person }, publisher: { "@id": website.replace("#website", "#org") }, isPartOf: { "@id": website }, about: { "@id": code } },
    { "@type": "BreadcrumbList", "@id": `${url}#crumbs`, itemListElement: [
      { "@type": "ListItem", position: 1, name: "Fizlet", item: site },
      { "@type": "ListItem", position: 2, name: SECTIONS[d.section], item: `${site}${d.section}/` },
      { "@type": "ListItem", position: 3, name: d.nav, item: url },
    ] },
  ];
}

/** The map of every docs and guides page (the foot of each page). */
function map(all, base, current) {
  return `<nav class="panel doc-map" aria-label="Docs and guides">${Object.entries(SECTIONS).map(([s, label]) => `<div><h2><a href="${base}${s}/">${label}</a></h2><ol>${all.filter((d) => d.section === s).map((d) =>
    `<li><a href="${base}${docPath(d)}"${d === current ? ' aria-current="page"' : ""}>${esc(d.nav)}</a></li>`).join("")}</ol></div>`).join("")}<div><h2><a href="${base}bricks/">Bricks</a></h2><p>Every module, its API and its size.</p><h2><a href="${base}news/">News</a></h2><p>Release notes for every version.</p></div></nav>`;
}

/** One docs or guide page. */
export function docPage({ doc: d, all, base, sizes, bricks }) {
  const mine = all.filter((x) => x.section === d.section), i = mine.indexOf(d);
  const step = (x, dir) => (x ? `<a class="bp-step ${dir}" href="${base}${docPath(x)}"><small>${dir === "prev" ? "← PREVIOUS" : "NEXT →"}</small><span>${esc(x.nav)}</span></a>` : "<span></span>");
  return `
<article class="section note doc" aria-labelledby="doc-title">
  <div class="wrap">
    <nav class="bp-crumbs" aria-label="Breadcrumb"><a href="${base}">Fizlet</a> / <a href="${base}${d.section}/">${SECTIONS[d.section]}</a> / <span aria-current="page">${esc(d.nav)}</span></nav>
    <header class="section-head note-head">
      <p class="eyebrow"><span class="index">${String(d.order).padStart(2, "0")}</span> ${esc(d.eyebrow.toUpperCase())}</p>
      <h1 id="doc-title">${esc(d.title)}${d.subtitle ? `<br><em>${esc(d.subtitle)}</em>` : ""}</h1>
      ${d.lead.map((p) => `<p class="lead">${inline(p, base)}</p>`).join("")}
    </header>
    ${d.blocks.map((b) => docBlock(b, { base, sizes, bricks })).join("\n    ")}
    <nav class="bp-steps" aria-label="More ${SECTIONS[d.section].toLowerCase()}">${step(mine[i - 1], "prev")}${step(mine[i + 1], "next")}</nav>
    ${map(all, base, d)}
  </div>
</article>`;
}

/** /docs/ or /guides/: the section's pages in reading order. */
export function sectionIndex({ section, all, base, head }) {
  const cards = all.filter((d) => d.section === section).map((d) => `<li class="panel note-card">
      <div class="card-anim" data-anim-slot="${esc(d.brick)}" aria-hidden="true"></div>
      <p class="eyebrow"><span class="index">${String(d.order).padStart(2, "0")}</span> ${esc(d.eyebrow.toUpperCase())}</p>
      <h2><a href="${base}${docPath(d)}">${esc(d.nav)}</a></h2>
      <p class="body">${inline(d.summary ?? d.lead[0], base)}</p>
    </li>`).join("\n    ");
  return `
<section class="section" aria-labelledby="sec-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${all.filter((d) => d.section === section).length}</span> ${esc(head.eyebrow)}</p>
      <h1 id="sec-title">${esc(head.title)}<br><em>${esc(head.accent)}</em></h1>
      <p class="lead">${inline(head.lead, base)}</p>
    </div>
    <ol class="gal note-cards">
    ${cards}
    </ol>
    ${map(all, base, null)}
  </div>
</section>`;
}
