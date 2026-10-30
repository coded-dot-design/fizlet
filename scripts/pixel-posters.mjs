// The hand-built pixel pieces' posters (site/gallery/pieces/*.ts that export `poster`): each runs its
// own scene headless to its poster moment and writes that frame, as an SVG of flat runs, between
// the <!-- poster --> markers of its stage (site/gallery/stages/<id>.html). The poster is the still
// frame under reduced motion and the placeholder while the scene loads; the stage is generated
// here, so never hand-edit what sits between the markers.
//   node scripts/pixel-posters.mjs           write them
//   node scripts/pixel-posters.mjs --check   fail if one is stale (tests run this)
import { build } from "esbuild";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "site/gallery";
const MARK = /<!-- poster -->[\s\S]*?<!-- \/poster -->/;

/** Each piece's stage file and its poster markup: [{ id, file, html, svg }]. */
export async function posters() {
  const out = [];
  for (const f of readdirSync(`${DIR}/pieces`).filter((f) => f.endsWith(".ts")).sort()) {
    const id = f.slice(0, -3), file = `${DIR}/stages/${id}.html`;
    if (!existsSync(file) || !/export function poster\b/.test(readFileSync(`${DIR}/pieces/${f}`, "utf8"))) continue;
    const r = await build({
      stdin: { contents: `export { poster, PALETTE } from "./pieces/${f}"; export { posterSVG } from "./pieces/pixel-stage.ts";`, resolveDir: DIR, loader: "ts" },
      bundle: true, format: "esm", write: false, logLevel: "silent",
    });
    const m = await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
    const cls = readFileSync(file, "utf8").match(/\.(\w+)-poster\s*\{/)?.[1];
    if (!cls) throw new Error(`${file}: no poster rule (e.g. .xx-poster { … }) in its style`);
    out.push({ id, file, html: readFileSync(file, "utf8"), svg: m.posterSVG(m.poster(), m.PALETTE, `${cls}-poster`) });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const p of await posters()) {
    if (!MARK.test(p.html)) throw new Error(`${p.file}: no <!-- poster --><!-- /poster --> markers`);
    const next = p.html.replace(MARK, `<!-- poster -->${p.svg}<!-- /poster -->`);
    if (next === p.html) continue;
    if (check) (stale++, console.error(`${p.file}: poster is stale (node scripts/pixel-posters.mjs)`));
    else (writeFileSync(p.file, next), console.log(`${p.file}: poster ${p.svg.length} B`));
  }
  if (stale) process.exit(1);
}
