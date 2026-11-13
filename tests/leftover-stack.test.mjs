// Leftover Stack's fridge (site/gallery/pieces/fridge/model.ts), headless: a dish slides as far back
// as it goes and rests on the lowest spot under its footprint (support), never overlaps another
// (the cells it covers rise by its height), refuses a spot with no headroom or off the shelf, turns
// (w and d swap, kept inside), sticks out past the door line only when nothing else fits there (a
// bump), and the third bump ends it (the door); a covered shelf is full (a bonus, once); every
// seed's night can be packed by the autopilot with no bumps (the Perfect pack) and fills at least
// most of the fridge; the same seed plays the same night; and a whole night on a reused fridge
// allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/fridge/model.ts");
const { fridge, autopilot, IDLE, PLAY, OVER, PACKED, COLS, DEPTH, NS, CLEAR, RUN_N, KIND_W, KIND_D, KIND_H, PER_CELL, FULL_PTS, PACK_PTS, PERFECT_PTS, WHY_DOOR } = M;
const cell = (s, c, z) => (s * COLS + c) * DEPTH + z;
/** A fridge in play with its run replaced by `kinds` (then pies). */
function night(kinds) {
  const f = fridge(1);
  f.SEQ.fill(M.TUB);
  kinds.forEach((k, i) => (f.SEQ[i] = k));
  f.start();
  return f;
}
const vol = (k) => KIND_W[k] * KIND_D[k] * KIND_H[k];

test("leftover stack: a dish slides to the back and rests on what is under it; nothing overlaps", () => {
  const f = night([M.TUB, M.TUB, M.PIE, M.JAR]);
  assert.equal(f.S[0], PLAY);
  f.moveTo(0, 2);
  f.drop();
  assert.deepEqual([f.PZ[0], f.PY[0], f.PU[0]], [0, 0, -1], "the first tub goes to the back row, on the shelf");
  assert.equal(f.H[cell(0, 2, 0)], 1);
  f.drop();
  assert.deepEqual([f.PZ[1], f.PY[1]], [1, 0], "the second goes in front of it: the lowest spot first");
  // A pie half (2 across) over both rows' column 2..3: it rests on the tub, level 1, back row.
  f.drop();
  assert.deepEqual([f.PC[2], f.PZ[2], f.PY[2], f.PU[2]], [2, 0, 1, 0], "the pie rests on the back tub");
  assert.equal(f.H[cell(0, 2, 0)], 2);
  assert.equal(f.H[cell(0, 3, 0)], 2, "the cell beside it under the pie is covered up to its top (no overlap below)");
  // The jar (2 tall) has no headroom over the pie (3 levels): it goes in front, on the tub.
  f.drop();
  assert.deepEqual([f.PZ[3], f.PY[3], f.PU[3]], [1, 1, 1]);
  for (let i = 0; i < 4; i++) assert.ok(f.PY[i] + KIND_H[f.PK[i]] <= CLEAR[0], `dish ${i} under the shelf above`);
});

test("leftover stack: no headroom or off the shelf is refused; a turn swaps w and d and stays inside", () => {
  const f = night([M.JAR, M.JAR, M.JAR, M.JAR, M.CASS]);
  f.moveTo(1, 0);
  assert.ok(f.drop() && f.drop(), "two jars side by side? no: back, then front");
  assert.equal(f.drop(), false, "a third jar on column 0 of shelf 1 (2 levels) has no headroom");
  assert.equal(f.ev[M.EV_REFUSE], 1);
  assert.equal(f.S[2], 2, "nothing placed");
  f.move(1, 0);
  f.drop();
  f.drop();
  // The casserole: 3 across, 1 deep; at column 5 it is kept to column 3; turned it is 1 across, 3 deep.
  f.moveTo(0, 5);
  assert.equal(f.S[6], COLS - 3, "kept inside");
  f.turn();
  assert.deepEqual([f.w(f.S[3], f.S[4]), f.d(f.S[3], f.S[4])], [1, 3]);
  f.moveTo(0, 5);
  assert.equal(f.S[6], 5);
  assert.ok(f.fit(f.S[3], f.S[4], 0, 5));
  assert.equal(f.F[3], 1, "3 deep on a 2-deep shelf: it sticks out a row");
});

test("leftover stack: sticking out bumps; the third bump and the door won't close", () => {
  const f = night([M.CASS, M.CASS, M.CASS, M.TUB]);
  for (let i = 0; i < 3; i++) {
    f.turn();
    f.moveTo(i, 0);
    assert.ok(f.drop());
    assert.equal(f.ev[M.EV_BUMP], 1, `bump ${i + 1}`);
    assert.equal(f.PO[i], 1);
  }
  assert.equal(f.S[7], 3);
  assert.equal(f.S[0], OVER);
  assert.equal(f.S[1], WHY_DOOR);
  assert.equal(f.ev[M.EV_OVER], 1);
  assert.equal(f.drop(), false, "nothing after the end");
  assert.equal(f.S[8], 3 * PER_CELL * vol(M.CASS));
});

test("leftover stack: a dish only sticks out when nothing fits inside on that spot", () => {
  const f = night([M.TUB, M.TRAY]);
  f.moveTo(2, 0);
  f.drop();
  // The tray (2 × 2) at column 0 of the top shelf: the back row is a tub high, the shelf two: it
  // stacks on the tub (rest 1, inside) rather than sticking out.
  f.moveTo(2, 0);
  assert.ok(f.fit(f.S[3], 0, 2, 0));
  assert.deepEqual([f.F[1], f.F[2], f.F[3]], [0, 1, 0]);
});

test("leftover stack: a covered shelf is full once (+150)", () => {
  const f = night([M.TRAY, M.TRAY, M.TRAY, M.TUB]);
  let fulls = 0;
  for (let c = 0; c < 3; c++) f.moveTo(2, c * 2), f.drop(), (fulls += f.ev[M.EV_FULL]);
  assert.equal(fulls, 1);
  assert.ok(f.full(2));
  assert.equal(f.S[9], 4);
  assert.equal(f.S[8], 3 * PER_CELL * vol(M.TRAY) + FULL_PTS);
});

test("leftover stack: every night can be packed with no bumps (the Perfect pack) and fills the fridge", () => {
  for (let s = 1; s <= 200; s++) {
    const f = fridge(s);
    assert.equal(f.S[0], IDLE);
    f.start();
    let v = 0;
    for (let i = 0; i < RUN_N; i++) v += vol(f.SEQ[i]);
    while (f.S[0] === PLAY) autopilot(f), f.drop();
    assert.equal(f.S[0], PACKED, `seed ${s}: packed`);
    assert.equal(f.S[7], 0, `seed ${s}: no bumps`);
    assert.equal(f.S[2], RUN_N);
    assert.ok(v >= 50, `seed ${s}: a full night (${v} cells)`);
    const full = (f.S[9] & 1) + ((f.S[9] >> 1) & 1) + ((f.S[9] >> 2) & 1);
    assert.equal(f.S[8], v * PER_CELL + full * FULL_PTS + PACK_PTS + PERFECT_PTS, `seed ${s}: the score adds up`);
    for (let q = 0; q < NS * COLS * DEPTH; q++) assert.ok(f.H[q] <= CLEAR[(q / (COLS * DEPTH)) | 0], "under every shelf's headroom");
  }
});

test("leftover stack: the same seed plays the same night", () => {
  const a = fridge(42), b = fridge(42);
  assert.deepEqual(Array.from(a.SEQ), Array.from(b.SEQ));
  for (const f of [a, b]) {
    f.start();
    while (f.S[0] === PLAY) autopilot(f), f.drop();
  }
  assert.deepEqual(Array.from(a.H), Array.from(b.H));
  assert.deepEqual(Array.from(a.S), Array.from(b.S));
  assert.ok([M.TURKEY, M.TRAY, M.MASH].includes(a.SEQ[0]), "a big dish first");
});

test("leftover stack: a whole night allocates nothing", async () => {
  const f = fridge(9);
  const play = () => {
    f.start();
    while (f.S[0] === PLAY) autopilot(f), f.move(1, 0), f.move(-1, 0), f.turn(), f.turn(), autopilot(f), f.drop();
  };
  play();
  assert.equal(await minorGCs(() => { for (let k = 0; k < 200; k++) play(); }), 0);
});
