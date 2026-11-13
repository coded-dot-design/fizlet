// Gravy Boat (site/gallery/pieces/gravy-boat.ts), headless: a hold starts the table and tilts the
// boat; the stream thickens the longer it's held and stops when let go (what is falling still
// lands); a pour stopped in time fills a crater to the gold line (PERFECT, the streak grows, best
// follows); held too long it overflows (a star gone, stains on the cloth, the streak resets), and
// three overflows end it; a plate with no pour is MORE GRAVY! and two of them in a row make the table
// wait (it settles); gravy that misses the crater runs down the mound as a short drip and fades; the
// plates speed up to a cap; steps allocate nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const G = await import("../site/gallery/pieces/gravy-boat.ts");
const { gravy, IDLE, PLAY, OVER, WAIT, LINE, SX, CR, V0, VMAX, NB, ND, DLIFE, EV_PERFECT, EV_OVERFLOW, EV_DRY } = G;
const DT = 1 / 60;
const inflight = (r) => { let v = 0; for (let j = 0; j < NB; j++) if (r.BA[j]) v += r.BV[j]; return v; };
/** The plate nearest the stream that has not passed it yet. */
const next = (r) => { let b = -1; for (let i = 0; i < 4; i++) if (!r.GR[i] && (b < 0 || r.X[i] < r.X[b])) b = i; return b; };
/** A careful pourer: hold as the next plate comes under the stream, let go when what's in it and in the air reaches the line. */
function pourer(r, I, aim = LINE) {
  const p = next(r), lead = 15 + r.speed() * 0.45;
  I[0] = p >= 0 && r.X[p] - SX < lead && r.X[p] - SX > -CR && r.LV[p] + inflight(r) < aim - 0.03 ? 1 : 0;
}

test("gravy boat: a hold starts it; the stream thickens with the hold and stops on release", () => {
  const I = new Float64Array(1), r = gravy(3, I), S = r.S;
  assert.equal(S[0], IDLE);
  for (let i = 0; i < 30; i++) r.step(DT);
  assert.equal(S[0], IDLE, "it waits for a hold");
  I[0] = 1;
  r.step(DT);
  assert.equal(S[0], PLAY);
  const flows = [];
  for (let i = 0; i < 40; i++) r.step(DT), flows.push(S[5]);
  assert.ok(S[2] > 0.5, "the boat tilts");
  assert.ok(flows[10] < flows[25] && flows[25] <= flows[39] && flows[39] > 1.5, "the stream thickens");
  I[0] = 0;
  r.step(DT);
  assert.equal(S[5], 0, "let go: it stops");
  assert.ok(inflight(r) > 0, "what is falling still falls");
});

test("gravy boat: a pour stopped in time fills to the gold line: PERFECT, the streak and best", () => {
  const I = new Float64Array(1), r = gravy(5, I), S = r.S;
  I[0] = 1, r.step(DT), (I[0] = 0);
  let perfect = 0, overflow = 0, n = 0;
  for (let i = 0; i < 60 * 40 && S[6] < 8; i++) {
    pourer(r, I);
    r.step(DT);
    perfect += r.ev[EV_PERFECT];
    overflow += r.ev[EV_OVERFLOW];
    n += r.ev[EV_PERFECT] + r.ev[G.EV_GOOD] + r.ev[EV_DRY];
  }
  assert.equal(overflow, 0, "no overflow");
  assert.ok(perfect >= 5, `mostly perfect (${perfect} of ${n})`);
  assert.ok(S[8] >= 3 && S[8] >= S[7], "best follows the streak");
  assert.equal(S[9], 3, "every star");
  assert.ok(r.speed() > V0, "the plates sped up");
});

test("gravy boat: held too long it overflows: a star, stains, the streak; three and the cloth is ruined", () => {
  const I = new Float64Array(1), r = gravy(7, I), S = r.S;
  I[0] = 1;
  let overflows = 0;
  for (let i = 0; i < 60 * 60 && S[0] !== OVER; i++) r.step(DT), (overflows += r.ev[EV_OVERFLOW]);
  assert.equal(S[0], OVER);
  assert.equal(overflows, 3);
  assert.equal(S[9], 0);
  assert.equal(S[7], 0, "no streak");
  assert.ok(r.ns > 5, "stains on the cloth");
  for (let i = 0; i < 4; i++) assert.ok(r.LV[i] <= 1, "never over the rim in the crater");
  // Every drop lands; then it settles.
  I[0] = 0;
  let i = 0;
  while (r.step(DT) && i++ < 600);
  assert.ok(i < 600, "it settles after the end");
});

test("gravy boat: no pour is MORE GRAVY!, and two in a row make the table wait (it settles)", () => {
  const I = new Float64Array(1), r = gravy(9, I), S = r.S;
  I[0] = 1, r.step(DT), (I[0] = 0);
  let dry = 0, i = 0;
  for (; i < 60 * 30 && S[0] === PLAY; i++) r.step(DT), (dry += r.ev[EV_DRY]);
  assert.equal(S[0], WAIT);
  assert.equal(dry, 2);
  let k = 0;
  while (r.step(DT) && k++ < 600);
  assert.ok(k < 600, "settles while it waits");
  const x = Array.from(r.X);
  I[0] = 1, r.step(DT);
  assert.equal(S[0], PLAY, "a hold carries on");
  assert.notDeepEqual(Array.from(r.X), x, "the table moves again");
});

test("gravy boat: gravy that misses the crater drips down the mound, then fades", () => {
  const I = new Float64Array(1), r = gravy(11, I);
  I[0] = 1;
  let seen = 0, ran = 0, oldest = 0;
  for (let i = 0; i < 60 * 12; i++) {
    r.step(DT);
    for (let k = 0; k < ND; k++) {
      if (!r.KA[k]) continue;
      seen++;
      oldest = Math.max(oldest, r.KT[k]);
      if (Math.abs(r.K1[k]) > Math.abs(r.K0[k]) + 2 && r.mound(r.K1[k]) > r.mound(r.K0[k])) ran++;
    }
  }
  assert.ok(seen > 0, "a pour across the plates drips on the mash");
  assert.ok(ran > 0, "a drip runs down the mound");
  assert.ok(oldest <= DLIFE, "and is short-lived");
  I[0] = 0;
  let i = 0;
  while (r.step(DT) && i++ < 900);
  assert.ok(i < 900, "it settles");
  for (let k = 0; k < ND; k++) assert.equal(r.KA[k], 0, "every drip gone");
});

test("gravy boat: the plates speed up to a cap", () => {
  const I = new Float64Array(1), r = gravy(2, I);
  assert.equal(r.speed(), V0);
  r.S[6] = 500;
  assert.equal(r.speed(), VMAX);
  assert.ok(VMAX <= 16, "the top speed stays fair");
});

test("gravy boat: steps allocate nothing", async () => {
  const I = new Float64Array(1), r = gravy(4, I);
  const play = () => {
    for (let i = 0; i < 60 * 20; i++) {
      pourer(r, I, i % 900 < 450 ? LINE : 1.4);
      if (r.S[0] !== PLAY) I[0] = 1;
      r.step(DT);
    }
  };
  play();
  assert.equal(await minorGCs(() => { for (let k = 0; k < 10; k++) play(); }), 0);
});
