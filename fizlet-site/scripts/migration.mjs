// Writes MIGRATION.md's route inventory (between the INVENTORY markers) from src/data/legacy/routes.json
// (every page of the legacy build) and src/data/migration.json (templates, components, what is done).
// `--check` fails when MIGRATION.md is stale or a route has no plan.
import { readFileSync, writeFileSync } from "node:fs";
const routes = JSON.parse(readFileSync("src/data/legacy/routes.json", "utf8"));
const plan = JSON.parse(readFileSync("src/data/migration.json", "utf8"));
const done = new Set(plan.done);
const missing = routes.filter((r) => !plan.types[r.type]);
if (missing.length) { console.error(`No plan for type(s): ${[...new Set(missing.map((r) => r.type))].join(", ")}`); process.exit(1); }
const byType = new Map();
for (const r of routes) (byType.get(r.type) ?? byType.set(r.type, []).get(r.type)).push(r);
const lines = [`${routes.length} legacy pages, ${done.size} done, ${routes.length - done.size} to do (legacy build v${JSON.parse(readFileSync("src/data/legacy/site.json", "utf8")).version}).`, ""];
lines.push("| Type | Pages | Done | Template | Components | Next wave |", "|---|---:|---:|---|---|---|");
for (const [type, rs] of byType) {
  const t = plan.types[type];
  lines.push(`| ${type} | ${rs.length} | ${rs.filter((r) => done.has(r.path)).length} | ${t.template} | ${t.components} | ${t.wave} |`);
}
lines.push("", "Every route (`/path` · type · status · in sitemap · title):", "");
for (const [type, rs] of byType) {
  lines.push(`<details><summary><b>${type}</b> (${rs.length})</summary>`, "");
  for (const r of rs) lines.push(`- [${done.has(r.path) ? "x" : " "}] \`/${r.path}\` · ${done.has(r.path) ? "done" : "to do"}${r.inSitemap ? "" : " · not in sitemap"}${r.redirect ? ` · redirects to /${r.redirect}` : ""}${r.noindex ? " · noindex" : ""} · ${r.title.replace(/\|/g, "\\|")}`);
  lines.push("", "</details>", "");
}
const body = lines.join("\n");
const md = readFileSync("MIGRATION.md", "utf8");
const next = md.replace(/(<!-- INVENTORY:START -->\n)[\s\S]*(<!-- INVENTORY:END -->)/, `$1${body}\n$2`);
if (process.argv[2] === "--check") {
  if (next !== md) { console.error("MIGRATION.md is stale: run npm run migration"); process.exit(1); }
  console.log("MIGRATION.md inventory is current");
} else { writeFileSync("MIGRATION.md", next); console.log(`MIGRATION.md: ${routes.length} routes`); }
