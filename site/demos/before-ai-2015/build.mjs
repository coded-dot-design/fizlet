// Build demos/before-ai-2015/ into site-dist/: the interactive companion to the note "Before AI:
// 2015" (notes/before-ai-2015/). Run after scripts/site.mjs builds the shell (it imports this).
// Three columns, live: the 2015 CSS sprites (css/sprites.css byte for byte from the 2015 app CSS, and
// the 4-line class toggle that replaced Angular), the Fizlet remake (same behaviour), the Fizlet
// arcade (the same art, ×100 alive: fzlt/fx, fzlt/sound, fzlt/hud), and under them a dissection
// of each: the 2015 sprite process (the sheets with their frames marked, the @keyframes, the class
// swap), then the bricks each Fizlet column uses with their sizes, and one comparison table. The
// sprite sheets and the icon font are Chris Cooley's 2015 originals, under app-assets/ with their
// 2015 hashed names.
// Every number on the page is measured here, at build time: the gzip bytes of the files it ships.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { page, crumbs, esc, icon } from "../../layout.mjs";
import { smallestBadge } from "../../pages/contest.mjs";
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
  bricks: Object.fromEntries(await Promise.all(["fzlt (kernel)", "fzlt/fx", "fzlt/sound", "fzlt/hud"].map(async (n) => [n, await brick(n)]))),
  sheets: Object.fromEntries(["88597e86.beats.png", "2deb5381.coffee.png", "136aceff.computer.svg"].map((f) => [f, statSync(`${DIR}/${SHEETS}${f}`).size])),
  font: statSync(`${DIR}/app-assets/fonts/77bdc9dc.chriscooley.woff`).size,
};

const fmt = (n) => n.toLocaleString("en-GB");

const kb = (n) => `${fmt(n)} B`;
const B = sizes.bricks;
const sheetsTotal = Object.values(sizes.sheets).reduce((a, b) => a + b, 0);

// ---------- Brick chips: which brick does the work, at its measured size ----------
// `data-brick` lets the arcade light a chip while its brick acts (arcade.ts kit: a hit lights hud
// and fx, a sound lights sound). The kernel is on whenever anything moves, so it never blinks.
const chip = (name, bytes, id = "") => `<li class="bt-chip"${id ? ` data-brick="${id}"` : ""}><code>${name}</code> <b>${kb(bytes)}</b></li>`;
const chips = (items, label) => `<ul class="bt-chips" aria-label="${label}">${items.join("")}</ul>`;
const KERNEL = chip("fzlt", B["fzlt (kernel)"]);

// ---------- One comparison: the same metrics, in the same order, under all three ----------
// Each numeric row marks its smallest value (SMALLEST, the contest's sticker) when one column is
// strictly smallest; rows where all three are the same files say so once.
const code = [sizes.css2015 + sizes.toggle, sizes.sameJs + sizes.sameCss, sizes.arcadeJs + sizes.arcadeCss];
const ROWS = [
  ["JavaScript, gzip", [sizes.toggle, sizes.sameJs, sizes.arcadeJs], "the 4-line toggle · the column alone · the column alone"],
  ["CSS, gzip", [sizes.css2015, sizes.sameCss, sizes.arcadeCss], "sprites.css, byte for byte · its own · its own"],
  ["Code in all, gzip", code, ""],
  ["Icon font", [sizes.font, sizes.font, 0], "the 2015 play switch · the same file · SVG icons instead"],
];
const cell = (v, all) => {
  const min = Math.min(...all), win = v === min && all.filter((x) => x === min).length === 1;
  return `<td${win ? ' class="bt-win"' : ""}><span class="bt-num">${v ? kb(v) : "none"}</span>${win ? ` ${smallestBadge()}` : ""}</td>`;
};
const TOC = [["three-ways", "Three ways"], ["compare", "One comparison"], ["taken-apart", "Taken apart"], ["archive", "The archive"]];
const COLS = ["2015 · CSS sprites", "Fizlet · remake", "Fizlet · arcade"];
const compare = `<div class="bt-cmp-wrap panel">
      <table class="bt-cmp">
        <caption class="bt-meta">Measured on this build · gzip unless marked</caption>
        <thead><tr><td></td>${COLS.map((c, i) => `<th scope="col"><span class="bt-act-n">0${i + 1}</span>${c}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th scope="row">Bricks</th><td>none</td><td>${chips([KERNEL], "Remake bricks")}</td><td>${chips([KERNEL, chip("fzlt/fx", B["fzlt/fx"]), chip("fzlt/sound", B["fzlt/sound"]), chip("fzlt/hud", B["fzlt/hud"])], "Arcade bricks")}</td></tr>
          ${ROWS.map(([name, vals, note]) => `<tr${name.startsWith("Code") ? ' class="bt-total"' : ""}><th scope="row">${name}${note ? `<small>${note}</small>` : ""}</th>${vals.map((v) => cell(v, vals)).join("")}</tr>`).join("\n          ")}
          <tr><th scope="row">3 sprite sheets<small>the 2015 files, untouched</small></th><td colspan="3" class="bt-same-row"><span class="bt-num">${kb(sheetsTotal)}</span> in all three</td></tr>
          <tr><th scope="row">Sound</th><td>none</td><td>none</td><td>a synth, no files</td></tr>
          <tr><th scope="row">Animation frames a second at rest<small>after a round, laptop open</small></th><td>CSS loops while open</td><td>loops while open, as 2015 did</td><td class="bt-win"><span class="bt-num">0</span> ${smallestBadge()}</td></tr>
        </tbody>
      </table>
    </div>`;

// ---------- The dissection: how each one moves (the same three parts, in the same order) ----------
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
const head = (i, sticker, title, beat) => `<span class="bt-sticker bt-sticker-${i}" aria-hidden="true">${sticker}</span>
        <p class="bt-meta"><span class="bt-act-n">0${i}</span> ${["", "THE ORIGINAL", "THE REMAKE", "THE ARCADE"][i]}</p>
        <h3 class="bt-act-title">${title}</h3>
        <p class="bt-beat">${beat}</p>`;
const dissection = `<div class="bt-dis-row">
      <article class="bt-dis panel" data-reveal>
        ${head(1, "2015", "2015 · CSS sprites", "Bricks: none. CSS and 4 lines.")}
        <p>The process: draw every frame by hand, lay the frames side by side on one long sheet, then show the sheet through a box one frame wide. <code>@keyframes</code> slide <code>background-position</code> from the first frame to the last, and <code>steps(n)</code> makes it jump frame to frame instead of gliding. A click toggles one class, which swaps the animation.</p>
        ${reels}
        <details class="bt-code"><summary>The 2015 toggle, all 4 lines</summary><pre><code>${esc(TOGGLE)}</code></pre></details>
      </article>
      <article class="bt-dis panel" data-reveal>
        ${head(2, "REMAKE", "Fizlet · remake", "Bricks: the kernel. Nothing else.")}
        ${chips([chip("fzlt", B["fzlt (kernel)"])], "Bricks")}
        <p>The <code>@keyframes</code> become data: each segment is a first frame, a last frame, the jumps and the seconds, read by one engine per sprite. <code>beatsPlug 1.4s steps(13)</code> is <code>{ a: 0, b: 13, n: 13, d: 1.4 }</code>. The kernel owns the clock, writes <code>background-position</code> through the ledger only when the frame changes, and sleeps when nothing plays.</p>
        <pre class="bt-pre"><code>// strip.ts: the frame at time t, exactly steps(n), jump-end
a + floor((t - w) / d * n) / n * (b - a)</code></pre>
        <p>Like 2015, the laptop's code scrolls forever once it is open, so the remake keeps asking for frames while it does. That is the fair copy.</p>
      </article>
      <article class="bt-dis panel" data-reveal>
        ${head(3, "×100", "Fizlet · arcade", "Bricks: kernel, <code>fzlt/fx</code>, <code>fzlt/sound</code>, <code>fzlt/hud</code>.")}
        <ul class="bt-does">
          <li>${chips([chip("fzlt", B["fzlt (kernel)"])], "Brick")}<span>the clock, settle, the ledger</span></li>
          <li>${chips([chip("fzlt/fx", B["fzlt/fx"])], "Brick")}<span>notes, code, splash, steam, combo words</span></li>
          <li>${chips([chip("fzlt/sound", B["fzlt/sound"])], "Brick")}<span>thump, clack, keys, pour, slurp: a synth, no files</span></li>
          <li>${chips([chip("fzlt/hud", B["fzlt/hud"])], "Brick")}<span>score, combo, best: change-only writes</span></li>
        </ul>
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

// Chris's words on why Fizlet exists: the owner's wording, as in the note (fizlet-engine
// content/posts/blog-before-ai-2015.json). Same text as ORIGIN_WHY (hero/origin-scene copy.ts):
// import that constant here once it lands.
const WHY = "There were a lot of animations before Fizlet, and in between. We kept writing the same thing over and over, a little different each time for a slightly different use. So we built Fizlet to make it easier for us. Then we figured other people could get something out of it too, so we open-sourced it.";

// The three acts in story order: 2015, the remake, the arcade. Each wears its sticker, its bricks
// as chips (measured) and the stage. `data-reveal`: scrubbed in by the scroll (reveal.ts).
const body = `${CSS}
<section class="bt" aria-labelledby="bt-title">
  <div class="wrap">
    ${crumbs("../../", [["notes/", "Notes"], [NOTE, "Before AI: 2015"]], "The three, live")}
    <header class="bt-head">
      <p class="eyebrow"><span class="index">2015</span> BEFORE AI · THE INTERACTIVE COMPANION</p>
      <h1 id="bt-title" class="bt-title">Drawn by hand in 2015.<br><em>Rebuilt in Fizlet.</em></h1>
      <p class="lead">In 2015, years before AI coding tools, Chris Cooley drew three micro animations frame by frame and played them with CSS sprites: headphones that plug in and play, a coffee cup that fills, a laptop that opens and types. The Wayback Machine kept them. Here they are live, beside the same three on Fizlet: once as they were, once as an arcade.</p>
      <p class="bt-by">By <a href="https://coded.design/">Chris Cooley ↗</a> · <a href="../../${NOTE}">Read the note: Before AI: 2015</a></p>
      <nav class="page-toc bt-toc" aria-label="On this page"><span class="bui-label"><b>ON THIS PAGE</b></span><ol>${TOC.map(([id, name], i) => `<li><a href="#${id}"><b>0${i + 1}</b>${name}</a></li>`).join("")}</ol></nav>
    </header>
    <ul class="rules bt-stats" aria-label="Measured on this build">
      <li class="panel rule"><b>${kb(code[0])}</b><p>2015, gzip: the CSS and the 4-line toggle. Bricks: none</p></li>
      <li class="panel rule"><b>${kb(code[1])}</b><p>the remake, gzip: JS (the kernel and the strip that plays the frames) and CSS</p></li>
      <li class="panel rule"><b>${kb(code[2])}</b><p>the arcade, gzip: JS (kernel, <code>fzlt/fx</code>, <code>fzlt/sound</code>, <code>fzlt/hud</code>) and CSS</p></li>
      <li class="panel rule"><b>0</b><p>animation frames a second the arcade asks for once a round is over</p></li>
    </ul>
    <figure class="bt-quote">
      <blockquote><p>“${esc(WHY)}”</p></blockquote>
      <figcaption class="bt-meta">Chris Cooley · why Fizlet exists</figcaption>
    </figure>

    <div class="bt-sec" id="three-ways" data-reveal>
      <p class="eyebrow"><span class="index">01</span> THREE WAYS · LIVE</p>
      <h2 class="bt-h">Same sprite sheets.<br><em>×100 the life.</em></h2>
      <p class="bt-how">Press the switches in the first two columns. In the arcade, hit everything: the headphones, the cup, the keys.</p>
    </div>
    <ol class="bt-row" aria-label="2015, then the remake, then the arcade">
      <li class="bt-act panel bt-2015" data-reveal>
        ${head(1, "2015", "2015 · CSS sprites", "Oh, that's cool.")}
        ${chips([`<li class="bt-chip bt-chip-none">no bricks</li>`, chip("CSS + 4 lines", sizes.css2015 + sizes.toggle)], "What it ships")}
        <div class="bt-screen"><div class="bt-stage">
          <div class="beats paused"><div class="switch" data-toggle="paused"></div></div>
          <div class="desk">
            <div class="comp close"><button class="switch" data-toggle="close" aria-label="Open or close the 2015 laptop"></button></div>
            <div class="coffee drinkMe"><button class="switch" data-toggle="drinkMe" aria-label="Fill or drink the 2015 coffee"></button></div>
          </div>
        </div></div>
        <p class="bt-cap">The 2015 CSS, byte for byte, and the 4-line class toggle that stood in for Angular's <code>ng-click</code>. The headphone switch is a <code>div</code>, as it was: mouse only.</p>
      </li>
      <li class="bt-act panel bt-same fz-same" data-reveal>
        ${head(2, "REMAKE", "Fizlet · remake", "Same thing. Rebuilt in minutes.")}
        ${chips([KERNEL], "Bricks at work")}
        <div class="bt-screen"><div class="bt-stage">
          <div class="fz-beats paused"><div class="switch"></div></div>
          <div class="desk">
            <div class="fz-comp close"><button class="switch" aria-label="Open or close the laptop"></button></div>
            <div class="fz-coffee drinkMe"><button class="switch" aria-label="Fill or drink the coffee"></button></div>
          </div>
        </div></div>
        <p class="bt-cap">Same frames, timings and clicks, rebuilt in about 6 minutes of agent time (container clock). The kernel owns the clock instead of <code>@keyframes</code>, and sleeps when nothing moves.</p>
      </li>
      <li class="bt-act panel bt-arcade fz-arcade" data-reveal>
        ${head(3, "×100", "Fizlet · arcade", "Now hit it. ×100.")}
        ${chips([KERNEL, chip("fzlt/fx", B["fzlt/fx"], "fx"), chip("fzlt/sound", B["fzlt/sound"], "sound"), chip("fzlt/hud", B["fzlt/hud"], "hud")], "Bricks at work: each lights while it acts")}
        <div class="bt-screen">
          <div class="bt-stage">
            <div class="fz-beats"><button type="button" class="fz-cups" aria-label="Hit the beat"></button><button type="button" class="fz-play" aria-pressed="false" aria-label="Play the music"><svg class="fz-i-play" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z"/></svg><svg class="fz-i-pause" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg></button></div>
            <div class="desk">
              <div class="fz-comp"><button type="button" class="fz-keys" aria-label="Open the laptop"></button><button type="button" class="fz-lid" aria-label="Close the laptop" hidden></button></div>
              <div class="fz-coffee"><button type="button" aria-label="Fill the cup"></button></div>
            </div>
          </div>
          <div class="fz-hud"><span>Score <b class="fz-score">0</b></span><span>Combo ×<b class="fz-combo">0</b></span><span>Best ×<b class="fz-best">0</b></span><button type="button" class="fz-mute" aria-pressed="true">${icon("sound", 18)}${icon("mute", 18)}<span>Sound</span></button></div>
        </div>
        <p class="bt-cap">The same 2015 frames. Hit the cups: bass, bounce, notes, an equalizer on the phone. Pour and sip: splash, steam, slurp. Open the lid, then hammer the keys: clicks, code spray, a lit screen. Hit fast to chain the combo.</p>
      </li>
    </ol>
    <p class="bt-note">Reduced motion: the 2015 column and the remake hold their first frame (a wrapper rule on this page; 2015 had none), and the arcade lands each press on its still frame with no particles, squash or shake; it makes a sound only when you press, and the Sound key mutes it. At rest the page asks for no animation frames, even after a round in the arcade; the site's tests count them on every build. On the page both Fizlet columns ship as one script, <b>${fmt(sizes.js)} B</b> gzip (they share the kernel), plus <b>${fmt(sizes.fizCss)} B</b> of CSS. The sprite sheets are the same files in all three.</p>
    <p class="bt-recall-row"><button type="button" class="bt-recall" data-recall>Recall</button><span>Give the page back: every engine stops and every style, class and attribute Fizlet wrote goes back as it was.</span></p>

    <div class="bt-sec" id="compare" data-reveal>
      <p class="eyebrow"><span class="index">02</span> ONE COMPARISON · MEASURED</p>
      <h2 class="bt-h">Side by side.<br><em>One comparison.</em></h2>
    </div>
    ${compare}

    <div class="bt-sec" id="taken-apart" data-reveal>
      <p class="eyebrow"><span class="index">03</span> HOW EACH ONE MOVES</p>
      <h2 class="bt-h">Taken apart.<br><em>Every byte counted.</em></h2>
    </div>
    ${dissection}

    <div class="bt-sec" id="archive" data-reveal>
      <p class="eyebrow"><span class="index">04</span> THE ARCHIVE</p>
      <h2 class="bt-h">The 2015 page.<br><em>Still on the archive.</em></h2>
    </div>
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
console.log(`Built ${OUT}/: before.js ${sizes.js} B gzip (remake alone ${sizes.sameJs}, arcade alone ${sizes.arcadeJs}), 2015 CSS ${sizes.css2015} B gzip`);
