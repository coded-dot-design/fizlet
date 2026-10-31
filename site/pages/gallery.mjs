// The gallery: every animation, newest first. Each entry shows the prompt it was made from, the
// live demo (lazy-mounted through fizlet/slot) and its size, measured on this build: the live chunk
// on the badge and the total with the shared loader beside it (one size, both parts named).
// Entries, themes and contributors are data (site/gallery/entries, site/gallery/themes,
// site/contributors); `fe anim --publish` in the engine adds entries. Each page holds PAGE_SIZE
// entries (scripts/gallery.mjs paginate) in theme sections; a theme filter and a search over the
// generated index (gallery/index.json) sit on top (site/gallery/browse.ts).
import { crumbs, esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { sections } from "../../scripts/gallery.mjs";
import { CONTEST } from "../../scripts/people.mjs";

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

/** "by <name>", linked to the contributor's profile; studio crew or an AI agent is named as one (not a real person). */
const BY_KIND = { persona: "studio crew", agent: "AI agent" };
export const byLine = (e, people, base, cls = "gal-by") =>
  `<p class="${cls}">by <a href="${base}people/${esc(e.author)}/">${esc(people[e.author].name)}</a>${BY_KIND[people[e.author].kind] ? ` <small class="gal-persona">${BY_KIND[people[e.author].kind]}</small>` : ""}</p>`;

/** Days from date `a` to date `b` (YYYY-MM-DD, UTC). */
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
/** A card is NEW for a week from its date (the build's date: FIZLET_TODAY pins it). */
export const NEW_DAYS = 7;
export const isNew = (e, today) => !!today && days(e.date, today) >= 0 && days(e.date, today) < NEW_DAYS;

/**
 * A card's stickers, tilted on its corner like the people page's (one .ppl-sticker look): its
 * status (NEW this week, else APPROVED, with the owner's date; a pending entry never has a card),
 * WINNER, HERO and TOO BIG TO WIN. Each has its own accessible name.
 */
export function cardStickers(e, { today, winner = false, tooBig = false } = {}) {
  const s = (tone, text, label) => `<span class="gal-sticker gal-sticker-${tone}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${text}</span>`;
  const approved = e.approved ? `approved by the owner on ${e.approved}` : "";
  return [
    winner && s("win", `${icon("check", 14)}WINNER`, "Winner of its weekly contest"),
    isNew(e, today) ? s("new", "NEW", `New this week: made ${e.date}${approved ? `, ${approved}` : ""}`) : approved && s("ok", "APPROVED", `Approved: ${approved}`),
    e.kind === "hero" && s("hero", "HERO", "Hero: a large animation, also on the heroes page"),
    tooBig && s("big", "TOO BIG TO WIN", `Too big to win: ${fmt(e.size)} B live, over the contest's ${fmt(CONTEST.maxLive)} B cap`),
  ].filter(Boolean).join("");
}

const card = (e, { loader, figures, base, people, themeTitle, winners, tooBig = new Set(), snippets = {}, today }) => {
  const fig = entryFigure(e, figures).replace("<figure ", `<figure data-gallery="${esc(e.id)}" `);
  const measured = e.pageCost?.measured;
  const big = tooBig.has(e.id);
  const stickers = cardStickers(e, { today, winner: winners.has(e.id), tooBig: big });
  // The stat chips (the people page's .ppl-count): every number measured on this build.
  const chips = [
    `<li class="gal-badge">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)}</li>`,
    `<li data-live-bytes="gallery:${esc(e.id)}"><b>${fmt(e.size)} B</b> live</li>`,
    `<li data-total="gallery:${esc(e.id)}" title="The shared loader (${fmt(loader)} B) comes first, before the piece nears the screen; the live chunk after"><b>${fmt(e.size + loader)} B</b> total with the ${fmt(loader)} B loader</li>`,
    `<li><b>${e.bricks.length}</b> ${e.bricks.length === 1 ? "brick" : "bricks"}</li>`,
    big ? `<li class="gal-over"><b>+${fmt(e.size - CONTEST.maxLive)} B</b> over the ${fmt(CONTEST.maxLive)} B cap</li>` : "",
  ].join("");
  return `<li class="panel gal-item" id="${esc(e.id)}" data-demo-host data-kind="${esc(e.kind)}">
      <div class="gal-stage">${fig}</div>
      <div class="gal-meta">
        <p class="eyebrow gal-line"><span class="index">#${e.archived ? "A" : ""}${String(e.no).padStart(3, "0")}</span> ${esc(e.date)} · ${esc(themeTitle.toUpperCase())} · ${e.made === "fe anim" ? `MADE BY FE ANIM · RECIPE ${esc(e.recipe.toUpperCase())}` : "HAND-BUILT"}</p>
        <h3 class="gal-title">${esc(e.title)}</h3>${stickers ? `
        <p class="gal-stickers">${stickers}</p>` : ""}
        ${byLine(e, people, base)}
        <p class="gal-prompt"><span class="bui-label">${e.made === "fe anim" ? "PROMPT" : "BRIEF"}</span> “${esc(e.prompt)}”</p>
        <ul class="ppl-count gal-count" aria-label="What it costs the page, measured on this build">${chips}</ul>
        ${measured ? `<p class="gal-cost"><b>${measured.framesSettled}</b> frames a second once still · <b>${measured.framesOffscreen}</b> off screen · Recall ${measured.recallExact ? "exact" : "not exact"} <small>(Chromium ${esc(measured.chromium.split(".")[0])})</small></p>` : ""}
        <ul class="ppl-count gal-bricks" aria-label="Bricks used">${e.bricks.map((b) => `<li><code>${esc(b)}</code></li>`).join("")}</ul>
        ${snippets[e.id] ? `<p class="gal-keys"><a class="bui-key bui-arcade bui-go" href="${base}gallery/${esc(snippets[e.id].file)}" download="fizlet-${esc(e.id)}.html" data-snippet="${esc(e.id)}">${icon("down", 16)}Get the snippet</a><span>one drop-in file, <b>${fmt(snippets[e.id].size)} B</b> gzip · <a href="${base}make/?p=${encodeURIComponent(e.prompt)}">change the prompt</a></span></p>` : ""}
        ${e.link ? `<p><a class="gal-link" href="${base}${esc(e.link)}">${icon("out", 16)}See it on its own page</a></p>` : ""}
      </div>
    </li>`;
};

/**
 * One gallery page. `page`: this page ({ n, path, entries }); `pages`: every page; `all`: every
 * entry (newest first: the chips' counts and where each theme first appears); `themes` in order;
 * `winners`: ids of weekly-contest winners (site/contest/weeks), featured with the Winner badge;
 * `tooBig`: ids of contest entries over the size cap, which wear the Too big to win sticker;
 * `today`: the build's date (YYYY-MM-DD), for the NEW sticker.
 */
export function galleryPage({ page, pages, all, themes, people, loader, figures, snippets = {}, base, winners = new Set(), tooBig = new Set(), archived = 0, today }) {
  const firstPage = Object.fromEntries(themes.map((t) => [t.id, pages.find((p) => p.entries.some((e) => e.theme === t.id))]));
  const used = themes.filter((t) => firstPage[t.id]);
  const chips = [`<a class="bui-key gal-chip" href="${base}gallery/" data-theme-chip="all"${page.n === 1 ? ' aria-current="true"' : ""}>All <small>${all.length}</small></a>`,
    ...used.map((t) => `<a class="bui-key gal-chip" href="${base}${firstPage[t.id].path}#theme-${esc(t.id)}" data-theme-chip="${esc(t.id)}">${esc(t.title)} <small>${all.filter((e) => e.theme === t.id).length}</small></a>`)].join("");
  const title = Object.fromEntries(themes.map((t) => [t.id, t.title]));
  const secs = sections(page.entries, themes).map(({ theme: t, entries }) => `<section class="gal-theme" id="theme-${esc(t.id)}" data-theme-section="${esc(t.id)}" aria-labelledby="theme-${esc(t.id)}-h">
    <div class="gal-theme-head"><h2 id="theme-${esc(t.id)}-h">${esc(t.title)}</h2><p>${esc(t.blurb)}</p></div>
    <ol class="gal">
    ${entries.map((e) => card(e, { loader, figures, base, people, themeTitle: title[e.theme], winners, tooBig, snippets, today })).join("\n    ")}
    </ol>
  </section>`).join("\n  ");
  const nav = pages.length > 1 ? `<nav class="gal-pages" aria-label="Gallery pages">${pages.map((p) => p.n === page.n
    ? `<span class="gal-page-now" aria-current="page">${p.n}</span>`
    : `<a class="bui-key" href="${base}${p.path}"${p.n === page.n - 1 ? ' rel="prev"' : p.n === page.n + 1 ? ' rel="next"' : ""} aria-label="Gallery page ${p.n}">${p.n}</a>`).join("")}</nav>` : "";
  const heroes = all.filter((e) => e.kind === "hero").length;
  return `
<section class="section" aria-labelledby="gal-title">
  <div class="wrap">
    ${page.n > 1 ? crumbs(base, [["gallery/", "Gallery"]], `Page ${page.n}`) : ""}
    <div class="section-head">
      <p class="eyebrow"><span class="index">${all.length}</span> ANIMATIONS · NEWEST FIRST${pages.length > 1 ? ` · PAGE ${page.n} OF ${pages.length}` : ""}</p>
      <h1 id="gal-title">One prompt.<br><em>One animation.</em></h1>
      <p class="lead">A new animation from a simple prompt, made from Fizlet bricks. Each one shows the prompt it was made from, runs live once it nears the screen, and wears its size, measured on this build. Still once it settles, asleep off screen, and the page always comes back. Take any made from a prompt home as one file, or <a href="${base}make/">make your own</a>. By <a href="https://coded.design/">Chris Cooley ↗</a>${heroes ? ` · <a href="${base}heroes/">the ${heroes} heroes, big</a>` : ""}.${archived ? ` Earlier factory runs wait in <a href="${base}gallery/archive/" rel="nofollow">the archive</a>.` : ""}</p>
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
 * revisit. One page, by theme, no search; the page is noindex,nofollow (and linked with rel="nofollow") and out of the gallery's index.
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
    ${crumbs(base, [["gallery/", "Gallery"]], "Archive")}
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
