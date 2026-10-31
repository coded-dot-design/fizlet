// Minifier bake-off (dev only, no dependencies added): bundles every scripts/sizes.mjs entry with
// esbuild (unminified ESM, the same tree-shaking), minifies that bundle with each minifier it can find,
// and prints gzip (zlib default level, what sizes.mjs and `npm run size` count) and brotli (q11) bytes.
//
//   node scripts/size-bakeoff.mjs [--json out.json] [--only kernel,page] [--tools esbuild,terser,...]
//
// Tools are optional and never in package.json: install them anywhere and point MINIFY_TOOLS at that
// folder's node_modules parent (e.g. `npm i --prefix /tmp/mt terser oxc-minify @swc/core uglify-js
// google-closure-compiler` then MINIFY_TOOLS=/tmp/mt). Bun is used when `bun` is on PATH. A tool that
// isn't installed, or that throws on an entry, is skipped and shown as "-" (the reason is printed once).
import { build, transform } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { BUDGETS, ESBUILD_JS } from "./sizes.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const only = opt("--only")?.split(",");
const pick = opt("--tools")?.split(",");

const gz = (b) => gzipSync(b).length;
const br = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const reqs = [createRequire(resolve("package.json"))];
if (process.env.MINIFY_TOOLS) reqs.unshift(createRequire(resolve(process.env.MINIFY_TOOLS, "package.json")));
function load(name) {
  for (const r of reqs) { try { return r(name); } catch {} }
  return null;
}
const tmp = mkdtempSync(join(tmpdir(), "bakeoff-"));
const onPath = (bin) => { try { execFileSync(bin, ["--version"], { stdio: "ignore" }); return true; } catch { return false; } };

// Each tool: (code) => Promise<string>. Options are each tool's strongest *safe* settings for an ES
// module (top-level names are module-private, so renaming them is safe); `unsafe` rows are labelled.
const TOOLS = {
  // What ships today: esbuild bundling and minifying in one pass (sizes.mjs).
  "esbuild": null,
  // esbuild minifying the unminified bundle (the same input every other tool gets).
  "esbuild (2-step)": async (c) => (await transform(c, { minify: true, format: "esm", target: "es2022" })).code,
  "terser": (() => { const t = load("terser"); return t && (async (c) => (await t.minify(c, { module: true, ecma: 2022, compress: { passes: 3 }, mangle: true })).code); })(),
  "terser unsafe": (() => { const t = load("terser"); return t && (async (c) => (await t.minify(c, { module: true, ecma: 2022, compress: { passes: 3, unsafe: true, unsafe_arrows: true, unsafe_math: true, unsafe_methods: true, unsafe_comps: true, pure_getters: true }, mangle: true })).code); })(),
  "oxc-minify": (() => { const o = load("oxc-minify"); return o && (async (c) => { const r = await o.minify("x.mjs", c, { module: true, compress: { target: "es2022" }, mangle: { toplevel: true } }); if (r.errors?.length) throw new Error(r.errors[0].message); return r.code; }); })(),
  "swc": (() => { const s = load("@swc/core"); return s && (async (c) => (await s.minify(c, { module: true, ecma: 2022, compress: { passes: 3 }, mangle: { topLevel: true }, toplevel: true })).code); })(),
  "uglify-js": (() => { const u = load("uglify-js"); return u && (async (c) => { const r = u.minify(c, { module: true, compress: { passes: 3 }, mangle: true, toplevel: true }); if (r.error) throw r.error; return r.code; }); })(),
  "closure SIMPLE": closure("SIMPLE"),
  "closure ADVANCED (unsafe)": closure("ADVANCED"),
  "bun": onPath("bun") ? async (c) => { const f = join(tmp, "in.mjs"); writeFileSync(f, c); return execFileSync("bun", ["build", f, "--minify", "--format=esm", "--target=browser"], { maxBuffer: 1 << 26 }).toString(); } : null,
};
// Closure drops an ES module's exports (it keeps only what goog/@export names), so the bundle's final
// `export { a as foo }` becomes `globalThis["__fz"] = { "foo": a }`: quoted keys survive ADVANCED renaming,
// and the cost is about the same as esbuild's export clause. ADVANCED also renames every unquoted
// property (options objects, ledger records, DOM-facing names it has no externs for): sizes only.
function closure(level) {
  const g = load("google-closure-compiler");
  if (!g) return null;
  return async (c) => {
    const m = c.match(/export\s*\{([^}]*)\};?\s*$/);
    if (!m) throw new Error("no trailing export clause");
    const pairs = m[1].split(",").map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b = a] = s.split(/\s+as\s+/); return `${JSON.stringify(b)}: ${a}`; });
    const f = join(tmp, "in.js"), o = join(tmp, "out.js");
    writeFileSync(f, `${c.slice(0, m.index)}globalThis["__fz"] = { ${pairs.join(", ")} };\n`);
    rmSync(o, { force: true });
    await new Promise((res, rej) => new g.compiler({ js: f, js_output_file: o, compilation_level: level, language_in: "ECMASCRIPT_NEXT", language_out: "NO_TRANSPILE", assume_function_wrapper: true, warning_level: "QUIET", emit_use_strict: false }).run((code, _out, err) => (code ? rej(new Error(err.split("\n").filter((l) => /ERROR/.test(l))[0] ?? err.slice(0, 300))) : res())));
    const out = readFileSync(o, "utf8");
    if (!out.includes("__fz")) throw new Error("exports dropped");
    return out;
  };
}

const names = Object.keys(TOOLS).filter((t) => (!pick || pick.includes(t)) && TOOLS[t] !== undefined);
const missing = names.filter((t) => t !== "esbuild" && !TOOLS[t]);
if (missing.length) console.error(`skipped (not installed): ${missing.join(", ")}`);
const tools = names.filter((t) => t === "esbuild" || TOOLS[t]);
const failed = new Map();
const rows = [];
for (const [name, entry] of BUDGETS) {
  if (entry.endsWith(".css")) continue;
  if (only && !only.some((s) => name.includes(s))) continue;
  const raw = (await build({ entryPoints: [entry], bundle: true, write: false, logLevel: "silent", format: "esm", target: "es2022", legalComments: "none" })).outputFiles[0].text;
  const row = { name, cells: {} };
  for (const t of tools) {
    let code;
    try {
      code = t === "esbuild" ? (await build({ entryPoints: [entry], write: false, ...ESBUILD_JS })).outputFiles[0].contents : await TOOLS[t](raw);
    } catch (e) {
      if (!failed.has(t)) failed.set(t, `${name}: ${String(e.message ?? e).slice(0, 160)}`);
      row.cells[t] = null;
      continue;
    }
    const buf = Buffer.from(code);
    row.cells[t] = { min: buf.length, gzip: gz(buf), brotli: br(buf) };
  }
  rows.push(row);
  console.error(`measured ${name}`);
}
rmSync(tmp, { recursive: true, force: true });
for (const [t, why] of failed) console.error(`${t} failed on ${why}`);

const fmt = (n) => (n == null ? "-" : n.toLocaleString("en-US"));
const table = (key) => {
  const lines = [`| entry (${key}) | ${tools.join(" | ")} |`, `|---|${tools.map(() => "--:").join("|")}|`];
  const tot = Object.fromEntries(tools.map((t) => [t, 0]));
  for (const r of rows) {
    const base = r.cells.esbuild?.[key];
    const vals = tools.map((t) => r.cells[t]?.[key]);
    const best = Math.min(...vals.filter((v) => v != null));
    lines.push(`| ${r.name} | ${tools.map((t, i) => { const v = vals[i]; if (v == null) { tot[t] = NaN; return "-"; } tot[t] += v; const d = t === "esbuild" ? "" : ` (${v - base >= 0 ? "+" : ""}${v - base})`; return (v === best ? `**${fmt(v)}**` : fmt(v)) + d; }).join(" | ")} |`);
  }
  lines.push(`| **sum** | ${tools.map((t) => (Number.isNaN(tot[t]) ? "-" : fmt(tot[t]))).join(" | ")} |`);
  return lines.join("\n");
};
console.log(`${table("gzip")}\n\n${table("brotli")}`);
const json = opt("--json");
if (json) writeFileSync(json, JSON.stringify(rows, null, 2));
