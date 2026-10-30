// Release notes (/news/): one page per version, read from CHANGELOG.md (the only source; nothing is
// retyped). "## Unreleased" is left out. Dates come from site/releases.json (UTC, by version), which
// fizlet-engine's `land.py bump` fills in; a version without one is shown without a date.
import { readFileSync } from "node:fs";

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** [{ version, date, md }] newest first, as the changelog lists them. */
export function releases(changelog = readFileSync("CHANGELOG.md", "utf8"), dates = JSON.parse(readFileSync("site/releases.json", "utf8"))) {
  const out = [];
  for (const part of changelog.split(/^## /m).slice(1)) {
    const [head, ...rest] = part.split("\n");
    const version = head.trim();
    if (version === "Unreleased") continue;
    if (!VERSION.test(version)) throw new Error(`CHANGELOG.md: "## ${version}" is not a version`);
    const date = dates[version] ?? null;
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`site/releases.json: ${version} date ${date}`);
    out.push({ version, date, md: rest.join("\n").trim() });
  }
  return out;
}

/** Where a release's notes are built. */
export const releasePath = (r) => `news/${r.version}/`;

/**
 * The changelog's Markdown, as blocks: { p: text } paragraphs, { h: text } sub-headings and
 * { ul: [{ text, ul }] } lists nested by indentation (a wrapped line continues its item).
 */
export function parse(md) {
  const blocks = [];
  let para = null;
  const stack = []; // [{ indent, list }]
  const flush = () => { para = null; stack.length = 0; };
  for (const raw of md.split("\n")) {
    if (!raw.trim()) { para = null; continue; }
    const h = raw.match(/^#{3,6} (.*)/);
    const li = raw.match(/^(\s*)- (.*)/);
    if (h) { flush(); blocks.push({ h: h[1].trim() }); continue; }
    if (li) {
      para = null;
      const indent = li[1].length;
      while (stack.length && stack.at(-1).indent > indent) stack.pop();
      if (!stack.length || stack.at(-1).indent < indent) {
        const list = [];
        if (stack.length) stack.at(-1).list.at(-1).ul = list;
        else blocks.push({ ul: list });
        stack.push({ indent, list });
      }
      stack.at(-1).list.push({ text: li[2].trim(), ul: null });
      continue;
    }
    const indent = raw.match(/^\s*/)[0].length;
    if (stack.length && indent > 0) { stack.at(-1).list.at(-1).text += " " + raw.trim(); continue; }
    if (para) { para.p += " " + raw.trim(); continue; }
    stack.length = 0;
    para = { p: raw.trim() };
    blocks.push(para);
  }
  return blocks;
}

/** Plain text of changelog Markdown (descriptions, JSON-LD). */
export const plain = (s) => s.replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

/**
 * A release's headline items: each top-level item's bold lead ("**The fizz: …**" → "The fizz: …"),
 * else its first sentence; for the index cards and the description.
 */
export function highlights(blocks) {
  const items = blocks.filter((b) => b.ul).flatMap((b) => b.ul);
  const cut = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/[\s,;:(]+\S*$/, "") + "…");
  const seen = new Set();
  return items.map((i) => {
    const bold = i.text.match(/^\*\*(.+?)\*\*/);
    return cut(plain(bold ? bold[1] : i.text.split(/(?<=\.)\s/)[0]).replace(/[.:]$/, ""), 64);
  }).filter((t) => !seen.has(t) && seen.add(t));
}

/** A search description for a release, 70–155 characters, from its highlights. */
export function releaseDescription(r, blocks) {
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
  if (text === head) text += plain(blocks.find((b) => b.p)?.p ?? "").slice(0, 100).replace(/\s+\S*$/, "");
  const sep = /…$/.test(text) ? " " : ". ";
  if ((text + sep + tail).length <= 155 && text.length < 110) text += sep + tail;
  else if (!/[.…]$/.test(text)) text += ".";
  return text;
}
