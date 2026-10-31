// Throttled frame budget (S6 P3): the perf harness (tests/perf/harness.mjs) run N times per target
// at each CPU throttle, with a main-thread breakdown of the window (script, style+layout, paint,
// layerize+commit, gc: self ms per frame from a Chromium trace). Medians across runs are checked
// against tests/stress/frame-budgets.json (the proposed budgets; the CI gate is tests/perf/budgets.json).
//
//   npm run site && npm run test:stress -- frame [--throttle 4,6] [--runs 5] [--seconds 10]
//     [--targets demo,gallery:<id>,...] [--out frame.json] [--self-test]
//
// Targets: `demo` is the home demo blasted by a seeded click every 250 ms (as `npm run perf`);
// `fizz` is the fizz story page's hero (demos/fizz/), tapped the same way;
// `gallery:<id>` is a gallery entry on its real gallery page, scrolled into view, live, and tapped by
// the same seeded clicker. The clicker's seed is fixed (7), so a run repeats exactly.
// --self-test: the demo again with a 30 ms busy loop in every frame (a stall fixture): the check must
// fail on it, or the gate is blind. Exit 1 when anything is over budget (or the self-test passes).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { clicker, launch, measure, serve } from "../perf/harness.mjs";
import { breakdown, flags, list, machine, median, range } from "./lib.mjs";

const f = flags();
const throttles = list(f.throttle, "4,6").map(Number), runs = Number(f.runs ?? 5), seconds = Number(f.seconds ?? 10);
const DEFAULT = "demo,fizz,gallery:storm-god-hammer-fights-giant,gallery:pip-narwhal-blows-bubbles,gallery:diamond-hands-sparkle-never-let";
const names = list(f.targets, DEFAULT);
const SITE = f.site ?? "site-dist"; // --site <dir>: another build (an older tag's site-dist, to bisect)
if (!existsSync(`${SITE}/index.html`)) throw new Error(`${SITE}/ is missing: run \`npm run site\` first`);
const budgets = JSON.parse(readFileSync(new URL("./frame-budgets.json", import.meta.url), "utf8"));
const index = JSON.parse(existsSync(`${SITE}/gallery/index.json`) ? readFileSync(`${SITE}/gallery/index.json`, "utf8") : "[]");

const site = await serve(SITE, "/fizlet/");
const STALL = "(() => { const burn = () => { const t = performance.now(); while (performance.now() - t < 30); requestAnimationFrame(burn); }; requestAnimationFrame(burn); })();";
function target(name) {
  if (name === "demo" || name === "stall")
    return {
      name,
      url: `${site.origin}/fizlet/`,
      ready: async (page) => {
        if (name === "stall") await page.evaluate(STALL);
        await page.locator("[data-demo]").scrollIntoViewIfNeeded();
      },
      drive: clicker("[data-demo] [data-board]"),
    };
  if (name === "fizz") {
    // The fizz story page (demos/fizz/): its hero slot, loaded by a first tap, then tapped.
    const sel = 'figure[data-slot-target="fizz#hero"]';
    return {
      name,
      url: `${site.origin}/fizlet/demos/fizz/`,
      ready: async (page) => {
        await page.locator(sel).scrollIntoViewIfNeeded();
        await page.locator(sel).click();
        await page.waitForSelector(`${sel} [data-fizlet-slot]`, { timeout: 15000 });
      },
      drive: clicker(sel),
    };
  }
  const id = name.replace(/^gallery:/, ""), row = index.find((r) => r.id === id);
  if (!row) throw new Error(`no gallery entry ${id} in site-dist/gallery/index.json`);
  const sel = `figure[data-gallery="${id}"]`;
  return {
    name,
    url: `${site.origin}/fizlet/${row.url.split("#")[0]}`,
    ready: async (page) => {
      await page.locator(sel).scrollIntoViewIfNeeded();
      await page.locator(sel).click(); // the first tap loads it at once (no idle wait)
      await page.waitForSelector(`${sel}[data-live="1"]`, { timeout: 15000 });
    },
    drive: clicker(sel),
  };
}

const browser = await launch();
const results = [], over = [];
const r2 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(2));
async function sample(name, throttle) {
  const rows = [];
  for (let i = 0; i < runs; i++) {
    let split = null;
    const r = await measure(browser, target(name), { seconds, throttle, onTrace: (ev) => (split = ev) });
    const b = breakdown(split, r.frames);
    const droppedPct = (100 * r.dropped) / Math.max(1, r.frames + r.dropped);
    rows.push({ ...r, droppedPct, breakdown: b });
    console.log(`  ${name} ${throttle}× run ${i + 1}: p50 ${r.p50.toFixed(1)} · p95 ${r.p95.toFixed(1)} · p99 ${r.p99.toFixed(1)} · dropped ${droppedPct.toFixed(1)}% · heap ${r.heapMB.toFixed(2)} MB · GC ${r.minorGC}/${r.majorGC} · busy ${b.busyMsPerFrame} ms/frame ${JSON.stringify(b.msPerFrame)}${r.errors.length ? " · ERR " + r.errors.join("; ") : ""}`);
  }
  const m = (k) => r2(median(rows.map((r) => r[k])));
  const groups = [...new Set(rows.flatMap((r) => Object.keys(r.breakdown.msPerFrame)))];
  const summary = {
    target: name, throttle, runs, seconds,
    p50: m("p50"), p95: m("p95"), p99: m("p99"), droppedPct: m("droppedPct"), layerizeMs: m("layerizeMs"), heapMB: m("heapMB"), minorGC: m("minorGC"), majorGC: m("majorGC"), fcp: m("fcp"),
    ranges: Object.fromEntries(["p50", "p95", "p99", "droppedPct"].map((k) => [k, range(rows.map((r) => r[k])).map(r2)])),
    msPerFrame: Object.fromEntries(groups.map((g) => [g, r2(median(rows.map((r) => r.breakdown.msPerFrame[g] ?? 0)))])),
    busyMsPerFrame: r2(median(rows.map((r) => r.breakdown.busyMsPerFrame))),
    top: rows[Math.floor(rows.length / 2)].breakdown.top,
    errors: rows.flatMap((r) => r.errors),
  };
  const key = name === "stall" ? "demo" : name.startsWith("gallery:") ? "gallery" : name;
  const b = budgets[`${key}@${throttle}x`] ?? {};
  summary.over = Object.entries(b).filter(([k]) => !k.startsWith("_")).filter(([k, max]) => !(summary[k] <= max)).map(([k, max]) => `${name} ${throttle}×: ${k} ${summary[k]} > ${max}`);
  if (summary.errors.length) summary.over.push(`${name}: page errors: ${summary.errors.join("; ")}`);
  return summary;
}

let selfTest = null;
try {
  for (const throttle of throttles)
    for (const name of names) {
      const s = await sample(name, throttle);
      results.push(s);
      over.push(...s.over);
      console.log(`${name} ${throttle}× median of ${runs}: p50 ${s.p50} · p95 ${s.p95} · p99 ${s.p99} · dropped ${s.droppedPct}% · layerize ${s.layerizeMs} · heap ${s.heapMB} MB · GC ${s.minorGC}/${s.majorGC} · ${JSON.stringify(s.msPerFrame)}${s.over.length ? "  OVER" : ""}`);
    }
  if (f["self-test"]) {
    const s = await sample("stall", throttles[0]);
    selfTest = { caught: s.over.length > 0, over: s.over, p50: s.p50, droppedPct: s.droppedPct };
    console.log(`self-test (30 ms stall per frame, ${throttles[0]}×): ${selfTest.caught ? "caught" : "NOT CAUGHT"}: ${s.over.join("; ")}`);
  }
} finally {
  await browser.close();
  await site.close();
}
const env = machine(browser);
console.log(`machine  ${env.cpu} · Chromium ${env.chromium} · load ${env.load.join(" ")} · ${env.uptime}`);
const report = { test: "frame", env, throttles, runs, seconds, budgets, results, selfTest, over, pass: over.length === 0 && (!selfTest || selfTest.caught) };
const out = f.out ?? "stress-frame.json";
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`report   ${out}`);
if (over.length) console.error("Over budget:\n  " + over.join("\n  "));
if (selfTest && !selfTest.caught) console.error("self-test: the stall fixture passed the budgets: the check is blind");
process.exit(report.pass ? 0 : 1);
