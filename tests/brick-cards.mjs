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
      await until(() => f.locator("canvas").count().then((n) => n === 1), 4000, `${id} mounts near the viewport`);
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
    await until(() => f.locator("canvas").count().then((n) => n === 1), 4000, "fx mounts on the first tap");
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
  // ---------- The card frame (site/pages/brick.mjs brickTile): one 3D object, status as a sticker ----------
  // No top bar and no stacked border; at rest the neutral card border, on hover and focus the
  // brick's colour; the status is a sticker, never in the name; the kernel is its own, wide card.
  {
    const frame = (card) => card.evaluate((li) => {
      const tok = (v) => { const p = document.createElement("i"); p.style.color = v; li.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
      const cs = getComputedStyle(li), bar = getComputedStyle(li, "::before");
      return {
        border: cs.borderTopColor, sides: new Set([cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor]).size,
        widths: new Set([cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]).size,
        bar: bar.content !== "none" && bar.content !== "normal", line: tok("var(--line)"), tone: tok("var(--tone)"),
        name: li.querySelector(".brick-name")?.textContent ?? "", sticker: li.querySelector(".brick-stickers > .brick-sticker[data-flag]")?.textContent ?? "",
        pill: li.querySelectorAll(".status-pill, .brick-top, .brick-tag").length, lift: cs.transform,
      };
    });
    for (const [path, reduce] of [["bricks/", false], ["", false], ["bricks/", true]]) {
      const { page, errors } = await open(path, reduce ? { reducedMotion: "reduce" } : {});
      await page.addStyleTag({ content: "[data-reveal]{opacity:1!important;transform:none!important}" });
      const cards = page.locator("ul.bricks:not(.planned) > li.brick");
      const n = await cards.count();
      assert.ok(n >= IDS.length, `${path || "home"}: brick cards (${n})`);
      for (let i = 0; i < n; i++) {
        const f = await frame(cards.nth(i));
        assert.equal(f.bar, false, `${path || "home"} card ${i}: no top bar`);
        assert.equal(f.sides, 1, `card ${i}: one border colour all round (no stacked border)`);
        assert.equal(f.widths, 1, `card ${i}: one border width all round`);
        assert.equal(f.border, f.line, `card ${i}: at rest, the neutral card border`);
        assert.equal(f.pill, 0, `card ${i}: no pill or top row`);
        assert.match(f.sticker, /^(COMPLETE|BETA|EXPERIMENTAL|DEPRECATED)$/, `card ${i}: the status is a sticker`);
        assert.ok(!f.name.includes(f.sticker), `card ${i}: the status is not in the name`);
      }
      // Hover and focus: the brick's colour on the border (and its shadow); reduced motion: no lift.
      for (const i of [0, 1, 2]) {
        const c = cards.nth(i);
        await c.scrollIntoViewIfNeeded();
        await c.hover({ position: { x: 8, y: 8 } });
        await sleep(250);
        let f = await frame(c);
        assert.equal(f.border, f.tone, `card ${i}: on hover, the brick's colour`);
        assert.equal(f.lift, reduce ? "none" : "matrix(1, 0, 0, 1, 0, -2)", `card ${i}: ${reduce ? "no movement under reduced motion" : "lifts on hover"}`);
        await page.mouse.move(0, 0);
        await c.locator(".brick-name a").focus();
        await sleep(250);
        f = await frame(c);
        assert.equal(f.border, f.tone, `card ${i}: on focus, the brick's colour`);
        await page.evaluate(() => document.activeElement.blur());
      }
      // The kernel: first, wide, a KERNEL sticker, its measured size against its budget.
      const k = cards.first();
      assert.match(await k.getAttribute("class"), /\bbrick-kernel\b/, "the first card is the kernel card");
      assert.equal(await page.locator("li.brick-kernel").count(), 1, "one kernel card");
      assert.equal(await k.locator(".brick-sticker-kernel").textContent(), "KERNEL");
      assert.match(await k.locator("[data-size]").textContent(), /^[\d,]+ B$/, "the kernel shows its measured bytes");
      assert.match(await k.textContent(), /of (a )?4,096 B/, "against its budget");
      assert.match(await k.getAttribute("class"), path ? /\bbrick-full\b/ : /\bbrick-compact\b/, path ? "full cards on the bricks index" : "compact cards on the home page");
      const [kw, rest] = await page.evaluate(() => { const l = document.querySelectorAll("ul.bricks:not(.planned) > li.brick"); return [l[0].offsetWidth, l[1].offsetWidth]; });
      assert.ok(kw > rest * 1.5, `the kernel card is wider than a brick (${kw} vs ${rest})`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  // ---------- Tokens only: the brick component's CSS block names no colour of its own ----------
  {
    const css = readFileSync("site/site.css", "utf8");
    const start = css.indexOf("/* ---------- Brick component (site/brick-ui.mjs)"), end = css.indexOf("/* 03 phases */", start);
    assert.ok(start > 0 && end > start, "the brick component's CSS block");
    assert.doesNotMatch(css.slice(start, end), /#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(/i, "brick component CSS: tokens only");
  }
  // ---------- Mini chips (docs recipes, roadmap needs): ≤ 28 px, neutral at rest, colour on focus ----------
  {
    for (const path of ["bricks/", "docs/authoring/"]) {
      const { page, errors } = await open(path);
      const minis = page.locator("a.brick-mini");
      const n = await minis.count();
      assert.ok(n > 0, `${path}: mini chips (${n})`);
      for (let i = 0; i < n; i++) {
        const m = minis.nth(i);
        const f = await m.evaluate((a) => {
          const tok = (v) => { const p = document.createElement("i"); p.style.color = v; a.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
          const cs = getComputedStyle(a), bar = getComputedStyle(a, "::before");
          return { h: a.getBoundingClientRect().height, bar: bar.content !== "none" && bar.content !== "normal", border: cs.borderTopColor, line: tok("var(--line)"), dot: !!a.querySelector(".brick-dot"), flag: a.querySelector(".brick-flag")?.dataset.flag, shadow: cs.boxShadow, kernel: a.classList.contains("brick-kernel") };
        });
        assert.ok(f.h <= 28, `${path} mini ${i}: ${f.h} px tall (≤ 28)`);
        assert.equal(f.bar, false, `mini ${i}: no top bar`);
        assert.equal(f.border, f.line, `mini ${i}: neutral at rest`);
        assert.ok(f.dot && f.flag, `mini ${i}: colour dot and status dot`);
        if (f.kernel) assert.equal(f.shadow.split("rgb").length - 1, 2, "the kernel mini: a double hard shadow");
        else assert.equal(f.shadow.split("rgb").length - 1, 1, `mini ${i}: one hard shadow`);
      }
      const m = minis.first();
      await m.focus();
      await sleep(250);
      assert.equal(...(await m.evaluate((a) => { const p = document.createElement("i"); p.style.color = "var(--tone)"; a.append(p); const c = getComputedStyle(p).color; p.remove(); return [getComputedStyle(a).borderTopColor, c]; })), "mini: the brick's colour on focus");
      if (path === "bricks/") assert.ok(await page.locator("a.brick-mini.brick-kernel").count() > 0, "a kernel mini on the roadmap's needs");
      assert.deepEqual(errors, []);
      await page.close();
    }
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
          await until(() => f.locator("canvas").count().then((n) => n === 1), 4000, id);
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
