// Size measurement shared by scripts/size.mjs (the CI budget) and scripts/site.mjs (the numbers on
// the website): each entry minified + gzipped, everything it pulls in included.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";

export const BUDGETS = [
  ["fizlet (kernel)", "src/index.ts", 4096],
  ["fizlet/debug", "src/debug.ts", 1536],
  // The player-facing performance overlay (off by default). Logic ~1.5 KB gz; its look is inline
  // on the kit tokens (~0.45 KB) so it works on pages without board-ui.css.
  ["fizlet/perf", "src/perf.ts", 2048],
  ["fizlet/input", "src/input.ts", 1536],
  // 1,995 B gz in 0.19.0; 2,073 B once stickAt/dpadAt/the drag use steer's exact `hypot` (+78 B, K5:
  // `Math.hypot` boxes its arguments, 23 young GCs per 1M drags; now 0). Budget raised by that delta.
  ["fizlet/pad", "src/pad.ts", 2126],
  ["fizlet/collide", "src/collide.ts", 1536],
  ["fizlet/grid", "src/grid.ts", 1536],
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
  // seek, flee, arrive, wander, patrol on typed arrays: 950 B gz when added.
  ["fizlet/steer", "src/steer.ts", 1280],
  // flag + tour + the kit card (its look inline on the tokens): 1,192 B gz when added; flag and tour alone tree-shake to less.
  ["fizlet/coach", "src/coach.ts", 1536],
  // Keyframe tracks, easings (tables), stagger, labels, repeat/yoyo, controls, events, revert:
  // 2,050 B gz when added (target was 1,536; ~110 B of it is the kernel's `need`, shared on a page).
  ["fizlet/timeline", "src/timeline.ts", 2304],
  // Pinch and iOS gesture lock on the animation and game surfaces, one delegated listener set:
  // 310 B gz when added.
  ["fizlet/touch", "src/touch.ts", 512],
  // The whole arcade module with every brick it composes (kernel, board-page, input, pad, sound, hud,
  // ui js) and both HUD presets: 21,634 B gz when the `hud` option came (Unreleased; skirmish is
  // +4,012 B over the card build, fizlet/hud included). The Board UI kit CSS is the game's (it bakes
  // in the sections it uses). 21,975 B before the skirmish flow moved onto fizlet/match (Unreleased,
  // G15): 23,990 B, +2,015 B. That is match itself in the bundle (the phase machine, its overlay and
  // its five keys, the white flag; the kernel was already there), less the preset's own countdown,
  // pause / result overlays it replaced, plus the Auto fire / Next gate / Restart / fold keys a
  // skirmish game can now ask for. Only skirmish games pay it; the card build is below.
  // +174 B (owner-approved, Unreleased): every run locks the page with fizlet/touch (lockTouch on the
  // whole page plus touch-action: manipulation through the ledger), 21,915 → 22,089 B; budget + the delta.
  // in the sections it uses). +67 B (21,970 → 22,037) when pad took the exact `hypot` (K5); budget
  // raised by that delta from 22,016.
  // in the sections it uses). +53 B (21,970 → 22,023) when board-page's hit took the exact `hypot`
  // (K5); budget raised by that delta from 22,016.
  ["fizlet/arcade", "src/arcade.ts", 24314],
  // A card game (`hud` left out): the shell and the `arcade` preset, skirmish tree-shaken away.
  // 17,622 B gz with the `hud` option (+311 B: the preset contract, header and nav choice); 17,311
  // in 0.17.0, 17,206 in 0.14.0 (17,081 in 0.13.0, 16,960 in 0.12.1, 16,946 in 0.12.0, 16,731 in
  // 0.11.0), of which arcade's own code, markup and CSS was 6,694 B in 0.12.0. 17,912 B in 0.19.0;
  // 17,964 B once drag() positions in the board's containing block (+52 B, a fix: the card jumped
  // when the board sat under a header or mid-page). 17,971 B with brick audit 2's drag fix (+7 B);
  // 18,033 B (+62 B) with the flow contract (Unreleased, G15): the shell's pause, resume and end are
  // asked of a HUD that owns its flow (`HudView.ask`) and it answers through `HudRun.go`; the card has
  // no flow, so it behaves byte for byte as before (tests/arcade-hud.mjs).
  // +181 B for the touch lock (Unreleased; owner-approved): every run locks the page with fizlet/touch.
  // when the board sat under a header or mid-page). +15 B budget (17,984 → 17,999) for sound's
  // own-key cue check (brick audit 2, P10: an event named "constructor" crashed render): measured
  // 17,964 → 17,979 B; with fizlet#103's +7 B, 17,986 B.
  // when the board sat under a header or mid-page). 18,040 B (+76 B) when pad took the exact `hypot`
  // (K5); budget raised by that delta from 17,984.
  // when the board sat under a header or mid-page). 18,024 B (+60 B) when board-page's hit took the
  // exact `hypot` (K5); budget raised by that delta from 17,984.
  ["fizlet/arcade (hud omitted)", "scripts/arcade-card.ts", 18311],
  // 3,401 B gz on 0.4.0's collide; 3,780 B with 0.4.1's hardened Grid (capacities, overflow counts: +379 B).
  // 4,095 B on 0.16 main. It bundles only the kernel's phase constants, but esbuild's renamer counts
  // the whole engine module, so a kernel edit moves it ±2 B (the fps-cap timer: 4,097 B). 4,162 B
  // (+65 B) when `hit`'s query radius took steer's exact `hypot` (K5, not a plain sqrt); budget
  // raised by that delta from 4,128.
  ["fizlet/board-page", "src/board-page.ts", 4193],
  // A hero's live chunk is ≤ 10 KB gz (fizlet-engine docs/LAYERS.md); the bricks take ≤ 7 KB, the scene ≥ 3 KB.
  ["page build (kernel+slot+input+fx)", "scripts/page-build.ts", 7168],
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
