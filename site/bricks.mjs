// The brick catalog: which modules each website page documents, and which size entry
// (scripts/sizes.mjs) measures it. Everything else on a brick page (summary, API, sizes) is read
// from the source and the build by scripts/api.mjs and scripts/sizes.mjs; tests/api.test.mjs checks
// this list against package.json's exports and the modules' runtime exports.

/** One module of a brick: its import, source, declarations and size entry. */
const mod = (name, file, size = name) => ({ name, src: `src/${file}.ts`, dts: `dist/${file}.d.ts`, size });

/**
 * [{ id, tag, role, modules, sizes, demo, snippet }]. `sizes` are the size entries shown (the
 * first is the headline); `demo` names a live demo in site/demos/ (only where it is cheap).
 */
export const BRICKS = [
  { id: "kernel", tag: "KERNEL", role: "go", modules: [{ ...mod("fizlet", "index", "fizlet (kernel)"), src: "src/index.ts" }], demo: "settle",
    snippet: `const e = createEngine({ root: board, seed: 7 });
e.add({ step(e, dt) {/* sim */}, render(e) {/* DOM */} });
e.start(); // e.destroy() gives the page back` },
  { id: "input", tag: "INPUT", role: "sys", modules: [mod("fizlet/input", "input")],
    snippet: `const pad = controls(e, { keys: { fire: ["Space"] } });
if (pad.hit("fire")) fire(); // true for one frame
if (pad.pointer.hit) aim(pad.pointer.x, pad.pointer.y);` },
  { id: "pad", tag: "PAD", role: "advance", modules: [mod("fizlet/pad", "pad")] },
  { id: "collide", tag: "COLLIDE", role: "cmd", modules: [mod("fizlet/collide", "collide")],
    snippet: `const grid = new Grid(32, 64, w, h); // cell, cap, world
grid.clear(); grid.add(xs, ys, rs, i); // typed arrays
const n = grid.near(xs, ys, rs, i, out); // ids, once` },
  { id: "grid", tag: "GRID", role: "flag", modules: [mod("fizlet/grid", "grid")], demo: "grid",
    snippet: `const b = board(48, 30, { cell: 40 });
b.scatter(seeded(1234), 0.12, ROCK, 1, BLOCKED);
const n = b.path(from, to, out, 400); // -1 = no path` },
  { id: "fx", tag: "FX", role: "attack", modules: [mod("fizlet/fx", "fx")], demo: "fx",
    snippet: `const fx = effects({ cap: 420 });
fx.blast(x, y, 1.2);       // flash, rings, debris, scorch
fx.step(dt); fx.draw(ctx); // pooled: never allocates` },
  { id: "camera", tag: "CAMERA", role: "go", modules: [mod("fizlet/camera", "camera")] },
  { id: "sprite", tag: "SPRITE", role: "fallin", modules: [mod("fizlet/sprite", "sprite")], demo: "sprite",
    snippet: `const art = sprites({ bug: { colors: { b: "team" }, frames: [rows] } },
  { palettes: [{ team: "#39ffb0" }, { team: "#ff5c8f" }] });
art.draw(ctx, "bug", frame, x, y, angle, 3, side);
img.src = spriteURL(def, 0, palettes); // the same pixels as SVG` },
  { id: "sound", tag: "SOUND", role: "advance", modules: [mod("fizlet/sound", "sound")], demo: "sound",
    snippet: `const sfx = sound(e, { cues: { boom: "boom" } });
e.events.emit("boom"); // in a step; plays after render
sfx.on = false;        // mute` },
  { id: "embed", tag: "EMBED", role: "fallin", modules: [mod("fizlet/embed", "embed")],
    snippet: `embed(() => import("./game.js").then((m) => m.mount), {
  name: "blitz", palette: { cmd: "#8573ee" },
  easterEgg: { sequence: "konami" } });` },
  { id: "slot", tag: "SLOT", role: "sys", modules: [mod("fizlet/slot", "slot")] },
  { id: "hud", tag: "HUD", role: "aim", modules: [mod("fizlet/hud", "hud")] },
  { id: "match", tag: "MATCH", role: "go", modules: [mod("fizlet/match", "match")] },
  { id: "board-page", tag: "BOARD PAGE", role: "attack", modules: [mod("fizlet/board-page", "board-page")] },
  { id: "presence", tag: "PRESENCE", role: "cmd", modules: [mod("fizlet/presence", "presence"), mod("fizlet/presence/check", "presence-check")] },
  { id: "ui", tag: "BOARD UI", role: "fire", modules: [mod("fizlet/ui", "ui/board-ui", "fizlet/ui (js)")], sizes: ["fizlet/ui (js)", "fizlet/ui (css)"],
    snippet: `applyPalette(root, { sys: "#06c4ff" }); // hex only
press(key, () => fire(), signal); // touch-safe
launch(startKey, start); // press, invert, shatter` },
  { id: "perf", tag: "PERF", role: "sys", modules: [mod("fizlet/perf", "perf")] },
  { id: "rules", tag: "RULES", role: "advance", modules: [mod("fizlet/rules", "rules")] },
  { id: "debug", tag: "DEBUG", role: "aim", modules: [mod("fizlet/debug", "debug")],
    snippet: `import { guardLayout } from "fizlet/debug";
guardLayout(e);  // dev builds only
e.violations;    // layout reads made in a step: 0` },
].map((b) => ({ sizes: b.modules.map((m) => m.size), ...b, name: b.modules[0].name }));

export const brickPath = (b) => `bricks/${b.id}.html`;
