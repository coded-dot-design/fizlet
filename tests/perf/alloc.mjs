// Game-level allocation test: N frames of a scripted run must cause at most a bounded number of
// minor GCs (V8 scavenges). A per-frame allocation in a game's loop shows up as dozens of
// scavenges over a few hundred frames; a clean loop shows a handful at most, from the browser's own
// input events and the harness reading the frame count once a second.
//
// Template: copy this file into a game's repo, point TARGET at the game's built page, give it a
// scripted run (seeded clicks or keys), measure an idle and a scripted run, then set MAX_MINOR_GC
// from what you measured. `npm run perf` runs it too (and puts it in the JSON report); on its own:
// `npm run test:alloc` after `npm run site`. Options: ALLOC_FRAMES (default 600).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { clicker, gcStats, launch, serve } from "./harness.mjs";

const FRAMES = Number(process.env.ALLOC_FRAMES ?? 600);
// Measured on the demo (4-core Xeon 2.8 GHz, no throttle): idle 0, scripted (a click every 250 ms)
// 3 per ~600 frames. The scripted run includes the browser's own input events. Minor GCs only see
// sustained allocation (V8 grows its young generation: an injected 4 KB/frame showed 2 scavenges,
// 16 KB/frame showed 6, per 600 frames), so the sampled per-function bytes are printed as well.
export const MAX_MINOR_GC = 8;

/** The demo as an allocation target. A game swaps in its own page and scripted run. */
export const demoTarget = (origin) => ({
  url: `${origin}/fizlet/`,
  ready: (page) => page.locator("[data-demo]").scrollIntoViewIfNeeded(),
  drive: clicker("[data-demo] [data-board]", 250),
});

/** Idle and scripted runs of FRAMES frames each; `over` lists what broke the bound. */
export async function allocCheck(browser, target) {
  const idle = await run(browser, target, false);
  const scripted = await run(browser, target, true);
  const over = [];
  if (scripted.errors.length) over.push(`alloc: page errors: ${scripted.errors.join("; ")}`);
  if (idle.minorGC > MAX_MINOR_GC) over.push(`alloc: idle run ${idle.minorGC} minor GCs > ${MAX_MINOR_GC}`);
  if (scripted.minorGC > MAX_MINOR_GC) over.push(`alloc: scripted run ${scripted.minorGC} minor GCs > ${MAX_MINOR_GC}`);
  console.log(`alloc    idle: ${idle.minorGC} minor GC / ${idle.frames} frames · scripted: ${scripted.minorGC} minor GC / ${scripted.frames} frames (max ${MAX_MINOR_GC})`);
  console.log(`         top allocators (sampled): ${scripted.top.join(" · ")}`);
  return { maxMinorGC: MAX_MINOR_GC, idle, scripted, over };
}

/** Run `drive` in slices until FRAMES frames have passed; count scavenges over exactly that window. */
async function run(browser, TARGET, scripted) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript({ path: new URL("./recorder.js", import.meta.url).pathname });
  const cdp = await context.newCDPSession(page);
  await page.goto(TARGET.url, { waitUntil: "load" });
  await TARGET.ready(page);
  await TARGET.drive(page, 1000); // warm up: pools filled, code compiled
  await page.waitForTimeout(500);

  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const traced = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "v8", "disabled-by-default-v8.gc"] }, transferMode: "ReportEvents" });
  if (scripted) {
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.startSampling", { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  }
  await page.evaluate(() => window.__perf.start());
  while ((await page.evaluate(() => window.__perf.count())) < FRAMES) {
    if (scripted) await TARGET.drive(page, 1000);
    else await page.waitForTimeout(1000);
  }
  const frames = await page.evaluate(() => window.__perf.count());
  const profile = scripted ? (await cdp.send("HeapProfiler.stopSampling")).profile : null;
  await cdp.send("Tracing.end");
  await traced;
  await context.close();
  return { frames, ...gcStats(events), errors, top: profile ? allocators(profile.head, frames) : [] };
}

// Diagnostic: bytes allocated per frame by function (sampled), so a failure points at the culprit.
function allocators(head, frames) {
  const by = new Map();
  const walk = (n) => {
    const key = `${n.callFrame.functionName || "(anonymous)"} ${n.callFrame.url.split("/").pop() || "(native)"}`;
    by.set(key, (by.get(key) ?? 0) + n.selfSize);
    n.children.forEach(walk);
  };
  walk(head);
  return [...by].filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, b]) => `${k} ${(b / frames / 1024).toFixed(2)} KB/frame`);
}

// Standalone: `node tests/perf/alloc.mjs`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync("site-dist/index.html")) throw new Error("site-dist/ is missing: run `npm run site` first");
  const site = await serve("site-dist", "/fizlet/");
  const browser = await launch();
  try {
    const { over } = await allocCheck(browser, demoTarget(site.origin));
    assert.deepEqual(over, [], over.join("\n"));
  } finally {
    await browser.close();
    await site.close();
  }
}
