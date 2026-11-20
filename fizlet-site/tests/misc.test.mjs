import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const COLOR = json("src/design/tokens.json").color.selector;
const hex = (name, theme) => {
  const v = theme === "light" ? COLOR['.bui[data-theme="light"]'][name] ?? COLOR[".bui"][name] : COLOR[".bui"][name];
  const ref = v?.match(/^var\((--[\w-]+)\)$/);
  return ref ? hex(ref[1], theme) : v;
};

test("brand: every swatch the legacy page showed is a token, with the same hex in each theme", () => {
  const groups = json("src/data/legacy/pages/brand.json").sections.find((s) => s.id === "colour").groups;
  assert.ok(groups.length >= 3);
  for (const w of groups.flatMap((g) => g.swatches)) {
    assert.ok(COLOR[".bui"][w.var], `${w.var} is not in tokens.json`);
    for (const { theme, hex: legacy } of w.legacy) assert.equal(hex(w.var, theme), legacy, `${w.var} ${theme}`);
    assert.equal(w.var in COLOR['.bui[data-theme="light"]'], w.legacy.some((l) => l.theme === "light"), `${w.var}: light value shown iff the light theme sets one`);
  }
});

test("redirects: one Cloudflare 301 per moved page (with and without the slash), to its new URL", () => {
  const moved = json("src/data/legacy/pages/redirects.json");
  const routes = json("src/data/legacy/routes.json").filter((r) => r.type === "redirect");
  assert.deepEqual(moved.map((r) => r.meta.path).sort(), routes.map((r) => r.path).sort());
  const rules = readFileSync("public/_redirects", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  assert.equal(rules.length, moved.length * 2);
  for (const r of moved) {
    assert.ok(rules.includes(`/${r.meta.path} /${r.to} 301`), r.meta.path);
    assert.ok(rules.includes(`/${r.meta.path.replace(/\/$/, "")} /${r.to} 301`), r.meta.path);
  }
});

test("the legal pages, the 404 and the moved pages keep their legacy head facts", () => {
  const routes = Object.fromEntries(json("src/data/legacy/routes.json").map((r) => [r.path, r]));
  for (const f of ["pages/legal/privacy.json", "pages/legal/cookies.json", "pages/not-found.json", "pages/brand.json"]) {
    const { meta } = json(`src/data/legacy/${f}`);
    assert.equal(meta.title, routes[meta.path].title);
    assert.equal(meta.description, routes[meta.path].description);
  }
  assert.ok(routes["404.html"].noindex);
  for (const r of json("src/data/legacy/pages/redirects.json")) assert.ok(routes[r.meta.path].noindex);
});
