// The bytes a demo ships: a built file's gzip size plus every chunk it imports statically (the
// code that loads with it), each gzipped on its own, like the demos' own builds count them.
// Used by scripts/site.mjs for the size badges and by tests/site.mjs to check them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

// Static imports and re-exports in minified ESM; `import(` (a lazy chunk) never matches.
const STATIC = /(?:^|[;}\s])(?:import|export)\s*(?:[^"'();]*?from\s*)?["'](\.{1,2}\/[^"']+)["']/g;

/** Gzip bytes of `file` and its static import closure. */
export function liveBytes(file, seen = new Set()) {
  if (seen.has(file)) return 0;
  seen.add(file);
  const src = readFileSync(file);
  let n = gzipSync(src).length;
  for (const [, spec] of src.toString("utf8").matchAll(STATIC)) n += liveBytes(join(dirname(file), spec), seen);
  return n;
}
