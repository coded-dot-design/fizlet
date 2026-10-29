// Measure the layers story and write site/demos/layers/measured.json (the only numbers its caption
// prints): gzip bytes, script time per frame under 4× CPU throttle, layout shift, frames once
// settled, and JS fetched before the slot nears the viewport. Budgets: fizlet-engine docs/LAYERS.md.
// Run: node site/demos/layers/measure.mjs (builds first).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const OUT = "site-dist/demos/layers";
execFileSync(process.execPath, ["site/demos/layers/build.mjs", OUT], { stdio: "inherit" });
const sizes = JSON.parse(readFileSync(`${OUT}/sizes.json`, "utf8"));
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const srv = await serve(OUT);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// Every rAF callback's script time, every frame's start, layout shifts.
const PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__f = [];
  window.__cls = 0;
  window.requestAnimationFrame = (cb) => raf((t) => {
    const a = performance.now();
    cb(t);
    window.__f.push([t, performance.now() - a]);
  });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
};
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
const r2 = (v) => Math.round(v * 100) / 100;

// 1. One full cycle at 1440 × 900, CPU throttled 4×.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(PROBE);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto(srv.url);
await page.waitForSelector("[data-fizlet-slot] .lz", { timeout: 15000 });
await page.evaluate(() => (window.__f.length = 0));
await page.waitForTimeout(13000);
const frames = await page.evaluate(() => window.__f);
const ms = frames.map((f) => f[1]), gaps = frames.slice(1).map((f, i) => f[0] - frames[i][0]);
const cls = await page.evaluate(() => window.__cls);
await ctx.close();

// 2. Settles: one quick cycle (data-loops=1), then count frames over 2 s.
const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p2.addInitScript(PROBE);
await p2.route(srv.url, async (route) => {
  const res = await route.fetch();
  route.fulfill({ response: res, body: (await res.text()).replace('<figure class="ae-slot lyr"', '<figure data-loops="1" data-speed="4" class="ae-slot lyr"') });
});
await p2.goto(srv.url);
await p2.waitForSelector("[data-fizlet-slot] .lz", { timeout: 15000 });
await p2.waitForTimeout(13000 / 4 + 2000);
const n0 = await p2.evaluate(() => window.__f.length);
await p2.waitForTimeout(2000);
const settled = (await p2.evaluate(() => window.__f.length)) - n0;
await p2.close();

// 3. Lazy: the slot far below the fold; which scripts load in 3 s.
const p3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const js = [];
p3.on("response", async (r) => { if (r.url().endsWith(".js")) js.push([r.url().split("/").pop(), (await r.body()).length]); });
await p3.route(srv.url, async (route) => {
  const res = await route.fetch();
  route.fulfill({ response: res, body: (await res.text()).replace("<main>", '<main><div style="height:5000px"></div>') });
});
await p3.goto(srv.url);
await p3.waitForTimeout(3000);
const before = js.filter(([f]) => f.startsWith("scene")).length, eagerJs = js.length;
await p3.close();

const measured = {
  version,
  chromium: browser.version(),
  bytes: sizes,
  frame: { throttle: 4, fps: 30, frames: ms.length, p50: r2(pct(ms, 0.5)), p95: r2(pct(ms, 0.95)), max: r2(Math.max(...ms)), gapP95: r2(pct(gaps, 0.95)) },
  cls: r2(cls),
  settledFrames: settled,
  sceneBeforeNear: before,
  eagerFiles: eagerJs,
};
await browser.close();
srv.close();
writeFileSync("site/demos/layers/measured.json", JSON.stringify(measured, null, 2) + "\n");
console.log(JSON.stringify(measured, null, 2));
const BUDGET = { poster: 6144, live: 10240 };
console.log(`poster ${sizes.poster} B gz (hero budget ${BUDGET.poster}): ${sizes.poster <= BUDGET.poster ? "ok" : "OVER"}`);
console.log(`live chunk ${sizes.live} B gz (hero budget ${BUDGET.live}): ${sizes.live <= BUDGET.live ? "ok" : "OVER"}`);
console.log(`CLS ${measured.cls} (budget 0) · frames once settled ${settled} (budget 0) · scene chunks before the slot is near ${before} (budget 0)`);
// Rebuild so the page's caption carries these numbers.
execFileSync(process.execPath, ["site/demos/layers/build.mjs", OUT], { stdio: "inherit" });
