// Measure the fizz demo on the built page (run `npm run site` first): script time per frame at 4×
// CPU throttle, frames once settled, offscreen and with reduced motion, layout shift, and whether the
// scene loads before the slot is near. Writes site/demos/fizz/measured.json, which the build reads:
// the caption publishes only these numbers. `node site/demos/fizz/measure.mjs`
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { serve } from "./serve.mjs";

const s = await serve();
const URL = s.origin + s.base + "demos/fizz/";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
// Every requestAnimationFrame callback, timed: Fizlet's one shared tick is the scene's whole frame.
const TIMING = () => {
  const raf = window.requestAnimationFrame.bind(window), log = (window.__raf = []);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const a = performance.now();
    try { cb(t); } finally { log.push([a, performance.now() - a]); }
  });
  let cls = 0;
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (cls += e.hadRecentInput ? 0 : e.value))).observe({ type: "layout-shift", buffered: true });
  window.__cls = () => cls;
};
const frames = (p, from, to) => p.evaluate(([a, b]) => window.__raf.filter(([t]) => t >= a && t < b), [from, to]);
const now = (p) => p.evaluate(() => performance.now());
const scene = (req) => req.some((u) => u.endsWith("/scene.js"));

async function open(opts, url = URL) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  const req = [];
  p.on("request", (r) => req.push(r.url()));
  await p.addInitScript(TIMING);
  return { ctx, p, req, go: () => p.goto(url, { waitUntil: "load" }) };
}

const out = { date: new Date().toISOString().slice(0, 10), browser: browser.version().split(".")[0] };

// 1. The story at 4× CPU throttle, desktop: script per frame while it plays, then frames once settled.
{
  const { ctx, p, go } = await open({ viewport: { width: 1440, height: 900 } });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await go();
  const t0 = await now(p);
  await p.waitForTimeout(9000); // the story (crunch, pop, fizz) and its last particles
  const t1 = await now(p);
  await p.waitForTimeout(3000);
  const t2 = await now(p);
  const run = (await frames(p, t0, t1)).map(([, ms]) => ms).sort((a, b) => a - b);
  const r1 = (n) => Math.round(n * 10) / 10;
  out.throttle4x = { frames: run.length, avgMs: r1(run.reduce((a, b) => a + b, 0) / run.length), p95Ms: r1(run[Math.floor(run.length * 0.95)]), maxMs: r1(run[run.length - 1]) };
  out.settled = { framesPerSecond: r1((await frames(p, t1, t2)).length / ((t2 - t1) / 1000)) };
  out.cls = { page: Math.round(await p.evaluate(() => window.__cls()) * 1e4) / 1e4 };
  await ctx.close();
}
// 2. Offscreen while it plays: frames stop.
{
  const { ctx, p, go } = await open({ viewport: { width: 1440, height: 900 } });
  await go();
  await p.waitForTimeout(1600);
  await p.evaluate(() => document.querySelector("[data-fizz-pop]").click());
  await p.evaluate(() => { document.body.style.paddingBottom = "3000px"; scrollTo(0, 2600); });
  await p.waitForTimeout(400);
  const a = await now(p);
  await p.waitForTimeout(1500);
  out.offscreen = { frames: (await frames(p, a, await now(p))).length };
  await ctx.close();
}
// 3. Reduced motion: the scene never loads, no frames.
{
  const { ctx, p, req, go } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await go();
  await p.waitForTimeout(7000);
  // The same page with the poster only (LAYERS.md measures page cost against it).
  out.cls.posterOnly = Math.round(await p.evaluate(() => window.__cls()) * 1e4) / 1e4;
  out.cls.fromSlot = Math.max(0, Math.round((out.cls.page - out.cls.posterOnly) * 1e4) / 1e4);
  out.reducedMotion = { sceneLoaded: scene(req), frames: (await frames(p, 0, await now(p))).length };
  await ctx.close();
}
// 4. Lazy: a phone with the slot below the fold loads only the loader, then the scene once near.
{
  const { ctx, p, req, go } = await open({ viewport: { width: 390, height: 240 } });
  await go();
  await p.waitForTimeout(2000);
  const before = scene(req);
  await p.evaluate(() => document.querySelector("figure.ae-slot").scrollIntoView());
  await p.waitForTimeout(2000);
  out.lazy = { sceneBeforeNear: before, sceneWhenNear: scene(req) };
  await ctx.close();
}
out.bytes = JSON.parse(readFileSync("site-dist/demos/fizz/sizes.json", "utf8"));
await browser.close();
s.close();
writeFileSync("site/demos/fizz/measured.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
