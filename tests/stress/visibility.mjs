// P5 (S6 pressure test): tab hide/show storm, resize storm, scroll in and out, Recall mid-step and
// mid-timeline, re-mount, in Chromium. One page carries five Fizlet scenes on one shared clock: a bare
// kernel engine, a looping timeline, a css clock, a gallery piece (Pip's Bubbles through fzlt/slot)
// and an arcade game. Seeded: every interval, viewport and scroll comes from --seed (printed), so a
// failure reruns exactly.
//
// Pass: no stuck scene (a timeline or engine nobody paused that stops moving once the page is visible
// and on screen again: the fizlet#170 bug class), the page byte for byte after every Recall (mid-step,
// mid-timeline, after re-mount; two engines with overlapping writes are recalled first-in first-out),
// every scene settles to 0 frames at the end, no console or page error.
//
//   node tests/stress/visibility.mjs [--seed n] [--cycles 200] [--json] [--self-test] [--lifo]
//   (--lifo: Recall the two overlapping engines last-in first-out, to show the order is what matters)
//
// Hidden/visible is emulated in the page (document.visibilityState overridden, visibilitychange
// dispatched): headless Chromium keeps a lone tab visible. The engine reads exactly that property and
// event, so its auto-pause path is the real one; only rAF keeps ticking while "hidden" (it would stop
// in a real hidden tab), which the engine ignores because it asks for no frames while held.
// --self-test adds two broken fixtures (an engine whose pause hook stalls it for good, a write that
// skips the ledger) and passes only if the check catches both.
import { build, transform } from "esbuild";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { launchOptions } from "../chromium.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? dflt : process.argv[i + 1];
};
const flag = (name) => process.argv.includes("--" + name);
const SEED = Number(arg("seed", 0)) || ((Date.now() % 1e9) | 0);
const CYCLES = Number(arg("cycles", flag("self-test") ? 30 : 200));
const SELF = flag("self-test"), JSON_OUT = flag("json"), LIFO = flag("lifo");

// mulberry32: the Node side's only randomness.
let rs = SEED >>> 0;
const rnd = () => {
  rs = (rs + 0x6d2b79f5) >>> 0;
  let t = rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const kit = (await transform(readFileSync("src/ui/board-ui.css", "utf8"), { loader: "css", minify: true })).code;
const SCENES = `
import { createEngine, scheduler } from "./src/kernel/index.ts";
import { timeline } from "./src/timeline.ts";
import { cssClock } from "./src/css-clock.ts";
import { slot } from "./src/slot.ts";
import { bubbles } from "./site/gallery/pieces/pip/bubbles.ts";
import { arcade, KX, VW, VH } from "./src/arcade.ts";
export { scheduler };

const $ = (id) => document.getElementById(id);
export const live = {};

// Hidden/visible, as the engine reads it.
let vis = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => vis });
Object.defineProperty(document, "hidden", { configurable: true, get: () => vis === "hidden" });
export function setHidden(h) {
  vis = h ? "hidden" : "visible";
  document.dispatchEvent(new Event("visibilitychange"));
}

function game() {
  return arcade({
    id: "stress-game", title: "Stress", color: "#06c4ff", css: ${JSON.stringify(kit)},
    create(ctx) {
      const e = ctx.engine, c = ctx.ctl, s = new Float64Array(2);
      e.add({ step(_, dt) { s[0] += dt * 60; s[1] = (s[1] + c[KX] + 1) % (c[VW] || 1); } });
      return { reset() { s.fill(0); }, over: () => 0, draw(g) { g.fillRect(s[1], c[VH] / 2, 6, 6); }, hud() {}, stats: () => ({ ticks: s[0] }) };
    },
  }, { root: "#board", seed: 7, sound: false });
}

export function mount(o = {}) {
  // kernel: one engine, a system that writes its step count through the ledger; o.stopAt destroys it
  // from inside a step (Recall mid-step).
  {
    const e = createEngine({ root: $("k"), seed: 3 }), txt = $("k").firstChild;
    const k = { e, n: 0, stopAt: -1 };
    e.add({ step(x) { k.n++; x.ledger.text(txt, "kernel " + k.n); x.ledger.style($("k"), "--x", String(k.n % 97)); if (k.n === k.stopAt) x.destroy(); } });
    e.start();
    live.kernel = k;
  }
  // timeline: a turret sweeping forever (repeat Infinity, yoyo), nobody pauses it.
  {
    const e = createEngine({ root: $("t"), seed: 4, settle: 0.25 });
    const tl = timeline(e, { repeat: Infinity, yoyo: true }).to($("t"), { transform: ["rotate(-20deg)", "rotate(20deg)"], opacity: [0.5, 1] }, { dur: 0.4, ease: "inOut" });
    e.start();
    tl.play();
    // a one-shot timeline on the same engine, for Recall mid-timeline
    const once = timeline(e).to($("t2"), { transform: ["translateX(0px)", "translateX(200px)"] }, { dur: 30, ease: "linear" });
    once.play();
    live.timeline = { e, tl, once };
  }
  // css clock: CSS @keyframes on the kernel clock; many loops, so it should never settle in the test.
  live.css = cssClock($("c"), { span: 1, loops: 100000 });
  // gallery piece through fzlt/slot, as the gallery mounts it.
  live.pipSlot = slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (live.pip = bubbles(stage, el, first)), { idle: 0 });
  // arcade game over the page's own text.
  live.game = game();
  live.game.start();
  // Overlapping writes: two engines write the same style and text through their own ledgers; Recall
  // takes them down in mount order (first in, first out), not the reverse.
  {
    const el = $("o"), a = createEngine({ seed: 8 }), b = createEngine({ seed: 9 });
    a.add({ step(x) { x.ledger.style(el, "color", "rgb(1, 2, 3)"); x.ledger.text(el.firstChild, "a"); } });
    b.add({ step(x) { x.ledger.style(el, "color", "rgb(4, 5, 6)"); x.ledger.text(el.firstChild, "b"); } });
    a.advance(1 / 60), b.advance(1 / 60);
    live.overlap = { a, b };
  }
  if (o.fixtures) {
    // A stall: a system whose pause hook stops it for good (what #170 did to timelines).
    const e = createEngine({ root: $("x"), seed: 5 }), f = { e, n: 0, dead: false };
    e.add({ step() { if (!f.dead) f.n++; }, pause() { f.dead = true; } });
    e.start();
    live.stall = f;
    // A leak: a write that skips the ledger, so Recall can't give it back.
    $("x").setAttribute("data-leak", "1");
  }
}

// Progress marks for every scene that should be moving right now.
export function marks() {
  const m = {};
  const k = live.kernel; if (k) m.kernel = [k.n, k.e.paused.join()];
  const t = live.timeline; if (t) m.timeline = [t.tl.time, t.tl.playing, t.e.paused.join()];
  const c = live.css; if (c) m.css = [c.tl.time, c.tl.playing, c.engine.paused.join()];
  const g = live.game; if (g) { const s = g.getSnapshot(); m.game = [s.elapsed, s.status]; }
  const f = live.stall; if (f) m.stall = [f.n, f.e.paused.join()];
  return m;
}
export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

// Visible and on screen: each scene that nobody paused must move within 'frames' frames.
export async function stuck(frames = 40) {
  // Let the IntersectionObservers report "back on screen" first (up to 60 frames).
  const engines = () => [live.kernel?.e, live.timeline?.e, live.css?.engine, live.stall?.e].filter(Boolean);
  for (let i = 0; i < 60 && engines().some((e) => e.paused.includes("offscreen")); i++) await frame();
  await frame();
  const a = marks();
  for (let i = 0; i < frames; i++) await frame();
  const b = marks(), out = [];
  for (const id in a) {
    const moved = b[id][0] !== a[id][0];
    if (!moved) out.push({ scene: id, before: a[id], after: b[id] });
  }
  return out;
}

// End: stop what loops forever, then everything must settle (0 rAF requests over 30 frames).
export async function settle() {
  live.timeline?.tl.pause();
  live.timeline?.once.pause();
  live.css?.hold(true);
  live.game?.pause();
  live.kernel?.e.stop();
  live.stall?.e.stop();
  // Up to 1,800 frames (30 s at 60 Hz) for the gallery piece's intro to play out and settle.
  let f = 0, r0 = scheduler.requests, quiet = 0;
  for (; f < 1800 && quiet < 30; f++) {
    await frame();
    quiet = scheduler.requests === r0 ? quiet + 1 : 0;
    r0 = scheduler.requests;
  }
  return { requests: quiet < 30 ? 30 - quiet : 0, frames: f, pip: live.pip?.engine?.paused.join() ?? null };
}

// Recall everything, mid-step and mid-timeline when asked.
export async function recall(mid, lifo) {
  const out = {};
  if (mid && live.kernel) {
    live.kernel.stopAt = live.kernel.n + 3;
    for (let i = 0; i < 20 && live.kernel.n < live.kernel.stopAt; i++) await frame();
    out.midStep = live.kernel.n === live.kernel.stopAt && live.kernel.e.paused.includes("stopped");
  }
  if (mid && live.timeline) {
    const t = live.timeline.once.time;
    out.midTimeline = t > 0 && t < 30;
  }
  if (live.overlap) {
    // first in, first out (as two independent scenes on a page come and go); lifo: the reverse
    if (lifo) live.overlap.b.destroy(), live.overlap.a.destroy();
    else live.overlap.a.destroy(), live.overlap.b.destroy();
    // Reported on its own (and put back by hand), so it never hides another leak in the page compare.
    const el = $("o"), was = '<div id="o" style="height:20px">overlap</div>';
    out.overlap = el.outerHTML === was ? null : el.outerHTML;
    if (out.overlap) el.outerHTML = was;
  }
  live.kernel?.e.destroy();
  live.timeline?.e.destroy();
  live.css?.destroy();
  live.pipSlot?.destroy();
  live.game?.destroy();
  live.stall?.e.destroy();
  for (const k in live) delete live[k];
  return out;
}
`;
const bundle = (await build({ stdin: { contents: SCENES, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "iife", globalName: "S", write: false, logLevel: "silent" })).outputFiles[0].text;

const PIP = "pip-narwhal-blows-bubbles";
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@keyframes spin{to{transform:rotate(360deg)}} #c i{display:inline-block;animation:spin 1s linear infinite paused;animation-delay:var(--fz-t,0s)}</style></head>
<body style="margin:0;font:16px/1.5 system-ui;background:#101514;color:#e1ebdb;--sans:system-ui;--mono:monospace">
<main id="board" style="max-width:900px;margin:auto;padding:10px">
<div id="k" style="height:30px">kernel</div>
<div id="t" style="width:80px;height:30px;background:#ff2e88;color: red"></div>
<div id="t2" style="width:40px;height:20px;background:#19f0ff"></div>
<div id="c" style="height:30px"><i>a</i><i>b</i><i>c</i></div>
<div id="x" style="height:20px">fixture</div>
<div id="o" style="height:20px">overlap</div>
<figure class="ae-slot" data-slot-target="gallery#${PIP}" role="img" aria-label="${PIP}" style="position:relative;width:640px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${PIP}.html`, "utf8")}</figure>
<p>Words for the arcade board: every letter here is terrain. <a href="#away">a link</a> <button>a button</button></p>
</main><div style="height:4000px"></div><script>${bundle}</script></body></html>`;

const T0 = Date.now();
const browser = await chromium.launch(launchOptions());
const result = { test: "visibility", seed: SEED, cycles: CYCLES, selfTest: SELF, chromium: browser.version(), node: process.version, uptime: execSync("uptime").toString().trim(), failures: [], stats: {} };
const fail = (kind, detail) => result.failures.push({ kind, ...detail });
try {
  const p = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text()));
  await p.setContent(PAGE);
  // The gallery piece seeds itself from Math.random at mount: make that seeded too.
  await p.evaluate((seed) => {
    let s = seed >>> 0;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }, SEED);
  const html = () => p.evaluate(() => document.documentElement.outerHTML);
  const before = await html();
  const home = async () => {
    await p.setViewportSize({ width: 1100, height: 1000 });
    await p.evaluate(() => window.scrollTo(0, 0));
  };
  let hides = 0, resizes = 0, scrolls = 0, checks = 0;

  const storm = async (from, to) => {
    for (let c = from; c < to; c++) {
      // hide for a random while, sometimes resize or scroll while hidden
      await p.evaluate(() => S.setHidden(true));
      hides++;
      const r = rnd();
      if (r < 0.25) { await p.setViewportSize({ width: ri(320, 1600), height: ri(300, 1200) }); resizes++; }
      else if (r < 0.45) { await p.evaluate((y) => window.scrollTo(0, y), ri(0, 4000)); scrolls++; }
      await p.waitForTimeout(ri(0, 40));
      await p.evaluate(() => S.setHidden(false));
      // a burst of resizes or scrolls while visible
      const burst = ri(0, 3);
      for (let i = 0; i < burst; i++) {
        if (rnd() < 0.5) { await p.setViewportSize({ width: ri(320, 1600), height: ri(300, 1200) }); resizes++; }
        else { await p.evaluate((y) => window.scrollTo(0, y), ri(0, 4000)); scrolls++; }
        await p.waitForTimeout(ri(0, 16));
      }
      await p.waitForTimeout(ri(0, 60));
      // every 10th cycle (and the last): back home, visible and on screen; nothing may be stuck
      if (c % 10 === 9 || c === to - 1) {
        await home();
        const s = await p.evaluate(() => S.stuck(40));
        checks++;
        for (const x of s) fail("stuck", { cycle: c, ...x });
      }
    }
  };

  // Phase A: mount, storm, Recall mid-step and mid-timeline.
  await p.evaluate((fx) => S.mount({ fixtures: fx }), SELF);
  await p.waitForFunction(() => S.live.pip, null, { timeout: 15000 });
  // First, a plain hide and show with nothing scrolled or resized (so no IntersectionObserver gets a
  // chance to wake anything): every scene must play on.
  await home();
  for (let i = 0; i < 40; i++) await p.evaluate(() => S.frame());
  await p.evaluate(async () => { S.setHidden(true); for (let i = 0; i < 5; i++) await S.frame(); S.setHidden(false); });
  for (const x of await p.evaluate(() => S.stuck(40))) fail("stuck", { cycle: "plain hide/show", ...x });
  const half = Math.floor(CYCLES / 2);
  await storm(0, half);
  await home();
  const midA = await p.evaluate((lifo) => S.recall(true, lifo), LIFO);
  if (midA.overlap) fail("overlap", { phase: "A", what: "two engines wrote the same element; Recall first-in first-out left the first engine's write", left: midA.overlap });
  if (!midA.midStep) fail("recall", { phase: "A", what: "destroy from inside a step did not land mid-step", midA });
  if (!midA.midTimeline) fail("recall", { phase: "A", what: "not mid-timeline", midA });
  for (let i = 0; i < 3; i++) await p.evaluate(() => S.frame());
  if ((await html()) !== before) fail("recall", { phase: "A", what: "page not byte for byte after Recall mid-step/mid-timeline", diff: await diff(before, await html()) });

  // Phase B: re-mount after destroy, storm again, settle, Recall.
  await p.evaluate((fx) => S.mount({ fixtures: fx }), SELF);
  await p.waitForFunction(() => S.live.pip, null, { timeout: 15000 });
  await storm(half, CYCLES);
  await home();
  const st = await p.evaluate(() => S.settle());
  if (st.requests) fail("settle", { what: "frames still requested after everything stopped", ...st });
  const endB = await p.evaluate((lifo) => S.recall(false, lifo), LIFO);
  if (endB.overlap) fail("overlap", { phase: "B", what: "two engines wrote the same element; Recall first-in first-out left the first engine's write", left: endB.overlap });
  for (let i = 0; i < 3; i++) await p.evaluate(() => S.frame());
  if ((await html()) !== before) fail("recall", { phase: "B", what: "page not byte for byte after re-mount + Recall", diff: await diff(before, await html()) });
  for (const e of errs) fail("error", { message: e });
  result.stats = { hides, resizes, scrolls, checks, settle: st, seconds: +((Date.now() - T0) / 1000).toFixed(1) };
  await p.close();

  async function diff(a, b) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return { at: i, before: a.slice(Math.max(0, i - 60), i + 80), after: b.slice(Math.max(0, i - 60), i + 80) };
  }
} finally {
  await browser.close();
}

// Group the failures for the summary (a stuck scene shows up at every check after it sticks).
const byKind = {};
for (const f of result.failures) {
  const key = f.kind + (f.scene ? ":" + f.scene : "");
  (byKind[key] ??= { count: 0, first: f }).count++;
}
result.summary = byKind;
let ok;
if (SELF) {
  // The check must catch both deliberate faults: the stalled engine and the ledger leak.
  const caughtStall = result.failures.some((f) => f.kind === "stuck" && f.scene === "stall");
  const caughtLeak = result.failures.some((f) => f.kind === "recall" && JSON.stringify(f.diff ?? "").includes("data-leak"));
  result.selfTestCaught = { stall: caughtStall, leak: caughtLeak };
  ok = caughtStall && caughtLeak;
} else ok = result.failures.length === 0;
result.pass = ok;
if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`visibility: seed ${SEED}, ${CYCLES} cycles, ${result.stats.hides} hides, ${result.stats.resizes} resizes, ${result.stats.scrolls} scrolls, ${result.stats.checks} stuck checks, ${result.stats.seconds}s; Chromium ${result.chromium}; ${result.uptime}`);
  for (const [k, v] of Object.entries(byKind)) console.log(`  FAIL ${k} ×${v.count}: ${JSON.stringify(v.first)}`);
  if (SELF) console.log(`  self-test: stall caught ${result.selfTestCaught.stall}, leak caught ${result.selfTestCaught.leak}`);
  console.log(ok ? "visibility: ok" : `visibility: FAIL (rerun: node tests/stress/visibility.mjs --seed ${SEED}${SELF ? " --self-test" : ""})`);
}
process.exit(ok ? 0 : 1);
