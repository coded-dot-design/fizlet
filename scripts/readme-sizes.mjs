// The README's sizes come from the build, never by hand: the "What's in the box" size column and the
// kernel's measured bytes in the contract are rewritten from scripts/sizes.mjs (the CI budget's own
// measure). A release step, not a PR gate (parallel PRs would all go stale at once): `land.py bump`
// runs `npm run readme:sizes` to write them, and the release workflow runs `--check` (exit 1 if stale).
// tests/status.test.mjs proves the generator on a fixture.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BRICKS } from "../site/bricks.mjs";
import { measure } from "./sizes.mjs";

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** The size cell for a module, from { name: gzip }. */
function cell(m, gz) {
  const at = (name) => {
    if (!(name in gz)) throw new Error(`readme-sizes: no measured size "${name}" (scripts/sizes.mjs BUDGETS)`);
    return gz[name];
  };
  switch (m.name) {
    case "@fzlt/core/ui": return `${kb(at("@fzlt/core/ui (js)"))} + ${kb(at("@fzlt/core/ui (css)"))} css`;
    case "@fzlt/core/fx": return `${kb(at("@fzlt/core/fx"))} (\`emitter\` and \`KINDS\` tree-shake away when unused)`;
    case "@fzlt/core/arcade": return `${kb(at("@fzlt/core/arcade (hud omitted)"))} for a card game with every brick it composes; ${kb(at("@fzlt/core/arcade"))} with \`skirmishHud\` (in-page art via \`ctx.attach\`)`;
    default: return kb(at(m.size));
  }
}

/** The README with every generated size replaced. `sizes`: measure()'s [{ name, gzip }]. */
export function readmeSizes(md, sizes) {
  const gz = Object.fromEntries(sizes.map((s) => [s.name, s.gzip]));
  const mods = BRICKS.flatMap((b) => b.modules);
  const lines = md.split("\n").map((l) => {
    if (!/^\| `@fzlt\/core/.test(l)) return l;
    const cells = l.split(" | ");
    const m = mods.find((x) => cells[0].split("`").includes(x.name));
    if (!m && cells[0].includes("tokens.json")) return l; // data, no gzip size of its own
    if (!m) throw new Error(`readme-sizes: README row for no known module: ${cells[0]}`);
    cells[cells.length - 1] = `${cell(m, gz)} |`;
    return cells.join(" | ");
  });
  return lines.join("\n").replace(/(Kernel ≤ 4 KB gzip \(measured: )[\d,]+( bytes\))/, (_, a, b) => `${a}${gz["@fzlt/core (kernel)"].toLocaleString("en-US")}${b}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = readFileSync("README.md", "utf8");
  const next = readmeSizes(md, await measure());
  if (process.argv.includes("--check")) {
    if (next !== md) { console.error("README sizes are stale: run npm run readme:sizes (land.py bump does)"); process.exit(1); }
    console.log("README sizes are this build's");
  } else {
    writeFileSync("README.md", next);
    console.log(next === md ? "README sizes already current" : "README sizes rewritten from the build");
  }
}
