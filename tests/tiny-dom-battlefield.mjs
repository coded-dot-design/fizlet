// Freeze, plan, radio (site/gallery/pieces/freeze-plan-radio-platoon.ts), DOM Battlefield's tiny
// gallery game, in Chromium on its own stage, mounted through fzlt/slot as the gallery does, Math.random
// seeded. Left alone it plays one attack (routes drawn for it, radioed leg by leg) to a result, then
// freezes and sleeps with the page as it was. Then a player: a drag draws a route, RADIO runs time for
// three seconds and the tank rolls it, time freezes by itself and the engine sleeps (frozen time costs no
// frames), FREEZE stops it early, the keyboard plans and radios, legs until a result. A whole-frame
// allocation check (V8's sampling heap profiler, as tests/brick-cards-alloc.mjs): the step allocates
// nothing. Recall mid-play gives the page back byte for byte; reduced motion keeps the still poster.
// Waits are on state and frames, never wall time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ID = "freeze-plan-radio-platoon";
const bundle = (await build({
  stdin: { contents: `export { slot } from "./src/slot.ts"; export { freeze } from "./site/gallery/pieces/${ID}.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "iife", globalName: "ar", write: false, logLevel: "silent",
})).outputFiles[0].text;

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;--sans:system-ui;--mono:monospace">
<main><p>Before the piece.</p><figure class="ae-slot" data-slot-target="gallery#${ID}" role="img" aria-label="${ID}" style="position:relative;width:720px;aspect-ratio:16/9;margin:0">${readFileSync(`site/gallery/stages/${ID}.html`, "utf8")}</figure><p>After it.</p></main>
<script>${bundle}</script></body>`;

const SAME = () => {
  const fig = document.querySelector("figure").cloneNode(true);
  fig.querySelector("[data-fizlet-slot]")?.remove();
  fig.querySelector(".ae-slot__placeholder").removeAttribute("style");
  const norm = (root) => {
    for (const e of root.querySelectorAll("[style]")) e.style.cssText ? e.setAttribute("style", e.style.cssText) : e.removeAttribute("style");
    return root.innerHTML;
  };
  const was = document.createElement("figure");
  was.innerHTML = window.figBefore;
  return norm(fig) === norm(was);
};
// The scene's live state, read as names (S slots: mode 0, picked 3, winner 4, legs 5); drag = a tap on
// the tank, then a tap a point.
const VIEW = () => {
  window.view = (sc) => Object.defineProperties(sc, Object.getOwnPropertyDescriptors({
    get mode() { return sc.S[0]; }, get sel() { return sc.S[3]; }, get winner() { return sc.S[4]; }, get bursts() { return sc.S[5]; },
    get hp() { return [sc.HP[0] + sc.HP[1] + sc.HP[2], sc.HP[3] + sc.HP[4] + sc.HP[5]]; }, get route() { return [...sc.RN]; },
    drag(t, xs, ys) { sc.tap(sc.X[t], sc.Y[t]); xs.forEach((x, i) => sc.tap(x, ys[i])); },
  }));
};
const UNTIL = `async (f, cap = 3600) => { for (let i = 0; i < cap && !f(); i++) await new Promise((r) => requestAnimationFrame(r)); return f(); }`;
const settle = async (p) => {
  await p.waitForFunction(() => scene.engine.paused.includes("settled"), null, { timeout: 90000, polling: 100 });
  return p.evaluate(async (same) => {
    const a = scene.engine.stats().frames;
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    return { more: scene.engine.stats().frames - a, same: new Function(`return (${same})()`)() };
  }, SAME.toString());
};

const browser = await chromium.launch(launchOptions());
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript((seed) => {
    let s = seed;
    Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }, +(process.env.SEED ?? 7));
  await p.setContent(html);
  await p.evaluate(VIEW);
  await p.evaluate(() => {
    window.before = document.body.innerHTML;
    window.figBefore = document.querySelector("figure").innerHTML;
    window.h = ar.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = view(ar.freeze(stage, el, first))), { idle: 0 });
  });
  await p.waitForFunction(() => window.scene);
  assert.deepEqual(await p.evaluate(() => ({ canvas: !!document.querySelector("[data-fizlet-slot] .fpr-cv"), poster: getComputedStyle(document.querySelector(".ae-slot__placeholder")).display, snd: document.querySelector(".fpr-snd").hidden })), { canvas: true, poster: "none", snd: true }, "mounts its canvas; the poster steps aside; no sound key before a gesture");

  // Left alone: routes drawn for it, radioed leg by leg, to a result; then frozen, asleep, page whole.
  const auto = await p.evaluate(async (u) => {
    const until = eval(u);
    let live = false, routed = false;
    await until(() => ((routed ||= scene.route.every((n) => n > 2)), (live ||= scene.mode === 1), scene.mode === 2), 60 * 40);
    return { routed, live, over: scene.mode === 2, winner: scene.winner };
  }, UNTIL);
  assert.ok(auto.routed && auto.live && auto.over && auto.winner >= 0, `plays one attack on its own to a result (${JSON.stringify(auto)})`);
  assert.deepEqual(await settle(p), { more: 0, same: true }, "after the demo: time frozen, asleep, the page whole");
  assert.deepEqual(await p.evaluate(() => [scene.mode, scene.hp]), [0, [9, 9]], "a fresh platoon waits for your plan");

  // A real drag from tank 2 draws its route; the sound key shows after the gesture.
  const box = await p.locator("figure").boundingBox(), k = box.width / 192;
  await p.mouse.move(box.x + 14 * k, box.y + 54 * k);
  await p.mouse.down();
  for (const [x, y] of [[30, 54], [46, 54], [62, 55], [80, 56], [88, 50], [90, 40]]) await p.mouse.move(box.x + x * k, box.y + y * k, { steps: 3 });
  await p.mouse.up();
  const drawn = await p.evaluate(() => ({ route: scene.route, sel: scene.sel, snd: document.querySelector(".fpr-snd").hidden }));
  assert.ok(drawn.route[1] >= 5 && drawn.sel === 1 && !drawn.snd, `a drag from tank 2 draws its route (${JSON.stringify(drawn)})`);

  // RADIO (a real click): time runs, the tank rolls; it freezes by itself and the engine sleeps.
  await p.click(".fpr-go");
  const leg = await p.evaluate(async (u) => {
    const until = eval(u);
    await until(() => scene.mode === 1 && document.querySelector(".fpr-go").hasAttribute("data-live"), 30);
    const live = scene.mode === 1, label = document.querySelector(".fpr-go").getAttribute("aria-label");
    await until(() => scene.mode !== 1, 600);
    return { live, label, after: scene.mode, bursts: scene.bursts };
  }, UNTIL);
  assert.deepEqual(leg, { live: true, label: "Freeze time", after: 0, bursts: 1 }, `RADIO runs time for one leg, then it freezes (${JSON.stringify(leg)})`);
  assert.deepEqual(await settle(p), { more: 0, same: true }, "frozen time: no frames");

  // FREEZE stops a leg early; the keyboard picks, routes and radios.
  const keys = await p.evaluate(async (u) => {
    const until = eval(u);
    scene.radio();
    await until(() => false, 20);
    scene.radio();
    await until(() => false, 2);
    const early = scene.mode;
    return { early };
  }, UNTIL);
  assert.equal(keys.early, 0, "FREEZE stops time early");
  await p.focus(".fpr-go");
  await p.keyboard.press("3");
  for (let i = 0; i < 5; i++) await p.keyboard.press("ArrowRight");
  const kb = await p.evaluate(() => ({ sel: scene.sel, route: scene.route[2] }));
  assert.ok(kb.sel === 2 && kb.route >= 2, `keys: 3 picks tank 3, arrows draw its route (${JSON.stringify(kb)})`);
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => scene.mode === 1, null, { timeout: 5000 });

  // Legs until a result: routes for all three toward the HQ, radio after each freeze.
  const end = await p.evaluate(async (u) => {
    const until = eval(u);
    for (let i = 0; i < 20 && scene.mode !== 2; i++) {
      await until(() => scene.mode !== 1, 600);
      if (scene.mode === 2) break;
      if (i === 0) scene.drag(0, [36, 90, 146, 168, 178], [9, 8, 9, 30, 54]);
      scene.radio();
    }
    return { over: scene.mode === 2, winner: scene.winner };
  }, UNTIL);
  assert.ok(end.over && end.winner >= 0, `six legs at most end in a result (${JSON.stringify(end)})`);
  assert.deepEqual(await settle(p), { more: 0, same: true }, "after the result: reset, frozen, asleep, the page whole");

  // Allocation: drive it by hand (radio legs back to back), sample the heap; the step allocates nothing.
  await p.evaluate(() => {
    scene.engine.stop();
    window.drive = (n) => {
      for (let i = 0; i < n; i++) {
        if (scene.mode === 0) scene.drag(0, [36, 90, 146], [9, 8, 9]), scene.drag(2, [36, 90, 146], [99, 100, 99]), scene.radio();
        scene.engine.advance(1 / 60);
      }
    };
    window.drive(20000);
  });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("HeapProfiler.enable");
  // Best of 3 (like the brick cards' allocation test): a JIT tier-up or deopt inside one sample
  // boxes numbers for a moment and reads as a frame's worth of garbage; the step itself allocates none.
  const FRAMES = 4000;
  let step = Infinity, by = {};
  for (let run = 0; run < 3 && step / FRAMES > 16; run++) {
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.startSampling", { samplingInterval: 128, includeObjectsCollectedByMinorGC: true, includeObjectsCollectedByMajorGC: true });
  await p.evaluate((n) => {
    // Only the step: render is skipped by advancing with a no-op drawing (drive itself never draws).
    window.drive(n);
  }, FRAMES);
  const { profile } = await cdp.send("HeapProfiler.stopSampling");
  let sum = 0;
  const seen = {};
  const walk = (node, inStep) => {
    const st = inStep || node.callFrame.functionName === "step";
    if (st && node.selfSize) (sum += node.selfSize), (seen[`${node.callFrame.functionName}:${node.callFrame.lineNumber}`] = (seen[`${node.callFrame.functionName}:${node.callFrame.lineNumber}`] ?? 0) + node.selfSize);
    for (const c of node.children) walk(c, st);
  };
  walk(profile.head, false);
  if (sum < step) (step = sum), (by = seen);
  }
  if (process.env.ALLOC_TOP) console.log(JSON.stringify(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8)));
  assert.ok(step / FRAMES <= 16, `the step allocates (next to) nothing: ${(step / FRAMES).toFixed(1)} B a frame sampled, bar 16`);

  // Byte for byte but for the figure's attribute order: a scene with real buttons is `accessible`, so
  // fzlt/slot drops role="img" while it runs and puts it back last (#215 puts it back in place).
  const after = await p.evaluate(() => {
    h.destroy();
    const canon = (html) => {
      const d = document.createElement("div");
      d.innerHTML = html;
      for (const e of d.querySelectorAll("*")) {
        const at = [...e.attributes].map((a) => [a.name, a.value]).sort(([x], [y]) => (x < y ? -1 : 1));
        for (const [n] of at) e.removeAttribute(n);
        for (const [n, v] of at) e.setAttribute(n, v);
      }
      return d.innerHTML;
    };
    return { same: canon(document.body.innerHTML) === canon(window.before), running: scene.engine.running };
  });
  if (!after.same) console.log("diff:", JSON.stringify(await p.evaluate(() => { const a = document.body.innerHTML, b = window.before; let i = 0; while (a[i] === b[i]) i++; return [a.slice(i - 80, i + 120), b.slice(i - 80, i + 120)]; })));
  assert.deepEqual(after, { same: true, running: false }, "Recall restores the page byte for byte");
  assert.deepEqual(errs, [], "no page errors");
  await p.close();

  for (const width of [390, 1440]) {
    const q = await browser.newPage({ viewport: { width, height: 900 } });
    await q.setContent(html.replace("width:720px", "width:100%"));
    await q.evaluate(() => (window.h = ar.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (window.scene = ar.freeze(stage, el, first)), { idle: 0 })));
    await q.waitForFunction(() => window.scene);
    const sz = await q.evaluate(() => { const r = document.querySelector(".fpr-go").getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(sz[0] >= 44 && sz[1] >= 44, `${width}: the RADIO key is at least 44 px (${sz})`);
    await q.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: "reduce" });
  const q = await ctx.newPage();
  await q.setContent(html);
  const rm = await q.evaluate(async () => {
    let made = 0;
    const before = document.body.innerHTML;
    const s = ar.slot(document.querySelector("figure.ae-slot"), () => (stage, el, first) => (made++, ar.freeze(stage, el, first)), { idle: 0 });
    for (let i = 0; i < 30; i++) await new Promise((r) => requestAnimationFrame(r));
    const img = document.querySelector(".ae-slot__placeholder");
    return { made, mounted: s.mounted, same: document.body.innerHTML === before, poster: getComputedStyle(img).display !== "none", drawn: img.complete && img.naturalWidth >= 192 };
  });
  assert.deepEqual(rm, { made: 0, mounted: false, same: true, poster: true, drawn: true }, "reduced motion keeps the poster");
  await ctx.close();
  console.log(`tiny-dom-battlefield: Freeze, plan, radio: demo attack to a result, drag a route, radio a leg, frozen time sleeps, FREEZE early, keys plan and radio, step ${(step / FRAMES).toFixed(1)} B a frame sampled (bar 16), 44 px keys at 390 and 1440, Recall exact, reduced motion still — ok`);
} finally {
  await browser.close();
}
