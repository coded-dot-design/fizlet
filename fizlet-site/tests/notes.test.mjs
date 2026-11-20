// Notes and news (W2-notes): the collections' data renders the legacy pages' own head facts, and the
// changelog's Markdown reads as the legacy build read it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { byDate, inline, longDate, notePath, noteMeta, notesIndexMeta } from "../src/lib/notes.ts";
import { highlights, md, parse, releaseMeta, releasePath, newsIndexMeta } from "../src/lib/releases.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const routes = new Map(json("src/data/legacy/routes.json").map((r) => [r.path, r]));
const notes = readdirSync("src/data/legacy/notes").map((f) => json(`src/data/legacy/notes/${f}`)).sort(byDate);
const releases = json("src/data/legacy/releases.json");

test("every note and release is a legacy route, with the legacy title and description", () => {
  const metas = [notesIndexMeta(notes), ...notes.map(noteMeta), newsIndexMeta(releases), ...releases.map(releaseMeta)];
  const legacy = [...routes.values()].filter((r) => ["note", "notes-index", "release", "news-index"].includes(r.type));
  assert.equal(metas.length, legacy.length);
  for (const m of metas) {
    const r = routes.get(m.path);
    assert.ok(r, `/${m.path} is not a legacy route`);
    assert.equal(m.title, r.title, `/${m.path} title`);
    assert.equal(m.description, r.description, `/${m.path} description`);
  }
});

test("releases: newest first, each once, at /news/<version>/", () => {
  assert.deepEqual(releases.map((r) => r.order), releases.map((_, i) => i));
  assert.equal(new Set(releases.map((r) => r.version)).size, releases.length);
  assert.equal(releasePath(releases[0]), `news/${json("src/data/legacy/site.json").version}/`);
  for (const n of notes) assert.equal(notePath(n), `notes/${n.slug}/`);
});

test("changelog Markdown: nested lists, repo links, external links marked", () => {
  const blocks = parse("Intro line\ncontinued.\n\n### Added\n- **One:** first.\n  - nested\n    wrapped\n- two. More.");
  assert.deepEqual(blocks, [{ p: "Intro line continued." }, { h: "Added" }, { ul: [{ text: "**One:** first.", ul: [{ text: "nested wrapped", ul: null }] }, { text: "two. More.", ul: null }] }]);
  assert.deepEqual(highlights(blocks), ["One", "two"]);
  assert.equal(md("see [x](src/a.ts) and https://fizlet.com/"), 'see <a href="https://github.com/coded-dot-design/fizlet/blob/main/src/a.ts">x ↗</a> and <a href="https://fizlet.com/">https://fizlet.com/ ↗</a>');
});

test("note inline text: escaped, code kept verbatim, site links from the root", () => {
  assert.equal(inline("**a** *b* `<c>` [d](/bricks/)"), '<b>a</b> <em>b</em> <code>&lt;c&gt;</code> <a href="/bricks/">d</a>');
  assert.equal(longDate("2026-11-20"), "20 November 2026");
});
