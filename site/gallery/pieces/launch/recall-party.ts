// "Recall Party": fizlet.com's launch, thrown on the page itself. The headline's letters are real
// text. Tap anywhere (Space: at the headline) and a party popper in the nearest bottom corner fires
// confetti there; every letter it reaches is knocked loose, tumbles and lands in a heap on the floor.
// Press Recall (R) and they all fly home, then the scene measures them: each letter's box against
// the one it had at the start, and says "back to the pixel" only when every one matches.
// The letters move through the engine's ledger (custom properties from tables made once), so
// leaving (Recall for real: destroy) gives the page back byte for byte. The line under the headline
// carries the kernel's gzip size and the dependency count, filled from this build
// (scripts/launch-facts.mjs). The game: ./recall-sim.ts (plain numbers, zero allocation).
// Bricks: the kernel, fizlet/sound (silent until a gesture; M mutes) and fizlet/slot.
import { createEngine } from "../../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { BTN_H, BTN_W, BTN_X, BTN_Y, CHECK, FLASH, HOME, LOOSE, MODE, PN, RECALL, recallSim, SIDE, AIMX, AIMY, POPS, RECALLS, HITS } from "./recall-sim";
import { CYAN, GOLD, GREEN, INK, kit, MUTED, ORANGE, PANEL, PAPER, PINK, PURPLE, W } from "./kit";

export type RecallScene = SlotScene & { engine: ReturnType<typeof createEngine>; sim: ReturnType<typeof recallSim>; readonly state: { mode: number; loose: number; pops: number; recalls: number; hits: number; exact: number } };

const CONF = [PINK, CYAN, GOLD, GREEN, PURPLE, ORANGE];
// Offsets in quarter art units (−160 … 160) and turns in whole degrees, as the strings the ledger writes.
const Q = 640, POS = Array.from({ length: Q * 2 + 1 }, (_, i) => String((i - Q) / 4)), DEG = Array.from({ length: 361 }, (_, i) => String(i - 180));
const q = (v: number) => POS[Math.max(0, Math.min(Q * 2, Math.round(v * 4) + Q))]!;

export function recallParty(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): RecallScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 2147483647) | 0 });
  const L = engine.ledger;
  const skin = slot.querySelector<HTMLElement>("[data-rp]")!;
  const els = [...skin.querySelectorAll<HTMLElement>(".rp-h i")], n = els.length;
  const sim = recallSim(n, engine.random, (t) => engine.events.emit(t));
  const S = sim.S;
  const k = kit(engine, stage, skin, "Recall Party: tap to fire a party popper at the page's letters, or press Space; R or the Recall button puts them back. M mutes.", { pop: "boom", hit: "hit", land: "click", recall: "power", home: "win" }, (key) => {
    if (key === " " || key === "Enter") return (sim.key(), true);
    if (key === "r" || key === "R") return (sim.recall(), true);
    return false;
  });
  const { g, col } = k;
  // [0] layout dirty, [1] art units per css px, [2] letters exact after the last Recall (−1 not checked).
  const st = new Float64Array(3);
  (st[0] = 1), (st[2] = -1);
  // Each letter's box at the start (css px, relative to the stage), to check Recall against.
  const was = new Float64Array(n * 4);
  let measured = false;
  const ro = new ResizeObserver(() => ((st[0] = 1), (measured = false), engine.wake()));
  ro.observe(skin);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const exactWord = `\u2713 back to the pixel: ${n} of ${n} letters`;
  const pt = new Float64Array(2);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    k.at(e, pt, 0);
    sim.tap(pt[0]!, pt[1]!);
    engine.wake();
  }, { signal: engine.signal });
  L.style(stage, "cursor", "pointer");

  engine.add({
    read() {
      k.read();
      if (st[0]) {
        // Layout: offsets ignore the transforms we write, so a letter's home is read wherever it is.
        st[0] = 0;
        const kx = W / (skin.clientWidth || 1);
        st[1] = kx;
        for (let i = 0; i < n; i++) {
          const el = els[i]!, p = el.offsetParent as HTMLElement | null;
          sim.place(i, ((p?.offsetLeft ?? 0) + el.offsetLeft + el.offsetWidth / 2) * kx, ((p?.offsetTop ?? 0) + el.offsetTop + el.offsetHeight / 2) * kx, el.offsetWidth * kx, el.offsetHeight * kx);
        }
      }
      if (!measured && S[MODE] !== RECALL && S[LOOSE] === 0 && S[HOME]! <= 0) {
        const r0 = skin.getBoundingClientRect();
        for (let i = 0; i < n; i++) {
          const r = els[i]!.getBoundingClientRect();
          (was[i * 4] = r.left - r0.left), (was[i * 4 + 1] = r.top - r0.top), (was[i * 4 + 2] = r.width), (was[i * 4 + 3] = r.height);
        }
        measured = true;
      }
      if (S[CHECK] === 1 && measured) {
        // Recall's proof: every letter's box where it started (within a tenth of a pixel).
        S[CHECK] = 2;
        const r0 = skin.getBoundingClientRect();
        let ok = 0;
        for (let i = 0; i < n; i++) {
          const r = els[i]!.getBoundingClientRect();
          if (Math.abs(r.left - r0.left - was[i * 4]!) < 0.1 && Math.abs(r.top - r0.top - was[i * 4 + 1]!) < 0.1 && Math.abs(r.width - was[i * 4 + 2]!) < 0.1 && Math.abs(r.height - was[i * 4 + 3]!) < 0.1) ok++;
        }
        st[2] = ok;
      }
    },
    step(e, dt) {
      if (sim.step(dt)) e.busy();
    },
    render() {
      // The letters: offsets and turns as custom properties; a letter at home has them taken back.
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        if (sim.LS[i] || sim.DX[i] !== 0 || sim.DY[i] !== 0) {
          L.style(el, "--x", q(sim.DX[i]!));
          L.style(el, "--y", q(sim.DY[i]!));
          L.style(el, "--r", DEG[Math.max(0, Math.min(360, Math.round(sim.R[i]!) + 180))]!);
        } else {
          L.unstyle(el, "--x");
          L.unstyle(el, "--y");
          L.unstyle(el, "--r");
        }
      }
      k.begin();
      g.textAlign = "center";
      g.textBaseline = "middle";
      // The poppers in the corners (the one that just fired kicks back) and the floor.
      for (let s = 0; s < 2; s++) {
        const x = s ? 156 : 4, fired = S[FLASH]! > 0 && S[SIDE] === s, a = fired || S[POPS]! > 0 && S[SIDE] === s ? Math.atan2(S[AIMY]! - 86, S[AIMX]! - x) : s ? -2.2 : -0.94;
        g.save();
        g.translate(x, 86);
        g.rotate(a);
        g.fillStyle = col[s ? CYAN : PINK]!;
        g.beginPath();
        g.moveTo(-3 - (fired ? 2 : 0), -1), g.lineTo(9, -3.4), g.lineTo(9, 3.4), g.lineTo(-3 - (fired ? 2 : 0), 1);
        g.fill();
        g.fillStyle = col[GOLD]!;
        g.fillRect(2, -2.3, 1.2, 4.6);
        g.fillRect(5.5, -3, 1.2, 6);
        if (fired) {
          g.fillStyle = col[PAPER]!;
          g.globalAlpha = S[FLASH]! * 5;
          k.circ(11, 0, 4 + (0.18 - S[FLASH]!) * 30);
          g.globalAlpha = 1;
        }
        g.restore();
      }
      // Confetti: flat flutters (a ribbon turning: its width follows its phase).
      for (let i = 0; i < PN; i++) {
        const l = sim.PL[i]!;
        if (l <= 0) continue;
        g.fillStyle = col[CONF[sim.PC[i]!]!]!;
        g.globalAlpha = Math.min(1, l * 2.5);
        const w = 1.6 * Math.abs(Math.sin(sim.PF[i]! + l * 9)) + 0.3;
        g.fillRect(sim.PX[i]! - w / 2, sim.PY[i]! - 0.7, w, 1.4);
      }
      g.globalAlpha = 1;
      // The Recall button: lit while there are letters to bring home.
      const live = S[LOOSE]! > 0 && S[MODE] !== RECALL;
      g.fillStyle = col[INK]!;
      k.box(BTN_X + 0.8, BTN_Y + 1.2, BTN_W, BTN_H, 3);
      g.fillStyle = col[live ? GOLD : PANEL]!;
      k.box(BTN_X, BTN_Y, BTN_W, BTN_H, 3);
      g.fillStyle = col[live ? INK : MUTED]!;
      k.text("RECALL", BTN_X + BTN_W / 2, BTN_Y + 8, 5.4);
      k.text("press R", BTN_X + BTN_W / 2, BTN_Y + 14.6, 3, true);
      // Home: the check, measured.
      if (S[HOME]! > 0 && st[2]! >= 0) {
        g.globalAlpha = Math.min(1, S[HOME]! * 2);
        g.fillStyle = col[st[2] === n ? GREEN : PINK]!;
        k.text(st[2] === n ? exactWord : "not yet", 62, 74, 4, true);
        g.globalAlpha = 1;
      }
    },
  });

  engine.start();
  if (first) {
    const kx = W / (stage.clientWidth || 1);
    sim.tap(first.x * kx, first.y * kx);
  }
  return {
    engine,
    sim,
    /** For tests: mode (0 intro, 1 idle, 2 party, 3 recall), loose letters, pops, Recalls, letters knocked, letters exact after the last Recall (−1: not checked). */
    get state() {
      return { mode: S[MODE]!, loose: S[LOOSE]!, pops: S[POPS]!, recalls: S[RECALLS]!, hits: S[HITS]!, exact: st[2]! };
    },
    destroy: () => engine.destroy(),
  };
}

export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => recallParty(stage, slot, first);
/** The poster: the demo popper's confetti in the air (scripts/gallery-posters.mjs). */
export const posterAt = 0.7;
