// Gallery search: every word of the query must appear in an entry's title, prompt, theme, author or lane
// (any case, any order). Pure, so the unit tests and the search box share it (GallerySearch.astro).
// Ported from the legacy site/gallery/search.ts; the index rows are the legacy build's gallery/index.json.
export interface IndexRow {
  id: string;
  no: number;
  kind: string;
  /** "micro" or "hifi" (the Hi-Fi lane): "hifi" and "hi-fi" find it. */
  lane: string;
  theme: string;
  themeTitle: string;
  title: string;
  prompt: string;
  author: string;
  authorName: string;
  date: string;
  url: string;
  sizes: { live: number; total: number };
}

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** The rows that match `query`, in index order (newest first); an empty query matches none. */
export function search(rows: readonly IndexRow[], query: string): IndexRow[] {
  const words = fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return [];
  return rows.filter((r) => {
    const hay = fold(`${r.title} ${r.prompt} ${r.theme} ${r.themeTitle} ${r.author} ${r.authorName} ${r.kind}${r.lane === "hifi" ? " hifi hi-fi" : ""}`);
    return words.every((w) => hay.includes(w));
  });
}

/** A hit's line under its title: theme · author · kind · lane · its measured total. */
export const hitLine = (r: IndexRow) =>
  ` ${r.themeTitle} · by ${r.authorName} · ${r.kind}${r.lane === "hifi" ? " · Hi-Fi" : ""} · ${(r.sizes.total / 1024).toFixed(1)} KB gz`;

/** The status line: how many matched, and how many of them are shown. */
export const foundLine = (query: string, hits: number, max: number) =>
  query.trim() ? `${hits} ${hits === 1 ? "match" : "matches"}${hits > max ? `, the newest ${max} shown` : ""}` : "";

/** A gallery page's own type, for the view and the layout. */
export interface GalleryData {
  meta: import("./site").PageMeta;
  robots: string;
  styles: string[];
  crumbs?: { trail: { href: string; label: string }[]; current: string };
  head: { index: string; eyebrow: string; title: { line: string; accent: string }; lead: string; contestHtml: string };
  themes: { label: string; chips: Chip[] } | null;
  search: { label: string; placeholder: string } | null;
  items: Card[];
  sections: { id: string; title: string; blurb: string; items: Card[] }[];
  pages: { label: string; list: { n: string; href?: string; rel?: string; current?: boolean }[] } | null;
}
export interface Chip { href: string; label: string; count: string; theme?: string; lane?: string; id?: string; current: boolean }
export interface Card { id: string; cls: string; attrs: Record<string, string>; stage: string; index: string; line: string; title: string; level?: string; metaHtml: string }

/** A gallery page's head facts: the legacy browse bundle is replaced by GalleryThemes' and
 *  GallerySearch's own scripts, so it is not loaded; every other legacy script is (gallery.js mounts the pieces). */
export const galleryMeta = (g: GalleryData) => ({ ...g.meta, scripts: (g.meta.scripts ?? []).filter((s) => !s.endsWith("/gallery/browse.js")) });
