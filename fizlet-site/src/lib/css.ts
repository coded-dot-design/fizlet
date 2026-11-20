// A small CSS reader for the design system (the token lint, the state sheet, the design-system
// page): every style rule in a sheet as { selector, decls, at, line }. Comments are dropped,
// strings and url() are kept whole; @media/@supports/@keyframes… wrappers come back in `at`.
export interface Decl { prop: string; value: string; important: boolean; line: number }
export interface Rule { selector: string; decls: Decl[]; at: string[]; line: number }

/** Split on `sep` outside (), [] and strings. */
export function splitTop(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0, q: string | null = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === sep && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

export function rules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const out: Rule[] = [];
  let i = 0;
  const lineAt = (p: number) => src.slice(0, p).split("\n").length;
  const skip = (c: string, q: string | null): string | null => {
    if (q) { if (c === "\\") i++; else if (c === q) return null; return q; }
    return c === '"' || c === "'" ? c : null;
  };
  const prelude = () => {
    const start = i;
    let q: string | null = null;
    while (i < src.length) {
      const c = src[i];
      const was = q;
      q = skip(c, q);
      if (!was && !q && (c === "{" || c === "}" || c === ";")) break;
      i++;
    }
    return { text: src.slice(start, i).trim(), at: start };
  };
  const body = (): Decl[] => {
    const start = i;
    let depth = 0, q: string | null = null;
    while (i < src.length) {
      const c = src[i];
      const was = q;
      q = skip(c, q);
      if (!was && !q) { if (c === "(") depth++; else if (c === ")") depth--; else if (c === "}" && depth <= 0) break; }
      i++;
    }
    const text = src.slice(start, i);
    i++;
    const decls: Decl[] = [];
    let pos = 0;
    for (const part of splitTop(text, ";")) {
      const at = text.indexOf(part, pos);
      pos = at + part.length;
      const colon = part.indexOf(":");
      if (colon < 0 || !part.trim()) continue;
      const raw = part.slice(colon + 1).replace(/\s+/g, " ").trim();
      decls.push({ prop: part.slice(0, colon).trim().toLowerCase(), value: raw.replace(/\s*!important$/, ""), important: /!important$/.test(raw), line: lineAt(start + at + part.length - part.trimStart().length) });
    }
    return decls;
  };
  const walk = (at: string[]) => {
    while (i < src.length) {
      while (/\s/.test(src[i] ?? "")) i++;
      if (i >= src.length) return;
      if (src[i] === "}") { i++; return; }
      const pre = prelude();
      if (src[i] === ";") { i++; continue; }
      if (src[i] !== "{") return;
      i++;
      if (/^@(media|supports|container|layer|keyframes|-webkit-keyframes|document|scope|starting-style)\b/.test(pre.text)) walk([...at, pre.text.replace(/\s+/g, " ")]);
      else out.push({ selector: pre.text.replace(/\s+/g, " "), decls: body(), at, line: lineAt(pre.at) });
    }
  };
  walk([]);
  return out;
}

/** Interaction states a static page can show: the shared sheets' :hover, :focus-visible (and
 *  :focus) and :active rules again, each pseudo-class also matching inside a [data-ds-state] cell,
 *  so a specimen there renders exactly as the real rule paints it (same declarations, same
 *  specificity: :is([data-ds-state="hover"] *) weighs what :hover weighs). */
export const STATES = { hover: /:hover\b/g, "focus-visible": /:focus(-visible)?\b(?!-)/g, active: /:active\b/g } as const;
// Hover reaches every element under the pointer's cell (a real hover lifts its ancestors too);
// focus and press land only on what can take them.
const FOCUSABLE = ":where(a[href], button, summary, [tabindex])"; // :where adds no weight
export function stateSheet(css: string): string {
  const out: string[] = [];
  for (const r of rules(css)) {
    if (r.at.some((a) => /keyframes/.test(a)) || !/:(hover|focus|active)\b/.test(r.selector)) continue;
    let sel = r.selector;
    for (const [state, re] of Object.entries(STATES)) sel = sel.replace(re, `:is([data-ds-state="${state}"] ${state === "hover" ? "*" : FOCUSABLE})`);
    const body = r.decls.map((d) => `${d.prop}: ${d.value}${d.important ? " !important" : ""};`).join(" ");
    out.push(r.at.reduceRight((inner, a) => `${a} { ${inner} }`, `${sel} { ${body} }`));
  }
  return out.join("\n");
}
