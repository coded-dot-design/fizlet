// News (/news/): every release, newest first, and one page per version (/news/<version>/), rendered
// from CHANGELOG.md as written (scripts/releases.mjs). Announcements (notes of type "news") lead the index.
import { AUTHOR, esc, icon, REPO } from "../layout.mjs";
import { inline, longDate } from "./notes.mjs";
import { highlights, parse, plain, releasePath } from "../../scripts/releases.mjs";

/** Changelog Markdown → the notes' inline syntax: repo paths link to GitHub, bare URLs become links. */
const md = (s, base) => inline(s
  .replace(/\]\((?!https?:|\/|#|mailto:)([^)\s]+)\)/g, (_, p) => `](${REPO}/blob/main/${p.replace(/^\.\//, "")})`)
  .replace(/(^|[\s(])(https:\/\/[^\s)`,]+[^\s)`,.;:])/g, (_, pre, url) => `${pre}[${url}](${url})`), base);

function list(items, base) {
  return `<ul class="ledger-rules note-list">${items.map((i) => `<li>${md(i.text, base)}${i.ul ? list(i.ul, base) : ""}</li>`).join("")}</ul>`;
}

/** JSON-LD for a release: a TechArticle about that version of the engine. */
export function releaseLd(r, { site, person, website, code, description }) {
  const url = site + releasePath(r);
  return [{ "@type": "TechArticle", "@id": `${url}#article`, headline: `Fizlet ${r.version} release notes`, description, url, mainEntityOfPage: url, inLanguage: "en",
    ...(r.date ? { datePublished: r.date, dateModified: r.date } : {}), author: { "@id": person }, publisher: { "@id": website.replace("#website", "#org") }, isPartOf: { "@id": website },
    about: { "@type": "SoftwareSourceCode", name: "Fizlet", softwareVersion: r.version, codeRepository: REPO, isBasedOn: { "@id": code } } }];
}

/** One release's page. */
export function releasePage({ release: r, prev, next, base, latest }) {
  const body = parse(r.md).map((b) => (b.h ? `<h2>${md(b.h, base)}</h2>` : b.p ? `<p class="body">${md(b.p, base)}</p>` : list(b.ul, base))).join("\n      ");
  const step = (x, dir) => (x ? `<a class="bp-step ${dir}" href="${base}${releasePath(x)}"><small>${dir === "prev" ? "← NEWER" : "OLDER →"}</small><code>${esc(x.version)}</code></a>` : "<span></span>");
  return `
<article class="section note release" aria-labelledby="rel-title">
  <div class="wrap">
    <nav class="bp-crumbs" aria-label="Breadcrumb"><a href="${base}">Fizlet</a> / <a href="${base}news/">News</a> / <span aria-current="page">${esc(r.version)}</span></nav>
    <header class="section-head note-head">
      <p class="eyebrow"><span class="index">${esc(r.version)}</span> RELEASE NOTES${r.version === latest ? " · LATEST" : ""}</p>
      <h1 id="rel-title">Fizlet ${esc(r.version)}</h1>
      <p class="note-by">By <a href="${AUTHOR}/">Chris Cooley</a>${r.date ? ` · <time datetime="${esc(r.date)}">${longDate(r.date)}</time>` : ""} · <a href="${REPO}/blob/main/CHANGELOG.md">CHANGELOG.md ↗</a></p>
    </header>
    <section class="note-block release-body">
      ${body}
    </section>
    <nav class="bp-steps" aria-label="Other releases">${step(prev, "prev")}${step(next, "next")}</nav>
    <p class="note-back"><a href="${base}news/">${icon("book", 16)}Every release</a></p>
  </div>
</article>`;
}

/** /news/: announcements, then every release, newest first. */
export function newsIndex({ releases, announcements, base }) {
  const posts = announcements.map((n) => `<li class="panel note-card">
      <div class="card-anim" data-anim-slot="${esc("note:" + n.slug)}" aria-hidden="true"></div>
      <p class="eyebrow"><span class="index">${esc(n.date)}</span> ${esc((n.eyebrow ?? "news").toUpperCase())}</p>
      <h3><a href="${base}notes/${esc(n.slug)}/">${esc(n.title)}</a></h3>
      <p class="body">${inline(n.lead[0] ?? "", base)}</p>
    </li>`).join("\n      ");
  const rows = releases.map((r) => {
    const hl = highlights(parse(r.md)).slice(0, 4);
    return `<li class="panel note-card rel-card">
      <div class="card-anim" data-anim-slot="${esc("release:" + r.version)}" aria-hidden="true"></div>
      <p class="eyebrow"><span class="index">${esc(r.version)}</span> ${r.date ? esc(longDate(r.date).toUpperCase()) : "RELEASE"}</p>
      <h3><a href="${base}${releasePath(r)}">Fizlet ${esc(r.version)}</a></h3>
      ${hl.length ? `<ul class="ledger-rules note-list">${hl.map((h) => `<li>${esc(plain(h))}</li>`).join("")}</ul>` : ""}
    </li>`;
  }).join("\n      ");
  return `
<section class="section" aria-labelledby="news-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${releases.length}</span> RELEASES · NEWEST FIRST</p>
      <h1 id="news-title">Every release.<br><em>Every number.</em></h1>
      <p class="lead">What changed in each version of Fizlet, straight from the <a href="${REPO}/blob/main/CHANGELOG.md">changelog</a>: new bricks, fixes and the sizes measured when each one shipped. Essays and field notes live in <a href="${base}notes/">Notes</a>.</p>
    </div>
    ${posts ? `<h2 class="news-h">Announcements</h2><ol class="gal note-cards">\n      ${posts}\n    </ol>` : ""}
    <h2 class="news-h">Release notes</h2>
    <ol class="gal note-cards">
      ${rows}
    </ol>
  </div>
</section>`;
}
