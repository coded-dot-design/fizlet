// The header nav (site/nav.ts, site/layout.mjs navTree) on the built site (run `npm run site` first).
// Desktop: each group is a click-to-open disclosure (aria-expanded, aria-controls), one open at a
// time; Enter and Space open it from the keyboard, Escape closes it and gives focus back, a click
// outside or Tab past it closes it; hover alone opens nothing. Phone (390): the nav sits behind the
// menu key; it opens a full-width panel, focus stays inside it (Tab and Shift+Tab wrap), every
// header link is in it with a 44 px target, Escape and a tap outside close it; opening it moves
// nothing on the page (no layout shift). /heroes/ redirects to Daily (/gallery/).
// SITE_NAV_SHOTS=<dir> saves the header, a menu, the phone menu, Daily and the contest page at 1440
// and 390, light and dark.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { NAV, ROOT as BASE } from "../site/layout.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/gallery/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let f = url.pathname.startsWith(BASE) ? join(ROOT, normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "")) : "";
  if (f && existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!f || !existsSync(f) || !statSync(f).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}${BASE}`;
const SHOTS = process.env.SITE_NAV_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Every header link, in order: [href from the root, label].
const LINKS = NAV.flatMap(([id, label]) => (typeof label === "string" ? [[id, label]] : label));
const GROUPS = NAV.filter(([, l]) => typeof l !== "string").map(([name]) => name);

const browser = await chromium.launch(launchOptions());
let where = "start";
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function open(opts, path = "", theme = "dark") {
  const ctx = await browser.newContext({ ...opts, reducedMotion: "reduce" });
  await ctx.addInitScript((t) => { try { localStorage.setItem("dom-virus:theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ORIGIN + path, { waitUntil: "load" });
  return { ctx, page, errors };
}
const expanded = (page) => page.$$eval(".nav-btn", (l) => l.filter((b) => b.getAttribute("aria-expanded") === "true").map((b) => b.textContent.trim()));
const menuShown = (page, name) => page.locator(".nav-btn", { hasText: name }).evaluate((b) => getComputedStyle(document.getElementById(b.getAttribute("aria-controls"))).display !== "none");
const active = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName);
/** Layout positions of the page under the header: they must not move when a menu opens. */
const layout = (page) => page.$$eval("main h1, main section, .site-head", (l) => l.map((e) => { const r = e.getBoundingClientRect(); return `${r.x},${r.y},${r.width},${r.height}`; }));

try {
  // ---------- Desktop: disclosure menus ----------
  where = "desktop menus";
  {
    const { ctx, page, errors } = await open(DESKTOP, "bricks/kernel.html");
    const btns = page.locator(".nav-btn");
    assert.deepEqual(await btns.allTextContents(), GROUPS, "a disclosure button per group");
    for (const name of GROUPS) {
      const b = page.locator(".nav-btn", { hasText: name });
      assert.equal(await b.getAttribute("aria-expanded"), "false", `${name}: closed`);
      const id = await b.getAttribute("aria-controls");
      assert.ok(id && (await page.locator(`#${id}`).count()) === 1, `${name}: aria-controls names its menu`);
      assert.equal(await menuShown(page, name), false, `${name}: its menu is hidden`);
    }
    assert.equal(await page.locator(".menu-key").isVisible(), false, "no menu key on a desktop");
    // Hover alone opens nothing.
    await btns.first().hover();
    assert.deepEqual(await expanded(page), [], "hover opens nothing");
    // Click opens; a second group's click closes the first; a click on it again closes it.
    const before = await layout(page);
    await page.locator(".nav-btn", { hasText: "Docs" }).click();
    assert.deepEqual(await expanded(page), ["Docs"]);
    assert.equal(await menuShown(page, "Docs"), true, "Docs: the menu shows");
    assert.deepEqual(await layout(page), before, "opening a menu moves nothing");
    // The API link marks the section you are in (a brick page).
    assert.equal(await page.locator('#nav-0 a[href$="bricks/"]').getAttribute("aria-current"), "true", "API: aria-current on a brick page");
    await page.locator(".nav-btn", { hasText: "Daily" }).click();
    assert.deepEqual(await expanded(page), ["Daily"], "one menu open at a time");
    await page.locator(".nav-btn", { hasText: "Daily" }).click();
    assert.deepEqual(await expanded(page), [], "a second click closes it");
    // Outside click closes.
    await page.locator(".nav-btn", { hasText: "Notes" }).click();
    await page.mouse.click(700, 600);
    assert.deepEqual(await expanded(page), [], "a click outside closes it");
    // Keyboard: Enter opens, Tab reaches its links, Escape closes and gives focus back.
    await page.locator(".nav-btn", { hasText: "Docs" }).focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await expanded(page), ["Docs"], "Enter opens");
    await page.keyboard.press("Tab");
    assert.equal(await active(page), "All docs", "Tab goes into the menu");
    await page.keyboard.press("Escape");
    assert.deepEqual(await expanded(page), [], "Escape closes");
    assert.equal(await active(page), "Docs", "Escape gives focus back to the button");
    await page.keyboard.press("Space");
    assert.deepEqual(await expanded(page), ["Docs"], "Space opens");
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    assert.equal(await active(page), "API", "the menu's last link");
    await page.keyboard.press("Tab");
    assert.deepEqual(await expanded(page), [], "Tab past the menu closes it");
    // Every link works: one opens its page.
    await page.locator(".nav-btn", { hasText: "Daily" }).click();
    await Promise.all([page.waitForURL(/\/contest\/$/), page.locator("#nav-2 a", { hasText: "Contest rules" }).click()]);
    assert.equal(await page.locator("#nav-2 a[aria-current=page]").textContent(), "Contest rules", "the contest page marks its link");
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- Phone: the menu key and its panel ----------
  where = "phone menu";
  {
    const { ctx, page, errors } = await open(PHONE, "gallery/");
    const key = page.locator(".menu-key");
    assert.ok(await key.isVisible(), "the menu key shows at 390");
    assert.equal(await key.getAttribute("aria-controls"), "site-nav");
    assert.equal(await page.locator(".site-nav").isVisible(), false, "the nav is folded away");
    const kb = await key.boundingBox();
    assert.ok(kb.width >= 44 && kb.height >= 44, `menu key is 44 px (${kb.width}×${kb.height})`);
    const before = await layout(page);
    await key.click();
    assert.equal(await key.getAttribute("aria-expanded"), "true");
    assert.ok(await page.locator(".site-nav").isVisible(), "the panel opens");
    assert.deepEqual(await layout(page), before, "opening the panel moves nothing");
    const panel = await page.locator(".site-nav").boundingBox();
    assert.ok(panel.x === 0 && panel.width === 390, `full width (${panel.x}, ${panel.width})`);
    assert.ok(panel.y + panel.height <= 844, "the panel fits the screen");
    // Every header link is in the panel, visible and at least 44 px tall, inside the screen.
    const links = await page.$$eval(".site-nav a", (l) => l.map((a) => { const r = a.getBoundingClientRect(); return { href: a.getAttribute("href"), text: a.textContent.trim(), w: r.width, h: r.height, x: r.x, right: r.right, vis: getComputedStyle(a).visibility }; }));
    assert.deepEqual(links.map((l) => [l.href.replace(/^\.\.\//, ""), l.text]), LINKS, "every header link is in the panel");
    for (const l of links) assert.ok(l.h >= 44 && l.x >= 0 && l.right <= 390 && l.vis === "visible", `${l.text}: a 44 px target on screen (${l.h})`);
    // Focus moves in and is trapped: Tab from the last link wraps to the key, Shift+Tab back.
    assert.equal(await active(page), LINKS[0][1], "focus goes to the first link");
    for (let i = 1; i < LINKS.length; i++) await page.keyboard.press("Tab");
    assert.equal(await active(page), LINKS.at(-1)[1], "Tab walks every link");
    await page.keyboard.press("Tab");
    assert.equal(await active(page), "Menu", "Tab from the last link wraps to the menu key");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await active(page), LINKS.at(-1)[1], "Shift+Tab from the key wraps to the last link");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await active(page), LINKS.at(-2)[1]);
    // Escape closes and gives focus back to the key.
    await page.keyboard.press("Escape");
    assert.equal(await key.getAttribute("aria-expanded"), "false", "Escape closes");
    assert.equal(await page.locator(".site-nav").isVisible(), false);
    assert.equal(await active(page), "Menu", "focus back on the key");
    // A tap outside closes it.
    await key.tap();
    assert.ok(await page.locator(".site-nav").isVisible());
    await page.touchscreen.tap(195, 800);
    assert.equal(await key.getAttribute("aria-expanded"), "false", "a tap outside closes");
    assert.equal(await page.locator(".site-nav").isVisible(), false);
    // A link in the panel opens its page.
    await key.tap();
    await Promise.all([page.waitForURL(/\/notes\/$/), page.locator(".site-nav a", { hasText: /^Notes$/ }).tap()]);
    assert.equal(await page.locator(".site-nav").isVisible(), false, "a new page starts closed");
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- /heroes/ redirects to Daily ----------
  where = "heroes redirect";
  {
    const { ctx, page } = await open(DESKTOP, "heroes/");
    await page.waitForURL(/\/gallery\/$/);
    assert.match(await page.locator("h1").textContent(), /^Daily\./, "lands on Daily");
    await ctx.close();
  }

  // ---------- Screenshots for review ----------
  if (SHOTS) {
    where = "shots";
    for (const theme of ["dark", "light"]) {
      for (const [w, opts] of [[1440, DESKTOP], [390, PHONE]]) {
        const shot = async (page, name, full = false) => page.screenshot({ path: `${SHOTS}/${name}-${w}-${theme}.png`, fullPage: full });
        const { ctx, page } = await open(opts, "", theme);
        await shot(page, "1-home-header");
        if (w === 1440) {
          await page.locator(".nav-btn", { hasText: "Docs" }).click();
          await shot(page, "2-menu-docs-open");
          await page.locator(".nav-btn", { hasText: "Daily" }).click();
          await shot(page, "2-menu-daily-open");
        } else {
          await page.locator(".menu-key").click();
          await shot(page, "3-mobile-menu-open");
        }
        await page.goto(ORIGIN + "gallery/");
        await shot(page, "4-daily-top");
        await page.goto(ORIGIN + "contest/");
        await shot(page, "5-contest-top");
        await page.locator("#ct-rules").evaluate((h) => h.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.evaluate(() => scrollBy(0, -90));
        await shot(page, "6-contest-rules");
        await ctx.close();
      }
    }
  }
  console.log(`site nav: menus, phone menu and the heroes redirect pass${SHOTS ? `; shots in ${SHOTS}` : ""}`);
} catch (e) {
  console.error(`site nav (${where}):`, e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
