// The "tokens only, no one-off styles" rule, as code (tests/tokens.test.mjs and the design-system
// page both read it).
//
// Shared components are src/components/*.astro; their classes are read from the components
// themselves (class="…", class={…} string literals, the Key tones). A rule in the shared sheets
// belongs to the shared components when every class in its selector is a component class (or the
// Board UI root, .bui); a rule naming any other class or id belongs to a page.
//
// In a shared-component rule:
//  - colour: no literal colour (hex, rgb/hsl/hwb/lab/lch/oklab/oklch/color(), a named colour);
//    only tokens, currentColor, transparent, inherit and color-mix() of those.
//  - size, for the token groups (type: font-size, font, line-height; space: margin, padding,
//    gap, inset; radius: border-radius; shadow: box-shadow, text-shadow, filter drop-shadow): no
//    absolute length literal (px, rem, pt, cm, mm, in, pc, Q). Lengths come from a token: a
//    var(--…), or N × the unit, calc(N * var(--u)). Relative lengths (em, %, ch, lh, vw, …) are
//    the cascade, not one-offs, and are allowed.
//  - type: font-family only through var(--sans) / var(--mono) (or inherit).
//  - motion: no cubic-bezier() literal; curves are var(--bui-spring) / var(--bui-out) (steps() is
//    a frame count, not a curve, and the keywords ease/linear stay allowed).
//  The whole Board UI kit (board-ui.css) is shared; in site.css, the rules the owner test picks.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rules } from "../../src/lib/css.ts";

export const SHEETS = ["src/styles/board-ui.css", "src/styles/site.css", "src/styles/design-system.css"];
const ROOT_CLASSES = new Set(["bui"]); // the Board UI root; every bui-* class is the kit's own

export function componentClasses(dirs = ["src/components", "src/layouts"]) {
  const set = new Set();
  const add = (s) => s.split(/\s+/).filter((c) => /^[a-z][\w-]*$/i.test(c)).forEach((c) => set.add(c));
  for (const f of dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".astro")).map((f) => join(d, f)))) {
    const s = readFileSync(f, "utf8");
    for (const [, v] of s.matchAll(/class="([^"]*)"/g)) add(v);
    for (const [, expr] of s.matchAll(/class=\{([^}]*)\}/g)) for (const [, v] of expr.matchAll(/["'`]([^"'`$]*)["'`]/g)) add(v);
    for (const [, v] of s.matchAll(/cls\s*=\s*"([^"]*)"/g)) add(v); // defaulted class props
    for (const [, v] of s.matchAll(/\["([\w-]+)",/g)) add(v); // class arrays: ["bui-key", …]
  }
  const tones = readFileSync("src/lib/site.ts", "utf8").match(/export type Tone = ([^;]+);/)?.[1] ?? "";
  for (const [, t] of tones.matchAll(/"(\w+)"/g)) { set.add(`bui-${t}`); }
  return set;
}

const classesIn = (sel) => [...sel.replace(/\[[^\]]*\]/g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
const hasId = (sel) => /#[_a-zA-Z][\w-]*/.test(sel.replace(/\[[^\]]*\]/g, ""));

/** "shared" when every class in every selector of the list is a component (or root) class. */
export function owner(selector, comps) {
  if (/^(from|to|\d+%)/.test(selector)) return "keyframes";
  const foreign = new Set();
  for (const part of selector.split(",")) {
    if (hasId(part)) foreign.add(part.match(/#([\w-]+)/)[1]);
    for (const c of classesIn(part)) if (!comps.has(c) && !ROOT_CLASSES.has(c) && !c.startsWith("bui-")) foreign.add(c);
  }
  return foreign.size ? [...foreign] : "shared";
}

const NAMED = "aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen|canvas|canvastext";
const COLOUR = new RegExp(`#[0-9a-f]{3,8}\\b|\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|(^|[\\s,(])(${NAMED})(?=$|[\\s,)])`, "i");
const SIZE_PROPS = /^(font-size|font|line-height|margin(-.*)?|padding(-.*)?|gap|row-gap|column-gap|inset(-.*)?|border(-.*)?-radius|box-shadow|text-shadow|filter)$/;
const ABS = /(^|[^\w.-])-?(0*[1-9]\d*\.?\d*|0*\.\d*[1-9]\d*)(px|rem|pt|pc|cm|mm|in|q)\b/i; // zero is not a size
const STACK = /\b(ui-monospace|ui-sans-serif|ui-serif|monospace|sans-serif|serif|system-ui|cursive|fantasy|-apple-system)\b|["']/;
const NON_VISUAL = /^(content|grid-template-areas|grid-area|counter-.*|quotes|font-feature-settings|font-variation-settings|will-change|transition-property|animation-name)$/;

/** Strip var(--…) references (and their fallbacks) and quoted strings from a value. */
const bare = (v) => {
  let s = v.replace(/"[^"]*"|'[^']*'|url\([^)]*\)/g, "");
  for (let k = 0; k < 8 && /var\(/.test(s); k++) s = s.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, "");
  return s;
};

/** Every raw value in a declaration: [] when it reads only tokens. */
export function problems({ prop, value }) {
  if (prop.startsWith("--") || NON_VISUAL.test(prop)) return [];
  const v = bare(value), out = [];
  if (COLOUR.test(v)) out.push(`raw colour in ${prop}: ${value}`);
  if (SIZE_PROPS.test(prop) && ABS.test(v.replace(/\b(\d+\.?\d*)\s*\*\s*$/, ""))) out.push(`raw size in ${prop}: ${value}`);
  if (prop === "font-family" ? !/^(inherit|initial|unset)?$/.test(v.trim()) : prop === "font" && STACK.test(value.replace(/var\([^)]*\)/g, ""))) out.push(`raw font stack in ${prop}: ${value}`);
  if (/\bcubic-bezier\(/.test(v)) out.push(`raw curve in ${prop}: ${value}`);
  return out;
}

/** Every rule of the shared sheets with its owner and its raw values. */
export function lint(sheets = SHEETS) {
  const comps = componentClasses();
  const found = [];
  for (const f of sheets) {
    for (const r of rules(readFileSync(f, "utf8"))) {
      if (r.at.some((a) => /keyframes/.test(a))) continue;
      const who = /(board-ui|design-system)\.css$/.test(f) ? "shared" : owner(r.selector, comps);
      for (const d of r.decls) for (const p of problems(d)) found.push({ file: f, line: d.line, selector: r.selector, owner: who, problem: p });
    }
  }
  return found;
}

// Which wave group owns a page class (for the MIGRATION.md list): by prefix, then by the ported
// page whose data uses it.
const GROUPS = [
  ["W2-home", /^(home|hero|origin|page-toc|play|story|profile|contract|board|loop|recall|spec|size|ship|game|roadmap|start|final|phase|pipeline|ledger|raf|slots|sec-num|soon|stats?)(\b|-|s$)/],
  ["W2-bricks", /^(brick|bp-|bd-|bc|el-card|bgraph|status-|bricks)/],
  ["W2-docs", /^(doc-|recipe|guide)/],
  ["W2-gallery", /^(gal|gk-|sk-)/],
  ["W2-notes", /^(note|news|release)/],
  ["W2-daily", /^(ppl-|person|ct-|win-|make|contest)/],
  ["W2-misc", /^(brand|lost|demo|qs-|ogs-|legal|privacy|cookie|dl$)/],
];
export function group(cls) {
  return GROUPS.find(([, re]) => re.test(cls))?.[0] ?? "unassigned";
}
