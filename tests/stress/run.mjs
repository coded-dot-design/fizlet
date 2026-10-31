// Stress tests, by name: `npm run test:stress -- <name> [flags]` runs tests/stress/<name>.mjs with the
// flags. Not part of `npm test` or CI (long, machine-dependent). `npm run test:stress` lists them.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dir = new URL(".", import.meta.url).pathname;
const names = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f !== "run.mjs").map((f) => f.slice(0, -4)).sort();
const [name, ...flags] = process.argv.slice(2);
if (!name || !names.includes(name)) {
  console.log(`usage: npm run test:stress -- <name> [flags]\n${names.map((n) => "  " + n).join("\n")}`);
  process.exit(name ? 2 : 0);
}
process.exit(spawnSync(process.execPath, [dir + name + ".mjs", ...flags], { stdio: "inherit" }).status ?? 1);
