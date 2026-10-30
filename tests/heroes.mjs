// Heroes (Playwright + Chromium), on the built site (site-dist/): /heroes/ shows exactly the games'
// own heroes in site/heroes/heroes.json (the allow-list) and no gallery entry; each one mounts in its
// card (its stage, in an iframe) and runs; nothing in a hero navigates (every link in every stage is
// clicked, on the page and on its own, and the URL never changes); Recall gives each hero back
// exactly as served; each comes to rest (no frames) with no input; the cartridge console says it is
// corrupted and boots nothing; reduced motion keeps the posters (no stage loads); the size badges
// are the stage scripts measured on this build.
// Run: npm run site && node tests/heroes.mjs. HEROES_SHOTS=<dir> saves 1440 and 390, light and dark.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";
import { heroes as heroList } from "../scripts/heroes.mjs";
import { entries } from "../scripts/gallery.mjs";
import { liveBytes } from "../scripts/live-bytes.mjs";
import { ROOT as BASE } from "../site/layout.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/heroes/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const HEROES = heroList();
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let f = url.pathname.startsWith(BASE) ? join(ROOT, normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "")) : "";
  if (f && existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!f || !existsSync(f)) return res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(launchOptions());
const shots = process.env.HEROES_SHOTS;
let where = "start";

/** A page that fails on any error, and on any request that leaves the test server (a hero must never reach out to navigate). */
async function open(ctx, path) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(`console: ${m.text()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()}: ${r.url()}`));
  page.on("framenavigated", (f) => f !== page.mainFrame() && f.url() !== "about:blank" && !f.url().includes("/stage.html") && errors.push(`a stage navigated: ${f.url()}`));
  await page.goto(ORIGIN + BASE + path, { waitUntil: "load" });
  return { page, errors };
}
/** Count requestAnimationFrame calls in every frame (a resting hero asks for none). */
const RAF = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = (cb) => (window.__raf++, raf(cb));
};

try {
  // ---------- The page: exactly the allow-list, in order, each with its game and its badge ----------
  where = "heroes page html";
  const html = readFileSync(`${ROOT}/heroes/index.html`, "utf8");
  assert.deepEqual([...html.matchAll(/<li class="hero-card panel" id="hero-([^"]+)"/g)].map((m) => m[1]), HEROES.map((h) => h.id), "/heroes/ shows exactly the heroes in site/heroes/heroes.json");
  for (const e of entries()) assert.ok(!html.includes(`data-hero="${e.id}"`), `gallery entry ${e.id} is not on /heroes/`);
  for (const h of HEROES) {
    const card = html.slice(html.indexOf(`id="hero-${h.id}"`)).split("</li>")[0];
    const bytes = liveBytes(`${ROOT}/heroes/${h.id}/stage.js`);
    assert.ok(card.includes(`data-bytes="${bytes}" data-live="heroes/${h.id}/stage.js"`), `${h.id}: its badge shows ${bytes} B, measured on this build`);
    assert.ok(card.includes(`href="${h.game}"`), `${h.id}: links to its game ${h.game}`);
    assert.match(card, /The game's own hero, (over|inside) the 9,728 B budget/, `${h.id}: says it is the game's own hero, against the budget`);
  }

  // ---------- Each hero on its own: it runs, links are inert, it rests, Recall is exact ----------
  for (const h of HEROES) {
    where = `${h.id} alone`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(RAF);
    const { page, errors } = await open(ctx, `heroes/${h.id}/stage.html?debug&rest=2`);
    await page.waitForFunction(() => window.heroStage, null, { timeout: 8000 });
    const served = await page.evaluate(async () => new DOMParser().parseFromString(await (await fetch(location.href)).text(), "text/html").querySelector("main").innerHTML);
    // It runs.
    if (h.id === "dom-battlefield") await page.waitForSelector("canvas.arena");
    if (h.id === "battlefield-blitz") await page.waitForFunction(() => (document.getElementById("bz-demo").shadowRoot ?? document.getElementById("bz-demo")).childElementCount > 0, null, { timeout: 8000 });
    if (h.id === "dom-virus") await page.waitForSelector(".hero-crossover[data-motion='true']");
    // Every link is dead: click each (as a visitor would), the URL stays.
    const url = page.url();
    const links = await page.locator("main a[href]").all();
    assert.ok(links.length > 0, `${h.id}: has links to check`);
    for (const a of links) {
      if (!(await a.isVisible())) continue;
      await a.click({ timeout: 2000, force: true, noWaitAfter: true });
      await page.waitForTimeout(60);
      assert.equal(page.url(), url, `${h.id}: a link navigated (${await a.getAttribute("href")})`);
    }
    // The cartridge joke: plug one in, the screen says it is corrupted, nothing boots.
    if (h.id === "dom-virus-cartridges") {
      await page.locator("a.cartridge").nth(1).click();
      await page.waitForSelector("[data-console][data-corrupt] .fz-corrupt", { timeout: 4000 });
      assert.match(await page.textContent(".fz-corrupt"), /CARTRIDGE CORRUPTED\..*DOM VIRUS/);
      await page.click("[data-pad='a']", { force: true });
      await page.waitForFunction(() => document.querySelector(".fz-corrupt b").textContent === "STILL CORRUPTED.", null, { timeout: 4000 });
      await page.locator("a.cartridge").nth(3).click();
      await page.waitForFunction(() => document.querySelector(".fz-corrupt small")?.textContent.startsWith("BYTE RUNNER"), null, { timeout: 4000 });
      assert.equal(page.url(), url, "the console boots nothing");
    } else await page.mouse.click(640, 400);
    // Rest: no input for a while and it comes to rest, then asks for no frames.
    await page.mouse.move(0, 0);
    if (h.id === "dom-battlefield") await page.evaluate(() => window.arena.rest());
    await page.waitForFunction(() => window.heroStage.resting, null, { timeout: 20000, polling: 250 });
    const before = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(1000);
    const frames = (await page.evaluate(() => window.__raf)) - before;
    assert.ok(frames <= 1, `${h.id}: at rest it asks for no frames (${frames} in 1 s)`);
    // Recall: the hero as served, exactly.
    await page.evaluate(() => window.heroStage.recall());
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.querySelector("main").innerHTML), served, `${h.id}: Recall gives the hero back exactly as served`);
    assert.deepEqual(errors, [], `${h.id}: no errors`);
    await ctx.close();
  }

  // ---------- On /heroes/: each card mounts its stage in the centre; links inside never move the page ----------
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    where = `heroes page, ${label}`;
    const ctx = await browser.newContext({ viewport });
    const { page, errors } = await open(ctx, "heroes/");
    const url = page.url();
    await page.$eval("[data-hero-track]", (t) => t.scrollIntoView({ block: "center" }));
    for (const [i, h] of HEROES.entries()) {
      if (i) await page.click("[data-hero-next]");
      await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] iframe[data-fizlet-slot]`) && !document.querySelector(`[data-hero="${id}"] iframe`).style.opacity, h.id, { timeout: 25000 });
      const playing = await page.$$eval("[data-hero] iframe", (l) => l.map((f) => f.closest("[data-hero]").dataset.hero));
      assert.deepEqual(playing, [h.id], `${label}: ${h.id} is the only stage mounted`);
      const frame = page.frame({ url: new RegExp(`/heroes/${h.id}/stage\\.html`) });
      await frame.waitForFunction(() => window.heroStage, null, { timeout: 8000 });
      if (label === "desktop") {
        for (const a of await frame.locator("main a[href]").all()) {
          if (!(await a.isVisible())) continue;
          await a.click({ timeout: 2000, force: true, noWaitAfter: true });
        }
        await page.waitForTimeout(150);
        assert.equal(page.url(), url, `${h.id}: a link in the hero moved the page`);
        assert.match(frame.url(), new RegExp(`/heroes/${h.id}/stage\\.html$`), `${h.id}: a link moved the stage`);
      }
    }
    assert.deepEqual(errors, [], `${label}: no errors`);
    await ctx.close();
  }

  // ---------- Screenshots (HEROES_SHOTS): each card centred and playing, 1440 and 390, dark and light ----------
  if (shots) {
    mkdirSync(shots, { recursive: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      where = `shots ${viewport.width}`;
      const ctx = await browser.newContext({ viewport });
      const { page } = await open(ctx, "heroes/");
      for (const theme of ["dark", "light"]) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${shots}/heroes-page-${viewport.width}-${theme}.png` });
      }
      for (const h of HEROES) {
        await page.$eval(`[data-hero="${h.id}"]`, (c) => c.scrollIntoView({ inline: "center", block: "start", behavior: "instant" }));
        await page.waitForFunction((id) => document.querySelector(`[data-hero="${id}"][data-playing] iframe`) && !document.querySelector(`[data-hero="${id}"] iframe`).style.opacity, h.id, { timeout: 25000 });
        for (const theme of ["dark", "light"]) {
          await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
          await page.waitForTimeout(1500);
          // The viewport, not the element: an element shot scrolls the snapping row to another card.
          await page.screenshot({ path: `${shots}/${h.id}-${viewport.width}-${theme}.png` });
        }
      }
      await ctx.close();
    }
  }

  // ---------- Reduced motion: posters only; no stage loads until Play ----------
  where = "reduced motion";
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const { page, errors } = await open(ctx, "heroes/");
    const stages = [];
    page.on("request", (r) => /\/stage\.html/.test(r.url()) && stages.push(r.url()));
    await page.$eval("[data-hero-track]", (t) => t.scrollIntoView({ block: "center" }));
    await page.waitForSelector("[data-hero][aria-current]");
    await page.waitForTimeout(800);
    assert.deepEqual(stages, [], "reduced motion: no stage loads");
    assert.equal(await page.isVisible(`[data-hero="${HEROES[0].id}"] img.hero-poster--dark`), true, "the poster shows");
    assert.equal(await page.locator("[data-hero] iframe").count(), 0);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log(`heroes: ${HEROES.length} heroes (${HEROES.map((h) => h.id).join(", ")}): the allow-list only, each mounts, links inert, rests, Recall exact, reduced motion posters`);
} catch (e) {
  console.error(`heroes test failed at: ${where}`);
  throw e;
} finally {
  await browser.close();
  server.close();
}
