/**
 * The hero battle as data: two platoons roam the hero, shell each other, flatten the board's shapes
 * and knock the headline's letters; airstrikes from the visitor. Struct-of-arrays in fixed typed
 * arrays (no objects, no closures, no growth), stepped by the engine at a fixed 60 Hz: a step never
 * allocates, reads layout or writes the DOM. The scene (scene.ts) measures the hero into `field`
 * and the letter boxes in its read phase and draws all of it in render; effects are fizlet/fx and
 * sounds go out through the engine's event ring.
 */
import type { Engine } from "../../../../src/kernel/engine";
import type { Effects } from "../../../../src/fx";

/** Caps: 5 tanks a side, the shapes a 2560 × 1440 hero asks for, shells, letters, layout rects. */
export const TANKS = 10, PROPS = 64, SHELLS = 48, LETTERS = 64, KEEP = 8, STRIKES = 6, LATER = 32;
/** fx colour table slots (the scene fills them from the page's tokens). */
export const WHITE = 0, HURT = 1, ADVANCE = 2, ATTACK = 3, SYS = 4, TEAM_A = 5, TEAM_B = 6, CMD = 7, HULL = 8;
/** fx word table: the boom words first (picked at random), then the fixed ones. */
export const WORDS = ["BOOM", "KABOOM", "WRECKED", "DIRECT HIT", "BLAM", "FLATTENED", "AIRSTRIKE!", "HIT"];
const BOOMS = 5, FLATTENED = 5, AIRSTRIKE = 6, HIT = 7;
/** Letter animations: knocked by a blast (0.82 s), flattened by a tread (1 s). */
export const KNOCK = 1, SQUASH = 2;
/** Seconds after the last visitor input before the battle rests (stops firing, then settles). */
export const REST = 30;

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Math.hypot returns a fresh heap number on every call (an allocation per step); this doesn't. */
const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
const f64 = (n: number) => new Float64Array(n);

export function createArena(e: Engine, fx: Effects) {
  const R = e.random, ev = e.events;
  const rand = (a: number, b: number) => a + R() * (b - a);
  // The field: W, H, scale, HQ A (x, y), HQ B (x, y), clock (s), quiet time (s), squash lock (s).
  const F = f64(11);
  const W = 0, H = 1, SC = 2, AX = 3, AY = 4, BX = 5, BY = 6, NOW = 7, QUIET = 8, SQUASHED = 9;
  F[SC] = 1.5;
  // Counts: tanks, props, shells, letters, keep-out rects, strikes waiting, blasts waiting; HUD
  // (wrecks, flattened, strikes) and a HUD-changed flag.
  const N = new Int32Array(11);
  const NT = 0, NP = 1, NS = 2, NL = 3, NK = 4, NQ = 5, ND = 6, WRECKS = 7, FLAT = 8, STRUCK = 9, HUD = 10;

  // Tanks.
  const team = new Uint8Array(TANKS), tx = f64(TANKS), ty = f64(TANKS), ta = f64(TANKS), tt = f64(TANKS), tv = f64(TANKS), hp = new Int32Array(TANKS);
  const cool = f64(TANKS), tread = f64(TANKS), recoil = f64(TANKS), flash = f64(TANKS), gx = f64(TANKS), gy = f64(TANKS), think = f64(TANKS), dead = f64(TANKS), drop = f64(TANKS);
  // Target: kind (0 none, 1 tank, 2 prop, 3 letter), index, point.
  const tk = new Uint8Array(TANKS), ti = new Int32Array(TANKS), tgx = f64(TANKS), tgy = f64(TANKS);
  // Shapes from the board: x, y, size, kind 0-3, crushed (s left), pop-in (0..1).
  const px = f64(PROPS), py = f64(PROPS), ps = f64(PROPS), pk = new Uint8Array(PROPS), crushed = f64(PROPS), pop = f64(PROPS);
  // Shells: team, x, y, vx, vy, life, size.
  const st = new Uint8Array(SHELLS), sx = f64(SHELLS), sy = f64(SHELLS), svx = f64(SHELLS), svy = f64(SHELLS), sl = f64(SHELLS), sb = f64(SHELLS);
  // Headline letters (hero px, measured without transforms) and their animation: busy until, kind, start, numbers.
  const lx = f64(LETTERS), ly = f64(LETTERS), lw = f64(LETTERS), lh = f64(LETTERS), busy = f64(LETTERS);
  const anim = new Uint8Array(LETTERS), t0 = f64(LETTERS), ldx = f64(LETTERS), ldy = f64(LETTERS), spin = f64(LETTERS);
  // Copy and keys the shapes keep off (left, top, right, bottom).
  const kl = f64(KEEP), kt = f64(KEEP), kr = f64(KEEP), kb = f64(KEEP);
  // Airstrikes on their way (x, y, seconds left) and follow-up blasts (x, y, seconds, size, tint).
  const qx = f64(STRIKES), qy = f64(STRIKES), qt = f64(STRIKES);
  const dx = f64(LATER), dy = f64(LATER), dt = f64(LATER), ds = f64(LATER), dc = new Uint8Array(LATER);

  const teamColor = (t: number) => (t ? TEAM_B : TEAM_A);
  const propTint = (k: number) => (k === 0 ? TEAM_A : k === 1 ? SYS : k === 2 ? HURT : CMD);

  function newProp(i: number) {
    let x = 0, y = 0;
    const k = (R() * 4) | 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rand(30, F[W]! - 30);
      y = rand(40, F[H]! - 30);
      let clear = true;
      for (let j = 0; j < N[NK]!; j++) if (x > kl[j]! - 30 && x < kr[j]! + 30 && y > kt[j]! - 30 && y < kb[j]! + 30) clear = false;
      if (clear) break;
    }
    px[i] = x;
    py[i] = y;
    ps[i] = rand(22, 40) * (F[SC]! / 1.4);
    pk[i] = k;
    crushed[i] = pop[i] = 0;
  }
  /** Enter from the team's own edge (the intro drives everyone in from off screen), or at its HQ. */
  function spawnTank(i: number, t: number, intro: boolean) {
    const w = F[W]!, h = F[H]!, hx = F[t ? BX : AX]!, hy = F[t ? BY : AY]!;
    team[i] = t;
    tx[i] = intro ? (t ? w + rand(40, 160) : -rand(40, 160)) : hx + rand(-30, 30);
    ty[i] = intro ? rand(h * 0.15, h * 0.9) : hy + rand(-30, 30);
    ta[i] = tt[i] = t ? Math.PI : 0;
    tv[i] = rand(62, 92);
    hp[i] = 3;
    cool[i] = rand(0.8, 2.4);
    tread[i] = recoil[i] = flash[i] = think[i] = dead[i] = 0;
    gx[i] = rand(w * 0.1, w * 0.9);
    gy[i] = rand(h * 0.15, h * 0.9);
    tk[i] = 0;
    drop[i] = intro ? 0 : 1;
  }

  /** The field changed size (read phase): HQs, tank and shape counts follow it. */
  function resize(w: number, h: number) {
    F[W] = w = Math.max(320, w);
    F[H] = h = Math.max(320, h);
    const sc = (F[SC] = w < 560 ? 1.05 : w < 900 ? 1.3 : 1.6);
    if (w < 700) (F[AX] = w * 0.84), (F[AY] = h * 0.6);
    else (F[AX] = w * 0.42), (F[AY] = h * 0.86);
    F[BX] = w * 0.88;
    F[BY] = h * 0.17;
    const want = (w < 560 ? 3 : w < 900 ? 4 : 5) * 2;
    for (let i = N[NT]!; i < want; i++) spawnTank(i, i % 2, true);
    N[NT] = want;
    const props = Math.min(PROPS, Math.round((w * h) / 60000));
    for (let i = N[NP]!; i < props; i++) newProp(i);
    N[NP] = props;
    for (let i = 0; i < want; i++) (tx[i] = Math.min(w - 20, tx[i]!)), (ty[i] = Math.min(h - 20, ty[i]!));
    return sc;
  }
  // ---------- Effects ----------
  function blast(x: number, y: number, size: number, tint: number) {
    const k = size * (F[SC]! / 1.4);
    fx.blast(x, y, k, tint);
    // Shots and blasts knock any letter in reach, away from the centre.
    const reach = 46 * k;
    for (let i = 0; i < N[NL]!; i++) {
      const cx = lx[i]! + lw[i]! / 2, cy = ly[i]! + lh[i]! / 2, d = len(cx - x, cy - y);
      if (d < reach + lw[i]! / 2) knock(i, (cx - x) / (d || 1), (cy - y) / (d || 1), size);
    }
  }
  function later(x: number, y: number, s: number, size: number, tint: number) {
    const i = N[ND]!;
    if (i === LATER) return;
    N[ND] = i + 1;
    dx[i] = x;
    dy[i] = y;
    dt[i] = s;
    ds[i] = size;
    dc[i] = tint;
  }
  function knock(i: number, nx: number, ny: number, power: number) {
    const now = F[NOW]!;
    if (now < busy[i]!) return;
    busy[i] = now + 0.9;
    const p = Math.min(2.4, power);
    anim[i] = KNOCK;
    t0[i] = now;
    ldx[i] = nx * 26 * p;
    ldy[i] = ny * 22 * p - 18 * p;
    spin[i] = (nx >= 0 ? 1 : -1) * rand(25, 70) * p;
  }
  function squash(i: number, angle: number) {
    const now = F[NOW]!;
    // One flattened letter at a time keeps the headline readable.
    if (now < busy[i]! || now < F[SQUASHED]!) return;
    busy[i] = now + 1.1;
    F[SQUASHED] = now + 0.7;
    N[FLAT]!++;
    N[HUD] = 1;
    fx.word(lx[i]! + lw[i]! / 2, ly[i]!, FLATTENED, HURT, 12.8);
    anim[i] = SQUASH;
    t0[i] = now;
    spin[i] = Math.abs(Math.cos(angle)) > 0.5 ? 1 : 0; // across: flattened flat; along: squeezed thin
  }
  function kill(i: number, strike: boolean) {
    const x = tx[i]!, y = ty[i]!, k = F[SC]! / 1.4;
    dead[i] = rand(1.4, 2.4);
    N[WRECKS]!++;
    N[HUD] = 1;
    blast(x, y, 2.2, teamColor(team[i]!));
    later(x + rand(-18, 18), y + rand(-18, 18), 0.14, 1.2, HURT);
    // The hull breaks up: team-coloured chunks and the turret spin away.
    for (let j = 0; j < 9; j++) {
      const a = rand(0, TAU), sp = rand(90, 220);
      fx.spawn(0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(7, 14) * k, 1.1, j % 3 ? teamColor(team[i]!) : HULL, rand(0, TAU), rand(-12, 12));
    }
    fx.word(x, y - 20, strike ? AIRSTRIKE : (R() * BOOMS) | 0, teamColor(1 - team[i]!), 19.2);
    ev.emit("tank-destroyed");
  }
  function wreckProp(i: number) {
    crushed[i] = rand(5, 9);
    for (let j = 0; j < 8; j++) {
      const a = rand(0, TAU), sp = rand(60, 180);
      fx.spawn(0, px[i]!, py[i]!, Math.cos(a) * sp, Math.sin(a) * sp, ps[i]! * rand(0.18, 0.32), 0.8, propTint(pk[i]!), rand(0, TAU), rand(-10, 10));
    }
  }

  // ---------- Airstrike ----------
  /** Call a strike at (x, y) in hero px (input, outside a step): false when six are already coming. */
  function strike(x: number, y: number) {
    const i = N[NQ]!;
    if (i === STRIKES) return false;
    N[NQ] = i + 1;
    qx[i] = x;
    qy[i] = y;
    qt[i] = 0.42;
    N[STRUCK]!++;
    N[HUD] = 1;
    F[QUIET] = 0;
    return true;
  }
  function detonate(x: number, y: number) {
    blast(x, y, 3.2, ATTACK);
    later(x + rand(-30, 30), y + rand(-24, 24), 0.09, 1.6, ADVANCE);
    later(x + rand(-30, 30), y + rand(-24, 24), 0.19, 1.3, SYS);
    const r = 95 * (F[SC]! / 1.4);
    for (let i = 0; i < N[NT]!; i++) if (!dead[i] && len(tx[i]! - x, ty[i]! - y) < r) kill(i, true);
    for (let i = 0; i < N[NP]!; i++) if (!crushed[i] && len(px[i]! - x, py[i]! - y) < r) wreckProp(i);
    for (let i = 0; i < N[NL]!; i++) {
      const cx = lx[i]! + lw[i]! / 2, cy = ly[i]! + lh[i]! / 2, d = len(cx - x, cy - y);
      if (d < r * 1.6) knock(i, (cx - x) / (d || 1), (cy - y) / (d || 1), 2.6 - d / r);
    }
    ev.emit("hurt");
  }

  // ---------- Simulation ----------
  function choose(i: number) {
    const w = F[W]!, h = F[H]!;
    think[i] = rand(1.2, 2.6);
    let near = -1, best = Infinity;
    for (let j = 0; j < N[NT]!; j++) {
      if (dead[j] || team[j] === team[i] || drop[j]! < 1) continue;
      const d = len(tx[j]! - tx[i]!, ty[j]! - ty[i]!);
      if (d < best) (best = d), (near = j);
    }
    const roll = R(), nl = N[NL]!;
    if (near >= 0 && best < w * 0.55 && roll < 0.62) (tk[i] = 1), (ti[i] = near), (tgx[i] = tx[near]!), (tgy[i] = ty[near]!);
    else if (nl && roll < 0.86) {
      const l = (R() * nl) | 0;
      tk[i] = 3;
      ti[i] = l;
      tgx[i] = lx[l]! + lw[l]! / 2;
      tgy[i] = ly[l]! + lh[l]! / 2;
    } else {
      let live = 0;
      for (let j = 0; j < N[NP]!; j++) if (!crushed[j]) live++;
      tk[i] = 0;
      for (let j = 0, k = (R() * live) | 0; live && j < N[NP]!; j++) if (!crushed[j] && !k--) (tk[i] = 2), (ti[i] = j), (tgx[i] = px[j]!), (tgy[i] = py[j]!);
    }
    // Drive somewhere: often straight over a letter or a shape, otherwise anywhere.
    const r = R();
    if (r < 0.2 && nl) {
      const l = (R() * nl) | 0;
      gx[i] = lx[l]! + lw[l]! / 2;
      gy[i] = ly[l]! + lh[l]! / 2;
    } else if (r < 0.55 && N[NP]!) {
      const p = (R() * N[NP]!) | 0;
      gx[i] = px[p]!;
      gy[i] = py[p]!;
    } else (gx[i] = rand(w * 0.05, w * 0.95)), (gy[i] = rand(h * 0.1, h * 0.92));
  }
  function fire(i: number) {
    const sc = F[SC]!, gun = 24 * sc, mx = tx[i]! + Math.cos(tt[i]!) * gun, my = ty[i]! + Math.sin(tt[i]!) * gun;
    const d = len(tgx[i]! - mx, tgy[i]! - my), sp = 560, a = tt[i]! + rand(-0.07, 0.07);
    recoil[i] = 6;
    flash[i] = 0.09;
    cool[i] = rand(1.1, 2.3);
    const s = N[NS]!;
    if (s < SHELLS) {
      N[NS] = s + 1;
      st[s] = team[i]!;
      sx[s] = mx;
      sy[s] = my;
      svx[s] = Math.cos(a) * sp;
      svy[s] = Math.sin(a) * sp;
      sl[s] = Math.min(1.4, d / sp + rand(-0.03, 0.05));
      sb[s] = tk[i] === 1 ? 1.25 : 1;
    }
    fx.spawn(1, mx, my, 0, 0, 9 * (sc / 1.4), 0.12, WHITE);
    ev.emit("fire");
  }

  function step(dt_: number) {
    const w = F[W]!, h = F[H]!, sc = F[SC]!;
    F[NOW]! += dt_;
    F[QUIET]! += dt_;
    const resting = F[QUIET]! >= REST;
    for (let i = N[NQ]! - 1; i >= 0; i--)
      if ((qt[i]! -= dt_) <= 0) {
        detonate(qx[i]!, qy[i]!);
        const n = --N[NQ]!;
        (qx[i] = qx[n]!), (qy[i] = qy[n]!), (qt[i] = qt[n]!);
      }
    for (let i = N[ND]! - 1; i >= 0; i--)
      if ((dt[i]! -= dt_) <= 0) {
        blast(dx[i]!, dy[i]!, ds[i]!, dc[i]!);
        const n = --N[ND]!;
        (dx[i] = dx[n]!), (dy[i] = dy[n]!), (dt[i] = dt[n]!), (ds[i] = ds[n]!), (dc[i] = dc[n]!);
      }
    for (let i = 0; i < N[NT]!; i++) {
      if (dead[i]) {
        if ((dead[i]! -= dt_) <= 0) spawnTank(i, team[i]!, false), (drop[i] = 0);
        continue;
      }
      if (drop[i]! < 1) drop[i] = Math.min(1, drop[i]! + dt_ * 1.6);
      recoil[i] = Math.max(0, recoil[i]! - dt_ * 30);
      flash[i] = Math.max(0, flash[i]! - dt_);
      // At rest the tanks hold where they are (the last shots still land).
      if (resting) continue;
      think[i]! -= dt_;
      cool[i]! -= dt_;
      if (think[i]! <= 0 || (tk[i] === 1 && (dead[ti[i]!] || ti[i]! >= N[NT]!))) choose(i);
      if (tk[i] === 1) (tgx[i] = tx[ti[i]!]!), (tgy[i] = ty[ti[i]!]!);
      // Drive: turn toward the goal, roll forward, slow on tight turns.
      const turn = wrap(Math.atan2(gy[i]! - ty[i]!, gx[i]! - tx[i]!) - ta[i]!);
      ta[i]! += Math.sign(turn) * Math.min(Math.abs(turn), 2.4 * dt_);
      const speed = tv[i]! * (Math.abs(turn) > 1.2 ? 0.35 : 1) * (sc / 1.4);
      tx[i]! += Math.cos(ta[i]!) * speed * dt_;
      ty[i]! += Math.sin(ta[i]!) * speed * dt_;
      tread[i]! += speed * dt_ * 0.15;
      if (len(gx[i]! - tx[i]!, gy[i]! - ty[i]!) < 24) think[i] = Math.min(think[i]!, 0.1);
      // Keep inside the field once on it.
      if (drop[i]! >= 1 || (tx[i]! > 0 && tx[i]! < w)) (tx[i] = Math.max(16, Math.min(w - 16, tx[i]!))), (ty[i] = Math.max(20, Math.min(h - 16, ty[i]!)));
      // Turret: track, fire when lined up.
      if (tk[i]) {
        const dta = wrap(Math.atan2(tgy[i]! - ty[i]!, tgx[i]! - tx[i]!) - tt[i]!);
        tt[i]! += Math.sign(dta) * Math.min(Math.abs(dta), 4.2 * dt_);
        if (cool[i]! <= 0 && Math.abs(dta) < 0.1 && tx[i]! > 0 && tx[i]! < w) fire(i);
      } else tt[i]! += wrap(ta[i]! - tt[i]!) * Math.min(1, dt_ * 3);
      // Treads: flatten shapes and letters underneath.
      const foot = 13 * sc;
      for (let p = 0; p < N[NP]!; p++)
        if (!crushed[p] && Math.abs(px[p]! - tx[i]!) < foot && Math.abs(py[p]! - ty[i]!) < foot) {
          crushed[p] = rand(5, 8);
          N[FLAT]!++;
          N[HUD] = 1;
          fx.word(px[p]!, py[p]! - 10, FLATTENED, HURT, 12.8);
          for (let j = 0; j < 6; j++) fx.spawn(0, px[p]!, py[p]!, rand(-90, 90), rand(-90, 90), ps[p]! * 0.2, 0.6, propTint(pk[p]!), 0, rand(-6, 6));
        }
      for (let l = 0; l < N[NL]!; l++)
        if (tx[i]! > lx[l]! && tx[i]! < lx[l]! + lw[l]! && ty[i]! > ly[l]! + lh[l]! * 0.15 && ty[i]! < ly[l]! + lh[l]! * 0.9) squash(l, ta[i]!);
    }
    // Tanks push apart.
    for (let i = 0; i < N[NT]!; i++)
      for (let j = i + 1; j < N[NT]!; j++) {
        if (dead[i] || dead[j]) continue;
        const ddx = tx[j]! - tx[i]!, ddy = ty[j]! - ty[i]!, d = len(ddx, ddy), min = 26 * sc;
        if (d > 0 && d < min) {
          const k = (min - d) / 2 / d;
          (tx[i]! -= ddx * k), (ty[i]! -= ddy * k), (tx[j]! += ddx * k), (ty[j]! += ddy * k);
        }
      }
    // Shells: fly, hit a tank on the way, or burst where they were aimed.
    for (let s = N[NS]! - 1; s >= 0; s--) {
      sx[s]! += svx[s]! * dt_;
      sy[s]! += svy[s]! * dt_;
      sl[s]! -= dt_;
      let hit = -1;
      for (let i = 0; i < N[NT]!; i++) if (!dead[i] && team[i] !== st[s] && drop[i]! >= 1 && len(tx[i]! - sx[s]!, ty[i]! - sy[s]!) < 15 * sc) hit = i;
      if (hit < 0 && sl[s]! > 0) continue;
      const x = sx[s]!, y = sy[s]!;
      blast(x, y, sb[s]!, teamColor(st[s]!));
      if (hit >= 0 && --hp[hit]! <= 0) kill(hit, false);
      else if (hit >= 0) fx.word(tx[hit]!, ty[hit]! - 16, HIT, HURT, 12.8), ev.emit("kill");
      for (let p = 0; p < N[NP]!; p++) if (!crushed[p] && len(px[p]! - x, py[p]! - y) < ps[p]!) wreckProp(p);
      const n = --N[NS]!;
      (st[s] = st[n]!), (sx[s] = sx[n]!), (sy[s] = sy[n]!), (svx[s] = svx[n]!), (svy[s] = svy[n]!), (sl[s] = sl[n]!), (sb[s] = sb[n]!);
    }
    for (let p = 0; p < N[NP]!; p++) {
      if (crushed[p]! > 0) {
        if ((crushed[p]! -= dt_) <= 0) newProp(p);
      } else pop[p] = Math.min(1, pop[p]! + dt_ * 2.5);
    }
    fx.step(dt_);
    // Awake while visited; at rest, until the last shell, blast, letter and pop-in have landed.
    let moving = !resting || N[NS]! > 0 || N[NQ]! > 0 || N[ND]! > 0 || fx.live > 0;
    for (let l = 0; !moving && l < N[NL]!; l++) moving = F[NOW]! < busy[l]!;
    for (let i = 0; !moving && i < N[NT]!; i++) moving = !dead[i] && (drop[i]! < 1 || recoil[i]! > 0);
    for (let p = 0; !moving && p < N[NP]!; p++) moving = !crushed[p] && pop[p]! < 1;
    if (moving) e.busy();
  }

  return {
    F, N, W, H, SC, AX, AY, BX, BY, NOW, QUIET, NT, NP, NS, NL, NK, NQ, WRECKS, FLAT, STRUCK, HUD,
    team, tx, ty, ta, tt, hp, tread, recoil, flash, dead, drop,
    px, py, ps, pk, crushed, pop, propTint, teamColor,
    st, sx, sy, svx, svy,
    lx, ly, lw, lh, busy, anim, t0, ldx, ldy, spin,
    kl, kt, kr, kb, qx, qy, qt,
    resize, strike, step, newProp,
  };
}
export type Arena = ReturnType<typeof createArena>;
