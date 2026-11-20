// Browse the built site like a visitor (the Astro page engine's browse gate, standalone): every
// built page at 1440 and 390 wide, in light and dark. Fails on a console error, a failed same-site
// request, a page wider than the screen, or an internal link that leads nowhere. A link to a
// legacy route not yet ported (src/data/legacy/routes.json, MIGRATION.md) is listed, not failed.
//   node scripts/browse.mjs dist
import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { serve } from "./serve.mjs";

const ROOT = process.argv[2] ?? "dist";
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pages = walk(ROOT).filter((f) => f.endsWith(".html")).map((f) => "/" + relative(ROOT, f).split("\\").join("/").replace(/index\.html$/, ""));
const legacy = new Set(JSON.parse(readFileSync("src/data/legacy/routes.json", "utf8")).map((r) => "/" + r.path));
const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [], pending = new Set();
const resolves = (path) => { const f = join(ROOT, path); return existsSync(f) && (!statSync(f).isDirectory() || existsSync(join(f, "index.html"))); };

for (const width of [1440, 390]) for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  for (const p of pages) {
    const page = await ctx.newPage();
    const where = `${p} ${width} ${theme}`;
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${where}: console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`${where}: error: ${e.message}`));
    page.on("requestfailed", (r) => { if (r.url().startsWith(base)) problems.push(`${where}: request failed: ${r.url()}`); });
    page.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`${where}: ${r.status()} ${r.url().slice(base.length)}`); });
    await page.goto(base + p, { waitUntil: "load" });
    await page.mouse.wheel(0, 4000); await page.waitForTimeout(300);
    const { over, links, theme: applied } = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - window.innerWidth,
      links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      theme: document.documentElement.dataset.theme,
    }));
    if (over > 1) problems.push(`${where}: ${over}px wider than the screen`);
    if (applied !== theme) problems.push(`${where}: theme is ${applied}, not ${theme}`);
    if (width === 1440 && theme === "dark") for (const href of links) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const path = href.split(/[?#]/)[0];
      if (resolves(path)) continue;
      if (legacy.has(path)) pending.add(path); else problems.push(`${p}: link to ${path} leads nowhere`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(`Browsed ${pages.length} pages x 4 (1440/390, dark/light). Links to legacy routes not yet ported: ${pending.size}.`);
for (const p of problems) console.error("  " + p);
if (problems.length) { console.error(`${problems.length} problem(s).`); process.exit(1); }
console.log("browse: ok");
