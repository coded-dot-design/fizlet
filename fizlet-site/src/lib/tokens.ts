// The design tokens as data (src/design/tokens.json): each theme's resolved values, and the WCAG
// contrast between colours, computed here from the JSON (var() references and color-mix() in srgb
// resolved the way the browser does), never typed in by hand.
import TOKENS from "../design/tokens.json" with { type: "json" };

export type Theme = "dark" | "light";
export type Group = "color" | "type" | "space" | "radius" | "shadow" | "motion";
type Sheet = Record<string, { $description?: string; selector: Record<string, Record<string, string>> }>;
const T = TOKENS as unknown as Sheet;

/** The cascade tokens.css builds: :root, .bui, then the light overrides (html is :root and .bui). */
const SCOPES: Record<Theme, string[]> = {
  dark: [":root", ".bui"],
  light: [":root", ".bui", '.bui[data-theme="light"]', 'html.bui[data-theme="light"]'],
};

export interface Token { name: string; group: Group; raw: Record<Theme, string>; scope: string }
/** Every token once, in tokens.json order, with its raw value in each theme. */
export function tokens(): Token[] {
  const seen = new Map<string, Token>();
  for (const [group, { selector }] of Object.entries(T)) for (const [scope, vars] of Object.entries(selector)) for (const name of Object.keys(vars)) {
    if (!seen.has(name)) seen.set(name, { name, group: group as Group, raw: { dark: rawOf(name, "dark"), light: rawOf(name, "light") }, scope });
  }
  return [...seen.values()];
}
export const description = (g: Group) => T[g]?.$description ?? "";

function rawOf(name: string, theme: Theme): string {
  let v = "";
  for (const scope of SCOPES[theme]) for (const { selector } of Object.values(T)) if (selector[scope]?.[name] !== undefined) v = selector[scope][name];
  return v;
}

/** A token's value with every var() replaced (fallbacks honoured). */
export function resolve(value: string, theme: Theme, depth = 0): string {
  if (depth > 12) throw new Error(`token cycle at ${value}`);
  return value.replace(/var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, n: string, fb?: string) => {
    const raw = rawOf(n, theme);
    return resolve(raw || (fb ?? "").trim(), theme, depth + 1);
  });
}

export type RGBA = [number, number, number, number];
/** A resolved colour value (hex, transparent, color-mix in srgb) as 0-255 rgb + 0-1 alpha. */
export function rgba(value: string): RGBA | null {
  const v = value.trim();
  if (v === "transparent") return [0, 0, 0, 0];
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const mix = v.match(/^color-mix\(in srgb,\s*(.+)\)$/);
  if (mix) {
    const parts = splitArgs(mix[1]).map((p) => {
      const m = p.trim().match(/^(.*?)(?:\s+([\d.]+)%)?$/)!;
      return { c: rgba(m[1]), p: m[2] === undefined ? null : +m[2] / 100 };
    });
    if (parts.length !== 2 || !parts[0].c || !parts[1].c) return null;
    let [a, b] = parts;
    let pa = a.p ?? (b.p === null ? 0.5 : 1 - b.p), pb = b.p ?? 1 - pa;
    const sum = pa + pb, scale = sum < 1 ? sum : 1;
    pa /= sum; pb /= sum;
    // srgb mixing is premultiplied by alpha (CSS Color 5), and a total under 100% scales alpha.
    const A = a.c![3] * pa + b.c![3] * pb;
    const ch = (i: number) => (A === 0 ? 0 : (a.c![i] * a.c![3] * pa + b.c![i] * b.c![3] * pb) / A);
    return [ch(0), ch(1), ch(2), A * scale];
  }
  return null;
}
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let d = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") d++;
    else if (s[i] === ")") d--;
    else if (s[i] === "," && d === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}

/** A colour token in a theme, composited over that theme's --bg when it is translucent. */
export function colour(name: string, theme: Theme): RGBA | null {
  const c = rgba(resolve(`var(${name})`, theme));
  if (!c || c[3] === 1) return c;
  const bg = rgba(resolve("var(--bg)", theme))!;
  return [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3])).concat(1) as RGBA;
}
export const hex = (c: RGBA) => "#" + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");

/** WCAG 2 relative luminance and contrast ratio. */
export function luminance([r, g, b]: RGBA): number {
  const f = (n: number) => { const s = n / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: RGBA, b: RGBA): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** A cubic-bezier() token's four numbers (for drawing the curve). */
export function bezier(value: string): [number, number, number, number] | null {
  const m = value.match(/cubic-bezier\(([^)]+)\)/);
  return m ? (m[1].split(",").map(Number) as [number, number, number, number]) : null;
}
