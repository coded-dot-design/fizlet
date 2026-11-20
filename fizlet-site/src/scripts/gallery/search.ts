// Gallery search: every word of the query must appear in an entry's title, prompt, theme, author or lane
// (any case, any order). Pure, so the unit tests and the page share it (browse.ts).
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
