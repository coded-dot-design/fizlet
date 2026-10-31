// The gallery's data model (scripts/gallery.mjs) and search (site/gallery/search.ts): entries,
// themes and contributors are data files, checked; pages of PAGE_SIZE; theme sections; the index.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contributors, entries, galleryIndex, isLive, galleryPath, paginate, PAGE_SIZE, sections, themes } from "../scripts/gallery.mjs";
import { search } from "../site/gallery/search.ts";

const THEMES = [{ id: "halloween", title: "Halloween", order: 1 }, { id: "everyday", title: "Everyday", order: 99 }];
const fake = (n, over = {}) => ({ no: n, id: `e${n}`, kind: "micro", theme: n % 3 ? "everyday" : "halloween", author: "chris-cooley", date: `2026-10-${String(1 + (n % 28)).padStart(2, "0")}`, title: `Entry ${n}`, prompt: `prompt ${n}`, ...over });

test("the repo's gallery data: every entry has a known kind, theme and author", () => {
  const T = themes(), P = contributors(), E = entries();
  assert.ok(T.some((t) => t.id === "halloween") && T.some((t) => t.id === "everyday"));
  assert.ok(P["chris-cooley"], "the owner's profile");
  for (const e of E) {
    assert.ok(["hero", "micro"].includes(e.kind), e.id);
    assert.ok(T.some((t) => t.id === e.theme), e.id);
    assert.ok(P[e.author], e.id);
  }
});

test("entries: a bad kind, theme or author fails with the file to add", () => {
  const d = mkdtempSync(join(tmpdir(), "gal-"));
  const people = { "chris-cooley": { name: "Chris Cooley" } }, themeIds = ["everyday"];
  const put = (e) => (mkdirSync(d, { recursive: true }), writeFileSync(join(d, `${e.id}.json`), JSON.stringify(e)));
  const base = { recipe: "burst", bricks: [], made: "fe anim", module: "anims/x.ts", export: "mount" };
  put({ ...fake(1, { theme: "everyday" }), ...base });
  assert.equal(entries({ dir: d, themeIds, people }).length, 1);
  put({ ...fake(1, { theme: "spooky" }), ...base });
  assert.throws(() => entries({ dir: d, themeIds, people }), /theme spooky has no site\/gallery\/themes\/spooky\.json/);
  put({ ...fake(1, { theme: "everyday", author: "someone" }), ...base });
  assert.throws(() => entries({ dir: d, themeIds, people }), /author someone has no site\/contributors\/someone\.json/);
  put({ ...fake(1, { theme: "everyday", kind: "giant" }), ...base });
  assert.throws(() => entries({ dir: d, themeIds, people }), /kind is "hero" or "micro"/);
});

test("the owner's gate: an entry is live only once approved; pending ones are checked but never listed", () => {
  const d = mkdtempSync(join(tmpdir(), "gal-gate-"));
  const people = { "chris-cooley": { name: "Chris Cooley" } }, themeIds = ["everyday"];
  const base = { recipe: "burst", bricks: [], made: "fe anim", module: "anims/x.ts", export: "mount", theme: "everyday" };
  const put = (e) => writeFileSync(join(d, `${e.id}.json`), JSON.stringify(e));
  put({ ...fake(1), ...base, approved: "2026-10-30" });
  put({ ...fake(2), ...base });
  const all = entries({ dir: d, themeIds, people });
  assert.deepEqual(all.filter(isLive).map((e) => e.id), ["e1"], "approved: live");
  assert.deepEqual(all.filter((e) => !isLive(e)).map((e) => e.id), ["e2"], "no approved: pending, off the site");
  put({ ...fake(2), ...base, approved: true });
  assert.throws(() => entries({ dir: d, themeIds, people }), /approved is the date the owner approved it/);
});

test("paginate: PAGE_SIZE a page at gallery/, gallery/page/2/ …; always one page", () => {
  assert.equal(PAGE_SIZE, 24);
  assert.deepEqual(paginate([]).map((p) => p.path), ["gallery/"]);
  const list = Array.from({ length: 50 }, (_, i) => fake(i + 1));
  const pages = paginate(list);
  assert.deepEqual(pages.map((p) => [p.n, p.path, p.entries.length]), [[1, "gallery/", 24], [2, "gallery/page/2/", 24], [3, "gallery/page/3/", 2]]);
  assert.deepEqual(pages.flatMap((p) => p.entries), list, "every entry once, in order");
  assert.equal(galleryPath(7), "gallery/page/7/");
});

test("sections: theme order, newest first inside each, empty themes left out", () => {
  const list = [fake(3), fake(2), fake(1)]; // e3 halloween, e2 + e1 everyday
  assert.deepEqual(sections(list, THEMES).map((s) => [s.theme.id, s.entries.map((e) => e.id)]), [["halloween", ["e3"]], ["everyday", ["e2", "e1"]]]);
  assert.deepEqual(sections([fake(1)], THEMES).map((s) => s.theme.id), ["everyday"]);
});

test("the index: each row on its page, its author's name and sizes (live + loader)", () => {
  const list = Array.from({ length: 30 }, (_, i) => ({ ...fake(30 - i), size: 1000 + i }));
  const rows = galleryIndex(list, { pages: paginate(list), people: { "chris-cooley": { name: "Chris Cooley" } }, themeList: THEMES, loader: 500 });
  assert.equal(rows[0].url, `gallery/#${list[0].id}`);
  assert.equal(rows[29].url, `gallery/page/2/#${list[29].id}`);
  assert.deepEqual(rows[0].sizes, { live: 1000, total: 1500 });
  assert.equal(rows[0].authorName, "Chris Cooley");
});

test("search: every word, any case and order, over title, prompt, theme and author", () => {
  const rows = [
    { id: "a", title: "Pumpkin pop", prompt: "an orange pumpkin pops", theme: "halloween", themeTitle: "Halloween", author: "chris-cooley", authorName: "Chris Cooley", kind: "hero" },
    { id: "b", title: "Snow", prompt: "snow falls softly", theme: "christmas", themeTitle: "Christmas", author: "someone", authorName: "Zoë Example", kind: "micro" },
  ];
  const ids = (q) => search(rows, q).map((r) => r.id);
  assert.deepEqual(ids(""), []);
  assert.deepEqual(ids("PUMPKIN"), ["a"]);
  assert.deepEqual(ids("pops orange"), ["a"]);
  assert.deepEqual(ids("christmas"), ["b"]);
  assert.deepEqual(ids("zoe"), ["b"], "accents fold");
  assert.deepEqual(ids("chris halloween"), ["a"]);
  assert.deepEqual(ids("hero"), ["a"]);
  assert.deepEqual(ids("pumpkin snow"), []);
});

test("an own stage: its markup comes from site/gallery/stages/<id>.html, and is required", () => {
  const dir = mkdtempSync(join(tmpdir(), "gal-own-"));
  const e = { no: 1, id: "zz-own-stage-test", kind: "micro", theme: "everyday", date: "2026-10-30", prompt: "p", title: "t", author: "chris-cooley", recipe: "hand-built", bricks: [], made: "by hand", module: "m.ts", export: "mount", stage: "own" };
  writeFileSync(join(dir, `${e.id}.json`), JSON.stringify(e));
  assert.throws(() => entries({ dir, themeIds: ["everyday"] }), /stage "own" needs site\/gallery\/stages\/zz-own-stage-test\.html/);
});

test("card stickers: one status (NEW for a week from its date, then APPROVED), HERO, TOO BIG TO WIN, WINNER", async () => {
  const { cardStickers, isNew, NEW_DAYS } = await import("../site/pages/gallery.mjs");
  const e = { date: "2026-10-30", approved: "2026-10-30", kind: "micro", size: 10_934 };
  const texts = (html) => [...html.matchAll(/class="gal-sticker gal-sticker-([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(NEW_DAYS, 7);
  assert.ok(isNew(e, "2026-10-30") && isNew(e, "2026-11-05"), "new for its first week");
  assert.ok(!isNew(e, "2026-11-06") && !isNew(e, "2026-10-29") && !isNew(e, undefined), "not before its date, after the week or without a build date");
  assert.deepEqual(texts(cardStickers(e, { today: "2026-10-31" })), ["new"]);
  assert.deepEqual(texts(cardStickers(e, { today: "2026-11-20" })), ["ok"]);
  assert.match(cardStickers(e, { today: "2026-11-20" }), /aria-label="Approved: approved by the owner on 2026-10-30"/);
  assert.deepEqual(texts(cardStickers({ ...e, kind: "hero" }, { today: "2026-10-31", winner: true, tooBig: true })), ["win", "new", "hero", "big"]);
  assert.match(cardStickers(e, { tooBig: true }), /Too big to win: 10,934 B live, over the contest's 10,240 B cap/);
  assert.equal(cardStickers({ ...e, approved: undefined, date: "2020-01-01" }, { today: "2026-10-31" }), "", "no approval, not new (an archived entry): no status sticker");
});
