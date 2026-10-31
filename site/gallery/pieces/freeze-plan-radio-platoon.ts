// Freeze, plan, radio: DOM Battlefield in ten seconds. Time is frozen (and so is the engine: a frozen
// battlefield draws no frames at all). Drag from one of your three mint tanks to draw its route
// round the walls (or tap a tank, then tap the map), then RADIO the platoon: time runs for three
// seconds, the tanks roll their routes leaving tread marks, turrets find targets in sight and fire,
// the coral platoon fires back from behind its walls, shells blast and scorch the ground. Then time
// freezes again and you plan the next leg. Take the enemy HQ flag or knock out their three tanks.
// Six legs to do it. FREEZE (the same key while time runs) stops a leg early. Keyboard: 1–3 picks a tank, the arrows draw
// its route, Backspace clears it, Enter radios. Left alone it plays one attack with routes drawn
// for it, then waits, frozen and asleep, for your plan.
// Bricks: the kernel (fixed step; settle; the ledger for every page write, so Recall gives the page
// back byte for byte), @fzlt/core/sound (cues from the event ring, silent until a gesture; its key
// shows once you have touched the piece).
import { createEngine } from "../../../src/kernel/index";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { sound } from "../../../src/sound";

export type FreezeScene = SlotScene & { engine: ReturnType<typeof createEngine>; tap(x: number, y: number): void; radio(): void; key(k: string): void; S: Float64Array; HP: Int8Array; RN: Uint8Array; X: Float32Array; Y: Float32Array };

const { abs, atan2, cos, sin, sqrt, max, min, round, PI } = Math;
const len = (x: number, y: number) => sqrt(x * x + y * y);
const W = 192, H = 108;
// Modes: planning (time frozen), time running, the result banner.
const PLAN = 0, LIVE = 1, OVER = 2;
// State slots.
const MODE = 0, T = 1, AUTO = 2, SEL = 3, WIN = 4, BURSTS = 5, DIRTY = 6, FR = 7, WORD = 8, WT = 9, SHAKE = 10, DRAW = 12, KEYED = 13, LIVE_T = 3;
// Tanks: 0..2 yours (mint), 3..5 theirs (coral).
const N = 6, R = 26, SH = 10, MK = 120, SC = 16, P = 160;
const HOME_X = [18, 14, 18, 154, 162, 150], HOME_Y = [24, 54, 84, 22, 56, 88], HOME_A = [0, 0, 0, PI, PI, PI];
const FLAG_X = 180, FLAG_Y = 56;
// Walls (x, y, w, h): the page's blocks of cover.
const WL = [58, 16, 8, 22, 58, 70, 8, 22, 100, 44, 10, 20, 130, 22, 8, 16, 130, 70, 8, 16];
const NW = WL.length / 4;
const LEGS = 6, RANGE = 62, SPEED = 34, RELOAD = 1.05;
// The routes the demo draws for itself: over the top, through the middle, under the bottom.
const AUTO_R = [
  [36, 9, 90, 8, 146, 9, 168, 30, 178, 54],
  [44, 54, 84, 54, 90, 36, 116, 36],
  [36, 99, 90, 100, 146, 99, 168, 80, 178, 58],
];
const SAY_GO = "Radio the platoon";
const WORDS = ["TIME FROZEN", "GO GO GO!", "HQ TAKEN!", "SECTOR CLEAR!", "PLATOON LOST", "HIT!", "KO!", "OUT OF TIME"];
// Particles: fire, smoke, debris, spark.
const FIRE = 0, SMOKE = 1, BIT = 2, SPARK = 3;

// Battlefield tokens (dom-battlefield brand/style-guide.md): rim, ink, muted, line, sys, cmd, go and its
// light ink, the coral team and its shade, fire, hurt, advance, tread and link.
const K_rim = "#07060f", K_ink = "#f6f3ff", K_muted = "#aea4d6", K_line = "#3b3170", K_sys = "#19f0ff", K_cmd = "#9a63ff", K_go = "#39ffb0", K_goD = "#00a36d", K_foe = "#ff5c8f", K_foeD = "#b8245a", K_fire = "#ff2b4e", K_hurt = "#ffc21a", K_adv = "#ff8a1f", K_tread = "#151020", K_link = "#8573ee";
const HEAT = [K_cmd, K_foe, K_adv, K_hurt, K_ink];

// A 3 × 5 font (base-36 glyphs, rows top down) for the HUD words, whole pixels only: just the
// characters the piece prints.
const F: Record<string, number> = {};
"0:odr 1:8t3 2:jhj 3:jgu 4:i4p 5:o0e 6:bfz A:8od C:bab D:l7y E:o13 F:o10 G:bcb H:i5p I:n13 K:i3x L:eg7 M:iy5 N:l7x O:8kq P:l9g Q:8kz R:l9p S:b66 T:n0y U:i27 V:i22 W:i65 Z:mnb !:77m .:2"
  .split(" ").forEach((g) => (F[g[0]!] = parseInt(g.slice(2), 36)));
const textW = (s: string, k: number) => (s.length * 4 - 1) * k;
function print(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, k: number) {
  g.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const b = F[s[i]!] ?? 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (b & (1 << (14 - r * 3 - c))) g.fillRect(x + (i * 4 + c) * k, y + r * k, k, k);
  }
}
/** A banner word: a rim all round, a drop shadow, the face. Centred on x. */
function shout(g: CanvasRenderingContext2D, s: string, x: number, y: number, k: number, face: string, drop: string) {
  x = round(x - textW(s, k) / 2);
  y = round(y);
  for (let o = 0; o < 9; o++) print(g, s, x + (o % 3) - 1, y + ((o / 3) | 0) - 1, K_rim, k);
  print(g, s, x + 1, y + 1, drop, k);
  print(g, s, x, y, face, k);
}

/** A top-down tank hull (treads with links, body, hatch), baked once per team and tread frame. */
function hull(body: string, dark: string, frame: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d")!;
  g.fillStyle = K_rim;
  g.fillRect(1, 2, 14, 12);
  g.fillStyle = K_tread;
  g.fillRect(2, 3, 12, 3);
  g.fillRect(2, 10, 12, 3);
  g.fillStyle = K_link;
  for (let i = 0; i < 6; i++) g.fillRect(2 + i * 2 + frame, 4, 1, 1), g.fillRect(2 + i * 2 + frame, 11, 1, 1);
  g.fillStyle = body;
  g.fillRect(3, 6, 10, 4);
  g.fillRect(12, 6, 2, 4);
  g.fillStyle = dark;
  g.fillRect(3, 6, 2, 4);
  return c;
}

export function freeze(stage: HTMLElement, slot: HTMLElement, first: SlotTap | null): FreezeScene {
  const engine = createEngine({ root: stage, settle: 0.5, seed: (Math.random() * 4294967295) >>> 0 });
  const L = engine.ledger, rnd = engine.random, ev = engine.events;
  // The stage (over the page's own field) holds the canvas and the two keys; it is their size container.
  L.style(stage, "container-type", "size");
  const make = <T extends HTMLElement>(tag: string, cls: string) => {
    const el = L.add(document.createElement(tag) as T);
    el.className = cls;
    stage.append(el);
    return el;
  };
  const canvas = make<HTMLCanvasElement>("canvas", "fpr-cv"), wrap = stage;
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute("aria-hidden", "true");
  const btn = make<HTMLButtonElement>("button", "fpr-k fpr-go"), mute = make<HTMLButtonElement>("button", "fpr-k fpr-snd");
  btn.type = mute.type = "button";
  btn.setAttribute("aria-label", SAY_GO);
  btn.setAttribute("aria-keyshortcuts", "1 2 3 ArrowUp ArrowDown ArrowLeft ArrowRight");
  mute.setAttribute("aria-label", "Sound");
  mute.setAttribute("aria-pressed", "false");
  mute.hidden = true;
  const g = canvas.getContext("2d")!;
  const HULL = [[hull(K_go, K_goD, 0), hull(K_go, K_goD, 1)], [hull(K_foe, K_foeD, 0), hull(K_foe, K_foeD, 1)]];

  const S = new Float64Array(16);
  // Tanks: where, body and turret angle, health, reload, recoil, muzzle flash, tread phase, hurt.
  const X = new Float32Array(N), Y = new Float32Array(N), A = new Float32Array(N), TA = new Float32Array(N), HP = new Int8Array(N), CD = new Float32Array(N), RC = new Float32Array(N), FL = new Float32Array(N), TR = new Float32Array(N), HU = new Float32Array(N);
  // Routes (yours): points, how many, which one is next.
  const RX = new Float32Array(3 * R), RY = new Float32Array(3 * R), RN = new Uint8Array(3), RI = new Uint8Array(3);
  // Shells, tread marks and scorch (rings that fade), particles (a pool, swap-removed).
  const BX = new Float32Array(SH), BY = new Float32Array(SH), BVX = new Float32Array(SH), BVY = new Float32Array(SH), BL = new Float32Array(SH), BO = new Int8Array(SH).fill(-1);
  const MX = new Float32Array(MK), MY = new Float32Array(MK), MA = new Float32Array(MK), ML = new Float32Array(MK);
  const CX = new Float32Array(SC), CY = new Float32Array(SC), CL = new Float32Array(SC);
  const PX = new Float32Array(P), PY = new Float32Array(P), PVX = new Float32Array(P), PVY = new Float32Array(P), PL = new Float32Array(P), PM = new Float32Array(P), PR = new Float32Array(P), PK = new Uint8Array(P);
  const ring = new Uint16Array(4); // next tread mark, next scorch, live particles, blasts queued
  const LS = new Int8Array(3).fill(-1);

  // A wall (or the edge) at (x, y), `p` px of clearance (a tank's half width; 1 for a shell).
  const blocked = (x: number, y: number, p = 1) => {
    if (x < p || y < p || x > W - p || y > H - p) return true;
    for (let w = 0; w < NW; w++) if (x > WL[w * 4]! - p && x < WL[w * 4]! + WL[w * 4 + 2]! + p && y > WL[w * 4 + 1]! - p && y < WL[w * 4 + 1]! + WL[w * 4 + 3]! + p) return true;
    return false;
  };
  // Line of sight: sample along the line every 3 px.
  const sight = (ax: number, ay: number, bx: number, by: number) => {
    const d = len(bx - ax, by - ay), n = (d / 3) | 0;
    for (let i = 1; i < n; i++) if (blocked(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  };

  function reset() {
    for (let i = 0; i < N; i++) (X[i] = HOME_X[i]!), (Y[i] = HOME_Y[i]!), (A[i] = TA[i] = HOME_A[i]!), (HP[i] = 3), (CD[i] = 0.4 + rnd() * 0.6), (RC[i] = FL[i] = HU[i] = 0);
    RN.fill(0);
    RI.fill(0);
    BO.fill(-1);
    ML.fill(0);
    CL.fill(0);
    ring[2] = ring[3] = 0;
    S[MODE] = PLAN;
    S[T] = 0;
    S[WIN] = -1;
    S[BURSTS] = 0;
    S[SEL] = -1;
    S[DRAW] = 0;
    S[DIRTY] = 1;
  }
  reset();
  S[AUTO] = first ? 0 : 1;
  S[WT] = 9;

  const put = (k: number, x: number, y: number, vx: number, vy: number, r: number, life: number) => {
    const i = ring[2]!;
    if (i >= P) return;
    ring[2] = i + 1;
    PK[i] = k;
    PX[i] = x;
    PY[i] = y;
    PVX[i] = vx;
    PVY[i] = vy;
    PR[i] = r;
    PL[i] = PM[i] = life;
  };
  // A blast is queued (a few typed-array writes, cheap enough to inline wherever a shell lands) and
  // spawned in parts(), which runs every frame: the particle work stays in hot, optimized code.
  const QX = new Float32Array(8), QY = new Float32Array(8), QP = new Uint8Array(8);
  function blast(x: number, y: number, p: number) {
    const q = ring[3]!;
    if (q >= 8) return;
    QX[q] = x;
    QY[q] = y;
    QP[q] = p;
    ring[3] = q + 1;
  }
  function say(w: number) {
    S[WORD] = w;
    S[WT] = 0;
  }

  /** Radio the platoon (plan → time runs), or freeze it early (time runs → plan). */
  function radio() {
    engine.wake();
    if (S[MODE] === PLAN) {
      S[MODE] = LIVE;
      S[T] = 0;
      S[SEL] = -1;
      S[BURSTS] = S[BURSTS]! + 1;
      say(1);
      ev.emit("radio");
    } else if (S[MODE] === LIVE) S[T] = LIVE_T;
    S[DIRTY] = 1;
  }
  /** Add a route point for tank t (from its last point, or from the tank). */
  function point(t: number, x: number, y: number) {
    const n = RN[t]!, lx = n ? RX[t * R + n - 1]! : X[t]!, ly = n ? RY[t * R + n - 1]! : Y[t]!;
    x = max(5, min(W - 5, x));
    y = max(5, min(H - 5, y));
    if (n >= R || len(x - lx, y - ly) < 4 || blocked(x, y, 4)) return;
    RX[t * R + n] = x;
    RY[t * R + n] = y;
    RN[t] = n + 1;
    S[DIRTY] = 1;
  }
  const pick = (x: number, y: number) => {
    let best = -1, bd = 15;
    for (let t = 0; t < 3; t++) {
      const d = HP[t]! > 0 ? len(X[t]! - x, Y[t]! - y) : 99;
      if (d < bd) (bd = d), (best = t);
    }
    return best;
  };
  function own() {
    if (S[AUTO]) (S[AUTO] = 0), reset();
    if (!S[KEYED]) (S[KEYED] = 1), L.attr(mute, "hidden", null);
    engine.wake();
  }
  /** A tap in art px: a tank picks it (its route starts again), anywhere else extends the picked route. */
  function tap(x: number, y: number) {
    own();
    if (S[MODE] !== PLAN) return;
    const t = pick(x, y);
    if (t >= 0) (S[SEL] = t), (RN[t] = 0), (RI[t] = 0);
    else if (S[SEL]! >= 0) point(S[SEL]!, x, y);
    S[DIRTY] = 1;
  }
  function key(k: string) {
    own();
    if (S[MODE] !== PLAN) return;
    if (k >= "1" && k <= "3" && HP[+k - 1]! > 0) return void ((S[SEL] = +k - 1), (RN[+k - 1] = 0), (RI[+k - 1] = 0), (S[DIRTY] = 1));
    const t = S[SEL]!;
    if (t < 0) return;
    const n = RN[t]!, lx = n ? RX[t * R + n - 1]! : X[t]!, ly = n ? RY[t * R + n - 1]! : Y[t]!;
    if (k === "ArrowRight") point(t, lx + 10, ly);
    else if (k === "ArrowLeft") point(t, lx - 10, ly);
    else if (k === "ArrowUp") point(t, lx, ly - 10);
    else if (k === "ArrowDown") point(t, lx, ly + 10);
    else if (k === "Backspace") (RN[t] = 0), (RI[t] = 0), (S[DIRTY] = 1);
  }

  // Input: drag from a tank draws its route; a tap elsewhere adds to the picked one.
  let rect = stage.getBoundingClientRect(), down = -1;
  const art = (e: PointerEvent, k: 0 | 1) => (k ? ((e.clientY - rect.top) / rect.height) * H : ((e.clientX - rect.left) / rect.width) * W);
  if (first) tap((first.x / stage.clientWidth) * W, (first.y / stage.clientHeight) * H);
  const sig = { signal: engine.signal };
  canvas.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    rect = stage.getBoundingClientRect(); // one read per press, outside any frame
    const x = art(e, 0), y = art(e, 1);
    tap(x, y);
    down = S[MODE] === PLAN && S[SEL]! >= 0 ? S[SEL]! : -1;
    if (down >= 0) canvas.setPointerCapture(e.pointerId);
  }, sig);
  canvas.addEventListener("pointermove", (e) => {
    if (down < 0 || S[MODE] !== PLAN) return;
    point(down, art(e, 0), art(e, 1));
    engine.wake();
  }, sig);
  const up = () => (down = -1);
  canvas.addEventListener("pointerup", up, sig);
  canvas.addEventListener("pointercancel", up, sig);
  btn.addEventListener("click", () => (own(), radio()), sig);
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.target === mute) return;
    if (/^([1-3]|Arrow\w+|Backspace)$/.test(e.key)) e.preventDefault(), key(e.key);
  }, sig);
  const snd = sound(engine, { cues: { boom: "boom", fire: "fire", radio: "ready", win: "win", lost: "end" }, volume: 0.14 });
  mute.addEventListener("click", () => {
    snd.on = !snd.on;
    L.attr(mute, "aria-pressed", "" + !snd.on);
  }, sig);

  /** Tank i fires at tank j: recoil, flash, a shell with a little spread. */
  function fire(i: number, j: number) {
    let s = 0;
    while (s < SH && BO[s]! >= 0) s++;
    if (s === SH) return;
    const a = TA[i]! + (rnd() - 0.5) * (i < 3 ? 0.1 : 0.34);
    BX[s] = X[i]! + cos(a) * 8;
    BY[s] = Y[i]! + sin(a) * 8;
    BVX[s] = cos(a) * 150;
    BVY[s] = sin(a) * 150;
    BL[s] = len(X[j]! - X[i]!, Y[j]! - Y[i]!) / 150 + 0.25;
    BO[s] = i < 3 ? 0 : 1;
    RC[i] = 1;
    FL[i] = 0.08;
    CD[i] = (i < 3 ? RELOAD : RELOAD * 1.5) + rnd() * 0.4;
    put(SMOKE, BX[s]!, BY[s]!, cos(a) * 10, sin(a) * 10, 1, 0.4);
    ev.emit("fire");
  }

  function over(w: number, word = w === 0 ? (HP[3]! + HP[4]! + HP[5]! ? 2 : 3) : 4) {
    S[MODE] = OVER;
    S[T] = 0;
    S[WIN] = w;
    say(word);
    ev.emit(w ? "lost" : "win");
  }

  /** Every tank, one fixed step: yours roll their routes, turrets track and fire. 1: the HQ is taken. */
  function tanks(dt: number) {
    for (let i = 0; i < N; i++) {
      if (HU[i]! > 0) HU[i] = HU[i]! - dt;
      if (RC[i]! > 0) RC[i] = max(0, RC[i]! - dt * 6);
      if (FL[i]! > 0) FL[i] = FL[i]! - dt;
      if (HP[i]! <= 0) continue;
      // Yours roll their route: turn toward the next point, then drive (walls stop them).
      if (i < 3 && RI[i]! < RN[i]!) {
        const k = i * R + RI[i]!, dx = RX[k]! - X[i]!, dy = RY[k]! - Y[i]!, d = len(dx, dy);
        if (d < 2) RI[i] = RI[i]! + 1;
        else {
          const want = atan2(dy, dx);
          let da = want - A[i]!;
          da = ((da + PI * 3) % (PI * 2)) - PI;
          A[i] = A[i]! + max(-6 * dt, min(6 * dt, da));
          if (abs(da) < 0.6) {
            const nx = X[i]! + cos(A[i]!) * SPEED * dt, ny = Y[i]! + sin(A[i]!) * SPEED * dt;
            // Into a wall: slide along it; stuck both ways, give up on that point.
            if (!blocked(nx, ny, 4)) (X[i] = nx), (Y[i] = ny);
            else if (!blocked(nx, Y[i]!, 4)) X[i] = nx;
            else if (!blocked(X[i]!, ny, 4)) Y[i] = ny;
            else RI[i] = RI[i]! + 1;
            TR[i] = TR[i]! + dt * 12;
            if ((S[FR]! & 3) === 0) {
              const m = ring[0]!;
              ring[0] = (m + 1) % MK;
              MX[m] = X[i]!;
              MY[m] = Y[i]!;
              MA[m] = A[i]!;
              ML[m] = 1;
            }
          }
        }
        if (len(X[i]! - FLAG_X, Y[i]! - FLAG_Y) < 7) return over(0), 1;
      }
      // Turrets: the nearest enemy in range and in sight; fire when lined up and loaded.
      let tgt = -1, bd = i < 3 ? RANGE : RANGE - 8;
      for (let j = i < 3 ? 3 : 0, end = j + 3; j < end; j++) {
        const d = HP[j]! > 0 ? len(X[j]! - X[i]!, Y[j]! - Y[i]!) : 999;
        if (d < bd && sight(X[i]!, Y[i]!, X[j]!, Y[j]!)) (bd = d), (tgt = j);
      }
      const want = tgt >= 0 ? atan2(Y[tgt]! - Y[i]!, X[tgt]! - X[i]!) : A[i]!;
      let da = want - TA[i]!;
      da = ((da + PI * 3) % (PI * 2)) - PI;
      TA[i] = TA[i]! + max(-4 * dt, min(4 * dt, da));
      CD[i] = CD[i]! - dt;
      if (tgt >= 0 && abs(da) < 0.12 && CD[i]! <= 0) fire(i, tgt);
    }
    return 0;
  }

  function shells(dt: number, mode: number) {
    let mv = false;
    for (let s = 0; s < SH; s++) {
      if (BO[s]! < 0) continue;
      mv = true;
      if (mode !== LIVE) continue;
      const x = (BX[s] = BX[s]! + BVX[s]! * dt), y = (BY[s] = BY[s]! + BVY[s]! * dt);
      BL[s] = BL[s]! - dt;
      let hit = blocked(x, y) || BL[s]! <= 0;
      for (let j = BO[s] ? 0 : 3, end = j + 3; j < end; j++)
        if (HP[j]! > 0 && abs(X[j]! - x) < 6 && abs(Y[j]! - y) < 6) {
          hit = true;
          HP[j] = HP[j]! - 1;
          HU[j] = 0.4;
          if (S[WT]! > 0.6) say(HP[j]! ? 5 : 6);
          if (!HP[j]) blast(X[j]!, Y[j]!, 3);
        }
      if (hit) (BO[s] = -1), blast(x, y, 1);
    }
    return mv;
  }

  function parts(dt: number) {
    // The queued blasts, spawned here (in the hot loop, so none of this math boxes a number).
    for (let q = 0; q < ring[3]!; q++) {
      const x = QX[q]!, y = QY[q]!, p = QP[q]!;
      put(FIRE, x, y, 0, 0, 2 + p * 2, 0.25 + p * 0.08);
      for (let i = 0; i < 2 + p * 2; i++) put(FIRE, x + (rnd() - 0.5) * 6 * p, y + (rnd() - 0.5) * 5 * p, 0, -6, 1 + p, 0.3 + rnd() * 0.25);
      for (let i = 0; i < 4 + p * 6; i++) {
        const a = rnd() * 6.283, s = 20 + rnd() * 50 * p;
        put(rnd() < 0.5 ? BIT : SPARK, x, y, cos(a) * s, sin(a) * s, 1, 0.3 + rnd() * 0.5);
      }
      for (let i = 0; i < 1 + p * 2; i++) put(SMOKE, x + (rnd() - 0.5) * 6, y, (rnd() - 0.5) * 8, -6 - rnd() * 8, 1.5 + rnd() * p, 0.9 + rnd() * 0.6);
      const c = ring[1]!;
      ring[1] = (c + 1) % SC;
      CX[c] = x;
      CY[c] = y;
      CL[c] = 1;
      S[SHAKE] = min(0.5, S[SHAKE]! + 0.06 * p * p);
      ev.emit("boom", 0, 0, round(x), round(y), p); // whole numbers: a double in an event slot boxes
    }
    ring[3] = 0;
    let n = ring[2]!;
    for (let i = n - 1; i >= 0; i--) {
      if ((PL[i] = PL[i]! - dt) <= 0) {
        n--;
        (PX[i] = PX[n]!), (PY[i] = PY[n]!), (PVX[i] = PVX[n]!), (PVY[i] = PVY[n]!), (PL[i] = PL[n]!), (PM[i] = PM[n]!), (PR[i] = PR[n]!), (PK[i] = PK[n]!);
        continue;
      }
      const k = PK[i]!;
      const drag = k === SMOKE ? 0.5 : 3;
      PVX[i] = PVX[i]! * (1 - drag * dt);
      PVY[i] = PVY[i]! * (1 - drag * dt);
      if (k === SMOKE) PR[i] = PR[i]! + 3 * dt;
      PX[i] = PX[i]! + PVX[i]! * dt;
      PY[i] = PY[i]! + PVY[i]! * dt;
    }
    ring[2] = n;
    for (let m = 0; m < MK; m++) if (ML[m]! > 0) ML[m] = ML[m]! - dt * 0.12;
    for (let c = 0; c < SC; c++) if (CL[c]! > 0) CL[c] = CL[c]! - dt * 0.15;
    if (S[SHAKE]! > 0) S[SHAKE] = max(0, S[SHAKE]! - dt);
  }

  engine.add({
    step(e, dt) {
      const mode = S[MODE]!, t = (S[T] = S[T]! + dt);
      let mv = false;
      S[FR] = S[FR]! + 1;
      // The demo: it draws its routes (a point a beat), then radios; again after each freeze.
      if (S[AUTO] && mode === PLAN) {
        mv = true;
        if (!S[BURSTS] && t > 0.4) {
          const d = (S[DRAW] = S[DRAW]! + dt * 9) | 0;
          for (let q = 0; q < 3; q++) {
            const r = AUTO_R[q]!, n = min(r.length / 2, max(0, d - q * 2));
            for (let k = RN[q]!; k < n; k++) (RX[q * R + k] = r[k * 2]!), (RY[q * R + k] = r[k * 2 + 1]!), (RN[q] = k + 1);
          }
          if (d > 14) radio();
        } else if (S[BURSTS] && t > 0.7) radio();
      }
      if (mode === LIVE) {
        // Busy now: the round can end on this step (HQ taken, a side wiped), and the result plays on.
        mv = true;
        e.busy();
        S[DIRTY] = 1;
        let foes = 0, mine = 0;
        for (let i = 0; i < N; i++) if (HP[i]! > 0) i < 3 ? mine++ : foes++;
        if (tanks(dt)) return;
        if (!foes) return over(0);
        if (!mine) return over(1);
      }
      // Shells: straight and fast; a tank or a wall stops them, or they burst where they were aimed.
      if (shells(dt, mode)) mv = true;
      // Time runs out: freeze. The demo stops after a few legs.
      if (mode === LIVE && t >= LIVE_T) {
        S[MODE] = PLAN;
        S[T] = 0;
        BO.fill(-1);
        if (S[BURSTS]! >= (S[AUTO] ? 4 : LEGS)) over(HP[0]! + HP[1]! + HP[2]! >= HP[3]! + HP[4]! + HP[5]! ? 0 : 1, 7);
      }
      if (mode === OVER) {
        mv = true;
        if (t > 2.6) {
          reset();
          S[AUTO] = 0;
        }
      }
      // Particles, marks and scorch fade; frozen time freezes them too (only LIVE and OVER run them).
      if (mode !== PLAN) {
        parts(dt);
      }
      if (S[WT]! < 2.6) (S[WT] = S[WT]! + dt), (mv = true);
      if (mv) e.busy(), (S[DIRTY] = 1);
    },
    render() {
      const m = S[MODE]!, live = m === LIVE ? 1 : 0;
      if (live !== LS[0]) {
        LS[0] = live;
        L.attr(btn, "data-live", live ? "" : null);
        L.attr(btn, "aria-label", live ? "Freeze time" : SAY_GO);
      }
      const sel = S[SEL]!;
      if (sel !== LS[1]) (LS[1] = sel), L.attr(wrap, "data-sel", sel >= 0 ? "" + (sel + 1) : null);
      const sh = S[SHAKE]! > 0 ? ((S[FR]! & 1 ? 1 : -1) * min(3, round(S[SHAKE]! * 10))) : 0;
      if (sh !== LS[2]) (LS[2] = sh), sh ? L.style(canvas, "translate", `${sh * 0.52}cqw ${-sh * 0.26}cqw`) : L.unstyle(canvas, "translate");
      if (!S[DIRTY]) return;
      S[DIRTY] = 0;
      draw();
    },
  });

  function draw() {
    const m = S[MODE]!, frozen = m === PLAN;
    g.clearRect(0, 0, W, H);
    // Scorch and tread marks on the ground, fading.
    for (let c = 0; c < SC; c++) {
      if (CL[c]! <= 0) continue;
      g.globalAlpha = min(0.6, CL[c]!);
      g.fillStyle = K_rim;
      g.fillRect(round(CX[c]!) - 3, round(CY[c]!) - 2, 7, 5);
      g.fillRect(round(CX[c]!) - 2, round(CY[c]!) - 3, 5, 7);
    }
    g.fillStyle = K_line;
    for (let k = 0; k < MK; k++) {
      if (ML[k]! <= 0) continue;
      g.globalAlpha = min(0.7, ML[k]!);
      const a = MA[k]!, ox = round(-sin(a) * 4), oy = round(cos(a) * 4);
      g.fillRect(round(MX[k]!) + ox, round(MY[k]!) + oy, 1, 1);
      g.fillRect(round(MX[k]!) - ox, round(MY[k]!) - oy, 1, 1);
    }
    g.globalAlpha = 1;
    // The walls: a rim, a lit top edge, a block face.
    for (let w = 0; w < NW; w++) {
      const x = WL[w * 4]!, y = WL[w * 4 + 1]!, ww = WL[w * 4 + 2]!, hh = WL[w * 4 + 3]!;
      g.fillStyle = K_rim;
      g.fillRect(x - 1, y - 1, ww + 2, hh + 3);
      g.fillStyle = K_cmd;
      g.fillRect(x, y, ww, hh);
      g.fillStyle = K_muted;
      g.fillRect(x, y, ww, 1);
      g.fillStyle = K_line;
      for (let r = y + 4; r < y + hh; r += 4) g.fillRect(x + ((r >> 2) & 1 ? 0 : ww >> 1), r, ww >> 1, 1);
    }
    // The enemy HQ flag.
    g.fillStyle = K_rim;
    g.fillRect(FLAG_X - 1, FLAG_Y - 10, 3, 13);
    g.fillStyle = K_ink;
    g.fillRect(FLAG_X, FLAG_Y - 9, 1, 12);
    g.fillStyle = m === OVER && !S[WIN] ? K_go : (S[FR]! >> 4) & 1 && !frozen ? K_fire : K_foe;
    g.fillRect(FLAG_X + 1, FLAG_Y - 9, 6, 4);
    print(g, "HQ", FLAG_X - 5, FLAG_Y + 5, K_foe, 1);
    // The routes: purple dots (the picked one bright), an arrow head at the end.
    for (let q = 0; q < 3; q++) {
      const n = RN[q]!;
      if (!n || HP[q]! <= 0) continue;
      g.fillStyle = S[SEL] === q ? K_sys : K_cmd;
      let lx = X[q]!, ly = Y[q]!;
      for (let k = RI[q]!; k < n; k++) {
        const x = RX[q * R + k]!, y = RY[q * R + k]!, d = len(x - lx, y - ly), st = max(1, (d / 3) | 0);
        for (let s = 1; s <= st; s++) if ((s & 1) === 0 || s === st) g.fillRect(round(lx + ((x - lx) * s) / st), round(ly + ((y - ly) * s) / st), 1, 1);
        lx = x;
        ly = y;
      }
      g.fillRect(round(lx) - 1, round(ly) - 1, 3, 3);
      print(g, "" + (q + 1), round(lx) + 3, round(ly) - 6, g.fillStyle as string, 1);
    }
    // The tanks: hull turned to its heading, turret and barrel (recoil), the muzzle flash, health pips.
    for (let i = 0; i < N; i++) {
      const x = round(X[i]!), y = round(Y[i]!), dead = HP[i]! <= 0, team = i < 3 ? 0 : 1;
      g.save();
      g.translate(x, y);
      g.rotate(A[i]!);
      if (dead) g.globalAlpha = 0.45;
      g.drawImage(HULL[team]![(TR[i]! | 0) & 1]!, -8, -8);
      g.restore();
      if (dead) {
        g.fillStyle = K_rim;
        g.fillRect(x - 2, y - 2, 4, 4);
        continue;
      }
      const a = TA[i]!, c = cos(a), s = sin(a), back = RC[i]! * 2;
      g.fillStyle = K_rim;
      for (let k = 1; k < 9; k++) g.fillRect(round(x + c * (k - back)) - 1, round(y + s * (k - back)) - 1, 2, 2);
      g.fillStyle = HU[i]! > 0 && (S[FR]! & 2) ? K_ink : team ? K_foeD : K_goD;
      g.fillRect(x - 3, y - 3, 6, 6);
      g.fillStyle = HU[i]! > 0 && (S[FR]! & 2) ? K_ink : team ? K_foe : K_go;
      g.fillRect(x - 2, y - 2, 4, 4);
      if (FL[i]! > 0) {
        g.fillStyle = K_hurt;
        g.fillRect(round(x + c * 10) - 2, round(y + s * 10) - 2, 4, 4);
        g.fillStyle = K_ink;
        g.fillRect(round(x + c * 10) - 1, round(y + s * 10) - 1, 2, 2);
      }
      for (let p = 0; p < 3; p++) (g.fillStyle = p < HP[i]! ? (HP[i]! > 1 ? K_go : K_hurt) : K_rim), g.fillRect(x - 4 + p * 3, y - 10, 2, 1);
      if (team === 0) {
        if (S[SEL] === i && frozen) (g.fillStyle = K_sys), g.fillRect(x - 7, y - 7, 3, 1), g.fillRect(x - 7, y - 7, 1, 3), g.fillRect(x + 5, y + 7, 3, 1), g.fillRect(x + 7, y + 5, 1, 3);
        print(g, "" + (i + 1), x - 1, y + 9, K_go, 1);
      }
    }
    // Shells: a hot core with a short trail.
    for (let s = 0; s < SH; s++) {
      if (BO[s]! < 0) continue;
      const x = round(BX[s]!), y = round(BY[s]!);
      g.fillStyle = BO[s] ? K_foe : K_go;
      g.fillRect(round(x - BVX[s]! * 0.02), round(y - BVY[s]! * 0.02), 1, 1);
      g.fillStyle = K_hurt;
      g.fillRect(x, y, 2, 2);
    }
    // Particles.
    for (let i = 0, n = ring[2]!; i < n; i++) {
      const k = PK[i]!, u = PL[i]! / PM[i]!, x = round(PX[i]!), y = round(PY[i]!);
      if (k === SMOKE) {
        g.globalAlpha = min(0.5, u);
        g.fillStyle = K_muted;
        const r = round(PR[i]!);
        g.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1);
        g.globalAlpha = 1;
      } else if (k === FIRE) {
        g.fillStyle = HEAT[min(4, (u * 5) | 0)]!;
        const r = round(PR[i]! * (0.4 + u * 0.6));
        g.fillRect(x - r, y - r + 1, r * 2 + 1, r * 2 - 1);
        g.fillRect(x - r + 1, y - r, r * 2 - 1, r * 2 + 1);
      } else {
        g.fillStyle = k === SPARK ? (u > 0.5 ? K_ink : K_hurt) : K_rim;
        g.fillRect(x, y, 1, 1);
      }
    }
    // Frozen: a cyan frame and the clock stopped; running: the seconds left.
    if (frozen) {
      g.fillStyle = K_sys;
      g.fillRect(0, 0, W, 1);
      g.fillRect(0, H - 1, W, 1);
      g.fillRect(0, 0, 1, H);
      g.fillRect(W - 1, 0, 1, H);
      g.fillStyle = K_rim;
      g.fillRect(2, 2, 59, 16);
      print(g, "TIME FROZEN", 4, 4, K_sys, 1);
      print(g, S[SEL]! >= 0 ? "DRAW ITS ROUTE" : "DRAG A TANK", 4, 11, K_muted, 1);
      const left = (S[AUTO] ? 4 : LEGS) - S[BURSTS]!;
      g.fillStyle = K_rim;
      g.fillRect(W - 44, 2, 42, 9);
      print(g, "LEGS " + left, W - 42, 4, left > 1 ? K_muted : K_hurt, 1);
    } else if (m === LIVE) {
      const left = max(0, LIVE_T - S[T]!);
      g.fillStyle = K_rim;
      g.fillRect(2, 2, 46, 12);
      print(g, "LIVE " + Math.ceil(left), 4, 4, K_fire, 1);
      g.fillStyle = K_fire;
      g.fillRect(4, 11, round((left / LIVE_T) * 40), 1);
    }
    const wt = S[WT]!, wd = S[WORD]!, big = (wd >= 2 && wd <= 4) || wd === 7;
    if (wt < (big ? 2.6 : 0.9) && wd > 0) shout(g, WORDS[wd]!, W / 2, big ? 46 : wd === 1 ? 50 : 20, big || (wd === 1 && S[BURSTS] === 1) ? 2 : 1, wd === 4 ? K_foe : wd === 7 ? K_hurt : big ? K_go : K_ink, wd === 4 ? K_fire : K_cmd);
  }

  engine.start();
  return {
    engine,
    accessible: true,
    tap,
    key,
    radio,
    /** The state, live (tests): S (mode 0, picked 3, winner 4, legs 5), health a tank, route lengths, where. */
    S,
    HP,
    RN,
    X,
    Y,
    destroy: () => engine.destroy(),
  };
}

/** The poster (reduced motion, and before the scene loads): the routes drawn, time frozen. */
export const posterAt = 1.9;

/** For `slot(fig, () => import("./freeze-plan-radio-platoon").then((m) => m.mount))`. */
export const mount = (stage: HTMLElement, slot: HTMLElement, first: SlotTap | null) => freeze(stage, slot, first);
