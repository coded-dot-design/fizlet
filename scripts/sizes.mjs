// Size measurement shared by scripts/size.mjs (the CI budget) and scripts/site.mjs (the numbers on
// the website): each entry minified + gzipped, everything it pulls in included.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";

export const BUDGETS = [
  ["fizlet (kernel)", "src/index.ts", 4096],
  ["fizlet/debug", "src/debug.ts", 1536],
  ["fizlet/input", "src/input.ts", 1536],
  ["fizlet/pad", "src/pad.ts", 2048],
  ["fizlet/collide", "src/collide.ts", 1536],
  ["fizlet/grid", "src/grid.ts", 1536],
  ["fizlet/fx", "src/fx.ts", 2048],
  ["fizlet/sprite", "src/sprite.ts", 1536],
  ["fizlet/sound", "src/sound.ts", 1536],
  ["fizlet/embed", "src/embed.ts", 2560],
  ["fizlet/slot", "src/slot.ts", 2048],

  ["fizlet/match", "src/match.ts", 2816],
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
