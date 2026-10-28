// The Fizlet home page. Numbers come from the build (sizes measured like `npm run size`); claims
// come from the test suites (tests/*.test.mjs, tests/browser.mjs).
import { esc, icon, REPO, SITE, HUB, BATTLEFIELD, BLITZ, ENGINE_PLAN } from "../layout.mjs";
import { QUICK_START } from "./quick-start.mjs";

const kb = (bytes) => (bytes / 1024).toFixed(1);

const CONTRACT = [
  ["One clock per page", "Every engine on the page shares one requestAnimationFrame. A fixed 60 Hz step with a catch-up cap: a long frame drops time, it never spirals."],
  ["Bounded everything", "Pools and the event ring have a fixed capacity and refuse work when full. Nothing grows during a session."],
  ["Zero steady-state allocation", "One million kernel steps of a busy system cause no young-generation GC. Each brick alone allocates nothing."],
  ["No layout reads in the step", "Read in read, simulate in step, write in render. fizlet/debug counts any layout read made during a step."],
  ["Change-only writes", "The ledger skips writes that change nothing. Writing the same value twice makes zero DOM mutations."],
  ["Pause by default", "Hidden tab, page leaving, root off screen, typing in the host's own fields. Zero CPU while paused."],
  ["Own nothing you can't give back", "Every page change goes through the ledger. destroy() restores it exactly, and a newer host edit always wins."],
  ["Embed-safe", "No globals, no global styles, many engines per page. One AbortSignal removes every listener and observer."],
  ["Budgets in CI", "Kernel at most 4 KB gzip, each brick about 1.5 KB. Over budget, the build fails."],
];

// One card per module: [import, tag, what, size entry name, snippet, role colour]
const BRICKS = [
  ["fizlet", "KERNEL", "createEngine, the shared scheduler, Pool, EventRing, Ledger, seeded random and stats(). Everything else is optional.", "fizlet (kernel)",
    `const e = createEngine({ root: board, seed: 7 });
e.add({ step(e, dt) {/* sim */}, render(e) {/* DOM */} });
e.start(); // e.destroy() gives the page back`, "go"],
  ["fizlet/input", "INPUT", "Keys to named intents with one-frame edges, pointer, a touch stick and on-screen press(). Keys typed in the host's fields never count.", "fizlet/input",
    `const pad = controls(e, { keys: { fire: ["Space"] } });
if (pad.hit("fire")) fire(); // true for one frame
if (pad.pointer.hit) aim(pad.pointer.x, pad.pointer.y);`, "sys"],
  ["fizlet/collide", "COLLIDE", "A fixed-capacity spatial hash plus circle, rect and swept segment tests. Pass typed arrays and indices, so nothing boxes.", "fizlet/collide",
    `const grid = new Grid(32, 64, w, h); // cell, cap, world
grid.clear(); grid.add(xs, ys, rs, i); // typed arrays
const n = grid.near(xs, ys, rs, i, out); // ids, once`, "cmd"],
  ["fizlet/fx", "FX", "Pooled particles (struct of arrays), the hero blast(), pop words, scorch marks and screen shake, drawn on a canvas.", "fizlet/fx",
    `const fx = effects({ cap: 420 });
fx.blast(x, y, 1.2);       // flash, rings, debris, scorch
fx.step(dt); fx.draw(ctx); // pooled: never allocates`, "attack"],
  ["fizlet/sound", "SOUND", "Reads the event ring after each frame and plays synth cues, or your own player. Silent until a gesture, and while paused.", "fizlet/sound",
    `const sfx = sound(e, { cues: { boom: "boom" } });
e.events.emit("boom"); // in a step; plays after render
sfx.on = false;        // mute`, "advance"],
  ["fizlet/embed", "EMBED", "Drop a game onto any page: a hex-only palette, easter-egg triggers, lazy load, a toggle key and Escape to give the page back.", "fizlet/embed",
    `embed(() => import("./game.js").then((m) => m.mount), {
  name: "blitz", palette: { cmd: "#8573ee" },
  easterEgg: { sequence: "konami" } });`, "fallin"],
  ["fizlet/ui", "BOARD UI", "The Battlefield design system as a brick: 3D keys, cards, stickers, overlays and the launch burst. This site is built with it.", "fizlet/ui (js)",
    `applyPalette(root, { sys: "#06c4ff" }); // hex only
press(key, () => fire(), signal); // touch-safe
launch(startKey, start); // press, invert, shatter`, "fire"],
  ["fizlet/debug", "DEBUG", "Development only: guardLayout() counts every layout read made during a step, the contract's hardest rule, as a number.", "fizlet/debug",
    `import { guardLayout } from "fizlet/debug";
guardLayout(e);  // dev builds only
e.violations;    // layout reads made in a step: 0`, "aim"],
];

const ROADMAP = [
  ["E0", "Baseline and archives", "part", "PARTLY DONE", "Freeze today's games as the before picture, so every port has numbers to beat.", [
    [1, "Perf harness: every app under a 4× CPU throttle (Playwright)"],
    [1, "Baseline numbers and commits recorded for all six apps"],
    [0, "Tag engine-baseline in every repo"],
    [0, "Battlefield archive selector (versioned paths)"],
    [0, "Hub TEST A RELEASE selector for every game version"],
  ]],
  ["E1", "Kernel", "done", "DONE · 0.1.0", "The scheduler, fixed step, auto-pause, pools, event ring, seeded random, the Recall ledger and stats.", [
    [1, "One rAF for N engines, fixed step with a catch-up cap"],
    [1, "Zero allocation over 1M steps, exact DOM restore"],
    [1, "Kernel under the 4 KB budget"],
  ]],
  ["E2", "Bricks", "now", "IN PROGRESS · 0.2", "Small, separately importable bricks lifted from the games, each with tests and a size budget.", [
    [1, "input · collide · fx · sound · embed · ui"],
    [0, "actor + steer"],
    [0, "aim · rules"],
    [0, "board-page · board-grid"],
    [0, "view-dom · camera"],
    [0, "A playground of runnable examples"],
  ]],
  ["E3", "Port the games", "next", "NOT STARTED", "One game at a time, smallest first, each as a 1.0 engine cut with the old build still playable.", [
    [0, "Null Invaders → Byte Runner → Sherman Bytes"],
    [0, "Swarm Protocol → DOM Battlefield"],
    [0, "Perf equal or better than the baseline"],
  ]],
  ["E4", "Presence and multiplayer", "next", "NOT STARTED", "A few-KB presence client where humans and AI agents are the same kind of player.", [
    [0, "presence brick + reference room server"],
    [0, "Battlefield 1v1 and co-op"],
    [0, "An AI agent joins a room"],
  ]],
  ["E5", "Docs for humans and AI", "next", "NOT STARTED", "Build a game or micro-interaction in an afternoon, from docs a person or an agent can follow.", [
    [0, "Authoring guide, one page per brick, recipes"],
    [0, "AGENTS.md: the strict, AI-readable spec"],
    [0, "Live kernel stats on Under the Hood"],
  ]],
  ["E6", "Weekly performance wins", "next", "NOT STARTED", "A standing weekly pass: run the perf harness, fix the top cost, log the win.", [
    [0, "Weekly harness run against the baseline"],
    [0, "perf-log.md of every win"],
  ]],
];

const PIPELINE = [
  ["src/", "the engine"],
  ["npm run check", "types · tests · size"],
  ["CI tags vX.Y.Z", "from package.json"],
  ["vendor/fizlet", "snapshot + ORIGIN.json"],
  ["Pages", "static, no server"],
];

const LEDGER_ROWS = [
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
      <h3 class="demo-title" aria-label="Hello, page.">${letters}</h3>
      <p class="demo-copy">${words}</p>
      <div class="demo-row"><span class="demo-btn" data-body>SIGN UP</span><span class="demo-chip" data-body>NEW</span><span class="demo-chip alt" data-body>v0.2</span></div>
    </div>`;
}

export function home({ version, sizes, bundle }) {
  const size = (name) => sizes.find((s) => s.name === name);
  const kernel = size("fizlet (kernel)");
  const css = size("fizlet/ui (css)");
  const bricks = BRICKS.map(([imp, tag, what, sizeName, snippet, role], i) => {
    const s = size(sizeName);
    const extra = imp === "fizlet/ui" ? ` + ${kb(css.gzip)} KB css` : "";
    return `<li class="panel brick${i === 0 ? " lit kernel" : ""}" style="--tone: var(--k-${role})">
        <div class="brick-top"><span class="brick-tag">${tag}</span><span class="brick-size"><b>${kb(s.gzip)} KB</b>${extra}<small> / ${kb(s.budget)} KB gzip</small></span></div>
        <h3><code>${imp}</code></h3>
        <p>${esc(what)}</p>
        ${code(snippet)}
        <span class="meter" aria-hidden="true"><i style="--v:${(s.gzip / s.budget).toFixed(3)}"></i></span>
      </li>`;
  }).join("\n      ");

  const contract = CONTRACT.map(([t, b], i) => `<li class="panel rule"><b>${String(i + 1).padStart(2, "0")}</b><h3>${esc(t)}</h3><p>${esc(b)}</p></li>`).join("\n      ");

  const roadmap = ROADMAP.map(([id, name, state, label, text, items]) => `<li class="panel phase" data-phase="${state}">
        <div class="phase-top"><span class="phase-id">${id}</span><span class="phase-pill">${label}</span></div>
        <h3>${esc(name)}</h3>
        <p>${esc(text)}</p>
        <ul class="checks">${items.map(([done, t]) => `<li${done ? ' class="done"' : ""}><i aria-hidden="true">${done ? icon("check", 14) : ""}</i><span>${esc(t)}</span><span class="sr">${done ? "(done)" : "(to do)"}</span></li>`).join("")}</ul>
      </li>`).join("\n      ");

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
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-field" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow"><span class="dot"></span>MICRO GAME ENGINE <span>/</span> <b>FOR THE DOM</b></p>
      <h1 id="hero-title">The page<br><em>is the board.</em></h1>
      <p class="lead">Fizlet is a tiny game engine that plays on the page you already have: one shared loop, bounded everything, and the page always comes back exactly as it was. The kernel is <b>${kb(kernel.gzip)} KB</b> gzipped. No runtime dependencies, ever.</p>
      <div class="hero-keys">
        <a class="bui-key bui-arcade bui-go" href="#start">${icon("play", 16)}Quick start</a>
        <a class="bui-key bui-arcade bui-sys" href="#contract">${icon("down", 16)}The contract</a>
        <a class="hero-link" href="${REPO}">${icon("github", 16)}coded-dot-design/fizlet ↗</a>
      </div>
      <div class="hero-install code-card"><div class="code-head"><span class="bui-label"><b>SCRIPT TAG</b> · ${kb(bundle)} KB, EVERY BRICK</span><button class="copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(`<script src="${SITE}fizlet.js"></script>`, "wrap")}</div>
    </div>

    <figure class="demo panel lit" data-demo aria-label="Live demo: a small page you can blast. Recall puts it back.">
      <div class="demo-chrome"><i></i><i></i><i></i><span class="demo-url">your.page</span><span class="demo-state" data-state>BOOTING</span></div>
      <div class="demo-board" data-board>
        ${demoPage()}
        <canvas class="demo-fx" data-fx aria-hidden="true"></canvas>
        <div class="demo-slam" data-slam hidden><div class="bui-sticker"><span>RECALL</span><b>RESTORED</b></div></div>
        <p class="demo-hint" data-hint aria-hidden="true"><span class="blink"></span>CLICK THE PAGE</p>
      </div>
      <div class="demo-keys">
        <button class="bui-arcade bui-attack" type="button" data-blast>${icon("fire", 18)}Blast<kbd>B</kbd></button>
        <button class="bui-arcade bui-cmd" type="button" data-recall>${icon("recall", 18)}Recall<kbd>R</kbd></button>
        <button class="bui-icon-key" type="button" data-sound aria-pressed="false" aria-label="Sound"><span class="snd-off">${icon("mute")}</span><span class="snd-on">${icon("sound")}</span></button>
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
    </figure>
  </div>
</section>

<!-- STATS -->
<section class="stats" aria-label="Fizlet in numbers">
  <div class="wrap stats-row">
    <span><b>${kb(kernel.gzip)} KB</b><small>KERNEL GZIP</small></span>
    <span><b>${BRICKS.length - 1}</b><small>BRICKS</small></span>
    <span><b>0</b><small>DEPENDENCIES</small></span>
    <span><b>1</b><small>rAF PER PAGE</small></span>
    <span><b>1M</b><small>STEPS · NO GC</small></span>
    <span class="soon"><i></i><b>V${esc(version)}</b><small>MIT · OPEN SOURCE</small></span>
  </div>
</section>

<!-- 01 THE CONTRACT -->
<section id="contract" class="section" aria-labelledby="contract-title">
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
<section id="bricks" class="section" aria-labelledby="bricks-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">02</span> KERNEL + BRICKS</p>
      <h2 id="bricks-title">Take only<br><em>what you need.</em></h2>
      <p class="lead">One small kernel and a box of bricks, each its own import with its own budget. Sizes are measured on this build: minified, gzipped, with everything each one pulls in.</p>
    </div>
    <ul class="bricks">
      ${bricks}
    </ul>
  </div>
</section>

<!-- 03 THE PAGE BECOMES THE BOARD -->
<section id="board" class="section" aria-labelledby="board-title">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">03</span> THE PAGE BECOMES THE BOARD</p>
      <h2 id="board-title">Read. Step.<br><em>Render.</em></h2>
      <p class="lead">A web page is a surprisingly good game map. The trick is reading it cheaply, changing only what you own and leaving cleanly. Every frame runs three phases, in order, for every system.</p>
      <p class="body">Geometry is read once in <code>read</code> and cached. The simulation runs in <code>step</code> on plain numbers, at a fixed 60 Hz, with no DOM at all. <code>render</code> writes only what changed, through the ledger. The demo above counts layout reads made during a step with <code>fizlet/debug</code>: the number stays at zero.</p>
    </div>
    <ol class="phases panel lit" aria-label="One frame">
      <li style="--tone: var(--k-sys)"><b>READ</b><span>once a frame</span><p>Cached geometry, input edges latched. The only phase that may measure the page.</p></li>
      <li style="--tone: var(--k-go)"><b>STEP <small>× 0–4</small></b><span>fixed dt = 1/60 s</span><p>The simulation. No DOM reads, no DOM writes, no allocation. Events go into the ring.</p></li>
      <li style="--tone: var(--k-attack)"><b>RENDER</b><span>once a frame · alpha</span><p>Change-only writes through engine.ledger. Sound and effects read the event ring.</p></li>
    </ol>
  </div>
</section>

<!-- 04 ONE LOOP. BOUNDED WORK. -->
<section id="loop" class="section" aria-labelledby="loop-title">
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
<section id="recall" class="section" aria-labelledby="recall-title">
  <div class="wrap split">
    <div>
      <p class="eyebrow"><span class="index">05</span> THE PART WE CARE ABOUT MOST</p>
      <h2 id="recall-title">Recall gives<br><em>the page back.</em></h2>
      <p class="lead">Every change Fizlet makes to the page goes through one ledger. It records the original and what the engine wrote. <code>destroy()</code> puts back everything the engine still owns, newest first.</p>
      <p class="body">If the host page changed something after the engine did, the host wins: the ledger stops writing it and never restores over it. A style attribute comes back byte for byte. Try it in the demo: blast the heading, then press <b>Recall</b>. That key runs <code>engine.ledger.restore()</code>, the same call <code>destroy()</code> makes.</p>
      <div class="split-keys"><a class="bui-key bui-arcade bui-cmd" href="#main">${icon("recall", 16)}Back to the demo</a></div>
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
<section id="specs" class="section" aria-labelledby="specs-title">
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
<section id="ship" class="section" aria-labelledby="ship-title">
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
<section id="games" class="section" aria-labelledby="games-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">08</span> BUILT ON FIZLET</p>
      <h2 id="games-title">Games that<br><em>play on your page.</em></h2>
    </div>
    <div class="games">
      <article class="panel lit game blitz">
        <p class="eyebrow"><span class="dot"></span> FIRST GAME ON FIZLET · <b>FREE FOR ALL</b></p>
        <h3>Battlefield Blitz</h3>
        <p>Every tank for itself. Parachute in, grab power tiles, call airstrikes, dodge mines. Most kills in three minutes wins. About 17 KB gzipped with the engine and the art, and it drops onto any website with one line: shells knock your headings around, and Escape gives the page back.</p>
        <span class="bui-label"><b>DROP-IN</b> · ONE LINE ON ANY PAGE</span>
        ${code(`<script src="${BLITZ}blitz.js" defer></script>`, "wrap")}
        <ul class="game-facts">
          <li><b>~17 KB</b><span>gzip, engine and art</span></li>
          <li><b>3 min</b><span>free-for-all match</span></li>
          <li><b>Esc</b><span>gives the page back</span></li>
        </ul>
        <p class="game-uses">Built on <code>fizlet</code> · <code>input</code> · <code>collide</code> · <code>fx</code> · <code>sound</code> · <code>embed</code> · <code>ui</code></p>
        <div class="game-keys">
          <a class="bui-key bui-arcade bui-attack" href="${BLITZ}play/">${icon("play", 16)}Play Blitz</a>
          <a class="bui-key bui-arcade bui-sys" href="${BLITZ}">${icon("book", 16)}About Blitz</a>
        </div>
      </article>
      <article class="panel game">
        <p class="eyebrow"><b>THE ARCADE</b> · PORTING IN E3</p>
        <h3>DOM VIRUS</h3>
        <p>Tiny games that turn your page into the game board. Fizlet is the engine they proved out: Null Invaders, Byte Runner, Sherman Bytes and Swarm Protocol move onto it one at a time.</p>
        <div class="game-keys"><a class="bui-key bui-arcade bui-cmd" href="${HUB}">${icon("cart", 16)}Visit DOM VIRUS ↗</a></div>
      </article>
      <article class="panel game">
        <p class="eyebrow"><b>SQUAD TACTICS</b> · PORTING IN E3</p>
        <h3>DOM Battlefield</h3>
        <p>Twelve tanks, one radio. The game whose board UI became this design system, and the next big port: then multiplayer, in E4.</p>
        <div class="game-keys"><a class="bui-key bui-arcade bui-go" href="${BATTLEFIELD}">${icon("out", 16)}DOM Battlefield ↗</a></div>
      </article>
    </div>
  </div>
</section>

<!-- 09 ROADMAP -->
<section id="roadmap" class="section" aria-labelledby="roadmap-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow"><span class="index">09</span> ROADMAP · E0 TO E6</p>
      <h2 id="roadmap-title">What's done.<br><em>What's left.</em></h2>
      <p class="lead">The plan of record is <a href="${ENGINE_PLAN}">ENGINE.md</a> in the DOM VIRUS repo. The kernel is done, the first bricks shipped with Blitz, and the rest of E2 is next.</p>
    </div>
    <ol class="roadmap">
      ${roadmap}
    </ol>
  </div>
</section>

<!-- 10 QUICK START -->
<section id="start" class="section" aria-labelledby="start-title">
  <div class="wrap start">
    <div class="start-head">
      <p class="eyebrow"><span class="index">10</span> QUICK START</p>
      <h2 id="start-title">Ten lines<br><em>to a blast.</em></h2>
      <p class="lead">One script tag puts the kernel and every brick on <code>window.fizlet</code>. Click the canvas: that's the hero explosion, pooled, paused when you scroll away.</p>
      <ol class="start-steps">
        <li><b>Script tag.</b> <code>fizlet.js</code> (${kb(bundle)} KB gzip), one file, no build step.</li>
        <li><b>Modules.</b> Import only the bricks you use from <code>${SITE}dist/</code>.</li>
        <li><b>From source.</b> Not on npm yet: <code>git clone</code>, <code>npm ci</code>, <code>npm run build</code> gives you <code>dist/</code> with the subpath exports.</li>
      </ol>
      <div class="split-keys">
        <a class="bui-key bui-arcade bui-go" href="examples/quick-start.html">${icon("play", 16)}Run the example</a>
        <a class="bui-key bui-arcade bui-sys" href="${REPO}#readme">${icon("book", 16)}Read the API</a>
      </div>
    </div>
    <div class="start-code">
      <div class="panel lit code-card"><div class="code-head"><span class="bui-label"><b>SCRIPT TAG</b> · index.html</span><button class="copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(QUICK_START(SITE + "fizlet.js"))}</div>
      <div class="panel code-card"><div class="code-head"><span class="bui-label"><b>MODULES</b> · only what you use</span><button class="copy" type="button" data-copy>${icon("copy", 14)}Copy</button></div>${code(`<script type="module">
  import { createEngine } from "${SITE}dist/index.js";
  import { effects } from "${SITE}dist/fx.js";
  import { controls } from "${SITE}dist/input.js";
</script>`)}</div>
    </div>
  </div>
</section>

<!-- FINAL -->
<section class="section final" aria-labelledby="final-title">
  <div class="wrap final-inner">
    <p class="eyebrow">MIT · NO DEPENDENCIES · V${esc(version)}</p>
    <h2 id="final-title">Make the page play.</h2>
    <div class="final-keys">
      <a class="bui-key bui-arcade bui-go" href="#start">${icon("play", 16)}Quick start</a>
      <a class="bui-key bui-arcade bui-sys" href="${REPO}">${icon("github", 16)}Source on GitHub</a>
    </div>
    <p class="final-links"><a href="${REPO}/blob/main/CHANGELOG.md">Changelog</a> · <a href="${ENGINE_PLAN}">Engine plan</a> · <a href="${HUB}">DOM VIRUS</a> · <a href="${BATTLEFIELD}">DOM Battlefield</a></p>
  </div>
</section>
`;
}
