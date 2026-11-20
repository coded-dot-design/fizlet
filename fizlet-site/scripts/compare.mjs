// Pixel compare: the legacy site and this one, page by page, at 1440 and 390 wide, light and dark.
//   node scripts/compare.mjs <legacyUrl> <newUrl> <outDir> [--full] [path ...]
// Screenshots both, writes a diff image per shot and report.json, prints the % of pixels that differ
// (pixelmatch, threshold 0.1). Exits 1 when any shot is over the 3% target.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const full = args.includes("--full");
const [legacy, next, out, ...rest] = args.filter((a) => a !== "--full");
const PATHS = rest.length ? rest : ["", "docs/getting-started/", "bricks/kernel.html", "gallery/"];
const TARGET = 3;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function shoot(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(600);
  const buf = await page.screenshot({ fullPage: full });
  await page.close();
  return PNG.sync.read(buf);
}
const report = [];
for (const width of [1440, 390]) for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  for (const p of PATHS) {
    const a = await shoot(ctx, legacy + p), b = await shoot(ctx, next + p);
    const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
    const pad = (img) => { if (img.width === w && img.height === h) return img; const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
    const A = pad(a), B = pad(b), diff = new PNG({ width: w, height: h });
    const n = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1 });
    const pct = +(100 * n / (w * h)).toFixed(3);
    const name = `${(p.replace(/[/.]+/g, "_").replace(/_$/, "") || "home")}-${width}-${theme}`;
    writeFileSync(`${out}/${name}-legacy.png`, PNG.sync.write(A));
    writeFileSync(`${out}/${name}-new.png`, PNG.sync.write(B));
    writeFileSync(`${out}/${name}-diff.png`, PNG.sync.write(diff));
    report.push({ page: "/" + p, width, theme, full, heights: [a.height, b.height], diffPct: pct, pass: pct <= TARGET });
    console.log(`${pct <= TARGET ? "ok  " : "OVER"} ${String(pct).padStart(7)}%  /${p} ${width} ${theme}${full ? " full" : ""} (h ${a.height}/${b.height})`);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1) + "\n");
process.exit(report.every((r) => r.pass) ? 0 : 1);
