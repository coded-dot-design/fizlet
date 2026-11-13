// Salvo Bay's game (site/gallery/pieces/salvo/model.ts), headless: placement is checked (in the bay,
// no overlap, a ship moves without tripping on itself), a shot is refused out of turn, off the bay or
// twice, misses and hits land where the fleet is, the last hit on a ship sinks it (all its cells
// marked), the last ship sunk ends the match with its winner; the same seed plays the same game;
// the bot never fires at a cell twice and always finishes its games; and a whole bot-vs-bot match
// on a reused match object allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/salvo/model.ts");
const { seeded } = await import("../src/kernel/random.ts");
const { N, FLEET, PLACE, BATTLE, OVER, MISS, HIT, SUNK } = M;

test("salvo bay: placement stays in the bay, never overlaps, and a ship can move over its own cells", () => {
  const m = M.newMatch(1);
  assert.equal(M.place(m, 0, 0, 5, 0, 0), false, "a 4-long ship along x from column 5 runs off the bay");
  assert.equal(M.place(m, 0, 0, 0, 5, 1), false, "and along y from row 5");
  assert.equal(M.place(m, 0, 0, -1, 0, 0), false, "off the left edge");
  assert.equal(M.place(m, 0, 0, 0, 0, 0), true);
  assert.deepEqual(Array.from(m.sides[0].grid.slice(0, 5)), [0, 0, 0, 0, -1]);
  assert.equal(M.place(m, 0, 1, 2, 0, 1), false, "crossing the Whale");
  assert.equal(M.place(m, 0, 1, 4, 0, 1), true);
  assert.equal(M.place(m, 0, 0, 1, 0, 0), false, "moving the Whale onto the Heron");
  assert.equal(M.place(m, 0, 0, 0, 1, 0), true, "moving the Whale down a row (over nothing)");
  assert.equal(M.place(m, 0, 0, 0, 1, 0), true, "onto its own cells");
  assert.equal(m.sides[0].grid[0], -1, "its old cells are free");
  M.unplace(m, 0, 0);
  assert.equal(m.sides[0].sx[0], -1);
  assert.equal(m.sides[0].grid.indexOf(0), -1, "unplaced: off the bay");
  assert.equal(M.begin(m), false, "no battle before both fleets are out");
});

test("salvo bay: a random fleet is legal, and the same seed gives the same fleet", () => {
  for (let s = 1; s < 200; s++) {
    const m = M.newMatch(s);
    M.randomFleet(m, 0, seeded(s));
    assert.ok(M.ready(m, 0), `seed ${s}: every ship placed`);
    const g = m.sides[0].grid;
    for (let i = 0; i < 4; i++) assert.equal(g.reduce((n, v) => n + (v === i ? 1 : 0), 0), FLEET[i], `seed ${s}: ship ${i} covers its length`);
    const again = M.newMatch(s);
    M.randomFleet(again, 0, seeded(s));
    assert.deepEqual(Array.from(again.sides[0].grid), Array.from(g));
  }
});

test("salvo bay: firing: turns, refusals, misses, hits, sinking and the win", () => {
  const m = M.newMatch(7);
  // The enemy fleet in the top rows, along x: Whale row 0, Heron row 1, Otter row 2, Minnow row 3.
  for (let i = 0; i < 4; i++) M.place(m, 1, i, 0, i, 0), M.place(m, 0, i, 0, i + 4, 0);
  assert.equal(M.fire(m, 0, 0, 0), 0, "no shots during placement");
  assert.ok(M.begin(m));
  assert.equal(m.phase, BATTLE);
  assert.equal(M.fire(m, 1, 0, 0), 0, "not the enemy's turn");
  assert.equal(M.fire(m, 0, 8, 0), 0, "off the bay");
  assert.equal(M.fire(m, 0, 7, 7), MISS);
  assert.equal(m.turn, 1, "a miss passes the turn");
  assert.equal(m.ship, -1);
  assert.equal(M.fire(m, 1, 7, 7), MISS);
  assert.equal(M.fire(m, 0, 7, 7), 0, "the same cell twice is refused");
  assert.equal(m.turn, 0, "and keeps the turn");
  assert.equal(M.fire(m, 0, 0, 3), HIT);
  assert.equal(m.ship, 3, "the Minnow");
  assert.equal(m.sides[1].shots[3 * N], HIT);
  M.fire(m, 1, 6, 7);
  assert.equal(M.fire(m, 0, 1, 3), SUNK, "its second cell sinks the Minnow");
  assert.equal(m.sides[1].sunk[3], 1);
  assert.deepEqual([m.sides[1].shots[3 * N], m.sides[1].shots[3 * N + 1]], [SUNK, SUNK], "both cells marked sunk");
  assert.equal(M.shipsLeft(m, 1), 3);
  // Sink the rest; the bot keeps missing on row 7.
  const water = () => { for (let c = 63; c >= 0; c--) if (m.sides[0].grid[c] < 0 && !m.sides[0].shots[c]) return c; };
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < FLEET[y]; x++) {
      if (m.turn === 1) { const c = water(); assert.equal(M.fire(m, 1, c & 7, c >> 3), MISS); }
      const r = M.fire(m, 0, x, y);
      assert.equal(r, x === FLEET[y] - 1 ? SUNK : HIT, `cell ${x},${y}`);
    }
  assert.equal(m.phase, OVER);
  assert.equal(m.winner, 0);
  assert.equal(M.fire(m, 1, 0, 7), 0, "no shots after the match");
  assert.deepEqual(Array.from(m.sides[0].n), [13, 12], "13 shots, 12 hits");
});

/** A whole bot-vs-bot match on `m` (reused); returns the shots fired. */
function botMatch(m, seed, rnd, onShot) {
  M.resetMatch(m, seed);
  M.randomFleet(m, 0, rnd);
  M.randomFleet(m, 1, rnd);
  M.begin(m);
  let shots = 0;
  while (m.phase === BATTLE && shots < 200) {
    const by = m.turn, c = M.botPick(m, by, rnd);
    onShot?.(by, c);
    M.fire(m, by, c & 7, c >> 3);
    shots++;
  }
  return shots;
}

test("salvo bay: the bot never fires at a cell twice, and always finishes the match", () => {
  const m = M.newMatch(1), rnd = seeded(99);
  let total = 0;
  for (let s = 1; s <= 300; s++) {
    const seen = [new Set(), new Set()];
    const shots = botMatch(m, s, rnd, (by, c) => {
      assert.ok(c >= 0 && c < 64, `seed ${s}: a cell on the bay`);
      assert.ok(!seen[by].has(c), `seed ${s}: side ${by} fired at ${c} twice`);
      seen[by].add(c);
    });
    assert.equal(m.phase, OVER, `seed ${s}: the match ends`);
    assert.equal(M.shipsLeft(m, 1 - m.winner), 0);
    total += shots;
  }
  // Hunting on a checkerboard then following hits: well under the 128 a blind sweep can take.
  assert.ok(total / 300 < 100, `average shots per match ${total / 300}`);
});

test("salvo bay: the same seed and the same shots play the same match", () => {
  const a = M.newMatch(1), b = M.newMatch(1);
  botMatch(a, 42, seeded(5));
  botMatch(b, 42, seeded(5));
  assert.deepEqual([a.winner, Array.from(a.sides[0].shots), Array.from(a.sides[1].shots)], [b.winner, Array.from(b.sides[0].shots), Array.from(b.sides[1].shots)]);
});

test("salvo bay: a whole match (placement, the bot's picks, every shot) allocates nothing", async () => {
  const m = M.newMatch(1), rnd = seeded(3);
  const work = (n) => {
    for (let k = 0; k < n; k++) botMatch(m, k + 1, rnd);
  };
  work(200);
  globalThis.gc?.();
  const n = await minorGCs(() => work(3000));
  assert.ok(n <= 1, `young-generation GCs over 3,000 matches: ${n}`);
});
