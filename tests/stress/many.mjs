// Many engines on one page (S6 P4): 1, 8, 32 and 64 gallery pieces on one page, each mounted the
// real way (site-dist/gallery/gallery.js arms fizlet/slot on every figure; each piece's live chunk is
// its own bundle, so `mixed` pages carry one kernel and one shared clock per distinct piece).
//
//   npm run site && npm run test:stress -- many [--counts 1,8,32,64] [--mode same,mixed]
//     [--piece gold-stars-pop-twinkle-tap] [--throttle 4] [--seconds 5] [--settle 8] [--gallery]
//     [--sweep [<id,...>] [--cap 30]] [--bare] [--out many.json] [--self-test]   (--counts 0: skip the fixture pages)
//
// Per page (N figures in a grid that fits the 1280×800 viewport, then a tall spacer):
//   mount     every figure goes live (data-live="1")
//   idle      rAF and setTimeout calls a second once every engine has settled (expected 0)
//   active    every figure tapped (a pointerdown at a seeded spot) every 250 ms: frame p50/p95/p99,
//             dropped %, page rAF calls a second, main-thread busy ms a second (Chromium trace)
//   offscreen every figure tapped once more, the page scrolled past them at once: rAF and timer calls
//             a second while they're off screen (expected 0: the kernel pauses off-screen engines)
//   memory    JS heap after a forced GC, DOM nodes
// --gallery also loads the real gallery pages (/gallery/, page/2/, archive/): scrolls each through so
// every slot mounts, records frames while scrolling, then idle calls at the top and after a GC heap.
// Pass: every figure mounts, idle and off-screen engines make 0 calls, main-thread work per engine
// doesn't grow with N on `same` pages (linear or better), no page errors. Idle waits --settle s
// (default 8): the longest gallery stories run 20-40 s before they settle (see --sweep), so a `mixed`
// page needs --settle 45 or more. --self-test adds a fixture piece whose loop
// never settles and ignores off screen; the run must fail on it. Seeded taps (seed printed).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { launch, serve, frameStats } from "../perf/harness.mjs";
import { breakdown, flags, list, machine } from "./lib.mjs";

const f = flags();
const counts = list(f.counts, "1,8,32,64").map(Number).filter((n) => n > 0), modes = list(f.mode, "same,mixed");
const piece = f.piece ?? "gold-stars-pop-twinkle-tap", throttle = Number(f.throttle ?? 4), seconds = Number(f.seconds ?? 5);
const settleWait = Number(f.settle ?? 8), SEED = Number(f.seed ?? 7);
const SITE = f.site ?? "site-dist"; // --site <dir>: another build (an older tag's site-dist, to bisect)
if (!existsSync(`${SITE}/index.html`)) throw new Error(`${SITE}/ is missing: run \`npm run site\` first`);
// Every gallery chunk (live and archived entries): the gallery/*.js files that export a slot mount.
const ids = readdirSync(`${SITE}/gallery`).filter((f) => f.endsWith(".js") && /\bas mount\b/.test(readFileSync(`${SITE}/gallery/${f}`, "utf8"))).map((f) => f.slice(0, -3)).sort();
if (!ids.includes(piece)) throw new Error(`no gallery entry ${piece}`);

// Each entry's real figure (the markup inside it is what some pieces read: a board, letters, a
// template), from the built gallery pages; an entry on no page gets a bare slot figure, and so does
// every entry with --bare (a chunk reused outside its gallery figure).
const FIGURES = new Map();
for (const file of ["index.html", "page/2/index.html", "page/3/index.html", "archive/index.html"].map((p) => `${SITE}/gallery/${p}`).filter(existsSync)) {
  const html = readFileSync(file, "utf8"), open = /<figure\b[^>]*\bdata-gallery="([^"]+)"/g;
  for (let m; (m = open.exec(html)); ) {
    if (FIGURES.has(m[1])) continue;
    let depth = 0, i = m.index;
    const tag = /<(\/?)figure\b/g;
    tag.lastIndex = i;
    for (let t; (t = tag.exec(html)); ) {
      depth += t[1] ? -1 : 1;
      if (!depth) {
        FIGURES.set(m[1], html.slice(i, html.indexOf(">", t.index) + 1));
        break;
      }
    }
  }
}
const figure = (id, i) =>
  ((!f.bare && FIGURES.get(id)) || `<figure class="ae-slot" data-gallery="${id}" data-slot-target="gallery#${id}" role="img" aria-label="${id}"></figure>`).replace(/data-slot-target="[^"]*"/, `data-slot-target="stress#${i}"`);

// Init script: counts the page's requestAnimationFrame and setTimeout calls (window.__calls), and a
// frame recorder on the native rAF that is off unless started (it never shows up in the counts).
const INIT = `(() => {
  const raf = window.requestAnimationFrame.bind(window), st = window.setTimeout.bind(window);
  const c = { raf: 0, timeout: 0 };
  window.requestAnimationFrame = (cb) => (c.raf++, raf(cb));
  window.setTimeout = (...a) => (c.timeout++, st(...a));
  const t = new Float64Array(1 << 15); let n = 0, on = 0;
  const tick = (now) => { if (!on) return; if (n < t.length) t[n++] = now; raf(tick); };
  Object.defineProperty(window, "__calls", { value: c });
  Object.defineProperty(window, "__rec", { value: { start() { n = 0; if (!on) (on = 1, raf(tick)); }, stop() { on = 0; return Array.from(t.subarray(0, n)); } } });
})();`;
// The self-test fixture: a "piece" whose loop never settles and keeps running off screen.
const NEVER = "export const mount = (stage) => { let on = 1; const loop = () => { if (!on) return; stage.dataset.t = String(performance.now() | 0); requestAnimationFrame(loop); }; requestAnimationFrame(loop); return { destroy() { on = 0; } }; };";

function fixture(n, mode, selfTest, only = null) {
  const cols = Math.ceil(Math.sqrt(n * 1.6)), rows = Math.ceil(n / cols);
  const w = Math.floor((1260 - (cols - 1) * 4) / cols), h = Math.max(40, Math.floor((780 - (rows - 1) * 4) / rows));
  const figs = Array.from({ length: n }, (_, i) => {
    const id = only ?? (selfTest && i === 0 ? "__never" : mode === "same" ? piece : ids[i % ids.length]);
    return figure(id, i);
  }).join("");
  return `<!doctype html><html lang="en" class="bui" data-theme="dark"><head><meta charset="utf-8"><title>many ${n}</title>
<link rel="stylesheet" href="/fizlet/board-ui.css"><link rel="stylesheet" href="/fizlet/site.css"><style>
body{margin:0;padding:10px}.grid{display:grid;grid-template-columns:repeat(${cols},${w}px);grid-auto-rows:${h}px;gap:4px}
.grid>figure{margin:0;position:relative;width:auto;height:auto;aspect-ratio:auto;overflow:hidden}.spacer{height:6000px}</style></head>
<body><div class="grid">${figs}</div><div class="spacer"></div><script type="module" src="/fizlet/gallery/gallery.js"></script></body></html>`;
}

const site = await serve(SITE, "/fizlet/");
const browser = await launch();
const r2 = (x) => (x == null || Number.isNaN(x) ? x : +x.toFixed(2));

async function open(url, routes = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  for (const [path, body] of Object.entries(routes))
    await context.route(`${site.origin}${path}`, (r) => r.fulfill({ status: 200, contentType: path.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8", body }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(INIT);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.goto(url, { waitUntil: "load" });
  return { context, page, cdp, errors };
}
/** rAF and setTimeout calls a second over `ms`. */
async function calls(page, ms) {
  const a = await page.evaluate(() => ({ ...window.__calls }));
  await page.waitForTimeout(ms);
  const b = await page.evaluate(() => ({ ...window.__calls }));
  return { rafPerSec: r2(((b.raf - a.raf) * 1000) / ms), timeoutPerSec: r2(((b.timeout - a.timeout) * 1000) / ms) };
}
async function memory(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  return { heapMB: r2(m.JSHeapUsedSize / 1048576), nodes: m.Nodes, layoutObjects: m.LayoutObjects };
}
async function traced(cdp, fn) {
  const events = [];
  const onData = (d) => events.push(...d.value);
  cdp.on("Tracing.dataCollected", onData);
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "v8", "disabled-by-default-v8.gc"] }, transferMode: "ReportEvents" });
  const out = await fn();
  await cdp.send("Tracing.end");
  await done;
  cdp.off("Tracing.dataCollected", onData);
  return { out, events };
}
// Taps: a pointerdown (then up) at a seeded spot inside every live stage, from the page (one evaluate).
const TAP = `(seed) => { let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const st of document.querySelectorAll("[data-fizlet-slot]")) { const r = st.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: r.left + r.width * (0.2 + 0.6 * rnd()), clientY: r.top + r.height * (0.2 + 0.6 * rnd()) };
    st.dispatchEvent(new PointerEvent("pointerdown", o)); st.dispatchEvent(new PointerEvent("pointerup", { ...o, buttons: 0 })); st.dispatchEvent(new MouseEvent("click", o)); }
  return s; }`;
async function tapFor(page, ms, seed) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    seed = await page.evaluate(`(${TAP})(${seed})`);
    await page.waitForTimeout(250);
  }
  return seed;
}

async function stress(n, mode, selfTest = false) {
  const path = `/fizlet/__stress/many-${mode}-${n}.html`;
  const routes = { [path]: fixture(n, mode, selfTest) };
  if (selfTest) routes["/fizlet/gallery/__never.js"] = NEVER;
  const { context, page, cdp, errors } = await open(`${site.origin}${path}`, routes);
  const t0 = Date.now();
  let live = 0;
  while (Date.now() - t0 < 30000 && (live = await page.locator('figure[data-live="1"]').count()) < n) await page.waitForTimeout(250);
  const mountMs = Date.now() - t0;
  // Idle: every piece has played its intro (autoplay) and settled.
  await page.waitForTimeout(settleWait * 1000);
  const idle = await calls(page, 2000);
  // Active: tapped every 250 ms; the recorder runs only here.
  await tapFor(page, 1000, SEED); // warm-up
  const { out: active, events } = await traced(cdp, async () => {
    const a = await page.evaluate(() => ({ ...window.__calls }));
    await page.evaluate(() => window.__rec.start());
    await tapFor(page, seconds * 1000, SEED);
    const stamps = await page.evaluate(() => window.__rec.stop());
    const b = await page.evaluate(() => ({ ...window.__calls }));
    // The recorder's own frames are on the native rAF: not in these counts.
    return { ...frameStats(stamps), rafPerSec: r2((b.raf - a.raf) / seconds), timeoutPerSec: r2((b.timeout - a.timeout) / seconds) };
  });
  const split = breakdown(events, active.frames);
  active.busyMsPerSec = r2((split.busyMsPerFrame * active.frames) / seconds);
  active.msPerFrame = split.msPerFrame;
  active.top = split.top;
  active.droppedPct = r2((100 * active.dropped) / Math.max(1, active.frames + active.dropped));
  // Off screen: wake them all, then scroll every figure out of view at once.
  await page.evaluate(`(${TAP})(${SEED})`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const offscreen = await calls(page, 2000);
  const mem = await memory(cdp);
  await context.close();
  const row = { n, mode, selfTest, live, mountMs, idle, active: { p50: active.p50, p95: active.p95, p99: active.p99, max: active.max, frames: active.frames, droppedPct: active.droppedPct, rafPerSec: active.rafPerSec, timeoutPerSec: active.timeoutPerSec, busyMsPerSec: active.busyMsPerSec, msPerFrame: active.msPerFrame, top: active.top }, offscreen, memory: mem, errors };
  console.log(`${mode.padEnd(5)} N=${String(n).padStart(2)}${selfTest ? " (self-test)" : ""}: live ${live}/${n} in ${mountMs} ms · idle ${idle.rafPerSec} rAF/s ${idle.timeoutPerSec} timers/s · active p50 ${active.p50.toFixed(1)} p95 ${active.p95.toFixed(1)} p99 ${active.p99.toFixed(1)} dropped ${active.droppedPct}% rAF ${active.rafPerSec}/s busy ${active.busyMsPerSec} ms/s ${JSON.stringify(active.msPerFrame)} · offscreen ${offscreen.rafPerSec} rAF/s ${offscreen.timeoutPerSec} timers/s · heap ${mem.heapMB} MB nodes ${mem.nodes}${errors.length ? " · ERR " + errors.join("; ") : ""}`);
  return row;
}

async function galleryPage(path) {
  const { context, page, cdp, errors } = await open(`${site.origin}/fizlet/${path}`);
  const total = await page.locator("figure[data-gallery]").count();
  // Scroll through, a viewport every 700 ms, recording frames: every slot comes near and mounts.
  await page.evaluate(() => window.__rec.start());
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1500);
  const scroll = frameStats(await page.evaluate(() => window.__rec.stop()));
  const live = await page.locator('figure[data-gallery][data-live="1"]').count();
  const atBottom = await calls(page, 2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(settleWait * 1000);
  const idleTop = await calls(page, 3000);
  const mem = await memory(cdp);
  await context.close();
  const row = { path, total, live, scroll: { p50: scroll.p50, p95: scroll.p95, p99: scroll.p99, droppedPct: r2((100 * scroll.dropped) / Math.max(1, scroll.frames + scroll.dropped)) }, atBottom, idleTop, memory: mem, errors };
  console.log(`gallery /${path}: live ${live}/${total} · scroll p50 ${scroll.p50.toFixed(1)} p95 ${scroll.p95.toFixed(1)} p99 ${scroll.p99.toFixed(1)} dropped ${row.scroll.droppedPct}% · bottom ${atBottom.rafPerSec} rAF/s ${atBottom.timeoutPerSec} timers/s · idle at top ${idleTop.rafPerSec} rAF/s ${idleTop.timeoutPerSec} timers/s · heap ${mem.heapMB} MB nodes ${mem.nodes}${errors.length ? " · ERR " + errors.join("; ") : ""}`);
  return row;
}

// The settle sweep (--sweep): every gallery chunk alone on a page. Seconds from live to quiet (no
// rAF and no timer call for a whole second, twice running), then again after one tap. `never`
// when it's still calling at --cap seconds (default 30). Four pages at a time.
async function settleTime(page, cap) {
  const t0 = Date.now();
  let quiet = 0;
  while (Date.now() - t0 < cap * 1000) {
    const c = await calls(page, 1000);
    quiet = c.rafPerSec === 0 && c.timeoutPerSec === 0 ? quiet + 1 : 0;
    if (quiet === 2) return r2((Date.now() - t0) / 1000 - 2);
  }
  return "never";
}
async function sweepOne(id, cap) {
  const path = `/fizlet/__stress/sweep-${id}.html`;
  const { context, page, errors } = await open(`${site.origin}${path}`, { [path]: fixture(1, "same", false, id) });
  let row;
  try {
    await page.waitForSelector('figure[data-live="1"]', { timeout: 30000 });
    const mount = await settleTime(page, cap);
    await page.evaluate(`(${TAP})(${SEED})`);
    const tap = await settleTime(page, cap);
    row = { id, mount, tap, errors };
  } catch (e) {
    row = { id, mount: "no mount", tap: null, errors: [...errors, e.message.split("\n")[0]] };
  }
  await context.close();
  console.log(`sweep ${id.padEnd(40)} settles ${row.mount === "never" ? "NEVER" : row.mount + " s"} after mount, ${row.tap === "never" ? "NEVER" : row.tap + " s"} after a tap${row.errors.length ? " · ERR " + row.errors.join("; ") : ""}`);
  return row;
}

/** The pass rules for one fixture row (and its smaller-N neighbour, for growth). */
function check(row, prev) {
  const fail = [], at = `${row.mode} N=${row.n}${row.selfTest ? " (self-test)" : ""}`;
  if (row.live < row.n) fail.push(`${at}: ${row.live}/${row.n} figures mounted`);
  if (row.idle.rafPerSec > 0 || row.idle.timeoutPerSec > 0) fail.push(`${at}: settled page still calls ${row.idle.rafPerSec} rAF/s, ${row.idle.timeoutPerSec} timers/s (expected 0)`);
  if (row.offscreen.rafPerSec > 0 || row.offscreen.timeoutPerSec > 0) fail.push(`${at}: off-screen engines call ${row.offscreen.rafPerSec} rAF/s, ${row.offscreen.timeoutPerSec} timers/s (expected 0)`);
  if (row.errors.length) fail.push(`${at}: page errors: ${row.errors.join("; ")}`);
  // Linear or better: busy main-thread ms a second per engine may not grow over the smaller N
  // (25% slack for a shared machine). A saturated main thread (> 900 ms/s) is reported, not judged.
  // Judged on `same` pages only: a `mixed` page of N is the first N chunks, so a bigger N is a
  // different mix of pieces, not more of the same (its numbers are reported as they are).
  if (prev && row.mode === "same" && row.active.busyMsPerSec < 900) {
    const per = row.active.busyMsPerSec / row.n, before = prev.active.busyMsPerSec / prev.n;
    if (per > before * 1.25) fail.push(`${at}: ${r2(per)} busy ms/s per engine > ${r2(before)} at N=${prev.n} (superlinear)`);
  }
  return fail;
}

const rows = [], gallery = [], sweep = [], fail = [], notes = [];
let selfTest = null;
console.log(`seed ${SEED} · throttle ${throttle}× · counts ${counts.join(",")} · modes ${modes.join(",")} · piece ${piece}`);
try {
  for (const mode of modes) {
    let prev = null;
    for (const n of counts) {
      const row = await stress(n, mode);
      rows.push(row);
      fail.push(...check(row, prev));
      if (row.active.busyMsPerSec >= 900) notes.push(`${mode} N=${n}: main thread saturated (${row.active.busyMsPerSec} busy ms/s at ${throttle}×)`);
      prev = row;
    }
  }
  if (f.sweep) {
    const cap = Number(f.cap ?? 30), todo = f.sweep === true ? ids.slice() : list(f.sweep).filter((id) => ids.includes(id));
    const work = async () => { for (let id; (id = todo.shift()); ) sweep.push(await sweepOne(id, cap)); };
    await Promise.all([work(), work(), work(), work()]);
    sweep.sort((a, b) => a.id.localeCompare(b.id));
    for (const r of sweep) {
      if (r.mount === "never" || r.mount === "no mount" || r.tap === "never") fail.push(`sweep ${r.id}: ${r.mount === "no mount" ? "never mounted" : `never settles (after mount: ${r.mount}, after a tap: ${r.tap})`}`);
      if (r.errors.length) fail.push(`sweep ${r.id}: page errors: ${r.errors.join("; ")}`);
    }
  }
  if (f.gallery) for (const p of ["gallery/", "gallery/page/2/", "gallery/archive/"]) {
    const g = await galleryPage(p);
    gallery.push(g);
    if (g.live < g.total) fail.push(`gallery /${p}: ${g.live}/${g.total} mounted after a scroll-through`);
    if (g.idleTop.rafPerSec > 0 || g.idleTop.timeoutPerSec > 0) fail.push(`gallery /${p}: idle at the top ${g.idleTop.rafPerSec} rAF/s, ${g.idleTop.timeoutPerSec} timers/s (expected 0)`);
    if (g.errors.length) fail.push(`gallery /${p}: page errors: ${g.errors.join("; ")}`);
  }
  if (f["self-test"]) {
    const row = await stress(8, "mixed", true);
    const caught = check(row, null);
    selfTest = { caught: caught.length >= 2, fails: caught };
    console.log(`self-test (a piece that never settles and ignores off screen): ${selfTest.caught ? "caught" : "NOT CAUGHT"}: ${caught.join("; ")}`);
  }
} finally {
  await browser.close();
  await site.close();
}
const env = machine(browser);
console.log(`machine  ${env.cpu} · Chromium ${env.chromium} · ${throttle}× · load ${env.load.join(" ")} · ${env.uptime}`);
for (const n of notes) console.log(`note     ${n}`);
const report = { test: "many", seed: SEED, env, throttle, seconds, settleWait, piece, rows, gallery, sweep, notes, selfTest, fail, pass: fail.length === 0 && (!selfTest || selfTest.caught) };
const out = f.out ?? "stress-many.json";
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`report   ${out}`);
if (fail.length) console.error("Fail:\n  " + fail.join("\n  "));
if (selfTest && !selfTest.caught) console.error("self-test: the never-settling fixture passed: the check is blind");
process.exit(report.pass ? 0 : 1);
