// links: the built site (dist/) against the legacy URL space, without a browser.
// - Every internal link and asset reference on every built page (href, src, poster, srcset; relative,
//   root-relative or https://fizlet.com/…) resolves to a built file, a folder with an index.html, or a
//   moved page in public/_redirects. A link to a legacy route not yet ported is listed, not failed
//   (MIGRATION.md has the plan); --strict (the cutover) fails on those too.
// - A same-site #fragment on a built page names an element that page has.
// - Every route ported (migration.json done) is served at its legacy URL; --strict: every legacy
//   route in routes.json is served (a built page or a 301).
// - public/_redirects matches the moved pages (redirects.json), each pointing at a served route.
// - sitemap.xml lists exactly the legacy sitemap's pages that are built here, in the legacy order and
//   format; robots.txt is the legacy policy. Staging builds (PUBLIC_ROBOTS=noindex): an empty sitemap
//   and a robots.txt that disallows everything.
//   node scripts/links.mjs [dist] [--strict]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const ROOT = args.find((a) => !a.startsWith("--")) ?? "dist";
const NOINDEX = process.env.PUBLIC_ROBOTS === "noindex";
const SITE = "https://fizlet.com/";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

const routes = json("src/data/legacy/routes.json");
const legacy = new Set(routes.map((r) => r.path));
const done = json("src/data/migration.json").done;
const moved = new Map(json("src/data/legacy/pages/redirects.json").map((r) => [r.meta.path, r.to]));

/** The file a site path is served from, or "" (a folder serves its index.html). */
const fileOf = (path) => {
  const f = join(ROOT, decodeURIComponent(path));
  if (!existsSync(f)) return "";
  if (!statSync(f).isDirectory()) return f;
  return (path === "" || path.endsWith("/")) && existsSync(join(f, "index.html")) ? join(f, "index.html") : "";
};
const served = (path) => !!fileOf(path) || moved.has(path);

const fail = [], pending = new Map();
const pages = walk(ROOT).filter((f) => f.endsWith(".html")).map((f) => relative(ROOT, f).split("\\").join("/"));
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file);
};
let checked = 0;
for (const page of pages) {
  const url = SITE + page.replace(/(^|\/)index\.html$/, "$1");
  const html = readFileSync(join(ROOT, page), "utf8")
    // Code samples and scripts show URLs; they are not links.
    .replace(/<(script|style|pre|code|template)\b[\s\S]*?<\/\1>/gi, "");
  const refs = [...html.matchAll(/\s(href|src|poster|data-src)="([^"]*)"/g)].map((m) => m[2])
    .concat([...html.matchAll(/\ssrcset="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0])));
  for (const ref of refs) {
    if (!ref || /^(?:mailto:|tel:|data:|javascript:|blob:)/i.test(ref) || ref.includes("{")) continue;
    let u;
    try { u = new URL(ref.replace(/&amp;/g, "&"), url); } catch { fail.push(`/${page}: bad URL ${ref}`); continue; }
    if (u.origin !== new URL(SITE).origin) continue;
    checked++;
    const path = u.pathname.slice(1);
    if (!served(path)) {
      if (legacy.has(path) && !STRICT) (pending.get(path) ?? pending.set(path, new Set()).get(path)).add(page);
      else fail.push(`/${page}: ${ref} leads nowhere (/${path})`);
      continue;
    }
    const file = fileOf(path);
    const frag = decodeURIComponent(u.hash.slice(1));
    if (frag && file.endsWith(".html") && !idsOf(file).has(frag)) fail.push(`/${page}: ${ref}: /${path} has no #${frag}`);
  }
}

for (const p of done) if (!fileOf(p)) fail.push(`/${p}: ported, but not served at its legacy URL`);
const unserved = routes.filter((r) => !served(r.path));
if (STRICT) for (const r of unserved) fail.push(`/${r.path}: a legacy route this build does not serve`);

// The moved pages: one 301 each (with and without the slash), to a served route.
const rules = existsSync("public/_redirects") ? readFileSync("public/_redirects", "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/)) : [];
for (const [from, to] of moved) {
  for (const src of [`/${from}`, `/${from.replace(/\/$/, "")}`]) if (!rules.some(([a, b, code]) => a === src && b === `/${to}` && code === "301")) fail.push(`public/_redirects: no "${src} /${to} 301"`);
  if (!fileOf(to) && !STRICT) (pending.get(to) ?? pending.set(to, new Set()).get(to)).add(`_redirects (${from})`);
  else if (!fileOf(to)) fail.push(`/${from} redirects to /${to}, which is not served`);
}
for (const [a] of rules) if (![...moved.keys()].some((f) => a === `/${f}` || a === `/${f.replace(/\/$/, "")}`)) fail.push(`public/_redirects: ${a} is not a moved legacy page`);

// sitemap.xml and robots.txt.
const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const want = NOINDEX ? [] : routes.filter((r) => r.inSitemap && fileOf(r.path)).map((r) => SITE + r.path).sort((a, b) => (a < b ? -1 : 1));
const expected = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${want.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
if (sitemap !== expected) fail.push(`sitemap.xml: not the legacy sitemap's built pages (${[...sitemap.matchAll(/<loc>/g)].length} listed, ${want.length} expected)`);
for (const r of routes) if (sitemap.includes(`<loc>${SITE}${r.path}</loc>`) && (r.noindex || r.path === "404.html")) fail.push(`sitemap.xml: lists /${r.path}, a noindex page`);
const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
if (NOINDEX ? !/^User-agent: \*\nDisallow: \/$/m.test(robots) : robots !== readFileSync("src/data/legacy/robots.txt", "utf8")) fail.push(`robots.txt: not the ${NOINDEX ? "staging (disallow all)" : "legacy"} policy`);

console.log(`links: ${pages.length} pages, ${checked} same-site references checked; ${routes.length - unserved.length} of ${routes.length} legacy routes served; ${pending.size} linked legacy routes not yet ported${STRICT ? "" : " (listed in MIGRATION.md)"}.`);
if (fail.length) { console.error(fail.map((f) => "  " + f).join("\n")); console.error(`links: ${fail.length} problem(s)`); process.exit(1); }
console.log(`links: ok (${NOINDEX ? "staging" : "production"} build${STRICT ? ", strict" : ""})`);
