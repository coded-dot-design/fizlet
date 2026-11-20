// The credits, one wording everywhere the package speaks: "Created by Chris Cooley · Built with fzlt ·
// Sponsored by coded.design". The author is Chris Cooley (no URL); coded.design is the sponsor, not an owner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");

test("package.json: Chris Cooley is the author, with no URL; MIT", () => {
  assert.equal(pkg.author, "Chris Cooley");
  assert.equal(pkg.license, "MIT");
});

test("README: the credits line, word for word, and no coded.design ownership wording", () => {
  assert.ok(readme.includes("Created by Chris Cooley · Built with fzlt · Sponsored by [coded.design](https://coded.design/)."), "the credits line");
  assert.match(readme, /\n## Licence\n\nMIT © Chris Cooley\n/);
  assert.doesNotMatch(readme, /© [^\n]*coded\.design/, "coded.design sponsors; it does not hold the copyright");
  assert.doesNotMatch(readme, /\[Chris Cooley\]\(https:\/\/coded\.design/, "the author is not linked to the sponsor");
});

test("LICENSE: MIT, copyright Chris Cooley", () => {
  const license = readFileSync("LICENSE", "utf8");
  assert.match(license, /^MIT License\n\nCopyright \(c\) \d{4} Chris Cooley\n/);
});
