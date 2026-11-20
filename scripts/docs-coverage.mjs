// Docs coverage: every public export of every brick carries TSDoc, and so does every member of an
// exported interface or object type (options, return values), so editors and the API pages show it.
// Reads the built declarations (dist/*.d.ts, which keep the comments) of each package.json subpath,
// following relative re-exports, and lists each declaration without a `/** … */` right before it.
//
//   npm run docs:coverage              build, then print counts per brick and every undocumented name
//   npm run docs:coverage -- --check   also fail when a name is undocumented and not in the baseline
//   npm run docs:coverage -- --write   rewrite the baseline (scripts/docs-coverage.json) to what is missing now
//
// The baseline only shrinks: a new export that lands without TSDoc fails --check (CI), and one
// documented since the baseline was written is reported so the baseline can be rewritten.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { surfaceFiles } from "./api-snapshot.mjs";

export const BASELINE = "scripts/docs-coverage.json";

/** Declarations in one .d.ts text: [{ name, documented, line }] for exports and their members. */
export function scanDts(text) {
  const lines = text.split("\n");
  const out = [];
  let depth = 0, inExport = false, exportDepth = 0, owner = "";
  let docEnd = -2; // index of the last line that closed a /** */ block
  let inDoc = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim();
    if (inDoc) { if (t.includes("*/")) { inDoc = false; docEnd = i; } continue; }
    if (t.startsWith("/**")) { if (t.includes("*/")) docEnd = i; else inDoc = true; continue; }
    if (t.startsWith("//") || t.startsWith("/*") || t === "") continue;
    const documented = docEnd === i - 1;
    if (depth === 0) {
      const m = t.match(/^export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/);
      if (m) {
        out.push({ name: m[1], documented, line: i + 1 });
        inExport = /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:interface|class|type|function)\b/.test(t);
        owner = m[1];
        exportDepth = 1;
      } else inExport = false;
    } else if (inExport && depth === exportDepth) {
      const m = t.match(/^(?:readonly\s+)?(?:static\s+)?(?:get\s+|set\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\??\s*[:(<]/);
      if (m && m[3] !== "constructor" && !/^(private|protected)\b/.test(t)) out.push({ name: `${owner}.${m[1] ?? m[2] ?? m[3]}`, documented, line: i + 1 });
    }
    for (const c of stripStrings(t)) { if (c === "{") depth++; else if (c === "}") depth--; }
  }
  // Overloads and get/set pairs: a name counts once, documented when any declaration is.
  const byName = new Map();
  for (const d of out) { const p = byName.get(d.name); if (!p) byName.set(d.name, d); else p.documented ||= d.documented; }
  return [...byName.values()];
}

const stripStrings = (t) => t.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "").replace(/\/\/.*$/, "");

/** Every package.json subpath with types: [{ brick, files }]. */
export function bricks() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return Object.entries(pkg.exports)
    .filter(([, v]) => typeof v === "object" && v.types)
    .map(([k, v]) => ({ brick: k === "." ? "core" : k.slice(2), files: surfaceFiles(v.types.replace(/^\.\//, "")) }));
}

/** { brick: { total, documented, missing: [names] } }, each declaration counted once per brick. */
export function coverage() {
  const out = {};
  for (const { brick, files } of bricks()) {
    const seen = new Map();
    for (const f of files) for (const d of scanDts(readFileSync(f, "utf8"))) {
      const key = `${relative("dist", f)}#${d.name}`;
      seen.set(key, d.documented);
    }
    const missing = [...seen].filter(([, ok]) => !ok).map(([k]) => k).sort();
    out[brick] = { total: seen.size, documented: seen.size - missing.length, missing };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (!args.includes("--no-build")) execFileSync("node", ["scripts/build.mjs"], { stdio: "ignore" });
  const cov = coverage();
  let total = 0, documented = 0;
  const unique = new Map();
  for (const [b, c] of Object.entries(cov)) {
    total += c.total; documented += c.documented;
    console.log(`${b.padEnd(18)} ${String(c.documented).padStart(4)}/${String(c.total).padEnd(4)} documented`);
  }
  for (const c of Object.values(cov)) for (const k of c.missing) unique.set(k, true);
  const allMissing = [...unique.keys()].sort();
  console.log(`\nall subpaths: ${documented}/${total} documented (${allMissing.length} distinct declarations without TSDoc)`);
  if (args.includes("--list")) for (const k of allMissing) console.log("  " + k);
  if (args.includes("--write")) {
    writeFileSync(BASELINE, JSON.stringify(allMissing, null, 2) + "\n");
    console.log(`wrote ${BASELINE}`);
  }
  if (args.includes("--check")) {
    const base = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : []);
    const fresh = allMissing.filter((k) => !base.has(k));
    const fixed = [...base].filter((k) => !unique.has(k));
    if (fixed.length) console.log(`\n${fixed.length} baseline entries are documented now: run npm run docs:coverage -- --write`);
    if (fresh.length) {
      console.error(`\n${fresh.length} public declarations have no TSDoc (add a /** */ comment in src/):`);
      for (const k of fresh) console.error("  " + k);
      process.exit(1);
    }
  }
}
