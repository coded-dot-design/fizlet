// Never Loses (site/gallery/pieces/never-loses.ts), headless: the bot's minimax. Over every game a
// player can play against it (every legal X move at every turn), it never loses; it takes a win when
// one is there and blocks yours; and picking a move allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { best, winner } = await import("../site/gallery/pieces/never-loses.ts");

test("never loses: every line a player can take ends in a draw or a bot win", () => {
  const b = new Int8Array(9);
  let games = 0, draws = 0, botWins = 0;
  const walk = () => {
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = 1;
      if (winner(b) === 1) assert.fail(`the player won: ${b.join("")}`);
      const m = best(b);
      if (m < 0) (games++, draws++);
      else {
        assert.equal(b[m], 0, "the bot plays an empty cell");
        b[m] = 2;
        if (winner(b) === 2) (games++, botWins++);
        else if (b.indexOf(0) < 0) (games++, draws++);
        else walk();
        b[m] = 0;
      }
      b[i] = 0;
    }
  };
  walk();
  assert.ok(games > 400 && botWins > 0 && draws > 0, `games ${games}: bot wins ${botWins}, draws ${draws}`);
});

test("never loses: it takes a win when one is there, and blocks yours", () => {
  // X X . / O O . / . . .  → the bot completes its row at 5.
  assert.equal(best(Int8Array.from([1, 1, 0, 2, 2, 0, 0, 0, 1])), 5);
  // X X . / . O . / . . .  → the bot blocks at 2.
  assert.equal(best(Int8Array.from([1, 1, 0, 0, 2, 0, 0, 0, 0])), 2);
  // A corner first: the bot takes the centre.
  assert.equal(best(Int8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 0])), 4);
  assert.equal(best(Int8Array.from([1, 2, 1, 2, 1, 2, 2, 1, 2])), -1, "a full board: no move");
});

test("never loses: picking a move allocates nothing", async () => {
  const b = new Int8Array(9);
  const work = (n) => { for (let k = 0; k < n; k++) { b.fill(0); b[k % 9] = 1; best(b); } };
  work(200);
  globalThis.gc?.();
  const n = await minorGCs(() => work(3000));
  assert.ok(n <= 1, `young-generation GCs over 3,000 searches: ${n}`);
});
