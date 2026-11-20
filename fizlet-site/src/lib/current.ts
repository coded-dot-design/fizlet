/** aria-current for a link to `href` from the page at `path` (both from the root, "/x/"): "page" on
 *  the page itself, "true" on a parent section. Anchors, other hosts and the home page never carry it. */
export function current(href: string, path: string): "page" | "true" | undefined {
  if (href.startsWith("#") || /^https?:/.test(href) || href === "/") return undefined;
  if (path === href) return "page";
  if (href.endsWith("/") && path.startsWith(href)) return "true";
  return undefined;
}
