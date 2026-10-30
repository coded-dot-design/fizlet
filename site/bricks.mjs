// The brick catalog: which modules each website page documents, and which size entry
// (scripts/sizes.mjs) measures it. Everything else on a brick page (summary, API, sizes) is read
// from the source and the build by scripts/api.mjs and scripts/sizes.mjs; tests/api.test.mjs checks
// this list against package.json's exports and the modules' runtime exports.

/** One module of a brick: its import, source, declarations and size entry. */
const mod = (name, file, size = name) => ({ name, src: `src/${file}.ts`, dts: `dist/${file}.d.ts`, size });

/**
 * The status flags, one per brick, and what earns each. The README's "What's in the box" table, the
 * brick pages and the bricks index read them from here; tests/status.test.mjs checks the evidence
 * below against the repo (the test files exist, a COMPLETE brick names who ships it, the README
 * agrees). The engine as a whole is a 0.x public beta (BETA_LINE).
 */
export const STATUS = {
  complete: { label: "COMPLETE", tone: "go", line: "Done, and always getting smaller and faster.",
    criteria: ["Its own export in package.json, with a size budget that `npm run size` checks in CI", "Tests in the suites (Node, and Chromium where it touches the page), including zero allocation per step where it runs per step", "Documented: a README row and a generated brick page", "Shipped: used by at least one released game or production page beyond its own demo", "API stable: no breaking change since it first shipped; one would need a CHANGELOG entry and moves it back to BETA"] },
  beta: { label: "BETA", tone: "sys", line: "Tested and budgeted; not yet carried by a shipped game, or its API is still moving.",
    criteria: ["Its own export, a size budget, tests and docs, like COMPLETE", "Not yet used by a released game or production page, or its API is still growing", "Safe to build on; a minor release may change it, and the CHANGELOG says how"] },
  experimental: { label: "EXPERIMENTAL", tone: "aim", line: "In the package to try; no promise yet.",
    criteria: ["Its own export and a size budget", "Tests may be partial", "May change or go away in any release"] },
  roadmap: { label: "ROADMAP", tone: "next", line: "Planned, not shipped: a name, a purpose, a size target.",
    criteria: ["Not in the package: nothing to import yet", "Has a purpose, a size target and the bricks it depends on", "Moves to EXPERIMENTAL or BETA when it lands with tests and a budget"] },
  deprecated: { label: "DEPRECATED", tone: "hurt", line: "Still in the package, replaced by something named.",
    criteria: ["Names its replacement", "Removed in the first minor release after the replacement is COMPLETE"] },
};

/** The one line for the whole engine: every page and the README say the same. */
export const BETA_LINE = "Fizlet 0.x is a public beta: every brick carries a status flag, and a 0.x minor release may change a BETA brick's API (the CHANGELOG says how). COMPLETE bricks keep theirs.";

/**
 * [{ id, tag, role, modules, sizes, demo, snippet, status, since, tests, used, why }]. `sizes` are
 * the size entries shown (the first is the headline); `demo` names a live demo in site/demos/ (only
 * where it is cheap). `status` is a key of STATUS; `since` the release it first shipped in;
 * `tests` the files that test it; `used` the released games and production pages that ship it
 * (not its own demo); `why` says what keeps a BETA brick from COMPLETE.
 */
export const BRICKS = [
  { id: "kernel", status: "complete", since: "0.1.0", tests: ["kernel.test.mjs", "browser.mjs"], used: ["every game: DOM Battlefield 1.0, Battlefield Blitz, Null Invaders 1.0, Byte Runner 1.0, Sherman Bytes 1.0, Swarm Protocol 1.4", "fizlet.com"],
    tag: "KERNEL", role: "go", modules: [{ ...mod("fizlet", "index", "fizlet (kernel)"), src: "src/index.ts" }], demo: "settle",
    snippet: `const e = createEngine({ root: board, seed: 7 });
e.add({ step(e, dt) {/* sim */}, render(e) {/* DOM */} });
e.start(); // e.destroy() gives the page back` },
  { id: "input", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs", "browser.mjs", "page.test.mjs"], used: ["Battlefield Blitz", "Null Invaders, Byte Runner and Sherman Bytes (through fizlet/arcade)"],
    tag: "INPUT", role: "sys", modules: [mod("fizlet/input", "input")],
    snippet: `const pad = controls(e, { keys: { fire: ["Space"] } });
if (pad.hit("fire")) fire(); // true for one frame
if (pad.pointer.hit) aim(pad.pointer.x, pad.pointer.y);` },
  { id: "pad", status: "complete", since: "0.3.3", tests: ["bricks.test.mjs", "browser.mjs"], used: ["Null Invaders, Byte Runner and Sherman Bytes (through fizlet/arcade)"],
    tag: "PAD", role: "advance", modules: [mod("fizlet/pad", "pad")] },
  { id: "collide", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs"], used: ["Battlefield Blitz"],
    tag: "COLLIDE", role: "cmd", modules: [mod("fizlet/collide", "collide")],
    snippet: `const grid = new Grid(32, 64, w, h); // cell, cap, world
grid.clear(); grid.add(xs, ys, rs, i); // typed arrays
const n = grid.near(xs, ys, rs, i, out); // ids, once` },
  { id: "grid", status: "beta", since: "0.3.1", tests: ["grid.test.mjs"], used: [], why: "No released game runs on it yet: only its own demo.",
    tag: "GRID", role: "flag", modules: [mod("fizlet/grid", "grid")], demo: "grid",
    snippet: `const b = board(48, 30, { cell: 40 });
b.scatter(seeded(1234), 0.12, ROCK, 1, BLOCKED);
const n = b.path(from, to, out, 400); // -1 = no path` },
  { id: "fx", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs", "page.test.mjs", "site.mjs"], used: ["Battlefield Blitz", "fizlet.com: the home demo and the gallery"],
    tag: "FX", role: "attack", modules: [mod("fizlet/fx", "fx")], demo: "fx",
    snippet: `const fx = effects({ cap: 420 });
fx.blast(x, y, 1.2);       // flash, rings, debris, scorch
fx.step(dt); fx.draw(ctx); // pooled: never allocates` },
  { id: "camera", status: "beta", since: "0.9.0", tests: ["camera.test.mjs", "camera.mjs"], used: [], why: "No released page or game runs on it: the fizz dropped it in 0.19.0.",
    tag: "CAMERA", role: "go", modules: [mod("fizlet/camera", "camera")] },
  { id: "sprite", status: "complete", since: "0.3.2", tests: ["bricks.test.mjs", "browser.mjs"], used: ["fizlet.com: the gallery's scenes"],
    tag: "SPRITE", role: "fallin", modules: [mod("fizlet/sprite", "sprite")], demo: "sprite",
    snippet: `const art = sprites({ bug: { colors: { b: "team" }, frames: [rows] } },
  { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }] });
art.draw(ctx, "bug", frame, x, y, angle, 3, side);
img.src = spriteURL(def, 0, palettes); // the same pixels as SVG` },
  { id: "sound", status: "complete", since: "0.2.0", tests: ["browser.mjs"], used: ["Battlefield Blitz", "Null Invaders, Byte Runner and Sherman Bytes (through fizlet/arcade)"],
    tag: "SOUND", role: "advance", modules: [mod("fizlet/sound", "sound")], demo: "sound",
    snippet: `const sfx = sound(e, { cues: { boom: "boom" } });
e.events.emit("boom"); // in a step; plays after render
sfx.on = false;        // mute` },
  { id: "embed", status: "complete", since: "0.2.0", tests: ["browser.mjs"], used: ["Battlefield Blitz (the drop-in)"],
    tag: "EMBED", role: "fallin", modules: [mod("fizlet/embed", "embed")],
    snippet: `embed(() => import("./game.js").then((m) => m.mount), {
  name: "blitz", palette: { cmd: "#8573ee" },
  easterEgg: { sequence: "konami" } });` },
  { id: "slot", status: "complete", since: "0.3.0", tests: ["browser.mjs", "fizz.mjs", "layers.mjs", "page.test.mjs"], used: ["fizlet.com: the home hero, the fizz and the gallery"],
    tag: "SLOT", role: "sys", modules: [mod("fizlet/slot", "slot")] },
  { id: "hud", status: "beta", since: "0.3.6", tests: ["hud.test.mjs", "browser.mjs"], used: [], why: "Only fizlet/arcade's skirmish preset uses it, and no released game uses that preset yet.",
    tag: "HUD", role: "aim", modules: [mod("fizlet/hud", "hud")] },
  { id: "match", status: "beta", since: "0.4.3", tests: ["match.test.mjs", "browser.mjs"], used: [], why: "No released game runs its match flow on it yet.",
    tag: "MATCH", role: "go", modules: [mod("fizlet/match", "match")] },
  { id: "board-page", status: "beta", since: "0.4.4", tests: ["browser.mjs"], used: ["Byte Runner, Sherman Bytes, Swarm Protocol 1.4", "Null Invaders (through fizlet/arcade)"], why: "Tested only in the browser: no Node test and no allocation test for its step queries (near, hit) yet.",
    tag: "BOARD PAGE", role: "attack", modules: [mod("fizlet/board-page", "board-page")] },
  { id: "presence", status: "beta", since: "0.4.0", tests: ["presence.test.mjs", "api.test.mjs"], used: ["Battlefield Blitz two players (behind an invite code)"], why: "The API is still growing: interpolation and AI players come next.",
    tag: "PRESENCE", role: "cmd", modules: [mod("fizlet/presence", "presence"), mod("fizlet/presence/check", "presence-check")] },
  { id: "ui", status: "complete", since: "0.1.0", tests: ["browser.mjs", "tokens.test.mjs"], used: ["every game", "fizlet.com", "the DOM VIRUS and DOM Battlefield sites"],
    tag: "BOARD UI", role: "fire", modules: [mod("fizlet/ui", "ui/board-ui", "fizlet/ui (js)")], sizes: ["fizlet/ui (js)", "fizlet/ui (css)"],
    snippet: `applyPalette(root, { sys: "#06c4ff" }); // hex only
press(key, () => fire(), signal); // touch-safe
launch(startKey, start); // press, invert, shatter` },
  { id: "perf", status: "complete", since: "0.7.0", tests: ["perf.test.mjs", "browser.mjs"], used: ["the DOM Battlefield and DOM VIRUS sites (the performance switch)"],
    tag: "PERF", role: "sys", modules: [mod("fizlet/perf", "perf")] },
  { id: "rules", status: "complete", since: "0.6.0", tests: ["rules.test.mjs"], used: ["DOM Battlefield 1.0.0 (supply drops: drops in src/model.ts, dom-battlefield#11)", "Battlefield Blitz 0.8.0+ (supply crates: drops in src/game.ts, Blitz#4)", "Null Invaders 1.0 (drops, score)", "Sherman Bytes 1.0 (drops, score, waves)"],
    tag: "RULES", role: "advance", modules: [mod("fizlet/rules", "rules")] },
  { id: "steer", status: "beta", since: "0.17.0", tests: ["steer.test.mjs"], used: [], why: "No released game moves on it yet (Battlefield Blitz is first in line).",
    tag: "STEER", role: "advance", modules: [mod("fizlet/steer", "steer")],
    snippet: `const m = steer({ cap: 16, random: e.random, blocked: (i, at) => wall(at[0], at[1]) });
m.place(0, 100, 200);
m.seek(0, player.x, player.y, dt); // in a step: also flee, arrive, wander, patrol` },
  { id: "coach", status: "beta", since: "0.17.0", tests: ["coach.test.mjs", "coach.mjs"], used: [], why: "No released game runs its tutorial on it yet.",
    tag: "COACH", role: "sys", modules: [mod("fizlet/coach", "coach")],
    snippet: `const tips = flag("my-game:tips", "off"); // localStorage, never throws
const t = tour(e), c = card(root, { onEnd: quit });
t.tick(dt); if (moved > 220) t.pass(); // in a step
const k = t.show(); if (k >= 0) c.show(\`\${k + 1}/10\`, STEPS[k], TEXT[k]);` },
  { id: "timeline", status: "beta", since: "0.19.0", tests: ["timeline.test.mjs", "timeline.mjs"], used: [], why: "New in 0.19.0: only its own demo so far; the site heroes move onto it next.",
    tag: "TIMELINE", role: "fire", modules: [mod("fizlet/timeline", "timeline")], demo: "timeline",
    snippet: `timeline(e)
  .to(cart, { translate: ["0px -150px", "0px 0px"] }, { dur: 0.7, ease: "back" })
  .label("seated")
  .to(screen, { "clip-path": ["inset(50%)", "inset(0%)"] }, { at: "seated" })
  .to(lines, { opacity: [0, 1] }, { stagger: 0.15 })
  .play(); // e.destroy() gives every property back` },
  { id: "touch", status: "beta", since: "0.20.0", tests: ["touch.mjs"], used: [], why: "New in 0.20.0: no released game or page ships it yet.",
    tag: "TOUCH", role: "sys", modules: [mod("fizlet/touch", "touch")],
    snippet: `lockTouch(); // pinch never zooms the page from a slot, a game or the pad
lockTouch(document, null); // a full-screen board: the whole page` },
  { id: "css-clock", status: "beta", since: "0.21.0", tests: ["css-clock.test.mjs", "css-clock.mjs"], used: ["fizlet.com (the home demo's hint and the roadmap's current phase)"], why: "New since 0.20.0: its API may still move.",
    tag: "CSS CLOCK", role: "fire", modules: [mod("fizlet/css-clock", "css-clock")],
    snippet: `/* CSS: the look stays in the stylesheet, paused; its time is --fz-t */
.led { animation: blink 1s steps(2) infinite paused; animation-delay: var(--fz-t, 0s); }

const c = cssClock(diagram, { span: 6, loops: 3 }); // rests on frame one, settles
pauseButton.onclick = () => c.hold(!held); // c.destroy() gives the page back` },
  { id: "arcade", status: "complete", since: "0.11.0", tests: ["arcade.mjs", "arcade-game.mjs", "arcade-hud.mjs"], used: ["Null Invaders 1.0", "Byte Runner 1.0", "Sherman Bytes 1.0"],
    tag: "ARCADE", role: "go", modules: [mod("fizlet/arcade", "arcade")],
    snippet: `const game = arcade({ id: "null-invaders", title: "Null Invaders", color: "#06c4ff",
  hint: "Mouse / WASD · Space fires", css: KIT_CSS, fire: true,
  readouts: [["Score", "team"], ["Wave"]], colors: ["#06c4ff"],
  cues: { fire: "fire" }, create: (ctx) => myRules(ctx) }, { root: "main" });
game.start(); // Escape: Recall` },
  { id: "debug", status: "complete", since: "0.1.0", tests: ["browser.mjs"], used: ["fizlet.com: the home demo (guardLayout)"],
    tag: "DEBUG", role: "aim", modules: [mod("fizlet/debug", "debug")],
    snippet: `import { guardLayout } from "fizlet/debug";
guardLayout(e);  // dev builds only
e.violations;    // layout reads made in a step: 0` },
].map((b) => ({ sizes: b.modules.map((m) => m.size), ...b, name: b.modules[0].name }));

export const brickPath = (b) => `bricks/${b.id}.html`;

/**
 * ROADMAP bricks: planned, not in the package. [{ name, phase, purpose, target, needs }]: `target`
 * is the size budget it is planned under (bytes gzip, a goal until measured); `needs` the bricks it
 * builds on. Each phase is a planned phase of site/roadmap.mjs (E9–E16), which lists these under it.
 */
export const PLANNED = [
  { name: "fizlet/layout", phase: "E10", purpose: "Force-directed layout on typed arrays with a Barnes-Hut pass: diagrams and graphs that settle.", target: 2048, needs: ["fizlet", "fizlet/camera"] },
  { name: "fizlet/view-canvas", phase: "E10", purpose: "One overlay canvas per root, sized for the screen's pixel density, redrawn only where something changed.", target: 1229, needs: ["fizlet"] },
  { name: "fizlet/actor", phase: "E11", purpose: "Entities on typed arrays: spawn, kill, side, health and tags, with fixed capacity.", target: 1229, needs: ["fizlet"] },
  { name: "fizlet/aim", phase: "E11", purpose: "Lead targeting, firing cones and line of sight for bots and turrets.", target: 1024, needs: ["fizlet/steer", "fizlet/grid"] },
  { name: "fizlet/view-dom", phase: "E11", purpose: "Pooled DOM nodes bound to actors, written change-only through the ledger.", target: 1536, needs: ["fizlet/actor"] },
  { name: "fizlet/snapshot", phase: "E12", purpose: "Fixed-capacity state to bytes and deltas, for authoritative rooms and replays.", target: 1536, needs: ["fizlet/presence", "fizlet/actor"] },
  { name: "fizlet/agent", phase: "E12", purpose: "An AI player that joins a room on the same command channel as a person.", target: 1024, needs: ["fizlet/presence", "fizlet/rules"] },
  { name: "fizlet/scene", phase: "E13", purpose: "An animation recipe as data (stage, cast, cue, gag) mounted as a scene.", target: 2048, needs: ["fizlet/sprite", "fizlet/fx", "fizlet/timeline", "fizlet/slot"] },
  { name: "fizlet/announce", phase: "E14", purpose: "Game events read out to screen readers through one polite live region, rate-limited.", target: 614, needs: ["fizlet"] },
  { name: "fizlet/music", phase: "E15", purpose: "A tiny step sequencer on the kernel clock: patterns and tempo on the sound brick's synth.", target: 1229, needs: ["fizlet/sound"] },
];
