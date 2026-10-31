// The site navigation rules (scripts/check-nav.mjs) on small hand-made pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNav } from "../scripts/check-nav.mjs";

const SITE = "https://fizlet.com/";
const shell = (base, path, body, current = "") => `<html><head><link rel="canonical" href="${SITE}${path}"></head><body>
<nav class="site-nav" aria-label="Site"><a href="${base}#contract">Contract</a><a href="${base}bricks/"${current}>Bricks</a></nav>
<main>${body}</main><footer class="site-foot"><ul><li><a href="${base}notes/">Notes</a></li></ul></footer></body></html>`;
const good = () => [
  { path: "", html: shell("./", "", '<a href="bricks/fx.html">fzlt/fx</a> <a href="https://github.com/x">Source ↗</a> <a class="k" href="https://github.com/x" aria-label="Source on GitHub"><svg></svg></a>') },
  { path: "bricks/", html: shell("../", "bricks/", "", ' aria-current="page"') },
  { path: "bricks/fx.html", html: shell("../", "bricks/fx.html", '<nav class="bp-crumbs" aria-label="Breadcrumb"><a href="../">Fizlet</a> / <a href="./">Bricks</a> / <span aria-current="page">fzlt/fx</span></nav>', ' aria-current="true"') },
  { path: "notes/", html: shell("../", "notes/", "") },
];

test("a site that keeps every rule passes", () => {
  const pages = good();
  // notes/ is marked current in its footer link.
  pages[3].html = pages[3].html.replace('<a href="../notes/">', '<a href="../notes/" aria-current="page">');
  assert.deepEqual(checkNav(pages, { site: SITE }), []);
});

test("each broken rule is named", () => {
  const pages = good();
  pages[3].html = pages[3].html.replace('<a href="../notes/">', '<a href="../notes/" aria-current="page">');
  pages[1].html = pages[1].html.replace(' aria-current="page"', ""); // 2: no active state
  pages[2].html = pages[2].html.replace(/<nav class="bp-crumbs"[\s\S]*?<\/nav>/, ""); // 3: no crumbs
  pages[0].html = pages[0].html.replace("Source ↗", "Source").replace('<a href="bricks/fx.html">fzlt/fx</a>', '<a href="bricks/fx.html">here</a>'); // 4, 5
  pages.push({ path: "lost/", html: shell("../", "lost/", "").replace('<a href="../#contract">Contract</a>', "") }); // 1 and 6
  pages[4].html = pages[4].html; // lost/ links out, but nothing links to it
  const got = checkNav(pages, { site: SITE }).join("\n");
  for (const want of ["bricks/: nav link ../bricks/ has no aria-current", "bricks/fx.html: no breadcrumbs", 'index: external link without ↗: "Source"', 'index: vague link text "here"', "lost/: header nav differs", "lost/: orphan"])
    assert.ok(got.includes(want), `${want}\n--- got:\n${got}`);
});

test("standalone pages skip the shell rules but not the link rules", () => {
  const pages = good();
  pages[3].html = pages[3].html.replace('<a href="../notes/">', '<a href="../notes/" aria-current="page">');
  pages.push({ path: "examples/fizz/", html: '<html><body><a href="https://coded.design/">Chris Cooley</a></body></html>' });
  pages[0].html = pages[0].html.replace("</main>", '<a href="examples/fizz/">The fizz hero example</a></main>');
  assert.deepEqual(checkNav(pages, { site: SITE, standalone: ["examples/fizz/"] }), ['examples/fizz/: external link without ↗: "Chris Cooley" → https://coded.design/']);
});

test("a moved page (meta refresh) needs no inbound link; the header may carry more attributes", () => {
  const pages = good();
  pages[3].html = pages[3].html.replace('<a href="../notes/">', '<a href="../notes/" aria-current="page">');
  for (const p of pages) p.html = p.html.replace('<nav class="site-nav" aria-label="Site">', '<nav class="site-nav" aria-label="Site" id="site-nav">');
  pages.push({ path: "old/", html: shell("../", "old/", "").replace("</head>", '<meta http-equiv="refresh" content="0; url=../notes/"></head>') });
  assert.deepEqual(checkNav(pages, { site: SITE }), []);
  pages[4].html = pages[4].html.replace(/<meta http-equiv[^>]*>/, "");
  assert.deepEqual(checkNav(pages, { site: SITE }), ["old/: orphan (no page links to it)"]);
});
