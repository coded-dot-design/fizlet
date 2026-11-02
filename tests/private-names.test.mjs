// No tracked text file names a private repo of the Fizlet factory: its org, or a repo by an old
// or new name. Public docs say "the Fizlet factory" (or "made with the factory") instead. The names
// are built from parts so this file does not name them either.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const j = (...p) => p.join("-");
const NAMES = [
  j("brain", "cache"),
  j("fizlet", "engine"), j("fizlet", "factory"),
  j("astro", "engine"), j("astro", "factory"), j("astro", "base", "engine"), ["astro", "base", "engine"].join("_"),
  j("cache", "keeper"), j("quill", "keeper"),
  j("core", "brain"),
];
const PRIVATE = new RegExp(NAMES.join("|"), "i");
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|webm|zip|gz|pdf|wasm)$/i;

test("no tracked text file names a private repo (old or new names)", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter((f) => f && !BINARY.test(f));
  assert.ok(files.length > 100, "git ls-files lists the repo");
  const hits = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; } // a deleted, not yet committed file
    text.split("\n").forEach((line, i) => { const m = PRIVATE.exec(line); if (m) hits.push(`${f}:${i + 1}: ${m[0]}`); });
  }
  assert.deepEqual(hits, [], "say \"the Fizlet factory\" instead");
});

test("the pattern catches each name and leaves the public org alone", () => {
  for (const n of NAMES) assert.match(`see ${n.toUpperCase()}/docs`, PRIVATE);
  for (const ok of ["coded-dot-design/fizlet", "https://coded.design/", "the Fizlet factory", "an Astro page engine slot"]) assert.doesNotMatch(ok, PRIVATE);
});
