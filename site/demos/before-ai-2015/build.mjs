// Build demos/before-ai-2015/ into site-dist/: the interactive companion to the note "Before AI:
// 2015" (notes/before-ai-2015/). Run after scripts/site.mjs builds the shell (it imports this).
// Three columns, live: the 2015 CSS sprites (css/sprites.css byte for byte from the 2015 app CSS, and
// the 4-line class toggle that replaced Angular), Fizlet with the same behaviour, Fizlet better. The
// sprite sheets and the icon font are Chris Cooley's 2015 originals, under app-assets/ with their
// 2015 hashed names. The timeline is drawn from timeline.json (confirmed entries only).
// Every number on the page is measured here, at build time: the gzip bytes of the files it ships.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { page, crumbs, esc } from "../../layout.mjs";

const OUT = "site-dist/demos/before-ai-2015", DIR = "site/demos/before-ai-2015";
const PATH = "demos/before-ai-2015/", NOTE = "notes/before-ai-2015/";
const WAYBACK = "https://web.archive.org/web/20150423171151/http://chriscooley.me/projects/css-animations";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
mkdirSync(OUT, { recursive: true });
cpSync(`${DIR}/css`, `${OUT}/css`, { recursive: true });
cpSync(`${DIR}/app-assets`, `${OUT}/app-assets`, { recursive: true });

await build({ entryPoints: { before: `${DIR}/main.ts` }, outdir: OUT, bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning" });
const gz = (f) => gzipSync(readFileSync(f)).length;
// The 2015 toggle, verbatim from the 2015 page rebuild: ng-click flipped a boolean, ng-class added or
// removed one class. It runs as written (scoped to [data-toggle], which only the 2015 column uses).
const TOGGLE = `document.addEventListener('click', function (e) {
  var sw = e.target.closest('[data-toggle]');
  if (sw) sw.parentNode.classList.toggle(sw.getAttribute('data-toggle'));
});`;
const fizCss = readFileSync(`${DIR}/same.css`, "utf8") + readFileSync(`${DIR}/better.css`, "utf8");
export const sizes = {
  js: gz(`${OUT}/before.js`),
  css2015: gz(`${OUT}/css/sprites.css`),
  toggle: gzipSync(TOGGLE).length,
  fizCss: gzipSync(fizCss).length,
};

// ---------- The timeline: confirmed entries only, the long gap drawn as a break ----------
const { entries } = JSON.parse(readFileSync(`${DIR}/timeline.json`, "utf8"));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const at = (d) => Date.parse(d.length === 7 ? `${d}-01T00:00Z` : d.length === 10 ? `${d}T00:00Z` : d);
const ymd = (d) => d.slice(0, 10).split("-").map(Number);
/** "December 2014", "23 April 2015", "31 October 2026, 09:00 Central". */
const when = (e) => {
  const [y, m, day] = ymd(e.date);
  const time = e.date.length > 10 ? `, ${e.date.slice(11, 16)}${e.zone ? " " + e.zone : ""}` : "";
  return day ? `${day} ${MONTHS[m - 1]} ${y}${time}` : `${MONTHS[m - 1]} ${y}`;
};
/** Whole years and months from a to b ("11 years, 6 months"). */
const span = (a, b) => {
  const [y0, m0, d0 = 1] = ymd(a), [y1, m1, d1 = 1] = ymd(b);
  const months = (y1 - y0) * 12 + (m1 - m0) - (d1 < d0 ? 1 : 0), y = Math.floor(months / 12), m = months % 12;
  return [y && `${y} year${y > 1 ? "s" : ""}`, m && `${m} month${m > 1 ? "s" : ""}`].filter(Boolean).join(", ");
};
const shown = entries.filter((e) => e.confirmed === true).sort((a, b) => at(a.date) - at(b.date));
export const hidden = entries.filter((e) => e.confirmed !== true);
const YEAR = 365.25 * 864e5, t0 = at(shown[0].date), t1 = at(shown.at(-1).date);
const pct = (t) => (((t - t0) / (t1 - t0)) * 100).toFixed(2);
// The to-scale rail: one dot per entry at its true place; dots closer than 3% stack upward.
let lastX = -9, lift = 0;
const dots = shown.map((e, i) => {
  const x = Number(pct(at(e.date)));
  lift = x - lastX < 3 ? lift + 1 : 0;
  lastX = x;
  return `<span class="bt-dot" style="left:${x}%;--lift:${lift}">${i + 1}</span>`;
}).join("");
const years = [];
for (let y = new Date(t0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= t1; y++) years.push(`<span style="left:${pct(Date.UTC(y, 0, 1))}%">${y % 5 ? "" : y}</span>`);
const items = shown.map((e, i) => {
  const gap = i && at(e.date) - at(shown[i - 1].date) > YEAR ? span(shown[i - 1].date, e.date) : "";
  const source = e.href ? `<a href="${esc(e.href)}">${esc(e.source)} ↗</a>` : esc(e.source);
  return `<li${gap ? ' class="bt-after-gap"' : ""}>${gap ? `<p class="bt-gap"><span aria-hidden="true">≈ ≈</span> ${gap} later</p>` : ""}<span class="bt-n" aria-hidden="true">${i + 1}</span><time datetime="${esc(e.date)}">${esc(when(e))}</time><b>${esc(e.label)}</b><small>Source: ${source}</small></li>`;
}).join("");
const timeline = `<figure class="bt-time">
      <div class="bt-scale" aria-hidden="true"><p class="bt-scale-cap">To scale, ${new Date(t0).getUTCFullYear()} to ${new Date(t1).getUTCFullYear()}: one dot per moment below.</p><div class="bt-rail">${dots}</div><div class="bt-years">${years.join("")}</div></div>
      <ol class="bt-list">${items}</ol>
      <figcaption>Dates come from the sources named on each one. Moments still to confirm with Chris are left off until he does.</figcaption>
    </figure>`;

const fmt = (n) => n.toLocaleString("en-GB");
const CSS = `<link rel="stylesheet" href="css/sprites.css">
<style>
${readFileSync(`${DIR}/kit-reset.css`, "utf8")}
${fizCss}
${readFileSync(`${DIR}/page.css`, "utf8")}
</style>`;

const body = `${CSS}
<section class="bt" aria-labelledby="bt-title">
  <div class="wrap">
    ${crumbs("../../", [["notes/", "Notes"], [NOTE, "Before AI: 2015"]], "The three, live")}
    <p class="eyebrow"><span class="index">2015</span> BEFORE AI · THE INTERACTIVE COMPANION</p>
    <h1 id="bt-title" class="bt-title">Drawn by hand in 2015.<br><em>Rebuilt in Fizlet.</em></h1>
    <p class="lead">In 2015, years before AI coding tools, Chris Cooley drew three micro animations frame by frame and played them with CSS sprites: headphones that plug in and play, a coffee cup that fills, a laptop that opens and types. The Wayback Machine kept them. Here they are live, beside the same three on Fizlet.</p>
    <p class="lead">By <a href="https://coded.design/">Chris Cooley ↗</a> · <a href="../../${NOTE}">Read the note: Before AI: 2015</a></p>

    <h2 class="bt-h">Three versions.<br><em>Same sprite sheets.</em></h2>
    <p class="bt-how">Press the red switch on the headphones, the cup and the laptop screen in each column.</p>
    <div class="bt-row">
      <div class="bt-cell bt-2015">
        <h3>2015 · CSS sprites</h3>
        <div class="bt-stage">
          <div class="beats paused"><div class="switch" data-toggle="paused"></div></div>
          <div class="desk">
            <div class="comp close"><button class="switch" data-toggle="close" aria-label="Open or close the 2015 laptop"></button></div>
            <div class="coffee drinkMe"><button class="switch" data-toggle="drinkMe" aria-label="Fill or drink the 2015 coffee"></button></div>
          </div>
        </div>
        <p class="bt-cap">The 2015 CSS, byte for byte, and the 4-line class toggle that stood in for Angular's <code>ng-click</code>. The headphone switch is a <code>div</code>, as it was: mouse only.</p>
      </div>
      <div class="bt-cell bt-same fz-same">
        <h3>Fizlet · same behaviour</h3>
        <div class="bt-stage">
          <div class="fz-beats paused"><div class="switch"></div></div>
          <div class="desk">
            <div class="fz-comp close"><button class="switch" aria-label="Open or close the laptop"></button></div>
            <div class="fz-coffee drinkMe"><button class="switch" aria-label="Fill or drink the coffee"></button></div>
          </div>
        </div>
        <p class="bt-cap">Same frames, timings and clicks. The kernel owns the clock instead of <code>@keyframes</code>, and sleeps when nothing moves.</p>
      </div>
      <div class="bt-cell bt-better fz-better">
        <h3>Fizlet · better</h3>
        <div class="bt-stage">
          <div class="fz-beats"><button type="button" aria-pressed="false" aria-label="Play the music"><svg class="fz-i-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z"/></svg><svg class="fz-i-pause" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg></button></div>
          <div class="desk">
            <div class="fz-comp"><button type="button" aria-label="Open the laptop"></button></div>
            <div class="fz-coffee"><button type="button" aria-label="Fill the cup"></button></div>
          </div>
        </div>
        <p class="bt-cap">Notes rise while the music plays. Real buttons for keyboard and screen readers. Click mid-move and it turns back from that frame. The code scrolls three times, then rests.</p>
      </div>
    </div>
    <p class="bt-note">Reduced motion: the 2015 and same-behaviour columns hold their first frame (a wrapper rule on this page; 2015 had none), and the better column lands each press on its still frame. At rest the page asks for no animation frames; the site's tests count them on every build. Measured on this build: the 2015 CSS is <b>${fmt(sizes.css2015)} B</b> gzip, plus the toggle at <b>${fmt(sizes.toggle)} B</b>; both Fizlet columns ship as one script, <b>${fmt(sizes.js)} B</b> gzip (kernel, <code>fizlet/fx</code> and the two versions), plus <b>${fmt(sizes.fizCss)} B</b> of CSS. The sprite sheets are the same files in all three.</p>
    <details class="bt-code"><summary>The 2015 toggle, all 4 lines</summary><pre><code>${esc(TOGGLE)}</code></pre></details>

    <h2 class="bt-h">Eleven years.<br><em>One line.</em></h2>
    ${timeline}

    <h2 class="bt-h">The 2015 page.<br><em>Still on the archive.</em></h2>
    <div class="bt-portal-wrap">
      <a class="bt-portal" href="${WAYBACK}" target="_blank" rel="noopener"><span class="bt-tape" aria-hidden="true">UNDER CONSTRUCTION</span><span class="bt-rad" aria-hidden="true">☢</span><span class="bt-portal-text">Open the 2015 capture on the Wayback Machine ↗</span><span class="bt-tape bt-tape-low" aria-hidden="true">BEST VIEWED IN 2015</span></a>
      <p class="bt-cap">Captured 23 April 2015 at chriscooley.me/projects/css-animations. Opens in a new tab.</p>
    </div>
  </div>
</section>
<script>
${TOGGLE}
</script>`;

writeFileSync(`${OUT}/index.html`, page({
  title: "Before AI: 2015, three sprites live · Fizlet",
  description: "Three CSS sprite animations Chris Cooley drew by hand in 2015, live beside two Fizlet rebuilds, with the timeline from 2015 to launch.",
  base: "../../", version, path: PATH, body, scripts: ["site.js", `${PATH}before.js`],
}));
writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes));
console.log(`Built ${OUT}/: before.js ${sizes.js} B gzip, 2015 CSS ${sizes.css2015} B gzip; timeline ${shown.length} shown, ${hidden.length} waiting for Chris`);
