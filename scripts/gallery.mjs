// The gallery's data and build. Data, one file each: entries (site/gallery/entries/<id>.json),
// themes (site/gallery/themes/<id>.json: adding a theme is a data file, never code) and
// contributors (site/contributors/<id>.json). The build writes site-dist/gallery/: the loader
// (fizlet/slot, armed on every figure), one bundle per entry (its live chunk, self-contained: the
// bytes on its size badge, measured here, on this build), the browse script (theme filter and
// search) and index.json, the generated index every page and the search read (never hand-written).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assignNumbers, duplicateMessage, duplicateNumbers } from "./gallery-number.mjs";

const DIR = "site/gallery";
export const KINDS = ["hero", "micro"];
/** Entries per gallery page: /gallery/ holds the newest PAGE_SIZE, /gallery/page/2/ the next. */
export const PAGE_SIZE = 24;
const NEED = ["id", "kind", "theme", "date", "prompt", "title", "author", "recipe", "bricks", "made", "module", "export"];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const readDir = (dir, what) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []).map((f) => {
  const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (`${d.id}.json` !== f || !ID.test(d.id)) throw new Error(`${what}/${f}: id is ${d.id}`);
  return d;
});

/** The themes, in their order. Each: { id, title, blurb, order }. */
export function themes(dir = `${DIR}/themes`, what = "gallery/themes") {
  const list = readDir(dir, what);
  for (const t of list) for (const k of ["title", "blurb", "order"]) if (t[k] === undefined) throw new Error(`gallery/themes/${t.id}.json: missing ${k}`);
  return list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** The contributors, by id. Each: { id, name, bio, url?, role? }. */
export function contributors(dir = "site/contributors") {
  const list = readDir(dir, "site/contributors");
  for (const c of list) for (const k of ["name", "bio"]) if (!c[k]) throw new Error(`site/contributors/${c.id}.json: missing ${k}`);
  for (const c of list) if (c.url && !/^https:\/\//.test(c.url)) throw new Error(`site/contributors/${c.id}.json: url must be https`);
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

/**
 * The owner's gate: an entry is live once it carries `approved: "<date>"` (the engine's
 * `fe anim approve <id>` stamps it). A new `fe anim` entry lands pending (no `approved`) and stays
 * off the site: no gallery card, index row, bundle, contest entry or people stat until approved.
 * `fe anim pull <id>` moves it to the archive instead.
 */
export const isLive = (e) => typeof e.approved === "string";

/** The entries, checked, newest first (then the highest number first). */
export function entries({ dir = `${DIR}/entries`, what = "gallery/entries", themeIds = themes().map((t) => t.id), people = contributors() } = {}) {
  const list = readDir(dir, what).map((e) => {
    const at = `${what}/${e.id}.json`;
    for (const k of NEED) if (e[k] === undefined) throw new Error(`${at}: missing ${k}`);
    if (!KINDS.includes(e.kind)) throw new Error(`${at}: kind is "hero" or "micro", not ${e.kind}`);
    if (!themeIds.includes(e.theme)) throw new Error(`${at}: theme ${e.theme} has no site/gallery/themes/${e.theme}.json`);
    if (!people[e.author]) throw new Error(`${at}: author ${e.author} has no site/contributors/${e.author}.json`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`${at}: date ${e.date}`);
    if (e.approved !== undefined && !(typeof e.approved === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.approved))) throw new Error(`${at}: approved is the date the owner approved it (YYYY-MM-DD), or unset while pending`);
    if (e.stage === "own") {
      const f = `${DIR}/stages/${e.id}.html`;
      if (!existsSync(f)) throw new Error(`${at}: stage "own" needs ${f}`);
      e.stageHtml = readFileSync(f, "utf8").trim();
    }
    return e;
  });
  // Numbers are given at land time (scripts/gallery-number.mjs): an archived entry has its own; a
  // gallery entry may have none yet. A live one without a number shows the one land will give it.
  for (const e of list) if (e.archived && !Number.isInteger(e.no)) throw new Error(`${what}/${e.id}.json: missing no`);
  for (const e of list) if (e.no !== undefined && !(Number.isInteger(e.no) && e.no > 0)) throw new Error(`${what}/${e.id}.json: no is a whole number from 1`);
  const dupes = duplicateNumbers(list);
  if (dupes.length) throw new Error(duplicateMessage(what, dupes));
  const given = assignNumbers(list);
  for (const e of list) if (given[e.id]) e.no = given[e.id];
  return list.sort((a, b) => b.date.localeCompare(a.date) || (b.no ?? 0) - (a.no ?? 0));
}

/** The site path of gallery page `n` (1-based): "gallery/", then "gallery/page/2/". */
export const galleryPath = (n) => (n === 1 ? "gallery/" : `gallery/page/${n}/`);
/** The profile path of a contributor. */
export const personPath = (id) => `people/${id}/`;

/** The entries (newest first) cut into pages of `size`: [{ n, path, entries }]; always one page. */
export function paginate(list, size = PAGE_SIZE) {
  const out = [];
  for (let i = 0; i === 0 || i < list.length; i += size) out.push({ n: out.length + 1, path: galleryPath(out.length + 1), entries: list.slice(i, i + size) });
  return out;
}

/** A page's entries in theme sections (theme order; newest first inside each), empty themes left out. */
export const sections = (list, themeList) => themeList.map((theme) => ({ theme, entries: list.filter((e) => e.theme === theme.id) })).filter((s) => s.entries.length);

/** The generated index: one row per entry, with its page, its author's name and its measured sizes. */
export function galleryIndex(list, { pages, people, themeList, loader }) {
  const page = Object.fromEntries(pages.flatMap((p) => p.entries.map((e) => [e.id, p.path])));
  const title = Object.fromEntries(themeList.map((t) => [t.id, t.title]));
  return list.map((e) => ({
    id: e.id, no: e.no, kind: e.kind, theme: e.theme, themeTitle: title[e.theme], title: e.title, prompt: e.prompt,
    author: e.author, authorName: people[e.author].name, date: e.date, demo: `gallery/${e.id}.js`, url: `${page[e.id]}#${e.id}`,
    sizes: { live: e.size, total: e.size + loader },
  }));
}

/**
 * The archive (site/gallery/archive/): earlier entries taken off the gallery, kept to revisit.
 * Its own entries and themes (the holiday themes live only here); every entry is `archived: true`,
 * its number is its own (shown as A004), and no id is shared with the gallery.
 */
export function archive({ themeList, people, live }) {
  const archiveThemes = themes(`${DIR}/archive/themes`, "gallery/archive/themes");
  const all = [...themeList, ...archiveThemes];
  const list = entries({ dir: `${DIR}/archive/entries`, what: "gallery/archive/entries", themeIds: all.map((t) => t.id), people });
  const ids = new Set(live.map((e) => e.id));
  for (const e of list) {
    if (e.archived !== true) throw new Error(`gallery/archive/entries/${e.id}.json: archived is true`);
    if (ids.has(e.id)) throw new Error(`gallery/archive/entries/${e.id}.json: the gallery has an entry with this id`);
  }
  return { entries: list, themes: all.sort((a, b) => a.order - b.order) };
}

export async function buildGallery(out) {
  mkdirSync(`${out}/gallery`, { recursive: true });
  const themeList = themes(), people = contributors();
  const checked = entries({ themeIds: themeList.map((t) => t.id), people });
  // Pending entries (not approved yet) are checked like the rest but never built or listed.
  const live = checked.filter(isLive), pending = checked.filter((e) => !isLive(e));
  const arch = archive({ themeList, people, live: checked });
  const list = [...live, ...arch.entries];
  const common = { bundle: true, minify: true, format: "esm", target: "es2022", legalComments: "none", logLevel: "warning", write: false };
  const gz = (r) => gzipSync(r.outputFiles[0].contents).length;
  const write = (r, file) => writeFileSync(file, r.outputFiles[0].contents);
  for (const e of list) {
    const r = await build({ ...common, stdin: { contents: `export { ${e.export} as mount } from ${JSON.stringify("./" + e.module)};`, resolveDir: DIR, loader: "ts" } });
    write(r, join(out, "gallery", `${e.id}.js`));
    e.size = gz(r);
  }
  const loader = await build({ ...common, entryPoints: [`${DIR}/gallery.ts`] });
  write(loader, join(out, "gallery", "gallery.js"));
  write(await build({ ...common, entryPoints: [`${DIR}/browse.ts`] }), join(out, "gallery", "browse.js"));
  const pages = paginate(live);
  const index = galleryIndex(live, { pages, people, themeList, loader: gz(loader) });
  writeFileSync(join(out, "gallery", "index.json"), JSON.stringify(index) + "\n");
  const archivePage = { n: 1, path: "gallery/archive/", entries: arch.entries };
  return { entries: live, pending: pending.map((e) => e.id), loader: gz(loader), themes: themeList, people, pages, index, archive: { ...arch, page: archivePage } };
}
