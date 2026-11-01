// Shared by the stress tests (tests/stress/<name>.mjs): flags, the machine line every result
// carries (CPU, Chromium, load average: the box is shared), percentiles and a trace breakdown.
import { cpus, loadavg } from "node:os";
import { execFileSync } from "node:child_process";

/** `--key value`, `--key=value` and bare `--flag` (true). Numbers stay strings; callers convert. */
export function flags(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=", 2);
    if (v != null) out[k] = v;
    else if (argv[i + 1] != null && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}
export const list = (v, d) => String(v ?? d).split(",").map((s) => s.trim()).filter(Boolean);

/** The machine line: CPU × cores, Chromium, load average now (1/5/15 min) and `uptime`. */
export function machine(browser) {
  let up = "";
  try {
    up = execFileSync("uptime", { encoding: "utf8" }).trim();
  } catch {}
  return { cpu: `${cpus()[0]?.model ?? "unknown CPU"} × ${cpus().length}`, chromium: browser?.version() ?? null, load: loadavg().map((l) => +l.toFixed(2)), uptime: up, node: process.version };
}

export const median = (xs) => {
  const s = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
export const range = (xs) => {
  const s = xs.filter((x) => x != null && !Number.isNaN(x));
  return s.length ? [Math.min(...s), Math.max(...s)] : [NaN, NaN];
};

// Where a window's main-thread time went: self time per trace event on the renderer main thread,
// grouped. Self, not total: a FunctionCall inside FireAnimationFrame counts once.
const GROUPS = [
  ["gc", /^(MinorGC|MajorGC|V8\.GC|BlinkGC|ThreadState::)/],
  ["script", /^(FunctionCall|EvaluateScript|v8\.|V8\.|FireAnimationFrame|TimerFire|EventDispatch|RunMicrotasks|FireIdleCallback|ResizeObserver|IntersectionObserver|HitTest|ParseHTML|v8\.compile|ScheduleStyleRecalculation|XHR|TimeStamp)/],
  ["style+layout", /^(UpdateLayoutTree|Layout|RecalculateStyles|InvalidateLayout|UpdateLayerTree|ComputeIntersections)/],
  ["paint", /^(Paint|PaintImage|PrePaint|PaintSetup|Decode|Rasterize|RasterTask|DrawLazyPixelRef|UpdateLayer)/],
  ["layerize+commit", /^(Layerize|Commit|ScrollbarLayer|UpdateLayerTree|CompositeLayers|BeginMainThreadFrame|BeginFrame)/],
];
export function breakdown(events, frames) {
  const main = events.find((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain");
  const xs = events.filter((e) => e.ph === "X" && e.dur != null && (!main || (e.pid === main.pid && e.tid === main.tid)));
  xs.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = new Map(), stack = [];
  for (const e of xs) {
    while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
    self.set(e, e.dur);
    if (stack.length) self.set(stack.at(-1), self.get(stack.at(-1)) - e.dur);
    stack.push(e);
  }
  const byName = new Map(), byGroup = {};
  for (const [e, us] of self) byName.set(e.name, (byName.get(e.name) ?? 0) + Math.max(0, us));
  let total = 0;
  for (const [name, us] of byName) {
    if (name === "RunTask" || name === "ThreadControllerImpl::RunTask") continue; // the task shell
    const g = GROUPS.find(([, re]) => re.test(name))?.[0] ?? "other";
    byGroup[g] = (byGroup[g] ?? 0) + us / 1000;
    total += us / 1000;
  }
  const per = (ms) => +(ms / Math.max(1, frames)).toFixed(2);
  const top = [...byName].filter(([n]) => !/RunTask$/.test(n)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, us]) => `${n} ${per(us / 1000)}`);
  return { msPerFrame: Object.fromEntries(Object.entries(byGroup).map(([g, ms]) => [g, per(ms)])), busyMsPerFrame: per(total), top };
}
