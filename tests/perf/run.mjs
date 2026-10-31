// Perf run, one command (`npm run perf`, which builds the site first): each target under a CPU
// throttle against tests/perf/budgets.json, then the allocation test. Writes a JSON report and
// exits 1 when anything is over budget. CI and the brain's perf auditor both call this.
//   PERF_SECONDS (default 10)   PERF_THROTTLE (default 4)   PERF_OUT (default perf-results.json)
//   BLITZ_DIR=<built Blitz dir> also measures Battlefield Blitz (BLITZ_PATH: page inside it, default play/)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { clicker, fmt, launch, measure, serve } from "./harness.mjs";
import { allocCheck, demoTarget } from "./alloc.mjs";

// Flags (`npm run perf -- --throttle 6 --runs 5`) override the env; with --runs N each target runs N
// times and its budget is checked on the median of each number (one run: as before).
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const seconds = Number(arg("seconds") ?? process.env.PERF_SECONDS ?? 10), throttle = Number(arg("throttle") ?? process.env.PERF_THROTTLE ?? 4);
const runs = Math.max(1, Number(arg("runs") ?? 1));
const mid = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const budgets = JSON.parse(readFileSync(new URL("./budgets.json", import.meta.url), "utf8"));
if (!existsSync("site-dist/index.html")) throw new Error("site-dist/ is missing: run `npm run site` first");

const servers = [], targets = [];
const site = await serve("site-dist", "/fizlet/");
servers.push(site);
targets.push({
  name: "demo",
  url: `${site.origin}/fizlet/`,
  // The demo pauses off screen: bring it into view, then blast it with seeded clicks.
  ready: (page) => page.locator("[data-demo]").scrollIntoViewIfNeeded(),
  drive: clicker("[data-demo] [data-board]"),
});
if (process.env.BLITZ_DIR) {
  const blitz = await serve(process.env.BLITZ_DIR, "/");
  servers.push(blitz);
  targets.push({ name: "blitz", url: `${blitz.origin}/${process.env.BLITZ_PATH ?? "play/"}`, drive: clicker("body", 200) });
} else {
  console.log("blitz    skipped: set BLITZ_DIR to a built Battlefield Blitz to measure it");
}

const browser = await launch();
const results = [], over = [];
let alloc = null;
try {
  for (const t of targets) {
    const all = [];
    for (let i = 0; i < runs; i++) {
      all.push(await measure(browser, t, { seconds, throttle }));
      console.log(fmt(all.at(-1)));
    }
    const r = runs === 1 ? all[0] : { ...all[0], ...Object.fromEntries(["fcp", "frames", "p50", "p95", "p99", "max", "dropped", "layerizeMs", "heapMB", "minorGC", "majorGC"].map((k) => [k, mid(all.map((x) => x[k]))])), errors: all.flatMap((x) => x.errors), runs: all };
    if (runs > 1) console.log(`${fmt(r)}  (median of ${runs})`);
    results.push(r);
    if (r.errors.length) over.push(`${r.name}: page errors: ${r.errors.join("; ")}`);
    const b = budgets[t.name] ?? {};
    for (const [key, max] of Object.entries(b)) {
      if (key.startsWith("_")) continue;
      const value = key === "droppedPct" ? (100 * r.dropped) / Math.max(1, r.frames + r.dropped) : r[key];
      if (!(value <= max)) over.push(`${r.name}: ${key} ${Number(value).toFixed(2)} > budget ${max}`);
    }
  }
  alloc = await allocCheck(browser, demoTarget(site.origin));
  over.push(...alloc.over);
} finally {
  await browser.close();
  for (const s of servers) await s.close();
}
const machine = `${cpus()[0]?.model ?? "unknown CPU"} × ${cpus().length}, Chromium ${browser.version()}, ${throttle}× CPU throttle, ${seconds} s${runs > 1 ? `, median of ${runs} runs` : ""}, load ${loadavg().map((l) => l.toFixed(2)).join(" ")}`;
console.log(`machine  ${machine}`);
const out = process.env.PERF_OUT ?? "perf-results.json";
writeFileSync(out, JSON.stringify({ machine, throttle, seconds, runs, budgets, results, alloc, over, pass: over.length === 0 }, null, 2) + "\n");
console.log(`report   ${out}`);
if (over.length) {
  console.error("Over budget:\n  " + over.join("\n  "));
  process.exit(1);
}
