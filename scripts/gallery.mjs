// Build the gallery's scripts into site-dist/gallery/: the loader (fizlet/slot, armed on every
// figure) and one bundle per entry (its live chunk, self-contained: the bytes on its size badge,
// measured here, on this build). Entries: site/gallery/entries/*.json, newest first.
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "site/gallery";
const NEED = ["no", "id", "date", "prompt", "title", "by", "recipe", "bricks", "made", "module", "export"];

/** The entries, checked, newest first (then the highest number first). */
export function entries() {
  const list = readdirSync(`${DIR}/entries`).filter((f) => f.endsWith(".json")).map((f) => {
    const e = JSON.parse(readFileSync(`${DIR}/entries/${f}`, "utf8"));
    for (const k of NEED) if (e[k] === undefined) throw new Error(`gallery/entries/${f}: missing ${k}`);
    if (`${e.id}.json` !== f) throw new Error(`gallery/entries/${f}: id is ${e.id}`);
    if (e.by !== "Chris Cooley") throw new Error(`gallery/entries/${f}: by Chris Cooley`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error(`gallery/entries/${f}: date ${e.date}`);
    return e;
  });
  const nos = new Set(list.map((e) => e.no));
  if (nos.size !== list.length) throw new Error("gallery: two entries share a number");
  return list.sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
}

export async function buildGallery(out) {
  mkdirSync(`${out}/gallery`, { recursive: true });
  const list = entries();
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
  return { entries: list, loader: gz(loader) };
}
