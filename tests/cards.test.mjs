// @fzlt/core/cards in Node: the same seed gives the same shuffle (and a fixed seed gives the same
// order as recorded), the shuffle is fair (every order of four cards about as often over 48,000
// seeds; every card at every place of a 52-card deck), pile invariants hold through thousands of
// random moves, draws, deals, flips, gathers and shuffles; dioramaCards' timing (a deal staggered
// in move order, each card landing on its layout after `dur`, a flip in place, reduced motion) and
// zero allocation for deck operations and show() + draw. Real pixels and a real click in Chromium:
// tests/beam-cards.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { deck, dioramaCards } = await import("../src/cards.ts");
const { diorama } = await import("../src/diorama.ts");

class FakeCtx {
  constructor(rec) { this.rec = rec; this.fillStyle = ""; this.strokeStyle = ""; this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = ""; this.m = [1, 0, 0, 1, 0, 0]; }
  setTransform(a, b, c, d, e, f) { if (this.rec) this.m = [a, b, c, d, e, f]; }
  fillRect() {}
  clearRect() {}
  beginPath() {}
  moveTo(x, y) {}
  lineTo(x, y) {}
  arc(x, y, r, a, b) {}
  arcTo(a, b, c, d, r) {}
  closePath() {}
  save() {}
  restore() {}
  clip() {}
  fill() {}
  stroke() {}
}
const canvas = (rec = null) => ({ clientWidth: 400, clientHeight: 300, width: 0, height: 0, getContext: () => new FakeCtx(rec) });
const order = (k, p) => Array.from({ length: k.count(p) }, (_, i) => k.at(p, i));
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

/** Every card in exactly one pile at its recorded place; the piles add up. */
function invariants(k) {
  let total = 0;
  const seen = new Uint8Array(k.size);
  for (let p = 0; p < k.piles; p++)
    for (let i = 0; i < k.count(p); i++) {
      const c = k.at(p, i);
      assert.ok(c >= 0 && c < k.size, "a card");
      assert.equal(seen[c], 0, `card ${c} once`);
      seen[c] = 1;
      assert.deepEqual([k.pile[c], k.pos[c]], [p, i], `card ${c} knows where it is`);
      total++;
    }
  assert.equal(total, k.size, "every card somewhere");
}

test("cards: the same seed, the same order; a fixed seed's order never changes", () => {
  const a = deck(), b = deck();
  a.shuffle(0, 20261113);
  b.shuffle(0, 20261113);
  assert.deepEqual(order(a, 0), order(b, 0));
  b.reset();
  b.shuffle(0, 20261114);
  assert.notDeepEqual(order(a, 0), order(b, 0), "another seed, another order");
  // Recorded: integer maths only, so this holds in every engine and every release.
  const c = deck({ size: 10 });
  c.shuffle(0, 7);
  assert.deepEqual(order(c, 0), [0, 4, 8, 1, 7, 3, 5, 6, 9, 2]);
  invariants(a);
});

test("cards: the shuffle is fair (chi-square over every order of 4; every card at every place of 52)", () => {
  const k = deck({ size: 4 }), counts = new Map(), runs = 48000;
  for (let s = 0; s < runs; s++) {
    k.reset();
    k.shuffle(0, s * 2654435761);
    const key = order(k, 0).join("");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.equal(counts.size, 24, "all 24 orders appear");
  const want = runs / 24;
  let chi = 0;
  for (const n of counts.values()) chi += ((n - want) ** 2) / want;
  assert.ok(chi < 49.7, `chi-square ${chi.toFixed(1)} (23 dof, p = 0.001 at 49.7)`);
  // 52 cards: the place of each card over 5,200 shuffles, per card and place about 100.
  const d = deck(), at = new Uint32Array(52 * 52);
  for (let s = 0; s < 5200; s++) {
    d.reset();
    d.shuffle(0, s + 1);
    for (let c = 0; c < 52; c++) at[c * 52 + d.pos[c]]++;
  }
  let chi2 = 0;
  for (const n of at) chi2 += ((n - 100) ** 2) / 100;
  assert.ok(chi2 < 2704 + 4.5 * Math.sqrt(2 * 2704), `place chi-square ${chi2.toFixed(0)} (2,704 cells)`);
});

test("cards: piles keep their invariants through random draws, deals, moves, flips, gathers and shuffles", () => {
  const k = deck({ size: 40, piles: ["draw", "discard", "a", "b", "table"] });
  assert.deepEqual([k.id("table"), k.id("nope"), k.count(0), k.top(0), k.at(0, 0), k.at(0, -1), k.at(1, 0)], [4, -1, 40, 39, 0, 39, -1]);
  let s = 12345;
  const rnd = (n) => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) % n);
  for (let step = 0; step < 4000; step++) {
    const op = rnd(7), p = rnd(5), q = rnd(5);
    if (op === 0) k.draw(p, q, 1 + rnd(3), rnd(2));
    else if (op === 1) k.deal(p, [2, 3], 1 + rnd(2), rnd(2));
    else if (op === 2 && k.count(p)) k.move(k.at(p, rnd(k.count(p))), q, rnd(2) ? -1 : rnd(k.count(q) + 1));
    else if (op === 3) k.flip(rnd(40));
    else if (op === 4 && p !== q) k.gather(p, q, rnd(2));
    else if (op === 5) k.shuffle(p, step);
    else if (op === 6 && rnd(20) === 0) k.reset();
    invariants(k);
  }
  // draw: top first; deal: round by round; a draw past the end returns −1.
  k.reset();
  assert.equal(k.draw(0, 1, 3, 1), 37);
  assert.deepEqual(order(k, 1), [39, 38, 37]);
  assert.ok(k.up[37] && k.up[38] && !k.up[36]);
  assert.equal(k.deal(0, [2, 3], 2), 4);
  assert.deepEqual([order(k, 2), order(k, 3)], [[36, 34], [35, 33]]);
  k.move(0, 2, 1, 1);
  assert.deepEqual(order(k, 2), [36, 0, 34], "move into the middle");
  k.gather(2, 4);
  assert.deepEqual(order(k, 4), [36, 0, 34], "gather keeps the order");
  assert.equal(k.draw(1, 0, 10), -1, "ran out");
  // Stamps follow the moves.
  k.reset();
  k.draw(0, 1, 2);
  assert.ok(k.stamp[38] > k.stamp[39], "the second draw stamped later");
  invariants(k);
});

/** A table, a deck of 8 and its view, with a hand (fan), a stack and a row. */
function scene(o = {}, record = true) {
  const rec = { faces: 0, backs: 0 }, d = diorama(canvas(record || null));
  Object.assign(d.cam, { yaw: 0, pitch: 0.85, dist: 12 });
  d.cluster("table", { fixed: 0 });
  d.add({ id: "table", size: [12, 0.3, 9], pos: [0, -0.3, 0], cluster: "table" });
  const k = deck({ size: 8, piles: ["draw", "hand", "table"] });
  const v = dioramaCards(d, k, {
    on: "table", dur: 0.4, stagger: 0.1, ...o,
    piles: [{ type: "stack", x: -3, z: -1 }, { type: "fan", x: 0, z: 2.5 }, { type: "row", x: 0, z: -1.5 }],
    face: () => rec.faces++, back: () => rec.backs++,
  });
  return { d, k, v, rec };
}

test("dioramaCards: a deal staggers in move order, lands on the layout after dur; flips; reduced motion", () => {
  const { d, k, v, rec } = scene(), out = new Float64Array(7);
  let t = 0;
  v.show(t);
  d.draw();
  assert.ok(rec.backs > 0 && rec.faces === 0, "face down in the stack: backs painted");
  v.pose(7, out);
  close(out[0], -3, 1e-9, "the stack's x");
  close(out[1], 0.012 / 2 + 7 * 0.012 * 1.1, 1e-9, "the top card's height");
  k.draw(0, 1, 5, 1); // five to the hand, face up
  const starts = [];
  for (let f = 0; f < 120; f++) {
    t = f / 100;
    const busy = v.show(t);
    for (let c = 3; c < 8; c++) {
      v.pose(c, out);
      if (starts[c] == null && Math.abs(out[0] + 3) > 1e-6) starts[c] = t;
    }
    d.draw();
    if (!busy) { assert.ok(t >= 0.8 - 1e-9, `rests after the last card's 0.1 × 4 + 0.4 (${t})`); break; }
  }
  // Card 7 was drawn first, then 6, … 3: each starts 0.1 s after the one before.
  for (let c = 6; c >= 3; c--) close(starts[c] - starts[c + 1], 0.1, 0.011, `card ${c} starts 0.1 s after card ${c + 1}`);
  // In the hand: a fan, left to right in hand order, held up toward the camera, faces painted.
  const xs = [7, 6, 5, 4, 3].map((c) => (v.pose(c, out), out[0]));
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), `fanned left to right: ${xs.map((x) => x.toFixed(2))}`);
  v.pose(5, out);
  assert.deepEqual([out[3], out[4], Math.abs(out[5]), out[6]], [0.9, 0, 0, 0], "the middle card: tilted 0.9 up, square, face up");
  rec.faces = 0;
  d.draw();
  assert.equal(rec.faces, 5, "five faces painted");
  // A flip in place: 0.8 × dur, the card lifts and turns over.
  k.flip(5);
  const t0 = t;
  let mid = 0;
  while (v.show((t += 0.01)) && t < t0 + 2) if (Math.abs(t - t0 - 0.16) < 0.006) mid = (v.pose(5, out), out[6]);
  close(t - t0, 0.33, 0.011, "a flip takes 0.8 × dur");
  assert.ok(mid > 1 && mid < 2.2, `half way it is on edge (${mid.toFixed(2)} rad)`);
  v.pose(5, out);
  assert.equal(out[6], Math.PI, "face down");
  // Play it to the table row; picking: the card under its own centre.
  k.move(5, 2, -1, 1);
  while (v.show((t += 0.01)));
  v.pose(5, out);
  assert.deepEqual([out[0], out[2], out[6]], [0, -1.5, 0], "on the table, face up");
  d.draw();
  const sc = new Float64Array(3);
  d.project(0, 0.03, -1.5, sc);
  assert.equal(v.pick(sc[0], sc[1]), 5);
  // Reduced motion: every move lands at once.
  const r = scene({ motion: false });
  r.k.draw(0, 1, 3, 1);
  assert.equal(r.v.show(0), false);
  r.v.pose(7, out);
  assert.equal(out[3], 0.9, "already in the hand");
});

test("cards: zero allocation per deck operation and per show() + draw", async (t) => {
  const minors = async (on) => {
    const { d, k, v } = scene({ dur: 0.2, stagger: 0.03 }, false), hand = new Int32Array([1, 2]), s = new Float64Array(2);
    const frame = () => {
      s[0] += 1 / 60;
      s[1]++;
      if (!on) return;
      const n = s[1] % 90;
      if (n === 1) k.shuffle(0, s[1]), k.deal(0, hand, 2, 1);
      else if (n === 30) k.flip(k.at(1, 0));
      else if (n === 50 && k.count(1)) k.move(k.at(1, -1), 2, -1, 1);
      else if (n === 70) k.gather(1, 0, 0), k.gather(2, 0, 0);
      v.show(s[0]);
      d.draw();
    };
    for (let i = 0; i < 3000; i++) frame();
    return minorGCs(() => { for (let i = 0; i < 20000; i++) frame(); });
  };
  const bare = await minors(false), withCards = await minors(true);
  t.diagnostic(`young GCs over 20k frames (best of 3): bare ${bare}, dealing and drawing ${withCards}`);
  assert.ok(withCards <= bare + 1, `young-generation GCs: ${withCards} with cards, ${bare} bare`);
});
