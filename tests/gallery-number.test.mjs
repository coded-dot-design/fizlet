// Gallery numbers are given at land time (scripts/gallery-number.mjs): PRs never pick one, existing
// numbers never move, a shared number goes to the entry that landed first, and the build refuses
// shared numbers by name.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignNumbers, duplicateMessage, duplicateNumbers } from "../scripts/gallery-number.mjs";
import { entries } from "../scripts/gallery.mjs";

const e = (id, over = {}) => ({ id, approved: "2026-10-30", ...over });

test("existing numbers are kept; new live entries take the next ones by approval date, then merge order, then id", () => {
  const list = [e("old", { no: 46 }), e("late", { approved: "2026-10-31" }), e("b"), e("a"), e("pending", { approved: undefined })];
  assert.deepEqual(assignNumbers(list), { a: 47, b: 48, late: 49 }, "same day: id order without a merge order");
  assert.deepEqual(assignNumbers(list, { arrival: { b: 0, a: 1 } }), { b: 47, a: 48, late: 49 }, "same day: merge order first");
  assert.deepEqual(assignNumbers([e("x", { no: 3 })]), {}, "nothing to give");
  assert.deepEqual(assignNumbers([e("x")], { reserved: [50] }), { x: 51 }, "a number a pulled entry held is never given again");
  assert.deepEqual(assignNumbers([]), {});
});

test("three PRs that each took #047: the first to land keeps it, the others are numbered again", () => {
  const list = [e("lab-pipeline", { no: 46 }), e("virus", { no: 47 }), e("heroes", { no: 47 }), e("pkg", { no: 47 })];
  const arrival = { "lab-pipeline": 0, heroes: 1, virus: 2, pkg: 3 };
  assert.deepEqual(duplicateNumbers(list, arrival), [{ no: 47, ids: ["heroes", "virus", "pkg"] }]);
  assert.deepEqual(assignNumbers(list, { arrival }), { virus: 48, pkg: 49 });
  assert.match(duplicateMessage("gallery/entries", duplicateNumbers(list, arrival)), /#047 is claimed by heroes, virus, pkg.*fe\.mjs anim number --fizlet <checkout> --write/);
});

test("the build: a live entry without a number shows the one land gives; shared numbers fail by name", () => {
  const d = mkdtempSync(join(tmpdir(), "gal-no-"));
  try {
    const base = { kind: "micro", theme: "everyday", date: "2026-10-30", prompt: "p", title: "t", author: "chris-cooley", recipe: "burst", bricks: [], made: "fe anim", module: "anims/x.ts", export: "mount" };
    const put = (x) => writeFileSync(join(d, `${x.id}.json`), JSON.stringify({ ...base, ...x }));
    const opts = { dir: d, themeIds: ["everyday"], people: { "chris-cooley": { name: "Chris Cooley" } } };
    put({ id: "a", no: 1, approved: "2026-10-29" });
    put({ id: "b", approved: "2026-10-30" });
    put({ id: "c" });
    const got = Object.fromEntries(entries(opts).map((x) => [x.id, x.no]));
    assert.deepEqual(got, { a: 1, b: 2, c: undefined }, "pending: no number until approved and landed");
    put({ id: "c", no: 1 });
    assert.throws(() => entries(opts), /#001 is claimed by a, c/);
    put({ id: "c", no: 0 });
    assert.throws(() => entries(opts), /c\.json: no is a whole number from 1/);
    put({ id: "c", archived: true });
    assert.throws(() => entries(opts), /c\.json: missing no/, "an archived entry keeps its own number");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
