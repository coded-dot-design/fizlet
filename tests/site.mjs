// Site test (Playwright + Chromium): serves site-dist/ at /fizlet/ (as GitHub Pages does) and checks
// every page at desktop and phone widths: no console errors, every internal link (and #anchor)
// resolves, no horizontal overflow at 360px, the live demo runs (blast, ledger, Recall, pause
// offscreen, reduced motion still frame), the quick start example works, the hosted modules load,
// every page passes the SEO and accessibility gates (scripts/check-html.mjs), every brick page shows
// the size measured on this build, and the brick demos run (settle sleeps, fx, grid, sprite, sound).
// Run `npm run site` first. SITE_SHOTS=<dir> also saves screenshots.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { checkHtml } from "../scripts/check-html.mjs";
import { measure } from "../scripts/sizes.mjs";
import { BRICKS } from "../site/bricks.mjs";
import { entries as galleryEntries } from "../scripts/gallery.mjs";
import { gzipSync } from "node:zlib";

const ROOT = "site-dist", BASE = "/fizlet/";
if (!existsSync(`${ROOT}/index.html`)) throw new Error("site-dist/ is missing: run `npm run site` first");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".ts": "text/plain", ".png": "image/png", ".xml": "application/xml" };

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

// Every built page, at its URL path ("" is the home page, "bricks/" the bricks index).
const PAGES = readdirSync(ROOT, { recursive: true }).filter((f) => f.endsWith(".html") && !f.startsWith("dist")).map((f) => f.replace(/\\/g, "/").replace(/(^|\/)index\.html$/, "$1")).sort();
for (const b of BRICKS) assert.ok(PAGES.includes(`bricks/${b.id}.html`), `a page for ${b.name}`);
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
  // ---------- SEO and accessibility gates, on the built HTML ----------
  where = "html gates";
  // Pages written by the demos' own build scripts (site/demos/fizz, site/demos/layers) are
  // standalone host pages; their open gaps are listed exactly, so a new gap or a fix both fail here
  // until this list is updated.
  const SEO = ["og:type", "og:title", "og:description", "og:url", "og:image", "og:site_name"].map((p) => `<meta property="${p}">`);
  const SOCIAL = (path) => [`canonical is https://coded-dot-design.github.io/fizlet/${path}`, ...SEO, "og:url matches the canonical", "a <header> landmark", "a <nav> landmark", "a <footer> landmark"];
  const KNOWN = {
    "demos/fizz/": ["heading levels in <main> skip from h1 to h3"],
    "demos/layers/": SOCIAL("demos/layers/"),
    "examples/fizz/": ["meta description 50–300 characters (0)", ...SOCIAL("examples/fizz/")],
  };
  for (const path of PAGES) {
    const file = path === "" || path.endsWith("/") ? `${path}index.html` : path;
    const want = KNOWN[path] ?? [];
    assert.deepEqual(checkHtml(readFileSync(`${ROOT}/${file}`, "utf8"), path).sort(), [...want].sort(), `${path || "index"}: html gates`);
  }
  const sitemap = readFileSync(`${ROOT}/sitemap.xml`, "utf8");
  for (const path of PAGES.filter((p) => p !== "404.html")) assert.ok(sitemap.includes(`<loc>https://coded-dot-design.github.io/fizlet/${path}</loc>`), `sitemap lists ${path || "index"}`);
  assert.equal(await status(`${BASE}og.png`), 200, "the social card");

  // ---------- Brick pages: the sizes are the ones measured on this build ----------
  where = "brick sizes";
  {
    const sizes = await measure();
    for (const b of BRICKS) {
      const html = readFileSync(`${ROOT}/bricks/${b.id}.html`, "utf8");
      for (const name of b.sizes) {
        const s = sizes.find((x) => x.name === name);
        assert.ok(html.includes(`data-size="${name}">${s.gzip.toLocaleString("en-US")} B</b>`), `${b.id}: ${name} shows ${s.gzip} B`);
      }
    }
    const pb = sizes.find((x) => x.name.startsWith("page build"));
    assert.ok(readFileSync(`${ROOT}/index.html`, "utf8").includes(`${pb.gzip.toLocaleString("en-US")} B</b>`), "home: the page build size");
  }

  // ---------- Gallery: newest first, a size badge measured on this build on every entry ----------
  where = "gallery sizes";
  const GALLERY = galleryEntries();
  {
    const html = readFileSync(`${ROOT}/gallery/index.html`, "utf8");
    assert.deepEqual([...html.matchAll(/<li class="panel gal-item" id="([^"]+)"/g)].map((m) => m[1]), GALLERY.map((e) => e.id), "entries in order, newest first");
    for (let i = 1; i < GALLERY.length; i++) assert.ok(GALLERY[i - 1].date >= GALLERY[i].date, "newest first");
    for (const e of GALLERY) {
      const bytes = gzipSync(readFileSync(`${ROOT}/gallery/${e.id}.js`)).length;
      assert.ok(html.includes(`data-size="gallery:${e.id}"><b>${bytes.toLocaleString("en-US")} B</b>`), `${e.id}: its badge shows ${bytes} B`);
      assert.ok(html.includes(`“${e.prompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}”`), `${e.id}: its prompt`);
    }
    for (const id of ["fizz", "layers", "howitworks"]) assert.ok(GALLERY.some((e) => e.id === id), `seeded with ${id}`);
  }

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
          // A slot's scene (figure.ae-slot) clips its own stage: what it draws past its edge is cut, by design.
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX) || p.matches("figure.ae-slot")) return false;
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
      if (shots && path !== "404.html") await page.screenshot({ path: `${shots}/fizlet-site-${label}${path ? "-" + path.replace(/\W+/g, "-").replace(/-html$|-$/, "") : ""}.png`, fullPage: true });
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
    // The blast demo sits below the hero: it runs only once on screen.
    const toDemo = () => page.evaluate(() => document.querySelector("[data-demo]").scrollIntoView({ block: "center" }));
    await toDemo();
    await page.waitForFunction(() => window.fizletDemo?.engine.stats().frames > 20);
    const board = page.locator("[data-demo] [data-board]");
    const box = await board.boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.25);
    await page.waitForFunction(() => window.fizletDemo.fx.live > 0);
    await page.click("[data-demo] [data-blast]");
    await page.waitForTimeout(700);
    let s = await stats();
    assert.ok(s.steps > 30 && s.frames > 20, "the engine steps");
    assert.ok(s.ledger > 0, "blasts changed the page through the ledger");
    assert.equal(s.pools.waves.cap, 8);
    assert.equal(await page.evaluate(() => window.fizletDemo.engine.violations), 0, "no layout reads in a step");
    const moved = await page.evaluate(() => [...document.querySelectorAll("[data-body]")].filter((el) => el.style.transform).length);
    assert.ok(moved > 3, `letters were knocked (${moved})`);
    assert.equal(await page.locator("[data-demo] [data-state]").textContent(), "RUNNING");
    await page.waitForTimeout(150);
    assert.notEqual(await page.locator('[data-demo] [data-stat="frames"]').textContent(), "0", "the HUD shows live stats");
    // Recall: the page comes back exactly.
    await page.click("[data-demo] [data-recall]");
    const back = await page.evaluate(() => ({
      text: document.querySelector(".demo-title").textContent,
      styled: [...document.querySelectorAll("[data-page], [data-page] *")].filter((el) => el.hasAttribute("style")).length,
      hot: document.querySelectorAll(".hot").length,
      ledger: window.fizletDemo.engine.ledger.size,
    }));
    assert.deepEqual(back, { text: "Hello, page.", styled: 0, hot: 0, ledger: 0 }, "Recall restores the page");
    assert.equal(await page.locator("[data-demo] [data-slam]").isVisible(), true, "the RESTORED sticker slams in");
    // Scrolled away: the engine pauses (and costs nothing).
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => window.fizletDemo.engine.paused.includes("offscreen"));
    const frozen = (await stats()).frames;
    await page.waitForTimeout(300);
    assert.equal((await stats()).frames, frozen, "no frames while off screen");
    await toDemo();
    await page.waitForFunction(() => window.fizletDemo.engine.running);
    // The home page also carries the two story demos: the layers hero and the fizz can.
    assert.equal(await page.locator("figure.lyr[data-slot-target]").count(), 1, "the layers hero");
    assert.equal(await page.locator("[data-slot='fizz'] figure.ae-slot[data-slot-target='fizz#hero']").count(), 1, "the fizz can in the story");
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

  // ---------- Gallery: each live demo loads only near the screen, plays, and gives the page back ----------
  where = "gallery";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const { page, errors } = await open(context, "gallery/");
    const loaded = [];
    page.on("request", (r) => r.url().includes("/gallery/") && r.url().endsWith(".js") && loaded.push(r.url().split("/gallery/")[1]));
    await page.waitForTimeout(600);
    const last = GALLERY[GALLERY.length - 1].id;
    assert.ok(!loaded.includes(`${last}.js`), `${last} (far below) has not loaded yet`);
    for (const e of GALLERY) {
      await page.$eval(`#${e.id}`, (el) => el.scrollIntoView({ block: "center" }));
      await page.waitForSelector(`figure[data-gallery="${e.id}"][data-live]`, { timeout: 8000 });
      await page.waitForFunction((id) => document.querySelector(`figure[data-gallery="${id}"] > :not(.ae-slot__placeholder):not(template)`), e.id, { timeout: 8000 });
    }
    assert.deepEqual(GALLERY.map((e) => e.id).filter((id) => !loaded.includes(`${id}.js`)), [], "every entry mounted");
    // A generated spray draws on a tap.
    const spray = GALLERY.find((e) => e.made === "fe anim");
    if (spray) {
      const fig = page.locator(`figure[data-gallery="${spray.id}"]`);
      await fig.scrollIntoViewIfNeeded();
      await fig.click({ position: { x: 120, y: 80 } });
      await page.waitForTimeout(120);
      const ink = await page.$eval(`figure[data-gallery="${spray.id}"] canvas`, (c) => {
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return n;
      });
      assert.ok(ink > 30, `${spray.id}: a tap sprays (${ink} px)`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  where = "gallery, reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "gallery/");
    const loaded = [];
    page.on("request", (r) => r.url().includes("/gallery/") && r.url().endsWith(".js") && !r.url().endsWith("gallery.js") && loaded.push(r.url()));
    for (const e of GALLERY) await page.$eval(`#${e.id}`, (el) => el.scrollIntoView({ block: "center" })), await page.waitForTimeout(250);
    assert.deepEqual(loaded, [], "reduced motion: no scene loads, the posters stay");
    assert.equal(await page.locator("figure[data-gallery] .ae-slot__placeholder").count(), GALLERY.length);
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
    assert.match(await page.locator("[data-demo] [data-state]").textContent(), /STILL/);
    await page.locator("[data-demo] [data-board]").click({ position: { x: 60, y: 50 } });
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
  // ---------- Brick demos ----------
  where = "brick demos";
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const ink = (page) => page.evaluate(() => {
      const c = document.querySelector(".bd-canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    // Kernel: settle. A click wakes the engine; once the puck stops it sleeps and frames stop.
    let { page, errors } = await open(context, "bricks/kernel.html");
    await page.waitForSelector("[data-brick-demo][data-ready]");
    const statusText = () => page.locator("[data-status]").textContent();
    await page.waitForFunction(() => /SETTLED/.test(document.querySelector("[data-status]").textContent), null, { timeout: 5000 });
    await page.locator(".bd-canvas").click({ position: { x: 60, y: 40 } });
    await page.waitForTimeout(100);
    assert.match(await statusText(), /RUNNING/, "a click wakes it");
    await page.waitForFunction(() => /SETTLED/.test(document.querySelector("[data-status]").textContent), null, { timeout: 5000 });
    const a = await statusText();
    await page.waitForTimeout(700);
    assert.equal(await statusText(), a, "no frames once settled");
    assert.deepEqual(errors, []);
    await page.close();
    // fx: a click blasts.
    ({ page, errors } = await open(context, "bricks/fx.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 300, y: 120 } });
    await page.waitForTimeout(120);
    assert.ok((await ink(page)) > 500, "the blast drew");
    assert.deepEqual(errors, []);
    await page.close();
    // grid: a click finds a path (or says there is none).
    ({ page, errors } = await open(context, "bricks/grid.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 300, y: 120 } });
    assert.match(await statusText(), /steps · \d+ cells searched|NO PATH/);
    assert.ok((await ink(page)) > 500, "the board drew");
    assert.deepEqual(errors, []);
    await page.close();
    // sprite: drawn on the canvas and as an <img> with alt text.
    ({ page, errors } = await open(context, "bricks/sprite.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    assert.ok((await ink(page)) > 200, "the sprites drew");
    assert.ok(await page.evaluate(() => { const i = document.querySelector(".bd-img"); return i.complete && i.naturalWidth > 0 && i.alt.length > 0; }), "the SVG sprite image loads");
    assert.deepEqual(errors, []);
    await page.close();
    // sound: a key per cue; a press wakes the engine.
    ({ page, errors } = await open(context, "bricks/sound.html"));
    await page.waitForSelector("[data-brick-demo][data-ready]");
    assert.equal(await page.locator(".bd-key").count(), 9);
    await page.locator(".bd-key").first().click();
    assert.match(await statusText(), /RUNNING/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  // Reduced motion: the demos show a still frame and never run.
  where = "brick demos, reduced motion";
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const { page, errors } = await open(context, "bricks/fx.html");
    await page.waitForSelector("[data-brick-demo][data-ready]");
    await page.locator(".bd-canvas").click({ position: { x: 100, y: 40 } });
    assert.match(await page.locator("[data-status]").textContent(), /REDUCED-MOTION/);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`site: ${PAGES.length} pages × 2 widths, html gates, gallery (${GALLERY.length} entries), ${checked.size} internal links, demo, brick demos, reduced motion and quick start ok`);
} catch (err) {
  console.error(`site test failed at: ${where}`);
  throw err;
} finally {
  await browser.close();
  server.close();
}
