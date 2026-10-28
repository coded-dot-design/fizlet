// Build: readable ESM (one file per entry, no bundled third-party code: there is none) plus .d.ts.
// Consumers minify; scripts/size.mjs checks the minified + gzipped budget.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";

export const ENTRIES = ["src/index.ts", "src/kernel/index.ts", "src/debug.ts", "src/input.ts", "src/collide.ts", "src/fx.ts", "src/sound.ts", "src/embed.ts", "src/ui/board-ui.ts"];
rmSync("dist", { recursive: true, force: true });
await build({ entryPoints: ENTRIES, outdir: "dist", outbase: "src", bundle: true, splitting: true, chunkNames: "chunks/[name]-[hash]", format: "esm", target: "es2022", platform: "browser", legalComments: "none", logLevel: "warning" });
execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { stdio: "inherit" });
cpSync("src/ui/board-ui.css", "dist/ui/board-ui.css");
console.log(`Built dist/: ${ENTRIES.length} entries`);
