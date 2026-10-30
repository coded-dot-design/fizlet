// Perf harness (Playwright + Chromium over CDP). Measure only: it loads a built page, throttles the
// CPU, drives a scripted run and records what the page did. It never changes the page under test.
//   - frame times: one rAF loop writing into a preallocated Float64Array (no allocation per frame)
//   - dropped frames: each frame interval counts round(dt / 16.67 ms) - 1 missed vsyncs
//   - time to first frame: first-contentful-paint from the page's own paint timing
//   - JS heap: CDP Performance.getMetrics JSHeapUsedSize at the end of the run (no forced GC)
//   - minor GCs: V8 scavenges in a CDP trace taken over the measured window only
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };

/** Serve a directory at `base` (Pages shaped: dir → index.html). Returns { origin, close }. */
export async function serve(root, base = "/") {
  root = resolve(root);
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let file = null;
    if (url.pathname.startsWith(base)) {
      const p = normalize(decodeURIComponent(url.pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, "");
      let f = join(root, p);
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
      if (f.startsWith(root) && existsSync(f) && statSync(f).isFile()) file = f;
    }
    if (!file) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const RECORDER = { path: new URL("./recorder.js", import.meta.url).pathname };

const GC_CATEGORIES = ["devtools.timeline", "v8", "disabled-by-default-v8.gc"];

/** Run one target. target: { name, url, ready(page), drive(page, ms) }. */
export async function measure(browser, target, { seconds = 10, throttle = 4, warmup = 2 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(RECORDER);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

  await page.goto(target.url, { waitUntil: "load" });
  // First contentful paint, or null if the page never paints content within 10 s.
  const fcp = await page.evaluate(() => new Promise((r) => {
    const get = () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    if (get() != null) return r(get());
    new PerformanceObserver(() => get() != null && r(get())).observe({ type: "paint", buffered: true });
    setTimeout(() => r(get() ?? null), 10000);
  }));
  if (target.ready) await target.ready(page);
  if (warmup) await target.drive(page, warmup * 1000);

  // The measured window: trace + frame recorder on, scripted input, then everything off.
  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const traced = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: GC_CATEGORIES }, transferMode: "ReportEvents" });
  await page.evaluate(() => window.__perf.start());
  await target.drive(page, seconds * 1000);
  const stamps = await page.evaluate(() => window.__perf.stop());
  await cdp.send("Tracing.end");
  await traced;
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  await context.close();

  return { name: target.name, throttle, seconds, fcp, ...frameStats(stamps), heapMB: metrics.JSHeapUsedSize / 1048576, ...gcStats(events), errors };
}

export function frameStats(stamps, vsync = 1000 / 60) {
  const dt = [];
  for (let i = 1; i < stamps.length; i++) dt.push(stamps[i] - stamps[i - 1]);
  const sorted = [...dt].sort((a, b) => a - b);
  const q = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : NaN);
  let dropped = 0;
  for (const d of dt) dropped += Math.max(0, Math.round(d / vsync) - 1);
  return { frames: dt.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: sorted.at(-1) ?? NaN, dropped };
}

// Minor GC = scavenge. Chromium names it MinorGC (devtools.timeline) and V8.GC_SCAVENGER (v8.gc);
// count the timeline event when present, else the v8 one, so one scavenge is never counted twice.
export function gcStats(events) {
  const count = (n) => events.filter((e) => e.name === n && (e.ph === "X" || e.ph === "B")).length;
  const timeline = count("MinorGC"), v8 = count("V8.GC_SCAVENGER") + count("V8.GC_MINOR_MARK_SWEEPER");
  const major = count("MajorGC") || count("V8.GC_MARK_COMPACTOR");
  return { minorGC: timeline || v8, majorGC: major };
}

/** Scripted input: a click on `selector` at seeded spots every `every` ms, for `ms`. Deterministic. */
export function clicker(selector, every = 250) {
  return async (page, ms) => {
    const box = await page.locator(selector).boundingBox();
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await page.mouse.click(box.x + box.width * (0.15 + 0.7 * rnd()), box.y + box.height * (0.2 + 0.6 * rnd()));
      await page.waitForTimeout(every);
    }
  };
}

export const fmt = (r) => `${r.name.padEnd(8)} p50 ${r.p50.toFixed(1)} ms · p95 ${r.p95.toFixed(1)} · p99 ${r.p99.toFixed(1)} · dropped ${r.dropped}/${r.frames} · FCP ${r.fcp == null ? "none" : r.fcp.toFixed(0) + " ms"} · heap ${r.heapMB.toFixed(2)} MB · minor GC ${r.minorGC} · major GC ${r.majorGC}`;
