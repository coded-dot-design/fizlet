// Corn Maze's model (site/gallery/pieces/maze/corn.ts on ./carve.ts), headless: in 300 seeded
// fields the scarecrow and every room reach the gate (a perfect maze plus loops), the pumpkins sit off
// the shortest way, the scarecrow in a dead end and the lanterns at forks; a walker that taps its way to every pumpkin (nearest first)
// and then the scarecrow finds him with light to spare, lighting the lanterns it passes; holding a
// way walks it and stops in a room on letting go; the crows scatter when you come near and land
// somewhere else later; the light runs out and it is dark; the same seed, the same field; and a
// whole walk allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/maze/corn.ts");
const C = await import("../site/gallery/pieces/maze/carve.ts");

/** Walk: tap the nearest pumpkin left, then the scarecrow; returns the field when it ends. */
function walk(f, maxT = 200) {
  M.go(f);
  const buf = new Int32Array(f.g.cols * f.g.rows);
  const target = () => {
    let best = -1, bd = 1e9;
    for (let k = 0; k < f.nP; k++) if (!f.got[k]) { const d = f.g.path(f.at, f.pumpkin[k], buf, 0, 1); if (d >= 0 && d < bd) (bd = d), (best = f.pumpkin[k]); }
    return best >= 0 ? best : f.scare;
  };
  M.tapTo(f, target());
  for (let t = 0; t < maxT && f.state === M.WALKING; t += 1 / 60) {
    M.step(f, 1 / 60);
    if (f.ev & M.EV_PUMPKIN || (f.at === f.to && f.pathI >= f.pathN)) (f.ev = 0), M.tapTo(f, target());
  }
  return f;
}

test("corn maze: 300 fields, everything reachable, pumpkins off the shortest way, lanterns at forks", () => {
  const buf = new Int32Array(15 * 15);
  for (let seed = 1; seed <= 300; seed++) {
    const f = M.load(seed);
    assert.ok(f.g.path(f.start, f.scare, buf, 0, 1) > 0, `seed ${seed}: the scarecrow can be reached`);
    for (let i = 0; i < f.g.cols * f.g.rows; i++) if (C.isRoom(f.g, i)) assert.ok(i === f.start || f.g.path(f.start, i, buf, 0, 1) > 0, `seed ${seed}: room ${i} reached`);
    assert.equal(f.nP, M.PUMPKINS, `seed ${seed}: pumpkins (${f.nP})`);
    const way = new Set(buf.slice(0, f.g.path(f.start, f.scare, buf, 0, 1)));
    for (let k = 0; k < f.nP; k++) assert.ok(!way.has(f.pumpkin[k]) && C.isRoom(f.g, f.pumpkin[k]), `seed ${seed}: pumpkin ${k} off the shortest way`);
    assert.equal(M.exits(f, f.scare), 1, `seed ${seed}: the scarecrow in a dead end`);
    for (let k = 0; k < f.nL; k++) assert.ok(M.exits(f, f.lantern[k]) >= 3, `seed ${seed}: lantern ${k} at a fork`);
    for (let k = 0; k < M.CROWS; k++) assert.ok(f.crow[k] >= 0 && f.g.flags[f.crow[k]] & 1, `seed ${seed}: crow ${k} on the corn`);
  }
  assert.deepEqual([...M.load(9).g.flags], [...M.load(9).g.flags], "the same seed, the same field");
});

test("corn maze: every pumpkin, then the scarecrow, before dark; lanterns light on the way", () => {
  let spare = Infinity;
  for (let seed = 1; seed <= 200; seed++) {
    const f = walk(M.load(seed));
    assert.equal(f.state, M.FOUND, `seed ${seed}: found the scarecrow`);
    assert.equal(f.taken, f.nP, `seed ${seed}: every pumpkin`);
    assert.ok(f.lit.some(Boolean) || f.nL === 0, `seed ${seed}: lanterns lit on the way`);
    spare = Math.min(spare, f.light);
  }
  assert.ok(spare > 3, `light to spare even on the longest walk: ${spare.toFixed(1)} s`);
});

test("corn maze: hold a way, crows scatter and land, the light runs out", () => {
  const f = M.load(4);
  M.go(f);
  const s = f.at, d = [0, 1, 2, 3].find((d) => M.next(f, s, d) >= 0);
  M.hold(f, d);
  for (let i = 0; i < 40; i++) M.step(f, 1 / 60);
  assert.notEqual(f.at, s, "walked");
  M.hold(f, -1);
  for (let i = 0; i < 120; i++) M.step(f, 1 / 60);
  assert.ok(f.at === f.to && C.isRoom(f.g, f.at), "let go: stopped in a room");
  // Walk next to a crow: it goes; later it lands somewhere else.
  const k = 0, c = f.crow[k], open = [c + 1, c - 1, c + f.g.cols, c - f.g.cols].find((i) => !(f.g.flags[i] & 1));
  Object.assign(f, { at: open, to: open, prog: 0, ev: 0 });
  M.step(f, 1 / 60);
  assert.ok(f.ev & M.EV_CROW && f.crowS[k] === 1, "the crow scattered");
  Object.assign(f, { at: f.start, to: f.start });
  for (let i = 0; i < (M.AWAY + 2) * 60 && f.crowS[k] !== 0; i++) M.step(f, 1 / 60);
  assert.equal(f.crowS[k], 0, "it landed again");
  for (let i = 0; i < M.LIGHT * 60 + 60 && f.state === M.WALKING; i++) M.step(f, 1 / 60);
  assert.equal(f.state, M.DARK, "the light ran out");
});

test("corn maze: a whole walk allocates nothing", async () => {
  const f = M.load(12);
  M.go(f);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      if (f.state !== M.WALKING) Object.assign(f, { state: M.WALKING, at: f.start, to: f.start, prog: 0, light: M.LIGHT }), f.got.fill(0);
      if (f.at === f.to && f.pathI >= f.pathN) M.tapTo(f, f.pumpkin[k % f.nP] === f.at ? f.scare : f.pumpkin[k % f.nP]);
      M.step(f, 1 / 60);
    }
  };
  work(3000);
  globalThis.gc?.();
  const n = await minorGCs(() => work(30000));
  assert.ok(n <= 1, `young-generation GCs over 30,000 steps: ${n}`);
});
