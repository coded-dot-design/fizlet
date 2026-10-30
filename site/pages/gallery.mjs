// The gallery: every animation, newest first. Each entry shows the prompt it was made from, the
// live demo (lazy-mounted through fizlet/slot) and its size, measured on this build: the live chunk
// on the badge and the total with the shared loader beside it (one size, both parts named).
// Entries are data (site/gallery/entries/*.json); `fe anim --publish` in the engine adds new ones.
import { esc, icon } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";

const fmt = (n) => n.toLocaleString("en-US");

/** A figure for an entry without a poster of its own: the prompt, as the still frame. */
const plainFigure = (e) =>
  `<figure class="ae-slot gal-fig gal-tap" data-slot-target="gallery#${esc(e.id)}" role="img" aria-label="${esc(e.title)}: ${esc(e.prompt)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}"><span class="ae-slot__placeholder gal-still" aria-hidden="true">“${esc(e.prompt)}”</span></figure>`;

/**
 * A figure for a page scene (`stage: "page"`): a small page of real elements (headings, keys) the
 * scene reads and lights up through the ledger; Recall gives it back. It is the poster too.
 */
const pageFigure = (e) =>
  `<figure class="ae-slot gal-fig gal-tap gal-page" data-slot-target="gallery#${esc(e.id)}" role="img" aria-label="${esc(e.title)}: ${esc(e.prompt)}" style="aspect-ratio: ${esc(e.aspect ?? "16 / 9")}">` +
  `<span class="gal-mini" aria-hidden="true"><b class="gal-mini-h1" data-fizlet-heading>Hello, page.</b><span class="gal-mini-p">Real elements under a Fizlet scene.</span>` +
  `<b class="gal-mini-h2" data-fizlet-heading>Every heading is real</b><span class="gal-mini-row"><span class="gal-mini-key" data-fizlet-target>Hover me</span><span class="gal-mini-key" data-fizlet-target>Or me</span></span>` +
  `<b class="gal-mini-h2" data-fizlet-heading>Recall gives it back</b></span>` +
  `<span class="ae-slot__placeholder gal-cap" aria-hidden="true">“${esc(e.prompt)}”</span></figure>`;

export function galleryPage({ entries, loader, figures, base }) {
  const cards = entries.map((e) => {
    const fig = (figures[e.figure] ?? (e.stage === "page" ? pageFigure : plainFigure)(e)).replace("<figure ", `<figure data-gallery="${esc(e.id)}" `);
    const measured = e.pageCost?.measured;
    const cost = [
      `<li>${sizeBadge(e.size, `gallery/${e.id}.js`, `${e.title}, its live chunk`)} <span class="gal-total" data-total="gallery:${esc(e.id)}">live ${fmt(e.size)} B · total <b>${fmt(e.size + loader)} B</b> with the loader</span></li>`,
      `<li><b>${fmt(loader)} B</b> before it nears the screen (the shared loader)</li>`,
      measured ? `<li><b>${measured.framesSettled}</b> frames a second once still · <b>${measured.framesOffscreen}</b> off screen · Recall ${measured.recallExact ? "exact" : "not exact"} <small>(Chromium ${esc(measured.chromium.split(".")[0])})</small></li>` : "",
    ].join("");
    return `<li class="panel gal-item" id="${esc(e.id)}" data-demo-host>
      <div class="gal-stage">${fig}</div>
      <div class="gal-meta">
        <p class="eyebrow"><span class="index">#${String(e.no).padStart(3, "0")}</span> ${esc(e.date)} · ${e.made === "fe anim" ? `MADE BY FE ANIM · RECIPE ${esc(e.recipe.toUpperCase())}` : "HAND-BUILT"}</p>
        <h2>${esc(e.title)}</h2>
        <p class="gal-prompt"><span class="bui-label">${e.made === "fe anim" ? "PROMPT" : "BRIEF"}</span> “${esc(e.prompt)}”</p>
        <ul class="gal-cost" aria-label="What it costs the page">${cost}</ul>
        <p class="gal-bricks">${e.bricks.map((b) => `<code>${esc(b)}</code>`).join(" ")}</p>
        ${e.link ? `<p><a class="gal-link" href="${base}${esc(e.link)}">${icon("out", 16)}See it on its own page</a></p>` : ""}
      </div>
    </li>`;
  }).join("\n    ");
  return `
<section class="section" aria-labelledby="gal-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">${entries.length}</span> ANIMATIONS · NEWEST FIRST</p>
      <h1 id="gal-title">One prompt.<br><em>One animation.</em></h1>
      <p class="lead">A new animation from a simple prompt, made from Fizlet bricks. Each one shows the prompt it was made from, runs live once it nears the screen, and wears its size, measured on this build. Still once it settles, asleep off screen, and the page always comes back. By <a href="https://coded.design/">Chris Cooley</a>.</p>
    </div>
    <ol class="gal" reversed>
    ${cards}
    </ol>
  </div>
</section>`;
}
