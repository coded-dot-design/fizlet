// Rat Race's model (site/gallery/pieces/maze/rat.ts on ./carve.ts), headless: every round's maze is
// a perfect maze plus loops (all rooms connected), the cheese is reachable from both corners with
// the doors either way (the doors sit on loops, so a shut one never cuts a room off), the corners
// are near even (yours never shorter), and the same seed lays the same maze; the rival, alone, always
// gets to the cheese; a mouse that holds a way runs it and turns at the next opening; a tapped room
// is reached by A*; a door that shuts on a mouse in its doorway bonks it back; and a whole race
// allocates nothing (young-generation GCs, node --expose-gc).
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const M = await import("../site/gallery/pieces/maze/rat.ts");
const C = await import("../site/gallery/pieces/maze/carve.ts");
const BLOCKED = 1;

const flood = (r) => {
  // Rooms reachable from the cheese, the doors as they stand.
  const g = r.g, seen = new Uint8Array(g.cols * g.rows), q = [r.cheese];
  seen[r.cheese] = 1;
  while (q.length) {
    const i = q.pop();
    for (const j of [i + 1, i - 1, i + g.cols, i - g.cols]) if (!seen[j] && !(g.flags[j] & BLOCKED)) (seen[j] = 1), q.push(j);
  }
  let n = 0;
  for (let i = 0; i < seen.length; i++) if (seen[i] && C.isRoom(g, i)) n++;
  return n;
};

test("rat race: 300 seeded mazes, every room reaches the cheese with the doors either way", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = M.load(seed);
    assert.ok(r.maze.nLoops >= 2, `seed ${seed}: loops for the doors`);
    for (let k = 0; k < 2; k++) {
      // Door state k: door k open, the other shut.
      C.door(r.g, r.doors[k], true), C.door(r.g, r.doors[1 - k], false);
      assert.equal(flood(r), M.CW * M.CH, `seed ${seed}: every room reaches the cheese (door ${k} open)`);
    }
    C.door(r.g, r.doors[0], true), C.door(r.g, r.doors[1], false);
    const you = M.steps(r, r.start[0], r.cheese), riv = M.steps(r, r.start[1], r.cheese);
    assert.ok(you > 0 && riv > 0 && you >= riv && you - riv <= 12, `seed ${seed}: fair corners (you ${you}, rival ${riv})`);
    assert.notEqual(r.doors[0], r.doors[1]);
  }
  const a = M.load(42), b = M.load(42);
  assert.deepEqual([...a.g.flags], [...b.g.flags], "the same seed, the same maze");
  assert.notDeepEqual([...a.g.flags], [...M.load(43).g.flags], "another seed, another maze");
});

test("rat race: the rival always gets to the cheese; a perfect run usually beats it", () => {
  let you = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = M.load(seed);
    M.go(r);
    let t = 0;
    while (r.state === M.RACING && t < 90) M.step(r, 1 / 60), (t += 1 / 60);
    assert.equal(r.winner, M.RIV, `seed ${seed}: the rival got there alone (${t.toFixed(1)} s)`);
    const r2 = M.load(seed);
    M.go(r2);
    M.tapTo(r2, r2.cheese);
    for (let i = 0; i < 90 * 60 && r2.state === M.RACING; i++) {
      M.step(r2, 1 / 60);
      if (r2.mice[0].at === r2.mice[0].to && r2.pathI >= r2.pathN) M.tapTo(r2, r2.cheese);
    }
    if (r2.winner === M.YOU) you++;
  }
  assert.ok(you > 120, `the shortest way wins most races: ${you} of 200`);
});

test("rat race: hold a way and the mouse runs it; a door shutting in its face bonks it back", () => {
  const r = M.load(5);
  M.go(r);
  const m = r.mice[0], g = r.g, start = m.at;
  // Hold a way that is open from the start.
  const d = [0, 1, 2, 3].find((d) => !(g.flags[start + [1, -1, g.cols, -g.cols][d]] & BLOCKED));
  M.hold(r, d);
  for (let i = 0; i < 30; i++) M.step(r, 1 / 60);
  assert.notEqual(m.at, start, "it ran");
  M.hold(r, -1);
  for (let i = 0; i < 120; i++) M.step(r, 1 / 60);
  assert.equal(m.at, m.to, "let go: it stops in a room");
  assert.ok(C.isRoom(g, m.at));
  // Put the rival in the open door's doorway, heading in, just before the swap.
  const r2 = M.load(7), D = r2.doors[r2.open], riv = r2.mice[1];
  M.go(r2);
  const rooms = [D - 1, D + 1, D - g.cols, D + g.cols].filter((i) => C.isRoom(r2.g, i));
  Object.assign(riv, { at: rooms[0], to: D, prog: 0.5, wait: 0 });
  r2.swapT = M.SWAP - 0.001;
  r2.ev = 0;
  M.step(r2, 1 / 60);
  assert.ok(r2.ev & M.EV_SWAP && r2.ev & M.EV_BONK1, "the doors swapped, the rival bonked");
  assert.deepEqual([riv.at, riv.to, riv.bonk > 0], [D, rooms[0], true], "bonked back to its room");
  assert.ok(r2.g.flags[D] & BLOCKED, "the door is shut");
});

test("rat race: a whole race allocates nothing", async () => {
  const r = M.load(11);
  const work = (n) => {
    for (let k = 0; k < n; k++) {
      // Over: the same maze again (no carving), both mice back on their corners.
      if (r.state !== M.RACING) {
        for (let i = 0; i < 2; i++) Object.assign(r.mice[i], { at: r.start[i], to: r.start[i], prog: 0, wait: 0, bonk: 0 });
        (r.state = M.RACING), (r.rN = r.rI = 0), M.tapTo(r, r.cheese);
      }
      M.step(r, 1 / 60);
    }
  };
  M.go(r);
  work(3000);
  globalThis.gc?.();
  const n = await minorGCs(() => work(30000));
  assert.ok(n <= 1, `young-generation GCs over 30,000 steps: ${n}`);
});
