// #49 SMASH: a rage giant on a shop page called FRAGILE. Click anything and KRUNCH leaps up over it,
// fists high, and slams down: the real letters and buttons he hits crumble into chunks of
// themselves (baked once from the element's own font and colours) that fly, bounce and pile up on
// the floor. He lands in a ground pound: the page shakes, a wave rolls along the floor, the letters
// it reaches jump and the rubble hops. Each smash winds his rage up a notch (his skin goes from calm
// stone to red, the smashes get wider); at full rage the next one is a SMAAASH that brings the
// whole page down. Leave him be, or show him the flower he will never smash, and he calms down and
// sits, and every chunk flies home: the page puts itself back together. The steel SECURE badge
// does not break: CLANG, and he sits there seeing stars.
// Bricks: the kernel (fixed step, settle: it sleeps once the page is whole and he is calm; its
// ledger for every page write, so Recall gives the page back byte for byte) and fizlet/sprite (the
// giant, the flower, the heart, baked once). Shared with #50: the giant (krunch.ts).
import { createEngine } from "../../../src/kernel/index";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { C, HEAD_Y, KRUNCH, RAGE, print, shout, textW } from "./krunch";

export type SmashScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; readonly rage: number; readonly broken: number };

const { abs, ceil, cos, hypot, max, min, round, sin } = Math;
const W = 160, H = 90, FLOOR = 82, CAP = 1200, MAX = 5, FX = 147, FLAT = 0.35;
// Giant modes.
const IDLE = 0, LEAP = 1, SLAM = 2, POUND = 3, BOUNCE = 4, DIZZY = 5, AWW = 6, ROAR = 7, SIT = 8;
// What a tap is on.
const NONE = 0, EL = 1, SAFE = 2, FLOWER = 3;
// State slots.
const MODE = 0, T = 1, GX = 2, GY = 3, VY = 4, X0 = 5, TX = 6, TY = 7, KIND = 8, TE = 9, RAGE_ = 10, IDLE_T = 11, QX = 12, QY = 13, Q = 14;
const SHAKE = 15, WR = 16, WX = 17, WP = 18, WN = 19, WORD = 20, WT = 21, WWX = 22, WWY = 23, MEGA = 24, DIRTY = 25, AUTO = 26, HIT = 27, FLASH = 28, RES = 29, NW = 30, BROKE = 31;
// Values for the page, made once (art px → cqw: the stage is a size container).
const YS = Array.from({ length: 81 }, (_, i) => `${(i - 60) * 0.625}cqw`);
const RS = Array.from({ length: 61 }, (_, i) => `${i - 30}deg`);
const SH = Array.from({ length: 9 }, (_, i) => `${(i - 4) * 0.625}cqw`);
const PCT = Array.from({ length: 101 }, (_, i) => `PAGE ${i}%`);
const WORDS = ["SMASH!", "KRUNCH!", "WHAM!", "BOOM!", "SMAAASH!", "CLANG!", "AWW", "HUFF", "RAWR!"];

const FLOWER_ART = { frames: [".w.w.", "wwyww", ".www.", "..g..", "g.g..", ".gg.g", "..gg.", "ppppp", ".ppp.", ".ppp."], colors: { w: C.ink, y: C.hurt, g: C.go, p: C.attack }, outline: C.rim, ax: 2, ay: 10 };
const HEART = { frames: [".kk.kk.", "kkkkkkk", "kkkkkkk", ".kkkkk.", "..kkk..", "...k..."], colors: { k: C.attack }, outline: C.rim, ax: 3, ay: 6 };

export function smash(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SmashScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: 49 });
  const L = engine.ledger, rnd = engine.random;
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const g = canvas.getContext("2d")!;
  const art = sprites({ ...KRUNCH, flower: FLOWER_ART, heart: HEART }, { palettes: RAGE });
  const S = new Float64Array(32);
  S[GX] = 18;
  S[GY] = FLOOR;
  S[WR] = -1;
  S[WT] = 9;
  S[RES] = S[DIRTY] = 1;
  S[AUTO] = first ? 0 : 0.5;

  // The page: every letter, word and button; its box (art px), its baked look, its hop.
  const wrap = slot.querySelector<HTMLElement>(".sm49")!, els = [...wrap.querySelectorAll<HTMLElement>("i")], n = els.length;
  const EX = new Float32Array(n), EY = new Float32Array(n), EW = new Float32Array(n), EH = new Float32Array(n);
  const OY = new Float32Array(n), OV = new Float32Array(n), RO = new Float32Array(n), RV = new Float32Array(n), LIT = new Float32Array(n);
  const GONE = new Uint8Array(n), LEFT = new Int16Array(n), WAVE = new Int16Array(n), LY = new Int16Array(n), LR = new Int16Array(n), LG = new Uint8Array(n), LL = new Uint8Array(n);
  const IMG: HTMLCanvasElement[] = [];
  const safe = els.findIndex((e) => e.classList.contains("sm49-safe"));
  // Chunks: where, how fast, whose, which piece of it (source x, y, size), and the way home.
  const KX = new Float32Array(CAP), KY = new Float32Array(CAP), KVX = new Float32Array(CAP), KVY = new Float32Array(CAP), KU = new Float32Array(CAP);
  const KA = new Float32Array(CAP), KB = new Float32Array(CAP), KD = new Float32Array(CAP), KE = new Int16Array(CAP), KS = new Uint8Array(CAP), KSX = new Uint8Array(CAP), KSY = new Uint8Array(CAP);
  let kn = 0;
  // The rubble's top, per art column (chunks pile up on each other).
  const PILE = new Float32Array(W);

  const ro = new ResizeObserver(() => ((S[RES] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  const to = (m: number) => ((S[MODE] = m), (S[T] = 0));
  const tap = (x: number, y: number) => ((S[QX] = x), (S[QY] = y), (S[Q] = 1), engine.wake());
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  stage.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    const r = stage.getBoundingClientRect(); // one read per tap, outside any frame
    tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }, { signal: engine.signal });

  /** Bake element i's look at art scale (its own font and colours), snapped to whole pixels. */
  function bake(i: number, k: number) {
    const el = els[i]!, cs = getComputedStyle(el), w = max(1, round(EW[i]!)), h = max(1, round(EH[i]!));
    const c = (IMG[i] ??= document.createElement("canvas")), x = c.getContext("2d")!;
    c.width = w;
    c.height = h;
    const bg = cs.backgroundColor, sh = /rgb[^)]*\)/.exec(cs.textShadow);
    if (bg !== "rgba(0, 0, 0, 0)") (x.fillStyle = C.rim), x.fillRect(0, 0, w, h), (x.fillStyle = bg), x.fillRect(1, 1, w - 2, h - 2);
    x.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (sh) (x.fillStyle = sh[0]), x.fillText(el.textContent!, w / 2 + 1, h / 2 + 2);
    x.fillStyle = cs.color;
    x.fillText(el.textContent!, w / 2, h / 2 + 1);
    const d = x.getImageData(0, 0, w, h);
    for (let p = 3; p < d.data.length; p += 4) d.data[p] = d.data[p]! > 110 ? 255 : 0;
    x.putImageData(d, 0, 0);
  }

  /** Element i breaks: hidden on the page, and in its place, chunks of it fly from (px, py). */
  function crumble(i: number, px: number, py: number, power: number) {
    if (GONE[i] || i === safe) return;
    GONE[i] = 1;
    LIT[i] = 0;
    S[BROKE] = S[BROKE]! + 1;
    const c = IMG[i]!, d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data, s = c.height > 12 ? 3 : 2;
    for (let y = 0; y < c.height; y += s)
      for (let x = 0; x < c.width; x += s) {
        if (kn >= CAP || !d[(y * c.width + x + (s >> 1)) * 4 + 3] && !d[((y + (s >> 1)) * c.width + x) * 4 + 3]) continue;
        const k = kn++, cx = EX[i]! + x, cy = EY[i]! + y, dx = cx - px;
        KX[k] = cx;
        KY[k] = cy;
        KVX[k] = dx * (2 + rnd() * 3) + (rnd() - 0.5) * 50 * power;
        KVY[k] = -30 - rnd() * 70 * power + (cy - py) * 2;
        KE[k] = i;
        KS[k] = s;
        KSX[k] = x;
        KSY[k] = y;
        KU[k] = -1;
        KD[k] = 0;
        LEFT[i] = LEFT[i]! + 1;
      }
  }

  /** Every broken element's chunks start home, left to right, after `wait` s. */
  function rebuild(wait: number) {
    PILE.fill(0);
    for (let k = 0; k < kn; k++) if (KU[k]! < 0 && KU[k] !== -3) KD[k] = wait + EX[KE[k]!]! * 0.006 + rnd() * 0.12;
  }

  /** The giant leaps for (x, y): above it, fists up, then down. */
  function go(kind: number, x: number, y: number, e: number) {
    S[KIND] = kind;
    S[TE] = e;
    S[TX] = max(16, min(W - 16, x));
    S[TY] = y;
    S[X0] = S[GX]!;
    S[T] = 0;
    S[MODE] = LEAP;
    S[MEGA] = kind !== FLOWER && S[RAGE_]! >= MAX ? 1 : 0;
    if (S[MEGA]) (S[TX] = 80), (S[TY] = FLOOR), (S[KIND] = NONE);
    if (kind === FLOWER) (S[TX] = FX - 21), (S[TY] = FLOOR);
  }

  /** What a tap at (x, y) is on, and the giant's answer. */
  function decide(x: number, y: number) {
    S[IDLE_T] = 0;
    if (abs(x - FX) < 6 && y > FLOOR - 13 && y < FLOOR + 3) return go(FLOWER, x, y, -1);
    let best = -1;
    for (let i = 0; i < n; i++)
      if (!GONE[i] && x > EX[i]! - 2 && x < EX[i]! + EW[i]! + 2 && y > EY[i]! - 2 && y < EY[i]! + EH[i]! + 2) best = i;
    if (best < 0) {
      if (abs(x - S[GX]!) < 14 && y > S[GY]! - 31 && y < S[GY]! + 2) {
        S[MODE] = ROAR;
        S[T] = 0;
        return say(8, S[GX]!, S[GY]! - 44);
      }
      return go(NONE, x, FLOOR, -1);
    }
    go(best === safe ? SAFE : EL, EX[best]! + EW[best]! / 2, EY[best]!, best);
  }

  function say(w: number, x: number, y: number) {
    S[WORD] = w;
    S[WT] = 0;
    S[WWX] = max(textW(WORDS[w]!, 4) / 2 + 2, min(W - textW(WORDS[w]!, 4) / 2 - 2, x));
    S[WWY] = max(3, min(FLOOR - 20, y));
  }

  /** The ground pound at x: the shake, the wave along the floor. */
  function pound(x: number) {
    const r = S[RAGE_]!, mega = S[MEGA]!;
    S[SHAKE] = mega ? 0.6 : 0.18 + r * 0.05;
    S[WR] = 1;
    S[WX] = x;
    S[WP] = mega ? 3 : 1 + r * 0.35;
    S[WN] = S[WN]! + 1;
    if (mega) (S[FLASH] = 0.12), say(4, 80, 14);
  }

  engine.add({
    read() {
      if (!S[RES]) return;
      S[RES] = 0;
      const k = W / (wrap.clientWidth || 1);
      for (let i = 0; i < n; i++) {
        const el = els[i]!;
        let x = 0, y = 0;
        for (let a: HTMLElement | null = el; a && a !== wrap; a = a.offsetParent as HTMLElement | null) (x += a.offsetLeft), (y += a.offsetTop);
        EX[i] = round(x * k);
        EY[i] = round(y * k);
        EW[i] = el.offsetWidth * k;
        EH[i] = el.offsetHeight * k;
        bake(i, k);
      }
      S[DIRTY] = 1;
    },
    step(e, dt) {
      let busy = S[AUTO]! > 0;
      const m = S[MODE]!, t = (S[T] = S[T]! + dt);
      if (S[AUTO]! > 0 && (S[AUTO] = S[AUTO]! - dt) <= 0) decide(EX[3]! + 4, EY[3]! + 6); // the G
      if (S[Q] && (m === IDLE || m === SIT)) (S[Q] = 0), decide(S[QX]!, S[QY]!);
      if (m !== IDLE) busy = true;
      if (m === LEAP) {
        // Up and over the target: a quick crouch, then an arc to above it, fists high.
        // (Raised fists hover just over the target: the swing down goes through it.)
        const u = min(1, max(0, t - 0.08) / 0.42), fl = S[KIND] === FLOWER;
        const top = S[MEGA] ? 32 : S[KIND] === NONE ? FLOOR - 24 : min(FLOOR - 18, S[TY]! + 14);
        S[GX] = S[X0]! + (S[TX]! - S[X0]!) * (1 - (1 - u) * (1 - u));
        S[GY] = t < 0.08 ? FLOOR + 1 : fl ? FLOOR - sin(u * 3.1416) * 14 : FLOOR + (top - FLOOR) * sin(u * 1.5708);
        if (u >= 1 && t > (S[MEGA] ? 0.85 : 0.62)) (S[MODE] = fl ? AWW : SLAM), (S[T] = 0), (S[VY] = 40), (S[HIT] = 0);
      } else if (m === SLAM) {
        // The swing lands at once; a beat of hit-stop; then he drops to the floor.
        if (t > 0.07) (S[VY] = S[VY]! + 1500 * dt), (S[GY] = min(FLOOR, S[GY]! + S[VY]! * dt));
        if (!S[HIT] && S[KIND] !== NONE) {
          S[HIT] = 1;
          const x = S[TX]!, y = S[TY]!;
          if (S[KIND] === SAFE) {
            // CLANG: steel. The fists bounce, the badge rings, the giant goes flying and sees stars.
            S[MODE] = BOUNCE;
            S[VY] = -170;
            S[SHAKE] = 0.15;
            S[RAGE_] = max(0, S[RAGE_]! - 2);
            OV[safe] = 40;
            RV[safe] = 300;
            LIT[safe] = 0.3;
            say(5, x, y - 18);
          } else {
            // The smash: what's under the fists (and, the angrier he is, around them) crumbles.
            const r = 2 + S[RAGE_]! * 5;
            for (let i = 0; i < n; i++) {
              const nx = max(EX[i]!, min(EX[i]! + EW[i]!, x)), ny = max(EY[i]!, min(EY[i]! + EH[i]!, y));
              if (i === S[TE] || hypot(nx - x, ny - y) < r) crumble(i, x, y, 1 + S[RAGE_]! * 0.3);
            }
            S[SHAKE] = 0.1;
            say(S[NW]!, x, y - 10);
            S[NW] = (S[NW]! + 1) % 4;
          }
        }
        if (S[GY]! >= FLOOR) {
          S[GY] = FLOOR;
          S[MODE] = POUND;
          S[T] = 0;
          if (S[KIND] === NONE && !S[MEGA]) say(S[NW]!, S[GX]!, FLOOR - 46), (S[NW] = (S[NW]! + 1) % 4);
          pound(S[GX]!);
          if (S[KIND] !== SAFE) S[RAGE_] = min(MAX, S[RAGE_]! + 1);
        }
      } else if (m === BOUNCE) {
        S[VY] = S[VY]! + 900 * dt;
        S[GY] = min(FLOOR, S[GY]! + S[VY]! * dt);
        S[GX] = S[GX]! + (S[GX]! < 80 ? -30 : 30) * dt;
        if (S[GY] === FLOOR && S[VY]! > 0) to(DIZZY), pound(S[GX]!);
      } else if (m === POUND && t > (S[MEGA] ? 0.9 : 0.4)) {
        if (S[MEGA]) to(SIT), (S[RAGE_] = 0), say(7, S[GX]!, FLOOR - 42), rebuild(0.8);
        else to(IDLE);
        S[MEGA] = 0;
      } else if (m === DIZZY && t > 1.6) to(IDLE);
      else if (m === ROAR && t > 0.7) to(IDLE), (S[RAGE_] = min(MAX, S[RAGE_]! + 1));
      else if (m === AWW) {
        // He lands by the flower, fists up… and stops. A heart; the rage drains; he sits.
        if (S[GY]! < FLOOR) S[GY] = min(FLOOR, S[GY]! + 120 * dt);
        if (t > 0.5 && S[WORD] !== 6) say(6, S[GX]! - 14, FLOOR - 50), (S[RAGE_] = 0);
        if (t > 1.6) to(SIT), rebuild(0.1);
      } else if (m === SIT && t > 2.2 && !kn) to(IDLE);
      // Left alone, he calms down: a huff, he sits, the page comes home.
      if (S[MODE] === IDLE) {
        S[IDLE_T] = S[IDLE_T]! + dt;
        if (S[RAGE_]! > 0 || kn) {
          busy = true;
          if (S[IDLE_T]! > 3) to(SIT), (S[RAGE_] = 0), say(7, S[GX]!, FLOOR - 42), rebuild(0.4);
        }
      }
      // The wave along the floor: letters it reaches jump; rubble hops; at full rage, all of it breaks.
      if (S[WR]! >= 0) {
        const r = (S[WR] = S[WR]! + 150 * dt), x = S[WX]!, p = S[WP]!;
        for (let i = 0; i < n; i++) {
          if (WAVE[i] === S[WN]) continue;
          const d = hypot(max(EX[i]! - x, 0, x - EX[i]! - EW[i]!), (FLOOR - EY[i]! - EH[i]!) * FLAT);
          if (d > r) continue;
          WAVE[i] = S[WN]!;
          if (p === 3) crumble(i, x, FLOOR, 2.4);
          else if (!GONE[i]) (OV[i] = OV[i]! - (60 + 40 * p) * max(0.3, 1 - d / 160)), (RV[i] = RV[i]! + (rnd() - 0.5) * 200 * p);
        }
        for (let k = 0; k < kn; k++) if (KU[k] === -2 && abs(abs(KX[k]! - x) - r) < 3) (KU[k] = -1), (KVY[k] = -50 - rnd() * 40 * p), (KVX[k] = (rnd() - 0.5) * 30), (PILE[round(KX[k]!)] = 0);
        if (r > 170) S[WR] = -1;
        busy = true;
      }
      // The page: hops fall back, spins spring home.
      for (let i = 0; i < n; i++) {
        if (OY[i]! < 0 || OV[i]! !== 0) {
          OV[i] = OV[i]! + 500 * dt;
          OY[i] = OY[i]! + OV[i]! * dt;
          if (OY[i]! >= 0) (OY[i] = 0), (OV[i] = OV[i]! > 50 ? -OV[i]! * 0.3 : 0);
          busy = true;
        }
        RV[i] = RV[i]! + (-90 * RO[i]! - 9 * RV[i]!) * dt;
        RO[i] = RO[i]! + RV[i]! * dt;
        if (abs(RO[i]!) + abs(RV[i]!) < 0.3) RO[i] = RV[i] = 0;
        else busy = true;
        if (LIT[i]! > 0) (LIT[i] = LIT[i]! - dt), (busy = true);
      }
      // The chunks: fly, bounce, lie in the rubble; going home, an arc back to their place.
      for (let k = kn - 1; k >= 0; k--) {
        const i = KE[k]!;
        if (KU[k] === -3) continue;
        if (KU[k]! >= 0) {
          const u = min(1, (KU[k] = KU[k]! + dt / 0.55)), q = u * u * (3 - 2 * u), hx = EX[i]! + KSX[k]!, hy = EY[i]! + KSY[k]!;
          KX[k] = KA[k]! + (hx - KA[k]!) * q;
          KY[k] = KB[k]! + (hy - KB[k]!) * q - sin(u * 3.1416) * 14;
          if (u >= 1) {
            // Home: this chunk is done; its element comes back once all of its chunks are.
            KU[k] = -3;
            if (!(LEFT[i] = LEFT[i]! - 1)) (GONE[i] = 0), (OV[i] = -60), (LIT[i] = 0.25), (S[BROKE] = S[BROKE]! - 1) || (kn = 0);
          }
        } else {
          // -1 flying, -2 at rest in the pile.
          if (KU[k] === -1) {
            KVY[k] = KVY[k]! + 420 * dt;
            KX[k] = KX[k]! + KVX[k]! * dt;
            KY[k] = KY[k]! + KVY[k]! * dt;
            if (KX[k]! < 0 || KX[k]! > W - KS[k]!) (KVX[k] = -KVX[k]! * 0.5), (KX[k] = max(0, min(W - KS[k]!, KX[k]!)));
            const c = round(KX[k]!), f = FLOOR - KS[k]! - PILE[c]!;
            if (KY[k]! > f && KVY[k]! > 0) {
              KY[k] = f;
              if (KVY[k]! > 70) (KVY[k] = -KVY[k]! * 0.3), (KVX[k] = KVX[k]! * 0.6);
              else (KU[k] = -2), (PILE[c] = PILE[c]! + KS[k]! * 0.6), c && (PILE[c - 1] = max(PILE[c - 1]!, PILE[c]! - 2));
            }
            busy = true;
          }
          // Going home: after its wait, from wherever it lies.
          if (KD[k]! > 0 && (KD[k] = KD[k]! - dt) <= 0) (KU[k] = 0), (KA[k] = KX[k]!), (KB[k] = KY[k]!);
        }
        if (KD[k]! > 0 || KU[k]! >= 0) busy = true;
      }
      if (S[SHAKE]! > 0) (S[SHAKE] = S[SHAKE]! - dt), (busy = true);
      if (S[FLASH]! > 0) (S[FLASH] = S[FLASH]! - dt), (busy = true);
      if (S[WT]! < 1.1) (S[WT] = S[WT]! + dt), (busy = true);
      if (busy) (e.busy(), (S[DIRTY] = 1));
    },
    render() {
      for (let i = 0; i < n; i++) {
        const el = els[i]!, y = max(-60, min(20, round(OY[i]!))), r = max(-30, min(30, round(RO[i]!))), gn = GONE[i]!, lt = LIT[i]! > 0 ? 1 : 0;
        if (y !== LY[i]) (LY[i] = y), y ? L.style(el, "--y", YS[y + 60]!) : L.unstyle(el, "--y");
        if (r !== LR[i]) (LR[i] = r), r ? L.style(el, "--r", RS[r + 30]!) : L.unstyle(el, "--r");
        if (gn !== LG[i]) (LG[i] = gn), L.attr(el, "data-gone", gn ? "" : null);
        if (lt !== LL[i]) (LL[i] = lt), L.attr(el, "data-hit", lt ? "" : null);
      }
      // The whole page shakes on a pound (a few whole art px, decaying).
      const sk = S[SHAKE]! > 0 ? ceil(S[SHAKE]! * 12) : 0, sx = sk ? (sk & 1 ? min(4, sk) : -min(4, sk)) : 0;
      if (sx) L.style(wrap, "--sx", SH[sx + 4]!), L.style(wrap, "--sy", SH[(sk & 2 ? 1 : -1) + 4]!);
      else L.unstyle(wrap, "--sx"), L.unstyle(wrap, "--sy");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw(sx);
    },
  });

  function draw(ox: number) {
    g.clearRect(0, 0, W, H);
    // The floor: a dark footer band the giant stands on, its cracks fading.
    g.fillStyle = C.rim;
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.fillStyle = C.line;
    g.fillRect(0, FLOOR + 1, W, 1);
    print(g, PCT[round(((n - S[BROKE]!) / n) * 100)]!, W - 40, FLOOR + 3, C.muted);
    print(g, "RAGE", 3, FLOOR + 3, C.muted);
    for (let i = 0; i < MAX; i++) (g.fillStyle = i < S[RAGE_]! ? (i < 2 ? C.aim : i < 4 ? C.attack : C.red) : C.line), g.fillRect(20 + i * 5, FLOOR + 3, 4, 5);
    // The wave: a flat ring on the floor.
    if (S[WR]! >= 0) {
      const r = S[WR]!, x = S[WX]! + ox, p = S[WP]!;
      g.fillStyle = p >= 3 ? C.attack : C.sys;
      for (let q = -1; q <= 1; q += 2) for (let j = 0; j < 2 + p; j++) g.fillRect(round(x + q * (r - j * 3)), FLOOR - 1 - (j & 1), 2, 1 + (j & 1));
    }
    for (let k = 0; k < kn; k++) {
      const s = KS[k]!;
      if (KU[k] === -3) continue;
      g.drawImage(IMG[KE[k]!]!, KSX[k]!, KSY[k]!, s, s, round(KX[k]! + ox), round(KY[k]!), s, s);
    }
    // The flower, over the rubble.
    art.draw(g, "flower", 0, FX + ox, FLOOR, 0, 1);
    // KRUNCH: a pose and a face for the mode, in the colour of his rage.
    const m = S[MODE]!, t = S[T]!, r = S[RAGE_]!, x = S[GX]! + ox, y = round(S[GY]!);
    const body = m === LEAP ? (t < 0.08 ? 2 : 1) : m === SLAM || m === POUND ? (m === POUND && t > 0.25 ? 0 : 2) : m === ROAR || (m === AWW && t < 0.5) ? 1 : m === SIT ? 3 : 0;
    const face = m === DIZZY || m === BOUNCE ? 2 : m === AWW && t >= 0.5 ? 3 : m === SIT ? 1 : m === ROAR || m === LEAP || m === SLAM ? 4 : r ? 0 : 1;
    const pal = S[FLASH]! > 0 ? 4 : r >= MAX ? 3 : r >= 3 ? 2 : r ? 1 : 0;
    // His shadow under him, smaller the higher he is.
    const sw = max(3, 14 - round((FLOOR - y) / 6));
    g.fillStyle = C.line;
    g.fillRect(round(x) - sw, FLOOR - 1, sw * 2, 1);
    art.draw(g, "body", body, x, y, 0, 1, pal);
    art.draw(g, "head", face, x, y + HEAD_Y[body]! + (m === SIT && t < 0.3 ? 1 : 0), 0, 1, pal);
    // Stars round a dizzy head.
    if (m === DIZZY || m === BOUNCE) {
      g.fillStyle = C.hurt;
      for (let s = 0; s < 3; s++) {
        const a = t * 6 + s * 2.09, sx = round(x + cos(a) * 9), sy = round(y - 33 + sin(a) * 2);
        g.fillRect(sx - 1, sy, 3, 1);
        g.fillRect(sx, sy - 1, 1, 3);
      }
    }
    if (m === AWW && t > 0.5) art.draw(g, "heart", 0, x + 10, y - 34 - min(8, (t - 0.5) * 16), 0, 1);
    // The word of the moment: slams in big, settles, hangs, goes.
    const wt = S[WT]!;
    if (wt < 0.9) {
      const w = WORDS[S[WORD]!]!, k = (wt < 0.05 ? 3 : 2) + (S[WORD] === 4 ? 1 : 0);
      shout(g, w, S[WWX]! + ox, S[WWY]! - (wt < 0.05 ? 2 : 0), k, S[WORD]! >= 5 ? C.ink : C.hurt, S[WORD] === 5 ? C.muted : C.attack);
    }
  }

  engine.start();
  return {
    engine,
    tap,
    get rage() {
      return S[RAGE_]!;
    },
    get broken() {
      return S[BROKE]!;
    },
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): this scene at this second with no tap,
 *  KRUNCH high over the G of FRAGILE, fists up (scripts/gallery-posters.mjs draws it). */
export const posterAt = 1.05;

/** For `slot(fig, () => import("./rage-giant-smashes-page").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => smash(stage, slot, first);
