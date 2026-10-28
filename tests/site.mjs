// Site test (Playwright + Chromium): serves site-dist/ at /fizlet/ (as GitHub Pages does) and checks
// every page at desktop and phone widths: no console errors, every internal link (and #anchor)
// resolves, no horizontal overflow at 360px, the live demo runs (blast, ledger, Recall, pause
// offscreen, reduced motion still frame), the quick start example works, and the hosted modules load.
// Run `npm run site` first. SITE_SHOTS=<dir> also saves screenshots.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = "site-dist", BASE = "/fizlet/";
if (!existsSync(`${ROOT}/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".ts": "text/plain" };

// A tiny static server shaped like Pages: /fizlet/<path>, dir → index.html, else 404.html with 404.
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = null;
  if (url.pathname.startsWith(BASE)) {
    let p = normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, "");
    let f = join(ROOT, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (existsSync(f) && statSync(f).isFile()) file = f;
  }
  if (!file) {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    return res.end(readFileSync(`${ROOT}/404.html`));
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
const status = async (path) => (await fetch(ORIGIN + path)).status;

const PAGES = ["", "examples/quick-start.html", "404.html"];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const shots = process.env.SITE_SHOTS;
let where = "start";

async function open(context, path) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404 (Not Found)") && errors.push(`console: ${m.text()}`));
  page.on("requestfailed", (r) => r.url().startsWith(ORIGIN) && errors.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => r.url().startsWith(ORIGIN) && r.status() >= 400 && !r.url().endsWith("/missing/page") && errors.push(`${r.status()}: ${r.url()}`));
  await page.goto(ORIGIN + BASE + path, { waitUntil: "load" });
  return { page, errors };
}

try {
  // ---------- Every page, desktop and phone: errors, links, overflow ----------
  const checked = new Set();
  for (const [label, viewport] of [["desktop", { width: 1280, height: 860 }], ["phone", { width: 360, height: 740 }]]) {
    const context = await browser.newContext({ viewport });
    for (const path of PAGES) {
      where = `${label} ${path || "index"}`;
      const { page, errors } = await open(context, path);
      await page.waitForTimeout(300);
      // Overflow: let the body show it (the site hides stray overflow-x), then compare widths. Also
      // catch content cut off by a clipping section (overflow: hidden): only a real scroll
      // container (a code block, a table) may hold something wider than the screen.
      const over = await page.evaluate(() => {
        document.body.style.overflowX = "visible";
        const w = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= w + 1) return false;
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return false;
          return true;
        }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${el.className} → ${Math.round(el.getBoundingClientRect().right)}`);
        return { scroll: document.documentElement.scrollWidth, w, wide };
      });
      assert.ok(over.scroll <= over.w, `${where}: horizontal overflow ${over.scroll} > ${over.w}: ${over.wide.join(", ")}`);
      assert.deepEqual(over.wide, [], `${where}: content wider than the screen`);
      if (label === "desktop") {
        const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
        for (const href of links) {
          const u = new URL(href);
          if (u.origin !== new URL(ORIGIN).origin) {
            assert.match(u.protocol, /^https:$/, `${where}: external link should be https: ${href}`);
            continue;
          }
          const key = u.pathname + u.hash;
          if (checked.has(key)) continue;
          checked.add(key);
          assert.equal(await status(u.pathname), 200, `${where}: broken link ${href}`);
          if (u.hash) {
            const html = await (await fetch(ORIGIN + u.pathname)).text();
            assert.ok(html.includes(`id="${u.hash.slice(1)}"`), `${where}: missing anchor ${href}`);
          }
        }
      }
      if (shots && path !== "404.html") await page.screenshot({ path: `${shots}/fizlet-site-${label}${path ? "-quick-start" : ""}.png`, fullPage: true });
      assert.deepEqual(errors, [], `${where}: errors`);
      await page.close();
    }
    await context.close();
  }

  // ---------- 404 at any depth ----------
  where = "404";
  assert.equal(await status(`${BASE}missing/page`), 404);
  {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const { page, errors } = await open(context, "missing/page");
    assert.equal(await page.locator("h1").textContent(), "This square is off the board.");
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector(".site-head")).position === "sticky"), "404 is styled from any depth");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- The live demo ----------
  where = "demo";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "");
    const stats = () => page.evaluate(() => window.fizletDemo.engine.stats());
    await page.waitForFunction(() => window.fizletDemo?.engine.stats().frames > 20);
    const board = page.locator("[data-board]");
    const box = await board.boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.25);
    await page.waitForFunction(() => window.fizletDemo.fx.live > 0);
    await page.click("[data-blast]");
    await page.waitForTimeout(700);
    let s = await stats();
    assert.ok(s.steps > 30 && s.frames > 20, "the engine steps");
    assert.ok(s.ledger > 0, "blasts changed the page through the ledger");
    assert.equal(s.pools.waves.cap, 8);
    assert.equal(await page.evaluate(() => window.fizletDemo.engine.violations), 0, "no layout reads in a step");
    const moved = await page.evaluate(() => [...document.querySelectorAll("[data-body]")].filter((el) => el.style.transform).length);
    assert.ok(moved > 3, `letters were knocked (${moved})`);
    assert.equal(await page.locator("[data-state]").textContent(), "RUNNING");
    await page.waitForTimeout(150);
    assert.notEqual(await page.locator('[data-stat="frames"]').textContent(), "0", "the HUD shows live stats");
    // Recall: the page comes back exactly.
    await page.click("[data-recall]");
    const back = await page.evaluate(() => ({
      text: document.querySelector(".demo-title").textContent,
      styled: [...document.querySelectorAll("[data-page], [data-page] *")].filter((el) => el.hasAttribute("style")).length,
      hot: document.querySelectorAll(".hot").length,
      ledger: window.fizletDemo.engine.ledger.size,
    }));
    assert.deepEqual(back, { text: "Hello, page.", styled: 0, hot: 0, ledger: 0 }, "Recall restores the page");
    assert.equal(await page.locator("[data-slam]").isVisible(), true, "the RESTORED sticker slams in");
    // Scrolled away: the engine pauses (and costs nothing).
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => window.fizletDemo.engine.paused.includes("offscreen"));
    const frozen = (await stats()).frames;
    await page.waitForTimeout(300);
    assert.equal((await stats()).frames, frozen, "no frames while off screen");
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => window.fizletDemo.engine.running);
    // The theme toggle (shared key with DOM VIRUS and Battlefield).
    await page.click("[data-theme-toggle]");
    assert.equal(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("dom-virus:theme")].join()), "light,light");
    // The hosted ES modules from the quick start load.
    const mods = await page.evaluate(async () => {
      const k = await import("/fizlet/dist/index.js"), fx = await import("/fizlet/dist/fx.js"), input = await import("/fizlet/dist/input.js");
      return [typeof k.createEngine, typeof fx.effects, typeof input.controls].join();
    });
    assert.equal(mods, "function,function,function");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- Reduced motion: a still frame, never an animation ----------
  where = "reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "");
    await page.waitForFunction(() => window.fizletDemo);
    assert.equal(await page.evaluate(() => window.fizletDemo.engine.running), false, "paused under reduced motion");
    assert.match(await page.locator("[data-state]").textContent(), /STILL/);
    await page.locator("[data-board]").click({ position: { x: 60, y: 50 } });
    const r = await page.evaluate(() => ({ ledger: window.fizletDemo.engine.ledger.size, live: window.fizletDemo.fx.live, running: window.fizletDemo.engine.running }));
    assert.ok(r.ledger > 0, "the click still lands (straight to the end state)");
    assert.equal(r.live, 0, "no particles left in flight: a still frame");
    assert.equal(r.running, false);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // ---------- The quick start example runs ----------
  where = "quick start";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "examples/quick-start.html");
    await page.locator("#board").click({ position: { x: 200, y: 100 } });
    await page.waitForTimeout(120);
    const ink = await page.evaluate(() => {
      const c = document.getElementById("board"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    assert.ok(ink > 500, `the blast drew (${ink} px)`);
    assert.equal(await page.evaluate(() => typeof window.fizlet.createEngine), "function", "window.fizlet from the script tag");
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`site: ${PAGES.length} pages × 2 widths, ${checked.size} internal links, demo, reduced motion and quick start ok`);
} catch (err) {
  console.error(`site test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
  server.close();
}
