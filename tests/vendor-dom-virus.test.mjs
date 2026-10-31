// The vendored domvirus.com pieces (site/vendor/dom-virus/) are one source: every file matches the
// sha256 that scripts/vendor-dom-virus.mjs recorded at the pinned commit (no hand edits), links are
// inert, and the gallery stages pull them in by name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check, PIECES } from "../scripts/vendor-dom-virus.mjs";
import { vendorIncludes } from "../scripts/gallery.mjs";

test("site/vendor/dom-virus matches ORIGIN.json at the pin", () => assert.deepEqual(check(), []));

test("a stage's vendor include expands to the piece's stylesheet and markup", () => {
  for (const p of PIECES) {
    const html = vendorIncludes(`<div><!-- vendor: dom-virus/${p.id} --></div>`);
    assert.ok(html.includes(`@scope ([data-dv="${p.id}"])`) && html.includes(`<div data-dv="${p.id}"`), p.id);
    assert.ok(!html.includes("Vendored from"), `${p.id}: the provenance comment stays in the file`);
    assert.ok(readFileSync(`site/gallery/stages/dv-${p.id}.html`, "utf8").includes(`<!-- vendor: dom-virus/${p.id} -->`), `${p.id}: its stage pulls it in`);
  }
  assert.throws(() => vendorIncludes("<!-- vendor: dom-virus/nope -->"), /missing/);
});
