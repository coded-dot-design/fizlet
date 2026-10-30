// The notes (/notes/): posts written for fizlet.com, one JSON per post in site/notes/<slug>.json,
// generated from the content model (never edited by hand). Blocks are a closed set: text (p, h, ul,
// ol), stats, cta, features, faq; inline text knows `code`, **strong**, *em* and [label](href).
import { readdirSync, readFileSync } from "node:fs";

const DIR = "site/notes";
const NEED = ["slug", "title", "date", "status", "lead", "blocks", "seo"];
const BLOCKS = ["text", "stats", "cta", "features", "faq"];

/** The published notes, checked, newest first. */
export function notes() {
  const list = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => {
    const n = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
    for (const k of NEED) if (n[k] === undefined) throw new Error(`notes/${f}: missing ${k}`);
    if (`${n.slug}.json` !== f) throw new Error(`notes/${f}: slug is ${n.slug}`);
    if (n.status !== "published" && n.status !== "scheduled") throw new Error(`notes/${f}: status ${n.status} is not live`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date)) throw new Error(`notes/${f}: date ${n.date}`);
    for (const b of n.blocks) if (!BLOCKS.includes(b.type)) throw new Error(`notes/${f}: unknown block ${b.type}`);
    return n;
  });
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

/** Where a note is built (its URL path under the site root). */
export const notePath = (n) => `notes/${n.slug}/`;
