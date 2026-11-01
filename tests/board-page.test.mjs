// @fzlt/core/board-page (Node, on a fixed fake page): near / nearAt, hit / hitAt and consume on a page
// whose layout is known to the pixel, the queued consume from a step, a host edit winning, Recall,
// the refresh budgets, and zero allocation in the step queries (the hot path a game runs every frame).
// The real DOM (Range reads, highlights, observers, Recall byte for byte) is in tests/browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const { createEngine } = await import("../src/index.ts");
const { boardPage } = await import("../src/board-page.ts");

// The fixed page model: every glyph is 10 × 16 px; a line's text starts at its element's (x, y).
const CW = 10, LH = 16;
const rect = (x, y, w, h) => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y });
const reads = new Int32Array(1); // Range reads (layout reads the board makes)

class Text {
  nodeType = 3;
  constructor(v, parent) {
    this.v = v;
    this.parentElement = parent;
    this.writes = 0;
  }
  get data() {
    return this.v;
  }
  get nodeValue() {
    return this.v;
  }
  set nodeValue(v) {
    this.writes++;
    this.v = v;
  }
  get isConnected() {
    return !!this.parentElement?.connected;
  }
}
class El {
  nodeType = 1;
  connected = true;
  constructor(tag, x, y, text, w) {
    this.tagName = tag.toUpperCase();
    this.x = x;
    this.y = y;
    this.kids = text === undefined ? [] : [new Text(text, this)];
    this.w = w ?? (text ?? "").length * CW;
  }
  matches(sel) {
    return sel.split(",").some((s) => s.trim().toUpperCase() === this.tagName);
  }
  closest(sel) {
    return this.matches(sel) ? this : null;
  }
  contains(n) {
    return n === this || this.kids.includes(n);
  }
  getBoundingClientRect() {
    return rect(this.x, this.y, this.w, LH);
  }
}
class Range {
  setStart(node, off) {
    this.n = node;
    this.a = off;
  }
  setEnd(_node, off) {
    this.b = off;
  }
  getBoundingClientRect() {
    reads[0]++;
    const p = this.n.parentElement;
    return rect(p.x + this.a * CW, p.y, (this.b - this.a) * CW, LH);
  }
}
const noop = class {
  observe() {}
  disconnect() {}
};

/** A page: a heading, two paragraphs and a button, on a 400 × 300 viewport. */
function page() {
  const h1 = new El("h1", 0, 0, "Hi");
  const p1 = new El("p", 0, 40, "abc def");
  const p2 = new El("p", 0, 80, "12");
  const btn = new El("button", 200, 200, "Go");
  const els = [h1, p1, p2, btn];
  const win = {
    innerWidth: 400,
    innerHeight: 300,
    getComputedStyle: () => ({ visibility: "visible", opacity: "1" }),
    addEventListener() {},
    MutationObserver: noop,
    ResizeObserver: noop,
  };
  const doc = {
    defaultView: win,
    createRange: () => new Range(),
    createTreeWalker: (el) => {
      let i = 0;
      return { nextNode: () => el.kids[i++] ?? null };
    },
  };
  const root = {
    ownerDocument: doc,
    querySelectorAll: (sel) => els.filter((el) => el.matches(sel)),
  };
  return { root, h1, p1, p2, btn };
}

function setup(o = {}) {
  const pg = page();
  const e = createEngine();
  const board = boardPage(e, { root: pg.root, ...o });
  e.advance(1 / 60); // read: scan and measure
  return { ...pg, e, board };
}

test("indexes every eligible glyph of the page with its exact rect, and the targets", () => {
  const { board, btn } = setup();
  const g = board.glyphs;
  // "Hi" (2) + "abc def" (6: the space is no glyph) + "12" (2); the button's text is never food.
  assert.equal(g.count, 10);
  const at = [];
  for (let i = 0; i < g.count; i++) at.push([g.x[i], g.y[i], g.w[i], g.h[i]]);
  at.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  assert.deepEqual(at, [
    [0, 0, 10, 16], [10, 0, 10, 16],
    [0, 40, 10, 16], [10, 40, 10, 16], [20, 40, 10, 16], [40, 40, 10, 16], [50, 40, 10, 16], [60, 40, 10, 16],
    [0, 80, 10, 16], [10, 80, 10, 16],
  ]);
  assert.equal(board.targets.length, 1);
  assert.equal(board.targets[0].el, btn);
  assert.deepEqual([board.targets[0].x, board.targets[0].y, board.targets[0].w, board.targets[0].h, board.targets[0].hp], [200, 200, 20, 16, 100]);
  assert.equal(board.reads, 10, "one Range read per glyph");
  assert.equal(board.scans, 1);
});

/** Index of the glyph whose rect starts at (x, y). */
const glyphAt = (board, x, y) => {
  for (let i = 0; i < board.glyphs.count; i++) if (board.glyphs.x[i] === x && board.glyphs.y[i] === y) return i;
  return -1;
};

test("near: the unspent glyphs a circle touches (rect distance, not centres)", () => {
  const { board } = setup();
  const out = new Int32Array(16);
  // A circle at (35, 48) with r 6 touches "c" (20..30) and "d" (40..50): 5 px to each edge.
  const m = board.near(35, 48, 6, out);
  assert.deepEqual([...out.subarray(0, m)].sort((a, b) => a - b), [glyphAt(board, 20, 40), glyphAt(board, 40, 40)].sort((a, b) => a - b));
  // r 4 reaches neither (the space between them is 10 px wide).
  assert.equal(board.near(35, 48, 4, out), 0);
  // Exactly on the edge counts (≤).
  assert.equal(board.near(35, 48, 5, out), 2);
  // `out` caps the answer: never past its length.
  assert.equal(board.near(30, 48, 100, new Int32Array(3)), 3);
  // nearAt reads the circle from a typed array and finds the same.
  const p = new Float64Array([0, 35, 48, 6]);
  const out2 = new Int32Array(16);
  assert.equal(board.nearAt(p, 1, out2), 2);
  assert.deepEqual([...out2.subarray(0, 2)].sort(), [...out.subarray(0, 2)].sort());
  // Nothing near an empty spot.
  assert.equal(board.near(300, 150, 20, out), 0);
});

test("hit: the first glyph a segment touches (2 px pad) and how far along it", () => {
  const { board } = setup();
  // Left to right along "abc def"'s middle, from x -20: "a" starts at 0, padded to -2. t = 18 / 100.
  const a = glyphAt(board, 0, 40);
  assert.equal(board.hit(-20, 48, 80, 48), a);
  assert.ok(Math.abs(board.t - 0.18) < 1e-9, `t ${board.t}`);
  // Right to left the first is "f" (60..70, padded 72): from 100, t = 28 / 100.
  assert.equal(board.hit(100, 48, 0, 48), glyphAt(board, 60, 40));
  assert.ok(Math.abs(board.t - 0.28) < 1e-9);
  // Straight down through x 15 crosses "i" (y 0) first.
  assert.equal(board.hit(15, -10, 15, 120), glyphAt(board, 10, 0));
  // A segment through the gap between lines (y 20..38 is clear; pads reach 18 and 38) hits nothing.
  assert.equal(board.hit(-10, 28, 300, 28), -1);
  // hitAt: the segment in p[i..i+3], t into p[i+4].
  const p = new Float64Array([9, -20, 48, 80, 48, -1]);
  assert.equal(board.hitAt(p, 1), a);
  assert.ok(Math.abs(p[5] - 0.18) < 1e-9);
  // A vertical segment that misses every rect along x.
  assert.equal(board.hit(150, 0, 150, 120), -1);
});

test("consume: spent glyphs leave near and hit; the page's own Text node gets the bit", () => {
  const { board, p1, e } = setup();
  const a = glyphAt(board, 0, 40), b = glyphAt(board, 10, 40), d = glyphAt(board, 40, 40);
  assert.equal(board.consume(a, "0"), true);
  assert.equal(p1.kids[0].data, "0bc def", "written now: outside a step");
  assert.equal(board.consume(a), false, "spent once");
  assert.equal(board.consume(-1), false);
  assert.equal(board.consume(99), false);
  assert.equal(board.glyphs.spent[a], 1);
  // The next unspent glyph along the line is "b".
  assert.equal(board.hit(-20, 48, 80, 48), b);
  const out = new Int32Array(8);
  assert.equal(board.near(5, 48, 4, out), 0, "a spent glyph is not near anything");
  // "erase" writes a no-break space; char() still gives the letter that was there.
  assert.equal(board.consume(d, "erase"), true);
  assert.equal(p1.kids[0].data, "0bc \u00a0ef");
  assert.equal(board.char(d), "d");
  assert.equal(board.parent(d), p1);
  assert.equal(board.char(99), "");
  // Recall: the paragraph comes back byte for byte.
  e.ledger.restore();
  assert.equal(p1.kids[0].data, "abc def");
});

test("consume from a step is queued and written in render, and a rescan can't lose it", () => {
  const { board, p1, e } = setup();
  const c = glyphAt(board, 20, 40);
  let done = false;
  e.add({
    step() {
      if (done) return;
      done = true;
      assert.equal(board.consume(c, "1"), true);
      assert.equal(p1.kids[0].data, "abc def", "nothing written in the step");
      board.refresh(); // a rescan asked from the step happens at the next read
    },
  });
  e.advance(1 / 60);
  assert.equal(p1.kids[0].data, "ab1 def", "written in render");
  e.advance(1 / 60);
  assert.equal(board.scans, 2, "rescanned at the next read");
  // After the rescan the consumed glyph is still spent and still the page's own.
  const i = glyphAt(board, 20, 40);
  assert.equal(board.glyphs.spent[i], 1);
  assert.equal(board.consume(i), false);
});

test("a newer edit by the host page wins: its text is dropped, never overwritten", () => {
  const { board, p1, e } = setup();
  const a = glyphAt(board, 0, 40);
  p1.kids[0].v = "host text"; // the page changed its own paragraph
  assert.equal(board.consume(a), false, "not ours anymore");
  assert.equal(p1.kids[0].data, "host text");
  board.refresh();
  // Rescanned: the new text is indexed afresh, and Recall leaves the host's edit alone.
  assert.equal(board.glyphs.count, 2 + 8 + 2);
  e.ledger.restore();
  assert.equal(p1.kids[0].data, "host text");
});

test("still: the board re-measures every 0.5 s by default, and only after a change with Infinity", () => {
  const { e } = setup();
  const before = reads[0];
  for (let f = 0; f < 60; f++) e.advance(1 / 60); // 1 s
  const perSecond = (reads[0] - before) / 10;
  assert.ok(perSecond >= 1 && perSecond <= 3, `still default: ~2 refreshes a second, got ${perSecond}`);

  const s = setup({ still: Infinity });
  const r0 = reads[0];
  for (let f = 0; f < 120; f++) s.e.advance(1 / 60);
  assert.equal(reads[0] - r0, 0, "still: Infinity reads nothing while nothing changes");
  s.board.consume(0); // a write makes it dirty: re-measured at the next read
  s.e.advance(1 / 60);
  s.e.advance(0.1);
  assert.ok(reads[0] > r0, "a change re-measures");
});

test("reads: a refresh never makes more Range reads than its budget; the rest come next time", () => {
  const { board, e } = setup({ reads: 4 });
  assert.equal(board.reads, 4);
  // Over budget the board stays dirty and measures the next 4 at 12.5 Hz.
  e.advance(0.1);
  assert.equal(board.reads, 4);
  e.advance(0.1);
  e.advance(0.1);
  let measured = 0;
  for (let i = 0; i < board.glyphs.count; i++) if (board.glyphs.w[i] > 0) measured++;
  assert.equal(measured, 10, "every glyph measured after three budgeted refreshes");
});

test("destroy: the board lets go (no glyphs, no queries answer)", () => {
  const { board, e } = setup();
  e.destroy();
  assert.equal(board.glyphs.count, 0);
  assert.equal(board.near(35, 48, 50, new Int32Array(8)), 0);
  assert.equal(board.hit(-20, 48, 80, 48), -1);
});

test("zero allocation: nearAt and hitAt from a step (300k frames, a moving circle and segment)", async () => {
  // A wider page so a query has real work: 8 lines of 30 glyphs.
  const pg = page();
  const lines = Array.from({ length: 8 }, (_, k) => new El("p", 0, 20 + k * 30, "abcdefghijklmnopqrstuvwxyz0123"));
  pg.root.querySelectorAll = (sel) => lines.filter((el) => el.matches(sel));
  const e = createEngine({ maxSteps: 1 });
  const board = boardPage(e, { root: pg.root, still: Infinity });
  e.advance(1 / 60);
  assert.equal(board.glyphs.count, 240);
  const q = new Float64Array([150, 125, 40, 0, 0]), seg = new Float64Array([-10, 28, 310, 260, 0]), out = new Int32Array(64);
  const sink = new Int32Array(2); // glyphs near, segments that hit
  let x = 0;
  e.add({
    step() {
      // Sweep the circle and the segment's end across the board: different cells, different answers.
      q[0] = (x = x + 7 < 300 ? x + 7 : 0);
      seg[3] = 310 - x;
      sink[0] += board.nearAt(q, 0, out);
      sink[1] += board.hitAt(seg, 0) >= 0 ? 1 : 0;
    },
  });
  // Warm up, then measure. The board's read runs every frame (its refresh clock); with still: Infinity
  // and no change it measures nothing, so what is counted is the read check and the two queries.
  for (let f = 0; f < 5000; f++) e.advance(1 / 60);
  const gcs = await minorGCs(() => {
    for (let f = 0; f < 3e5; f++) e.advance(1 / 60);
  });
  assert.ok(sink[0] > 0 && sink[1] > 0, `the queries found glyphs (${sink})`);
  assert.equal(gcs, 0, `${gcs} young GCs over 300k frames of nearAt + hitAt`);

});
