// The tokens-only rule over the shared sheets (scripts/lib/design-lint.mjs has the rule).
//   node scripts/design-lint.mjs            exit 1 on a raw value in a shared-component rule
//   node scripts/design-lint.mjs --pages    also list the page rules' raw values, by owning group
//   node scripts/design-lint.mjs --write    rewrite the MIGRATION.md list of page raw values
import { readFileSync, writeFileSync } from "node:fs";
import { lint, group } from "./lib/design-lint.mjs";

const found = lint();
const shared = found.filter((x) => x.owner === "shared");
const pages = found.filter((x) => x.owner !== "shared" && x.owner !== "keyframes");
const byGroup = new Map();
for (const x of pages) {
  const g = group(x.owner[0]);
  if (!byGroup.has(g)) byGroup.set(g, { n: 0, classes: new Map(), colour: 0 });
  const e = byGroup.get(g);
  e.n++; if (/colour/.test(x.problem)) e.colour++;
  e.classes.set(x.owner[0], (e.classes.get(x.owner[0]) ?? 0) + 1);
}
const order = [...byGroup].sort((a, b) => a[0].localeCompare(b[0]));

if (process.argv.includes("--write")) {
  const rows = order.map(([g, e]) => `| ${g} | ${e.n} | ${e.colour} | ${[...e.classes].sort((a, b) => b[1] - a[1]).map(([c, n]) => `\`.${c}\` ${n}`).join(", ")} |`);
  const block = `<!-- TOKENS:START -->\n${pages.length} raw values in page rules of the shared sheets (${shared.length} in shared-component rules), measured by \`npm run lint:tokens -- --pages\`.\n\n| Group | Raw values | of them colours | Rules (by class, count) |\n|---|---:|---:|---|\n${rows.join("\n")}\n<!-- TOKENS:END -->`;
  const md = readFileSync("MIGRATION.md", "utf8");
  writeFileSync("MIGRATION.md", md.includes("<!-- TOKENS:START -->") ? md.replace(/<!-- TOKENS:START -->[\s\S]*<!-- TOKENS:END -->/, block) : md + "\n" + block + "\n");
  console.log(`MIGRATION.md: ${pages.length} page raw values in ${byGroup.size} groups`);
}
if (process.argv.includes("--pages")) for (const x of pages) console.log(`${group(x.owner[0])}\t${x.file}:${x.line}\t${x.selector}\t${x.problem}`);
for (const x of shared) console.error(`  ${x.file}:${x.line} ${x.selector}: ${x.problem}`);
if (shared.length) { console.error(`lint:tokens: ${shared.length} raw value(s) in shared-component rules (use a token: src/design/tokens.json)`); process.exit(1); }
console.log(`lint:tokens: ok (shared components read only tokens; ${pages.length} raw values left in page rules, listed in MIGRATION.md)`);
