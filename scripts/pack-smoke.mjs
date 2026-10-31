// Pack smoke test: `npm pack` the package, install the tarball into an empty project, then import
// every subpath from package.json "exports" (Node ESM) and typecheck an import of each (.d.ts) under
// both NodeNext and Bundler resolution. Proves the files whitelist, the exports map (every build
// entry, the Board UI stylesheet and tokens), the types and the sideEffects flag ship together.
// Publishes nothing.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const fail = (msg) => {
  throw new Error(msg);
};

// The package.json fields, checked before packing: JS subpaths name their types first, next to the
// .js; the data files a page links are exported; only stylesheets have side effects on import; no
// runtime dependencies.
const target = (v) => (typeof v === "string" ? { default: v } : v);
for (const [k, v] of Object.entries(pkg.exports)) {
  const t = target(v);
  if (!t.default.endsWith(".js")) continue;
  if (Object.keys(t)[0] !== "types" || t.types !== t.default.replace(/\.js$/, ".d.ts")) fail(`package.json exports["${k}"]: "types" first, next to its .js (${JSON.stringify(t)})`);
}
for (const k of ["./ui/board-ui.css", "./ui/tokens.json", "./package.json"]) if (!pkg.exports[k]) fail(`package.json exports: ${k} is missing`);
if (JSON.stringify(pkg.sideEffects) !== JSON.stringify(["*.css"])) fail(`package.json sideEffects: expected ["*.css"], got ${JSON.stringify(pkg.sideEffects)}`);
if (Object.keys(pkg.dependencies ?? {}).length || Object.keys(pkg.peerDependencies ?? {}).length) fail("Fizlet ships no runtime dependencies");

const dir = mkdtempSync(join(tmpdir(), "fizlet-pack-"));
try {
  // Build first, then pack without lifecycle scripts so stdout is only the JSON report.
  run("npm", ["run", "build"]);
  // Every build entry (each .js in dist/ outside the shared chunks) is a subpath.
  const exported = new Set(Object.values(pkg.exports).map((v) => target(v).default));
  const entries = readdirSync("dist", { recursive: true }).map((f) => f.split("\\").join("/")).filter((f) => f.endsWith(".js") && !f.startsWith("chunks/"));
  const unexported = entries.filter((f) => !exported.has(`./dist/${f}`));
  if (unexported.length) fail(`built but not in package.json exports: ${unexported.join(", ")}`);

  const [{ filename, files }] = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", dir]));
  const paths = files.map((f) => f.path);
  const leaked = paths.filter((p) => !/^(dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/.test(p) || /\.map$/.test(p) || (/\.ts$/.test(p) && !p.endsWith(".d.ts")));
  if (leaked.length) fail(`files outside the whitelist: ${leaked.join(", ")}`);
  const required = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", ...Object.values(pkg.exports).flatMap((v) => Object.values(target(v))).map((p) => p.slice(2))];
  const missing = [...new Set(required)].filter((p) => !paths.includes(p));
  if (missing.length) fail(`the tarball is missing: ${missing.join(", ")}`);

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", join(dir, filename)], dir);

  const subpaths = Object.keys(pkg.exports).filter((k) => k !== "./package.json");
  // Data files (CSS, JSON tokens) only need to resolve; JS subpaths import and typecheck.
  const data = (k) => /\.(css|json)$/.test(k);
  const js = subpaths.filter((k) => !data(k)).map((k) => (k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`));
  const css = subpaths.filter(data).map((k) => `${pkg.name}/${k.slice(2)}`);

  // Runtime: every JS subpath imports in Node (no DOM) and exports something, and importing it adds
  // nothing to the global scope; data subpaths resolve to a file.
  const probe = `const out = [];
for (const s of ${JSON.stringify(js)}) {
  const before = new Set(Object.getOwnPropertyNames(globalThis));
  const m = await import(s);
  if (!Object.keys(m).length) throw new Error(s + " exports nothing");
  const added = Object.getOwnPropertyNames(globalThis).filter((k) => !before.has(k));
  if (added.length) throw new Error(s + " adds globals on import: " + added.join(", "));
  out.push(s + " (" + Object.keys(m).length + ")");
}
for (const s of ${JSON.stringify(css)}) { import.meta.resolve(s); out.push(s); }
console.log(out.join("\\n"));`;
  writeFileSync(join(dir, "probe.mjs"), probe);
  console.log(run("node", ["probe.mjs"], dir).trim());

  // sideEffects ["*.css"] lets a bundler drop an unused JS import whole. Prove that is safe: bundled
  // with annotations ignored, what is left of a bare import must not touch the page (only local
  // constants a minifier can't prove pure). And the stylesheet import must stay.
  const HOST = /\b(document|window|globalThis|self|navigator|location|localStorage|sessionStorage|customElements|addEventListener|requestAnimationFrame|setTimeout|setInterval|queueMicrotask|fetch|console|matchMedia|CSS)\b/;
  const bundle = (contents, more = {}) => build({ stdin: { contents, resolveDir: dir }, bundle: true, write: false, format: "esm", logLevel: "silent", ...more });
  for (const s of js) {
    const left = (await bundle(`import "${s}";`, { minify: true, ignoreAnnotations: true })).outputFiles[0].text;
    if (HOST.test(left)) fail(`${s}: importing it runs code that touches the page, so sideEffects must list it:\n${left.slice(0, 400)}`);
  }
  const kept = await bundle(`import "@fzlt/core/ui/board-ui.css";`, { outdir: join(dir, "out") });
  if (!kept.outputFiles.some((f) => f.path.endsWith(".css") && f.text.includes(".bui-"))) fail("a bundler dropped @fzlt/core/ui/board-ui.css: sideEffects must keep *.css");

  // Types: each JS subpath resolves to its .d.ts under the consumer's own settings, with Node
  // (NodeNext) and bundler (Bundler) resolution.
  writeFileSync(join(dir, "types.ts"), js.map((s, i) => `import * as m${i} from "${s}";\nvoid m${i};`).join("\n"));
  const options = { target: "ES2022", lib: ["ES2022", "DOM"], strict: true, noEmit: true };
  for (const [module, moduleResolution] of [["NodeNext", "NodeNext"], ["ESNext", "Bundler"]]) {
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { ...options, module, moduleResolution }, files: ["types.ts"] }));
    run(resolve("node_modules/.bin/tsc"), ["-p", "tsconfig.json"], dir);
  }
  console.log(`Pack smoke: ${filename}, ${files.length} files; ${js.length} JS subpaths import, touch nothing on import and typecheck (NodeNext, Bundler); ${css.length} data subpaths (CSS/JSON) resolve.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
