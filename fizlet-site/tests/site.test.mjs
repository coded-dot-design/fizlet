import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { current } from "../src/lib/current.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));

test("aria-current: the page, its section, never home, anchors or other hosts", () => {
  assert.equal(current("/docs/getting-started/", "/docs/getting-started/"), "page");
  assert.equal(current("/docs/", "/docs/getting-started/"), "true");
  assert.equal(current("/bricks/", "/bricks/kernel.html"), "true");
  assert.equal(current("/bricks/kernel.html", "/bricks/kernel.html"), "page");
  assert.equal(current("/bricks/kernel.html", "/bricks/"), undefined);
  assert.equal(current("/", "/"), undefined);
  assert.equal(current("#start", "/"), undefined);
  assert.equal(current("https://fizlet.com/docs/", "/docs/"), undefined);
});

test("tokens.css is generated from tokens.json and current", () => {
  execFileSync(process.execPath, ["scripts/tokens.mjs", "--check"], { stdio: "pipe" });
});

test("tokens: both themes define every surface and ink colour", () => {
  const c = json("src/design/tokens.json").color.selector;
  for (const k of ["--bg", "--surface", "--raised", "--card", "--ink", "--muted", "--line"]) {
    assert.ok(c[".bui"][k], `dark ${k}`);
    assert.ok(c['.bui[data-theme="light"]'][k], `light ${k}`);
  }
});

// A variant may re-point a token on its own selector: .bui[data-side="1"] plays as team B, the
// gutter's phone step (@media max-width 520px), a poster's own unit scale (.sk-poster .sk --u).
const VARIANTS = new Set(["--team", "--gutter", "--u"]);
test("the lifted stylesheets define no tokens of their own", () => {
  const names = new Set(Object.values(json("src/design/tokens.json")).flatMap((g) => Object.values(g.selector ?? {}).flatMap((v) => Object.keys(v))));
  for (const f of ["src/styles/board-ui.css", "src/styles/site.css"]) {
    for (const [, name] of readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:/g)) assert.ok(!names.has(name) || VARIANTS.has(name), `${f} redefines ${name}`);
  }
});

test("every legacy route has a plan, and MIGRATION.md is current", () => {
  execFileSync(process.execPath, ["scripts/migration.mjs", "--check"], { stdio: "pipe" });
});

test("URLs stay the legacy ones: brick pages end in .html, folder pages in /", () => {
  for (const r of json("src/data/legacy/routes.json")) {
    if (r.type === "brick") assert.match(r.path, /^bricks\/[\w-]+\.html$/);
    if (r.type === "doc") assert.match(r.path, /^(docs|guides)\/[\w-]+\/$/);
  }
});

test("the footer map: five columns, every internal link from the root", () => {
  const footer = json("src/data/legacy/footer.json");
  assert.deepEqual(footer.map((c) => c.name), ["Learn", "Engine", "Daily", "Notes", "Project"]);
  for (const s of footer.flatMap((c) => c.sections)) for (const i of s.items) assert.match(i.href, /^(\/|https:\/\/)/);
});
