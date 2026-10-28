// Size budgets (contract 9): each entry minified + gzipped, everything it pulls in included.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";

const BUDGETS = [
  ["fizlet (kernel)", "src/index.ts", 4096],
  ["fizlet/debug", "src/debug.ts", 1536],
  ["fizlet/input", "src/input.ts", 1536],
  ["fizlet/collide", "src/collide.ts", 1536],
  ["fizlet/fx", "src/fx.ts", 2048],
  ["fizlet/sound", "src/sound.ts", 1536],
  ["fizlet/embed", "src/embed.ts", 2560],
  ["fizlet/ui (js)", "src/ui/board-ui.ts", 3072],
];
let failed = false;
for (const [name, entry, budget] of BUDGETS) {
  const out = await build({ entryPoints: [entry], bundle: true, minify: true, format: "esm", target: "es2022", write: false, logLevel: "silent" });
  const gz = gzipSync(out.outputFiles[0].contents).length;
  const ok = gz <= budget;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${name.padEnd(18)} ${String(gz).padStart(5)} / ${budget} bytes gzip`);
}
const cssOut = await build({ entryPoints: ["src/ui/board-ui.css"], bundle: true, minify: true, write: false, logLevel: "silent" });
const css = gzipSync(cssOut.outputFiles[0].contents).length;
const cssOk = css <= 5120;
failed ||= !cssOk;
console.log(`${cssOk ? "ok  " : "OVER"} ${"fizlet/ui (css)".padEnd(18)} ${String(css).padStart(5)} / 5120 bytes gzip`);
if (failed) process.exit(1);
