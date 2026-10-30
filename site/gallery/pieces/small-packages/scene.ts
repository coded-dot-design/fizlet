// Big things, small packages (gallery micro game). A pixel dev drags a package.json crate while
// dependencies keep raining onto it. Tap one to cut it: it shatters, the shards bounce off the
// floor, the stack and the dev, and what was above it drops. Cut them all and the crate shrinks to
// the Fizlet box, which flies to his hands with the kernel's real gzip size, measured at build
// (the figure's data-kernel-gzip; no number at all without it). Tap again to play again.
// Bricks: the kernel (fixed step, settle, 30 fps cap, the ledger), fizlet/collide (shards against
// the stack). Mounted through fizlet/slot: never under reduced motion (the poster is the joke,
// tap to shrink); every node it adds goes through the ledger, so Recall gives the page back.
import { createEngine } from "../../../../src/kernel/index";
import { circleRect } from "../../../../src/collide";
import type { SlotScene, SlotTap } from "../../../../src/slot";
import { BH, CAPTION, CAPTION_SMALL, CH, CW, CX, DARK, DX, EDGE, FACE, FLOOR, GO, H, K, LIGHT, NAMES, POPS, SAY, SHARDS, W, addBlock, bw, kernelLine, paint, restOf, world, type World } from "./world";

const G = 300; // gravity, art px a second²
const lut = (pal: string[]) => Uint32Array.from(pal, (h) => (0xff000000 | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16)) >>> 0);
const LUTS = [lut(DARK), lut(LIGHT)];

/** Start (or restart) a round: three dependencies on the crate, nine more on their way. */
export function reset(w: World) {
  const S = w.S;
  S.fill(0);
  w.n[0] = 0;
  w.pl.fill(0);
  w.ol.fill(0);
  for (let k = 0; k < 3; k++) addBlock(w, k, (k & 1 ? 3 : -2), NaN);
  S[K.Supply] = 9;
  S[K.Spawn] = 0.6;
  S[K.Dirty] = 1;
}

const DUST = 6, DUST2 = 3; // muted, floor line
/** n shards out of a rect (x, y, rw, rh) in colours a and b, flying away from (ax, ay). */
function burst(w: World, r: () => number, x: number, y: number, rw: number, rh: number, a: number, b: number, n: number, ax: number, ay: number, up: number) {
  for (let i = 0, j = 0; i < SHARDS && j < n; i++) {
    if (w.pl[i]! > 0) continue;
    j++;
    const sx = x + r() * rw, sy = y + r() * rh;
    w.px[i] = sx;
    w.py[i] = sy;
    w.vx[i] = (sx - ax) * 4 + (r() - 0.5) * 70;
    w.vy[i] = (sy - ay) * 3 - up - r() * 70;
    w.pl[i] = 1.6 + r() * 1.4;
    w.pc[i] = r() < 0.55 ? a : b;
    w.ps[i] = 1 + ((r() * 2.6) | 0);
  }
}

/** Cut the dependency nearest a tap (art px), if the tap is on the stack. True if one went. */
export function cut(w: World, r: () => number, x: number, y: number) {
  let best = -1, d = BH * 0.9;
  for (let i = 0; i < w.n[0]!; i++) {
    const e = Math.abs(w.by[i]! + BH / 2 - y);
    if (x > w.bx[i]! - 4 && x < w.bx[i]! + bw(w.bk[i]!) + 4 && e < d) (d = e), (best = i);
  }
  if (best < 0) return false;
  const k = w.bk[best]!, c = w.bc[best]!;
  burst(w, r, w.bx[best]!, w.by[best]!, bw(k), BH, FACE + c, EDGE + c, 40, x, y, 50);
  for (let i = 0; i < POPS; i++) if (w.ol[i]! <= 0) {
    w.ox[i] = w.bx[best]! + bw(k) / 2;
    w.oy[i] = w.by[best]!;
    w.ol[i] = 1;
    w.ok[i] = k;
    break;
  }
  for (let i = best; i < w.n[0]! - 1; i++) (w.bx[i] = w.bx[i + 1]!), (w.by[i] = w.by[i + 1]!), (w.bv[i] = w.bv[i + 1]!), (w.bk[i] = w.bk[i + 1]!), (w.bc[i] = w.bc[i + 1]!);
  w.n[0] = w.n[0]! - 1;
  w.S[K.Say] = Math.max(1, w.S[K.Say]!);
  return true;
}

/** One fixed step of the world. True while anything moves. */
export function tick(w: World, r: () => number, dt: number) {
  const S = w.S, ph = S[K.Phase]!;
  let busy = false, n = w.n[0]!, speed = 0;
  S[K.Time] = S[K.Time]! + dt;
  S[K.T] = S[K.T]! + dt;
  S[K.Idle] = S[K.Idle]! + dt;
  if (!S[K.Say] && S[K.Time]! > 2.6) S[K.Say] = 1;
  if (ph === 0) {
    // He pulls while there is a load and someone is playing (or it has just loaded).
    const pulling = S[K.Idle]! < 7;
    if (pulling) {
      busy = true;
      // New dependencies keep arriving (never past seven high) while the round's supply lasts.
      if (S[K.Supply]! > 0 && n < 7 && (S[K.Spawn] = S[K.Spawn]! - dt) <= 0) {
        addBlock(w, (12 - S[K.Supply]!) % NAMES.length, (r() - 0.5) * 8, -BH - 2);
        S[K.Supply] = S[K.Supply]! - 1;
        S[K.Spawn] = 1.2 + r() * 0.5;
        n++;
      }
      speed = 34 / (1 + n * 0.45);
      S[K.Scroll] = S[K.Scroll]! + speed * dt;
      S[K.Walk] = S[K.Walk]! + speed * dt * 0.14;
    }
    if (!n && !S[K.Supply]) (S[K.Phase] = 1), (S[K.T] = 0), burst(w, r, CX, FLOOR - CH, CW, CH, FACE + GO, DUST, 30, CX + CW / 2, FLOOR, 40);
  } else if (ph === 1 && S[K.T]! > 0.9) {
    S[K.Phase] = 2;
    S[K.T] = 0;
  } else if (ph === 2) {
    // The box flies along an arc from where the crate was to his raised hands.
    const t = Math.min(1, S[K.T]! / 0.7), x0 = CX + CW / 2, x1 = DX + 5.5;
    S[K.BoxX] = x0 + (x1 - x0) * t;
    S[K.BoxY] = FLOOR + (FLOOR - 18 - FLOOR) * t - Math.sin(t * Math.PI) * 34;
    if (t >= 1) (S[K.Phase] = 3), (S[K.T] = 0), (S[K.Say] = 2), burst(w, r, x1 - 6, FLOOR - 30, 12, 12, FACE + GO, FACE + 6, 24, x1, FLOOR - 24, 60);
  }
  if (ph === 3) S[K.Glow] = S[K.T]! < 1.6 ? Math.abs(Math.sin(S[K.T]! * 6)) * (1 - S[K.T]! / 1.6) : 0;
  if (ph >= 1 && (ph < 3 || S[K.T]! < 1.7)) busy = true;
  // The stack: each block falls onto the one below (or the crate) and lands with a bounce; a heavy
  // landing squashes the crate and yanks the dev back a step.
  for (let i = 0; i < n; i++) {
    const rest = restOf(w, i);
    if (w.by[i]! >= rest && !w.bv[i]) continue;
    busy = true;
    w.bv[i] = w.bv[i]! + G * dt;
    w.by[i] = w.by[i]! + w.bv[i]! * dt;
    if (w.by[i]! >= rest) {
      const v = w.bv[i]!;
      w.by[i] = rest;
      w.bv[i] = v > 70 ? -v * 0.28 : 0;
      if (v > 120) (S[K.Squash] = 2), (S[K.Yank] = 3), burst(w, r, w.bx[i]!, rest + BH - 2, bw(w.bk[i]!), 1, DUST, DUST2, 6, w.bx[i]! + bw(w.bk[i]!) / 2, rest + BH + 2, 10);
    }
  }
  if (S[K.Squash]! > 0) (S[K.Squash] = Math.max(0, S[K.Squash]! - dt * 12)), (busy = true);
  if (S[K.Yank]! > 0) (S[K.Yank] = Math.max(0, S[K.Yank]! - dt * 10)), (busy = true);
  // Shards: gravity, the floor, the tops and sides of the stack and the crate, and the dev.
  for (let i = 0; i < SHARDS; i++) {
    if (w.pl[i]! <= 0) continue;
    busy = true;
    w.pl[i] = w.pl[i]! - dt;
    const ox = w.px[i]!, oy = w.py[i]!;
    w.vy[i] = w.vy[i]! + G * dt;
    let x = ox + w.vx[i]! * dt, y = oy + w.vy[i]! * dt;
    for (let j = -1; j <= w.n[0]!; j++) {
      // j = -1: the crate; j = n: the dev; else block j.
      const bx = j < 0 ? CX : j === w.n[0] ? DX - S[K.Yank]! + 1 : w.bx[j]!, by = j < 0 ? FLOOR - CH : j === w.n[0] ? FLOOR - 16 : w.by[j]!;
      const ww = j < 0 ? CW : j === w.n[0] ? 9 : bw(w.bk[j]!), hh = j < 0 ? CH : j === w.n[0] ? 16 : BH;
      if (S[K.Phase]! && j < 0) continue; // the crate is gone once it shrinks
      if (!circleRect(x, y, 0.8, bx, by, ww, hh)) continue;
      if (oy <= by && w.vy[i]! > 0) (y = by - 0.5), (w.vy[i] = -w.vy[i]! * 0.42), (w.vx[i] = w.vx[i]! * 0.8);
      else if (circleRect(ox, oy, 0.8, bx, by, ww, hh)) {
        // Already inside (a block came down on it): knocked out of the nearer side.
        const left = x < bx + ww / 2;
        x = left ? bx - 1.5 : bx + ww + 1.5;
        w.vx[i] = (left ? -1 : 1) * (40 + r() * 40);
        w.vy[i] = -30 - r() * 40;
      } else (x = ox), (w.vx[i] = -w.vx[i]! * 0.55);
    }
    if (y >= FLOOR) {
      y = FLOOR - 0.5;
      w.vy[i] = Math.abs(w.vy[i]!) > 24 ? -w.vy[i]! * 0.45 : 0;
      w.vx[i] = w.vx[i]! * (w.vy[i] ? 0.75 : 0.9);
      if (!w.vy[i]) x += speed * dt; // debris rides the floor as he drags
    }
    if (x < 0 || x >= W) (w.vx[i] = -w.vx[i]! * 0.5), (x = ox);
    w.px[i] = x;
    w.py[i] = y;
  }
  for (let i = 0; i < POPS; i++) if (w.ol[i]! > 0) (w.ol[i] = w.ol[i]! - dt), (w.oy[i] = w.oy[i]! - 16 * dt), (busy = true);
  if (busy) S[K.Dirty] = 1;
  return busy;
}

/** A tap (art px): cut a dependency, nudge the crate, or play again once the box is in his hands. */
export function tap(w: World, r: () => number, x: number, y: number) {
  const S = w.S;
  S[K.Idle] = 0;
  S[K.Dirty] = 1;
  if (S[K.Phase] === 3) {
    reset(w);
    S[K.Say] = 1;
  } else if (!S[K.Phase] && !cut(w, r, x, y) && x > CX && x < CX + CW && y > FLOOR - CH) {
    S[K.Squash] = 3; // a knock on the crate: it thuds (cut the dependencies first)
    burst(w, r, x - 2, y - 2, 4, 4, DUST, DUST2, 6, x, y + 4, 30);
  }
}

export type SmallPackages = SlotScene & { engine: ReturnType<typeof createEngine>; w: World };

export function mount(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): SmallPackages {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.6 }), L = engine.ledger, R = engine.random;
  const w = world(), S = w.S, bytes = Number(slot.dataset.kernelGzip) || 0;
  if (bytes) w.label = bytes.toLocaleString("en-US") + " B GZIP";
  reset(w);
  const canvas = L.add(document.createElement("canvas"));
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated";
  const cap = L.add(document.createElement("p")), big = document.createElement("span"), small = document.createElement("small");
  canvas.setAttribute("aria-hidden", "true");
  cap.style.cssText = CAPTION;
  small.style.cssText = CAPTION_SMALL;
  cap.append(big, small);
  stage.append(canvas, cap);
  const ctx = canvas.getContext("2d")!, img = ctx.createImageData(W, H), out = new Uint32Array(img.data.buffer);
  // Read in read(): the stage's size (caption type size) and the page's theme.
  const st = new Float64Array([1, 0, 0, -1]); // resized, light, font px, caption shown
  const q = new Float32Array(32);
  let qn = 0;
  const push = (x: number, y: number) => {
    if (qn < 16) (q[qn * 2] = x), (q[qn * 2 + 1] = y), qn++;
    engine.wake();
  };
  const sig = { signal: engine.signal };
  stage.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    const b = stage.getBoundingClientRect(); // one read per tap, outside any frame
    push(((ev.clientX - b.left) / b.width) * W, ((ev.clientY - b.top) / b.height) * H);
  }, sig);
  const ro = new ResizeObserver(() => ((st[0] = 1), engine.wake()));
  ro.observe(stage);
  const mo = new MutationObserver(() => ((S[K.Dirty] = st[0] = 1), engine.wake()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect()), { once: true });
  let firstTap = first;

  engine.add({
    read() {
      if (!st[0]) return;
      st[0] = 0;
      const b = stage.getBoundingClientRect();
      st[1] = document.documentElement.dataset.theme === "light" ? 1 : 0;
      st[2] = Math.max(10, Math.min(20, Math.round(b.width / 44)));
      if (firstTap && b.width) push((firstTap.x / b.width) * W, (firstTap.y / b.height) * H), (firstTap = null);
    },
    step(e, dt) {
      for (let i = 0; i < qn; i++) tap(w, R, q[i * 2]!, q[i * 2 + 1]!);
      qn = 0;
      if (tick(w, R, dt)) e.busy();
    },
    render() {
      if (L.style(cap, "font-size", st[2] + "px") || st[3] !== S[K.Say]) {
        const s = S[K.Say]!;
        st[3] = s;
        // The punchline sits top right, over the empty floor, clear of the box in his hands.
        cap.style.left = s === 2 ? "auto" : "";
        cap.style.right = s === 2 ? "3%" : "";
        cap.style.top = s === 2 ? "15%" : "";
        big.textContent = SAY[s]![0]!;
        small.textContent = s === 2 ? (bytes ? kernelLine(bytes) : "") : SAY[s]![1]!;
        small.style.display = small.textContent ? "block" : "none";
      }
      if (!S[K.Dirty]) return;
      S[K.Dirty] = 0;
      paint(w);
      const t = LUTS[st[1]!]!, b = w.buf;
      for (let i = 0; i < b.length; i++) out[i] = t[b[i]!]!;
      ctx.putImageData(img, 0, 0);
    },
  });
  engine.start();
  return { engine, w, destroy: () => engine.destroy() };
}
