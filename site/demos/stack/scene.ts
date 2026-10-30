/**
 * Stack it: Fizlet's bricks, by their real names and measured sizes, burst out over the stage; a
 * hand stacks five onto the pad (each lands with a slam, dust and its bytes); the stack morphs into
 * the app those bricks make (a shooter), which plays and gets its stars. Then it is your turn: tap
 * or drag bricks onto the pad, press FINISHED, and your stack becomes its own app (input, pad,
 * steer: a shooter; timeline, camera: a movie; grid, rules, match, board-page, presence: a board
 * game; the kernel alone: hello), with stars for what it does and what it weighs (./data.ts build()).
 *
 * Built on the kernel alone (settle + 30 fps cap: still means zero frames; the ledger: Recall), so
 * it fits a hero's live budget: its dust, blasts and pop words are one small pool here (fx in the
 * stack turns the app's hits into blasts; without it they blink). Mounted by fizlet/slot. The
 * bricks are real Board UI keys (buttons: tap, Enter or Space stacks one; drag places one), so the
 * scene is accessible (`accessible: true`) and its rating is spoken (aria-live). Reduced motion
 * (the heroes page's Play key is the only way in): no intro, every move jumps, the app is one
 * still frame. Its look (brick, pad, key) is in site/site.css (.sk), shared with the poster.
 */
import { createEngine, type Engine } from "../../../src/kernel/index";
import type { SlotScene } from "../../../src/slot";
import { APPS, BRICKS, DEMO, HELLO, VERDICT, build, bytesLabel, kb, type Built } from "./data";

export type StackScene = SlotScene & { engine: Engine; play(): void };

const MONO = "px ui-monospace,SFMono-Regular,Menlo,monospace";
// Canvas colours, read from the Board UI tokens (both themes). The brick roles map onto them.
// The first nine are the brick roles (a brick's colour index is its role's index).
const TOK = "k-go k-sys k-fire k-advance k-cmd k-fallin k-attack k-aim k-flag bg raised ink line rim hurt team-a team-b".split(" ");
const GO = 0, FIRE = 2, ADV = 3, FLAG = 8, BG = 9, RAISED = 10, INK = 11, LINE = 12, RIM = 13, HURT = 14, TA = 15, TB = 16;
// Pixel art, a number a row (bit 0 on the left): the invader and the ship.
const INV = [36, 60, 126, 219, 255, 165], SHIP = [8, 28, 28, 127, 107];
/** The board's moves (cells 0-8): X, O, X … X wins on 2-4-6. */
const TTT = [4, 3, 0, 8, 2, 1, 6], HOT = [HURT, ADV, FIRE, FLAG];
const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sm = (k: number) => k * k * (3 - 2 * k);
// Phases: 0 burst, 1 the intro's hand stacks, 2 morph into the app, 3 the app, 4 back to bricks, 5 your turn.
const BURST = 0, HAND = 1, MORPH = 2, APP = 3, UNMORPH = 4, YOURS = 5;
const PN = 120; // the particle pool: dust, blast bits, rings, pop words

export function mount(stage: HTMLElement): StackScene {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = createEngine({ root: stage, fps: 30, settle: 0.4 }), sig = { signal: e.signal };
  const B = BRICKS.split(",").map((s) => s.split(" ")), N = B.length, bytes = B.map((b) => +b[2]!);
  const rnd = (a: number) => (e.random() - 0.5) * a;
  const role = B.map((b) => TOK.indexOf("k-" + b[1])), C: string[] = [];

  // ---------- DOM: the bricks (Board UI keys), the canvas over them, the FINISHED key ----------
  const root = e.ledger.add(document.createElement("div"));
  root.className = "sk";
  root.innerHTML =
    B.map(([id, r, b]) => `<div class="sk-w"><button class="bui-key bui-arcade sk-b" aria-pressed="false" style="--c:var(--k-${r})"><b>${id!.toUpperCase()}</b><span>${bytesLabel(+b!)}</span></button></div>`).join("") +
    `<i class="sk-pad"></i><p class="sk-hint"><b>STACK IT</b><span>TAP OR DRAG BRICKS ONTO THE PAD</span></p><b class="sk-tag"></b><canvas></canvas><button class="bui-key bui-arcade bui-go sk-go">FINISHED</button><p class="sk-rate" aria-live="polite" hidden></p>`;
  stage.append(root);
  const wrap = [...root.querySelectorAll<HTMLElement>(".sk-w")], keys = wrap.map((w) => w.firstElementChild as HTMLButtonElement);
  const cv = root.querySelector("canvas")!, c = cv.getContext("2d")!, go = root.querySelector<HTMLButtonElement>(".sk-go")!, say = root.querySelector<HTMLElement>(".sk-rate")!, tag = root.querySelector<HTMLElement>(".sk-tag")!;

  // ---------- State ----------
  // Per brick: now (x, y, r), flight from (a*) to (t*), progress k (≥ 1: at rest), duration, arc,
  // slam on landing, squash, home (normalised x, y, r); LS: a number for what render last wrote.
  const F = Array.from({ length: 17 }, () => new Float32Array(N));
  const [X, Y, R, AX, AY, AR, TX, TY, TR, K, DU, HH, SL, Q, NX, NY, NR] = F as Float32Array[] as [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];
  const shown = new Uint8Array(N), LS = new Float64Array(N);
  // Particles: x, y, vx, vy, life (s; they fade over their last half second), size, kind (0 bit, 1 ring, 2 word), colour, word.
  const P = Array.from({ length: 9 }, () => new Float32Array(PN));
  const [PX, PY, PVX, PVY, PL, PS, PK, PC, PW] = P as [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array];
  // Scalars that change every frame (a typed array: writing them never allocates):
  // 0 phase time, 1 morph (0-1), 3 pointer x, 4 y, 5 grab dx, 6 dy, 7 down x, 8 down y, 9 ship x,
  // 10 ship aim, 11 fire timer, 12 recoil, 13 score, 14 app end, 16 flash, 17 the ship's target,
  // 18 the movie's / board's blast done, 19 a tap's hold on the ship, 20 the app's clock, 21 shake,
  // 22 live particles.
  const G = new Float64Array(23);
  const RE = new Float32Array(6), BX = new Float32Array(8), BY = new Float32Array(8).fill(-1);
  let ph = BURST, demo = !still, held = -1, moved = 0, built: Built | null = null, lastGo = -1, lastHud = -1, has = "";
  const st: number[] = []; // the stack, bottom first

  // ---------- Layout (one read at mount, again on resize) ----------
  let W = 0, H = 0, u = 1, bw = 0, bh = 0, pitch = 0, padX = 0, padY = 0, cap = 0, ax = 0, ay = 0, aw = 0, ah = 0, tb = 0, dpr = 1, resized = 1;
  const slotY = (j: number) => padY - 5 * u - bh / 2 - j * pitch;
  function lay() {
    const r = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
    TOK.forEach((v, i) => (C[i] = cs.getPropertyValue("--" + v).trim() || "#888"));
    W = r.width;
    H = r.height;
    u = cl(Math.min(W / 560, H / 350), 0.72, 1.5);
    bw = 92 * u;
    bh = 30 * u;
    pitch = bh + 4 * u;
    padX = W / 2;
    padY = H - 16 * u;
    cap = Math.max(4, Math.floor((padY - 56 * u) / pitch));
    tb = 18 * u;
    const h0 = H - 74 * u;
    aw = Math.min(W - 20 * u, h0 * 1.9);
    ax = (W - aw) / 2;
    ay = 10 * u + tb;
    ah = h0 - tb;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    root.style.setProperty("--u", u + "px");
  }
  /** Scatter homes: a grid over the stage, the pad's column left free, shuffled, jittered. */
  function scatter() {
    // Each side of the pad: a grid of cells (the FINISHED key's corner left free); brick i takes a random free cell.
    const half = W / 2 - bw * 0.65, cols = Math.max(1, Math.floor(half / (bw + 12 * u))), top = 46 * u, rows = Math.max(2, Math.floor((H - top) / (bh * 1.7))), rh = (H - top) / rows;
    const cells = Array.from({ length: cols * rows * 2 }, (_, k) => k).filter((k) => !(k & 1) || k >> 1 !== cols * rows - cols);
    for (let i = 0; i < N; i++) {
      wrap[i]!.hidden = !(shown[i] = +(cells.length > 0));
      const k = cells.splice(Math.floor(e.random() * cells.length), 1)[0]!, x = (((k >> 1) % cols) + 0.5) * (half / cols) + rnd(6 * u);
      NX[i] = (k & 1 ? W - x : x) / W;
      NY[i] = (top + (Math.floor(k / 2 / cols) + 0.5) * rh) / H;
      NR[i] = rnd(14);
    }
  }

  // ---------- Particles ----------
  function pop(k: number, x: number, y: number, vx: number, vy: number, s: number, l: number, col: number, w = 0) {
    const i = G[22]!;
    if (still || i >= PN) return;
    G[22] = i + 1;
    PX[i] = x, PY[i] = y, PVX[i] = vx, PVY[i] = vy, PS[i] = s, PL[i] = l, PK[i] = k, PC[i] = col, PW[i] = w;
  }
  /** A blast: a shock ring and hot bits flying out, and a kick. */
  function blast(x: number, y: number, p: number) {
    if (still) return;
    pop(1, x, y, 0, 0, 12 * p * u, 0.45, FLAG);
    for (let k = 0; k < 14; k++) {
      const a = k * 0.449 + e.random() * 0.3, v = (100 + e.random() * 160) * p * u;
      pop(0, x, y, Math.cos(a) * v, Math.sin(a) * v, (3 + e.random() * 4) * p * u, 0.4 + e.random() * 0.4, HOT[k & 3]!);
    }
    G[21] = G[21]! + 3 * p;
  }

  // ---------- Motion ----------
  /** Fly brick i to (x, y, r) in `d` s along an arc `h` px high; `slam`: it lands (dust, squash). */
  function fly(i: number, x: number, y: number, r: number, d: number, h = 0, slam = 0) {
    AX[i] = X[i]!, AY[i] = Y[i]!, AR[i] = R[i]!, TX[i] = x, TY[i] = y, TR[i] = r, DU[i] = still ? 1e-3 : d, HH[i] = h, SL[i] = slam, K[i] = 0;
    e.wake();
  }
  const home = (i: number, d = 0.5) => fly(i, NX[i]! * W, NY[i]! * H, NR[i]!, d, 30 * u);
  function push(i: number) {
    if (st.length >= cap) return void (G[21] = 3);
    const j = st.length;
    st.push(i);
    keys[i]!.ariaPressed = "true";
    fly(i, padX, slotY(j), 0, 0.42, Math.max(30 * u, Y[i]! - slotY(j) + 50 * u), 1);
    changed();
  }
  function pull(i: number) {
    const j = st.indexOf(i);
    if (j < 0) return;
    st.splice(j, 1);
    keys[i]!.ariaPressed = "false";
    for (let k = j; k < st.length; k++) fly(st[k]!, padX, slotY(k), 0, 0.2, 0, 1);
    changed();
  }
  const toggle = (i: number) => (st.includes(i) ? (pull(i), home(i)) : push(i));
  function changed() {
    say.hidden = true;
    has = " " + st.map((i) => B[i]![0]).join(" ") + " ";
  }
  /** A brick lands on the stack: squash, dust in its colour, its bytes pop up, a kick. */
  function land(i: number) {
    if (still) return;
    Q[i] = 1;
    const x = X[i]!, y = Y[i]! + bh / 2;
    for (let k = 0; k < 10; k++) {
      const s = k & 1 ? 1 : -1;
      pop(0, x + (s * bw) / 2, y, s * (50 + k * 14) * u, -(40 + k * 9) * u, (3 + (k % 3)) * u, 0.45, k % 3 ? role[i]! : FLAG);
    }
    pop(2, x + bw, Y[i]!, 0, -50 * u, 13 * u, 0.9, role[i]!, i);
    G[21] = G[21]! + 1.6;
  }

  // ---------- The story ----------
  function play() {
    for (const i of [...st]) pull(i);
    ph = still ? YOURS : BURST;
    demo = !still;
    G[0] = G[1] = 0;
    for (let i = 0; i < N; i++) {
      X[i] = W / 2, Y[i] = H * 0.55, Q[i] = 0, R[i] = NR[i]! + rnd(720);
      if (shown[i]) fly(i, NX[i]! * W, NY[i]! * H, NR[i]!, 0.75 + e.random() * 0.35, 40 * u);
    }
    blast(W / 2, H * 0.55, 1.2);
  }
  /** FINISHED: the stack becomes its app (or, with no kernel, falls apart). */
  function finish() {
    const b = (built = build(st.map((i) => B[i]![0]!), st.map((i) => bytes[i]!)));
    if (b.app < 0) {
      for (const i of [...st]) pull(i), home(i, 0.6);
      return rate(b);
    }
    ph = MORPH;
    resized = 1;
    G[0] = G[13] = G[17] = G[18] = G[19] = G[20] = 0;
    G[14] = still ? 0 : 4.4;
    G[9] = G[10] = ax + aw / 2;
    RE.fill(0);
    BY.fill(-1);
    changed();
    e.wake();
  }
  function rate(b: Built) {
    // The card (site.css slams it in): the stars, the verdict, the weight; read out as it lands.
    say.innerHTML = `<b aria-hidden="true">${"★★★★★☆☆☆☆☆".substr(5 - b.stars, 5)}</b><strong>${VERDICT[b.stars]}</strong><small>${kb(b.bytes)} · ${b.app < 0 ? "ADD THE KERNEL" : b.dead ? b.dead + " UNUSED" : "ALL USED"}</small><span class="sk-say">${b.stars} of 5 stars.</span>`;
    say.hidden = false;
    e.wake();
  }

  // ---------- Input: tap a brick (or Enter / Space) to stack it or take it back; drag to place ----------
  const local = (ev: PointerEvent) => {
    const r = stage.getBoundingClientRect(); // one read per input, outside any frame
    G[3] = ev.clientX - r.left;
    G[4] = ev.clientY - r.top;
  };
  root.addEventListener("pointerdown", (ev) => {
    if (!ev.isPrimary) return;
    local(ev);
    const w = (ev.target as Element).closest(".sk-w"), i = wrap.indexOf(w as HTMLElement), x = G[3]!, y = G[4]!;
    if (ph === APP && !w && x > ax && x < ax + aw && y > ay && y < ay + ah) {
      // A tap on the app: it plays on for 3 s more (the shooter fires there).
      if (!still) G[14] = Math.max(G[14]!, G[20]! + 3);
      G[10] = x;
      G[19] = 1;
      return void (fire(), e.wake());
    }
    if (demo && ph < MORPH) {
      // A hand on the table ends the intro: it is your turn now.
      demo = false;
      ph = YOURS;
      for (const k of [...st]) pull(k), home(k);
    }
    if (i < 0 || ph !== YOURS) return;
    held = i;
    K[i] = 1;
    moved = 0;
    G[5] = x - X[i]!, G[6] = y - Y[i]!, G[7] = x, G[8] = y;
    wrap[i]!.setPointerCapture(ev.pointerId);
    e.wake();
  }, sig);
  root.addEventListener("pointermove", (ev) => {
    if (held < 0 || !ev.isPrimary) return;
    local(ev);
    if (Math.abs(G[3]! - G[7]!) + Math.abs(G[4]! - G[8]!) > 6) moved = 1;
    e.wake();
  }, sig);
  const up = () => {
    const i = held;
    if (i < 0) return;
    const x = X[i]!, y = Y[i]!;
    held = -1;
    if (!moved) return void toggle(i);
    // Dropped on the pad: onto the top of the stack. Anywhere else: back to its place.
    pull(i);
    Math.abs(x - padX) < bw * 0.8 && y > slotY(st.length) - bh * 1.6 ? push(i) : home(i, 0.35);
  };
  root.addEventListener("pointerup", up, sig);
  root.addEventListener("pointercancel", up, sig);
  root.addEventListener("click", (ev) => {
    const t = ev.target as Element, i = keys.indexOf(t as HTMLButtonElement);
    // Keyboard (and screen readers): a click with no pointer behind it toggles the brick.
    if (i >= 0 && !ev.detail && ph === YOURS) toggle(i);
    // A press in the scene is play, not a call for full screen (the heroes page).
    ev.stopPropagation();
  }, sig);
  go.addEventListener("click", () => {
    if (ph === YOURS && st.length) finish();
    else if (ph === APP && !demo) (ph = UNMORPH), (G[0] = 0), e.wake();
  }, sig);
  // A new size or the page's light / dark switch: lay out and read the tokens again, redraw.
  // A new size: lay out again (FINISHED also reads the tokens again: light or dark, as the page is now).
  const ro = new ResizeObserver(() => ((resized = 1), e.wake()));
  ro.observe(stage);
  e.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  // ---------- The apps ----------
  const px = () => Math.max(2, Math.round(ah / 80));
  function fire() {
    for (let k = 0; k < 8; k++) if (BY[k]! < 0) return void ((BX[k] = G[9]!), (BY[k] = ay + ah - 6 * px()), (G[12] = 1));
  }
  const invX = (i: number, t: number) => ax + aw * (0.14 + 0.144 * i) + Math.sin(t * 1.7) * aw * 0.05;
  const invY = (i: number, t: number) => ay + ah * (0.2 + (i & 1) * 0.1) + Math.sin(t * 3 + i) * 2 * u;
  const cell = () => Math.min(aw / 4.2, ah / 3.6);
  /** A hit: a blast with fx in the stack, a blink without. */
  const boom = (x: number, y: number, p: number) => (has.includes(" fx ") ? blast(x, y, p) : pop(1, x, y, 0, 0, 5 * u, 0.2, FLAG));
  /** The app's own clock runs to G[14] (a tap buys more), then the app holds its last frame. */
  function stepApp(dt: number) {
    if (G[20]! >= G[14]!) return;
    const t = (G[20] = Math.min(G[14]!, G[20]! + dt)), app = built!.app, p = px();
    if (app === 0) {
      for (let i = 0; i < 6; i++) RE[i] = Math.max(0, RE[i]! - dt);
      // The ship hunts invader G[17] (leading it), fires once it is under it; a tap takes over for a second.
      if (G[19]! > 0) G[19] = G[19]! - dt;
      else G[10] = invX(G[17]!, t + 0.45);
      if ((G[11] = G[11]! - dt) <= 0 && t < G[14]! - 0.6 && Math.abs(G[9]! - G[10]!) < 2 * p) (G[11] = 0.4), (G[17] = (G[17]! + 1) % 6), fire();
      G[9] = G[9]! + (G[10]! - G[9]!) * Math.min(1, dt * 9);
      G[12] = Math.max(0, G[12]! - dt * 6);
      for (let k = 0; k < 8; k++) {
        if (BY[k]! < 0) continue;
        BY[k] = BY[k]! - dt * ah * 1.6;
        if (BY[k]! < ay) BY[k] = -1;
        for (let i = 0; i < 6; i++) {
          const x = invX(i, t), y = invY(i, t);
          if (BY[k]! >= 0 && !RE[i] && Math.abs(BX[k]! - x) < 5 * p && Math.abs(BY[k]! - y) < 4 * p) (RE[i] = 1.4), (BY[k] = -1), (G[13] = G[13]! + 10), boom(x, y, 0.8);
        }
      }
    } else if (app === 1) {
      if (t > 0.9 && !G[18]) (G[18] = 1), boom(ax + aw / 2, ay + ah / 2, 1.4);
    } else if (app === 2) {
      if (t > 2.8 && !G[18]) (G[18] = 1), boom(ax + aw / 2 + cell(), ay + ah / 2 - cell(), 1);
    }
  }
  const fill = (col: number, x: number, y: number, w: number, h: number) => ((c.fillStyle = C[col]!), c.fillRect(x, y, w, h));
  function text(s: string, x: number, y: number, size: number, col: number, align: CanvasTextAlign = "center", weight = 700) {
    c.font = weight + " " + Math.round(size * u) + MONO;
    c.textAlign = align;
    c.fillStyle = C[col]!;
    c.fillText(s, x, y);
  }
  function pixels(art: number[], w: number, x: number, y: number, p: number) {
    for (let r = 0; r < art.length; r++) for (let b = 0; b < w; b++) if ((art[r]! >> b) & 1) c.fillRect(x + (b - w / 2) * p, y + r * p, p, p);
  }
  function drawApp(t: number) {
    const app = built!.app, cx = ax + aw / 2, cy = ay + ah / 2, p = px();
    fill(app === 1 ? RAISED : BG, ax, ay, aw, ah);
    if (app === 0) {
      // A shooter: a row of invaders, the ship hunting them, recoil and muzzle flash.
      fill(LINE, ax, ay + ah - 2 * p, aw, 1);
      c.fillStyle = C[TB]!;
      for (let i = 0; i < 6; i++) if (!RE[i]) pixels(INV, 8, invX(i, t), invY(i, t), p);
      c.fillStyle = C[HURT]!;
      for (let k = 0; k < 8; k++) if (BY[k]! >= 0) c.fillRect(BX[k]! - p / 2, BY[k]!, p, 3 * p);
      const sy = ay + ah - 7 * p + G[12]! * 3 * u;
      if (G[12]! > 0.6) c.fillRect(G[9]! - p, sy - 3 * p, 2 * p, 2 * p);
      c.fillStyle = C[TA]!;
      pixels(SHIP, 7, G[9]!, sy, p);
    } else if (app === 1) {
      // A movie: the title slams home, letterbox bars close in.
      c.save();
      const k = cl((t - 0.3) / 0.6), s = 3 - 2 * sm(k);
      c.globalAlpha = k;
      c.translate(cx, cy);
      c.scale(s, s);
      text("THE STACK", 0, 0, ah * 0.17 / u, FIRE, "center", 900);
      c.restore();
      c.globalAlpha = cl(t - 1.2);
      text("A FIZLET PICTURE", cx, cy + ah * 0.16, 10, INK);
      const lb = ah * 0.12 * sm(cl(t / 0.4));
      fill(RIM, ax, ay, aw, lb);
      fill(RIM, ax, ay + ah - lb, aw, lb);
    } else if (app === 2) {
      // A board game: X and O take turns; X wins on the diagonal.
      const cs = cell();
      c.lineWidth = 3 * u;
      c.strokeStyle = C[LINE]!;
      c.beginPath();
      for (let k = 1; k < 3; k++) {
        const o = (k - 1.5) * cs;
        c.moveTo(cx + o, cy - 1.5 * cs), c.lineTo(cx + o, cy + 1.5 * cs), c.moveTo(cx - 1.5 * cs, cy + o), c.lineTo(cx + 1.5 * cs, cy + o);
      }
      c.stroke();
      c.lineWidth = 5 * u;
      for (let k = 0; k < 7 && k * 0.42 <= t; k++) {
        const s = sm(cl((t - k * 0.42) / 0.25)) * cs * 0.28, x = cx + ((TTT[k]! % 3) - 1) * cs, y = cy + (Math.floor(TTT[k]! / 3) - 1) * cs;
        c.strokeStyle = C[k & 1 ? TB : TA]!;
        c.beginPath();
        if (k & 1) c.moveTo(x + s, y), c.arc(x, y, s, 0, 6.3);
        else c.moveTo(x - s, y - s), c.lineTo(x + s, y + s), c.moveTo(x + s, y - s), c.lineTo(x - s, y + s);
        c.stroke();
      }
    } else {
      // Hello: the kernel alone, its greeting bouncing on the loop.
      text("Hello, page.", cx, cy - Math.abs(Math.sin(t * 4)) * ah * 0.2, ah * 0.13 / u, INK, "center", 900);
    }
    // What the other bricks put on top.
    if (has.includes(" hud ")) {
      text("SCORE " + (app ? Math.floor(t * 4) * 5 : G[13]), ax + 8 * u, ay + 10 * u, 10, TA, "left");
    }
    // Power on: a flash as the bricks become the app.
    c.globalAlpha = G[16]!;
    fill(FLAG, ax, ay, aw, ah);
    c.globalAlpha = 1;
  }
  // ---------- The frame ----------
  e.add({
    read() {
      if (!resized) return;
      resized = 0;
      const w0 = W, h0 = H;
      lay();
      if (!w0) return scatter(), play();
      // A new size: the table is laid out again (more or fewer bricks fit) and every brick goes
      // straight to where it belongs at this size.
      if (w0 === W && h0 === H) return;
      scatter();
      for (let i = 0; i < N; i++) {
        const j = st.indexOf(i);
        if (held !== i) j < 0 ? home(i, 1e-3) : fly(i, padX, slotY(j), 0, 1e-3);
      }
    },
    step(_, dt) {
      const t = (G[0] = G[0]! + dt);
      let busy = held >= 0 || G[22]! > 0 || G[21]! > 0 || ph < APP || ph === UNMORPH;
      // One phase a step (a phase starts with its own clock at 0 on the next step).
      if (ph === BURST) t > 1.15 && ((ph = HAND), (G[0] = 0));
      else if (ph === HAND) {
        if (st.length < Math.min(Math.floor((t - 0.1) / 0.5) + 1, DEMO.length) && shown[DEMO[st.length]!]) push(DEMO[st.length]!);
        if (t > DEMO.length * 0.5 + 0.55) finish();
      } else if (ph === MORPH) (G[1] = still ? 1 : cl(t / 0.75)) >= 1 && ((ph = APP), (G[0] = 0), (G[16] = +!still));
      else if (ph === APP) {
        G[16] = Math.max(0, G[16]! - dt * 3);
        stepApp(dt);
        if (t > (still ? 0 : 1.2) && say.hidden) rate(built!);
        if (demo && t > 4.8) (ph = UNMORPH), (G[0] = 0);
        busy ||= demo || G[20]! < G[14]! || G[16]! > 0;
      } else if (ph === UNMORPH && !(G[1] = still ? 0 : 1 - cl(t / 0.6))) {
        ph = YOURS;
        changed();
        if (demo) for (const i of [...st]) pull(i), home(i, 0.55);
        demo = false;
      }
      // Particles: bits fall, rings grow, words rise; the dead swap with the last live one.
      let n = G[22]!;
      for (let i = n - 1; i >= 0; i--) {
        if ((PL[i] = PL[i]! - dt) <= 0) {
          n--;
          for (const a of P) a[i] = a[n]!;
          continue;
        }
        PX[i] = PX[i]! + PVX[i]! * dt;
        PY[i] = PY[i]! + PVY[i]! * dt;
        if (!PK[i]) PVY[i] = PVY[i]! + 700 * u * dt;
      }
      G[22] = n;
      G[21] = Math.max(0, G[21]! - dt * 24);
      for (let i = 0; i < N; i++) {
        if (i === held) {
          const x = G[3]! - G[5]!, vx = x - X[i]!;
          X[i] = x;
          Y[i] = G[4]! - G[6]!;
          R[i] = R[i]! + (cl(vx * 1.2, -14, 14) - R[i]!) * 0.3;
          continue;
        }
        if (Q[i]! > 0) (Q[i] = Math.max(0, Q[i]! - dt * 4)), (busy = true);
        if (K[i]! >= 1) continue;
        busy = true;
        const k = (K[i] = Math.min(1, K[i]! + dt / DU[i]!)), o = 1 - (1 - k) * (1 - k);
        X[i] = AX[i]! + (TX[i]! - AX[i]!) * o;
        Y[i] = AY[i]! + (TY[i]! - AY[i]!) * (SL[i] ? k * k : o) - HH[i]! * 4 * k * (1 - k);
        R[i] = AR[i]! + (TR[i]! - AR[i]!) * sm(k);
        if (k >= 1 && SL[i]) land(i);
      }
      if (busy) e.busy();
    },
    render() {
      const m = sm(G[1]!), sh = G[21]! > 0.3 ? (e.steps & 1 ? 1 : -1) * Math.min(9, G[21]!) * 0.5 : 0, inApp = ph >= MORPH && ph <= UNMORPH;
      // The bricks: change-only writes. A stacked brick dips when one lands on it; in the morph each
      // stacked brick stretches into its band of the app window, then the app shows over them.
      for (let i = 0; i < N; i++) {
        const j = st.indexOf(i), z = i === held ? 40 : K[i]! < 1 ? 30 : 2 + j;
        let x = X[i]!, y = Y[i]!, a = 1 + Q[i]! * 0.12, b = 1 - Q[i]! * 0.16, o = 1;
        if (j >= 0 && m > 0) {
          const band = ah / st.length;
          x += (ax + aw / 2 - x) * m;
          y += (ay + ah - (j + 0.5) * band - y) * m;
          a += (aw / bw - a) * m;
          b += (band / bh - b) * m;
          o = 1 - cl(m * 4 - 3);
        } else if (inApp) o = 0;
        // A number for what this brick looks like now: nothing is built or written while it is unchanged.
        const v = x + y * 1e3 + R[i]! * 1e6 + a * 1e8 + b * 1e9 + o * 1e10 + z * 1e11 + m * 1e13;
        if (!shown[i] || v === LS[i]) continue;
        LS[i] = v;
        const s = wrap[i]!.style;
        s.transform = `translate(${(x - bw / 2).toFixed(1)}px,${(y - bh / 2).toFixed(1)}px) rotate(${R[i]!.toFixed(1)}deg) scale(${a.toFixed(3)},${b.toFixed(3)})`;
        s.setProperty("--t", String(1 - cl(m * 3)));
        s.opacity = String(o);
        s.visibility = o ? "" : "hidden";
        s.zIndex = String(z);
      }
      const re = ph === APP && !demo, off = !(ph === YOURS ? st.length : re), gk = +re * 2 + +off;
      if (gk !== lastGo) (lastGo = gk), (go.textContent = re ? "REBUILD" : "FINISHED"), (go.disabled = off);
      // The canvas: the pad, the stack's weight, the hint, the app, the rating, the particles.
      c.setTransform(dpr, 0, 0, dpr, sh * dpr, 0);
      c.clearRect(-20, 0, W + 40, H);
      c.textBaseline = "middle";
      // The hint, and the stack's weight over its top (change-only; site.css fades them in the app).
      let sum = 0;
      for (const i of st) sum += bytes[i]!;
      const hud = sum * 99 + st.length * 2 + +inApp;
      if (hud !== lastHud) {
        lastHud = hud;
        tag.textContent = sum ? kb(sum) : "";
        tag.style.top = slotY(st.length) + bh / 2 - 18 * u + "px";
        root.classList.toggle("sk-app", inApp);
      }
      if (m > 0 && built && built.app >= 0) {
        c.globalAlpha = cl(m * 2 - 1);
        c.save();
        c.beginPath();
        c.rect(ax, ay, aw, ah);
        c.clip();
        drawApp(G[20]! + (still ? 3.6 : 0));
        c.restore();
        // The window: rim, title bar (the app's name, its bricks and weight).
        fill(RAISED, ax, ay - tb, aw, tb);
        c.strokeStyle = C[RIM]!;
        c.lineWidth = 2 * u;
        c.strokeRect(ax, ay - tb, aw, ah + tb);
        text(`${built.app < HELLO ? APPS[built.app]![0] : "HELLO"} · ${st.length} BRICK${st.length > 1 ? "S" : ""} · ${kb(built.bytes)}`, ax + aw / 2, ay - tb / 2, 10, INK);
      }
      for (let i = 0; i < G[22]!; i++) {
        const k = Math.min(1, PL[i]! * 2), s = PS[i]!;
        c.globalAlpha = k;
        if (PK[i] === 2) text("+" + bytesLabel(bytes[PW[i]!]!), PX[i]!, PY[i]!, s / u, PC[i]!, "center", 900);
        else if (PK[i]) (c.strokeStyle = C[FLAG]!), (c.lineWidth = 3 * k * u + 1), c.beginPath(), c.arc(PX[i]!, PY[i]!, s * (5 - PL[i]! * 9), 0, 6.3), c.stroke();
        else fill(PC[i]!, PX[i]! - s / 2, PY[i]! - s / 2, s, s);
      }
      c.globalAlpha = 1;
    },
  });
  e.start();
  return { engine: e, play, accessible: true, destroy: () => e.destroy() };
}
