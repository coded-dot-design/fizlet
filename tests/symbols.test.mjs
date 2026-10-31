// The periodic table's data (site/bricks.mjs): every brick, shipped and planned, has exactly one
// two-letter symbol, unique, lowercase, and the one the rule gives; one number (the kernel is 1, no
// gaps, no repeats); and one family from FAMILIES, with every family in use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRICKS, PLANNED, FAMILIES } from "../site/bricks.mjs";

const all = [...BRICKS.map((b) => ({ id: b.id, ...b })), ...PLANNED.map((p) => ({ id: p.name.split("/").pop(), ...p }))];

// Module tiles (a brick's second module with its own `sym`, e.g. presence/check): their symbols count
// for uniqueness too; the rule for them is the brick's first letter, then the module's.
const parts = BRICKS.flatMap((b) => b.modules.slice(1).filter((m) => m.sym).map((m) => ({ id: m.name, sym: m.sym, brick: b, part: m.name.split("/").pop() })));

test("every brick and every planned brick has exactly one two-letter symbol, unique", () => {
  for (const b of [...all, ...parts]) {
    assert.equal(typeof b.sym, "string", `${b.id}: a symbol`);
    assert.match(b.sym, /^[a-z]{2}$/, `${b.id}: two lowercase letters (${b.sym})`);
  }
  const seen = new Map();
  for (const b of [...all, ...parts]) {
    assert.ok(!seen.has(b.sym), `${b.id} and ${seen.get(b.sym)} share ${b.sym}`);
    seen.set(b.sym, b.id);
  }
  assert.equal(seen.size, BRICKS.length + PLANNED.length + parts.length);
  for (const p of parts) assert.equal(p.sym, p.brick.id[0] + p.part[0], `${p.id}: its brick's first letter, then its own`);
});

test("each symbol is the rule's: first letter, next consonant; on a clash the lower number keeps it", () => {
  const taken = new Set();
  for (const b of [...all].sort((a, c) => a.no - c.no)) {
    const w = b.id.replace(/-/g, "");
    const next = [...w.slice(1)].filter((c) => !"aeiou".includes(c) && c !== w[0]).map((c) => w[0] + c);
    const want = next.find((s) => !taken.has(s)) ?? [...w.slice(1)].map((c) => w[0] + c).find((s) => !taken.has(s));
    assert.equal(b.sym, want, `${b.id}: the rule gives ${want}`);
    taken.add(want);
  }
});

test("numbers: the kernel is 1, then 2…N with no gaps or repeats; planned after shipped", () => {
  assert.equal(BRICKS.find((b) => b.id === "kernel").no, 1);
  const nos = all.map((b) => b.no).sort((a, b) => a - b);
  assert.deepEqual(nos, all.map((_, i) => i + 1));
  const lastShipped = Math.max(...BRICKS.map((b) => b.no));
  for (const p of PLANNED) assert.ok(p.no > lastShipped, `${p.name} numbered after every shipped brick`);
});

test("families: each brick in one known family; every family has a brick", () => {
  const ids = FAMILIES.map((f) => f.id);
  for (const b of all) assert.ok(ids.includes(b.family), `${b.id}: family ${b.family}`);
  for (const f of ids) assert.ok(all.some((b) => b.family === f), `family ${f} is used`);
  assert.deepEqual(all.filter((b) => b.family === "kernel").map((b) => b.id), ["kernel"], "the kernel stands alone");
});
