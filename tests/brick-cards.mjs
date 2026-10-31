// The brick cards (site/cards/) in Chromium, on the built bricks page (run `npm run site` first):
// nothing loads until a card nears the viewport; a tap plays it (the engine wakes) and it settles to
// ASLEEP, 0 fps; the size it shows is the build's; destroy() gives the figure back byte for byte;
// under reduced motion no card loads and each keeps its still, labelled poster. SHOTS=<dir> also
// saves the bricks page and a brick page at 1440 and 390, light and dark.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import { launchOptions } from "./chromium.mjs";

import { CARD_IDS as IDS } from "../site/brick-cards.mjs";

const ROOT = "site-dist";
if (!existsSync(`${ROOT}/brick-cards.js`)) throw new Error("site-dist/brick-cards.js is missing: run `npm run site` first");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (f.endsWith("/")) f += "index.html";
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
}).listen(0);
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(launchOptions());
const cardChunk = new RegExp(`/chunks/(${IDS.join("|")})-[A-Z0-9]+\\.js$`);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function open(path, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const errors = [], loaded = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => cardChunk.test(r.url()) && loaded.push(r.url().match(cardChunk)[1]));
  // Each figure as the build wrote it, before any script runs (for the Recall check).
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    globalThis.before = Object.fromEntries([...document.querySelectorAll("figure[data-brick-card]")].map((f) => [f.dataset.brickCard, f.outerHTML]));
  }));
  await page.goto(URL0 + path);
  return { page, errors, loaded };
}
const fig = (page, id) => page.locator(`figure[data-brick-card="${id}"]`).first();
const read = (page, id) => fig(page, id).locator(".bc-read b").textContent();
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    if (await fn()) return;
    if (Date.now() > end) throw new Error(`timed out: ${what}`);
    await sleep(100);
  }
}

try {
  // ---------- Live: lazy, the build's size, play, settle, Recall ----------
  {
    const { page, errors, loaded } = await open("bricks/");
    await sleep(800);
    assert.ok(loaded.length < IDS.length, `cards far below the fold wait (${loaded.join(", ")} loaded at the top)`);
    const sizes = JSON.parse(await page.evaluate(() => JSON.stringify([...document.querySelectorAll("figure[data-brick-card]")].map((f) => [f.dataset.brickCard, Number(f.dataset.bytes)]))));
    const html = readFileSync(`${ROOT}/bricks/index.html`, "utf8");
    for (const [id, bytes] of sizes) assert.match(html, new RegExp(`data-size="[^"]*">${bytes.toLocaleString("en-US")} B|<b>${(bytes / 1024).toFixed(1)} KB</b>`), `${id}: the card's size is the build's`);
    const before = await page.evaluate(() => globalThis.before);
    for (const id of IDS) {
      const f = fig(page, id);
      await f.scrollIntoViewIfNeeded();
      await until(() => f.locator("canvas").count().then((n) => n >= 1), 4000, `${id} mounts near the viewport`);
      await f.click();
      await until(async () => /^AWAKE/.test(await read(page, id)), 2000, `${id} wakes on a tap`);
      await f.click({ position: { x: 40, y: 60 } });
      await until(async () => (await read(page, id)) === "ASLEEP · 0 FPS", 15000, `${id} settles`);
      await sleep(1100);
      assert.equal(await read(page, id), "ASLEEP · 0 FPS", `${id} stays asleep: no frames`);
      assert.notEqual(await f.locator(".bc-read span").textContent(), "", `${id} readout`);
    }
    assert.deepEqual([...new Set(loaded)].sort(), [...IDS].sort(), "each card loads its own chunk");
    // Off screen: wake one, scroll it away, the engine stops.
    const k = fig(page, "kernel");
    await k.scrollIntoViewIfNeeded();
    await k.click();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await until(async () => /0 FPS$/.test(await read(page, "kernel")), 3000, "kernel sleeps off screen");
    // Recall: every slot destroyed, every figure exactly as the build wrote it.
    await page.evaluate(() => globalThis.fizletBrickCards.forEach((s) => s.destroy()));
    for (const id of IDS) assert.equal(await fig(page, id).evaluate((el) => el.outerHTML), before[id], `${id}: Recall exact`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // ---------- A brick page: the card sits above the demo and plays from the first tap ----------
  {
    const { page, errors } = await open("bricks/fx.html");
    const f = fig(page, "fx");
    await f.click(); // before the scene is up: the slot hands the tap over
    await until(() => f.locator("canvas").count().then((n) => n >= 1), 4000, "fx mounts on the first tap");
    await until(async () => (await read(page, "fx")) === "ASLEEP · 0 FPS", 9000, "fx settles");
    assert.deepEqual(errors, []);
    await page.close();
  }
  // ---------- Reduced motion: still posters, labelled, nothing loads ----------
  {
    const { page, errors, loaded } = await open("bricks/", { reducedMotion: "reduce" });
    for (const id of IDS) {
      const f = fig(page, id);
      await f.scrollIntoViewIfNeeded();
      await f.click();
    }
    await sleep(600);
    assert.deepEqual(loaded, [], "no card loads under reduced motion");
    assert.equal(await page.locator("figure[data-brick-card] canvas").count(), 0);
    for (const id of IDS) {
      const f = fig(page, id);
      assert.equal(await f.getAttribute("role"), "img");
      assert.match(await f.getAttribute("aria-label"), /KB gzip: .+\. .+/, `${id} poster is labelled`);
      assert.ok(await f.locator(".bc-poster .bc-block").isVisible(), `${id} still poster`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  // ---------- Screenshots (SHOTS=<dir>): 1440 and 390, light and dark, after a tap ----------
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    for (const [w, h] of [[1440, 900], [390, 844]])
      for (const theme of ["dark", "light"]) {
        const { page } = await open("bricks/", { viewport: { width: w, height: h } });
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        for (const id of IDS) {
          const f = fig(page, id);
          await f.scrollIntoViewIfNeeded();
          await until(() => f.locator("canvas").count().then((n) => n >= 1), 4000, id);
          await f.click();
          await sleep(id === "steer" || id === "grid" ? 350 : 160);
        }
        await fig(page, "kernel").scrollIntoViewIfNeeded();
        // A full-page capture lies outside the viewport, where content-visibility skips the stages.
        await page.addStyleTag({ content: "[data-fizlet-slot]{content-visibility:visible!important}" });
        await sleep(200);
        await page.screenshot({ path: `${process.env.SHOTS}/bricks-${w}-${theme}.png`, fullPage: w === 390 ? false : true });
        await page.close();
        const one = await open("bricks/collide.html", { viewport: { width: w, height: h } });
        await one.page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        const c = fig(one.page, "collide");
        await c.scrollIntoViewIfNeeded();
        await until(() => c.locator("canvas").count().then((n) => n === 1), 4000, "collide");
        for (const x of [0.2, 0.5, 0.8]) await c.click({ position: { x: (await c.boundingBox()).width * x, y: 30 } });
        await sleep(300);
        await one.page.screenshot({ path: `${process.env.SHOTS}/collide-${w}-${theme}.png` });
        await one.page.close();
      }
  }
  console.log(`brick cards: ${IDS.length} cards lazy, play, settle, sleep off screen, Recall exact, reduced-motion posters`);
} finally {
  await browser.close();
  server.close();
}
