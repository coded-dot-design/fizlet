// The README's sizes come from the build, never by hand: the "What's in the box" size column and the
// kernel's measured bytes in the contract are rewritten from scripts/sizes.mjs (the CI budget's own
// measure). `npm run readme:sizes` writes them; tests/status.test.mjs fails when the README is stale.
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
    case "fizlet/ui": return `${kb(at("fizlet/ui (js)"))} + ${kb(at("fizlet/ui (css)"))} css`;
    case "fizlet/fx": return `${kb(at("fizlet/fx"))} (\`emitter\` and \`KINDS\` tree-shake away when unused)`;
    case "fizlet/arcade": return `${kb(at("fizlet/arcade (hud omitted)"))} for a card game with every brick it composes; ${kb(at("fizlet/arcade"))} with \`skirmishHud\` (in-page art via \`ctx.attach\`)`;
    default: return kb(at(m.size));
  }
}

/** The README with every generated size replaced. `sizes`: measure()'s [{ name, gzip }]. */
export function readmeSizes(md, sizes) {
  const gz = Object.fromEntries(sizes.map((s) => [s.name, s.gzip]));
  const mods = BRICKS.flatMap((b) => b.modules);
  const lines = md.split("\n").map((l) => {
    if (!/^\| `fizlet/.test(l)) return l;
    const cells = l.split(" | ");
    const m = mods.find((x) => cells[0].split("`").includes(x.name));
    if (!m && cells[0].includes("tokens.json")) return l; // data, no gzip size of its own
    if (!m) throw new Error(`readme-sizes: README row for no known module: ${cells[0]}`);
    cells[cells.length - 1] = `${cell(m, gz)} |`;
    return cells.join(" | ");
  });
  return lines.join("\n").replace(/(Kernel ≤ 4 KB gzip \(measured: )[\d,]+( bytes\))/, (_, a, b) => `${a}${gz["fizlet (kernel)"].toLocaleString("en-US")}${b}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = readFileSync("README.md", "utf8");
  const next = readmeSizes(md, await measure());
  writeFileSync("README.md", next);
  console.log(next === md ? "README sizes already current" : "README sizes rewritten from the build");
}
