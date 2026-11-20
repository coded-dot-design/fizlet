// Every code example in the docs is proven: each ```ts / ```js block of README.md and the brick docs,
// and each site listing (site/brick-examples, site/docs/code: the brick and docs pages' code)
// (scripts/doc-examples.mjs lists the files) is typechecked against the bricks' real types, then run
// in Chromium against the source, a few frames long, and fails on any error it throws. Free names a
// fragment leaves to the page around it get a value: a running engine, a canvas context, elements
// (scripts/doc-examples.mjs CONTEXT), and for anything else a stand-in that absorbs every use (any
// property, call or number), so what runs for real is the bricks' own code with the example's options.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { CONTEXT, NUMBERS, examples } from "../scripts/doc-examples.mjs";
import { launchOptions } from "./chromium.mjs";

const ROOT = resolve(".");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

/** `@fzlt/core/<sub>` → its source file (package.json exports, dist/*.js → src/*.ts). */
const SUBPATHS = Object.fromEntries(
  Object.entries(pkg.exports)
    .map(([k, v]) => [k === "." ? "@fzlt/core" : "@fzlt/core/" + k.slice(2), typeof v === "string" ? v : v.default])
    .filter(([, v]) => v.startsWith("./dist/"))
    .map(([k, v]) => [k, join(ROOT, v.replace("./dist/", "src/").replace(/\.js$/, ".ts"))]),
);

/** Every name a brick exports (an example that uses one must import it, not lean on a stand-in). */
const BRICK_NAMES = new Set();
for (const f of [...readdirSync("src"), ...readdirSync("src/kernel").map((f) => "kernel/" + f), "ui/board-ui.ts"])
  if (f.endsWith(".ts"))
    for (const [, n] of readFileSync(join("src", f), "utf8").matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm))
      BRICK_NAMES.add(n);

const all = examples();

/** The site's listings: brick pages' examples and the docs pages' code. They live in the site's own
 * repository since the split, so in the package alone this list is empty; the README and brick docs stay. */
const LISTINGS = ["site/brick-examples", "site/docs/code"].filter((d) => existsSync(d)).flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".ts")).sort().map((f) => `${d}/${f}`));

/** A runtime value for a listing's `declare const name: type` (the stand-in for anything else). */
function valueFor(name, type) {
  if (/^HTML\w*Element$/.test(type)) return `__ctx("stage").appendChild(document.createElement("div"))`;
  if (type === "Text") return `document.createTextNode("")`;
  if (type === "number") return "0";
  if (type === "string") return `""`;
  if (type === "boolean") return "false";
  if (/^(Float64|Float32|Uint8|Uint32|Int32)Array$/.test(type)) return `new ${type}(64)`;
  return `__ctx(${JSON.stringify(name)})`;
}
const dir = mkdtempSync(join(tmpdir(), "fzlt-doc-examples-"));
const fileOf = (i) => join(dir, `ex${i}.${all[i].lang}`);

/** Line 1 of each generated file: the prelude, then a value for each free name (line numbers stay the doc's). */
function header(ex, free) {
  const decl = free.map((n) => {
    const type = CONTEXT[n] ?? "any";
    return ex.lang === "ts" ? `let ${n} = __ctx("${n}") as ${type};` : `let ${n} = /** @type {${type}} */ (__ctx("${n}"));`;
  });
  return `import "./prelude.ts"; ${decl.join(" ")}`;
}

function write(free) {
  all.forEach((ex, i) => {
    const code = ex.code.replace(/(["'])\.\/[\w-]+-scene\.js\1/g, `"./ex${i}.${ex.lang}"`); // its own module
    writeFileSync(fileOf(i), header(ex, free[i]) + "\n" + code + "\n");
  });
}

/** tsc over every example: [{ i, line, code, msg }]. */
function typecheck() {
  try {
    execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["-p", join(dir, "tsconfig.json")], { encoding: "utf8" });
    return [];
  } catch (err) {
    const out = (err.stdout ?? "") + (err.stderr ?? "");
    const errs = [...out.matchAll(/ex(\d+)\.(?:ts|js)\((\d+),\d+\): error (TS\d+): (.*)/g)].map(([, i, line, code, msg]) => ({ i: +i, line: +line, code, msg }));
    if (!errs.length) throw new Error(out);
    return errs;
  }
}

const where = (i, line) => `${all[i].file}:${all[i].line + line - 1}`;

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("the docs have examples, and every one is steered by at most one doc-test tag", () => {
  // The package README keeps its install and kernel examples; each brick's long-form examples moved
  // with the guides to the docs site at the split (4 here then, 19 in the old README). A drop below
  // that means the extractor broke, not that the docs shrank.
  assert.ok(all.length >= 4, `only ${all.length} examples found`);
  for (const ex of all) assert.ok(["run", "typecheck", "skip"].includes(ex.mode), `${ex.file}:${ex.line}: unknown doc-test tag ${ex.mode}`);
});

const live = all.map((ex, i) => i).filter((i) => all[i].mode !== "skip");
const free = all.map(() => []);

test("every example typechecks against the bricks' types (free names: context values or stand-ins)", () => {
  writeFileSync(join(dir, "prelude.ts"), "export {};\n");
  writeFileSync(join(dir, "globals.d.ts"), `declare function __ctx(name: string): any;\ndeclare module "*.css";\n`);
  const paths = Object.fromEntries(Object.entries(SUBPATHS).map(([k, v]) => [k, [v]]));
  paths["@fzlt/core/ui/board-ui.css"] = [join(ROOT, "src/ui/board-ui.css")];
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "Bundler", lib: ["ES2022", "DOM", "DOM.Iterable"],
      strict: true, noImplicitAny: false, skipLibCheck: true, noEmit: true, allowJs: true, checkJs: true, allowImportingTsExtensions: true,
      types: [], paths,
    },
    files: ["globals.d.ts", "prelude.ts", ...live.map((i) => `ex${i}.${all[i].lang}`)],
  }));
  write(free);
  // Pass 1 finds the free names; pass 2 must be clean.
  for (const e of typecheck()) {
    const m = e.msg.match(/^(?:Cannot find name|No value exists in scope for the shorthand property) '([\w$]+)'/);
    if (!m || free[e.i].includes(m[1])) continue;
    // A brick's function called without its import is the example's bug; a brick name used as a
    // plain value (`board`, `slot`) is the page's variable.
    if (BRICK_NAMES.has(m[1]) && new RegExp(`(^|[^.\\w$])${m[1]}\\s*\\(`).test(all[e.i].code)) continue;
    free[e.i].push(m[1]);
  }
  write(free);
  const errs = typecheck().map((e) => `${where(e.i, e.line)} ${e.code} ${e.msg}`);
  assert.deepEqual(errs, [], "examples that do not typecheck:\n" + errs.join("\n"));
});

test("every example runs in Chromium for a few frames without an error", { timeout: 300_000 }, async () => {
  const run = live.filter((i) => all[i].mode === "run");
  // The prelude: the context values and the stand-in every other free name gets.
  writeFileSync(join(dir, "prelude.ts"), `
import { createEngine } from "@fzlt/core";
const stage = document.createElement("div");
stage.style.cssText = "position:relative;width:640px;height:360px";
document.body.append(stage);
const el = (tag = "div") => stage.appendChild(document.createElement(tag));
const canvas = el("canvas") as HTMLCanvasElement;
let engine: ReturnType<typeof createEngine> | null = null;
const NUMBERS = ${JSON.stringify(NUMBERS)};
const any: any = new Proxy(function () {}, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === Symbol.iterator ? [][Symbol.iterator].bind([]) : k === "then" ? undefined : k === "length" ? 0 : any),
  apply: () => any,
  construct: () => any,
});
const ctx: Record<string, () => unknown> = {
  e: () => (engine ??= createEngine({ root: stage, seed: 7 })),
  engine: () => (engine ??= createEngine({ root: stage, seed: 7 })),
  ctx: () => canvas.getContext("2d"),
  lines: () => [el("p"), el("p")],
  signal: () => new AbortController().signal,
};
for (const n of ["root", "stage", "host", "figure", "cart", "screen", "deck", "tank"]) ctx[n] = () => el();
// The HUD example's markup (README "HUD"), so its selectors find their elements.
ctx.wrap = () => Object.assign(el(), { innerHTML: '<b data-k></b><b data-t></b><i data-hp role="progressbar"></i><ol class="feed"></ol><p class="banner"></p>' });
for (const n of NUMBERS) ctx[n] = () => 0;
(globalThis as any).__ctx = (n: string) => (ctx[n] ? ctx[n]() : any);
(globalThis as any).__engine = () => engine;
`);
  write(free);
  const plugin = {
    name: "fzlt",
    setup(b) {
      b.onResolve({ filter: /^@fzlt\/core/ }, (a) => {
        if (a.path === "@fzlt/core/ui/board-ui.css") return { path: join(ROOT, "src/ui/board-ui.css") };
        const p = SUBPATHS[a.path];
        return p ? { path: p } : { errors: [{ text: `no subpath ${a.path}` }] };
      });
    },
  };
  // The site's typechecked listings (npm run typecheck covers their types) run the same way. Their
  // `declare const` names are globals the page would have: each gets a value by its declared type.
  const entries = run.map((i) => ({ at: `${all[i].file}:${all[i].line}`, entry: fileOf(i) }));
  for (const f of LISTINGS) {
    const src = readFileSync(f, "utf8");
    if (/^\/\/ doc-test: (typecheck|skip)\b/m.test(src)) continue;
    const sets = [];
    for (const [, list] of src.matchAll(/^declare (?:const|let) (.+);$/gm))
      for (const [, n, type] of list.matchAll(/([A-Za-z_$][\w$]*): ((?:[^,(){}]|\([^)]*\)|\{[^}]*\})+)/g))
        sets.push(`g.${n} = ${valueFor(n, type.trim())};`);
    const wrap = join(dir, `listing${entries.length}.ts`);
    writeFileSync(wrap, `import "./prelude.ts";\nimport "./globals${entries.length}.ts";\nimport ${JSON.stringify(join(ROOT, f))};\n`);
    writeFileSync(join(dir, `globals${entries.length}.ts`), `const g = globalThis as any;\n${sets.join("\n")}\n`);
    entries.push({ at: f, entry: wrap });
  }
  const browser = await chromium.launch(launchOptions());
  const failures = [];
  try {
    for (const { at, entry } of entries) {
      const out = await build({
        entryPoints: [entry], bundle: true, format: "esm", write: false, outdir: dir, plugins: [plugin],
        loader: { ".css": "css" }, logLevel: "silent", target: "es2022",
      }).catch((err) => ({ err }));
      if (out.err) {
        failures.push(`${at} does not bundle: ${out.err.message.split("\n")[0]}`);
        continue;
      }
      const js = out.outputFiles.find((f) => f.path.endsWith(".js")).text;
      const css = out.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.setContent(`<!doctype html><style>${css}</style><main><h1>Fizlet docs</h1><p>Some text the bricks may read.</p><div id="game"></div></main>`);
      await page.evaluate(() => window.addEventListener("unhandledrejection", (ev) => { throw ev.reason; }));
      await page.addScriptTag({ content: js, type: "module" });
      await page.waitForTimeout(400); // a few frames of whatever the example started
      await page.evaluate(() => (globalThis.__engine?.() ?? null)?.destroy());
      await page.waitForTimeout(50);
      await page.close();
      if (errors.length) failures.push(`${at} threw: ${errors.join(" | ")}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`# doc examples: ${all.length} found, ${live.length} typechecked, ${run.length} run; site listings: ${LISTINGS.length} found, ${entries.length - run.length} run`);
  assert.deepEqual(failures, [], "examples that fail when run:\n" + failures.join("\n"));
});
