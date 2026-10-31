// The Fizlet home page. Numbers come from the build (sizes measured like `npm run size`); claims
// come from the test suites (tests/*.test.mjs, tests/browser.mjs).
import { esc, icon, REPO, SITE, HUB, BATTLEFIELD, BLITZ, ENGINE_PLAN, AUTHOR } from "../layout.mjs";
import { sizeBadge } from "../size-badge.mjs";
import { QUICK_START } from "./quick-start.mjs";
import { BETA_LINE, IN_HOUSE, inHouse } from "../bricks.mjs";
import { brickCompact } from "../brick-ui.mjs";
import { LAUNCH_LAST, phases } from "../roadmap.mjs";
import { originSection } from "../origin/section.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);

export const CONTRACT = [
  ["One clock per page", "Every engine on the page shares one requestAnimationFrame. A fixed 60 Hz step with a catch-up cap: a long frame drops time, it never spirals."],
  ["Bounded everything", "Pools and the event ring have a fixed capacity and refuse work when full. Nothing grows during a session."],
  ["Zero steady-state allocation", "One million kernel steps of a busy system cause no young-generation GC. Each brick alone allocates nothing."],
  ["No layout reads in the step", "Read in read, simulate in step, write in render. @fzlt/core/debug counts any layout read made during a step."],
  ["Change-only writes", "The ledger skips writes that change nothing. Writing the same value twice makes zero DOM mutations."],
  ["Pause by default", "Hidden tab, page leaving, root off screen, typing in the host's own fields. Zero CPU while paused."],
  ["Own nothing you can't give back", "Every page change goes through the ledger. destroy() restores it exactly, and a newer host edit always wins."],
  ["Embed-safe", "No globals, no global styles, many engines per page. Every root Fizlet owns is CSS-contained. One AbortSignal removes every listener and observer."],
  ["Budgets in CI", "Kernel at most 4 KB gzip; every brick and the page build have their own budget. Over budget, the build fails."],
];

const PIPELINE = [
  ["src/", "the engine"],
  ["npm run check", "types · tests · size"],
  ["CI tags vX.Y.Z", "from package.json"],
  ["vendor/fizlet", "snapshot + ORIGIN.json"],
  ["Pages", "static, no server"],
];

export const LEDGER_ROWS = [
  ["ledger.text(node, v)", "a text node's value", "the 0s and 1s a shot leaves in a word"],
  ["ledger.style(el, prop, v)", "one inline style property", "transforms, custom properties"],
  ["ledger.attr(el, name, v)", "an attribute (null removes)", "aria-busy, data-hp"],
  ["ledger.cls(el, name, on)", "one class", "smashed, burning"],
  ["ledger.add(node)", "a node you put on the page", "a canvas, an overlay, debris"],
];

const code = (s, cls = "") => `<pre class="code${cls ? " " + cls : ""}"><code>${esc(s)}</code></pre>`;

/** The demo page the engine knocks around: every letter and word is a real element. */
function demoPage() {
  const letters = [..."Hello, page."].map((c) => (c === " " ? " " : `<span class="dl" data-body data-flip>${esc(c)}</span>`)).join("");
  const words = "Every letter here is a real element on this page. Knock it around, then press Recall.".split(" ").map((w) => `<span class="dw" data-body>${esc(w)}</span>`).join(" ");
  return `<div class="demo-page" data-page>
      <h2 class="demo-title" aria-label="Hello, page.">${letters}</h2>
      <p class="demo-copy">${words}</p>
      <div class="demo-row"><span class="demo-btn" data-body>SIGN UP</span><span class="demo-chip" data-body>NEW</span><span class="demo-chip alt" data-body>v0.2</span></div>
    </div>`;
}

/**
 * The "Blast it. Recall it." demo figure (site/demo.ts runs it). The gallery mounts it in a slot.
 * `badge`: its size badge (site/size-badge.mjs), shown in the window chrome.
 */
export function playFigure(badge = "") {
  return `<figure class="demo panel lit" data-demo${badge ? " data-demo-host" : ""} aria-label="Live demo: a small page you can blast. Recall puts it back.">
      <div class="demo-chrome"><i></i><i></i><i></i><span class="demo-url">your.page</span><span class="demo-state" data-state>BOOTING</span>${badge}</div>
      <div class="demo-board" data-board>
        ${demoPage()}
        <canvas class="demo-fx" data-fx aria-hidden="true"></canvas>
        <div class="demo-slam" data-slam hidden><div class="bui-sticker"><span>RECALL</span><b>RESTORED</b></div></div>
        <p class="demo-hint" data-hint aria-hidden="true"><span class="blink"></span>CLICK THE PAGE</p>
      </div>
      <div class="demo-keys">
        <button class="bui-key bui-arcade bui-attack" type="button" data-blast>${icon("fire", 18)}Blast<kbd>B</kbd></button>
        <button class="bui-key bui-arcade bui-cmd" type="button" data-recall>${icon("recall", 18)}Recall<kbd>R</kbd></button>
        <button class="bui-key bui-icon-key" type="button" data-sound aria-pressed="false" aria-label="Sound"><span class="snd-off">${icon("mute")}</span><span class="snd-on">${icon("sound")}</span></button>
      </div>
      <dl class="demo-stats" aria-label="engine.stats(), live">
        <div><dt>FRAMES</dt><dd data-stat="frames">0</dd></div>
        <div><dt>STEPS</dt><dd data-stat="steps">0</dd></div>
        <div><dt>DROPPED</dt><dd data-stat="dropped">0</dd></div>
        <div><dt>FRAME MS</dt><dd data-stat="ms">0.00</dd></div>
        <div><dt>WAVES</dt><dd data-stat="waves">0/8</dd></div>
        <div><dt>PARTICLES</dt><dd data-stat="particles">0/420</dd></div>
        <div><dt>LEDGER</dt><dd data-stat="ledger">0</dd></div>
        <div><dt>LAYOUT IN STEP</dt><dd data-stat="layout">0</dd></div>
      </dl>
      <figcaption class="bui-label"><b>LIVE</b> · fizlet + input + fx + sound + debug, running this board</figcaption>
    </figure>`;
}

/** Section 09, from site/roadmap.mjs only (tests/roadmap.test.mjs renders it against the source). */
export function roadmapSection(all = phases()) {
  const [first, last] = [all[0].id, all.at(-1).id];
  const next = all[all.findIndex((p) => p.id === LAUNCH_LAST) + 1]?.id;
  const roadmap = all.map(({ id, name, tone, label, goal, items }) => `<li class="panel phase" data-phase="${tone}">
        <div class="phase-top"><span class="phase-id">${id}</span><span class="phase-pill">${esc(label)}</span></div>
        <h3>${esc(name)}</h3>
        <p>${esc(goal)}</p>
        <ul class="checks">${items.map(([done, t]) => `<li${done ? ' class="done"' : ""}><i aria-hidden="true">${done ? icon("check", 14) : ""}</i><span>${esc(t)}</span><span class="sr">${done ? "(done)" : "(to do)"}</span></li>`).join("")}</ul>
      </li>`).join("\n      ");
  return `<!-- 09 ROADMAP -->
<section id="roadmap" class="section" data-reveal aria-labelledby="roadmap-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">09</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">09</span> ROADMAP · ${first} TO ${last}</p>
      <h2 id="roadmap-title">What's done.<br><em>What's left.</em></h2>
      <p class="lead">${esc(BETA_LINE)} ${first} to ${LAUNCH_LAST} are the launch scope; a box is ticked only with a release, a merged change or a test behind it. ${next} to ${last} are next, with the bricks each adds (<a href="bricks/#planned">ROADMAP</a> on the bricks page). The first plan, E0 to E6, is <a href="${ENGINE_PLAN}">ENGINE.md ↗</a> in the DOM VIRUS repo.</p>
    </div>
    <ol class="roadmap">
      ${roadmap}
    </ol>
  </div>
</section>`;
}

export function home({ version, sizes, bundle, bricks: catalog, layers, fizz, blast, origin }) {
  const size = (name) => sizes.find((s) => s.name === name);
  const kernel = size("@fzlt/core (kernel)");
  const css = size("@fzlt/core/ui (css)");
  const pageBuild = size("page build (kernel+slot+input+fx)");
  // Compact on the home page: the snippet and the whole API live on each brick's own page.
  const compact = (b, h) => brickCompact({ brick: b, size: size(b.sizes[0]), href: `bricks/${b.id}.html`, h,
    extra: b.id === "ui" ? `<li>+ <b>${kb(css.gzip)} KB</b> css</li>` : "" });
  const bricks = catalog.filter((b) => !inHouse(b)).map((b) => compact(b)).join("\n      ");
  // In-house / experimental (site/bricks.mjs IN_HOUSE): listed apart, with its label.
  const ours = catalog.filter(inHouse).map((b) => compact(b, "h4")).join("\n      ");

  const contract = CONTRACT.map(([t, b], i) => `<li class="panel rule"><b>${String(i + 1).padStart(2, "0")}</b><h3>${esc(t)}</h3><p>${esc(b)}</p></li>`).join("\n      ");

  const specs = [
    ["1", "rAF per page", "However many engines run, one requestAnimationFrame drives them."],
    ["60 Hz", "fixed step", "Same results on a 30 Hz phone and a 144 Hz monitor."],
    ["4", "catch-up steps", "Past that a frame drops time instead of spiralling."],
    ["64", "events a frame", "The default ring. Full means dropped and counted, never grown."],
    ["1M", "steps, 0 young GCs", "The kernel test runs a busy system for a million steps."],
    ["0", "mutations on rewrite", "Writing the same value twice touches nothing (browser test)."],
    ["420", "fx particles", "The default cap, struct of arrays. New ones are refused when full."],
    [kb(kernel.gzip) + " KB", "kernel gzip", `Of a ${kb(kernel.budget)} KB budget, checked on every push.`],
  ].map(([n, label, note]) => `<li class="panel spec-card"><b>${n}</b><span>${label}</span><small>${esc(note)}</small></li>`).join("\n      ");

  const chips = sizes.map((s) => `<li><i style="--v:${(s.gzip / s.budget).toFixed(3)}"></i><span>${esc(s.name)}</span><b>${(s.gzip / 1024).toFixed(2)}<small> KB</small></b></li>`).join("");

  const pipeline = PIPELINE.map(([t, s], i) => `<li><em>${String(i + 1).padStart(2, "0")}</em><b>${esc(t)}</b><span>${esc(s)}</span></li>`).join("");
  const ledger = LEDGER_ROWS.map(([c, what, eg]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(what)}</td><td>${esc(eg)}</td></tr>`).join("");

  return `
<!-- HERO: the headline, and a live board running on Fizlet itself -->
<section class="hero has-grid" aria-labelledby="hero-title">
  <div class="hero-field" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow"><span class="dot"></span>MICRO GAME ENGINE <span>/</span> <b>FOR THE DOM</b></p>
      <h1 id="hero-title">The page<br><em>is the board.</em></h1>
      <p class="byline">by <a href="${AUTHOR}">Chris Cooley ↗</a></p>
      <p class="beta-line"><span class="status-pill" data-flag="beta">PUBLIC BETA</span> v${esc(version)} · a 0.x public beta: <a href="bricks/#status">every brick carries its status</a></p>
      <p class="lead">Fizlet is a tiny game engine that plays on the page you already have: one shared loop, bounded everything, and the page always comes back exactly as it was. The kernel is <b>${kb(kernel.gzip)} KB</b> gzipped. No runtime dependencies, ever.</p>
      <div class="hero-keys">
        <a class="bui-key bui-arcade bui-go" href="#start">${icon("play", 16)}Quick start</a>
        <a class="bui-key bui-arcade bui-sys" href="#contract">${icon("down", 16)}The contract</a>
        <a class="hero-link" href="${REPO}">${icon("github", 16)}coded-dot-design/fizlet ↗</a>
      </div>
      <div class="hero-install code-card"><div class="code-head"><span class="bui-label"><b>SCRIPT TAG</b> · ${kb(bundle)} KB, EVERY BRICK</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(`<script src="${SITE}fizlet.js"></script>`, "wrap")}</div>
    </div>

    <div class="hero-layers" data-demo-host>
      <style>${layers.css}</style>
      ${layers.figure}
      ${sizeBadge(layers.sizes.live, layers.live, "the layers scene with @fzlt/core/slot")}
      <p class="hero-cap bui-label"><b>LIVE</b> · Battlefield Blitz as a stack of bricks · its code loads only once it nears the screen · <a href="demos/layers/">The layers story</a></p>
      ${layers.loader}
    </div>
  </div>
</section>

<!-- STATS -->
<section class="stats" aria-label="Fizlet in numbers">
  <div class="wrap stats-row">
    <span><b>${kb(kernel.gzip)} KB</b><small>KERNEL GZIP</small></span>
    <span><b>${catalog.length - 1}</b><small>BRICKS</small></span>
    <span><b>0</b><small>DEPENDENCIES</small></span>
    <span><b>1</b><small>rAF PER PAGE</small></span>
    <span><b>1M</b><small>STEPS · NO GC</small></span>
    <span class="soon"><i></i><b>V${esc(version)}</b><small>MIT · OPEN SOURCE</small></span>
  </div>
</section>

${originSection(origin)}

<!-- ON THIS PAGE: one jump per numbered section (the long page's own table of contents), then the weekly contest (its own page; it and Roadmap left the header) -->
<nav class="page-toc" aria-label="On this page">
  <div class="wrap"><span class="bui-label"><b>ON THIS PAGE</b></span><ol><li><a href="#contract"><b>01</b>Contract</a></li><li><a href="#bricks"><b>02</b>Bricks</a></li><li><a href="#board"><b>03</b>The board</a></li><li><a href="#loop"><b>04</b>The loop</a></li><li><a href="#recall"><b>05</b>Recall</a></li><li><a href="#specs"><b>06</b>Specs</a></li><li><a href="#ship"><b>07</b>Ship</a></li><li><a href="#games"><b>08</b>Games</a></li><li><a href="#roadmap"><b>09</b>Roadmap</a></li><li><a href="#start"><b>10</b>Quick start</a></li><li><a href="contest/"><b>→</b>Weekly contest</a></li></ol></div>
</nav>

<!-- PLAY: the live board, running on Fizlet itself -->
<section id="play" class="section" data-reveal aria-labelledby="play-title">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">▶</span> BLAST IT · RECALL IT</p>
      <h2 id="play-title">Blast it.<br><em>Recall it.</em></h2>
      <p class="lead">Every letter in this little page is a real element. Click it, blast it, then press <b>Recall</b>: the ledger puts back every change the engine made.</p>
    </div>
    ${playFigure(sizeBadge(blast.bytes, blast.live, "this demo: fizlet, input, fx, sound and debug"))}
  </div>
</section>

<!-- THE NAME: the origin story (owner-stated), and the slot for the soda-can fizz scene -->
<section id="story" class="section" data-reveal aria-labelledby="story-title">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">FZ</span> THE NAME</p>
      <h2 id="story-title">Crack the can.<br><em>Hear the fizz.</em></h2>
      <p class="lead"><b>-let</b>, as in applet: a very small app with one job. <b>Fiz-</b>, from the old soda commercial: a can cracks, the shot zooms in on the bubbles and the drip running down the side.</p>
      <p class="body">Motion that looks complex, a tiny footprint, and the page as the stage. <a href="demos/fizz/#fz-story">The whole story of the name</a>.</p>
    </div>
    <!-- The soda-can fizz scene (site/demos/fizz/): its own figure and poster; demos/fizz/main.js mounts it. -->
    <div class="fizz-slot" data-demo-host>
      ${fizz.figure}
      ${sizeBadge(fizz.sizes.chunk, fizz.live, "the fizz scene: kernel, fx, sprite, camera and the can")}
      <p class="hero-cap bui-label"><b>LIVE</b> · tap the can · <a href="demos/fizz/">The fizz proof piece</a></p>
    </div>
  </div>
</section>

<!-- THE PAGE PROFILE -->
<section id="profile" class="section" data-reveal aria-labelledby="profile-title">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">00</span> HEROES AND DIAGRAMS · THE PAGE PROFILE</p>
      <h2 id="profile-title">Costs nothing<br><em>while it's still.</em></h2>
      <p class="lead">Fizlet is not only for games: it is built just as much for landing-page heroes and interactive diagrams, where the page is the product. The page profile is a lighter build of the same bricks for them.</p>
      <p class="body"><b>Settle.</b> Pass <code>settle: 0.5</code> and systems call <code>engine.busy()</code> in any frame where something moves. Half a second after the last one, the engine sleeps: no requestAnimationFrame at all, zero frames, until <code>wake()</code>, its input or <code>start()</code>. Something due later (an intro delay, an autoplay beat) holds it awake with <code>engine.busy(seconds)</code>. <b>fps.</b> <code>fps: 30</code> caps an ambient loop on the shared clock. <b>slot.</b> Loads the scene only once it nears the viewport and the main thread is idle, and replays the tap that woke it.</p>
      <div class="split-keys"><a class="bui-key bui-arcade bui-go" href="bricks/kernel.html">${icon("play", 16)}Try settle live</a><a class="bui-key bui-arcade bui-sys" href="bricks/slot.html">${icon("book", 16)}@fzlt/core/slot</a></div>
    </div>
    <div class="panel lit profile-card" style="--tone: var(--k-go)">
      <span class="bui-label"><b>PAGE BUILD</b> · kernel + slot + input + fx</span>
      <b class="profile-size" data-size="${esc(pageBuild.name)}">${pageBuild.gzip.toLocaleString("en-US")} B</b>
      <small>gzip, measured on this build, against a ${kb(pageBuild.budget)} KB budget checked in CI</small>
      <span class="meter" aria-hidden="true"><i style="--v:${(pageBuild.gzip / pageBuild.budget).toFixed(3)}"></i></span>
      <ul class="ledger-rules">
        <li><b>0 frames</b> once settled, offscreen, in a hidden tab, and under reduced motion when you opt in.</li>
        <li><b>Lazy scene.</b> The scene's own code loads only once its slot nears the viewport.</li>
        <li><b>No game bricks.</b> No sound, pad, hud or match in the page build (a test fails if one gets in).</li>
      </ul>
    </div>
  </div>
</section>

<!-- 01 THE CONTRACT -->
<section id="contract" class="section" data-reveal aria-labelledby="contract-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">01</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">01</span> WHY · THE CONTRACT</p>
      <h2 id="contract-title">Nine promises.<br><em>Each one tested.</em></h2>
      <p class="lead">Most engines assume they own the page. Fizlet is a guest: it runs inside someone else's site, on a phone, next to their code, and it leaves no trace. Every brick and every game built on it keeps these.</p>
    </div>
    <ol class="rules">
      ${contract}
    </ol>
  </div>
</section>

<!-- 02 KERNEL + BRICKS -->
<section id="bricks" class="section" data-reveal aria-labelledby="bricks-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">02</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">02</span> KERNEL + BRICKS</p>
      <h2 id="bricks-title">Take only<br><em>what you need.</em></h2>
      <p class="lead">One small kernel and a box of bricks, each its own import with its own budget. Sizes are measured on this build: minified, gzipped, with everything each one pulls in. Each brick has a page with a snippet, its whole API and, for most, a live demo.</p>
    </div>
    <ul class="bricks compact">
      ${bricks}
    </ul>
    <div class="section-head" id="in-house">
      <h3>${esc(IN_HOUSE.label)}</h3>
      <p class="body">${esc(IN_HOUSE.line)} <a href="${IN_HOUSE.guide}">Build your own room server</a>.</p>
    </div>
    <ul class="bricks compact in-house">
      ${ours}
    </ul>
    <div class="split-keys"><a class="bui-key bui-arcade bui-sys" href="bricks/">${icon("grid", 16)}Every brick, every export</a></div>
  </div>
</section>

<!-- 03 THE PAGE BECOMES THE BOARD -->
<section id="board" class="section" data-reveal aria-labelledby="board-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">03</span>
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">03</span> THE PAGE BECOMES THE BOARD</p>
      <h2 id="board-title">Read. Step.<br><em>Render.</em></h2>
      <p class="lead">A web page is a surprisingly good game map. The trick is reading it cheaply, changing only what you own and leaving cleanly. Every frame runs three phases, in order, for every system.</p>
      <p class="body">Geometry is read once in <code>read</code> and cached. The simulation runs in <code>step</code> on plain numbers, at a fixed 60 Hz, with no DOM at all. <code>render</code> writes only what changed, through the ledger. The demo above counts layout reads made during a step with <code>@fzlt/core/debug</code>: the number stays at zero.</p>
    </div>
    <ol class="phases panel lit" aria-label="One frame">
      <li style="--tone: var(--k-sys)"><b>READ</b><span>once a frame</span><p>Cached geometry, input edges latched. The only phase that may measure the page.</p></li>
      <li style="--tone: var(--k-go)"><b>STEP <small>× 0–4</small></b><span>fixed dt = 1/60 s</span><p>The simulation. No DOM reads, no DOM writes, no allocation. Events go into the ring.</p></li>
      <li style="--tone: var(--k-attack)"><b>RENDER</b><span>once a frame · alpha</span><p>Change-only writes through engine.ledger. Sound and effects read the event ring.</p></li>
    </ol>
  </div>
</section>

<!-- 04 ONE LOOP. BOUNDED WORK. -->
<section id="loop" class="section" data-reveal aria-labelledby="loop-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">04</span>
  <div class="wrap split flip">
    <div>
      <p class="eyebrow"><span class="index">04</span> A FRAME, NOT A FREE-FOR-ALL</p>
      <h2 id="loop-title">One loop.<br><em>Bounded work.</em></h2>
      <p class="lead">One requestAnimationFrame drives every engine on the page. Pools are filled up front and never grow; when one is full it says no, and the frame stays inside its budget.</p>
      <p class="body">A slow frame runs at most four catch-up steps and drops the rest of the time (it shows in <code>stats().dropped</code>). Hidden tab, page leaving, root scrolled away, a visitor typing in a field: the engine pauses and costs nothing. Scroll the demo away and back: it sleeps.</p>
    </div>
    <div class="loop panel" aria-label="Three engines, one requestAnimationFrame, a fixed step with a catch-up cap">
      <div class="loop-row"><span class="bui-label"><b>RAF</b> · ONE PER PAGE</span><div class="raf">${Array.from({ length: 12 }, (_, i) => `<i${i === 7 ? ' class="long"' : ""}></i>`).join("")}</div></div>
      <div class="loop-row"><span class="bui-label"><b>ENGINES</b> · SHARE IT</span><div class="engines"><span>hero</span><span>game</span><span>widget</span></div></div>
      <div class="loop-row"><span class="bui-label"><b>STEPS</b> · CAP 4, THEN DROP</span><div class="steps">${[1, 1, 2, 1, 1, 1, 1, 4, 1, 1, 1, 1].map((n, i) => `<span>${Array.from({ length: n }, () => "<i></i>").join("")}${i === 7 ? '<i class="drop"></i><i class="drop"></i>' : ""}</span>`).join("")}</div></div>
      <div class="loop-row"><span class="bui-label"><b>POOL</b> · 24 SLOTS, NEVER GROWS</span><div class="slots">${Array.from({ length: 24 }, (_, i) => `<i${i < 19 ? ' class="on"' : ""}></i>`).join("")}</div></div>
      <p class="loop-note">A long frame (the wide tick) runs four steps and drops the rest. Engines 2 and 3 cost no extra frames.</p>
    </div>
  </div>
</section>

<!-- 05 RECALL -->
<section id="recall" class="section" data-reveal aria-labelledby="recall-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">05</span>
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">05</span> THE PART WE CARE ABOUT MOST</p>
      <h2 id="recall-title">Recall gives<br><em>the page back.</em></h2>
      <p class="lead">Every change Fizlet makes to the page goes through one ledger. It records the original and what the engine wrote. <code>destroy()</code> puts back everything the engine still owns, newest first.</p>
      <p class="body">If the host page changed something after the engine did, the host wins: the ledger stops writing it and never restores over it. A style attribute comes back byte for byte. Try it in the demo: blast the heading, then press <b>Recall</b>. That key runs <code>engine.ledger.restore()</code>, the same call <code>destroy()</code> makes.</p>
      <div class="split-keys"><a class="bui-key bui-arcade bui-cmd" href="#play">${icon("recall", 16)}Back to the demo</a></div>
    </div>
    <div class="panel lit ledger">
      <div class="ledger-head"><span class="bui-label"><b>engine.ledger</b> · WHAT IT OWNS</span><span class="ledger-led">TESTED IN CHROMIUM</span></div>
      <div class="table-scroll"><table><thead><tr><th>Call</th><th>Owns</th><th>For example</th></tr></thead><tbody>${ledger}</tbody></table></div>
      <ul class="ledger-rules">
        <li><b>Change-only.</b> Writing a value that is already there makes no mutation.</li>
        <li><b>Host wins.</b> A newer edit by the page is never overwritten or undone.</li>
        <li><b>Exact.</b> After destroy() the DOM matches the snapshot taken before.</li>
      </ul>
    </div>
  </div>
</section>

<!-- 06 SPEC SHEET -->
<section id="specs" class="section" data-reveal aria-labelledby="specs-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">06</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">06</span> SPEC SHEET</p>
      <h2 id="specs-title">Hard limits,<br><em>in actual numbers.</em></h2>
      <p class="lead">Limits constrain work; they are not frame-rate promises. Real frame time still depends on the page, the fonts and the device.</p>
    </div>
    <ul class="spec-grid">
      ${specs}
    </ul>
    <ul class="size-chips" aria-label="Every module, gzip">${chips}</ul>
    <p class="spec-note">Sizes measured on this build of v${esc(version)}, minified and gzipped (1 KB = 1024 bytes), the same way <code>npm run size</code> checks them in CI. The bar is the share of each module's budget. The one-file script-tag bundle (kernel and every brick but debug) is ${kb(bundle)} KB.</p>
  </div>
</section>

<!-- 07 BUILD ONCE. SHIP EACH. -->
<section id="ship" class="section" data-reveal aria-labelledby="ship-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">07</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">07</span> INDEPENDENT PACKAGES · SHARED FOUNDATIONS</p>
      <h2 id="ship-title">Build once.<br><em>Ship each.</em></h2>
      <p class="lead">The engine lives in one repo. Each game takes a fingerprinted snapshot, tests itself and tags its own release. Pages serves static files: no runtime iframe, no remote content service, no client framework.</p>
    </div>
    <ol class="pipeline">${pipeline}</ol>
  </div>
</section>

<!-- 08 GAMES -->
<section id="games" class="section" data-reveal aria-labelledby="games-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">08</span>
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">08</span> BUILT ON FIZLET</p>
      <h2 id="games-title">Games that<br><em>play on your page.</em></h2>
    </div>
    <div class="games">
      <article class="panel lit game blitz">
        <p class="eyebrow"><span class="dot"></span> FIRST GAME ON FIZLET · <b>FREE FOR ALL</b></p>
        <h3>Battlefield Blitz</h3>
        <p>Every tank for itself. Parachute in, grab power tiles, call airstrikes, dodge mines. Most kills in three minutes wins. It drops onto any website with one line: shells knock your headings around, and Escape gives the page back.</p>
        <span class="bui-label"><b>DROP-IN</b> · ONE LINE ON ANY PAGE</span>
        ${code(`<script src="${BLITZ}blitz.js" defer></script>`, "wrap")}
        <ul class="game-facts">
          <li><b>1 line</b><span>on any page</span></li>
          <li><b>3 min</b><span>free-for-all match</span></li>
          <li><b>Esc</b><span>gives the page back</span></li>
        </ul>
        <p class="game-uses">Built on <code>fizlet</code> · <code>input</code> · <code>collide</code> · <code>fx</code> · <code>sound</code> · <code>embed</code> · <code>rules</code> · <code>presence</code> · <code>ui</code></p>
        <div class="game-keys">
          <a class="bui-key bui-arcade bui-attack" href="${BLITZ}play/">${icon("play", 16)}Play Blitz ↗</a>
          <a class="bui-key bui-arcade bui-sys" href="${BLITZ}">${icon("book", 16)}About Blitz ↗</a>
        </div>
      </article>
      <article class="panel game">
        <p class="eyebrow"><b>THE ARCADE</b> · ON FIZLET</p>
        <h3>DOM VIRUS</h3>
        <p>Tiny games that turn your page into the game board. Fizlet is the engine they proved out, and now they run on it: Null Invaders, Byte Runner and Sherman Bytes at 1.0 on <code>@fzlt/core/arcade</code>, Swarm Protocol 1.4 on the kernel.</p>
        <div class="game-keys"><a class="bui-key bui-arcade bui-cmd" href="${HUB}">${icon("cart", 16)}Visit DOM VIRUS ↗</a></div>
      </article>
      <article class="panel game">
        <p class="eyebrow"><b>SQUAD TACTICS</b> · ON FIZLET 1.0</p>
        <h3>DOM Battlefield</h3>
        <p>Twelve tanks, one radio. The game whose board UI became this design system, on the Fizlet kernel since 1.0; two-network matches come in E12.</p>
        <div class="game-keys"><a class="bui-key bui-arcade bui-go" href="${BATTLEFIELD}">${icon("out", 16)}DOM Battlefield ↗</a></div>
      </article>
    </div>
  </div>
</section>

${roadmapSection()}

<!-- 10 QUICK START -->
<section id="start" class="section" data-reveal aria-labelledby="start-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <span class="sec-num" aria-hidden="true">10</span>
  <div class="wrap start">
    <div class="start-head">
      <p class="eyebrow"><span class="index">10</span> QUICK START</p>
      <h2 id="start-title">Ten lines<br><em>to a blast.</em></h2>
      <p class="lead">One script tag puts the kernel and every brick on <code>window.fizlet</code>. Click the canvas: that's the hero explosion, pooled, paused when you scroll away.</p>
      <ol class="start-steps">
        <li><b>Script tag.</b> <code>fizlet.js</code> (${kb(bundle)} KB gzip), one file, no build step.</li>
        <li><b>Modules.</b> Import only the bricks you use from <code>${SITE}dist/</code>.</li>
        <li><b>npm.</b> <span class="soon-tag">COMING SOON</span> <code>npm install @fzlt/core</code> is not published yet. Until then: <code>git clone</code>, <code>npm ci</code>, <code>npm run build</code> gives you <code>dist/</code> with the subpath exports.</li>
      </ol>
      <div class="split-keys">
        <a class="bui-key bui-arcade bui-go" href="examples/quick-start.html">${icon("play", 16)}Run the example</a>
        <a class="bui-key bui-arcade bui-sys" href="${REPO}#readme">${icon("book", 16)}Read the API on GitHub ↗</a>
      </div>
    </div>
    <div class="start-code">
      <div class="panel lit code-card"><div class="code-head"><span class="bui-label"><b>SCRIPT TAG</b> · index.html</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(QUICK_START(SITE + "fizlet.js"))}</div>
      <div class="panel code-card"><div class="code-head"><span class="bui-label"><b>MODULES</b> · only what you use</span><button class="bui-key copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(`<script type="module">
  import { createEngine } from "${SITE}dist/index.js";
  import { effects } from "${SITE}dist/fx.js";
  import { controls } from "${SITE}dist/input.js";
</script>`)}</div>
    </div>
  </div>
</section>

<!-- FINAL -->
<section class="section final" data-reveal aria-labelledby="final-title">
  <span class="sec-rule" aria-hidden="true"></span>
  <div class="wrap final-inner">
    <p class="eyebrow">MIT · NO DEPENDENCIES · V${esc(version)}</p>
    <h2 id="final-title">Make the page play.</h2>
    <div class="final-keys">
      <a class="bui-key bui-arcade bui-go" href="#start">${icon("play", 16)}Quick start</a>
      <a class="bui-key bui-arcade bui-sys" href="${REPO}">${icon("github", 16)}Source on GitHub ↗</a>
    </div>
    <p class="final-links"><a href="${REPO}/blob/main/CHANGELOG.md">Changelog ↗</a> · <a href="${ENGINE_PLAN}">Engine plan ↗</a> · <a href="${HUB}">DOM VIRUS ↗</a> · <a href="${BATTLEFIELD}">DOM Battlefield ↗</a></p>
  </div>
</section>
`;
}
