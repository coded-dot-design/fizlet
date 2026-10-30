// Build: readable ESM (one file per entry, no bundled third-party code: there is none) plus .d.ts.
// Consumers minify; scripts/size.mjs checks the minified + gzipped budget.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkTokens, readTokenSources } from "./tokens.mjs";

export const ENTRIES = ["src/index.ts", "src/kernel/index.ts", "src/debug.ts", "src/perf.ts", "src/input.ts", "src/collide.ts", "src/fx.ts", "src/camera.ts", "src/sound.ts", "src/embed.ts", "src/slot.ts", "src/grid.ts", "src/sprite.ts", "src/pad.ts", "src/presence.ts", "src/presence-check.ts", "src/hud.ts", "src/match.ts", "src/rules.ts", "src/steer.ts", "src/coach.ts", "src/timeline.ts", "src/touch.ts", "src/css-clock.ts", "src/actor.ts", "src/aim.ts", "src/arcade.ts", "src/board-page.ts", "src/ui/board-ui.ts"];
// tokens.json is the authoritative token source: refuse to build when the CSS or the palette map drifts.
const drift = checkTokens(readTokenSources());
if (drift.length) throw new Error(`Board UI tokens disagree with src/ui/tokens.json:\n  ${drift.join("\n  ")}`);
rmSync("dist", { recursive: true, force: true });
await build({ entryPoints: ENTRIES, outdir: "dist", outbase: "src", bundle: true, splitting: true, chunkNames: "chunks/[name]-[hash]", format: "esm", target: "es2022", platform: "browser", legalComments: "none", logLevel: "warning" });
execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { stdio: "inherit" });
// Declarations: give relative imports their file extension, so consumers on any module resolution
// (Bundler, Node16, NodeNext) can follow them: "./kernel/index" -> "./kernel/index.js".
for (const f of readdirSync("dist", { recursive: true })) {
  if (!f.endsWith(".d.ts")) continue;
  const file = join("dist", f), dir = dirname(file);
  const text = readFileSync(file, "utf8").replace(/(from |import\()(["'])(\.{1,2}\/[^"']+?)\2/g, (m, pre, q, spec) => {
    if (/\.(js|mjs|cjs|css)$/.test(spec)) return m;
    if (existsSync(join(dir, spec + ".d.ts"))) return `${pre}${q}${spec}.js${q}`;
    if (existsSync(join(dir, spec, "index.d.ts"))) return `${pre}${q}${spec}/index.js${q}`;
    throw new Error(`${file}: cannot resolve ${spec}`);
  });
  writeFileSync(file, text);
}
cpSync("src/ui/board-ui.css", "dist/ui/board-ui.css");
cpSync("src/ui/tokens.json", "dist/ui/tokens.json");
console.log(`Built dist/: ${ENTRIES.length} entries`);
