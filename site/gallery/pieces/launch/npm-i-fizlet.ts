// "npm i fizlet": pay for what you use. Fizlet's bricks ride a belt; the order card says what this
// thing needs; tap a brick (Space: the one over the chute) and it drops into the box. Ones the order
// needs snap in; one it doesn't bounces back out with its real size ("+1,265 B you don't need").
// A full order ships with its whole bundle measured: the bricks together, minified and gzipped, as
// the size budget measures them. The stage's own text is the install line and the package's real
// numbers: 0 dependencies, the packed tarball's bytes and files.
// Every number comes from this build (scripts/launch-facts.mjs fills the stage); a stage with none
// (the poster run) draws no numbers. The game: ./npm-sim.ts (plain numbers, zero allocation).
// Bricks: the kernel (fixed step, settle, its ledger: Recall gives the page back byte for byte),
// fizlet/sound (silent until a gesture; M mutes) and fizlet/slot.
import { createEngine } from "../../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { BELT_Y, BH, BOX_H, BOX_W, BOX_X, BOX_Y, BW, CHUTE, LID, MODE, IDLE, npmSim, ORDER, SHIP, SLOTS, SNAP, W_ADDED, W_DUP, W_NOPE, W_SNAP, BOXX, SHIPPED, HAVE, NOPES } from "./npm-sim";
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
  // Strings, made once: each brick's size, its "you don't need" line, each order's bundle line.
  const size = labels.map((_, i) => (f ? commas(f.bricks[i]![1]) + " B" : ""));
  const nope = labels.map((l, i) => (f ? `+${size[i]} you don't need` : `no ${l} in this one`));
  const bundle = orderList.map((_, o) => (f ? commas(f.orders[o]![2]) + " B" : ""));
  const added = f ? `added 1 package, ${f.deps} dependencies` : "added 1 package";
  const titles = orderList.map((o) => "ORDER: " + o[0].toUpperCase());

  const sim = npmSim(labels.length, orderList.map((o) => o[1].map(idx)), engine.random, (t) => engine.events.emit(t));
  const S = sim.S;
  const k = kit(engine, stage, skin, "npm i fizlet: tap the bricks the order needs, or press Space for the one over the chute. M mutes.", { grab: "click", snap: "ready", nope: "hurt", ship: "win" }, (key) => (key === " " || key === "Enter" || key === "ArrowDown" ? (sim.key(), true) : false));
  const { g, col } = k;
  const pt = new Float64Array(2);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    k.at(e, pt, 0);
    sim.tap(pt[0]!, pt[1]!);
    engine.wake();
  }, { signal: engine.signal });
  engine.ledger.style(stage, "cursor", "pointer");

  /** A brick at (x, y): its face colour, its name, its measured size under the name. */
  function brick(kind: number, x: number, y: number, a = 1) {
    g.globalAlpha = a;
    g.fillStyle = col[INK]!;
    k.box(x + 0.8, y + 1.2, BW, BH, 2);
    g.fillStyle = col[FACE[kind % FACE.length]!]!;
    k.box(x, y, BW, BH, 2);
    // studs: it's a brick
    g.fillStyle = col[FACE[kind % FACE.length]!]!;
    g.fillRect(x + 4, y - 1.6, 5, 1.8);
    g.fillRect(x + BW - 9, y - 1.6, 5, 1.8);
    g.fillStyle = col[INK]!;
    k.text(labels[kind]!, x + BW / 2, y + (f ? 5.6 : 7.4), 4.6, true);
    if (f) k.text(size[kind]!, x + BW / 2, y + 10.4, 3.3, true);
    g.globalAlpha = 1;
  }

  engine.add({
    read() {
      k.read();
    },
    step(e, dt) {
      if (sim.step(dt)) e.busy();
    },
    render() {
      k.begin();
      g.textAlign = "center";
      g.textBaseline = "middle";
      // The belt: rollers under the bricks, moving with the belt.
      const by = BELT_Y + BH + 1.6;
      g.fillStyle = col[LINE]!;
      k.box(-2, by, W + 4, 3.2, 1.6);
      g.fillStyle = col[MUTED]!;
      for (let i = 0; i < 20; i++) k.circ(((i * 9 + S[4]!) % 180) - 10, by + 1.6, 0.8);
      // The chute: an arrow over the box.
      g.fillStyle = col[GOLD]!;
      g.globalAlpha = 0.7;
      g.beginPath();
      g.moveTo(CHUTE - 3, by + 6), g.lineTo(CHUTE + 3, by + 6), g.lineTo(CHUTE, by + 10);
      g.fill();
      g.globalAlpha = 1;
      for (let i = 0; i < SLOTS; i++) if (sim.belt[i]! >= 0) brick(sim.belt[i]!, sim.slotX(i), BELT_Y);
      // The order card: what this thing needs, ticked as they snap in.
      const o = S[ORDER]!, mask = sim.MASK[o]!;
      g.fillStyle = col[PAPER]!;
      k.box(5, 44, 52, 42, 2);
      g.fillStyle = col[INK]!;
      g.textAlign = "left";
      k.text(titles[o]!, 8, 49.5, 3.6);
      let row = 0;
      for (let b = 0; b < labels.length; b++) {
        if (!((mask >> b) & 1)) continue;
        const y = 56 + row++ * 7, got = (S[HAVE]! >> b) & 1 && S[SHIP]! !== -2;
        g.strokeStyle = col[INK]!;
        g.lineWidth = 0.6;
        g.strokeRect(8, y - 2.2, 4.4, 4.4);
        if (got) {
          g.strokeStyle = col[GREEN]!;
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(8.6, y), g.lineTo(10, y + 1.6), g.lineTo(13.4, y - 2.6);
          g.stroke();
        }
        g.fillStyle = col[INK]!;
        k.text(labels[b]!, 15, y + 0.2, 4, true);
      }
      g.textAlign = "center";
      // The box: an open carton; what landed stacks inside; the lid shuts when it ships.
      const bx = S[BOXX]!, lid = S[LID]!, snap = S[SNAP]!;
      g.fillStyle = col[ORANGE]!;
      k.box(bx, BOX_Y - snap * 2, BOX_W, BOX_H + snap * 2, 1.5);
      g.fillStyle = col[INK]!;
      g.globalAlpha = 0.25;
      g.fillRect(bx + 2, BOX_Y + 2, BOX_W - 4, BOX_H - 4);
      g.globalAlpha = 1;
      for (let i = 0; i < 8 && sim.IN[i]! >= 0; i++) {
        g.fillStyle = col[FACE[sim.IN[i]! % FACE.length]!]!;
        g.fillRect(bx + 3, BOX_Y + BOX_H - 10 - i * 4, BOX_W - 6, 3.4);
      }
      // the front lip with the name on it, then the flaps: open out and up, folded shut to ship
      g.fillStyle = col[ORANGE]!;
      g.fillRect(bx, BOX_Y + BOX_H - 6, BOX_W, 6);
      g.fillStyle = col[INK]!;
      k.text("fizlet", bx + BOX_W / 2, BOX_Y + BOX_H - 2.8, 4.2, true);
      g.strokeStyle = col[ORANGE]!;
      g.lineWidth = 2.4;
      g.lineCap = "round";
      const phi = 2.3 * (1 - lid), fc = Math.cos(phi) * BOX_W * 0.48, fs = Math.sin(phi) * BOX_W * 0.48;
      g.beginPath();
      g.moveTo(bx + 0.8, BOX_Y), g.lineTo(bx + 0.8 + fc, BOX_Y - fs);
      g.moveTo(bx + BOX_W - 0.8, BOX_Y), g.lineTo(bx + BOX_W - 0.8 - fc, BOX_Y - fs);
      g.stroke();
      g.lineCap = "butt";
      if (lid > 0.95) (g.fillStyle = col[GOLD]!), g.fillRect(bx + BOX_W / 2 - 3, BOX_Y - 1.2, 6, BOX_H - 6);
      // Flying bricks: a good one drops into the box, a bad one to the lip, then off.
      for (let i = 0; i < 4; i++) {
        const kk = sim.FK[i]!;
        if (kk < 0) continue;
        const t = sim.FT[i]!;
        if (sim.FG[i]) {
          const u = Math.min(1, t / 0.36), e2 = u * u;
          brick(kk, sim.FX[i]! + (bx + (BOX_W - BW) / 2 - sim.FX[i]!) * u, BELT_Y + (BOX_Y + 2 - BELT_Y) * e2, 1 - u * 0.4);
        } else if (t < 0.3) {
          const u = t / 0.3;
          brick(kk, sim.FX[i]! + (bx + (BOX_W - BW) / 2 - sim.FX[i]!) * u, BELT_Y + (BOX_Y - BH - 1 - BELT_Y) * u * u);
        } else brick(kk, sim.FX[i]!, sim.FY[i]!);
      }
      // The bundle: once an order ships, its measured size.
      const ship = S[SHIP]!;
      g.fillStyle = col[PANEL]!;
      k.box(122, 44, 34, 42, 2);
      g.fillStyle = col[MUTED]!;
      k.text("BUNDLE", 139, 49.5, 3.4, true);
      if (f && ship >= 0) {
        g.fillStyle = col[GREEN]!;
        k.text(bundle[o]!, 139, 61, 5);
        g.fillStyle = col[MUTED]!;
        k.text("gzip, measured", 139, 67, 3, true);
      } else {
        g.fillStyle = col[MUTED]!;
        k.text(S[MODE] === IDLE && ship === -1 ? "tap a brick" : "packing…", 139, 61, 3.6, true);
      }
      g.fillStyle = col[MUTED]!;
      k.text(SHIPS[Math.min(10, S[SHIPPED]!)]!, 139, 80, 3.2, true);
      // Words and sparks.
      for (let i = 0; i < 6; i++) {
        const t = sim.WT[i]!;
        if (t >= 1.4) continue;
        g.globalAlpha = Math.min(1, (1.4 - t) * 3);
        const kind = sim.WK[i]!, x = sim.WX[i]!, y = sim.WY[i]!;
        if (kind === W_SNAP) (g.fillStyle = col[GREEN]!), k.text("✓", x, y, 5);
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
  const SHIPS = Array.from({ length: 11 }, (_, i) => (i < 10 ? `shipped ${i}` : "shipped 10+"));

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
