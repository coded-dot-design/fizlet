// Short fuse: PLUM (toon.ts) is napping against a bundle of dynamite, under a notice that says not
// to light the fuse. The fuse runs under every line of the notice, back and forth, down to the
// bundle. Click anywhere and it lights at the nearest bit of fuse: the spark fizzes along under the
// letters (each one hops as the heat goes by) toward the bundle. Click the spark to blow it out
// (FFT!), though a stub can sputter back to life. Light it in two places and race them; a spark
// that reaches a burnt gap fizzles out. Let one through and PLUM wakes, does a take, looks right at
// you, gulps: BOOM. The page jumps, he stands there black with soot, blinking white eyes, his hat
// comes down, he coughs, the soot falls off, and he lays a new fuse and goes back to sleep.
// Bricks: the kernel (fixed step, settle: it sleeps while he does; its ledger for every page write,
// so Recall gives the page back byte for byte) and fzlt/sprite (the toon and the bundle, baked
// once). The toon is shared with "Look out below!" (toon.ts).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, F, HAT_Y, PLUM, DYNA, TOON, grawlix, print, shout, take, textW } from "./toon";

export type FuseScene = SlotScene & {
  engine: ReturnType<typeof createEngine>;
  tap(x: number, y: number): void;
  /** The fuse as art px points (for tests): sample i at (fx[i], fy[i]); sparks by sample. */
  readonly fuse: { fx: Float32Array; fy: Float32Array; n: number };
  readonly sparks: number[];
  readonly saved: number;
  readonly booms: number;
  readonly mode: number;
};

const { abs, cos, hypot, max, min, round, sin, sqrt } = Math;
const W = 160, H = 90, FLOOR = 82, BX = 112, PX = 131, MAXP = 1200, SP = 4, SPEED = 24;
// PLUM's modes.
const enum M { SLEEP, WAKE, TAKE, CAMERA, PHEW, BOOM, SOOT, CLEAN, RELAY }
// A spark: 0 none, 1 burning, 2 blown out (an ember that may come back), 3 fizzled.
const enum P { OFF, LIT, EMBER }
// State slots.
const enum K { MODE, T, SAVED, BOOMS, AUTO, RES, DIRTY, SHAKE, FLASH, WORD, WT, WX, WY, QX, QY, QN, GROW, HY, HV, BUND, BV }
const WORDS = ["FFT", "HISS!", "BOOM!", "PHEW", "KOFF", "GULP", "FIZZ"];
const YS = Array.from({ length: 61 }, (_, i) => `${(i - 30) * 0.625}cqw`);
const RS = Array.from({ length: 121 }, (_, i) => `${i - 60}deg`);
const DIG = Array.from({ length: 100 }, (_, i) => String(i));

export function shortFuse(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FuseScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 31 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites({ ...PLUM, dyna: DYNA() }, { palettes: TOON });
  const S = new Float64Array(24);
  S[K.WT] = 9;
  S[K.RES] = S[K.DIRTY] = 1;
  S[K.AUTO] = first ? 0 : 0.7;
  S[K.GROW] = -1;

  // The notice: every letter; its box (art px), its hop and tilt, how hot it is.
  const wrap = slot.querySelector<HTMLElement>(".sf")!, els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const lines = [...wrap.querySelectorAll<HTMLElement>(".sf-l")];
  const EX = new Float32Array(n), EY = new Float32Array(n), EW = new Float32Array(n), EH = new Float32Array(n);
  const OY = new Float32Array(n), VY = new Float32Array(n), RO = new Float32Array(n), VR = new Float32Array(n), HOT = new Float32Array(n);
  const LY = new Int16Array(n), LR = new Int16Array(n), LH = new Uint8Array(n);
  // The fuse: one sample per art px, start to bundle; which are burnt.
  const FX = new Float32Array(MAXP), FY = new Float32Array(MAXP), BURNT = new Uint8Array(MAXP);
  let fn = 0;
  // The sparks: where along the fuse, state, timer, whether it will come back.
  const KS = new Float32Array(SP), KST = new Uint8Array(SP), KT = new Float32Array(SP), KBACK = new Uint8Array(SP);
  // Bits: sparks flying off a lit fuse, smoke, soot flakes. x, y, vx, vy, age, kind.
  const NB = 48, BXs = new Float32Array(NB), BYs = new Float32Array(NB), BVX = new Float32Array(NB), BVY = new Float32Array(NB), BA = new Float32Array(NB).fill(9), BK = new Uint8Array(NB);
  let bn = 0;

  const ro = new ResizeObserver(() => ((S[K.RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const to = (m: number) => ((S[K.MODE] = m), (S[K.T] = 0));
  const say = (w: number, x: number, y: number) => {
    const hw = textW(WORDS[w]!, 2) / 2 + 2;
    S[K.WORD] = w;
    S[K.WT] = 0;
    S[K.WX] = max(hw, min(W - hw, x));
    S[K.WY] = max(2, min(FLOOR - 16, y));
  };
  const bit = (x: number, y: number, vx: number, vy: number, k: number) => {
    const b = bn++ % NB;
    BXs[b] = x;
    BYs[b] = y;
    BVX[b] = vx;
    BVY[b] = vy;
    BA[b] = 0;
    BK[b] = k;
  };
  function tap(x: number, y: number) {
    S[K.QX] = x;
    S[K.QY] = y;
    S[K.QN] = 1;
    engine.wake();
  }
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Lay the fuse: under each line, back and forth, then over to the bundle's own fuse. */
  function lay(k: number) {
    const ys: number[] = [], xs0: number[] = [], xs1: number[] = [];
    for (const l of lines) {
      let x = 0, y = 0;
      for (let a: HTMLElement | null = l; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
      ys.push(round((y + l.offsetHeight) * k) + 1);
      xs0.push(x * k);
      xs1.push((x + l.offsetWidth) * k);
    }
    const lo = round(min(...xs0)) - 3, hi = round(max(...xs1)) + 3;
    fn = 0;
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      const len = max(abs(x1 - x0), abs(y1 - y0));
      for (let i = 0; i < len && fn < MAXP; i++) (FX[fn] = x0 + ((x1 - x0) * i) / len), (FY[fn] = y0 + ((y1 - y0) * i) / len), fn++;
    };
    let x = lo;
    for (let i = 0; i < ys.length; i++) {
      const x1 = i & 1 ? lo : hi;
      seg(x, ys[i]!, x1, ys[i]!);
      x = x1;
      if (i < ys.length - 1) seg(x, ys[i]!, x, ys[i + 1]!);
    }
    // Over to the bundle and down into it (its fuse sticks out of the top).
    seg(x, ys[ys.length - 1]!, BX, ys[ys.length - 1]!);
    seg(BX, ys[ys.length - 1]!, BX, FLOOR - 11);
    FX[fn] = BX;
    FY[fn] = FLOOR - 11;
    fn++;
  }

  /** A tap: blow out the spark it's on, or light the fuse at its nearest unburnt bit. */
  function act(x: number, y: number) {
    const m = S[K.MODE]!;
    if (m >= M.BOOM) return;
    for (let s = 0; s < SP; s++) {
      if (KST[s] !== P.LIT) continue;
      const i = KS[s]! | 0;
      if (hypot(FX[i]! - x, FY[i]! - y) < 9) {
        // FFT: out. A stub may sputter back.
        KST[s] = P.EMBER;
        KT[s] = 0;
        KBACK[s] = rnd() < 0.3 ? 1 : 0;
        say(0, FX[i]!, FY[i]! - 12);
        for (let j = 0; j < 4; j++) bit(FX[i]!, FY[i]! - 1, (rnd() - 0.5) * 10, -12 - rnd() * 10, 1);
        return;
      }
    }
    let best = -1, bd = 1e9;
    for (let i = 0; i < fn - 1; i++) {
      if (BURNT[i]) continue;
      const d = hypot(FX[i]! - x, (FY[i]! - y) * 1.6);
      if (d < bd) (bd = d), (best = i);
    }
    if (best < 0) return;
    for (let s = 0; s < SP; s++)
      if (KST[s] === P.OFF) {
        KST[s] = P.LIT;
        KS[s] = best;
        KT[s] = 0;
        BURNT[best] = 1;
        for (let j = 0; j < 5; j++) bit(FX[best]!, FY[best]!, (rnd() - 0.5) * 50, -20 - rnd() * 30, 0);
        return;
      }
  }

  /** The bundle goes up: flash, shake, the notice jumps, every spark is blown away. */
  function boom() {
    S[K.BOOMS] = S[K.BOOMS]! + 1;
    S[K.FLASH] = 0.1;
    S[K.SHAKE] = 0.45;
    S[K.HY] = 0;
    S[K.HV] = -150;
    S[K.BUND] = -1;
    to(M.BOOM);
    say(2, BX - 6, FLOOR - 62);
    for (let s = 0; s < SP; s++) KST[s] = P.OFF;
    for (let i = 0; i < fn; i++) BURNT[i] = 1;
    for (let j = 0; j < 14; j++) {
      const a = -3.1416 * rnd();
      bit(BX, FLOOR - 6, cos(a) * (40 + rnd() * 60), sin(a) * (50 + rnd() * 60), 0);
    }
    for (let i = 0; i < n; i++) {
      const cx = EX[i]! + EW[i]! / 2, cy = EY[i]! + EH[i]!, d = hypot(cx - BX, (cy - FLOOR + 6) * 1.3);
      if (d > 70) continue;
      const p = 1 - d / 70;
      VY[i] = VY[i]! - (90 + 160 * p);
      VR[i] = VR[i]! + (cx < BX ? -1 : 1) * (200 + 500 * p);
      HOT[i] = 1 + p;
    }
  }

  engine.add({
    read() {
      if (!S[K.RES]) return;
      S[K.RES] = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        EX[i] = x * k;
        EY[i] = y * k;
        EW[i] = el.offsetWidth * k;
        EH[i] = el.offsetHeight * k;
      }
      // A new layout lays the fuse again (what was burnt stays burnt, by share of its length).
      const was = fn;
      lay(k);
      if (was && was !== fn) {
        for (let s = 0; s < SP; s++) KS[s] = min(fn - 1, (KS[s]! * fn) / was);
      }
      S[K.DIRTY] = 1;
    },
    step(e, dt) {
      let busy = false;
      S[K.T] = S[K.T]! + dt;
      if (S[K.AUTO]! > 0) {
        busy = true;
        // The intro: someone lights it near the end. He'll never know who.
        if ((S[K.AUTO] = S[K.AUTO]! - dt) <= 0) act(FX[fn - 62]!, FY[fn - 62]!);
      }
      if (S[K.QN]) (S[K.QN] = 0), act(S[K.QX]!, S[K.QY]!);
      // The sparks.
      let rem = 1e9;
      for (let s = 0; s < SP; s++) {
        const st = KST[s]!;
        if (st === P.OFF) continue;
        busy = true;
        KT[s] = KT[s]! + dt;
        if (st === P.EMBER) {
          if (KBACK[s] && KT[s]! > 0.9) (KST[s] = P.LIT), (KT[s] = 0), say(1, FX[KS[s]! | 0]!, FY[KS[s]! | 0]! - 12);
          else if (!KBACK[s] && KT[s]! > 0.7) (KST[s] = P.OFF), (S[K.SAVED] = S[K.SAVED]! + 1);
          continue;
        }
        // Lit: fizzing along, faster in spurts.
        const a = KS[s]!, v = SPEED * (1 + 0.6 * sin(KT[s]! * 11 + s * 2)), b = a + v * dt;
        const i0 = a | 0, i1 = min(fn - 1, b | 0);
        for (let i = i0 + 1; i <= i1; i++) {
          if (BURNT[i]) {
            // A gap already burnt: it fizzles out here.
            KST[s] = P.OFF;
            say(6, FX[i0]!, FY[i0]! - 12);
            bit(FX[i0]!, FY[i0]!, 0, -14, 1);
            break;
          }
          BURNT[i] = 1;
          // Under a letter: it hops off the heat.
          for (let j = 0; j < n; j++)
            if (abs(EY[j]! + EH[j]! + 1 - FY[i]!) < 2.5 && abs(EX[j]! + EW[j]! / 2 - FX[i]!) < 0.5 && OY[j]! > -1) (VY[j] = -55 - rnd() * 20), (VR[j] = (rnd() - 0.5) * 160), (HOT[j] = 0.5);
        }
        if (KST[s] !== P.LIT) continue;
        KS[s] = b;
        if (rnd() < dt * 18) bit(FX[i1]!, FY[i1]!, (rnd() - 0.5) * 40, -10 - rnd() * 30, 0);
        if (b >= fn - 1) {
          KST[s] = P.OFF;
          boom();
          break;
        }
        rem = min(rem, fn - 1 - b);
      }
      // PLUM: asleep until a spark gets close; then the take, the look at you, the gulp.
      const m = S[K.MODE]!, t = S[K.T]!;
      if (m <= M.CAMERA || m === M.PHEW) {
        const want = rem < 14 ? M.CAMERA : rem < 34 ? M.TAKE : rem < 70 ? M.WAKE : -1;
        if (want > m || (want >= 0 && m === M.PHEW)) to(want), want === M.CAMERA && say(5, PX, FLOOR - 36);
        else if (want < 0 && m > M.SLEEP && m !== M.PHEW) to(M.PHEW), say(3, PX, FLOOR - 36);
        else if (m === M.PHEW && t > 1.2) to(M.SLEEP);
      } else if (m === M.BOOM && t > 0.5) to(M.SOOT);
      else if (m === M.SOOT) {
        // The hat comes down; he blinks twice; a cough.
        if (t > 1.5 && t - dt <= 1.5) say(4, PX - 4, FLOOR - 36), bit(PX - 5, FLOOR - 10, -8, -10, 1), bit(PX - 6, FLOOR - 9, -14, -6, 1);
        if (t > 2.1) {
          to(M.CLEAN);
          for (let j = 0; j < 12; j++) bit(PX - 5 + rnd() * 10, FLOOR - 14 + rnd() * 12, (rnd() - 0.5) * 20, rnd() * 10, 2);
        }
      } else if (m === M.CLEAN && t > 1.1) to(M.RELAY), (S[K.GROW] = fn - 1), (S[K.BUND] = -40), (S[K.BV] = 0);
      else if (m === M.RELAY) {
        // A new bundle drops in; the fuse rolls back out from it, along every line.
        if (S[K.BUND]! < 0) (S[K.BV] = S[K.BV]! + 400 * dt), (S[K.BUND] = min(0, S[K.BUND]! + S[K.BV]! * dt));
        if (S[K.GROW]! >= 0) {
          const g1 = max(-1, S[K.GROW]! - 300 * dt);
          for (let i = S[K.GROW]! | 0; i > g1; i--) BURNT[i] = 0;
          S[K.GROW] = g1 < 0 ? -1 : g1;
        }
        if (S[K.GROW]! < 0 && !S[K.BUND] && t > 1.4) to(M.SLEEP);
      }
      if (S[K.MODE] !== M.SLEEP || S[K.T]! < 0.1) busy = true;
      // The hat, blown up, comes down.
      if (S[K.HV] !== 0 || S[K.HY]! < 0) {
        S[K.HV] = S[K.HV]! + 300 * dt;
        S[K.HY] = S[K.HY]! + S[K.HV]! * dt;
        if (S[K.HY]! >= 0 && S[K.HV]! > 0) (S[K.HY] = 0), (S[K.HV] = S[K.HV]! > 60 ? -S[K.HV]! * 0.3 : 0);
        busy = true;
      }
      // Bits.
      for (let b = 0; b < NB; b++) {
        if (BA[b]! >= 0.9) continue;
        BA[b] = BA[b]! + dt;
        const k = BK[b]!;
        BVY[b] = BVY[b]! + (k === 1 ? -20 : k === 2 ? 160 : 90) * dt;
        BXs[b] = BXs[b]! + BVX[b]! * dt;
        BYs[b] = min(FLOOR - 1, BYs[b]! + BVY[b]! * dt);
        busy = true;
      }
      // The notice: hops fall back, tilts spring home, heat cools.
      for (let i = 0; i < n; i++) {
        if (OY[i] || VY[i] || RO[i] || VR[i]) {
          VY[i] = VY[i]! + (230 * -OY[i]! - 9 * VY[i]!) * dt;
          OY[i] = OY[i]! + VY[i]! * dt;
          VR[i] = VR[i]! + (160 * -RO[i]! - 8 * VR[i]!) * dt;
          RO[i] = RO[i]! + VR[i]! * dt;
          if (abs(OY[i]!) + abs(VY[i]!) < 0.2 && abs(RO[i]!) + abs(VR[i]!) < 0.3) OY[i] = VY[i] = RO[i] = VR[i] = 0;
          busy = true;
        }
        if (HOT[i]! > 0) (HOT[i] = max(0, HOT[i]! - dt)), (busy = true);
      }
      if (S[K.SHAKE]! > 0) (S[K.SHAKE] = S[K.SHAKE]! - dt), (busy = true);
      if (S[K.FLASH]! > 0) (S[K.FLASH] = S[K.FLASH]! - dt), (busy = true);
      if (S[K.WT]! < 1.1) (S[K.WT] = S[K.WT]! + dt), (busy = true);
      if (busy) e.busy(), (S[K.DIRTY] = 1);
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, y = max(-30, min(30, round(OY[i]!))), r = max(-60, min(60, round(RO[i]!))), h = HOT[i]! > 0 ? 1 : 0;
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", YS[y + 30]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", RS[r + 60]!) : L.unstyle(el, "--r");
        if (h !== LH[i]) (LH[i] = h), L.attr(el, "data-hot", h ? "" : null);
      }
      // The page shakes with the blast.
      const sk = S[K.SHAKE]! > 0 ? round(S[K.SHAKE]! * 14) : 0, sx = sk ? (sk & 1 ? 1 : -1) * min(3, sk) : 0;
      if (sx) L.style(wrap, "--sx", YS[sx + 30]!), L.style(wrap, "--sy", YS[(sk & 2 ? 1 : -1) + 30]!);
      else L.unstyle(wrap, "--sx"), L.unstyle(wrap, "--sy");
      if (!S[K.DIRTY]) return;
      S[K.DIRTY] = 0;
      draw(sx);
    },
  });

  /** A filled pixel disc. */
  function disc(x: number, y: number, r: number, c: string) {
    g.fillStyle = c;
    for (let j = -r; j <= r; j++) {
      const w = round(sqrt(r * r - j * j));
      g.fillRect(round(x) - w, round(y) + j, w * 2 + 1, 1);
    }
  }

  function draw(ox: number) {
    g.setTransform(1, 0, 0, 1, ox, 0);
    g.clearRect(-4, 0, W + 8, H);
    // The ground: a dark band, the score on it (bottom left: the gallery says TAP TO PLAY bottom right).
    g.fillStyle = C.rim;
    g.fillRect(-4, FLOOR, W + 8, H - FLOOR);
    g.fillStyle = C.line;
    g.fillRect(-4, FLOOR, W + 8, 1);
    print(g, "SAVED", 3, FLOOR + 3, C.muted);
    print(g, DIG[min(99, S[K.SAVED]!)]!, 25, FLOOR + 3, C.go);
    print(g, "BOOMS", 36, FLOOR + 3, C.muted);
    print(g, DIG[min(99, S[K.BOOMS]!)]!, 58, FLOOR + 3, C.attack);
    // The fuse: a twisted cord where it's whole, a trail of ash where it burnt.
    for (let i = 0; i < fn; i++) {
      const x = round(FX[i]!), y = round(FY[i]!);
      if (BURNT[i]) {
        if (i % 3 === 0 && S[K.MODE] !== M.RELAY) (g.fillStyle = C.line), g.fillRect(x, y, 1, 1);
      } else (g.fillStyle = i % 4 < 2 ? C.muted : C.ink), g.fillRect(x, y, 1, 1);
    }
    // The bundle (gone after a boom; a new one drops in with the new fuse).
    const m = S[K.MODE]!, t = S[K.T]!;
    if (S[K.BUND]! >= 0 || m === M.RELAY) art.draw(g, "dyna", 0, BX, FLOOR + round(S[K.BUND]!), 0, 1);
    // PLUM.
    let f = F.blink, pal = 0, hy = 0;
    if (m === M.WAKE) f = F.stand + F.left;
    else if (m === M.TAKE) (f = F.take + F.left), (hy = -3);
    else if (m === M.CAMERA || m === M.PHEW || m === M.CLEAN || m === M.RELAY) f = F.look;
    else if (m === M.BOOM || m === M.SOOT) (f = (m === M.SOOT && ((t > 0.7 && t < 0.82) || (t > 1.05 && t < 1.17))) ? F.blink : F.look), (pal = 2);
    const jy = m === M.TAKE ? -max(0, round(min(t, 0.3 - t) * 30)) : 0;
    g.fillStyle = C.line;
    g.fillRect(PX - 6, FLOOR, 12, 1);
    art.draw(g, "plum", f, PX, FLOOR + jy, 0, 1, pal);
    art.draw(g, "hat", 0, PX, FLOOR + jy + HAT_Y(f) + hy + round(S[K.HY]!), 0, 1);
    if (m === M.SLEEP) {
      // A Z, then a smaller one.
      g.fillStyle = C.ink;
      zee(PX + 8, FLOOR - 21, 3);
      zee(PX + 13, FLOOR - 26, 2);
    }
    if (m === M.TAKE) take(g, PX, FLOOR + jy - 24, C.ink);
    if (m === M.CAMERA || m === M.PHEW) {
      // A bead of sweat.
      g.fillStyle = C.sys;
      const sy = FLOOR - 13 + (m === M.PHEW ? round(t * 8) % 6 : 0);
      g.fillRect(PX + 6, sy, 1, 2), g.fillRect(PX + 7, sy + 1, 1, 2);
    }
    if (m === M.CLEAN && t > 0.4) grawlix(g, PX - 14, FLOOR - 28, t - 0.4);
    // The sparks: a fizzing star, or a glowing ember.
    for (let s = 0; s < SP; s++) {
      const st = KST[s]!;
      if (st === P.OFF) continue;
      const i = min(fn - 1, KS[s]! | 0), x = round(FX[i]!), y = round(FY[i]!);
      if (st === P.EMBER) {
        g.fillStyle = (round(KT[s]! * 12) & 1) && KBACK[s] ? C.hurt : C.attack;
        g.fillRect(x, y, 1, 1);
        continue;
      }
      const k = round(KT[s]! * 24) & 3, r = 1 + (k & 1);
      g.fillStyle = C.attack;
      g.fillRect(x - r - 1, y, r * 2 + 3, 1), g.fillRect(x, y - r - 1, 1, r * 2 + 3);
      g.fillStyle = C.hurt;
      g.fillRect(x - 1, y - 1, 3, 3);
      if (k > 1) g.fillRect(x - 2, y - 2, 1, 1), g.fillRect(x + 2, y + 2, 1, 1), g.fillRect(x + 2, y - 2, 1, 1), g.fillRect(x - 2, y + 2, 1, 1);
      g.fillStyle = C.ink;
      g.fillRect(x, y, 1, 1);
    }
    // The blast: a white flash, a fireball that swells into smoke.
    if (m === M.BOOM) {
      const u = min(1, t / 0.5), r = round(8 + sqrt(u) * 22);
      disc(BX, FLOOR - 8, r + 2, C.rim);
      disc(BX, FLOOR - 8, r, u < 0.4 ? C.ink : C.hurt);
      disc(BX + round(r * 0.3), FLOOR - 10, round(r * 0.6), u < 0.4 ? C.hurt : C.attack);
      disc(BX - round(r * 0.4), FLOOR - 6 - round(r * 0.3), round(r * 0.45), u < 0.5 ? C.hurt : C.line);
    } else if (m === M.SOOT && t < 0.6) {
      const r = round(22 * (1 - t / 0.6));
      if (r > 1) disc(BX, FLOOR - 8 - round(t * 20), r, C.line);
    }
    for (let b = 0; b < NB; b++) {
      const a = BA[b]!;
      if (a >= 0.9) continue;
      const k = BK[b]!, x = round(BXs[b]!), y = round(BYs[b]!);
      if (k === 0) (g.fillStyle = a < 0.3 ? C.ink : C.hurt), g.fillRect(x, y, 1, 1);
      else if (k === 1) {
        const r = 1 + round(a * 2);
        g.fillStyle = C.line;
        g.fillRect(x - r, y - r, r * 2, r * 2);
        g.fillStyle = C.muted;
        g.fillRect(x - r + 1, y - r, r * 2 - 2, 1);
      } else (g.fillStyle = C.rim), g.fillRect(x, y, 2, 1);
    }
    if (S[K.FLASH]! > 0) (g.fillStyle = C.ink), g.fillRect(-4, 0, W + 8, H);
    const wt = S[K.WT]!;
    if (wt < 0.8) shout(g, WORDS[S[K.WORD]!]!, S[K.WX]!, S[K.WY]! - (wt < 0.05 ? 2 : 0), S[K.WORD] === 2 ? (wt < 0.06 ? 4 : 3) : 2, S[K.WORD] === 2 ? C.hurt : C.ink, S[K.WORD] === 2 ? C.attack : C.cmd);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  /** A pixel Z, s wide. */
  function zee(x: number, y: number, s: number) {
    g.fillRect(x, y, s, 1);
    for (let j = 1; j < s - 1; j++) g.fillRect(x + s - 1 - j, y + j, 1, 1);
    g.fillRect(x, y + s - 1, s, 1);
  }

  engine.start();
  return {
    engine,
    tap,
    get fuse() {
      return { fx: FX, fy: FY, n: fn };
    },
    get sparks() {
      const out: number[] = [];
      for (let s = 0; s < SP; s++) if (KST[s] === P.LIT) out.push(KS[s]!);
      return out;
    },
    get saved() {
      return S[K.SAVED]!;
    },
    get booms() {
      return S[K.BOOMS]!;
    },
    get mode() {
      return S[K.MODE]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  the spark a breath from the bundle and PLUM looking right at you (scripts/gallery-posters.mjs). */
export const posterAt = 2.95;

/** For `slot(fig, () => import("./fuse-burns-along-text-lines").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => shortFuse(stage, slot, first);
