// People (/people/ and /people/<id>/): the maker, the AI agents and the studio crew. Each page shows
// the pixel avatar (its 2–3 frames cross-fade every 4 s: site/site.ts), who they are and who they
// report to, what they make, their gallery entries (each linked to its card on the gallery page
// that holds it) and two stats measured on this build (entries and their total live bytes). The
// attribution line on every gallery card ("by <name>") links here. A sticker on every avatar says
// what they are (STICKER): the crew are characters and the agents are AI agents, not real people,
// and the sticker's accessible name says so. Data: site/contributors/*.json (scripts/people.mjs).
import { crumbs, esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { STICKER, avatarSvg } from "../../scripts/people.mjs";
import { personPath } from "../../scripts/gallery.mjs";

const fmt = (n) => n.toLocaleString("en-US");
const isTodo = (s) => /^KIT:/.test(s);
/** The winner sticker: a contest winner, here, on /contest/ and on its /gallery/ card. */
export const winnerBadge = () => `<span class="win-badge">${icon("check", 14)}WINNER</span>`;

const EYEBROW = { owner: "MAKER", persona: "STUDIO CREW", agent: "AI AGENT" };

/**
 * The avatar: every frame stacked (the first shown; site/site.ts cross-fades the rest unless the
 * viewer asks for reduced motion), one accessible name, and the sticker on its corner.
 */
export function avatar(p, size) {
  const s = STICKER[p.kind];
  const label = `${p.name}: pixel-art avatar${p.kind === "owner" ? " (a stylized character, not a likeness)" : ""}`;
  const frames = p.avatars.map((rows, i) => avatarSvg(rows, { size, cls: i ? "" : "on" })).join("");
  return `<div class="ppl-av-wrap"><span class="ppl-frame" role="img" aria-label="${esc(label)}"${p.avatars.length > 1 ? " data-rotate" : ""}>${frames}</span><span class="ppl-sticker ppl-sticker-${p.kind}" role="img" aria-label="${esc(s.label)}" title="${esc(s.label)}">${s.text}</span></div>`;
}

/** Who they are, under the name: the title in mono caps, the tagline, and who they report to. */
function titles(p, byId, base) {
  const boss = p.reportsTo && byId[p.reportsTo];
  return `<p class="ppl-role">${esc(p.role)}</p>${p.tagline ? `
        <p class="ppl-tagline">${esc(p.tagline)}</p>` : ""}${boss ? `
        <p class="ppl-reports"><span aria-hidden="true">↳</span> reports to <a href="${base}people/${esc(boss.id)}/">${esc(boss.name)}</a>, the ${esc(boss.role.split(" · ")[0])}</p>` : ""}`;
}

const stats = (s) => `<ul class="rules ppl-stats" aria-label="Measured on this build">
        <li class="panel rule"><b data-stat="entries">${fmt(s.count)}</b><p>gallery ${s.count === 1 ? "entry" : "entries"}</p></li>
        <li class="panel rule"><b data-stat="bytes">${fmt(s.bytes)} B</b><p>live code, gzip, all entries together</p></li>
      </ul>`;

/**
 * One profile. `stats`: { entries, count, bytes } from scripts/people.mjs statsOf; `urlOf(id)`: an
 * entry's site path (its gallery page + #id); `wins`: contest winners.
 */
export function personPage({ person: p, stats: s, base, urlOf, wins = new Set(), people = [] }) {
  const byId = Object.fromEntries(people.map((x) => [x.id, x]));
  const list = (items, label) => `<ul class="ppl-list" aria-label="${label}">${items.map((x) => isTodo(x)
    ? `<li class="ppl-todo">Not picked yet: Chris fills this in.</li>` : `<li>${esc(x)}</li>`).join("")}</ul>`;
  const entries = s.entries.length
    ? `<ol class="ppl-entries">${s.entries.map((e) => `<li class="panel"><a href="${base}${esc(urlOf(e.id))}">${esc(e.title)}</a>${wins.has(e.id) ? ` ${winnerBadge()}` : ""}<span class="ppl-prompt">“${esc(e.prompt)}”</span><span class="ppl-size">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)}<small>${esc(e.date)}</small></span></li>`).join("")}</ol>`
    : `<p class="body">No gallery entries yet. ${p.kind === "persona" ? `${esc(p.name)} pitches pieces for the <a href="${base}contest/">weekly contest</a>.` : ""}</p>`;
  return `
<article class="section ppl" aria-labelledby="person-name">
  <div class="wrap">
    ${crumbs(base, [["people/", "People"]], p.name)}
    <header class="ppl-head">
      ${avatar(p, 160)}
      <div class="ppl-who">
        <p class="eyebrow"><span class="index">${EYEBROW[p.kind]}</span> ${esc(p.handle ?? "FIZLET")}${p.pronouns ? ` · <span class="ppl-pronouns">${esc(p.pronouns)}</span>` : ""}</p>
        <h1 id="person-name" data-person="${esc(p.id)}">${esc(p.name)}</h1>
        ${titles(p, byId, base)}
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

/** The index: the maker first, then the AI agents, then the studio crew. `rows`: [{ person, stats }]. */
export function peopleIndex({ rows, base }) {
  const byId = Object.fromEntries(rows.map((r) => [r.person.id, r.person]));
  const cards = rows.map(({ person: p, stats: s }) => `<li class="panel ppl-tile" data-person="${esc(p.id)}">
      ${avatar(p, 96)}
      <div class="ppl-tile-body">
        <h2><a href="${base}${personPath(p.id)}">${esc(p.name)}</a></h2>
        ${titles(p, byId, base)}
        <p class="ppl-count" aria-label="Measured on this build"><span><b>${fmt(s.count)}</b> ${s.count === 1 ? "entry" : "entries"}</span><span><b>${fmt(s.bytes)} B</b> live gzip</span></p>
      </div>
    </li>`).join("\n    ");
  return `
<section class="section" aria-labelledby="ppl-index">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${rows.length}</span> PEOPLE · ${rows.filter((r) => r.person.kind === "persona").length} STUDIO CREW</p>
      <h1 id="ppl-index">Who makes<br><em>the animations.</em></h1>
      <p class="lead">Fizlet is made by <a href="${base}${personPath(rows[0].person.id)}">Chris Cooley</a>.${rows.some((r) => r.person.kind === "agent") ? " The AI agents on the team keep the engine running; each wears an AI AGENT sticker, because they are not people." : ""} The studio crew are Fizlet characters, not real people, and wear a CHARACTER sticker: each has a style and a way of writing prompts, pitches animation ideas for the gallery and votes in the <a href="${base}contest/">weekly contest</a> with Quill, Pip and Chris. Entries and bytes are measured on this build.</p>
    </div>
    <ul class="ppl-tiles">
    ${cards}
    </ul>
  </div>
</section>`;
}
