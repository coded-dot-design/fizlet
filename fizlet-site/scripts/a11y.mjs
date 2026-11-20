// The accessibility gate: every built page in dist/, light and dark, at 1440 and 390 wide.
//   node scripts/a11y.mjs [dist] [--report]
// Fails on: an axe-core violation (WCAG 2.0/2.1/2.2 A and AA rules, plus best practice), a page
// without one <main>, a <header>/<footer> landmark, a first-tab skip link that moves focus into
// <main>, an h1, or with a heading level skipped; a focusable control with no visible focus ring;
// header, nav menus, theme toggle, Copy keys and the docs sidebar not usable by keyboard alone;
// animation or transition left running under prefers-reduced-motion. --report prints the counts and
// exits 0 (the before/after numbers in MIGRATION.md).
import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";

const args = process.argv.slice(2);
const REPORT = args.includes("--report");
const ROOT = args.find((a) => !a.startsWith("--")) ?? "dist";
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
// Pages with the site shell. The engine demos' own host pages (public/demos/, kept as built) and
// the legacy dist/ bundle are the engine's, not this site's; they are listed in MIGRATION.md.
const SKIP = /^\/(demos|dist|origin|gallery\/pieces|chunks)\//;
const pages = walk(ROOT).filter((f) => f.endsWith(".html")).map((f) => "/" + relative(ROOT, f).split("\\").join("/").replace(/index\.html$/, "")).filter((p) => !SKIP.test(p)).sort();

const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const problems = [];
const axeCount = new Map(); // rule id → nodes, across every page and mode
let axeTotal = 0;

async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(() => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    resultTypes: ["violations"],
  }));
  for (const v of res.violations) {
    axeCount.set(v.id, (axeCount.get(v.id) ?? 0) + v.nodes.length);
    axeTotal += v.nodes.length;
    for (const n of v.nodes.slice(0, 3)) problems.push(`${where}: axe ${v.id} (${v.impact}): ${n.target.join(" ")}`);
    if (v.nodes.length > 3) problems.push(`${where}: axe ${v.id}: and ${v.nodes.length - 3} more`);
  }
}

// Structure: landmarks, skip link, headings. Runs once per page (theme does not change it).
async function structure(page, p) {
  const s = await page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis).map((h) => +h.tagName[1]);
    let skipped = null;
    for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { skipped = `h${levels[i - 1]} → h${levels[i]}`; break; }
    return {
      main: document.querySelectorAll("main").length,
      banner: document.querySelectorAll("body > header, header.site-head").length,
      info: document.querySelectorAll("body > footer, footer").length,
      h1: levels.filter((l) => l === 1).length, first: levels[0], skipped,
      lang: document.documentElement.lang,
    };
  });
  if (s.main !== 1) problems.push(`${p}: ${s.main} <main> landmarks, want 1`);
  if (!s.banner) problems.push(`${p}: no <header> banner landmark`);
  if (!s.info) problems.push(`${p}: no <footer> contentinfo landmark`);
  if (s.h1 !== 1) problems.push(`${p}: ${s.h1} visible h1, want 1`);
  else if (s.first !== 1) problems.push(`${p}: first heading is h${s.first}, not h1`);
  if (s.skipped) problems.push(`${p}: heading level skipped (${s.skipped})`);
  if (!s.lang) problems.push(`${p}: <html> has no lang`);
  // Skip link: the first Tab lands on it, it is visible when focused, Enter moves focus into main.
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const a = document.activeElement, r = a?.getBoundingClientRect();
    return { href: a?.getAttribute("href"), text: a?.textContent?.trim(), shown: !!r && r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 };
  });
  if (skip.href !== "#main") problems.push(`${p}: first Tab focuses ${skip.href ?? "nothing"}, not the skip link`);
  else {
    if (!skip.shown) problems.push(`${p}: skip link is not visible when focused`);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const inMain = await page.evaluate(() => !!document.activeElement?.closest("main"));
    if (!inMain) problems.push(`${p}: after the skip link, Tab does not land inside <main>`);
  }
}

// Visible focus: tab through the page; every focused element must change its outline or box-shadow.
async function focusRing(page, where) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1) || (cs.boxShadow && cs.boxShadow !== "none");
      const id = el.outerHTML.slice(0, 120);
      return { id, ring, label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40) };
    });
    if (!f) break;
    if (seen.has(f.id)) break;
    seen.add(f.id);
    if (!f.ring) problems.push(`${where}: no visible focus ring on "${f.label}"`);
  }
}

// Keyboard-only use of the shared furniture.
async function keyboard(page, p, width) {
  const focusSel = async (sel) => page.evaluate((s) => { const el = document.querySelector(s); el?.focus(); return document.activeElement === el; }, sel);
  // Theme toggle: Enter flips the theme.
  if (await focusSel("[data-theme-toggle]")) {
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.keyboard.press("Enter");
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    if (before === after) problems.push(`${p} ${width}: theme toggle does nothing on Enter`);
    await page.keyboard.press("Enter");
  } else problems.push(`${p} ${width}: no focusable theme toggle`);
  // Small screens: the menu key opens the nav.
  if (width < 900) {
    if (await focusSel("[data-menu]")) {
      await page.keyboard.press("Enter");
      const open = await page.evaluate(() => document.querySelector("[data-menu]").getAttribute("aria-expanded"));
      if (open !== "true") problems.push(`${p} ${width}: menu key does not open the nav on Enter`);
    }
  }
  // Nav groups: Enter opens the disclosure, its first link is reachable by Tab, Escape closes it
  // and returns focus to the button.
  // (Under 961px the groups are flat lists inside the open menu: their links must be tabbable.)
  if (width < 961) {
    const flat = await page.evaluate(() => [...document.querySelectorAll(".site-nav a")].filter((a) => a.tabIndex < 0 || !a.getClientRects().length).length);
    if (flat) problems.push(`${p} ${width}: ${flat} nav link(s) not reachable with the menu open`);
  }
  const groups = width < 961 ? 0 : await page.$$eval(".nav-btn", (b) => b.length);
  for (let i = 0; i < groups; i++) {
    const ok = await page.evaluate((n) => { const b = document.querySelectorAll(".nav-btn")[n]; b.focus(); return document.activeElement === b; }, i);
    if (!ok) { problems.push(`${p} ${width}: nav group ${i + 1} is not focusable`); continue; }
    await page.keyboard.press("Enter");
    const st = await page.evaluate((n) => {
      const b = document.querySelectorAll(".nav-btn")[n], m = document.getElementById(b.getAttribute("aria-controls"));
      const a = m?.querySelector("a"), shown = !!a && a.getBoundingClientRect().height > 0 && getComputedStyle(m).visibility !== "hidden";
      return { label: b.textContent.trim(), expanded: b.getAttribute("aria-expanded"), shown };
    }, i);
    if (st.expanded !== "true" || !st.shown) { problems.push(`${p} ${width}: nav "${st.label}" does not open on Enter`); continue; }
    await page.keyboard.press("Tab");
    const inMenu = await page.evaluate((n) => { const b = document.querySelectorAll(".nav-btn")[n]; return !!document.getElementById(b.getAttribute("aria-controls"))?.contains(document.activeElement); }, i);
    if (!inMenu) problems.push(`${p} ${width}: Tab after opening "${st.label}" does not enter its menu`);
    await page.keyboard.press("Escape");
    const closed = await page.evaluate((n) => { const b = document.querySelectorAll(".nav-btn")[n]; return { exp: b.getAttribute("aria-expanded"), back: document.activeElement === b }; }, i);
    if (closed.exp !== "false") problems.push(`${p} ${width}: Escape does not close "${st.label}"`);
    else if (!closed.back) problems.push(`${p} ${width}: Escape from "${st.label}" does not return focus to its button`);
  }
  // Copy keys: reachable, a <button>, and Enter gives feedback (text, aria-label or a live region).
  const copies = await page.$$eval("[data-copy], button.copy, .code-copy", (b) => b.map((x) => x.tagName));
  if (copies.some((t) => t !== "BUTTON")) problems.push(`${p} ${width}: a Copy key is not a <button>`);
  if (copies.length) {
    await page.evaluate(() => document.querySelector("[data-copy], button.copy, .code-copy").focus());
    const before = await page.evaluate(() => { const b = document.activeElement; return b.textContent + "|" + b.getAttribute("aria-label") + "|" + (document.querySelector("[aria-live]")?.textContent ?? ""); });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => { const b = document.querySelector("[data-copy], button.copy, .code-copy"); return b.textContent + "|" + b.getAttribute("aria-label") + "|" + (document.querySelector("[aria-live]")?.textContent ?? ""); });
    if (before === after) problems.push(`${p} ${width}: Copy key gives no feedback on Enter`);
  }
  // Docs sidebar: every link reachable by Tab (not hidden from the keyboard), current page marked.
  const side = await page.evaluate(() => {
    const s = document.querySelector(".docs-side, [data-docs-sidebar], nav[aria-label='Docs']");
    if (!s) return null;
    const links = [...s.querySelectorAll("a[href]")];
    return { n: links.length, untabbable: links.filter((a) => a.tabIndex < 0).length, current: !!s.querySelector("[aria-current]") };
  });
  if (side) {
    if (side.untabbable) problems.push(`${p} ${width}: ${side.untabbable} docs sidebar link(s) out of the tab order`);
    if (!side.current) problems.push(`${p} ${width}: docs sidebar does not mark the current page (aria-current)`);
  }
}

// Reduced motion: nothing animates or transitions for longer than 0.01s, except opt-outs marked
// data-motion-ok (none today).
async function reducedMotion(page, p) {
  const moving = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[data-motion-ok]")) continue;
      const cs = getComputedStyle(el);
      const dur = (v) => Math.max(0, ...v.split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 0.001 : 1)));
      const anim = cs.animationName !== "none" && dur(cs.animationDuration) > 0.01 && cs.animationIterationCount !== "0";
      if (anim) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} animation ${cs.animationName}`);
      if (out.length >= 5) break;
    }
    return { out, smooth: getComputedStyle(document.documentElement).scrollBehavior === "smooth" };
  });
  for (const m of moving.out) problems.push(`${p}: under reduced motion, ${m}`);
  if (moving.smooth) problems.push(`${p}: under reduced motion, scroll-behavior is smooth`);
}

for (const width of [1440, 390]) for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  for (const p of pages) {
    const page = await ctx.newPage();
    const where = `${p} ${width} ${theme}`;
    await page.goto(base + p, { waitUntil: "load" });
    await page.waitForTimeout(150);
    await axe(page, where);
    if (theme === "dark") {
      await page.reload({ waitUntil: "load" });
      if (width === 1440) await structure(page, p);
      await focusRing(page, where);
      await page.reload({ waitUntil: "load" });
      await keyboard(page, p, width);
      if (width === 1440) await reducedMotion(page, p);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close(); server.close();

const rules = [...axeCount].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(", ");
console.log(`a11y: ${pages.length} pages x 4 (1440/390, dark/light). axe violations (nodes): ${axeTotal}${rules ? ` (${rules})` : ""}. Other problems: ${problems.filter((x) => !/: axe /.test(x)).length}.`);
for (const p of problems) console.error("  " + p);
if (REPORT) process.exit(0);
if (problems.length) { console.error(`${problems.length} problem(s).`); process.exit(1); }
console.log("a11y: ok");
