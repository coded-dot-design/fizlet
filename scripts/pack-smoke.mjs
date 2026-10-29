// Pack smoke test: `npm pack` the package, install the tarball into an empty project, then import
// every subpath from package.json "exports" (Node ESM) and typecheck an import of each (.d.ts).
// Proves the files whitelist, the exports map and the types ship together. Publishes nothing.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const dir = mkdtempSync(join(tmpdir(), "fizlet-pack-"));
try {
  // Build first, then pack without lifecycle scripts so stdout is only the JSON report.
  run("npm", ["run", "build"]);
  const [{ filename, files }] = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", dir]));
  const leaked = files.map((f) => f.path).filter((p) => !/^(dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/.test(p));
  if (leaked.length) throw new Error(`files outside the whitelist: ${leaked.join(", ")}`);

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module" }));
  run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", join(dir, filename)], dir);

  const subpaths = Object.keys(pkg.exports).filter((k) => k !== "./package.json");
  // Data files (CSS, JSON tokens) only need to resolve; JS subpaths import and typecheck.
  const data = (k) => /\.(css|json)$/.test(k);
  const js = subpaths.filter((k) => !data(k)).map((k) => (k === "." ? pkg.name : `${pkg.name}/${k.slice(2)}`));
  const css = subpaths.filter(data).map((k) => `${pkg.name}/${k.slice(2)}`);

  // Runtime: every JS subpath imports and exports something; CSS subpaths resolve to a file.
  const probe = `const out = [];
for (const s of ${JSON.stringify(js)}) { const m = await import(s); if (!Object.keys(m).length) throw new Error(s + " exports nothing"); out.push(s + " (" + Object.keys(m).length + ")"); }
for (const s of ${JSON.stringify(css)}) { import.meta.resolve(s); out.push(s); }
console.log(out.join("\\n"));`;
  writeFileSync(join(dir, "probe.mjs"), probe);
  console.log(run("node", ["probe.mjs"], dir).trim());

  // Types: each JS subpath resolves to its .d.ts under the consumer's own settings.
  writeFileSync(join(dir, "types.ts"), js.map((s, i) => `import * as m${i} from "${s}";\nvoid m${i};`).join("\n"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022", "DOM"], strict: true, noEmit: true }, files: ["types.ts"] }));
  run(resolve("node_modules/.bin/tsc"), ["-p", "tsconfig.json"], dir);
  console.log(`Pack smoke: ${filename}, ${files.length} files, ${js.length} JS subpaths import and typecheck, ${css.length} data subpaths (CSS/JSON) resolve.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
