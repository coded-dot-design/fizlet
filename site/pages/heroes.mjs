// The heroes page: the games' own landing heroes, one large card each in a row that snaps card by
// card. Only the heroes in site/heroes/heroes.json render here (the allow-list; gallery entries never
// do). The card in the centre plays: its stage (site-dist/heroes/<id>/stage.html, the game's own
// hero, vendored at a pinned commit and running on Fizlet) mounts in the card while it is centred
// and on screen, and goes away otherwise; every other card is its still poster (site/gallery/heroes.ts).
// Each card wears its size badge (the stage's live code, measured on this build) and links to its game.
import { esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";

const fmt = (n) => n.toLocaleString("en-US");

/** A hero's poster figure: the game's own still frame, light and dark (the stage mounts over it). */
export const heroFigure = (h, base) =>
  `<figure class="ae-slot hero-fig hero-game" data-hero-fig role="img" aria-label="${esc(h.title)}: ${esc(h.about)}">` +
  ["dark", "light"].map((t) => `<img class="ae-slot__placeholder hero-poster hero-poster--${t}" src="${base}heroes/${esc(h.id)}/poster-${t}.jpg" alt="" width="1280" height="800" loading="lazy" decoding="async">`).join("") +
  `</figure>`;

export function heroesPage({ heroes, budget, base, owner }) {
  const cards = heroes.map((h, i) => `<li class="hero-card panel" id="hero-${esc(h.id)}" data-hero="${esc(h.id)}" data-stage="${base}${esc(h.path)}" data-stage-title="${esc(h.title)}: the game's own hero" data-demo-host aria-roledescription="slide" aria-label="${i + 1} of ${heroes.length}: ${esc(h.title)}">
        <div class="hero-stage" data-hero-stage>
          ${heroFigure(h, base)}
          <button class="bui-key hero-close" type="button" data-hero-close hidden>${icon("close", 16)}Close</button>
        </div>
        <div class="hero-meta">
          <p class="eyebrow"><span class="index">${String(i + 1).padStart(2, "0")}</span> THE GAME'S OWN HERO · ${esc(h.repo.split("/")[1].toUpperCase())} @ ${esc(h.short)}</p>
          <h2>${esc(h.title)}. <em>${esc(h.line)}</em></h2>
          <p class="hero-by">by <a href="${base}people/${esc(owner.id)}/">${esc(owner.name)}</a></p>
          <p class="hero-about">${esc(h.about)}</p>
          <p class="hero-size">${sizeBadge(h.live, h.path.replace(/stage\.html$/, "stage.js"), `${h.title}, the game's own hero, its live code`)} <span>live <b>${fmt(h.live)} B</b> · its markup and CSS <b>${fmt(h.doc)} B</b>. The game's own hero, ${h.live > budget ? `over the ${fmt(budget)} B budget for scenes made for fizlet.com` : `inside the ${fmt(budget)} B budget for scenes made for fizlet.com`}.</span></p>
          <p class="hero-keys-row">
            <button class="bui-key" type="button" data-hero-play aria-pressed="false">${icon("play", 16)}Play</button>
            <button class="bui-key" type="button" data-hero-open aria-label="Full screen: ${esc(h.title)}">${icon("out", 16)}Full screen</button>
            <a class="bui-key bui-go" href="${esc(h.game)}">${icon("grid", 16)}Play ${esc(h.title)} ↗</a>
            <a class="hero-alone" href="${base}${esc(h.path)}" rel="nofollow">${esc(h.title)}: the hero on its own</a>
          </p>
        </div>
      </li>`).join("\n      ");
  return `
<section class="section heroes" aria-labelledby="hero-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${heroes.length}</span> HEROES · THE CENTRE ONE PLAYS</p>
      <h1 id="hero-title">The big ones.<br><em>One at a time.</em></h1>
      <p class="lead">The games' own landing heroes, running on Fizlet: each one vendored from its game at a pinned commit, never redrawn. The card in the middle plays; the rest wait as posters, costing nothing. Arrow keys or the keys below move a card; full screen for the whole show. Nothing in a hero leaves this page: its links are for show. Every one wears its size, measured on this build. <a href="${base}gallery/">The micro animations are in the gallery</a>.</p>
    </div>
  </div>
  <div class="hero-row" role="region" aria-roledescription="carousel" aria-label="Hero animations">
    <div class="wrap hero-nav">
      <button class="bui-key" type="button" data-hero-prev aria-label="Previous hero" disabled>${icon("left", 16)}Prev</button>
      <button class="bui-key" type="button" data-hero-next aria-label="Next hero">Next${icon("right", 16)}</button>
    </div>
    <ul class="hero-track" data-hero-track tabindex="0" aria-label="Heroes: left and right arrow keys move a card">
      ${cards}
    </ul>
  </div>
</section>`;
}
