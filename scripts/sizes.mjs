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
  ["fizlet/pad", "src/pad.ts", 2048],
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
  // The whole arcade shell with every brick it composes (kernel, board-page, input, pad, sound, ui js):
  // 16,960 B gz in 0.12.1 (16,946 in 0.12.0, 16,731 in 0.11.0), of which arcade's own code, markup and CSS was 6,694 B in 0.12.0. The
  // Board UI kit CSS is the game's (it bakes in the sections it uses).
  ["fizlet/arcade", "src/arcade.ts", 17408],
  // 3,401 B gz on 0.4.0's collide; 3,780 B with 0.4.1's hardened Grid (capacities, overflow counts: +379 B).
  ["fizlet/board-page", "src/board-page.ts", 4096],
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
