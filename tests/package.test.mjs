// Guards the release manifest against merge mistakes: a duplicated key in package.json is legal
// JSON, and the last one silently wins (a merge once left two "version" lines, the older last).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

/** Duplicate keys per object, found by walking the JSON source (JSON.parse hides them). */
export function duplicateKeys(src) {
  const dups = [], stack = [];
  const re = /"(?:[^"\\]|\\.)*"\s*:|[{}[\]]|"(?:[^"\\]|\\.)*"/g;
  for (let m; (m = re.exec(src)); ) {
    const t = m[0];
    if (t === "{") stack.push(new Set());
    else if (t === "[") stack.push(null);
    else if (t === "}" || t === "]") stack.pop();
    else if (t.endsWith(":")) {
      const key = JSON.parse(t.slice(0, t.lastIndexOf('"') + 1)), keys = stack.at(-1);
      if (keys) keys.has(key) ? dups.push(key) : keys.add(key);
    }
  }
  return dups;
}

test("duplicateKeys finds a repeated key and ignores arrays and nested objects", () => {
  assert.deepEqual(duplicateKeys('{"a":1,"b":{"a":2},"c":["a","a"],"a":3}'), ["a"]);
  assert.deepEqual(duplicateKeys('{"a":"x:y","b":"\\"a\\":"}'), []);
});

test("package.json has no duplicate keys", () => {
  assert.deepEqual(duplicateKeys(text("package.json")), []);
});

test("package-lock.json version matches package.json", () => {
  const pkg = JSON.parse(text("package.json")), lock = JSON.parse(text("package-lock.json"));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
});

test("every export has a size budget or is the root/ui/package entry or a data file", () => {
  const pkg = JSON.parse(text("package.json")), sizes = text("scripts/sizes.mjs");
  const missing = Object.keys(pkg.exports).filter((k) => !["." , "./kernel", "./package.json", "./ui", "./ui/board-ui.css", "./ui/tokens.json"].includes(k) && !sizes.includes(`"fizlet/${k.slice(2)}"`));
  assert.deepEqual(missing, []);
});
