/**
 * The live demo on the home page, built with Fizlet itself (bundled from this repo's src/).
 * A small "page" whose letters and words are real elements: a click drops an fx blast and a shock
 * wave that knocks them around; Recall (engine.ledger.restore(), the call destroy() makes) puts the
 * page back exactly. It keeps the contract it shows off:
 *   - read measures (only when the layout changed), step simulates on typed arrays and a pooled
 *     wave list (no DOM, no allocation), render writes change-only through engine.ledger;
 *   - the engine pauses off screen and in a hidden tab;
 *   - reduced motion: the engine stays paused, and a click jumps straight to the settled result
 *     (engine.advance by hand), a still frame instead of an animation.
 */
import { createEngine } from "../src/index";
import { controls } from "../src/input";
import { effects } from "../src/fx";
import { sound } from "../src/sound";
import { guardLayout } from "../src/debug";
import { press, slam } from "../src/ui/board-ui";

const root = document.querySelector<HTMLElement>("[data-demo]");
if (root) run(root);

/** Run the demo on its figure (`[data-demo]`); the gallery mounts it in a slot. Returns its engine. */
export function run(root: HTMLElement) {
  const board = root.querySelector<HTMLElement>("[data-board]")!;
  const page = root.querySelector<HTMLElement>("[data-page]")!;
  const canvas = root.querySelector<HTMLCanvasElement>("canvas[data-fx]")!;
  const ctx = canvas.getContext("2d")!;
  const hint = root.querySelector<HTMLElement>("[data-hint]")!;
  const slamWrap = root.querySelector<HTMLElement>("[data-slam]")!;
  const stateEl = root.querySelector<HTMLElement>("[data-state]")!;
  const bodies = [...root.querySelectorAll<HTMLElement>("[data-body]")];
  const N = bodies.length;
  const flipNode = bodies.map((b) => (b.hasAttribute("data-flip") ? (b.firstChild as Text) : null));
  const canFlip = Uint8Array.from(flipNode, (n) => (n ? 1 : 0));

  // Bodies, struct of arrays: home centre and half size (measured), offset, velocity, spin.
  const HX = new Float32Array(N), HY = new Float32Array(N), HW = new Float32Array(N), HH = new Float32Array(N);
  const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
  const ROT = new Float32Array(N), SPIN = new Float32Array(N);
  const awake = new Uint8Array(N), dirty = new Uint8Array(N), flip = new Uint8Array(N);
  // Running numbers in one typed array (a captured `let` holding a double would box on every write).
  const st = new Float64Array(12);
  const W = 0, H = 1, DPR = 2, LIGHT = 3, PENDING = 4, MEASURE = 5, RESIZE = 6, SCORCH = 7, DRAWN = 8, SHAKING = 9, RECALL = 10, TICK = 11;
  st[MEASURE] = 1;
  const MAXQ = 8, Q = new Float32Array(MAXQ * 3); // pending blasts: x, y, power

  const engine = createEngine({ root, seed: 7, pause: { reducedMotion: true } });
  guardLayout(engine);
  const pad = controls(engine, { target: board, keys: { blast: ["KeyB"], recall: ["KeyR"] } });
  const fx = effects({ cap: 420, words: ["BOOM", "KAPOW", "FIZZ", "POP", "BLAM"] });
  const sfx = sound(engine, { cues: { boom: "boom" }, on: false });
  // Shock waves: a named, bounded pool (shows in stats()). Each remembers which bodies it hit.
  let ids = 0;
  const waves = engine.pool("waves", 8, () => ({ id: ids++, x: 0, y: 0, r: 0, max: 0, power: 0 }));
  const hitMask = new Uint8Array(8 * N);

  const queue = (x: number, y: number, power: number) => {
    const n = st[PENDING]!;
    if (n >= MAXQ) return;
    Q[n * 3] = x;
    Q[n * 3 + 1] = y;
    Q[n * 3 + 2] = power;
    st[PENDING] = n + 1;
  };

  function measure() {
    st[W] = board.clientWidth;
    st[H] = board.clientHeight;
    st[DPR] = Math.min(devicePixelRatio || 1, 1.5);
    // offsetLeft/Top ignore transforms, so a knocked-over letter still reports its home.
    for (let b = 0; b < N; b++) {
      const el = bodies[b]!;
      HW[b] = el.offsetWidth / 2;
      HH[b] = el.offsetHeight / 2;
      HX[b] = el.offsetLeft + HW[b]!;
      HY[b] = el.offsetTop + HH[b]!;
    }
    st[MEASURE] = 0;
    st[RESIZE] = 1;
  }

  engine.add({
    // READ: the only phase that measures; input edges arrive here.
    read(e) {
      if (st[MEASURE]) measure();
      st[LIGHT] = document.documentElement.dataset.theme === "light" ? 1 : 0;
      if (pad.pointer.hit) queue(pad.pointer.x, pad.pointer.y, 1.1);
      if (pad.hit("blast")) queue(st[W]! * (0.15 + 0.7 * e.random()), st[H]! * (0.2 + 0.6 * e.random()), 1.3);
      if (pad.hit("recall")) st[RECALL] = 1;
    },

    // STEP: numbers only. No DOM, no allocation.
    step(e, dt) {
      const n = st[PENDING]!;
      for (let k = 0; k < n; k++) {
        const x = Q[k * 3]!, y = Q[k * 3 + 1]!, p = Q[k * 3 + 2]!;
        const w = waves.acquire(); // full pool: the wave is refused, the blast still shows
        if (w) {
          w.x = x;
          w.y = y;
          w.r = 0;
          w.max = Math.max(120, Math.min(st[W]!, st[H]!) * 0.6) * p;
          w.power = p;
          hitMask.fill(0, w.id * N, w.id * N + N);
        }
        fx.blast(x, y, p, 3);
        if (e.random() < 0.7) fx.word(x, y - 26, (e.random() * fx.words.length) | 0, 1 + ((e.random() * 5) | 0), 18);
        e.events.emit("boom", 0, 0, x, y, p);
        st[SCORCH] = 9;
      }
      st[PENDING] = 0;

      const items = waves.items;
      for (let i = items.length; i--; ) {
        const w = items[i]!, base = w.id * N;
        w.r += 640 * dt;
        for (let b = 0; b < N; b++) {
          if (hitMask[base + b]) continue;
          const dx = HX[b]! + X[b]! - w.x, dy = HY[b]! + Y[b]! - w.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d > w.r) continue;
          hitMask[base + b] = 1;
          if (d > w.max) continue;
          const k = 1 - d / w.max, imp = 470 * w.power * k, inv = d > 0.5 ? 1 / d : 0;
          VX[b]! += dx * inv * imp + (e.random() - 0.5) * 90 * k;
          VY[b]! += dy * inv * imp - 140 * k;
          SPIN[b]! += (e.random() - 0.5) * 900 * k;
          awake[b] = 1;
          if (canFlip[b] && k > 0.3 && e.random() < 0.75) flip[b] = e.random() < 0.5 ? 1 : 2;
        }
        if (w.r > w.max + 60) waves.releaseAt(i);
      }

      const bw = st[W]!, bh = st[H]!, drag = 1 - 3.4 * dt;
      for (let b = 0; b < N; b++) {
        if (!awake[b]) continue;
        X[b]! += VX[b]! * dt;
        Y[b]! += VY[b]! * dt;
        ROT[b]! += SPIN[b]! * dt;
        VX[b]! *= drag;
        VY[b]! *= drag;
        SPIN[b]! *= drag;
        // Stay on the board: bounce off its edges, losing half the speed.
        const cx = HX[b]! + X[b]!, cy = HY[b]! + Y[b]!, hw = HW[b]!, hh = HH[b]!;
        if (cx < hw) (X[b] = hw - HX[b]!), (VX[b] = Math.abs(VX[b]!) * 0.5);
        else if (cx > bw - hw) (X[b] = bw - hw - HX[b]!), (VX[b] = -Math.abs(VX[b]!) * 0.5);
        if (cy < hh) (Y[b] = hh - HY[b]!), (VY[b] = Math.abs(VY[b]!) * 0.5);
        else if (cy > bh - hh) (Y[b] = bh - hh - HY[b]!), (VY[b] = -Math.abs(VY[b]!) * 0.5);
        dirty[b] = 1;
        if (VX[b]! * VX[b]! + VY[b]! * VY[b]! < 4 && Math.abs(SPIN[b]!) < 4) awake[b] = 0;
      }
      fx.step(dt);
      if (st[SCORCH]! > 0) st[SCORCH]! -= dt;
    },

    // RENDER: change-only writes, every page change through the ledger (so Recall can undo it).
    render(e) {
      if (st[RECALL]) recall();
      const L = e.ledger, bw = st[W]!, bh = st[H]!, dpr = st[DPR]!;
      if (st[RESIZE]) {
        canvas.width = Math.round(bw * dpr);
        canvas.height = Math.round(bh * dpr);
        st[RESIZE] = 0;
        st[DRAWN] = 1;
      }
      for (let b = 0; b < N; b++) {
        if (dirty[b]) {
          dirty[b] = awake[b]!;
          L.style(bodies[b]!, "transform", `translate(${X[b]!.toFixed(1)}px, ${Y[b]!.toFixed(1)}px) rotate(${ROT[b]!.toFixed(1)}deg)`);
        }
        if (flip[b]) {
          L.text(flipNode[b]!, flip[b] === 1 ? "0" : "1");
          L.cls(bodies[b]!, "hot", true);
          flip[b] = 0;
          L.cls(hint, "gone", true);
        }
      }
      const shake = fx.shake;
      if (shake > 0.05) {
        L.style(page, "transform", `translate(${((Math.random() - 0.5) * shake).toFixed(1)}px, ${((Math.random() - 0.5) * shake).toFixed(1)}px)`);
        st[SHAKING] = 1;
      } else if (st[SHAKING]) {
        L.style(page, "transform", "none");
        st[SHAKING] = 0;
      }
      const active = fx.live > 0 || st[SCORCH]! > 0;
      if (active || st[DRAWN]) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, bw, bh);
        if (active) {
          const light = st[LIGHT] === 1;
          fx.drawGround(ctx, light);
          fx.draw(ctx, light);
        }
        st[DRAWN] = active ? 1 : 0;
      }
      if (st[TICK]!++ % 6 === 0) hud();
    },
  });

  // ---------- HUD: engine.stats(), about 10 times a second ----------
  const cells = new Map<string, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-stat]")) cells.set(el.dataset.stat!, el);
  const put = (key: string, v: string) => {
    const el = cells.get(key);
    if (el && el.textContent !== v) el.textContent = v;
  };
  function hud() {
    const s = engine.stats(), w = s.pools.waves!;
    put("frames", String(s.frames));
    put("steps", String(s.steps));
    put("dropped", String(s.dropped));
    put("ms", s.frameMs.avg.toFixed(2));
    put("waves", `${w.used}/${w.cap}`);
    put("particles", `${fx.live}/420`);
    put("ledger", String(s.ledger));
    put("layout", String((engine as typeof engine & { violations?: number }).violations ?? 0));
    const state = engine.running ? "RUNNING" : s.paused.includes("reduced-motion") ? "STILL · REDUCED MOTION" : `PAUSED · ${s.paused.join(" · ").toUpperCase()}`;
    if (stateEl.textContent !== state) stateEl.textContent = state;
    root.dataset.running = engine.running ? "1" : "0";
  }

  // ---------- Recall: the ledger gives the page back; the simulation forgets ----------
  let slamTimer = 0;
  function recall() {
    st[RECALL] = 0;
    engine.ledger.restore();
    for (const a of [X, Y, VX, VY, ROT, SPIN]) a.fill(0);
    awake.fill(0);
    dirty.fill(0);
    flip.fill(0);
    waves.clear();
    fx.clear();
    st[SCORCH] = st[SHAKING] = st[PENDING] = 0;
    st[DRAWN] = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sfx.play("power");
    slamWrap.hidden = false;
    slam(slamWrap.firstElementChild as HTMLElement);
    clearTimeout(slamTimer);
    slamTimer = window.setTimeout(() => (slamWrap.hidden = true), 1500);
    hud();
  }

  // Reduced motion: the engine stays paused; run the time by hand and show only the end state.
  const settle = () => {
    for (let i = 0; i < 150; i++) engine.advance(1 / 60);
  };
  const on = { signal: engine.signal };
  board.addEventListener("pointerdown", () => !engine.running && settle(), on);
  press(root.querySelector<HTMLElement>("[data-blast]")!, () => {
    pad.press("blast");
    pad.press("blast", false);
    if (!engine.running) settle();
  }, engine.signal);
  press(root.querySelector<HTMLElement>("[data-recall]")!, recall, engine.signal);
  const soundKey = root.querySelector<HTMLElement>("[data-sound]")!;
  press(soundKey, () => {
    sfx.on = !sfx.on;
    soundKey.setAttribute("aria-pressed", String(sfx.on));
  }, engine.signal);

  new ResizeObserver(() => (st[MEASURE] = 1)).observe(board);
  engine.start();
  hud();
  // For the site test (and the curious): the engine behind the demo.
  (window as unknown as { fizletDemo: unknown }).fizletDemo = { engine, fx };
  return engine;
}
