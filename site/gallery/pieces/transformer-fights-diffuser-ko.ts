// #32 The transformer fights the diffuser to a KO: one arcade bout in a server hall. Two fighters
// you can tell apart by their outline alone: the TRANSFORMER, a stacked mech of layers with three
// attention heads for antennas and piston fists, and the DIFFUSER, a hovering cloud of noise with
// one lens and two floating mitts. Every swing has a wind-up, a lunge and a beat of hit-stop. A hit
// lands in the body that takes it: the mech's layers whip back one after another (head, chest,
// legs) and it skids, leaving marks on the floor that fade; the diffuser glitches apart row by row
// and sheds noise. The heavy blow and the uppercut get a POW and a slow-motion KO: the diffuser
// comes apart into static that rains down and fades, the rack lights flash, and the mech raises
// both fists, attention heads blinking. Click during the bout and the transformer throws an extra
// jab; click after the KO for a rematch.
// Bricks: the kernel (fixed step, settle: it sleeps after the win; nothing is scheduled without a
// busy frame), fizlet/sprite (both fighters as pixel data, baked once; the hit flash a palette) and
// fizlet/slot (loads near the screen, never under reduced motion; destroy() gives the page back).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, W, H, artCanvas, bits, offscreen, print, sfx, sfxW, textW } from "./pix";

export type BoutScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(): void; tap(x: number, y: number): void; readonly hp: readonly number[]; readonly over: boolean };

const { abs, max, min, round, sin } = Math;

// ---------- The cast, stamped from parts ("." is see-through) ----------
const blank = (w: number, h: number) => Array.from({ length: h }, () => ".".repeat(w));
function stamp(rows: string[], x: number, y: number, part: readonly string[]) {
  part.forEach((p, j) => {
    const r = rows[y + j];
    if (r === undefined) return;
    let o = "";
    for (let i = 0; i < r.length; i++) o += i >= x && i < x + p.length && p[i - x] !== "." ? p[i - x] : r[i];
    rows[y + j] = o;
  });
  return rows;
}
// The transformer, facing right (24 × 21): y attention heads, c body, s layer seams, k visor,
// e eyes, g core, w fists. Poses: 0 guard, 1 wind-up, 2 jab, 3 hit, 4 uppercut, 5 win.
const ANT = ["y...y...y", "c...c...c"];
const HEAD = [".cccccccccc.", "cccccccccccc", "ckkkkkkkkkkc", "ckkkkkkekkee", "ckkkkkkkkkkc", ".cccccccccc."];
const HEAD_HIT = [".cccccccccc.", "cccccccccccc", "ckkkkkkkkkkc", "ckkkkkkekkek", "ckkkkkkkekkc", ".cccccccccc."];
const TORSO = ["..ssssssssss..", ".cccccccccccc.", ".cgcgcgcgcgcc.", ".ssssssssssss.", "cccccccccccccc", "cssssssssssssc", ".cccccccccccc.", "..ssssssssss.."];
const LEGS = ["..ccc....ccc..", "..sss....sss..", "..ccc....ccc..", ".cccc...cccc..", "ccccc..ccccc.."];
const LUNGE = ["..ccc....ccc..", ".sss......sss.", ".cc........cc.", "ccc........ccc", "cccc.......cccc"];
function mech(pose: number) {
  const r = blank(24, 21);
  if (pose === 1) stamp(r, 0, 9, ["www...", "wwwccc", "www..c"]);
  if (pose === 3) stamp(r, 1, 2, ["ww", "ww", ".c", ".c"]);
  if (pose === 5) stamp(r, 1, 0, ["www", "www", ".cc", "..c"]), stamp(r, 16, 0, ["www", "www", "cc.", "c.."]);
  if (pose !== 5 && pose !== 3) stamp(r, 1, 12, ["ww.", "wwc"]);
  stamp(r, 6 - (pose === 3 ? 1 : 0), 0, ANT);
  stamp(r, 5 - (pose === 3 ? 1 : 0), 2, pose === 3 ? HEAD_HIT : HEAD);
  stamp(r, 4, 8, TORSO);
  stamp(r, 4, 16, pose === 2 || pose === 4 ? LUNGE : LEGS);
  if (pose === 0) stamp(r, 16, 5, ["..www", "..www", ".cc..", "cc..."]);
  if (pose === 2) stamp(r, 15, 9, ["ccccccwww", "sssssswww", "......www"]);
  if (pose === 4) stamp(r, 16, 0, ["www", "www", ".cc", ".cc", "cc.", "cc."]);
  return r;
}
// The diffuser, facing left (30 × 14): p body, n noise, s underside, w lens, k pupil, m mitts.
// Poses: 0 guard, 1 wind-up, 2 jab (the mitt flies out), 3 hit.
const CLOUD = [
  "......pppppp......", "....pppnpppppp....", "...pppppppppnppp..", "..ppwwwwpppppppnp.", ".ppwwkkwwppnppppp.", ".ppwkkkkwpppppppp.",
  ".ppwwkkwwpppnpppp.", "..ppwwwwppppppppp.", "..pppppppnpppppp..", "...ssppppppppss...", "....ssssssssss....", "......n..n..n.....", ".....n..n..n......",
];
const CLOUD_HIT = CLOUD.map((r, j) => (j >= 3 && j <= 7 ? r.replace(/w/g, "p").replace(/k+/, (m) => "n".repeat(m.length)) : r));
const MITT = [".mm.", "mmmm", "mmmm", ".mm."];
function cloud(pose: number) {
  const r = blank(30, 14);
  stamp(r, 26, pose === 1 ? 1 : 6, MITT); // the back mitt
  stamp(r, 10, 0, pose === 3 ? CLOUD_HIT : CLOUD);
  if (pose === 0) stamp(r, 6, 6, MITT);
  if (pose === 1) stamp(r, 12, 0, MITT);
  if (pose === 2) stamp(r, 0, 5, MITT), stamp(r, 4, 6, ["n.n.n.", ".n.n.n"]);
  if (pose === 3) stamp(r, 9, 2, MITT);
  return r;
}
const CAST = {
  mech: { frames: [0, 1, 2, 3, 4, 5].map(mech), colors: { y: C.hurt, c: C.sys, s: C.line, k: C.rim, e: C.hurt, g: C.go, w: C.ink }, ax: 11, ay: 21 },
  cloud: { frames: [0, 1, 2, 3].map(cloud), colors: { p: C.cmd, n: C.muted, s: C.base, w: C.ink, k: C.rim, m: C.cmd }, ax: 19, ay: 14 },
};
// The colours a dissolving diffuser comes apart into.
const NOISE = [C.cmd, C.muted, C.ink, C.base, C.hurt, C.attack, C.sys];

// ---------- The bout ----------
// Beats: [time, move, who (0 transformer, 1 diffuser), damage]. Moves: 0 FIGHT!, 1 jab, 2 heavy, 3 uppercut (the KO).
const WORD = 0, JAB = 1, HEAVY = 2, UPPER = 3;
const SCRIPT = [0.25, WORD, 0, 0, 0.95, JAB, 0, 0.14, 1.55, JAB, 1, 0.12, 2.05, JAB, 0, 0.16, 2.55, JAB, 1, 0.16, 3.05, HEAVY, 0, 0.3, 4.05, UPPER, 0, 1];
const BEATS = SCRIPT.length / 4;
const FLOOR = 76, SCALE = 2, HOME = [50, 112], REACH = [16, -14];
// Wind-up and strike lengths by move (s), hit-stop, knockback (art px/s), flash.
const WIND = [0, 0.1, 0.28, 0.34], STRIKE = 0.07, STOP = [0, 0.05, 0.11, 0.3], KNOCK = [0, 70, 140, 0];
// Per-fighter slots.
const X = 0, OX = 1, VX = 2, POSE = 3, ACT = 4, AT = 5, MOVE = 6, DMG = 7, FL = 8, HP = 9, SHOWN = 10, SQ = 11, JO = 12, JV = 13, GL = 14, KO = 15, RET = 16;
// Scene slots.
const TIME = 0, BEAT = 1, STOPT = 2, SLOW = 3, SHAKE = 4, WD = 5, WT = 6, WINNER = 7, END = 8, FLASH = 9, ZOOM = 10, DIRTY = 11, TQ = 12, TX_ = 13, TY_ = 14;
const WORDS = ["FIGHT!", "POW", "KO!", "WHAM"];
const NAMES = ["TRANSFORMER", "DIFFUSER"], WINS = "TRANSFORMER WINS";

export function bout(stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null): BoutScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 32 });
  const rnd = engine.random;
  const g = artCanvas(engine, stage);
  const art = sprites(CAST, { palettes: [{}, { "*": C.ink }] });
  const chips = bits(220, NOISE);
  // The comic words, lettered once.
  const lettered = WORDS.map((w) => {
    const x = offscreen(sfxW(w) + 5, 13);
    sfx(x, w, 1, 1, w === "KO!" ? C.hurt : C.ink, w === "KO!" ? C.attack : C.attack, C.rim, [0, -1, 1, 0]);
    return x.canvas;
  });
  // The hall behind them, drawn once: racks of servers on a back wall, the floor's grid.
  const hall = offscreen(W, H);
  hall.fillStyle = C.rim;
  hall.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = 2 + i * 18;
    hall.fillStyle = "#1b1636";
    hall.fillRect(x, 22, 14, FLOOR - 22);
    hall.fillStyle = C.line;
    for (let y = 25; y < FLOOR - 2; y += 5) hall.fillRect(x + 2, y, 10, 3);
  }
  hall.fillStyle = C.base;
  hall.fillRect(0, FLOOR, W, 1);
  hall.fillStyle = "#1b1636";
  hall.fillRect(0, FLOOR + 1, W, H - FLOOR);
  hall.fillStyle = C.line;
  for (let x = -40; x < W + 40; x += 14) for (let y = FLOOR + 3; y < H; y += 4) hall.fillRect(round(80 + (x - 80) * (1 + (y - FLOOR) / 14)), y, 2, 1);

  const F = [new Float64Array(17), new Float64Array(17)];
  const S = new Float64Array(16);
  // Skid marks on the floor: x, length, life.
  const MK = new Float32Array(24);
  let mk = 0;
  function reset() {
    S.fill(0);
    S[WT] = 9;
    S[DIRTY] = 1;
    for (let i = 0; i < 2; i++) F[i]!.fill(0), (F[i]![X] = HOME[i]!), (F[i]![HP] = F[i]![SHOWN] = 1);
    chips.clear();
    MK.fill(0);
    mk = 0;
  }
  reset();
  const play = () => (reset(), engine.wake());
  const tap = (x: number, y: number) => ((S[TX_] = x), (S[TY_] = y), (S[TQ] = 1), engine.wake());
  if (first) tap(80, 45);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  const say = (w: number) => ((S[WD] = w), (S[WT] = 0));
  /** Fighter i starts a move (wind-up first). */
  function attack(i: number, move: number, dmg: number) {
    const f = F[i]!;
    if (f[KO] || F[1 - i]![KO]) return;
    f[ACT] = 1;
    f[AT] = 0;
    f[MOVE] = move;
    f[DMG] = dmg;
    f[POSE] = 1;
  }
  /** The blow lands: hit-stop, the flash, knockback, the body's own reaction, chips, a word. */
  function land(i: number) {
    const a = F[i]!, d = F[1 - i]!, mv = a[MOVE]!, cx = (a[X]! + a[OX]! + d[X]!) / 2, cy = FLOOR - (mv === UPPER ? 30 : 22);
    S[STOPT] = STOP[mv]!;
    d[FL] = 0.09;
    d[POSE] = 3;
    d[RET] = mv === UPPER ? 9 : 0.35;
    d[HP] = max(0, d[HP]! - a[DMG]!);
    d[VX] = (i ? -1 : 1) * KNOCK[mv]!;
    d[JV] = (i ? -1 : 1) * (mv === HEAVY ? 160 : 110);
    d[SQ] = mv === HEAVY ? 0.22 : 0.12;
    d[GL] = 1 - i ? 0.35 : 0;
    S[SHAKE] = mv === HEAVY ? 0.25 : 0.1;
    // Chips: the mech sheds sparks, the diffuser noise.
    for (let k = 0, n = mv === HEAVY ? 22 : 12; k < n; k++) chips.spawn(cx, cy + (rnd() - 0.5) * 8, (i ? -1 : 1) * (30 + rnd() * 90), -30 - rnd() * 60, 0.4 + rnd() * 0.4, rnd() < 0.3 ? 2 : 1, i ? 4 : (rnd() * 4) | 0);
    if (mv === HEAVY) say(1);
    if (i === 1 && mv === JAB && d[HP]! < 0.75) say(3);
    if (mv === UPPER) knockout(1 - i, cx, cy);
  }
  /** The KO: slow motion, the loser comes apart (the diffuser into static), KO!, a winner. */
  function knockout(i: number, cx: number, cy: number) {
    const d = F[i]!, fr = CAST.cloud.frames[3]!;
    d[KO] = 1;
    d[HP] = 0;
    S[SLOW] = 0.9;
    S[ZOOM] = 0.9;
    S[FLASH] = 0.12;
    S[SHAKE] = 0.4;
    S[WINNER] = 2 - i;
    S[END] = S[TIME]! + 3;
    say(2);
    // Every pixel of it becomes a chip of static, flung up and away from the blow.
    for (let y = 0; y < fr.length; y++)
      for (let x = 0; x < fr[y]!.length; x++) {
        const ch = fr[y]![x]!;
        if (ch === "." || (x + y) & 1) continue;
        const px = d[X]! + (x - 19) * SCALE, py = FLOOR + (y - 14) * SCALE;
        chips.spawn(px, py, (px - cx) * 2 + 40 + rnd() * 60, -80 - rnd() * 90 + (py - cy) * 2, 1.4 + rnd() * 1.2, 2, ch === "p" || ch === "m" ? 0 : ch === "n" ? 1 : ch === "w" ? 2 : 3);
      }
  }

  engine.add({
    step(e, dt) {
      let busy = false;
      if (S[TQ]) {
        S[TQ] = 0;
        // After the bout: a rematch. During it: one more jab from the transformer.
        if (S[END] && S[TIME]! > S[END]! - 1.5) reset();
        else if (!F[0]![ACT]) attack(0, JAB, 0.06);
      }
      // Hit-stop: the world holds for a beat, the clock (and the shake) don't.
      if (S[STOPT]! > 0) {
        S[STOPT] = S[STOPT]! - dt;
        e.busy();
        S[DIRTY] = 1;
        return;
      }
      const k = S[SLOW]! > 0 ? 0.35 : 1, sd = dt * k;
      if (S[SLOW]! > 0) S[SLOW] = S[SLOW]! - dt;
      const t = (S[TIME] = S[TIME]! + sd);
      while (S[BEAT]! < BEATS && SCRIPT[S[BEAT]! * 4]! <= t) {
        const r = S[BEAT]! * 4;
        S[BEAT] = S[BEAT]! + 1;
        if (SCRIPT[r + 1] === WORD) say(0);
        else attack(SCRIPT[r + 2]!, SCRIPT[r + 1]!, SCRIPT[r + 3]!);
      }
      if (S[BEAT]! < BEATS || !S[END] || t < S[END]!) busy = true;
      for (let i = 0; i < 2; i++) {
        const f = F[i]!, dir = i ? -1 : 1;
        // A move: wind-up (lean back), strike (lunge to reach), recover.
        if (f[ACT]) {
          f[AT] = f[AT]! + sd;
          const mv = f[MOVE]!;
          if (f[ACT] === 1) {
            f[OX] = -dir * 3 * min(1, f[AT]! / max(0.05, WIND[mv]!));
            if (f[AT]! >= WIND[mv]!) (f[ACT] = 2), (f[AT] = 0), (f[POSE] = mv === UPPER ? 4 : 2), (f[SQ] = -0.1);
          } else if (f[ACT] === 2) {
            f[OX] = -dir * 3 + (REACH[i]! + dir * 3) * min(1, f[AT]! / STRIKE);
            if (f[AT]! >= STRIKE) (f[ACT] = 3), (f[AT] = 0), land(i);
          } else {
            f[OX] = f[OX]! * (1 - min(1, sd * 10));
            if (f[AT]! > (mv === UPPER ? 0.9 : 0.25)) (f[ACT] = 0), (f[OX] = 0), (f[POSE] = S[WINNER] === i + 1 ? 5 : 0);
          }
          busy = true;
        }
        // Knockback slides on the floor and leaves a skid that fades.
        if (f[VX]) {
          const v = f[VX]!;
          f[X] = f[X]! + v * sd;
          f[VX] = abs(v) < 8 ? 0 : v * (1 - min(1, sd * 7));
          if (!i || !f[KO]) {
            if (abs(v) > 30 && mk < 8 && ((t * 30) | 0) % 2 === 0) (MK[mk * 3] = f[X]! - 6), (MK[mk * 3 + 1] = 2 + abs(v) / 40), (MK[mk * 3 + 2] = 1.6), mk++;
          }
          busy = true;
        }
        // Walk back to the mark between exchanges.
        if (!f[ACT] && !f[VX] && !f[KO] && abs(f[X]! - HOME[i]!) > 0.3) (f[X] = f[X]! + (HOME[i]! - f[X]!) * min(1, sd * 4)), (busy = true);
        // The body's own spring (the mech's layers whip, the cloud wobbles), squash, flash, glitch.
        f[JV] = f[JV]! + (-260 * f[JO]! - 14 * f[JV]!) * sd;
        f[JO] = f[JO]! + f[JV]! * sd;
        if (abs(f[JO]!) + abs(f[JV]!) < 0.05) f[JO] = f[JV] = 0;
        else busy = true;
        if (f[SQ]) (f[SQ] = abs(f[SQ]!) < 0.01 ? 0 : f[SQ]! * (1 - min(1, sd * 12))), (busy = true);
        if (f[FL]! > 0) (f[FL] = f[FL]! - sd), (busy = true);
        if (f[GL]! > 0) (f[GL] = f[GL]! - sd), (busy = true);
        if (f[RET]! > 0 && (f[RET] = f[RET]! - sd) <= 0 && !f[ACT]) f[POSE] = S[WINNER] === i + 1 ? 5 : 0;
        if (f[RET]! > 0) busy = true;
        f[SHOWN] = max(f[HP]!, f[SHOWN]! - sd * 0.5);
        if (f[SHOWN]! > f[HP]!) busy = true;
      }
      // The winner raises both fists once the dust settles.
      if (S[WINNER] && !F[S[WINNER]! - 1]![ACT]) F[S[WINNER]! - 1]![POSE] = 5;
      for (let m = mk - 1; m >= 0; m--) if ((MK[m * 3 + 2] = MK[m * 3 + 2]! - sd) <= 0) MK.copyWithin(m * 3, (mk - 1) * 3, mk * 3), mk--;
      if (mk) busy = true;
      chips.step(sd, 220, FLOOR);
      if (chips.live) busy = true;
      for (let s = SHAKE; s <= ZOOM; s++) if ((s === SHAKE || s === FLASH || s === ZOOM) && S[s]! > 0) (S[s] = S[s]! - dt), (busy = true);
      if (S[WT]! < 1.4) (S[WT] = S[WT]! + sd), (busy = true);
      if (busy) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function fighter(i: number) {
    const f = F[i]!, id = i ? "cloud" : "mech", tile = art.tile(id, f[POSE]!, SCALE, f[FL]! > 0 ? 1 : 0);
    const t = S[TIME]!, tw = tile.width, th = tile.height, ax = (i ? 19 : 11) * SCALE, ay = (i ? 14 : 21) * SCALE;
    const bob = f[KO] ? 0 : i ? round(sin(t * 5) * 1.5) - 3 : f[ACT] || S[WINNER] ? 0 : round(sin(t * 4)) * 1;
    const sq = f[SQ]!, w = round(tw * (1 + sq)), h = round(th * (1 - sq));
    const x = round(f[X]! + f[OX]! - ax * (1 + sq)), y = FLOOR - h + (th - ay) + bob;
    if (f[KO]) return;
    // Its shadow, narrower while it hovers.
    g.fillStyle = C.rim;
    g.fillRect(round(f[X]! + f[OX]!) - (i ? 8 : 11), FLOOR, i ? 16 : 22, 1);
    if (i) {
      // The diffuser glitches: each two-row band slips sideways while the hit lasts.
      for (let r = 0; r < th; r += 4) {
        const slip = f[GL]! > 0 ? round((rnd() - 0.5) * 8 * f[GL]! * 3) : 0, jo = round(f[JO]! * 0.6 * (r / th));
        g.drawImage(tile, 0, r, tw, 4, x + slip + jo, y + round((r * h) / th), w, round((4 * h) / th) + 1);
      }
    } else {
      // The mech's layers whip back one after another: head most, legs least.
      const cut = [0, 8 * SCALE, 16 * SCALE, th], lag = [1, 0.55, 0];
      for (let s = 0; s < 3; s++) {
        const sy = cut[s]!, sh = cut[s + 1]! - sy;
        g.drawImage(tile, 0, sy, tw, sh, x + round(f[JO]! * lag[s]!), y + round((sy * h) / th), w, round((sh * h) / th));
      }
    }
  }

  function draw() {
    const t = S[TIME]!, sk = S[SHAKE]! > 0 ? round(sin(t * 90) * S[SHAKE]! * 8) : 0;
    const z = S[ZOOM]! > 0 ? 1 + 0.12 * min(1, S[ZOOM]! * 3) : 1;
    g.setTransform(z, 0, 0, z, (1 - z) * 80 + sk, (1 - z) * (FLOOR - 20));
    g.drawImage(hall.canvas, 0, 0);
    // The racks' lights: they blink with the bout and all flash on the KO.
    for (let i = 0; i < 9; i++)
      for (let r = 0; r < 10; r++) {
        const on = S[FLASH]! > 0 || ((i * 7 + r * 3 + ((t * (S[WINNER] ? 8 : 3)) | 0)) % 9 === 0);
        if (!on) continue;
        g.fillStyle = S[FLASH]! > 0 ? C.attack : r & 1 ? C.go : C.sys;
        g.fillRect(4 + i * 18 + ((r * 5) % 8), 26 + r * 5, 1, 1);
      }
    // Skid marks, fading.
    for (let m = 0; m < mk; m++) {
      g.globalAlpha = min(1, MK[m * 3 + 2]!);
      g.fillStyle = C.line;
      g.fillRect(round(MK[m * 3]!), FLOOR + 1, round(MK[m * 3 + 1]!) + 3, 1);
    }
    g.globalAlpha = 1;
    fighter(1);
    fighter(0);
    chips.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (S[FLASH]! > 0) (g.fillStyle = C.ink), (g.globalAlpha = S[FLASH]! * 4), g.fillRect(0, 0, W, H), (g.globalAlpha = 1);
    // The HUD: bars that shake when hit (white shows what was just lost), names, VS.
    for (let i = 0; i < 2; i++) {
      const f = F[i]!, x = i ? 88 : 8, j = f[FL]! > 0 ? 1 : 0, c = i ? C.cmd : C.sys;
      g.fillStyle = C.line;
      g.fillRect(x - 1, 5 + j, 66, 7);
      g.fillStyle = C.rim;
      g.fillRect(x, 6 + j, 64, 5);
      g.fillStyle = C.ink;
      const sw = round(62 * f[SHOWN]!), hw = round(62 * f[HP]!);
      g.fillRect(i ? x + 1 + 62 - sw : x + 1, 7 + j, sw, 3);
      g.fillStyle = f[HP]! < 0.3 && (t * 6) & 1 ? C.attack : c;
      g.fillRect(i ? x + 1 + 62 - hw : x + 1, 7 + j, hw, 3);
      print(g, NAMES[i]!, i ? 152 - textW(NAMES[i]!) : 8, 14, c);
    }
    print(g, "VS", 77, 6, C.hurt);
    // The word of the moment: slams in big, settles, hangs.
    const wt = S[WT]!;
    if (wt < 1.2) {
      const c = lettered[S[WD]!]!, ko = S[WD] === 2, s = wt < 0.05 || (ko && wt < 0.7) ? 2 : 1, ww = c.width * s, wh = c.height * s;
      if (wt < 1 || (wt * 20) & 1) g.drawImage(c, round(80 - ww / 2), round((ko ? 30 : 31) - wh / 2), ww, wh);
    }
    if (S[WINNER] && t > S[END]! - 2) {
      const x = round(112 - textW(WINS) / 2), up = round(max(0, (S[END]! - 1.6 - t) * 20));
      g.fillStyle = C.rim;
      g.fillRect(x - 3, 52 + up, textW(WINS) + 6, 9);
      print(g, WINS, x, 54 + up, C.hurt);
    }
  }

  engine.start();
  return {
    engine,
    play,
    tap,
    get hp() {
      return [F[0]![HP]!, F[1]![HP]!];
    },
    get over() {
      return S[WINNER]! > 0;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the transformer winding up its heavy blow (scripts/gallery-posters.mjs draws it). */
export const posterAt = 3.3;

/** For `slot(fig, () => import("./transformer-fights-diffuser-ko").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => bout(stage, slot, first);
