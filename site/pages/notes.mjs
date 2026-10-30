// Notes: the index (/notes/) and one page per note (/notes/<slug>/), from site/notes/*.json
// (scripts/notes.mjs). The page wears the site's own parts: section head, panels, contract-style
// stat cards, kit keys and the size badge (the kernel, measured on this build).
import { AUTHOR, esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const longDate = (d) => DATE.format(new Date(`${d}T00:00:00Z`));

/**
 * Inline text: escaped, then `code`, **strong**, *em* and [label](href). A site path ("/bricks/")
 * is made relative to the page (`base`), so a preview build on another path still links right.
 */
export function inline(s, base) {
  const code = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href.startsWith("/") ? base + href.slice(1) : href}">${label}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[i]}</code>`);
}

const href = (h, base) => (h.startsWith("/") ? base + h.slice(1) : h);
const KEYS = ["bui-sys", "bui-cmd", "bui-go"];

export function block(b, base) {
  const h2 = (text) => (text ? `<h2>${inline(text, base)}${b.headingAccent ? `<br><em>${inline(b.headingAccent, base)}</em>` : ""}</h2>` : "");
  switch (b.type) {
    case "text":
      return `<section class="note-block">${h2(b.heading)}${b.body.map((x) =>
        x.type === "p" ? `<p class="body">${inline(x.text, base)}</p>`
          : x.type === "h" ? `<h3>${inline(x.text, base)}</h3>`
            : `<${x.type} class="ledger-rules note-list">${x.items.map((i) => `<li>${inline(i, base)}</li>`).join("")}</${x.type}>`).join("")}</section>`;
    case "stats":
      return `<section class="note-block">${h2(b.heading)}<ul class="rules note-stats">${b.items.map((i) => `<li class="panel rule"><b>${esc(i.value)}</b><p>${inline(i.label, base)}</p></li>`).join("")}</ul></section>`;
    case "features":
      return `<section class="note-block">${h2(b.heading)}${b.subhead ? `<p class="body">${inline(b.subhead, base)}</p>` : ""}<ul class="note-rows">${b.items.map((i) =>
        `<li class="panel"><h3>${inline(i.title, base)}</h3><p>${inline(i.body, base)}</p>${i.link ? `<p><a href="${esc(href(i.link.href, base))}">${esc(i.link.label)}</a></p>` : ""}</li>`).join("")}</ul></section>`;
    case "faq":
      return `<section class="note-block"><h2>Questions</h2><div class="note-rows">${b.items.map((i) => `<div class="panel"><h3>${inline(i.q, base)}</h3><p>${inline(i.a, base)}</p></div>`).join("")}</div></section>`;
    case "cta":
      return `<div class="split-keys">${b.links.map((l, i) => {
        const out = /^https:/.test(l.href);
        return `<a class="bui-key bui-arcade ${KEYS[i % KEYS.length]}" href="${esc(href(l.href, base))}">${icon(out ? "out" : "book", 16)}${esc(l.label)}${out ? " ↗" : ""}</a>`;
      }).join("")}</div>`;
    default:
      throw new Error(`note block ${b.type}`);
  }
}

/** JSON-LD for a note: a BlogPosting by Chris Cooley, plus its questions as an FAQPage. */
export function noteLd(n, { site, person, website }) {
  const url = `${site}notes/${n.slug}/`;
  const faq = n.blocks.filter((b) => b.type === "faq").flatMap((b) => b.items);
  const plain = (s) => s.replace(/\*\*|`|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return [
    { "@type": "BlogPosting", "@id": `${url}#post`, headline: n.title, alternativeHeadline: n.subtitle, description: n.seo.description, url, mainEntityOfPage: url,
      datePublished: n.date, dateModified: n.date, inLanguage: "en", keywords: n.tags.join(", "), author: { "@id": person }, publisher: { "@id": website.replace("#website", "#org") }, isPartOf: { "@id": website } },
    ...(faq.length ? [{ "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: faq.map((f) => ({ "@type": "Question", name: plain(f.q), acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) }] : []),
  ];
}

/** One note's page body. `kernel`: the kernel's gzip bytes, measured on this build. */
export function notePage({ note: n, base, kernel }) {
  return `
<article class="section note" aria-labelledby="note-title">
  <div class="wrap">
    <nav class="bp-crumbs" aria-label="Breadcrumb"><a href="${base}">Fizlet</a> / <a href="${base}notes/">Notes</a> / <span aria-current="page">${esc(n.title)}</span></nav>
    <header class="section-head note-head">
      <p class="eyebrow"><span class="index">${esc(n.date)}</span> ${esc((n.eyebrow ?? n.type ?? "note").toUpperCase())}</p>
      <h1 id="note-title">${esc(n.title)}${n.subtitle ? `<br><em>${esc(n.subtitle)}</em>` : ""}</h1>
      ${n.lead.map((p) => `<p class="lead">${inline(p, base)}</p>`).join("")}
      <p class="note-by">By <a href="${AUTHOR}/">Chris Cooley</a> · <time datetime="${esc(n.date)}">${longDate(n.date)}</time> · ${sizeBadge(kernel, "size:fizlet (kernel)", "the kernel on this build")}</p>
    </header>
    ${n.blocks.map((b) => block(b, base)).join("\n    ")}
    <p class="note-back"><a href="${base}notes/">${icon("book", 16)}All notes</a></p>
  </div>
</article>`;
}

/** The notes index: newest first. */
export function notesIndex({ notes, base }) {
  const cards = notes.map((n) => `<li class="panel note-card">
      <p class="eyebrow"><span class="index">${esc(n.date)}</span> ${esc((n.eyebrow ?? n.type ?? "note").toUpperCase())}</p>
      <h2><a href="${base}notes/${esc(n.slug)}/">${esc(n.title)}</a></h2>
      ${n.subtitle ? `<p class="note-sub">${esc(n.subtitle)}</p>` : ""}
      <p class="body">${inline(n.lead[0] ?? "", base)}</p>
    </li>`).join("\n    ");
  return `
<section class="section" aria-labelledby="notes-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${notes.length}</span> NOTES · NEWEST FIRST</p>
      <h1 id="notes-title">Field notes.<br><em>Measured, then written.</em></h1>
      <p class="lead">What building games on Fizlet teaches the engine: the ports, the lessons and the numbers behind them, each one measured. By <a href="${AUTHOR}/">Chris Cooley</a>.</p>
    </div>
    <ol class="gal note-cards">
    ${cards}
    </ol>
  </div>
</section>`;
}
