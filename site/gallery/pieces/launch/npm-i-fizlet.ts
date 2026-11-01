// "npm i @fzlt/core": pay for what you use. Fizlet's bricks ride a belt; the order card says what this
// thing needs; tap a brick (Space: the one over the chute) and it drops into the box. Ones the order
// needs snap in; one it doesn't bounces back out with its real size ("+1,265 B you don't need").
// A full order ships with its whole bundle measured: the bricks together, minified and gzipped, as
// the size budget measures them. The stage's own text is the install line and the package's real
// numbers: 0 dependencies, the packed tarball's bytes and files.
// Every number comes from this build (scripts/launch-facts.mjs fills the stage); a stage with none
// (the poster run) draws no numbers. The game: ./npm-sim.ts (plain numbers, zero allocation).
// Bricks: the kernel (fixed step, settle, its ledger: Recall gives the page back byte for byte),
// @fzlt/core/sound (silent until a gesture; M mutes) and @fzlt/core/slot.
import { createEngine } from "../../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { BELT_Y, BH, BOX_H, BOX_W, BOX_X, BOX_Y, BW, CHUTE, LID, MODE, IDLE, npmSim, ORDER, SHIP, SLOTS, SNAP, W_ADDED, W_DUP, W_NOPE, W_SNAP, BOXX, SHIPPED, HAVE, NOPES, OT, STREAK, LAST, SPEED, T } from "./npm-sim";
import { commas, CYAN, facts, GOLD, GREEN, INK, kit, LINE, MUTED, ORANGE, PANEL, PAPER, PINK, PURPLE, W } from "./kit";

type Facts = { deps: number; kernel: number; bricks: [string, number][]; orders: [string, string[], number][] };
export type NpmScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof npmSim>; readonly state: { mode: number; order: number; shipped: number; have: number; nopes: number } };

/** The belt's bricks and orders when the stage carries no numbers (the poster). */
const LABELS = ["kernel", "input", "fx", "sound", "slot", "pad", "collide", "sprite", "steer", "grid", "camera", "hud"];
const ORDERS: [string, string[]][] = [["a blaster", ["kernel", "input", "fx", "sound"]], ["a page toy", ["kernel", "slot", "fx"]], ["a platformer", ["kernel", "pad", "collide", "sprite"]], ["a crowd", ["kernel", "steer", "grid"]]];
const FACE = [GOLD, PINK, CYAN, GREEN, PURPLE, ORANGE];

export function npmIFizlet(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): NpmScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const skin = slot.querySelector<HTMLElement>("[data-ni]")!;
  const f = facts<Facts>(skin);
  const labels = f ? f.bricks.map((b) => b[0]) : LABELS;
  const orderList = f ? f.orders.map((o) => [o[0], o[1]] as [string, string[]]) : ORDERS;
  const idx = (l: string) => Math.max(0, labels.indexOf(l));
  // Strings, made once: each brick's size and its "+kernel 3,413 B" tick, its "you don't need" line,
  // each order's bundle counting up to its measured size (21 steps), the typed command, streaks.
  const size = labels.map((_, i) => (f ? commas(f.bricks[i]![1]) + " B" : ""));
  const gain = labels.map((l, i) => `+${l} ${size[i]}`);
  const nope = labels.map((l, i) => (f ? `+${size[i]} you don't need` : `no ${l} in this one`));
  const count = orderList.map((_, o) => Array.from({ length: 21 }, (_, j) => (f ? commas((f.orders[o]![2] * j) / 20) + " B" : "")));
  const added = f ? `added 1 package, ${f.deps} dependencies` : "added 1 package";
  const sticker = f ? `${f.deps} deps` : "0 deps";
  const titles = orderList.map((o) => "# " + o[0]);
  const CMD = "$ npm i @fzlt/core", TYPE = Array.from({ length: CMD.length + 1 }, (_, i) => CMD.slice(0, i));
  const STREAK_S = Array.from({ length: 21 }, (_, i) => (i < 20 ? `streak ${i}` : "streak 20+"));
  const sim = npmSim(labels.length, orderList.map((o) => o[1].map(idx)), engine.random, (t) => engine.events.emit(t));
  const S = sim.S;
  const k = kit(engine, stage, skin, "npm i @fzlt/core: tap the bricks the order needs, or press Space for the one over the chute. M mutes.", { grab: "click", snap: "ready", nope: "hit", ship: "win" }, (key) => (key === " " || key === "Enter" || key === "ArrowDown" ? (sim.key(), true) : false));
  const { g, col } = k;
  const pt = new Float64Array(2), cw = new Float64Array([2.34]);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    k.at(e, pt, 0);
    sim.tap(pt[0]!, pt[1]!);
    engine.wake();
  }, { signal: engine.signal });
  engine.ledger.style(stage, "cursor", "pointer");

  /** A brick at (x, y), turned by `r`: its face colour, its name, its measured size (red: `hot`). */
  function brick(kind: number, x: number, y: number, a = 1, r = 0, hot = false) {
    const face = col[FACE[kind % FACE.length]!]!;
    g.save();
    g.globalAlpha = a;
    g.translate(x + BW / 2, y + BH / 2);
    g.rotate(r);
    g.fillStyle = col[INK]!;
    k.box(-BW / 2 + 0.8, -BH / 2 + 1.2, BW, BH, 2);
    g.fillStyle = face;
    k.box(-BW / 2, -BH / 2, BW, BH, 2);
    // studs: it's a brick
    g.fillRect(-BW / 2 + 4, -BH / 2 - 1.6, 5, 1.8);
    g.fillRect(BW / 2 - 9, -BH / 2 - 1.6, 5, 1.8);
    g.fillStyle = col[INK]!;
    k.text(labels[kind]!, 0, f ? -2 : 0, 5, true);
    if (f) {
      if (hot) (g.fillStyle = col[PINK]!), k.box(-BW / 2 + 2, 0.6, BW - 4, 5.2, 1), (g.fillStyle = col[PAPER]!);
      k.text(size[kind]!, 0, 3.3, 3.7, true);
    }
    g.restore();
  }

  engine.add({
    read() {
      // the terminal's character width, measured once a resize (the cursor follows the typing)
      if (k.read()) (g.font = "700 3.9px ui-monospace, monospace"), (cw[0] = g.measureText("0").width);
    },
    step(e, dt) {
      if (sim.step(dt)) e.busy();
    },
    render() {
      k.begin();
      g.textAlign = "center";
      g.textBaseline = "middle";
      const t = S[T]!, sp = S[SPEED]!, pos = S[4]!;
      // The belt: tread lines that scroll with it, a roller at each end.
      const by = BELT_Y + BH + 1.6;
      g.fillStyle = col[LINE]!;
      k.box(-2, by, W + 4, 3.4, 1.7);
      g.strokeStyle = col[MUTED]!;
      g.lineWidth = 0.5;
      g.beginPath();
      for (let i = 0; i < 28; i++) {
        const x = ((i * 6 + pos) % 168) - 4;
        g.moveTo(x, by + 0.5), g.lineTo(x - 1.4, by + 2.9);
      }
      g.stroke();
      // The chute: an arrow over the box.
      g.fillStyle = col[GOLD]!;
      g.beginPath();
      g.moveTo(CHUTE - 3, by + 6), g.lineTo(CHUTE + 3, by + 6), g.lineTo(CHUTE, by + 10);
      g.fill();
      // Bricks ride the belt, bobbing a little while it moves.
      const bob = Math.min(1, sp / 28) * 0.6;
      for (let i = 0; i < SLOTS; i++) if (sim.belt[i]! >= 0) brick(sim.belt[i]!, sim.slotX(i), BELT_Y - Math.abs(Math.sin(t * 7 + i * 1.7)) * bob);
      // The order card: a terminal. The command types in, the order's bricks are a checklist that
      // ticks off, the cursor blinks while the order is open (solid once the scene rests).
      const o = S[ORDER]!, mask = sim.MASK[o]!, ot = S[OT]!;
      g.fillStyle = col[INK]!;
      k.box(5, 44, 54, 43, 2);
      g.strokeStyle = col[LINE]!;
      g.lineWidth = 0.5;
      g.strokeRect(5.25, 44.25, 53.5, 42.5);
      g.textAlign = "left";
      const typed = TYPE[Math.min(CMD.length, Math.floor(ot * 24))]!;
      g.fillStyle = col[GREEN]!;
      k.text(typed, 8, 49.5, 3.9, true);
      if (S[MODE] !== IDLE || ot < 0.8 ? Math.floor(t * 2.5) % 2 === 0 : true) g.fillRect(8.4 + typed.length * cw[0]!, 47.6, 2, 3.8);
      g.fillStyle = col[MUTED]!;
      k.text(titles[o]!, 8, 55.5, 3.5, true);
      let row = 0;
      for (let b = 0; b < labels.length; b++) {
        if (!((mask >> b) & 1)) continue;
        const y = 61.5 + row++ * 6, got = (S[HAVE]! >> b) & 1 && S[SHIP]! !== -2;
        g.fillStyle = col[got ? GREEN : MUTED]!;
        k.text(got ? "[x]" : "[ ]", 8, y, 3.6, true);
        g.fillStyle = col[got ? GREEN : PAPER]!;
        k.text(labels[b]!, 17, y, 3.6, true);
      }
      g.textAlign = "center";
      // The box: an open carton; what landed stacks inside. A snap squashes it and nudges the flaps;
      // shipping folds them shut and stamps the sticker on.
      const bx = S[BOXX]!, lid = S[LID]!, snap = S[SNAP]!, ship = S[SHIP]!;
      g.save();
      g.translate(bx + BOX_W / 2, BOX_Y + BOX_H);
      g.scale(1 + snap * 0.24, 1 - snap * 0.3);
      g.translate(-BOX_W / 2, -BOX_H);
      g.fillStyle = col[ORANGE]!;
      k.box(0, 0, BOX_W, BOX_H, 1.5);
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.25;
      g.fillRect(2, 2, BOX_W - 4, BOX_H - 4);
      g.globalAlpha = 1;
      for (let i = 0; i < 8 && sim.IN[i]! >= 0; i++) {
        g.fillStyle = col[FACE[sim.IN[i]! % FACE.length]!]!;
        g.fillRect(3, BOX_H - 10 - i * 4, BOX_W - 6, 3.4);
      }
      g.fillStyle = col[ORANGE]!;
      g.fillRect(0, BOX_H - 6, BOX_W, 6);
      g.fillStyle = col[INK]!;
      k.text("@fzlt/core", BOX_W / 2, BOX_H - 2.8, 4.2, true);
      g.strokeStyle = col[ORANGE]!;
      g.lineWidth = 2.4;
      g.lineCap = "round";
      const phi = 2.3 * (1 - lid) + snap * 1.6, fc = Math.cos(phi) * BOX_W * 0.48, fs = Math.sin(phi) * BOX_W * 0.48;
      g.beginPath();
      g.moveTo(0.8, 0), g.lineTo(0.8 + fc, -fs);
      g.moveTo(BOX_W - 0.8, 0), g.lineTo(BOX_W - 0.8 - fc, -fs);
      g.stroke();
      g.lineCap = "butt";
      if (lid > 0.95) (g.fillStyle = col[GOLD]!), g.fillRect(BOX_W / 2 - 3, -1.2, 6, BOX_H - 6);
      if (ship > 0.4) {
        // the sticker, stamped: big and light, then down hard
        const st = 1 + Math.max(0, 0.55 - ship) * 5;
        g.translate(BOX_W / 2 + 9, 8);
        g.rotate(-0.18);
        g.scale(st, st);
        g.globalAlpha = Math.min(1, (ship - 0.4) * 8);
        g.fillStyle = col[GREEN]!;
        k.box(-8, -3.4, 16, 6.8, 1.2);
        g.fillStyle = col[INK]!;
        k.text(sticker, 0, 0.2, 3.6, true);
      }
      g.restore();
      // Flying bricks: a good one drops into the box; a bad one to the lip, then a wobble, its size
      // flashing red, and it tumbles off.
      for (let i = 0; i < 4; i++) {
        const kk = sim.FK[i]!;
        if (kk < 0) continue;
        const ft = sim.FT[i]!;
        if (sim.FG[i]) {
          const u = Math.min(1, ft / 0.36);
          brick(kk, sim.FX[i]! + (bx + (BOX_W - BW) / 2 - sim.FX[i]!) * u, BELT_Y + (BOX_Y + 2 - BELT_Y) * u * u, 1 - u * 0.4);
        } else if (ft < 0.3) {
          const u = ft / 0.3;
          brick(kk, sim.FX[i]! + (bx + (BOX_W - BW) / 2 - sim.FX[i]!) * u, BELT_Y + (BOX_Y - BH - 1 - BELT_Y) * u * u);
        } else {
          const w = ft - 0.3;
          brick(kk, sim.FX[i]!, sim.FY[i]!, 1, Math.sin(w * 40) * 0.25 * Math.max(0, 1 - w * 4) + w * sim.FVX[i]! * 0.06, w < 0.35);
        }
      }
      // The bundle: the order that shipped, counting up to its measured size; the streak.
      const last = ship >= 0 ? o : S[LAST]!;
      g.fillStyle = col[PANEL]!;
      k.box(121, 44, 35, 43, 2);
      g.fillStyle = col[MUTED]!;
      k.text("BUNDLE", 138.5, 49.5, 3.4, true);
      if (f && last >= 0) {
        g.fillStyle = col[GREEN]!;
        k.text(count[last]![ship >= 0 ? Math.max(0, Math.min(20, Math.round((ship - 0.15) * 30))) : 20]!, 138.5, 60, 5.6);
        g.fillStyle = col[MUTED]!;
        k.text("gzip, measured", 138.5, 66.5, 3, true);
      } else k.text(S[MODE] === IDLE ? "tap a brick" : "packing…", 138.5, 60, 3.6, true);
      g.fillStyle = col[S[STREAK]! > 1 ? GOLD : MUTED]!;
      k.text(STREAK_S[Math.min(20, S[STREAK]!)]!, 138.5, 76, 3.6);
      g.fillStyle = col[MUTED]!;
      k.text(SHIPS[Math.min(10, S[SHIPPED]!)]!, 138.5, 82, 3, true);
      // Words and sparks.
      for (let i = 0; i < 6; i++) {
        const wt = sim.WT[i]!;
        if (wt >= 1.4) continue;
        g.globalAlpha = Math.min(1, (1.4 - wt) * 3);
        const kind = sim.WK[i]!, x = sim.WX[i]!, y = sim.WY[i]!;
        if (kind === W_SNAP) (g.fillStyle = col[GREEN]!), k.text(gain[sim.WV[i]!]!, x, y, 4.2);
        else if (kind === W_NOPE) (g.fillStyle = col[PINK]!), k.text(nope[sim.WV[i]!]!, x, y, 3.8, true);
        else if (kind === W_DUP) (g.fillStyle = col[PINK]!), k.text("already in", x, y, 3.8, true);
        else if (kind === W_ADDED) (g.fillStyle = col[GOLD]!), k.text(added, x, y, 4, true);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 160; i++) {
        if (sim.PL[i]! <= 0) continue;
        g.fillStyle = col[sim.PC[i]!]!;
        g.fillRect(sim.PX[i]! - 0.5, sim.PY[i]! - 0.5, 1, 1);
      }
    },
  });
  const SHIPS = Array.from({ length: 11 }, (_, i) => (i < 10 ? `${i} shipped` : "10+ shipped"));

  engine.start();
  if (first) {
    const kx = W / (stage.clientWidth || 1);
    sim.tap(first.x * kx, first.y * kx);
  }
  return {
    engine,
    sim,
    /** For tests: the mode (0 intro, 1 idle, 2 playing), the order, orders shipped, the have mask, bounces. */
    get state() {
      return { mode: S[MODE]!, order: S[ORDER]!, shipped: S[SHIPPED]!, have: S[HAVE]!, nopes: S[NOPES]! };
    },
    destroy: () => engine.destroy(),
  };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => npmIFizlet(stage, slot, first);
/** The poster: the demo's kernel just dropped into the box (scripts/gallery-posters.mjs). */
export const posterAt = 1.6;
