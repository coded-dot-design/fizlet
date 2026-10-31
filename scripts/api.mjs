// The public API of each module, read from the source of truth: the built declarations (dist/*.d.ts,
// which keep the source's doc comments) through the TypeScript compiler API (`typescript`, already
// the repo's type checker: no new dependency), and the source file's leading comment for the
// summary. The brick pages and llms-full.txt are generated from this at site build time
// (scripts/site.mjs), so they cannot drift from the code; tests/api.test.mjs checks it against the
// modules' real runtime exports and fails on an export without a doc comment.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { API, SignatureKind, SymbolFlags } from "typescript/unstable/sync";

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

// One compiler session for the whole run (a build or a test file): every declaration file in dist/
// opened in one snapshot, and any other file asked for (a test fixture) added to it. The compiler runs
// as a child process that never holds the event loop open and ends with this process (its pipe closes).
let session = null;
function project(file) {
  if (!session) {
    const files = readdirSync("dist", { recursive: true }).map(String).filter((f) => f.endsWith(".d.ts")).map((f) => resolve("dist", f));
    session = { api: new API({ cwd: process.cwd() }), open: new Set(), snap: null };
    session.snap = session.api.updateSnapshot({ openFiles: files });
    files.forEach((f) => session.open.add(f));
  }
  if (!session.open.has(file)) {
    session.snap = session.api.updateSnapshot({ openFiles: [file] });
    session.open.add(file);
  }
  const p = session.snap.getDefaultProjectForFile(file);
  if (!p) throw new Error(`scripts/api.mjs: the compiler opened no project for ${file}`);
  return { checker: p.checker, program: p.program };
}

const DECL = /^export (?:declare )?(?:abstract )?(const|let|function|class|interface|type|enum) (\w+)/;
const one = (s) => s.replace(/\s+/g, " ").trim();
/** A `/** *\/` comment's text, as `leadComment` reads it. */
const commentText = (c) => one(c.replace(/^\/\*\*/, "").replace(/\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\* ?/, "")).join("\n"));
/** The top-level statement a declaration belongs to (a `const`'s declarator → its statement). */
const statementOf = (node) => {
  let n = node;
  while (n.parent?.parent) n = n.parent;
  return n;
};
/** A declaration's code as published: its text, minus private class members (not API). */
const codeOf = (node) => node.getText().split("\n").filter((l) => !/^\s+private /.test(l)).join("\n").replace(/\n+$/, "");

/** `@param name text` tags → Map(name → text). */
const paramDocs = (tags) => new Map(tags.filter((t) => t.name === "param").map((t) => {
  const m = t.text.match(/^(\w+)\s*(?:-\s*)?([\s\S]*)$/);
  return m ? [m[1], m[2]] : [t.text, ""];
}));

/**
 * A call (or construct) signature: its parameters as declared (the type as written), its return type
 * and the one-line text. `alias` names an exported `type X = ReturnType<typeof f>`, which stands in
 * for an inline object return type.
 */
function signatureOf(checker, name, sig, docs, alias, ctor = "") {
  const params = sig.getParameters().map((ps) => {
    const node = ps.valueDeclaration?.resolve();
    const type = node?.type ? one(node.type.getText()) : checker.typeToString(checker.getTypeOfSymbol(ps));
    return { name: ps.name, type, optional: !!(node?.questionToken || node?.initializer), rest: !!node?.dotDotDotToken, doc: docs.get(ps.name) ?? "" };
  });
  const decl = sig.declaration?.resolve();
  const written = decl?.type?.getText();
  let returns = written && !written.includes("\n") ? one(written) : alias ?? one(written ?? checker.typeToString(checker.getReturnTypeOfSignature(sig)));
  if (returns.length > 120) returns = "{ … }";
  if (sig.isConstruct) returns = name + ctor;
  const tps = ctor || (decl?.typeParameters?.length ? `<${decl.typeParameters.map((t) => one(t.getText())).join(", ")}>` : "");
  const text = `${sig.isConstruct ? "new " : ""}${name}${tps}(${params.map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ")}): ${returns}`;
  return { text, params, returns };
}

/**
 * Every export of a .d.ts entry, the way the compiler sees it (re-exports followed to their
 * declarations), one entry per declaration statement: `const A = 1, B = 2` is one entry with two
 * names, overloads are one entry. In export order.
 * → [{ name, names, kind, doc, tags, code, sigs, type }]: `doc` is the doc comment ("" if none),
 * `tags` its other block tags ([{ name, text }]: @deprecated, @example…), `code` the declaration as
 * published, `sigs` a function's call signatures (a class's constructors), `type` a variable's type.
 * `lead`: the module's leading comment (plain text), which is never an export's doc.
 */
export function declarations(dts, { lead = "" } = {}) {
  const file = resolve(dts), { checker, program } = project(file);
  const sf = program.getSourceFile(file);
  if (!sf) throw new Error(`${dts}: not in the compiler's program (run npm run build)`);
  const mod = checker.getSymbolAtLocation(sf);
  const out = [], byStatement = new Map();
  for (const exp of mod ? checker.getExportsOfModule(mod) : []) {
    const sym = exp.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const stmts = [...new Set(sym.declarations.map((h) => h.resolve()).filter(Boolean).map(statementOf))];
    if (!stmts.length) continue;
    const key = `${stmts[0].getSourceFile().fileName}:${stmts[0].pos}`;
    if (byStatement.has(key)) {
      byStatement.get(key).names.push(exp.name); // another name of the same statement
      continue;
    }
    const code = stmts.map(codeOf).join("\n");
    const kind = code.match(DECL)?.[1];
    if (!kind) throw new Error(`${dts}: ${exp.name} is not a plain exported declaration: ${code.slice(0, 60)}`);
    // The compiler reads the last doc comment before a statement. When that is the module's leading
    // comment (its summary, kept at the top of some declaration files), the declaration has none of its own.
    const fileComment = !!lead && stmts[0].jsDoc?.length === 1 && stmts[0].jsDoc[0].pos === 0 && commentText(stmts[0].jsDoc[0].getText()) === lead;
    const tags = fileComment ? [] : checker.getJsDocTagsOfSymbol(sym).map((t) => ({ name: t.name, text: one(t.text ?? "") }));
    const doc = fileComment ? "" : one(checker.getDocumentationCommentOfSymbol(sym));
    const d = { name: exp.name, names: [exp.name], kind, doc, tags, code, sigs: [], type: null, sym };
    byStatement.set(key, d);
    out.push(d);
  }
  // Signatures once every export is known (to find the `ReturnType<typeof f>` aliases).
  const aliases = new Map(out.filter((d) => d.kind === "type").map((d) => [d.code.match(/=\s*ReturnType<typeof (\w+)>;?$/)?.[1], d.name]).filter(([f]) => f));
  for (const d of out) {
    const type = checker.getTypeOfSymbol(d.sym);
    const docs = paramDocs(d.tags);
    const node = d.sym.valueDeclaration?.resolve();
    if (d.kind === "class") {
      const tps = node?.typeParameters?.length ? `<${node.typeParameters.map((t) => one(t.getText())).join(", ")}>` : "";
      d.sigs = checker.getSignaturesOfType(type, SignatureKind.Construct).map((s) => signatureOf(checker, d.name, s, docs, null, tps));
    } else if (d.kind === "function" || ((d.kind === "const" || d.kind === "let") && d.names.length === 1))
      // A function, or a const holding one (`const board: (cols, rows) => Board`).
      d.sigs = checker.getSignaturesOfType(type, SignatureKind.Call).map((s) => signatureOf(checker, d.name, s, docs, aliases.get(d.name)));
    if ((d.kind === "const" || d.kind === "let") && d.names.length === 1 && !d.sigs.length)
      d.type = node?.type ? one(node.type.getText()) : node?.initializer ? one(node.initializer.getText()) : checker.typeToString(type);
    d.tags = d.tags.filter((t) => t.name !== "param");
    delete d.sym;
  }
  return out;
}

/** The whole API of a module: its summary and its exports. */
export function api({ src, dts }) {
  const lead = leadComment(src), summary = lead.replace(/^((?:fzlt|fizlet)[\w/-]*|Board UI kit): /, "");
  return { summary: summary.charAt(0).toUpperCase() + summary.slice(1), decls: declarations(dts, { lead }) };
}

/** Exports with no doc comment, as "module: names". Every public export must say what it is. */
export const undocumented = (mods) => mods.flatMap((m) => m.decls.filter((d) => !d.doc).map((d) => `${m.name}: ${d.names.join(", ")}`));
