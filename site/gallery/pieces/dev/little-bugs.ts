// "127 Little Bugs" (dev-humor): our own pixel bugs crawl over a dark code panel under a counter
// that reads "99 little bugs in the code". Tap a bug to patch it: it pops, the counter ticks down…
// and the patch hatches a fresh batch out of the same spot, so the count climbs (99 → 98 → 127).
// Bugs scatter from the cursor; still, they hide (the scene settles). A few patches in, a SHIP IT
// stamp slams down anyway and flings the bugs under it; the next tap is a new sprint at 99.
// Bricks: the kernel (fixed step, settle, the ledger: Recall gives the page back byte for byte),
// @fzlt/core/slot, @fzlt/core/sound; the rig is the surf minis' kit (../surf/kit.ts, with `track`
// for the pointer). The swarm is `bugSwarm()`: a pool of typed arrays, plain numbers, no DOM
// (tests/dev-humor.test.mjs: zero allocation, and the counter only ever climbs past a patch).
import { createEngine } from "../../../../src/kernel/index";
import { seeded } from "../../../../src/kernel/random";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { C, drawWords, DEMO, DONE, FONT, H, IDLE, NUM, PLAY, rig, spray, TAU, W, words, type Pad } from "../surf/kit";

/** The pool, the first count, patches before the stamp, the tap's reach (art units). */
export const BUGN = 64, START = 99, STAMP_AT = 4, REACH = 9;
// Bug states.
const OFF = 0, LIVE = 1, POP = 2, HATCH = 3;
// State slots.
const MODE = 0, T = 1, COUNT = 2, SHOW = 3, AWAKE = 4, PATCHES = 5, BROOD = 6, BX = 7, BY = 8, STAMP = 9, LINE = 10, GX = 11, GY = 12, TICK = 13, SPRINTS = 14, LX = 15;
/** Events this step: patched, a batch hatched, a counter tick, the stamp, a new sprint. */
export const EV_PATCH = 0, EV_HATCH = 1, EV_TICK = 2, EV_STAMP = 3, EV_SPRINT = 4;
/** The verse under the counter (our own lines; LINE picks one). */
export const VERSE = [
  "Tap a bug to patch it.", "Patch one bug, push it to prod…", "…the fix forked a family.", "…the hotfix needed a hotfix.",
  "…the tests went green. Then red.", "…works on my machine, though.", "Ship it. It's a feature now.", "Tap for a new sprint.",
];
const WORDS = ["PATCHED", "+"];
/** "+N" for a hatch, made once. */
const PLUS = /* @__PURE__ */ Array.from({ length: 64 }, (_, i) => `+${i}`);
/** The panel the bugs crawl on. */
const X0 = 4, X1 = 156, Y0 = 23, Y1 = 87;
/** The highest a pop word sits: it rises 8 and stands about 7 tall, so it never reaches the header (0..19). */
const WTOP = 35;
/** The stamp's box when it lands (centre, half sizes). */
export const STAMPBOX = [80, 56, 34, 12] as const;

export function bugSwarm(seed: number, pad: Pad, demo: boolean) {
  const R = seeded(seed);
  const S = new Float64Array(17), ev = new Uint8Array(5);
  const X = new Float64Array(BUGN), Y = new Float64Array(BUGN), HD = new Float64Array(BUGN), SPD = new Float64Array(BUGN), AGE = new Float64Array(BUGN), ST = new Uint8Array(BUGN), KIND = new Uint8Array(BUGN), FLING = new Float64Array(BUGN);
  const list = WORDS.slice(), sp = spray(140, R), wd = words(list);
  /** How many bugs you can see for a count. */
  const seen = (n: number) => Math.max(6, Math.min(BUGN - 8, Math.round(n / 5)));
  function spawn(x: number, y: number, hatch: boolean) {
    for (let i = 0; i < BUGN; i++) {
      if (ST[i] !== OFF) continue;
      (X[i] = x), (Y[i] = y), (HD[i] = R() * TAU), (SPD[i] = 10 + R() * 9), (AGE[i] = 0), (ST[i] = hatch ? HATCH : LIVE), (KIND[i] = (R() * 3) | 0), (FLING[i] = 0);
      return i;
    }
    return -1;
  }
  function sprint() {
    ST.fill(OFF);
    (S[COUNT] = START), (S[SHOW] = START), (S[PATCHES] = 0), (S[BROOD] = 0), (S[STAMP] = 0), (S[LINE] = 0);
    for (let k = 0, n = seen(START); k < n; k++) spawn(X0 + 6 + R() * (X1 - X0 - 12), Y0 + 4 + R() * (Y1 - Y0 - 8), false);
  }
  sprint();
  (S[MODE] = demo ? DEMO : IDLE), (S[AWAKE] = demo ? 6 : 1.5), (S[GX] = 20), (S[GY] = 80);
  /** Patch the live bug nearest (x, y) within `reach`. */
  function patch(x: number, y: number, reach: number) {
    let best = -1, bd = reach * reach;
    for (let i = 0; i < BUGN; i++) {
      if (ST[i] !== LIVE) continue;
      const dx = X[i]! - x, dy = Y[i]! - y, d = dx * dx + dy * dy;
      if (d < bd) (bd = d), (best = i);
    }
    if (best < 0) return false;
    (ST[best] = POP), (AGE[best] = 0);
    (S[COUNT] = S[COUNT]! - 1), (S[PATCHES] = S[PATCHES]! + 1), (S[BROOD] = 0.55), (S[BX] = X[best]!), (S[BY] = Y[best]!), (S[LINE] = 1);
    sp.burst(X[best]!, Y[best]!, 16, 46, 0, TAU, 1.6, 0);
    sp.burst(X[best]!, Y[best]!, 8, 30, 0, TAU, 1.2, 1);
    wd.say(0, Math.max(26, Math.min(134, X[best]!)), Math.max(WTOP, Math.min(84, Y[best]! - 7)), 0);
    ev[EV_PATCH] = 1;
    return true;
  }
  /** The patch hatches: the first one always takes 98 to 127; later ones are a surprise. */
  function hatch() {
    const n = S[PATCHES]! === 1 && S[COUNT]! === START - 1 ? 29 : 3 + ((R() * 34) | 0);
    S[COUNT] = S[COUNT]! + n;
    const want = seen(S[COUNT]!);
    let live = 0;
    for (let i = 0; i < BUGN; i++) if (ST[i] === LIVE || ST[i] === HATCH) live++;
    for (let k = 0, m = Math.max(2, want - live); k < m; k++) spawn(S[BX]!, S[BY]!, true);
    (list[1] = PLUS[Math.min(63, n)]!), wd.say(1, Math.max(14, Math.min(146, S[BX]! + (S[BX]! < 80 ? 26 : -26))), Math.max(WTOP + 12, Math.min(84, S[BY]! + 8)), 1);
    (S[LINE] = 2 + ((S[PATCHES]! - 1) % 4)), (S[AWAKE] = Math.max(S[AWAKE]!, 2.5));
    ev[EV_HATCH] = 1;
    if (S[PATCHES]! >= STAMP_AT && !S[STAMP]) stamp();
  }
  function stamp() {
    (S[STAMP] = 0.001), (S[MODE] = DONE), (S[LINE] = 6), (S[AWAKE] = 3);
    // It lands: every bug under it is flung out from under the box.
    for (let i = 0; i < BUGN; i++) {
      if (ST[i] === OFF || ST[i] === POP) continue;
      const dx = X[i]! - STAMPBOX[0], dy = Y[i]! - STAMPBOX[1];
      if (Math.abs(dx) < STAMPBOX[2] + 3 && Math.abs(dy) < STAMPBOX[3] + 3) (HD[i] = Math.atan2(dy, dx || 0.1)), (FLING[i] = 1);
    }
    sp.burst(STAMPBOX[0], STAMPBOX[1] + STAMPBOX[3], 26, 60, 0, TAU, 1.8, 2);
    ev[EV_STAMP] = 1;
  }
  function step(dt: number) {
    ev.fill(0);
    S[T] = S[T]! + dt;
    const presses = pad[1]!;
    pad[1] = 0;
    let mode = S[MODE]!;
    // A move wakes them (a resting pointer doesn't keep them up); they run while it is over them.
    const near = pad[5]! > 0;
    if (near && pad[3]! + pad[4]! * 1000 !== S[LX]) (S[LX] = pad[3]! + pad[4]! * 1000), (S[AWAKE] = Math.max(S[AWAKE]!, 1.6));
    if (presses > 0) {
      S[AWAKE] = Math.max(S[AWAKE]!, 2);
      if (mode === DONE) {
        if (S[STAMP]! > 1) sprint(), (S[MODE] = mode = IDLE), (S[SPRINTS] = S[SPRINTS]! + 1), (ev[EV_SPRINT] = 1);
      } else {
        if (mode === DEMO) S[MODE] = mode = PLAY;
        mode = S[MODE] = PLAY;
        // A press with no pointer (the keyboard): the bug nearest the middle, wherever it is.
        if (!S[BROOD]) patch(pad[5]! > 0 || pad[3]! > 0 ? pad[3]! : 80, pad[5]! > 0 || pad[3]! > 0 ? pad[4]! : 56, pad[5]! > 0 || pad[3]! > 0 ? REACH : 999);
      }
    }
    // The attract run: a ghost cursor sweeps in, scatters a few, and patches one.
    if (mode === DEMO) {
      const t = S[T]!;
      const tx = t < 1.3 ? 20 + t * 46 : X[0]!, ty = t < 1.3 ? 80 - t * 18 : Y[0]!;
      S[GX] = S[GX]! + (tx - S[GX]!) * Math.min(1, dt * 6);
      S[GY] = S[GY]! + (ty - S[GY]!) * Math.min(1, dt * 6);
      if (t > 1.6 && !S[PATCHES]) patch(X[0]!, Y[0]!, 999);
      if (t > 3.6) S[MODE] = mode = IDLE;
    }
    if (S[BROOD]! > 0) {
      S[BROOD] = Math.max(0, S[BROOD]! - dt);
      if (S[BROOD] === 0) hatch();
    }
    if (S[STAMP]! > 0) S[STAMP] = S[STAMP]! + dt;
    // The counter catches up, one tick at a time.
    if (S[SHOW] !== S[COUNT]) {
      S[TICK] = S[TICK]! + dt * (S[SHOW]! > S[COUNT]! ? 8 : 26);
      while (S[TICK]! >= 1 && S[SHOW] !== S[COUNT]) (S[TICK] = S[TICK]! - 1), (S[SHOW] = S[SHOW]! + (S[SHOW]! < S[COUNT]! ? 1 : -1)), (ev[EV_TICK] = 1);
    } else S[TICK] = 0;
    // The swarm: crawl while awake, flee the cursor, hide (stop) once things go quiet.
    S[AWAKE] = Math.max(0, S[AWAKE]! - dt);
    const pace = Math.min(1, S[AWAKE]! / 0.8), cx = mode === DEMO ? S[GX]! : pad[3]!, cy = mode === DEMO ? S[GY]! : pad[4]!, cursor = mode === DEMO || near;
    let busy = 0;
    for (let i = 0; i < BUGN; i++) {
      const st = ST[i]!;
      if (st === OFF) continue;
      AGE[i] = AGE[i]! + dt;
      if (st === POP) {
        if (AGE[i]! > 0.35) ST[i] = OFF;
        busy++;
        continue;
      }
      if (st === HATCH && AGE[i]! > 0.45) ST[i] = LIVE;
      let v = SPD[i]! * pace * (st === HATCH ? 1.8 : 1);
      if (FLING[i]! > 0) (v += 120 * FLING[i]!), (FLING[i] = Math.max(0, FLING[i]! - dt * 2.5));
      if (cursor) {
        const dx = X[i]! - cx, dy = Y[i]! - cy, d2 = dx * dx + dy * dy;
        if (d2 < 22 * 22) {
          // Turn away from the cursor, and run.
          const away = Math.atan2(dy, dx);
          let da = away - HD[i]!;
          da -= Math.round(da / TAU) * TAU;
          HD[i] = HD[i]! + da * Math.min(1, dt * 10);
          v = Math.max(v, 34 * (1 - Math.sqrt(d2) / 22) + 8);
        }
      }
      if (v <= 0.01) continue;
      busy++;
      HD[i] = HD[i]! + (R() - 0.5) * dt * 7;
      (X[i] = X[i]! + Math.cos(HD[i]!) * v * dt), (Y[i] = Y[i]! + Math.sin(HD[i]!) * v * dt);
      // The panel's edges turn them back.
      if (X[i]! < X0) (X[i] = X0), (HD[i] = Math.PI - HD[i]!);
      if (X[i]! > X1) (X[i] = X1), (HD[i] = Math.PI - HD[i]!);
      if (Y[i]! < Y0) (Y[i] = Y0), (HD[i] = -HD[i]!);
      if (Y[i]! > Y1) (Y[i] = Y1), (HD[i] = -HD[i]!);
    }
    const moving = sp.step(dt, 40) + wd.step(dt);
    return mode === DEMO || busy > 0 || moving > 0 || S[BROOD]! > 0 || S[SHOW] !== S[COUNT] || (S[STAMP]! > 0 && S[STAMP]! < 1.2) || S[AWAKE]! > 0;
  }
  return { S, ev, sp, wd, step, patch, bugs: { X, Y, HD, AGE, ST, KIND }, LIVE, POP, HATCH };
}
export type BugSwarm = ReturnType<typeof bugSwarm>;

// ---------- the drawing ----------
/** Our bug, seven by seven, facing up, two steps of its legs (b body, h head, s spot, l leg, a feeler). */
const BUG = [
  [".a...a.", "..hhh..", "lbbbbbl", ".bbsbb.", "lbsbbbl", ".bbbbb.", "l.bbb.l"],
  ["a.....a", "..hhh..", ".bbbbb.", "lbbsbbl", ".bsbbb.", "lbbbbbl", ".lbbbl."],
];
const BODY = [C.attack, C.advance, C.hurt];
const SYN = [C.sys, C.cmd, C.go, C.muted, C.hurt];
/** The code under the bugs: indent, width, colour (one page, drawn every frame from these numbers). */
const LINES = [0, 30, 1, 6, 46, 0, 6, 22, 3, 12, 58, 2, 12, 34, 0, 6, 12, 3, 0, 8, 3, 0, 0, 0, 0, 40, 1, 6, 28, 4, 12, 50, 0, 12, 26, 2, 6, 38, 3, 0, 10, 3];

export type BugScene = SlotScene & { engine: ReturnType<typeof createEngine>; swarm: BugSwarm; poster(): void; readonly state: { mode: number; count: number; show: number; patches: number; live: number; stamp: number; sprints: number } };

export function mount(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): BugScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const r = rig(engine, stage, "Patch a bug", { patch: "hit", hatch: "hurt", tick: "click", stamp: "boom", sprint: "ready" }, false, true);
  const g = r.g;
  const swarm = bugSwarm((engine.random() * 2147483647) | 0, r.pad, !first);
  const S = swarm.S, B = swarm.bugs;
  if (first) r.pad[1] = 1;
  // The bug sprites, baked once: two leg steps × three bodies, 7 × 7 pixels.
  const sprites = BUG.flatMap((rows) =>
    BODY.map((body) => {
      const c = document.createElement("canvas");
      (c.width = 7), (c.height = 7);
      const x = c.getContext("2d")!;
      rows.forEach((row, y) => [...row].forEach((ch, i) => {
        if (ch === ".") return;
        x.fillStyle = ch === "b" ? body : ch === "h" ? C.rim : ch === "s" ? C.rim : C.ink;
        x.fillRect(i, y, 1, 1);
      }));
      return c;
    }),
  );
  const SPRAY = [C.go, C.attack, C.ink];
  // The pop words: "PATCHED", "+N".
  const WCOL = [C.go, C.attack];
  // The counter's parts, measured once: "<n>" + " little bugs in the code".
  const TAIL = " little bugs in the code";
  g.font = FONT[8]!;
  const tailW = g.measureText(TAIL).width, digitW = g.measureText("0").width;
  engine.add({
    read: () => r.read(),
    step(e, dt) {
      if (swarm.step(dt)) e.busy();
      const ev = swarm.ev;
      if (ev[EV_PATCH]) e.events.emit("patch");
      if (ev[EV_HATCH]) e.events.emit("hatch");
      if (ev[EV_TICK]) e.events.emit("tick");
      if (ev[EV_STAMP]) e.events.emit("stamp");
      if (ev[EV_SPRINT]) e.events.emit("sprint");
    },
    render() {
      r.begin();
      const t = S[T]!, mode = S[MODE]!;
      // The panel: gutter, line numbers, the code.
      g.fillStyle = C.surface;
      g.fillRect(0, 0, W, H);
      g.fillStyle = C.bg;
      g.fillRect(0, 19, 11, H - 19);
      g.font = FONT[4]!;
      g.textAlign = "right";
      g.textBaseline = "middle";
      for (let i = 0; i < 14; i++) {
        const y = 24 + i * 4.8, k = i % (LINES.length / 3);
        g.fillStyle = C.line;
        g.fillText(NUM[i + 41]!, 9, y + 0.3);
        const w = LINES[k * 3 + 1]!;
        if (!w) continue;
        g.fillStyle = SYN[LINES[k * 3 + 2]!]!;
        g.globalAlpha = 0.55;
        g.beginPath();
        g.roundRect(15 + LINES[k * 3]!, y - 1, w * 1.9, 2, 1);
        g.fill();
        g.globalAlpha = 1;
      }
      // The header: the counter and the verse.
      g.fillStyle = C.raised;
      g.fillRect(0, 0, W, 19);
      g.fillStyle = C.line;
      g.fillRect(0, 19, W, 0.6);
      // The number right-aligned against the words (no measuring in a frame).
      const show = S[SHOW]! | 0, digits = show > 99 ? 3 : show > 9 ? 2 : 1, xm = (W - tailW + digits * digitW) / 2;
      g.font = FONT[8]!;
      g.textAlign = "right";
      g.fillStyle = S[SHOW]! > START ? C.attack : C.go;
      g.fillText(NUM[Math.min(999, show)]!, xm, 7.5);
      g.textAlign = "left";
      g.fillStyle = C.ink;
      g.fillText(TAIL, xm, 7.5);
      g.font = FONT[5]!;
      g.textAlign = "center";
      g.fillStyle = C.muted;
      g.fillText(VERSE[mode === DONE && S[STAMP]! > 1.2 ? 7 : S[LINE]!]!, W / 2, 15);
      // The bugs (popping ones squash flat; hatching ones grow out of the patch).
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < BUGN; i++) {
        const st = B.ST[i]!;
        if (!st) continue;
        const a = B.AGE[i]!;
        let s = 0.9, sx = 1;
        if (st === swarm.POP) (sx = 1 + a * 3), (s = 0.9 * Math.max(0.05, 1 - a / 0.35));
        else if (st === swarm.HATCH) s = 0.9 * Math.min(1, a / 0.3);
        g.save();
        g.translate(B.X[i]!, B.Y[i]!);
        g.rotate(B.HD[i]! + 1.5708);
        g.scale(s * sx, s);
        g.drawImage(sprites[((t * 8 + i) | 0) % 2 === 0 || st === swarm.POP ? B.KIND[i]! : 3 + B.KIND[i]!]!, -3.5, -3.5, 7, 7);
        g.restore();
      }
      g.imageSmoothingEnabled = true;
      r.drawSpray(swarm.sp, SPRAY);
      drawWords(r, swarm.wd, WCOL);
      // The stamp: slams in big, settles flat, tilted, over the code.
      if (S[STAMP]! > 0) {
        const k = S[STAMP]!, sc = k < 0.18 ? 2.4 - (k / 0.18) * 1.4 : k < 0.3 ? 1 - Math.sin(((k - 0.18) / 0.12) * Math.PI) * 0.06 : 1;
        g.save();
        g.translate(STAMPBOX[0], STAMPBOX[1]);
        g.rotate(-0.14);
        g.scale(sc, sc);
        g.globalAlpha = Math.min(1, k / 0.1);
        g.fillStyle = C.rim;
        g.fillRect(-STAMPBOX[2], -STAMPBOX[3] + 1.6, STAMPBOX[2] * 2, STAMPBOX[3] * 2);
        g.fillStyle = C.go;
        g.fillRect(-STAMPBOX[2], -STAMPBOX[3], STAMPBOX[2] * 2, STAMPBOX[3] * 2);
        g.strokeStyle = C.rim;
        g.lineWidth = 1.4;
        g.strokeRect(-STAMPBOX[2] + 2, -STAMPBOX[3] + 2, STAMPBOX[2] * 2 - 4, STAMPBOX[3] * 2 - 4);
        g.fillStyle = C.rim;
        g.font = FONT[14]!;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("SHIP IT", 0, 1);
        g.restore();
        g.globalAlpha = 1;
      }
      // The ghost cursor of the attract run.
      if (mode === DEMO) {
        g.save();
        g.translate(S[GX]!, S[GY]!);
        g.fillStyle = C.ink;
        g.strokeStyle = C.rim;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, 0), g.lineTo(0, 8), g.lineTo(2.2, 6.2), g.lineTo(3.8, 9.4), g.lineTo(5, 8.8), g.lineTo(3.5, 5.8), g.lineTo(6.2, 5.8);
        g.closePath();
        g.fill(), g.stroke();
        g.restore();
      }
    },
  });

  engine.start();
  return {
    engine,
    swarm,
    get state() {
      let live = 0;
      for (let i = 0; i < BUGN; i++) if (B.ST[i] === swarm.LIVE) live++;
      return { mode: S[MODE]!, count: S[COUNT]!, show: S[SHOW]!, patches: S[PATCHES]!, live, stamp: S[STAMP]!, sprints: S[SPRINTS]! };
    },
    poster: () => r.poster(),
    destroy: () => engine.destroy(),
  };
}

/** The poster: the attract run, the patch just hatched (scripts/gallery-posters.mjs). */
export const posterAt = 2.5;
