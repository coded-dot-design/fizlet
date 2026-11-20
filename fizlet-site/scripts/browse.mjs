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
// The gallery's runtime: the theme chips filter the flat list in place (and a second press, or a
// #theme- address, works as on the legacy site), and the search box finds pieces from the index.
const GALLERY = pages.filter((p) => /^\/gallery\/((page\/\d+|hifi)\/)?$/.test(p));
if (GALLERY.length) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  for (const p of GALLERY) {
    const page = await ctx.newPage();
    const check = (ok, what) => { if (!ok) problems.push(`${p} gallery: ${what}`); };
    await page.goto(base + p, { waitUntil: "load" });
    const shown = () => page.$$eval("[data-gal-flat] > li.gal-item", (li) => li.filter((x) => !x.hidden).map((x) => x.dataset.theme));
    const all = await shown();
    // A theme with cards on this page: one with fewer than all of them where there is one.
    const themes = [...new Set(all)];
    const theme = themes.find((t) => all.filter((x) => x === t).length < all.length) ?? themes[0];
    if (theme) {
      await page.click(`a[data-theme-chip="${theme}"]`);
      const only = await shown();
      check(only.length > 0 && only.every((t) => t === theme), `chip ${theme} shows ${only.length} cards, not only its own`);
      check(new URL(page.url()).hash === `#theme-${theme}`, `chip ${theme} did not set #theme-${theme}`);
      check(await page.getAttribute(`a[data-theme-chip="${theme}"]`, "aria-current") === "true", `chip ${theme} not current`);
      await page.click(`a[data-theme-chip="${theme}"]`);
      check((await shown()).length === all.length, `a second press on ${theme} did not show all`);
      await page.goto(`${base}${p}#theme-${theme}`, { waitUntil: "load" });
      await page.reload({ waitUntil: "load" });
      check((await shown()).every((t) => t === theme), `#theme-${theme} on arrival did not filter`);
    } else check(false, "no theme to filter on");
    // Search: visible once its script runs, hits from the index, a count, a link to each piece.
    check(await page.isVisible("form[data-gal-search]"), "search box hidden");
    const title = (await page.textContent("[data-gal-flat] > li.gal-item .gal-title")) ?? "";
    await page.fill("#gal-q", title.toUpperCase());
    await page.waitForFunction(() => document.querySelector("[data-gal-found]")?.textContent?.trim(), null, { timeout: 5000 }).catch(() => {});
    const hits = await page.$$eval("[data-gal-results] a", (a) => a.map((x) => x.textContent));
    check(hits.includes(title), `search for "${title}" did not find it (${hits.length} hits)`);
    check(/^\d+ match(es)?/.test((await page.textContent("[data-gal-found]")) ?? ""), "no match count");
    await page.fill("#gal-q", "");
    await page.waitForTimeout(100);
    check((await page.$$("[data-gal-results] li")).length === 0, "clearing the search left hits");
    await page.close();
  }
  await ctx.close();
  console.log(`Gallery runtime: theme chips and search checked on ${GALLERY.length} pages.`);
}
await browser.close(); server.close();
console.log(`Browsed ${pages.length} pages x 4 (1440/390, dark/light). Links to legacy routes not yet ported: ${pending.size}.`);
for (const p of problems) console.error("  " + p);
if (problems.length) { console.error(`${problems.length} problem(s).`); process.exit(1); }
console.log("browse: ok");
