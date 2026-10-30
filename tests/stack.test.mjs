// Stack it's data (site/demos/stack/data.ts): every brick wears its real name, its catalog colour
// and its size measured on this build (and so does the poster); a stack's app and stars.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS as CATALOG } from "../site/bricks.mjs";
import { APPS, BRICKS, DEMO, HELLO, VERDICT, build, bytesLabel, kb } from "../site/demos/stack/data.ts";

const rows = BRICKS.split(",").map((s) => s.split(" "));
const sizeName = (id) => (id === "kernel" ? "fizlet (kernel)" : id === "ui" ? "fizlet/ui (js)" : `fizlet/${id}`);

test("stack: each brick's bytes are its measured gzip size, its colour its catalog role", async () => {
  const sizes = Object.fromEntries((await measure()).map((m) => [m.name, m.gzip]));
  const roles = Object.fromEntries(CATALOG.map((b) => [b.id, b.role]));
  assert.equal(rows.length, 20);
  for (const [id, role, bytes] of rows) {
    assert.equal(+bytes, sizes[sizeName(id)], `${id}: ${bytes} B, measured ${sizes[sizeName(id)]} B`);
    assert.equal(role, roles[id], `${id}: role ${role}, catalog ${roles[id]}`);
  }
});

test("stack: the poster wears the same names, sizes and colours", () => {
  const html = readFileSync("site/gallery/stages/stack-it.html", "utf8");
  const shown = [...html.matchAll(/--c:var\(--k-(\w+)\)"><b>([A-Z-]+)<\/b><span>([\d,]+ B)<\/span>/g)];
  assert.ok(shown.length >= 10, "a table of bricks");
  for (const [, role, name, label] of shown) {
    const row = rows.find((r) => r[0] === name.toLowerCase());
    assert.ok(row, name);
    assert.deepEqual([role, label], [row[1], bytesLabel(+row[2])], name);
  }
  const stacked = [...html.matchAll(/sk-on[^>]*>.*?<b>([A-Z-]+)<\/b>/g)].map((m) => m[1].toLowerCase());
  const sum = stacked.reduce((a, id) => a + +rows.find((r) => r[0] === id)[2], 0);
  assert.ok(html.includes(`>${kb(sum)}</b>`), `the poster's stack weighs ${kb(sum)}`);
});

const sum = (...ids) => ids.reduce((a, id) => a + +rows.find((r) => r[0] === id)[2], 0);
const make = (...ids) => build(ids, ids.map((id) => +rows.find((r) => r[0] === id)[2]));

test("stack: what a stack makes, and its stars", () => {
  const intro = DEMO.map((i) => rows[i][0]);
  assert.deepEqual(intro, ["kernel", "input", "sprite", "fx", "hud"]);
  assert.deepEqual(make(...intro), { app: 0, stars: 5, bytes: sum(...intro), dead: 0 }, "the intro: a shooter, five stars");
  assert.equal(APPS[0][0], "SHOOTER");
  assert.deepEqual(make("kernel", "timeline", "camera", "fx"), { app: 1, stars: 5, bytes: sum("kernel", "timeline", "camera", "fx"), dead: 0 }, "a movie");
  assert.equal(make("kernel", "grid", "rules", "match").app, 2, "a board game");
  assert.deepEqual(make("kernel"), { app: HELLO, stars: 3, bytes: sum("kernel"), dead: 0 }, "the kernel alone: hello (runs, no dead weight, light)");
  assert.deepEqual(make("kernel", "input", "grid"), { app: 0, stars: 3, bytes: sum("kernel", "input", "grid"), dead: 1 }, "a tie goes to the first app; the other brick is dead weight");
  assert.deepEqual(make("input", "sprite", "fx"), { app: -1, stars: 0, bytes: sum("input", "sprite", "fx"), dead: 0 }, "no kernel, no app");
  assert.equal(make("kernel", "grid", "board-page", "presence", "ui", "match", "perf").stars < 5, true, "heavy stacks lose the size star");
  assert.equal(VERDICT[5], "SHIP IT");
  assert.equal(kb(10240), "10.0 KB");
});
