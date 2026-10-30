// Hard shadows follow the domain (src/ui/BOARD-UI.md §4.1): a component keeps its depth and reads
// --shadow-x / --shadow-y, set once at the site's :root. The check: no stylesheet, stage or scene in
// site/ or src/ui/ hard-codes an offset box-shadow or drop-shadow. The files still waiting for their
// port are listed with how many they hold; that number may only go down (fizlet#136 ports the kit
// and the site chrome reads the kit's keys; then they leave this list).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hardShadows, layerToToken, tokenShadows } from "../scripts/shadow-tokens.mjs";

const PENDING = {
  "site/site.css": 17,
  "site/demos/layers/css.ts": 3,
  "site/demos/layers/poster.ts": 1,
  "src/ui/board-ui.css": 12,
};

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

test("no hard-coded offset shadow in site/ or src/ui/ (gallery, stages, labs, vendored pieces)", () => {
  const bad = [];
  for (const f of [...walk("site"), ...walk("src/ui")].filter((f) => /\.(css|html|ts|mjs)$/.test(f))) {
    const found = hardShadows(readFileSync(f, "utf8"));
    const allowed = PENDING[f] ?? 0;
    if (found.length > allowed) bad.push(`${f}: ${found.map((h) => `${h.line}: ${h.text}`).join("; ")}`);
    if (allowed && found.length < allowed) bad.push(`${f}: ${found.length} left, lower PENDING (was ${allowed})`);
  }
  assert.deepEqual(bad, [], "use calc(<depth> * var(--shadow-x, 0)) calc(<depth> * var(--shadow-y, 1)); scripts/shadow-tokens.mjs tokenShadows() does it");
});

test("tokenShadows: depth kept, direction from the tokens; press travel follows; what can't be expressed goes", () => {
  const t = (x) => `calc(${x} * var(--shadow-x, 0)) calc(${x} * var(--shadow-y, 1))`;
  assert.equal(tokenShadows(".a{box-shadow:6px 6px 0 var(--accent)}"), `.a{box-shadow:${t("6px")} 0 var(--accent)}`);
  assert.equal(tokenShadows(".a{box-shadow:0 .9cqw 0 #000}"), `.a{box-shadow:${t(".9cqw")} 0 #000}`);
  assert.equal(tokenShadows(".a{box-shadow:7px 7px #f4457a!important}"), `.a{box-shadow:${t("7px")} #f4457a!important}`);
  assert.equal(tokenShadows(".a{filter:drop-shadow(1px 1px 0 red)}"), `.a{filter:drop-shadow(${t("1px")} 0 red)}`);
  assert.equal(tokenShadows(".k{transform:translate(3px,3px);box-shadow:0 0 0 red}"), `.k{transform:translate(calc(3px * var(--shadow-x, 0)), calc(3px * var(--shadow-y, 1)));box-shadow:0 0 0 red}`);
  assert.equal(tokenShadows(".k{transform:translate(3px,3px)}"), ".k{transform:translate(3px,3px)}", "no shadow in the rule: a plain move");
  // Rings, glows and bevels have no direction; sideways, up and unequal offsets can't be expressed.
  for (const keep of ["0 0 0 3px #f00", "0 0 40px #f008", "inset 0 -2px 0 red"]) assert.equal(layerToToken(keep), keep);
  for (const drop of ["4px 0 0 red", "0 -3px 0 red", "2px 5px 0 red"]) assert.equal(layerToToken(drop), null);
  assert.equal(tokenShadows(".a{box-shadow:4px 0 0 red,0 0 9px blue}"), ".a{box-shadow:0 0 9px blue}");
  assert.equal(tokenShadows(".a{box-shadow:4px 0 0 red}"), ".a{box-shadow:none}");
  // The check sees what the rewrite leaves alone, and nothing it wrote.
  const src = ".a{box-shadow:6px 6px 0 red}.b{box-shadow:0 var(--py) 0 red}.c{box-shadow:0 0 0 2px red}";
  assert.deepEqual(hardShadows(src).map((h) => h.text), ["6px 6px 0 red", "0 var(--py) 0 red"]);
  assert.deepEqual(hardShadows(tokenShadows(src)), [], "a var() depth straight down is a depth too");
});
