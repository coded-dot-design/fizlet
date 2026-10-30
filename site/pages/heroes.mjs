// The heroes page: the big animations, one large card each in a row that snaps card by card. The
// card in the centre plays; the others are their posters (site/gallery/heroes.ts). Each card wears
// its size badge (its gallery bundle, measured on this build) and says who made it.
import { esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { entryFigure, byLine } from "./gallery.mjs";

const fmt = (n) => n.toLocaleString("en-US");

export function heroesPage({ heroes, themes, people, loader, figures, base, urlOf }) {
  const title = Object.fromEntries(themes.map((t) => [t.id, t.title]));
  const cards = heroes.map((e, i) => {
    // The poster is the gallery's figure for the entry, without its gallery slot wiring.
    const fig = entryFigure(e, figures).replace(/ data-slot-target="[^"]*"/, "").replace("<figure ", `<figure data-hero-fig `).replace(/class="ae-slot(?: ae-slot--\w+)?/, '$& hero-fig');
    return `<li class="hero-card panel" id="hero-${esc(e.id)}" data-hero="${esc(e.id)}" data-demo-host aria-roledescription="slide" aria-label="${i + 1} of ${heroes.length}: ${esc(e.title)}">
        <div class="hero-stage" data-hero-stage>
          ${fig}
          <button class="bui-key hero-close" type="button" data-hero-close hidden>${icon("close", 16)}Close</button>
        </div>
        <div class="hero-meta">
          <p class="eyebrow"><span class="index">#${String(e.no).padStart(3, "0")}</span> ${esc(title[e.theme].toUpperCase())} · ${esc(e.date)}</p>
          <h2>${esc(e.title)}</h2>
          ${byLine(e, people, base, "hero-by")}
          <p class="hero-size">${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)} <span>total <b>${fmt(e.size + loader)} B</b> with the loader</span></p>
          <p class="hero-keys-row">
            <button class="bui-key" type="button" data-hero-play aria-pressed="false">${icon("play", 16)}Play</button>
            <button class="bui-key" type="button" data-hero-open aria-label="Full screen: ${esc(e.title)}">${icon("out", 16)}Full screen</button>
            <a class="bui-key" href="${base}${esc(urlOf(e.id))}">${icon("grid", 16)}Prompt and cost</a>
          </p>
        </div>
      </li>`;
  }).join("\n      ");
  return `
<section class="section heroes" aria-labelledby="hero-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${heroes.length}</span> HEROES · THE CENTRE ONE PLAYS</p>
      <h1 id="hero-title">The big ones.<br><em>One at a time.</em></h1>
      <p class="lead">The hero animations, large. The card in the middle plays; the rest wait as posters, costing nothing. Arrow keys or the keys below move a card; full screen for the whole show. Every one wears its size, measured on this build. <a href="${base}gallery/">Every animation is in the gallery</a>.</p>
    </div>
  </div>
  <div class="hero-row" role="region" aria-roledescription="carousel" aria-label="Hero animations">
    <div class="wrap hero-nav">
      <button class="bui-key" type="button" data-hero-prev aria-label="Previous hero">${icon("left", 16)}Prev</button>
      <button class="bui-key" type="button" data-hero-next aria-label="Next hero">Next${icon("right", 16)}</button>
    </div>
    <ul class="hero-track" data-hero-track tabindex="0" aria-label="Heroes: left and right arrow keys move a card">
      ${cards}
    </ul>
  </div>
</section>`;
}
