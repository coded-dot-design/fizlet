// Build demos/before-ai-2015/ into site-dist/: the interactive companion to the note "Before AI:
// 2015" (notes/before-ai-2015/). Run after scripts/site.mjs builds the shell (it imports this).
// Three columns, live: the 2015 CSS sprites (css/sprites.css byte for byte from the 2015 app CSS, and
// the 4-line class toggle that replaced Angular), the Fizlet remake (same behaviour), the Fizlet
// arcade (the same art, ×100 alive: fizlet/fx, fizlet/sound, fizlet/hud), and under them a dissection
// of each: the 2015 sprite process (the sheets with their frames marked, the @keyframes, the class
// swap), then the bricks each Fizlet column uses with their sizes. The
// sprite sheets and the icon font are Chris Cooley's 2015 originals, under app-assets/ with their
// 2015 hashed names. The timeline is drawn from timeline.json (confirmed entries only).
// Every number on the page is measured here, at build time: the gzip bytes of the files it ships.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { page, crumbs, esc } from "../../layout.mjs";
import { BUDGETS } from "../../../scripts/sizes.mjs";

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
const sameCss = readFileSync(`${DIR}/same.css`, "utf8"), arcadeCss = readFileSync(`${DIR}/arcade.css`, "utf8");
const fizCss = sameCss + arcadeCss;
// Each Fizlet column on its own: the same bundle settings as the page script, one column per entry,
// so each number is what that column alone would ship (kernel and bricks tree-shaken as it uses them).
const alone = async (fn, sel) => {
  const res = await build({ stdin: { contents: `import { ${fn} } from "./${fn}"; ${fn}(document.querySelector("${sel}"));`, resolveDir: DIR, loader: "ts" }, bundle: true, minify: true, write: false, format: "esm", target: "es2022", legalComments: "none", logLevel: "silent" });
  return gzipSync(res.outputFiles[0].contents).length;
};
// The bricks as the size table on the home page and `npm run size` measure them (scripts/sizes.mjs:
// the whole brick, minified + gzipped, everything it pulls in).
const brick = async (name) => {
  const entry = BUDGETS.find(([n]) => n === name)[1];
  const res = await build({ entryPoints: [entry], bundle: true, minify: true, write: false, logLevel: "silent", format: "esm", target: "es2022" });
  return gzipSync(res.outputFiles[0].contents).length;
};
const SHEETS = "app-assets/images/animations/";
export const sizes = {
  js: gz(`${OUT}/before.js`),
  css2015: gz(`${OUT}/css/sprites.css`),
  toggle: gzipSync(TOGGLE).length,
  fizCss: gzipSync(fizCss).length,
  sameJs: await alone("same", ".bt-same"),
  sameCss: gzipSync(sameCss).length,
  arcadeJs: await alone("arcade", ".bt-arcade"),
  arcadeCss: gzipSync(arcadeCss).length,
  bricks: Object.fromEntries(await Promise.all(["fizlet (kernel)", "fizlet/fx", "fizlet/sound", "fizlet/hud"].map(async (n) => [n, await brick(n)]))),
  sheets: Object.fromEntries(["88597e86.beats.png", "2deb5381.coffee.png", "136aceff.computer.svg"].map((f) => [f, statSync(`${DIR}/${SHEETS}${f}`).size])),
  font: statSync(`${DIR}/app-assets/fonts/77bdc9dc.chriscooley.woff`).size,
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

// ---------- The dissection: what each column is made of, and what it weighs ----------
// 2015: the old-school sprite process. Each sheet is shown whole, scaled down, frames numbered at
// their true boundaries; beside it the rules that play it, copied from css/sprites.css (unprefixed).
const SPRITES = readFileSync(`${DIR}/css/sprites.css`, "utf8"), LINES = SPRITES.split("\n");
const anim = (sel) => `${sel}{animation:${LINES.find((l) => l.startsWith(sel + "{") && /[;{]animation:/.test(l)).match(/[;{]animation:([^;}]+)/)[1]}}`;
const keys = (name) => SPRITES.match(new RegExp(`(?<!-webkit-)@keyframes ${name}\\{.*?\\}\\}`))[0];
const STRIPS = [
  { name: "Headphones", file: "88597e86.beats.png", n: 29, fw: 300, w: 8700, h: 300, k: 0.2, swap: "paused", rules: [anim(".beats"), ".beats.paused{animation-play-state:paused}", keys("beatsPlug"), keys("beatsOn")] },
  { name: "Coffee", file: "2deb5381.coffee.png", n: 12, fw: 84, w: 1008, h: 168, rows: 2, k: 0.75, swap: "drinkMe", rules: [anim(".coffee"), anim(".coffee.drinkMe"), keys("coffeeFill"), keys("coffeeDrink")] },
  { name: "Laptop", file: "136aceff.computer.svg", n: 30, fw: 210, w: 6300, h: 210, k: 0.3, swap: "close", rules: [anim(".comp"), anim(".comp.close"), keys("comp"), keys("compType"), keys("compScroll"), keys("compOut")] },
];
const reels = STRIPS.map((t) => {
  const fw = t.fw * t.k, box = (t.h / (t.rows ?? 1)) * t.k;
  const marks = Array.from({ length: t.n }, (_, i) => `<span style="left:${(i * fw).toFixed(1)}px">${i}</span>`).join("");
  return `<figure class="bt-sheet">
          <figcaption><b>${t.name}</b> · <code>${t.file.replace(/^\w+\./, "")}</code> · ${t.n} frames × ${t.fw} px = ${fmt(t.w)} px wide · ${fmt(sizes.sheets[t.file])} B</figcaption>
          <div class="bt-film" tabindex="0" role="img" aria-label="The ${t.name.toLowerCase()} sheet: ${t.n} frames, ${t.fw} px each, side by side"><div class="bt-reel" style="width:${(t.n * fw).toFixed(1)}px;height:${box.toFixed(1)}px;--fw:${fw.toFixed(1)}px;background-image:url(${SHEETS}${t.file});background-size:${(t.w * t.k).toFixed(1)}px ${(t.h * t.k).toFixed(1)}px">${marks}</div></div>
          <pre><code>${esc(t.rules.join("\n"))}</code></pre>
          <p class="bt-swap">The click: the toggle flips <code>.${t.swap}</code>, which swaps the <code>animation</code> and restarts it.</p>
        </figure>`;
}).join("\n        ");
const kb = (n) => `${fmt(n)} B`;
const row = (a, b) => `<tr><th scope="row">${a}</th><td>${b}</td></tr>`;
const B = sizes.bricks;
const dissection = `<div class="bt-dis-row">
      <article class="bt-dis">
        <h3>2015 · CSS sprites</h3>
        <p class="bt-bricks">Bricks: none. CSS and 4 lines.</p>
        <table class="bt-sizes"><tbody>
          ${row("sprites.css, gzip", kb(sizes.css2015))}
          ${row("the 4-line toggle, gzip", kb(sizes.toggle))}
          ${row("<b>code, gzip</b>", `<b>${kb(sizes.css2015 + sizes.toggle)}</b>`)}
          ${row("3 sprite sheets", kb(Object.values(sizes.sheets).reduce((a, b) => a + b, 0)))}
          ${row("icon font (the play switch)", kb(sizes.font))}
        </tbody></table>
        <p>The process: draw every frame by hand, lay the frames side by side on one long sheet, then show the sheet through a box one frame wide. <code>@keyframes</code> slide <code>background-position</code> from the first frame to the last, and <code>steps(n)</code> makes it jump frame to frame instead of gliding. A click toggles one class, which swaps the animation.</p>
        ${reels}
        <details class="bt-code"><summary>The 2015 toggle, all 4 lines</summary><pre><code>${esc(TOGGLE)}</code></pre></details>
      </article>
      <article class="bt-dis">
        <h3>Fizlet · remake</h3>
        <p class="bt-bricks">Bricks: the kernel. Nothing else.</p>
        <table class="bt-sizes"><tbody>
          ${row("<code>fizlet</code> (kernel)<small>the clock, settle, the ledger</small>", kb(B["fizlet (kernel)"]))}
          ${row("<b>this column alone, JS gzip</b>", `<b>${kb(sizes.sameJs)}</b>`)}
          ${row("its CSS, gzip", kb(sizes.sameCss))}
          ${row("sprite sheets and icon font<small>the 2015 files</small>", "same")}
        </tbody></table>
        <p>The <code>@keyframes</code> become data: each segment is a first frame, a last frame, the jumps and the seconds, read by one engine per sprite. <code>beatsPlug 1.4s steps(13)</code> is <code>{ a: 0, b: 13, n: 13, d: 1.4 }</code>. The kernel owns the clock, writes <code>background-position</code> through the ledger only when the frame changes, and sleeps when nothing plays.</p>
        <pre class="bt-pre"><code>// strip.ts: the frame at time t, exactly steps(n), jump-end
a + floor((t - w) / d * n) / n * (b - a)</code></pre>
        <p>Like 2015, the laptop's code scrolls forever once it is open, so the remake keeps asking for frames while it does. That is the fair copy.</p>
      </article>
      <article class="bt-dis">
        <h3>Fizlet · arcade</h3>
        <p class="bt-bricks">Bricks: kernel, <code>fizlet/fx</code>, <code>fizlet/sound</code>, <code>fizlet/hud</code>.</p>
        <table class="bt-sizes"><tbody>
          ${row("<code>fizlet</code> (kernel)<small>the clock, settle, the ledger</small>", kb(B["fizlet (kernel)"]))}
          ${row("<code>fizlet/fx</code><small>notes, code, splash, steam, combo words</small>", kb(B["fizlet/fx"]))}
          ${row("<code>fizlet/sound</code><small>thump, clack, keys, pour, slurp: a synth, no files</small>", kb(B["fizlet/sound"]))}
          ${row("<code>fizlet/hud</code><small>score, combo, best: change-only writes</small>", kb(B["fizlet/hud"]))}
          ${row("<b>this column alone, JS gzip</b>", `<b>${kb(sizes.arcadeJs)}</b>`)}
          ${row("its CSS, gzip", kb(sizes.arcadeCss))}
          ${row("sprite sheets<small>the 2015 files; no icon font</small>", "same")}
          ${row("animation frames a second at rest<small>after a round on all three</small>", "<b>0</b>")}
        </tbody></table>
        <p>The art is the 2015 frames, untouched. Squash, wobble and the stage shake are one style each, written through the ledger and given back when they stop. The particles draw on one canvas per sprite, only while one is alive. Each sprite's engine and the column's own (HUD, combo, shake) settle on their own, so after the last spark the page asks for nothing.</p>
      </article>
    </div>
    <p class="bt-fine">Measured on this build (<code>site/demos/before-ai-2015/build.mjs</code>): a brick's size is the whole brick, minified and gzipped with everything it pulls in, as <code>npm run size</code> measures it; a column's size is that column alone, bundled and gzipped the way this page's script is, so it counts only the parts of each brick it uses. Sheet and font sizes are the files on disk. The 0 at rest is counted by <code>tests/site.mjs</code> in Chromium on every build.</p>`;
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
    <p class="lead">In 2015, years before AI coding tools, Chris Cooley drew three micro animations frame by frame and played them with CSS sprites: headphones that plug in and play, a coffee cup that fills, a laptop that opens and types. The Wayback Machine kept them. Here they are live, beside the same three on Fizlet: once as they were, once as an arcade.</p>
    <p class="lead">By <a href="https://coded.design/">Chris Cooley ↗</a> · <a href="../../${NOTE}">Read the note: Before AI: 2015</a></p>

    <h2 class="bt-h">Same sprite sheets.<br><em>×100 the life.</em></h2>
    <p class="bt-how">Press the switches in the first two columns. In the arcade, hit everything: the headphones, the cup, the keys.</p>
    <div class="bt-row">
      <div class="bt-cell bt-2015">
        <h3>2015 · CSS sprites</h3>
        <p class="bt-beat">Oh, that's cool.</p>
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
        <h3>Fizlet · remake</h3>
        <p class="bt-beat">Same thing. Rebuilt in minutes.</p>
        <div class="bt-stage">
          <div class="fz-beats paused"><div class="switch"></div></div>
          <div class="desk">
            <div class="fz-comp close"><button class="switch" aria-label="Open or close the laptop"></button></div>
            <div class="fz-coffee drinkMe"><button class="switch" aria-label="Fill or drink the coffee"></button></div>
          </div>
        </div>
        <p class="bt-cap">Same frames, timings and clicks, rebuilt in about 6 minutes of agent time (container clock). The kernel owns the clock instead of <code>@keyframes</code>, and sleeps when nothing moves.</p>
      </div>
      <div class="bt-cell bt-arcade fz-arcade">
        <h3>Fizlet · arcade</h3>
        <p class="bt-beat">Now hit it. ×100.</p>
        <div class="fz-hud"><span>Score <b class="fz-score">0</b></span><span>Combo ×<b class="fz-combo">0</b></span><span>Best ×<b class="fz-best">0</b></span><button type="button" class="fz-mute" aria-pressed="true">Sound</button></div>
        <div class="bt-stage">
          <div class="fz-beats"><button type="button" class="fz-cups" aria-label="Hit the beat"></button><button type="button" class="fz-play" aria-pressed="false" aria-label="Play the music"><svg class="fz-i-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z"/></svg><svg class="fz-i-pause" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg></button></div>
          <div class="desk">
            <div class="fz-comp"><button type="button" class="fz-keys" aria-label="Open the laptop"></button><button type="button" class="fz-lid" aria-label="Close the laptop" hidden></button></div>
            <div class="fz-coffee"><button type="button" aria-label="Fill the cup"></button></div>
          </div>
        </div>
        <p class="bt-cap">The same 2015 frames. Hit the cups: bass, bounce, notes, an equalizer on the phone. Pour and sip: splash, steam, slurp. Open the lid, then hammer the keys: clicks, code spray, a lit screen. Hit fast to chain the combo.</p>
      </div>
    </div>
    <p class="bt-note">Reduced motion: the 2015 column and the remake hold their first frame (a wrapper rule on this page; 2015 had none), and the arcade lands each press on its still frame with no particles, squash or shake; it makes a sound only when you press, and the Sound key mutes it. At rest the page asks for no animation frames, even after a round in the arcade; the site's tests count them on every build. On the page both Fizlet columns ship as one script, <b>${fmt(sizes.js)} B</b> gzip (they share the kernel), plus <b>${fmt(sizes.fizCss)} B</b> of CSS. The sprite sheets are the same files in all three.</p>

    <h2 class="bt-h">Taken apart.<br><em>Every byte counted.</em></h2>
    ${dissection}

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
  description: "Three CSS sprite animations Chris Cooley drew by hand in 2015, live beside a Fizlet remake and an arcade version, taken apart with bricks and sizes.",
  base: "../../", version, path: PATH, body, scripts: ["site.js", `${PATH}before.js`],
}));
writeFileSync(`${OUT}/sizes.json`, JSON.stringify(sizes));
console.log(`Built ${OUT}/: before.js ${sizes.js} B gzip (remake alone ${sizes.sameJs}, arcade alone ${sizes.arcadeJs}), 2015 CSS ${sizes.css2015} B gzip; timeline ${shown.length} shown, ${hidden.length} waiting for Chris`);
