// The website's brick pages are generated from the source: this checks the generator. The catalog
// covers every public module in package.json, each page's API lists every runtime export of its
// module, the sizes on a page are the measured ones, and the HTML gates catch what they should.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { api, declarations, leadComment } from "../scripts/api.mjs";
import { checkHtml } from "../scripts/check-html.mjs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS } from "../site/bricks.mjs";
import { brickPage } from "../site/pages/brick.mjs";
import { page } from "../site/layout.mjs";

// The declarations come from the build (npm run check builds after the tests).
if (!existsSync("dist/index.d.ts")) execFileSync("node", ["scripts/build.mjs"], { stdio: "inherit" });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

test("the catalog covers every public module in package.json, once", () => {
  const listed = BRICKS.flatMap((b) => b.modules.map((m) => m.name));
  assert.equal(new Set(listed).size, listed.length, "a module is listed twice");
  const exported = Object.keys(pkg.exports)
    .filter((k) => !/\.(css|json)$/.test(k) && k !== "./kernel")
    .map((k) => (k === "." ? "fizlet" : `fizlet/${k.slice(2)}`));
  assert.deepEqual([...listed].sort(), exported.sort());
  for (const b of BRICKS) for (const m of b.modules) assert.ok(existsSync(m.src) && existsSync(m.dts), `${m.name}: ${m.src}, ${m.dts}`);
});

test("each brick's API lists every runtime export of its module, with a summary", async () => {
  for (const b of BRICKS)
    for (const m of b.modules) {
      const { summary, decls } = api(m);
      assert.ok(summary.length > 40, `${m.name}: a leading comment in ${m.src}`);
      const names = new Set(decls.flatMap((d) => d.names));
      const runtime = Object.keys(await import(`../${m.src}`));
      for (const n of runtime) assert.ok(names.has(n), `${m.name}: ${n} is exported but not on its page`);
      for (const d of decls) {
        assert.ok(d.code.startsWith("export "), `${m.name}.${d.name}: ${d.code.slice(0, 40)}`);
        assert.doesNotMatch(d.code, /^\s+private /m, `${m.name}.${d.name}: private members are not API`);
      }
    }
});

test("declarations: re-exports, multi-name consts, doc comments", () => {
  const kernel = declarations("dist/index.d.ts");
  const names = kernel.flatMap((d) => d.names);
  for (const n of ["createEngine", "Ledger", "Pool", "EventRing", "seeded", "IDLE", "RENDER", "Engine", "System"]) assert.ok(names.includes(n), n);
  assert.deepEqual(declarations("dist/grid.d.ts").find((d) => d.name === "BLOCKED").names, ["BLOCKED", "COVER", "OCCUPIED"]);
  assert.match(declarations("dist/grid.d.ts").find((d) => d.name === "board").doc, /cols × rows/);
  assert.match(leadComment("src/presence.ts"), /^fizlet\/presence: lockstep/); // `//` comments too
});

test("a brick page shows the measured size and every export", async () => {
  const sizes = await measure();
  const b = BRICKS.find((x) => x.id === "grid");
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  const html = brickPage({ brick: { ...b, summary: "x" }, mods, sizes, version: pkg.version });
  const s = sizes.find((x) => x.name === "fizlet/grid");
  assert.ok(html.includes(`data-size="fizlet/grid">${s.gzip.toLocaleString("en-US")} B</b>`), "the measured gzip bytes");
  for (const d of mods[0].decls) assert.ok(html.includes(`id="api-fizlet-grid-${d.name}"`), d.name);
  assert.match(html, /npm install fizlet {3}# not published yet/);
  const full = page({ title: "fizlet/grid · Fizlet", description: "The game board: typed-array tiles, A* paths and line of sight, measured.", base: "../", version: pkg.version, path: "bricks/grid.html", body: html });
  assert.deepEqual(checkHtml(full, "bricks/grid.html"), []);
});

test("checkHtml catches the basics", () => {
  const good = page({ title: "A page · Fizlet", description: "A description long enough for a search result snippet to be useful.", base: "./", version: "1.0.0", path: "x.html", body: "<section><h1>Hi</h1><h2>Sub</h2></section>" });
  assert.deepEqual(checkHtml(good, "x.html"), []);
  const has = (html, re) => assert.ok(checkHtml(html, "x.html").some((p) => re.test(p)), `${re}: ${checkHtml(html, "x.html")}`);
  has(good.replace("<h2>Sub</h2>", "<h1>Two</h1>"), /one <h1>/);
  has(good.replace("<h2>Sub</h2>", "<h4>Deep</h4>"), /skip from h1 to h4/);
  has(good.replace("<h2>Sub</h2>", '<img src="a.png">'), /without alt/);
  has(good.replace("<h2>Sub</h2>", "<svg></svg>"), /svg/);
  assert.deepEqual(checkHtml(good.replace("<h2>Sub</h2>", '<h2>Sub</h2><svg aria-hidden="true"><svg x="1"></svg></svg>'), "x.html"), [], "a nested svg is hidden with its parent");
  has(good.replace("<h2>Sub</h2>", '<button type="button"></button>'), /without a name/);
  has(good.replace("<h2>Sub</h2>", '<h2>Sub</h2><pre class="code"><code>x</code></pre>'), /<pre> without tabindex/);
  assert.deepEqual(checkHtml(good.replace("<h2>Sub</h2>", '<h2>Sub</h2><pre tabindex="0" class="code"><code>x</code></pre>'), "x.html"), [], "a focusable code block passes");
  has(good.replace(/<link rel="canonical"[^>]*>/, ""), /canonical/);
  has(good.replace(/<meta property="og:image"[^>]*>/, ""), /og:image/);
  has(good.replace(/<meta name="description"[^>]*>/, ""), /description/);
  has(good.replace("<main", "<div").replace("</main>", "</div>"), /<main>/);
  has(good.replace("<h2>Sub</h2>", '<p id="dup"></p><p id="dup"></p>'), /unique ids/);
});
