// validate:content: the data this site renders is whole and consistent before anything builds.
// - tokens.css is generated from tokens.json (and current); every token group is there.
// - every route in the inventory has a plan; MIGRATION.md is current; every "done" route has its data.
// - every exported page has a title, a description (70-160 chars, the legacy rule), JSON-LD nodes.
// - every vendored runtime file listed in assets.json is in public/.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const fail = [];
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const run = (script, ...args) => { try { execFileSync(process.execPath, [script, ...args], { stdio: "pipe" }); } catch (e) { fail.push(String(e.stderr || e.stdout || e.message).trim()); } };

run("scripts/tokens.mjs", "--check");
const tokens = json("src/design/tokens.json");
for (const g of ["color", "type", "space", "radius", "shadow", "motion"]) if (!tokens[g]) fail.push(`tokens.json: no ${g} group`);
for (const theme of ['.bui', '.bui[data-theme="light"]']) if (!tokens.color.selector[theme]) fail.push(`tokens.json: no colours for ${theme}`);

run("scripts/migration.mjs", "--check");
const routes = json("src/data/legacy/routes.json");
const paths = new Set(routes.map((r) => r.path));
if (paths.size !== routes.length) fail.push("routes.json: duplicate paths");
const plan = json("src/data/migration.json");
const DATA = { "": "pages/home.json", "gallery/": "pages/gallery/index.json" };
// The gallery's other pages: Daily page <n> (pages/gallery/page-<n>.json), the Hi-Fi lane, the archive.
const galleryData = (p) => /^gallery\/page\/\d+\/$/.test(p) ? `pages/gallery/page-${p.split("/")[2]}.json` : /^gallery\/(hifi|archive)\/$/.test(p) ? `pages/gallery/${p.split("/")[1]}.json` : undefined;
for (const p of plan.done) {
  if (!paths.has(p)) fail.push(`migration.json: done route /${p} is not a legacy route`);
  const file = DATA[p] ?? galleryData(p) ?? (p.startsWith("docs/") ? `pages/docs/${p.split("/")[1]}.json` : p.startsWith("bricks/") ? `pages/bricks/${p.slice(7, -5)}.json` : null);
  if (!file || !existsSync(`src/data/legacy/${file}`)) { fail.push(`/${p}: done, but no page data (${file})`); continue; }
  const { meta } = json(`src/data/legacy/${file}`);
  if (meta.path !== p) fail.push(`${file}: meta.path ${meta.path} is not ${p}`);
  if (!meta.title) fail.push(`${file}: no title`);
  if (!(meta.description?.length >= 70 && meta.description.length <= 160)) fail.push(`${file}: description is ${meta.description?.length} chars (70-160)`);
}
for (const f of json("src/data/legacy/assets.json")) if (!existsSync(`public/${f}`)) fail.push(`public/${f}: listed in assets.json, missing`);
const footer = json("src/data/legacy/footer.json");
if (footer.length !== 5) fail.push(`footer.json: ${footer.length} columns, expected 5`);

if (fail.length) { console.error(fail.map((f) => "  " + f).join("\n")); console.error(`validate:content: ${fail.length} problem(s)`); process.exit(1); }
console.log(`validate:content: ok (${routes.length} routes, ${plan.done.length} done, tokens and inventory current)`);
