// `npm run test:stress -- <name> [flags]`: runs tests/stress/<name>.mjs with the flags (Node with
// --expose-gc, for the soak). Stress tests stay out of `npm test` and CI: they are long and seeded,
// and each prints its seed and exits non-zero on a failure. `npm run test:stress` alone lists them.
import { spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const names = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f !== "run.mjs").map((f) => f.slice(0, -4));
const [name, ...flags] = process.argv.slice(2);
if (!name || !existsSync(join(dir, name + ".mjs"))) {
  console.log(`usage: npm run test:stress -- <name> [flags]\nstress tests: ${names.join(", ")}`);
  process.exit(name ? 2 : 0);
}
const r = spawnSync(process.execPath, ["--expose-gc", "--import", "tsx", join(dir, name + ".mjs"), ...flags], { stdio: "inherit" });
process.exit(r.status ?? 1);
