// The website's brick pages and llms-full.txt are generated from the source: this checks the
// generator. The catalog covers every public module in package.json, each page's API lists every
// runtime export of its module and every export has a doc comment, signatures come from the compiler,
// the sizes on a page are the measured ones, and the HTML gates catch what they should.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { api, declarations, leadComment, undocumented } from "../scripts/api.mjs";
import { llmsFull } from "../scripts/llms-full.mjs";
import { checkHtml } from "../scripts/check-html.mjs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS, STATUS } from "../site/bricks.mjs";
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
    .map((k) => (k === "." ? "@fzlt/core" : `@fzlt/core/${k.slice(2)}`));
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

test("every public export has a doc comment", () => {
  const mods = BRICKS.flatMap((b) => b.modules.map((m) => ({ ...m, ...api(m) })));
  assert.deepEqual(undocumented(mods), [], "add a /** doc comment */ to each of these in src/ (it reaches the brick page and llms-full.txt)");
  // The gate itself: a declaration file with undocumented exports fails it, and a module's leading
  // comment does not count as the doc of the export right below it.
  const decls = declarations("tests/fixtures/api/mixed.d.ts", { lead: "A module's leading comment: its summary, not the doc of the first export below it." });
  assert.deepEqual(undocumented([{ name: "mixed", decls }]), ["mixed: FirstOptions", "mixed: bare"]);
});

test("declarations: signatures, parameters and return types from the compiler", () => {
  const fx = declarations("tests/fixtures/api/mixed.d.ts");
  const one = fx.find((d) => d.name === "one");
  assert.equal(one.sigs[0].text, "one(n: number, o?: FirstOptions): number");
  assert.deepEqual(one.sigs[0].params.map((p) => [p.name, p.type, p.optional, p.doc]), [["n", "number", false, "how many"], ["o", "FirstOptions", true, ""]]);
  assert.deepEqual(one.tags, [{ name: "deprecated", text: "Use `two()`." }]);
  assert.equal(fx.find((d) => d.name === "bare").sigs[0].text, "bare(...xs: string[]): void");
  assert.deepEqual(fx.find((d) => d.name === "A").names, ["A", "B"]);
  const kernel = declarations("dist/index.d.ts");
  // An inline object return type reads as its exported alias (type Engine = ReturnType<typeof createEngine>).
  assert.equal(kernel.find((d) => d.name === "createEngine").sigs[0].text, "createEngine(o?: EngineOptions): Engine");
  assert.equal(kernel.find((d) => d.name === "Pool").sigs[0].text, "new Pool<T>(cap: number, create: () => T): Pool<T>");
  // A const holding a function gets its signature.
  assert.equal(declarations("dist/grid.d.ts").find((d) => d.name === "board").sigs[0].text, "board(cols: number, rows: number, opts?: BoardOptions): Board");
});

test("declarations: re-exports, multi-name consts, doc comments", () => {
  const kernel = declarations("dist/index.d.ts");
  const names = kernel.flatMap((d) => d.names);
  for (const n of ["createEngine", "Ledger", "Pool", "EventRing", "seeded", "IDLE", "RENDER", "Engine", "System"]) assert.ok(names.includes(n), n);
  assert.deepEqual(declarations("dist/grid.d.ts").find((d) => d.name === "BLOCKED").names, ["BLOCKED", "COVER", "OCCUPIED"]);
  assert.match(declarations("dist/grid.d.ts").find((d) => d.name === "board").doc, /cols × rows/);
  assert.match(leadComment("src/presence.ts"), /^@fzlt\/core\/presence: lockstep/); // `//` comments too
});

test("a brick page shows the measured size and every export", async () => {
  const sizes = await measure();
  const b = BRICKS.find((x) => x.id === "grid");
  const mods = b.modules.map((m) => ({ ...m, ...api(m) }));
  const html = brickPage({ brick: { ...b, summary: "x" }, mods, sizes, version: pkg.version });
  const s = sizes.find((x) => x.name === "@fzlt/core/grid");
  assert.ok(html.includes(`data-size="@fzlt/core/grid">${s.gzip.toLocaleString("en-US")} B</b>`), "the measured gzip bytes");
  for (const d of mods[0].decls) assert.ok(html.includes(`id="api-fzlt-core-grid-${d.name}"`), d.name);
  // Each export: its status flag, and a function's signature, parameters and return type.
  assert.equal(html.match(/<article class="bp-decl"[\s\S]*?<\/article>/g).filter((a) => a.includes('class="status-pill" data-flag="beta"')).length, mods[0].decls.length);
  assert.ok(html.includes("<code>board(cols: number, rows: number, opts?: BoardOptions): Board</code>"), "the signature");
  assert.match(html, /<dt>Returns<\/dt><dd><code><a href="#api-fzlt-core-grid-Board">Board<\/a><\/code><\/dd>/);
  assert.match(html, /npm install @fzlt\/core\n/);
  assert.ok(!html.includes("not published"), "npm is live: no 'not published' note");
  const full = page({ title: "@fzlt/core/grid · Fizlet", description: "The game board: typed-array tiles, A* paths and line of sight, measured.", base: "../", version: pkg.version, path: "bricks/grid.html", body: html });
  assert.deepEqual(checkHtml(full, "bricks/grid.html"), []);
});

test("llms-full.txt: every export of every brick, with its status", async () => {
  const sizes = await measure();
  const bricks = BRICKS.map((b) => ({ ...b, mods: b.modules.map((m) => ({ ...m, ...api(m) })) }));
  const txt = llmsFull({ bricks, sizes, version: pkg.version, site: "https://fizlet.com/", description: pkg.description });
  for (const b of bricks) {
    assert.ok(txt.includes(`## ${b.name}\n\nStatus: ${STATUS[b.status].label}.`), b.name);
    for (const m of b.mods) for (const d of m.decls) assert.ok(txt.includes(`### ${d.names.join(", ")} (${d.kind}, `), `${m.name}.${d.name}`);
  }
  assert.ok(txt.includes("Signature: `createEngine(o?: EngineOptions): Engine`"));
  assert.doesNotMatch(txt, /&(lt|gt|amp|quot|#\d+);/, "plain text: nothing HTML-escaped");
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
  has(good.replace(/<link rel="canonical"[^>]*>/, ""), /canonical/);
  has(good.replace(/<meta property="og:image"[^>]*>/, ""), /og:image/);
  has(good.replace(/<meta name="description"[^>]*>/, ""), /description/);
  has(good.replace("<main", "<div").replace("</main>", "</div>"), /<main>/);
  has(good.replace("<h2>Sub</h2>", '<p id="dup"></p><p id="dup"></p>'), /unique ids/);
});

test("checkHtml: a moved page (meta refresh) names its new home as canonical", () => {
  const moved = page({ title: "Moved · Fizlet", description: "A page that moved, sending its visitors to the new address straight away.", base: "../", version: "1.0.0", path: "old/", redirect: "new/", body: "<section><h1>Moved</h1></section>" });
  assert.match(moved, /<meta http-equiv="refresh" content="0; url=\.\.\/new\/">/);
  assert.match(moved, /<meta name="robots" content="noindex">/);
  assert.deepEqual(checkHtml(moved, "old/"), []);
  assert.ok(checkHtml(moved.replace(/new\/">\n<meta name="robots"/, 'other/">\n<meta name="robots"'), "old/").some((p) => /canonical/.test(p)), "a canonical that is not the target fails");
});
