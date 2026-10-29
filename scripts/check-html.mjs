// SEO and accessibility basics for every page of the website, checked on the built HTML (no
// browser needed): run by tests/site.mjs over site-dist/, unit-tested in tests/api.test.mjs.
// → a list of problems (empty when the page passes).

const SITE = "https://coded-dot-design.github.io/fizlet/";

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? null;
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
const meta = (html, key, value) => tags(html, "meta").find((t) => attr(t, key) === value);
const text = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** `path`: the page's path under the site root ("" for the home page, "bricks/fx.html"). */
export function checkHtml(html, path) {
  const bad = [];
  const need = (ok, msg) => ok || bad.push(msg);
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");

  // Document basics.
  need(/^<!doctype html>/i.test(html), "starts with <!doctype html>");
  need(/<html\b[^>]*\slang="[a-z-]+"/i.test(html), "<html lang>");
  need(tags(html, "meta").some((t) => attr(t, "charset")), "<meta charset>");
  need(meta(html, "name", "viewport"), "<meta name=viewport>");

  // Search and sharing.
  const titles = html.match(/<title>([\s\S]*?)<\/title>/gi) ?? [];
  need(titles.length === 1, `exactly one <title> (found ${titles.length})`);
  const title = titles[0] ? text(titles[0]) : "";
  need(title.length >= 10 && title.length <= 70, `title 10–70 characters (${title.length})`);
  const desc = attr(meta(html, "name", "description") ?? "", "content") ?? "";
  need(desc.length >= 50 && desc.length <= 300, `meta description 50–300 characters (${desc.length})`);
  const canonical = tags(html, "link").find((t) => attr(t, "rel") === "canonical");
  need(canonical && attr(canonical, "href") === SITE + path, `canonical is ${SITE}${path}`);
  for (const p of ["og:type", "og:title", "og:description", "og:url", "og:image", "og:site_name"]) need(meta(html, "property", p), `<meta property="${p}">`);
  need(attr(meta(html, "property", "og:url") ?? "", "content") === SITE + path, "og:url matches the canonical");

  // Structure: one h1, landmarks, unique ids, no skipped heading levels inside <main>.
  const h1 = tags(body, "h1");
  need(h1.length === 1, `exactly one <h1> (found ${h1.length})`);
  for (const l of ["header", "nav", "main", "footer"]) need(tags(body, l).length >= 1, `a <${l}> landmark`);
  need(tags(body, "main").length === 1, "exactly one <main>");
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  need(!dup.length, `unique ids (duplicated: ${[...new Set(dup)].join(", ")})`);
  const main = body.slice(body.indexOf("<main"), body.indexOf("</main>"));
  let level = 1;
  for (const m of main.matchAll(/<h([1-6])\b/gi)) {
    const n = Number(m[1]);
    need(n <= level + 1, `heading levels in <main> skip from h${level} to h${n}`);
    level = n;
  }
  for (const n of [...main.matchAll(/<nav\b[^>]*>/gi)]) need(attr(n[0], "aria-label"), "every <nav> in <main> has an aria-label");

  // Every image has alt text; every svg is hidden or named; every link and button has a name.
  for (const t of tags(body, "img")) need(attr(t, "alt") !== null, `<img> without alt: ${t}`);
  // Only outermost svgs: one nested in another is hidden or named with it.
  let depth = 0;
  for (const [t] of body.matchAll(/<\/?svg\b[^>]*>/gi)) {
    if (t.startsWith("</")) depth--;
    else {
      if (!depth) need(attr(t, "aria-hidden") === "true" || attr(t, "aria-label") || attr(t, "role") === "img", `<svg> neither hidden nor named: ${t.slice(0, 60)}`);
      if (!t.endsWith("/>")) depth++;
    }
  }
  for (const t of tags(body, "canvas")) need(attr(t, "aria-hidden") === "true" || attr(t, "aria-label"), `<canvas> neither hidden nor named: ${t.slice(0, 60)}`);
  for (const [, open, inner] of body.matchAll(/<(a\b[^>]*|button\b[^>]*)>([\s\S]*?)<\/(?:a|button)>/gi))
    need(text(inner) || attr(`<${open}>`, "aria-label"), `a link or button without a name: <${open.slice(0, 60)}>`);
  for (const t of tags(body, "a")) {
    const href = attr(t, "href");
    need(href !== null && href !== "" && href !== "#", `a link without a target: ${t}`);
    if (href && /^http:/.test(href)) need(false, `an http link (use https): ${href}`);
  }
  return bad;
}
