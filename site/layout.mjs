// The page shell for every page on the Fizlet site: a Board UI root (<html class="bui">), so the
// page wears the Battlefield design system's own tokens, keys and cards. Header, footer and theme
// match the DOM Battlefield site, so the two read as siblings. Dark by default; the theme is shared
// with DOM VIRUS and Battlefield (localStorage "dom-virus:theme").

import { resolveAnalytics } from "./analytics/config.mjs";
import { analyticsSnippet } from "./analytics/snippet.mjs";

export const REPO = "https://github.com/coded-dot-design/fizlet";
// The production host: canonical, og:url, sitemap, llms.txt and the hosted script URLs all use it.
// FIZLET_SITE overrides it for a preview build on another host (e.g. the GitHub Pages address).
export const SITE = new URL(process.env.FIZLET_SITE || "https://fizlet.com/").href;
/** The site's root path on its host ("/" on fizlet.com): the 404 page links from it, at any depth. */
export const ROOT = new URL(SITE).pathname;
// The games live on DOM VIRUS (domvirus.com, the arcade catalog); Fizlet links there, never copies them.
export const HUB = "https://domvirus.com/";
export const BATTLEFIELD = "https://battlefield.domvirus.com/";
export const BLITZ = "https://battlefieldblitz.domvirus.com/";
export const AUTHOR = "https://coded.design";
export const ENGINE_PLAN = "https://github.com/coded-dot-design/dom-virus/blob/main/ENGINE.md";

export const ORG = { "@type": "Organization", "@id": `${SITE}#org`, name: "coded.design", url: AUTHOR + "/" };
export const PERSON = { "@type": "Person", "@id": `${SITE}#author`, name: "Chris Cooley", url: AUTHOR + "/" };
export const WEBSITE = { "@type": "WebSite", "@id": `${SITE}#website`, name: "Fizlet", url: SITE, inLanguage: "en", author: { "@id": PERSON["@id"] }, publisher: { "@id": ORG["@id"] } };

/** Escape text for HTML. */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// GA4 + PostHog, consent first (site/analytics, from astro-engine kit/src/lib/analytics): only when
// PUBLIC_GA4_ID or PUBLIC_POSTHOG_KEY is set at build time (repository Variables); otherwise no
// analytics code ships. Never in src/: the engine (kernel and bricks) stays analytics-free.
export const ANALYTICS = resolveAnalytics(process.env);
const analytics = (base) =>
  analyticsSnippet(ANALYTICS, { privacyUrl: `${base}privacy/`, cookiesUrl: `${base}cookies/`, storageKey: "fizlet:consent" });

// Line icons on a 20px grid (the Battlefield site's stroke style).
const PATHS = {
  sun: "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4",
  moon: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z",
  github: "M7.5 17c-4 1.2-4-2-5.5-2.5m11 4.5v-3a2.6 2.6 0 0 0-.7-2c2.4-.3 4.9-1.2 4.9-5.3a4.1 4.1 0 0 0-1.1-2.8 3.8 3.8 0 0 0-.1-2.8s-.9-.3-2.9 1.1a10 10 0 0 0-5.2 0C5.9 2.8 5 3.1 5 3.1a3.8 3.8 0 0 0-.1 2.8 4.1 4.1 0 0 0-1.1 2.8c0 4.1 2.5 5 4.9 5.3a2.6 2.6 0 0 0-.7 2v3",
  play: "m6 4 10 6-10 6Z",
  down: "M10 3v13M5 11l5 5 5-5",
  out: "M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8",
  sound: "M3 8h3l4-3v10l-4-3H3ZM13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10",
  mute: "M3 8h3l4-3v10l-4-3H3ZM13 8l4 4M17 8l-4 4",
  book: "M4 3h9a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3ZM4 14a3 3 0 0 1 3-3h9",
  bolt: "M11 2 4 11h5l-1 7 7-9h-5Z",
  grid: "M3 3h14v14H3ZM3 8h14M3 13h14M8 3v14M13 3v14",
  code: "M7 5 2 10l5 5M13 5l5 5-5 5",
  copy: "M7 7h10v10H7ZM3 13V3h10",
  recall: "M4 10a6 6 0 1 0 2-4.5M4 3v3h3",
  fire: "M10 1v5M10 14v5M1 10h5M14 10h5",
  check: "M4 10.5 8 14.5 16 5.5",
  cart: "M4 2h9l3 3v13H4ZM7 2v5h6V2M7 13h6M7 16h6",
  close: "M5 5l10 10M15 5 5 15",
  menu: "M3 5h14M3 10h14M3 15h14",
  left: "M17 10H4M9 5l-5 5 5 5",
  right: "M3 10h13M11 5l5 5-5 5",
};
export const icon = (name, size = 20) =>
  `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

/** The Fizlet mark: three pixel bubbles fizzing up a grid tile, one popping (pink). */
export const mark = (size = 40) =>
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" shape-rendering="crispEdges"><path d="M0 16h64M0 32h64M0 48h64M16 0v64M32 0v64M48 0v64" stroke="#19f0ff" stroke-opacity=".35"/><rect x="1" y="1" width="62" height="62" fill="none" stroke="#19f0ff" stroke-width="2"/><g fill="currentColor"><path fill-rule="evenodd" d="M8 30h26v26H8Zm7 7v12h12V37Z"/><path d="M36 18h14v14H36ZM40 40h8v8h-8Z"/></g><path d="M52 6h6v6h-6ZM46 6h3v3h-3ZM58 14h3v3h-3Z" fill="#ff2e88"/></svg>`;

// Site navigation, one source (brain: fizlet-engine playbooks/content/site-nav.md). The header is the
// short version: Daily · Docs · Bricks · Notes. A group is a small menu behind a disclosure button
// (site/nav.ts: click, keyboard, Escape, outside click; never hover-only); on a phone the whole nav
// is one panel behind the menu key. The footer's site map lists every indexable page (siteMap()
// below), so no page is an orphan. A link to the page you are on, or one of its parents, carries
// aria-current. External links end in ↗ (icon keys name the destination in aria-label).
export const NAV = [
  ["Daily", [["gallery/", "Daily pieces"], ["contest/", "Contest rules"]]],
  ["Docs", [["docs/", "All docs"], ["docs/getting-started/", "Getting started"], ["guides/", "Guides"], ["docs/authoring/", "Recipes"], ["bricks/", "API"]]],
  ["bricks/", "Bricks"],
  ["Notes", [["notes/", "Notes"], ["news/", "News"]]],
];

/** `aria-current` for a nav link to `id` from the page at `path`: "page" on the page itself, "true"
 *  on a parent section (bricks/ on a brick page). Home anchors never carry it. */
export const current = (id, path) => (id.startsWith("#") ? "" : path === id ? ' aria-current="page"' : path.startsWith(id) ? ' aria-current="true"' : "");
const navLinks = (list, home, path) => list.map(([id, label]) => `<a href="${home}${id}"${current(id, path)}>${label}</a>`);
const CHEVRON = `<svg class="nav-chev" viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>`;
/** The header nav: a link per top-level page, a disclosure button and its menu per group. */
const navTree = (home, path) => `<ul class="nav-list">${NAV.map(([id, label]) => typeof label === "string"
  ? `<li class="nav-item"><a class="nav-top" href="${home}${id}"${current(id, path)}>${label}</a></li>`
  : `<li class="nav-item"><button class="nav-btn" type="button" aria-expanded="false" aria-controls="nav-${id.toLowerCase()}">${id}${CHEVRON}</button><span class="nav-label" aria-hidden="true">${id}</span><ul class="nav-menu" id="nav-${id.toLowerCase()}" aria-label="${id}">${navLinks(label, home, path).map((a) => `<li>${a}</li>`).join("")}</ul></li>`).join("")}</ul>`;

/**
 * A breadcrumb trail for a deep page: Fizlet / its section / the page. `trail`: [[href, label], …]
 * from the root (hrefs relative to `base`); the last label is the page itself.
 */
export const crumbs = (base, trail, last) =>
  `<nav class="bp-crumbs" aria-label="Breadcrumb"><a href="${base}">Fizlet</a> / ${trail.map(([href, label]) => `<a href="${base}${href}">${esc(label)}</a> / `).join("")}<span aria-current="page">${esc(last)}</span></nav>`;

/** JSON-LD: one @graph per page, every page carrying the site and its publisher. `<` is escaped. */
export const jsonLd = (nodes = []) =>
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [WEBSITE, ORG, PERSON, ...nodes] }).replace(/</g, "\\u003c")}</script>`;

/** Canonical, Open Graph and author tags for a page at `path` (also used by the demos' own host pages). */
export const social = ({ title, description, path, canonical = path }) => `<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:site_name" content="Fizlet">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Fizlet™: building blocks for animation and games on the DOM.">
<meta name="twitter:card" content="summary_large_image">
<meta name="author" content="Chris Cooley">`;

// ---------- The footer site map ----------
// Every indexable page, from the one route list scripts/site.mjs also writes sitemap.xml from (every
// built page but the 404 and noindex pages such as the gallery archive). page() leaves a marker in
// its footer; fillSiteMap() swaps it for the map once every page is built. A section claims routes
// by path (its index page and everything under it), so a new page joins its section on the next
// build; a page no section claims lands in "More", so none is ever dropped. Home is the brand link.
const PROJECT = [
  [REPO, "Source on GitHub"],
  [`${REPO}/blob/main/CHANGELOG.md`, "Changelog"],
  [`${REPO}/blob/main/LICENSE`, "MIT licence"],
  [`${REPO}/blob/main/src/ui/BOARD-UI.md`, "Board UI spec"],
  [ENGINE_PLAN, "Engine plan"],
];
// The headline, one source: the home hero, the /bricks/ hero and fzlt.dev. "&" (not "and") keeps the
// first line short enough for one line beside the layers card; it wears the .amp accent (site.css).
export const HEADLINE = { line: "Logic & style.", accent: "The bricks do the rest." };
export const headline = (sep = "<br>") => `${esc(HEADLINE.line).replace("&amp;", '<span class="amp">&amp;</span>')}${sep}<em>${esc(HEADLINE.accent)}</em>`;
// The family line: the same four sites, in the same order, in every family footer (domvirus.com,
// battlefield.domvirus.com and battlefieldblitz.domvirus.com list it too). Production URLs; Fizlet is
// the engine, and this site's own entry (SITE) has no ↗. Other hosts never go in sitemap.xml.
export const FAMILY_LINE = [[HUB, "DOM VIRUS"], [BATTLEFIELD, "DOM Battlefield"], [BLITZ, "Battlefield Blitz"], [SITE, "Built with Fizlet"]];
/** Columns of sections. `head`: the section's index page; `match`: a section with no page of its
 *  own; `chips`: short labels in a wrapped grid; `fold`: children behind a disclosure; `links`: external. */
export const SITE_MAP = [
  ["Learn", [{ head: "docs/" }, { head: "guides/" }, { head: "examples/quick-start.html" }]],
  ["Engine", [{ head: "bricks/", chips: true }, { label: "Demos", match: /^(demos|examples)\// }]],
  ["Daily", [{ head: "gallery/" }, { head: "contest/" }, { head: "make/" }, { head: "people/" }]],
  ["Notes", [{ head: "notes/" }, { head: "news/", chips: true, fold: "releases" }]],
  ["Project", [{ label: "More", match: /./ }, { label: "Source", links: PROJECT }, { label: "DOM VIRUS family", links: FAMILY_LINE }]],
];

/**
 * The footer's site map for the page at `path` (`base`: the path back to the root). `routes`:
 * [{ path, label, chip? }] in reading order, every indexable page ("" is home, linked by the brand).
 */
export function siteMap(routes, base, path) {
  const claimed = new Set([""]);
  const take = (test) => routes.filter((r) => !claimed.has(r.path) && test(r.path)).map((r) => (claimed.add(r.path), r));
  // A route with a `chip` (a brick: site/brick-ui.mjs symChip) draws itself; its label stays its name.
  const a = (r, cls = "") => r.chip ? r.chip(`${base}${r.path}`, current(r.path, path)) : `<a${cls} href="${base}${r.path}"${current(r.path, path)}>${esc(r.label)}</a>`;
  const section = (s) => {
    if (s.links) return `<li class="map-sec"><span class="map-label">${esc(s.label)}</span><ul>${s.links.map(([href, label]) => `<li><a href="${href}">${esc(label)}${href === SITE ? "" : " ↗"}</a></li>`).join("")}</ul></li>`;
    const rs = take(s.head ? (p) => p === s.head || (s.head.endsWith("/") && p.startsWith(s.head)) : (p) => s.match.test(p));
    const head = rs.find((r) => r.path === s.head), kids = rs.filter((r) => r !== head);
    if (!head && !kids.length) return "";
    let list = kids.length ? `<ul${s.chips ? ' class="map-chips"' : ""}>${kids.map((r) => `<li>${a(r)}</li>`).join("")}</ul>` : "";
    if (s.fold && kids.length) list = `<details class="map-fold"${kids.some((r) => r.path === path) ? " open" : ""}><summary>All ${kids.length} ${s.fold}</summary>${list}</details>`;
    return `<li class="map-sec">${head ? a(head, ' class="map-head"') : `<span class="map-label">${esc(s.label)}</span>`}${list}</li>`;
  };
  // Each column is a disclosure: always open above phone width (site.css shows its content), closed
  // at phone width except the column holding the page you are on. No JS.
  const cols = SITE_MAP.map(([name, sections]) => {
    const list = sections.map(section).join("");
    return `<details class="map-col"${/aria-current=/.test(list) ? " open" : ""}><summary><h2>${esc(name)}</h2></summary><ul>${list}</ul></details>`;
  });
  return `<nav class="foot-map" aria-label="Site map">${cols.join("")}</nav>`;
}
const MARKER = /<!--site-map (\S*) (\S*)-->/;
/** Swap a built page's site-map marker for the map (a page without one comes back as is). */
export const fillSiteMap = (html, routes) => html.replace(MARKER, (_, base, path) => siteMap(routes, base, path));

/** The grid on every hero: the page's first <section> or <article> (its head, the hero) gets the
 *  shared `.has-grid` treatment from site.css (--grid-* tokens), unless the page already marks one. */
export const withGrid = (body) =>
  /\bhas-grid\b/.test(body) ? body : body.replace(/<(?:section|article)\b[^>]*>/, (tag) =>
    / class="/.test(tag) ? tag.replace(/ class="/, ' class="has-grid ') : tag.replace(/>$/, ' class="has-grid">'));

/**
 * A full page. `base` is the path back to the site root ("./" for top-level pages, "../" one
 * level down, "/fizlet/" for the 404 page, which can be served at any depth). `redirect`: a moved
 * page's new path (from the root): the page sends the visitor there (meta refresh, the static
 * site's redirect), its canonical names it, and it stays out of search (noindex).
 */
export function page({ title, description, base, version, body, scripts = [], path = "", ld = [], noindex = false, nofollow = false, redirect = "" }) {
  const home = base;
  body = withGrid(body);
  const nav = navTree(home, path);
  if (redirect) noindex = true;
  return `<!doctype html>
<html lang="en" class="bui" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${redirect ? `<meta http-equiv="refresh" content="0; url=${base}${redirect}">\n` : ""}${noindex ? `<meta name="robots" content="noindex${nofollow ? ",nofollow" : ""}">\n` : ""}${social({ title, description, path, canonical: redirect || path })}
<meta name="theme-color" content="#07060f">
${jsonLd(ld)}
<link rel="icon" href="${base}icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${base}board-ui.css">
<link rel="stylesheet" href="${base}site.css">
<script>try{var t=localStorage.getItem("dom-virus:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="${home}" aria-label="Fizlet home">
      <span class="brand-mark">${mark(40)}</span>
      <span class="brand-text"><small>DOM ENGINE<i>V${esc(version)}</i></small><b>FIZLET</b></span>
    </a>
    <nav class="site-nav" aria-label="Site" id="site-nav">${nav}</nav>
    <div class="head-keys">
      <a class="bui-key bui-icon-key gh" href="${REPO}" aria-label="Source on GitHub">${icon("github")}</a>
      <button class="bui-key bui-icon-key" type="button" data-theme-toggle aria-label="Switch light or dark"><span class="theme-dark">${icon("moon")}</span><span class="theme-light">${icon("sun")}</span></button>
      <a class="bui-key bui-arcade bui-go start-key-sm" href="${home}#start">${icon("play", 16)}Start</a>
      <button class="bui-key bui-icon-key menu-key" type="button" data-menu aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon("menu")}${icon("close")}</button>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-brand">
      <a class="brand" href="${home}">
        <span class="brand-mark">${mark(40)}</span>
        <span class="brand-text"><small>DOM ENGINE</small><b>FIZLET<i class="brand-fzlt">fzlt™</i></b></span>
      </a>
      <p>Fizlet™ is the building blocks for animation and games on the DOM, by <a href="${AUTHOR}">Chris Cooley ↗</a>. Bring the logic and style; the bricks do the rest, and the page always comes back.</p>
      <p class="foot-note"><a href="${HUB}">DOM VIRUS ↗</a> is one use of the bricks: its games run on Fizlet.</p>
      <p class="foot-note">Fizlet and fzlt are trademarks of Chris Cooley.</p>
    </div>
    <!--site-map ${base} ${path}-->
  </div>
  <div class="foot-base">
    <div class="wrap"><span>© 2026 Chris Cooley · MIT licence · no runtime dependencies</span><button type="button" class="foot-cookies" data-cookie-settings hidden>Cookie settings</button><span>By <a href="${AUTHOR}">Chris Cooley ↗</a> · coded.design</span></div>
  </div>
</footer>
${scripts.map((s) => `<script type="module" src="${base}${s}"></script>`).join("\n")}
${analytics(base)}
</body>
</html>
`;
}
