// The design tokens: src/design/tokens.json is the one source; this writes src/styles/tokens.css
// from it (the stylesheets read only the CSS variables). `--check` fails when tokens.css is stale.
//
// tokens.json: { "<group>": { "$description", "selector": { "<css selector>": { "--name": "value" } } } }
// Groups: color (light + dark), type, space, radius, shadow, motion. A value may reference another
// token with var(); colors may be color-mix() of other tokens (derived, never passed in).
//
// One-time seed (the migration): `node scripts/tokens.mjs --from-legacy <board-ui.css> <site.css>`
// lifts the legacy token blocks into tokens.json.
import { readFileSync, writeFileSync } from "node:fs";

const JSON_PATH = "src/design/tokens.json";
const CSS_PATH = "src/styles/tokens.css";

const decls = (block) => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.replace(/\s+/g, " ").trim()]);
const blockOf = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no ${selector} block`);
  return css.slice(at, css.indexOf("\n}", at));
};

if (process.argv[2] === "--from-legacy") {
  const [bui, site] = process.argv.slice(3).map((f) => readFileSync(f, "utf8"));
  const GROUPS = {
    type: /^--(sans|mono|head-size)$/,
    space: /^--(u|page|gutter|block-gap|section-gap|head-gap|head-lead-gap)$/,
    shadow: /^--(shadow-[xy]|shadow-color|bui-s[xy]|bui-shadow|sticker-shadow|sticker-edge|base)$/,
    motion: /^--bui-(spring|out)$/,
  };
  const out = {
    color: { $description: "Surfaces, ink and the control palette (one colour per job). Dark is the default theme; light overrides.", selector: {} },
    type: { $description: "Font stacks and the head size (the type scale's top step).", selector: {} },
    space: { $description: "The unit (--u), the page container, gutters and the section rhythm.", selector: {} },
    radius: { $description: "Corner radii, by size in px.", selector: { ":root": Object.fromEntries([4, 5, 6, 8, 10, 12].map((n) => [`--r-${n}`, `${n}px`])) } },
    shadow: { $description: "The hard-shadow direction (straight below on fizlet.com) and the bases under keys, stickers and panels.", selector: {} },
    motion: { $description: "The two curves every key and card moves on.", selector: {} },
  };
  const add = (selector, pairs) => {
    for (const [k, v] of pairs) {
      const group = Object.entries(GROUPS).find(([, re]) => re.test(k))?.[0] ?? "color";
      ((out[group].selector[selector] ??= {}))[k] = v;
    }
  };
  add(".bui", decls(blockOf(bui, ".bui")));
  add('.bui[data-theme="light"]', decls(blockOf(bui, '.bui[data-theme="light"]')));
  add(":root", decls(blockOf(site, ":root")));
  add('html.bui[data-theme="light"]', decls(blockOf(site, 'html.bui[data-theme="light"]')));
  writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${JSON_PATH}`);
  process.exit(0);
}

const tokens = JSON.parse(readFileSync(JSON_PATH, "utf8"));
// Rules keep their cascade order: :root, .bui, then the light overrides (as the legacy sheets had them).
const ORDER = [":root", ".bui", '.bui[data-theme="light"]', 'html.bui[data-theme="light"]'];
const bySelector = new Map(ORDER.map((s) => [s, []]));
for (const [group, { selector }] of Object.entries(tokens)) {
  for (const [sel, vars] of Object.entries(selector)) {
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push(`  /* ${group} */`, ...Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`));
  }
}
const css = `/* Generated from src/design/tokens.json by scripts/tokens.mjs: edit the JSON, then npm run tokens. */\n` +
  [...bySelector].filter(([, lines]) => lines.length).map(([sel, lines]) => `${sel} {\n${lines.join("\n")}\n}`).join("\n") + "\n";
if (process.argv[2] === "--check") {
  if (readFileSync(CSS_PATH, "utf8") !== css) { console.error(`${CSS_PATH} is stale: run npm run tokens`); process.exit(1); }
  console.log(`${CSS_PATH} matches ${JSON_PATH}`);
} else {
  writeFileSync(CSS_PATH, css);
  console.log(`Wrote ${CSS_PATH}`);
}
