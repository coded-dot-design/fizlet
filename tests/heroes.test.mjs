// The heroes' data and vendoring (node): the allow-list is the only source of /heroes/, every
// vendored file matches what scripts/heroes-vendor.mjs wrote (no hand edits), and the vendor
// helpers do what they say (a balanced section, absolute links, shadows on the kit's tokens).
import { test } from "node:test";
import assert from "node:assert/strict";
import { heroes } from "../scripts/heroes.mjs";
import { absolute, element, shadows } from "../scripts/heroes-vendor.mjs";
import { entries } from "../scripts/gallery.mjs";

test("the heroes: pinned, vendored unchanged, never a gallery id", () => {
  const list = heroes(); // throws on a hand-edited vendored file or a pin that does not match
  assert.deepEqual(list.map((h) => h.id), ["dom-battlefield", "battlefield-blitz", "dom-virus", "dom-virus-cartridges"]);
  const ids = new Set(entries().map((e) => e.id));
  for (const h of list) assert.ok(!ids.has(h.id), `${h.id} is not a gallery entry`);
  for (const h of list) assert.match(h.game, /^https:\/\//);
});

test("no gallery entry is a hero any more (the heroes are the games' own)", () => {
  assert.deepEqual(entries().filter((e) => e.kind === "hero").map((e) => e.id), []);
});

test("element: the balanced section", () => {
  const html = '<main><section class="a"><section>in</section><p>x</p></section><section>b</section></main>';
  assert.equal(element(html, '<section class="a"'), '<section class="a"><section>in</section><p>x</p></section>');
});

test("absolute: links to the game's domain; in-page sprite refs stay", () => {
  assert.equal(absolute('<a href="/play/">p</a><a href="#how">h</a><use href="#bf-hull"/>', "https://g.example/"), '<a href="https://g.example/play/">p</a><a href="https://g.example/#how">h</a><use href="#bf-hull"/>');
});

test("shadows: hard offsets on --shadow-x / --shadow-y (depth × token); glows, insets and zero stay", () => {
  assert.equal(shadows(".a{box-shadow:3px 3px 0 var(--ink)}"), ".a{box-shadow:calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 var(--ink)}");
  assert.equal(shadows(".a{box-shadow:0 0 0 1px var(--ink),inset 0 -2px 0 red,0 0 12px blue}"), ".a{box-shadow:0 0 0 1px var(--ink),inset 0 -2px 0 red,0 0 12px blue}");
  assert.equal(shadows(".a{box-shadow:inset 0 -4px 0 red, 0 3px 0 var(--ink)}"), ".a{box-shadow:inset 0 -4px 0 red,calc(3px * var(--shadow-x, 0)) calc(3px * var(--shadow-y, 1)) 0 var(--ink)}");
});
