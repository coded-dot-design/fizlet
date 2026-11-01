#!/usr/bin/env node
// `npx @fzlt/core` (or `fzlt` once installed): the version and the measured brick sizes.
// Zero dependencies, node: built-ins only. Every number comes from dist/sizes.json, written by the
// build from scripts/sizes.mjs (the same measurement as `npm run size`); nothing is measured here.
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const pkg = read("../package.json");
let sizes = null;
try {
  sizes = read("../dist/sizes.json");
} catch {}

const args = process.argv.slice(2);
const INSTALL = "npm i @fzlt/core";
const HOME = "https://fizlet.com";

if (args.includes("--help") || args.includes("-h")) {
  console.log(`fzlt [--json] [--version]\n  prints the version and the measured brick sizes of ${pkg.name}`);
} else if (args.includes("--version") || args.includes("-v")) {
  console.log(pkg.version);
} else if (args.includes("--json")) {
  const out = { name: pkg.name, version: pkg.version, install: INSTALL, home: HOME, measured: sizes?.measured ?? null, sizes: sizes?.entries ?? [] };
  console.log(JSON.stringify(out, null, 2));
} else {
  const n = (x) => x.toLocaleString("en-US");
  const lines = [
    "Fizlet™ (fzlt™) · the bricks for dom animation and games · by Chris Cooley",
    `version  ${pkg.version}`,
    `install  ${INSTALL}`,
    `home     ${HOME}`,
  ];
  if (sizes?.entries?.length) {
    const w = Math.max(5, ...sizes.entries.map((e) => e.name.length));
    lines.push("", `${"brick".padEnd(w)}  ${"gz".padStart(6)}  ${"budget".padStart(6)}`);
    for (const e of sizes.entries) lines.push(`${e.name.padEnd(w)}  ${n(e.gzip).padStart(6)}  ${n(e.budget).padStart(6)}`);
    lines.push("", `bytes: ${sizes.measured}`);
  }
  console.log(lines.join("\n"));
}
