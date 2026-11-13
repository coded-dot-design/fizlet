// Mirror Maze's puzzles (site/gallery/pieces/mirror/model.ts), headless on @fzlt/core/beam: every
// board starts dark (no target lit) and is solvable at its par, which a brute force over every
// mirror state confirms is the fewest turns (no state with fewer turns lights every target), and
// turning the solving looks from the start, one 45° tap at a time, lights the board in exactly par
// moves; the boards get no easier toward the end; a turn re-runs the light, four turns bring a
// mirror back; and turning mirrors and re-running the light allocates nothing (young-generation
// GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/mirror/model.ts");
const { LEVELS, PARS } = M;

test("mirror maze: every board starts dark and is solvable at its par (brute force over every mirror state)", () => {
  assert.equal(LEVELS.length, 5);
  for (let l = 0; l < LEVELS.length; l++) {
    const L = LEVELS[l], n = L.mirror.length, bd = M.load(l);
    assert.ok(n >= 1 && n <= 4, `board ${l + 1}: one to four mirrors`);
    assert.equal(M.lit(bd), 0, `board ${l + 1}: nothing lit at the start`);
    // Every state: the fewest turns among those that light every target.
    let best = Infinity;
    for (let s = 0; s < 1 << (2 * n); s++) {
      let cost = 0;
      for (let i = 0; i < n; i++) M.setLook(bd, i, (s >> (2 * i)) & 3), (cost += (((s >> (2 * i)) & 3) - L.mirror[i][2] + 4) & 3);
      if (M.solved(bd)) best = Math.min(best, cost);
    }
    assert.equal(PARS[l], best, `board ${l + 1}: par is the fewest turns`);
    assert.ok(PARS[l] >= 1, `board ${l + 1}: needs at least one turn`);
    // Play it: from the start, tap the solving looks in, one 45° turn at a time.
    const want = new Uint8Array(8), b2 = M.load(l);
    M.par(l, M.load(l), want);
    for (let i = 0; i < n; i++) while (b2.look[i] !== want[i]) assert.equal(M.solved(b2), false, `board ${l + 1}: not lit before par`), M.turn(b2, i);
    assert.equal(M.solved(b2), true, `board ${l + 1}: lit`);
    assert.equal(b2.moves, PARS[l], `board ${l + 1}: in par moves`);
  }
  assert.ok(PARS[0] < PARS[1] && PARS[1] < PARS[2], `the first boards ramp up: ${PARS}`);
  assert.ok(LEVELS.slice(3).every((L) => L.split.length > 0), "the last boards split the light");
});

test("mirror maze: a turn re-runs the light; four turns bring a mirror back", () => {
  const bd = M.load(1), start = M.lit(bd), ver = bd.b.ver;
  M.turn(bd, 0);
  assert.ok(bd.b.ver > ver, "the light ran again");
  for (let k = 0; k < 3; k++) M.turn(bd, 0);
  assert.equal(bd.look[0], LEVELS[1].mirror[0][2]);
  assert.equal(M.lit(bd), start);
  assert.equal(bd.moves, 4);
});

test("mirror maze: turning mirrors and re-running the light allocates nothing", async () => {
  const bd = M.load(4);
  const work = (n) => {
    for (let k = 0; k < n; k++) M.turn(bd, k & 3), M.solved(bd);
  };
  work(2000);
  globalThis.gc?.();
  const n = await minorGCs(() => work(20000));
  assert.ok(n <= 1, `young-generation GCs over 20,000 turns: ${n}`);
});
