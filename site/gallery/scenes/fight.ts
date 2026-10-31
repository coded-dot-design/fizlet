// The fight scene: two original pixel robots in a tiny one-on-one arcade bout (health bars, hit
// sparks, pop words, a KO and a winner banner). A bout is data: a gag picks a script of beats
// (time, move, who, how much) and the scene plays it once, then sleeps on the last frame; a tap
// plays it again. Bricks: the kernel (settle + fps cap), fzlt/sprite (the fighters, baked once)
// and fzlt/fx (sparks, pop words, the overflow blast, shake). Mounted through fzlt/slot: it
// loads near the viewport, never under reduced motion, and destroy() gives the page back.
import { createEngine } from "../../../src/kernel/index";
import { effects, emitter, SPARK } from "../../../src/fx";
import { sprites } from "../../../src/sprite";
import type { SlotScene, SlotTap } from "../../../src/slot";
import { aspect, mark } from "../aspect";

export type Fighter = "transformer" | "diffuser" | "tokenizer" | "hallucinator" | "context" | "overfitter";
export type Gag = "ko" | "combo" | "overflow" | "hallucinate" | "overfit" | "diffuse";
export interface Fight {
  /** The bout's script: a plain KO, a token-counting combo, a context window overflow, punching a
   *  hallucinated ghost, an overfit block that breaks on unseen data, or rising from static. */
  gag: Gag;
  /** The star (left, facing right) and the opponent (right). */
  a: Fighter;
  b: Fighter;
  /** Hex colours from the Board UI tokens: star, opponent, sparks, KO, white. */
  colors: string[];
  /** Seconds after the bout ends before it plays again while visible; 0: once, then it sleeps. */
  loop: number;
  /** Size multiplier for the fighters. */
  scale: number;
}
export type FightScene = SlotScene & { engine: ReturnType<typeof createEngine>; play(): void };

// The fighters: a name and a 5-row head (10 wide) on one shared robot body. a: body, b: panel,
// e: glow, w: white, k: dark. All original characters.
const HEADS: Record<Fighter, string[]> = {
  transformer: ["TRANSFORMER", "..e..e..e.", "..k..k..k.", ".aaaaaaaa.", ".aawwaaww.", ".aaaakkaa."],
  diffuser: ["DIFFUSER", "...aaaa...", "..aeaabaa.", ".aaaaaeaa.", ".aawwawwa.", ".aeaaaaba."],
  tokenizer: ["TOKENIZER", ".kkkkkkkk.", ".aaaaaaaa.", ".aawwaawwa", ".akekekea.", ".aaaaaaaa."],
  hallucinator: ["HALLUCINATOR", "....ee....", ".aaaaaaaa.", ".aewaaewa.", ".awealwea.", ".aaakkaaa."],
  context: ["CONTEXT WINDOW", ".bbbbbbbb.", ".bkkkkkkb.", ".bkwkkwkb.", ".bkkeekkb.", ".bbbbbbbb."],
  overfitter: ["OVERFITTER", "kkkkkkkkkk", "...kkkk..e", ".aaaaaaaa.", ".aawwaaww.", ".aaaaaaaa."],
};
// Body poses (18 wide; the head sits at columns 4-13): idle, punch, block, hit.
const BODY = [
  [".......kkkk.......", "....aaaaaaaaaa....", "...aabbbbbbbbaa...", "...aabbbbbbbbaa...", "...aa.aaaaaa.aa...", "...ww.aaaaaa.ww...", "......aa..aa......", "......aa..aa......", ".....aaa..aaa....."],
  [".......kkkk.......", "....aaaaaaaaaaaaww", "...aabbbbbbbb..www", "...aabbbbbbbb.....", "...aa.aaaaaa......", "...ww.aaaaaa......", "......aa...aa.....", "......aa....aa....", ".....aaa....aaa..."],
  [".......kkkk.......", "....aaaaaaaaaa.ww.", "...aabbbbbbbbaaww.", "...aabbbbbbbb.....", "...aa.aaaaaa......", "......aaaaaa......", "......aa..aa......", "......aa..aa......", ".....aaa..aaa....."],
  [".......kkkk.......", "...aaaaaaaaaa.....", "..aabbbbbbbbaa....", ".ww.bbbbbbbb.aa...", "....aaaaaaa..ww...", "....aaaaaaa.......", ".....aa..aa.......", "....aa....aa......", "...aaa....aaa....."],
];
// Pop words (fx word table): 9-16 are the combo's token counts.
const WORDS = ["FIGHT!", "KO!", "BLOCK", "MISS", "???", "OVERFLOW!", "UNSEEN DATA!", "DENOISED", "POW", "1 TOK", "2 TOK", "3 TOK", "4 TOK", "5 TOK", "6 TOK", "7 TOK", "8 TOK", "512 TOKENS!"];
// Moves: WORD (who: colour, arg: word), HIT (who hits the other for arg health), BLOCK (who punches,
// the other blocks), MISS (who punches the ghost), KO (who wins), TOK (a combo hit, arg: word),
// FILL (who's context meter + arg), POP (who's context overflows: a blast), GHOST (arg 1/0),
// STATIC (who rises from static over arg seconds).
const WORD = 0, HIT = 1, BLOCK = 2, MISS = 3, KO = 4, TOK = 5, FILL = 6, POP = 7, GHOST = 8, STATIC = 9;
const tok = (t: number) => [t, TOK, 0, 9 + Math.round((t - 0.7) / 0.15)];
// Each script: [time, move, who (0 star, 1 opponent), arg] rows.
const SCRIPTS: Record<Gag, number[]> = {
  ko: [0.2, WORD, 4, 0, 0.8, HIT, 0, 0.2, 1.4, HIT, 1, 0.15, 1.9, HIT, 0, 0.25, 2.4, HIT, 1, 0.2, 2.9, HIT, 0, 0.3, 2.9, WORD, 2, 8, 3.5, HIT, 0, 0.25, 3.5, KO, 0, 0],
  combo: [0.2, WORD, 4, 0, ...[0.7, 0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.75].flatMap(tok), 2.3, HIT, 0, 0.44, 2.3, WORD, 3, 17, 2.7, KO, 0, 0],
  overflow: [0.2, WORD, 4, 0, ...[0.7, 1.2, 1.7, 2.2, 2.6].flatMap((t) => [t, HIT, 1, 0.08, t, FILL, 0, 0.25]), 3, POP, 0, 0, 3, KO, 1, 0],
  hallucinate: [0.2, WORD, 4, 0, 0.5, GHOST, 0, 1, 0.9, MISS, 0, 3, 1.4, MISS, 0, 4, 1.9, MISS, 0, 3, 2.3, GHOST, 0, 0, 2.6, HIT, 1, 0.5, 3.1, HIT, 1, 0.5, 3.1, KO, 1, 0],
  overfit: [0.2, WORD, 4, 0, 0.7, BLOCK, 1, 0, 1.2, BLOCK, 1, 0, 1.7, BLOCK, 1, 0, 2.3, HIT, 1, 1, 2.3, WORD, 3, 6, 2.7, KO, 1, 0],
  diffuse: [0, STATIC, 0, 1.6, 1.7, WORD, 0, 7, 2.2, HIT, 0, 0.5, 2.7, HIT, 0, 0.5, 2.7, KO, 0, 0],
};
const DARK = "#07060f", PANEL = "#1b1636";
// The arena per stage aspect (wide, square, tall: ../aspect): its grid (w, h), how far each fighter
// stands from the middle, a health bar's width, how far down the opponent's name sits. The grid is
// scaled to fit, so a square or portrait phone stage gets a narrower arena and much bigger fighters.
const ARENA = [160, 90, 32, 64, 0, 100, 100, 26, 36, 0, 84, 112, 22, 30, 7];

export function fight(stage: HTMLElement, p: Fight, _first: SlotTap | null = null): FightScene {
  const engine = createEngine({ root: stage, fps: 30, settle: 0.5 });
  const [ca, cb, cs, ck, cw] = p.colors as [string, string, string, string, string];
  const fx = effects({ cap: 160, colors: p.colors, words: WORDS, scorch: 0, gravity: 160 });
  const { ids, emit } = emitter(fx, { s: SPARK });
  const head = (f: Fighter, flip: boolean) => {
    const rows = BODY.map((b) => [...HEADS[f].slice(1).map((r) => "...." + r + "...."), ...b]);
    return flip ? rows.map((fr) => fr.map((r) => [...r].reverse().join(""))) : rows;
  };
  const colors = { a: "body", b: PANEL, e: "glow", w: cw, k: DARK, l: cs };
  const spr = sprites(
    { A: { frames: head(p.a, false), colors, ax: 9, ay: 14 }, B: { frames: head(p.b, true), colors, ax: 9, ay: 14 } },
    { palettes: [{ body: ca, glow: cs }, { body: cb, glow: cs }, { "*": cw }] },
  );
  const names = [HEADS[p.a][0]!, HEADS[p.b][0]!], wins = names.map((n) => n + " WINS");
  const script = SCRIPTS[p.gag], beats = script.length / 4;
  const end = script[script.length - 4]! + 1.2;
  const canvas = engine.ledger.add(document.createElement("canvas"));
  canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated";
  stage.append(canvas);
  const ctx = canvas.getContext("2d")!;
  // Frame state: width, height, dpr, resized, time, next beat, ghost, winner (+1), loop timer;
  // the arena: aspect class, grid w, h, floor, stand-off, bar width, name drop, middle, word line, marked.
  const s = new Float64Array([0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 160, 90, 78, 32, 64, 0, 80, 58, -1]);
  let banner = "";
  // Per fighter (0 star, 1 opponent): lunge, pose, pose timer, flash, health, shown health, fall,
  // context meter, shown meter, static left, static total, knockback.
  const F = [new Float64Array(12), new Float64Array(12)];
  const reset = () => {
    s[4] = s[5] = s[6] = s[7] = s[8] = 0;
    for (const f of F) f.fill(0), (f[4] = f[5] = 1);
    fx.clear();
  };
  reset();
  const ro = new ResizeObserver(() => ((s[3] = 1), engine.wake()));
  ro.observe(stage);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });
  const play = () => (reset(), engine.wake());
  stage.addEventListener("pointerdown", play, { signal: engine.signal });

  const baseX = (i: number) => s[16]! + (i ? s[13]! : -s[13]!);
  const punch = (i: number, pose = 1) => {
    const f = F[i]!;
    f[0] = 1;
    f[1] = pose;
    f[2] = 0.2;
  };
  const struck = (i: number, dmg: number, sparks: number) => {
    const f = F[1 - i]!;
    f[3] = 0.12;
    f[1] = 3;
    f[2] = 0.25;
    f[11] = 1;
    f[4] = Math.max(0, f[4]! - dmg);
    emit(ids.s, s[16]! + (i ? -10 : 10), s[12]! - 18, sparks, 2, 1, 0.35);
    fx.kick(2);
  };
  function beat(t: number, op: number, who: number, arg: number) {
    const other = 1 - who, cx = s[16]!, FLOOR = s[12]!, M = s[17]!;
    if (op === WORD) fx.word(cx, M, arg, who, arg === 17 || arg === 6 ? 13 : 10);
    else if (op === HIT || op === TOK) {
      punch(who);
      struck(who, op === TOK ? 0.07 : arg, op === TOK ? 6 : 14);
      if (op === TOK) fx.word(cx + (who ? -10 : 10), FLOOR - 26, arg, 3, 7);
    } else if (op === BLOCK) {
      punch(who);
      const f = F[other]!;
      f[1] = 2;
      f[2] = 0.3;
      emit(ids.s, cx + (who ? -10 : 10), FLOOR - 20, 6, 4, 1, 0.3);
      fx.word(baseX(other), FLOOR - 34, 2, 4, 8);
    } else if (op === MISS) punch(who), fx.word(cx + 2, FLOOR - 34, arg, 2, 9);
    else if (op === KO) {
      F[other]![4] = 0;
      fx.word(cx, M - 6, 1, 3, 16);
      fx.kick(5);
      s[7] = who + 1;
    } else if (op === FILL) F[who]![7] = F[who]![7]! + arg;
    else if (op === POP) fx.blast(baseX(who), FLOOR - 24, 0.6, 3), fx.word(cx, M - 12, 5, 3, 11);
    else if (op === GHOST) s[6] = arg;
    else if (op === STATIC) (F[who]![9] = F[who]![10] = arg);
    void t;
  }

  function paint() {
    const w = s[0]!, h = s[1]!, d = s[2]!, VW = s[10]!, VH = s[11]!, FLOOR = s[12]!, cx = s[16]!;
    if (s[9] !== s[18]) mark(engine.ledger, stage, (s[18] = s[9]!)), (canvas.width = 0);
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      // The arena is its aspect's grid, centred and scaled to fit: one transform per resize.
      const k = Math.min(canvas.width / VW, canvas.height / VH);
      ctx.setTransform(k, 0, 0, k, (canvas.width - VW * k) / 2, (canvas.height - VH * k) / 2);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = DARK;
    ctx.fillRect(-VW, -VH, VW * 3, VH * 3);
    const sh = fx.shake * 0.25;
    if (sh) ctx.save(), ctx.translate(Math.round(Math.sin(s[4]! * 70) * sh), Math.round(Math.cos(s[4]! * 53) * sh));
    // Floor: a pixel grid line and Tron-ish ticks.
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, FLOOR, VW, 2);
    ctx.fillStyle = cb;
    for (let x = 4; x < VW; x += 12) ctx.fillRect(x, FLOOR + 6, 4, 1);
    ctx.fillStyle = ca;
    for (let x = 10; x < VW; x += 12) ctx.fillRect(x, FLOOR + 9, 4, 1);
    // Health bars and names.
    for (let i = 0; i < 2; i++) {
      const f = F[i]!, bw = s[14]!, x = i ? VW - 8 - bw : 8, c = i ? cb : ca, iw = bw - 2;
      ctx.fillStyle = PANEL;
      ctx.fillRect(x, 6, bw, 6);
      ctx.fillStyle = cw;
      ctx.fillRect(i ? x + 1 + iw * (1 - f[5]!) : x + 1, 7, iw * f[5]!, 4);
      ctx.fillStyle = c;
      ctx.fillRect(i ? x + 1 + iw * (1 - f[4]!) : x + 1, 7, iw * f[4]!, 4);
    }
    ctx.font = "700 5px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = ca;
    ctx.fillText(names[0]!, 8, 18);
    ctx.textAlign = "right";
    ctx.fillStyle = cb;
    ctx.fillText(names[1]!, VW - 8, 18 + s[15]!);
    ctx.textAlign = "center";
    ctx.fillStyle = cw;
    ctx.fillText("VS", cx, 11);
    // The hallucinated ghost: a flickering copy of the opponent, too close to be real.
    if (s[6]) {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(s[4]! * 31);
      spr.draw(ctx, 1, 0, cx - 4, FLOOR, 0, 2 * p.scale, 1);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 2; i++) {
      const f = F[i]!, dir = i ? -1 : 1;
      const x = baseX(i) + dir * (f[0]! * 12 - f[11]! * 5);
      if (f[9]! > 0) {
        // Rising from static: noise pixels thin out as the sprite fades in.
        const k = f[9]! / f[10]!;
        for (let n = 0; n < 70 * k; n++) {
          ctx.fillStyle = n & 1 ? ca : cw;
          ctx.fillRect(x - 18 + ((engine.random() * 36) | 0), FLOOR - 30 + ((engine.random() * 30) | 0), 2, 2);
        }
        ctx.globalAlpha = 1 - k;
      }
      // A KO falls backwards about the feet, lifted so it lands on the floor, not through it.
      spr.draw(ctx, i, f[1]!, x, FLOOR - f[6]! * 14 * p.scale, -dir * f[6]! * 1.5708, 2 * p.scale, f[3]! > 0 ? 2 : i);
      ctx.globalAlpha = 1;
      if (f[8]! > 0 && !f[6]) {
        // The context meter: fills with every punch, blinks when it overflows.
        const full = f[8]! >= 1;
        ctx.fillStyle = PANEL;
        ctx.fillRect(x - 13, FLOOR - 40, 26, 4);
        ctx.fillStyle = full && (s[4]! * 8) & 1 ? cw : full ? ck : cs;
        ctx.fillRect(x - 12, FLOOR - 39, 24 * Math.min(1, f[8]!), 2);
        ctx.fillStyle = cw;
        ctx.fillText("CTX", x, FLOOR - 42);
      }
    }
    fx.draw(ctx);
    if (sh) ctx.restore();
    if (s[7] && s[4]! > end - 0.6) {
      ctx.font = banner;
      ctx.fillStyle = s[7] === 1 ? ca : cb;
      ctx.fillText(wins[s[7]! - 1]!, cx, s[17]! - 24);
    }
  }
  engine.add({
    read() {
      if (!s[3]) return;
      s[3] = 0;
      const w = (s[0] = stage.clientWidth), h = (s[1] = stage.clientHeight), k = (s[9] = aspect(w, h)) * 5;
      s[2] = Math.min(2, devicePixelRatio || 1);
      // The arena for this aspect: grid, floor, stand-off, bars, names; words sit midway up.
      const VW = (s[10] = ARENA[k]!), VH = (s[11] = ARENA[k + 1]!);
      s[12] = VH - 12;
      s[13] = ARENA[k + 2]!;
      s[14] = ARENA[k + 3]!;
      s[15] = ARENA[k + 4]!;
      s[16] = VW / 2;
      s[17] = VH - 32 - (VH - 90) / 2;
      // The winner banner at a size that fits the grid (made here, on a resize: never in a frame).
      banner = `900 ${Math.min(8, (VW - 8) / (Math.max(wins[0]!.length, wins[1]!.length) * 0.62)).toFixed(1)}px ui-monospace, monospace`;
    },
    step(e, dt) {
      const t = (s[4] = s[4]! + dt);
      while (s[5]! < beats && script[s[5]! * 4]! <= t) {
        const r = s[5]! * 4;
        s[5] = s[5]! + 1;
        beat(script[r]!, script[r + 1]!, script[r + 2]!, script[r + 3]!);
      }
      for (const f of F) {
        f[0] = Math.max(0, f[0]! - dt * 5);
        f[11] = Math.max(0, f[11]! - dt * 4);
        f[3] = Math.max(0, f[3]! - dt);
        if (f[2]! > 0 && (f[2] = f[2]! - dt) <= 0) f[1] = 0;
        f[5] = Math.max(f[4]!, f[5]! - dt * 0.6);
        f[8] = Math.min(f[7]!, f[8]! + dt * 2);
        f[9] = Math.max(0, f[9]! - dt);
        if (f[4]! <= 0 && s[7]) (f[6] = Math.min(1, f[6]! + dt * 3)), (f[1] = 3), (f[2] = 1);
      }
      fx.step(dt);
      if (p.loop > 0 && t > end && (s[8] = s[8]! + dt) >= p.loop) reset();
      if (t < end || fx.live > 0 || p.loop > 0) e.busy();
    },
    render: () => paint(),
  });
  engine.start();
  return { engine, play, destroy: () => engine.destroy() };
}

/** A slot mount for these params: `slot(fig, () => import("./anim.js").then((m) => m.mount))`. */
export const scene = (p: Fight) => (stage: HTMLElement, _slot: HTMLElement, first: SlotTap | null) => fight(stage, p, first);
