// Shared helpers for the stress tests: flags, a seeded PRNG, young-GC counting, a NaN/Infinity scan.
import { PerformanceObserver, constants } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import os from "node:os";

/** Run `main(argv, env)` when this module is the entry point (`npm run test:stress -- <name>` spawns
 *  it): print the machine (Node, CPU, load average) and the JSON result, exit 1 on a fail. */
export async function selfRun(url, name, main) {
  if (url !== pathToFileURL(process.argv[1]).href) return;
  if (typeof globalThis.gc !== "function") console.warn("stress: run node with --expose-gc (npm run test:stress does)");
  const env = { node: process.version, cpu: os.cpus()[0]?.model, cpus: os.cpus().length, load: os.loadavg().map((x) => +x.toFixed(2)), at: new Date().toISOString() };
  const result = await main(process.argv.slice(2), env);
  if (!result) return; // a child process that printed its own line
  console.log(JSON.stringify({ test: name, env, ...result }, null, 2));
  process.exitCode = result.pass ? 0 : 1;
}

/** `--steps 1e6 --seed 3 --self-test` → { steps: 1000000, seed: 3, "self-test": true }. */
export function flags(argv, defaults) {
  const o = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) o[k] = true;
    else (o[k] = isNaN(+next) ? next : +next), i++;
  }
  return o;
}

/** mulberry32: a seeded [0, 1) generator, independent of the engine's own. Its state lives in a
 *  Uint32Array: a captured `let` above 2^30 would box a heap number on every draw (the harness must
 *  not be the thing that allocates in a zero-GC soak). */
export function prng(seed) {
  const a = new Uint32Array([seed >>> 0]), t = new Uint32Array(1);
  return () => {
    a[0] = a[0] + 0x6d2b79f5;
    t[0] = a[0];
    t[0] = Math.imul(t[0] ^ (t[0] >>> 15), t[0] | 1);
    t[0] ^= t[0] + Math.imul(t[0] ^ (t[0] >>> 7), t[0] | 61);
    return ((t[0] ^ (t[0] >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counts young-generation (scavenge) GCs while it is open. `stop()` waits for the observer to flush. */
export function youngGCs() {
  let minor = 0;
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.detail?.kind === constants.NODE_PERFORMANCE_GC_MINOR) minor++;
  });
  obs.observe({ entryTypes: ["gc"] });
  return {
    async stop() {
      await new Promise((r) => setTimeout(r, 30));
      obs.disconnect();
      return minor;
    },
  };
}

/** Every NaN or ±Infinity slot in the named typed arrays and numbers: [{ name, index, value }]. `span`
 *  scans only the first slots of each array (a fuzzed huge capacity must not page in gigabytes). */
export function badSlots(named, limit = 8, span = Infinity) {
  const out = [];
  for (const [name, v] of Object.entries(named)) {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) out.push({ name, value: String(v) });
    } else if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
      for (let i = 0, n = Math.min(v.length, span); i < n; i++)
        if (!Number.isFinite(v[i])) {
          out.push({ name, index: i, value: String(v[i]) });
          break;
        }
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Heap used after a full GC, in bytes. */
export function heap() {
  globalThis.gc?.();
  globalThis.gc?.();
  return process.memoryUsage().heapUsed;
}
