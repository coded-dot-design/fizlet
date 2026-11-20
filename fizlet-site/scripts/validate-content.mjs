// validate:content: the data this site renders is whole and consistent before anything builds.
// - tokens.css is generated from tokens.json (and current); every token group is there.
// - every route in the inventory has a plan; MIGRATION.md is current; every "done" route has its data.
// - every exported page has a title, a description (70-160 chars, the legacy rule), JSON-LD nodes.
// - every vendored runtime file listed in assets.json is in public/.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { byDate, notePath, noteMeta, notesIndexMeta } from "../src/lib/notes.ts";
import { releasePath, releaseMeta, newsIndexMeta } from "../src/lib/releases.ts";
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
// Notes and releases render from the collections (src/content.config.ts): their head facts come from
// src/lib/notes.ts and src/lib/releases.ts, and must be the legacy page's own (routes.json).
const NOTES = readdirSync("src/data/legacy/notes").map((f) => json(`src/data/legacy/notes/${f}`)).sort(byDate);
const RELEASES = json("src/data/legacy/releases.json");
const COLLECTED = new Map([
  [notesIndexMeta(NOTES).path, notesIndexMeta(NOTES)], ...NOTES.map((n) => [notePath(n), noteMeta(n)]),
  [newsIndexMeta(RELEASES).path, newsIndexMeta(RELEASES)], ...RELEASES.map((r) => [releasePath(r), releaseMeta(r)]),
]);
const byPath = new Map(routes.map((r) => [r.path, r]));
for (const p of plan.done) {
  if (!paths.has(p)) fail.push(`migration.json: done route /${p} is not a legacy route`);
  if (/^(news|notes)\//.test(p)) {
    const meta = COLLECTED.get(p);
    if (!meta) { fail.push(`/${p}: done, but not in the notes or releases collection`); continue; }
    if (meta.title !== byPath.get(p).title) fail.push(`/${p}: title "${meta.title}" is not the legacy "${byPath.get(p).title}"`);
    if (meta.description !== byPath.get(p).description) fail.push(`/${p}: description is not the legacy one`);
    if (!(meta.description.length >= 70 && meta.description.length <= 160)) fail.push(`/${p}: description is ${meta.description.length} chars (70-160)`);
    continue;
  }
  const file = DATA[p] ?? (p.startsWith("docs/") ? `pages/docs/${p.split("/")[1]}.json` : p.startsWith("bricks/") ? `pages/bricks/${p.slice(7, -5)}.json` : null);
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
