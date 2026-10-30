/**
 * Hero arena: the landing page's live mini battle, on Fizlet. Two platoons drawn with the game's own
 * tank sprites roam the whole hero, shell each other, flatten the board's shapes, and knock the
 * headline's letters around (shots and treads both). Tap the field (or the AIRSTRIKE key) to call a
 * strike.
 *
 * fizlet/slot mounts it (index.astro) once the hero is near and the main thread is idle; under
 * reduced motion it never loads and the hero keeps its still poster (ArenaPoster.astro). One engine
 * (kernel): layout is read in its read phase (only after a resize, a font load or a theme change),
 * the battle steps at a fixed 60 Hz (sim.ts: no allocation, no DOM), and render draws the canvas
 * and writes the page (letters, HUD, the copy's shake) through the engine's ledger only, change-only.
 * It pauses offscreen and in hidden tabs; REST seconds after the last visitor input the battle stops
 * firing and the engine settles to no frames at all until the next pointer move, tap or scroll.
 * destroy() (Recall) gives the hero back exactly as it was.
 */
import { createEngine } from "../../../../src/kernel/engine";
import { effects } from "../../../../src/fx";
import { sprites } from "../../../../src/sprite";
import type { SlotMount } from "../../../../src/slot";
import type { createGameAudio } from "./audio";
import { createArena, WORDS, KNOCK, LETTERS, KEEP, ATTACK, TEAM_A, TEAM_B, REST } from "./sim";
import { TANK } from "./tank";

const TAU = Math.PI * 2;
/** Token → fx colour slot (sim.ts WHITE … HULL); the fallbacks are the dark theme's. */
const TOKENS: [string, string][] = [["", "#fff4ff"], ["--hurt", "#ffc21a"], ["--k-advance", "#ff8a1f"], ["--k-attack", "#ff2e88"], ["--k-sys", "#19f0ff"], ["--team-a", "#39ffb0"], ["--team-b", "#ff5c8f"], ["--k-cmd", "#9a63ff"], ["", "#151020"]];
const easeBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
/** CSS cubic-bezier(x1, y1, x2, y2) at progress x (Newton's method; the curves here are monotone in x). */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const f = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(f) < 1e-6 || Math.abs(d) < 1e-6) break;
    t -= f / d;
  }
  return ((ay * t + by) * t + cy) * t;
}
/** Keyframes as the Web Animations API plays them: linear between offsets, the first and last
 *  segments extended past 0 and 1 (an overshooting easing). */
function key(off: readonly number[], v: readonly number[], e: number) {
  let i = 0;
  while (i < off.length - 2 && e > off[i + 1]!) i++;
  return v[i]! + ((e - off[i]!) / (off[i + 1]! - off[i]!)) * (v[i + 1]! - v[i]!);
}
const KNOCK_AT = [0, 0.3, 0.7, 1], SQUASH_AT = [0, 0.18, 0.6, 0.82, 1];

export const mountArena: SlotMount = (stage, hero, first) => {
  const doc = hero.ownerDocument, win = doc.defaultView!;
  // Ambient hero: 30 fps like every Fizlet hero (two fixed 60 Hz steps a frame, same battle); the cap
  // takes the engine off the shared clock between frames (one timer), so it costs ~30 rAF calls a second.
  const engine = createEngine({ root: stage, settle: 0.5, fps: 30 });
  const L = engine.ledger, on = { signal: engine.signal };
  // The stage sits where the old canvas did: over the copy, under the HUD, never taking a tap.
  L.style(stage, "z-index", "2");
  L.style(stage, "pointer-events", "none");
  const canvas = L.add(doc.createElement("canvas"));
  canvas.className = "arena";
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const inner = hero.querySelector<HTMLElement>(".hero-inner");
  const counter = (sel: string) => hero.querySelector(sel)?.firstChild as Text | null;
  const hud = [counter("[data-wrecks]"), counter("[data-flat]"), counter("[data-strikes]")];
  const letterEls = [...hero.querySelectorAll<HTMLElement>(".hx")].slice(0, LETTERS);
  const keepEls = [...hero.querySelectorAll<HTMLElement>(".hero-title, .lead, .hero-ctas, .hero-top, .arena-hud")].slice(0, KEEP);

  const colors = TOKENS.map(([, c]) => c);
  const fx = effects({ colors, words: WORDS });
  // Hull and turret per team; palette 2 is the turret's muzzle flash.
  const pals = [{ team: colors[TEAM_A]! }, { team: colors[TEAM_B]! }, { team: "#fff8d4" }];
  const art = sprites(TANK, { palettes: pals });
  // Sound starts off (as it always has): the synth loads with the first press of the sound key.
  type Audio = ReturnType<typeof createGameAudio>;
  let audio: Audio | null = null;
  const A = createArena(engine, fx);
  const { F, N, tx, ty } = A;
  // View: device pixels per CSS px, canvas size; what the read phase must redo.
  let dpr = 1, cw = 0, ch = 0, light = false, hqFont = "", relayout = 1, recolour = 1, letters = 0;
  const lightFill = "rgba(255,255,255,.7)", darkFill = "rgba(7,6,15,.55)";

  function colours() {
    recolour = 0;
    const s = win.getComputedStyle(doc.documentElement);
    TOKENS.forEach(([name], i) => name && (colors[i] = s.getPropertyValue(name).trim() || colors[i]!));
    pals[0]!.team = colors[TEAM_A]!;
    pals[1]!.team = colors[TEAM_B]!;
    art.clear();
    light = doc.documentElement.dataset.theme === "light";
  }
  /** Hero-relative layout box (transforms ignored: a knocked letter keeps its home). */
  function box(el: HTMLElement, out: Float64Array[], i: number) {
    let x = 0, y = 0;
    for (let e: HTMLElement | null = el; e && e !== hero; e = e.offsetParent as HTMLElement | null) (x += e.offsetLeft), (y += e.offsetTop);
    out[0]![i] = x;
    out[1]![i] = y;
    out[2]![i] = el.offsetWidth;
    out[3]![i] = el.offsetHeight;
  }
  function layout() {
    relayout = 0;
    const w = hero.clientWidth, h = hero.clientHeight;
    let n = 0;
    const lb = [A.lx, A.ly, A.lw, A.lh];
    for (const el of letterEls) {
      box(el, lb, n);
      if (A.lw[n]! > 4) n++;
    }
    // Letters keep their order, so an animation in flight stays on its letter.
    letters = N[A.NL] = n;
    const kb = [A.kl, A.kt, A.kr, A.kb];
    keepEls.forEach((el, i) => (box(el, kb, i), (A.kr[i]! += A.kl[i]!), (A.kb[i]! += A.kt[i]!)));
    N[A.NK] = keepEls.length;
    const sc = A.resize(w, h);
    dpr = Math.min(win.devicePixelRatio || 1, F[A.W]! < 700 ? 1.5 : 2);
    hqFont = `700 ${Math.round(11 * (sc / 1.4))}px ui-monospace, monospace`;
  }
  colours();
  layout();

  // ---------- Render ----------
  const reticle = (x: number, y: number, r: number) => {
    ctx.arc(x, y, r, 0, TAU);
    for (let q = 0; q < 4; q++) {
      const c = q & 1 ? 0 : 1, s = q < 2 ? -1 : 1;
      ctx.moveTo(x + c * s * (r + 12), y + (1 - c) * s * (r + 12));
      ctx.lineTo(x + c * s * (r - 14), y + (1 - c) * s * (r - 14));
    }
  };
  function round(x: number, y: number, w: number, h: number, r: number) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function draw() {
    const W = F[A.W]!, H = F[A.H]!, sc = F[A.SC]!, k14 = sc / 1.4;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (pw !== cw || ph !== ch) (canvas.width = cw = pw), (canvas.height = ch = ph);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const shake = fx.shake, ox = shake ? (Math.random() * 2 - 1) * shake * 0.5 : 0, oy = shake ? (Math.random() * 2 - 1) * shake * 0.5 : 0;
    ctx.translate(ox, oy);
    if (inner) L.style(inner, "transform", shake > 4 ? `translate(${(ox * 0.4).toFixed(1)}px,${(oy * 0.4).toFixed(1)}px)` : "");
    // Scorch marks on the ground.
    fx.drawGround(ctx, light);
    // HQs: the game's dashed squares, exaggerated.
    for (let i = 0; i < 2; i++) {
      const s = 46 * k14, x = F[i ? A.BX : A.AX]!, y = F[i ? A.BY : A.AY]!;
      ctx.strokeStyle = ctx.fillStyle = colors[i ? TEAM_B : TEAM_A]!;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.globalAlpha = 0.75;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.65);
      ctx.globalAlpha = 0.9;
      ctx.font = hqFont;
      ctx.textAlign = "center";
      ctx.fillText(i ? "HQ B" : "HQ A", x, y - s * 0.45);
    }
    ctx.globalAlpha = 1;
    // Shapes from the board.
    for (let p = 0; p < N[A.NP]!; p++) {
      const x = A.px[p]!, y = A.py[p]!, kind = A.pk[p]!, tint = colors[A.propTint(kind)]!;
      if (A.crushed[p]! > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = tint;
        ctx.fillRect(x - A.ps[p]! * 0.6, y - 2, A.ps[p]! * 1.2, 4);
        ctx.globalAlpha = 1;
        continue;
      }
      const s = A.ps[p]! * (A.pop[p]! < 1 ? 0.4 + 0.6 * easeBack(A.pop[p]!) : 1);
      ctx.lineWidth = 3;
      ctx.strokeStyle = tint;
      ctx.fillStyle = light ? lightFill : darkFill;
      ctx.beginPath();
      if (kind === 0) round(x - s / 2, y - s / 2, s, s, s * 0.3);
      else if (kind === 1) ctx.rect(x - s / 2, y - s / 2, s, s);
      else if (kind === 2) ctx.arc(x, y, s / 2, 0, TAU);
      else round(x - s * 0.7, y - s * 0.28, s * 1.4, s * 0.56, s * 0.28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = tint;
      if (kind === 1) ctx.fillRect(x - s * 0.18, y - s * 0.18, s * 0.36, s * 0.36);
      if (kind === 2) ctx.fillRect(x + s * 0.22, y - s * 0.42, s * 0.2, s * 0.2);
    }
    // Strike reticles.
    ctx.strokeStyle = colors[ATTACK]!;
    ctx.lineWidth = 3;
    for (let q = 0; q < N[A.NQ]!; q++) {
      const k = A.qt[q]! / 0.42;
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.beginPath();
      reticle(A.qx[q]!, A.qy[q]!, 30 + 60 * k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Tanks: hull, then the turret on top (its own angle, recoil frame and muzzle-flash palette).
    for (let i = 0; i < N[A.NT]!; i++) {
      if (A.dead[i]) continue;
      const t = A.team[i]!, k = sc * (A.drop[i]! < 1 ? 0.6 + 0.4 * easeBack(A.drop[i]!) : 1);
      art.draw(ctx, 0, Math.floor(A.tread[i]!) % 2, tx[i]!, ty[i]!, A.ta[i]!, k, t);
      art.draw(ctx, 1, Math.round(A.recoil[i]!), tx[i]!, ty[i]!, A.tt[i]!, k, A.flash[i]! > 0 ? 2 : t);
      const hp = A.hp[i]!;
      if (hp < 3) {
        ctx.fillStyle = colors[hp === 1 ? ATTACK : 1]!;
        for (let j = 0; j < 3; j++) (ctx.globalAlpha = j < hp ? 1 : 0.25), ctx.fillRect(tx[i]! - 10 + j * 8, ty[i]! - 22 * sc, 6, 4);
        ctx.globalAlpha = 1;
      }
    }
    // Shells.
    ctx.lineCap = "round";
    for (let s = 0; s < N[A.NS]!; s++) {
      const x = A.sx[s]!, y = A.sy[s]!;
      ctx.strokeStyle = colors[A.teamColor(A.st[s]!)]!;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - A.svx[s]! * 0.04, y - A.svy[s]! * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors[0]!;
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    // Particles, pop words.
    fx.draw(ctx, light);
  }
  /** The headline letters: the knock and squash keyframes the hero always played, on the engine's clock. */
  function animateLetters() {
    const now = F[A.NOW]!;
    for (let i = 0; i < letters; i++) {
      const kind = A.anim[i]!;
      if (!kind) continue;
      const el = letterEls[i]!, p = (now - A.t0[i]!) / (kind === KNOCK ? 0.82 : 1);
      let transform = "", color = "";
      if (p >= 1) A.anim[i] = 0;
      else if (kind === KNOCK) {
        const e = bezier(0.2, 0.9, 0.3, 1.2, p), dx = A.ldx[i]!, dy = A.ldy[i]!, s = A.spin[i]!;
        const tx_ = key(KNOCK_AT, [0, dx, dx * 0.3, 0], e), ty_ = key(KNOCK_AT, [0, dy, Math.max(0, dy * -0.1), 0], e);
        transform = `translate(${tx_.toFixed(2)}px,${ty_.toFixed(2)}px) rotate(${key(KNOCK_AT, [0, s, -s * 0.15, 0], e).toFixed(2)}deg) scale(${key(KNOCK_AT, [1, 1.15, 1, 1], e).toFixed(3)})`;
        const c = Math.max(0, Math.min(1, e < 0.3 ? e / 0.3 : 1 - (e - 0.3) / 0.7));
        color = `color-mix(in srgb,${colors[ATTACK]} ${(c * 100).toFixed(1)}%,currentColor)`;
      } else {
        const e = bezier(0, 0, 0.58, 1, p), across = A.spin[i]!;
        const sx = key(SQUASH_AT, across ? [1, 1.25, 1.25, 0.92, 1] : [1, 0.3, 0.3, 0.92, 1], e);
        const sy = key(SQUASH_AT, across ? [1, 0.28, 0.28, 1.12, 1] : [1, 1.15, 1.15, 1.12, 1], e);
        transform = `scale(${sx.toFixed(3)},${sy.toFixed(3)}) translateY(${(across ? key(SQUASH_AT, [0, 40, 40, 0, 0], e) : 0).toFixed(1)}%)`;
      }
      L.style(el, "transform", transform);
      L.style(el, "color", color);
    }
  }

  engine.add({
    read() {
      if (recolour) colours();
      if (relayout) layout();
    },
    step: (_, dt) => A.step(dt),
    render(e) {
      draw();
      animateLetters();
      if (N[A.HUD]) {
        N[A.HUD] = 0;
        const v = [String(N[A.WRECKS]).padStart(3, "0"), String(N[A.FLAT]).padStart(3, "0"), String(N[A.STRUCK]).padStart(2, "0")];
        hud.forEach((t, i) => t && L.text(t, v[i]!));
      }
      if (audio) for (let i = 0; i < e.events.size; i++) audio.play(e.events.at(i)!.type);
    },
    pause: () => audio?.silence(),
  });

  // ---------- Wiring (every listener and observer ends with the engine) ----------
  // A resize, a font or a theme redraws (a resting battle stays at rest); a visitor wakes the battle.
  const wake = () => engine.wake();
  const visit = () => ((F[A.QUIET] = 0), engine.wake());
  const ro = new win.ResizeObserver(() => ((relayout = 1), wake()));
  ro.observe(hero);
  const mo = new win.MutationObserver(() => ((recolour = 1), wake()));
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (ro.disconnect(), mo.disconnect(), audio?.close()));
  void doc.fonts?.ready.then(() => engine.signal.aborted || ((relayout = 1), wake()));
  const strike = (x: number, y: number) => A.strike(x, y) && (audio?.play("fire"), engine.wake());
  /** A strike on a tank that's on the field (the AIRSTRIKE key), or the middle when none is. */
  const airstrike = () => {
    let n = 0, pick = -1;
    for (let i = 0; i < N[A.NT]!; i++) if (!A.dead[i] && tx[i]! > 0 && tx[i]! < F[A.W]! && Math.random() * ++n < 1) pick = i;
    strike(pick < 0 ? F[A.W]! / 2 : tx[pick]!, pick < 0 ? F[A.H]! / 2 : ty[pick]!);
  };
  const keyed = (t: EventTarget | null) => (t as Element | null)?.closest?.("a, button, input, label, [data-no-strike]");
  hero.addEventListener("pointerdown", (ev) => {
    visit();
    if (keyed(ev.target)) return;
    audio?.unlock(ev);
    const r = hero.getBoundingClientRect(); // one read per tap, outside any frame
    strike(ev.clientX - r.left, ev.clientY - r.top);
  }, on);
  hero.addEventListener("pointermove", visit, { ...on, passive: true });
  win.addEventListener("scroll", visit, { ...on, passive: true });
  hero.querySelector("[data-airstrike]")?.addEventListener("click", (ev) => (audio?.unlock(ev), airstrike()), on);
  const sound = hero.querySelector<HTMLElement>("[data-sound]");
  let synth: Promise<Audio> | undefined;
  sound?.addEventListener("click", async (ev) => {
    const a = await (synth ??= import("./audio").then((m) => (audio = m.createGameAudio(doc, "battlefield-site", false))));
    if (engine.signal.aborted) return;
    a.toggle();
    a.unlock(ev);
    L.attr(sound, "aria-pressed", String(a.enabled));
  }, on);
  // The tap that loaded the scene: a key's own action, or a strike on the field.
  if (first) {
    const r = hero.getBoundingClientRect(), at = doc.elementFromPoint(r.left + first.x, r.top + first.y), k = keyed(at);
    if (!k) strike(first.x, first.y);
    else if (k.matches("[data-airstrike]")) airstrike();
  }
  engine.start();
  // ?debug: the browser test's handle (stats, Recall, rest now).
  if (win.location.search.includes("debug"))
    (win as unknown as { arena: object }).arena = { engine, arena: A, fx, rest: () => ((F[A.QUIET] = REST), engine.wake()) };
  return { destroy: () => engine.destroy() };
};
