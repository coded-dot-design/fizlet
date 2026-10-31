// tokens.json is the authoritative source of the Board UI tokens. board-ui.css keeps its literal
// variable block (the shipped CSS stays byte for byte what games already load); this check makes
// the build fail when that block, or applyPalette's variable map in board-ui.ts, drifts from it.
// Used by scripts/build.mjs and tests/tokens.test.mjs.
import { readFileSync } from "node:fs";

const UI = new URL("../src/ui/", import.meta.url);

export function readTokenSources() {
  return {
    tokens: JSON.parse(readFileSync(new URL("tokens.json", UI), "utf8")),
    css: readFileSync(new URL("board-ui.css", UI), "utf8"),
    ts: readFileSync(new URL("board-ui.ts", UI), "utf8"),
  };
}

/** The custom properties declared in the first rule whose selector is exactly `selector`. */
function block(css, selector) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = text.search(new RegExp(`(^|\\})\\s*${selector.replace(/[.[\]"=]/g, "\\$&")}\\s*\\{`));
  if (at < 0) return null;
  const open = text.indexOf("{", at + 1), body = text.slice(open + 1, text.indexOf("}", open + 1));
  const vars = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
  return vars;
}

/** "= sys" in tokens.json means "the same as the sys role": var(--k-sys) in CSS. */
const value = (v, roles) => (typeof v === "string" && v.startsWith("= ") ? `var(${roles[v.slice(2)]?.var})` : v);

/** Every disagreement between tokens.json, board-ui.css and board-ui.ts, as readable lines. */
export function checkTokens({ tokens, css, ts }) {
  const problems = [];
  const dark = block(css, ".bui"), light = block(css, '.bui[data-theme="light"]');
  if (!dark || !light) return ["board-ui.css: the .bui and .bui[data-theme=\"light\"] token blocks are missing"];
  const { roles, inks, surfaces, derived } = tokens.palette;
  const groups = { ...roles, ...inks, ...surfaces };
  // name -> { dark, light } expected from tokens.json (light falls back to dark: same in both themes).
  const want = new Map();
  for (const t of Object.values(groups)) want.set(t.var, { dark: value(t.dark, roles), light: value(t.light ?? t.dark, roles) });
  for (const [k, v] of Object.entries(derived)) if (k.startsWith("--")) want.set(k, { dark: v, light: v });
  want.set("--u", { dark: tokens.units.u.desktop, light: tokens.units.u.desktop });
  want.set("--bui-spring", { dark: tokens.motion.spring, light: tokens.motion.spring });
  want.set("--bui-out", { dark: tokens.motion.out, light: tokens.motion.out });
  for (const [k, v] of Object.entries(tokens.shadow.aliases)) want.set(k, { dark: v, light: v });

  for (const [name, w] of want) {
    const d = dark.get(name), l = light.get(name) ?? d;
    if (d !== w.dark) problems.push(`${name}: board-ui.css dark default is ${d ?? "missing"}, tokens.json says ${w.dark}`);
    if (l !== w.light) problems.push(`${name}: board-ui.css light value is ${l ?? "missing"}, tokens.json says ${w.light}`);
  }
  // Every control colour (--k-*) the CSS declares with a default must be a token.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/(--k-[\w-]+)\s*:/g))
    if (!want.has(m[1])) problems.push(`${m[1]}: declared in board-ui.css but not in tokens.json`);
  for (const m of text.matchAll(/var\((--k-[\w-]+)\s*,/g))
    if (!want.has(m[1])) problems.push(`${m[1]}: used with a fallback in board-ui.css but not in tokens.json`);

  // applyPalette's map (board-ui.ts VARS) names exactly the palette tokens, each to its variable.
  const map = ts.match(/const VARS[^{]*\{([\s\S]*?)\};/)?.[1];
  if (!map) return [...problems, "board-ui.ts: the VARS palette map is missing"];
  const vars = Object.fromEntries([...map.matchAll(/(\w+):\s*"(--[\w-]+)"/g)].map((m) => [m[1], m[2]]));
  for (const [key, t] of Object.entries(groups))
    if (vars[key] !== t.var) problems.push(`palette ${key}: board-ui.ts maps it to ${vars[key] ?? "nothing"}, tokens.json says ${t.var}`);
  for (const key of Object.keys(vars)) if (!groups[key]) problems.push(`palette ${key}: in board-ui.ts but not in tokens.json`);
  return problems;
}
