// The publish-clean gate: what `npm pack` would ship is the build and three docs, with no comments
// and no agent words.
//
//   npm run publish-clean     (builds first when dist/ is missing)
//
// 1. every packed file is dist/..., bin/..., README.md, LICENSE, CHANGELOG.md or package.json;
// 2. no packed dist .js/.d.ts or bin file holds a comment (scripts/comments.mjs tokenizes, so a `//`
//    inside a string, template or regex is not one; a first-line shebang is allowed);
// 3. no packed file except LICENSE and CHANGELOG.md holds the whole word agent, Claude, keeper or
//    handoff (any case) or Pip (capitalised). CHANGELOG.md is history and only warned about.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanComments } from "./comments.mjs";

export const ALLOWED = /^(dist\/.+|bin\/.+|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/;
export const CODE = /^(dist\/.+\.(js|mjs|cjs|d\.ts)|bin\/.+)$/;
// Pip is the keeper's name: capitalised only, so a die's pips (\`pip\` in @fzlt/core/dice) are not one.
// A brick's import path is a name, not a word: the planned \`@fzlt/core/agent\` (AI players) is allowed.
export const WORDS = /\b(agent|Claude|keeper|handoff)\b/i;
export const NAME = /\bPip\b/;
const NAMES_OK = /@fzlt\/core\/[a-z-]+/g;
const banned = (line) => { const l = line.replace(NAMES_OK, ""); return WORDS.test(l) || NAME.test(l); };
export const WORDS_EXEMPT = new Set(["LICENSE"]);
export const WORDS_WARN = new Set(["CHANGELOG.md"]);

/** `files`: [{ path, text }] as packed. Returns { problems, warnings } (problems empty = clean). */
export function checkPack(files) {
  const problems = [], warnings = [];
  for (const { path, text } of files) {
    if (!ALLOWED.test(path)) {
      problems.push(`${path}: not allowed in the package (only dist/, bin/, README.md, LICENSE, CHANGELOG.md, package.json)`);
      continue;
    }
    if (CODE.test(path) && text != null) {
      const [first] = scanComments(text);
      if (first) problems.push(`${path}:${first.line}: comment ${JSON.stringify(first.text.slice(0, 40))}`);
    }
    if (text == null || WORDS_EXEMPT.has(path)) continue;
    const hits = text.split("\n").flatMap((l, i) => (banned(l) ? [`${path}:${i + 1}: ${JSON.stringify(l.trim().slice(0, 70))}`] : []));
    if (WORDS_WARN.has(path)) {
      if (hits.length) warnings.push(`${path}: ${hits.length} line(s) with agent words (history, not failed), first ${hits[0]}`);
    } else problems.push(...hits.slice(0, 5).map((h) => `${h} has a banned word (agent|Claude|Pip|keeper|handoff)`));
  }
  return { problems, warnings };
}

const BINARY = /\.(png|gif|jpe?g|woff2?|ico|wasm)$/;

export function packedFiles(cwd = process.cwd()) {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const [pack] = JSON.parse(out);
  return pack.files.map(({ path }) => ({ path, text: BINARY.test(path) ? null : readFileSync(`${cwd}/${path}`, "utf8") }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync("dist/index.js")) execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  const files = packedFiles();
  const { problems, warnings } = checkPack(files);
  for (const w of warnings) console.warn(`warn  ${w}`);
  if (problems.length) {
    console.error(`publish-clean: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`publish-clean: ${files.length} packed files, no stray files, no comments, no agent words`);
}
