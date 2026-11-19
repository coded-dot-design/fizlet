// The two movie-homage pieces (site/gallery/pieces/), each on its own stage (site/gallery/stages/
// <id>.html) in a slot, mounted through fizlet/slot as the gallery does, in Chromium:
// - Grid duel: the demo round rides itself and settles with the page as it was; a tap starts a
//   round, a tap above VEGA turns her up, she crashes into a real page element (only it is nudged
//   and lit) and the rival takes the round; it settles with the page back in place.
// - Jack in: the intro fires a packet; taps crack ICE and breach a node (only its own text glitches,
//   then reads exactly as before); the trace trips the alarm, the daemon hunts a still cursor and
//   flatlines it (every node re-ICEs); it settles with the page exactly as it was.
// Both: Recall mid-play gives the page back byte for byte, and reduced motion keeps the poster (the
// scene never mounts). Math.random is seeded (each piece seeds its engine from it at mount), so
// every run is the same run; the waits count frames, not wall time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const bundle = (await build({
  stdin: {
    contents: 'export { slot } from "./src/slot.ts"; export { mount as grid } from "./site/gallery/pieces/light-cycles-duel-on-the-grid.ts"; export { mount as jack } from "./site/gallery/pieces/netrunner-jacks-into-the-page.ts";',
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "nh", write: false, logLevel: "silent",
})).outputFiles[0].text;

const page = (id) => `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${id}" role="img" aria-label="${id}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${id}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const browser = await chromium.launch(launchOptions());

// Waits on the scene, not the clock: resolves once `cond` holds, fails after `frames` frames without
// it (or if the scene stops drawing for 15 s before it holds).
const until = (p, cond, arg, frames, what) => p.evaluate(async ({ cond, arg, frames, what }) => {
  const ok = new Function("arg", `return (${cond})(arg)`);
  const start = scene.engine.stats().frames;
  let last = start, lastAt = performance.now();
  for (;;) {
    if (ok(arg)) return;
    const f = scene.engine.stats().frames;
    if (f - start > frames) throw new Error(`${what}: not after ${frames} frames`);
    if (f !== last) (last = f), (lastAt = performance.now());
    else if (performance.now() - lastAt > 15000) throw new Error(`${what}: the scene stopped first`);
    await new Promise((r) => requestAnimationFrame(r));
  }
}, { cond: cond.toString(), arg, frames, what });

async function open(id, make) {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.setContent(page(id));
  await p.evaluate((make) => {
    let s = 0x2f6b1d3;
    Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    // Every page element the scene writes to, counted (it may write only what it hits).
    window.touched = new Set();
    new MutationObserver((list) => list.forEach((m) => {
      const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      if (!el.closest("[data-fizlet-slot]")) touched.add(el);
    })).observe(document.querySelector("figure"), { subtree: true, attributes: true, characterData: true });
    window.h = nh.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = nh[make](stage, el, first)), { idle: 0 });
  }, make);
  await p.waitForFunction(() => window.scene);
  const m = await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] canvas"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display }));
  assert.deepEqual(m, { canvas: true, poster: "none" }, `${id}: mounts its canvas on the stage; the poster steps aside`);
  return { p, errs, box: await p.locator("figure").boundingBox() };
}

// Settled: no frames, and the page's own elements are as they were (style text compared as the
// browser reads it; Recall below checks the bytes). `hud`: a readout the piece keeps up to date.
const settledInPlace = async (p, id, frames, hud = "") => {
  await until(p, () => scene.engine.paused.includes("settled"), null, frames, `${id}: settles`);
  const still = await p.evaluate(async (hud) => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 25));
    const fig = document.querySelector("figure").cloneNode(true);
    fig.querySelector("[data-fizlet-slot]").remove();
    fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
    const norm = (root) => {
      if (hud) root.querySelector(hud).remove();
      for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
      return root.innerHTML;
    };
    const was = document.createElement("figure");
    was.innerHTML = window.figBefore;
    return { more: scene.engine.stats().frames - a, same: norm(fig) === norm(was) };
  }, hud);
  assert.deepEqual(still, { more: 0, same: true }, `${id}: settled, no frames, the page's elements as they were`);
};

async function recallAndStill(p, errs, id, make) {
  const after = await p.evaluate(() => (h.destroy(), { same: document.body.innerHTML === window.before, running: scene.engine.running }));
  assert.deepEqual(after, { same: true, running: false }, `${id}: Recall restores the page byte for byte`);
  assert.deepEqual(errs, [], `${id}: no page errors`);
  await p.close();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(page(id));
  const rm = await q.evaluate(async (make) => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = nh.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, nh[make](stage, el, first)), { idle: 0 });
    const img = document.querySelector(".ae-slot__placeholder");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    for (let i = 0; i < 10; i++) await new Promise((r) => requestAnimationFrame(r));
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth > 100 };
  }, make);
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, `${id}: reduced motion keeps the poster`);
  await ctx.close();
}

try {
  {
    const id = "light-cycles-duel-on-the-grid";
    const { p, errs, box } = await open(id, "grid");
    // The demo round rides itself (autopilot), ends in a crash, and the scene settles.
    await until(p, () => scene.state.phase === 2 && scene.state.auto === 1, null, 300, `${id}: the demo round rides`);
    await until(p, () => scene.state.phase === 3, null, 3000, `${id}: the demo round ends in a crash`);
    assert.equal(await p.evaluate(() => scene.state.you + scene.state.rivals), 0, `${id}: the demo round does not count`);
    await settledInPlace(p, id, 600);

    // A tap: round 1. Ride right along the bottom; a tap above VEGA turns her up, into the page.
    await p.evaluate(() => window.touched.clear());
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await until(p, () => scene.state.phase === 2 && scene.state.round === 1 && scene.state.auto === 0, null, 300, `${id}: a tap starts round 1 under your control`);
    await until(p, () => scene.state.x >= 21, null, 600, `${id}: VEGA rides right`);
    assert.equal(await p.evaluate(() => scene.state.dir), 0, `${id}: no tap, no turn`);
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.04);
    await until(p, () => scene.state.dir === 3, null, 60, `${id}: a tap above turns VEGA up at the next grid line`);
    await until(p, () => scene.state.phase === 3, null, 600, `${id}: she crashes`);
    const crash = await p.evaluate(() => ({
      winner: scene.state.winner, vega: scene.state.alive[0],
      hit: [...touched].map((e) => e.textContent),
      lit: [...document.querySelectorAll(".lc i[data-hit]")].map((e) => e.textContent),
    }));
    assert.equal(crash.winner, 1, `${id}: the rival takes the round`);
    assert.equal(crash.vega, 0, `${id}: VEGA broke into pixels`);
    assert.equal(crash.lit.length, 1, `${id}: the one element she rode into is lit (${crash.lit})`);
    assert.ok(crash.hit.every((t) => t === crash.lit[0] || /^VEGA \d – \d RIVALS$/.test(t)), `${id}: only that element and the score were written (${crash.hit})`);
    await until(p, () => /VEGA 0 – 1 RIVALS/.test(document.querySelector("[data-lc-hud]").textContent), null, 60, `${id}: the score counts it`);
    // The score line changed for good; everything else springs back.
    await p.evaluate(() => (window.figBefore = window.figBefore.replace("VEGA 0 – 0 RIVALS", "VEGA 0 – 1 RIVALS")));
    await settledInPlace(p, id, 900);

    // Recall mid-ride.
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await until(p, () => scene.state.phase === 2, null, 300, `${id}: round 2 rides`);
    await recallAndStill(p, errs, id, "grid");
  }
  {
    const id = "netrunner-jacks-into-the-page";
    const { p, errs, box } = await open(id, "jack");
    // The intro jacks in and fires one packet; it cracks ICE; then it settles, page as it was.
    await until(p, () => scene.state.fired === 1 && scene.state.ice < 16, null, 400, `${id}: the intro packet cracks ICE`);
    await settledInPlace(p, id, 900, ".nr-deck");

    // Fire at the heading until it is breached: only its own text glitches, and reads true after.
    const heading = await p.locator(".nr-h i").boundingBox();
    const at = (b, fx = 0.5, fy = 0.5) => p.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
    await p.evaluate(() => {
      window.touched.clear();
      window.scrambled = 0;
      const t = document.querySelector(".nr-h i").firstChild;
      // Old values too: with the clock driven by hand, a scramble can resolve within one batch of steps.
      new MutationObserver((rs) => rs.some((r) => r.oldValue !== "NIMBUS VAULT") || t.nodeValue !== "NIMBUS VAULT" ? window.scrambled++ : 0).observe(t, { characterData: true, characterDataOldValue: true });
    });
    // The clock is driven by hand, as below (engine stopped, fixed steps per tap; a tap is read on
    // the next step): on a slow runner real time let the tries run out before the heading broke.
    await p.evaluate(() => scene.engine.stop());
    for (let k = 0; k < 16 && !(await p.evaluate(() => window.scrambled)); k++) {
      await at(heading, 0.5 + (k % 3) * 0.1);
      const left = await p.evaluate(() => { for (let i = 0; i < 2; i++) scene.engine.advance(1 / 60); for (let i = 0; i < 900 && scene.state.packets; i++) scene.engine.advance(1 / 60); for (let i = 0; i < 6; i++) scene.engine.advance(1 / 60); return scene.state.packets; });
      assert.equal(left, 0, `${id}: the packets spend their charges`);
    }
    await p.evaluate(() => scene.engine.start());
    const glitch = await p.evaluate(() => ({ scrambled: window.scrambled > 0, breaches: scene.state.breaches, text: document.querySelector(".nr-h i").textContent, nodes: [...touched].every((e) => e.closest("[data-nr-node]") || e.closest(".nr-deck")) }));
    assert.deepEqual(glitch.scrambled, true, `${id}: the breach scrambles the heading's own text`);
    assert.ok(glitch.breaches >= 1, `${id}: a node is breached`);
    assert.ok(glitch.nodes, `${id}: only the nodes and WREN's deck are ever written`);
    await settledInPlace(p, id, 900, ".nr-deck");
    assert.equal(await p.evaluate(() => document.querySelector(".nr-h i").textContent), "NIMBUS VAULT", `${id}: the heading reads true again`);

    // Keep firing at the live nodes until the trace trips the alarm; the daemon comes out. The clock
    // is driven by hand here (engine stopped, a fixed number of steps between real taps), so where
    // the ricochets land is the same every run.
    const targets = await p.evaluate(() => [...document.querySelectorAll("[data-nr-node]:not([data-nr-sentry])")].map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    const adv = (k) => p.evaluate((k) => { for (let i = 0; i < k; i++) scene.engine.advance(1 / 60); return scene.state; }, k);
    await p.evaluate(() => scene.engine.stop());
    let st = await adv(1);
    for (let k = 0; k < 200 && !(st.daemon && !st.packets && st.phase === 1); k++) {
      if (st.daemon) st = await adv(20); // let the last packets land (one could still root the page)
      else if (st.phase !== 1) (st = await adv(60)), await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9), (st = await adv(2));
      else await p.mouse.click(...targets[k % targets.length]), (st = await adv(40));
    }
    assert.deepEqual([st.daemon, st.phase], [1, 1], `${id}: the trace trips the alarm, black ICE is out`);
    // A still cursor: the daemon closes in and flatlines you; every node re-ICEs.
    const spot = [box.x + box.width * 0.15, box.y + box.height * 0.45];
    await p.mouse.move(...spot);
    const f0 = st.flatlines, d0 = Math.hypot(st.dx - box.width * 0.15, st.dy - box.height * 0.45);
    for (let k = 0; k < 60 && st.phase === 1 && st.daemon; k++) st = await adv(10);
    assert.ok(d0 > 40, `${id}: the daemon starts away from the cursor (${d0})`);
    assert.deepEqual([st.phase, st.flatlines - f0, st.ice, st.trace, st.daemon], [2, 1, 16, 0, 0], `${id}: caught: flatlined, every node re-ICEd, the trace reset`);
    await p.evaluate(() => scene.engine.start());
    await settledInPlace(p, id, 900, ".nr-deck");
    // A tap jacks in again.
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
    await until(p, () => scene.state.phase === 1, null, 60, `${id}: a tap jacks in again`);

    // Recall mid-glitch.
    await at(heading);
    await until(p, () => scene.state.packets === 0, null, 900, `${id}: the packet is spent`);
    await recallAndStill(p, errs, id, "jack");
  }
  console.log("neon homages: grid duel (demo, tap to ride and turn, a crash on a real element, only it nudged, settles in place) and jack in (packets crack ICE, a breach glitches only its node, the alarm's daemon flatlines a still cursor, every node re-ICEs), Recall exact, reduced motion still — ok");
} finally {
  await browser.close();
}
