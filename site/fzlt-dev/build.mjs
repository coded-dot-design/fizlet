// Build the fzlt.dev landing page: `npm run site:fzlt` → site-dist-fzlt/ (index.html, fzlt.css,
// icon.svg). One static page, no JS: the FIZLET wordmark and the fzlt mark (the site's own lockup),
// the install line, and links to fizlet.com, the docs, GitHub and npm. Every link leaves for
// fizlet.com or the code's homes; nothing on the page loads from anywhere else.
//
// Styles: the Board UI kit (src/ui/board-ui.css, whole), the site.css rules for the pieces this page
// uses (picked by class at build time, never copied by hand), and page.css (layout). Theme without a
// script: the page is dark (the kit's default), and every `[data-theme="light"]` rule of those
// sheets is repeated under `prefers-color-scheme: light`, so it follows the visitor's system.
import { transform } from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { measure } from "../../scripts/sizes.mjs";
import { AUTHOR, REPO, esc, icon, mark } from "../layout.mjs";

const OUT = process.argv[2] ?? "site-dist-fzlt";
const HOME = "https://fizlet.com/";
const NPM = "https://www.npmjs.com/package/@fzlt/core";
const ORG = "https://github.com/fizlet";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// ---------- CSS: a tiny walker over minified CSS ----------
/** Split minified CSS into [prelude, body] blocks at one nesting level (strings and comments safe). */
function blocks(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = scan(css, i, "{");
    if (open < 0) break;
    // A statement at-rule before it (@charset, @import) ends in ";": the block's prelude is what follows.
    const prelude = css.slice(i, open).split(";").pop().trim();
    let depth = 1, j = open + 1;
    for (; j < css.length && depth; j++) {
      const c = css[j];
      if (c === '"' || c === "'") j = css.indexOf(c, j + 1);
      else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    out.push([prelude, css.slice(open + 1, j - 1)]);
    i = j;
  }
  return out;
}
function scan(css, from, ch) {
  for (let i = from; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") i = css.indexOf(c, i + 1);
    else if (c === ch) return i;
    else if (c === ";" && ch === "{") from = i + 1; // a statement at-rule (@import, @charset): skipped
  }
  return -1;
}
/** Split a selector list at its top-level commas. */
function selectors(list) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && !depth) out.push(list.slice(start, i)), (start = i + 1);
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}
const NESTED = /^@(media|supports|layer|container)\b/;
/**
 * Rebuild `css` keeping the selectors `keep(selector)` accepts (a rule with none left is dropped),
 * mapped through `map` (return null to drop). Nested @media/@supports recurse; other at-rules
 * (@keyframes, @font-face) are kept only when `atRules` is true.
 */
function pick(css, keep, map = (s) => s, atRules = true) {
  let out = "";
  for (const [prelude, body] of blocks(css)) {
    if (NESTED.test(prelude)) {
      const inner = pick(body, keep, map, atRules);
      if (inner) out += `${prelude}{${inner}}`;
    } else if (prelude.startsWith("@")) {
      if (atRules) out += `${prelude}{${body}}`;
    } else {
      const sel = selectors(prelude).filter(keep).map(map).filter(Boolean);
      if (sel.length) out += `${sel.join(",")}{${body}}`;
    }
  }
  return out;
}
const minify = async (css) => (await transform(css, { loader: "css", minify: true })).code.trim();

// site.css: only the rules for the pieces used here. A selector is kept when every class it names
// is one of these (rules naming no class, such as :root, html, body, a, code, are kept too).
const SITE_CLASSES = new Set(["bui", "wrap", "skip", "sr", "eyebrow", "index", "brand", "brand-mark", "brand-text", "has-grid", "hero-install", "code", "code-card", "foot-base"]);
const classesOf = (sel) => [...sel.replace(/\[[^\]]*\]/g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
const kit = await minify(readFileSync("src/ui/board-ui.css", "utf8"));
const site = pick(await minify(readFileSync("site/site.css", "utf8")), (s) => classesOf(s).every((c) => SITE_CLASSES.has(c)), undefined, false);
const own = await minify(readFileSync("site/fzlt-dev/page.css", "utf8"));
const all = kit + site + own;
// The light theme without a script: each light rule again under the system preference, its
// `[data-theme=light]` read as "no theme chosen" (the page sets none). Dark-only rules are left out.
const LIGHT = /\[data-theme=("?)light\1\]/;
const light = pick(all, (s) => LIGHT.test(s), (s) => s.replace(new RegExp(LIGHT, "g"), ":not([data-theme])"), false);
const css = await minify(`${all}@media (prefers-color-scheme:light){${light}}`);
if (/@import|url\((?!["']?data:)/.test(css)) throw new Error("fzlt.dev: the CSS must not load anything");

// ---------- The page ----------
const sizes = await measure();
const kernel = sizes.find((s) => s.name === "@fzlt/core (kernel)").gzip;
const n = (x) => x.toLocaleString("en-US");
const out = (href, label, cls = "bui-key", ico = "out") => `<li><a class="${cls}" href="${href}">${icon(ico, 16)}${label}</a></li>`;
const title = "Fizlet™ (fzlt™): npm i @fzlt/core";
const description = "Fizlet™ (fzlt™) is the bricks for DOM animation and games, by Chris Cooley. npm i @fzlt/core.";

const html = `<!doctype html>
<html lang="en" class="bui">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://fzlt.dev/">
<meta name="author" content="Chris Cooley">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="https://fzlt.dev/">
<meta property="og:site_name" content="Fizlet">
<meta property="og:image" content="${HOME}og.png">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#07060f">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="fzlt.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="fz has-grid">
<header class="wrap">
  <p class="eyebrow"><span class="index">fzlt.dev</span> <b>v${esc(version)}</b></p>
  <div class="fz-lockups">
    <a class="brand" href="${HOME}" aria-label="Fizlet: fizlet.com">
      <span class="brand-mark">${mark(70)}</span>
      <span class="brand-text"><small>DOM ENGINE</small><b>FIZLET</b></span>
    </a>
    <span class="fz-short" role="img" aria-label="fzlt, the short mark"><span class="brand-mark">${mark(30)}</span><span aria-hidden="true">fzlt</span></span>
  </div>
</header>
<main id="main" class="wrap">
  <h1>Logic and style. <em>The bricks do the rest.</em></h1>
  <p class="fz-lead"><b>Fizlet™ (fzlt™)</b> is the bricks for DOM animation and games, by <a href="${AUTHOR}/">Chris Cooley ↗</a>. Each brick solves a task written again and again over two decades of animation and game work, so a game or an animation boils down to its logic and its style.</p>
  <div class="hero-install code-card">
    <pre class="code"><code><span class="fz-prompt" aria-hidden="true">$ </span>npm i @fzlt/core</code></pre>
  </div>
  <p class="fz-facts">kernel <b>${n(kernel)} B</b> gzip · ${sizes.length} size budgets in CI · 0 runtime dependencies · MIT</p>
  <nav aria-label="Fizlet links">
    <ul class="fz-links">
      ${out(HOME, "fizlet.com", "bui-key bui-arcade bui-go", "right")}
      ${out(`${HOME}docs/`, "Docs ↗", "bui-key", "book")}
      ${out(REPO, "coded-dot-design/fizlet ↗", "bui-key", "github")}
      ${out(ORG, "github.com/fizlet ↗", "bui-key", "github")}
      ${out(NPM, "npm @fzlt/core ↗", "bui-key", "code")}
    </ul>
  </nav>
</main>
</div>
<footer class="foot-base fz-foot">
  <div class="wrap"><span>Fizlet and fzlt are trademarks of Chris Cooley.</span><span>By <a href="${AUTHOR}/">Chris Cooley ↗</a> · MIT licence</span></div>
</footer>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/index.html`, html);
writeFileSync(`${OUT}/fzlt.css`, css + "\n");
writeFileSync(`${OUT}/icon.svg`, mark(64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" style="color:#39ffb0;background:#07060f" '));
console.log(`Built ${OUT}/: fzlt.dev (index.html ${n(html.length)} B, fzlt.css ${n(css.length)} B)`);
