// Landing a PR, the repeatable parts as commands (ADR 0015: repeated agent steps become functions
// with tests). Each command is a pure function below plus a thin CLI; tests/land.test.mjs covers them.
//
//   node scripts/land.mjs bump <version>   package.json + lockfile version, CHANGELOG "## Unreleased" → "## <version>"
//   node scripts/land.mjs changelog        during a rebase: resolve CHANGELOG.md (the branch's Unreleased goes on top)
//   node scripts/land.mjs ci <sha> [repo] [--ignore a,b]  wait for every check run on <sha>; exit 1 unless all passed
//                                          (--ignore: checks known red for another reason, e.g. Pages not enabled)
//
// Code conflicts are never resolved here: they need a person or an agent reading both sides.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const parts = (v) => v.split("-")[0].split(".").map(Number);
/** a > b for plain x.y.z versions (pre-release tags compare as equal to their release). */
export const newer = (a, b) => {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/** Sets the version in package.json, package-lock.json and the CHANGELOG, keeping each file's formatting. */
export function bump({ pkg, lock, changelog }, version) {
  if (!SEMVER.test(version)) throw new Error(`not a version: ${version}`);
  const current = JSON.parse(pkg).version;
  if (!newer(version, current)) throw new Error(`${version} is not newer than ${current}`);
  const setVersion = (text, count) => {
    let n = 0;
    // The top-level "version" and, in the lockfile, packages[""].version: both sit right after "name": "fizlet".
    const out = text.replace(/("name": "[^"]+",\n\s*"version": )"[^"]+"/g, (_, head) => (n++, `${head}"${version}"`));
    if (n !== count) throw new Error(`expected ${count} version field(s), found ${n}`);
    return out;
  };
  if (!/^## Unreleased$/m.test(changelog)) throw new Error('CHANGELOG.md has no "## Unreleased" section');
  return {
    pkg: setVersion(pkg, 1),
    lock: setVersion(lock, 2),
    changelog: changelog.replace(/^## Unreleased$/m, `## ${version}`),
  };
}

const BLOCK = /<<<<<<< [^\n]*\n([\s\S]*?)(?:\|\|\|\|\|\|\| [^\n]*\n[\s\S]*?)?=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g;
/** Resolves rebase conflicts in a CHANGELOG: main's side (HEAD while rebasing) stays, the branch's
 *  "## Unreleased" section goes on top of it. Anything else in a conflict is refused. */
export function mergeChangelog(text) {
  return text.replace(BLOCK, (_, main, branch) => {
    const unreleased = branch.match(/^## Unreleased\n[\s\S]*?(?=^## |(?![\s\S]))/m)?.[0];
    const rest = unreleased ? branch.replace(unreleased, "") : branch;
    if (!unreleased || rest.trim() && !main.includes(rest.trim()))
      throw new Error("CHANGELOG conflict is not just a new Unreleased section: resolve it by hand");
    return `${unreleased.trimEnd()}\n\n${main}`;
  });
}

/** Check runs → passed, failed or pending. Neutral and skipped count as passed; `ignore` names are left out. */
export function verdict(all, ignore = []) {
  const runs = all.filter((r) => !ignore.includes(r.name));
  if (!runs.length) return { state: "pending", failed: [] };
  if (runs.some((r) => r.status !== "completed")) return { state: "pending", failed: [] };
  const failed = runs.filter((r) => !["success", "skipped", "neutral"].includes(r.conclusion)).map((r) => `${r.name}: ${r.conclusion}`);
  return { state: failed.length ? "failed" : "passed", failed };
}

async function cli([cmd, ...args]) {
  if (cmd === "bump") {
    const files = { pkg: "package.json", lock: "package-lock.json", changelog: "CHANGELOG.md" };
    const out = bump(Object.fromEntries(Object.entries(files).map(([k, f]) => [k, readFileSync(f, "utf8")])), args[0] ?? "");
    for (const [k, f] of Object.entries(files)) writeFileSync(f, out[k]);
    console.log(`version ${args[0]}: package.json, package-lock.json, CHANGELOG.md`);
  } else if (cmd === "changelog") {
    writeFileSync("CHANGELOG.md", mergeChangelog(readFileSync("CHANGELOG.md", "utf8")));
    execFileSync("git", ["add", "CHANGELOG.md"]);
    console.log("CHANGELOG.md resolved and staged");
  } else if (cmd === "ci") {
    const at = args.indexOf("--ignore"), ignore = at < 0 ? [] : (args.splice(at, 2)[1] ?? "").split(",");
    const [sha, repo = "coded-dot-design/fizlet"] = args;
    if (!sha) throw new Error("usage: land.mjs ci <sha> [owner/repo] [--ignore a,b]");
    for (let i = 0; ; i++) {
      const runs = JSON.parse(execFileSync("gh", ["api", `repos/${repo}/commits/${sha}/check-runs`, "--jq", ".check_runs"], { encoding: "utf8" }));
      const v = verdict(runs, ignore);
      if (v.state === "passed") return console.log(`${sha.slice(0, 7)}: ${runs.length} checks passed`);
      if (v.state === "failed") throw new Error(`${sha.slice(0, 7)}: ${v.failed.join(", ")}`);
      if (i >= 80) throw new Error(`${sha.slice(0, 7)}: still pending after 20 minutes`);
      await new Promise((r) => setTimeout(r, 15000));
    }
  } else {
    throw new Error("usage: land.mjs bump <version> | changelog | ci <sha> [owner/repo] [--ignore a,b]");
  }
}

if (import.meta.url === `file://${process.argv[1]}`)
  cli(process.argv.slice(2)).catch((e) => (console.error(e.message), process.exit(1)));
