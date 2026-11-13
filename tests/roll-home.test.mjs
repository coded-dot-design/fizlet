// Roll Home's game (site/gallery/pieces/roll/model.ts), headless: the die is @fzlt/core/dice's
// roll(seed) for each roll's seed; a move steps, takes a ladder up or a chute down where it lands,
// sends an opponent on the landing space back to the porch (never on the porch itself), takes a
// pawn home on reaching or passing the porch, keeps the turn on a 6 and ends the match when both a
// player's pawns are home; moves out of turn or of a pawn at home are refused; the jumps agree with
// @fzlt/core/track's (the scene's board); the same seed plays the same game; bot-vs-bot games always
// end; and a whole game on a reused match allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/roll/model.ts");
const { roll } = await import("../src/dice.ts");
const { track } = await import("../src/track.ts");
const { seeded } = await import("../src/kernel/random.ts");
const { HOME, ROLL, PICK, OVER, FINISH, LADDER, CHUTE, CAPTURE, AGAIN, WIN, JUMPS, SPACES } = M;

/** Play one turn: roll, then move the pick (or the bot's). Returns what the move did. */
function turn(m, rnd) {
  M.rollDie(m);
  return M.move(m, M.botPick(m, rnd));
}
function game(m, seed, rnd) {
  M.reset(m, seed);
  let n = 0;
  while (m.phase !== OVER && n < 2000) turn(m, rnd), n++;
  return n;
}

test("roll home: each roll is dice's roll(seed) for the match's next seed", () => {
  const m = M.newMatch(9);
  for (let i = 0; i < 40; i++) {
    const s = M.rollSeed(m), v = M.rollDie(m);
    assert.equal(v, roll(s), `roll ${i}`);
    assert.ok(v >= 1 && v <= 6);
    assert.equal(m.phase, PICK);
    assert.equal(M.rollDie(m), 0, "no second roll before the move");
    M.move(m, M.botPick(m, () => 0.5));
    if (m.phase === OVER) break;
  }
});

test("roll home: steps, ladders, chutes, bumps, home, a 6 again, the win", () => {
  const m = M.newMatch(1);
  const at = (pos, turn, die) => (m.pos.set(pos), (m.turn = turn), (m.die = die), (m.phase = PICK));
  // A plain step.
  at([0, 0, 0, 0], 0, 3);
  assert.equal(M.move(m, 0), 0);
  assert.deepEqual([m.pos[0], m.turn, m.phase], [3, 1, ROLL]);
  // A ladder: 1 → 4.
  at([0, 0, 0, 0], 0, 1);
  assert.equal(M.move(m, 0) & LADDER, LADDER);
  assert.equal(m.pos[0], 4);
  assert.deepEqual([m.last.stop, m.last.land], [1, 4]);
  // A chute: 15 → 5.
  at([12, 0, 0, 0], 0, 3);
  assert.equal(M.move(m, 0) & CHUTE, CHUTE);
  assert.equal(m.pos[0], 5);
  // A bump: landing on the bot's pawn sends it to the porch (after the ladder too).
  at([2, 0, 9, 4], 0, 2);
  assert.equal(M.move(m, 0) & CAPTURE, CAPTURE);
  assert.deepEqual(Array.from(m.pos), [4, 0, 9, 0]);
  assert.equal(m.last.sent, 1 << 3);
  // Never on the porch, and never your own.
  at([22, 3, 0, 0], 0, 2);
  assert.equal(M.move(m, 0) & CAPTURE, 0);
  assert.equal(m.pos[0], HOME, "22 + 2 passes the porch: home");
  at([10, 8, 0, 0], 0, 2);
  assert.equal(M.move(m, 1) & CAPTURE, 0, "your own pawn is not bumped");
  // Home: reaching or passing the porch; a 6 keeps the turn.
  at([20, 5, 3, 3], 0, 6);
  const d = M.move(m, 0);
  assert.equal(d & (FINISH | AGAIN), FINISH | AGAIN);
  assert.deepEqual([m.pos[0], m.turn], [HOME, 0]);
  // The win: both home.
  at([HOME, 23, 3, 3], 0, 1);
  assert.equal(M.move(m, 1) & WIN, WIN);
  assert.deepEqual([m.phase, m.winner], [OVER, 0]);
});

test("roll home: moves out of turn, of a pawn at home or before the roll are refused", () => {
  const m = M.newMatch(2);
  assert.equal(M.move(m, 0), -1, "before the roll");
  M.rollDie(m);
  assert.equal(M.move(m, 2), -1, "the bot's pawn on your turn");
  m.pos[1] = HOME;
  assert.equal(M.move(m, 1), -1, "a pawn at home");
  assert.equal(M.choice(m), false, "one pawn out: no choice");
  m.pos[1] = 0;
  assert.equal(M.choice(m), false, "both on the porch: no choice");
  m.pos[1] = 5;
  assert.equal(M.choice(m), true);
});

test("roll home: the jumps are the track's (the scene's board)", () => {
  const tr = track({ points: [0, 0, 10, 0, 10, 10, 0, 10], closed: true, smooth: true, spaces: SPACES, jumps: JUMPS, tokens: 4 });
  for (let s = 0; s < SPACES; s++) {
    const want = M.jumpAt(s) >= 0 ? M.jumpAt(s) : s;
    for (let from = 0; from < SPACES; from++) {
      const v = (s - from + SPACES) % SPACES;
      if (v < 1 || v > 6 || from + v >= SPACES) continue;
      tr.place(0, from);
      tr.move(0, v);
      assert.equal(tr.at[0], want, `from ${from} by ${v}`);
    }
  }
  for (const [a, b] of JUMPS) assert.ok(a > 0 && b > 0 && M.jumpAt(b) < 0, `jump ${a} → ${b}: off the porch, no chains`);
});

test("roll home: bot-vs-bot games end, and the same seed plays the same game", () => {
  const m = M.newMatch(1), wins = [0, 0];
  let turns = 0;
  for (let s = 1; s <= 300; s++) {
    const n = game(m, s, seeded(s));
    assert.equal(m.phase, OVER, `seed ${s} ends`);
    assert.equal(M.homeCount(m, m.winner), 2);
    turns += n;
    wins[m.winner]++;
  }
  assert.ok(turns / 300 < 120, `average turns ${turns / 300}`);
  assert.ok(wins[0] > 60 && wins[1] > 60, `both sides win some: ${wins}`);
  const a = M.newMatch(1), b = M.newMatch(1);
  game(a, 77, seeded(5));
  game(b, 77, seeded(5));
  assert.deepEqual([a.winner, Array.from(a.stats)], [b.winner, Array.from(b.stats)]);
});

test("roll home: whole games (rolls, picks, moves, bumps) allocate nothing", async () => {
  const m = M.newMatch(1), rnd = seeded(3);
  const work = (n) => {
    for (let k = 0; k < n; k++) game(m, k + 1, rnd);
  };
  work(200);
  globalThis.gc?.();
  const n = await minorGCs(() => work(2000));
  assert.ok(n <= 1, `young-generation GCs over 2,000 games: ${n}`);
});
