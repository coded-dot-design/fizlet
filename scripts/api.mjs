// The public API of each module, read from the source of truth: the built declarations (dist/*.d.ts,
// which keep the source's doc comments) for the exports, and the source file's leading comment for
// the summary. The website's brick pages are generated from this (scripts/site.mjs), and
// tests/api.test.mjs checks it against the modules' real runtime exports.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The leading comment of a source file (a `/** *\/` block or `//` lines), as plain text. */
export function leadComment(src) {
  const text = readFileSync(src, "utf8");
  const block = text.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  let body = "";
  if (block) body = block[1].split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join("\n");
  else {
    const lines = [];
    for (const l of text.split("\n")) {
      if (!/^\s*\/\//.test(l)) break;
      lines.push(l.replace(/^\s*\/\/ ?/, ""));
    }
    body = lines.join("\n");
  }
  return body.replace(/\s+/g, " ").trim();
}

/** Text of a doc comment without its markers. */
const docText = (lines) => lines.join("\n").replace(/^\s*\/\*\*\s?/, "").replace(/\s*\*\/\s*$/, "").split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join(" ").replace(/\s+/g, " ").trim();

/** Split on commas at bracket depth 0. */
function topSplit(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if ("([{<".includes(ch)) depth++;
    else if (")]}>".includes(ch)) depth--;
    if (ch === "," && depth === 0) (out.push(cur), (cur = ""));
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const DECL = /^export (?:declare )?(?:abstract )?(const|let|function|class|interface|type|enum) (\w+)/;

/**
 * Every exported declaration reachable from a .d.ts entry, following `export *` and
 * `export { a } from` re-exports. → [{ name, names, kind, doc, code }], in file order.
 */
export function declarations(dts, only = null, seen = new Set()) {
  const key = dts + "|" + (only ? [...only].sort().join() : "*");
  if (seen.has(key)) return [];
  seen.add(key);
  const lines = readFileSync(dts, "utf8").split("\n");
  const out = [];
  let doc = [], inDoc = false, cur = null;
  const flush = () => {
    if (cur) {
      cur.code = cur.code.join("\n").replace(/\n+$/, "");
      if (!only || cur.names.some((n) => only.has(n))) out.push(cur);
    }
    cur = null;
  };
  const resolve = (spec) => {
    const base = join(dirname(dts), spec.replace(/\.js$/, ""));
    for (const f of [base + ".d.ts", join(base, "index.d.ts")]) if (existsSync(f)) return f;
    throw new Error(`${dts}: cannot resolve ${spec}`);
  };
  for (const line of lines) {
    if (inDoc) {
      doc.push(line);
      if (line.includes("*/")) inDoc = false;
      continue;
    }
    if (line.startsWith("/**")) {
      // A top-level doc comment: it belongs to the next statement.
      flush();
      doc = [line];
      inDoc = !line.includes("*/");
      continue;
    }
    if (/^\S/.test(line) && !/^[}\]);]/.test(line)) {
      // A new top-level statement.
      flush();
      const re = line.match(/^export (type )?(\*|\{([^}]*)\}) from ["']([^"']+)["'];/);
      if (re) {
        const names = re[3] ? new Set(re[3].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) : null;
        const sub = declarations(resolve(re[4]), names && only ? new Set([...names].filter((n) => only.has(n))) : names ?? only, seen);
        out.push(...sub);
        doc = [];
        continue;
      }
      const m = line.match(DECL);
      if (!m) {
        doc = [];
        continue;
      }
      const [, kind, name] = m;
      let names = [name];
      if (kind === "const" || kind === "let") {
        const rest = line.replace(/^export (?:declare )?(?:const|let) /, "").replace(/;\s*$/, "");
        names = topSplit(rest).map((p) => p.trim().match(/^(\w+)/)?.[1]).filter(Boolean);
      }
      const prev = out[out.length - 1];
      if (kind === "function" && prev && prev.kind === "function" && prev.name === name && !doc.length) {
        // An overload: same entry, one more signature.
        cur = prev;
        out.pop();
        cur.code = [cur.code, line];
      } else cur = { name, names, kind, doc: doc.length ? docText(doc) : "", code: [line] };
      doc = [];
      continue;
    }
    if (cur) {
      // Members of a class or interface: private ones are not API.
      if (/^\s+private /.test(line)) continue;
      cur.code.push(line);
    }
  }
  flush();
  return out;
}

/** The whole API of a module: its summary and its exports. */
export function api({ src, dts }) {
  const summary = leadComment(src).replace(/^(fizlet[\w/-]*|Board UI kit): /, "");
  return { summary: summary.charAt(0).toUpperCase() + summary.slice(1), decls: declarations(dts) };
}
