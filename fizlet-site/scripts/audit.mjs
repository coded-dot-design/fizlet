// audit: the built site (dist/) and the source, against the site's rules.
// Built pages: lang, one <title>, a description, a canonical on fizlet.com, one <h1>, the theme
// script before paint, og:image, JSON-LD that parses, no inline event handlers, and every legacy
// URL kept (a done route builds at its exact path). Staging/preview builds (PUBLIC_ROBOTS=noindex)
// must carry noindex on every page; production builds must not.
// Source: tokens only, no one-off styles: no <style> blocks and no colour literals in components,
// layouts or pages (colours live in tokens.json; the lifted legacy sheets read the tokens).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const fail = [];
const NOINDEX = process.env.PUBLIC_ROBOTS === "noindex";

for (const f of walk("dist").filter((f) => f.endsWith(".html"))) {
  const h = readFileSync(f, "utf8"), at = relative("dist", f);
  const need = (ok, what) => { if (!ok) fail.push(`${at}: ${what}`); };
  need(/<html lang="en"/.test(h), "no lang");
  need((h.match(/<title>/g) ?? []).length === 1, "not one <title>");
  need(/<meta name="description" content="[^"]{70,160}">/.test(h), "description missing or not 70-160 chars");
  need(/<link rel="canonical" href="https:\/\/fizlet\.com\//.test(h), "no fizlet.com canonical");
  need((h.match(/<h1[\s>]/g) ?? []).length === 1, `${(h.match(/<h1[\s>]/g) ?? []).length} <h1>`);
  need(h.indexOf("dom-virus:theme") < h.indexOf("<body"), "theme script after first paint");
  need(/property="og:image"/.test(h), "no og:image");
  need(!/\son(click|load|error|mouseover)=/i.test(h), "inline event handler");
  need(NOINDEX === /<meta name="robots" content="noindex/.test(h), NOINDEX ? "staging build without noindex" : "production build with noindex");
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { fail.push(`${at}: JSON-LD does not parse`); } }
}
for (const p of JSON.parse(readFileSync("src/data/migration.json", "utf8")).done) {
  const f = join("dist", p === "" || p.endsWith("/") ? `${p}index.html` : p);
  if (!existsSync(f)) fail.push(`/${p}: done, but not built at its legacy URL (${f})`);
}
for (const f of walk("src").filter((f) => /\.(astro|ts)$/.test(f))) {
  const s = readFileSync(f, "utf8");
  if (/<style[\s>]/.test(s) && !/<style is:inline set:html=\{css\}/.test(s)) fail.push(`${f}: a <style> block (tokens and the shared sheets only)`);
  if (/#[0-9a-f]{3,8}\b(?![\w-])/i.test(s.replace(/href="#[^"]*"|"#[\w-]+"|'#[\w-]+'|`#[\w-]+`/g, "")) && !f.endsWith("BaseLayout.astro")) fail.push(`${f}: a colour literal (use a token)`);
}
if (!existsSync("dist/sitemap.xml") || !existsSync("dist/robots.txt")) fail.push("no sitemap.xml or robots.txt");
if (fail.length) { console.error(fail.map((f) => "  " + f).join("\n")); console.error(`audit: ${fail.length} problem(s)`); process.exit(1); }
console.log(`audit: ok (${walk("dist").filter((f) => f.endsWith(".html")).length} pages, ${NOINDEX ? "staging" : "production"} build)`);
