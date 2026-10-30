// The posters of the hand-built gallery pieces that bring their own stage: each piece's still frame
// is the scene itself at `posterAt` seconds with no tap (run by hand on its engine: deterministic,
// the engine's random is seeded), saved as a small PNG into the poster <img data-poster> of its
// site/gallery/stages/<id>.html. So the poster, the reduced-motion still and the live scene are
// one drawing. Run after changing a piece's art: `node scripts/gallery-posters.mjs [id…]`.
import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { launchOptions } from "../tests/chromium.mjs";
import { entries } from "./gallery.mjs";

const DIR = "site/gallery";
const want = process.argv.slice(2);
const list = entries().filter((e) => e.stage === "own" && readFileSync(`${DIR}/${e.module}`, "utf8").includes("export const posterAt") && (!want.length || want.includes(e.id)));
const browser = await chromium.launch(launchOptions());
try {
  for (const e of list) {
    const js = (await build({
      stdin: { contents: `export { ${e.export} as mount, posterAt } from ${JSON.stringify("./" + e.module)};`, resolveDir: DIR, loader: "ts" },
      bundle: true, format: "iife", globalName: "piece", write: false, logLevel: "silent",
    })).outputFiles[0].text;
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><body style="margin:0"><div id="host" style="position:relative;width:640px;height:360px"></div><script>${js}</script></body>`);
    const png = await page.evaluate(() => {
      const host = document.getElementById("host");
      const scene = piece.mount(host, host, null);
      scene.engine.stop();
      scene.poster?.(); // a piece whose still is not its first seconds sets it up
      for (let i = 0, n = Math.round(piece.posterAt * 30); i < n; i++) scene.engine.advance(1 / 30);
      // Every layer the piece draws (under and over its real elements), in page order.
      const [c0, ...more] = host.querySelectorAll("canvas"), out = document.createElement("canvas");
      out.width = c0.width;
      out.height = c0.height;
      const g = out.getContext("2d");
      for (const c of [c0, ...more]) g.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    });
    await page.close();
    const f = `${DIR}/stages/${e.id}.html`, html = readFileSync(f, "utf8");
    const next = html.replace(/(<img[^>]*data-poster[^>]*src=")[^"]*(")/, `$1${png}$2`);
    if (next === html && !html.includes(png)) throw new Error(`${f}: no <img data-poster src="…"> to fill`);
    writeFileSync(f, next);
    console.log(`${e.id}: poster (${png.length} chars)`);
  }
} finally {
  await browser.close();
}
