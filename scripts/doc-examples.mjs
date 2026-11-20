// The code examples in the docs (README.md and the brick docs beside the source), extracted so a
// test can typecheck and run each one (tests/doc-examples.test.mjs, part of `npm test`).
//
// An example is a ```ts or ```js block. Most are fragments: they use names the page around them
// would have (`engine`, `ctx`, `player`…). Those free names are found by the typecheck itself
// ("Cannot find name") and declared: the context names below with their real types, every other
// one as `any`. A free name that a brick exports is not declared: the example has to import it.
// A block with no import of its own continues the block before it in the same file (its imports
// are carried over).
//
// An HTML comment right before the fence steers one block:
//   <!-- doc-test: typecheck -->   typecheck only (it needs a server, a network, a second page…)
//   <!-- doc-test: skip -->        neither (not TypeScript the brick runs: shell, a shape sketch)
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The files whose examples are tested. */
export const DOCS = ["README.md", "src/ui/BOARD-UI.md", "src/ACTORS.md"];

/**
 * Names an example may use without defining, with the type the typecheck gives them (the browser
 * run gives each a live value of that kind: a running engine, a canvas context, an element).
 */
export const CONTEXT = {
  e: "import('@fzlt/core').Engine",
  engine: "import('@fzlt/core').Engine",
  ctx: "CanvasRenderingContext2D",
  root: "HTMLElement", stage: "HTMLElement", host: "HTMLElement", wrap: "HTMLElement",
  figure: "HTMLElement", cart: "HTMLElement", screen: "HTMLElement", deck: "HTMLElement", tank: "HTMLElement",
  lines: "HTMLElement[]",
  signal: "AbortSignal",
};

/** Free names that are numbers in the examples (positions, cell ids, frames): 0 when run. */
export const NUMBERS = ["x", "y", "a", "z", "from", "to", "unit", "frame", "angle", "side", "px", "py", "x0", "y0", "x1", "y1", "tx", "ty", "speed"];
for (const n of NUMBERS) CONTEXT[n] = "number";

/** Every ts/js block of one markdown file: [{ file, line, lang, code, mode }] (line: the fence's, 1-based). */
export function extract(file, text = readFileSync(file, "utf8")) {
  const out = [], lines = text.split("\n");
  let prevImports = "";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(ts|typescript|js|javascript)\s*$/);
    if (!m) continue;
    const start = i;
    const body = [];
    for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
    let k = start - 1;
    while (k >= 0 && lines[k].trim() === "") k--;
    const tag = lines[k]?.match(/<!--\s*doc-test:\s*(\w+)\s*-->/)?.[1];
    let code = body.join("\n");
    const imports = code.split("\n").filter((l) => /^import\s/.test(l)).join("\n");
    if (!imports && prevImports) code = prevImports + "\n" + code;
    else if (imports) prevImports = imports;
    code = rebase(file, code);
    out.push({ file, line: start + 1, lang: m[1].startsWith("t") ? "ts" : "js", code, mode: tag ?? "run" });
  }
  return out;
}

/** A doc beside the source imports by relative path ("./board-ui"): point it at the file itself. */
function rebase(file, code) {
  return code.replace(/(from\s+|import\s+|import\()(["'])(\.\.?\/[^"']+)\2/g, (_, pre, q, spec) => {
    if (/^\.\.?\/[\w-]+-scene\.js$/.test(spec)) return `${pre}${q}${spec}${q}`; // the example's own module
    return `${pre}${q}${resolve(dirname(file), spec).replace(/\.js$/, "")}${q}`;
  });
}

/** All examples of DOCS, from the repo root. */
export function examples(root = ".") {
  return DOCS.flatMap((f) => {
    try {
      return extract(f, readFileSync(join(root, f), "utf8"));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  });
}
