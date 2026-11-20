// Notes and news, shared text helpers (the legacy site/pages/notes.mjs and site/size-badge.mjs,
// ported): inline Markdown, dates, the size badge and the notes' JSON-LD. Pure functions, so the
// pages, the tests and validate:content all run the same code.
// No imports (lib/site.ts reads JSON, which plain Node cannot import without attributes): the host is
// lib/site.ts's SITE, repeated.
const SITE = "https://fizlet.com/";

export const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "2026-11-20" → "20 November 2026". */
export const longDate = (d: string) => DATE.format(new Date(`${d}T00:00:00Z`));

/** Inline text: escaped, then `code`, **strong**, *em* and [label](href). Site paths stay root-absolute. */
export function inline(s: string): string {
  const code: string[] = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[+i]}</code>`);
}

/** A note as site/notes/<slug>.json holds it (the content model's export; never edited by hand). */
export type NoteItem = { title: string; body: string; link?: { href: string; label: string } };
export type NoteBody = { type: "p"; text: string } | { type: "h"; text: string } | { type: "ul"; items: string[] } | { type: "ol"; items: string[] };
export type NoteBlock =
  | { type: "text"; heading?: string; headingAccent?: string; body: NoteBody[] }
  | { type: "stats"; heading?: string; headingAccent?: string; items: { value: string; label: string }[] }
  | { type: "features"; heading?: string; headingAccent?: string; subhead?: string; items: NoteItem[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "cta"; links: { href: string; label: string }[] };
export interface Note {
  slug: string; type?: string; title: string; subtitle?: string; eyebrow?: string; tags: string[]; date: string;
  lead: string[]; blocks: NoteBlock[]; seo: { title: string; description: string };
}

/** Newest first, then by slug (the legacy order). */
export const byDate = (a: Note, b: Note) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);
export const notePath = (n: Note) => `notes/${n.slug}/`;
/** A note's eyebrow label, upper case. */
export const noteKind = (n: Note) => (n.eyebrow ?? n.type ?? "note").toUpperCase();

export const notesIndexMeta = (notes: Note[]) => ({
  path: "notes/",
  title: "Notes: what the games taught the engine · Fizlet",
  description: `Field notes from building on Fizlet's bricks, newest first: ports, lessons and the numbers behind them, each one measured (${notes.length} so far, by Chris Cooley).`,
  ld: [] as unknown[],
});

/** JSON-LD for a note: a BlogPosting by Chris Cooley, plus its questions as an FAQPage. */
export function noteLd(n: Note) {
  const url = `${SITE}notes/${n.slug}/`;
  const faq = n.blocks.flatMap((b) => (b.type === "faq" ? b.items : []));
  const plain = (s: string) => s.replace(/\*\*|`|\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return [
    { "@type": "BlogPosting", "@id": `${url}#post`, headline: n.title, alternativeHeadline: n.subtitle, description: n.seo.description, url, mainEntityOfPage: url,
      datePublished: n.date, dateModified: n.date, inLanguage: "en", keywords: n.tags.join(", "), author: { "@id": `${SITE}#author` }, publisher: { "@id": `${SITE}#org` }, isPartOf: { "@id": `${SITE}#website` } },
    ...(faq.length ? [{ "@type": "FAQPage", "@id": `${url}#faq`, mainEntity: faq.map((f) => ({ "@type": "Question", name: plain(f.q), acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) }] : []),
  ];
}

export const noteMeta = (n: Note) => ({ path: notePath(n), title: n.seo.title, description: n.seo.description, ld: noteLd(n) });
