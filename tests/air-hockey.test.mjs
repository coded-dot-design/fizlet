// Air Hockey's game (site/gallery/pieces/air-hockey/model.ts) on @fzlt/core/flick, headless: the
// puck glides on air (a long slide before it stops), banks off the rails and only leaves through a
// mouth, and a puck through the bot's mouth is your goal (and the other way round); a mallet stays in
// its own half; a mallet driven through the puck sends it; first to 7 wins; bot-vs-bot games always
// finish, the same targets play the same game bit for bit, and the game's code allocates nothing
// (node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/air-hockey/model.ts");
const { seeded } = await import("../src/kernel/random.ts");
const { PLAY, GOALED, OVER, PUCK, YOU, BOT, L, W, WIN } = M;
const still = seeded(1);
/** Tick with your mallet parked at home; returns the step's goal code. */
const idle = (g, n) => {
  let r = 0;
  for (let k = 0; k < n && !r; k++) r = M.step(g, -900, 400, still);
  return r;
};

test("air hockey: the puck glides on air and banks off the rails; only a mouth lets it out", () => {
  const g = M.newGame(1);
  // Slide it across at an angle: it banks off a side rail and stays on the table.
  g.w.place(PUCK, -0.3, 0);
  g.w.run();
  g.w.flick(PUCK, 0.6, 2.4);
  let banked = false;
  for (let k = 0; k < 120; k++) {
    M.step(g, -900, 0, still);
    if (g.w.vz[PUCK] < 0) banked = true;
  }
  assert.ok(banked, "it came back off the rail");
  assert.ok(Math.abs(g.w.z[PUCK]) < W / 2 && g.w.off[PUCK] === 0, "still on the table");
  assert.ok(Math.hypot(g.w.vx[PUCK], g.w.vz[PUCK]) > 1.5, "air: it keeps most of its speed");
});

test("air hockey: through the bot's mouth is your goal, through yours the bot's; a goal waits for the serve", () => {
  const g = M.newGame(1);
  g.w.place(BOT, 0.8, 0.4); // out of the way: the shot is in before it gets back
  g.w.place(PUCK, 0.85, 0);
  g.w.run();
  g.w.flick(PUCK, 4, 0);
  const r = idle(g, 120);
  assert.equal(r, 1, "your goal");
  assert.deepEqual([g.score[0], g.score[1], g.phase, g.last], [1, 0, GOALED, 0]);
  M.serve(g, 1);
  assert.equal(g.phase, PLAY);
  assert.ok(g.w.x[PUCK] > 0, "the bot's side serves");
  g.w.place(YOU, -0.8, 0.4);
  g.w.place(PUCK, -0.85, 0);
  g.w.run();
  g.w.flick(PUCK, -4, 0);
  assert.equal(idle(g, 120), 2, "the bot's goal");
  assert.deepEqual([g.score[0], g.score[1]], [1, 1]);
});

test("air hockey: your mallet stays in your half and inside the rails, and a mallet driven through the puck sends it", () => {
  let g;
  g = M.newGame(1, { emit: (t, a, b) => t === "flick:hit" && M.hit(g, a, b) });
  for (let k = 0; k < 90; k++) M.step(g, 900, 900, still);
  assert.ok(g.w.x[YOU] < 0 && g.w.z[YOU] < W / 2, `your mallet at ${g.w.x[YOU]}, ${g.w.z[YOU]}`);
  M.resetGame(g, 1);
  // The puck rests at (−0.45, 0): drive through it toward the bot.
  let top = 0;
  for (let k = 0; k < 40; k++) M.step(g, -50, 0, still), (top = Math.max(top, g.w.vx[PUCK]));
  assert.ok(top > 2, `the puck flies: ${top}`);
  assert.ok(g.hits[YOU] >= 1, "a hit counted");
});

/** A bot-vs-bot game: your side plays a chaser (seeded); returns the ticks. */
function botGame(g, seed) {
  M.resetGame(g, seed);
  const rnd = seeded(seed), yr = seeded(seed * 7);
  let t = 0, wait = 0;
  while (g.phase !== OVER && t < 60 * 900) {
    const px = g.w.x[PUCK], pz = g.w.z[PUCK];
    const tx = px < 0 ? px - 0.05 : -0.85, tz = px < 0 ? pz + (yr() - 0.5) * 0.05 : pz * 0.5;
    M.step(g, Math.round(tx * 1000), Math.round(tz * 1000), rnd);
    t++;
    if (g.phase === GOALED && ++wait > 60) M.serve(g, g.last === 0 ? 1 : 0), (wait = 0);
  }
  return t;
}

test("air hockey: games always finish at 7, and the same targets play the same game bit for bit", () => {
  const g = M.newGame(1);
  for (let s = 1; s <= 8; s++) {
    botGame(g, s);
    assert.equal(g.phase, OVER, `seed ${s}`);
    assert.equal(g.score[g.winner], WIN);
    assert.ok(g.score[1 - g.winner] < WIN);
  }
  const a = M.newGame(1), b = M.newGame(1);
  botGame(a, 5);
  botGame(b, 5);
  assert.deepEqual([Array.from(a.score), a.tick, Array.from(a.w.x), Array.from(a.w.z), Array.from(a.hits)], [Array.from(b.score), b.tick, Array.from(b.w.x), Array.from(b.w.z), Array.from(b.hits)]);
});

test("air hockey: the game's own code (the bot, the mallets, goals, serves) stays in flick's allocation bar", async () => {
  const g = M.newGame(1), steps = new Float64Array(1);
  const work = (n) => {
    for (let k = 0; k < n; k++) steps[0] += botGame(g, k + 1);
  };
  work(1);
  steps[0] = 0;
  const n = await minorGCs(() => work(2));
  assert.ok(n <= 1 + steps[0] / 20000, `young-generation GCs: ${n} over ${steps[0]} ticks`);
});
