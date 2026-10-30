// Hard shadows follow the domain, never the component (src/ui/BOARD-UI.md §4.1). A site sets
// `--shadow-x` / `--shadow-y` once at :root (unitless: direction per unit of depth; fizlet.com 0 1,
// DOM VIRUS 1 1); a component keeps only its depth: `calc(<depth> * var(--shadow-x, 0))
// calc(<depth> * var(--shadow-y, 1))`. The fallbacks are the kit's own (straight below).
//
// - `tokenShadows(css)`: rewrites a stylesheet's hard offset shadows (box-shadow, drop-shadow) and
//   the press travel that goes with them (an equal-axis translate in a rule that also sets a shadow)
//   onto the tokens. A shadow whose offset is not a depth along one direction (sideways only, up,
//   or unequal axes) can't be expressed: it is removed. Used by scripts/vendor-dom-virus.mjs, so a
//   piece from another domain takes this domain's angle.
// - `hardShadows(text)`: every hard-coded offset shadow left in a file (the check in tests/site.mjs
//   and tests/shadow-tokens.test.mjs). Zero offsets (rings, glows) and inset bevels are fine.

/** Split on top-level commas (not inside parentheses). */
const layers = (v) => {
  const out = [];
  let d = 0, s = "";
  for (const c of v) {
    if (c === "(") d++;
    else if (c === ")") d--;
    if (c === "," && !d) (out.push(s), (s = ""));
    else s += c;
  }
  return [...out, s];
};
/** The tokens of one shadow layer (top-level spaces; a function call is one token). */
const words = (v) => {
  const out = [];
  let d = 0, s = "";
  for (const c of v.trim()) {
    if (c === "(") d++;
    else if (c === ")") d--;
    if (/\s/.test(c) && !d) (s && out.push(s), (s = ""));
    else s += c;
  }
  return s ? [...out, s] : out;
};
const LENGTH = /^(-?(\d*\.)?\d+([a-z%]+)?|(max|min|clamp|calc)\(.*\))$/i;
const zero = (w) => /^-?0*\.?0+([a-z%]+)?$/i.test(w);
const neg = (w) => w.startsWith("-");
const token = (depth, axis) => `calc(${depth} * var(--shadow-${axis}, ${axis === "x" ? 0 : 1}))`;
const usesToken = (w) => /--shadow-[xy]\b/.test(w);

/**
 * One shadow layer on the tokens: the new layer, unchanged, or null when it can't be expressed.
 */
export function layerToToken(layer) {
  const w = words(layer);
  const i = w.findIndex((x) => LENGTH.test(x) || usesToken(x));
  if (i < 0 || w.includes("inset")) return layer;
  const [x, y] = [w[i], w[i + 1]];
  if (y === undefined || usesToken(x) || usesToken(y)) return layer;
  if (zero(x) && zero(y)) return layer;
  let depth;
  if (zero(x) && !neg(y)) depth = y;
  else if (x === y && !neg(x)) depth = x;
  else return null; // sideways, up, or unequal: not a depth in one direction
  w.splice(i, 2, token(depth, "x"), token(depth, "y"));
  return w.join(" ");
}

/** A stylesheet with every hard offset shadow (and its press travel) on the tokens. */
export function tokenShadows(css) {
  const shadow = (v) => {
    const kept = layers(v).map(layerToToken).filter((l) => l !== null);
    return kept.length ? kept.join(",").trim() : "none";
  };
  let out = css
    .replace(/(box-shadow\s*:\s*)([^;}]+?)(\s*(!important)?\s*[;}])/g, (_, a, v, z) => a + shadow(v) + z)
    .replace(/drop-shadow\(([^()]*(\([^()]*\)[^()]*)*)\)/g, (m, v) => {
      const t = layerToToken(v);
      return t === null ? "drop-shadow(0 0 0 transparent)" : `drop-shadow(${t})`;
    });
  // The press follows the shadow: translate(a, a) in a rule (or keyframe) that sets a shadow.
  out = out.replace(/\{[^{}]*\}/g, (block) =>
    /box-shadow/.test(block)
      ? block.replace(/translate\(\s*(-?)([\d.]+[a-z]+)\s*,\s*(-?)([\d.]+[a-z]+)\s*\)/g, (m, s1, a, s2, b) =>
          a === b && s1 === s2 && !zero(a) ? `translate(${token(s1 + a, "x")}, ${token(s1 + a, "y")})` : m)
      : block);
  return out;
}

/** Every hard-coded offset shadow in a file's text: [{ line, text }]. */
export function hardShadows(text) {
  const found = [];
  const lines = text.split("\n");
  lines.forEach((ln, n) => {
    for (const m of ln.matchAll(/box-shadow\s*:\s*([^;}"`]+)/g))
      for (const l of layers(m[1])) {
        const w = words(l);
        if (w.includes("inset")) continue;
        const i = w.findIndex((x) => LENGTH.test(x) || /^var\(/.test(x) || usesToken(x));
        if (i < 0 || w[i + 1] === undefined) continue;
        const [x, y] = [w[i], w[i + 1]];
        if (usesToken(x) && usesToken(y)) continue;
        if (zero(x) && zero(y)) continue;
        found.push({ line: n + 1, text: l.trim() });
      }
    for (const m of ln.matchAll(/drop-shadow\(([^()]*(\([^()]*\)[^()]*)*)\)/g)) {
      const w = words(m[1]);
      if (w[1] === undefined || (usesToken(w[0]) && usesToken(w[1])) || (zero(w[0]) && zero(w[1]))) continue;
      found.push({ line: n + 1, text: `drop-shadow(${m[1]})` });
    }
  });
  return found;
}
