// PERF-LOG.md, generated from tests/perf/wins.json (one source; never edit the Markdown by hand).
//   node scripts/perf-log.mjs           print the log
//   node scripts/perf-log.mjs --write   write PERF-LOG.md
//   node scripts/perf-log.mjs --check   exit 1 when PERF-LOG.md is stale or an entry is incomplete
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "coded-dot-design/fizlet";
const NEED = ["version", "pr", "win", "metric", "before", "after", "unit", "how", "test"];

/** Load and check the wins. Every win is measured: a number before and after, and how. */
export function loadWins(file = "tests/perf/wins.json") {
  const { wins } = JSON.parse(readFileSync(file, "utf8"));
  wins.forEach((w, i) => {
    for (const k of NEED) if (w[k] === undefined || w[k] === "") throw new Error(`wins[${i}]: missing ${k}`);
    if (typeof w.before !== "number" || typeof w.after !== "number") throw new Error(`wins[${i}]: before and after must be measured numbers`);
    if (w.before === w.after) throw new Error(`wins[${i}]: before equals after, not a win`);
    if (!Number.isInteger(w.pr) || w.pr < 1) throw new Error(`wins[${i}]: pr must be a PR number`);
    // A Fizlet version, or "Unreleased" for a win merged since the last release. A win on a site
    // that runs Fizlet (a game's hero) names its repo, and its version is that repo's.
    if (!/^(\d+\.\d+\.\d+|Unreleased)$/.test(w.version)) throw new Error(`wins[${i}]: version ${w.version}`);
    if (w.repo !== undefined && !/^[\w.-]+\/[\w.-]+$/.test(w.repo)) throw new Error(`wins[${i}]: repo ${w.repo} is not owner/name`);
    if (/\|/.test(w.win + w.metric + w.how + w.test)) throw new Error(`wins[${i}]: no "|" in text (it is a table cell)`);
  });
  return wins;
}

const num = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

/** The Markdown: one table row per win. */
export function render(wins) {
  return [
    "# Perf log",
    "",
    "Every performance win in Fizlet, one line each, measured before and after. Newest first.",
    "Generated from `tests/perf/wins.json` by `node scripts/perf-log.mjs --write`; do not edit by hand.",
    "",
    "| Version | Win | Measured | Before → after | How | Test | PR |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...wins.map((w) => {
      const repo = w.repo ?? REPO, short = repo === REPO ? "" : repo.split("/")[1];
      return `| ${short ? `${short} ` : ""}${w.version} | ${w.win} | ${w.metric} | ${num(w.before)} → ${num(w.after)} ${w.unit} | ${w.how} | ${w.test} | [${short}#${w.pr}](https://github.com/${repo}/pull/${w.pr}) |`;
    }),
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const md = render(loadWins());
  const mode = process.argv[2];
  if (mode === "--write") writeFileSync("PERF-LOG.md", md);
  else if (mode === "--check") {
    if (readFileSync("PERF-LOG.md", "utf8") !== md) {
      console.error("PERF-LOG.md is stale: run `node scripts/perf-log.mjs --write`");
      process.exit(1);
    }
  } else process.stdout.write(md);
}
