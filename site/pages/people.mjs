// People (/people/ and /people/<id>/): the maker and the house personas. Each page shows the
// pixel avatar, who they are, what they make, their gallery entries (each linked to its card on
// the gallery page that holds it) and two stats measured on this build (entries and their total
// live bytes). The attribution line on every gallery card ("by <name>") links here. Personas are
// characters, and every card and page says so (PERSONA_NOTE). Data: site/contributors/*.json
// (scripts/people.mjs).
import { crumbs, esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { PERSONA_NOTE, avatarSvg } from "../../scripts/people.mjs";
import { personPath } from "../../scripts/gallery.mjs";

const fmt = (n) => n.toLocaleString("en-US");
const isTodo = (s) => /^KIT:/.test(s);
/** The winner sticker: a contest winner, here, on /contest/ and on its /gallery/ card. */
export const winnerBadge = () => `<span class="win-badge">${icon("check", 14)}WINNER</span>`;

/** The persona sticker (cards and pages), or the maker's. */
const tag = (p) => p.kind === "persona"
  ? `<p class="ppl-persona"><b>${PERSONA_NOTE.split(" — ").map(esc).join("</b> — ")}.</p>`
  : `<p class="ppl-owner"><b>Maker</b> — the real person who builds Fizlet.</p>`;

const stats = (s) => `<ul class="rules ppl-stats" aria-label="Measured on this build">
        <li class="panel rule"><b data-stat="entries">${fmt(s.count)}</b><p>gallery ${s.count === 1 ? "entry" : "entries"}</p></li>
        <li class="panel rule"><b data-stat="bytes">${fmt(s.bytes)} B</b><p>live code, gzip, all entries together</p></li>
      </ul>`;

/**
 * One profile. `stats`: { entries, count, bytes } from scripts/people.mjs statsOf; `urlOf(id)`: an
 * entry's site path (its gallery page + #id); `wins`: contest winners.
 */
export function personPage({ person: p, stats: s, base, urlOf, wins = new Set() }) {
  const list = (items, label) => `<ul class="ppl-list" aria-label="${label}">${items.map((x) => isTodo(x)
    ? `<li class="ppl-todo">Not picked yet: Chris fills this in.</li>` : `<li>${esc(x)}</li>`).join("")}</ul>`;
  const entries = s.entries.length
    ? `<ol class="ppl-entries">${s.entries.map((e) => `<li class="panel"><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a>${wins.has(e.id) ? ` ${winnerBadge()}` : ""}<span class="ppl-prompt">“${esc(e.prompt)}”</span><span class="ppl-size">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)}<small>${esc(e.date)}</small></span></li>`).join("")}</ol>`
    : `<p class="body">No gallery entries yet. ${p.kind === "persona" ? `${esc(p.name)} makes pieces for the <a href="${base}contest/">weekly contest</a>.` : ""}</p>`;
  return `
<article class="section ppl" aria-labelledby="person-name">
  <div class="wrap">
    ${crumbs(base, [["people/", "People"]], p.name)}
    <header class="ppl-head">
      <div class="ppl-frame">${avatarSvg(p.avatar, { size: 160, label: `${p.name}: pixel-art avatar${p.kind === "owner" ? " (a stylized character, not a likeness)" : ""}` })}</div>
      <div class="ppl-who">
        <p class="eyebrow"><span class="index">${p.kind === "owner" ? "MAKER" : "PERSONA"}</span> ${esc(p.handle ?? "FIZLET")}</p>
        <h1 id="person-name" data-person="${esc(p.id)}">${esc(p.name)}</h1>
        <p class="ppl-role">${esc(p.role)}</p>
        ${tag(p)}
        <p class="lead">${esc(p.bio)}</p>
        ${p.url ? `<p class="ppl-url"><a href="${esc(p.url)}">${icon("out", 16)}${esc(p.url.replace(/^https:\/\/|\/$/g, ""))} ↗</a></p>` : ""}
      </div>
    </header>
    ${stats(s)}
    <div class="ppl-grid">
      <section class="panel ppl-card" aria-labelledby="ppl-style"><h2 id="ppl-style">What they make</h2><p>${esc(p.style)}</p>${p.promptStyle ? `<h3>Prompt style</h3><p>${esc(p.promptStyle)}</p>` : ""}${p.samplePrompt ? `<p class="gal-prompt"><span class="bui-label">PROMPT</span> “${esc(p.samplePrompt)}”</p>` : ""}</section>
      <section class="panel ppl-card" aria-labelledby="ppl-games"><h2 id="ppl-games">Favorite games</h2>${list(p.favoriteGames, "Favorite games")}</section>
      <section class="panel ppl-card" aria-labelledby="ppl-hobbies"><h2 id="ppl-hobbies">Off the board</h2>${list(p.hobbies, "Hobbies")}</section>
    </div>
    <section class="ppl-gallery" aria-labelledby="ppl-entries"><h2 id="ppl-entries">In the gallery</h2>${entries}</section>
    <p class="note-back"><a href="${base}people/">${icon("grid", 16)}All people</a></p>
  </div>
</article>`;
}

/** The index: the maker first, then the personas. `rows`: [{ person, stats }]. */
export function peopleIndex({ rows, base }) {
  const cards = rows.map(({ person: p, stats: s }) => `<li class="panel ppl-tile" data-person="${esc(p.id)}">
      <span class="ppl-frame">${avatarSvg(p.avatar, { size: 96 })}</span>
      <div>
        <h2><a href="${base}${personPath(p.id)}">${esc(p.name)}</a></h2>
        <p class="ppl-role">${esc(p.role)}</p>
        ${tag(p)}
        <p class="ppl-count"><b>${fmt(s.count)}</b> ${s.count === 1 ? "entry" : "entries"} · <b>${fmt(s.bytes)} B</b> live gzip</p>
      </div>
    </li>`).join("\n    ");
  return `
<section class="section" aria-labelledby="ppl-index">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${rows.length}</span> PEOPLE · ${rows.filter((r) => r.person.kind === "persona").length} HOUSE PERSONAS</p>
      <h1 id="ppl-index">Who makes<br><em>the animations.</em></h1>
      <p class="lead">Fizlet is made by <a href="${base}${personPath(rows[0].person.id)}">Chris Cooley</a>. The house personas are Fizlet characters, not real people: each one has a style, a way of writing prompts and a seat at the <a href="${base}contest/">weekly contest</a>. Entries and bytes are measured on this build.</p>
    </div>
    <ul class="ppl-tiles">
    ${cards}
    </ul>
  </div>
</section>`;
}
