// The docs (/docs/) and guides (/guides/): one JSON per page in site/docs/<section>/<slug>.json,
// written for fizlet.com (public docs; the source of truth for these pages). Blocks are the notes'
// closed set (text, stats, cta, features, faq) plus three docs-only ones: code (a snippet), sizes
// (every budgeted module, measured on this build) and contract (the nine rules, from the home page).
// A code block's listing is a file in site/docs/code/, typechecked by `npm run typecheck`. A recipe
// block runs site/recipes/<id>.js live on the page (with <id>.html), shows its measured size and its code.
// Numbers are never typed: `{size:<entry>}` (gzip bytes), `{kb:<entry>}`, `{budget:<entry>}` (the
// scripts/sizes.mjs entry) and `{version}` are filled in from the build, and an unknown one fails it.
import { readdirSync, readFileSync } from "node:fs";

const DIR = "site/docs";
export const SECTIONS = { docs: "Docs", guides: "Guides" };
const NEED = ["slug", "section", "order", "nav", "eyebrow", "title", "lead", "blocks", "seo"];
export const DOC_BLOCKS = ["text", "stats", "cta", "features", "faq", "code", "sizes", "contract", "recipe"];

/** A typechecked listing (site/docs/code/<file>), from its "// ---" line on. */
export function codeOf(file) {
  const text = readFileSync(`${DIR}/code/${file}`, "utf8"), at = text.indexOf("// ---\n");
  if (at < 0) throw new Error(`docs/code/${file}: no "// ---" line`);
  return text.slice(at + 7).trim();
}

/** Every page, checked, in reading order per section (docs first). */
export function docs() {
  const out = [];
  for (const section of Object.keys(SECTIONS)) {
    for (const f of readdirSync(`${DIR}/${section}`).filter((x) => x.endsWith(".json"))) {
      const d = JSON.parse(readFileSync(`${DIR}/${section}/${f}`, "utf8"));
      for (const k of NEED) if (d[k] === undefined) throw new Error(`docs/${section}/${f}: missing ${k}`);
      if (`${d.slug}.json` !== f || d.section !== section) throw new Error(`docs/${section}/${f}: slug ${d.slug}, section ${d.section}`);
      for (const b of d.blocks) {
        if (!DOC_BLOCKS.includes(b.type)) throw new Error(`docs/${section}/${f}: unknown block ${b.type}`);
        // A code block names its listing in site/docs/code/ (typechecked); the page shows it from "// ---" on.
        if (b.type === "code") b.code = codeOf(b.src);
      }
      out.push(d);
    }
  }
  const rank = Object.keys(SECTIONS);
  return out.sort((a, b) => rank.indexOf(a.section) - rank.indexOf(b.section) || a.order - b.order);
}

/** Where a page is built (its URL path under the site root). */
export const docPath = (d) => `${d.section}/${d.slug}/`;

/**
 * Fill the build's numbers into every string of a page: `{size:@fzlt/core (kernel)}` → "3,439 B",
 * `{kb:…}` → "3.4 KB", `{budget:…}` → "4,096 B", `{version}` → "0.19.0".
 */
export function fill(value, { sizes, version }) {
  const entry = (name) => {
    const s = sizes.find((x) => x.name === name);
    if (!s) throw new Error(`docs: no size entry "${name}" in scripts/sizes.mjs`);
    return s;
  };
  const one = (s) => s.replace(/\{(size|kb|budget|version)(?::([^}]+))?\}/g, (_, kind, name) =>
    kind === "version" ? version
      : kind === "size" ? `${entry(name).gzip.toLocaleString("en-US")} B`
        : kind === "kb" ? `${(entry(name).gzip / 1024).toFixed(1)} KB`
          : `${entry(name).budget.toLocaleString("en-US")} B`);
  const walk = (v) => (typeof v === "string" ? one(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
  return walk(value);
}
