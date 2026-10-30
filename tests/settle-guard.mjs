// Settle guard (Playwright + Chromium): every gallery entry (live and archived) plays its autoplay
// story to the end before its engine settles. Each entry runs alone on its own gallery page
// (site-dist/, the real figure and stage), with its live chunk rebuilt here from the same module
// and one probe in the kernel: after each frame it reports whether the frame counted as busy
// (`busy()` was called, or a `busy(sec)` hold was still running).
//
// The rule: with no input, once a frame isn't busy, nothing may become busy again by itself. A quiet
// stretch followed by a busy frame means something was counting down without keeping the engine
// awake (an intro delay, a pause between beats, an autoplay timer). Settle can end the scene in that
// stretch: on a slow page the quiet time (wall time) runs ahead of the countdown (the engine's own
// steps, at most `maxSteps` a frame), so any such stretch can be cut short, not only one ≥ settle.
// The fix is `e.busy(sec)` when the thing is scheduled. Once it settles, the guard wakes every engine
// and lets it settle again: whatever was still pending would show up then.
//
// Scope: the gallery's entries are every autoplaying scene on the site (the labs, the fizz and layers
// stories and the home demo among them); the brick demos only move on input.
//
// Why a run and not a static scan: a countdown in a step looks like any other decrement (`t -= dt`,
// `S[WAIT] = S[WAIT]! - dt`), and whether it gates a later busy() is only clear from the run.
// Run with: npm run site && node tests/settle-guard.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

const ROOT = "site-dist", ORIGIN = "http://fizlet.test";
if (!existsSync(`${ROOT}/gallery/index.json`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const { entries, isLive, archive, themes, contributors } = await import("../scripts/gallery.mjs");
const themeList = themes(), people = contributors();
const all = entries({ themeIds: themeList.map((t) => t.id), people });
const live = all.filter(isLive), archived = archive({ themeList, people, live: all }).entries;
const index = JSON.parse(readFileSync(`${ROOT}/gallery/index.json`, "utf8"));
const pageOf = (id) => {
  const row = index.find((r) => r.id === id);
  return row ? row.url.split("#")[0] : "gallery/archive/";
};
const only = process.argv[2]; // one id, to look at a single entry

// The probe: one call per frame, just before the settle check (the kernel's own numbers, nothing
// else changes), and one per wake(). A wake comes from outside the story (input, the figure coming
// on screen): it starts a new stretch, like a tap would. The build fails if either line moves in the
// kernel, so the guard can't go blind.
const PROBE_AT = "      if (settle) {\n        if (moved)", WAKE_AT = "    wake() {\n";
const probe = {
  name: "settle-probe",
  setup(b) {
    b.onLoad({ filter: /src[\\/]kernel[\\/]engine\.ts$/ }, ({ path }) => {
      const src = readFileSync(path, "utf8");
      if (!src.includes(PROBE_AT) || !src.includes(WAKE_AT)) throw new Error("settle-guard: the kernel's settle check or wake() moved; update PROBE_AT, WAKE_AT");
      return {
        loader: "ts",
        contents: src
          .replace(PROBE_AT, "      if (settle) globalThis.__fzFrame?.(engine, moved || n[STEPS]! < n[HOLD]!, settle);\n" + PROBE_AT)
          .replace(WAKE_AT, WAKE_AT + "      globalThis.__fzWake?.(engine);\n"),
      };
    });
  },
};
const chunk = async (e) => (await build({
  stdin: { contents: `export { ${e.export} as mount } from ${JSON.stringify("./" + e.module)};`, resolveDir: "site/gallery", loader: "ts" },
  bundle: true, format: "esm", target: "es2022", write: false, logLevel: "warning", plugins: [probe],
})).outputFiles[0].text;
const STUB = "export const mount = () => ({ destroy() {} });";
const ids = new Set([...live, ...archived].map((e) => e.id));

const TYPES = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webp: "image/webp", woff2: "font/woff2", txt: "text/plain", xml: "application/xml" };
const browser = await chromium.launch(launchOptions());
const failures = [];
const seen = [];
// One entry, alone on its page, in its own context. Entries run a few at a time: the rule is in the
// engine's own steps, so a busier machine changes how long a run takes, not what it finds.
async function check(e) {
  const own = await chunk(e);
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (x) => errs.push(x.message));
  await p.route(`${ORIGIN}/**`, (r) => {
    let path = decodeURIComponent(new URL(r.request().url()).pathname.slice(1));
    const m = path.match(/^gallery\/([a-z0-9-]+)\.js$/);
    // This entry's chunk with the probe; every other entry's demo stays a poster.
    if (m && ids.has(m[1])) return r.fulfill({ body: m[1] === e.id ? own : STUB, contentType: TYPES.js });
    if (path === "" || path.endsWith("/")) path += "index.html";
    const file = `${ROOT}/${path}`;
    if (!existsSync(file)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ body: readFileSync(file), contentType: TYPES[path.split(".").pop()] ?? "application/octet-stream" });
  });
  await p.addInitScript(() => {
    // Same run every time: scenes that roll from Math.random get the same rolls.
    let s = 0x2f6b1d3;
    Math.random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    // Per engine: its steps at the end of the last busy frame and of the last quiet one, and every
    // quiet stretch (steps run in frames that weren't busy) that ended in a busy frame by itself
    // (no input reaches the page in this run).
    window.__fz = [];
    window.__fzFrame = (engine, busy, settle) => {
      let r = window.__fz.find((x) => x.engine === engine);
      if (!r) window.__fz.push((r = { engine, settle, busyAt: 0, quietAt: -1, gaps: [], frames: 0 }));
      r.frames++;
      if (!busy) r.quietAt = engine.steps;
      else {
        if (r.quietAt > r.busyAt) r.gaps.push([r.busyAt, r.quietAt, r.woken ? 1 : 0]);
        (r.busyAt = engine.steps), (r.quietAt = -1);
      }
    };
    window.__fzWake = (engine) => {
      const r = window.__fz.find((x) => x.engine === engine);
      if (r) (r.busyAt = engine.steps), (r.quietAt = -1);
    };
  });
  await p.goto(`${ORIGIN}/${pageOf(e.id)}`);
  const fig = p.locator(`figure[data-gallery="${e.id}"]`);
  await fig.scrollIntoViewIfNeeded();
  // State, not time: the engine has framed, then every engine has settled (or a long story cap
  // in frames has run out, which fails below).
  const run = (cap) => p.evaluate(async (cap) => {
    const frames = () => window.__fz.reduce((k, r) => k + r.frames, 0);
    const start = frames();
    for (;;) {
      const up = window.__fz.length && frames() > start;
      if (up && window.__fz.every((r) => !r.engine.running)) return { done: true };
      if (frames() - start > cap) return { done: false };
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, cap);
  await p.waitForFunction(() => window.__fz.length > 0, null, { timeout: 15000 });
  const first = await run(60 * 60);
  // Wake it with nothing pending: it must stay quiet and settle again.
  await p.evaluate(() => window.__fz.forEach((r) => ((r.woken = true), r.engine.wake())));
  const again = await run(60 * 10);
  const out = await p.evaluate(() => window.__fz.map((r) => ({ settle: r.settle, gaps: r.gaps, paused: r.engine.paused })));
  await ctx.close();
  seen.push(e.id);
  const where = `${e.id} (${e.module})`;
  if (!first.done) failures.push(`${where}: did not settle within 3,600 frames`);
  if (!again.done) failures.push(`${where}: woken with nothing pending, it did not settle again`);
  for (const r of out) for (const [a, b, woken] of r.gaps)
    failures.push(`${where}: quiet for ${b - a} steps (after step ${a}), then busy by itself${woken ? " after it had settled and was woken" : ""} (settle ${r.settle} s): a scheduled thing without busy(sec)`);
  if (errs.length) failures.push(`${where}: page errors: ${errs.join("; ")}`);
}
try {
  const queue = [...live, ...archived].filter((e) => !only || e.id === only);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) await check(queue.shift());
  }));
  assert.ok(seen.length > 0, "the guard ran at least one entry");
  assert.deepEqual(failures, [], `settle guard:\n  ${failures.join("\n  ")}`);
  console.log(`settle guard: ${seen.length} gallery entries play their story through before they settle, and stay settled once woken — ok`);
} finally {
  await browser.close();
}
