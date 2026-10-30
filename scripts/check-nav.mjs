// Site navigation rules, checked on the built HTML (tests/site.mjs runs it on site-dist/; the
// rules are written up in the engine repo: fizlet-engine playbooks/content/site-nav.md). One function per
// page set, pure: pages in, a list of problems out (empty when every rule holds).
//
//   1. one header nav: every page on the site layout carries the same header links;
//   2. you are here: a header or footer link to the page, or to the section it sits in, has aria-current;
//   3. breadcrumbs: every page below a section (bricks/x.html, notes/x/, gallery/page/2/) has a
//      Breadcrumb nav that ends on the page (aria-current="page");
//   4. external links say so: their text ends in ↗, or (an icon key) an aria-label names the place;
//   5. descriptive link text: no "here", "click here", "read more", "more", "link";
//   6. no orphans: every page but the 404 is linked from at least one other page.
// Standalone example pages (their own plain shell, no site layout) are exempt from 1 to 3.

const VAGUE = /^(click here|here|read more|more|link|this|go)$/i;
const text = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Every <a> outside <head>: { href, attrs, text }. */
export function links(html) {
  const body = html.replace(/<head>[\s\S]*?<\/head>/, "");
  return [...body.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1].match(/href="([^"]*)"/)?.[1] ?? "", attrs: m[1], text: text(m[2]) }));
}

/**
 * `pages`: [{ path, html }] (path as served: "" home, "bricks/", "bricks/fx.html").
 * `site`: the production origin + root ("https://fizlet.com/"): links there count as internal.
 * `standalone`: paths of pages with their own shell.
 */
export function checkNav(pages, { site, standalone = [] }) {
  const out = [];
  const internal = (href, from) => {
    if (href.startsWith(site)) href = new URL(site).pathname + href.slice(site.length);
    else if (/^[a-z]+:/i.test(href)) return null;
    const u = new URL(href, `http://x/${from}`);
    return decodeURIComponent(u.pathname.slice(1)).replace(/(^|\/)index\.html$/, "$1");
  };
  const inbound = new Map(pages.map((p) => [p.path, 0]));
  let header = null;
  for (const { path, html } of pages) {
    const name = path || "index";
    const own = !standalone.includes(path);
    const nav = html.match(/<nav class="site-nav" aria-label="Site">([\s\S]*?)<\/nav>/)?.[1];
    if (own && path !== "404.html") {
      // 1. The header, resolved to site paths (so "../bricks/" and "bricks/" compare equal).
      if (!nav) out.push(`${name}: no header nav`);
      else {
        const hrefs = links(nav).map((a) => (a.href.includes("#") ? "#" + a.href.split("#")[1] : internal(a.href, path)));
        header ??= hrefs.join(" ");
        if (hrefs.join(" ") !== header) out.push(`${name}: header nav differs (${hrefs.join(" ")})`);
        // 2. You are here: a nav or footer link to this page or its section is marked.
        const foot = html.match(/<footer class="site-foot">([\s\S]*?)<\/footer>/)?.[1] ?? "";
        const navLinks = [...links(nav), ...links(foot)].filter((a) => !a.href.includes("#") && !/^https?:/.test(a.href));
        const mine = navLinks.filter((a) => {
          const t = internal(a.href, path);
          return t && t !== "" && (path === t || path.startsWith(t));
        });
        for (const a of mine) if (!/aria-current="(page|true)"/.test(a.attrs)) out.push(`${name}: nav link ${a.href} has no aria-current`);
        for (const a of navLinks) {
          const t = internal(a.href, path);
          if (/aria-current/.test(a.attrs) && !(t && t !== "" && path.startsWith(t))) out.push(`${name}: aria-current on ${a.href}, not this page`);
        }
      }
      // 3. Breadcrumbs below a section.
      const depth = path.replace(/\/$/, "").split("/").length;
      if (depth > 1) {
        const crumbs = html.match(/<nav class="bp-crumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/)?.[1];
        if (!crumbs) out.push(`${name}: no breadcrumbs`);
        else if (!/<span aria-current="page">[^<]+<\/span>$/.test(crumbs.trim())) out.push(`${name}: breadcrumbs do not end on the page`);
      }
    }
    for (const a of links(html)) {
      // 4 and 5.
      const ext = /^https?:/.test(a.href) && !a.href.startsWith(site);
      if (ext && !a.text.includes("↗") && !(a.text === "" && /aria-label="[^"]+"/.test(a.attrs))) out.push(`${name}: external link without ↗: "${a.text}" → ${a.href}`);
      if (VAGUE.test(a.text)) out.push(`${name}: vague link text "${a.text}" → ${a.href}`);
      // 6. Inbound links (a page linking itself does not count).
      const t = ext ? null : internal(a.href, path);
      if (t != null && t !== path && inbound.has(t)) inbound.set(t, inbound.get(t) + 1);
    }
  }
  for (const [path, n] of inbound) if (n === 0 && path !== "404.html") out.push(`${path || "index"}: orphan (no page links to it)`);
  return out;
}
