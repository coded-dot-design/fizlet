// The stress runner: `npm run test:stress -- <name> [flags]` runs tests/stress/<name>.mjs with the
// flags. Not part of `npm test` or CI: these are long, throttled, machine-sensitive runs.
// With no name it lists the tests.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const names = readdirSync(dir).filter((f) => f.endsWith(".mjs") && !["run.mjs", "lib.mjs"].includes(f)).map((f) => f.slice(0, -4));
const [name, ...rest] = process.argv.slice(2);
if (!name || !names.includes(name)) {
  console.log(`usage: npm run test:stress -- <name> [flags]\n  tests: ${names.join(", ")}`);
  process.exit(name ? 2 : 0);
}
const r = spawnSync(process.execPath, ["--expose-gc", `${dir}${name}.mjs`, ...rest], { stdio: "inherit" });
process.exit(r.status ?? 1);
