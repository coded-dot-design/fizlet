// Build the FILET factory hero for /bricks/ (scripts/site.mjs calls this): the live chunk
// (factory.js: @fzlt/core/slot + the scene) into <out>/factory/, and the hero's HTML and CSS with every
// byte measured: live chunk, inline loader + controller, and the poster (inline HTML + CSS + script).
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { factoryHero } from "./hero.mjs";

const gz = (s) => gzipSync(s).length;

/** `{ html, css, sizes: { live, script, poster }, live }`; `base` is the page's path back to the root. */
export async function buildFactory({ out, base, bricks, sizes, version }) {
  mkdirSync(`${out}/factory`, { recursive: true });
  await build({
    entryPoints: { factory: "site/factory/entry.ts" }, outdir: `${out}/factory`, bundle: true, minify: true,
    format: "esm", target: "es2022", legalComments: "none", logLevel: "warning",
  });
  const live = gz(readFileSync(`${out}/factory/factory.js`));
  const hero = await factoryHero({ bricks, sizes, version, live: `${base}factory/factory.js`, liveBytes: live });
  const script = gz(hero.html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
  const result = { live, script, poster: gz(`<style>${hero.css}</style>${hero.html}`) };
  writeFileSync(`${out}/factory/sizes.json`, JSON.stringify(result));
  return { html: hero.html, css: hero.css, sizes: result, live: "factory/factory.js" };
}
