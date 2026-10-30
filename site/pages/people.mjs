// A contributor's profile (site/contributors/<id>.json): who they are and every animation of theirs
// in the gallery, newest first, each linked to its card. The attribution line on every card
// ("by <name>") links here.
import { esc, icon } from "../layout.mjs";

export function personPage({ person, entries, themes, base, urlOf }) {
  const title = Object.fromEntries(themes.map((t) => [t.id, t.title]));
  const mine = entries.filter((e) => e.author === person.id);
  const heroes = mine.filter((e) => e.kind === "hero").length;
  const list = mine.map((e) => `<li><a href="${base}${e.kind === "hero" ? `heroes/#hero-${esc(e.id)}` : esc(urlOf(e.id))}">${esc(e.title)}</a> <small>${esc(title[e.theme])} · ${e.kind} · ${esc(e.date)}</small></li>`).join("\n        ");
  return `
<section class="section person" aria-labelledby="person-name">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${mine.length}</span> ${mine.length === 1 ? "ANIMATION" : "ANIMATIONS"}${heroes ? ` · ${heroes} ${heroes === 1 ? "HERO" : "HEROES"}` : ""}${person.role ? ` · ${esc(person.role.toUpperCase())}` : ""}</p>
      <h1 id="person-name" data-person="${esc(person.id)}">${esc(person.name)}</h1>
      <p class="lead">${esc(person.bio)}</p>
      ${person.url ? `<p><a class="gal-link" href="${esc(person.url)}">${icon("out", 16)}${esc(new URL(person.url).host)}</a></p>` : ""}
    </div>
    <div class="panel person-list">
      <h2>In the gallery</h2>
      <ol reversed>
        ${list}
      </ol>
    </div>
  </div>
</section>`;
}
