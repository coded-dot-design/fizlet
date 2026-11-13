// Runs one shard of a chained test script, so CI can split the long suites across parallel jobs.
//   node scripts/shard.mjs <script> <k>/<n>      run shard k of n of package.json's <script>
//   node scripts/shard.mjs <script> <k>/<n> --list   print that shard's files, run nothing
// <script> is a package.json script made of `node tests/x.mjs && node tests/y.mjs ...` (test:browser,
// test:site): package.json stays the one list, so a test added there lands in a shard by itself.
// Shards are balanced by tests/shard-times.json (seconds per file, from a CI log; a file not in the
// table counts as the table's median) with longest-first greedy, ties broken by file name: the same
// list and table always give the same shards, and every file is in exactly one shard for any n.
// Every file runs even after a failure (one run shows every red file); exit 1 if any failed.
import { readFileSync, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";

/** The test files of a chained `node <file> && node <file>` script, in order. */
export function files(command) {
  return command.split("&&").map((part) => {
    const m = /^\s*node\s+(\S+\.mjs)\s*$/.exec(part);
    if (!m) throw new Error(`shard: not a plain \`node <file>\` step: ${part.trim()}`);
    return m[1];
  });
}

/** Splits `list` into `n` shards balanced by `times` (seconds per file). */
export function shards(list, n, times = {}) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`shard: n must be a whole number >= 1, got ${n}`);
  const known = Object.values(times).sort((a, b) => a - b);
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 1;
  const cost = (f) => times[f] ?? fallback;
  const out = Array.from({ length: n }, () => ({ files: [], seconds: 0 }));
  const order = [...new Set(list)].sort((a, b) => cost(b) - cost(a) || (a < b ? -1 : a > b ? 1 : 0));
  for (const f of order) {
    let min = 0;
    for (let i = 1; i < n; i++) if (out[i].seconds < out[min].seconds) min = i;
    out[min].files.push(f);
    out[min].seconds += cost(f);
  }
  // Each shard runs its files in package.json order (the order the full suite runs them in).
  for (const s of out) s.files.sort((a, b) => list.indexOf(a) - list.indexOf(b));
  return out;
}

const FAIL = /✖|not ok|Error|error TS|AssertionError|expected|actual|OVER|failed/;

function run(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tail = [];
    const child = spawn(process.execPath, [file], { stdio: ["ignore", "pipe", "pipe"] });
    const pipe = (src, dst) => src.on("data", (b) => {
      dst.write(b);
      for (const line of String(b).split("\n")) if (FAIL.test(line) && tail.length < 40) tail.push(line);
    });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on("close", (code, signal) => resolve({ file, ok: code === 0, code: code ?? signal, seconds: (Date.now() - t0) / 1000, tail }));
  });
}

async function main(argv) {
  const [script, spec, flag] = argv;
  const m = /^(\d+)\/(\d+)$/.exec(spec ?? "");
  if (!script || !m) {
    console.error("usage: node scripts/shard.mjs <package.json script> <k>/<n> [--list]");
    return 2;
  }
  const k = Number(m[1]), n = Number(m[2]);
  if (k < 1 || k > n) { console.error(`shard: k must be 1..${n}, got ${k}`); return 2; }
  const command = JSON.parse(readFileSync("package.json", "utf8")).scripts?.[script];
  if (!command) { console.error(`shard: no script ${script} in package.json`); return 2; }
  const table = JSON.parse(readFileSync("tests/shard-times.json", "utf8"))[script] ?? {};
  const mine = shards(files(command), n, table)[k - 1];
  if (flag === "--list") { console.log(mine.files.join("\n")); return 0; }

  console.log(`${script} shard ${k}/${n}: ${mine.files.length} files, ~${Math.round(mine.seconds)} s by tests/shard-times.json`);
  const results = [];
  for (const f of mine.files) {
    const r = await run(f);
    results.push(r);
    console.log(`${r.ok ? "ok" : "FAILED"} ${f} (${r.seconds.toFixed(1)} s${r.ok ? "" : `, exit ${r.code}`})`);
  }
  const failed = results.filter((r) => !r.ok);
  const total = results.reduce((s, r) => s + r.seconds, 0);
  if (process.env.GITHUB_ACTIONS) {
    // Failures as annotations (readable through the API when job logs are not); timings for the table.
    for (const r of failed) {
      console.log(`::error::${r.file} failed (exit ${r.code})`);
      for (const line of r.tail) console.log(`::error::${line}`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### ${script} shard ${k}/${n}: ${Math.round(total)} s\n\n| file | s | |\n|---|---:|---|\n` +
      results.map((r) => `| ${r.file} | ${r.seconds.toFixed(1)} | ${r.ok ? "ok" : "FAILED"} |`).join("\n") +
      `\n\n<!-- shard-times ${JSON.stringify(Object.fromEntries(results.map((r) => [r.file, Math.round(r.seconds)])))} -->\n`);
  }
  console.log(`${script} shard ${k}/${n}: ${results.length - failed.length}/${results.length} ok in ${Math.round(total)} s`);
  return failed.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main(process.argv.slice(2));
