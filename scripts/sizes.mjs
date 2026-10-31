// Size measurement shared by scripts/size.mjs (the CI budget) and scripts/site.mjs (the numbers on
// the website): each entry minified + gzipped, everything it pulls in included.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";

export const BUDGETS = [
  // 3,334 B gz with size/kernel (3,413 in train 0.21.0, −79 B, no behaviour change): the engine's
  // slots, pause bits and phases as const enums, short private names. The budget stays the contract's 4 KB.
  ["fizlet (kernel)", "src/index.ts", 4096],
  ["fizlet/debug", "src/debug.ts", 1536],
  // The player-facing performance overlay (off by default). Logic ~1.5 KB gz; its look is inline
  // on the kit tokens (~0.45 KB) so it works on pages without board-ui.css.
  ["fizlet/perf", "src/perf.ts", 2048],
  ["fizlet/input", "src/input.ts", 1536],
  // 1,995 B gz in 0.19.0; 2,073 B once stickAt/dpadAt/the drag use steer's exact `hypot` (+78 B, #118, K5:
  // `Math.hypot` boxes its arguments, 23 young GCs per 1M drags; now 0). Budget raised by that delta.
  ["fizlet/pad", "src/pad.ts", 2126],
  ["fizlet/collide", "src/collide.ts", 1536],
  // 1,533 B gz in 0.19.0 (3 B under 1,536); 1,634 B once the constructor checks cols, rows and cell
  // (+101 B, brick audit P8: `cell: 0` made at() NaN, a fractional cols sized the arrays wrong). An
  // inline check, not the kernel's `need` (+181 B: grid runs without the kernel). Raised by that delta.
  // 1,603 B in train 0.21.0: the search's private members are one letter (−31 B, no behaviour change).
  ["fizlet/grid", "src/grid.ts", 1637],
  // Whole module: effects() 2,1xx B + gravity, plus emitter() and KINDS (~0.6 KB), which tree-shake
  // away when unused (the page build below ships effects() alone).
  ["fizlet/fx", "src/fx.ts", 3072],
  // Pan/zoom of a DOM stage through the ledger (fizlet-engine docs/LAYERS.md: camera ≈ 1.5 KB).
  ["fizlet/camera", "src/camera.ts", 1536],
  ["fizlet/sprite", "src/sprite.ts", 1536],
  ["fizlet/sound", "src/sound.ts", 1536],
  ["fizlet/embed", "src/embed.ts", 2560],
  ["fizlet/slot", "src/slot.ts", 2048],
  ["fizlet/presence", "src/presence.ts", 2048],
  ["fizlet/presence/check", "src/presence-check.ts", 5120],
  ["fizlet/hud", "src/hud.ts", 1536],

  ["fizlet/match", "src/match.ts", 2816],
  // 1,318 B gz with per-drop age, landing spot and drop:land (0.10.1).
  ["fizlet/rules", "src/rules.ts", 1536],
  // seek, flee, arrive, wander, patrol on typed arrays: 950 B gz when added. 958 B with arriveGoal (+8 B,
  // the goal read from gx/gy: Blitz's wingmen boxed their per-frame slot as arrive's arguments).
  ["fizlet/steer", "src/steer.ts", 1280],
  // flag + tour + the kit card (its look inline on the tokens): 1,192 B gz when added; flag and tour alone tree-shake to less.
  ["fizlet/coach", "src/coach.ts", 1536],
  // Keyframe tracks, easings (tables), stagger, labels, repeat/yoyo, controls, events, revert:
  // 2,050 B gz when added (target was 1,536; ~110 B of it is the kernel's `need`, shared on a page).
  ["fizlet/timeline", "src/timeline.ts", 2304],
  // Pinch and iOS gesture lock on the animation and game surfaces, one delegated listener set:
  // 310 B gz when added.
  ["fizlet/touch", "src/touch.ts", 512],
  // A page's own CSS @keyframes on the kernel clock: 5,363 B gz with the kernel and timeline it
  // composes when added; its own code is 477 B (on a page the kernel and timeline are shared).
  // 5,305 B with size/kernel (−63 B, the kernel's); budget lowered by that delta.
  ["fizlet/css-clock", "src/css-clock.ts", 5569],
  // The whole arcade module with every brick it composes (kernel, board-page, input, pad, sound, hud,
  // ui js) and both HUD presets: 21,634 B gz when the `hud` option came (Unreleased; skirmish is
  // +4,012 B over the card build, fizlet/hud included). The Board UI kit CSS is the game's (it bakes
  // in the sections it uses). 21,976 B in 0.19.0 main; 23,999 B with #116 (+2,023 B: the skirmish flow on
  // fizlet/match, G15 — match's phase machine, overlay, keys and white flag, less the preset's own
  // countdown / pause / result overlays; budget 24,064). 24,334 B with release train 0.20.0 (+335 B;
  // budget raised by that delta). Each rise, measured at its merge in the train:
  // +171 B #96: every run locks the page with fizlet/touch (owner-approved).
  // +18 B #115: sound's own-key cue check (an event named "constructor" crashed render).
  // +13 B #117: hud finds its rows and text nodes once (an event frame reads no DOM).
  // +82 B #118 and −9 B #119: pad, then board-page, take steer's exact `hypot` (K5: `Math.hypot`
  //   boxes its arguments); the second shares the first's code, so together +73 B, not +135.
  // +57 B #120: input resolves intents once and gives steps `id()` handles.
  // +3 B #122: the fps cap counts its slot from the frame's start (kernel).
  // 24,178 B with size/kernel (−102 B from 24,280 in train 0.21.0, the kernel's; budget lowered by that delta).
  ["fizlet/arcade", "src/arcade.ts", 24297],
  // A card game (`hud` left out): the shell and the `arcade` preset, skirmish tree-shaken away.
  // 17,622 B gz with the `hud` option (+311 B: the preset contract, header and nav choice); 17,311
  // in 0.17.0, 17,206 in 0.14.0 (17,081 in 0.13.0, 16,960 in 0.12.1, 16,946 in 0.12.0, 16,731 in
  // 0.11.0), of which arcade's own code, markup and CSS was 6,694 B in 0.12.0. 17,912 B in 0.19.0;
  // 17,964 B once drag() positions in the board's containing block (+52 B, a fix: the card jumped
  // when the board sat under a header or mid-page). 18,038 B with #116 (+72 B: brick audit 2's drag fix
  // and the flow contract, `HudView.ask` / `HudRun.go`; the card has no flow and behaves byte for byte
  // as before, tests/arcade-hud.mjs; budget 18,048). 18,351 B with release train 0.20.0 (+313 B;
  // budget raised by that delta). Each rise, at its merge:
  // +180 B #96: the touch lock (owner-approved).
  // +11 B #115: sound's own-key cue check.
  // +70 B #118 and −6 B #119: pad's and board-page's exact `hypot` (shared code: +64 B together).
  // +55 B #120: input's intents resolved once, `id()` handles.
  // +3 B #122: the fps cap counts from the frame's start.
  // 18,302 B in train 0.21.0 (headroom, no behaviour change): the ledger's private names and shared
  // style checks, and collide Grid's one-letter private names. 18,192 B with size/kernel (−103 B from
  // 18,295, the kernel's; budget lowered by that delta).
  ["fizlet/arcade (hud omitted)", "scripts/arcade-card.ts", 18258],
  // 3,401 B gz on 0.4.0's collide; 3,780 B with 0.4.1's hardened Grid (capacities, overflow counts: +379 B).
  // 4,095 B on 0.16 main. It bundles only the kernel's phase constants, but esbuild's renamer counts
  // the whole engine module, so a kernel edit moves it ±2 B (the fps-cap timer: 4,097 B). 4,162 B
  // (+65 B, #119) when `hit`'s query radius took steer's exact `hypot` (K5, not a plain sqrt); budget
  // raised by that delta from 4,128. 4,136 B in train 0.21.0: collide Grid's one-letter private names
  // (−26 B, no behaviour change). 4,131 B with size/kernel (−5 B, the kernel's); budget lowered by that delta.
  ["fizlet/board-page", "src/board-page.ts", 4188],
  // A hero's live chunk is ≤ 10 KB gz (fizlet-engine docs/LAYERS.md); the bricks take ≤ 7 KB, the scene
  // ≥ 3 KB (tests/page.test.mjs holds the budget there, so it never rises). 7,129 B before release
  // train 0.20.0, 7,164 B after: +35 B #120 (input's intents resolved once), +0 B #122 (its fps-cap
  // nap leaves the clamp to setTimeout; with Math.max the two together were 7,169, 1 B over).
  // 7,128 B in train 0.21.0 (7,166 on main, 7,171 with #174's start fix; no behaviour change): slot's
  // selector without spaces −3 B, the ledger's short private names −20 B, one shared style check and
  // put-back −12 B, restore's attribute put-back as one expression −8 B. 7,017 B with size/kernel
  // (−111 B, no behaviour change): the engine's slots, pause bits and phases as const enums −66 B
  // (esbuild inlines enums; a top-level const in a module that imports is not inlined), short private
  // names in the ledger entry, ring and pool −15 B, fx's shape numbers ahead of TAU so they inline −30 B.
  // Budget 7,104 B: the 7 KB cap less the ≥ 64 B headroom S8 asked for, locked in.
  ["page build (kernel+slot+input+fx)", "scripts/page-build.ts", 7104],
  ["fizlet/ui (js)", "src/ui/board-ui.ts", 3072],
  ["fizlet/ui (css)", "src/ui/board-ui.css", 5120],
];

/** [{ name, entry, budget, gzip }] for every budgeted entry. */
export async function measure() {
  const out = [];
  for (const [name, entry, budget] of BUDGETS) {
    const css = entry.endsWith(".css");
    const res = await build({ entryPoints: [entry], bundle: true, minify: true, write: false, logLevel: "silent", ...(css ? {} : { format: "esm", target: "es2022" }) });
    out.push({ name, entry, budget, gzip: gzipSync(res.outputFiles[0].contents).length });
  }
  return out;
}
