// Perf run, one command (`npm run perf`, which builds the site first): each target under a CPU
// throttle against tests/perf/budgets.json, then the allocation test. Writes a JSON report and
// exits 1 when anything is over budget. CI and the brain's perf auditor both call this.
//   PERF_SECONDS (default 10)   PERF_THROTTLE (default 4)   PERF_OUT (default perf-results.json)
//   BLITZ_DIR=<built Blitz dir> also measures Battlefield Blitz (BLITZ_PATH: page inside it, default play/)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { clicker, fmt, launch, measure, serve } from "./harness.mjs";
import { allocCheck, demoTarget } from "./alloc.mjs";

const seconds = Number(process.env.PERF_SECONDS ?? 10), throttle = Number(process.env.PERF_THROTTLE ?? 4);
const budgets = JSON.parse(readFileSync(new URL("./budgets.json", import.meta.url), "utf8"));
if (!existsSync("site-dist/index.html")) throw new Error("site-dist/ is missing: run `npm run site` first");

// The machine's load at the start and end of the run is part of every result (numbers on a busy
// machine are not numbers on an idle one). On GitHub Actions each line is also an annotation, so a
// weekly run can be read through the API without downloading the artifact.
const load = () => loadavg().map((n) => n.toFixed(2)).join(" ");
const note = (line) => process.env.GITHUB_ACTIONS && console.log(`::notice title=perf::${line}`);
const loadStart = load();
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
    const r = await measure(browser, t, { seconds, throttle });
    results.push(r);
    console.log(fmt(r));
    note(fmt(r));
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
const machine = `${cpus()[0]?.model ?? "unknown CPU"} × ${cpus().length}, Chromium ${browser.version()}, ${throttle}× CPU throttle, ${seconds} s, load ${loadStart} → ${load()}`;
console.log(`machine  ${machine}`);
note(`machine  ${machine}`);
if (alloc) note(`alloc    idle ${alloc.idle.minorGC} minor GC / ${alloc.idle.frames} frames · scripted ${alloc.scripted.minorGC} / ${alloc.scripted.frames}`);
const out = process.env.PERF_OUT ?? "perf-results.json";
writeFileSync(out, JSON.stringify({ machine, throttle, seconds, budgets, results, alloc, over, pass: over.length === 0 }, null, 2) + "\n");
console.log(`report   ${out}`);
if (over.length) {
  console.error("Over budget:\n  " + over.join("\n  "));
  for (const o of over) process.env.GITHUB_ACTIONS && console.log(`::error title=perf over budget::${o}`);
  process.exit(1);
}
