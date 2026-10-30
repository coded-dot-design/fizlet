// The gallery: every animation, newest first. Each entry shows the prompt it was made from, the
// live demo (lazy-mounted through fizlet/slot) and its size, measured on this build: the live chunk
// on the badge and the total with the shared loader beside it (one size, both parts named).
// Entries, themes and contributors are data (site/gallery/entries, site/gallery/themes,
// site/contributors); `fe anim --publish` in the engine adds entries. Each page holds PAGE_SIZE
// entries (scripts/gallery.mjs paginate) in theme sections; a theme filter and a search over the
// generated index (gallery/index.json) sit on top (site/gallery/browse.ts).
import { esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { sections } from "../../scripts/gallery.mjs";
import { winnerBadge } from "./people.mjs";

const fmt = (n) => n.toLocaleString("en-US");

/** A figure for an entry without a poster of its own: the prompt, as the still frame. */
export const plainFigure = (e) =>
  `<figure class="ae-slot gal-fig gal-tap" data-slot-target="gallery#${esc(e.id)}" role="img" aria-label="${esc(e.title)}: ${esc(e.prompt)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}"><span class="ae-slot__placeholder gal-still" aria-hidden="true">“${esc(e.prompt)}”</span></figure>`;

/**
 * A figure for a page scene (`stage: "page"`): a small page of real elements (headings, keys) the
 * scene reads and lights up through the ledger; Recall gives it back. It is the poster too.
 */
export const pageFigure = (e) =>
  `<figure class="ae-slot gal-fig gal-tap gal-page" data-slot-target="gallery#${esc(e.id)}" role="img" aria-label="${esc(e.title)}: ${esc(e.prompt)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}">` +
  `<span class="gal-mini" aria-hidden="true"><b class="gal-mini-h1" data-fizlet-heading>Hello, page.</b><span class="gal-mini-p">Real elements under a Fizlet scene.</span>` +
  `<b class="gal-mini-h2" data-fizlet-heading>Every heading is real</b><span class="gal-mini-row"><span class="gal-mini-key" data-fizlet-target>Hover me</span><span class="gal-mini-key" data-fizlet-target>Or me</span></span>` +
  `<b class="gal-mini-h2" data-fizlet-heading>Recall gives it back</b></span>` +
  `<span class="ae-slot__placeholder gal-cap" aria-hidden="true">“${esc(e.prompt)}”</span></figure>`;

/**
 * A figure for an entry with a stage of its own (`stage: "own"`): its markup, from
 * site/gallery/stages/<id>.html (read by scripts/gallery.mjs into `e.stageHtml`), is the poster and
 * the real elements its scene plays on. Every piece looks like itself; no shared page.
 */
export const ownFigure = (e) =>
  `<figure class="ae-slot gal-fig gal-tap gal-own" data-slot-target="gallery#${esc(e.id)}" role="img" aria-label="${esc(e.title)}: ${esc(e.prompt)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}">${e.stageHtml}</figure>`;

/** The figure for an entry: its own poster (`figures[e.figure]`), its own stage, a page scene or the prompt. */
export const entryFigure = (e, figures) => figures[e.figure] ?? (e.stage === "own" ? ownFigure : e.stage === "page" ? pageFigure : plainFigure)(e);

/** "by <name>", linked to the contributor's profile; a house persona is named as one (a character, not a real person). */
export const byLine = (e, people, base, cls = "gal-by") =>
  `<p class="${cls}">by <a href="${base}people/${esc(e.author)}/">${esc(people[e.author].name)}</a>${people[e.author].kind === "persona" ? ' <small class="gal-persona">house persona</small>' : ""}</p>`;

const card = (e, { loader, figures, base, people, themeTitle, winners }) => {
  const fig = entryFigure(e, figures).replace("<figure ", `<figure data-gallery="${esc(e.id)}" `);
  const measured = e.pageCost?.measured;
  const cost = [
    `<li>${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)} <span class="gal-total" data-total="gallery:${esc(e.id)}">live ${fmt(e.size)} B · total <b>${fmt(e.size + loader)} B</b> with the loader</span></li>`,
    `<li><b>${fmt(loader)} B</b> before it nears the screen (the shared loader)</li>`,
    measured ? `<li><b>${measured.framesSettled}</b> frames a second once still · <b>${measured.framesOffscreen}</b> off screen · Recall ${measured.recallExact ? "exact" : "not exact"} <small>(Chromium ${esc(measured.chromium.split(".")[0])})</small></li>` : "",
  ].join("");
  return `<li class="panel gal-item" id="${esc(e.id)}" data-demo-host data-kind="${esc(e.kind)}">
      <div class="gal-stage">${fig}</div>
      <div class="gal-meta">
        <p class="eyebrow"><span class="index">#${e.archived ? "A" : ""}${String(e.no).padStart(3, "0")}</span> ${esc(e.date)} · ${e.kind === "hero" ? "HERO · " : ""}${esc(themeTitle.toUpperCase())} · ${e.made === "fe anim" ? `MADE BY FE ANIM · RECIPE ${esc(e.recipe.toUpperCase())}` : "HAND-BUILT"}</p>
        <h3>${esc(e.title)}${winners.has(e.id) ? ` ${winnerBadge()}` : ""}</h3>
        ${byLine(e, people, base)}
        <p class="gal-prompt"><span class="bui-label">${e.made === "fe anim" ? "PROMPT" : "BRIEF"}</span> “${esc(e.prompt)}”</p>
        <ul class="gal-cost" aria-label="What it costs the page">${cost}</ul>
        <p class="gal-bricks">${e.bricks.map((b) => `<code>${esc(b)}</code>`).join(" ")}</p>
        ${e.link ? `<p><a class="gal-link" href="${base}${esc(e.link)}">${icon("out", 16)}See it on its own page</a></p>` : ""}
      </div>
    </li>`;
};

/**
 * One gallery page. `page`: this page ({ n, path, entries }); `pages`: every page; `all`: every
 * entry (newest first: the chips' counts and where each theme first appears); `themes` in order;
 * `winners`: ids of daily-contest winners (site/contest/days), featured with the Winner badge.
 */
export function galleryPage({ page, pages, all, themes, people, loader, figures, base, winners = new Set(), archived = 0 }) {
  const firstPage = Object.fromEntries(themes.map((t) => [t.id, pages.find((p) => p.entries.some((e) => e.theme === t.id))]));
  const used = themes.filter((t) => firstPage[t.id]);
  const chips = [`<a class="bui-key gal-chip" href="${base}gallery/" data-theme-chip="all"${page.n === 1 ? ' aria-current="true"' : ""}>All <small>${all.length}</small></a>`,
    ...used.map((t) => `<a class="bui-key gal-chip" href="${base}${firstPage[t.id].path}#theme-${esc(t.id)}" data-theme-chip="${esc(t.id)}">${esc(t.title)} <small>${all.filter((e) => e.theme === t.id).length}</small></a>`)].join("");
  const title = Object.fromEntries(themes.map((t) => [t.id, t.title]));
  const secs = sections(page.entries, themes).map(({ theme: t, entries }) => `<section class="gal-theme" id="theme-${esc(t.id)}" data-theme-section="${esc(t.id)}" aria-labelledby="theme-${esc(t.id)}-h">
    <div class="gal-theme-head"><h2 id="theme-${esc(t.id)}-h">${esc(t.title)}</h2><p>${esc(t.blurb)}</p></div>
    <ol class="gal">
    ${entries.map((e) => card(e, { loader, figures, base, people, themeTitle: title[e.theme], winners })).join("\n    ")}
    </ol>
  </section>`).join("\n  ");
  const nav = pages.length > 1 ? `<nav class="gal-pages" aria-label="Gallery pages">${pages.map((p) => p.n === page.n
    ? `<span class="gal-page-now" aria-current="page">${p.n}</span>`
    : `<a class="bui-key" href="${base}${p.path}"${p.n === page.n - 1 ? ' rel="prev"' : p.n === page.n + 1 ? ' rel="next"' : ""} aria-label="Gallery page ${p.n}">${p.n}</a>`).join("")}</nav>` : "";
  const heroes = all.filter((e) => e.kind === "hero").length;
  return `
<section class="section" aria-labelledby="gal-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${all.length}</span> ANIMATIONS · NEWEST FIRST${pages.length > 1 ? ` · PAGE ${page.n} OF ${pages.length}` : ""}</p>
      <h1 id="gal-title">One prompt.<br><em>One animation.</em></h1>
      <p class="lead">A new animation from a simple prompt, made from Fizlet bricks. Each one shows the prompt it was made from, runs live once it nears the screen, and wears its size, measured on this build. Still once it settles, asleep off screen, and the page always comes back. By <a href="https://coded.design/">Chris Cooley</a>${heroes ? ` · <a href="${base}heroes/">the ${heroes} heroes, big</a>` : ""}.${archived ? ` Earlier factory runs wait in <a href="${base}gallery/archive/">the archive</a>.` : ""}</p>
    </div>
    <nav class="gal-themes" aria-label="Themes">${chips}</nav>
    <form class="gal-search" role="search" data-gal-search data-base="${base}" hidden>
      <label class="bui-label" for="gal-q">SEARCH</label>
      <input id="gal-q" type="search" name="q" autocomplete="off" placeholder="title, prompt, theme or author">
      <p class="gal-found" role="status" aria-live="polite" data-gal-found></p>
      <ul class="gal-results" data-gal-results></ul>
    </form>
  </div>
  <div class="wrap gal-sections">
  ${secs}
    ${nav}
  </div>
</section>`;
}

/**
 * The archive: earlier entries taken off the gallery (most were recipe palette swaps), kept to
 * revisit. One page, by theme, no search; the page is noindex and out of the gallery's index.
 */
export function archivePage({ entries, themes, people, loader, figures, base }) {
  const title = Object.fromEntries(themes.map((t) => [t.id, t.title]));
  const secs = sections(entries, themes).map(({ theme: t, entries: list }) => `<section class="gal-theme" id="theme-${esc(t.id)}" aria-labelledby="theme-${esc(t.id)}-h">
    <div class="gal-theme-head"><h2 id="theme-${esc(t.id)}-h">${esc(t.title)}</h2><p>${esc(t.blurb)}</p></div>
    <ol class="gal">
    ${list.map((e) => card(e, { loader, figures, base, people, themeTitle: title[e.theme], winners: new Set() })).join("\n    ")}
    </ol>
  </section>`).join("\n  ");
  return `
<section class="section" aria-labelledby="gal-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${entries.length}</span> ARCHIVED · NOT IN THE GALLERY</p>
      <h1 id="gal-title">The archive.</h1>
      <p class="lead">Earlier factory runs, taken off <a href="${base}gallery/">the gallery</a> to keep it to the good ones. Kept here to revisit: each still runs live and wears its size, measured on this build.</p>
    </div>
  </div>
  <div class="wrap gal-sections">
  ${secs}
  </div>
</section>`;
}
