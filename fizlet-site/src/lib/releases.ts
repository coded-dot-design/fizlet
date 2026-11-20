// Release notes (/news/): the legacy scripts/releases.mjs and site/pages/news.mjs, ported. A release
// is CHANGELOG.md's section for one version, as written (the export copies it; nothing is retyped).
import { esc, inline } from "./notes.ts";

const SITE = "https://fizlet.com/"; // lib/site.ts's SITE (see lib/notes.ts)
export const REPO = "https://github.com/coded-dot-design/fizlet";

export interface Release { version: string; date: string | null; md: string; order: number }
export type Item = { text: string; ul: Item[] | null };
export type Block = { p: string } | { h: string } | { ul: Item[] };

export const releasePath = (r: { version: string }) => `news/${r.version}/`;

/** The changelog's Markdown, as blocks: paragraphs, sub-headings and lists nested by indentation. */
export function parse(md: string): Block[] {
  const blocks: Block[] = [];
  let para: { p: string } | null = null;
  const stack: { indent: number; list: Item[] }[] = [];
  const flush = () => { para = null; stack.length = 0; };
  for (const raw of md.split("\n")) {
    if (!raw.trim()) { para = null; continue; }
    const h = raw.match(/^#{3,6} (.*)/);
    const li = raw.match(/^(\s*)- (.*)/);
    if (h) { flush(); blocks.push({ h: h[1].trim() }); continue; }
    if (li) {
      para = null;
      const indent = li[1].length;
      while (stack.length && stack.at(-1)!.indent > indent) stack.pop();
      if (!stack.length || stack.at(-1)!.indent < indent) {
        const list: Item[] = [];
        if (stack.length) stack.at(-1)!.list.at(-1)!.ul = list;
        else blocks.push({ ul: list });
        stack.push({ indent, list });
      }
      stack.at(-1)!.list.push({ text: li[2].trim(), ul: null });
      continue;
    }
    const indent = raw.match(/^\s*/)![0].length;
    if (stack.length && indent > 0) { stack.at(-1)!.list.at(-1)!.text += " " + raw.trim(); continue; }
    if (para) { (para as { p: string }).p += " " + raw.trim(); continue; }
    stack.length = 0;
    para = { p: raw.trim() };
    blocks.push(para);
  }
  return blocks;
}

/** Plain text of changelog Markdown (descriptions, JSON-LD). */
export const plain = (s: string) => s.replace(/\*\*|`/g, "").replace(/"/g, "'").replace(/[<>&]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

/** A release's headline items: each top-level item's bold lead, else its first sentence. */
export function highlights(blocks: Block[]): string[] {
  const items = blocks.flatMap((b) => ("ul" in b ? b.ul : []));
  const cut = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/[\s,;:(]+\S*$/, "") + "…");
  const seen = new Set<string>();
  return items.map((i) => {
    const bold = i.text.match(/^\*\*(.+?)\*\*/);
    return cut(plain(bold ? bold[1] : i.text.split(/(?<=\.)\s/)[0]).replace(/[.:]$/, ""), 64);
  }).filter((t) => !seen.has(t) && seen.add(t));
}

/** A search description for a release, 70–155 characters, from its highlights. */
export function releaseDescription(r: { version: string }, blocks: Block[]): string {
  const head = `Fizlet ${r.version} release notes: `;
  const tail = "Every change, with its measured numbers.";
  let text = head;
  for (const h of highlights(blocks)) {
    const add = (text === head ? "" : "; ") + h;
    if ((text + add).length > 152) {
      if (text === head) text += h.slice(0, 152 - text.length).replace(/\s+\S*$/, "") + "…";
      break;
    }
    text += add;
  }
  if (text === head) text += plain((blocks.find((b) => "p" in b) as { p: string } | undefined)?.p ?? "").slice(0, 100).replace(/\s+\S*$/, "");
  const sep = /…$/.test(text) ? " " : ". ";
  if ((text + sep + tail).length <= 155 && text.length < 110) text += sep + tail;
  else if (!/[.…]$/.test(text)) text += ".";
  return text;
}

/** Changelog Markdown → HTML: repo paths link to GitHub, bare URLs become links, and every link that
 *  leaves the site ends in ↗ (site nav rule 4). */
export const md = (s: string) => inline(s
  .replace(/\]\((?!https?:|\/|#|mailto:)([^)\s]+)\)/g, (_, p) => `](${REPO}/blob/main/${p.replace(/^\.\//, "")})`)
  .replace(/(^|\s|(?<!\])\()(https:\/\/[^\s)`,]+[^\s)`,.;:])/g, (_, pre, url) => `${pre}[${url}](${url})`))
  .replace(/(<a href="https?:[^"]*">)((?:(?!<\/a>).)*?)(?<!↗)<\/a>/g, "$1$2 ↗</a>");

/** A list as HTML (nested lists inside their item). */
export const listHtml = (items: Item[]): string =>
  `<ul class="ledger-rules note-list">${items.map((i) => `<li>${md(i.text)}${i.ul ? listHtml(i.ul) : ""}</li>`).join("")}</ul>`;

/** JSON-LD for a release: a TechArticle about that version of the engine. */
export function releaseLd(r: Release, description: string) {
  const url = SITE + releasePath(r);
  return [{ "@type": "TechArticle", "@id": `${url}#article`, headline: `Fizlet ${r.version} release notes`, description, url, mainEntityOfPage: url, inLanguage: "en",
    ...(r.date ? { datePublished: r.date, dateModified: r.date } : {}), author: { "@id": `${SITE}#author` }, publisher: { "@id": `${SITE}#org` }, isPartOf: { "@id": `${SITE}#website` },
    about: { "@type": "SoftwareSourceCode", name: "Fizlet", softwareVersion: r.version, codeRepository: REPO, isBasedOn: { "@id": `${SITE}#code` } } }];
}

export function releaseMeta(r: Release) {
  const description = releaseDescription(r, parse(r.md));
  return { path: releasePath(r), title: `Fizlet ${r.version} release notes · Fizlet`, description, ld: releaseLd(r, description) };
}

export const newsIndexMeta = (releases: Release[]) => ({
  path: "news/",
  title: "News: every Fizlet release, newest first · Fizlet",
  description: `Release notes for all ${releases.length} Fizlet versions, newest first, from the changelog: new bricks, fixes and the sizes measured when each shipped.`,
  ld: [] as unknown[],
});

export { esc };
