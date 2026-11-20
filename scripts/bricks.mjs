// The brick catalog: which modules each brick's docs page covers, and which size entry
// (scripts/sizes.mjs) measures it (moved here from the website's site/bricks.mjs: the docs and the
// README read it from the package). Everything else on a brick page (summary, API, sizes) is read
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
  experimental: { label: "ALPHA", tone: "aim", line: "In the package to try; no promise yet.",
    criteria: ["Its own export and a size budget", "Tests may be partial", "May change or go away in any release"] },
  roadmap: { label: "ROADMAP", tone: "next", line: "Planned, not shipped: a name, a purpose, a size target.",
    criteria: ["Not in the package: nothing to import yet", "Has a purpose, a size target and the bricks it depends on", "Moves to ALPHA or BETA when it lands with tests and a budget"] },
  deprecated: { label: "DEPRECATED", tone: "hurt", line: "Still in the package, replaced by something named.",
    criteria: ["Names its replacement", "Removed in the first minor release after the replacement is COMPLETE"] },
};

/** The one line for the whole engine: every page and the README say the same. */
export const BETA_LINE = "Fizlet 0.x is a public beta: every brick carries a status flag, and a 0.x minor release may change a BETA brick's API (the CHANGELOG says how). COMPLETE bricks keep theirs.";

/**
 * In-house / experimental (owner, 2026-10-31: multiplayer is in-house): bricks that ship in the
 * package (MIT, shipped, no breaking change) and that our games run on, but that aren't offered as
 * a supported service. Every list of bricks (the bricks page, the home page, the README table,
 * llms-full.txt) shows them apart, under this label. The way to run your own room server:
 * /guides/build-your-own-room-server/.
 */
export const IN_HOUSE = { ids: ["presence"], label: "In-house / experimental", line: "Used in our games. Not a supported multiplayer service.", guide: "guides/build-your-own-room-server/" };
/** Is this brick in the in-house group? */
export const inHouse = (b) => IN_HOUSE.ids.includes(b.id);

/** One export's flag: its brick's, unless its doc comment carries `@deprecated`, `@experimental` or `@beta`. */
export const exportStatus = (brick, decl) => decl.tags.find((t) => ["deprecated", "experimental", "beta"].includes(t.name))?.name ?? brick.status;

/**
 * The periodic table's families (bricks/ hero), in column order: `tone` is the family's Board UI
 * token (its column head, and a planned brick's colour, which has no role yet).
 */
export const FAMILIES = [
  { id: "kernel", label: "Kernel", tone: "go" },
  { id: "input", label: "Input", tone: "sys" },
  { id: "network", label: "Network", tone: "cmd" },
  // IN_HOUSE's bricks (above): its column, beside Network (presence is the multiplayer brick), with
  // its line as the note.
  { id: "inhouse", label: "In-house", tone: "hurt", note: IN_HOUSE.line },
  { id: "motion", label: "Motion", tone: "advance" },
  { id: "render", label: "Render", tone: "attack" },
  { id: "game", label: "Game", tone: "fire" },
  { id: "page", label: "Page", tone: "fallin" },
];

/**
 * The periodic table's two blocks (bricks/ hero), side by side: 2D (the kernel and the DOM, CSS and
 * 2D-canvas bricks) and 3D (the tabletop bricks on `@fzlt/core/diorama`: roadmap E17). Each block
 * has its own family columns, in FAMILIES order; a brick is 3D when DIMS[1].ids lists it.
 */
export const DIMS = [
  { id: "2d", label: "2D", sub: "kernel, DOM, CSS, canvas" },
  { id: "3d", label: "3D", sub: "tabletop, on diorama", line: "Software 3D on a 2D canvas you own: diorama draws the scene; the rest furnish it, move it and play on it.",
    ids: ["diorama", "dice", "track", "water", "props", "beam", "cards", "flick", "terrain", "drive", "rig", "ribbon", "turntable", "ground"] },
];
/** A brick's block in the table: "3d" or "2d". */
export const dimOf = (b) => (DIMS[1].ids.includes(b.id) ? "3d" : "2d");

/**
 * Every brick, shipped and planned, carries three periodic-table fields, kept here and nowhere else:
 * - `no`: its number. The kernel is 1; shipped bricks in the order they shipped (`since`, then this
 *   list), planned ones after, in roadmap order. A shipped brick's number never moves; planned
 *   numbers shift up by one when a new brick ships ahead of them (owner, 2026-11-13).
 * - `sym`: its two-letter symbol, lowercase mono like the fzlt mark (fizlet, vowels out: fzlt), for
 *   recognising a brick at a glance. The rule: the name's first letter, then its next consonant
 *   (vowels and a repeat of the first letter skipped: kernel kr, coach ch); on a clash the lower
 *   number keeps it and the later brick takes its next consonant (sound sn, snapshot sh). A name
 *   with no consonant after its first letter keeps its own next letter (ui). fx reads as itself.
 *   tests/symbols.test.mjs checks every symbol is unique, two letters and follows the rule.
 * - `family`: its column in the table, a FAMILIES id.
 * A brick's second module can stand in the table as its own tile when it carries a `sym` (presence/check:
 * pc): its brick's first letter, then the module's first letter. It shares its brick's number, as
 * "14b", and its family.
 */

/**
 * The released games, each at its latest tag (github.com/coded-dot-design/<repo>/tags): the `used`
 * lines below name them through this, so a new release is one edit here. A game counts once a tag
 * ships the brick; the sites count once their deployed build does.
 */
const GAME = {
  battlefield: "DOM Battlefield 1.0.3", blitz: "Battlefield Blitz 1.0.1", invaders: "Null Invaders 1.0.3",
  runner: "Byte Runner 1.0.2", sherman: "Sherman Bytes 1.1.0", swarm: "Swarm Protocol 1.4.0",
};
/** The three arcade games, which take most bricks through @fzlt/core/arcade. */
const ARCADE = `${GAME.invaders}, ${GAME.runner} and ${GAME.sherman}`;
/** The DOM Battlefield site's hero battle (a slot scene on the kernel, fx and sprite). */
const BF_HERO = `the hero battle on the ${GAME.battlefield} site`;
/** The BETA bricks that ship now: what COMPLETE still asks for. */
const API_CHECK = "Shipped now; COMPLETE also asks that its API has had no breaking change since it shipped, which is still to be confirmed.";

/**
 * [{ id, no, sym, family, tag, role, modules, sizes, demo, snippet, status, since, tests, used, why }]. `sizes` are
 * the size entries shown (the first is the headline); `demo` names a live demo in site/demos/ (only
 * where it is cheap). `status` is a key of STATUS; `since` the release it first shipped in;
 * `tests` the files that test it; `used` the released games and production pages that ship it
 * (not its own demo); `why` says what keeps a BETA brick from COMPLETE.
 */
export const BRICKS = [
  { id: "kernel", no: 1, sym: "kr", family: "kernel", status: "complete", since: "0.1.0", tests: ["kernel.test.mjs", "browser.mjs"], used: [`every game: ${Object.values(GAME).join(", ")}`, "fizlet.com", "the DOM VIRUS site"],
    tag: "KERNEL", role: "go", modules: [{ ...mod("@fzlt/core", "index", "@fzlt/core (kernel)"), src: "src/index.ts" }], demo: "settle",
    snippet: `const e = createEngine({ root: board, seed: 7 });
e.add({ step(e, dt) {/* sim */}, render(e) {/* DOM */} });
e.start(); // e.destroy() gives the page back` },
  { id: "input", no: 4, sym: "in", family: "input", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs", "browser.mjs", "page.test.mjs"], used: [GAME.blitz, `${ARCADE} (through @fzlt/core/arcade)`],
    tag: "INPUT", role: "sys", modules: [mod("@fzlt/core/input", "input")],
    snippet: `const pad = controls(e, { keys: { fire: ["Space"] } });
if (pad.hit("fire")) fire(); // true for one frame
if (pad.pointer.hit) aim(pad.pointer.x, pad.pointer.y);` },
  { id: "pad", no: 12, sym: "pd", family: "input", status: "complete", since: "0.3.3", tests: ["bricks.test.mjs", "browser.mjs"], used: [`${ARCADE} (through @fzlt/core/arcade)`],
    tag: "PAD", role: "advance", modules: [mod("@fzlt/core/pad", "pad")] },
  { id: "collide", no: 5, sym: "cl", family: "motion", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs"], used: [`${GAME.blitz} (inRect)`, `${GAME.invaders}, ${GAME.runner}, ${GAME.sherman} and ${GAME.swarm} (the page-text Grid inside @fzlt/core/board-page)`],
    tag: "COLLIDE", role: "cmd", modules: [mod("@fzlt/core/collide", "collide")],
    snippet: `const grid = new Grid(32, 64, w, h); // cell, cap, world
grid.clear(); grid.add(xs, ys, rs, i); // typed arrays
const n = grid.near(xs, ys, rs, i, out); // ids, once` },
  { id: "grid", no: 10, sym: "gr", family: "motion", status: "beta", since: "0.3.1", tests: ["grid.test.mjs"], used: [], why: "No released game runs on it yet: only its own demo.",
    tag: "GRID", role: "flag", modules: [mod("@fzlt/core/grid", "grid")], demo: "grid",
    snippet: `const b = board(48, 30, { cell: 40 });
b.scatter(seeded(1234), 0.12, ROCK, 1, BLOCKED);
const n = b.path(from, to, out, 400); // -1 = no path` },
  { id: "fx", no: 6, sym: "fx", family: "render", status: "complete", since: "0.2.0", tests: ["bricks.test.mjs", "page.test.mjs"], used: [GAME.blitz, BF_HERO, "fizlet.com: the home demo and the gallery"],
    tag: "FX", role: "attack", modules: [mod("@fzlt/core/fx", "fx")], demo: "fx",
    snippet: `const fx = effects({ cap: 420 });
fx.blast(x, y, 1.2);       // flash, rings, debris, scorch
fx.step(dt); fx.draw(ctx); // pooled: never allocates` },
  { id: "camera", no: 19, sym: "cm", family: "motion", status: "beta", since: "0.9.0", tests: ["camera.test.mjs", "camera.mjs"], used: [], why: "No released page or game runs on it: the fizz dropped it in 0.19.0.",
    tag: "CAMERA", role: "go", modules: [mod("@fzlt/core/camera", "camera")] },
  { id: "sprite", no: 11, sym: "sp", family: "render", status: "complete", since: "0.3.2", tests: ["bricks.test.mjs", "browser.mjs"], used: [BF_HERO, "fizlet.com: the gallery's scenes"],
    tag: "SPRITE", role: "fallin", modules: [mod("@fzlt/core/sprite", "sprite")], demo: "sprite",
    snippet: `const art = sprites({ bug: { colors: { b: "team" }, frames: [rows] } },
  { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }] });
art.draw(ctx, "bug", frame, x, y, angle, 3, side);
img.src = spriteURL(def, 0, palettes); // the same pixels as SVG` },
  { id: "sound", no: 7, sym: "sn", family: "render", status: "complete", since: "0.2.0", tests: ["sound.test.mjs", "browser.mjs"], used: [GAME.blitz, `${ARCADE} (through @fzlt/core/arcade)`],
    tag: "SOUND", role: "advance", modules: [mod("@fzlt/core/sound", "sound")], demo: "sound",
    snippet: `const sfx = sound(e, { cues: { boom: "boom" } });
e.events.emit("boom"); // in a step; plays after render
sfx.on = false;        // mute` },
  { id: "embed", no: 8, sym: "em", family: "page", status: "complete", since: "0.2.0", tests: ["embed.test.mjs", "browser.mjs"], used: [`${GAME.blitz} (the drop-in)`],
    tag: "EMBED", role: "fallin", modules: [mod("@fzlt/core/embed", "embed")],
    snippet: `embed(() => import("./game.js").then((m) => m.mount), {
  name: "blitz", palette: { cmd: "#8573ee" },
  easterEgg: { sequence: "konami" } });` },
  { id: "slot", no: 9, sym: "sl", family: "page", status: "complete", since: "0.3.0", tests: ["slot.test.mjs", "browser.mjs", "page.test.mjs"], used: ["fizlet.com: the home hero, the fizz and the gallery", BF_HERO],
    tag: "SLOT", role: "sys", modules: [mod("@fzlt/core/slot", "slot")] },
  { id: "hud", no: 13, sym: "hd", family: "game", status: "beta", since: "0.3.6", tests: ["hud.test.mjs", "browser.mjs"], used: [`${GAME.sherman} (its scoreboard is @fzlt/core/arcade's skirmish preset)`, "fizlet.com: Before AI: 2015, live (the arcade column's score, combo and best)"], why: API_CHECK,
    tag: "HUD", role: "aim", modules: [mod("@fzlt/core/hud", "hud")] },
  { id: "match", no: 15, sym: "mt", family: "game", status: "beta", since: "0.4.3", tests: ["match.test.mjs", "browser.mjs"], used: [`${GAME.sherman} (the skirmish preset's countdown, pause and result run on it)`], why: API_CHECK,
    tag: "MATCH", role: "go", modules: [mod("@fzlt/core/match", "match")] },
  { id: "board-page", no: 16, sym: "br", family: "page", status: "complete", since: "0.4.4", tests: ["board-page.test.mjs", "browser.mjs"], used: [GAME.swarm, `${ARCADE} (through @fzlt/core/arcade)`],
    tag: "BOARD PAGE", role: "attack", modules: [mod("@fzlt/core/board-page", "board-page")] },
  { id: "presence", no: 14, sym: "pr", family: "inhouse", status: "beta", since: "0.4.0", tests: ["presence.test.mjs", "rollback.test.mjs", "api.test.mjs"], used: [`${GAME.blitz} multiplayer (behind an invite code)`], why: "The API is still growing: interpolation and AI players come next.",
    tag: "PRESENCE", role: "cmd", modules: [mod("@fzlt/core/presence", "presence"), { ...mod("@fzlt/core/presence/check", "presence-check"), sym: "pc" }, mod("@fzlt/core/presence/rollback", "rollback")] },
  { id: "ui", no: 2, sym: "ui", family: "page", status: "complete", since: "0.1.0", tests: ["ui.test.mjs", "tokens.test.mjs", "browser.mjs"], used: [GAME.battlefield, GAME.blitz, `${ARCADE} (through @fzlt/core/arcade)`, "fizlet.com", "the DOM VIRUS, DOM Battlefield and Battlefield Blitz sites"],
    tag: "BOARD UI", role: "fire", modules: [mod("@fzlt/core/ui", "ui/board-ui", "@fzlt/core/ui (js)")], sizes: ["@fzlt/core/ui (js)", "@fzlt/core/ui (css)"],
    snippet: `applyPalette(root, { sys: "#06c4ff" }); // hex only
press(key, () => fire(), signal); // touch-safe
launch(startKey, start); // press, invert, shatter` },
  { id: "perf", no: 18, sym: "pf", family: "page", status: "complete", since: "0.7.0", tests: ["perf.test.mjs", "browser.mjs"], used: [`${GAME.battlefield} and the DOM VIRUS site (the performance switch)`],
    tag: "PERF", role: "sys", modules: [mod("@fzlt/core/perf", "perf")] },
  { id: "rules", no: 17, sym: "rl", family: "game", status: "complete", since: "0.6.0", tests: ["rules.test.mjs"], used: ["DOM Battlefield 1.0.0 (supply drops: drops in src/model.ts, dom-battlefield#11)", "Battlefield Blitz 0.8.0+ (supply crates: drops in src/game.ts, Blitz#4)", "Null Invaders 1.0 (drops, score)", "Sherman Bytes 1.0 (drops, score, waves)"],
    tag: "RULES", role: "advance", modules: [mod("@fzlt/core/rules", "rules")] },
  { id: "steer", no: 21, sym: "st", family: "motion", status: "complete", since: "0.17.0", tests: ["steer.test.mjs", "math-engines.mjs"], used: ["Battlefield Blitz (every tank: drive, seek, arriveGoal, wander and the exact hypot in src/game.ts; dom-battlefield-blitz#22, from its next release)"],
    tag: "STEER", role: "advance", modules: [mod("@fzlt/core/steer", "steer")],
    snippet: `const m = steer({ cap: 16, random: e.random, blocked: (i, at) => wall(at[0], at[1]) });
m.place(0, 100, 200);
m.seek(0, player.x, player.y, dt); // in a step: also flee, arrive, wander, patrol` },
  { id: "coach", no: 22, sym: "ch", family: "game", status: "complete", since: "0.17.0", tests: ["coach.test.mjs", "coach.mjs"], used: ["Battlefield Blitz (the practice coach's steps and tricks on tour in src/game.ts, its own card; dom-battlefield-blitz#22, from its next release)"],
    tag: "COACH", role: "sys", modules: [mod("@fzlt/core/coach", "coach")],
    snippet: `const tips = flag("my-game:tips", "off"); // localStorage, never throws
const t = tour(e), c = card(root, { onEnd: quit });
t.tick(dt); if (moved > 220) t.pass(); // in a step
const k = t.show(); if (k >= 0) c.show(\`\${k + 1}/10\`, STEPS[k], TEXT[k]);` },
  { id: "timeline", no: 23, sym: "tm", family: "motion", status: "beta", since: "0.19.0", tests: ["timeline.test.mjs", "timeline.mjs"], used: ["fizlet.com: the home page's reveals and parallax, the origin hero and Before AI: 2015, live", "the DOM VIRUS site: the cartridge console, the detail-page scenes and the diagrams"], why: API_CHECK,
    tag: "TIMELINE", role: "fire", modules: [mod("@fzlt/core/timeline", "timeline")], demo: "timeline",
    snippet: `timeline(e)
  .to(cart, { translate: ["0px -150px", "0px 0px"] }, { dur: 0.7, ease: "back" })
  .label("seated")
  .to(screen, { "clip-path": ["inset(50%)", "inset(0%)"] }, { at: "seated" })
  .to(lines, { opacity: [0, 1] }, { stagger: 0.15 })
  .play(); // e.destroy() gives every property back` },
  { id: "touch", no: 24, sym: "tc", family: "input", status: "beta", since: "0.20.0", tests: ["touch.mjs"], used: [`${ARCADE} (through @fzlt/core/arcade: no page zoom while a run is live)`, "the DOM Battlefield and Battlefield Blitz sites", "fizlet.com: every page"], why: API_CHECK,
    tag: "TOUCH", role: "sys", modules: [mod("@fzlt/core/touch", "touch")],
    snippet: `lockTouch(); // pinch never zooms the page from a slot, a game or the pad
lockTouch(document, null); // a full-screen board: the whole page` },
  { id: "css-clock", no: 25, sym: "cs", family: "motion", status: "beta", since: "0.21.0", tests: ["css-clock.test.mjs", "css-clock.mjs"], used: ["fizlet.com (the home demo's hint and the roadmap's current phase)"], why: "New since 0.20.0: its API may still move.",
    tag: "CSS CLOCK", role: "fire", modules: [mod("@fzlt/core/css-clock", "css-clock")],
    snippet: `/* CSS: the look stays in the stylesheet, paused; its time is --fz-t */
.led { animation: blink 1s steps(2) infinite paused; animation-delay: var(--fz-t, 0s); }

const c = cssClock(diagram, { span: 6, loops: 3 }); // rests on frame one, settles
pauseButton.onclick = () => c.hold(!held); // c.destroy() gives the page back` },
  { id: "layout", no: 26, sym: "ly", family: "motion", status: "experimental", since: "0.21.0", tests: ["layout.test.mjs", "layout.mjs"], used: ["fizlet.com: the bricks index's brick graph"], why: "New in E10 (diagrams); its API may still change.",
    tag: "LAYOUT", role: "advance", modules: [mod("@fzlt/core/layout", "layout")],
    snippet: `const g = layout(e, { cap: 64, cx: 320, cy: 200 }); // DOM-free, typed arrays
const a = g.add(), b = g.add();
g.link(a, b, 60); // settles in ≤ 300 steps, then stops calling busy()
g.pin(a, px, py); // a drag: the rest flows round it; g.free(a) lets go
const [l, t, r, b] = g.bounds(box); // left, top, right, bottom
fit(cam, l, t, r - l, b - t); // frame it with @fzlt/core/camera` },
  { id: "view-canvas", no: 27, sym: "vw", family: "render", status: "experimental", since: "0.21.0", tests: ["view-canvas.test.mjs", "view-canvas.mjs"], used: ["fizlet.com: the bricks index's brick graph"], why: "New in E10 (diagrams); its API may still change.",
    tag: "VIEW CANVAS", role: "aim", modules: [mod("@fzlt/core/view-canvas", "view-canvas")],
    snippet: `const v = viewCanvas(e, diagram, { label: "Brick graph", draw(ctx, box) { paint(ctx); } });
box.set([x - 12, y - 12, 24, 24]); // a node moved: [x, y, w, h], CSS px
v.dirty(box); // only those device pixels are cleared and redrawn; v.dirty() is all of it` },
  { id: "diorama", no: 28, sym: "dr", family: "render", status: "experimental", since: "0.22.0", tests: ["diorama.test.mjs", "diorama-glide.test.mjs", "diorama.mjs"], used: ["Salvo Bay prototype (gallery piece to follow)"], why: "New: software 3D for tabletop scenes, lifted from the Salvo Bay prototype; its API may still change before a gallery piece ships on it.",
    tag: "DIORAMA", role: "fire", modules: [mod("@fzlt/core/diorama", "diorama")],
    snippet: `const d = diorama(canvas, { background: "#efe8de" }); // a canvas you own, no WebGL
d.add({ id: "table", size: [10, 0.4, 7], color: "#c69a6f" });
d.add({ id: "boat", size: [2, 0.6, 0.8], on: "table", color: "#e04a3a", shadow: 0.3 });
d.fit(d.cam, corners, { x0: 16, y0: 16, x1: w - 16, y1: h - 16 });
e.add({ render: () => d.draw() }); // painter's sort, shadows, 0 allocations
canvas.onclick = (ev) => d.pick(ev.offsetX, ev.offsetY); // the boat` },
  { id: "dice", no: 29, sym: "dc", family: "game", status: "experimental", since: "0.22.0", tests: ["dice.test.mjs", "dice-track.mjs"], used: [], why: "New, for the Tabletop games on @fzlt/core/diorama; its API may still change before a game ships on it.",
    tag: "DICE", role: "fire", modules: [mod("@fzlt/core/dice", "dice")],
    snippet: `roll(seed, 2, 6, out); // the values alone: integer maths, the same in every browser
const dc = dice({ count: 2 }); // d6 with tumble paths that land on those values
const v = dioramaDice(d, dc, { on: "table" }); // into a @fzlt/core/diorama scene, pips painted
dc.roll(matchSeed + turn, { from: [-4, 0] }); // both players: the same seed, the same roll
v.show(t); // each frame, t seconds since the roll; dc.value → [3, 5]` },
  { id: "track", no: 30, sym: "tr", family: "game", status: "experimental", since: "0.22.0", tests: ["track.test.mjs", "dice-track.mjs"], used: [], why: "New, for the Tabletop roll-and-move games; its API may still change before a game ships on it.",
    tag: "TRACK", role: "advance", modules: [mod("@fzlt/core/track", "track")],
    snippet: `const t = track({ points: corners, closed: true, smooth: true, spaces: 40, jumps: [[4, 14], [31, 9]], events: e.events });
t.place(0, 0);
t.move(0, dc.total); // steps, then a ladder or chute; track:pass, track:land on the ring
t.apply(token, time); // each frame: an arc per step, a slide per jump, side by side on a shared space` },
  { id: "water", no: 31, sym: "wt", family: "render", status: "experimental", since: "0.22.0", tests: ["water.test.mjs", "water.mjs"], used: [], why: "New: the water of the Salvo Bay prototype as a brick for diorama games (a wave pool next); its API may still change before a piece ships on it.",
    tag: "WATER", role: "sys", modules: [mod("@fzlt/core/water", "water")],
    snippet: `const w = water(d, { rect: [-4, -3, 4, 3], level: 0.8, bands: [{ h: 0.3, color: "#4f8fb5" }] });
w.wake(boat); // bow waves and a trail that follow it
w.splash(x, z); // a column, spray, a crown of drops, rings: pooled, 0 allocations
e.add({ step: (_, dt) => w.step(dt) && e.busy(), render: () => d.draw() }); // rests, then settles
w.height(x, z); // the surface under a surfer, the same on every run` },
  { id: "props", no: 32, sym: "ps", family: "render", status: "experimental", since: "0.22.0", tests: ["props.test.mjs", "props.mjs"], used: [], why: "New: a starter kit of low-poly models for @fzlt/core/diorama scenes; its API may still change before a game ships on it.",
    tag: "PROPS", role: "attack", modules: [mod("@fzlt/core/props", "props")],
    snippet: `import { house, pineTree, car } from "@fzlt/core/props"; // only what you use
d.cluster("floor", { fixed: 0 }); // what props stand on draws first
house(d, { id: "home", on: "floor", pos: [2, 0, -1], rot: 0.3 }); // a group root + its parts
for (let i = 0; i < 5; i++) pineTree(d, { on: "floor", pos: [i * 2 - 4, 0, 3], seed: matchSeed + i }); // same seed, same trees
car(d, { on: "floor", colors: { paint: "#6db0cf" } }); // any colour by key
d.root(d.pick(x, y)); // a click on any part → the prop's root (tag "house")` },
  { id: "beam", no: 33, sym: "bm", family: "game", status: "experimental", since: "0.22.0", tests: ["beam.test.mjs", "beam-cards.mjs"], used: [], why: "New, for the Tabletop games on @fzlt/core/diorama; its API may still change before a game ships on it.",
    tag: "BEAM", role: "attack", modules: [mod("@fzlt/core/beam", "beam")],
    snippet: `const b = beam({ grid: { cell: 1, x0: -4, z0: -3 }, bounds: [-4, -3, 4, 3] });
b.add({ kind: "emitter", col: 0, row: 1, a: 0 });
const m = b.add({ kind: "mirror", col: 4, row: 1, a: Math.PI / 4 }); // any angle; π/4 steps are exact
b.add({ kind: "target", col: 4, row: 5, r: 0.3 });
b.run(); // segments in b.x0 … b.z1, hits in b.hp; b.lit[target] > 0
const v = dioramaBeam(d, b, { on: "board", light: (i, on) => tint(i, on) });
v.show(t); // each frame: glowing beams in the depth sort, a pulse, sparks; false once it rests` },
  { id: "cards", no: 34, sym: "cr", family: "game", status: "experimental", since: "0.22.0", tests: ["cards.test.mjs", "beam-cards.mjs"], used: [], why: "New, for the Tabletop card games on @fzlt/core/diorama; its API may still change before a game ships on it.",
    tag: "CARDS", role: "cmd", modules: [mod("@fzlt/core/cards", "cards")],
    snippet: `const k = deck({ size: 52, piles: ["draw", "hand", "table"] });
k.shuffle(0, matchSeed); // the same seed, the same order, for both players
k.deal(0, [k.id("hand")], 5); // face down
const v = dioramaCards(d, k, { on: "table", face: paintFace, piles: [{ type: "stack", x: -3 }, { type: "fan", z: 2.4 }, { type: "row" }] });
v.show(t); // each frame: deal arcs, flips, a hand fanned toward the camera
canvas.onclick = (ev) => { const c = v.pick(ev.offsetX, ev.offsetY); if (c >= 0) k.flip(c); };` },
  { id: "flick", no: 35, sym: "fl", family: "motion", status: "experimental", since: "0.22.0", tests: ["flick.test.mjs", "flick.mjs"], used: [], why: "New, for the Tabletop games on @fzlt/core/diorama; its API may still change before a game ships on it.",
    tag: "FLICK", role: "advance", modules: [mod("@fzlt/core/flick", "flick")],
    snippet: `const w = flick({ table: [14, 4.6], events: e.events }); // the table top's frame: y = 0, centred
const puck = w.add({ pos: [-5, 0], size: [0.8, 0.25] }); // discs, boxes, ramps, fixed walls
const a = sling({ pull: 2.5, max: 14 }); // a slingshot drag: a.power is the meter
a.begin(w.x[puck], w.z[puck], px, pz); a.move(px, pz); // pointer on the table (diorama's ground)
if (a.end()) w.flick(puck, a.jx, a.jz); // send [a.angle, a.level]: the same shot everywhere
e.add({ step: (_, dt) => w.step(dt) && e.busy(), render: () => w.apply(puck, ob) });` },
  { id: "actor", no: 39, sym: "ac", family: "game", status: "experimental", since: "0.28.0", tests: ["actor.test.mjs"], used: [], why: "New (E11): no game moves its units on it yet; DOM Battlefield is first in line (src/ACTORS.md).",
    tag: "ACTOR", role: "cmd", modules: [mod("@fzlt/core/actor", "actor")],
    snippet: `const A = actors({ cap: 64, sides: 2, events: e.events });
const i = A.spawn(0, 5); A.x[i] = 120; A.y[i] = 80; // side 0, 5 hp
const foe = A.nearest(i, 300, 1 << 1);  // closest side-1 actor in range
if (foe >= 0 && A.hurt(foe, 1)) score++; // true: that killed it
A.sweep(); // once per step: dead rows come back` },
  { id: "aim", no: 40, sym: "am", family: "game", status: "experimental", since: "0.28.0", tests: ["aim.test.mjs"], used: [], why: "New (E11): no game aims on it yet; DOM Battlefield is first in line (src/ACTORS.md).",
    tag: "AIM", role: "aim", modules: [mod("@fzlt/core/aim", "aim")],
    snippet: `const s = aim({ x: A.x, y: A.y, a: A.a, vx: A.vx, vy: A.vy, board,
  foe: (i, j) => A.alive[j] === 1 && A.side[j] !== A.side[i] });
const j = s.pick(i, A.list, A.n, 0.6, 460); // nearest foe in the cone, in sight
if (j >= 0 && s.lead(i, j, 400)) fire(i, s.out[0], s.out[1]); // where it will be` },
  { id: "view-dom", no: 41, sym: "vd", family: "render", status: "experimental", since: "0.28.0", tests: ["view-dom.test.mjs", "view-dom.mjs"], used: [], why: "New (E11): no game draws its units with it yet; DOM Battlefield is first in line (src/ACTORS.md).",
    tag: "VIEW DOM", role: "fire", modules: [mod("@fzlt/core/view-dom", "view-dom")],
    snippet: `/* CSS: the look is the page's */
.board i { position: absolute; left: 0; top: 0; width: 24px; height: 24px; }
.board i[data-side="1"] { background: var(--hurt); }

viewDom(e, A, board, { linger: 0.4 }); // one pooled node per row
// moved rows write one transform; a still board writes nothing and settles` },
  { id: "announce", no: 42, sym: "an", family: "page", status: "beta", since: "0.28.0", tests: ["announce.test.mjs", "announce.mjs"], used: [], why: "New (E14): no released game reads out through it yet.",
    tag: "ANNOUNCE", role: "sys", modules: [mod("@fzlt/core/announce", "announce")],
    snippet: `const a = announce(e, { words: (ev) => ev.type === "score" ? \`Score \${ev.a}\` : null });
e.events.emit("score", score); // in a step, as for sound: read once per gap, latest value
a.say("over", "Game over"); a.flush(); // from a HUD or a result screen` },
  { id: "scene", no: 43, sym: "sc", family: "render", status: "experimental", since: "0.28.0", tests: ["scene.test.mjs"], used: ["fizlet.com: two gallery micros (#38 and #40 are scene data)"], why: "New in E13: the format may still change, and the factory does not emit it yet.",
    tag: "SCENE", role: "aim", modules: [mod("@fzlt/core/scene", "scene")],
    snippet: `// The recipe is data: stage, cast (values on the clock), cues, gags
const d = { v: 1, stage: { w: 160, h: 90, bg: "#07060f", end: 2 },
  fx: { words: ["GO!"] }, cue: [[0.5, "word", 0, 80, 45, 0, 14]] };
slot(fig, () => scene(d)); // rests on the last frame, settles; a tap replays` },
  { id: "terrain", no: 36, sym: "tn", family: "render", status: "experimental", since: "0.22.0", tests: ["terrain.test.mjs", "terrain-drive.mjs", "drive-drift.mjs"], used: [], why: "New, for the diorama vehicle games (trail, desert and circuit racers); its API may still change before a game ships on it.",
    tag: "TERRAIN", role: "fallin", modules: [mod("@fzlt/core/terrain", "terrain")],
    snippet: `const t = terrain({ cols: 96, rows: 64, cell: 0.5 });
t.noise({ seed, amp: 2.2, ridge: 0.7, wind: [1, 0.3], stretch: 2.5 }); // dunes, the same in every browser
t.ribbon(loop, { width: 3.6, kind: 1 }).ramp([-3, 8], [1, 8], { height: 0.9 }); // a flat track, a jump
terrainView(d, t, { bands, kinds: ["#9c7a55"], lod: [26] }); // flat-shaded faces in d.draw()
t.sample(x, z, out); // [height, nx, ny, nz] under a wheel: the drawn triangle's` },
  { id: "drive", no: 37, sym: "dv", family: "motion", status: "experimental", since: "0.22.0", tests: ["drive.test.mjs", "terrain-drive.mjs", "drive-drift.mjs", "drive-suspension.mjs"], used: [], why: "New, for the diorama vehicle games; its feel and API may still change before a game ships on it.",
    tag: "DRIVE", role: "advance", modules: [mod("@fzlt/core/drive", "drive")],
    snippet: `const v = drive(t, { kind: "bike" }); // or "car": four springs, rollovers
v.reset(-9, 8, 0);
e.add({ step(_, dt) { v.set(throttle, brake, steer, drift); if (v.step(dt)) e.busy(); chase(d.cam, v, follow, dt); } });
car.pos.set(v.pos); car.rot.set(v.rot); // body pose; v.comp, v.spin, v.steerAngle for the wheels
// long travel: drive(t, { travel: 0.6, stiffness: 70, progressive: 1.2, rebound: 0.85 }); v.press[i], v.bodyRoll
if (v.crashed) v.reset(x, z, yaw); // a nose-down landing; v.dust scales an emitter
score += v.drift * dt; // handbrake drifts (drift input 1); drive:drift banks each chain
touchAll(cars, { onHit: (a, b) => b.drift > 0.3 && b.spinOut(7, 1.2) }); // ram a drifter: it spins` },
  { id: "rig", no: 44, sym: "rg", family: "motion", status: "experimental", since: "0.28.0", tests: ["rig.test.mjs", "rig.mjs"], used: [], why: "New: lifted from Holeshot's rider (the game still carries its own copy until its port); its API may still change before a game ships on it.",
    tag: "RIG", role: "advance", modules: [mod("@fzlt/core/rig", "rig")],
    snippet: `const leg = limb(d, "leg", { on: "rider", l1: 0.4, l2: 0.42, bend: 1 }); // knee forward
d.add({ size: [0.4, 0.1, 0.1], pos: [0.2, -0.05, 0], on: "leg:a" }); // the thigh, along +x
d.add({ size: [0.42, 0.08, 0.08], pos: [0.21, -0.04, 0], on: "leg:b" }); // the shin
e.add({ render() { leg.reach(hip[0], hip[1], 0, peg[0], peg[1], 0.15); d.draw(); } }); // the foot on the peg
ik2(J, ax, ay, bx, by, 0.3, 0.3, -1); // J = [upper angle, lower angle, elbow x, elbow y]` },
  { id: "ribbon", no: 45, sym: "rb", family: "render", status: "experimental", since: "0.28.0", tests: ["ribbon.test.mjs", "ribbon.mjs"], used: [], why: "New: lifted from Holeshot's road-edge ribbons (the game still carries its own copy until its port); its API may still change before a game ships on it.",
    tag: "RIBBON", role: "fallin", modules: [mod("@fzlt/core/ribbon", "ribbon")],
    snippet: `terrainView(d, t, { bands }); // the ground, then the ribbons over it in its cluster
const r = ribbon(d, t, { step: 0.5, hide: true }); // one decal; nothing to call per frame
r.band(loop, -1.4, 1.4, "#6d4c3a", true); // the track: closed, 2.8 wide, mitred, draped
r.band(loop, -1.7, -1.4, "#f4f1e6", true); // a white edge strip on its left
r.band(loop, 1.4, 1.7, "#e8483c", true); // a red one on its right` },
  { id: "turntable", no: 46, sym: "tb", family: "motion", status: "experimental", since: "0.28.0", tests: ["turntable.test.mjs", "turntable.mjs"], used: [], why: "New: lifted from the garage turntables of Holeshot and CitySmash (each game still carries its own copy until its port); its API may still change before a game ships on it.",
    tag: "TURNTABLE", role: "advance", modules: [mod("@fzlt/core/turntable", "turntable")],
    snippet: `const tt = turntable(engine, canvas, { yaw: -0.15, label: "Turn the bike: drag, or the arrow keys",
  onTurn: (yaw) => { d.cam.yaw = yaw; d.draw(); } }); // drawn only when the angle changed
tt.spin(); // show it off after a change (nothing under reduced motion)
turntable(engine, el, { friction: 4, snap: Math.PI / 2 }); // a throw that coasts and rests on a quarter turn` },
  { id: "ground", no: 47, sym: "gn", family: "render", status: "experimental", since: "0.28.0", tests: ["ground.test.mjs", "ground.mjs"], used: [], why: "New: lifted from the ground painters of Holeshot, CitySmash, Dune Hop and Salvo Bay (each game still carries its own copy until its port); its API may still change before a game ships on it.",
    tag: "GROUND", role: "fallin", modules: [mod("@fzlt/core/ground", "ground")],
    snippet: `d.decal("floor", 5, (ctx) => { // inside the diorama's sort, over the floor
  ctx.beginPath(); // many lines, one stroke
  for (const l of LINES) seg(d, ctx, l[0], l[1], l[2], l[3], l[4], l[5]);
  ctx.stroke();
  ctx.beginPath(); if (ring(d, ctx, x, z, 2, terrain, 0.03)) ctx.fill(); // lies on the slope
  ctx.fillStyle = "#000"; shadow(d, ctx, car.x, groundY, car.z, 1.2, lift); // fades as it lifts
});
sky.fillRect(0, 0, d.width, horizon(d)); // the sky ends where level ground does` },
  { id: "math", no: 38, sym: "mh", family: "motion", status: "beta", since: "0.27.0", tests: ["math.test.mjs", "math-engines.mjs"], used: [], why: "New: no released game runs its sim on it yet.",
    tag: "MATH", role: "advance", modules: [mod("@fzlt/core/math", "math")],
    snippet: `const a = atan2(ty - y, tx - x); // in a step: the same bits on an iPhone and a desktop
x += cos(a) * v * dt; y += sin(a) * v * dt;` },
  { id: "arcade", no: 20, sym: "ar", family: "game", status: "complete", since: "0.11.0", tests: ["arcade.test.mjs", "arcade.mjs", "arcade-game.mjs", "arcade-hud.mjs"], used: [GAME.invaders, GAME.runner, GAME.sherman],
    tag: "ARCADE", role: "go", modules: [mod("@fzlt/core/arcade", "arcade")],
    snippet: `const game = arcade({ id: "null-invaders", title: "Null Invaders", color: "#06c4ff",
  hint: "Mouse / WASD · Space fires", css: KIT_CSS, fire: true,
  readouts: [["Score", "team"], ["Wave"]], colors: ["#06c4ff"],
  cues: { fire: "fire" }, create: (ctx) => myRules(ctx) }, { root: "main" });
game.start(); // Escape: Recall` },
  { id: "debug", no: 3, sym: "db", family: "page", status: "complete", since: "0.1.0", tests: ["debug.test.mjs", "browser.mjs"], used: ["fizlet.com: the home demo (guardLayout)"],
    tag: "DEBUG", role: "aim", modules: [mod("@fzlt/core/debug", "debug")],
    snippet: `import { guardLayout } from "@fzlt/core/debug";
guardLayout(e);  // dev builds only
e.violations;    // layout reads made in a step: 0` },
].map((b) => ({ sizes: b.modules.map((m) => m.size), ...b, name: b.modules[0].name }));

export const brickPath = (b) => `bricks/${b.id}.html`;

/**
 * ROADMAP bricks: planned, not in the package. [{ name, no, sym, family, phase, purpose, target, needs }]: `target`
 * is the size budget it is planned under (bytes gzip, a goal until measured); `needs` the bricks it
 * builds on. Each phase is a planned phase of site/roadmap.mjs (E9–E16), which lists these under it.
 */
export const PLANNED = [
  { name: "@fzlt/core/snapshot", no: 48, sym: "sh", family: "network", phase: "E12", purpose: "Fixed-capacity state to bytes and deltas, for authoritative rooms and replays.", target: 1536, needs: ["@fzlt/core/presence", "@fzlt/core/actor"] },
  { name: "@fzlt/core/agent", no: 49, sym: "ag", family: "network", phase: "E12", purpose: "An AI player that joins a room on the same command channel as a person.", target: 1024, needs: ["@fzlt/core/presence", "@fzlt/core/rules"] },
  { name: "@fzlt/core/music", no: 50, sym: "ms", family: "render", phase: "E15", purpose: "A tiny step sequencer on the kernel clock: patterns and tempo on the sound brick's synth.", target: 1229, needs: ["@fzlt/core/sound"] },
];
