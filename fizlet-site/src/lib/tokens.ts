// Token values for display (the brand page's swatches), read from the one source, tokens.json.
import TOKENS from "../design/tokens.json";
const COLOR = TOKENS.color.selector as Record<string, Record<string, string>>;
const DARK = COLOR[".bui"], LIGHT = COLOR['.bui[data-theme="light"]'];
/** A colour token's value in a theme, `var(--x)` references followed to their hex. */
export function tokenHex(name: string, theme: "dark" | "light" = "dark"): string | undefined {
  const own = theme === "light" ? LIGHT[name] ?? DARK[name] : DARK[name];
  const ref = own?.match(/^var\((--[\w-]+)\)$/);
  return ref ? tokenHex(ref[1], theme) : own;
}
/** Does the light theme set its own value for this token? */
export const hasLight = (name: string) => name in LIGHT;
